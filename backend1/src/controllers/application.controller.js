const { prisma } = require('../lib/prisma');
const { createCandidateNotification } = require('../services/notification.service');
const { scheduleCandidateCommonSync } = require('../services/candidateCommonSync.service');
const {
  resolvePublicCompanyName,
  shouldShowClientNamePublicly,
  CONFIDENTIAL_COMPANY_LABEL,
} = require('../utils/formatPortalJob.util');

/** True for Prisma Mongo write conflicts / transient transaction failures (case + message fallbacks). */
function isMongoTransientWriteConflict(e) {
  if (!e) return false;
  const code = e.code;
  if (code === 'P2034' || code === 2034) return true;
  const msg = String(e.message || '').toLowerCase();
  return msg.includes('write conflict') || msg.includes('deadlock') || msg.includes('please retry your transaction');
}

/** MongoDB (replica set) can surface Prisma P2034 on conflicting writes — retry with backoff per Prisma docs. */
async function withMongoWriteConflictRetry(fn, maxAttempts = 12) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (e.code === 'ALREADY_APPLIED') throw e;
      if (isMongoTransientWriteConflict(e) && attempt < maxAttempts - 1) {
        const backoff = Math.min(2000, 40 * 2 ** attempt + Math.floor(Math.random() * 80));
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

function splitFullName(fullName) {
  const value = String(fullName || '').trim();
  if (!value) return { firstName: null, lastName: null };

  const parts = value.split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(' ') || null,
  };
}

function calculateExperienceYears(workExperiences) {
  if (!Array.isArray(workExperiences) || workExperiences.length === 0) return null;

  const totalMs = workExperiences.reduce((sum, item) => {
    const start = item?.startDate ? new Date(item.startDate).getTime() : null;
    const end = item?.isCurrentJob ? Date.now() : item?.endDate ? new Date(item.endDate).getTime() : Date.now();
    if (!start || Number.isNaN(start) || Number.isNaN(end) || end < start) return sum;
    return sum + (end - start);
  }, 0);

  if (!totalMs) return null;
  return Math.max(0, Math.round(totalMs / (1000 * 60 * 60 * 24 * 365)));
}

