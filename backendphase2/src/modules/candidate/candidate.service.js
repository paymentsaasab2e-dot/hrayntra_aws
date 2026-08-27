import {
  prisma,
  getActiveTenantDbName,
  getJobPortalPrismaClient,
  getCandidateCommonPrismaClient,
} from '../../config/prisma.js';
import {
  fetchCandidateCommonForMatchPipeline,
  fetchCandidateCommonForTenant,
  fetchCandidateCommonForCandidatesList,
  fetchCandidateCommonByCandidateId,
  mapCandidateCommonRowToCandidate,
  applyProfileSnapshotFields,
} from '../../services/candidateCommon/candidateCommonPool.service.js';
import {
  PIPELINE_STAGES,
  mapStageNameToPipelineBucket,
  updateCandidateStage,
  mapPlacementStatusToCrmStageLabel,
} from '../stage/candidateStage.service.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { escapePrismaRegex } from '../../utils/escapePrismaRegex.js';
import { resolveCandidateListExperienceYears } from '../../utils/candidateExperienceYears.util.js';
import {
  applyResumeJsonToCandidate,
  batchHydrateCandidatesResumeFromPortal,
} from '../../utils/candidateResumeHydrate.util.js';
import { batchHydratePortalProfileSections } from '../../utils/portalProfileSectionsHydrate.util.js';
import { persistCandidateCvProfileToTenant } from '../../utils/candidateCvPersist.util.js';
import {
  mergeCandidateRecruiterExtraData,
  pickRecruiterCvExtraFields,
} from '../../utils/candidateRecruiterCvExtra.util.js';
import { hydratePhase1SnapshotPersonalInfoFromPortal } from '../../utils/phase1SnapshotHydrate.util.js';
import {
  USER_BRIEF_SELECT,
  prepareListWithAuditMeta,
  attachAuditMetaToEntity,
} from '../../utils/listAuditMeta.js';
import { assertNoInterviewerScheduleConflicts } from '../../utils/interviewConflict.util.js';
import { resolveInterviewTimeZone, zonedWallClockToDate } from '../../utils/zonedDateTime.js';
import activityService, { ENTITY_TYPES } from '../../services/activityService.js';
import { appendEntityActivityVisibilityToWhere } from '../../services/activityVisibility.service.js';
import { dbLogger } from '../../utils/db-logger.js';
import { normalizePortalCareerPreferences } from '../../utils/normalizePortalCareerPreferences.js';
import { generateMeetingLink } from '../../services/meetingService.js';
import {
  sendCandidateAssignmentEmail,
  sendCandidateHiredEmail,
  sendCandidateInterviewScheduledEmail,
  sendCandidateRejectedEmail,
  sendInterviewPanelScheduledEmail,
} from '../../services/emailService.js';
import { buildSuperAdminOwnerScope, isSuperAdminUser } from '../../utils/superAdminScope.js';
import { canViewAllAssignments, hasAnyPermission as hasAnyPermissionScope } from '../../utils/permissionScope.js';
import {
  applyOrgCompanyAssigneeWhere,
  getRequestOrgScope,
  isOrgHeadPurpose,
  resolveWriteOrgUnitId,
} from '../../services/orgListScope.service.js';
import {
  buildAssigneeVisibilityOr,
  buildInitialParticipantIds,
  stampVisibilityOnAssigneeChange,
} from '../../services/memberVisibility.service.js';
import { pushPortalNotification } from '../notification/notification.service.js';
import { createAlertNotification } from '../setting/alert-dispatch.service.js';
import { notifyCandidateRejectedInternal } from '../setting/alert-notify.helpers.js';
import { notifyInterviewScheduleChange } from '../notification/interviewNotifications.js';
import { AI_MATCH_AUTHOR_WHERE } from '../match/matchQueryHelpers.js';
import { permanentDeleteCandidateById } from '../../services/candidatePermanentDelete.service.js';
import { detachCandidateFromJobLink } from '../internal/portal-job-detach.service.js';
import { getHqEnabledModules } from '../setting/recruitmentMode.service.js';
import {
  queueAiEntryRecommendation,
  buildEntitySnapshot,
} from '../../services/aiEntryRecommendation.service.js';

const CANDIDATE_ACTIVITY_ENTITY = 'CANDIDATE';
const NOTE_ACTIVITY_KIND = 'candidate-note';
const TAG_ACTIVITY_KIND = 'candidate-tag';
const PIPELINE_ACTIVITY_KIND = 'candidate-pipeline';

function isPhase1CandidateSource(source) {
  return String(source || '').trim().toLowerCase() === 'phase1';
}

function isPhase1CandidateRecord(candidate) {
  return isPhase1CandidateSource(candidate?.source);
}

/** All non-deleted job ids in the active tenant DB (used to scope cross-pool merges). */
async function getTenantJobIdSet() {
  const jobs = await prisma.job.findMany({
    where: { isDeleted: { not: true } },
    select: { id: true },
  });
  return new Set(jobs.map((job) => String(job.id)));
}

/** AI pipeline scores only — must not count as assign/apply on the Candidates list. */
function matchRepresentsCrmJobLink(match) {
  if (!match) return false;
  const ev = match.evaluation;
  if (ev && typeof ev === 'object') {
    if (ev.pending) return false;
    if (ev.origin === 'ai') return false;
    if (ev.origin === 'applied') return true;
  }
  if (match.createdById) return true;
  return false;
}

function crmLinkedMatches(candidate) {
  return (Array.isArray(candidate?.matches) ? candidate.matches : []).filter((row) =>
    matchRepresentsCrmJobLink(row)
  );
}

/** All job ids linked to a candidate (assign, apply, pipeline, CRM match — not AI-only scores). */
function collectCandidateLinkedJobIds(candidate) {
  const ids = new Set();
  const push = (raw) => {
    const id = String(raw || '').trim();
    if (id) ids.add(id);
  };
  for (const id of Array.isArray(candidate?.assignedJobs) ? candidate.assignedJobs : []) {
    push(id);
  }
  for (const row of Array.isArray(candidate?.applications) ? candidate.applications : []) {
    push(row?.jobId);
  }
  for (const row of Array.isArray(candidate?.pipelineEntries) ? candidate.pipelineEntries : []) {
    push(row?.jobId);
  }
  for (const row of crmLinkedMatches(candidate)) {
    push(row?.jobId);
    push(row?.job?.id);
  }
  return Array.from(ids);
}

function resolveCandidateAssignedJobTitlesForList(candidate, jobsById) {
  const titles = [];
  const seen = new Set();
  for (const jobId of collectCandidateLinkedJobIds(candidate)) {
    let title = jobsById.get(jobId);
    if (!title) {
      const match = (Array.isArray(candidate?.matches) ? candidate.matches : []).find(
        (row) => String(row?.jobId || row?.job?.id || '').trim() === jobId
      );
      title = match?.job?.title;
    }
    if (!title) {
      const application = (Array.isArray(candidate?.applications) ? candidate.applications : []).find(
        (row) => String(row?.jobId || '').trim() === jobId
      );
      title = application?.job?.title;
    }
    const label = String(title || '').trim();
    if (label && !seen.has(label)) {
      seen.add(label);
      titles.push(label);
    }
  }
  return titles;
}

/** Keep only job links that belong to the signed-in tenant (drops other tenants' apply/pipeline ids). */
function scopeCandidateJobLinksToTenant(candidate, tenantJobIdSet) {
  if (!candidate) return candidate;
  if (!tenantJobIdSet || tenantJobIdSet.size === 0) {
    return {
      ...candidate,
      assignedJobs: [],
      applications: [],
      pipelineEntries: [],
      matches: [],
      interviews: [],
      placements: [],
      assignedJobTitles: [],
    };
  }
  const allowed = tenantJobIdSet;
  const assignedJobs = (Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs : [])
    .map((id) => String(id || '').trim())
    .filter((id) => id && allowed.has(id));

  const applications = (Array.isArray(candidate.applications) ? candidate.applications : []).filter(
    (row) => allowed.has(String(row?.jobId || '').trim())
  );
  const pipelineEntries = (Array.isArray(candidate.pipelineEntries)
    ? candidate.pipelineEntries
    : []
  ).filter((row) => allowed.has(String(row?.jobId || '').trim()));
  const matches = (Array.isArray(candidate.matches) ? candidate.matches : []).filter((row) =>
    allowed.has(String(row?.jobId || row?.job?.id || '').trim()) && matchRepresentsCrmJobLink(row)
  );
  const interviews = (Array.isArray(candidate.interviews) ? candidate.interviews : []).filter(
    (row) => allowed.has(String(row?.jobId || row?.job?.id || '').trim())
  );
  const placements = (Array.isArray(candidate.placements) ? candidate.placements : []).filter(
    (row) => allowed.has(String(row?.jobId || '').trim())
  );

  const assignedJobTitles = (Array.isArray(candidate.assignedJobTitles)
    ? candidate.assignedJobTitles
    : []
  ).filter((_, index) => index < assignedJobs.length);

  return {
    ...candidate,
    assignedJobs,
    applications,
    pipelineEntries,
    matches,
    interviews,
    placements,
    assignedJobTitles,
  };
}

/** When tenantJobIdSet is provided (including empty), drop links outside this tenant. */
function scopeCandidateForActiveTenant(candidate, tenantJobIdSet) {
  if (tenantJobIdSet == null) return candidate;
  return scopeCandidateJobLinksToTenant(candidate, tenantJobIdSet);
}

/** True if candidate row carries any job/application/pipeline/match/interview link (unscoped). */
function candidateHasAnyJobLink(candidate) {
  if (!candidate) return false;
  return candidateHasRealJobLink(candidate, null);
}

/**
 * After tenant scoping, drop rows that only belonged to another tenant's pipeline.
 * Pure Phase 1 discovery (no job links anywhere) stays on All candidates via includeCommonPool.
 */
function shouldIncludeCandidateAfterTenantScope(original, scoped, options = {}) {
  const { includeCommonPool = false, inTenantDb = false } = options;
  if (inTenantDb) return true;
  if (candidateHasRealJobLink(scoped, null)) return true;
  if (candidateHasAnyJobLink(original)) return false;
  return includeCommonPool;
}

function candidateHasRealJobLink(candidate, tenantJobIdSet = null) {
  if (!candidate) return false;
  const row = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
  const assigned = Array.isArray(row.assignedJobs) ? row.assignedJobs : [];
  if (assigned.some((id) => String(id || '').trim())) return true;
  if (Array.isArray(row.applications) && row.applications.length > 0) return true;
  if (Array.isArray(row.pipelineEntries) && row.pipelineEntries.length > 0) return true;
  if (crmLinkedMatches(row).length > 0) return true;
  if (Array.isArray(row.interviews) && row.interviews.length > 0) return true;
  const titles = Array.isArray(row.assignedJobTitles) ? row.assignedJobTitles : [];
  if (titles.some((title) => String(title || '').trim())) return true;
  return false;
}

function isTerminalCandidateStage(stage) {
  const normalized = String(stage || '').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('hire') ||
    normalized === 'placed' ||
    normalized === 'joined' ||
    normalized === 'onboarded' ||
    normalized.includes('reject')
  );
}

/** Rank workflow stages so merges never downgrade Interviewing → Applied → New. */
function candidateWorkflowStageRank(stage) {
  const s = String(stage || '')
    .trim()
    .toLowerCase();
  if (!s || s === 'new') return 0;
  if (s.includes('reject')) return 70;
  if (s.includes('hire') || s.includes('placed') || s.includes('joined') || s.includes('onboard')) return 60;
  if (s.includes('offer')) return 50;
  if (s.includes('interview') && s.includes('complet')) return 45;
  if (s.includes('interview')) return 40;
  if (s.includes('screen') || s.includes('short') || s.includes('long') || s.includes('submit')) return 30;
  if (s.includes('applied') || s.includes('apply')) return 20;
  return 15;
}

function mergeCandidateWorkflowStages(...stages) {
  let best = '';
  let bestRank = -1;
  for (const stage of stages) {
    const label = String(stage || '').trim();
    if (!label) continue;
    const rank = candidateWorkflowStageRank(label);
    if (rank > bestRank) {
      bestRank = rank;
      best = label;
    }
  }
  return best;
}

const TERMINAL_INTERVIEW_STATUSES = new Set(['CANCELLED', 'CANCELED', 'REJECTED', 'NO_SHOW']);
const COMPLETED_INTERVIEW_STATUSES = new Set(['COMPLETED', 'FEEDBACK_SUBMITTED']);

function normalizeInterviewStatusForList(row) {
  return String(row?.status || 'SCHEDULED').toUpperCase();
}

function isRelevantInterviewForList(row) {
  return !TERMINAL_INTERVIEW_STATUSES.has(normalizeInterviewStatusForList(row));
}

function candidateHasUpcomingInterviewLink(candidate, tenantJobIdSet = null) {
  const scoped = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
  const interviews = Array.isArray(scoped?.interviews) ? scoped.interviews : [];
  return interviews.some((row) => {
    const status = normalizeInterviewStatusForList(row);
    if (TERMINAL_INTERVIEW_STATUSES.has(status)) return false;
    return !COMPLETED_INTERVIEW_STATUSES.has(status);
  });
}

function candidateHasCompletedInterviewOnly(candidate, tenantJobIdSet = null) {
  const scoped = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
  const interviews = Array.isArray(scoped?.interviews) ? scoped.interviews : [];
  const relevant = interviews.filter(isRelevantInterviewForList);
  if (!relevant.length) return false;
  return relevant.every((row) => COMPLETED_INTERVIEW_STATUSES.has(normalizeInterviewStatusForList(row)));
}

function candidateHasTenantApplicationLink(candidate, tenantJobIdSet = null) {
  const scoped = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
  return Array.isArray(scoped?.applications) && scoped.applications.length > 0;
}

function candidateHasFreshSubmittedApplication(candidate, tenantJobIdSet = null) {
  const scoped = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
  const apps = Array.isArray(scoped?.applications) ? scoped.applications : [];
  return apps.some((row) => {
    const status = String(row?.status || '').toUpperCase();
    return status === 'SUBMITTED' || status === 'UNDER_REVIEW';
  });
}

/** Latest placement status label for CRM candidate list (mirrors placements table). */
function resolvePlacementStageLabelForList(candidate, tenantJobIdSet = null) {
  const placements = Array.isArray(candidate?.placements) ? candidate.placements : [];
  if (!placements.length) return '';

  const tenantJobIds = tenantJobIdSet instanceof Set ? tenantJobIdSet : null;
  const relevant = placements
    .filter((row) => row && !row.deletedAt && row.status)
    .filter((row) => {
      const jobId = String(row?.jobId || '').trim();
      if (!tenantJobIds || !jobId) return true;
      return tenantJobIds.has(jobId);
    })
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

  const latest = relevant[0];
  if (!latest?.status) return '';
  return mapPlacementStatusToCrmStageLabel(latest.status);
}

function resolveLatestPlacementStatusForList(candidate, tenantJobIdSet = null) {
  const placements = Array.isArray(candidate?.placements) ? candidate.placements : [];
  if (!placements.length) return null;

  const tenantJobIds = tenantJobIdSet instanceof Set ? tenantJobIdSet : null;
  const relevant = placements
    .filter((row) => row && !row.deletedAt && row.status)
    .filter((row) => {
      const jobId = String(row?.jobId || '').trim();
      if (!tenantJobIds || !jobId) return true;
      return tenantJobIds.has(jobId);
    })
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

  return relevant[0]?.status ? String(relevant[0].status).toUpperCase() : null;
}

/** CRM list/drawer stage: when a placement exists, show its status on the Candidates table. */
function resolveCandidateStageForList(candidate, tenantJobIdSet = null) {
  const placementStage = resolvePlacementStageLabelForList(candidate, tenantJobIdSet);
  if (placementStage) {
    return placementStage;
  }

  const hasTenantJob = candidateHasRealJobLink(candidate, tenantJobIdSet);
  const hasUpcomingInterview = candidateHasUpcomingInterviewLink(candidate, tenantJobIdSet);
  const interviewCompletedOnly = candidateHasCompletedInterviewOnly(candidate, tenantJobIdSet);
  const scoped = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
  const explicitStage = String(candidate?.stage || '').trim();
  const explicitLower = explicitStage.toLowerCase();

  const tenantPipelineStage = mergeCandidateWorkflowStages(
    ...(Array.isArray(scoped.pipelineEntries) ? scoped.pipelineEntries : [])
      .map((row) => String(row?.stage?.name || row?.stageName || row?.stage || '').trim())
      .filter(Boolean),
    explicitStage,
  );

  if (interviewCompletedOnly && !hasUpcomingInterview) {
    const merged = mergeCandidateWorkflowStages(tenantPipelineStage, 'Interview completed');
    if (hasTenantJob || tenantPipelineStage || explicitStage) {
      return merged || 'Interview completed';
    }
  }

  if (hasUpcomingInterview) {
    const merged = mergeCandidateWorkflowStages(tenantPipelineStage, 'Interviewing');
    if (hasTenantJob || tenantPipelineStage || explicitStage) {
      return merged || 'Interviewing';
    }
  }

  if (
    interviewCompletedOnly &&
    (explicitLower === 'interviewing' || explicitLower === 'interview')
  ) {
    return 'Interview completed';
  }

  if (tenantPipelineStage) {
    return tenantPipelineStage;
  }

  if (candidateHasTenantApplicationLink(candidate, tenantJobIdSet) || hasTenantJob) {
    return 'Applied';
  }

  if (explicitStage && explicitLower !== 'new') {
    return explicitStage;
  }
  const status = String(candidate?.status || '').toUpperCase();
  if (status === 'NEW' || status === 'ACTIVE') return 'New';
  return explicitStage || 'New';
}

function stageWhenLinkingToJob(existingStage) {
  const current = String(existingStage || '').trim();
  if (isTerminalCandidateStage(current)) return current;
  if (!current || current.toLowerCase() === 'new') return 'Applied';
  return current;
}

/**
 * CRM Candidates page: show Phase 1 / AI-pool rows only after a real job link (apply, assign, pipeline).
 * Hide sparse rows created only so Match records can reference a tenant candidate id.
 */
function candidateHasListIdentity(candidate) {
  return (
    Boolean(String(candidate?.firstName || '').trim()) ||
    Boolean(String(candidate?.lastName || '').trim()) ||
    Boolean(String(candidate?.email || '').trim())
  );
}

/** CRM list merges Phase 1 common pool by default; pass includeCommonPool=false to opt out. */
function parseIncludeCommonPoolQuery(query = {}) {
  const raw = query?.includeCommonPool;
  if (raw === 'false' || raw === '0' || raw === false) return false;
  return true;
}

/** Tenant HQ flag: Phase 1 (candidatecommon) on All candidates. Missing → allowed. */
async function tenantAllowsPhase1CommonPool() {
  try {
    const modules = await getHqEnabledModules();
    return modules?.phase1CommonPoolEnabled !== false;
  } catch {
    return true;
  }
}

async function resolveLoadCommonPool(query = {}) {
  if (!parseIncludeCommonPoolQuery(query)) return false;
  if (!isTenantScopedRequest()) return true;
  return tenantAllowsPhase1CommonPool();
}

function shouldShowOnCrmCandidatesList(candidate, options = {}) {
  if (!candidate) return false;
  const includeCommonPool = options.includeCommonPool === true;
  if (isPhase1CandidateSource(candidate.source) && !candidateHasRealJobLink(candidate)) {
    if (includeCommonPool) {
      return candidateHasListIdentity(candidate);
    }
    return false;
  }
  if (!candidateHasListIdentity(candidate) && !candidateHasRealJobLink(candidate)) {
    return false;
  }
  return true;
}

