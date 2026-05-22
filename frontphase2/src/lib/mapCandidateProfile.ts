import type { BackendCandidate } from './api';
import {
  buildEducationSummaryFromCvEntries,
  isGarbageEducationSummary,
} from './candidateEducation';
import { enrichBackendCandidateFromPhase1Snapshot, getPhase1ProfileSnapshot } from './phase1ProfileSnapshot';
import { computeTotalExperienceYears } from './candidateExperience';
import { resolveCandidateListStage } from './candidateListMapping';
import type { CandidateProfileDrawerData } from '../components/drawers/CandidateProfileDrawer';
import type { MatchCandidate } from '../components/matches/types';

export function isValidObjectId(id: string): boolean {
  return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id.trim());
}

export function extractApiData<T>(response: { data?: T | { data?: T } } | T): T {
  if ((response as { data?: T | { data?: T } })?.data) {
    const payload = (response as { data?: T | { data?: T } }).data;
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return (payload as { data?: T }).data as T;
    }
    return payload as T;
  }
  return response as T;
}

const TAG_COLOR_PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#ea580c',
  '#dc2626',
  '#0891b2',
  '#ca8a04',
  '#4f46e5',
];

export function getTagColor(label: string) {
  const seed = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLOR_PALETTE[seed % TAG_COLOR_PALETTE.length];
}

export function mapBackendStage(status: string): string {
  switch (status) {
    case 'NEW':
      return 'Applied';
    case 'INTERVIEWING':
      return 'Interviewing';
    case 'OFFERED':
      return 'Offered';
    case 'PLACED':
      return 'Hired';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
}

export function formatSalary(
  salary?: BackendCandidate['salary']
): { current: string; expected: string } {
  if (!salary || (salary.min == null && salary.max == null)) {
    return { current: '', expected: '' };
  }

  const prefix = salary.currency || '';
  const min = salary.min != null ? `${prefix}${salary.min}` : '';
  const max = salary.max != null ? `${prefix}${salary.max}` : '';

  return {
    current: '',
    expected: [min, max].filter(Boolean).join(' - '),
  };
}

export function formatSalaryFrequency(type?: string | null): string {
  const value = String(type || '').trim().toUpperCase();
  switch (value) {
    case 'ANNUAL':
    case 'ANNUALLY':
    case 'YEARLY':
      return 'Annually';
    case 'MONTHLY':
      return 'Monthly';
    case 'HOURLY':
      return 'Hourly';
    case 'DAILY':
      return 'Daily';
    case 'WEEKLY':
      return 'Weekly';
    default:
      return '';
  }
}

export function formatCandidateSalaryDisplay(
  amount: number | null | undefined,
  currency?: string | null,
  frequency?: string | null
): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '';
  const num = Number(amount);
  const currencyCode = String(currency || '').trim();
  const freqLabel = formatSalaryFrequency(frequency);
  const formattedNumber = num.toLocaleString();
  const head = currencyCode ? `${currencyCode} ${formattedNumber}` : formattedNumber;
  return freqLabel ? `${head} / ${freqLabel}` : head;
}

type BackendCandidateInterview = NonNullable<BackendCandidate['interviews']>[number];

export function findJobTitleById(jobId: string, matches?: BackendCandidate['matches']): string | undefined {
  if (!jobId || !Array.isArray(matches)) return undefined;
  for (const match of matches) {
    if (match?.job?.id === jobId && match.job.title) {
      return match.job.title;
    }
  }
  return undefined;
}

