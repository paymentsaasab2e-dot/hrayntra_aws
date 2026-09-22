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
  fetchCandidateCommonListIndex,
  fetchCandidateCommonByCandidateId,
  mapCandidateCommonRowToCandidate,
  applyProfileSnapshotFields,
} from '../../services/candidateCommon/candidateCommonPool.service.js';
import {
  PIPELINE_STAGES,
  mapStageNameToPipelineBucket,
  updateCandidateStage,
  mapPlacementStatusToCrmStageLabel,
  isSubmittedToClientStageLabel,
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
  mergeOrgCompanyListScope,
  resolveWriteOrgUnitId,
} from '../../services/orgListScope.service.js';
import {
  buildAssigneeVisibilityOr,
  buildInitialParticipantIds,
  stampVisibilityOnAssigneeChange,
} from '../../services/memberVisibility.service.js';
import { assertCanAssignCrm } from '../../services/crmAssignmentScope.service.js';
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
const TENANT_JOB_ID_CACHE_TTL_MS = 30_000;
const TENANT_JOB_ID_CACHE = new Map();

function tenantJobCacheKey(suffix = 'all') {
  let tenant = '';
  try {
    tenant = String(getActiveTenantDbName?.() || '');
  } catch {
    tenant = '';
  }
  return `${tenant}\u0001${suffix}`;
}

async function getTenantJobIdSet() {
  const key = tenantJobCacheKey('all');
  const hit = TENANT_JOB_ID_CACHE.get(key);
  if (hit && Date.now() - hit.at < TENANT_JOB_ID_CACHE_TTL_MS) {
    return new Set(hit.ids);
  }
  const jobs = await prisma.job.findMany({
    where: { isDeleted: { not: true } },
    select: { id: true },
  });
  const ids = jobs.map((job) => String(job.id));
  TENANT_JOB_ID_CACHE.set(key, { at: Date.now(), ids });
  return new Set(ids);
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
  if (isSubmittedToClientStageLabel(s)) return 42;
  if (s.includes('interview')) return 40;
  if (s.includes('screen') || s.includes('short') || s.includes('long')) return 30;
  if (s.includes('submit')) return 30;
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

function isLikelyObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || '').trim());
}

/** Prefer the primary assigned job — same idea as FE resolveSubmitJobIdFromBackend. */
function resolvePrimaryJobIdForList(candidate, tenantJobIdSet = null) {
  const scoped = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
  const assigned = (Array.isArray(scoped.assignedJobs) ? scoped.assignedJobs : [])
    .map((id) => String(id || '').trim())
    .find((id) => isLikelyObjectId(id));
  if (assigned) return assigned;

  const fromPipeline = (Array.isArray(scoped.pipelineEntries) ? scoped.pipelineEntries : [])
    .map((row) => String(row?.jobId || '').trim())
    .find((id) => isLikelyObjectId(id));
  if (fromPipeline) return fromPipeline;

  const fromApp = (Array.isArray(scoped.applications) ? scoped.applications : [])
    .map((row) => String(row?.jobId || row?.job?.id || '').trim())
    .find((id) => isLikelyObjectId(id));
  if (fromApp) return fromApp;

  const fromMatch = (Array.isArray(scoped.matches) ? scoped.matches : [])
    .map((row) => String(row?.jobId || row?.job?.id || '').trim())
    .find((id) => isLikelyObjectId(id));
  return fromMatch || '';
}