function splitResponsibilities(value) {
  const text = String(value || '').trim();
  if (!text) return [];

  return text
    .split(/\r?\n|[.;]\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatApplicationStatus(status) {
  const statusMap = {
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    SHORTLISTED: 'Shortlisted',
    ASSESSMENT: 'Assessment',
    INTERVIEW: 'Interview',
    FINAL_DECISION: 'Final Decision',
    SELECTED: 'Selected',
    REJECTED: 'Rejected',
  };

  return statusMap[status] || status || 'Submitted';
}

/**
 * Derive the per-application "current pipeline stage" label using ONLY
 * per-application signals — never the global `candidate.stage`, which can
 * be stale or inherited from an unrelated job. Used by both
 * `getApplications` (list) and `getApplicationById` (detail) so the portal
 * card and the detail view always agree, and a freshly submitted Job B
 * never inherits "Rejected" from a previously-rejected Job A.
 */
function deriveApplicationPipelineStage({
  pipelineStageName,
  appStatus,
  matchStatus,
  timelineStatuses,
}) {
  const pipelineText = String(pipelineStageName || '').trim();
  if (pipelineText) return pipelineText;

  const appU = String(appStatus || '').toUpperCase();
  if (appU === 'REJECTED') return 'Rejected';

  if (Array.isArray(timelineStatuses)) {
    const latest = [...timelineStatuses]
      .map((s) => String(s || '').toUpperCase())
      .filter(Boolean);
    if (latest.includes('REJECTED')) return 'Rejected';
    const lastStrong = [...latest]
      .reverse()
      .find((s) =>
        ['INTERVIEW', 'SHORTLISTED', 'ASSESSMENT', 'FINAL_DECISION', 'SELECTED'].includes(s)
      );
    if (lastStrong) return formatApplicationStatus(lastStrong);
  }

  if (appStatus) return formatApplicationStatus(appStatus);

  const matchU = String(matchStatus || '').toUpperCase();
  if (matchU) {
    if (matchU === 'REJECTED') return 'Rejected';
    if (matchU === 'HIRED' || matchU === 'PLACED') return 'Hired';
    if (matchU === 'OFFER' || matchU === 'OFFERED') return 'Offer';
    if (matchU === 'INTERVIEW' || matchU === 'INTERVIEWING' || matchU === 'INTERVIEW_SCHEDULED') {
      return 'Interview';
    }
    if (matchU === 'SHORTLISTED') return 'Shortlisted';
    if (matchU === 'REVIEWED') return 'Under Review';
  }

  return 'Submitted';
}

function formatMatchStatus(status) {
  const statusMap = {
    REVIEWED: 'Under Review',
    SHORTLISTED: 'Shortlisted',
    INTERVIEW: 'Interview',
    INTERVIEWING: 'Interview',
    INTERVIEW_SCHEDULED: 'Interview',
    OFFER: 'Offer',
    OFFERED: 'Offer',
    PLACED: 'Hired',
    HIRED: 'Hired',
    REJECTED: 'Rejected',
  };
  return statusMap[String(status || '').toUpperCase()] || null;
}

/**
 * Compute the chip + progress label for ONE application row on the candidate
 * portal. Designed to be resilient to multi-job candidates and stale
 * application enums.
 *
 * Priority order:
 *   1. Application.status === REJECTED                      (per-application terminal)
 *   2. Any ApplicationTimeline entry with status REJECTED   (covers older CRM
 *      rejects that flipped the timeline but never the enum, and any reject
 *      flow without a `jobId`)
 *   3. Match.status === REJECTED                            (recruiter view)
 *   4. Per-job pipeline stage name containing "reject"
 *   5. Strong Application enum (INTERVIEW / FINAL_DECISION / etc.)
 *   6. Pipeline stage name / match text / candidate.stage   (display fallbacks)
 *
 * IMPORTANT: `candidate.stage` is a SINGLE field on the candidate row and gets
 * overwritten by the apply flow every time the candidate applies to a new job.
 * It therefore CANNOT be trusted to detect rejection on a specific older
 * application — only the per-application signals (1-4) are.
 */
function resolveApplicationDisplayStatus({
  appStatus,
  matchStatus,
  candidateStage,
  pipelineStageName,
  timelineStatuses,
}) {
  const appU = String(appStatus || '').toUpperCase();
  if (appU === 'REJECTED') {
    return formatApplicationStatus('REJECTED');
  }

  if (Array.isArray(timelineStatuses)) {
    const rejectedInTimeline = timelineStatuses.some(
      (s) => String(s || '').toUpperCase() === 'REJECTED'
    );
    if (rejectedInTimeline) {
      return formatApplicationStatus('REJECTED');
    }
  }

  const matchU = String(matchStatus || '').toUpperCase();
  if (matchU === 'REJECTED') {
    return formatMatchStatus(matchStatus) || 'Rejected';
  }

  const pipeLower = String(pipelineStageName || '').trim().toLowerCase();
  if (pipeLower.includes('reject')) {
    return pipelineStageName.trim();
  }

  const strongApp = new Set(['INTERVIEW', 'FINAL_DECISION', 'SELECTED', 'REJECTED', 'SHORTLISTED', 'ASSESSMENT']);
  if (appStatus && strongApp.has(appU)) {
    return formatApplicationStatus(appStatus);
  }

  if (appU === 'SUBMITTED' || appU === 'UNDER_REVIEW') {
    const pipeLooksTerminal =
      pipeLower.includes('hire') ||
      pipeLower.includes('placed') ||
      pipeLower.includes('joined') ||
      pipeLower.includes('onboard');
    if (pipeLooksTerminal) {
      return 'Applied';
    }
    const pipelineStageText = String(pipelineStageName || '').trim();
    if (pipelineStageText) return pipelineStageText;
    return formatApplicationStatus(appStatus) || 'Applied';
  }

  const pipelineStageText = String(pipelineStageName || '').trim();
  if (pipelineStageText) return pipelineStageText;

  const matchText = formatMatchStatus(matchStatus);
  if (matchText) return matchText;

  const stageText = String(candidateStage || '').trim();
  if (stageText) return stageText;

  return formatApplicationStatus(appStatus);
}

/**
 * Parse portal timeline description for interview rows (Phase 2 syncApplicationState stores lines here).
 */
/** Map Phase 2 / Prisma InterviewType-like tokens to candidate-friendly labels */
const INTERVIEW_TYPE_DISPLAY = new Map([
  ['PHONE', 'Phone screening'],
  ['VIDEO', 'Video interview'],
  ['IN_PERSON', 'In-person interview'],
  ['TECHNICAL_TEST', 'Technical test'],
  ['ASSESSMENT', 'Assessment'],
  ['GROUP_DISCUSSION', 'Group discussion'],
  ['ONSITE', 'On-site interview'],
  ['TECHNICAL', 'Technical round'],
  ['FINAL', 'Final interview'],
  ['SCREENING', 'HR screening'],
  ['HR_SCREENING', 'HR screening'],
]);

function humanizeInterviewTypeLabel(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s) return null;
  const upper = s.replace(/[\s_-]+/g, '_').toUpperCase();
  if (INTERVIEW_TYPE_DISPLAY.has(upper)) return INTERVIEW_TYPE_DISPLAY.get(upper);
  const compact = upper.replace(/_/g, '');
  for (const [k, v] of INTERVIEW_TYPE_DISPLAY) {
    if (k.replace(/_/g, '') === compact) return v;
  }
  const looksLikeEnum = /^[A-Z][A-Z0-9_]*$/i.test(s.replace(/\s+/g, '')) && /^[A-Z0-9 _-]+$/i.test(s);
  if (looksLikeEnum) {
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s;
}

function parseInterviewDetailsFromDescription(description, title) {
  const text = `${String(description || '')}\n${String(title || '')}`;
  const linkMatch = text.match(/https?:\/\/[^\s]+/i);
  const meetingLink = linkMatch ? linkMatch[0].replace(/[),.;]+$/, '') : null;
  let location = null;
  const locLine = text.split(/\r?\n/).find((l) => /^location\s*:/i.test(l.trim()));
  if (locLine) location = locLine.replace(/^location\s*:/i, '').trim();
  const whenLine = text.split(/\r?\n/).find((l) => /^when\s*:/i.test(l.trim()));
  let scheduledAt = null;
  if (whenLine) {
    const raw = whenLine.replace(/^when\s*:/i, '').trim();
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) scheduledAt = d.toISOString();
  }

  let typeFromLine = null;
  const typeLine = text.split(/\r?\n/).find((l) => /^type\s*:/i.test(l.trim()));
  if (typeLine) typeFromLine = typeLine.replace(/^type\s*:/i, '').trim() || null;

  let recruiterRound = null;
  const desc = String(description || '');
  const recruiterMatch = desc.match(/Recruiter scheduled\s+([^.]+\.?)/i);
  if (recruiterMatch) recruiterRound = recruiterMatch[1].replace(/\.$/, '').trim();

  // Names of the assigned interviewer(s) and recruiter who scheduled — written by
  // backendphase2 `buildInterviewTimelineDescription` as `Interviewer: A, B` and `Recruiter: C`.
  let interviewerNames = [];
  const interviewerLine = text.split(/\r?\n/).find((l) => /^interviewer(s)?\s*:/i.test(l.trim()));
  if (interviewerLine) {
    interviewerNames = interviewerLine
      .replace(/^interviewer(s)?\s*:/i, '')
      .split(/[,;|]/)
      .map((name) => name.trim())
      .filter(Boolean);
  }

  let recruiterName = null;
  const recruiterLine = text.split(/\r?\n/).find((l) => /^recruiter\s*:/i.test(l.trim()));
  if (recruiterLine) {
    recruiterName = recruiterLine.replace(/^recruiter\s*:/i, '').trim() || null;
  }

  return {
    meetingLink,
    location,
    scheduledAt,
    interviewType: typeFromLine,
    recruiterRound,
    interviewerNames,
    recruiterName,
  };
}