function buildAssignedJobsList(c: BackendCandidate): NonNullable<CandidateProfileDrawerData['assignedJobs']> {
  type Row = NonNullable<CandidateProfileDrawerData['assignedJobs']>[number];
  const byKey = new Map<string, Row>();

  const upsert = (row: Row) => {
    const key = row.id ? String(row.id) : row.title.trim();
    if (!key) return;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      return;
    }
    byKey.set(key, {
      ...existing,
      ...row,
      title: row.title || existing.title,
      stage: row.stage || existing.stage,
      status: row.status || existing.status,
      movedAt: row.movedAt || existing.movedAt,
      notes: row.notes || existing.notes,
      pipelineEntryId: row.pipelineEntryId || existing.pipelineEntryId,
      isPipelineEntry: Boolean(row.isPipelineEntry || existing.isPipelineEntry),
      department: row.department || existing.department,
    });
  };

  for (const entry of c.pipelineEntries || []) {
    const jobId = String(entry.jobId || '').trim();
    const match = jobId ? c.matches?.find((m) => m.job?.id === jobId) : undefined;
    const titleFromMatch = match?.job?.title || (jobId ? findJobTitleById(jobId, c.matches) : undefined);
    const title = String(titleFromMatch || '').trim() || 'Untitled job';
    const department = match?.job?.client?.companyName || null;
    upsert({
      id: jobId || null,
      pipelineEntryId: entry.id ? String(entry.id) : null,
      title,
      department,
      stage: entry.stage?.name || null,
      movedAt: entry.movedAt || null,
      notes: entry.notes || null,
      status: null,
      isPipelineEntry: true,
    });
  }

  for (const match of c.matches || []) {
    const id = match.job?.id ? String(match.job.id) : '';
    const title = String(match.job?.title || '').trim();
    if (!id && !title) continue;
    upsert({
      id: id || null,
      title: title || 'Untitled job',
      status: match.status || null,
      stage: c.stage || null,
    });
  }

  const titleArr = Array.isArray(c.assignedJobTitles) ? c.assignedJobTitles : [];
  const idArr = Array.isArray(c.assignedJobs) ? c.assignedJobs : [];
  const max = Math.max(titleArr.length, idArr.length);
  for (let i = 0; i < max; i += 1) {
    const id = idArr[i] ? String(idArr[i]) : '';
    const title = String(titleArr[i] || findJobTitleById(id, c.matches) || '').trim();
    if (!id && !title) continue;
    upsert({
      id: id || null,
      title: title || 'Untitled job',
      status: null,
      stage: c.stage || null,
    });
  }

  return Array.from(byKey.values());
}