/** Pipeline stage for a specific job — same SoT as Job Details → Candidates. */
function resolvePipelineStageForJob(candidate, jobId, tenantJobIdSet = null) {
  const id = String(jobId || '').trim();
  if (!id) return '';
  const scoped = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
  const entry = (Array.isArray(scoped.pipelineEntries) ? scoped.pipelineEntries : []).find(
    (row) => String(row?.jobId || '').trim() === id,
  );
  return String(entry?.stage?.name || entry?.stageName || entry?.stage || '').trim();
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

/**
 * CRM list Stage column: prefer the assigned job's pipeline stage (Job Details SoT).
 * Placement status is only used when there is no pipeline entry for that job.
 */
function resolveCandidateStageForList(candidate, tenantJobIdSet = null) {
  const primaryJobId = resolvePrimaryJobIdForList(candidate, tenantJobIdSet);
  const jobPipelineStage = resolvePipelineStageForJob(candidate, primaryJobId, tenantJobIdSet);
  if (jobPipelineStage) {
    return jobPipelineStage;
  }

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

  const submittedStage = [explicitStage, tenantPipelineStage].find((stage) =>
    isSubmittedToClientStageLabel(stage),
  );
  if (submittedStage) {
    return submittedStage;
  }

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

function stageWhenLinkingToJob(_existingStage) {
  // New job assignment always starts at Applied (per-job pipeline may still
  // advance later). Do not carry Offer / Interviewing from a previous job.
  return 'Applied';
}

/**
 * When assignedJobs gains a new id, decide the CRM stage for that link.
 * If the client re-sent the previous stage (edit form always does), treat it as
 * stale and use Applied. An intentionally different stage is kept.
 */
function resolveStageForNewlyAssignedJob(existingStage, incomingStage) {
  const existing = String(existingStage || '').trim();
  const incoming = String(incomingStage || '').trim();
  if (!incoming) return 'Applied';
  if (!existing) return incoming.toLowerCase() === 'new' ? 'Applied' : incoming;
  if (incoming.toLowerCase() === existing.toLowerCase()) return 'Applied';
  if (incoming.toLowerCase() === 'new') return 'Applied';
  return incoming;
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

function buildCandidateNameNormalized(firstName, lastName) {
  return [firstName, lastName]
    .map((part) => String(part || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 2–3 char n-grams per name token — enables mid-string match via multikey index (e.g. "man" → Himanshu). */
function buildCandidateNameSearchGrams(nameNormalized) {
  const normalized = String(nameNormalized || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];
  const grams = new Set();
  for (const token of normalized.split(' ')) {
    if (!token) continue;
    for (const n of [2, 3]) {
      if (token.length < n) continue;
      for (let i = 0; i <= token.length - n; i += 1) {
        grams.add(token.slice(i, i + n));
      }
    }
  }
  return Array.from(grams);
}

function buildCandidateNameSearchFields(firstName, lastName) {
  const nameNormalized = buildCandidateNameNormalized(firstName, lastName) || null;
  return {
    nameNormalized,
    nameSearchGrams: nameNormalized ? buildCandidateNameSearchGrams(nameNormalized) : [],
  };
}

/** Grams derived from a search term for indexed mid-string lookup. */
function buildQueryNameSearchGrams(normalizedTerm) {
  const token = String(normalizedTerm || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
  if (token.length < 2) return [];
  if (token.length <= 3) return [token];
  const grams = [];
  for (let i = 0; i <= token.length - 3; i += 1) {
    grams.push(token.slice(i, i + 3));
  }
  // Keep AND selective: ends + middle cover the string without huge conjunctions.
  if (grams.length <= 5) return grams;
  return [grams[0], grams[Math.floor(grams.length / 2)], grams[grams.length - 1]];
}

/**
 * Classify free-text search so we never run a giant multi-field regex OR.
 * @returns {{ kind: 'empty'|'id'|'email'|'phone'|'name'|'general', term: string, normalized: string }}
 */
function classifyCandidateSearch(search) {
  const term = String(search || '').trim();
  if (!term) return { kind: 'empty', term: '', normalized: '' };
  const normalized = term.toLowerCase().replace(/\s+/g, ' ').trim();

  if (/^[a-fA-F0-9]{24}$/.test(term)) {
    return { kind: 'id', term, normalized };
  }
  if (term.includes('@') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term)) {
    return { kind: 'email', term, normalized: normalized.toLowerCase() };
  }
  const digitsOnly = term.replace(/\D/g, '');
  const nonDigitStripped = term.replace(/[\s()+.-]/g, '');
  if (digitsOnly.length >= 7 && digitsOnly.length === nonDigitStripped.replace(/\D/g, '').length) {
    return { kind: 'phone', term, normalized: digitsOnly };
  }
  // Letters / name-like (including multi-word). Short tokens stay "name".
  if (/^[\p{L}\p{M}\s.'.-]+$/u.test(term)) {
    return { kind: 'name', term, normalized };
  }
  return { kind: 'general', term, normalized };
}

function buildCandidateSearchWhereClause(search) {
  const classified = classifyCandidateSearch(search);
  if (classified.kind === 'empty') return null;

  const escaped = escapePrismaRegex(classified.term);
  const escapedNorm = escapePrismaRegex(classified.normalized);

  if (classified.kind === 'id') {
    return { id: classified.term };
  }

  if (classified.kind === 'email') {
    return {
      OR: [
        { email: { contains: escaped, mode: 'insensitive' } },
        { linkedIn: { contains: escaped, mode: 'insensitive' } },
      ],
    };
  }

  if (classified.kind === 'phone') {
    return {
      OR: [
        { phone: { contains: escaped, mode: 'insensitive' } },
        { phone: { contains: classified.normalized, mode: 'insensitive' } },
      ],
    };
  }

  if (classified.kind === 'name') {
    const tokens = classified.normalized.split(/\s+/).filter(Boolean);
    const queryGrams = buildQueryNameSearchGrams(classified.normalized);

    // Mid-string via n-gram multikey index (avoids leading-wildcard COLLSCAN when grams exist).
    // Prefix via startsWith for IXSCAN on nameNormalized / firstName when indexes exist.
    const nameOr = [
      { nameNormalized: { startsWith: escapedNorm, mode: 'insensitive' } },
      { firstName: { startsWith: escaped, mode: 'insensitive' } },
      { lastName: { startsWith: escaped, mode: 'insensitive' } },
    ];
    if (queryGrams.length === 1) {
      nameOr.push({ nameSearchGrams: { has: queryGrams[0] } });
    } else if (queryGrams.length > 1) {
      nameOr.push({
        AND: queryGrams.map((gram) => ({ nameSearchGrams: { has: gram } })),
      });
    }
    // Legacy rows without grams: bounded contains fallback (still auth-scoped + take K).
    nameOr.push(
      { nameNormalized: { contains: escapedNorm, mode: 'insensitive' } },
      { firstName: { contains: escaped, mode: 'insensitive' } },
      { lastName: { contains: escaped, mode: 'insensitive' } },
    );

    if (tokens.length > 1) {
      return {
        AND: tokens.map((token) => {
          const tokenGrams = buildQueryNameSearchGrams(token);
          const orParts = [
            { nameNormalized: { contains: escapePrismaRegex(token), mode: 'insensitive' } },
            { firstName: { contains: escapePrismaRegex(token), mode: 'insensitive' } },
            { lastName: { contains: escapePrismaRegex(token), mode: 'insensitive' } },
          ];
          if (tokenGrams.length === 1) {
            orParts.unshift({ nameSearchGrams: { has: tokenGrams[0] } });
          } else if (tokenGrams.length > 1) {
            orParts.unshift({
              AND: tokenGrams.map((gram) => ({ nameSearchGrams: { has: gram } })),
            });
          }
          return { OR: orParts };
        }),
      };
    }
    return { OR: nameOr };
  }

  // General (mixed symbols): identity + role fields only — never cvSummary/notes in list search.
  return {
    OR: [
      { nameNormalized: { contains: escapedNorm, mode: 'insensitive' } },
      { firstName: { contains: escaped, mode: 'insensitive' } },
      { lastName: { contains: escaped, mode: 'insensitive' } },
      { email: { contains: escaped, mode: 'insensitive' } },
      { phone: { contains: escaped, mode: 'insensitive' } },
      { currentTitle: { contains: escaped, mode: 'insensitive' } },
      { currentCompany: { contains: escaped, mode: 'insensitive' } },
      { designation: { contains: escaped, mode: 'insensitive' } },
      { skills: { hasSome: [classified.term] } },
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

  // Token AND (Google-like): "john bang" matches John in Bangalore.
  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return hay.includes(needle);
  return tokens.every((token) => hay.includes(token));
}

function annotateCandidateListFlags(candidate, tenantJobIdSet = null) {
  const phase1 = isPhase1CandidateRecord(candidate);
  const hasSnap = Boolean(
    candidate?.extraData?.phase1ProfileSnapshot &&
      typeof candidate.extraData.phase1ProfileSnapshot === 'object',
  );
  const hasJob = candidateHasRealJobLink(candidate, tenantJobIdSet);
  const discoveryOnly = (phase1 || hasSnap) && !hasJob;
  const placementStatus = resolveLatestPlacementStatusForList(candidate, tenantJobIdSet);
  const resolvedStage = resolveCandidateStageForList(candidate, tenantJobIdSet);
  const stageNew = ['new', ''].includes(String(resolvedStage || '').trim().toLowerCase());
  return {
    ...candidate,
    stage: resolvedStage,
    placementStatus,
    // Any Phase 1 source/snapshot must flag so the drawer uses Phase1DetailSections.
    isPhase1Candidate: phase1 || hasSnap || discoveryOnly,
    isNewCandidate: discoveryOnly || (phase1 && stageNew && !hasJob),
    isJobAppliedCandidate: hasJob && resolvedStage === 'Applied',
    poolOrigin: discoveryOnly ? 'phase1_common' : phase1 || hasSnap ? 'phase1' : 'tenant',
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
      client: {
        select: { id: true, companyName: true },
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
  const explicitAssigned = (Array.isArray(scoped.assignedJobs) ? scoped.assignedJobs : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  // Prefer explicit assignedJobs for titles so an old pipeline Job A does not
  // become assignedJobTitles[0] after reassignment to Job B.
  const jobIds = explicitAssigned.length
    ? explicitAssigned
    : collectCandidateLinkedJobIds(scoped);
  const jobsById = new Map();
  if (jobIds.length) {
    const jobs = await prisma.job.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, title: true },
    });
    for (const job of jobs) jobsById.set(job.id, job.title);
  }
  const titles = [];
  const seen = new Set();
  for (const jobId of jobIds) {
    let title = jobsById.get(jobId);
    if (!title) {
      const match = (Array.isArray(scoped?.matches) ? scoped.matches : []).find(
        (row) => String(row?.jobId || row?.job?.id || '').trim() === jobId,
      );
      title = match?.job?.title;
    }
    if (!title) {
      const application = (Array.isArray(scoped?.applications) ? scoped.applications : []).find(
        (row) => String(row?.jobId || '').trim() === jobId,
      );
      title = application?.job?.title;
    }
    const label = String(title || '').trim();
    if (label && !seen.has(label)) {
      seen.add(label);
      titles.push(label);
    }
  }
  return {
    ...candidate,
    assignedJobTitles: titles.length
      ? titles
      : resolveCandidateAssignedJobTitlesForList(scoped, jobsById),
  };
}

const candidateListInclude = {
  assignedTo: {
    select: { id: true, name: true, email: true },
  },
  createdBy: {
    select: USER_BRIEF_SELECT,
  },
  // List table only needs enough relation rows for stage / job chips — not full history.
  applications: {
    select: {
      id: true,
      jobId: true,
      status: true,
      job: { select: { id: true, title: true } },
    },
    take: 8,
  },
  pipelineEntries: {
    select: { id: true, jobId: true, stage: { select: { name: true } } },
    take: 8,
  },
  matches: {
    select: {
      id: true,
      jobId: true,
      score: true,
      status: true,
      createdById: true,
      job: {
        select: {
          id: true,
          title: true,
          client: { select: { companyName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  },
  interviews: {
    select: { id: true, jobId: true, status: true, scheduledAt: true },
    orderBy: { scheduledAt: 'desc' },
    take: 5,
  },
  placements: {
    select: { id: true, jobId: true, status: true, updatedAt: true, createdAt: true, deletedAt: true },
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  },
};

/** Faster list include — enough for table chips; avoid deep client joins on every filter. */
const candidateListIncludeFast = {
  assignedTo: {
    select: { id: true, name: true, email: true },
  },
  createdBy: {
    select: USER_BRIEF_SELECT,
  },
  applications: {
    select: { id: true, jobId: true, status: true, job: { select: { id: true, title: true } } },
    take: 5,
  },
  pipelineEntries: {
    select: { id: true, jobId: true, stage: { select: { name: true } } },
    take: 5,
  },
  matches: {
    select: {
      id: true,
      jobId: true,
      score: true,
      status: true,
      job: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  },
};

/** Lean index for merge/sort — never load extraData / CV JSON for the full tenant. */
const candidateListIndexSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  source: true,
  assignedJobs: true,
  createdById: true,
  assignedToId: true,
  updatedAt: true,
  createdAt: true,
  lastActivity: true,
};

function toLeanCandidateIndex(row) {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    firstName: row.firstName || null,
    lastName: row.lastName || null,
    email: row.email || null,
    source: row.source || null,
    assignedJobs: Array.isArray(row.assignedJobs) ? row.assignedJobs : [],
    createdById: row.createdById || null,
    assignedToId: row.assignedToId || null,
    updatedAt: row.updatedAt || row.lastActivity || row.createdAt || null,
    createdAt: row.createdAt || row.updatedAt || null,
  };
}

function mergeLeanCandidateIndex(mergedById, row) {
  const lean = toLeanCandidateIndex(row);
  if (!lean) return;
  const prior = mergedById.get(lean.id);
  if (!prior) {
    mergedById.set(lean.id, lean);
    return;
  }
  const nextTs = candidateListSortTimestamp(lean);
  const priorTs = candidateListSortTimestamp(prior);
  mergedById.set(lean.id, nextTs >= priorTs ? { ...prior, ...lean } : { ...lean, ...prior });
}

async function hydrateCandidateListRows(client, ids) {
  const unique = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!unique.length || !client?.candidate?.findMany) return [];
  const rows = await client.candidate.findMany({
    where: { id: { in: unique } },
    include: candidateListInclude,
  });
  return rows.map((row) => {
    const next = { ...row };
    delete next.extraData;
    delete next.notes;
    delete next.recruiterNotes;
    delete next.salary;
    return next;
  });
}

async function hydrateMergedCandidatePage(mergedIndex, skip, limit, { req, loadCommonPool }) {
  const slice = mergedIndex.slice(skip, skip + limit);
  const pageIds = slice.map((row) => row.id);
  if (!pageIds.length) return [];

  let portalClient = null;
  try {
    portalClient = getJobPortalPrismaClient();
  } catch {
    portalClient = null;
  }

  const [tenantRows, portalRows, commonRows] = await Promise.all([
    hydrateCandidateListRows(prisma, pageIds),
    portalClient ? hydrateCandidateListRows(portalClient, pageIds) : Promise.resolve([]),
    loadCommonPool
      ? fetchCandidateCommonForCandidatesList(req, { ids: pageIds })
      : Promise.resolve([]),
  ]);

  const mergedById = new Map();
  for (const candidate of commonRows) mergedById.set(String(candidate.id), candidate);
  for (const candidate of portalRows) {
    const id = String(candidate.id);
    const prior = mergedById.get(id);
    mergedById.set(id, prior ? mergePortalAndTenantCandidateRow(candidate, prior) : candidate);
  }
  for (const candidate of tenantRows) {
    const id = String(candidate.id);
    const prior = mergedById.get(id);
    mergedById.set(id, prior ? mergePortalAndTenantCandidateRow(prior, candidate) : candidate);
  }

  return pageIds.map((id) => mergedById.get(String(id))).filter(Boolean);
}

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

/** Score Phase 1 overview richness so sparse `{}` snaps never beat a full recruiter edit. */
function scorePhase1ProfileSnapshot(snap) {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return -1;
  let score = 0;
  const addArr = (value, weight = 3) => {
    if (Array.isArray(value)) score += value.length * weight;
  };
  addArr(snap.workExperience, 8);
  addArr(snap.education, 5);
  addArr(snap.skills, 2);
  addArr(snap.languages, 2);
  addArr(snap.certifications, 3);
  addArr(snap.portfolioLinks, 2);
  addArr(snap.projects, 3);
  addArr(snap.internships, 3);
  addArr(snap.gapExplanations, 2);
  addArr(snap.accomplishments, 2);
  addArr(snap.academicAchievements, 2);
  addArr(snap.competitiveExams, 2);
  if (String(snap.summaryText || '').trim()) score += 6;
  if (snap.careerPreferences && typeof snap.careerPreferences === 'object') {
    for (const value of Object.values(snap.careerPreferences)) {
      if (value == null || value === '') continue;
      if (Array.isArray(value) && !value.length) continue;
      score += 2;
    }
  }
  const personalInfo = snap.personalInfo;
  if (personalInfo && typeof personalInfo === 'object' && !Array.isArray(personalInfo)) {
    for (const value of Object.values(personalInfo)) {
      if (value != null && String(value).trim()) score += 1;
    }
  }
  if (snap.vaccination && typeof snap.vaccination === 'object') score += 2;
  if (snap.visaWorkAuthorization && typeof snap.visaWorkAuthorization === 'object') score += 2;
  return score;
}

function phase1SnapshotSavedAtMs(snap) {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return 0;
  const raw = snap._phase1SnapshotSavedAt || snap._savedAt;
  const ms = Date.parse(String(raw || ''));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Prefer newer recruiter-stamped snaps, then richer content.
 * Never let an empty portal/common object wipe a tenant Overview save.
 */
function pickPreferredPhase1ProfileSnapshot(portalSnap, tenantSnap) {
  const portalOk = portalSnap && typeof portalSnap === 'object' && !Array.isArray(portalSnap);
  const tenantOk = tenantSnap && typeof tenantSnap === 'object' && !Array.isArray(tenantSnap);
  if (!portalOk) return tenantOk ? tenantSnap : null;
  if (!tenantOk) return portalSnap;

  const portalAt = phase1SnapshotSavedAtMs(portalSnap);
  const tenantAt = phase1SnapshotSavedAtMs(tenantSnap);
  if (portalAt || tenantAt) {
    if (tenantAt !== portalAt) return tenantAt > portalAt ? tenantSnap : portalSnap;
  }

  const portalScore = scorePhase1ProfileSnapshot(portalSnap);
  const tenantScore = scorePhase1ProfileSnapshot(tenantSnap);
  if (tenantScore !== portalScore) {
    return tenantScore > portalScore ? tenantSnap : portalSnap;
  }

  return tenantAt ? tenantSnap : portalSnap;
}

/** Prefer non-empty portal/common Phase 1 fields over sparse tenant CRM stubs (same Mongo id). */
function mergePortalAndTenantCandidateRow(portalRow, tenantRow) {
  if (!tenantRow) return portalRow;
  if (!portalRow) return tenantRow;
  // Tenant CRM assignment is replace-SoT when present. Unioning portal∪tenant
  // resurrected the previous job (A) after a reassignment to B and made the
  // drawer flash B then revert to A's name/stage on refresh.
  const tenantAssignedJobs = (Array.isArray(tenantRow.assignedJobs) ? tenantRow.assignedJobs : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  const portalAssignedJobs = (Array.isArray(portalRow.assignedJobs) ? portalRow.assignedJobs : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  const mergedAssignedJobs = tenantAssignedJobs.length
    ? tenantAssignedJobs
    : portalAssignedJobs;

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
  const tenantOverviewSaved =
    phase1SnapshotSavedAtMs(tenantExtraForCv.phase1ProfileSnapshot) > 0;
  const preferTenantProfileFields = tenantEditorCvSaved || tenantOverviewSaved;
  const editorCvScalarKeys = new Set([
    'firstName',
    'lastName',
    'middleName',
    'email',
    'phone',
    'linkedIn',
    'currentTitle',
    'currentCompany',
    'location',
    'designation',
    'cvSummary',
    'gender',
  ]);

  const merged = {
    ...tenantRow,
    ...portalRow,
    assignedJobs: mergedAssignedJobs,
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
    if (preferTenantProfileFields && editorCvScalarKeys.has(key)) {
      if (Object.prototype.hasOwnProperty.call(tenantRow, key)) {
        merged[key] = pickFirstNonEmpty(tenantRow[key], portalRow[key]);
      }
      continue;
    }
    merged[key] = pickFirstNonEmpty(portalRow[key], tenantRow[key]);
  }
  // When tenant owns the assignment list, keep tenant CRM stage (Applied after
  // reassignment) instead of letting portal's older Offer/Interviewing win rank.
  if (tenantAssignedJobs.length) {
    const tenantStage = String(tenantRow?.stage || '').trim();
    merged.stage =
      tenantStage ||
      mergeCandidateWorkflowStages(portalRow?.stage, tenantRow?.stage);
  } else {
    merged.stage = mergeCandidateWorkflowStages(portalRow?.stage, tenantRow?.stage);
  }
  for (const key of arrayKeys) {
    if (preferTenantProfileFields && key === 'skills') {
      merged.skills = pickFirstNonEmpty(tenantRow.skills, portalRow.skills);
      continue;
    }
    if (preferTenantProfileFields && key === 'recruiterSkills') {
      merged.recruiterSkills = pickFirstNonEmpty(
        tenantRow.recruiterSkills,
        portalRow.recruiterSkills,
      );
      continue;
    }
    merged[key] = pickFirstNonEmpty(portalRow[key], tenantRow[key]);
  }

  if (preferTenantProfileFields) {
    merged.cvWorkExperienceEntries = pickFirstNonEmpty(
      tenantRow.cvWorkExperienceEntries,
      portalRow.cvWorkExperienceEntries,
    );
    merged.cvEducationEntries = pickFirstNonEmpty(
      tenantRow.cvEducationEntries,
      portalRow.cvEducationEntries,
    );
    merged.cvPortfolioLinks = pickFirstNonEmpty(
      tenantRow.cvPortfolioLinks,
      portalRow.cvPortfolioLinks,
    );
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
  const phase1Snap = pickPreferredPhase1ProfileSnapshot(
    portalExtra.phase1ProfileSnapshot,
    tenantExtra.phase1ProfileSnapshot,
  );
  merged.extraData = mergeCandidateRecruiterExtraData(
    { ...portalExtra, ...(phase1Snap ? { phase1ProfileSnapshot: phase1Snap } : {}) },
    {
      ...tenantExtra,
      ...(phase1Snap ? { phase1ProfileSnapshot: phase1Snap } : {}),
      workHistory: pickFirstNonEmpty(portalExtra.workHistory, tenantExtra.workHistory),
      workHistoryText: pickFirstNonEmpty(portalExtra.workHistoryText, tenantExtra.workHistoryText),
    },
  );
  if (preferTenantProfileFields) {
    merged.avatar = pickFirstNonEmpty(tenantRow.avatar, portalRow.avatar);
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
  if (action.includes('email') || action.includes('submitted') || metadata.kind === 'match-submission') {
    return 'email-sent';
  }
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
    reviewUrl: String(metadata.reviewUrl || '').trim() || null,
    clientName: metadata.clientName || null,
  };
}

const MATCH_CLIENT_REVIEW_KIND = 'match-client-review';

function parseClientReviewResponsesFromNotes(notes) {
  const responses = [];
  const lines = String(notes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('[Client Tag]')) {
      const rest = line.replace('[Client Tag]', '').trim();
      const dashIdx = rest.indexOf(' - ');
      const tag = dashIdx >= 0 ? rest.slice(0, dashIdx).trim() : rest;
      const comments = dashIdx >= 0 ? rest.slice(dashIdx + 3).trim() : '';
      responses.push({
        tag,
        comments,
        documentLabel: null,
        documentFileName: null,
        documentUrl: null,
      });
      continue;
    }
    if (line.startsWith('[Client Upload]')) {
      const rest = line.replace('[Client Upload]', '').trim();
      const colonIdx = rest.indexOf(':');
      const documentLabel = colonIdx >= 0 ? rest.slice(0, colonIdx).trim() : rest;
      const documentFileName = colonIdx >= 0 ? rest.slice(colonIdx + 1).trim() : '';
      const last = responses[responses.length - 1];
      if (last && !last.documentFileName) {
        last.documentLabel = documentLabel;
        last.documentFileName = documentFileName;
      } else {
        responses.push({
          tag: '',
          comments: '',
          documentLabel,
          documentFileName,
          documentUrl: null,
        });
      }
    }
  }
  return responses;
}

function fileNameFromUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  const parts = value.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function isClientReviewActivity(activity) {
  const metadata = getActivityMetadata(activity);
  const action = String(activity?.action || '');
  const description = String(activity?.description || metadata.text || '');
  if (metadata.kind === MATCH_CLIENT_REVIEW_KIND) return true;
  if (/^client review submitted/i.test(action)) return true;
  if (/^client uploaded/i.test(action)) return true;
  if (description.includes('[Client Tag]') || description.includes('[Client Upload]')) return true;
  return Boolean(String(metadata.tag || '').trim() && metadata.offerLetterUrl);
}

function isClientSubmissionActivity(activity) {
  if (isClientReviewActivity(activity)) return false;
  const metadata = getActivityMetadata(activity);
  const action = String(activity?.action || '').toLowerCase();
  return metadata.kind === 'match-submission' || action.includes('submitted');
}

function mapClientReviewActivityToReply(activity, jobById = new Map()) {
  const metadata = getActivityMetadata(activity);
  if (!isClientReviewActivity(activity)) return null;
  const job = jobById.get(String(activity.relatedId || metadata.jobId || '')) || null;
  const parsedFromNotes = parseClientReviewResponsesFromNotes(
    String(activity.description || '').replace(/\s+\|\s+/g, '\n'),
  );
  const parsed = parsedFromNotes[0] || null;
  const documentUrl = String(metadata.offerLetterUrl || parsed?.documentUrl || '').trim() || null;
  const documentFileName =
    String(metadata.documentFileName || parsed?.documentFileName || '').trim() ||
    fileNameFromUrl(documentUrl) ||
    null;
  const submissionType = String(metadata.submissionType || 'GENERAL');
  return {
    id: activity.id,
    clientName: metadata.clientName || job?.client?.companyName || 'Client',
    jobTitle: metadata.jobTitle || job?.title || activity.relatedLabel || null,
    tag: String(metadata.tag || parsed?.tag || '').trim(),
    comments: String(metadata.comments || parsed?.comments || '').trim(),
    documentUrl,
    documentFileName,
    documentLabel:
      documentUrl || documentFileName
        ? parsed?.documentLabel ||
          (submissionType === 'OFFER_CONFIRMATION' ? 'Offer letter received' : 'Document received')
        : null,
    repliedAt: activity.createdAt,
    submissionType,
  };
}

function collectCandidateClientSubmissions(activities, extraReviewUrl = '') {
  const submissions = [];
  const seen = new Set();
  for (const activity of Array.isArray(activities) ? activities : []) {
    if (!isClientSubmissionActivity(activity)) continue;
    const metadata = getActivityMetadata(activity);
    const clientName = String(metadata.clientName || '').trim() || 'Client';
    const jobTitle = String(metadata.relatedJobTitle || metadata.jobTitle || activity.relatedLabel || '').trim();
    const key = `${clientName.toLowerCase()}|${jobTitle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    submissions.push({
      id: activity.id,
      clientName,
      jobTitle: jobTitle || null,
      reviewUrl: String(metadata.reviewUrl || extraReviewUrl || '').trim() || null,
      submittedAt: activity.createdAt,
    });
  }
  return submissions;
}

function repliesFromExtraData(candidate) {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return [];
  return (Array.isArray(extra.clientReviews) ? extra.clientReviews : [])
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const tag = String(row.tag || '').trim();
      const comments = String(row.comments || '').trim();
      const documentUrl = String(row.documentUrl || '').trim() || null;
      const documentFileName = String(row.documentFileName || '').trim() || null;
      if (!tag && !comments && !documentUrl && !documentFileName) return null;
      return {
        id: String(row.id || `extra-client-review-${index}`),
        clientName: String(row.clientName || '').trim() || 'Client',
        jobTitle: row.jobTitle || null,
        tag,
        comments,
        documentUrl,
        documentFileName,
        documentLabel: row.documentLabel || null,
        repliedAt: row.repliedAt || null,
        submissionType: row.submissionType || 'GENERAL',
      };
    })
    .filter(Boolean);
}

function mergeActivityRows(...lists) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list : []) {
      const id = String(row?.id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
    }
  }
  return merged;
}

async function collectCandidateClientReplies(candidate, activities, db) {
  const reviewActivities = (Array.isArray(activities) ? activities : []).filter(isClientReviewActivity);

  const missingJobIds = [
    ...new Set(
      reviewActivities
        .map((activity) => String(activity.relatedId || getActivityMetadata(activity).jobId || '').trim())
        .filter(Boolean),
    ),
  ];

  let jobById = new Map();
  if (missingJobIds.length) {
    const loadJobs = async (client) => {
      if (!client?.job?.findMany) return [];
      try {
        return await client.job.findMany({
          where: { id: { in: missingJobIds } },
          select: { id: true, title: true, client: { select: { companyName: true } } },
        });
      } catch {
        return [];
      }
    };
    let jobs = await loadJobs(db);
    if (!jobs.length && db !== prisma) {
      jobs = await loadJobs(prisma);
    }
    jobById = new Map(jobs.map((job) => [String(job.id), job]));
  }

  const replies = reviewActivities
    .map((activity) => mapClientReviewActivityToReply(activity, jobById))
    .filter(Boolean);

  const activityInterviewIds = new Set(
    (Array.isArray(activities) ? activities : [])
      .map((activity) => String(getActivityMetadata(activity).interviewId || '').trim())
      .filter(Boolean),
  );

  const interviews = Array.isArray(candidate?.interviews) ? candidate.interviews : [];
  interviews.forEach((interview, interviewIndex) => {
    const interviewId = String(interview?.id || '').trim();
    if (interviewId && activityInterviewIds.has(interviewId)) return;
    const parsed = parseClientReviewResponsesFromNotes(interview?.notes);
    if (!parsed.length) return;
    const clientName = interview?.client?.companyName || 'Client';
    const jobTitle = interview?.job?.title || null;
    parsed.forEach((response, responseIndex) => {
      replies.push({
        id: `${interviewId || `interview-${interviewIndex}`}-reply-${responseIndex}`,
        clientName,
        jobTitle,
        tag: String(response.tag || '').trim(),
        comments: String(response.comments || '').trim(),
        documentUrl: response.documentUrl || null,
        documentFileName: response.documentFileName || null,
        documentLabel: response.documentLabel || null,
        repliedAt: interview.updatedAt || interview.scheduledAt || interview.createdAt || null,
        submissionType: 'GENERAL',
      });
    });
  });

  for (const extra of repliesFromExtraData(candidate)) {
    const duplicate = replies.some(
      (row) =>
        String(row.tag || '') === extra.tag &&
        String(row.comments || '') === extra.comments &&
        String(row.clientName || '').toLowerCase() === String(extra.clientName || '').toLowerCase(),
    );
    if (!duplicate) replies.push(extra);
  }

  return replies.sort((a, b) => {
    const aTime = new Date(a.repliedAt || 0).getTime();
    const bTime = new Date(b.repliedAt || 0).getTime();
    return bTime - aTime;
  });
}

async function resolveFallbackClientReviewUrl(candidateId, db) {
  const match = await db.match.findFirst({
    where: { candidateId, status: 'SHORTLISTED' },
    orderBy: { updatedAt: 'desc' },
    include: { job: { select: { id: true, clientId: true, title: true } } },
  });
  if (!match) return '';
  const { createClientReviewToken, toClientReviewUrl } = await import('../../services/interview.service.js');
  const token = createClientReviewToken({
    matchId: match.id,
    candidateId: match.candidateId,
    jobId: match.jobId,
    clientId: match.job?.clientId || null,
    submissionType: 'GENERAL',
    cvShareMode: 'edited',
  });
  return toClientReviewUrl(token, {
    matchId: match.id,
    candidateId: match.candidateId,
  });
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

/** Client submit/reply rows should always appear on the candidate Client tab. */
async function getCandidateClientTabActivities(candidateId, client = prisma) {
  return client.activity.findMany({
    where: {
      entityType: CANDIDATE_ACTIVITY_ENTITY,
      entityId: candidateId,
    },
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
  const firstName = poolRow.firstName ?? null;
  const lastName = poolRow.lastName ?? null;
  return {
    firstName,
    lastName,
    ...buildCandidateNameSearchFields(firstName, lastName),
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
  if (!candidate) return candidate;

  const fromPortal = careerPrefs
    ? normalizePortalCareerPreferences(careerPrefs, candidate)
    : null;

  const extra =
    candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? candidate.extraData
      : {};
  const snap =
    extra.phase1ProfileSnapshot &&
    typeof extra.phase1ProfileSnapshot === 'object' &&
    !Array.isArray(extra.phase1ProfileSnapshot)
      ? extra.phase1ProfileSnapshot
      : null;
  const snapPrefs = snap?.careerPreferences;
  const fromSnap = snapPrefs
    ? normalizePortalCareerPreferences(snapPrefs, candidate)
    : null;

  const snapAt = phase1SnapshotSavedAtMs(snap);
  let portalUpdatedAt = 0;
  if (careerPrefs?.updatedAt) {
    const raw = careerPrefs.updatedAt;
    const ms =
      raw && typeof raw === 'object' && raw.$date
        ? Date.parse(String(raw.$date))
        : Date.parse(String(raw));
    portalUpdatedAt = Number.isFinite(ms) ? ms : 0;
  }

  // Prefer recruiter/candidate Overview snapshot when it is newer than portal collection.
  const preferSnap = Boolean(fromSnap && snapAt && (!portalUpdatedAt || snapAt >= portalUpdatedAt));
  const normalized = preferSnap
    ? { ...(fromPortal || {}), ...fromSnap }
    : fromPortal
      ? { ...(fromSnap || {}), ...fromPortal }
      : fromSnap;

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

/**
 * Map Overview / snapshot career prefs into the Phase 1 `career_preferences` collection
 * so getById + Phase 1 profile stay in sync after CRM edits.
 */
function mapSalaryTypeForPortal(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw.startsWith('ANNUAL') || raw === 'YEARLY') return 'ANNUAL';
  if (raw.startsWith('MONTH')) return 'MONTHLY';
  if (raw.startsWith('HOUR')) return 'HOURLY';
  if (raw.startsWith('DAY') || raw === 'DAILY') return 'DAILY';
  return null;
}

function mapWorkModeForPortal(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/[-\s]+/g, '_');
  if (!raw) return null;
  if (raw === 'REMOTE') return 'REMOTE';
  if (raw === 'HYBRID') return 'HYBRID';
  if (raw === 'ON_SITE' || raw === 'ONSITE') return 'ON_SITE';
  return null;
}

function parseNoticePeriodDaysFromPrefs(prefs) {
  if (prefs?.noticePeriodDays != null && Number.isFinite(Number(prefs.noticePeriodDays))) {
    return Number(prefs.noticePeriodDays);
  }
  const noticePeriodStr = String(prefs?.noticePeriod || '');
  const daysMatch = noticePeriodStr.match(/(\d+)/);
  return daysMatch ? Number.parseInt(daysMatch[1], 10) : null;
}

async function upsertPortalCareerPreferences(candidateId, prefs) {
  if (!candidateId || !prefs || typeof prefs !== 'object') return false;
  let portalClient = null;
  try {
    portalClient = getJobPortalPrismaClient();
  } catch {
    portalClient = null;
  }
  if (!portalClient?.$runCommandRaw) return false;

  const idStr = String(candidateId).trim();
  if (!/^[a-fA-F0-9]{24}$/.test(idStr)) return false;

  const preferredRoles = Array.isArray(prefs.preferredJobTitles)
    ? prefs.preferredJobTitles
    : Array.isArray(prefs.preferredRoles)
      ? prefs.preferredRoles
      : [];
  const jobTypes = Array.isArray(prefs.jobTypes) ? prefs.jobTypes.map(String).filter(Boolean) : [];
  const preferredLocations = Array.isArray(prefs.preferredLocations)
    ? prefs.preferredLocations.map(String).filter(Boolean)
    : [];
  const currentBenefits = Array.isArray(prefs.currentBenefits)
    ? prefs.currentBenefits.map(String).filter(Boolean)
    : [];
  const preferredBenefits = Array.isArray(prefs.preferredBenefits)
    ? prefs.preferredBenefits.map(String).filter(Boolean)
    : [];

  const workModeInput =
    (Array.isArray(prefs.workModes) && prefs.workModes[0]) || prefs.preferredWorkMode || null;
  const preferredWorkMode = mapWorkModeForPortal(workModeInput);
  const currentSalaryType = mapSalaryTypeForPortal(prefs.currentSalaryType);
  const preferredSalaryType = mapSalaryTypeForPortal(
    prefs.preferredSalaryType || prefs.salaryFrequency,
  );
  const currentSalary =
    prefs.currentSalary != null && prefs.currentSalary !== ''
      ? Number(prefs.currentSalary)
      : null;
  const preferredSalaryRaw =
    prefs.preferredSalary != null && prefs.preferredSalary !== ''
      ? prefs.preferredSalary
      : prefs.salaryAmount;
  const preferredSalary =
    preferredSalaryRaw != null && preferredSalaryRaw !== '' ? Number(preferredSalaryRaw) : null;

  const nowIso = new Date().toISOString();
  const setDoc = {
    preferredRoles: preferredRoles.map(String).filter(Boolean),
    preferredIndustry: prefs.preferredIndustry || null,
    functionalArea: prefs.functionalArea || null,
    currentCurrency: prefs.currentCurrency || 'USD',
    currentLocation: prefs.currentLocation || null,
    currentBenefits,
    jobTypes,
    preferredLocations,
    relocationPreference: prefs.relocationPreference || null,
    preferredCurrency: prefs.preferredCurrency || prefs.salaryCurrency || 'USD',
    preferredBenefits,
    availabilityToStart: prefs.availabilityToStart || null,
    noticePeriod: prefs.noticePeriod || null,
    noticePeriodDays: parseNoticePeriodDaysFromPrefs(prefs),
    openToRelocation:
      prefs.relocationPreference === 'Open to Relocate' ||
      prefs.relocationPreference === 'Open to Remote Only' ||
      prefs.openToRelocation === true,
    updatedAt: { $date: nowIso },
  };
  if (currentSalaryType) setDoc.currentSalaryType = currentSalaryType;
  if (preferredSalaryType) setDoc.preferredSalaryType = preferredSalaryType;
  if (preferredWorkMode) setDoc.preferredWorkMode = preferredWorkMode;
  if (Number.isFinite(currentSalary)) setDoc.currentSalary = currentSalary;
  if (Number.isFinite(preferredSalary)) setDoc.preferredSalary = preferredSalary;
  if (prefs.passportNumbersByLocation && typeof prefs.passportNumbersByLocation === 'object') {
    setDoc.passportNumbersByLocation = prefs.passportNumbersByLocation;
  }

  try {
    await portalClient.$runCommandRaw({
      update: 'career_preferences',
      updates: [
        {
          q: { candidateId: { $oid: idStr } },
          u: {
            $set: setDoc,
            $setOnInsert: {
              candidateId: { $oid: idStr },
              createdAt: { $date: nowIso },
            },
          },
          upsert: true,
        },
      ],
    });
    return true;
  } catch (err) {
    console.warn(
      '[candidate.service] portal career_preferences upsert failed:',
      idStr,
      err?.message || err,
    );
    return false;
  }
}

function mapGenderEnumForPortal(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw === 'MALE' || raw === 'M') return 'MALE';
  if (raw === 'FEMALE' || raw === 'F') return 'FEMALE';
  if (raw === 'OTHER' || raw === 'O') return 'OTHER';
  return null;
}

/** Mirror CRM Overview identity fields onto Phase 1 candidate_profiles. */
async function syncPortalCandidateProfileIdentity(candidateId, { gender, dateOfBirth, middleName, firstName, lastName, email, phone, city, country, linkedIn } = {}) {
  if (!candidateId) return;
  let portalClient = null;
  try {
    portalClient = getJobPortalPrismaClient();
  } catch {
    portalClient = null;
  }
  if (!portalClient?.$runCommandRaw) return;

  const idStr = String(candidateId).trim();
  if (!/^[a-fA-F0-9]{24}$/.test(idStr)) return;

  const setDoc = { updatedAt: { $date: new Date().toISOString() } };
  const genderEnum = mapGenderEnumForPortal(gender);
  if (genderEnum) setDoc.gender = genderEnum;
  if (dateOfBirth) {
    const d = dateOfBirth instanceof Date ? dateOfBirth : new Date(String(dateOfBirth));
    if (Number.isFinite(d.getTime())) setDoc.dateOfBirth = { $date: d.toISOString() };
  }
  const nameParts = [firstName, middleName, lastName].map((p) => String(p || '').trim()).filter(Boolean);
  if (nameParts.length) setDoc.fullName = nameParts.join(' ');
  if (email) setDoc.email = String(email).trim().toLowerCase();
  if (phone) setDoc.phoneNumber = String(phone).trim();
  if (city) setDoc.city = String(city).trim();
  if (country) setDoc.country = String(country).trim();
  if (linkedIn) setDoc.linkedinUrl = String(linkedIn).trim();

  if (Object.keys(setDoc).length <= 1) return;

  try {
    await portalClient.$runCommandRaw({
      update: 'candidate_profiles',
      updates: [
        {
          q: { candidateId: { $oid: idStr } },
          u: {
            $set: setDoc,
            $setOnInsert: {
              candidateId: { $oid: idStr },
              fullName: setDoc.fullName || 'Candidate',
              email: setDoc.email || '',
              createdAt: { $date: new Date().toISOString() },
            },
          },
          upsert: true,
        },
      ],
    });
  } catch (err) {
    console.warn(
      '[candidate.service] portal candidate_profiles sync failed:',
      idStr,
      err?.message || err,
    );
  }
}

async function buildCandidateResponse(candidate, activityClient = prisma, viewerUserId = null) {
  const activities = await getCandidateActivities(candidate.id, activityClient, viewerUserId);
  const customTags = extractCustomTags(activities);
  const internalNotes = activities.map(mapActivityToNote).filter(Boolean);
  let extraReviewUrl = String(candidate?.extraData?.cvSubmission?.reviewUrl || '').trim();
  const hasSubmissionWithoutUrl = activities.some((activity) => {
    const metadata = getActivityMetadata(activity);
    const action = String(activity.action || '').toLowerCase();
    const isSubmission = action.includes('submitted') || metadata.kind === 'match-submission';
    return isSubmission && !String(metadata.reviewUrl || '').trim();
  });
  if (!extraReviewUrl && hasSubmissionWithoutUrl) {
    extraReviewUrl = await resolveFallbackClientReviewUrl(candidate.id, activityClient);
  }
  const activityFeed = activities
    .map(mapActivityToDrawerItem)
    .filter(Boolean)
    .map((item) =>
      item.type === 'email-sent' &&
      !item.reviewUrl &&
      extraReviewUrl &&
      /submitted/i.test(String(item.title || ''))
        ? { ...item, reviewUrl: extraReviewUrl }
        : item,
    );
  let clientTabActivities = await getCandidateClientTabActivities(candidate.id, activityClient).catch(
    () => [],
  );
  if (activityClient !== prisma) {
    const tenantClientTabActivities = await getCandidateClientTabActivities(candidate.id, prisma).catch(
      () => [],
    );
    clientTabActivities = mergeActivityRows(clientTabActivities, tenantClientTabActivities);
  }
  const clientReplies = await collectCandidateClientReplies(candidate, clientTabActivities, activityClient);
  const clientSubmissions = collectCandidateClientSubmissions(clientTabActivities, extraReviewUrl);
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
    clientReplies,
    clientSubmissions,
  };
}

/** Job ids the signed-in user owns (creator, assignee, manager, or supporting recruiter). */
async function getMyJobIds(userId, { take } = {}) {
  if (!userId) return [];
  const resolvedTake =
    take === undefined || take === null
      ? resolveMineJobTake()
      : Number(take) > 0
        ? Number(take)
        : null;
  const myJobs = await prisma.job.findMany({
    where: buildMyJobsWhereClause(userId),
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    ...(resolvedTake ? { take: resolvedTake } : {}),
  });
  return myJobs.map((j) => String(j.id));
}

/** Default My Candidates job window — high enough for enterprise tenants (env override). */
function resolveMineJobTake() {
  const raw = Number(process.env.CANDIDATE_MINE_JOB_TAKE);
  if (Number.isFinite(raw) && raw === 0) return null; // 0 = no cap
  if (Number.isFinite(raw) && raw > 0) return Math.min(10_000, Math.max(500, raw));
  return 2500;
}

function chunkIds(ids, size = 400) {
  const list = Array.isArray(ids) ? ids : [];
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

async function prefetchMineLinkedCandidateIds(jobIds) {
  const capped = (Array.isArray(jobIds) ? jobIds : []).map((id) => String(id || '').trim()).filter(Boolean);
  if (!capped.length) return [];
  const LINK_TAKE = Math.min(
    20_000,
    Math.max(2000, Number(process.env.CANDIDATE_MINE_LINK_TAKE || 8000) || 8000),
  );
  const perChunk = Math.max(200, Math.floor(LINK_TAKE / Math.max(1, Math.ceil(capped.length / 400))));
  const linked = new Set();
  for (const chunk of chunkIds(capped, 400)) {
    if (linked.size >= LINK_TAKE) break;
    const take = Math.min(perChunk, LINK_TAKE - linked.size);
    const [apps, matches, pipes, interviews, placements] = await Promise.all([
      prisma.application
        .findMany({
          where: { jobId: { in: chunk } },
          select: { candidateId: true },
          take,
          orderBy: { appliedAt: 'desc' },
        })
        .catch(() => []),
      prisma.match
        .findMany({
          where: { jobId: { in: chunk } },
          select: { candidateId: true },
          take,
          orderBy: { createdAt: 'desc' },
        })
        .catch(() => []),
      prisma.pipelineEntry
        .findMany({
          where: { jobId: { in: chunk } },
          select: { candidateId: true },
          take,
          orderBy: { movedAt: 'desc' },
        })
        .catch(() => []),
      prisma.interview
        .findMany({
          where: { jobId: { in: chunk } },
          select: { candidateId: true },
          take,
          orderBy: { scheduledAt: 'desc' },
        })
        .catch(() => []),
      prisma.placement
        .findMany({
          where: { jobId: { in: chunk }, deletedAt: null },
          select: { candidateId: true },
          take,
          orderBy: { updatedAt: 'desc' },
        })
        .catch(() => []),
    ]);
    for (const row of [...apps, ...matches, ...pipes, ...interviews, ...placements]) {
      const id = String(row?.candidateId || '').trim();
      if (id) linked.add(id);
      if (linked.size >= LINK_TAKE) break;
    }
  }
  return Array.from(linked).slice(0, LINK_TAKE);
}

/**
 * Candidates the user may see when mine=true: created by them, assigned to them,
 * or linked to jobs they own (apply / match / pipeline / interview / placement).
 *
 * Prefer id prefetch over nested `some` scans — correlated relation filters can
 * starve the Mongo pool. Nest only as a safety net when prefetch is thin.
 */
async function buildMineCandidatesScope(userId, knownJobIds) {
  if (!userId) {
    return { id: { in: [] } };
  }
  const myJobIds = Array.isArray(knownJobIds)
    ? knownJobIds.map((id) => String(id || '').trim()).filter(Boolean)
    : await getMyJobIds(userId);
  const jobCap = resolveMineJobTake() || myJobIds.length;
  const cappedJobIds = myJobIds.slice(0, jobCap || myJobIds.length);
  const orClause = buildAssigneeVisibilityOr(userId);
  if (cappedJobIds.length > 0) {
    // Mongo hasSome is fine with large arrays; chunk only relation prefetches.
    orClause.push({ assignedJobs: { hasSome: cappedJobIds } });
    try {
      const linkedIds = await prefetchMineLinkedCandidateIds(cappedJobIds);
      if (linkedIds.length) {
        orClause.push({ id: { in: linkedIds } });
      }
      // Safety net when prefetch is empty/thin so My Candidates is not missing applicants.
      if (linkedIds.length < 100) {
        const relationJobIds = cappedJobIds.slice(0, 120);
        orClause.push({ applications: { some: { jobId: { in: relationJobIds } } } });
        orClause.push({ pipelineEntries: { some: { jobId: { in: relationJobIds } } } });
        orClause.push({ matches: { some: { jobId: { in: relationJobIds } } } });
        orClause.push({ interviews: { some: { jobId: { in: relationJobIds } } } });
        orClause.push({ placements: { some: { jobId: { in: relationJobIds } } } });
      }
    } catch (err) {
      console.warn('[candidate.service] mine link prefetch failed:', err?.message || err);
      const relationJobIds = cappedJobIds.slice(0, 80);
      orClause.push({ applications: { some: { jobId: { in: relationJobIds } } } });
      orClause.push({ pipelineEntries: { some: { jobId: { in: relationJobIds } } } });
      orClause.push({ matches: { some: { jobId: { in: relationJobIds } } } });
      orClause.push({ interviews: { some: { jobId: { in: relationJobIds } } } });
      orClause.push({ placements: { some: { jobId: { in: relationJobIds } } } });
    }
  }
  return { OR: orClause };
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

  const placements = Array.isArray(candidate.placements) ? candidate.placements : [];
  if (placements.some((row) => jobIdSet.has(String(row?.jobId || '').trim()))) {
    return true;
  }

  return false;
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

/**
 * Portal list/count gates on CRM job ids. Unbounded `$in` arrays make Mongo crawl
 * (multi-minute list loads). Cap non-mine lookups to recent jobs; mine already uses owned jobs.
 */
const PORTAL_JOB_ID_CAP = Math.min(
  2000,
  Math.max(100, Number(process.env.CANDIDATE_PORTAL_JOB_ID_CAP || 800) || 800),
);

async function getVisibleTenantJobIds(req, mine, { take = null } = {}) {
  const userId = req?.user?.id;
  let jobWhere =
    mine && userId ? buildMyJobsWhereClause(userId) : { isDeleted: { not: true } };

  jobWhere = await mergeOrgCompanyListScope(jobWhere, req, {
    assignedToIdField: 'assignedToId',
    createdByField: 'createdById',
    extraHasField: 'supportingRecruiters',
  });

  const effectiveTake =
    Number.isFinite(Number(take)) && Number(take) > 0
      ? Number(take)
      : mine
        ? null
        : PORTAL_JOB_ID_CAP;

  const cacheKey = tenantJobCacheKey(
    `vis:${mine ? '1' : '0'}:${userId || ''}:${effectiveTake || 'all'}:${req.headers?.['x-org-unit-id'] || ''}`,
  );
  const hit = TENANT_JOB_ID_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < TENANT_JOB_ID_CACHE_TTL_MS) {
    return hit.ids.slice();
  }

  const jobs = await prisma.job.findMany({
    where: jobWhere,
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    ...(effectiveTake ? { take: effectiveTake } : {}),
  });

  const ids = jobs.map((job) => job.id);
  TENANT_JOB_ID_CACHE.set(cacheKey, { at: Date.now(), ids });
  return ids;
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
  longlist: ['Longlist', 'Long List', 'LONGLIST', 'Long-list'],
  shortlist: ['Shortlist', 'Short List', 'SHORTLIST', 'Short-list'],
  screening: ['Screening', 'SCREENING', 'Phone Screen', 'Phone Screening', 'HR Screening'],
  submitted: [
    'Submitted',
    'SUBMITTED',
    'Submit to Client',
    'Submit to client',
    'SUBMITTED_TO_CLIENT',
    'Submitted to Client',
    'Client Submission',
  ],
  'submit-to-client': [
    'Submit to Client',
    'Submit to client',
    'SUBMITTED_TO_CLIENT',
    'Submitted to Client',
    'Submitted',
    'SUBMITTED',
  ],
  interviewing: [
    'Interviewing',
    'Interview',
    'INTERVIEW',
    'INTERVIEWING',
    'Interview Scheduled',
    'Interview Round',
  ],
  offered: ['Offered', 'Offer', 'OFFER', 'OFFERED', 'Offer Sent', 'Offer Accepted'],
  hired: ['Hired', 'HIRED', 'Placed', 'PLACED', 'Joined', 'JOINED', 'Onboarded'],
  rejected: ['Rejected', 'REJECTED', 'Declined', 'Withdrawn', 'Failed'],
};

const ACTIVE_INTERVIEW_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'RESCHEDULED',
  'IN_PROGRESS',
  'FEEDBACK_PENDING',
];

const OFFERED_PLACEMENT_STATUSES = ['OFFER_SENT', 'OFFER_ACCEPTED', 'PENDING'];
const HIRED_PLACEMENT_STATUSES = [
  'JOINING_SCHEDULED',
  'JOINED',
  'COMPLETED',
  'ACTIVE',
  'REPLACED',
];
const REJECTED_PLACEMENT_STATUSES = [
  'OFFER_REJECTED',
  'FAILED',
  'WITHDRAWN',
  'DROPPED',
  'CANCELLED',
  'NO_SHOW',
];

function normalizeStageFilterKey(stageParam) {
  const raw = String(stageParam || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase().replace(/_/g, '-');
  if (lower === 'submit to client' || lower === 'submitted to client') return 'submitted';
  const keys = Object.keys(STAGE_FILTER_VARIANTS);
  if (keys.includes(lower)) return lower === 'submit-to-client' ? 'submitted' : lower;
  const byVariant = keys.find((key) =>
    (STAGE_FILTER_VARIANTS[key] || []).some((v) => String(v).toLowerCase() === lower)
  );
  if (byVariant === 'submit-to-client') return 'submitted';
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
  const variants = STAGE_FILTER_VARIANTS[key] || STAGE_FILTER_VARIANTS['submit-to-client'];
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
  return { stage: { in: unique } };
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

/**
 * Stage filter SoT matches the table badge: candidate.stage OR pipeline stage name
 * OR interviews / placements for Interviewing / Offered / Hired / Rejected.
 */
async function buildStageFilterWhereAsync(stageParam) {
  const key = normalizeStageFilterKey(stageParam);
  if (!key) return null;

  if (key === 'new') {
    return {
      OR: [{ stage: null }, { stage: '' }, { stage: 'New' }, { stage: 'NEW' }],
    };
  }

  const variants =
    STAGE_FILTER_VARIANTS[key] ||
    STAGE_FILTER_VARIANTS['submit-to-client'] ||
    [String(stageParam || '').trim()];
  const unique = [...new Set(variants.map((v) => String(v).trim()).filter(Boolean))];
  const orParts = [{ stage: { in: unique } }];

  try {
    const pipelineStages = await prisma.pipelineStage.findMany({
      select: { id: true, name: true },
      take: 1200,
    });
    const matchingStageIds = pipelineStages
      .filter((row) => stageMatchesFilter(row?.name, stageParam))
      .map((row) => String(row.id))
      .filter(Boolean);
    if (matchingStageIds.length) {
      orParts.push({
        pipelineEntries: { some: { stageId: { in: matchingStageIds } } },
      });
    }
  } catch (err) {
    console.warn('[candidate.service] pipeline stage filter lookup failed:', err?.message || err);
  }

  if (key === 'interviewing') {
    orParts.push({
      interviews: {
        some: {
          status: { in: ACTIVE_INTERVIEW_STATUSES },
        },
      },
    });
  }

  if (key === 'applied') {
    orParts.push({
      AND: [
        { OR: [{ applications: { some: {} } }, { assignedJobs: { isEmpty: false } }] },
        {
          NOT: {
            interviews: {
              some: { status: { in: ACTIVE_INTERVIEW_STATUSES } },
            },
          },
        },
      ],
    });
  }

  if (key === 'offered') {
    orParts.push({
      placements: {
        some: {
          status: { in: OFFERED_PLACEMENT_STATUSES },
          deletedAt: null,
        },
      },
    });
  }

  if (key === 'hired') {
    orParts.push({ status: 'PLACED' });
    orParts.push({
      placements: {
        some: {
          status: { in: HIRED_PLACEMENT_STATUSES },
          deletedAt: null,
        },
      },
    });
  }

  if (key === 'rejected') {
    orParts.push({
      placements: {
        some: {
          status: { in: REJECTED_PLACEMENT_STATUSES },
          deletedAt: null,
        },
      },
    });
    orParts.push({
      matches: { some: { status: 'REJECTED' } },
    });
  }

  if (key === 'shortlist') {
    orParts.push({
      matches: { some: { status: 'SHORTLISTED' } },
    });
  }

  return { OR: orParts };
}

async function appendCandidateListFilterAndParts(andParts, filters) {
  const { company, location, jobId, stage, minExperience, maxExperience, minExperienceOpen } = filters;
  const stageClause = stage ? await buildStageFilterWhereAsync(stage) : null;
  if (stageClause) {
    andParts.push(stageClause);
  }
  if (company) {
    // Index-friendly: filter on candidate.currentCompany only.
    andParts.push({ currentCompany: { contains: company, mode: 'insensitive' } });
  }
  if (location) {
    andParts.push({
      OR: [
        { location: { contains: location, mode: 'insensitive' } },
        { city: { contains: location, mode: 'insensitive' } },
        { country: { contains: location, mode: 'insensitive' } },
      ],
    });
  }
  if (jobId) {
    andParts.push({
      OR: [
        { assignedJobs: { has: jobId } },
        { applications: { some: { jobId } } },
        { matches: { some: { jobId } } },
        { pipelineEntries: { some: { jobId } } },
        { interviews: { some: { jobId } } },
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

async function buildPortalCandidatesWhere(
  req,
  { status, assignedToId, search, mine, listFilters, myJobIds = null },
) {
  if (!isTenantScopedRequest()) return null;

  const tenantJobIds = await getVisibleTenantJobIds(req, mine);
  if (!tenantJobIds.length) return null;

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
    const mineScope = await buildMineCandidatesScope(
      req.user.id,
      Array.isArray(myJobIds) ? myJobIds : undefined,
    );
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
    await appendCandidateListFilterAndParts(andParts, listFilters);
  }

  if (andParts.length) {
    where.AND = andParts;
  }
  return where;
}

async function fetchPortalCandidatesForTenant(
  req,
  { status, assignedToId, search, mine, listFilters, indexOnly = false, take = null, skip = 0, myJobIds = null },
) {
  if (!isTenantScopedRequest()) return [];

  const where = await buildPortalCandidatesWhere(req, {
    status,
    assignedToId,
    search,
    mine,
    listFilters,
    myJobIds,
  });
  if (!where) return [];

  const portalPrisma = getJobPortalPrismaClient();
  const query = {
    where,
    ...(indexOnly
      ? { select: candidateListIndexSelect }
      : { include: candidateListInclude }),
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  };
  if (Number.isFinite(Number(skip)) && Number(skip) > 0) query.skip = Number(skip);
  if (Number.isFinite(Number(take)) && Number(take) > 0) query.take = Number(take);

  return portalPrisma.candidate.findMany(query);
}

/**
 * Global top-K across sorted sources lives in union of each source's top-K.
 * K = skip + limit → Node never holds more than ~3K lean rows for normal pages.
 */
function mergeBoundedCandidateIndexes(sources, { loadCommonPool, tenantCandidateIds, search, listFilters, tenantJobIdSet, mine, userId, myJobIds }) {
  const mergedById = new Map();
  for (const row of sources.common || []) mergeLeanCandidateIndex(mergedById, row);
  for (const row of sources.portal || []) {
    if (sources.softDeletedTenantIds?.has(row.id) && !mergedById.has(String(row.id))) continue;
    mergeLeanCandidateIndex(mergedById, row);
  }
  for (const row of sources.tenant || []) mergeLeanCandidateIndex(mergedById, row);

  let merged = Array.from(mergedById.values())
    .filter((original) =>
      shouldIncludeCandidateAfterTenantScope(original, original, {
        includeCommonPool: loadCommonPool,
        inTenantDb: tenantCandidateIds.has(String(original.id)),
      }),
    )
    .filter((candidate) =>
      shouldShowOnCrmCandidatesList(candidate, { includeCommonPool: loadCommonPool }),
    )
    .filter((candidate) => candidateMatchesSearch(candidate, search))
    .filter((candidate) => {
      // Lean index rows lack pipelineEntries/interviews. Stage SoT was already applied in
      // SQL (tenant/portal). Re-running resolveCandidateStageForList here falsely drops
      // Interviewing/Applied rows that only have relation-based stage.
      if (listFilters?.stage) {
        const leanSafeFilters = { ...listFilters, stage: '' };
        return candidateMatchesListFilters(candidate, leanSafeFilters, tenantJobIdSet);
      }
      return candidateMatchesListFilters(candidate, listFilters, tenantJobIdSet);
    });

  // Tenant + portal queries already apply mine scope in SQL. Lean index rows lack
  // applications/matches, so re-filtering here incorrectly drops portal applicants.
  // Only re-check when common-pool rows could be in the merge (All candidates).
  if (mine && userId && loadCommonPool) {
    merged = merged.filter((candidate) => candidateMatchesMineScope(candidate, userId, myJobIds));
  }

  merged.sort((a, b) => {
    const delta = candidateListSortTimestamp(b) - candidateListSortTimestamp(a);
    if (delta !== 0) return delta;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
  return merged;
}

/** Hard ceiling for k-way merge window — prevents K→100k on extreme deep pages. */
const CANDIDATE_LIST_MAX_K = Math.min(
  10_000,
  Math.max(200, Number(process.env.CANDIDATE_LIST_MAX_K || 2500) || 2500),
);
/** Overlap sample size for portal-only estimate (replaces scanning up to 100k portal rows). */
const PORTAL_OVERLAP_SAMPLE = Math.min(
  500,
  Math.max(50, Number(process.env.CANDIDATE_PORTAL_OVERLAP_SAMPLE || 200) || 200),
);
const CANDIDATE_COUNT_CACHE_TTL_MS = Math.min(
  120_000,
  Math.max(5_000, Number(process.env.CANDIDATE_COUNT_CACHE_TTL_MS || 45_000) || 45_000),
);
const CANDIDATE_COUNT_CACHE = new Map();
const CANDIDATE_COUNT_CACHE_MAX = 64;

function isCandidatePerfLogEnabled() {
  return (
    process.env.CANDIDATE_PERF_LOG === '1' ||
    process.env.CANDIDATE_PERF_LOG === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

function candidatePerfNow() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function logCandidatePerf(parts) {
  if (!isCandidatePerfLogEnabled()) return;
  const body = Object.entries(parts)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.info(`[CandidatePerformance] ${body}`);
}

function buildCandidateCountCacheKey(req, { loadCommonPool, mine, tenantWhere }) {
  const q = req.query || {};
  let tenant = '';
  try {
    tenant = String(getActiveTenantDbName?.() || '');
  } catch {
    tenant = '';
  }
  // Include filter/search/RBAC identity — never share counts across tenants/users/scopes.
  return [
    'count',
    tenant,
    String(req.user?.id || ''),
    String(req.headers?.['x-org-unit-id'] || req.query?.orgUnitId || ''),
    mine ? '1' : '0',
    loadCommonPool ? '1' : '0',
    String(q.status || ''),
    String(q.assignedToId || ''),
    String(q.search || ''),
    String(q.ids || ''),
    String(q.company || ''),
    String(q.location || ''),
    String(q.jobId || ''),
    String(q.experienceRange || q.experience || ''),
    String(q.stage || ''),
    String(q.minExperience || ''),
    String(q.maxExperience || ''),
    // Cheap fingerprint of the auth-scoped where (stable JSON keys from Prisma).
    JSON.stringify(tenantWhere || {}),
  ].join('\u0001');
}

function readCandidateCountCache(key) {
  const hit = CANDIDATE_COUNT_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CANDIDATE_COUNT_CACHE_TTL_MS) {
    CANDIDATE_COUNT_CACHE.delete(key);
    return null;
  }
  return hit.total;
}

function writeCandidateCountCache(key, total) {
  CANDIDATE_COUNT_CACHE.set(key, { at: Date.now(), total });
  while (CANDIDATE_COUNT_CACHE.size > CANDIDATE_COUNT_CACHE_MAX) {
    const oldest = CANDIDATE_COUNT_CACHE.keys().next().value;
    CANDIDATE_COUNT_CACHE.delete(oldest);
  }
}

/**
 * Resolve bounded K for multi-source list merge.
 * Search keeps a small window; deep offset pages are capped (not full-table).
 */
function resolveCandidateListK({ skip, limit, search }) {
  const pageWindow = Math.max(1, Number(skip) + Number(limit));
  const searchActive = Boolean(String(search || '').trim());
  // Search: stay near the requested page; do not grow toward MAX just because N is huge.
  const inflated = searchActive
    ? Math.min(Math.max(pageWindow, Math.min(pageWindow * 3, 750)), CANDIDATE_LIST_MAX_K)
    : Math.min(Math.max(pageWindow, pageWindow * 2), CANDIDATE_LIST_MAX_K);
  const deepClamped = pageWindow > CANDIDATE_LIST_MAX_K;
  return { K: inflated, deepClamped, maxK: CANDIDATE_LIST_MAX_K, pageWindow };
}

function isLivePortalListMergeEnabled() {
  const raw = String(process.env.CANDIDATE_LIST_LIVE_PORTAL_MERGE || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

async function countMergedCandidateListTotal({
  tenantWhere,
  req,
  status,
  assignedToId,
  search,
  mine,
  listFilters,
  loadCommonPool,
  myJobIds = null,
  livePortalMerge = false,
}) {
  const cacheKey = buildCandidateCountCacheKey(req, { loadCommonPool, mine, tenantWhere });
  const cached = readCandidateCountCache(cacheKey);
  if (cached != null) return cached;

  const t0 = candidatePerfNow();

  // My candidates never merge portal/common — count tenant scope only (avoids pool starvation).
  if (mine) {
    const tenantTotal = await prisma.candidate.count({ where: tenantWhere });
    writeCandidateCountCache(cacheKey, tenantTotal);
    logCandidatePerf({
      count: `${Math.round(candidatePerfNow() - t0)}ms`,
      tenantTotal,
      portalOnly: 0,
      commonOnly: 0,
      total: tenantTotal,
      mine: 1,
    });
    return tenantTotal;
  }

  const tenantTotal = await prisma.candidate.count({ where: tenantWhere });

  let portalOnly = 0;
  // Live portal counts hold Mongo connections for minutes under large job-id $in filters.
  // Off by default — enable only with CANDIDATE_LIST_LIVE_PORTAL_MERGE=1.
  try {
    if (livePortalMerge && isTenantScopedRequest()) {
      const portalWhere = await buildPortalCandidatesWhere(req, {
        status,
        assignedToId,
        search,
        mine,
        listFilters,
        myJobIds,
      });
      if (portalWhere) {
        const portalPrisma = getJobPortalPrismaClient();
        // Fast path: count() + small id sample for overlap. Never pull 100k lean rows into Node.
        const [portalTotal, sample] = await Promise.all([
          portalPrisma.candidate.count({ where: portalWhere }),
          portalPrisma.candidate.findMany({
            where: portalWhere,
            select: { id: true },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            take: PORTAL_OVERLAP_SAMPLE,
          }),
        ]);
        if (portalTotal > 0 && sample.length) {
          const sampleIds = sample.map((row) => String(row.id)).filter(Boolean);
          const existing = await prisma.candidate.findMany({
            where: { id: { in: sampleIds } },
            select: { id: true },
          });
          const existingSet = new Set(existing.map((row) => String(row.id)));
          const overlapRate = existingSet.size / sampleIds.length;
          portalOnly = Math.max(0, Math.round(portalTotal * (1 - overlapRate)));
        } else if (portalTotal > 0) {
          portalOnly = portalTotal;
        }
      }
    }
  } catch (err) {
    console.warn('[candidate.service] portal total count failed:', err?.message || err);
  }

  let commonOnly = 0;
  if (loadCommonPool) {
    try {
      let commonPrisma = null;
      try {
        commonPrisma = getCandidateCommonPrismaClient();
      } catch {
        commonPrisma = null;
      }
      if (commonPrisma?.candidateCommon?.count && (await tenantAllowsPhase1CommonPool())) {
        const commonWhere = { isVerified: true };
        const searchText = String(search || '').trim();
        if (searchText) {
          commonWhere.OR = [
            { firstName: { contains: searchText, mode: 'insensitive' } },
            { lastName: { contains: searchText, mode: 'insensitive' } },
            { email: { contains: searchText, mode: 'insensitive' } },
          ];
        }
        const commonTotal = await commonPrisma.candidateCommon.count({ where: commonWhere });
        // Assume moderate overlap with tenant/portal; avoid loading thousands of common ids.
        const sampleTake = Math.min(PORTAL_OVERLAP_SAMPLE, commonTotal);
        if (sampleTake > 0) {
          const sample = await commonPrisma.candidateCommon.findMany({
            where: commonWhere,
            select: { candidateId: true, id: true },
            orderBy: [{ updatedAt: 'desc' }, { syncedAt: 'desc' }],
            take: sampleTake,
          });
          const sampleIds = [
            ...new Set(
              sample
                .map((row) => String(row.candidateId || row.id || '').trim())
                .filter(Boolean),
            ),
          ];
          if (sampleIds.length) {
            const existing = await prisma.candidate.findMany({
              where: { id: { in: sampleIds } },
              select: { id: true },
            });
            const existingSet = new Set(existing.map((row) => String(row.id)));
            const overlapRate = existingSet.size / sampleIds.length;
            commonOnly = Math.max(0, Math.round(commonTotal * (1 - overlapRate)));
          } else {
            commonOnly = commonTotal;
          }
        }
      } else {
        // Fallback: bounded index scan (legacy path).
        const commonIndex = await fetchCandidateCommonListIndex(req, {
          take: Math.min(CANDIDATE_LIST_MAX_K, 500),
          search,
        });
        const commonIds = [
          ...new Set(commonIndex.map((row) => String(row.id || '').trim()).filter(Boolean)),
        ];
        if (commonIds.length) {
          const existing = await prisma.candidate.findMany({
            where: { id: { in: commonIds } },
            select: { id: true },
          });
          const existingSet = new Set(existing.map((row) => String(row.id)));
          commonOnly = commonIds.filter((id) => !existingSet.has(id)).length;
        }
      }
    } catch (err) {
      console.warn('[candidate.service] common total count failed:', err?.message || err);
    }
  }

  const total = tenantTotal + portalOnly + commonOnly;
  writeCandidateCountCache(cacheKey, total);
  logCandidatePerf({
    count: `${Math.round(candidatePerfNow() - t0)}ms`,
    tenantTotal,
    portalOnly,
    commonOnly,
    total,
  });
  return total;
}

/**
 * Create/update a pipeline entry (+ match) for an already-assigned job without rewriting
 * candidate.assignedJobs. Used after replace-assignment so Job A is not re-appended.
 * When forceStage is true, move an existing entry to the requested stage (Applied on reassign).
 */
async function ensurePipelineEntryForJob(candidateId, data, userId) {
  const jobId = String(data?.jobId || '').trim();
  const rawStageName = String(data?.stage || 'Applied').trim() || 'Applied';
  const forceStage = Boolean(data?.forceStage);
  if (!jobId) throw new Error('Job is required');

  const normalizedStage = rawStageName.toLowerCase();
  const stageName =
    normalizedStage === 'offer' || normalizedStage === 'offered'
      ? 'Offer'
      : normalizedStage === 'joined' || normalizedStage === 'hired'
        ? 'Hired'
        : rawStageName;

  const existingEntry = await prisma.pipelineEntry.findFirst({
    where: { candidateId, jobId },
    select: { id: true, stageId: true },
  });

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      pipelineStages: { orderBy: { order: 'asc' } },
    },
  });
  if (!job) throw new Error('Job not found');

  let targetStage = job.pipelineStages.find(
    (stage) => stage.name.toLowerCase() === stageName.toLowerCase(),
  );
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

  if (existingEntry) {
    if (!forceStage) return;
    if (String(existingEntry.stageId) !== String(targetStage.id)) {
      await prisma.pipelineEntry.update({
        where: { id: existingEntry.id },
        data: {
          stageId: targetStage.id,
          movedById: userId || null,
          movedAt: new Date(),
        },
      });
    }
  } else {
    await prisma.pipelineEntry.create({
      data: {
        candidateId,
        jobId,
        stageId: targetStage.id,
        movedById: userId || null,
        notes: null,
      },
    });
  }

  const existingMatch = await prisma.match.findFirst({
    where: { candidateId, jobId },
  });
  if (existingMatch) {
    await prisma.match.update({
      where: { id: existingMatch.id },
      data: { status: mapStageToMatchStatus(stageName) },
    });
  } else {
    await prisma.match.create({
      data: {
        candidateId,
        jobId,
        createdById: userId || null,
        score: 75,
        status: mapStageToMatchStatus(stageName),
      },
    });
  }

  try {
    await updateCandidateStage({
      candidateId,
      jobId,
      stage: mapStageNameToPipelineBucket(stageName),
      performedById: userId || null,
      skipStageActivity: true,
      metadata: { customStageName: stageName, ensureOnly: true },
    });
  } catch (stageError) {
    console.warn(
      '[candidate.ensurePipelineEntryForJob] stage sync failed:',
      stageError?.message || stageError,
    );
  }
}

export const candidateService = {
  async getAll(req) {
    const pagination = getPaginationParams(req);
    // Prefer batches ≤100 for list UX; allow larger for export via env override.
    const page = pagination.page;
    const limit = Math.min(
      Math.max(1, pagination.limit || 10),
      Math.min(200, Number(process.env.CANDIDATE_LIST_MAX_PAGE || 100) || 100),
    );
    const skip = (page - 1) * limit;
    const { status, assignedToId, search, ids } = req.query;
    const listFilters = parseCandidateListFilters(req.query);
    const mine =
      req.query?.mine === 'true' || req.query?.mine === '1' || req.query?.mine === true;
    // My candidates is tenant CRM + portal applicants only — never the full Phase 1 pool.
    const loadCommonPool = mine ? false : await resolveLoadCommonPool(req.query);
    const myJobIds = mine && req.user?.id ? await getMyJobIds(req.user.id) : [];
    const tenantJobIdSet = isTenantScopedRequest()
      ? mine
        ? new Set(myJobIds)
        : await getTenantJobIdSet()
      : null;
    const livePortalMerge = isLivePortalListMergeEnabled();

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
      andParts.push(await buildMineCandidatesScope(req.user.id, myJobIds));
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
    await appendCandidateListFilterAndParts(andParts, listFilters);
    if (andParts.length) {
      where.AND = andParts;
    }

    let candidates = [];
    let total = 0;
    const perfT0 = candidatePerfNow();
    const memT0 =
      isCandidatePerfLogEnabled() && typeof process !== 'undefined' && process.memoryUsage
        ? process.memoryUsage().heapUsed
        : null;
    const perfMarks = {
      tenantQuery: null,
      portalQuery: null,
      commonQuery: null,
      merge: null,
      hydrate: null,
      count: null,
      K: null,
      sourceCounts: null,
    };

    const hydratePageFromIndex = async (pageIndex) => {
      const tHydrate = candidatePerfNow();
      const pageRows = await hydrateMergedCandidatePage(pageIndex, 0, pageIndex.length, {
        req,
        loadCommonPool,
      });
      const attached = await attachPlacementsToCandidates(pageRows);
      perfMarks.hydrate = Math.round(candidatePerfNow() - tHydrate);
      return attached;
    };

    // My candidates: tenant CRM only (true skip/take).
    // All candidates: tenant-only by default. Multi-source (common/portal) only when
    // explicitly enabled — merge filters were wiping the table to 0 under load.
    // Set CANDIDATE_LIST_COMMON_MERGE=1 to restore Phase1 common-pool merge on All.
    const allowCommonMerge = (() => {
      const raw = String(process.env.CANDIDATE_LIST_COMMON_MERGE || '').trim().toLowerCase();
      return raw === '1' || raw === 'true' || raw === 'yes';
    })();
    const useMultiSourceMerge =
      !mine && ((loadCommonPool && allowCommonMerge) || livePortalMerge);

    if (useMultiSourceMerge) {
      // Bounded k-way merge for All candidates (tenant + optional portal + common pool).
      const { K, deepClamped, maxK } = resolveCandidateListK({ skip, limit, search });
      perfMarks.K = K;

      const tSources = candidatePerfNow();
      const PORTAL_QUERY_BUDGET_MS = Math.min(
        4000,
        Math.max(400, Number(process.env.CANDIDATE_PORTAL_QUERY_MS || 1500) || 1500),
      );
      // Phase 1 common pool is the source of truth for discovery profiles — give it more time.
      const COMMON_QUERY_BUDGET_MS = Math.min(
        8000,
        Math.max(PORTAL_QUERY_BUDGET_MS, Number(process.env.CANDIDATE_COMMON_QUERY_MS || 4000) || 4000),
      );
      const withBudget = (promise, label, fallback, budgetMs = PORTAL_QUERY_BUDGET_MS) =>
        Promise.race([
          promise,
          new Promise((resolve) => {
            setTimeout(() => {
              logCandidatePerf({ [label]: `timeout>${budgetMs}ms` });
              resolve(fallback);
            }, budgetMs);
          }),
        ]);

      // Warm count in parallel, but never block the page rows on a slow total.
      const countPromise = countMergedCandidateListTotal({
        tenantWhere: where,
        req,
        status,
        assignedToId,
        search,
        mine,
        listFilters,
        loadCommonPool,
        myJobIds,
        livePortalMerge,
      }).then((value) => {
        perfMarks.count = Math.round(candidatePerfNow() - tSources);
        return value;
      });

      const tenantPromise = prisma.candidate
        .findMany({
          where,
          select: candidateListIndexSelect,
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take: K,
        })
        .then((rows) => {
          perfMarks.tenantQuery = Math.round(candidatePerfNow() - tSources);
          return rows;
        });

      // Off by default: live portal scans starve the shared Atlas pool.
      const portalPromise =
        livePortalMerge && isTenantScopedRequest()
          ? withBudget(
              fetchPortalCandidatesForTenant(req, {
                status,
                assignedToId,
                search,
                mine,
                listFilters,
                indexOnly: true,
                take: K,
                myJobIds,
              }).then((rows) => {
                perfMarks.portalQuery = Math.round(candidatePerfNow() - tSources);
                return rows;
              }),
              'portalQuery',
              [],
            )
          : Promise.resolve([]);

      const commonPromise = loadCommonPool
        ? withBudget(
            fetchCandidateCommonListIndex(req, { take: K, search }).then((rows) => {
              perfMarks.commonQuery = Math.round(candidatePerfNow() - tSources);
              return rows;
            }),
            'commonQuery',
            [],
            COMMON_QUERY_BUDGET_MS,
          )
        : Promise.resolve([]);

      const [tenantIndex, portalIndex, commonIndex] = await Promise.all([
        tenantPromise,
        portalPromise,
        commonPromise,
      ]);

      const COUNT_WAIT_MS = Math.min(
        3000,
        Math.max(500, Number(process.env.CANDIDATE_COUNT_WAIT_MS || 1500) || 1500),
      );
      let mergedTotal = await Promise.race([
        countPromise,
        new Promise((resolve) => {
          setTimeout(() => resolve(null), COUNT_WAIT_MS);
        }),
      ]);
      if (mergedTotal == null) {
        // Don't stall the table: tenant count is enough for pagination chrome; cache warms async.
        mergedTotal = await prisma.candidate.count({ where }).catch(() => skip + limit);
        void countPromise.catch(() => null);
        perfMarks.count = `timeout>${COUNT_WAIT_MS}ms→tenant`;
      }

      perfMarks.sourceCounts = `t=${tenantIndex.length},p=${portalIndex.length},c=${commonIndex.length},portalLive=${livePortalMerge ? 1 : 0}`;

      const tombstoneIds = [
        ...portalIndex.map((c) => c.id),
        ...commonIndex.map((c) => c.id),
      ];
      const softDeletedTenantIds = tombstoneIds.length
        ? await collectSoftDeletedTenantCandidateIds(tombstoneIds)
        : new Set();
      const tenantCandidateIds = new Set(tenantIndex.map((row) => String(row.id)));

      const tMerge = candidatePerfNow();
      const merged = mergeBoundedCandidateIndexes(
        {
          tenant: tenantIndex,
          portal: portalIndex,
          common: commonIndex,
          softDeletedTenantIds,
        },
        {
          loadCommonPool,
          tenantCandidateIds,
          search,
          listFilters,
          tenantJobIdSet,
          mine,
          userId: req.user?.id,
          myJobIds,
        },
      );
      perfMarks.merge = Math.round(candidatePerfNow() - tMerge);

      total = mergedTotal;
      // Extreme deep pages: clamp to the last safe window inside MAX_K (never grow K to 100k+).
      // Users still get rows; totals remain exact/cached for numbered UX.
      const sliceSkip = deepClamped ? Math.max(0, Math.min(skip, merged.length - limit)) : skip;
      const pageIndex = merged.slice(Math.max(0, sliceSkip), Math.max(0, sliceSkip) + limit);
      if (deepClamped) {
        logCandidatePerf({
          deepPage: 1,
          requestedSkip: skip,
          effectiveSkip: Math.max(0, sliceSkip),
          maxK,
          note: 'clamped-to-safe-window',
        });
      }
      candidates = await hydratePageFromIndex(pageIndex);

      // Safety net: never blank All Candidates when tenant CRM has rows
      // (merge/hydrate filters or common-pool timeouts must not wipe the table).
      if (
        !candidates.length &&
        !String(search || '').trim() &&
        !listFilters?.jobId &&
        !listFilters?.stage &&
        !listFilters?.company &&
        !listFilters?.location
      ) {
        try {
          const [fallbackTotal, fallbackRows] = await Promise.all([
            prisma.candidate.count({ where }),
            prisma.candidate.findMany({
              where,
              include: candidateListInclude,
              orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
              skip,
              take: limit,
            }),
          ]);
          if (fallbackRows.length) {
            logCandidatePerf({
              mergeFallback: 'tenant-page',
              fallbackTotal,
              note: 'multi-source returned empty; using tenant CRM page',
            });
            total = Math.max(Number(total) || 0, fallbackTotal);
            candidates = await attachPlacementsToCandidates(fallbackRows);
            perfMarks.sourceCounts = `${perfMarks.sourceCounts || ''};fallback=tenant`;
          }
        } catch (fallbackErr) {
          console.warn(
            '[candidate.service] tenant list fallback failed:',
            fallbackErr?.message || fallbackErr,
          );
        }
      }
    } else {
      // Fast path: tenant CRM only — lean id page + hydrate (filters must stay snappy).
      const tQ = candidatePerfNow();
      const hasActiveListFilters = Boolean(
        String(search || '').trim() ||
          listFilters?.stage ||
          listFilters?.company ||
          listFilters?.location ||
          listFilters?.jobId ||
          listFilters?.experienceRange ||
          status ||
          assignedToId,
      );
      const [rowTotal, pageIndexRows] = await Promise.all([
        prisma.candidate.count({ where }),
        prisma.candidate.findMany({
          where,
          select: { id: true },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          skip,
          take: limit,
        }),
      ]);
      const pageIds = pageIndexRows.map((row) => String(row.id)).filter(Boolean);
      let pageRows = [];
      if (pageIds.length) {
        const hydrated = await prisma.candidate.findMany({
          where: { id: { in: pageIds } },
          include: hasActiveListFilters ? candidateListIncludeFast : candidateListInclude,
        });
        const byId = new Map(hydrated.map((row) => [String(row.id), row]));
        pageRows = pageIds.map((id) => byId.get(id)).filter(Boolean);
      }
      perfMarks.tenantQuery = Math.round(candidatePerfNow() - tQ);
      perfMarks.count = perfMarks.tenantQuery;
      perfMarks.sourceCounts = `tenant-only mine=${mine ? '1' : '0'} filtered=${hasActiveListFilters ? 1 : 0}`;
      total = rowTotal;
      candidates = await attachPlacementsToCandidates(pageRows);
    }

    if (candidates.length) {
      let portalClientForList = null;
      try {
        portalClientForList = getJobPortalPrismaClient();
      } catch {
        portalClientForList = null;
      }
      if (portalClientForList) {
        const hasActiveListFilters = Boolean(
          String(search || '').trim() ||
            listFilters?.stage ||
            listFilters?.company ||
            listFilters?.location ||
            listFilters?.jobId ||
            listFilters?.experienceRange ||
            status ||
            assignedToId ||
            mine,
        );
        // Filter / My list changes must stay snappy — never wait on portal resume I/O.
        if (hasActiveListFilters) {
          void batchHydrateCandidatesResumeFromPortal(candidates, portalClientForList).catch(() => null);
        } else {
          const RESUME_HYDRATE_MS = Math.min(
            2500,
            Math.max(200, Number(process.env.CANDIDATE_RESUME_HYDRATE_MS || 800) || 800),
          );
          await Promise.race([
            batchHydrateCandidatesResumeFromPortal(candidates, portalClientForList).catch(() => null),
            new Promise((resolve) => setTimeout(resolve, RESUME_HYDRATE_MS)),
          ]);
        }
        const candidateIds = candidates
          .map((row) => String(row?.id || '').trim())
          .filter(Boolean);
        if (candidateIds.length) {
          // Do not block the list response on CV stub writes — run in background.
          void (async () => {
            try {
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
            } catch (err) {
              console.warn('[candidate.service] list CV stub background failed:', err?.message || err);
            }
          })();
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
    // Skip waiting when filters / My tab are active — table latency matters more.
    const skipCareerPrefsWait = Boolean(
      String(search || '').trim() ||
        listFilters?.stage ||
        listFilters?.company ||
        listFilters?.location ||
        listFilters?.jobId ||
        listFilters?.experienceRange ||
        status ||
        assignedToId ||
        mine,
    );
    let careerPrefsByCandidate = new Map();
    if (!skipCareerPrefsWait && candidates.length) {
      const CAREER_PREFS_MS = Math.min(
        2500,
        Math.max(200, Number(process.env.CANDIDATE_CAREER_PREFS_MS || 1000) || 1000),
      );
      careerPrefsByCandidate = await Promise.race([
        fetchCareerPreferencesForCandidates(candidates.map((c) => c.id).filter(Boolean)),
        new Promise((resolve) => setTimeout(() => resolve(new Map()), CAREER_PREFS_MS)),
      ]);
    } else if (candidates.length) {
      void fetchCareerPreferencesForCandidates(candidates.map((c) => c.id).filter(Boolean)).catch(
        () => null,
      );
    }

    const enriched = candidates.map((candidate) => {
      const careerPrefs = careerPrefsByCandidate.get(String(candidate.id));
      if (careerPrefs) mergeCareerPreferencesIntoCandidate(candidate, careerPrefs);
      const scopedCandidate = scopeCandidateForActiveTenant(candidate, tenantJobIdSet);
      const explicitAssigned = (Array.isArray(scopedCandidate.assignedJobs)
        ? scopedCandidate.assignedJobs
        : []
      )
        .map((id) => String(id || '').trim())
        .filter(Boolean);
      const linkedJobIds = collectCandidateLinkedJobIds(scopedCandidate);
      // Keep replace-assignment SoT: do not expand assignedJobs with stale
      // pipeline/application ids from a previous job after reassignment.
      const scopedWithJobs = {
        ...scopedCandidate,
        assignedJobs: explicitAssigned.length
          ? explicitAssigned
          : linkedJobIds.length
            ? linkedJobIds
            : [],
      };
      const titles = (() => {
        if (explicitAssigned.length) {
          const seen = new Set();
          const out = [];
          for (const jobId of explicitAssigned) {
            let title = jobsById.get(jobId);
            if (!title) {
              const match = (Array.isArray(scopedWithJobs?.matches) ? scopedWithJobs.matches : []).find(
                (row) => String(row?.jobId || row?.job?.id || '').trim() === jobId,
              );
              title = match?.job?.title;
            }
            if (!title) {
              const application = (Array.isArray(scopedWithJobs?.applications)
                ? scopedWithJobs.applications
                : []
              ).find((row) => String(row?.jobId || '').trim() === jobId);
              title = application?.job?.title;
            }
            const label = String(title || '').trim();
            if (label && !seen.has(label)) {
              seen.add(label);
              out.push(label);
            }
          }
          return out;
        }
        return resolveCandidateAssignedJobTitlesForList(scopedWithJobs, jobsById);
      })();
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
    const memDelta =
      memT0 != null && typeof process !== 'undefined' && process.memoryUsage
        ? Math.round((process.memoryUsage().heapUsed - memT0) / 1024)
        : null;
    logCandidatePerf({
      searchKind: classifyCandidateSearch(search).kind,
      K: perfMarks.K,
      sourceCounts: perfMarks.sourceCounts,
      tenantQuery: perfMarks.tenantQuery != null ? `${perfMarks.tenantQuery}ms` : undefined,
      portalQuery: perfMarks.portalQuery != null ? `${perfMarks.portalQuery}ms` : undefined,
      commonQuery: perfMarks.commonQuery != null ? `${perfMarks.commonQuery}ms` : undefined,
      merge: perfMarks.merge != null ? `${perfMarks.merge}ms` : undefined,
      hydrate: perfMarks.hydrate != null ? `${perfMarks.hydrate}ms` : undefined,
      count: perfMarks.count != null ? `${perfMarks.count}ms` : undefined,
      fetched: candidates.length,
      total,
      memoryDeltaKb: memDelta,
      totalMs: `${Math.round(candidatePerfNow() - perfT0)}ms`,
    });
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

    // Always merge Phase 1 common-pool profile (same candidateId) into the drawer payload.
    const commonCandidate = await fetchCandidateCommonByCandidateId(id, { requireVerified: false });
    if (commonCandidate) {
      candidate = mergePortalAndTenantCandidateRow(commonCandidate, candidate);
      if (!isPhase1CandidateSource(candidate.source)) {
        candidate = { ...candidate, source: 'phase1' };
      }
    }

    // Career preferences live in the job-portal DB (where candidates self-update).
    // Always look there so recruiter drawer reflects candidate-side updates.
    let portalClientForPrefs = null;
    try { portalClientForPrefs = getJobPortalPrismaClient(); } catch { portalClientForPrefs = null; }

    // If common pool missed but portal has the Phase 1 row, merge that too.
    if (!commonCandidate && portalClientForPrefs) {
      try {
        const portalRow = await portalClientForPrefs.candidate.findFirst({
          where: { id },
          include: candidateDetailInclude,
        });
        if (portalRow) {
          candidate = mergePortalAndTenantCandidateRow(portalRow, candidate);
        }
      } catch (err) {
        console.warn('[candidate.service] portal merge for getById failed:', err?.message || err);
      }
    }

    const careerPrefs = await fetchPortalCareerPreferencesRaw(portalClientForPrefs, candidate.id);
    mergeCareerPreferencesIntoCandidate(candidate, careerPrefs);
    await hydrateAndPersistCandidateCvProfile(candidate, portalClientForPrefs);

    return buildCandidateResponse(
      await enrichCandidateDetailJobTitles(annotateForTenant(candidate), tenantJobIdSet),
      prisma,
      viewerUserId,
    );
  },

  async create(data, createdByUserId, req = null) {
    const candidateData = {
      firstName: data.firstName,
      lastName: data.lastName,
      ...buildCandidateNameSearchFields(data.firstName, data.lastName),
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

    if (createdByUserId && data.assignedToId) {
      await assertCanAssignCrm(createdByUserId, data.assignedToId, { req, modules: ['Candidates'] });
    }

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

  async update(id, data, performedByUserId = null, req = null) {
    // Whitelist of fields that exist on the Candidate Prisma model. Anything not
    // in this list (e.g. legacy `tags`, `workAuthorization`, `state`, `zipCode`,
    // `github`, `willingToRelocate`, `remoteWorkPreference`) is intentionally
    // ignored — including those keys even with `undefined` values can cause
    // Prisma "Unknown argument" errors, and silently mapping them would also
    // corrupt valid saves.
    const ALLOWED_FIELDS = [
      'firstName',
      'lastName',
      'middleName',
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
      'gender',
      'dateOfBirth',
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

    if (Object.prototype.hasOwnProperty.call(data || {}, 'dateOfBirth')) {
      const rawDob = data.dateOfBirth;
      if (rawDob === null || rawDob === '' || rawDob === undefined) {
        updateData.dateOfBirth = null;
      } else {
        const parsedDob = rawDob instanceof Date ? rawDob : new Date(String(rawDob));
        updateData.dateOfBirth = Number.isFinite(parsedDob.getTime()) ? parsedDob : null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(data || {}, 'gender')) {
      const g = String(data.gender || '').trim();
      updateData.gender = g || null;
    }

    if (Object.prototype.hasOwnProperty.call(data || {}, 'middleName')) {
      const m = String(data.middleName || '').trim();
      updateData.middleName = m || null;
    }

    if (Object.prototype.hasOwnProperty.call(data || {}, 'lastActivity')) {
      updateData.lastActivity = data.lastActivity ? new Date(data.lastActivity) : null;
    }

    let newlyAssignedJobIds = [];

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
        newlyAssignedJobIds = nextIds.filter((jid) => jid && !prevIds.has(jid));
        const addedJob = newlyAssignedJobIds.length > 0;
        if (addedJob) {
          const incomingStage = Object.prototype.hasOwnProperty.call(updateData, 'stage')
            ? updateData.stage
            : Object.prototype.hasOwnProperty.call(data || {}, 'stage')
              ? data.stage
              : undefined;
          updateData.stage = resolveStageForNewlyAssignedJob(existingRow.stage, incomingStage);
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
      const incomingExtra =
        updateData.extraData &&
        typeof updateData.extraData === 'object' &&
        !Array.isArray(updateData.extraData)
          ? { ...updateData.extraData }
          : {};
      // Stamp Overview saves so merge prefers tenant over stale portal/common snaps.
      if (
        incomingExtra.phase1ProfileSnapshot &&
        typeof incomingExtra.phase1ProfileSnapshot === 'object' &&
        !Array.isArray(incomingExtra.phase1ProfileSnapshot)
      ) {
        const prevSnap =
          existingExtra.phase1ProfileSnapshot &&
          typeof existingExtra.phase1ProfileSnapshot === 'object'
            ? existingExtra.phase1ProfileSnapshot
            : {};
        const prevPersonal =
          prevSnap.personalInfo && typeof prevSnap.personalInfo === 'object'
            ? prevSnap.personalInfo
            : {};
        const nextPersonal =
          incomingExtra.phase1ProfileSnapshot.personalInfo &&
          typeof incomingExtra.phase1ProfileSnapshot.personalInfo === 'object'
            ? { ...incomingExtra.phase1ProfileSnapshot.personalInfo }
            : { ...prevPersonal };
        if (Object.prototype.hasOwnProperty.call(updateData, 'gender')) {
          nextPersonal.gender = updateData.gender;
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'middleName')) {
          nextPersonal.middleName = updateData.middleName;
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'dateOfBirth')) {
          const dob = updateData.dateOfBirth;
          nextPersonal.dob =
            dob instanceof Date
              ? dob.toISOString().slice(0, 10)
              : dob
                ? String(dob).slice(0, 10)
                : null;
          nextPersonal.dateOfBirth = nextPersonal.dob;
        }
        incomingExtra.phase1ProfileSnapshot = {
          ...incomingExtra.phase1ProfileSnapshot,
          personalInfo: nextPersonal,
          _phase1SnapshotSavedAt:
            incomingExtra.phase1ProfileSnapshot._phase1SnapshotSavedAt ||
            new Date().toISOString(),
        };
      }
      updateData.extraData = mergeCandidateRecruiterExtraData(existingExtra, incomingExtra);
    } else if (
      Object.prototype.hasOwnProperty.call(updateData, 'gender') ||
      Object.prototype.hasOwnProperty.call(updateData, 'middleName') ||
      Object.prototype.hasOwnProperty.call(updateData, 'dateOfBirth')
    ) {
      // Identity-only patch without a full snapshot — keep personalInfo in extraData.
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
      const prevSnap =
        existingExtra.phase1ProfileSnapshot &&
        typeof existingExtra.phase1ProfileSnapshot === 'object'
          ? existingExtra.phase1ProfileSnapshot
          : {};
      const prevPersonal =
        prevSnap.personalInfo && typeof prevSnap.personalInfo === 'object'
          ? { ...prevSnap.personalInfo }
          : {};
      if (Object.prototype.hasOwnProperty.call(updateData, 'gender')) {
        prevPersonal.gender = updateData.gender;
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'middleName')) {
        prevPersonal.middleName = updateData.middleName;
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'dateOfBirth')) {
        const dob = updateData.dateOfBirth;
        prevPersonal.dob =
          dob instanceof Date
            ? dob.toISOString().slice(0, 10)
            : dob
              ? String(dob).slice(0, 10)
              : null;
        prevPersonal.dateOfBirth = prevPersonal.dob;
      }
      updateData.extraData = mergeCandidateRecruiterExtraData(existingExtra, {
        phase1ProfileSnapshot: {
          ...prevSnap,
          personalInfo: prevPersonal,
          _phase1SnapshotSavedAt: new Date().toISOString(),
        },
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(updateData, 'firstName') ||
      Object.prototype.hasOwnProperty.call(updateData, 'lastName')
    ) {
      const nameSource = await prisma.candidate.findUnique({
        where: { id },
        select: { firstName: true, lastName: true },
      });
      const nextFirst = Object.prototype.hasOwnProperty.call(updateData, 'firstName')
        ? updateData.firstName
        : nameSource?.firstName;
      const nextLast = Object.prototype.hasOwnProperty.call(updateData, 'lastName')
        ? updateData.lastName
        : nameSource?.lastName;
      Object.assign(updateData, buildCandidateNameSearchFields(nextFirst, nextLast));
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

    if (performedByUserId && updateData.assignedToId) {
      const nextAssignee = String(updateData.assignedToId || '').trim();
      const previousAssignee = String(beforeUpdate?.assignedToId || '').trim();
      if (nextAssignee && nextAssignee !== previousAssignee) {
        await assertCanAssignCrm(performedByUserId, nextAssignee, { req, modules: ['Candidates'] });
      }
    }

    const writeOnClient = async (client) => {
      try {
        return await client.candidate.update({
          where: { id },
          data: updateData,
        });
      } catch (error) {
        if (error?.code === 'P2025') return null;
        // Stale Prisma client (before `prisma generate`) may reject new identity fields.
        if (/Unknown arg|Unknown argument/i.test(String(error?.message || ''))) {
          const stripped = { ...updateData };
          delete stripped.gender;
          delete stripped.middleName;
          delete stripped.dateOfBirth;
          try {
            return await client.candidate.update({
              where: { id },
              data: stripped,
            });
          } catch (retryErr) {
            if (retryErr?.code === 'P2025') return null;
            throw retryErr;
          }
        }
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

    // Hybrid Phase 1 candidates: tenant Overview save must also land on portal so
    // later portal-preferring hydrations do not resurrect a stale empty snapshot.
    if (
      updated &&
      isTenantScopedRequest() &&
      updateData.extraData?.phase1ProfileSnapshot &&
      typeof updateData.extraData.phase1ProfileSnapshot === 'object'
    ) {
      let portalPrisma = null;
      try {
        portalPrisma = getJobPortalPrismaClient();
      } catch {
        portalPrisma = null;
      }
      if (portalPrisma) {
        try {
          const portalRow = await portalPrisma.candidate.findUnique({
            where: { id },
            select: { id: true, extraData: true },
          });
          if (portalRow) {
            const portalExtra =
              portalRow.extraData &&
              typeof portalRow.extraData === 'object' &&
              !Array.isArray(portalRow.extraData)
                ? portalRow.extraData
                : {};
            await portalPrisma.candidate.update({
              where: { id },
              data: {
                extraData: mergeCandidateRecruiterExtraData(portalExtra, {
                  phase1ProfileSnapshot: updateData.extraData.phase1ProfileSnapshot,
                  ...(Array.isArray(updateData.extraData.phase1GapExplanations)
                    ? { phase1GapExplanations: updateData.extraData.phase1GapExplanations }
                    : {}),
                  ...(Array.isArray(updateData.extraData.phase1Internships)
                    ? { phase1Internships: updateData.extraData.phase1Internships }
                    : {}),
                  ...(Array.isArray(updateData.extraData.phase1Accomplishments)
                    ? { phase1Accomplishments: updateData.extraData.phase1Accomplishments }
                    : {}),
                }),
                ...(Object.prototype.hasOwnProperty.call(updateData, 'firstName')
                  ? { firstName: updateData.firstName }
                  : {}),
                ...(Object.prototype.hasOwnProperty.call(updateData, 'lastName')
                  ? { lastName: updateData.lastName }
                  : {}),
                ...(Object.prototype.hasOwnProperty.call(updateData, 'email')
                  ? { email: updateData.email }
                  : {}),
                ...(Object.prototype.hasOwnProperty.call(updateData, 'phone')
                  ? { phone: updateData.phone }
                  : {}),
                ...(Object.prototype.hasOwnProperty.call(updateData, 'linkedIn')
                  ? { linkedIn: updateData.linkedIn }
                  : {}),
                ...(Object.prototype.hasOwnProperty.call(updateData, 'city')
                  ? { city: updateData.city }
                  : {}),
                ...(Object.prototype.hasOwnProperty.call(updateData, 'country')
                  ? { country: updateData.country }
                  : {}),
              },
            });
          }
        } catch (syncErr) {
          console.warn(
            '[candidate.service] portal phase1 snapshot sync failed:',
            id,
            syncErr?.message || syncErr,
          );
        }
      }

      const snapCareer = updateData.extraData.phase1ProfileSnapshot.careerPreferences;
      if (snapCareer && typeof snapCareer === 'object') {
        void upsertPortalCareerPreferences(id, snapCareer);
      }

      const snapPersonal = updateData.extraData.phase1ProfileSnapshot.personalInfo;
      void syncPortalCandidateProfileIdentity(id, {
        gender: updateData.gender ?? snapPersonal?.gender,
        dateOfBirth: updateData.dateOfBirth ?? snapPersonal?.dob ?? snapPersonal?.dateOfBirth,
        middleName: updateData.middleName ?? snapPersonal?.middleName,
        firstName: updateData.firstName ?? snapPersonal?.firstName,
        lastName: updateData.lastName ?? snapPersonal?.lastName,
        email: updateData.email ?? snapPersonal?.email,
        phone: updateData.phone ?? snapPersonal?.phone,
        city: updateData.city ?? snapPersonal?.city,
        country: updateData.country ?? snapPersonal?.country,
        linkedIn: updateData.linkedIn ?? snapPersonal?.linkedinUrl,
      });
    } else if (updated && isTenantScopedRequest()) {
      // Non-snapshot Overview/CRM edits that still carry identity fields.
      if (
        Object.prototype.hasOwnProperty.call(updateData, 'gender') ||
        Object.prototype.hasOwnProperty.call(updateData, 'dateOfBirth') ||
        Object.prototype.hasOwnProperty.call(updateData, 'middleName') ||
        Object.prototype.hasOwnProperty.call(updateData, 'firstName') ||
        Object.prototype.hasOwnProperty.call(updateData, 'lastName')
      ) {
        void syncPortalCandidateProfileIdentity(id, {
          gender: updateData.gender,
          dateOfBirth: updateData.dateOfBirth,
          middleName: updateData.middleName,
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          email: updateData.email,
          phone: updateData.phone,
          city: updateData.city,
          country: updateData.country,
          linkedIn: updateData.linkedIn,
        });
      }
    }

    // Keep portal assignment in sync so getById merge cannot resurrect Job A
    // after the tenant row was reassigned to Job B.
    if (
      updated &&
      isTenantScopedRequest() &&
      Object.prototype.hasOwnProperty.call(updateData, 'assignedJobs')
    ) {
      let portalPrismaForJobs = null;
      try {
        portalPrismaForJobs = getJobPortalPrismaClient();
      } catch {
        portalPrismaForJobs = null;
      }
      if (portalPrismaForJobs) {
        try {
          const portalExists = await portalPrismaForJobs.candidate.findUnique({
            where: { id },
            select: { id: true },
          });
          if (portalExists) {
            const portalJobPatch = {
              assignedJobs: Array.isArray(updateData.assignedJobs)
                ? updateData.assignedJobs.map((jid) => String(jid || '').trim()).filter(Boolean)
                : [],
            };
            if (Object.prototype.hasOwnProperty.call(updateData, 'stage')) {
              portalJobPatch.stage = updateData.stage;
            }
            await portalPrismaForJobs.candidate.update({
              where: { id },
              data: portalJobPatch,
            });
          }
        } catch (syncJobsErr) {
          console.warn(
            '[candidate.service] portal assignedJobs sync failed:',
            id,
            syncJobsErr?.message || syncJobsErr,
          );
        }
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

    // New job links: ensure a per-job pipeline entry at Applied so the job
    // drawer does not fall back to a previous job's Offer / Interviewing stage.
    // Use ensure-only path (do not rewrite assignedJobs) — addToPipeline appends
    // and would undo a replace assignment if anything reintroduced the old job.
    if (newlyAssignedJobIds.length) {
      const linkStage = String(updateData.stage || 'Applied').trim() || 'Applied';
      for (const jobId of newlyAssignedJobIds) {
        try {
          await ensurePipelineEntryForJob(
            id,
            { jobId, stage: linkStage, forceStage: true },
            performedByUserId || updated.assignedToId || null,
          );
        } catch (linkErr) {
          console.warn(
            '[candidate.service] ensure Applied pipeline for new job failed:',
            id,
            jobId,
            linkErr?.message || linkErr,
          );
        }
      }
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

    // Detach all job links (pipeline, match, application, assignment) so
    // "Remove from job" works even when the candidate was only applied/matched.
    await detachCandidateFromJobLink(candidateId, normalizedJobId);

    await prisma.activity.create({
      data: {
        action: 'Removed from job',
        description: `${candidate.firstName} ${candidate.lastName}`.trim()
          ? `${candidate.firstName} ${candidate.lastName} removed from ${job.title}.`
          : `Candidate removed from ${job.title}.`,
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
        // Never include CRM client name in candidate interview emails.
        companyName: '',
        scheduledAt,
        timezone: resolveInterviewTimeZone(data?.timezone),
        interviewId: interview?.id,
        interviewType: String(data?.type || '').trim() || null,
        roundLabel: String(data?.round || '').trim() || null,
        durationLabel: String(data?.duration || '').trim() || null,
        mode: String(data?.mode || '').trim() || null,
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
    const tenantJobIdSet = isTenantScopedRequest()
      ? mine
        ? new Set(myJobIds)
        : await getTenantJobIdSet()
      : null;

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
        applications: { select: { jobId: true, status: true }, take: 40 },
        pipelineEntries: {
          select: {
            jobId: true,
            stageId: true,
            stage: { select: { id: true, name: true } },
          },
          take: 40,
        },
        matches: { select: { jobId: true }, take: 40 },
        interviews: { select: { jobId: true, status: true, scheduledAt: true }, take: 40 },
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

  async bulkAction(action, candidateIds, payload, userId, req = null) {
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
        if (userId && primaryRecruiterId) {
          await assertCanAssignCrm(userId, primaryRecruiterId, { req, modules: ['Candidates'] });
        }
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