function buildInterviewRoundsFromTimeline(rawTimeline) {
  const rows = (rawTimeline || [])
    .filter((item) => String(item?.status || '').toUpperCase() === 'INTERVIEW')
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
  const total = rows.length;
  return rows.map((item, index) => {
    const parsed = parseInterviewDetailsFromDescription(item.description, item.title);
    const fromType = humanizeInterviewTypeLabel(parsed.interviewType);
    const fromRecruiter = humanizeInterviewTypeLabel(parsed.recruiterRound);
    const titleRaw = String(item.title || '').trim();
    const titleOK = titleRaw && !/^interview$/i.test(titleRaw);

    let roundLabel = fromType || fromRecruiter || (titleOK ? humanizeInterviewTypeLabel(titleRaw) : null);

    if (!roundLabel && total > 1) {
      roundLabel = `Round ${index + 1} of ${total}`;
    }

    return {
      timelineId: item.id,
      timelineTitle: item.title || 'Interview',
      scheduledAt: parsed.scheduledAt || (item.occurredAt ? new Date(item.occurredAt).toISOString() : null),
      roundLabel: roundLabel || null,
      format: null,
      meetingLink: parsed.meetingLink,
      location: parsed.location,
      notes: item.description || null,
      interviewerNames: Array.isArray(parsed.interviewerNames) ? parsed.interviewerNames : [],
      recruiterName: parsed.recruiterName || null,
    };
  });
}

function formatSalaryText(job) {
  const salary = job?.salary;
  if (salary && typeof salary === 'object') {
    if (salary.amount) return String(salary.amount);
    if (salary.min && salary.max) {
      const currency = salary.currency || '';
      const type = salary.type ? `/${String(salary.type).toLowerCase()}` : '';
      return `${currency}${salary.min} - ${currency}${salary.max}${type}`;
    }
  }

  if (job?.salaryMin && job?.salaryMax) {
    const currency = job.salaryCurrency || '';
    const type = job.salaryType ? `/${String(job.salaryType).toLowerCase()}` : '';
    return `${currency}${job.salaryMin} - ${currency}${job.salaryMax}${type}`;
  }

  return 'Not specified';
}

function normalizePortfolioLinks(links) {
  if (!Array.isArray(links)) return [];

  return links
    .map((item) => {
      if (typeof item === 'string') {
        const url = item.trim();
        return url ? { type: 'Link', url } : null;
      }

      if (!item || typeof item !== 'object') return null;
      const url = String(item.url || item.link || '').trim();
      if (!url) return null;

      return {
        type: String(item.type || item.label || 'Link').trim() || 'Link',
        url,
      };
    })
    .filter(Boolean);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeResumeSkills(skills) {
  return asArray(skills)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      return String(item.name || item.skill || item.title || item.languageName || '').trim();
    })
    .filter(Boolean);
}

function normalizeResumeLanguages(languages) {
  return asArray(languages)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      return String(item.name || item.language || item.languageName || '').trim();
    })
    .filter(Boolean);
}

function normalizeResumeEducationEntries(entries) {
  return asArray(entries)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        degree: String(item.degree || item.educationLevel || item.title || '').trim() || null,
        institution: String(item.institution || item.school || item.college || '').trim() || null,
        startYear: item.startYear || item.start_date || item.from || null,
        endYear: item.endYear || item.end_date || item.to || null,
      };
    })
    .filter(Boolean);
}

function normalizeResumeWorkEntries(entries) {
  return asArray(entries)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        title: String(item.title || item.jobTitle || item.role || '').trim() || null,
        company: String(item.company || item.organization || '').trim() || null,
        location: String(item.location || item.workLocation || '').trim() || null,
        startDate: String(item.startDate || item.start_date || item.from || '').trim() || null,
        endDate: String(item.endDate || item.end_date || item.to || '').trim() || null,
        responsibilities: splitResponsibilities(
          Array.isArray(item.responsibilities) ? item.responsibilities.join('. ') : item.responsibilities || item.description || ''
        ),
      };
    })
    .filter(Boolean);
}