export function mapCandidateProfile(raw: BackendCandidate): CandidateProfileDrawerData {
  const c = enrichBackendCandidateFromPhase1Snapshot(raw);
  const phase1Snap = getPhase1ProfileSnapshot(
    c.extraData && typeof c.extraData === 'object' && !Array.isArray(c.extraData)
      ? (c.extraData as Record<string, unknown>)
      : null
  );
  const resumeFileName = phase1Snap?.resume?.fileName?.trim() || 'Resume';
  const resumeAtsScore =
    typeof (c as BackendCandidate & { resumeAtsScore?: number }).resumeAtsScore === 'number'
      ? (c as BackendCandidate & { resumeAtsScore?: number }).resumeAtsScore
      : typeof phase1Snap?.resume?.atsScore === 'number'
        ? phase1Snap.resume.atsScore
        : null;

  const namePart = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  const emailPart = c.email?.trim() || '';
  const phonePart = c.phone?.trim() || '';
  const shortId = c.id && c.id.length >= 6 ? c.id.slice(-6) : c.id;
  const fullName =
    namePart ||
    emailPart ||
    phonePart ||
    (shortId ? `Candidate …${shortId}` : 'Candidate');
  const latestMatch = c.matches?.[0];
  const latestInterview = c.interviews?.[0];
  const salary = formatSalary(c.salary);
  const stage = resolveCandidateListStage(c);
  const skillsCount = c.skills?.length || 0;
  const skillsMatch = Math.min(95, skillsCount > 0 ? 55 + skillsCount * 8 : 38);
  const experienceFit = Math.min(96, c.experience != null ? 45 + c.experience * 6 : 35);
  const educationFit = c.currentTitle ? 72 : 48;
  const keywordMatch = Math.min(
    94,
    Math.round((skillsMatch * 0.45) + (experienceFit * 0.35) + (educationFit * 0.2))
  );
  const overall = Math.round((skillsMatch + experienceFit + educationFit + keywordMatch) / 4);
  const insightItems: NonNullable<CandidateProfileDrawerData['aiScore']>['insights'] = [];
  const backendAi = (c as BackendCandidate).aiCandidateAnalysis;
  const backendBreakdown = backendAi?.breakdown || {};
  const aiSkillsMatch =
    typeof backendBreakdown.skillsMatch === 'number' && Number.isFinite(backendBreakdown.skillsMatch)
      ? Math.max(0, Math.min(100, Math.round(backendBreakdown.skillsMatch)))
      : skillsMatch;
  const aiExperienceFit =
    typeof backendBreakdown.experienceFit === 'number' && Number.isFinite(backendBreakdown.experienceFit)
      ? Math.max(0, Math.min(100, Math.round(backendBreakdown.experienceFit)))
      : experienceFit;
  const aiEducationFit =
    typeof backendBreakdown.educationFit === 'number' && Number.isFinite(backendBreakdown.educationFit)
      ? Math.max(0, Math.min(100, Math.round(backendBreakdown.educationFit)))
      : educationFit;
  const aiKeywordMatch =
    typeof backendBreakdown.keywordMatch === 'number' && Number.isFinite(backendBreakdown.keywordMatch)
      ? Math.max(0, Math.min(100, Math.round(backendBreakdown.keywordMatch)))
      : keywordMatch;

  if (skillsCount > 0) {
    insightItems.push({
      type: 'strength',
      text: `${fullName} shows ${skillsCount} relevant skill${skillsCount > 1 ? 's' : ''} in the profile.`,
    });
  } else {
    insightItems.push({
      type: 'gap',
      text: 'Skills are missing or incomplete, which may lower the confidence of the screening result.',
    });
  }

  if ((c.experience ?? 0) >= 3) {
    insightItems.push({
      type: 'strength',
      text: `Experience level looks aligned with mid-level hiring expectations at ${c.experience} years.`,
    });
  } else {
    insightItems.push({
      type: 'gap',
      text: 'Experience appears limited for roles that expect deeper hands-on exposure.',
    });
  }

  if (!c.resume) {
    insightItems.push({
      type: 'gap',
      text: 'Resume file is not attached, so profile evaluation is based only on available record data.',
    });
  } else {
    insightItems.push({
      type: 'strength',
      text: 'Resume is available for detailed recruiter and AI review.',
    });
  }

  const fallbackActivityItems: NonNullable<CandidateProfileDrawerData['activity']> = [
    {
      id: `candidate-created-${c.id}`,
      type: 'note-added',
      title: 'Candidate profile created',
      description: `${fullName} was added to the system.`,
      timestamp: c.createdAt,
      performedBy: {
        name: c.assignedTo?.name || 'System',
      },
      relatedJob: latestMatch?.job?.title || null,
    },
  ];

  if (c.resume) {
    fallbackActivityItems.push({
      id: `resume-parsed-${c.id}`,
      type: 'resume-parsed',
      title: 'Resume parsed',
      description: 'Resume file is attached and ready for recruiter review.',
      timestamp: c.createdAt,
      performedBy: {
        name: 'AI Parser',
      },
      relatedJob: latestMatch?.job?.title || null,
    });
  }

  if (latestMatch) {
    fallbackActivityItems.push({
      id: `pipeline-${latestMatch.id}`,
      type: 'added-to-pipeline',
      title: 'Added to pipeline',
      description: `${fullName} was added to the hiring pipeline.`,
      timestamp: c.createdAt,
      performedBy: {
        name: c.assignedTo?.name || 'Recruiter',
      },
      relatedJob: latestMatch.job?.title || null,
    });
  }

  if (latestInterview?.scheduledAt) {
    fallbackActivityItems.push({
      id: `interview-${latestInterview.id}`,
      type: 'interview-scheduled',
      title: 'Interview scheduled',
      description: `Interview status: ${latestInterview.status || 'scheduled'}.`,
      timestamp: latestInterview.scheduledAt,
      performedBy: {
        name: c.assignedTo?.name || 'Recruiter',
      },
      relatedJob: latestMatch?.job?.title || null,
    });
  }

  const fallbackNotes: NonNullable<CandidateProfileDrawerData['notes']> = [
    {
      id: `note-screening-${c.id}`,
      text: c.resume
        ? 'Resume reviewed internally. Candidate looks promising for initial recruiter screening.'
        : 'Profile created, but resume is still missing and needs follow-up.',
      createdAt: c.createdAt,
      recruiter: {
        id: c.assignedTo?.id,
        name: c.assignedTo?.name || 'Recruiter',
        avatar: c.assignedTo?.avatar || null,
      },
      tags: ['Screening', c.resume ? 'Resume' : 'Follow-up'],
      isPinned: Boolean(c.resume),
    },
  ];

  if (latestInterview?.scheduledAt) {
    fallbackNotes.push({
      id: `note-interview-${latestInterview.id}`,
      text: 'Interview coordination is active. Keep communication warm and confirm availability before the next round.',
      createdAt: latestInterview.scheduledAt,
      recruiter: {
        id: c.assignedTo?.id,
        name: c.assignedTo?.name || 'Recruiter',
        avatar: c.assignedTo?.avatar || null,
      },
      tags: ['Interview', 'Follow-up'],
      isPinned: false,
    });
  }

  const fallbackTags = Array.from(
    new Set([
      ...(c.tags || []),
      ...(c.skills?.slice(0, 2) || []),
      (c.experience ?? 0) >= 5 ? 'Senior' : '',
      c.source?.toLowerCase().includes('referral') ? 'Referral' : '',
      c.location?.toLowerCase().includes('remote') ? 'Remote Candidate' : '',
    ].filter(Boolean))
  ).map((tag) => ({
    id: `tag-${tag.toLowerCase().replace(/\s+/g, '-')}`,
    label: tag,
    color: getTagColor(tag),
  }));

  const careerPrefs = c.careerPreferences || null;
  const expectedSalaryFromPrefs = formatCandidateSalaryDisplay(
    c.expectedSalary ?? careerPrefs?.preferredSalary ?? null,
    careerPrefs?.preferredCurrency || c.salary?.currency || null,
    careerPrefs?.preferredSalaryType || null
  );
  const expectedSalaryDisplay =
    expectedSalaryFromPrefs ||
    salary.expected ||
    (c.expectedSalary != null && Number.isFinite(Number(c.expectedSalary))
      ? `${c.salary?.currency || ''} ${Number(c.expectedSalary).toLocaleString()}`.trim()
      : '');

  return {
    id: c.id,
    name: fullName,
    firstName: c.firstName || null,
    lastName: c.lastName || null,
    avatar: c.avatar || phase1Snap?.personalInfo?.profilePhotoUrl || null,
    currentTitle: c.currentTitle || null,
    currentCompany: c.currentCompany || null,
    stage,
    experience:
      computeTotalExperienceYears(
        Array.isArray(c.cvWorkExperienceEntries) ? c.cvWorkExperienceEntries : [],
        c.experience ?? c.experienceYears ?? null,
      ) ?? c.experience ?? c.experienceYears ?? 0,
    location: c.location || '—',
    email: c.email,
    phone: c.phone || '—',
    linkedIn: c.linkedIn || null,
    designation: c.currentTitle || null,
    expectedSalary: expectedSalaryDisplay || '—',
    expectedSalaryValue: c.expectedSalary ?? careerPrefs?.preferredSalary ?? null,
    currentSalaryValue: c.currentSalary ?? careerPrefs?.currentSalary ?? null,
    salaryCurrency: careerPrefs?.preferredCurrency || c.salary?.currency || 'INR',
    noticePeriod: c.noticePeriod || careerPrefs?.noticePeriod || '—',
    // Prefer the explicitly-assigned job (set via the candidate edit modal) over
    // any pre-existing Match record so changing the assignment reflects in the
    // drawer + dropdown immediately after save. If the title can't be resolved
    // locally we leave it empty — the drawer enriches it from the loaded jobs
    // list before display.
    assignedJob:
      (c.assignedJobs?.[0] && findJobTitleById(c.assignedJobs[0], c.matches)) ||
      latestMatch?.job?.title ||
      '—',
    assignedJobId: c.assignedJobs?.[0] || latestMatch?.job?.id || null,
    assignedJobs: buildAssignedJobsList(c),
    recruiter: c.assignedTo?.name || 'Unassigned',
    recruiterId: c.assignedTo?.id || null,
    source: c.source || '—',
    status: c.status || 'NEW',
    availability:
      c.availability ||
      careerPrefs?.availabilityToStart ||
      (c.status === 'ACTIVE' ? 'available' : c.status === 'PLACED' ? 'unavailable' : 'limited'),
    resumeUrl: c.resume || c.resumeUrl || null,
    summary:
      c.notes?.trim() ||
      c.cvSummary?.trim() ||
      (c.skills?.length ? `Skills: ${c.skills.join(', ')}` : null),
    cvAddress: c.address || null,
    cvCity: c.city || null,
    cvCountry: c.country || null,
    cvAvailability: c.availability || careerPrefs?.availabilityToStart || null,
    cvExpectedSalary:
      formatCandidateSalaryDisplay(
        c.expectedSalary ?? careerPrefs?.preferredSalary ?? null,
        careerPrefs?.preferredCurrency || c.salary?.currency || null,
        careerPrefs?.preferredSalaryType || null
      ) || salary.expected || null,
    cvCurrentSalary:
      formatCandidateSalaryDisplay(
        c.currentSalary ?? careerPrefs?.currentSalary ?? null,
        careerPrefs?.currentCurrency || careerPrefs?.preferredCurrency || c.salary?.currency || null,
        careerPrefs?.currentSalaryType || null
      ) || null,
    cvEducation: (() => {
      const entries = Array.isArray(c.cvEducationEntries) ? c.cvEducationEntries : [];
      const fromEntries = buildEducationSummaryFromCvEntries(
        entries as Array<Record<string, unknown>>
      );
      if (fromEntries) return fromEntries;
      const raw = c.education || null;
      if (raw && isGarbageEducationSummary(raw)) return null;
      return raw;
    })(),
    cvEducationEntries: Array.isArray(c.cvEducationEntries) ? c.cvEducationEntries : [],
    cvWorkExperienceEntries: Array.isArray(c.cvWorkExperienceEntries) ? c.cvWorkExperienceEntries : [],
    cvPortfolioLinks: c.cvPortfolioLinks || [],
    cvCertifications:
      (Array.isArray(c.certifications) && c.certifications.length
        ? c.certifications
        : Array.isArray((c as any).certificationsList)
          ? (c as any).certificationsList
          : []) || [],
    cvLanguages: (() => {
      const snap = phase1Snap;
      if (Array.isArray(snap?.languages) && snap.languages.length) {
        return snap.languages
          .map((l) => {
            const name = String(l?.name || '').trim();
            const prof = String(l?.proficiency || '').trim();
            return prof ? `${name} (${prof})` : name;
          })
          .filter(Boolean);
      }
      if (Array.isArray(c.languages) && c.languages.length) return c.languages;
      const recruiterLangs = (c as BackendCandidate & { recruiterLanguages?: string[] }).recruiterLanguages;
      if (Array.isArray(recruiterLangs) && recruiterLangs.length) return recruiterLangs;
      return [];
    })(),
    cvPortfolio: c.portfolio || null,
    cvWebsite: c.website || null,
    cvNotes: c.cvSummary || c.notes || null,
    cvPreferredLocation:
      c.preferredLocation ||
      (Array.isArray(careerPrefs?.preferredLocations) && careerPrefs?.preferredLocations.length
        ? careerPrefs.preferredLocations[0]
        : null) ||
      careerPrefs?.currentLocation ||
      null,
    cvSkills:
      (Array.isArray(c.skills) && c.skills.length
        ? c.skills
        : Array.isArray((c as any).recruiterSkills)
          ? (c as any).recruiterSkills
          : []) || [],
    cvSummary: c.cvSummary || null,
    extraData:
      c.extraData && typeof c.extraData === 'object' && !Array.isArray(c.extraData)
        ? (c.extraData as Record<string, unknown>)
        : null,
    tags: c.tagObjects?.length ? c.tagObjects : fallbackTags,
    notes: c.internalNotes?.length ? c.internalNotes : fallbackNotes,
    files:
      c.resume || c.resumeUrl
        ? [{ name: resumeFileName, url: c.resume || c.resumeUrl || '' }]
        : [],
    activity: c.activityFeed?.length ? c.activityFeed : fallbackActivityItems,
    scheduledInterviews: (c.interviews || [])
      .filter((interview) => Boolean(interview.scheduledAt))
      .map((interview, index) => ({
        id: interview.id,
        candidateId: c.id,
        jobId: interview.job?.id || latestMatch?.job?.id || null,
        jobTitle: interview.job?.title || latestMatch?.job?.title || null,
        // Backend stores human-friendly type label in `round` (e.g. "HR Screening").
        // If older records stored numeric rounds, we still fall back safely.
        type: interview.round || (interview as any).type || interview.status || 'Interview',
        round: index + 1,
        date: (interview.scheduledAt || '').split('T')[0] || '',
        time: interview.scheduledAt
          ? new Date(interview.scheduledAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })
          : '',
        duration: interview.duration ? `${interview.duration} mins` : '1 hour',
        mode:
          interview.mode === 'in-person'
            ? 'in-person'
            : interview.mode === 'phone'
              ? 'phone'
              : 'video',
        platform:
          (interview as BackendCandidateInterview).platform === 'GOOGLE_MEET'
            ? 'Google Meet'
            : (interview as BackendCandidateInterview).platform === 'ZOOM'
              ? 'Zoom'
              : null,
        meetingLink: (interview as BackendCandidateInterview).meetingLink || null,
        location: (interview as BackendCandidateInterview).location || null,
        phoneNumber: c.phone || null,
        interviewers: interview.interviewer
          ? [{ id: interview.interviewer.id, name: interview.interviewer.name, role: 'Interviewer' }]
          : c.assignedTo
            ? [{ id: c.assignedTo.id, name: c.assignedTo.name, role: 'Interviewer' }]
          : [],
        notes: (interview as BackendCandidateInterview).notes || '',
        sendCandidateInvite: true,
        sendInterviewerInvite: true,
        status:
          String(interview.status || '').toUpperCase() === 'COMPLETED'
            ? 'completed'
            : String(interview.status || '').toUpperCase() === 'CANCELLED'
              ? 'cancelled'
              : 'scheduled',
      })),
    aiScore: {
      overall:
        typeof backendAi?.overall === 'number' && Number.isFinite(backendAi.overall)
          ? Math.max(0, Math.min(100, Math.round(backendAi.overall)))
          : resumeAtsScore != null
            ? Math.max(0, Math.min(100, Math.round(resumeAtsScore)))
            : overall,
      source: backendAi?.source || (resumeAtsScore != null ? 'resume_ats' : 'estimated'),
      jobTitle: backendAi?.jobTitle || latestMatch?.job?.title || null,
      breakdown: {
        skillsMatch: aiSkillsMatch,
        experienceFit: aiExperienceFit,
        educationFit: aiEducationFit,
        keywordMatch: aiKeywordMatch,
      },
      insights:
        Array.isArray(backendAi?.insights) && backendAi.insights.length
          ? backendAi.insights
              .filter((item) => item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim().length > 0)
              .map((item) => ({
                type: item.type === 'gap' ? 'gap' : 'strength',
                text: String(item.text),
              }))
          : insightItems,
    },
  };
}

