import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { canViewAllAssignments, hasAnyPermission } from '../../utils/permissionScope.js';
import {
  candidateService,
  loadMatchPipelineCandidatePool,
  loadAppliedMatchCandidatePool,
  ensureCandidateMaterializedForMatch,
} from '../candidate/candidate.service.js';
import { sendMatchSubmissionEmail } from '../../emails/email.service.js';
import { env } from '../../config/env.js';
import { createRequire } from 'module';
import {
  createClientReviewToken,
  normalizeSubmissionType,
} from '../../services/interview.service.js';
import {
  buildCvSubmissionSnapshot,
} from '../../utils/cvSubmissionSnapshot.js';
import { AI_MATCH_AUTHOR_WHERE, MANUAL_MATCH_AUTHOR_WHERE } from './matchQueryHelpers.js';
import { notifyMatchSubmittedToClient } from '../setting/alert-notify.helpers.js';
import { moveCandidateToSubmittedToClient } from '../stage/candidateStage.service.js';
import { isDeliverableEmail } from '../../utils/emailDeliverability.js';

// Mirror of the interview drawer's purpose codes. Keeping the resolution
// logic here means a match-submitted-to-client carries the same UX (tag
// options + offer-letter upload) on the public review page.
const MATCH_SUBMISSION_PURPOSES = {
  INITIAL_REVIEW: 'Initial review — please confirm the candidate is a fit before scheduling.',
  INTERIM_REVIEW: 'Mid-cycle review — please confirm next steps.',
  OFFER_CONFIRMATION: 'Final clarification — please attach the signed offer letter.',
  GENERAL: 'Please review this candidate.',
};