async function syncApplicationToRecruiterView(candidateId, job) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      profile: true,
      resume: true,
      summary: true,
      portfolioLinks: true,
      educations: {
        orderBy: [{ endYear: 'desc' }, { startYear: 'desc' }],
        take: 3,
      },
      skills: {
        include: {
          skill: {
            select: { name: true },
          },
        },
      },
      languages: true,
      workExperiences: {
        orderBy: { startDate: 'desc' },
      },
      careerPreferences: true,
    },
  });

  if (!candidate) return;

  const resumeJson =
    candidate.resume?.resumeJson && typeof candidate.resume.resumeJson === 'object'
      ? candidate.resume.resumeJson
      : {};
  const { firstName, lastName } = splitFullName(candidate.profile?.fullName);
  const latestWork = candidate.workExperiences?.[0];
  const educationSummary = candidate.educations?.[0]
    ? [candidate.educations[0].degree, candidate.educations[0].specialization].filter(Boolean).join(' - ')
    : null;
  const recruiterSkills = (candidate.skills || []).map((item) => item.skill?.name).filter(Boolean);
  const recruiterLanguages = (candidate.languages || []).map((item) => item.name).filter(Boolean);
  const resumeSkills = normalizeResumeSkills(resumeJson.skills);
  const resumeLanguages = normalizeResumeLanguages(resumeJson.languages);
  const assignedJobs = Array.from(new Set([...(candidate.assignedJobs || []), job.id]));
  const cvEducationEntries = (candidate.educations || []).map((item) => ({
    degree: item.degree || null,
    institution: item.institution || null,
    startYear: item.startYear || null,
    endYear: item.endYear || (item.isOngoing ? 'Present' : null),
  }));
  const cvWorkExperienceEntries = (candidate.workExperiences || []).map((item) => ({
    title: item.jobTitle || null,
    company: item.company || null,
    location: item.workLocation || null,
    startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : null,
    endDate: item.isCurrentJob ? 'Present' : item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : null,
    responsibilities: splitResponsibilities(item.responsibilities),
  }));
  const cvPortfolioLinks = normalizePortfolioLinks(candidate.portfolioLinks?.links);
  const fallbackEducationEntries = normalizeResumeEducationEntries(resumeJson.education);
  const fallbackWorkEntries = normalizeResumeWorkEntries(
    resumeJson.workExperience || resumeJson.experience
  );
  const resumePersonalInfo = resumeJson.personalInformation || resumeJson.personalInfo || {};
  const resumeSummary = String(resumeJson.summary || '').trim() || null;
  const resumeCertifications = asArray(resumeJson.certifications)
    .map((item) => (typeof item === 'string' ? item.trim() : String(item?.name || item?.title || '').trim()))
    .filter(Boolean);

  // Stage-flip policy on a fresh portal apply (mirrors backendphase2
  // applyPortalApplicationSync — keep the two backends in agreement):
  //  • Rejected → Applied  ✅ (re-activate the candidate; lifetime activity
  //    log stays intact because Activity rows are append-only on entityId).
  //  • Hired / Placed / Joined / Onboarded → keep terminal (positive
  //    outcomes must NOT silently regress just because the candidate
  //    browsed a new posting; per-application status chips remain correct
  //    via the per-Application enum and per-app pipelineStage anyway).
  //  • Anything else → Applied.
  const previousStageLower = String(candidate.stage || '').trim().toLowerCase();
  const stageIsPositiveTerminal =
    previousStageLower.includes('hire') ||
    previousStageLower === 'placed' ||
    previousStageLower === 'joined' ||
    previousStageLower === 'onboarded';
  const nextStage = stageIsPositiveTerminal ? candidate.stage : 'Applied';

  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      firstName: firstName || resumePersonalInfo.fullName?.split?.(' ')?.[0] || candidate.firstName || null,
      lastName:
        lastName ||
        (typeof resumePersonalInfo.fullName === 'string'
          ? resumePersonalInfo.fullName.split(' ').slice(1).join(' ') || null
          : null) ||
        candidate.lastName ||
        null,
      email: candidate.profile?.email || candidate.email || resumePersonalInfo.email || null,
      phone: candidate.profile?.phoneNumber || candidate.whatsappNumber || candidate.phone || resumePersonalInfo.phoneNumber || null,
      linkedIn: candidate.profile?.linkedinUrl || candidate.linkedIn || resumePersonalInfo.linkedinUrl || null,
      resumeUrl: candidate.resume?.fileUrl || candidate.resumeUrl || null,
      recruiterSkills: recruiterSkills.length ? recruiterSkills : resumeSkills,
      experienceYears: calculateExperienceYears(candidate.workExperiences),
      currentTitle: latestWork?.jobTitle || candidate.currentTitle || null,
      currentCompany: latestWork?.company || candidate.currentCompany || null,
      location: latestWork?.workLocation || candidate.location || candidate.profile?.city || resumePersonalInfo.city || null,
      addressLine: candidate.profile?.address || candidate.addressLine || resumePersonalInfo.address || null,
      city: candidate.profile?.city || candidate.city || resumePersonalInfo.city || null,
      country: candidate.profile?.country || candidate.country || resumePersonalInfo.country || null,
      recruiterStatus: 'ACTIVE',
      source: candidate.source || 'Job Portal Application',
      availability: candidate.careerPreferences?.availabilityToStart || candidate.availability || null,
      noticePeriod: candidate.careerPreferences?.noticePeriod || candidate.noticePeriod || null,
      avatar: candidate.profile?.profilePhotoUrl || candidate.avatar || null,
      designation: latestWork?.jobTitle || candidate.designation || null,
      expectedSalary: candidate.careerPreferences?.preferredSalary || candidate.expectedSalary || null,
      currentSalary: candidate.careerPreferences?.currentSalary || candidate.currentSalary || null,
      recruiterEducation: educationSummary || candidate.recruiterEducation || fallbackEducationEntries[0]?.degree || null,
      recruiterLanguages: recruiterLanguages.length ? recruiterLanguages : resumeLanguages,
      certificationsList: resumeCertifications,
      cvSummary: candidate.summary?.summaryText || candidate.cvSummary || resumeSummary,
      cvEducationEntries: cvEducationEntries.length ? cvEducationEntries : fallbackEducationEntries,
      cvWorkExperienceEntries: cvWorkExperienceEntries.length ? cvWorkExperienceEntries : fallbackWorkEntries,
      cvPortfolioLinks,
      preferredLocation:
        candidate.careerPreferences?.preferredLocations?.[0] ||
        candidate.profile?.city ||
        candidate.profile?.country ||
        candidate.preferredLocation ||
        null,
      assignedJobs,
      stage: nextStage,
      lastActivity: new Date(),
    },
  });

  scheduleCandidateCommonSync(candidateId);

  const existingMatch = await prisma.match.findFirst({
    where: { candidateId, jobId: job.id },
    select: { id: true },
  });

  if (!existingMatch) {
    await prisma.match.create({
      data: {
        candidateId,
        jobId: job.id,
        score: 75,
        status: 'REVIEWED',
        notes: 'Applied from candidate portal',
        createdById: job.createdById || job.assignedToId || undefined,
      },
    });
  }

  const firstStage = await prisma.pipelineStage.findFirst({
    where: { jobId: job.id },
    orderBy: { order: 'asc' },
    select: { id: true },
  });

  if (!firstStage) return;

  const existingPipelineEntry = await prisma.pipelineEntry.findFirst({
    where: { candidateId, jobId: job.id },
    select: { id: true },
  });

  if (!existingPipelineEntry) {
    await prisma.pipelineEntry.create({
      data: {
        candidateId,
        jobId: job.id,
        stageId: firstStage.id,
        movedById: job.createdById || job.assignedToId || undefined,
        notes: 'Applied from candidate portal',
      },
    });
  }
}

/**
 * Mirror the portal apply into the Phase 2 tenant DB (assignedJobs merge, match,
 * pipeline, stage engine, activity feed).
 *
 * Multi-agency design:
 *  - Each portal Job document now carries `tenantDbName` (written by the CRM at
 *    job-mirror time) — read it from the Job here and pass to the webhook so the
 *    apply lands in the correct tenant DB no matter how many agencies share the
 *    portal. No per-deployment env-var configuration is required for routing.
 *  - `PHASE2_DEFAULT_TENANT_DB_NAME` is only used as a fallback for legacy jobs
 *    that were mirrored before this field existed.
 *  - `PHASE2_INTERNAL_API_URL` defaults to the typical local CRM dev port.
 *  - `PHASE2_PORTAL_SYNC_SECRET` is the shared secret for the webhook auth; both
 *    backends ship a sane local default so dev environments work out of the box.
 */