export function enrichProfileWithMatchData(
  profile: CandidateProfileDrawerData,
  match: MatchCandidate | null | undefined,
  jobTitle?: string | null
): CandidateProfileDrawerData {
  if (!match) return profile;

  const ai = match.explanation?.aiEngine;
  const breakdown = ai?.breakdown;
  const insights: NonNullable<CandidateProfileDrawerData['aiScore']>['insights'] = [
    ...(profile.aiScore?.insights || []),
  ];

  if (match.explanation?.text?.trim()) {
    insights.push({ type: 'strength', text: match.explanation.text.trim() });
  }
  if (ai?.suggestion?.trim()) {
    insights.push({ type: 'gap', text: ai.suggestion.trim() });
  }
  if (match.explanation.matchedSkills?.length) {
    insights.push({
      type: 'strength',
      text: `Matched skills: ${match.explanation.matchedSkills.join(', ')}`,
    });
  }
  if (match.explanation.missingSkills?.length) {
    insights.push({
      type: 'gap',
      text: `Missing skills: ${match.explanation.missingSkills.join(', ')}`,
    });
  }
  if (ai?.verdict?.trim()) {
    insights.push({ type: 'strength', text: `Verdict: ${ai.verdict}` });
  }

  const skillsMatch = typeof breakdown?.skills === 'number' ? breakdown.skills : match.score;
  const experienceFit = typeof breakdown?.experience === 'number' ? breakdown.experience : skillsMatch;
  const educationFit = typeof breakdown?.semantic === 'number' ? breakdown.semantic : skillsMatch;
  const keywordMatch = typeof breakdown?.cultural === 'number' ? breakdown.cultural : educationFit;

  return {
    ...profile,
    assignedJob: jobTitle && jobTitle !== '—' ? jobTitle : profile.assignedJob,
    aiScore: {
      overall: Math.max(0, Math.min(100, Math.round(match.score))),
      source: 'match',
      jobTitle: jobTitle || profile.aiScore?.jobTitle || profile.assignedJob || null,
      breakdown: {
        skillsMatch: Math.round(skillsMatch),
        experienceFit: Math.round(experienceFit),
        educationFit: Math.round(educationFit),
        keywordMatch: Math.round(keywordMatch),
      },
      insights: insights.slice(0, 8),
    },
  };
}