function candidateListSortTimestamp(candidate) {
  const raw =
    candidate?.updatedAt ||
    candidate?.lastActivity ||
    candidate?.syncedAt ||
    candidate?.createdAt ||
    null;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function buildCandidateSearchWhereClause(search) {
  const term = String(search || '').trim();
  if (!term) return null;
  const escaped = escapePrismaRegex(term);
  return {
    OR: [
      { firstName: { contains: escaped, mode: 'insensitive' } },
      { lastName: { contains: escaped, mode: 'insensitive' } },
      { email: { contains: escaped, mode: 'insensitive' } },
      { phone: { contains: escaped, mode: 'insensitive' } },
      { linkedIn: { contains: escaped, mode: 'insensitive' } },
      { currentTitle: { contains: escaped, mode: 'insensitive' } },
      { currentCompany: { contains: escaped, mode: 'insensitive' } },
      { designation: { contains: escaped, mode: 'insensitive' } },
      { location: { contains: escaped, mode: 'insensitive' } },
      { address: { contains: escaped, mode: 'insensitive' } },
      { city: { contains: escaped, mode: 'insensitive' } },
      { country: { contains: escaped, mode: 'insensitive' } },
      { preferredLocation: { contains: escaped, mode: 'insensitive' } },
      { education: { contains: escaped, mode: 'insensitive' } },
      { recruiterEducation: { contains: escaped, mode: 'insensitive' } },
      { cvSummary: { contains: escaped, mode: 'insensitive' } },
      { notes: { contains: escaped, mode: 'insensitive' } },
      { recruiterNotes: { contains: escaped, mode: 'insensitive' } },
      { source: { contains: escaped, mode: 'insensitive' } },
      { availability: { contains: escaped, mode: 'insensitive' } },
      { stage: { contains: escaped, mode: 'insensitive' } },
      { skills: { hasSome: [term] } },
      { recruiterSkills: { hasSome: [term] } },
      { certifications: { hasSome: [term] } },
      { languages: { hasSome: [term] } },
    ],
  };
}

function flattenCandidateJsonForSearch(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(flattenCandidateJsonForSearch).join(' ');
  if (typeof value === 'object') {
    return Object.values(value).map(flattenCandidateJsonForSearch).join(' ');
  }
  return '';
}

/** Case-insensitive match for name, email, phone (used after merge / common pool). */
function candidateMatchesSearch(candidate, search) {
  if (!search) return true;
  const needle = String(search).trim().toLowerCase();
  if (!needle) return true;

  const firstName = String(candidate?.firstName || '').toLowerCase();
  const lastName = String(candidate?.lastName || '').toLowerCase();
  const fullName = `${firstName} ${lastName}`.trim();
  const hay = [
    firstName,
    lastName,
    fullName,
    candidate?.email,
    candidate?.phone,
    candidate?.linkedIn,
    candidate?.currentTitle,
    candidate?.currentCompany,
    candidate?.designation,
    candidate?.location,
    candidate?.city,
    candidate?.country,
    candidate?.preferredLocation,
    candidate?.education,
    candidate?.cvSummary,
    candidate?.source,
    candidate?.availability,
    candidate?.stage,
    candidate?.status,
    ...(Array.isArray(candidate?.skills) ? candidate.skills : []),
    ...(Array.isArray(candidate?.languages) ? candidate.languages : []),
    ...(Array.isArray(candidate?.certifications) ? candidate.certifications : []),
    flattenCandidateJsonForSearch(candidate?.cvWorkExperienceEntries),
    flattenCandidateJsonForSearch(candidate?.cvEducationEntries),
    flattenCandidateJsonForSearch(candidate?.cvPortfolioLinks),
    flattenCandidateJsonForSearch(candidate?.extraData),
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  if (hay.includes(needle)) return true;

  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    return tokens.every((token) => hay.includes(token));
  }

  return false;
}

function annotateCandidateListFlags(candidate, tenantJobIdSet = null) {
  const phase1 = isPhase1CandidateRecord(candidate);
  const hasJob = candidateHasRealJobLink(candidate, tenantJobIdSet);
  const discoveryOnly = phase1 && !hasJob;
  const placementStatus = resolveLatestPlacementStatusForList(candidate, tenantJobIdSet);
  const resolvedStage = resolveCandidateStageForList(candidate, tenantJobIdSet);
  const stageNew = ['new', ''].includes(String(resolvedStage || '').trim().toLowerCase());
  return {
    ...candidate,
    stage: resolvedStage,
    placementStatus,
    isPhase1Candidate: discoveryOnly,
    isNewCandidate: discoveryOnly || (phase1 && stageNew && !hasJob),
    isJobAppliedCandidate: hasJob && resolvedStage === 'Applied',
    poolOrigin: discoveryOnly ? 'phase1_common' : phase1 ? 'phase1' : 'tenant',
  };
}

async function attachPlacementsToCandidates(candidates) {
  const ids = [...new Set(candidates.map((row) => String(row?.id || '').trim()).filter(Boolean))];
  if (!ids.length) return candidates;

  const placementRows = await prisma.placement.findMany({
    where: { candidateId: { in: ids }, deletedAt: null },
    select: {
      id: true,
      candidateId: true,
      jobId: true,
      status: true,
      updatedAt: true,
      createdAt: true,
      deletedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const byCandidateId = new Map();
  for (const row of placementRows) {
    const candidateId = String(row.candidateId || '').trim();
    if (!candidateId) continue;
    if (!byCandidateId.has(candidateId)) byCandidateId.set(candidateId, []);
    byCandidateId.get(candidateId).push(row);
  }

  return candidates.map((candidate) => {
    const candidateId = String(candidate?.id || '').trim();
    const hydrated = byCandidateId.get(candidateId) || [];
    const existing = Array.isArray(candidate?.placements) ? candidate.placements : [];
    const mergedPlacements = hydrated.length ? hydrated : existing;
    return mergedPlacements.length ? { ...candidate, placements: mergedPlacements } : candidate;
  });
}

/** Prisma scope: non-phase1 OR phase1 with a real job/application/pipeline link. */
function buildCrmCandidatesListScopeClause() {
  return {
    OR: [
      { NOT: { source: 'phase1' } },
      { assignedJobs: { isEmpty: false } },
      { applications: { some: {} } },
      { pipelineEntries: { some: {} } },
    ],
  };
}
const REJECTION_ACTIVITY_KIND = 'candidate-rejection';
const INTERVIEW_ACTIVITY_KIND = 'candidate-interview';

const candidateDetailInclude = {
  assignedTo: {
    select: { id: true, name: true, email: true, avatar: true },
  },
  createdBy: {
    select: USER_BRIEF_SELECT,
  },
  interviews: {
    include: {
      interviewer: {
        select: { id: true, name: true, email: true, avatar: true, role: true, department: true },
      },
      job: {
        select: { id: true, title: true },
      },
    },
    orderBy: { scheduledAt: 'desc' },
  },
  placements: true,
  matches: {
    include: {
      job: {
        select: {
          id: true,
          title: true,
          client: { select: { companyName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  },
  pipelineEntries: {
    include: {
      stage: true,
      movedBy: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
    orderBy: { movedAt: 'desc' },
  },
  applications: {
    select: {
      id: true,
      jobId: true,
      status: true,
      appliedAt: true,
      job: { select: { id: true, title: true } },
    },
    orderBy: { appliedAt: 'desc' },
    take: 30,
  },
};

async function enrichCandidateDetailJobTitles(candidate, tenantJobIdSet = null) {
  if (!candidate) return candidate;
  const scoped = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
  const jobIds = collectCandidateLinkedJobIds(scoped);
  const jobsById = new Map();
  if (jobIds.length) {
    const jobs = await prisma.job.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, title: true },
    });
    for (const job of jobs) jobsById.set(job.id, job.title);
  }
  return {
    ...candidate,
    assignedJobTitles: resolveCandidateAssignedJobTitlesForList(scoped, jobsById),
  };
}

const candidateListInclude = {
  assignedTo: {
    select: { id: true, name: true, email: true },
  },
  createdBy: {
    select: USER_BRIEF_SELECT,
  },
  applications: {
    select: {
      id: true,
      jobId: true,
      status: true,
      job: { select: { id: true, title: true } },
    },
    take: 30,
  },
  pipelineEntries: {
    select: { id: true, jobId: true, stage: { select: { name: true } } },
    take: 30,
  },
  matches: {
    select: {
      id: true,
      jobId: true,
      score: true,
      status: true,
      createdById: true,
      evaluation: true,
      job: {
        select: {
          id: true,
          title: true,
          client: { select: { companyName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  },
  interviews: {
    select: { id: true, jobId: true, status: true, scheduledAt: true },
    orderBy: { scheduledAt: 'desc' },
    take: 15,
  },
  placements: {
    select: { id: true, jobId: true, status: true, updatedAt: true, createdAt: true, deletedAt: true },
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  },
};

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (typeof value === 'number') {
      if (Number.isFinite(value)) return value;
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length) return value;
      continue;
    }
    return value;
  }
  return null;
}

function mergeCandidateRelationRows(tenantRows, portalRows, keyFn) {
  const byKey = new Map();
  for (const row of [...(tenantRows || []), ...(portalRows || [])]) {
    if (!row) continue;
    const key = keyFn(row);
    if (!key) continue;
    byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

/** Jobs the signed-in recruiter owns: creator, assignee, manager, or supporting recruiter. */
function buildMyJobsWhereClause(userId) {
  const uid = String(userId || '').trim();
  if (!uid) {
    return { id: { in: [] } };
  }
  return {
    isDeleted: { not: true },
    OR: [
      { createdById: uid },
      { assignedToId: uid },
      { managerId: uid },
      { supportingRecruiters: { has: uid } },
    ],
  };
}

/** Prefer non-empty portal/common Phase 1 fields over sparse tenant CRM stubs (same Mongo id). */
function mergePortalAndTenantCandidateRow(portalRow, tenantRow) {
  if (!tenantRow) return portalRow;
  if (!portalRow) return tenantRow;
  const jobSet = new Set([
    ...(Array.isArray(portalRow.assignedJobs) ? portalRow.assignedJobs : []),
    ...(Array.isArray(tenantRow.assignedJobs) ? tenantRow.assignedJobs : []),
  ].map(String).filter(Boolean));

  const scalarKeys = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'linkedIn',
    'resume',
    'resumeUrl',
    'experience',
    'experienceYears',
    'currentTitle',
    'currentCompany',
    'location',
    'address',
    'addressLine',
    'city',
    'country',
    'designation',
    'cvSummary',
    'notes',
    'recruiterNotes',
    'education',
    'recruiterEducation',
    'stage',
    'noticePeriod',
    'availability',
    'address',
    'addressLine',
    'gender',
    'middleName',
  ];
  const arrayKeys = [
    'skills',
    'recruiterSkills',
    'languages',
    'recruiterLanguages',
    'certifications',
    'certificationsList',
  ];
  const richKeys = ['cvEducationEntries', 'cvWorkExperienceEntries', 'cvPortfolioLinks'];
  const tenantExtraForCv =
    tenantRow?.extraData && typeof tenantRow.extraData === 'object' && !Array.isArray(tenantRow.extraData)
      ? tenantRow.extraData
      : {};
  const tenantEditorCvSaved = tenantExtraForCv.cvEditorContentSaved === true;
  const editorCvScalarKeys = new Set([
    'firstName',
    'lastName',
    'email',
    'phone',
    'linkedIn',
    'currentTitle',
    'currentCompany',
    'location',
    'designation',
    'cvSummary',
  ]);

  const merged = {
    ...tenantRow,
    ...portalRow,
    assignedJobs: Array.from(jobSet),
    applications: mergeCandidateRelationRows(
      tenantRow.applications,
      portalRow.applications,
      (row) => String(row?.id || `${row?.jobId || ''}:${row?.candidateId || ''}`)
    ),
    matches: mergeCandidateRelationRows(
      tenantRow.matches,
      portalRow.matches,
      (row) => String(row?.id || `${row?.jobId || ''}:${row?.candidateId || ''}`)
    ),
    pipelineEntries: mergeCandidateRelationRows(
      tenantRow.pipelineEntries,
      portalRow.pipelineEntries,
      (row) => String(row?.id || `${row?.jobId || ''}:${row?.candidateId || ''}`)
    ),
    interviews: mergeCandidateRelationRows(
      tenantRow.interviews,
      portalRow.interviews,
      (row) => String(row?.id || `${row?.jobId || ''}:${row?.scheduledAt || ''}`)
    ),
    placements: Array.isArray(tenantRow?.placements) && tenantRow.placements.length
      ? tenantRow.placements
      : Array.isArray(portalRow?.placements)
        ? portalRow.placements
        : [],
  };
  for (const key of scalarKeys) {
    if (key === 'stage') continue;
    if (tenantEditorCvSaved && editorCvScalarKeys.has(key)) {
      if (Object.prototype.hasOwnProperty.call(tenantRow, key)) {
        merged[key] = tenantRow[key] ?? null;
      }
      continue;
    }
    merged[key] = pickFirstNonEmpty(portalRow[key], tenantRow[key]);
  }
  merged.stage = mergeCandidateWorkflowStages(portalRow?.stage, tenantRow?.stage);
  for (const key of arrayKeys) {
    if (tenantEditorCvSaved && key === 'skills') {
      merged.skills = Array.isArray(tenantRow.skills) ? tenantRow.skills : [];
      continue;
    }
    if (tenantEditorCvSaved && key === 'recruiterSkills') {
      merged.recruiterSkills = Array.isArray(tenantRow.recruiterSkills)
        ? tenantRow.recruiterSkills
        : [];
      continue;
    }
    merged[key] = pickFirstNonEmpty(portalRow[key], tenantRow[key]);
  }

  if (tenantEditorCvSaved) {
    merged.cvWorkExperienceEntries = Array.isArray(tenantRow.cvWorkExperienceEntries)
      ? tenantRow.cvWorkExperienceEntries
      : [];
    merged.cvEducationEntries = Array.isArray(tenantRow.cvEducationEntries)
      ? tenantRow.cvEducationEntries
      : [];
  } else {
    for (const key of richKeys) {
      merged[key] = pickFirstNonEmpty(portalRow[key], tenantRow[key]);
    }
  }
  const portalSource = String(portalRow?.source || '').trim().toLowerCase();
  const tenantSource = String(tenantRow?.source || '').trim().toLowerCase();
  merged.source =
    portalSource === 'phase1' || tenantSource === 'phase1'
      ? 'phase1'
      : pickFirstNonEmpty(portalRow.source, tenantRow.source);

  const portalExtra =
    portalRow?.extraData && typeof portalRow.extraData === 'object' && !Array.isArray(portalRow.extraData)
      ? portalRow.extraData
      : {};
  const tenantExtra =
    tenantRow?.extraData && typeof tenantRow.extraData === 'object' && !Array.isArray(tenantRow.extraData)
      ? tenantRow.extraData
      : {};
  const phase1Snap =
    portalExtra.phase1ProfileSnapshot && typeof portalExtra.phase1ProfileSnapshot === 'object'
      ? portalExtra.phase1ProfileSnapshot
      : tenantExtra.phase1ProfileSnapshot && typeof tenantExtra.phase1ProfileSnapshot === 'object'
        ? tenantExtra.phase1ProfileSnapshot
        : null;
  merged.extraData = mergeCandidateRecruiterExtraData(
    { ...portalExtra, ...(phase1Snap ? { phase1ProfileSnapshot: phase1Snap } : {}) },
    {
      ...tenantExtra,
      ...(phase1Snap ? { phase1ProfileSnapshot: phase1Snap } : {}),
      workHistory: pickFirstNonEmpty(portalExtra.workHistory, tenantExtra.workHistory),
      workHistoryText: pickFirstNonEmpty(portalExtra.workHistoryText, tenantExtra.workHistoryText),
    },
  );
  if (tenantEditorCvSaved) {
    merged.avatar = tenantRow.avatar ?? null;
  } else {
    merged.avatar = pickFirstNonEmpty(portalRow.avatar, tenantRow.avatar);
  }

  return merged;
}

async function resolveJobIdForStageSync(candidateId, data) {
  const explicit = String(data?.jobId || '').trim();
  if (explicit) return explicit;
  const m = await prisma.match.findFirst({
    where: { candidateId },
    orderBy: { updatedAt: 'desc' },
    select: { jobId: true },
  });
  if (m?.jobId) return String(m.jobId);
  // Fallback: many flows (especially reject from the Candidates tab) never
  // send `jobId`, but the tenant candidate still carries `assignedJobs[]`.
  // Without a jobId the portal `Application` row + pipeline never sync —
  // the job portal keeps showing "Interview" forever.
  const cand = await prisma.candidate.findFirst({
    where: { id: candidateId, isDeleted: { not: true } },
    select: { assignedJobs: true },
  });
  const fromAssigned = Array.isArray(cand?.assignedJobs)
    ? cand.assignedJobs.map((id) => String(id || '').trim()).find((id) => /^[a-f\d]{24}$/i.test(id))
    : null;
  return fromAssigned || null;
}

function getActivityMetadata(activity) {
  return activity?.metadata && typeof activity.metadata === 'object' ? activity.metadata : {};
}

function normalizeTagId(value = '') {
  return `tag-${String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

function getTagColor(label = '') {
  const palette = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#dc2626', '#0891b2', '#ca8a04', '#4f46e5'];
  const seed = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function buildTagRecord(tag) {
  if (!tag) return null;

  const label = typeof tag === 'string' ? tag.trim() : String(tag.label || '').trim();
  if (!label) return null;

  return {
    id: typeof tag === 'string' ? normalizeTagId(label) : tag.id || normalizeTagId(label),
    label,
    color: typeof tag === 'string' ? getTagColor(label) : tag.color || getTagColor(label),
  };
}

function getCandidateActivityType(activity) {
  const metadata = getActivityMetadata(activity);
  const action = String(activity.action || '').toLowerCase();

  if (metadata.kind === NOTE_ACTIVITY_KIND) return 'note-added';
  if (metadata.kind === PIPELINE_ACTIVITY_KIND) return 'added-to-pipeline';
  if (metadata.kind === REJECTION_ACTIVITY_KIND) return 'rejected';
  if (metadata.kind === INTERVIEW_ACTIVITY_KIND) return 'interview-scheduled';
  if (action.includes('email')) return 'email-sent';
  if (action.includes('resume')) return 'resume-parsed';
  if (action.includes('stage')) return 'stage-movement';

  return 'note-added';
}

function mapActivityToDrawerItem(activity) {
  const metadata = getActivityMetadata(activity);

  if (metadata.kind === TAG_ACTIVITY_KIND) {
    return null;
  }

  return {
    id: activity.id,
    type: getCandidateActivityType(activity),
    title: activity.action,
    description: activity.description || metadata.text || null,
    timestamp: activity.createdAt,
    performedBy: {
      name: activity.performedBy?.name || 'System',
      avatar: activity.performedBy?.avatar || null,
    },
    relatedJob: metadata.relatedJobTitle || activity.relatedLabel || null,
  };
}

function mapActivityToNote(activity) {
  const metadata = getActivityMetadata(activity);

  if (metadata.kind !== NOTE_ACTIVITY_KIND) {
    return null;
  }

  return {
    id: activity.id,
    text: metadata.text || activity.description || '',
    createdAt: activity.createdAt,
    recruiter: {
      id: activity.performedBy?.id,
      name: activity.performedBy?.name || 'Recruiter',
      avatar: activity.performedBy?.avatar || null,
    },
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter(Boolean) : [],
    isPinned: Boolean(metadata.isPinned),
  };
}

function clampScore(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function buildAiCandidateAnalysis(candidate) {
  const matches = Array.isArray(candidate?.matches) ? candidate.matches : [];
  const primaryMatch = matches.find((item) => Number.isFinite(Number(item?.score))) || matches[0] || null;

  const experienceYears = Number(candidate?.experience ?? candidate?.experienceYears ?? 0);
  const hasEducation = Boolean(candidate?.education || candidate?.recruiterEducation);
  const skillsCount = Array.isArray(candidate?.skills) ? candidate.skills.length : 0;

  if (primaryMatch && Number.isFinite(Number(primaryMatch?.score))) {
    const overall = clampScore(primaryMatch.score, 0);
    const skillsMatch = clampScore(overall + Math.min(skillsCount * 2, 8) - 4, overall);
    const experienceFit = clampScore(overall + Math.min(experienceYears * 2, 10) - 5, overall);
    const educationFit = clampScore(overall + (hasEducation ? 4 : -6), overall);
    const keywordMatch = clampScore(Math.round((skillsMatch * 0.5) + (experienceFit * 0.3) + (educationFit * 0.2)), overall);

    const jobTitle = primaryMatch?.job?.title || null;
    const insights = [
      {
        type: overall >= 65 ? 'strength' : 'gap',
        text: jobTitle
          ? `AI fit score is ${overall}% for applied job "${jobTitle}".`
          : `AI fit score is ${overall}% based on latest matched job.`,
      },
      {
        type: skillsMatch >= 60 ? 'strength' : 'gap',
        text: skillsMatch >= 60
          ? 'Skills alignment is strong for the selected role.'
          : 'Skills alignment needs improvement for the selected role.',
      },
      {
        type: experienceFit >= 60 ? 'strength' : 'gap',
        text: experienceFit >= 60
          ? 'Experience level is relevant to current role expectations.'
          : 'Experience appears lighter than this role typically expects.',
      },
    ];

    return {
      source: 'match',
      jobTitle,
      overall,
      breakdown: {
        skillsMatch,
        experienceFit,
        educationFit,
        keywordMatch,
      },
      insights,
    };
  }

  const skillsMatch = clampScore(skillsCount > 0 ? 55 + skillsCount * 8 : 38, 0);
  const experienceFit = clampScore(experienceYears > 0 ? 45 + experienceYears * 6 : 35, 0);
  const educationFit = hasEducation ? 72 : 48;
  const keywordMatch = clampScore(Math.round((skillsMatch * 0.45) + (experienceFit * 0.35) + (educationFit * 0.2)), 0);
  const overall = clampScore(Math.round((skillsMatch + experienceFit + educationFit + keywordMatch) / 4), 0);

  return {
    source: 'estimated',
    jobTitle: null,
    overall,
    breakdown: {
      skillsMatch,
      experienceFit,
      educationFit,
      keywordMatch,
    },
    insights: [],
  };
}

function extractCustomTags(activities) {
  const activeTags = new Map();
  const orderedActivities = [...activities].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const activity of orderedActivities) {
    const metadata = getActivityMetadata(activity);
    if (metadata.kind !== TAG_ACTIVITY_KIND) continue;

    const tag = buildTagRecord(metadata.tag);
    if (!tag) continue;

    if (metadata.operation === 'remove') {
      activeTags.delete(tag.id);
    } else {
      activeTags.set(tag.id, tag);
    }
  }

  return Array.from(activeTags.values());
}

function mapInterviewType(type, mode) {
  const normalizedType = String(type || '').toLowerCase();
  const normalizedMode = String(mode || '').toLowerCase();

  if (
    (normalizedType.includes('hr') && normalizedType.includes('screen')) ||
    (normalizedType.includes('screening') && !normalizedType.includes('technical'))
  ) {
    return 'VIDEO';
  }
  if (normalizedType.includes('technical')) return 'TECHNICAL';
  if (normalizedType.includes('final')) return 'FINAL';
  if (normalizedMode === 'phone') return 'PHONE';
  if (normalizedMode === 'in-person') return 'ONSITE';

  return 'VIDEO';
}

function mapInterviewMode(mode) {
  const normalizedMode = String(mode || '').toLowerCase();
  if (normalizedMode === 'in-person' || normalizedMode === 'onsite' || normalizedMode === 'walk-in') {
    return 'OFFLINE';
  }

  return 'ONLINE';
}

function mapMeetingPlatform(platform, mode) {
  const normalizedPlatform = String(platform || mode || '').toLowerCase();
  if (normalizedPlatform.includes('google')) return 'GOOGLE_MEET';
  if (normalizedPlatform.includes('teams') || normalizedPlatform.includes('microsoft')) return 'MS_TEAMS';
  if (normalizedPlatform.includes('zoom')) return 'ZOOM';
  return null;
}

function mapStageToMatchStatus(stage) {
  const normalizedStage = String(stage || '').toLowerCase();

  if (normalizedStage.includes('shortlist')) return 'SHORTLISTED';
  if (normalizedStage.includes('reject')) return 'REJECTED';

  return 'REVIEWED';
}

function parseDurationToMinutes(duration) {
  const value = String(duration || '').trim().toLowerCase();
  const match = value.match(/(\d+(?:\.\d+)?)/);

  if (!match) return 60;

  const amount = Number(match[1]);
  if (Number.isNaN(amount)) return 60;
  if (value.includes('hour')) return Math.round(amount * 60);

  return Math.round(amount);
}

function normalizeInterviewTimeInput(time) {
  return String(time || '')
    .trim()
    .replace(/\u202f/g, ' ')
    .replace(/\s+/g, ' ');
}

function buildScheduledAt(date, time, timezone) {
  if (!date || !time) {
    throw new Error('Interview date and time are required');
  }

  const normalizedTime = normalizeInterviewTimeInput(time);
  const twelveHour = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const twentyFourHour = normalizedTime.match(/^(\d{1,2}):(\d{2})$/);

  let hours;
  let minutes;

  if (twelveHour) {
    hours = Number(twelveHour[1]);
    minutes = Number(twelveHour[2]);
    const meridiem = twelveHour[3].toUpperCase();
    if (hours === 12) {
      hours = meridiem === 'AM' ? 0 : 12;
    } else if (meridiem === 'PM') {
      hours += 12;
    }
  } else if (twentyFourHour) {
    hours = Number(twentyFourHour[1]);
    minutes = Number(twentyFourHour[2]);
  } else {
    throw new Error('Invalid interview time format. Use a time like 9:00 AM.');
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Invalid interview time');
  }

  const dateValue = String(date || '').trim();
  if (/T/.test(dateValue)) {
    const fromIso = new Date(dateValue);
    if (Number.isNaN(fromIso.getTime())) {
      throw new Error('Invalid interview schedule');
    }
    return fromIso;
  }

  const ymd = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!ymd) {
    throw new Error('Invalid interview date');
  }

  const scheduledAt = zonedWallClockToDate(
    Number(ymd[1]),
    Number(ymd[2]),
    Number(ymd[3]),
    hours,
    minutes,
    timezone
  );

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error('Invalid interview schedule');
  }

  return scheduledAt;
}

function resolveInterviewClientIdForJob(job, data) {
  const fromPayload = String(data?.clientId || '').trim();
  const fromJob = String(job?.clientId || '').trim();
  const clientId = fromPayload || fromJob;
  if (!clientId) {
    throw new Error(
      'This job is not linked to a client. Select a client on the job or link a client before scheduling an interview.'
    );
  }
  if (fromJob && fromPayload && fromPayload !== fromJob) {
    throw new Error('Selected client does not match the job client');
  }
  return clientId;
}

function resolveScheduleInterviewers(data, userId) {
  const interviewers = Array.isArray(data?.interviewers)
    ? data.interviewers.filter((item) => item && String(item.id || '').trim())
    : [];
  return interviewers;
}

async function generateCandidateMeetingLink({ candidate, job, data, interviewers, userId }) {
  const platform = mapMeetingPlatform(data?.platform, data?.mode);
  if (String(data?.mode || '').toLowerCase() !== 'video' || !platform) {
    return { meetingLink: null, platform: null, error: null };
  }

  const scheduledAt = buildScheduledAt(data?.date, data?.time, data?.timezone);
  const interviewerIds = Array.isArray(interviewers) ? interviewers.map((item) => item.id).filter(Boolean) : [];
  const panelUsers = interviewerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: interviewerIds } },
        select: { email: true },
      })
    : [];

  const result = await generateMeetingLink(platform, {
    id: `candidate-preview-${candidate.id}-${Date.now()}`,
    date: scheduledAt,
    duration: parseDurationToMinutes(data?.duration),
    timezone: resolveInterviewTimeZone(data?.timezone),
    candidateName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email || 'Candidate',
    jobTitle: job.title,
    panelEmails: panelUsers.map((item) => item.email).filter(Boolean),
    notes: String(data?.notes || '').trim() || undefined,
  }, userId);

  return {
    meetingLink: result.meetingLink,
    platform,
    error: result.error || null,
  };
}

async function getCandidateActivities(candidateId, client = prisma, viewerUserId = null) {
  let where = {
    entityType: CANDIDATE_ACTIVITY_ENTITY,
    entityId: candidateId,
  };

  if (viewerUserId) {
    where = await appendEntityActivityVisibilityToWhere(where, viewerUserId);
  }

  return client.activity.findMany({
    where,
    include: {
      performedBy: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Copy a portal-only candidate into the active tenant DB so mutations (interview, reject, etc.) succeed.
 * List view merges portal + tenant rows; without this, POST .../interviews fails with "Candidate not found".
 */
async function materializePortalCandidateIntoTenant(portalRow) {
  const assignedJobs = Array.isArray(portalRow.assignedJobs) ? portalRow.assignedJobs : [];
  const skills =
    Array.isArray(portalRow.recruiterSkills) && portalRow.recruiterSkills.length
      ? portalRow.recruiterSkills
      : Array.isArray(portalRow.skills)
        ? portalRow.skills
        : [];
  const languages = Array.isArray(portalRow.languages) ? portalRow.languages : [];
  const recruiterLanguages = Array.isArray(portalRow.recruiterLanguages) ? portalRow.recruiterLanguages : [];

  const profileFields = buildMatchMaterializeProfileFields(
    portalRow,
    skills,
    languages,
    recruiterLanguages,
  );
  const portalExtra =
    portalRow?.extraData && typeof portalRow.extraData === 'object' && !Array.isArray(portalRow.extraData)
      ? portalRow.extraData
      : {};
  profileFields.extraData = portalExtra;

  const computedExp = resolveCandidateListExperienceYears({ ...portalRow, ...profileFields });
  if (computedExp != null) {
    profileFields.experience = Math.max(0, Math.round(computedExp));
    profileFields.experienceYears = computedExp;
  }

  const phase1 = isPhase1CandidateSource(portalRow?.source);
  const stageForCreate =
    portalRow.stage && String(portalRow.stage).trim() ? String(portalRow.stage).trim() : phase1 ? 'New' : 'Applied';

  return prisma.candidate.upsert({
    where: { id: portalRow.id },
    create: {
      id: portalRow.id,
      ...profileFields,
      status: 'ACTIVE',
      recruiterStatus: portalRow.recruiterStatus ?? null,
      source: phase1 ? 'phase1' : portalRow.source ?? 'Job portal',
      assignedJobs,
      stage: stageForCreate,
      education: portalRow.education ?? portalRow.recruiterEducation ?? null,
      recruiterEducation: portalRow.recruiterEducation ?? null,
      portfolio: portalRow.portfolio ?? null,
      website: portalRow.website ?? null,
      preferredLocation: portalRow.preferredLocation ?? null,
    },
    update: profileFields,
  });
}

/** Profile fields synced when AI match materializes a pool row — never workflow fields on update. */
function buildMatchMaterializeProfileFields(poolRow, skills, languages, recruiterLanguages) {
  return {
    firstName: poolRow.firstName ?? null,
    lastName: poolRow.lastName ?? null,
    email: poolRow.email ?? null,
    phone: poolRow.phone ?? null,
    linkedIn: poolRow.linkedIn ?? null,
    resume: poolRow.resume ?? poolRow.resumeUrl ?? null,
    resumeUrl: poolRow.resumeUrl ?? null,
    skills,
    recruiterSkills: Array.isArray(poolRow.recruiterSkills) ? poolRow.recruiterSkills : [],
    experience: poolRow.experience ?? poolRow.experienceYears ?? null,
    experienceYears: poolRow.experienceYears ?? null,
    currentTitle: poolRow.currentTitle ?? null,
    currentCompany: poolRow.currentCompany ?? null,
    location: poolRow.location ?? null,
    address: poolRow.address ?? poolRow.addressLine ?? null,
    addressLine: poolRow.addressLine ?? null,
    city: poolRow.city ?? null,
    country: poolRow.country ?? null,
    recruiterStatus: poolRow.recruiterStatus ?? null,
    lastActivity: poolRow.lastActivity ?? new Date(),
    languages,
    recruiterLanguages,
    notes: poolRow.notes ?? poolRow.recruiterNotes ?? null,
    recruiterNotes: poolRow.recruiterNotes ?? null,
    education: poolRow.education ?? poolRow.recruiterEducation ?? null,
    recruiterEducation: poolRow.recruiterEducation ?? null,
    certifications: Array.isArray(poolRow.certifications) ? poolRow.certifications : [],
    certificationsList: Array.isArray(poolRow.certificationsList) ? poolRow.certificationsList : [],
    cvSummary: poolRow.cvSummary ?? null,
    cvEducationEntries: poolRow.cvEducationEntries ?? null,
    cvWorkExperienceEntries: poolRow.cvWorkExperienceEntries ?? null,
    cvPortfolioLinks: poolRow.cvPortfolioLinks ?? null,
    portfolio: poolRow.portfolio ?? null,
    website: poolRow.website ?? null,
    preferredLocation: poolRow.preferredLocation ?? null,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
  };
}

function isAppliedMatchEvaluation(evaluation) {
  return evaluation && typeof evaluation === 'object' && evaluation.origin === 'applied';
}

/**
 * Full materialize for AI match: create tenant row for Match FK.
 * Phase 1 rows stay discovery-only (New stage, no job assignment, hidden from Candidates list).
 * When aiMatchOnly is true, never link the scoring job to assignedJobs (score-only, no assignment).
 */
async function materializeCandidateForMatch(poolRow, options = {}) {
  const matchingJobId = String(options.matchingJobId || '').trim();
  const aiMatchOnly = Boolean(options.aiMatchOnly);
  const phase1 = isPhase1CandidateSource(poolRow?.source);
  let poolAssignedJobs = Array.isArray(poolRow.assignedJobs)
    ? poolRow.assignedJobs.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  if (aiMatchOnly && matchingJobId) {
    poolAssignedJobs = poolAssignedJobs.filter((id) => id !== matchingJobId);
  }
  const hasRealJobLink = !aiMatchOnly && poolAssignedJobs.length > 0;
  const assignedJobs =
    phase1 && !hasRealJobLink ? [] : poolAssignedJobs;
  const skills =
    Array.isArray(poolRow.recruiterSkills) && poolRow.recruiterSkills.length
      ? poolRow.recruiterSkills
      : Array.isArray(poolRow.skills)
        ? poolRow.skills
        : [];
  const languages = Array.isArray(poolRow.languages) ? poolRow.languages : [];
  const recruiterLanguages = Array.isArray(poolRow.recruiterLanguages) ? poolRow.recruiterLanguages : [];

  const profileFields = buildMatchMaterializeProfileFields(
    poolRow,
    skills,
    languages,
    recruiterLanguages,
  );

  const existing = await prisma.candidate.findUnique({
    where: { id: poolRow.id },
    select: { id: true, isDeleted: true, stage: true, assignedJobs: true, source: true },
  });

  if (existing && existing.isDeleted !== true) {
    const updateData = { ...profileFields };
    if (aiMatchOnly && matchingJobId && Array.isArray(existing.assignedJobs)) {
      const trimmed = existing.assignedJobs
        .map((id) => String(id || '').trim())
        .filter((id) => id && id !== matchingJobId);
      if (trimmed.length !== existing.assignedJobs.length) {
        updateData.assignedJobs = trimmed;
      }
    }
    return prisma.candidate.update({
      where: { id: poolRow.id },
      data: updateData,
    });
  }

  // AI match materialize must not default CRM stage to Applied — preserve pool stage or New.
  const stageForCreate =
    poolRow.stage && String(poolRow.stage).trim() ? String(poolRow.stage).trim() : 'New';

  // Pool-only rows (no job application) stay phase1 discovery — visible on AI Matches, not Candidates list.
  const discoveryOnly = (phase1 || !hasRealJobLink) && !hasRealJobLink;
  const sourceForCreate = discoveryOnly
    ? 'phase1'
    : phase1
      ? 'phase1'
      : poolRow.source ?? null;

  const createData = {
    id: poolRow.id,
    ...profileFields,
    status: 'ACTIVE',
    source: sourceForCreate,
    assignedJobs,
    stage: discoveryOnly ? 'New' : stageForCreate,
  };

  if (existing?.isDeleted === true) {
    const restoreData = {
      ...profileFields,
      status: 'ACTIVE',
    };
    if (phase1) {
      restoreData.source = 'phase1';
      restoreData.assignedJobs = [];
      if (!existing.stage || isPhase1CandidateSource(existing.source)) {
        restoreData.stage = 'New';
      }
    } else {
      restoreData.source = poolRow.source ?? existing.source ?? null;
      const poolStage = poolRow.stage && String(poolRow.stage).trim();
      if (!existing.stage) {
        restoreData.stage = poolStage || 'New';
      } else if (existing.stage === 'Applied' && poolStage && poolStage !== 'Applied') {
        restoreData.stage = poolStage;
      }
      if (!aiMatchOnly && (!Array.isArray(existing.assignedJobs) || !existing.assignedJobs.length)) {
        restoreData.assignedJobs = assignedJobs;
      } else if (aiMatchOnly && matchingJobId && Array.isArray(existing.assignedJobs)) {
        const trimmed = existing.assignedJobs
          .map((id) => String(id || '').trim())
          .filter((id) => id && id !== matchingJobId);
        if (trimmed.length !== existing.assignedJobs.length) {
          restoreData.assignedJobs = trimmed;
        }
      }
    }
    return prisma.candidate.update({
      where: { id: poolRow.id },
      data: restoreData,
    });
  }

  return prisma.candidate.create({ data: createData });
}

/**
 * Materialize a portal / Phase 1 / application-only candidate into the active tenant DB so
 * mutations (schedule interview, reject, notes, etc.) succeed for rows shown in merged lists.
 */
async function materializeCandidateIntoTenantById(candidateId, options = {}) {
  const id = String(candidateId || '').trim();
  if (!id) return null;

  const jobIdHint = String(options.jobIdHint || '').trim();

  const commonRow = await fetchCandidateCommonByCandidateId(id, { requireVerified: false });
  if (commonRow) {
    const assigned = Array.isArray(commonRow.assignedJobs)
      ? commonRow.assignedJobs.map((jid) => String(jid || '').trim()).filter(Boolean)
      : [];
    const withJob =
      jobIdHint && !assigned.includes(jobIdHint)
        ? {
            ...commonRow,
            assignedJobs: [...assigned, jobIdHint],
            stage:
              commonRow.stage && String(commonRow.stage).trim().toLowerCase() !== 'new'
                ? commonRow.stage
                : 'Applied',
          }
        : commonRow;
    const phase1 = isPhase1CandidateSource(withJob.source);
    const linkJob = Boolean(jobIdHint);
    return materializeCandidateForMatch(withJob, {
      matchingJobId: jobIdHint,
      aiMatchOnly: phase1 && !linkJob && !assigned.length,
    });
  }

  let portalPrisma = null;
  try {
    portalPrisma = getJobPortalPrismaClient();
  } catch {
    portalPrisma = null;
  }

  if (portalPrisma) {
    const portalRow = await portalPrisma.candidate.findUnique({
      where: { id },
    });
    if (portalRow) {
      return materializePortalCandidateIntoTenant(portalRow);
    }
  }

  const applicationRows = await prisma.application.findMany({
    where: { candidateId: id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { jobId: true },
  });
  const applicationJobIds = [
    ...new Set(applicationRows.map((row) => String(row.jobId || '').trim()).filter(Boolean)),
  ];
  if (applicationJobIds.length) {
    const assignedJobs = jobIdHint
      ? [...new Set([...applicationJobIds, jobIdHint])]
      : applicationJobIds;
    return materializePortalCandidateIntoTenant({
      id,
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
      source: 'Job portal',
      assignedJobs,
      stage: 'Applied',
      status: 'ACTIVE',
      lastActivity: new Date(),
    });
  }

  return null;
}

/**
 * Resolve a candidate by id from the tenant DB, falling back to the job-portal DB and
 * materializing the row into the tenant on demand. The merged candidate list view shows
 * portal-only rows in the picker, so callers that mutate (interview create, reject, etc.)
 * must use this helper instead of `prisma.candidate.findUnique` to avoid a "Candidate not
 * found" 400 for candidates that exist on the portal side but not in the tenant yet.
 */
async function getCandidateOrThrow(id, options = {}) {
  const candidateId = String(id || '').trim();
  if (!candidateId) {
    throw new Error('Candidate not found');
  }

  const jobIdHint = String(options.jobId || options.jobIdHint || '').trim();

  const tenantRow = await prisma.candidate.findUnique({
    where: { id: candidateId },
  });

  if (tenantRow && tenantRow.isDeleted !== true) {
    return tenantRow;
  }

  if (!isTenantScopedRequest()) {
    throw new Error('Candidate not found');
  }

  const purgedRef = await prisma.purgedCandidateRef
    .findUnique({ where: { candidateId }, select: { candidateId: true } })
    .catch(() => null);

  const materialized = await materializeCandidateIntoTenantById(candidateId, { jobIdHint });
  if (materialized) {
    return materialized;
  }

  if (purgedRef || tenantRow?.isDeleted === true) {
    throw new Error('Candidate not found');
  }

  throw new Error('Candidate not found');
}

/**
 * Batch-load verified Phase 1 snapshots for match-pipeline enrichment (applied + AI pools).
 */
async function fetchCandidateCommonMappedByIds(candidateIds) {
  const map = new Map();
  if (!Array.isArray(candidateIds) || !candidateIds.length) return map;
  if (!(await tenantAllowsPhase1CommonPool())) return map;

  let commonPrisma = null;
  try {
    commonPrisma = getCandidateCommonPrismaClient();
  } catch {
    commonPrisma = null;
  }
  if (!commonPrisma || !isTenantScopedRequest()) return map;

  const ids = [...new Set(candidateIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return map;

  try {
    const rows = await commonPrisma.candidateCommon.findMany({
      where: { candidateId: { in: ids }, isVerified: true },
    });
    for (const row of rows) {
      const id = String(row.candidateId || '').trim();
      if (!id) continue;
      const mapped = mapCandidateCommonRowToCandidate(row);
      if (mapped) map.set(id, mapped);
    }
  } catch (err) {
    console.warn(
      '[enrichCandidatesForMatchPipeline] candidatecommon batch fetch failed:',
      err?.message || err
    );
  }

  return map;
}

/**
 * Normalize every pool row to the same full tenant CV profile before AI / Applied scoring.
 * Both pipelines call this so Pass 1–4 see identical candidate data for the same person.
 */
async function enrichCandidatesForMatchPipeline(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return [];

  let portalClient = null;
  try {
    if (isTenantScopedRequest()) portalClient = getJobPortalPrismaClient();
  } catch {
    portalClient = null;
  }

  const ids = [...new Set(candidates.map((row) => String(row?.id || '').trim()).filter(Boolean))];
  const [tenantRows, careerPrefsMap, commonById, editorRows] = await Promise.all([
    ids.length
      ? prisma.candidate.findMany({
          where: { id: { in: ids }, isDeleted: { not: true } },
        })
      : [],
    fetchCareerPreferencesForCandidates(ids),
    fetchCandidateCommonMappedByIds(ids),
    Promise.all(ids.map((id) => loadTenantEditorCvContentFields(id))),
  ]);
  const tenantById = new Map(tenantRows.map((row) => [row.id, row]));
  const editorById = new Map(ids.map((id, index) => [id, editorRows[index]]));

  const enriched = [];
  for (const poolRow of candidates) {
    const id = String(poolRow?.id || '').trim();
    if (!id) continue;

    const tenantRow = tenantById.get(id);
    const commonRow = commonById.get(id);

    let row;
    if (commonRow && tenantRow) {
      row = mergePortalAndTenantCandidateRow(commonRow, tenantRow);
    } else if (commonRow) {
      row = mergePortalAndTenantCandidateRow(commonRow, poolRow);
    } else if (tenantRow) {
      row = mergePortalAndTenantCandidateRow(poolRow, tenantRow);
    } else {
      row = { ...poolRow };
    }

    applyTenantEditorCvContentFields(row, editorById.get(id));

    const tenantCvExtra = tenantRow?.extraData
      ? pickRecruiterCvExtraFields(tenantRow.extraData)
      : await loadTenantRecruiterCvExtra(id);
    if (tenantCvExtra && Object.keys(tenantCvExtra).length) {
      const prevExtra =
        row.extraData && typeof row.extraData === 'object' && !Array.isArray(row.extraData)
          ? row.extraData
          : {};
      row.extraData = mergeCandidateRecruiterExtraData(prevExtra, {
        ...prevExtra,
        ...tenantCvExtra,
      });
    }

    const snap =
      row.extraData?.phase1ProfileSnapshot &&
      typeof row.extraData.phase1ProfileSnapshot === 'object'
        ? row.extraData.phase1ProfileSnapshot
        : null;
    if (snap) {
      applyProfileSnapshotFields(row, {
        profileSnapshot: snap,
        careerPreferences: row.careerPreferences,
        recruiterLanguages: row.recruiterLanguages,
        addressLine: row.address || row.addressLine,
      });
    }

    enriched.push(row);
  }

  if (portalClient) {
    try {
      await Promise.all(
        enriched.map((row) => hydratePhase1SnapshotPersonalInfoFromPortal(row, portalClient))
      );
      await batchHydratePortalProfileSections(enriched, portalClient);
      await batchHydrateCandidatesResumeFromPortal(enriched, portalClient);
    } catch (hydrateErr) {
      console.warn(
        '[enrichCandidatesForMatchPipeline] portal hydrate failed:',
        hydrateErr?.message || hydrateErr
      );
    }
  }

  for (const row of enriched) {
    const careerPrefs = careerPrefsMap.get(String(row.id || '').trim());
    if (careerPrefs) mergeCareerPreferencesIntoCandidate(row, careerPrefs);

    const computedExp = resolveCandidateListExperienceYears(row);
    if (computedExp != null && Number.isFinite(computedExp)) {
      row.experience = computedExp;
      row.experienceYears = computedExp;
    }
  }

  return enriched;
}

/**
 * Pool for AI match pipeline: tenant NEW/ACTIVE + candidatecommon (Phase 1 snapshots)
 * + optional job-portal merge. Excludes AI-rejected rows for this job.
 */
async function loadMatchPipelineCandidatePool(req, jobId) {
  const jobIdStr = String(jobId || '').trim();
  if (!jobIdStr) {
    return {
      candidates: [],
      tenantCount: 0,
      commonCount: 0,
      portalCount: 0,
      mergedCount: 0,
      phase1TombstoneReincluded: 0,
      commonIncluded: false,
      portalIncluded: false,
    };
  }

  const includeCommon =
    process.env.MATCH_INCLUDE_CANDIDATE_COMMON !== 'false' &&
    process.env.MATCH_INCLUDE_CANDIDATE_COMMON !== '0';
  const includePortal =
    process.env.MATCH_INCLUDE_PORTAL_CANDIDATES !== 'false' &&
    process.env.MATCH_INCLUDE_PORTAL_CANDIDATES !== '0';

  const tenantCandidates = await prisma.candidate.findMany({
    where: {
      isDeleted: { not: true },
    },
  });

  let commonCandidates = [];
  const commonIncluded = includeCommon && isTenantScopedRequest();
  if (commonIncluded) {
    commonCandidates = await fetchCandidateCommonForMatchPipeline(req);
  }

  let portalCandidates = [];
  const portalIncluded = includePortal && isTenantScopedRequest();
  if (portalIncluded) {
    const portalPrisma = getJobPortalPrismaClient();
    const portalLimit = Math.min(5000, Math.max(1, Number(process.env.MATCH_PORTAL_POOL_MAX || 500) || 500));
    portalCandidates = await portalPrisma.candidate.findMany({
      take: portalLimit,
      orderBy: { updatedAt: 'desc' },
    });
  }

  const portalIdsForTombstone = [
    ...portalCandidates.map((c) => c.id),
    ...commonCandidates.map((c) => c.id),
  ];
  const softDeletedTenantIds = portalIdsForTombstone.length
    ? await collectSoftDeletedTenantCandidateIds(portalIdsForTombstone)
    : new Set();

  const mergedById = new Map();
  // Phase 1 snapshots stay eligible for AI matching even when tenant has a recycle-bin tombstone.
  for (const candidate of commonCandidates) {
    mergedById.set(candidate.id, candidate);
  }
  let phase1TombstoneReincluded = 0;
  for (const candidate of commonCandidates) {
    if (softDeletedTenantIds.has(candidate.id)) phase1TombstoneReincluded += 1;
  }
  for (const candidate of portalCandidates) {
    if (softDeletedTenantIds.has(candidate.id) && !mergedById.has(candidate.id)) continue;
    const prior = mergedById.get(candidate.id);
    mergedById.set(
      candidate.id,
      prior ? mergePortalAndTenantCandidateRow(candidate, prior) : candidate
    );
  }
  for (const candidate of tenantCandidates) {
    const prior = mergedById.get(candidate.id);
    mergedById.set(
      candidate.id,
      prior ? mergePortalAndTenantCandidateRow(prior, candidate) : candidate
    );
  }

  let merged = Array.from(mergedById.values());
  if (merged.length) {
    const rejected = await prisma.match.findMany({
      where: {
        jobId: jobIdStr,
        status: 'REJECTED',
        createdById: AI_MATCH_AUTHOR_WHERE,
        candidateId: { in: merged.map((c) => c.id) },
      },
      select: { candidateId: true },
    });
    const rejectedIds = new Set(rejected.map((r) => r.candidateId));
    merged = merged.filter((c) => !rejectedIds.has(c.id));
  }

  merged = await enrichCandidatesForMatchPipeline(merged);

  return {
    candidates: merged,
    tenantCount: tenantCandidates.length,
    commonCount: commonCandidates.length,
    portalCount: portalCandidates.length,
    mergedCount: merged.length,
    phase1TombstoneReincluded,
    commonIncluded,
    portalIncluded,
  };
}

/**
 * Ensure a scored candidate exists in the tenant DB before writing a Match row.
 * @returns {{ id: string, materialized: boolean } | null}
 */
async function ensureCandidateMaterializedForMatch(candidateRow, options = {}) {
  if (!candidateRow?.id) return null;
  if (!isTenantScopedRequest()) return null;

  const existing = await prisma.candidate.findUnique({
    where: { id: candidateRow.id },
    select: { id: true, isDeleted: true },
  });
  if (existing?.isDeleted === true) {
    const row = await materializeCandidateForMatch(candidateRow, options);
    if (!row?.id) return null;
    return { id: row.id, materialized: true };
  }
  if (existing) return { id: existing.id, materialized: false };

  const row = await materializeCandidateForMatch(candidateRow, options);
  if (!row?.id) return null;
  return { id: row.id, materialized: true };
}

// Exposed for cross-module callers (e.g. services/interview.service.js) so they can
// rely on the same portal→tenant materialization as the candidate module routes.
/**
 * Candidates tied to a specific job for the Matches page "AI Applied Matches" tab and
 * the Job drawer Candidates tab:
 * - `assignedJobs` contains the job id (recruiter assigned), and/or
 * - a tenant `Application` row exists for (candidateId, jobId), and/or
 * - a `PipelineEntry` exists for this job.
 * Does not load the general AI pool (NEW/ACTIVE tenant-wide, candidatecommon, portal).
 */
async function loadAppliedMatchCandidatePool(req, jobId) {
  const jobIdStr = String(jobId || '').trim();
  if (!jobIdStr) {
    return {
      candidates: [],
      tenantCount: 0,
      commonCount: 0,
      portalCount: 0,
      mergedCount: 0,
      phase1TombstoneReincluded: 0,
      commonIncluded: false,
      portalIncluded: false,
    };
  }

  const applicationRows = await prisma.application.findMany({
    where: { jobId: jobIdStr },
    select: { candidateId: true },
  });
  const applicationCandidateIds = [
    ...new Set(applicationRows.map((row) => String(row.candidateId || '').trim()).filter(Boolean)),
  ];

  const pipelineRows = await prisma.pipelineEntry.findMany({
    where: { jobId: jobIdStr },
    select: { candidateId: true },
  });
  const pipelineCandidateIds = [
    ...new Set(pipelineRows.map((row) => String(row.candidateId || '').trim()).filter(Boolean)),
  ];

  const matchRows = await prisma.match.findMany({
    where: { jobId: jobIdStr },
    select: { candidateId: true, evaluation: true },
  });
  const matchCandidateIds = [
    ...new Set(
      matchRows
        .filter((row) => isAppliedMatchEvaluation(row.evaluation))
        .map((row) => String(row.candidateId || '').trim())
        .filter(Boolean),
    ),
  ];

  const linkedIdSet = new Set([
    ...applicationCandidateIds,
    ...pipelineCandidateIds,
    ...matchCandidateIds,
  ]);

  const appliedPoolCandidateInclude = {
    assignedTo: { select: { id: true, name: true } },
  };

  const assignedCandidates = await prisma.candidate.findMany({
    where: {
      isDeleted: { not: true },
      assignedJobs: { has: jobIdStr },
    },
    include: appliedPoolCandidateInclude,
  });
  assignedCandidates.forEach((row) => linkedIdSet.add(row.id));

  const extraIds = [...linkedIdSet].filter((id) => !assignedCandidates.some((row) => row.id === id));
  let extraCandidates = [];
  if (extraIds.length) {
    extraCandidates = await prisma.candidate.findMany({
      where: {
        isDeleted: { not: true },
        id: { in: extraIds },
      },
      include: appliedPoolCandidateInclude,
    });
  }

  const byId = new Map();
  for (const row of assignedCandidates) byId.set(row.id, row);
  for (const row of extraCandidates) byId.set(row.id, row);

  let portalCount = 0;
  if (isTenantScopedRequest()) {
    try {
      const portalPrisma = getJobPortalPrismaClient();
      const portalLinkedIds = new Set();

      const portalApplications = await portalPrisma.application.findMany({
        where: { jobId: jobIdStr },
        select: { candidateId: true },
      });
      for (const row of portalApplications) {
        const id = String(row.candidateId || '').trim();
        if (id) portalLinkedIds.add(id);
      }

      const portalMatches = await portalPrisma.match.findMany({
        where: { jobId: jobIdStr },
        select: { candidateId: true, evaluation: true },
      });
      for (const row of portalMatches) {
        if (!isAppliedMatchEvaluation(row.evaluation)) continue;
        const id = String(row.candidateId || '').trim();
        if (id) portalLinkedIds.add(id);
      }

      const portalAssigned = await portalPrisma.candidate.findMany({
        where: { assignedJobs: { has: jobIdStr } },
        select: { id: true },
      });
      for (const row of portalAssigned) {
        const id = String(row.id || '').trim();
        if (id) portalLinkedIds.add(id);
      }

      if (portalLinkedIds.size) {
        const portalCandidates = await portalPrisma.candidate.findMany({
          where: { id: { in: [...portalLinkedIds] } },
        });
        for (const portalRow of portalCandidates) {
          const id = String(portalRow.id || '').trim();
          if (!id) continue;
          portalCount += 1;
          const tenantRow = byId.get(id);
          const mappedPortal = {
            id,
            firstName: portalRow.firstName ?? null,
            lastName: portalRow.lastName ?? null,
            email: portalRow.email ?? null,
            phone: portalRow.phone ?? null,
            linkedIn: portalRow.linkedIn ?? null,
            resume: portalRow.resumeUrl ?? null,
            resumeUrl: portalRow.resumeUrl ?? null,
            experience: portalRow.experience ?? portalRow.experienceYears ?? null,
            experienceYears: portalRow.experienceYears ?? portalRow.experience ?? null,
            currentTitle: portalRow.currentTitle ?? portalRow.designation ?? null,
            currentCompany: portalRow.currentCompany ?? null,
            location: portalRow.location ?? null,
            city: portalRow.city ?? null,
            country: portalRow.country ?? null,
            designation: portalRow.designation ?? portalRow.currentTitle ?? null,
            avatar: portalRow.avatar ?? null,
            stage: portalRow.stage ?? 'Applied',
            source: portalRow.source || 'Job Portal',
            assignedJobs: Array.isArray(portalRow.assignedJobs)
              ? portalRow.assignedJobs.map(String)
              : [jobIdStr],
            status: 'ACTIVE',
          };
          const jobSet = new Set([
            ...(Array.isArray(mappedPortal.assignedJobs) ? mappedPortal.assignedJobs : []),
            jobIdStr,
          ]);
          mappedPortal.assignedJobs = Array.from(jobSet);
          byId.set(
            id,
            tenantRow ? mergePortalAndTenantCandidateRow(mappedPortal, tenantRow) : mappedPortal
          );
        }
      }
    } catch (portalErr) {
      console.warn(
        '[loadAppliedMatchCandidatePool] portal applicants merge failed:',
        portalErr?.message || portalErr
      );
    }
  }

  const candidates = await enrichCandidatesForMatchPipeline(Array.from(byId.values()));

  return {
    candidates,
    tenantCount: assignedCandidates.length + extraCandidates.length,
    commonCount: 0,
    portalCount,
    mergedCount: candidates.length,
    phase1TombstoneReincluded: 0,
    commonIncluded: false,
    portalIncluded: portalCount > 0,
  };
}

export {
  getCandidateOrThrow,
  loadMatchPipelineCandidatePool,
  loadAppliedMatchCandidatePool,
  ensureCandidateMaterializedForMatch,
};

function normalizePortalWorkMode(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw === 'REMOTE') return 'Remote';
  if (raw === 'ON_SITE' || raw === 'ONSITE' || raw === 'ON-SITE') return 'On-site';
  if (raw === 'HYBRID') return 'Hybrid';
  return value;
}

/**
 * The job-portal "career_preferences" collection lives in the portal MongoDB
 * but is not part of the backendphase2 Prisma schema. We read it via raw command
 * so we can surface candidate-self-updated values (notice period, expected
 * salary, availability, preferred location, etc.) inside the recruiter drawer.
 */
async function fetchCareerPreferencesForCandidates(candidateIds) {
  const map = new Map();
  if (!Array.isArray(candidateIds) || !candidateIds.length) return map;

  let portalClient = null;
  try { portalClient = getJobPortalPrismaClient(); } catch { portalClient = null; }
  if (!portalClient) return map;

  const ids = Array.from(new Set(candidateIds.map((id) => String(id)).filter(Boolean)));
  const objectIdHexes = ids.filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
  const stringIds = ids;

  try {
    const result = await portalClient.$runCommandRaw({
      find: 'career_preferences',
      filter: {
        $or: [
          ...(objectIdHexes.length
            ? [{ candidateId: { $in: objectIdHexes.map((hex) => ({ $oid: hex })) } }]
            : []),
          { candidateId: { $in: stringIds } },
        ],
      },
      limit: ids.length,
    });
    const docs = result?.cursor?.firstBatch || [];
    for (const doc of docs) {
      const rawId = doc?.candidateId;
      const idStr = rawId && typeof rawId === 'object' && rawId.$oid
        ? String(rawId.$oid)
        : String(rawId || '');
      if (idStr) map.set(idStr, doc);
    }
  } catch (err) {
    console.warn('[candidate.service] bulk career_preferences fetch failed:', err?.message || err);
  }

  return map;
}

async function fetchPortalCareerPreferencesRaw(client, candidateId) {
  if (!candidateId) return null;
  const targetClient = client || (() => {
    try { return getJobPortalPrismaClient(); } catch { return null; }
  })();
  if (!targetClient) return null;

  const idStr = String(candidateId);
  const isObjectIdHex = /^[a-fA-F0-9]{24}$/.test(idStr);

  try {
    const filters = isObjectIdHex
      ? [{ candidateId: { $oid: idStr } }, { candidateId: idStr }]
      : [{ candidateId: idStr }];

    for (const filter of filters) {
      const result = await targetClient.$runCommandRaw({
        find: 'career_preferences',
        filter,
        limit: 1,
      });
      const doc = result?.cursor?.firstBatch?.[0];
      if (doc) return doc;
    }
  } catch (err) {
    console.warn('[candidate.service] failed to fetch career_preferences:', err?.message || err);
  }

  return null;
}

function resolveCandidateResumeUrl(candidate) {
  if (!candidate) return null;
  const extra =
    candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? candidate.extraData
      : {};
  const snap = extra.phase1ProfileSnapshot;
  const fromSnapshot =
    snap && typeof snap === 'object' && snap.resume && typeof snap.resume === 'object'
      ? snap.resume.fileUrl
      : null;
  return pickFirstNonEmpty(candidate.resume, candidate.resumeUrl, fromSnapshot);
}

async function fetchPortalResumeFileUrl(client, candidateId) {
  if (!client || !candidateId) return null;
  const idStr = String(candidateId).trim();
  if (!idStr) return null;
  const isObjectIdHex = /^[a-fA-F0-9]{24}$/.test(idStr);

  try {
    if (client.resume?.findUnique) {
      const row = await client.resume.findUnique({
        where: { candidateId: idStr },
        select: { fileUrl: true },
      });
      const url = String(row?.fileUrl || '').trim();
      if (url) return url;
    }
  } catch {
    /* job-portal client may not expose Resume model */
  }

  try {
    const filters = isObjectIdHex
      ? [{ candidateId: { $oid: idStr } }, { candidateId: idStr }]
      : [{ candidateId: idStr }];
    for (const filter of filters) {
      const result = await client.$runCommandRaw({
        find: 'resumes',
        filter,
        limit: 1,
      });
      const doc = result?.cursor?.firstBatch?.[0];
      const url = String(doc?.fileUrl || doc?.file_url || '').trim();
      if (url) return url;
    }
  } catch (err) {
    console.warn('[candidate.service] portal resume fetch failed:', err?.message || err);
  }

  return null;
}

async function hydrateCandidateResumeFromPortal(candidate, portalClient) {
  if (!candidate) return candidate;
  let resumeUrl = resolveCandidateResumeUrl(candidate);
  if (!resumeUrl && portalClient) {
    resumeUrl = await fetchPortalResumeFileUrl(portalClient, candidate.id);
  }
  if (resumeUrl) {
    candidate.resume = resumeUrl;
    candidate.resumeUrl = resumeUrl;
  }

  if (portalClient?.resume?.findFirst) {
    try {
      const resumeRow = await portalClient.resume.findFirst({
        where: { candidateId: candidate.id },
        select: { resumeJson: true },
        orderBy: { updatedAt: 'desc' },
      });
      const resumeJson = resumeRow?.resumeJson;
      if (resumeJson && typeof resumeJson === 'object' && !Array.isArray(resumeJson)) {
        applyResumeJsonToCandidate(candidate, resumeJson);
      }
    } catch (err) {
      console.warn('[candidate.service] portal resumeJson hydrate failed:', err?.message || err);
    }
  }

  if (candidate.experience == null && candidate.experienceYears == null) {
    const computedExp = resolveCandidateListExperienceYears(candidate);
    if (computedExp != null) {
      candidate.experience = computedExp;
      candidate.experienceYears = computedExp;
    }
  }

  return candidate;
}

async function loadTenantRecruiterCvExtra(candidateId) {
  if (!candidateId) return {};
  try {
    const row = await prisma.candidate.findUnique({
      where: { id: String(candidateId) },
      select: { extraData: true },
    });
    return pickRecruiterCvExtraFields(row?.extraData);
  } catch {
    return {};
  }
}

async function loadTenantEditorCvContentFields(candidateId) {
  if (!candidateId) return null;
  try {
    return await prisma.candidate.findUnique({
      where: { id: String(candidateId) },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        linkedIn: true,
        avatar: true,
        cvSummary: true,
        cvWorkExperienceEntries: true,
        cvEducationEntries: true,
        skills: true,
        recruiterSkills: true,
        languages: true,
        recruiterLanguages: true,
        cvPortfolioLinks: true,
        currentTitle: true,
        currentCompany: true,
        location: true,
        designation: true,
        extraData: true,
      },
    });
  } catch {
    return null;
  }
}

function applyTenantEditorCvContentFields(candidate, tenantRow) {
  if (!candidate || !tenantRow) return candidate;
  const extra =
    tenantRow.extraData && typeof tenantRow.extraData === 'object' && !Array.isArray(tenantRow.extraData)
      ? tenantRow.extraData
      : {};
  if (extra.cvEditorContentSaved !== true) return candidate;

  const editorFields = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'linkedIn',
    'avatar',
    'cvSummary',
    'currentTitle',
    'currentCompany',
    'location',
    'designation',
  ];
  for (const key of editorFields) {
    if (Object.prototype.hasOwnProperty.call(tenantRow, key)) {
      candidate[key] = tenantRow[key] ?? null;
    }
  }
  candidate.cvWorkExperienceEntries = Array.isArray(tenantRow.cvWorkExperienceEntries)
    ? tenantRow.cvWorkExperienceEntries
    : [];
  candidate.cvEducationEntries = Array.isArray(tenantRow.cvEducationEntries)
    ? tenantRow.cvEducationEntries
    : [];
  candidate.skills = Array.isArray(tenantRow.skills) ? tenantRow.skills : [];
  candidate.recruiterSkills = Array.isArray(tenantRow.recruiterSkills)
    ? tenantRow.recruiterSkills
    : [];
  candidate.languages = Array.isArray(tenantRow.languages) ? tenantRow.languages : [];
  candidate.recruiterLanguages = Array.isArray(tenantRow.recruiterLanguages)
    ? tenantRow.recruiterLanguages
    : [];
  candidate.cvPortfolioLinks = Array.isArray(tenantRow.cvPortfolioLinks)
    ? tenantRow.cvPortfolioLinks
    : [];
  return candidate;
}

async function hydrateAndPersistCandidateCvProfile(candidate, portalClient) {
  if (!candidate) return candidate;
  const [tenantCvExtra, tenantEditorCvRow] = await Promise.all([
    loadTenantRecruiterCvExtra(candidate.id),
    loadTenantEditorCvContentFields(candidate.id),
  ]);
  const skipCvPersist = tenantCvExtra.cvEditorContentSaved === true;

  await hydratePhase1SnapshotPersonalInfoFromPortal(candidate, portalClient);
  await hydrateCandidateResumeFromPortal(candidate, portalClient);

  if (Object.keys(tenantCvExtra).length) {
    const prevExtra =
      candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
        ? candidate.extraData
        : {};
    candidate.extraData = mergeCandidateRecruiterExtraData(prevExtra, {
      ...prevExtra,
      ...tenantCvExtra,
    });
  }

  applyTenantEditorCvContentFields(candidate, tenantEditorCvRow);

  if (!skipCvPersist) {
    try {
      await persistCandidateCvProfileToTenant(candidate);
    } catch (err) {
      console.warn('[candidate.service] CV persist to tenant failed:', candidate.id, err?.message || err);
    }
  }

  if (Object.keys(tenantCvExtra).length) {
    const prevExtra =
      candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
        ? candidate.extraData
        : {};
    candidate.extraData = mergeCandidateRecruiterExtraData(prevExtra, {
      ...prevExtra,
      ...tenantCvExtra,
    });
  }

  applyTenantEditorCvContentFields(candidate, tenantEditorCvRow);
  return candidate;
}

function mergeCareerPreferencesIntoCandidate(candidate, careerPrefs) {
  if (!candidate || !careerPrefs) return candidate;

  const normalized = normalizePortalCareerPreferences(careerPrefs, candidate);
  if (!normalized) return candidate;

  candidate.noticePeriod = pickFirstNonEmpty(candidate.noticePeriod, normalized.noticePeriod);
  candidate.availability = pickFirstNonEmpty(candidate.availability, normalized.availabilityToStart);
  candidate.expectedSalary =
    candidate.expectedSalary != null ? candidate.expectedSalary : normalized.preferredSalary;
  candidate.currentSalary =
    candidate.currentSalary != null ? candidate.currentSalary : normalized.currentSalary;
  candidate.preferredLocation = pickFirstNonEmpty(
    candidate.preferredLocation,
    Array.isArray(normalized.preferredLocations) ? normalized.preferredLocations[0] : null,
  );
  if (!candidate.currentTitle && normalized.currentRole) {
    candidate.currentTitle = normalized.currentRole;
  }
  if (!candidate.designation && normalized.currentRole) {
    candidate.designation = normalized.currentRole;
  }
  if (normalized.currentLocation) {
    candidate.location = pickFirstNonEmpty(candidate.location, normalized.currentLocation);
  }

  candidate.careerPreferences = normalized;
  return candidate;
}

async function buildCandidateResponse(candidate, activityClient = prisma, viewerUserId = null) {
  const activities = await getCandidateActivities(candidate.id, activityClient, viewerUserId);
  const customTags = extractCustomTags(activities);
  const internalNotes = activities.map(mapActivityToNote).filter(Boolean);
  const activityFeed = activities.map(mapActivityToDrawerItem).filter(Boolean);
  const normalizedCandidate = {
    ...candidate,
    resume: resolveCandidateResumeUrl(candidate),
    skills:
      Array.isArray(candidate.skills) && candidate.skills.length
        ? candidate.skills
        : Array.isArray(candidate.recruiterSkills)
          ? candidate.recruiterSkills
          : [],
    experience:
      resolveCandidateListExperienceYears(candidate) ??
      candidate.experience ??
      candidate.experienceYears ??
      null,
    address: candidate.address || candidate.addressLine || null,
    status: candidate.status || candidate.recruiterStatus || 'NEW',
    education: candidate.education || candidate.recruiterEducation || null,
    certifications:
      Array.isArray(candidate.certifications) && candidate.certifications.length
        ? candidate.certifications
        : Array.isArray(candidate.certificationsList)
          ? candidate.certificationsList
          : [],
    languages:
      Array.isArray(candidate.languages) && candidate.languages.length
        ? candidate.languages
        : Array.isArray(candidate.recruiterLanguages)
          ? candidate.recruiterLanguages
          : [],
    notes: candidate.notes || candidate.recruiterNotes || null,
    aiCandidateAnalysis: buildAiCandidateAnalysis(candidate),
  };

  const withAudit = await attachAuditMetaToEntity(normalizedCandidate, ENTITY_TYPES.CANDIDATE);

  return {
    ...withAudit,
    tags: customTags.map((tag) => tag.label),
    tagObjects: customTags,
    internalNotes,
    activityFeed,
  };
}

/** Job ids the signed-in user owns (creator, assignee, manager, or supporting recruiter). */
async function getMyJobIds(userId) {
  if (!userId) return [];
  const myJobs = await prisma.job.findMany({
    where: buildMyJobsWhereClause(userId),
    select: { id: true },
  });
  return myJobs.map((j) => String(j.id));
}

/**
 * In-memory check on merged list rows (tenant + portal + common pool).
 * Ensures applicants linked only on portal/assignedJobs still appear under My candidates.
 */
function candidateMatchesMineScope(candidate, userId, myJobIds) {
  if (!candidate || !userId) return false;
  const uid = String(userId);
  if (String(candidate.createdById || candidate.createdBy?.id || '') === uid) return true;
  if (String(candidate.assignedToId || candidate.assignedTo?.id || '') === uid) return true;

  const jobIdSet = new Set((myJobIds || []).map((id) => String(id)).filter(Boolean));
  if (!jobIdSet.size) {
    return String(candidate.createdById || candidate.createdBy?.id || '') === uid
      || String(candidate.assignedToId || candidate.assignedTo?.id || '') === uid;
  }

  const assigned = Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs : [];
  if (assigned.some((id) => jobIdSet.has(String(id || '').trim()))) return true;

  const matchJobIds = Array.isArray(candidate.matchJobIds) ? candidate.matchJobIds : [];
  if (matchJobIds.some((id) => jobIdSet.has(String(id || '').trim()))) return true;

  const applications = Array.isArray(candidate.applications) ? candidate.applications : [];
  if (applications.some((row) => jobIdSet.has(String(row?.jobId || '').trim()))) return true;

  const pipelineEntries = Array.isArray(candidate.pipelineEntries) ? candidate.pipelineEntries : [];
  if (pipelineEntries.some((row) => jobIdSet.has(String(row?.jobId || '').trim()))) return true;

  const matches = Array.isArray(candidate.matches) ? candidate.matches : [];
  if (matches.some((row) => jobIdSet.has(String(row?.jobId || row?.job?.id || '').trim()))) {
    return true;
  }

  const interviews = Array.isArray(candidate.interviews) ? candidate.interviews : [];
  if (interviews.some((row) => jobIdSet.has(String(row?.jobId || row?.job?.id || '').trim()))) {
    return true;
  }

  return false;
}

/** Candidates the user may see when mine=true: created by them, assigned to them, or linked to jobs they own. */
async function buildMineCandidatesScope(userId) {
  if (!userId) {
    return { id: { in: [] } };
  }
  const myJobIds = await getMyJobIds(userId);
  const orClause = buildAssigneeVisibilityOr(userId);
  if (myJobIds.length > 0) {
    orClause.push({ matches: { some: { jobId: { in: myJobIds } } } });
    orClause.push({ pipelineEntries: { some: { jobId: { in: myJobIds } } } });
    orClause.push({ interviews: { some: { jobId: { in: myJobIds } } } });
    orClause.push({ assignedJobs: { hasSome: myJobIds } });
    orClause.push({ applications: { some: { jobId: { in: myJobIds } } } });
  }
  return { OR: orClause };
}

/** Recruiters without view-all see candidates they own or who applied to their jobs. */
async function buildCandidateListVisibilityScope(req) {
  const userId = req?.user?.id;
  if (!userId) return { id: { in: [] } };
  const visibleJobIds = await getVisibleTenantJobIds(req, false);
  const visibilityOr = buildAssigneeVisibilityOr(userId);
  if (visibleJobIds.length > 0) {
    visibilityOr.push({ assignedJobs: { hasSome: visibleJobIds } });
    visibilityOr.push({ applications: { some: { jobId: { in: visibleJobIds } } } });
    visibilityOr.push({ matches: { some: { jobId: { in: visibleJobIds } } } });
    visibilityOr.push({ pipelineEntries: { some: { jobId: { in: visibleJobIds } } } });
  }
  return { OR: visibilityOr };
}

function isTenantScopedRequest() {
  return Boolean(getActiveTenantDbName());
}

async function getVisibleTenantJobIds(req, mine) {
  const userId = req?.user?.id;
  const jobWhere =
    mine && userId ? buildMyJobsWhereClause(userId) : { isDeleted: { not: true } };

  const jobs = await prisma.job.findMany({
    where: jobWhere,
    select: { id: true },
  });

  return jobs.map((job) => job.id);
}

/**
 * Portal DB candidates never carry the tenant CRM `isDeleted` flag. After a tenant soft-deletes
 * a candidate, the portal row can still exist — merge paths must drop those ids so deleted
 * candidates never reappear in lists, stats, or exports.
 */
async function collectSoftDeletedTenantCandidateIds(portalCandidateIds) {
  const ids = [...new Set((portalCandidateIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return new Set();

  const [softDeletedRows, purgedRows] = await Promise.all([
    prisma.candidate.findMany({
      where: { id: { in: ids }, isDeleted: true },
      select: { id: true },
    }),
    prisma.purgedCandidateRef
      .findMany({
        where: { candidateId: { in: ids } },
        select: { candidateId: true },
      })
      .catch(() => []),
  ]);

  const hidden = new Set(softDeletedRows.map((r) => r.id));
  for (const row of purgedRows) {
    hidden.add(row.candidateId);
  }
  return hidden;
}

const CANDIDATE_EXPERIENCE_RANGES = {
  '0-2': { min: 0, max: 2 },
  '2-5': { min: 2, max: 5 },
  '5-10': { min: 5, max: 10 },
  '10+': { min: 10, max: null },
};

/** UI / API stage filter keys → DB values that may appear on `candidate.stage`. */
const STAGE_FILTER_VARIANTS = {
  new: ['New', 'NEW'],
  applied: ['Applied', 'APPLIED'],
  longlist: ['Longlist', 'Long List', 'LONGLIST'],
  shortlist: ['Shortlist', 'Short List', 'SHORTLIST'],
  screening: ['Screening', 'SCREENING'],
  submitted: ['Submitted', 'SUBMITTED'],
  interviewing: ['Interviewing', 'Interview', 'INTERVIEW', 'INTERVIEWING'],
  offered: ['Offered', 'Offer', 'OFFER', 'OFFERED'],
  hired: ['Hired', 'HIRED', 'Placed', 'PLACED'],
  rejected: ['Rejected', 'REJECTED'],
};

function normalizeStageFilterKey(stageParam) {
  const raw = String(stageParam || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const keys = Object.keys(STAGE_FILTER_VARIANTS);
  if (keys.includes(lower)) return lower;
  const byVariant = keys.find((key) =>
    (STAGE_FILTER_VARIANTS[key] || []).some((v) => String(v).toLowerCase() === lower)
  );
  return byVariant || lower;
}

function stageMatchesFilter(candidateStage, stageParam) {
  const key = normalizeStageFilterKey(stageParam);
  if (!key) return true;
  const hay = String(candidateStage || '').trim();
  const hayLower = hay.toLowerCase();
  if (key === 'new') {
    return !hay || hayLower === 'new';
  }
  const variants = STAGE_FILTER_VARIANTS[key];
  if (!variants) {
    return hayLower === key || hayLower.includes(key);
  }
  return variants.some((variant) => {
    const v = String(variant || '').trim().toLowerCase();
    return v && (hayLower === v || hayLower.includes(v));
  });
}

function buildStagePrismaWhereClause(stageParam) {
  const key = normalizeStageFilterKey(stageParam);
  if (!key) return null;
  if (key === 'new') {
    return {
      OR: [{ stage: null }, { stage: '' }, { stage: 'New' }, { stage: 'NEW' }],
    };
  }
  const variants = STAGE_FILTER_VARIANTS[key] || [String(stageParam || '').trim()];
  const unique = [...new Set(variants.map((v) => String(v).trim()).filter(Boolean))];
  return {
    OR: unique.map((variant) => ({ stage: variant })),
  };
}

function parseCandidateListFilters(query = {}) {
  const company = String(query.company || '').trim();
  const location = String(query.location || '').trim();
  const jobId = String(query.jobId || '').trim();
  const experienceRange = String(query.experienceRange || '').trim();
  const stage = String(query.stage || '').trim();
  const range = CANDIDATE_EXPERIENCE_RANGES[experienceRange];
  return {
    company,
    location,
    jobId,
    experienceRange,
    stage,
    minExperience: range ? range.min : null,
    maxExperience: range && range.max != null ? range.max : null,
    minExperienceOpen: range && range.max == null ? range.min : null,
  };
}

function appendCandidateListFilterAndParts(andParts, filters) {
  const { company, location, jobId, stage, minExperience, maxExperience, minExperienceOpen } = filters;
  const stageClause = buildStagePrismaWhereClause(stage);
  if (stageClause) {
    andParts.push(stageClause);
  }
  if (company) {
    andParts.push({
      OR: [
        { currentCompany: { contains: company, mode: 'insensitive' } },
        {
          matches: {
            some: {
              job: {
                client: { companyName: { contains: company, mode: 'insensitive' } },
              },
            },
          },
        },
      ],
    });
  }
  if (location) {
    andParts.push({ location: { contains: location } });
  }
  if (jobId) {
    andParts.push({
      OR: [
        { assignedJobs: { has: jobId } },
        { matches: { some: { jobId: jobId } } },
        { applications: { some: { jobId: jobId } } },
        { pipelineEntries: { some: { jobId: jobId } } },
      ],
    });
  }
  const expBounds = [];
  if (minExperience != null || maxExperience != null || minExperienceOpen != null) {
    const experienceClause = {};
    const experienceYearsClause = {};
    if (minExperience != null) {
      experienceClause.gte = minExperience;
      experienceYearsClause.gte = minExperience;
    }
    if (maxExperience != null) {
      experienceClause.lte = maxExperience;
      experienceYearsClause.lte = maxExperience;
    }
    if (minExperienceOpen != null) {
      experienceClause.gte = minExperienceOpen;
      experienceYearsClause.gte = minExperienceOpen;
    }
    if (Object.keys(experienceClause).length) {
      expBounds.push({ experience: experienceClause });
    }
    if (Object.keys(experienceYearsClause).length) {
      expBounds.push({ experienceYears: experienceYearsClause });
    }
    if (expBounds.length) {
      andParts.push({ OR: expBounds });
    }
  }
}

function candidateMatchesListFilters(candidate, filters, tenantJobIdSet = null) {
  const { company, location, jobId, stage, minExperience, maxExperience, minExperienceOpen } = filters;
  if (stage && !stageMatchesFilter(resolveCandidateStageForList(candidate, tenantJobIdSet), stage)) {
    return false;
  }
  if (company) {
    const needle = company.toLowerCase();
    const currentCompanyHay = String(candidate.currentCompany || '').toLowerCase();
    const matchClientNames = (Array.isArray(candidate.matches) ? candidate.matches : [])
      .map((match) => String(match?.job?.client?.companyName || '').toLowerCase())
      .filter(Boolean);
    const matchesCompany =
      currentCompanyHay.includes(needle) ||
      matchClientNames.some((name) => name.includes(needle));
    if (!matchesCompany) return false;
  }
  if (location) {
    const hay = [candidate.location, candidate.city, candidate.country]
      .map((part) => String(part || '').toLowerCase())
      .filter(Boolean)
      .join(' ');
    if (!hay.includes(location.toLowerCase())) return false;
  }
  if (jobId) {
    const assigned = Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs.map(String) : [];
    const matchJobIds = Array.isArray(candidate.matches)
      ? candidate.matches.map((m) => String(m?.jobId || m?.job?.id || '')).filter(Boolean)
      : [];
    const applicationJobIds = Array.isArray(candidate.applications)
      ? candidate.applications.map((a) => String(a?.jobId || '')).filter(Boolean)
      : [];
    const pipelineJobIds = Array.isArray(candidate.pipelineEntries)
      ? candidate.pipelineEntries.map((p) => String(p?.jobId || '')).filter(Boolean)
      : [];
    const linkedToJob =
      assigned.includes(jobId) ||
      matchJobIds.includes(jobId) ||
      applicationJobIds.includes(jobId) ||
      pipelineJobIds.includes(jobId);
    if (!linkedToJob) return false;
  }
  const exp = Number(candidate.experience ?? candidate.experienceYears ?? 0) || 0;
  if (minExperience != null && exp < minExperience) return false;
  if (maxExperience != null && exp > maxExperience) return false;
  if (minExperienceOpen != null && exp < minExperienceOpen) return false;
  return true;
}

async function fetchPortalCandidatesForTenant(req, { status, assignedToId, search, mine, listFilters }) {
  if (!isTenantScopedRequest()) return [];

  const portalPrisma = getJobPortalPrismaClient();
  const tenantJobIds = await getVisibleTenantJobIds(req, mine);
  if (!tenantJobIds.length) return [];

  const where = {};
  if (assignedToId === 'unassigned') {
    where.assignedToId = null;
  } else if (assignedToId) {
    where.assignedToId = assignedToId;
  }

  const andParts = [];
  // Shared job-portal DB is cross-tenant — always gate on this tenant's CRM job ids.
  andParts.push({
    OR: [
      { matches: { some: { jobId: { in: tenantJobIds } } } },
      { assignedJobs: { hasSome: tenantJobIds } },
      { applications: { some: { jobId: { in: tenantJobIds } } } },
      { pipelineEntries: { some: { jobId: { in: tenantJobIds } } } },
    ],
  });

  if (status) {
    andParts.push({
      OR: [{ status }, { recruiterStatus: status }],
    });
  }

  const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
  const canViewAllCandidates =
    canViewAllAssignments(req) || hasAnyPermissionScope(req, ['view_all_candidates']);
  if (mine && req?.user?.id) {
    const mineScope = await buildMineCandidatesScope(req.user.id);
    andParts.push(mineScope);
  } else if (superAdminScope) {
    andParts.push(superAdminScope);
  } else if (!canViewAllCandidates && req?.user?.id) {
    const org = await getRequestOrgScope(req);
    if (!isOrgHeadPurpose(org)) {
      andParts.push(await buildCandidateListVisibilityScope(req));
    }
  }
  const orgScope = await applyOrgCompanyAssigneeWhere(req, {
    assignedToIdField: 'assignedToId',
    createdByField: 'createdById',
  });
  if (orgScope) andParts.push(orgScope);

  const searchClause = buildCandidateSearchWhereClause(search);
  if (searchClause) andParts.push(searchClause);

  if (listFilters) {
    appendCandidateListFilterAndParts(andParts, listFilters);
  }

  if (andParts.length) {
    where.AND = andParts;
  }

  return portalPrisma.candidate.findMany({
    where,
    include: candidateListInclude,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export const candidateService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, assignedToId, search, ids } = req.query;
    const listFilters = parseCandidateListFilters(req.query);
    const loadCommonPool = await resolveLoadCommonPool(req.query);
    const mine =
      req.query?.mine === 'true' || req.query?.mine === '1' || req.query?.mine === true;
    const myJobIds = mine && req.user?.id ? await getMyJobIds(req.user.id) : [];
    const tenantJobIdSet = isTenantScopedRequest() ? await getTenantJobIdSet() : null;

    if (mine && !req.user?.id) {
      return formatPaginationResponse([], page, limit, 0);
    }

    const where = {};
    if (status) where.status = status;
    if (assignedToId === 'unassigned') {
      where.assignedToId = null;
    } else if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    const andParts = [];
    if (ids) {
      const idList = String(ids)
        .split(',')
        .map((value) => value.trim())
        .filter((value) => /^[a-fA-F0-9]{24}$/.test(value));
      if (idList.length) {
        andParts.push({ id: { in: idList } });
      }
    }
    // Recycle Bin: hide soft-deleted rows from the normal Candidates page.
    // `not: true` matches false, null, and missing-field documents (legacy rows from before
    // the soft-delete column existed) without tripping Prisma's "Argument isDeleted is missing".
    andParts.push({ isDeleted: { not: true } });
    // Phase 1 discovery rows (no job link) appear on "All candidates" via includeCommonPool + candidatecommon merge.
    if (!loadCommonPool) {
      andParts.push(buildCrmCandidatesListScopeClause());
    }
    const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    const canViewAllCandidates =
      canViewAllAssignments(req) || hasAnyPermissionScope(req, ['view_all_candidates']);

    // When mine=true, use the expanded "my candidates" scope only:
    // - created by me
    // - linked to jobs created by me (matches / pipeline / interviews)
    // Do NOT also AND with the legacy super-admin owner scope, otherwise
    // candidates applied on my jobs but not directly assigned/created get excluded.
    if (mine && req.user?.id) {
      andParts.push(await buildMineCandidatesScope(req.user.id));
    } else if (superAdminScope) {
      andParts.push(superAdminScope);
    } else if (!canViewAllCandidates && req.user?.id) {
      const org = await getRequestOrgScope(req);
      if (!isOrgHeadPurpose(org)) {
        andParts.push(await buildCandidateListVisibilityScope(req));
      }
    }
    const orgScope = await applyOrgCompanyAssigneeWhere(req, {
      assignedToIdField: 'assignedToId',
      createdByField: 'createdById',
    });
    if (orgScope) andParts.push(orgScope);
    const searchClause = buildCandidateSearchWhereClause(search);
    if (searchClause) andParts.push(searchClause);
    appendCandidateListFilterAndParts(andParts, listFilters);
    if (andParts.length) {
      where.AND = andParts;
    }

    let candidates = [];
    let total = 0;

    if (isTenantScopedRequest()) {
      let commonCandidates = [];
      if (loadCommonPool) {
        commonCandidates = await fetchCandidateCommonForCandidatesList(req);
      }

      const [tenantCandidates, portalCandidates] = await Promise.all([
        prisma.candidate.findMany({
          where,
          include: candidateListInclude,
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        fetchPortalCandidatesForTenant(req, { status, assignedToId, search, mine, listFilters }),
      ]);

      const tombstoneIds = [
        ...portalCandidates.map((c) => c.id),
        ...commonCandidates.map((c) => c.id),
      ];
      const softDeletedTenantIds = tombstoneIds.length
        ? await collectSoftDeletedTenantCandidateIds(tombstoneIds)
        : new Set();

      const mergedById = new Map();
      // Phase 1 discovery rows stay visible on "All candidates" even when a tenant recycle-bin stub exists.
      for (const candidate of commonCandidates) {
        mergedById.set(candidate.id, candidate);
      }
      for (const candidate of portalCandidates) {
        if (softDeletedTenantIds.has(candidate.id) && !mergedById.has(candidate.id)) continue;
        const prior = mergedById.get(candidate.id);
        mergedById.set(
          candidate.id,
          prior ? mergePortalAndTenantCandidateRow(candidate, prior) : candidate
        );
      }
      for (const candidate of tenantCandidates) {
        const prior = mergedById.get(candidate.id);
        mergedById.set(
          candidate.id,
          prior ? mergePortalAndTenantCandidateRow(prior, candidate) : candidate
        );
      }

      const tenantCandidateIds = new Set(tenantCandidates.map((candidate) => candidate.id));

      let merged = Array.from(mergedById.values())
        .filter((original) =>
          shouldIncludeCandidateAfterTenantScope(
            original,
            scopeCandidateForActiveTenant(original, tenantJobIdSet),
            { includeCommonPool: loadCommonPool, inTenantDb: tenantCandidateIds.has(original.id) }
          )
        )
        .map((candidate) => scopeCandidateForActiveTenant(candidate, tenantJobIdSet))
        .filter((candidate) => shouldShowOnCrmCandidatesList(candidate, { includeCommonPool: loadCommonPool }))
        .filter((candidate) => candidateMatchesSearch(candidate, search))
        .filter((candidate) => candidateMatchesListFilters(candidate, listFilters, tenantJobIdSet));

      if (mine && req.user?.id) {
        merged = merged.filter((candidate) =>
          candidateMatchesMineScope(candidate, req.user.id, myJobIds)
        );
      }

      merged.sort((a, b) => candidateListSortTimestamp(b) - candidateListSortTimestamp(a));

      total = merged.length;
      candidates = merged.slice(skip, skip + limit);
      candidates = await attachPlacementsToCandidates(candidates);
    } else {
      const tenantRows = await prisma.candidate.findMany({
        where,
        include: candidateListInclude,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      });

      if (loadCommonPool) {
        const commonCandidates = await fetchCandidateCommonForCandidatesList(req);
        const softDeletedTenantIds = commonCandidates.length
          ? await collectSoftDeletedTenantCandidateIds(commonCandidates.map((c) => c.id))
          : new Set();
        const mergedById = new Map();
        for (const commonRow of commonCandidates) {
          mergedById.set(commonRow.id, commonRow);
        }
        for (const candidate of tenantRows) {
          if (softDeletedTenantIds.has(candidate.id) && !mergedById.has(candidate.id)) continue;
          const prior = mergedById.get(candidate.id);
          mergedById.set(
            candidate.id,
            prior ? mergePortalAndTenantCandidateRow(prior, candidate) : candidate
          );
        }
        const tenantCandidateIds = new Set(tenantRows.map((candidate) => candidate.id));

        let merged = Array.from(mergedById.values())
          .filter((original) =>
            shouldIncludeCandidateAfterTenantScope(
              original,
              scopeCandidateForActiveTenant(original, tenantJobIdSet),
              { includeCommonPool: loadCommonPool, inTenantDb: tenantCandidateIds.has(original.id) }
            )
          )
          .map((candidate) => scopeCandidateForActiveTenant(candidate, tenantJobIdSet))
          .filter((candidate) => shouldShowOnCrmCandidatesList(candidate, { includeCommonPool: loadCommonPool }))
          .filter((candidate) => candidateMatchesSearch(candidate, search))
          .filter((candidate) => candidateMatchesListFilters(candidate, listFilters, tenantJobIdSet));

        if (mine && req.user?.id) {
          merged = merged.filter((candidate) =>
            candidateMatchesMineScope(candidate, req.user.id, myJobIds)
          );
        }

        merged.sort((a, b) => candidateListSortTimestamp(b) - candidateListSortTimestamp(a));

        total = merged.length;
        candidates = merged.slice(skip, skip + limit);
        candidates = await attachPlacementsToCandidates(candidates);
      } else {
        let rows = tenantRows;
        if (search) {
          rows = rows.filter((candidate) => candidateMatchesSearch(candidate, search));
        }
        total = rows.length;
        candidates = rows.slice(skip, skip + limit);
        candidates = await attachPlacementsToCandidates(candidates);
      }
    }

    if (candidates.length) {
      let portalClientForList = null;
      try {
        portalClientForList = getJobPortalPrismaClient();
      } catch {
        portalClientForList = null;
      }
      if (portalClientForList) {
        await batchHydrateCandidatesResumeFromPortal(candidates, portalClientForList);
        const candidateIds = candidates
          .map((row) => String(row?.id || '').trim())
          .filter(Boolean);
        if (candidateIds.length) {
          const existingTenantRows = await prisma.candidate.findMany({
            where: { id: { in: candidateIds } },
            select: { id: true },
          });
          const existingTenantIds = new Set(existingTenantRows.map((row) => row.id));
          await Promise.all(
            candidates
              .filter((row) => row?.id && !existingTenantIds.has(row.id))
              .map((row) =>
                persistCandidateCvProfileToTenant(row).catch((err) => {
                  console.warn(
                    '[candidate.service] list CV stub persist failed:',
                    row?.id,
                    err?.message || err,
                  );
                }),
              ),
          );
        }
      }
    }

    // Resolve linked job ids (assign, apply, pipeline, match) into titles for list UI.
    const assignedJobIds = Array.from(
      new Set(
        candidates.flatMap((candidate) => {
          const scoped = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
          return collectCandidateLinkedJobIds(scoped);
        })
      )
    );

    const jobsById = new Map();
    if (assignedJobIds.length) {
      const jobs = await prisma.job.findMany({
        where: { id: { in: assignedJobIds } },
        select: { id: true, title: true },
      });
      for (const job of jobs) jobsById.set(job.id, job.title);
    }

    // Fetch career preferences from portal DB for the visible page so that
    // candidate-self-updated values (notice period, expected salary, availability,
    // preferred location) appear in the list response too.
    const careerPrefsByCandidate = await fetchCareerPreferencesForCandidates(
      candidates.map((c) => c.id).filter(Boolean)
    );

    const enriched = candidates.map((candidate) => {
      const careerPrefs = careerPrefsByCandidate.get(String(candidate.id));
      if (careerPrefs) mergeCareerPreferencesIntoCandidate(candidate, careerPrefs);
      const scopedCandidate = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
      const linkedJobIds = collectCandidateLinkedJobIds(scopedCandidate);
      const scopedWithJobs = {
        ...scopedCandidate,
        assignedJobs: linkedJobIds.length
          ? linkedJobIds
          : Array.isArray(scopedCandidate.assignedJobs)
            ? scopedCandidate.assignedJobs
            : [],
      };
      const titles = resolveCandidateAssignedJobTitlesForList(scopedWithJobs, jobsById);
      return annotateCandidateListFlags(
        {
          ...scopedWithJobs,
          resume: scopedWithJobs.resume || scopedWithJobs.resumeUrl || null,
          skills:
            Array.isArray(scopedWithJobs.skills) && scopedWithJobs.skills.length
              ? scopedWithJobs.skills
              : Array.isArray(scopedWithJobs.recruiterSkills)
                ? scopedWithJobs.recruiterSkills
                : [],
          experience:
            resolveCandidateListExperienceYears(scopedWithJobs) ??
            scopedWithJobs.experience ??
            scopedWithJobs.experienceYears ??
            null,
          status: scopedWithJobs.status || scopedWithJobs.recruiterStatus || 'NEW',
          education: scopedWithJobs.education || scopedWithJobs.recruiterEducation || null,
          languages:
            Array.isArray(scopedWithJobs.languages) && scopedWithJobs.languages.length
              ? scopedWithJobs.languages
              : Array.isArray(scopedWithJobs.recruiterLanguages)
                ? scopedWithJobs.recruiterLanguages
                : [],
          notes: scopedWithJobs.notes || scopedWithJobs.recruiterNotes || null,
          assignedJobTitles: titles,
        },
        tenantJobIdSet
      );
    });

    const withAudit = await prepareListWithAuditMeta(enriched, ENTITY_TYPES.CANDIDATE);
    return formatPaginationResponse(withAudit, page, limit, total);
  },

  async getById(id, req = null) {
    const viewerUserId = req?.user?.id || null;
    const tenantJobIdSet = isTenantScopedRequest() ? await getTenantJobIdSet() : null;
    const annotateForTenant = (row) =>
      annotateCandidateListFlags(scopeCandidateForActiveTenant(row, tenantJobIdSet), tenantJobIdSet);

    // Super admins should be able to open ANY candidate in their tenant by default.
    // buildSuperAdminOwnerScope already returns null unless mineOnly=true is explicitly
    // passed, so we don't apply any extra "mine" restriction here. Non-super users
    // without the view_all_candidates permission stay scoped to records they
    // created or are assigned to.
    const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    let accessScope = superAdminScope;
    const canViewAllCandidates =
      canViewAllAssignments(req) || hasAnyPermissionScope(req, ['view_all_candidates']);

    if (!isSuperAdminUser(req) && !canViewAllCandidates && req?.user?.id) {
      const org = await getRequestOrgScope(req);
      if (!isOrgHeadPurpose(org)) {
        const assignedScope = { OR: buildAssigneeVisibilityOr(req.user.id) };
        accessScope = accessScope ? { AND: [accessScope, assignedScope] } : assignedScope;
      }
    }
    const orgScope = await applyOrgCompanyAssigneeWhere(req, {
      assignedToIdField: 'assignedToId',
      createdByField: 'createdById',
    });
    if (orgScope) {
      accessScope = accessScope ? { AND: [accessScope, orgScope] } : orgScope;
    }

    const baseTenantWhere = { id, isDeleted: { not: true } };
    let candidate = await prisma.candidate.findFirst({
      where: accessScope ? { AND: [baseTenantWhere, accessScope] } : baseTenantWhere,
      include: candidateDetailInclude,
    });

    if (!candidate && isTenantScopedRequest()) {
      let portalPrisma = null;
      try {
        portalPrisma = getJobPortalPrismaClient();
      } catch {
        portalPrisma = null;
      }

      const [tombstone, purgedRef, commonCandidate] = await Promise.all([
        prisma.candidate.findFirst({
          where: { id, isDeleted: true },
          select: { id: true },
        }),
        prisma.purgedCandidateRef
          .findUnique({ where: { candidateId: id }, select: { candidateId: true } })
          .catch(() => null),
        fetchCandidateCommonByCandidateId(id, { requireVerified: false }),
      ]);

      // Phase 1 pool row still opens in the drawer even if tenant soft-deleted the same id.
      if (commonCandidate && (tombstone || purgedRef)) {
        const careerPrefs = await fetchPortalCareerPreferencesRaw(portalPrisma, id);
        mergeCareerPreferencesIntoCandidate(commonCandidate, careerPrefs);
        await hydrateAndPersistCandidateCvProfile(commonCandidate, portalPrisma);
        return buildCandidateResponse(
          await enrichCandidateDetailJobTitles(annotateForTenant(commonCandidate), tenantJobIdSet),
          portalPrisma,
          viewerUserId,
        );
      }
      if (tombstone || purgedRef) {
        return null;
      }

      if (portalPrisma) {
        candidate = await portalPrisma.candidate.findFirst({
          where: { id },
          include: candidateDetailInclude,
        });
        if (candidate) {
          const commonRow = await fetchCandidateCommonByCandidateId(id, { requireVerified: false });
          if (commonRow) {
            candidate = mergePortalAndTenantCandidateRow(commonRow, candidate);
          }
          const careerPrefs = await fetchPortalCareerPreferencesRaw(portalPrisma, candidate.id);
          mergeCareerPreferencesIntoCandidate(candidate, careerPrefs);
          await hydrateAndPersistCandidateCvProfile(candidate, portalPrisma);
          return buildCandidateResponse(
            await enrichCandidateDetailJobTitles(annotateForTenant(candidate), tenantJobIdSet),
            portalPrisma,
            viewerUserId,
          );
        }
      }

      if (commonCandidate) {
        const careerPrefs = await fetchPortalCareerPreferencesRaw(portalPrisma, id);
        mergeCareerPreferencesIntoCandidate(commonCandidate, careerPrefs);
        await hydrateAndPersistCandidateCvProfile(commonCandidate, portalPrisma);
        return buildCandidateResponse(
          await enrichCandidateDetailJobTitles(annotateForTenant(commonCandidate), tenantJobIdSet),
          portalPrisma,
          viewerUserId,
        );
      }
    }

    if (!candidate) return null;

    const commonCandidate = await fetchCandidateCommonByCandidateId(id, { requireVerified: false });
    if (commonCandidate) {
      candidate = mergePortalAndTenantCandidateRow(commonCandidate, candidate);
    }

    // Career preferences live in the job-portal DB (where candidates self-update).
    // Always look there so recruiter drawer reflects candidate-side updates.
    let portalClientForPrefs = null;
    try { portalClientForPrefs = getJobPortalPrismaClient(); } catch { portalClientForPrefs = null; }
    const careerPrefs = await fetchPortalCareerPreferencesRaw(portalClientForPrefs, candidate.id);
    mergeCareerPreferencesIntoCandidate(candidate, careerPrefs);
    await hydrateAndPersistCandidateCvProfile(candidate, portalClientForPrefs);

    return buildCandidateResponse(
      await enrichCandidateDetailJobTitles(annotateForTenant(candidate), tenantJobIdSet),
      portalClientForPrefs,
      viewerUserId,
    );
  },

  async create(data, createdByUserId, req = null) {
    const candidateData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      linkedIn: data.linkedIn,
      resume: data.resume,
      skills: data.skills || [],
      experience: data.experience,
      currentTitle: data.currentTitle,
      currentCompany: data.currentCompany,
      location: data.location,
      status: data.status || 'NEW',
      source: data.source,
      assignedToId: data.assignedToId,
      rating: data.rating,
      noticePeriod: data.noticePeriod,
      hotlist: data.hotlist || false,
      salary: data.salary,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender,
      address: data.address,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      country: data.country,
      workAuthorization: data.workAuthorization,
      availability: data.availability,
      expectedSalary: data.expectedSalary,
      currentSalary: data.currentSalary,
      education: data.education,
      certifications: data.certifications || [],
      languages: data.languages || [],
      portfolio: data.portfolio,
      github: data.github,
      website: data.website,
      notes: data.notes,
      tags: data.tags || [],
      preferredLocation: data.preferredLocation,
      willingToRelocate: data.willingToRelocate || false,
      remoteWorkPreference: data.remoteWorkPreference,
      createdById: createdByUserId || undefined,
      participantIds: buildInitialParticipantIds(createdByUserId, data.assignedToId),
    };

    const writeOrgUnitId = await resolveWriteOrgUnitId(req);
    if (writeOrgUnitId) candidateData.orgUnitId = writeOrgUnitId;

    // Log data being stored
    dbLogger.logCreate('CANDIDATE', candidateData);

    const candidate = await prisma.candidate.create({
      data: candidateData,
    });

    console.log(`✅ Candidate created successfully with ID: ${candidate.id}\n`);

    if (createdByUserId) {
      const entityName =
        `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email || 'Candidate';
      await activityService.logCandidateCreated({
        entityId: candidate.id,
        performedById: createdByUserId,
        entityName,
      });
    }

    const entityName =
      `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email || 'Candidate';
    queueAiEntryRecommendation({
      entityType: 'CANDIDATE',
      entityId: candidate.id,
      entityLabel: entityName,
      snapshot: buildEntitySnapshot('CANDIDATE', candidate),
      recipientUserId: candidate.assignedToId || createdByUserId,
      actorUserId: createdByUserId,
      trigger: 'create',
    });

    return candidate;
  },

  async update(id, data, performedByUserId = null) {
    // Whitelist of fields that exist on the Candidate Prisma model. Anything not
    // in this list (e.g. legacy `tags`, `dateOfBirth`, `workAuthorization`,
    // `state`, `zipCode`, `github`, `gender`, `willingToRelocate`,
    // `remoteWorkPreference`) is intentionally ignored — including those keys
    // even with `undefined` values can cause Prisma "Unknown argument" errors,
    // and silently mapping them would also corrupt valid saves.
    const ALLOWED_FIELDS = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'linkedIn',
      'resume',
      'resumeUrl',
      'skills',
      'recruiterSkills',
      'currentTitle',
      'currentCompany',
      'designation',
      'location',
      'address',
      'addressLine',
      'city',
      'country',
      'status',
      'recruiterStatus',
      'source',
      'assignedToId',
      'rating',
      'availability',
      'noticePeriod',
      'hotlist',
      'avatar',
      'education',
      'recruiterEducation',
      'certifications',
      'certificationsList',
      'languages',
      'recruiterLanguages',
      'portfolio',
      'website',
      'notes',
      'recruiterNotes',
      'cvSummary',
      'cvEducationEntries',
      'cvWorkExperienceEntries',
      'cvPortfolioLinks',
      'preferredLocation',
      'assignedJobs',
      'stage',
      'salary',
      'extraData',
    ];
    const INTEGER_FIELDS = new Set([
      'experience',
      'experienceYears',
      'expectedSalary',
      'currentSalary',
    ]);

    const updateData = {};
    for (const key of ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data || {}, key)) {
        updateData[key] = data[key];
      }
    }

    for (const key of INTEGER_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(data || {}, key)) continue;
      const raw = data[key];
      if (raw === null || raw === '' || raw === undefined) {
        updateData[key] = null;
        continue;
      }
      const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
      updateData[key] = Number.isFinite(parsed) ? parsed : null;
    }

    if (Object.prototype.hasOwnProperty.call(data || {}, 'lastActivity')) {
      updateData.lastActivity = data.lastActivity ? new Date(data.lastActivity) : null;
    }

    if (Object.prototype.hasOwnProperty.call(data || {}, 'assignedJobs')) {
      const existingRow = await prisma.candidate.findUnique({
        where: { id },
        select: { assignedJobs: true, stage: true },
      });
      if (existingRow) {
        const prevIds = new Set(
          (Array.isArray(existingRow.assignedJobs) ? existingRow.assignedJobs : []).map((jid) =>
            String(jid || '').trim(),
          ),
        );
        const nextIds = (Array.isArray(data.assignedJobs) ? data.assignedJobs : [])
          .map((jid) => String(jid || '').trim())
          .filter(Boolean);
        const addedJob = nextIds.some((jid) => !prevIds.has(jid));
        if (addedJob && !Object.prototype.hasOwnProperty.call(updateData, 'stage')) {
          updateData.stage = stageWhenLinkingToJob(existingRow.stage);
          if (!Object.prototype.hasOwnProperty.call(updateData, 'status')) {
            updateData.status = 'ACTIVE';
          }
        }
      }
    }

    if (updateData.extraData) {
      const existingExtraRow = await prisma.candidate.findUnique({
        where: { id },
        select: { extraData: true },
      });
      const existingExtra =
        existingExtraRow?.extraData &&
        typeof existingExtraRow.extraData === 'object' &&
        !Array.isArray(existingExtraRow.extraData)
          ? existingExtraRow.extraData
          : {};
      updateData.extraData = mergeCandidateRecruiterExtraData(existingExtra, updateData.extraData);
    }

    dbLogger.logUpdate('CANDIDATE', id, updateData);

    const beforeUpdate = await prisma.candidate.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        stage: true,
        assignedToId: true,
        createdById: true,
        participantIds: true,
        notes: true,
        currentTitle: true,
        currentCompany: true,
      },
    });

    // The candidate may live in the main tenant DB (recruiter-created) OR in
    // the per-tenant job-portal DB (self-registered via the public portal).
    // We update wherever the row actually exists so saves never fail with
    // "Record to update not found" on hybrid candidates.
    stampVisibilityOnAssigneeChange({
      updateData,
      previous: beforeUpdate,
      performerId: performedByUserId,
    });

    const writeOnClient = async (client) => {
      try {
        return await client.candidate.update({
          where: { id },
          data: updateData,
        });
      } catch (error) {
        if (error?.code === 'P2025') return null;
        throw error;
      }
    };

    let updated = await writeOnClient(prisma);

    if (!updated && isTenantScopedRequest()) {
      let portalPrisma = null;
      try { portalPrisma = getJobPortalPrismaClient(); } catch { portalPrisma = null; }
      if (portalPrisma) {
        updated = await writeOnClient(portalPrisma);
      }
    }

    if (!updated) {
      const err = new Error('Candidate not found');
      err.code = 'P2025';
      throw err;
    }

    console.log(`✅ Candidate updated successfully (ID: ${id})\n`);

    if (performedByUserId && beforeUpdate && Object.keys(updateData).length) {
      await activityService.logCandidateFieldChanges({
        entityId: id,
        performedById: performedByUserId,
        oldData: beforeUpdate,
        newData: { ...beforeUpdate, ...updateData },
        trackedFields: Object.keys(updateData),
      });
    }

    return updated;
  },

  async delete(id, performedById = null) {
    // Soft delete — keeps related rows (interviews, placements, pipeline entries, applications)
    // intact so the Recycle Bin restore brings the full candidate back.
    //
    // The Candidates page merges tenant + job-portal candidates. A row that only lives in the
    // portal DB has no tenant document to flip `isDeleted` on, so we must materialize it into
    // the tenant first; otherwise the soft-delete silently no-ops, the row keeps re-appearing
    // from the portal merge, and the Recycle Bin stays empty.
    const tenantRow = await prisma.candidate.findUnique({
      where: { id },
      select: { id: true, isDeleted: true, deletedAt: true },
    });

    if (tenantRow?.isDeleted === true) {
      if (tenantRow.deletedAt) {
        // Already in the Recycle Bin — make this idempotent so the UI still sees success.
        return { message: 'Candidate already in Recycle Bin' };
      }
      // Tombstone left behind by a previous purge — re-stamp delete metadata so it shows
      // up in the Recycle Bin again instead of staying invisibly tombstoned forever.
      const tombstoneRow = await prisma.candidate.findUnique({
        where: { id },
        select: { email: true, extraData: true },
      });
      const tombstoneExtra =
        tombstoneRow?.extraData &&
        typeof tombstoneRow.extraData === 'object' &&
        !Array.isArray(tombstoneRow.extraData)
          ? tombstoneRow.extraData
          : {};
      await prisma.candidate.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy: performedById || null,
          email: null,
          extraData: {
            ...tombstoneExtra,
            ...(tombstoneRow?.email
              ? { preRecycleBinEmail: String(tombstoneRow.email).trim() }
              : {}),
          },
        },
      });
      return { message: 'Candidate moved to Recycle Bin' };
    }

    if (!tenantRow) {
      // Portal-only candidate — bring it into the tenant DB so the tombstone is persisted.
      if (!isTenantScopedRequest()) {
        throw new Error('Candidate not found');
      }
      let portalPrisma = null;
      try {
        portalPrisma = getJobPortalPrismaClient();
      } catch {
        portalPrisma = null;
      }
      const portalRow = portalPrisma
        ? await portalPrisma.candidate.findUnique({ where: { id } })
        : null;
      if (!portalRow) {
        throw new Error('Candidate not found');
      }
      await materializePortalCandidateIntoTenant(portalRow);
    }

    const rowBeforeDelete = await prisma.candidate.findUnique({
      where: { id },
      select: { email: true, extraData: true },
    });

    const priorExtra =
      rowBeforeDelete?.extraData &&
      typeof rowBeforeDelete.extraData === 'object' &&
      !Array.isArray(rowBeforeDelete.extraData)
        ? rowBeforeDelete.extraData
        : {};

    const deletedRow = await prisma.candidate.findUnique({
      where: { id },
      select: { firstName: true, lastName: true, email: true },
    });

    await prisma.candidate.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: performedById || null,
        // Free the email for bulk CV re-import after the user clears the Candidates page.
        email: null,
        extraData: {
          ...priorExtra,
          ...(rowBeforeDelete?.email
            ? { preRecycleBinEmail: String(rowBeforeDelete.email).trim() }
            : {}),
        },
      },
    });

    if (performedById && deletedRow) {
      const entityName =
        `${deletedRow.firstName || ''} ${deletedRow.lastName || ''}`.trim() ||
        rowBeforeDelete?.email ||
        'Candidate';
      await activityService.logCandidateActivity({
        entityId: id,
        performedById,
        action: 'Candidate moved to Recycle Bin',
        description: `"${entityName}" was soft-deleted.`,
      });
    }

    return { message: 'Candidate moved to Recycle Bin' };
  },

  /**
   * Recycle Bin — list soft-deleted candidates (newest first). Scope:
   * - admins / view_all_candidates: all deleted
   * - everyone else: deleted candidates they created, are assigned to, or deleted themselves
   *
   * Purged candidates keep `isDeleted=true` as a tombstone (so the portal merge never
   * resurrects them on the Candidates page) but clear `deletedAt`, so we exclude rows
   * with `deletedAt: null` to keep the Recycle Bin showing only currently-restorable
   * candidates.
   */
  async listTrash(req) {
    const page = Math.max(Number.parseInt(String(req.query?.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query?.limit ?? '50'), 10) || 50, 1),
      500
    );
    const skip = (page - 1) * limit;

    const andParts = [{ isDeleted: true, deletedAt: { not: null } }];
    const canViewAll =
      canViewAllAssignments(req) || hasAnyPermissionScope(req, ['view_all_candidates']);
    if (!canViewAll && req?.user?.id) {
      const org = await getRequestOrgScope(req);
      if (!isOrgHeadPurpose(org)) {
        andParts.push({
          OR: [
            ...buildAssigneeVisibilityOr(req.user.id),
            { deletedBy: req.user.id },
          ],
        });
      }
    }
    const orgScope = await applyOrgCompanyAssigneeWhere(req, {
      assignedToIdField: 'assignedToId',
      createdByField: 'createdById',
    });
    if (orgScope) andParts.push(orgScope);
    const where = { AND: andParts };

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: candidateListInclude,
      }),
      prisma.candidate.count({ where }),
    ]);
    const withAudit = await prepareListWithAuditMeta(candidates, ENTITY_TYPES.CANDIDATE);
    return formatPaginationResponse(withAudit, page, limit, total);
  },

  /** Recycle Bin — restore a soft-deleted candidate. */
  async restore(id /*, performedById */) {
    const candidate = await prisma.candidate.findFirst({
      where: { id, isDeleted: true },
      select: { id: true },
    });
    if (!candidate) {
      throw new Error('Deleted candidate not found');
    }
    const trashRow = await prisma.candidate.findUnique({
      where: { id },
      select: { email: true, extraData: true },
    });
    const trashExtra =
      trashRow?.extraData &&
      typeof trashRow.extraData === 'object' &&
      !Array.isArray(trashRow.extraData)
        ? trashRow.extraData
        : {};
    const restoredEmail =
      String(trashRow?.email || '').trim() ||
      String(trashExtra.preRecycleBinEmail || '').trim() ||
      null;

    await prisma.candidate.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        ...(restoredEmail ? { email: restoredEmail } : {}),
        extraData: (() => {
          const { preRecycleBinEmail: _removed, ...rest } = trashExtra;
          return Object.keys(rest).length ? rest : undefined;
        })(),
      },
    });
    return { message: 'Candidate restored' };
  },

  /**
   * Recycle Bin — permanently delete a soft-deleted candidate.
   * Removes the tenant row, deletes S3 resume/assets, and records PurgedCandidateRef
   * so portal merge and bulk CV duplicate checks ignore this id.
   */
  /**
   * Bulk permanent-delete (Recycle Bin → Delete forever). Iterates over the supplied
   * ids and delegates to `purge` so PII wipe + tombstone logic stays consistent. We
   * intentionally process sequentially: each purge runs its own Prisma transaction
   * and Mongo doesn't love a flurry of overlapping transactions in the same tenant
   * DB. Returns per-id success/failure so the UI can show "deleted X of Y".
   */
  async bulkPurge(ids) {
    const unique = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)));
    if (!unique.length) {
      return { success: 0, failed: 0, failures: [] };
    }
    let success = 0;
    const failures = [];
    for (const candidateId of unique) {
      try {
        await this.purge(candidateId);
        success += 1;
      } catch (err) {
        failures.push({ id: candidateId, message: err?.message || 'Failed to purge candidate' });
      }
    }
    return { success, failed: failures.length, failures };
  },

  async purge(id) {
    const candidate = await prisma.candidate.findFirst({
      where: { id, isDeleted: true },
      select: { id: true },
    });
    if (!candidate) {
      throw new Error('Deleted candidate not found');
    }

    await permanentDeleteCandidateById(id);
    return { message: 'Candidate permanently deleted' };
  },

  async addNote(candidateId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const text = String(data?.text || '').trim();
    const tags = Array.isArray(data?.tags) ? data.tags.filter(Boolean) : [];

    if (!text) {
      throw new Error('Note text is required');
    }

    const activity = await prisma.activity.create({
      data: {
        action: 'Internal note added',
        description: text,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: candidateId,
        category: 'Notes',
        relatedType: 'candidate',
        relatedId: candidateId,
        relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
        metadata: {
          kind: NOTE_ACTIVITY_KIND,
          text,
          tags,
          isPinned: false,
        },
      },
      include: {
        performedBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return mapActivityToNote(activity);
  },

  async updateNote(candidateId, noteId, data) {
    await getCandidateOrThrow(candidateId);

    const note = await prisma.activity.findUnique({
      where: { id: noteId },
    });

    if (!note || note.entityId !== candidateId || getActivityMetadata(note).kind !== NOTE_ACTIVITY_KIND) {
      throw new Error('Candidate note not found');
    }

    const text = String(data?.text || '').trim();
    if (!text) {
      throw new Error('Note text is required');
    }

    const existingMetadata = getActivityMetadata(note);
    const updated = await prisma.activity.update({
      where: { id: noteId },
      data: {
        description: text,
        metadata: {
          ...existingMetadata,
          text,
          tags: Array.isArray(data?.tags) ? data.tags.filter(Boolean) : existingMetadata.tags || [],
        },
      },
      include: {
        performedBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return mapActivityToNote(updated);
  },

  async deleteNote(candidateId, noteId) {
    await getCandidateOrThrow(candidateId);

    const note = await prisma.activity.findUnique({
      where: { id: noteId },
    });

    if (!note || note.entityId !== candidateId || getActivityMetadata(note).kind !== NOTE_ACTIVITY_KIND) {
      throw new Error('Candidate note not found');
    }

    await prisma.activity.delete({ where: { id: noteId } });
    return { message: 'Candidate note deleted successfully' };
  },

  async pinNote(candidateId, noteId, isPinned) {
    await getCandidateOrThrow(candidateId);

    const note = await prisma.activity.findUnique({
      where: { id: noteId },
    });

    if (!note || note.entityId !== candidateId || getActivityMetadata(note).kind !== NOTE_ACTIVITY_KIND) {
      throw new Error('Candidate note not found');
    }

    const existingMetadata = getActivityMetadata(note);
    const updated = await prisma.activity.update({
      where: { id: noteId },
      data: {
        metadata: {
          ...existingMetadata,
          isPinned: Boolean(isPinned),
        },
      },
      include: {
        performedBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return mapActivityToNote(updated);
  },

  async addTag(candidateId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const tag = buildTagRecord(data?.tag || data);

    if (!tag) {
      throw new Error('Tag label is required');
    }

    await prisma.activity.create({
      data: {
        action: 'Candidate tag added',
        description: `Tag "${tag.label}" added to candidate.`,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: candidateId,
        category: 'Candidates',
        relatedType: 'candidate',
        relatedId: candidateId,
        relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
        metadata: {
          kind: TAG_ACTIVITY_KIND,
          operation: 'add',
          tag,
        },
      },
    });

    return tag;
  },

  async removeTag(candidateId, tagId, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const activities = await getCandidateActivities(candidateId);
    const tags = extractCustomTags(activities);
    const matchedTag = tags.find(
      (tag) => tag.id === tagId || normalizeTagId(tag.label) === tagId || tag.label.toLowerCase() === String(tagId).toLowerCase()
    );

    if (!matchedTag) {
      throw new Error('Candidate tag not found');
    }

    await prisma.activity.create({
      data: {
        action: 'Candidate tag removed',
        description: `Tag "${matchedTag.label}" removed from candidate.`,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: candidateId,
        category: 'Candidates',
        relatedType: 'candidate',
        relatedId: candidateId,
        relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
        metadata: {
          kind: TAG_ACTIVITY_KIND,
          operation: 'remove',
          tag: matchedTag,
        },
      },
    });

    return { message: 'Candidate tag removed successfully' };
  },

  async addToPipeline(candidateId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const jobId = String(data?.jobId || '').trim();
    const rawStageName = String(data?.stage || '').trim();

    if (!jobId) {
      throw new Error('Job is required');
    }

    if (!rawStageName) {
      throw new Error('Pipeline stage is required');
    }

    const normalizedStage = rawStageName.toLowerCase();
    // Keep UI tags consistent across modules:
    // - offer/offered -> Offer
    // - joined/hired -> Hired
    const stageName =
      normalizedStage === 'offer' || normalizedStage === 'offered'
        ? 'Offer'
        : normalizedStage === 'joined' || normalizedStage === 'hired'
          ? 'Hired'
          : rawStageName;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        client: {
          select: { companyName: true },
        },
        pipelineStages: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    const existingStage = job.pipelineStages.find(
      (stage) => stage.name.toLowerCase() === stageName.toLowerCase()
    );

    const updatedAssignedJobs = Array.from(new Set([...(candidate.assignedJobs || []), jobId]));

    const pipelineNotes = String(data?.notes || '').trim() || null;

    const hadPipelineEntry = await prisma.pipelineEntry.findFirst({
      where: { candidateId, jobId },
      select: { id: true },
    });

    const activityPayload = {
      action: hadPipelineEntry ? 'Pipeline entry updated' : 'Candidate added to pipeline',
      description: hadPipelineEntry
        ? `${candidate.firstName} ${candidate.lastName}`.trim()
          ? `${candidate.firstName} ${candidate.lastName} moved to ${stageName} on ${job.title}.`
          : `Candidate moved to ${stageName} on ${job.title}.`
        : `${candidate.firstName} ${candidate.lastName}`.trim()
        ? `${candidate.firstName} ${candidate.lastName} added to ${job.title} at ${stageName} stage.`
        : `Candidate added to ${job.title} at ${stageName} stage.`,
      performedById: userId,
      entityType: CANDIDATE_ACTIVITY_ENTITY,
      entityId: candidateId,
      category: 'Candidates',
      relatedType: 'job',
      relatedId: job.id,
      relatedLabel: job.title,
      metadata: {
        kind: PIPELINE_ACTIVITY_KIND,
        jobId: job.id,
        relatedJobTitle: job.title,
        recruiterId: data?.recruiterId || null,
        priority: data?.priority || 'Medium',
        stage: stageName,
        notes: pipelineNotes,
      },
    };

    let targetStage = existingStage;

    if (!targetStage) {
      const nextOrder =
        job.pipelineStages.length > 0
          ? Math.max(...job.pipelineStages.map((stage) => stage.order || 0)) + 1
          : 1;

      targetStage = await prisma.pipelineStage.create({
        data: {
          jobId,
          name: stageName,
          order: nextOrder,
          color: '#2563eb',
        },
      });
    }

    await prisma.pipelineEntry.deleteMany({
      where: {
        candidateId,
        jobId,
      },
    });

    await prisma.pipelineEntry.create({
      data: {
        candidateId,
        jobId,
        stageId: targetStage.id,
        movedById: userId,
        notes: pipelineNotes,
      },
    });

    const existingMatch = await prisma.match.findFirst({
      where: {
        candidateId,
        jobId,
      },
    });

    if (existingMatch) {
      await prisma.match.update({
        where: { id: existingMatch.id },
        data: {
          status: mapStageToMatchStatus(stageName),
          notes: pipelineNotes || existingMatch.notes || null,
        },
      });
    } else {
      await prisma.match.create({
        data: {
          candidateId,
          jobId,
          createdById: userId,
          score: 75,
          status: mapStageToMatchStatus(stageName),
          notes: pipelineNotes,
        },
      });
    }

    const priorStage = String(candidate.stage || '').trim().toLowerCase();
    const crmStage =
      stageName ||
      ((!priorStage || priorStage === 'new') && updatedAssignedJobs.length
        ? 'Applied'
        : stageWhenLinkingToJob(candidate.stage));

    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        stage: crmStage,
        assignedToId: data?.recruiterId || candidate.assignedToId || undefined,
        assignedJobs: updatedAssignedJobs,
        lastActivity: new Date(),
        status: 'ACTIVE',
      },
    });

    await prisma.activity.create({
      data: activityPayload,
    });

    // Bucket the (possibly custom) stage name into a canonical PIPELINE_STAGES value
    // and mirror to the job-portal Application + ApplicationTimeline. Without this the
    // candidate keeps showing the previous tag (e.g. "Interviewing") in other tabs and
    // /applications even though the recruiter moved them to "Offer" in the custom
    // per-job pipeline.
    try {
      await updateCandidateStage({
        candidateId,
        jobId,
        stage: mapStageNameToPipelineBucket(stageName),
        performedById: userId,
        skipStageActivity: true,
        metadata: {
          customStageName: stageName,
          pipelineNotes,
        },
      });
    } catch (stageError) {
      console.warn(
        '[candidate.addToPipeline] candidate stage sync failed:',
        stageError?.message || stageError,
      );
    }

    if (
      stageName.toLowerCase() === 'hired' &&
      candidate.email
    ) {
      try {
        await sendCandidateHiredEmail({
          toEmail: candidate.email,
          candidateName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
          jobTitle: job.title,
          companyName: job.client?.companyName || null,
          senderUserId: userId,
        });
      } catch (emailErr) {
        console.warn('[candidate.addToPipeline] hired email failed:', emailErr?.message || emailErr);
      }
    }

    return this.getById(candidateId);
  },

  async removeFromPipeline(candidateId, jobId, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const normalizedJobId = String(jobId || '').trim();
    if (!normalizedJobId) {
      throw new Error('Job is required');
    }

    const job = await prisma.job.findUnique({
      where: { id: normalizedJobId },
      select: { id: true, title: true },
    });
    if (!job) {
      throw new Error('Job not found');
    }

    const deleted = await prisma.pipelineEntry.deleteMany({
      where: { candidateId, jobId: normalizedJobId },
    });

    if (!deleted.count) {
      throw new Error('Pipeline entry not found for this job');
    }

    await detachCandidateFromJobLink(candidateId, normalizedJobId);

    await prisma.activity.create({
      data: {
        action: 'Removed from pipeline',
        description: `${candidate.firstName} ${candidate.lastName}`.trim()
          ? `${candidate.firstName} ${candidate.lastName} removed from ${job.title} pipeline.`
          : `Candidate removed from ${job.title} pipeline.`,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: candidateId,
        category: 'Candidates',
        relatedType: 'job',
        relatedId: job.id,
        relatedLabel: job.title,
        metadata: {
          kind: PIPELINE_ACTIVITY_KIND,
          jobId: job.id,
          relatedJobTitle: job.title,
        },
      },
    });

    return this.getById(candidateId);
  },

  async rejectCandidate(candidateId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const reason = String(data?.reason || '').trim();
    const feedback = String(data?.feedback || '').trim();
    // Default to true so callers that don't pass the flag (older clients,
    // bulk operations) keep the existing "feedback visible to candidate"
    // behaviour. New rejection modals send this explicitly.
    const showFeedbackToCandidate =
      data?.showFeedbackToCandidate === undefined
        ? true
        : Boolean(data.showFeedbackToCandidate);

    if (!reason) {
      throw new Error('Reject reason is required');
    }

    const jobId = await resolveJobIdForStageSync(candidateId, data);

    await updateCandidateStage({
      candidateId,
      jobId,
      stage: PIPELINE_STAGES.REJECTED,
      reason,
      feedback,
      performedById: userId,
      skipStageActivity: true,
      showFeedbackToCandidate,
    });

    // Sweep ALL of the candidate's other in-progress portal applications and
    // flip them to REJECTED too. This is what the recruiter means when they
    // press "Reject" without picking a specific job (Candidates tab) — the
    // candidate is no longer in consideration on any open requisition. It also
    // remediates older applications whose `Application.status` enum is stale
    // because an earlier reject ran without `jobId`. The per-job reject above
    // already covered `jobId`; here we cover every other open one.
    try {
      const portal = getJobPortalPrismaClient();
      const otherOpen = await portal.application.findMany({
        where: {
          candidateId,
          status: { notIn: ['REJECTED', 'SELECTED'] },
          ...(jobId ? { NOT: { jobId } } : {}),
        },
        select: { id: true, jobId: true },
      });
      for (const app of otherOpen) {
        try {
          await updateCandidateStage({
            candidateId,
            jobId: app.jobId,
            stage: PIPELINE_STAGES.REJECTED,
            reason,
            feedback,
            performedById: userId,
            skipStageActivity: true,
            showFeedbackToCandidate,
          });
        } catch (perAppErr) {
          console.warn(
            '[candidate.rejectCandidate] secondary application reject failed:',
            { applicationId: app.id, jobId: app.jobId },
            perAppErr?.message || perAppErr
          );
        }
      }
    } catch (sweepErr) {
      console.warn(
        '[candidate.rejectCandidate] open-applications sweep failed:',
        sweepErr?.message || sweepErr
      );
    }

    await prisma.activity.create({
      data: {
        action: 'Candidate rejected',
        description: `${candidate.firstName} ${candidate.lastName}`.trim()
          ? `${candidate.firstName} ${candidate.lastName} was rejected due to ${reason.toLowerCase()}.`
          : `Candidate was rejected due to ${reason.toLowerCase()}.`,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: candidateId,
        category: 'Candidates',
        relatedType: 'candidate',
        relatedId: candidateId,
        relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
        metadata: {
          kind: REJECTION_ACTIVITY_KIND,
          reason,
          feedback,
          sendEmail: Boolean(data?.sendEmail),
          showFeedbackToCandidate,
        },
      },
    });

    if (feedback) {
      await prisma.activity.create({
        data: {
          action: 'Internal note added',
          description: feedback,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: candidateId,
          category: 'Notes',
          relatedType: 'candidate',
          relatedId: candidateId,
          relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
          metadata: {
            kind: NOTE_ACTIVITY_KIND,
            text: `${feedback}${data?.sendEmail ? '\n\nRejection email will be sent to the candidate.' : '\n\nRejection email was skipped.'}`,
            tags: ['Rejected', reason],
            isPinned: true,
          },
        },
      });
    }

    // CRM bell + portal bell notifications. Best-effort.
    try {
      const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`
        .trim() ||
        candidate.email ||
        'Candidate';
      if (userId) {
        const job = jobId
          ? await prisma.job.findUnique({ where: { id: jobId }, select: { title: true } })
          : null;
        await notifyCandidateRejectedInternal({
          userId,
          candidateId,
          candidateName,
          reason,
          jobTitle: job?.title || null,
          performedById: userId,
          candidateEmailSent: Boolean(data?.sendEmail) && Boolean(candidate.email),
        });
      }
      void pushPortalNotification(candidateId, {
        type: 'application',
        title: 'Application update',
        description: showFeedbackToCandidate
          ? `Your application was not selected. Reason: ${reason}${feedback ? `. Feedback: ${feedback}` : ''}`
          : 'Your application was not selected this time.',
        actionButton: 'View applications',
        actionPath: '/applications',
        metadata: {
          status: 'REJECTED',
          jobId: jobId || null,
          reason,
          showFeedbackToCandidate,
          feedback: showFeedbackToCandidate ? feedback : null,
        },
      });
    } catch (bellErr) {
      console.warn(
        '[candidate.rejectCandidate] notification failed (non-fatal):',
        bellErr?.message || bellErr
      );
    }

    if (Boolean(data?.sendEmail) && candidate.email) {
      try {
        const job = jobId
          ? await prisma.job.findUnique({
              where: { id: jobId },
              select: { title: true },
            })
          : null;
        await sendCandidateRejectedEmail({
          toEmail: candidate.email,
          candidateName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
          jobTitle: job?.title || null,
          reason,
          feedback: showFeedbackToCandidate ? feedback : '',
          senderUserId: userId,
        });
      } catch (emailErr) {
        console.warn('[candidate.rejectCandidate] rejection email failed:', emailErr?.message || emailErr);
      }
    }

    return this.getById(candidateId);
  },

  async scheduleInterview(candidateId, data, userId) {
    const jobId = String(data?.jobId || '').trim();
    const candidate = await getCandidateOrThrow(candidateId, { jobId: jobId || undefined });
    const resolvedJobId = String(jobId || candidate.assignedJobs?.[0] || '').trim();

    if (!resolvedJobId) {
      throw new Error('Linked job is required to schedule an interview');
    }

    const job = await prisma.job.findUnique({
      where: { id: resolvedJobId },
      select: {
        id: true,
        title: true,
        clientId: true,
      },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    const clientId = resolveInterviewClientIdForJob(job, data);
    const interviewers = resolveScheduleInterviewers(data, userId);
    const panelMembers = await prisma.user.findMany({
      where: { id: { in: interviewers.map((item) => item.id).filter(Boolean) } },
      select: { id: true, name: true, email: true },
    });

    const leadInterviewer =
      interviewers.find((item) => item.role === 'Lead Interviewer') || interviewers[0];
    const scheduledAt = buildScheduledAt(data?.date, data?.time, data?.timezone);
    const notes = String(data?.notes || '').trim();
    let generatedMeetingLink = data?.mode === 'video' ? String(data?.meetingLink || '').trim() || null : null;
    const resolvedPlatform = mapMeetingPlatform(data?.platform, data?.mode);

    if (String(data?.mode || '').toLowerCase() === 'video' && resolvedPlatform && !generatedMeetingLink) {
      const generated = await generateCandidateMeetingLink({ candidate, job, data, interviewers, userId });
      if (!generated.meetingLink) {
        throw new Error(generated.error || 'Unable to generate meeting link');
      }
      generatedMeetingLink = generated.meetingLink;
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { companyName: true },
    });
    if (!client) {
      throw new Error('Client not found. Link a valid client to this job before scheduling.');
    }

    await assertNoInterviewerScheduleConflicts(prisma, {
      interviewerIds: interviewers.map((item) => item.id).filter(Boolean),
      scheduledAt,
      durationMinutes: parseDurationToMinutes(data?.duration),
    });

    const assignedJobs = Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs.map(String) : [];
    if (!assignedJobs.includes(resolvedJobId)) {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          assignedJobs: [...assignedJobs, resolvedJobId],
          lastActivity: new Date(),
        },
      });
    }

    const interview = await prisma.$transaction(async (tx) => {
      const createdInterview = await tx.interview.create({
        data: {
          candidateId,
          jobId: resolvedJobId,
          clientId,
          interviewerId: leadInterviewer?.id || null,
          createdById: userId,
          scheduledAt,
          duration: parseDurationToMinutes(data?.duration),
          type: mapInterviewType(data?.type, data?.mode),
          status: 'SCHEDULED',
          location: data?.mode === 'in-person' ? String(data?.location || '').trim() || null : null,
          meetingLink: generatedMeetingLink,
          notes: notes || null,
          // In our UI, "Interview Type" is the human-friendly label (HR Screening, Technical Round 1, etc.).
          // Persist that label in `round` so the Candidate drawer can display it cleanly.
          round: String(data?.type || data?.round || 1),
          mode: mapInterviewMode(data?.mode),
          platform: resolvedPlatform,
          timezone: resolveInterviewTimeZone(data?.timezone),
          instructions: data?.mode === 'phone' ? String(data?.phoneNumber || '').trim() || null : null,
          panelIds: interviewers.map((item) => item.id).filter(Boolean),
        },
        include: {
          interviewer: {
            select: { id: true, name: true, email: true, avatar: true, role: true, department: true },
          },
          job: {
            select: { id: true, title: true },
          },
        },
      });

      if (interviewers.length) {
        await tx.interviewPanel.createMany({
          data: interviewers.map((item) => ({
            interviewId: createdInterview.id,
            userId: item.id,
            // Candidate drawer uses roles like "Lead Interviewer/Interviewer/Observer".
            // Interview module expects PanelRole enum; default to TECHNICAL.
            role: 'TECHNICAL',
          })),
        });
      }

      await tx.activity.create({
        data: {
          action: 'Interview scheduled',
          description: `${data?.type || 'Interview'} on ${String(data?.date || '')} at ${String(data?.time || '')}`,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: candidateId,
          category: 'Interviews',
          relatedType: 'job',
          relatedId: job.id,
          relatedLabel: job.title,
          metadata: {
            kind: INTERVIEW_ACTIVITY_KIND,
            interviewId: createdInterview.id,
            relatedJobTitle: job.title,
            date: data?.date,
            time: data?.time,
            duration: data?.duration,
            mode: data?.mode,
            type: data?.type,
            round: data?.round,
            sendCandidateInvite: Boolean(data?.sendCandidateInvite),
            sendInterviewerInvite: Boolean(data?.sendInterviewerInvite),
          },
        },
      });

      return createdInterview;
    });

    if (Boolean(data?.sendCandidateInvite) && candidate.email) {
      await sendCandidateInterviewScheduledEmail({
        toEmail: candidate.email,
        candidateName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email,
        jobTitle: job.title,
        companyName: client?.companyName || 'Company',
        scheduledAt,
        timezone: resolveInterviewTimeZone(data?.timezone),
        interviewType: String(data?.type || '').trim() || null,
        roundLabel: String(data?.round || '').trim() || null,
        durationLabel: String(data?.duration || '').trim() || null,
        modeLabel:
          String(data?.mode || '').toLowerCase() === 'video'
            ? 'Video Call'
            : String(data?.mode || '').toLowerCase() === 'in-person'
              ? 'In Person'
              : String(data?.mode || '').toLowerCase() === 'phone'
                ? 'Phone Call'
                : 'Interview',
        platformLabel:
          resolvedPlatform === 'GOOGLE_MEET'
            ? 'Google Meet'
            : resolvedPlatform === 'ZOOM'
              ? 'Zoom'
              : null,
        meetingLink: generatedMeetingLink,
        location: data?.mode === 'in-person' ? String(data?.location || '').trim() || null : null,
        phoneNumber: data?.mode === 'phone' ? String(data?.phoneNumber || '').trim() || null : null,
        interviewerNames: interviewers.map((item) => item.name).filter(Boolean),
        notes: notes || null,
        senderUserId: userId,
      });
    }

    if (Boolean(data?.sendInterviewerInvite) && panelMembers.length) {
      const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email;
      for (const panelMember of panelMembers) {
        if (!panelMember.email) continue;
        await sendInterviewPanelScheduledEmail({
          toEmail: panelMember.email,
          recipientName: panelMember.name,
          candidateName,
          jobTitle: job.title,
          companyName: client?.companyName || 'Company',
          scheduledAt,
          timezone: resolveInterviewTimeZone(data?.timezone),
          interviewType: String(data?.type || '').trim() || null,
          roundLabel: String(data?.round || '').trim() || null,
          durationLabel: String(data?.duration || '').trim() || null,
          modeLabel:
            String(data?.mode || '').toLowerCase() === 'video'
              ? 'Video Call'
              : String(data?.mode || '').toLowerCase() === 'in-person'
                ? 'In Person'
                : String(data?.mode || '').toLowerCase() === 'phone'
                  ? 'Phone Call'
                  : 'Interview',
          platformLabel:
            resolvedPlatform === 'GOOGLE_MEET'
              ? 'Google Meet'
              : resolvedPlatform === 'ZOOM'
                ? 'Zoom'
                : null,
          meetingLink: generatedMeetingLink,
          location: data?.mode === 'in-person' ? String(data?.location || '').trim() || null : null,
          phoneNumber: data?.mode === 'phone' ? String(data?.phoneNumber || '').trim() || null : null,
          interviewerNames: panelMembers.map((item) => item.name).filter(Boolean),
          notes: notes || null,
          senderUserId: userId,
        });
      }
    }

    const locationLine =
      String(data?.mode || '').toLowerCase() === 'in-person' ? String(data?.location || '').trim() || null : null;

    // Names shown to the candidate on the job portal interview card.
    const interviewerNames = [
      ...interviewers.map((item) => item.name).filter(Boolean),
      ...panelMembers.map((item) => item.name).filter(Boolean),
    ];
    const dedupedInterviewerNames = Array.from(new Set(interviewerNames.map((n) => String(n).trim()).filter(Boolean)));
    const scheduler = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        }).catch(() => null)
      : null;
    const schedulerLabel = scheduler?.name || scheduler?.email || null;

    await updateCandidateStage({
      candidateId,
      jobId: resolvedJobId,
      stage: PIPELINE_STAGES.INTERVIEW,
      metadata: {
        scheduledAt: interview.scheduledAt,
        interviewTitle: String(data?.type || '').trim() || null,
        meetingLink: generatedMeetingLink,
        locationLine,
        mode: String(data?.mode || '').trim() || null,
        interviewerNames: dedupedInterviewerNames,
        recruiterName: schedulerLabel,
      },
      performedById: userId,
      skipStageActivity: true,
    });

    void notifyInterviewScheduleChange({
      event: 'scheduled',
      portalCandidateId: candidateId,
      candidateName:
        `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() ||
        candidate.email ||
        'Candidate',
      jobTitle: job.title,
      jobId: job.id,
      interviewId: interview.id,
      scheduledAt: interview.scheduledAt,
      mode: String(data?.mode || '').trim() || null,
      meetingLink: generatedMeetingLink,
      schedulerUserId: userId,
      panelUserIds: interviewers.map((item) => item.id).filter(Boolean),
    });

    const interviewCandidateName =
      `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email || 'Candidate';
    queueAiEntryRecommendation({
      entityType: 'INTERVIEW',
      entityId: interview.id,
      entityLabel: `${interviewCandidateName} — ${job.title}`,
      snapshot: buildEntitySnapshot('INTERVIEW', { ...interview, candidate, job, client }),
      recipientUserId: leadInterviewer?.id || userId,
      actorUserId: userId,
      trigger: 'create',
    });

    return interview;
  },

  async generateInterviewMeetingLink(candidateId, data, userId) {
    const jobId = String(data?.jobId || '').trim();
    const candidate = await getCandidateOrThrow(candidateId, { jobId: jobId || undefined });
    const resolvedJobId = String(jobId || candidate.assignedJobs?.[0] || '').trim();

    if (!resolvedJobId) {
      throw new Error('Linked job is required to generate a meeting link');
    }

    const job = await prisma.job.findUnique({
      where: { id: resolvedJobId },
      select: { id: true, title: true, clientId: true },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    const interviewers = Array.isArray(data?.interviewers) ? data.interviewers.filter(Boolean) : [];
    const result = await generateCandidateMeetingLink({ candidate, job, data, interviewers, userId });

    if (!result.meetingLink) {
      throw new Error(result.error || 'Unable to generate meeting link');
    }

    return {
      meetingLink: result.meetingLink,
      platform: result.platform,
    };
  },

  async updateInterview(candidateId, interviewId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId, {
      jobId: data?.jobId || undefined,
    });

    const existing = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: {
        id: true,
        candidateId: true,
        jobId: true,
        clientId: true,
        createdById: true,
        scheduledAt: true,
        duration: true,
        interviewerId: true,
        panelIds: true,
        status: true,
      },
    });

    if (!existing || existing.candidateId !== candidateId) {
      throw new Error('Interview not found for this candidate');
    }

    // Status mapping from UI
    const statusRaw = String(data?.status || '').toLowerCase();
    const nextStatus =
      statusRaw === 'completed'
        ? 'COMPLETED'
        : statusRaw === 'cancelled'
          ? 'CANCELLED'
          : statusRaw === 'scheduled'
            ? 'SCHEDULED'
            : undefined;

    const scheduledAt =
      data?.date && data?.time ? buildScheduledAt(data?.date, data?.time, data?.timezone) : undefined;

    const interviewers = Array.isArray(data?.interviewers) ? data.interviewers.filter(Boolean) : [];
    const leadInterviewer =
      interviewers.find((item) => item.role === 'Lead Interviewer') || interviewers[0];

    const nextPanelIds = interviewers.length
      ? interviewers.map((item) => item.id).filter(Boolean)
      : existing.panelIds?.length
        ? existing.panelIds
        : [existing.interviewerId].filter(Boolean);
    const nextScheduledAt = scheduledAt || existing.scheduledAt;
    const nextDuration = data?.duration
      ? parseDurationToMinutes(data.duration)
      : existing.duration || 60;

    // Skip conflict check when cancelling or completing.
    if (nextStatus !== 'CANCELLED' && nextStatus !== 'COMPLETED') {
      await assertNoInterviewerScheduleConflicts(prisma, {
        interviewerIds: nextPanelIds,
        scheduledAt: nextScheduledAt,
        durationMinutes: nextDuration,
        excludeInterviewId: interviewId,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedInterview = await tx.interview.update({
        where: { id: interviewId },
        data: {
          // If interview was created without createdById (legacy), backfill on first edit.
          createdById: existing.createdById ? undefined : userId,
          scheduledAt: scheduledAt || undefined,
          duration: data?.duration ? parseDurationToMinutes(data.duration) : undefined,
          // Keep UI label in round field for display consistency
          round: data?.type ? String(data.type) : undefined,
          type: data?.type || data?.mode ? mapInterviewType(data?.type, data?.mode) : undefined,
          mode: data?.mode ? mapInterviewMode(data?.mode) : undefined,
          platform: data?.platform || data?.mode ? mapMeetingPlatform(data?.platform, data?.mode) : undefined,
          location: data?.mode === 'in-person' ? String(data?.location || '').trim() || null : undefined,
          meetingLink: data?.mode === 'video' ? String(data?.meetingLink || '').trim() || null : undefined,
          instructions: data?.mode === 'phone' ? String(data?.phoneNumber || '').trim() || null : undefined,
          notes: typeof data?.notes === 'string' ? data.notes.trim() || null : undefined,
          timezone:
            data?.timezone !== undefined ? resolveInterviewTimeZone(data.timezone) : undefined,
          interviewerId: leadInterviewer?.id ? leadInterviewer.id : undefined,
          panelIds: interviewers.length ? interviewers.map((i) => i.id).filter(Boolean) : undefined,
          status: nextStatus || undefined,
        },
        include: {
          interviewer: {
            select: { id: true, name: true, email: true, avatar: true, role: true, department: true },
          },
          job: { select: { id: true, title: true } },
        },
      });

      if (interviewers.length) {
        await tx.interviewPanel.deleteMany({ where: { interviewId } });
        await tx.interviewPanel.createMany({
          data: interviewers.map((item) => ({
            interviewId,
            userId: item.id,
            role: 'TECHNICAL',
          })),
        });
      }

      await tx.activity.create({
        data: {
          action: 'Interview updated',
          description: `Interview updated (${nextStatus || 'SCHEDULED'})`,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: candidateId,
          category: 'Interviews',
          relatedType: 'job',
          relatedId: updatedInterview.jobId,
          relatedLabel: updatedInterview.job?.title || '',
          metadata: {
            kind: INTERVIEW_ACTIVITY_KIND,
            interviewId: updatedInterview.id,
            status: nextStatus,
            date: data?.date,
            time: data?.time,
            duration: data?.duration,
            mode: data?.mode,
            type: data?.type,
          },
        },
      });

      return updatedInterview;
    });

    if (scheduledAt) {
      void notifyInterviewScheduleChange({
        event: 'rescheduled',
        portalCandidateId: candidateId,
        candidateName:
          `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() ||
          candidate.email ||
          'Candidate',
        jobTitle: updated.job?.title || 'a role',
        jobId: updated.jobId,
        interviewId: updated.id,
        scheduledAt,
        mode: data?.mode ? String(data.mode) : null,
        meetingLink: data?.mode === 'video' ? String(data?.meetingLink || '').trim() || null : null,
        schedulerUserId: userId,
        panelUserIds: interviewers.map((item) => item.id).filter(Boolean),
      });
    }

    return updated;
  },

  async getStats(req = {}) {
    const loadCommonPool = await resolveLoadCommonPool(req.query || {});
    const mine =
      req.query?.mine === 'true' || req.query?.mine === '1' || req.query?.mine === true;
    const userId = req.user?.id;
    const myJobIds = mine && userId ? await getMyJobIds(userId) : [];
    const tenantJobIdSet = isTenantScopedRequest() ? await getTenantJobIdSet() : null;

    const emptyStats = {
      all: 0,
      applied: 0,
      longlist: 0,
      shortlist: 0,
      screening: 0,
      submitted: 0,
      interviewing: 0,
      offered: 0,
      hired: 0,
      rejected: 0,
    };

    if (mine && !userId) {
      return emptyStats;
    }

    const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    const mineScope = mine ? await buildMineCandidatesScope(userId) : null;
    const scopeWhere = mine ? mineScope : superAdminScope;

    const stages = [
      'Applied',
      'Longlist',
      'Shortlist',
      'Screening',
      'Submitted',
      'Interviewing',
      'Offered',
      'Hired',
      'Rejected',
    ];

    // Recycle Bin: don't count soft-deleted candidates in the stage stats.
    const scopedStatsWhere = {
      AND: [
        scopeWhere || {},
        { isDeleted: { not: true } },
        ...(loadCommonPool ? [] : [buildCrmCandidatesListScopeClause()]),
      ],
    };
    let scopedCandidates = await prisma.candidate.findMany({
      where: scopedStatsWhere,
      select: {
        id: true,
        stage: true,
        source: true,
        createdById: true,
        assignedToId: true,
        assignedJobs: true,
        applications: { select: { jobId: true }, take: 30 },
        pipelineEntries: { select: { jobId: true }, take: 30 },
        matches: { select: { jobId: true }, take: 30 },
      },
    });
    const tenantCandidateIds = new Set(scopedCandidates.map((candidate) => candidate.id));

    if (isTenantScopedRequest()) {
      const portalCandidates = await fetchPortalCandidatesForTenant(req, {
        status: undefined,
        assignedToId: undefined,
        search: undefined,
        mine,
        listFilters: { stage: '' },
      });
      // Same Recycle Bin guard as getAll(): drop portal entries whose tenant row is soft-deleted.
      const softDeletedTenantIds = await collectSoftDeletedTenantCandidateIds(
        portalCandidates.map((c) => c.id)
      );
      const byId = new Map(scopedCandidates.map((candidate) => [candidate.id, candidate]));
      for (const portalCandidate of portalCandidates) {
        if (softDeletedTenantIds.has(portalCandidate.id)) continue;
        const prior = byId.get(portalCandidate.id);
        const mergedRow = prior
          ? mergePortalAndTenantCandidateRow(portalCandidate, prior)
          : portalCandidate;
        byId.set(portalCandidate.id, mergedRow);
      }
      scopedCandidates = Array.from(byId.values());
    }

    if (loadCommonPool && isTenantScopedRequest()) {
      const commonCandidates = await fetchCandidateCommonForCandidatesList(req);
      const softDeletedTenantIds = commonCandidates.length
        ? await collectSoftDeletedTenantCandidateIds(commonCandidates.map((c) => c.id))
        : new Set();
      const byId = new Map(scopedCandidates.map((candidate) => [candidate.id, candidate]));
      for (const commonRow of commonCandidates) {
        const prior = byId.get(commonRow.id);
        byId.set(
          commonRow.id,
          prior ? mergePortalAndTenantCandidateRow(commonRow, prior) : commonRow
        );
      }
      scopedCandidates = Array.from(byId.values());
    }

    scopedCandidates = scopedCandidates
      .filter((original) =>
        shouldIncludeCandidateAfterTenantScope(
          original,
          scopeCandidateForActiveTenant(original, tenantJobIdSet),
          {
            includeCommonPool: loadCommonPool,
            inTenantDb: tenantCandidateIds.has(original.id),
          }
        )
      )
      .map((candidate) => scopeCandidateForActiveTenant(candidate, tenantJobIdSet))
      .filter((candidate) => shouldShowOnCrmCandidatesList(candidate, { includeCommonPool: loadCommonPool }))
      .filter((candidate) =>
        mine && userId ? candidateMatchesMineScope(candidate, userId, myJobIds) : true
      );

    const resolvedForStats = scopedCandidates.map((candidate) =>
      annotateCandidateListFlags(candidate, tenantJobIdSet)
    );

    const stageCounts = stages.map((stageName) => ({
      stage: stageName,
      count: resolvedForStats.filter((candidate) => String(candidate.stage || '') === stageName).length,
    }));

    const totalCount = resolvedForStats.length;

    // Build result object
    const result = {
      all: totalCount,
      applied: stageCounts.find((s) => s.stage === 'Applied')?.count || 0,
      longlist: stageCounts.find((s) => s.stage === 'Longlist')?.count || 0,
      shortlist: stageCounts.find((s) => s.stage === 'Shortlist')?.count || 0,
      screening: stageCounts.find((s) => s.stage === 'Screening')?.count || 0,
      submitted: stageCounts.find((s) => s.stage === 'Submitted')?.count || 0,
      interviewing: stageCounts.find((s) => s.stage === 'Interviewing')?.count || 0,
      offered: stageCounts.find((s) => s.stage === 'Offered')?.count || 0,
      hired: stageCounts.find((s) => s.stage === 'Hired')?.count || 0,
      rejected: stageCounts.find((s) => s.stage === 'Rejected')?.count || 0,
    };

    return result;
  },

  async bulkAction(action, candidateIds, payload, userId) {
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      throw new Error('Candidate IDs are required');
    }

    switch (action) {
      case 'assign_recruiter': {
        const recruiterIds = Array.isArray(payload?.recruiterIds)
          ? payload.recruiterIds.filter(Boolean)
          : payload?.recruiterId
            ? [payload.recruiterId]
            : [];

        if (!recruiterIds.length) {
          throw new Error('At least one recruiter is required');
        }

        const uniqueRecruiterIds = Array.from(new Set(recruiterIds.map(String)));
        const primaryRecruiterId = uniqueRecruiterIds[0];
        const recruiters = await prisma.user.findMany({
          where: { id: { in: uniqueRecruiterIds }, isActive: true },
          select: { id: true, name: true, email: true },
        });

        if (!recruiters.length) {
          throw new Error('Selected recruiters were not found');
        }

        const updated = await prisma.candidate.updateMany({
          where: { id: { in: candidateIds }, isDeleted: { not: true } },
          data: { assignedToId: primaryRecruiterId },
        });

        const assignedCandidates = await prisma.candidate.findMany({
          where: { id: { in: candidateIds }, isDeleted: { not: true } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            currentTitle: true,
            currentCompany: true,
            experience: true,
            location: true,
            stage: true,
            skills: true,
            assignedJobs: true,
          },
        });

        const assignedBy = userId
          ? await prisma.user.findUnique({
              where: { id: userId },
              select: { name: true },
            })
          : null;

        // Log activity for each candidate
        for (const candidateId of candidateIds) {
          const candidate = await prisma.candidate.findUnique({
            where: { id: candidateId },
            select: { firstName: true, lastName: true, email: true },
          });
          if (candidate) {
            await prisma.activity.create({
              data: {
                action: 'Bulk action: Assign recruiter',
                description: `Recruiter assigned via bulk action`,
                performedById: userId,
                entityType: CANDIDATE_ACTIVITY_ENTITY,
                entityId: candidateId,
                category: 'Assignment',
                relatedType: 'candidate',
                relatedId: candidateId,
                relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
                metadata: {
                  kind: 'candidate-bulk-action',
                  recruiterId: primaryRecruiterId,
                  recruiterIds: uniqueRecruiterIds,
                },
              },
            });
          }
        }

        await Promise.allSettled(
          recruiters
            .filter((recruiter) => recruiter.email)
            .map((recruiter) =>
              sendCandidateAssignmentEmail({
                toEmail: recruiter.email,
                assigneeName: recruiter.name,
                assignedByName: assignedBy?.name || null,
                senderUserId: userId,
                candidates: assignedCandidates.map((candidate) => ({
                  name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email || 'Candidate',
                  email: candidate.email,
                  phone: candidate.phone,
                  currentTitle: candidate.currentTitle,
                  currentCompany: candidate.currentCompany,
                  experience: candidate.experience,
                  location: candidate.location,
                  stage: candidate.stage,
                  skills: candidate.skills,
                  assignedJobs: candidate.assignedJobs,
                })),
              })
            )
        );

        await Promise.allSettled(
          uniqueRecruiterIds.map((recruiterId) =>
            createAlertNotification(recruiterId, 'candidate.assigned', {
              category: 'CANDIDATE',
              title: 'Candidate assigned to you',
              description: `${assignedCandidates.length} candidate(s) assigned to you${
                assignedBy?.name ? ` by ${assignedBy.name}` : ''
              }.`,
              actionLabel: 'View candidates',
              actionPath: '/candidate',
              entityType: 'CANDIDATE',
              metadata: { count: assignedCandidates.length },
            })
          )
        );

        return { updated: updated.count };
      }

      case 'add_tag': {
        if (!payload?.tag) {
          throw new Error('Tag is required');
        }
        // For each candidate, add tag via activity
        for (const candidateId of candidateIds) {
          const candidate = await prisma.candidate.findUnique({
            where: { id: candidateId },
            select: { firstName: true, lastName: true, email: true },
          });
          if (candidate) {
            await prisma.activity.create({
              data: {
                action: `Tag added: ${payload.tag}`,
                description: `Tag "${payload.tag}" added via bulk action`,
                performedById: userId,
                entityType: CANDIDATE_ACTIVITY_ENTITY,
                entityId: candidateId,
                category: 'Tagging',
                relatedType: 'candidate',
                relatedId: candidateId,
                relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
                metadata: { kind: TAG_ACTIVITY_KIND, tag: payload.tag },
              },
            });
          }
        }
        return { updated: candidateIds.length };
      }

      case 'reject': {
        const reason = payload?.reason || 'Bulk rejection';
        const updated = await prisma.candidate.updateMany({
          where: { id: { in: candidateIds }, isDeleted: { not: true } },
          data: { status: 'REJECTED' },
        });
        // Log rejection for each candidate
        for (const candidateId of candidateIds) {
          const candidate = await prisma.candidate.findUnique({
            where: { id: candidateId },
            select: { firstName: true, lastName: true, email: true },
          });
          if (candidate) {
            await prisma.activity.create({
              data: {
                action: 'Candidate rejected',
                description: reason,
                performedById: userId,
                entityType: CANDIDATE_ACTIVITY_ENTITY,
                entityId: candidateId,
                category: 'Rejection',
                relatedType: 'candidate',
                relatedId: candidateId,
                relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
                metadata: { kind: REJECTION_ACTIVITY_KIND, reason },
              },
            });
          }
        }
        return { updated: updated.count };
      }

      case 'export': {
        // Return candidates for export
        const candidates = await prisma.candidate.findMany({
          where: { id: { in: candidateIds }, isDeleted: { not: true } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            currentCompany: true,
            currentTitle: true,
            experience: true,
            location: true,
            status: true,
            source: true,
            createdAt: true,
          },
        });
        return { candidates };
      }

      default:
        throw new Error(`Unknown bulk action: ${action}`);
    }
  },
};