async function syncPhase2TenantAfterPortalApply(candidateId, jobId) {
  const base =
    process.env.PHASE2_INTERNAL_API_URL ||
    process.env.PHASE2_API_URL ||
    process.env.PHASE2_BASE_URL ||
    'http://localhost:5001';
  const secret =
    process.env.PHASE2_PORTAL_SYNC_SECRET || 'phase2-portal-sync-2026-shared-secret';

  // Resolve which tenant DB this job belongs to.
  // 1. Read from the portal Job's `tenantDbName` (preferred — multi-agency safe).
  // 2. Fall back to `PHASE2_DEFAULT_TENANT_DB_NAME` env var for legacy jobs.
  let tenantDbName = null;
  let assignedJobsSnapshot = [];
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { tenantDbName: true },
    });
    tenantDbName = String(job?.tenantDbName || '').trim() || null;
  } catch (e) {
    console.warn('[Application] Could not read job.tenantDbName:', e?.message || e);
  }
  if (!tenantDbName) {
    tenantDbName = String(process.env.PHASE2_DEFAULT_TENANT_DB_NAME || '').trim() || null;
  }

  if (!tenantDbName) {
    console.warn(
      `[Application] Phase2 tenant sync skipped — no tenantDbName on Job ${jobId} and no PHASE2_DEFAULT_TENANT_DB_NAME env fallback. ` +
        `Set tenantDbName on the portal Job (CRM job-mirror writes it now) or configure the env default.`
    );
    return;
  }

  try {
    const c = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { assignedJobs: true },
    });
    if (Array.isArray(c?.assignedJobs)) {
      assignedJobsSnapshot = c.assignedJobs;
    }
  } catch (e) {
    console.warn('[Application] Could not load candidate for Phase2 sync:', e?.message || e);
  }

  const url = `${String(base).replace(/\/$/, '')}/api/v1/internal/sync-portal-application`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-phase2-portal-sync-secret': secret,
      },
      body: JSON.stringify({
        tenantDbName,
        candidateId,
        jobId,
        assignedJobsSnapshot,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[Application] Phase2 tenant sync HTTP error:', res.status, text);
    } else {
      console.log(
        `✅ Phase2 tenant sync ok | candidateId=${candidateId} jobId=${jobId} tenantDbName=${tenantDbName}`
      );
    }
  } catch (e) {
    console.warn('[Application] Phase2 tenant sync failed:', e?.message || e);
  }
}

/**
 * Create a new job application
 * POST /api/applications
 */
async function createApplication(req, res) {
  try {
    const { candidateId, jobId, screeningAnswers } = req.body;

    if (!candidateId || !jobId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID and Job ID are required',
      });
    }

    // Verify IDs are valid ObjectIds (24-char hex)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(candidateId) || !objectIdRegex.test(jobId)) {
      console.warn(`[Application] Invalid ID format: candidateId=${candidateId}, jobId=${jobId}`);
      return res.status(400).json({
        success: false,
        message: candidateId === 'guest' ? 'Please log in to apply for jobs' : 'Invalid ID format provided',
      });
    }

    // Check if application already exists
    const existingApplication = await prisma.application.findUnique({
      where: {
        candidateId_jobId: {
          candidateId,
          jobId,
        },
      },
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied to this job',
        data: {
          applicationId: existingApplication.id,
        },
      });
    }

    // Verify job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true, client: true },
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    let application;

    try {
      // Avoid interactive multi-write transactions: they trigger P2034 on Mongo far more often than
      // two separate writes. Duplicate applies are still blocked by @@unique([candidateId, jobId]).
      application = await withMongoWriteConflictRetry(
        () =>
          prisma.application.create({
            data: {
              candidateId,
              jobId,
              status: 'SUBMITTED',
              screeningAnswers: screeningAnswers || {},
            },
            include: {
              job: {
                include: {
                  company: true,
                  client: true,
                },
              },
            },
          }),
        12
      );

      await prisma.applicationTimeline
        .create({
          data: {
            applicationId: application.id,
            status: 'SUBMITTED',
            title: 'Application Submitted',
            description: 'Your application has been successfully submitted',
          },
        })
        .catch((timelineErr) => {
          console.warn('[Application] Timeline create failed (non-fatal):', timelineErr?.message || timelineErr);
        });
    } catch (e) {
      if (e.code === 'ALREADY_APPLIED') {
        return res.status(400).json({
          success: false,
          message: 'You have already applied to this job',
        });
      }
      if (e.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'You have already applied to this job',
        });
      }
      throw e;
    }

    console.log(`✅ Application created: ${application.id} for job ${jobId} by candidate ${candidateId}`);

    const responsePayload = {
      success: true,
      message: 'Application submitted successfully',
      data: {
        applicationId: application.id,
        status: application.status,
        appliedAt: application.appliedAt,
        job: {
          id: application.job.id,
          title: application.job.title,
          company: resolvePublicCompanyName(application.job, CONFIDENTIAL_COMPANY_LABEL),
        },
      },
    };

    res.json(responsePayload);

    // Persist a bell notification for the candidate ("Application submitted")
    // so it shows up under the bell icon alongside the toast. Failures are
    // swallowed inside the helper so they cannot affect the HTTP response.
    void createCandidateNotification(candidateId, {
      type: 'application',
      title: 'Application submitted successfully',
      description: `Your application for ${
        application.job.title || 'a role'
      } at ${resolvePublicCompanyName(application.job, 'the company')} has been received.`,
      actionButton: 'View application',
      actionPath: `/applications/${application.id}`,
      metadata: {
        applicationId: application.id,
        jobId: job.id,
        jobTitle: application.job.title || null,
        companyName: shouldShowClientNamePublicly(application.job)
          ? application.job.company?.name || application.job.client?.companyName || null
          : null,
        status: application.status,
      },
    });

    // Heavy / outbound sync must not block or fail the HTTP response (avoids client "Failed to fetch" on hangs / crashes).
    Promise.allSettled([
      syncApplicationToRecruiterView(candidateId, job),
      syncPhase2TenantAfterPortalApply(candidateId, job.id),
    ]).then((results) => {
      results.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error(`[Application] Post-commit sync slot ${idx} failed:`, r.reason);
        }
      });
    });
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get all applications for a candidate
 * GET /api/applications/:candidateId
 */