function normalizeMatchScore(score) {
  const n = Number(score);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const buildClientReviewUrl = (match, submissionType, cvShareMode = null, batchMatchIds = null) => {
  const normalizedBatch = Array.isArray(batchMatchIds)
    ? Array.from(new Set(batchMatchIds.map((id) => String(id || '').trim()).filter(Boolean)))
    : [];
  const token = createClientReviewToken({
    matchId: match.id,
    candidateId: match.candidateId,
    jobId: match.jobId,
    clientId: match.job?.clientId || match.job?.client?.id || null,
    submissionType,
    cvShareMode,
    batchMatchIds: normalizedBatch.length > 1 ? normalizedBatch : undefined,
  });
  return `${env.FRONTEND_URL}/client-review/${encodeURIComponent(token)}`;
};

const require = createRequire(import.meta.url);

const CANDIDATE_ACTIVITY_ENTITY = 'CANDIDATE';
const NOTE_ACTIVITY_KIND = 'candidate-note';
const PIPELINE_ACTIVITY_KIND = 'candidate-pipeline';
const MATCH_SUBMISSION_ACTIVITY_KIND = 'match-submission';
const MATCH_REJECTION_ACTIVITY_KIND = 'match-rejection';
const MATCH_SAVE_ACTIVITY_KIND = 'match-save';

function getActivityMetadata(activity) {
  return activity?.metadata && typeof activity.metadata === 'object' ? activity.metadata : {};
}

function buildInitials(firstName = '', lastName = '') {
  return `${String(firstName || '').trim()[0] || ''}${String(lastName || '').trim()[0] || ''}`.toUpperCase() || 'NA';
}

function normalizeCandidateExperienceYears(candidate) {
  if (!candidate) return 0;
  for (const raw of [candidate.experience, candidate.experienceYears]) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function normalizeCandidateLocationLabel(candidate) {
  if (!candidate) return 'Location unavailable';
  const direct = String(candidate.location || '').trim();
  if (direct) return direct;
  const parts = [candidate.city, candidate.country]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : 'Location unavailable';
}

function enrichSparseCandidateFromPool(candidate, poolRow) {
  if (!candidate || !poolRow) return candidate;
  const experience = (() => {
    const fromMatch = normalizeCandidateExperienceYears(candidate);
    if (fromMatch > 0) return fromMatch;
    return normalizeCandidateExperienceYears(poolRow);
  })();
  const location =
    normalizeCandidateLocationLabel(candidate) ||
    normalizeCandidateLocationLabel(poolRow) ||
    'Location unavailable';
  return {
    ...poolRow,
    ...candidate,
    experience,
    experienceYears: experience,
    location,
    city: candidate.city || poolRow.city || null,
    country: candidate.country || poolRow.country || null,
    currentTitle:
      candidate.currentTitle ||
      poolRow.currentTitle ||
      candidate.designation ||
      poolRow.designation ||
      null,
    currentCompany: candidate.currentCompany || poolRow.currentCompany || null,
    avatar: candidate.avatar || poolRow.avatar || null,
    phone: candidate.phone || poolRow.phone || null,
    assignedTo: candidate.assignedTo || poolRow.assignedTo || null,
    assignedToId: candidate.assignedToId ?? poolRow.assignedToId ?? null,
  };
}

const MATCH_CANDIDATE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  skills: true,
  experience: true,
  experienceYears: true,
  phone: true,
  location: true,
  city: true,
  country: true,
  currentTitle: true,
  currentCompany: true,
  noticePeriod: true,
  avatar: true,
  resume: true,
  linkedIn: true,
  salary: true,
  hotlist: true,
  assignedJobs: true,
  stage: true,
  designation: true,
  updatedAt: true,
  source: true,
  assignedToId: true,
  assignedTo: { select: { id: true, name: true } },
};

/** Matches visible when tied to the user's jobs/candidates or created by them (unless tenant-wide access). */
function buildMatchListScope(req) {
  if (!req?.user?.id) return null;
  if (canViewAllAssignments(req)) return null;
  if (hasAnyPermission(req, ['view_all_candidates'])) return null;
  const uid = req.user.id;
  return {
    OR: [
      { createdById: uid },
      { job: { is: { OR: [{ createdById: uid }, { assignedToId: uid }] } } },
      { candidate: { is: { OR: [{ createdById: uid }, { assignedToId: uid }] } } },
    ],
  };
}

function parseSalary(salary) {
  if (!salary || typeof salary !== 'object') {
    return {
      expected: 'Not shared',
      currency: 'USD',
      amount: 0,
      fit: 'average',
    };
  }

  const currency = salary.currency || 'USD';
  const rawExpected = salary.expected ?? salary.max ?? salary.current ?? 0;
  const amount = Number(rawExpected) || 0;
  const symbol =
    currency === 'GBP' ? '£' : currency === 'EUR' ? 'EUR ' : currency === 'INR' ? 'INR ' : currency === 'AED' ? 'AED ' : '$';

  return {
    expected: amount ? `${symbol}${amount >= 1000 ? `${Math.round(amount / 1000)}k` : amount}` : 'Not shared',
    currency,
    amount,
    fit: amount <= 80000 ? 'excellent' : amount <= 120000 ? 'good' : amount <= 160000 ? 'average' : 'poor',
  };
}

function toRelativeLabel(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return diffDays <= 1 ? '1d ago' : `${diffDays}d ago`;
}

function toTimestamp(value) {
  if (!value) return 'Recently';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildExplanation(match, candidate, job) {
  const candidateSkills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const jobSkills = Array.isArray(job.skills) ? job.skills : [];
  const normalizedCandidateSkills = candidateSkills.map((skill) => String(skill).toLowerCase());
  const matchedSkills = jobSkills.filter((skill) => normalizedCandidateSkills.includes(String(skill).toLowerCase())).slice(0, 4);
  const missingSkills = jobSkills.filter((skill) => !normalizedCandidateSkills.includes(String(skill).toLowerCase())).slice(0, 4);
  const score = Number(match.score || 0);

  const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();

  return {
    skills: matchedSkills.length >= Math.max(1, Math.ceil(jobSkills.length / 2)) ? true : matchedSkills.length ? 'partial' : false,
    experience:
      candidate.experience && candidate.experience >= Number.parseInt(String(job.experienceRequired || '0'), 10)
        ? true
        : candidate.experience
        ? 'partial'
        : false,
    location: candidate.location && job.location && candidate.location.toLowerCase().includes(String(job.location).toLowerCase()) ? true : 'partial',
    salary: score >= 85 ? true : score >= 70 ? 'partial' : false,
    text:
      match.notes ||
      candidateName
        ? `${candidateName} aligns with ${job.title} on ${matchedSkills.slice(0, 3).join(', ') || 'core skills'} and ${candidate.experience || 0} years of experience.`
        : `Profile aligned to ${job.title}.`,
    matchedSkills,
    missingSkills,
    roleRequirement: job.experienceRequired || `${candidate.experience || 0}+ years`,
  };
}

function deriveDisplayStatus(match, candidate, activities, jobId) {
  const submissionActivity = activities.find((activity) => {
    const metadata = getActivityMetadata(activity);
    return metadata.kind === MATCH_SUBMISSION_ACTIVITY_KIND && metadata.jobId === jobId;
  });
  if (match.status === 'REJECTED') return 'Rejected';
  if (submissionActivity) return 'Submitted';
  if ((candidate.assignedJobs || []).includes(jobId)) return 'Sent to Pipeline';
  if (match.status === 'SHORTLISTED') return 'Selected';
  if (match.status === 'REVIEWED') return 'Reviewed';
  return 'New';
}

/** CRM pipeline stage for job drawer / candidates list — not Match.status (SUGGESTED, etc.). */
function resolveCandidateCrmStageForMatch(candidate, jobId, pipelineStageName, isAppliedMatch) {
  const pipelineLabel = String(pipelineStageName || '').trim();
  if (pipelineLabel) {
    const pipelineLower = pipelineLabel.toLowerCase();
    const pipelineLooksTerminal =
      pipelineLower.includes('hire') ||
      pipelineLower === 'placed' ||
      pipelineLower.includes('joined') ||
      pipelineLower.includes('onboard');
    if (isAppliedMatch && pipelineLooksTerminal) {
      return 'Applied';
    }
    return pipelineLabel;
  }

  const explicit = String(candidate?.stage || '').trim();
  const explicitLower = explicit.toLowerCase();
  const globalLooksTerminal =
    explicitLower.includes('hire') ||
    explicitLower === 'placed' ||
    explicitLower.includes('joined') ||
    explicitLower.includes('onboard');

  if (isAppliedMatch && (!explicit || explicitLower === 'new' || globalLooksTerminal)) {
    return 'Applied';
  }

  if (explicit && explicitLower !== 'new') {
    return explicit;
  }

  const assigned = Array.isArray(candidate?.assignedJobs)
    ? candidate.assignedJobs.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  if (jobId && assigned.includes(String(jobId))) {
    return 'Applied';
  }
  if (assigned.length) {
    return 'Applied';
  }
  return explicit || 'Applied';
}

function mapNotes(activities) {
  return activities
    .filter((activity) => getActivityMetadata(activity).kind === NOTE_ACTIVITY_KIND)
    .slice(0, 10)
    .map((activity) => {
      const metadata = getActivityMetadata(activity);
      return {
        id: activity.id,
        text: metadata.text || activity.description || '',
        createdAt: toRelativeLabel(activity.createdAt),
        author: activity.performedBy?.name || 'Recruiter',
      };
    });
}

function mapActivity(activities) {
  return activities.slice(0, 10).map((activity) => ({
    id: activity.id,
    title: activity.action,
    description: activity.description || getActivityMetadata(activity).text || '',
    timestamp: toTimestamp(activity.createdAt),
  }));
}

function mapSubmittedHistory(activities, jobId) {
  const activity = activities.find((item) => {
    const metadata = getActivityMetadata(item);
    return metadata.kind === MATCH_SUBMISSION_ACTIVITY_KIND && metadata.jobId === jobId;
  });

  if (!activity) return null;

  return {
    date: new Date(activity.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    status: getActivityMetadata(activity).notifyClient ? 'Submitted to client' : 'Drafted for client',
  };
}

function usableEmail(value) {
  const email = String(value || '').trim();
  if (!isDeliverableEmail(email)) return '';
  return email;
}

function getClientRecipients(client, explicitEmail) {
  const explicit = usableEmail(explicitEmail);
  if (explicit) return [explicit];

  const contacts = Array.isArray(client?.contacts) ? client.contacts : [];
  const fromContacts = contacts
    .filter((contact) => String(contact?.contactType || '').toUpperCase() !== 'CANDIDATE')
    .map((contact) => usableEmail(contact?.email))
    .filter(Boolean);
  const fromEmails = Array.isArray(client?.emails)
    ? client.emails.map((email) => usableEmail(email)).filter(Boolean)
    : [];
  const fromTeam = usableEmail(client?.teamMemberEmail);
  return [...new Set([...fromContacts, ...fromEmails, ...(fromTeam ? [fromTeam] : [])])];
}

function mapEmailCandidate(candidate) {
  return {
    name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
    currentTitle: candidate.currentTitle || candidate.designation || 'Candidate',
    currentCompany: candidate.currentCompany || '',
    experience: candidate.experience || 0,
    location: candidate.location || 'Not shared',
    skills: candidate.skills || [],
    email: candidate.email || '',
    phone: candidate.phone || 'Not shared',
  };
}

async function getCandidateActivities(candidateIds) {
  if (!candidateIds.length) return [];
  return prisma.activity.findMany({
    where: {
      entityType: CANDIDATE_ACTIVITY_ENTITY,
      entityId: { in: candidateIds },
    },
    include: {
      performedBy: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function mapMatchRecord(match, activitiesByCandidateId) {
  const candidate = match.candidate;
  const job = match.job;
  const activities = activitiesByCandidateId.get(candidate.id) || [];
  const evaluation = coerceEvaluationObject(match.evaluation);
  let explanation = buildExplanation(match, candidate, job);
  let score = Math.round(Number(match.score || 0));

  if (evaluation) {
    const ev = evaluation;
    const final = Number(ev.finalScore ?? ev.merged?.finalScore ?? match.score) || 0;
    const p1 = ev.pass1?.score ?? 0;
    const p2 = ev.pass2?.score ?? 0;
    const p3 = ev.pass3?.score ?? 0;
    const p4 = ev.pass4?.skipped ? null : ev.pass4?.score ?? 0;
    explanation = {
      ...explanation,
      text: String(ev.suggestion || explanation.text),
      scoreBand: ev.band || ev.merged?.band || explanation.scoreBand,
      matchedSkills:
        Array.isArray(ev.pass1?.matchedRequired) && ev.pass1.matchedRequired.length
          ? ev.pass1.matchedRequired.slice(0, 10)
          : explanation.matchedSkills,
      missingSkills:
        Array.isArray(ev.pass1?.missingRequired) && ev.pass1.missingRequired.length
          ? ev.pass1.missingRequired.slice(0, 10)
          : explanation.missingSkills,
      aiEngine: {
        deterministicScore: p1,
        aiScore: p3,
        verdict: ev.band || ev.merged?.band || 'Fit',
        confidenceLevel: final >= 80 ? 'high' : final >= 60 ? 'medium' : 'low',
        confidenceScore: final,
        breakdown: {
          skills: p1,
          experience: p2,
          semantic: p3,
          cultural: p4 == null ? 0 : p4,
        },
        pipelineWeights: ev.weights || ev.merged?.weights,
        suggestion: ev.suggestion,
        runId: ev.runId,
        formula: ev.merged?.formula,
      },
    };
    score = Math.round(final);
  }

  const salary = parseSalary(candidate.salary);
  const displayStatus = deriveDisplayStatus(match, candidate, activities, job.id);
  const isAppliedMatch = matchRepresentsJobApplication({ ...match, evaluation }, candidate, job.id);

  return {
    id: match.id,
    candidateId: candidate.id,
    jobId: job.id,
    name: `${candidate.firstName} ${candidate.lastName}`.trim(),
    photo: candidate.avatar || '',
    initials: buildInitials(candidate.firstName, candidate.lastName),
    score,
    skills: candidate.skills || [],
    experience: normalizeCandidateExperienceYears(candidate),
    experienceYears: normalizeCandidateExperienceYears(candidate),
    location: normalizeCandidateLocationLabel(candidate),
    city: candidate.city || null,
    country: candidate.country || null,
    salary,
    noticePeriod: candidate.noticePeriod || 'Not shared',
    status: displayStatus,
    candidateStage: resolveCandidateCrmStageForMatch(
      candidate,
      job.id,
      match.__pipelineStageName,
      isAppliedMatch,
    ),
    matchRecordStatus: match.status,
    candidate: { stage: candidate.stage || null },
    matchSource: match.createdById ? 'manual' : 'ai',
    createdBy: match.createdBy ? { name: match.createdBy.name } : { name: '—' },
    candidateOwner: candidate.assignedTo?.name || null,
    createdAt: match.createdAt,
    explanation,
    currentTitle: candidate.currentTitle || candidate.designation || 'Candidate',
    currentCompany: candidate.currentCompany || 'Unknown company',
    email: candidate.email,
    phone: candidate.phone || 'Not shared',
    resumeName: candidate.resume ? String(candidate.resume).split('/').pop() : 'Resume not uploaded',
    portfolioUrl: candidate.linkedIn || undefined,
    savedAt: candidate.hotlist ? candidate.updatedAt : null,
    notes: mapNotes(activities),
    activity: mapActivity(activities),
    submittedHistory: mapSubmittedHistory(activities, job.id),
    matchRating: null,
    isPhase1Candidate:
      (evaluation && evaluation.origin === 'phase1') ||
      String(candidate.source || '').toLowerCase() === 'phase1',
    isAppliedCandidate: isAppliedMatch,
  };
}

function coerceEvaluationObject(evaluation) {
  if (!evaluation) return null;
  if (typeof evaluation === 'object') return evaluation;
  if (typeof evaluation === 'string') {
    try {
      const parsed = JSON.parse(evaluation);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function isAppliedPipelineEvaluation(evaluation) {
  const ev = coerceEvaluationObject(evaluation);
  return Boolean(ev && ev.origin === 'applied');
}

function matchRepresentsJobApplication(match, candidate, jobId) {
  if (isAppliedPipelineEvaluation(match?.evaluation)) return true;
  const notes = String(match?.notes || '').toLowerCase();
  if (notes.includes('applied from candidate portal') || notes.includes('job portal')) {
    return true;
  }
  const status = String(match?.status || '').toUpperCase();
  if (status === 'REVIEWED' && notes.includes('applied')) return true;
  const assigned = Array.isArray(candidate?.assignedJobs)
    ? candidate.assignedJobs.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  return Boolean(jobId && assigned.includes(String(jobId)) && ['REVIEWED', 'SUBMITTED'].includes(status));
}

/** One row per candidate — Applied tab prefers applied-origin; AI tab prefers ai-origin. */
function dedupeMatchesByCandidateId(matches, { preferApplied = false } = {}) {
  const bestByCandidate = new Map();

  const originPriority = (match) => {
    const ev = coerceEvaluationObject(match?.evaluation);
    if (ev?.pending) return 0;
    if (isAppliedPipelineEvaluation(ev)) return preferApplied ? 2 : 0;
    return preferApplied ? 0 : 2;
  };

  const rank = (match) => ({
    origin: originPriority(match),
    score: Number(match?.score || 0),
    updated: new Date(match?.updatedAt || match?.createdAt || 0).getTime(),
  });

  for (const match of matches) {
    const candidateId = String(match?.candidateId || '').trim();
    if (!candidateId) continue;

    const existing = bestByCandidate.get(candidateId);
    if (!existing) {
      bestByCandidate.set(candidateId, match);
      continue;
    }

    const nextRank = rank(match);
    const prevRank = rank(existing);
    const pickNext =
      nextRank.origin > prevRank.origin ||
      (nextRank.origin === prevRank.origin &&
        (nextRank.score > prevRank.score ||
          (nextRank.score === prevRank.score && nextRank.updated >= prevRank.updated)));

    if (pickNext) bestByCandidate.set(candidateId, match);
  }

  return Array.from(bestByCandidate.values());
}

export const matchService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { jobId, candidateId, status, minScore, source, saved } = req.query;

    const where = {};
    if (jobId) where.jobId = jobId;
    if (candidateId) where.candidateId = candidateId;
    if (status) where.status = status;
    if (minScore !== undefined && minScore !== null && minScore !== '') {
      const parsed = parseFloat(minScore);
      if (Number.isFinite(parsed)) where.score = { gte: parsed };
    }
    if (source === 'manual') where.createdById = MANUAL_MATCH_AUTHOR_WHERE;
    if (source === 'ai') where.createdById = AI_MATCH_AUTHOR_WHERE;
    // Applied tab / job drawer: all match rows for this job (pool merge adds non-match applicants).
    if (source === 'applied' && jobId) {
      where.jobId = String(jobId);
    }
    if (saved === 'true') {
      where.candidate = {
        is: {
          hotlist: true,
        },
      };
    }

    const visibilityScope = buildMatchListScope(req);
    const mergedWhere =
      visibilityScope && Object.keys(where).length > 0
        ? { AND: [where, visibilityScope] }
        : visibilityScope || where;

    const pipelineRequested =
      req.query.runPipeline === '1' || req.query.refresh === '1' || req.query.forceRefresh === '1';

    const shouldRunAiPipeline = String(source) === 'ai' && jobId && pipelineRequested;
    const shouldRunAppliedPipeline = String(source) === 'applied' && jobId && pipelineRequested;

    if (shouldRunAiPipeline || shouldRunAppliedPipeline) {
      try {
        const { runMatchPipeline } = require('../../services/jobMatchEngine/matchPipelineRunner.cjs');
        const forceRefresh = req.query.refresh === '1' || req.query.forceRefresh === '1';
        const suggestionMin = Number(process.env.MATCH_SUGGESTION_MIN_SCORE || 50);
        const minForPipeline = minScore ? parseFloat(minScore) : suggestionMin;

        if (shouldRunAppliedPipeline) {
          const pool = await loadAppliedMatchCandidatePool(req, String(jobId));
          console.log(
            `[matchService] Applied pool: tenant-assigned=${pool.mergedCount} (job ${jobId})`
          );
          await runMatchPipeline({
            jobId: String(jobId),
            prisma,
            minScore: Number.isFinite(minForPipeline) ? minForPipeline : suggestionMin,
            forceRefresh,
            candidates: pool.candidates,
            poolStats: pool,
            pipelineMode: 'applied',
            materializeCandidate: ensureCandidateMaterializedForMatch,
          });
        } else {
          const pool = await loadMatchPipelineCandidatePool(req, String(jobId));
          if (pool.commonIncluded || pool.portalIncluded) {
            const tombstoneNote =
              pool.phase1TombstoneReincluded > 0
                ? ` phase1-reincluded=${pool.phase1TombstoneReincluded}`
                : '';
            console.log(
              `[matchService] AI pool: tenant=${pool.tenantCount} common=${pool.commonCount ?? 0} portal=${pool.portalCount} merged=${pool.mergedCount}${tombstoneNote} (job ${jobId})`
            );
          }
          const jobIdStr = String(jobId);
          await runMatchPipeline({
            jobId: jobIdStr,
            prisma,
            minScore: Number.isFinite(minForPipeline) ? minForPipeline : suggestionMin,
            forceRefresh,
            candidates: pool.candidates,
            poolStats: pool,
            pipelineMode: 'ai',
            materializeCandidate: (row) =>
              ensureCandidateMaterializedForMatch(row, {
                matchingJobId: jobIdStr,
                aiMatchOnly: true,
              }),
          });
        }
      } catch (pipeErr) {
        console.error('[matchService] Match pipeline failed:', pipeErr?.message || pipeErr);
      }
    }

    let [matches, total] = await Promise.all([
      prisma.match.findMany({
        where: mergedWhere,
        skip,
        take: limit,
        include: {
          candidate: {
            select: MATCH_CANDIDATE_SELECT,
          },
          job: {
            select: {
              id: true,
              title: true,
              skills: true,
              experienceRequired: true,
              location: true,
              status: true,
              priority: true,
              client: { select: { companyName: true } },
            },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { score: 'desc' },
      }),
      prisma.match.count({ where: mergedWhere }),
    ]);

    const activities = await getCandidateActivities([...new Set(matches.map((match) => match.candidate.id))]);
    const activitiesByCandidateId = new Map();
    for (const activity of activities) {
      const candidateActivities = activitiesByCandidateId.get(activity.entityId) || [];
      candidateActivities.push(activity);
      activitiesByCandidateId.set(activity.entityId, candidateActivities);
    }

    const pipelineStageByCandidateId = new Map();
    if (jobId && matches.length) {
      const candidateIds = [...new Set(matches.map((match) => match.candidateId).filter(Boolean))];
      const pipelineRows = await prisma.pipelineEntry.findMany({
        where: { jobId: String(jobId), candidateId: { in: candidateIds } },
        include: { stage: { select: { name: true, systemRole: true } } },
        orderBy: [{ movedAt: 'desc' }, { createdAt: 'desc' }],
      });
      for (const row of pipelineRows) {
        if (!pipelineStageByCandidateId.has(row.candidateId)) {
          pipelineStageByCandidateId.set(row.candidateId, row.stage?.name || null);
        }
      }
    }
    for (const match of matches) {
      match.__pipelineStageName = pipelineStageByCandidateId.get(match.candidateId) || null;
    }

    if (source === 'ai' && jobId) {
      const pool = await loadMatchPipelineCandidatePool(req, String(jobId));
      const poolById = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
      const poolIdSet = new Set(pool.candidates.map((candidate) => candidate.id));
      matches = matches
        .filter((match) => poolIdSet.has(match.candidateId))
        .map((match) => {
          const poolRow = poolById.get(match.candidateId);
          if (poolRow) {
            match.candidate = enrichSparseCandidateFromPool(match.candidate, poolRow);
          }
          return match;
        });
      const jobRow = await prisma.job.findFirst({
        where: { id: String(jobId), isDeleted: { not: true } },
        include: { client: { select: { companyName: true, logo: true } } },
      });
      const scoredIds = new Set(matches.map((match) => match.candidateId));
      for (const candidate of pool.candidates) {
        if (scoredIds.has(candidate.id)) continue;
        if (!jobRow) continue;
        const enrichedCandidate = enrichSparseCandidateFromPool(candidate, poolById.get(candidate.id));
        matches.push({
          id: `ai-pending-${candidate.id}`,
          candidateId: candidate.id,
          jobId: String(jobId),
          score: 0,
          status: 'NEW',
          candidate: enrichedCandidate,
          job: jobRow,
          createdById: null,
          evaluation: {
            origin: 'ai',
            pending: true,
            suggestion: 'Run AI Matches to score this candidate for the job.',
          },
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      matches = dedupeMatchesByCandidateId(matches, { preferApplied: false });
      matches.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
      total = matches.length;
    } else if (source === 'ai') {
      matches = dedupeMatchesByCandidateId(matches, { preferApplied: false });
      total = matches.length;
    }

    if (source === 'applied' && jobId) {
      const pool = await loadAppliedMatchCandidatePool(req, String(jobId));
      const poolById = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
      const poolIdSet = new Set(pool.candidates.map((candidate) => candidate.id));
      // Anyone linked to this job (applied, assigned, pipeline, portal) — keep AI/manual match scores too.
      matches = matches
        .filter((match) => poolIdSet.has(match.candidateId))
        .map((match) => {
          const poolRow = poolById.get(match.candidateId);
          if (poolRow) {
            match.candidate = enrichSparseCandidateFromPool(match.candidate, poolRow);
          }
          return match;
        });
      const jobRow = await prisma.job.findFirst({
        where: { id: String(jobId), isDeleted: { not: true } },
        include: { client: { select: { companyName: true, logo: true } } },
      });
      const scoredIds = new Set(matches.map((match) => match.candidateId));
      for (const candidate of pool.candidates) {
        if (scoredIds.has(candidate.id)) continue;
        if (!jobRow) continue;
        const enrichedCandidate = enrichSparseCandidateFromPool(candidate, poolById.get(candidate.id));
        matches.push({
          id: `applied-pending-${candidate.id}`,
          candidateId: candidate.id,
          jobId: String(jobId),
          score: 0,
          status: 'NEW',
          candidate: enrichedCandidate,
          job: jobRow,
          createdById: null,
          evaluation: {
            origin: 'applied',
            pending: true,
            suggestion: 'Candidate applied to this job. Run AI Applied Matches to score.',
          },
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      matches = dedupeMatchesByCandidateId(matches, { preferApplied: true });
      matches.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
      total = matches.length;
    }

    let enrichedMatches = matches.map((match) => mapMatchRecord(match, activitiesByCandidateId));
    if (source === 'applied' && jobId) {
      enrichedMatches = enrichedMatches.map((row) => ({ ...row, isAppliedCandidate: true }));
    }

    return formatPaginationResponse(enrichedMatches, page, limit, total);
  },

  async getById(id, req = null) {
    const visibilityScope = buildMatchListScope(req);
    const whereClause = visibilityScope ? { AND: [{ id }, visibilityScope] } : { id };
    const match = await prisma.match.findFirst({
      where: whereClause,
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            skills: true,
            experience: true,
            location: true,
            currentTitle: true,
            currentCompany: true,
            noticePeriod: true,
            avatar: true,
            resume: true,
            linkedIn: true,
            salary: true,
            hotlist: true,
            assignedJobs: true,
            stage: true,
            designation: true,
            updatedAt: true,
          },
        },
        job: {
          include: {
            client: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!match) return null;

    if (match.jobId) {
      const pipelineRow = await prisma.pipelineEntry.findFirst({
        where: { candidateId: match.candidateId, jobId: match.jobId },
        include: { stage: { select: { name: true } } },
        orderBy: [{ movedAt: 'desc' }, { createdAt: 'desc' }],
      });
      match.__pipelineStageName = pipelineRow?.stage?.name || null;
    }

    const activities = await getCandidateActivities([match.candidate.id]);
    const activitiesByCandidateId = new Map([[match.candidate.id, activities]]);
    return mapMatchRecord(match, activitiesByCandidateId);
  },

  async create(data) {
    return prisma.match.create({
      data: {
        candidateId: data.candidateId,
        jobId: data.jobId,
        score: normalizeMatchScore(data.score),
        status: data.status || 'SUGGESTED',
        notes: data.notes,
        createdById: data.createdById,
      },
    });
  },

  /** Submit-to-client: ensure a real Match row exists for candidate + job (handles applied-pool / duplicate). */
  async findOrCreateForSubmit({ candidateId, jobId, score, createdById }) {
    const cid = String(candidateId || '').trim();
    const jid = String(jobId || '').trim();
    if (!cid || !jid) {
      throw new Error('Candidate and job are required to submit to the client');
    }

    const candidate = await prisma.candidate.findFirst({
      where: { id: cid, isDeleted: { not: true } },
      select: { id: true },
    });
    if (!candidate) {
      throw new Error('Candidate not found');
    }

    const job = await prisma.job.findFirst({
      where: { id: jid, isDeleted: { not: true } },
      select: { id: true },
    });
    if (!job) {
      throw new Error('Job not found for this candidate');
    }

    const existing = await prisma.match.findFirst({
      where: { candidateId: cid, jobId: jid },
    });
    if (existing) return existing;

    try {
      return await prisma.match.create({
        data: {
          candidateId: cid,
          jobId: jid,
          score: normalizeMatchScore(score),
          status: 'SUGGESTED',
          createdById: createdById || null,
        },
      });
    } catch (err) {
      if (err?.code === 'P2002') {
        const again = await prisma.match.findFirst({
          where: { candidateId: cid, jobId: jid },
        });
        if (again) return again;
      }
      throw err;
    }
  },

  async update(id, data) {
    return prisma.match.update({
      where: { id },
      data: {
        status: data.status,
        notes: data.notes,
        score: data.score,
      },
    });
  },

  async delete(id) {
    await prisma.match.delete({ where: { id } });
    return { message: 'Match deleted successfully' };
  },

  async save(id, data, userId) {
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        candidate: true,
        job: { select: { id: true, title: true } },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const saved = data?.saved !== false;

    await prisma.$transaction(async (tx) => {
      await tx.candidate.update({
        where: { id: match.candidateId },
        data: {
          hotlist: saved,
          lastActivity: new Date(),
        },
      });

      await tx.activity.create({
        data: {
          action: saved ? 'Match saved' : 'Match unsaved',
          description: saved
            ? `Saved match for ${match.job.title}.`
            : `Removed saved match for ${match.job.title}.`,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: match.candidateId,
          category: 'Candidates',
          relatedType: 'job',
          relatedId: match.jobId,
          relatedLabel: match.job.title,
          metadata: {
            kind: MATCH_SAVE_ACTIVITY_KIND,
            saved,
            jobId: match.jobId,
            relatedJobTitle: match.job.title,
          },
        },
      });
    });

    return this.getById(id);
  },

  async submit(id, data, userId) {
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        candidate: true,
        job: {
          include: {
            client: {
              include: {
                contacts: {
                  where: {
                    contactType: { in: ['CLIENT', 'HIRING_MANAGER'] },
                  },
                  select: {
                    email: true,
                    firstName: true,
                    lastName: true,
                    contactType: true,
                  },
                  orderBy: [{ createdAt: 'asc' }],
                },
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const message = String(data?.message || '').trim();
    const notifyClient = Boolean(data?.notifyClient);
    const recipients = notifyClient ? getClientRecipients(match.job.client, data?.toEmail) : [];

    if (notifyClient && !recipients.length) {
      const raw = String(data?.toEmail || '').trim();
      if (raw && !isDeliverableEmail(raw)) {
        throw new Error(`Client contact email is invalid: ${raw}`);
      }
      throw new Error('No client contact email found for this job');
    }

    // Mirror the interview drawer: the recruiter must commit to a purpose.
    // We default to GENERAL if the caller didn't pass one (older client),
    // but still log it on the activity so the row carries the intent.
    const submissionType =
      normalizeSubmissionType(data?.submissionType) || 'GENERAL';
    const cvShareModeRaw = String(data?.cvShareMode || '').trim().toLowerCase();
    const cvShareMode =
      cvShareModeRaw === 'edited' || cvShareModeRaw === 'original' || cvShareModeRaw === 'saasa'
        ? cvShareModeRaw
        : null;

    const batchMatchIds = Array.isArray(data?.batchMatchIds)
      ? data.batchMatchIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    const normalizedBatchMatchIds = Array.from(new Set(batchMatchIds));

    const reviewUrl = buildClientReviewUrl(
      match,
      submissionType,
      cvShareMode || 'edited',
      normalizedBatchMatchIds.length > 1 ? normalizedBatchMatchIds : null,
    );
    console.info(
      `[match.submit] client-review url for ${env.NODE_ENV}: ${reviewUrl} (FRONTEND_URL=${env.FRONTEND_URL})`,
    );

    if (cvShareMode || reviewUrl) {
      const freshCandidate = await prisma.candidate.findUnique({
        where: { id: match.candidateId },
      });
      const existingExtra =
        freshCandidate?.extraData &&
        typeof freshCandidate.extraData === 'object' &&
        !Array.isArray(freshCandidate.extraData)
          ? freshCandidate.extraData
          : {};
      const existingSubmission =
        existingExtra.cvSubmission &&
        typeof existingExtra.cvSubmission === 'object' &&
        !Array.isArray(existingExtra.cvSubmission)
          ? existingExtra.cvSubmission
          : {};
      const snapshot = cvShareMode
        ? buildCvSubmissionSnapshot(freshCandidate, match.job?.title || '')
        : existingSubmission.snapshot;
      await prisma.candidate.update({
        where: { id: match.candidateId },
        data: {
          extraData: {
            ...existingExtra,
            cvSubmission: {
              ...existingSubmission,
              ...(cvShareMode ? { shareMode: cvShareMode, snapshot } : {}),
              updatedAt: new Date().toISOString(),
              reviewUrl,
            },
          },
        },
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id },
        data: {
          status: 'SHORTLISTED',
          notes: message || match.notes || null,
        },
      });

      await tx.candidate.update({
        where: { id: match.candidateId },
        data: {
          lastActivity: new Date(),
        },
      });

      await tx.activity.create({
        data: {
          action: 'Candidate submitted',
          description: `Submitted to ${match.job.client?.companyName || 'client'}${notifyClient ? ' and client notified.' : '.'}`,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: match.candidateId,
          category: 'Candidates',
          relatedType: 'job',
          relatedId: match.jobId,
          relatedLabel: match.job.title,
          metadata: {
            kind: MATCH_SUBMISSION_ACTIVITY_KIND,
            jobId: match.jobId,
            relatedJobTitle: match.job.title,
            clientName: match.job.client?.companyName || null,
            notifyClient,
            message,
            submissionType,
            reviewUrl,
          },
        },
      });
    });

    let emailSent = false;
    let emailError = null;

    if (notifyClient) {
      const purposeLine = MATCH_SUBMISSION_PURPOSES[submissionType] || MATCH_SUBMISSION_PURPOSES.GENERAL;
      const finalMessage = [
        message,
        message ? '' : null,
        normalizedBatchMatchIds.length > 1
          ? `Review ${normalizedBatchMatchIds.length} submitted candidates using the link below.`
          : null,
        purposeLine,
        reviewUrl ? `Review link: ${reviewUrl}` : null,
      ]
        .filter((part) => part !== null)
        .join('\n')
        .trim();

      let emailCandidates = [mapEmailCandidate(match.candidate)];
      if (normalizedBatchMatchIds.length > 1) {
        const batchMatches = await prisma.match.findMany({
          where: { id: { in: normalizedBatchMatchIds } },
          include: { candidate: true },
        });
        emailCandidates = normalizedBatchMatchIds
          .map((id) => batchMatches.find((row) => row.id === id))
          .filter(Boolean)
          .map((row) => mapEmailCandidate(row.candidate));
      }

      const emailResult = await sendMatchSubmissionEmail({
        to: recipients,
        clientName: match.job.client?.companyName || 'Team',
        jobTitle: match.job.title,
        recruiterName: match.createdBy?.name || 'Recruitment Team',
        message: finalMessage,
        candidates: emailCandidates,
        portalUrl: reviewUrl || `${env.FRONTEND_URL}/matches`,
        forceSend: true,
      });

      emailSent = Boolean(emailResult?.success) && !emailResult?.skipped;
      if (emailResult?.skipped) {
        emailError = 'Client submission email is disabled in notification settings';
        console.warn('[match.submit] client email skipped:', emailError);
      } else if (!emailResult?.success) {
        emailError = emailResult?.error || 'Failed to send email';
        console.warn('[match.submit] client email failed:', emailError);
      }
    }

    const additionalClients = Array.isArray(data?.additionalClients)
      ? data.additionalClients.filter((item) => item && item.clientId)
      : [];

    if (notifyClient && additionalClients.length) {
      const purposeLine =
        MATCH_SUBMISSION_PURPOSES[submissionType] || MATCH_SUBMISSION_PURPOSES.GENERAL;
      const finalMessage = [
        message,
        message ? '' : null,
        purposeLine,
        reviewUrl ? `Review link: ${reviewUrl}` : null,
      ]
        .filter((part) => part !== null)
        .join('\n')
        .trim();
      const emailCandidate = mapEmailCandidate(match.candidate);

      for (const extra of additionalClients) {
        const extraClient = await prisma.client.findUnique({
          where: { id: String(extra.clientId) },
          include: {
            contacts: {
              where: { contactType: { in: ['CLIENT', 'HIRING_MANAGER'] } },
              select: { email: true, firstName: true, lastName: true, contactType: true },
              orderBy: [{ createdAt: 'asc' }],
            },
          },
        });
        if (!extraClient) continue;

        const extraRecipients = getClientRecipients(extraClient, extra.toEmail);
        if (!extraRecipients.length) continue;

        const extraEmailResult = await sendMatchSubmissionEmail({
          to: extraRecipients,
          clientName: extraClient.companyName || 'Team',
          jobTitle: match.job.title,
          recruiterName: match.createdBy?.name || 'Recruitment Team',
          message: finalMessage,
          candidates: [emailCandidate],
          portalUrl: reviewUrl || `${env.FRONTEND_URL}/matches`,
          forceSend: true,
        });

        if (!extraEmailResult.success) {
          console.warn(
            `[match.submit] additional client email failed for ${extraClient.companyName || 'client'}:`,
            extraEmailResult.error,
          );
          continue;
        }

        await prisma.activity.create({
          data: {
            action: 'Candidate submitted',
            description: `Submitted to ${extraClient.companyName || 'client'} (additional recipient).`,
            performedById: userId,
            entityType: CANDIDATE_ACTIVITY_ENTITY,
            entityId: match.candidateId,
            category: 'Candidates',
            relatedType: 'job',
            relatedId: match.jobId,
            relatedLabel: match.job.title,
            metadata: {
              kind: MATCH_SUBMISSION_ACTIVITY_KIND,
              jobId: match.jobId,
              relatedJobTitle: match.job.title,
              clientName: extraClient.companyName || null,
              notifyClient: true,
              message,
              submissionType,
              reviewUrl,
              additionalClientId: extraClient.id,
            },
          },
        });
      }
    }

    try {
      const candidateName =
        `${match.candidate?.firstName || ''} ${match.candidate?.lastName || ''}`.trim() ||
        'Candidate';
      await notifyMatchSubmittedToClient({
        match,
        userId,
        candidateName,
        jobTitle: match.job?.title,
        clientName: match.job?.client?.companyName,
      });
    } catch (alertErr) {
      console.warn('[match.submitToClient] alert failed:', alertErr?.message || alertErr);
    }

    try {
      await moveCandidateToSubmittedToClient({
        candidateId: match.candidateId,
        jobId: match.jobId,
        performedById: userId,
        metadata: {
          matchId: match.id,
          submissionType,
        },
      });
    } catch (stageErr) {
      console.warn('[match.submit] candidate stage sync failed:', stageErr?.message || stageErr);
    }

    const submitted = await this.getById(id);
    return {
      ...submitted,
      reviewUrl,
      emailSent,
      emailError,
    };
  },

  async reject(id, data, userId) {
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        candidate: true,
        job: { select: { id: true, title: true } },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const reason = String(data?.reason || '').trim();
    const notes = String(data?.notes || '').trim();

    if (!reason) {
      throw new Error('Reject reason is required');
    }

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id },
        data: {
          status: 'REJECTED',
          notes: notes || reason,
        },
      });

      await tx.candidate.update({
        where: { id: match.candidateId },
        data: {
          lastActivity: new Date(),
        },
      });

      await tx.activity.create({
        data: {
          action: 'Match rejected',
          description: `${reason}${notes ? ` • ${notes}` : ''}`,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: match.candidateId,
          category: 'Candidates',
          relatedType: 'job',
          relatedId: match.jobId,
          relatedLabel: match.job.title,
          metadata: {
            kind: MATCH_REJECTION_ACTIVITY_KIND,
            reason,
            notes,
            jobId: match.jobId,
            relatedJobTitle: match.job.title,
          },
        },
      });
    });

    return this.getById(id);
  },

  async bulkReject(data, userId) {
    const matchIds = Array.isArray(data?.matchIds) ? data.matchIds.filter(Boolean) : [];
    const reason = String(data?.reason || '').trim();
    const notes = String(data?.notes || '').trim();

    if (!matchIds.length) {
      throw new Error('Select at least one match');
    }

    if (!reason) {
      throw new Error('Reject reason is required');
    }

    const items = [];
    for (const matchId of matchIds) {
      const updated = await this.reject(matchId, { reason, notes }, userId);
      items.push(updated);
    }

    return {
      count: items.length,
      items,
    };
  },

  async bulkAddToPipeline(data, userId) {
    const candidateIds = Array.isArray(data?.candidateIds) ? data.candidateIds.filter(Boolean) : [];
    const jobId = String(data?.jobId || '').trim();
    const stage = String(data?.stage || '').trim();
    const recruiterId = String(data?.recruiterId || '').trim();
    const notes = String(data?.notes || '').trim();
    const priority = String(data?.priority || 'Medium').trim();

    if (!candidateIds.length) {
      throw new Error('Select at least one candidate');
    }

    if (!jobId) {
      throw new Error('Job is required');
    }

    if (!stage) {
      throw new Error('Pipeline stage is required');
    }

    const items = [];
    for (const candidateId of candidateIds) {
      const updated = await candidateService.addToPipeline(
        candidateId,
        {
          jobId,
          stage,
          recruiterId: recruiterId || undefined,
          notes,
          priority,
        },
        userId
      );
      items.push(updated);
    }

    return {
      count: items.length,
      items,
    };
  },

  async bulkEmail(data, userId) {
    const matchIds = Array.isArray(data?.matchIds) ? data.matchIds.filter(Boolean) : [];
    const message = String(data?.message || '').trim();
    const subject = String(data?.subject || '').trim();

    if (!matchIds.length) {
      throw new Error('Select at least one match');
    }

    const matches = await prisma.match.findMany({
      where: {
        id: { in: matchIds },
      },
      include: {
        candidate: true,
        job: {
          include: {
            client: {
              include: {
                contacts: {
                  where: {
                    contactType: { in: ['CLIENT', 'HIRING_MANAGER'] },
                  },
                  select: {
                    email: true,
                    firstName: true,
                    lastName: true,
                    contactType: true,
                  },
                  orderBy: [{ createdAt: 'asc' }],
                },
              },
            },
          },
        },
      },
    });

    if (!matches.length) {
      throw new Error('No matches found');
    }

    const firstJob = matches[0].job;
    const sameJob = matches.every((item) => item.jobId === firstJob.id);
    if (!sameJob) {
      throw new Error('Bulk email requires matches from the same job');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const recipients = getClientRecipients(firstJob.client, data?.toEmail);
    if (!recipients.length) {
      throw new Error('No client contact email found for this job');
    }

    // One review token per match — the bulk email lists all candidates and
    // includes a per-candidate "review" link so the client can drill into any
    // one of them. We pick the first link as `portalUrl` so older email
    // templates still have a meaningful CTA target.
    const submissionType = normalizeSubmissionType(data?.submissionType) || 'GENERAL';
    const reviewLinks = matches.map((item) => ({
      candidateId: item.candidateId,
      candidateName: `${item.candidate?.firstName || ''} ${item.candidate?.lastName || ''}`.trim() || 'Candidate',
      url: buildClientReviewUrl(item, submissionType),
    }));

    const purposeLine =
      MATCH_SUBMISSION_PURPOSES[submissionType] || MATCH_SUBMISSION_PURPOSES.GENERAL;
    const linkBlock = reviewLinks
      .map((entry) => `• ${entry.candidateName}: ${entry.url}`)
      .join('\n');
    const finalMessage = [message, message ? '' : null, purposeLine, linkBlock]
      .filter((part) => part !== null)
      .join('\n')
      .trim();

    const emailResult = await sendMatchSubmissionEmail({
      to: recipients,
      clientName: firstJob.client?.companyName || 'Team',
      jobTitle: firstJob.title,
      recruiterName: user?.name || 'Recruitment Team',
      message: finalMessage,
      subject: subject || `Candidate Submission: ${firstJob.title}`,
      candidates: matches.map((item) => mapEmailCandidate(item.candidate)),
      portalUrl: reviewLinks[0]?.url || `${env.FRONTEND_URL}/matches`,
      forceSend: true,
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send email');
    }

    for (const match of matches) {
      try {
        await moveCandidateToSubmittedToClient({
          candidateId: match.candidateId,
          jobId: match.jobId,
          performedById: userId,
          metadata: {
            matchId: match.id,
            bulk: true,
            submissionType,
          },
        });
      } catch (stageErr) {
        console.warn(
          '[match.bulkEmail] candidate stage sync failed:',
          stageErr?.message || stageErr,
        );
      }
    }

    await prisma.activity.createMany({
      data: matches.map((match) => ({
        action: 'Candidate submission email sent',
        description: `Submission email sent for ${match.job.title}.`,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: match.candidateId,
        category: 'Candidates',
        relatedType: 'job',
        relatedId: match.jobId,
        relatedLabel: match.job.title,
        metadata: {
          kind: MATCH_SUBMISSION_ACTIVITY_KIND,
          jobId: match.jobId,
          relatedJobTitle: match.job.title,
          clientName: match.job.client?.companyName || null,
          notifyClient: true,
          message,
          subject: subject || `Candidate Submission: ${firstJob.title}`,
          bulk: true,
          submissionType,
          reviewUrl: reviewLinks.find((entry) => entry.candidateId === match.candidateId)?.url || null,
        },
      })),
    });

    return {
      count: matches.length,
      recipients,
    };
  },
};