async function getApplications(req, res) {
  try {
    const { candidateId } = req.params;
    const startedAt = Date.now();

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    console.log(`📥 DB fetch requested: applications | candidateId=${candidateId}`);
    const applications = await prisma.application.findMany({
      where: { candidateId },
      include: {
        job: {
          include: {
            company: true,
            client: true,
          },
        },
        candidate: {
          select: { stage: true },
        },
        // Pull each app's full timeline so the chip can detect rejections that
        // were written to the timeline (by CRM Phase 2 stage sync) even when
        // the `Application.status` enum is stale (older reject without jobId).
        timeline: {
          select: { status: true },
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    });

    const jobIds = Array.from(new Set(applications.map((app) => app.jobId).filter(Boolean)));
    const matches = jobIds.length
      ? await prisma.match.findMany({
          where: {
            candidateId,
            jobId: { in: jobIds },
          },
          select: {
            jobId: true,
            status: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];
    const matchByJobId = new Map();
    for (const match of matches) {
      if (!matchByJobId.has(match.jobId)) {
        matchByJobId.set(match.jobId, match);
      }
    }

    const pipelineEntries = jobIds.length
      ? await prisma.pipelineEntry.findMany({
          where: {
            candidateId,
            jobId: { in: jobIds },
          },
          select: {
            jobId: true,
            movedAt: true,
            createdAt: true,
            stage: {
              select: { name: true },
            },
          },
          orderBy: [{ movedAt: 'desc' }, { createdAt: 'desc' }],
        })
      : [];
    const pipelineStageByJobId = new Map();
    for (const entry of pipelineEntries) {
      if (!pipelineStageByJobId.has(entry.jobId)) {
        pipelineStageByJobId.set(entry.jobId, entry?.stage?.name || null);
      }
    }

    // Transform applications to match frontend format
    const transformedApplications = applications.map((app) => {
      const job = app.job;

      // Format salary
      let salary = 'Not specified';
      if (job.salaryMin && job.salaryMax) {
        const currency = job.salaryCurrency || 'USD';
        const salaryType = job.salaryType === 'ANNUAL' ? '/year' : job.salaryType === 'MONTHLY' ? '/month' : '';
        salary = `${currency === 'USD' ? '$' : currency}${job.salaryMin.toLocaleString()} - ${currency === 'USD' ? '$' : currency}${job.salaryMax.toLocaleString()}${salaryType}`;
      }

      // Format status
      const statusMap = {
        SUBMITTED: 'Submitted',
        UNDER_REVIEW: 'Under Review',
        SHORTLISTED: 'Shortlisted',
        ASSESSMENT: 'Assessment',
        INTERVIEW: 'Interview',
        FINAL_DECISION: 'Final Decision',
        SELECTED: 'Selected',
        REJECTED: 'Rejected',
      };

      const recruiterMatch = matchByJobId.get(app.jobId) || null;
      const pipelineStageName = pipelineStageByJobId.get(app.jobId) || null;
      const timelineStatuses = Array.isArray(app.timeline)
        ? app.timeline.map((t) => t?.status).filter(Boolean)
        : [];
      const displayStatus = resolveApplicationDisplayStatus({
        appStatus: app.status,
        matchStatus: recruiterMatch?.status,
        candidateStage: app.candidate?.stage,
        pipelineStageName,
        timelineStatuses,
      });
      const perAppPipelineStage = deriveApplicationPipelineStage({
        pipelineStageName,
        appStatus: app.status,
        matchStatus: recruiterMatch?.status,
        timelineStatuses,
      });

      return {
        id: app.id,
        jobId: job.id,
        jobTitle: job.title,
        company: resolvePublicCompanyName(job, CONFIDENTIAL_COMPANY_LABEL),
        status: displayStatus,
        applicationStatus: statusMap[app.status] || app.status,
        pipelineStatusCode: recruiterMatch?.status || null,
        // Per-application pipeline label. We deliberately do NOT fall back
        // to `app.candidate?.stage` here — that single global field bleeds
        // across all of a candidate's applications, so a previously
        // rejected candidate would otherwise see "Rejected" on a brand
        // new Job B's card just because Job A was rejected.
        pipelineStage: perAppPipelineStage,
        appliedDate: app.appliedAt.toISOString().split('T')[0],
        matchScore: app.matchScore || 0,
        salary,
        location: job.location || 'Not specified',
        employmentType: job.employmentType || 'Full-time',
        workMode: job.workMode || 'On-site',
      };
    });

    console.log(
      `📦 DB fetch result: applications | candidateId=${candidateId} | count=${applications.length} | elapsedMs=${Date.now() - startedAt}`
    );

    res.json({
      success: true,
      data: transformedApplications,
    });
  } catch (error) {
    const message = String(error?.message || '');
    const isDbUnavailable =
      error?.code === 'P2010' ||
      message.includes('Server selection timeout') ||
      message.includes('No such host is known') ||
      message.includes('forcibly closed by the remote host') ||
      message.includes('connection');

    if (isDbUnavailable) {
      console.warn('DB unavailable - getApplications');
      return res.status(503).json({
        success: false,
        message: 'Database unavailable',
      });
    }

    console.error('Error fetching applications:', message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get single application detail by applicationId
 * GET /api/applications/detail/:applicationId
 */
async function getApplicationById(req, res) {
  try {
    const { applicationId } = req.params;
    const startedAt = Date.now();

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required',
      });
    }

    console.log(`📥 DB fetch requested: application-detail | applicationId=${applicationId}`);

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: {
          select: { stage: true },
        },
        job: {
          include: {
            company: true,
            client: true,
          },
        },
        timeline: {
          orderBy: {
            occurredAt: 'asc',
          },
        },
        communications: {
          orderBy: {
            sentAt: 'asc',
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    const recruiterMatch = await prisma.match.findFirst({
      where: {
        candidateId: application.candidateId,
        jobId: application.jobId,
      },
      select: {
        status: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const latestPipelineEntry = await prisma.pipelineEntry.findFirst({
      where: {
        candidateId: application.candidateId,
        jobId: application.jobId,
      },
      select: {
        stage: {
          select: { name: true },
        },
      },
      orderBy: [{ movedAt: 'desc' }, { createdAt: 'desc' }],
    });
    const orderedPipelineStages = await prisma.pipelineStage.findMany({
      where: { jobId: application.jobId },
      select: { id: true, name: true, order: true },
      orderBy: { order: 'asc' },
    });
    const normalizedStageNames = new Set(
      orderedPipelineStages
        .map((stage) => String(stage?.name || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const detailTimelineStatuses = Array.isArray(application.timeline)
      ? application.timeline.map((t) => t?.status).filter(Boolean)
      : [];
    // Per-application current stage. We deliberately do NOT fall back to
    // `application.candidate?.stage` (the global candidate field) — that
    // value persists across a candidate's other jobs and would, for
    // example, paint a brand-new Job B's "Pipeline Stage" card as
    // "Rejected" the moment a previous Job A was rejected.
    const currentPipelineStageName = deriveApplicationPipelineStage({
      pipelineStageName: latestPipelineEntry?.stage?.name,
      appStatus: application.status,
      matchStatus: recruiterMatch?.status,
      timelineStatuses: detailTimelineStatuses,
    });
    const currentStageNormalized = String(currentPipelineStageName || '').trim().toLowerCase();
    const pipelineStages = orderedPipelineStages.map((stage) => String(stage.name || '').trim()).filter(Boolean);
    if (currentPipelineStageName && currentStageNormalized && !normalizedStageNames.has(currentStageNormalized)) {
      pipelineStages.push(String(currentPipelineStageName).trim());
    }

    const statusLabel = resolveApplicationDisplayStatus({
      appStatus: application.status,
      matchStatus: recruiterMatch?.status,
      candidateStage: application.candidate?.stage,
      pipelineStageName: latestPipelineEntry?.stage?.name,
      timelineStatuses: detailTimelineStatuses,
    });
    // Keep `statusCode` aligned with the human-facing label when the resolver
    // infers rejection from match / portal-candidate stage (stale
    // `Application.status` can still read `INTERVIEW` after older CRM rejects
    // that omitted `jobId`).
    const displayLooksRejected = String(statusLabel || '').toLowerCase().includes('reject');
    const responseStatusCode =
      String(application.status || '').toUpperCase() === 'REJECTED' || displayLooksRejected
        ? 'REJECTED'
        : application.status;
    const rawTimeline = application.timeline || [];
    const interviewRounds = buildInterviewRoundsFromTimeline(rawTimeline);
    const latestInterview = interviewRounds.length ? interviewRounds[interviewRounds.length - 1] : null;

    const timeline = rawTimeline.map((item) => ({
      id: item.id,
      status: formatApplicationStatus(item.status),
      title: item.title || formatApplicationStatus(item.status),
      description: item.description || null,
      occurredAt: item.occurredAt,
    }));

    const communications = (application.communications || []).map((item) => ({
      id: item.id,
      channel: String(item.channel || '').toLowerCase(),
      subject: item.subject || null,
      message: item.message || '',
      sentAt: item.sentAt,
    }));

    console.log(
      `📦 DB fetch result: application-detail | applicationId=${applicationId} | status=${application.status} | timeline=${timeline.length} | communications=${communications.length} | elapsedMs=${Date.now() - startedAt}`
    );

    // `offerDetails` is a String? column reused as a JSON blob to carry both
    // legacy free-text *and* structured fields written by the CRM
    // (e.g. offer-letter URL pushed from the recruiter's "Submit to Client"
    // / Placement creation flow). Parse defensively so older free-text
    // rows still render.
    let offerLetterUrl = null;
    let offerLetterFileName = null;
    let offerLetterUploadedAt = null;
    let offerDetailsText = application.offerDetails || null;
    let placementId = null;
    let placementStatus = null;
    let offerResponse = null;
    let offerRespondedAt = null;
    let joiningDate = null;
    let reportingToName = null;
    let reportingToTitle = null;
    let reportingToEmail = null;
    let joiningNotes = null;
    if (application.offerDetails) {
      try {
        const parsed = JSON.parse(application.offerDetails);
        if (parsed && typeof parsed === 'object') {
          offerLetterUrl = parsed.offerLetterUrl || null;
          offerLetterFileName = parsed.offerLetterFileName || null;
          offerLetterUploadedAt = parsed.offerLetterUploadedAt || null;
          offerDetailsText = parsed.legacyOfferText || null;
          placementId = parsed.placementId || null;
          placementStatus = parsed.placementStatus || null;
          offerResponse = parsed.offerResponse || null;
          offerRespondedAt = parsed.offerRespondedAt || null;
          joiningDate = parsed.joiningDate || null;
          reportingToName = parsed.reportingToName || null;
          reportingToTitle = parsed.reportingToTitle || null;
          reportingToEmail = parsed.reportingToEmail || null;
          joiningNotes = parsed.joiningNotes || null;
        }
      } catch {
        offerDetailsText = application.offerDetails;
      }
    }

    return res.json({
      success: true,
      data: {
        id: application.id,
        candidateId: application.candidateId,
        jobId: application.jobId,
        status: statusLabel,
        statusCode: responseStatusCode,
        pipelineStatusCode: recruiterMatch?.status || null,
        pipelineStage: currentPipelineStageName,
        pipelineStages,
        appliedAt: application.appliedAt,
        updatedAt: application.updatedAt,
        emailUpdates: application.emailUpdates,
        whatsappUpdates: application.whatsappUpdates,
        offerDetails: offerDetailsText,
        offerLetterUrl,
        offerLetterFileName,
        offerLetterUploadedAt,
        placementId,
        placementStatus,
        offerResponse,
        offerRespondedAt,
        joiningDate,
        reportingToName,
        reportingToTitle,
        reportingToEmail,
        joiningNotes,
        screeningAnswers: application.screeningAnswers || null,
        interviewRounds,
        interviewDetails: latestInterview,
        job: {
          id: application.job.id,
          title: application.job.title,
          company: resolvePublicCompanyName(application.job, CONFIDENTIAL_COMPANY_LABEL),
          location: application.job.location || 'Not specified',
          workMode: application.job.workMode || application.job.jobLocationType || 'Not specified',
          experience:
            application.job.experienceRequired ||
            application.job.experienceLevel ||
            'Not specified',
          employmentType: application.job.employmentType || application.job.type || 'Full-time',
          salary: formatSalaryText(application.job),
        },
        timeline,
        communications,
      },
    });
  } catch (error) {
    console.error('Error fetching application detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch application detail',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function syncPhase2PlacementOfferResponse(candidateId, jobId, decision) {
  const base =
    process.env.PHASE2_INTERNAL_API_URL ||
    process.env.PHASE2_API_URL ||
    process.env.PHASE2_BASE_URL ||
    'http://localhost:5001';
  const secret =
    process.env.PHASE2_PORTAL_SYNC_SECRET || 'phase2-portal-sync-2026-shared-secret';

  let tenantDbName = null;
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { tenantDbName: true },
    });
    tenantDbName = String(job?.tenantDbName || '').trim() || null;
  } catch (e) {
    console.warn('[Application] Could not read job.tenantDbName for offer response:', e?.message || e);
  }
  if (!tenantDbName) {
    tenantDbName = String(process.env.PHASE2_DEFAULT_TENANT_DB_NAME || '').trim() || null;
  }
  if (!tenantDbName) {
    throw new Error('Tenant routing is not configured for this job');
  }

  const url = `${String(base).replace(/\/$/, '')}/api/v1/internal/placement-offer-response`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-phase2-portal-sync-secret': secret,
    },
    body: JSON.stringify({ tenantDbName, candidateId, jobId, decision }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Phase2 offer response failed (${res.status})`);
  }
  return res.json();
}

/**
 * POST /api/applications/detail/:applicationId/offer-response
 * Body: { candidateId, decision: 'accept' | 'reject' }
 */
async function respondToOfferLetter(req, res) {
  try {
    const { applicationId } = req.params;
    const candidateId = String(req.body?.candidateId || '').trim();
    const decision = String(req.body?.decision || '').trim().toLowerCase();

    if (!applicationId || !candidateId) {
      return res.status(400).json({ success: false, message: 'applicationId and candidateId are required' });
    }
    if (!['accept', 'reject'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'decision must be accept or reject' });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, candidateId: true, jobId: true, offerDetails: true },
    });
    if (!application || application.candidateId !== candidateId) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    let parsed = {};
    if (application.offerDetails) {
      try {
        const maybe = JSON.parse(application.offerDetails);
        parsed = maybe && typeof maybe === 'object' ? maybe : {};
      } catch {
        parsed = {};
      }
    }
    if (!parsed.offerLetterUrl) {
      return res.status(400).json({ success: false, message: 'No offer letter is available for this application' });
    }
    if (parsed.offerResponse && parsed.offerResponse !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'You have already responded to this offer' });
    }

    const phase2 = await syncPhase2PlacementOfferResponse(candidateId, application.jobId, decision);

    return res.json({
      success: true,
      message: decision === 'accept' ? 'Offer accepted successfully' : 'Offer declined',
      data: phase2?.data || null,
    });
  } catch (error) {
    console.error('Error responding to offer:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit offer response',
    });
  }
}

/**
 * Check if candidate has applied to a job
 * GET /api/applications/check/:candidateId/:jobId
 */
async function checkApplication(req, res) {
  try {
    const { candidateId, jobId } = req.params;
    const startedAt = Date.now();

    if (!candidateId || !jobId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID and Job ID are required',
      });
    }

    console.log(`📥 DB fetch requested: check-application | candidateId=${candidateId} | jobId=${jobId}`);
    const application = await prisma.application.findUnique({
      where: {
        candidateId_jobId: {
          candidateId,
          jobId,
        },
      },
    });

    console.log(
      `📦 DB fetch result: check-application | candidateId=${candidateId} | jobId=${jobId} | hasApplied=${!!application} | elapsedMs=${Date.now() - startedAt}`
    );

    res.json({
      success: true,
      data: {
        hasApplied: !!application,
        applicationId: application?.id || null,
        status: application?.status || null,
      },
    });
  } catch (error) {
    const message = String(error?.message || '');
    const isDbUnavailable =
      error?.code === 'P2010' ||
      message.includes('Server selection timeout') ||
      message.includes('No such host is known') ||
      message.includes('forcibly closed by the remote host') ||
      message.includes('connection');

    if (isDbUnavailable) {
      console.warn('DB unavailable - checkApplication');
      return res.status(503).json({
        success: false,
        message: 'Database unavailable',
      });
    }

    console.error('Error checking application:', message);
    res.status(500).json({
      success: false,
      message: 'Failed to check application status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Withdraw (delete) an existing application.
 * DELETE /api/applications/detail/:applicationId?candidateId=...
 */
async function withdrawApplication(req, res) {
  try {
    const { applicationId } = req.params;
    const candidateId = String(req.query?.candidateId || req.body?.candidateId || '').trim();

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required',
      });
    }

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, candidateId: true, jobId: true },
    });

    // Idempotent success: if already deleted, treat as withdrawn.
    if (!app) {
      return res.json({
        success: true,
        message: 'Application already withdrawn',
      });
    }

    if (app.candidateId !== candidateId) {
      return res.status(403).json({
        success: false,
        message: 'You can only withdraw your own application',
      });
    }

    await withMongoWriteConflictRetry(async () => {
      await prisma.application.delete({ where: { id: app.id } });

      // Clean recruiter-side mirror records created during apply flow.
      await Promise.all([
        prisma.match.deleteMany({ where: { candidateId, jobId: app.jobId } }),
        prisma.pipelineEntry.deleteMany({ where: { candidateId, jobId: app.jobId } }),
      ]);

      // Remove this job from candidate.assignedJobs so Explore Jobs can show it again as not-applied.
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { assignedJobs: true },
      });
      if (candidate && Array.isArray(candidate.assignedJobs)) {
        const nextAssignedJobs = candidate.assignedJobs.filter((j) => String(j) !== String(app.jobId));
        if (nextAssignedJobs.length !== candidate.assignedJobs.length) {
          await prisma.candidate.update({
            where: { id: candidateId },
            data: { assignedJobs: nextAssignedJobs },
          });
        }
      }
    }, 10);

    return res.json({
      success: true,
      message: 'Application withdrawn successfully',
      data: {
        applicationId: app.id,
        jobId: app.jobId,
        candidateId: app.candidateId,
      },
    });
  } catch (error) {
    console.error('Error withdrawing application:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to withdraw application',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  createApplication,
  getApplications,
  getApplicationById,
  withdrawApplication,
  checkApplication,
  respondToOfferLetter,
};
