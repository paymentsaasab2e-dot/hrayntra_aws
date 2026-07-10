import {
  prisma,
  getActiveTenantDbName,
  getDefaultPrismaClient,
  getJobPortalPrismaClient,
} from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import activityService from '../../services/activityService.js';
import { sendJobAssignmentEmail, sendJobClosedEmail } from '../../services/emailService.js';
import { createAlertNotification } from '../setting/alert-dispatch.service.js';
import { notifyJobClosed, personName } from '../setting/alert-notify.helpers.js';
import { buildSuperAdminOwnerScope, mergeWhereWithScope } from '../../utils/superAdminScope.js';
import { canViewAllAssignments, canViewAllJobs } from '../../utils/permissionScope.js';
import {
  buildAssigneeVisibilityOr,
  buildInitialParticipantIds,
  stampVisibilityOnAssigneeChange,
} from '../../services/memberVisibility.service.js';
import { escapePrismaRegex } from '../../utils/escapePrismaRegex.js';
import {
  getDefaultPipelineTemplate,
  applyOrgPipelineTemplateToEmptyJobs,
} from '../setting/recruitmentMode.service.js';
import { assertCanCreateJob } from '../setting/planAccess.service.js';
import {
  normalizeApplicationFormSchema,
  schemaFromLegacyQuestions,
  defaultApplicationFormSchema,
} from '../../utils/applicationFormSchema.js';
import {
  USER_BRIEF_SELECT,
  prepareListWithAuditMeta,
  attachAuditMetaToEntity,
} from '../../utils/listAuditMeta.js';
import { ENTITY_TYPES } from '../../services/activityService.js';
import {
  jobPublicApplyService,
  buildApplyUrlFromToken,
} from './jobPublicApply.service.js';
import { upsertPortalJobDocument } from '../../utils/portalJobRawSync.util.js';
import { preScreenAssessmentService } from '../pre-screen-assessment/assessment.service.js';
import {
  queueAiEntryRecommendation,
  buildEntitySnapshot,
} from '../../services/aiEntryRecommendation.service.js';

async function enrichJobWithApplyLink(job) {
  if (!job?.id) return job;
  let token = job.applyLinkToken || null;
  if (!token) {
    token = await jobPublicApplyService.ensureApplyTokenForJob(job.id);
  }
  const applyUrl = token
    ? buildApplyUrlFromToken(token, undefined, job.tenantDbName || getActiveTenantDbName())
    : null;
  return {
    ...job,
    applyLinkToken: token,
    applyUrl,
    applicationFormSchema:
      job.applicationFormSchema ||
      (job.applicationFormEnabled
        ? jobPublicApplyService.resolveJobFormSchema(job)
        : null),
  };
}

async function enrichJobWithAssessments(job) {
  if (!job?.id) return enrichJobWithApplyLink(job);
  const enriched = await enrichJobWithApplyLink(job);
  const links = await preScreenAssessmentService.getJobLinks(job.id).catch(() => []);
  return { ...enriched, preScreenAssessments: links };
}

function resolveApplicationFormSchemaFromPayload(data) {
  if (data.applicationFormSchema) {
    return normalizeApplicationFormSchema(data.applicationFormSchema);
  }
  if (data.applicationFormEnabled && Array.isArray(data.applicationFormQuestions)?.length) {
    return schemaFromLegacyQuestions(data.applicationFormQuestions);
  }
  return data.applicationFormEnabled ? defaultApplicationFormSchema() : null;
}

/** First `getAll` per tenant awaits a one-time pipeline repair (empty / legacy → org template). */
const orgPipelineRepairPromiseByTenant = new Map();

async function ensureOrgPipelineTemplateRepairOnce() {
  const tenantDbName = getActiveTenantDbName();
  if (!tenantDbName) return;
  if (!orgPipelineRepairPromiseByTenant.has(tenantDbName)) {
    orgPipelineRepairPromiseByTenant.set(
      tenantDbName,
      (async () => {
        try {
          await applyOrgPipelineTemplateToEmptyJobs();
        } catch (error) {
          console.warn('[job.service] org pipeline repair skipped:', error?.message || error);
        }
      })()
    );
  }
  await orgPipelineRepairPromiseByTenant.get(tenantDbName);
}

// Helper function to get color for pipeline stage
function getStageColor(stageName) {
  const colorMap = {
    'Applied': '#3b82f6',
    'Screening': '#8b5cf6',
    'Screened': '#8b5cf6',
    'Technical Interview': '#f59e0b',
    'Interview': '#f59e0b',
    'HR Interview': '#10b981',
    'Offer': '#10b981',
    'Hired': '#059669',
    'Joined': '#059669',
  };
  return colorMap[stageName] || '#6b7280';
}

function mapStageToMatchStatus(stage) {
  const normalizedStage = String(stage || '').toLowerCase();

  if (normalizedStage.includes('shortlist')) return 'SHORTLISTED';
  if (normalizedStage.includes('reject')) return 'REJECTED';

  return 'REVIEWED';
}

const JOB_SALARY_CURRENCY_CODES = new Set(['USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'JPY']);

function normalizeSalaryCurrencyCode(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper) && JOB_SALARY_CURRENCY_CODES.has(upper)) return upper;
  const lower = trimmed.toLowerCase();
  if (lower.includes('rupee') || lower.includes('₹') || lower.includes('india')) return 'INR';
  if (lower.includes('dollar') || lower.includes('$') || lower.includes('usd')) return 'USD';
  if (lower.includes('euro') || lower.includes('€') || lower.includes('eur')) return 'EUR';
  if (lower.includes('pound') || lower.includes('£') || lower.includes('gbp')) return 'GBP';
  if (lower.includes('aed')) return 'AED';
  if (lower.includes('sgd')) return 'SGD';
  if (lower.includes('aud')) return 'AUD';
  if (lower.includes('cad')) return 'CAD';
  if (lower.includes('jpy') || lower.includes('yen')) return 'JPY';
  return upper.length === 3 ? upper : undefined;
}

function normalizeSalaryData(salary) {
  if (!salary || typeof salary !== 'object') return salary;

  const normalized = { ...salary };

  const toNum = (v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const minNum = toNum(normalized.min);
  const maxNum = toNum(normalized.max);
  if (minNum !== undefined) normalized.min = minNum;
  else delete normalized.min;
  if (maxNum !== undefined) normalized.max = maxNum;
  else delete normalized.max;

  if (normalized.amount !== undefined && normalized.amount !== null && normalized.amount !== '') {
    normalized.amount = String(normalized.amount).trim();
  } else {
    delete normalized.amount;
  }

  const currencyCode = normalizeSalaryCurrencyCode(normalized.currency);
  if (currencyCode) normalized.currency = currencyCode;
  else delete normalized.currency;

  if (normalized.type != null && String(normalized.type).trim() === '') delete normalized.type;

  return Object.keys(normalized).length ? normalized : null;
}

/**
 * Resolved client row (logo included) — portal listings use client.logo when no job-specific image URL exists.
 */
async function loadClientMirrorForPortalSync(job) {
  const clientId = job?.clientId;
  if (!clientId) return null;
  return prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, companyName: true, industry: true, logo: true, location: true },
  });
}

function resolvePortalSyncTenantDbName(job, payload = {}) {
  return (
    getActiveTenantDbName() ||
    String(job?.tenantDbName || '').trim() ||
    String(payload?.tenantDbName || '').trim() ||
    'default'
  );
}

const JOB_PUBLIC_VISIBILITY_FIELDS = [
  'nationality',
  'jobTitle',
  'client',
  'contactPerson',
  'openings',
  'location',
  'industryType',
  'employmentType',
  'targetHireDate',
  'experience',
  'salary',
  'languages',
  'keyResponsibilities',
  'qualifications',
  'candidateRequirements',
  'skills',
  'jobDescription',
  'videoMediaLink',
  'forecastRevenue',
  'priority',
];

function normalizePublicFieldVisibility(incoming, existing) {
  const merged = Object.fromEntries(JOB_PUBLIC_VISIBILITY_FIELDS.map((key) => [key, true]));
  const apply = (source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return;
    for (const key of JOB_PUBLIC_VISIBILITY_FIELDS) {
      if (source[key] === false) merged[key] = false;
      else if (source[key] === true) merged[key] = true;
    }
  };
  apply(existing);
  apply(incoming);
  return merged;
}

async function loadJobForPortalSync(jobId) {
  if (!jobId) return null;
  return prisma.job.findUnique({
    where: { id: jobId },
    include: {
      client: {
        select: { id: true, companyName: true, industry: true, logo: true, location: true },
      },
    },
  });
}

function isPortalSyncFieldVisible(visibility, showClient, field) {
  if (field === 'client') {
    if (showClient === false) return false;
    if (visibility && typeof visibility === 'object' && visibility.client === false) return false;
    return true;
  }
  if (!visibility || typeof visibility !== 'object') return true;
  return visibility[field] !== false;
}

const PORTAL_DESCRIPTION_SECTION_STRIP = {
  keyResponsibilities: [
    /^key responsibilities$/i,
    /^responsibilities$/i,
    /^role & responsibilities$/i,
  ],
  qualifications: [
    /^requirements$/i,
    /^required skills$/i,
    /^qualifications/i,
    /^preferred qualifications?$/i,
    /^preferred education/i,
  ],
  candidateRequirements: [/^candidate requirements?$/i],
  skills: [/^skills$/i, /^key skills$/i],
};

function stripHiddenPortalDescriptionSections(html, patterns) {
  const source = String(html || '').trim();
  if (!source || !Array.isArray(patterns) || !patterns.length) return source;
  const parts = source.split(/(?=<h[1-3][^>]*>)/i);
  if (parts.length <= 1) return source;
  const kept = [];
  for (const part of parts) {
    const headingMatch = part.match(/^<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    if (!headingMatch) {
      kept.push(part);
      continue;
    }
    const headingText = String(headingMatch[1] || '')
      .replace(/<[^>]+>/g, '')
      .trim();
    const shouldStrip = patterns.some((pattern) => pattern.test(headingText));
    if (!shouldStrip) kept.push(part);
  }
  return kept.join('').trim();
}

function scrubPortalDescriptionForVisibility(visibility, showClient, value) {
  if (!value || !isPortalSyncFieldVisible(visibility, showClient, 'jobDescription')) return value;
  const patterns = [];
  if (!isPortalSyncFieldVisible(visibility, showClient, 'keyResponsibilities')) {
    patterns.push(...PORTAL_DESCRIPTION_SECTION_STRIP.keyResponsibilities);
  }
  if (!isPortalSyncFieldVisible(visibility, showClient, 'qualifications')) {
    patterns.push(...PORTAL_DESCRIPTION_SECTION_STRIP.qualifications);
  }
  if (!isPortalSyncFieldVisible(visibility, showClient, 'candidateRequirements')) {
    patterns.push(...PORTAL_DESCRIPTION_SECTION_STRIP.candidateRequirements);
  }
  if (!isPortalSyncFieldVisible(visibility, showClient, 'skills')) {
    patterns.push(...PORTAL_DESCRIPTION_SECTION_STRIP.skills);
  }
  if (!patterns.length) return value;
  return stripHiddenPortalDescriptionSections(value, patterns) || null;
}

function applyVisibilityToPortalSyncPayload(jobPortalData, resolvedVisibility, resolvedShowClient) {
  const show = (field) => isPortalSyncFieldVisible(resolvedVisibility, resolvedShowClient, field);
  const out = { ...jobPortalData };

  if (!show('location')) {
    out.location = null;
    out.city = null;
    out.state = null;
    out.country = null;
  }
  if (!show('salary')) out.salary = null;
  if (!show('nationality')) out.nationality = null;
  if (!show('priority')) out.priority = null;
  if (!show('openings')) out.openings = null;
  if (!show('experience')) out.experienceRequired = null;
  if (!show('languages')) out.languages = null;
  if (!show('skills')) {
    out.skills = [];
    out.preferredSkills = [];
    out.requirements = [];
  }
  if (!show('keyResponsibilities')) out.keyResponsibilities = [];
  if (!show('qualifications')) {
    out.requirements = [];
    out.education = null;
  }
  if (!show('candidateRequirements')) out.candidateRequirements = [];
  if (!show('jobDescription')) {
    out.description = null;
    out.overview = null;
    out.benefits = [];
  } else {
    if (out.description) {
      out.description = scrubPortalDescriptionForVisibility(
        resolvedVisibility,
        resolvedShowClient,
        out.description,
      );
    }
    if (out.overview) {
      out.overview = scrubPortalDescriptionForVisibility(
        resolvedVisibility,
        resolvedShowClient,
        out.overview,
      );
    }
  }
  if (!show('videoMediaLink')) out.videoMediaLink = null;
  if (!show('forecastRevenue')) out.forecastRevenue = null;
  if (!show('contactPerson')) {
    out.hiringManager = null;
    out.hiringManagerId = null;
  }
  if (!show('industryType')) {
    out.department = null;
    out.jobCategory = null;
  }
  if (!show('targetHireDate')) out.expectedClosureDate = null;
  if (!show('employmentType')) out.type = null;

  return out;
}

async function invalidatePortalJobsListCache() {
  const base = String(env.JOB_PORTAL_API_URL || '').trim().replace(/\/$/, '');
  if (!base) return;
  try {
    const response = await fetch(`${base}/api/jobs/cache/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      console.warn(`[syncJobToJobPortalDb] cache invalidate HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn('[syncJobToJobPortalDb] cache invalidate failed:', error?.message || error);
  }
}

function queueCandidateJobMatchAlerts(jobId) {
  const id = String(jobId || '').trim();
  const base = String(env.JOB_PORTAL_API_URL || '').trim().replace(/\/$/, '');
  if (!id || !base) return;

  const secret =
    String(process.env.PHASE2_PORTAL_SYNC_SECRET || '').trim() ||
    'phase2-portal-sync-2026-shared-secret';

  setImmediate(() => {
    fetch(`${base}/api/internal/job-match-alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-phase2-portal-sync-secret': secret,
      },
      body: JSON.stringify({ jobId: id }),
    }).catch((error) => {
      console.warn('[job.service] job-match-alerts request failed:', error?.message || error);
    });
  });
}

/** Re-mirror a job to the candidate portal (e.g. after assessment links change). */
export async function refreshJobPortalMirror(jobId) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  await syncJobToPortal(job, {});
}

async function syncJobToPortal(job, payload = {}) {
  const jobForSync = (await loadJobForPortalSync(job?.id)) || job;
  const mergedForSync = {
    ...jobForSync,
    ...(payload.publicFieldVisibility && typeof payload.publicFieldVisibility === 'object'
      ? { publicFieldVisibility: payload.publicFieldVisibility }
      : {}),
    ...(payload.showClientNamePublicly !== undefined
      ? { showClientNamePublicly: payload.showClientNamePublicly !== false }
      : {}),
  };
  await syncJobToJobPortalDb(mergedForSync, payload);
}

async function syncJobToJobPortalDb(job, payload = {}) {
  const tenantDbName = resolvePortalSyncTenantDbName(job, payload);

  // Mirror into the shared job-portal DB (JOB_PORTAL_DATABASE_URL), not tenant/default DATABASE_URL.
  // backend1 `/api/jobs` reads this DB — screening questions must land here or Apply shows no modal.
  const portalPrisma = getJobPortalPrismaClient();

  // Mirror tenant client into the portal DB — company name, industry, location, **and logo**
  // — so Explore Jobs shows the same image as Clients / converted Leads.
  const mirrorClient = await loadClientMirrorForPortalSync(job);
  if (mirrorClient?.id && mirrorClient.companyName) {
    try {
      await portalPrisma.client.upsert({
        where: { id: mirrorClient.id },
        create: {
          id: mirrorClient.id,
          companyName: mirrorClient.companyName,
          industry: mirrorClient.industry || null,
          logo: mirrorClient.logo || null,
          location: mirrorClient.location || job.location || null,
          status: 'ACTIVE',
        },
        update: {
          companyName: mirrorClient.companyName,
          industry: mirrorClient.industry || null,
          logo: mirrorClient.logo ?? null,
          location: mirrorClient.location || job.location || null,
        },
      });
    } catch (clientSyncError) {
      console.error(
        `Job portal sync: failed to mirror client ${mirrorClient.id}, proceeding with job sync.`,
        clientSyncError?.message || clientSyncError
      );
    }
  }

  const resolvedShowClient =
    payload.showClientNamePublicly !== undefined
      ? payload.showClientNamePublicly !== false
      : job.showClientNamePublicly === false
        ? false
        : true;
  const resolvedVisibility = normalizePublicFieldVisibility(
    payload.publicFieldVisibility && typeof payload.publicFieldVisibility === 'object'
      ? payload.publicFieldVisibility
      : null,
    job.publicFieldVisibility && typeof job.publicFieldVisibility === 'object'
      ? job.publicFieldVisibility
      : null,
  );

  const jobPortalData = applyVisibilityToPortalSyncPayload(
    {
    title: job.title,
    location: job.location || null,
    description: job.description || null,
    overview: job.overview || null,
    requirements: Array.isArray(job.requirements) ? job.requirements : [],
    skills: Array.isArray(job.skills) ? job.skills : [],
    preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
    keyResponsibilities: Array.isArray(job.keyResponsibilities) ? job.keyResponsibilities : [],
    candidateRequirements: Array.isArray(job.candidateRequirements) ? job.candidateRequirements : [],
    type: job.type ? String(job.type) : 'FULL_TIME',
    status: ['CLOSED', 'FILLED'].includes(String(job.status || '').toUpperCase()) ? 'CLOSED' : 'OPEN',
    // Origin tenant — backend1 reads this on every apply to route the new
    // Application / Match / pipeline write into the correct tenant DB.
    // Carrying it on every Job means the system supports as many agencies /
    // tenants as needed without any per-deployment env config.
    tenantDbName,
    clientId: job.clientId || null,
    assignedToId: job.assignedToId || null,
    createdById: job.createdById || null,
    openings: job.openings || 1,
    salary: job.salary || null,
    experienceRequired: job.experienceRequired || null,
    education: job.education || null,
    benefits: Array.isArray(job.benefits) ? job.benefits : [],
    hiringManager: job.hiringManager || null,
    hiringManagerId: job.hiringManagerId || null,
    priority: job.priority || null,
    department: job.department || null,
    jobCategory: job.jobCategory || null,
    jobLocationType: job.jobLocationType || null,
    workMode: job.workMode || null,
    expectedClosureDate: job.expectedClosureDate || null,
    jdFileName: job.jdFileName || null,
    hot: Boolean(job.hot),
    aiMatch: Boolean(job.aiMatch),
    noCandidates: Boolean(job.noCandidates),
    slaRisk: Boolean(job.slaRisk),
    visibility: job.visibility || null,
    showClientNamePublicly: resolvedShowClient,
    publicFieldVisibility: resolvedVisibility,
    distributionPlatforms: job.distributionPlatforms || null,
    supportingRecruiters: Array.isArray(job.supportingRecruiters) ? job.supportingRecruiters : [],
    applicationFormEnabled: Boolean(job.applicationFormEnabled),
    applicationFormLogo: job.applicationFormLogo || null,
    applicationFormQuestions: Array.isArray(job.applicationFormQuestions) ? job.applicationFormQuestions : [],
    applicationFormNote: job.applicationFormNote || null,
    preScreenAssessments: await preScreenAssessmentService.getPortalJobAssessments(job.id).catch(() => []),
    nationality: job.nationality || null,
    country: job.country || null,
    state: job.state || null,
    city: job.city || null,
    languages: job.languages || null,
    forecastRevenue: job.forecastRevenue || null,
    videoMediaLink: job.videoMediaLink || null,
    postedDate: job.postedDate || job.createdAt || null,
  },
    resolvedVisibility,
    resolvedShowClient,
  );

  // MongoDB Atlas rejects Prisma update/upsert when the aggregation pipeline exceeds 50 stages.
  // Use raw Mongo $set upsert (with chunked Prisma fallback) instead.
  await upsertPortalJobDocument(portalPrisma, job.id, jobPortalData);

  console.log(
    `[syncJobToJobPortalDb] mirrored job ${job.id} → portal DB (tenant=${tenantDbName}, showClient=${jobPortalData.showClientNamePublicly}, visibilityKeys=${resolvedVisibility ? Object.keys(resolvedVisibility).filter((k) => resolvedVisibility[k] === false).join(',') || 'all-visible' : 'default'})`,
  );

  const activeTenant = getActiveTenantDbName();
  if (activeTenant && job?.id && job.tenantDbName !== activeTenant) {
    try {
      await prisma.job.update({
        where: { id: job.id },
        data: { tenantDbName: activeTenant },
      });
    } catch (tenantStampError) {
      console.warn(
        `[syncJobToJobPortalDb] could not stamp tenantDbName on job ${job.id}:`,
        tenantStampError?.message || tenantStampError,
      );
    }
  }

  // Mirror this job's pipeline stages into the portal DB so the
  // candidate-portal application-detail view can resolve the per-job
  // stage flow ("Applied → Screening → Interview → Offer …") AND so
  // backend1's `syncApplicationToRecruiterView` can create a per-job
  // PipelineEntry on every apply. Without this, freshly-created portal
  // jobs have no pipeline_stages rows, the apply-time pipeline-entry
  // create bails on "no first stage", and the application detail page
  // is forced to fall back on the global `candidate.stage` (which then
  // bleeds previous-job rejections into brand-new applications).
  try {
    const tenantStages = await prisma.pipelineStage.findMany({
      where: { jobId: job.id },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, order: true, color: true },
    });
    if (tenantStages.length) {
      // Replace-and-rewrite is safer than per-row diff: stage IDs are
      // referenced by `pipeline_entries`, so we delete in two steps to
      // keep referential integrity in the portal DB.
      await portalPrisma.pipelineEntry.deleteMany({
        where: { jobId: job.id, NOT: { stageId: { in: tenantStages.map((s) => s.id) } } },
      });
      for (const stage of tenantStages) {
        await portalPrisma.pipelineStage.upsert({
          where: { id: stage.id },
          create: {
            id: stage.id,
            jobId: job.id,
            name: stage.name,
            order: stage.order,
            color: stage.color || null,
          },
          update: {
            name: stage.name,
            order: stage.order,
            color: stage.color || null,
          },
        });
      }
      // Drop any portal pipeline_stages for this job that no longer exist
      // on the tenant side (e.g. recruiter customised the pipeline and
      // removed a stage).
      await portalPrisma.pipelineStage.deleteMany({
        where: {
          jobId: job.id,
          NOT: { id: { in: tenantStages.map((s) => s.id) } },
        },
      });
    }
  } catch (pipelineMirrorError) {
    console.warn(
      `[syncJobToJobPortalDb] pipeline-stages mirror failed for job ${job.id} (non-fatal):`,
      pipelineMirrorError?.message || pipelineMirrorError
    );
  }

  await invalidatePortalJobsListCache();
}

/**
 * Remove portal / Phase 1 job mirror so backend1 & public listings stay in sync with tenant deletes.
 * Jobs are upserted to `getDefaultPrismaClient()` (DATABASE_URL); applications may live on
 * JOB_PORTAL_DATABASE_URL when it differs from DATABASE_URL.
 */
async function deleteAppsForJob(client, jobId) {
  const applications = await client.application.findMany({
    where: { jobId },
    select: { id: true },
  });
  const applicationIds = applications.map((a) => a.id);
  if (applicationIds.length) {
    await client.applicationTimeline.deleteMany({
      where: { applicationId: { in: applicationIds } },
    });
  }
  await client.application.deleteMany({ where: { jobId } });
}

async function safeDeleteJobRow(client, jobId) {
  try {
    await client.job.delete({ where: { id: jobId } });
  } catch (e) {
    const code = e?.code;
    const msg = String(e?.message || '');
    if (
      code === 'P2025' ||
      msg.includes('Record to delete does not exist') ||
      msg.includes('No record was found')
    ) {
      return;
    }
    throw e;
  }
}

export async function removeJobFromPortalDatabases(jobId) {
  const defaultDb = getDefaultPrismaClient();
  const portalDb = getJobPortalPrismaClient();

  if (defaultDb === portalDb) {
    await defaultDb.$transaction(async (tx) => {
      await deleteAppsForJob(tx, jobId);
      await safeDeleteJobRow(tx, jobId);
    });
  } else {
    await portalDb.$transaction(async (tx) => {
      await deleteAppsForJob(tx, jobId);
      await safeDeleteJobRow(tx, jobId);
    });

    await defaultDb.$transaction(async (tx) => {
      await deleteAppsForJob(tx, jobId);
      await safeDeleteJobRow(tx, jobId);
    });
  }

  await invalidatePortalJobsListCache();
}

async function deleteMirroredJobForPhase1(jobId) {
  if (!getActiveTenantDbName()) return;
  await removeJobFromPortalDatabases(jobId);
}

function isTenantScopedRequest() {
  return Boolean(getActiveTenantDbName());
}

async function getPortalMatchCountMap(jobIds = []) {
  if (!isTenantScopedRequest() || !Array.isArray(jobIds) || !jobIds.length) {
    return new Map();
  }

  const portalPrisma = getDefaultPrismaClient();
  const rows = await portalPrisma.match.findMany({
    where: { jobId: { in: jobIds } },
    select: { jobId: true },
  });

  const counts = new Map();
  for (const row of rows) {
    if (!row?.jobId) continue;
    counts.set(row.jobId, (counts.get(row.jobId) || 0) + 1);
  }
  return counts;
}

/**
 * Unique candidates who actually applied to each job (applications + job-linked matches),
 * merged across tenant and job portal DB without double-counting.
 */
async function getMergedAppliedCountByJobId(jobIds = []) {
  const counts = new Map();
  if (!Array.isArray(jobIds) || !jobIds.length) return counts;

  const uniqIds = [...new Set(jobIds.map((id) => String(id || '').trim()).filter(Boolean))];
  const pairsByJob = new Map();

  const addPair = (jobId, candidateId) => {
    const j = String(jobId || '').trim();
    const c = String(candidateId || '').trim();
    if (!j || !c) return;
    if (!pairsByJob.has(j)) pairsByJob.set(j, new Set());
    pairsByJob.get(j).add(c);
  };

  const [tenantApplications, tenantMatches] = await Promise.all([
    prisma.application.findMany({
      where: { jobId: { in: uniqIds } },
      select: { jobId: true, candidateId: true },
    }),
    prisma.match.findMany({
      where: { jobId: { in: uniqIds } },
      select: {
        id: true,
        jobId: true,
        candidateId: true,
        evaluation: true,
        createdById: true,
      },
    }),
  ]);

  for (const app of tenantApplications) addPair(app.jobId, app.candidateId);

  let portalMatches = [];
  let portalApplications = [];
  if (isTenantScopedRequest()) {
    const portalPrisma = getDefaultPrismaClient();
    [portalMatches, portalApplications] = await Promise.all([
      portalPrisma.match.findMany({
        where: { jobId: { in: uniqIds } },
        select: {
          id: true,
          jobId: true,
          candidateId: true,
          evaluation: true,
          createdById: true,
        },
      }),
      portalPrisma.application.findMany({
        where: { jobId: { in: uniqIds } },
        select: { jobId: true, candidateId: true },
      }),
    ]);
    for (const app of portalApplications) addPair(app.jobId, app.candidateId);
  }

  const jobLinkedMatches = mergeJobMatches(tenantMatches, portalMatches);
  for (const match of jobLinkedMatches) addPair(match.jobId, match.candidateId);

  for (const jobId of uniqIds) {
    counts.set(jobId, pairsByJob.get(jobId)?.size || 0);
  }
  return counts;
}

function hydrateAppliedPipelineStageCounts(pipelineStages = [], appliedCount = 0) {
  if (!appliedCount || !Array.isArray(pipelineStages) || !pipelineStages.length) {
    return pipelineStages;
  }
  return pipelineStages.map((stage) => {
    const role = String(stage?.systemRole || '').toUpperCase();
    const isApplied =
      role === 'APPLIED' || /^applied$/i.test(String(stage?.name || '').trim());
    const entryCount = Number(stage?._count?.entries ?? stage?.entriesCount ?? 0);
    if (!isApplied || entryCount > 0) return stage;
    return {
      ...stage,
      _count: { ...(stage._count || {}), entries: appliedCount },
      entriesCount: appliedCount,
    };
  });
}

function attachAppliedCountsToJobs(jobs = [], appliedCountMap = new Map()) {
  return jobs.map((job) => {
    const appliedCount = Number(appliedCountMap.get(job.id) || 0);
    const pipelineStages = hydrateAppliedPipelineStageCounts(job.pipelineStages, appliedCount);
    return {
      ...job,
      appliedCount,
      pipelineStages,
      _count: {
        ...(job._count || {}),
        applications: Math.max(Number(job?._count?.applications || 0), appliedCount),
      },
      noCandidates: appliedCount === 0 ? job.noCandidates : false,
    };
  });
}

function isJobLinkedMatchRow(match) {
  const evaluation = match?.evaluation;
  if (evaluation && typeof evaluation === 'object' && evaluation.origin != null) {
    const origin = String(evaluation.origin);
    if (origin === 'ai' || origin === 'tenant' || origin === 'phase1') return false;
    if (origin === 'applied') return true;
  }
  return Boolean(match?.createdById);
}

function mergeJobMatches(tenantMatches = [], portalMatches = []) {
  const mergedByKey = new Map();
  for (const match of portalMatches) {
    const key = match?.candidateId || `match:${match?.id || Math.random()}`;
    mergedByKey.set(key, match);
  }
  for (const match of tenantMatches) {
    const key = match?.candidateId || `match:${match?.id || Math.random()}`;
    mergedByKey.set(key, match);
  }
  return Array.from(mergedByKey.values()).filter(isJobLinkedMatchRow);
}

function mergeJobApplications(tenantApplications = [], portalApplications = []) {
  const mergedByKey = new Map();
  const pickNewer = (a, b) => {
    const aTs = a?.appliedAt ? new Date(a.appliedAt).getTime() : 0;
    const bTs = b?.appliedAt ? new Date(b.appliedAt).getTime() : 0;
    return bTs >= aTs ? b : a;
  };
  const mergeOne = (app) => {
    if (!app) return;
    const candId = String(app.candidateId || '').trim();
    const jobId = String(app.jobId || '').trim();
    const key = candId && jobId ? `${candId}:${jobId}` : String(app.id || '').trim();
    if (!key) return;
    const existing = mergedByKey.get(key);
    mergedByKey.set(key, existing ? pickNewer(existing, app) : app);
  };
  for (const app of portalApplications) mergeOne(app);
  for (const app of tenantApplications) mergeOne(app);
  return Array.from(mergedByKey.values()).sort((a, b) => {
    const aTs = a?.appliedAt ? new Date(a.appliedAt).getTime() : 0;
    const bTs = b?.appliedAt ? new Date(b.appliedAt).getTime() : 0;
    return bTs - aTs;
  });
}

export const jobService = {
  async getPublicFeed(req) {
    const rawLimit = Number.parseInt(String(req.query?.limit || '200'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 200;

    const jobs = await prisma.job.findMany({
      where: {
        status: 'OPEN',
      },
      take: limit,
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
            logo: true,
            industry: true,
            location: true,
          },
        },
      },
      orderBy: [
        { postedDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return jobs.map((job) => ({
      id: job.id,
      source: 'phase2',
      clientId: job.clientId || null,
      title: job.title,
      description: job.description || null,
      overview: job.overview || null,
      requirements: Array.isArray(job.requirements) ? job.requirements : [],
      skills: Array.isArray(job.skills) ? job.skills : [],
      preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
      keyResponsibilities: Array.isArray(job.keyResponsibilities) ? job.keyResponsibilities : [],
      candidateRequirements: Array.isArray(job.candidateRequirements) ? job.candidateRequirements : [],
      location: job.location || null,
      type: job.type || null,
      status: job.status,
      openings: job.openings ?? 1,
      experienceRequired: job.experienceRequired || null,
      education: job.education || null,
      benefits: Array.isArray(job.benefits) ? job.benefits : [],
      postedDate: job.postedDate || job.createdAt || null,
      hiringManager: job.hiringManager || null,
      department: job.department || null,
      jobCategory: job.jobCategory || null,
      jobLocationType: job.jobLocationType || null,
      workMode: job.workMode || null,
      priority: job.priority || null,
      salary: job.salary || null,
      company: job.client
        ? {
            id: job.client.id,
            companyName: job.client.companyName,
            logo: job.client.logo || null,
            industry: job.client.industry || null,
            location: job.client.location || null,
          }
        : null,
    }));
  },

  async notifyAssignment(job, performedById) {
    if (!job?.assignedTo?.email) return;

    try {
      const assignedBy = performedById
        ? await prisma.user.findUnique({
            where: { id: performedById },
            select: { name: true },
          })
        : null;

      await sendJobAssignmentEmail({
        toEmail: job.assignedTo.email,
        assigneeName: job.assignedTo.name,
        jobTitle: job.title,
        clientCompanyName: job.client?.companyName || null,
        jobLocation: job.location,
        jobType: job.type,
        jobStatus: job.status,
        openings: job.openings,
        assignedByName: assignedBy?.name || null,
        senderUserId: performedById,
      });

      if (job.assignedToId) {
        await createAlertNotification(job.assignedToId, 'job.assigned', {
          category: 'JOB',
          title: 'Job assigned to you',
          description: `${job.title || 'A job'} was assigned to you${
            assignedBy?.name ? ` by ${assignedBy.name}` : ''
          }.`,
          actionLabel: 'Open job',
          actionPath: `/job?jobId=${job.id}`,
          entityType: 'JOB',
          entityId: job.id,
        });
      }
    } catch (emailError) {
      console.error('Failed to send job assignment email:', emailError);
    }
  },

  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, clientId, assignedToId, search, mine, ids } = req.query;

    await ensureOrgPipelineTemplateRepairOnce();

    const where = {};
    if (status) where.status = status;

    // Some legacy rows may exist with `clientId: null`.
    // `Job.clientId` is optional in Prisma now, so we should avoid filtering logic.
    // Also sanitize query values like the string "null".
    const safeClientId = clientId && clientId !== 'null' ? clientId : undefined;
    const safeAssignedToId = assignedToId && assignedToId !== 'null' ? assignedToId : undefined;

    if (safeClientId) where.clientId = safeClientId;

    if (safeAssignedToId) where.assignedToId = safeAssignedToId;

    // Jobs page: only jobs created by the authenticated user (no seeded/dummy rows unless they match)
    const mineFilter = mine === 'true' || mine === '1';
    if (mineFilter && req.user?.id) {
      where.createdById = req.user.id;
    } else if (!canViewAllJobs(req) && req.user?.id) {
      where.OR = buildAssigneeVisibilityOr(req.user.id);
    }
    if (search) {
      const escaped = escapePrismaRegex(search);
      where.OR = [
        { title: { contains: escaped, mode: 'insensitive' } },
        { description: { contains: escaped, mode: 'insensitive' } },
        { overview: { contains: escaped, mode: 'insensitive' } },
        { location: { contains: escaped, mode: 'insensitive' } },
        { country: { contains: escaped, mode: 'insensitive' } },
        { state: { contains: escaped, mode: 'insensitive' } },
        { city: { contains: escaped, mode: 'insensitive' } },
        { nationality: { contains: escaped, mode: 'insensitive' } },
        { experienceRequired: { contains: escaped, mode: 'insensitive' } },
        { education: { contains: escaped, mode: 'insensitive' } },
        { hiringManager: { contains: escaped, mode: 'insensitive' } },
        { department: { contains: escaped, mode: 'insensitive' } },
        { jobCategory: { contains: escaped, mode: 'insensitive' } },
        { workMode: { contains: escaped, mode: 'insensitive' } },
        { priority: { contains: escaped, mode: 'insensitive' } },
        { skills: { hasSome: [search] } },
        { requirements: { hasSome: [search] } },
        { keyResponsibilities: { hasSome: [search] } },
        { preferredSkills: { hasSome: [search] } },
        { candidateRequirements: { hasSome: [search] } },
        { benefits: { hasSome: [search] } },
        { client: { companyName: { contains: escaped, mode: 'insensitive' } } },
      ];
    }
    const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    let scopedWhere = mergeWhereWithScope(where, superAdminScope);
    // Recycle Bin: hide soft-deleted rows from the normal Jobs page.
    // `not: true` matches false, null, and missing-field documents (legacy rows from before
    // the soft-delete column existed) without tripping Prisma's "Argument isDeleted is missing".
    scopedWhere = { AND: [scopedWhere, { isDeleted: { not: true } }] };

    if (ids) {
      const idList = String(ids)
        .split(',')
        .map((value) => value.trim())
        .filter((value) => /^[a-fA-F0-9]{24}$/.test(value));
      if (idList.length) {
        scopedWhere = { AND: [scopedWhere, { id: { in: idList } }] };
      }
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: scopedWhere,
        skip,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              companyName: true,
              logo: true,
              emails: true,
              teamMemberEmail: true,
              contacts: {
                where: { status: 'ACTIVE' },
                orderBy: { updatedAt: 'desc' },
                take: 10,
                select: { email: true, contactType: true },
              },
            },
          },
          assignedTo: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          createdBy: {
            select: USER_BRIEF_SELECT,
          },
          // Per-stage data so the Jobs table can render a dynamic pipeline column
          // (e.g. agency uses Applied/Screened/Interview/Offer/Joined while standalone
          // uses the org template the tenant configured in Settings → Recruitment workflow).
          pipelineStages: {
            select: {
              id: true,
              name: true,
              order: true,
              color: true,
              systemRole: true,
              _count: { select: { entries: true } },
            },
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { matches: true, interviews: true, placements: true, applications: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.job.count({ where: scopedWhere }),
    ]);

    if (jobs.length) {
      const appliedCountMap = await getMergedAppliedCountByJobId(jobs.map((job) => job.id));
      const mergedJobs = attachAppliedCountsToJobs(jobs, appliedCountMap);
      const withAudit = await prepareListWithAuditMeta(mergedJobs, ENTITY_TYPES.JOB);
      return formatPaginationResponse(withAudit, page, limit, total);
    }

    const withAudit = await prepareListWithAuditMeta(jobs, ENTITY_TYPES.JOB);
    return formatPaginationResponse(withAudit, page, limit, total);
  },

  async getById(id, req = null) {
    let where = { id };
    const scope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    where = mergeWhereWithScope(where, scope);
    if (!canViewAllJobs(req) && req?.user?.id) {
      where = mergeWhereWithScope(where, { OR: buildAssigneeVisibilityOr(req.user.id) });
    }

    const job = await prisma.job.findFirst({
      where,
      include: {
        client: true,
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        createdBy: {
          select: USER_BRIEF_SELECT,
        },
        manager: {
          select: { id: true, name: true, email: true },
        },
        pipelineStages: {
          include: {
            entries: {
              include: {
                candidate: {
                  select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        matches: {
          include: {
            candidate: true,
          },
        },
        applications: {
          include: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
        },
        interviews: {
          include: {
            candidate: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        notes: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        files: {
          include: {
            uploadedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!job) return null;

    const appliedCountMap = await getMergedAppliedCountByJobId([id]);
    const appliedCount = Number(appliedCountMap.get(id) || 0);
    const baseWithApplied = {
      ...job,
      appliedCount,
      pipelineStages: hydrateAppliedPipelineStageCounts(job.pipelineStages, appliedCount),
      _count: {
        ...(job._count || {}),
        applications: Math.max(
          Number(job._count?.applications || 0),
          Array.isArray(job.applications) ? job.applications.length : 0,
          appliedCount
        ),
      },
    };

    if (!isTenantScopedRequest()) {
      const withAudit = await attachAuditMetaToEntity(baseWithApplied, ENTITY_TYPES.JOB);
      return enrichJobWithAssessments(withAudit);
    }

    const portalPrisma = getJobPortalPrismaClient();
    const portalJob = await portalPrisma.job.findUnique({
      where: { id },
      include: {
        matches: {
          include: {
            candidate: true,
          },
        },
        applications: {
          include: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
        },
      },
    });

    if (!portalJob?.matches?.length && !portalJob?.applications?.length) {
      const withAudit = await attachAuditMetaToEntity(baseWithApplied, ENTITY_TYPES.JOB);
      return enrichJobWithAssessments(withAudit);
    }

    const mergedMatches = mergeJobMatches(job.matches || [], portalJob.matches || []);
    const mergedApplications = mergeJobApplications(job.applications || [], portalJob.applications || []);
    const mergedAppliedCount = mergedApplications.length || mergedMatches.length || appliedCount;

    const mergedJob = {
      ...baseWithApplied,
      matches: mergedMatches,
      applications: mergedApplications,
      appliedCount: mergedAppliedCount,
      pipelineStages: hydrateAppliedPipelineStageCounts(
        baseWithApplied.pipelineStages,
        mergedAppliedCount
      ),
      _count: {
        matches: mergedMatches.length,
        applications: mergedApplications.length,
        interviews: Array.isArray(job.interviews) ? job.interviews.length : 0,
        placements: Array.isArray(job.placements) ? job.placements.length : 0,
      },
    };
    const withAudit = await attachAuditMetaToEntity(mergedJob, ENTITY_TYPES.JOB);
    return enrichJobWithAssessments(withAudit);
  },

  async create(data, createdByUserId) {
    await assertCanCreateJob();

    // Utility function to remove undefined values
    const removeUndefined = (obj) => {
      return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== undefined)
      );
    };

    const jobData = removeUndefined({
      title: data.title,
      description: data.description,
      overview: data.overview,
      requirements: data.requirements || [],
      skills: data.skills || [],
      preferredSkills: data.preferredSkills || [],
      keyResponsibilities: data.keyResponsibilities || [],
      candidateRequirements: data.candidateRequirements || [],
      location: data.location,
      type: data.type || 'FULL_TIME',
      status: data.status || 'OPEN', // Default to OPEN when creating from client drawer
      openings: data.openings || 1,
      salary: normalizeSalaryData(data.salary),
      experienceRequired: data.experienceRequired,
      education: data.education,
      benefits: data.benefits || [],
      postedDate: data.postedDate ? new Date(data.postedDate) : null,
      hiringManager: data.hiringManager,
      hiringManagerId: data.hiringManagerId, // Support hiringManagerId from frontend
      department: data.department,
      jobCategory: data.jobCategory,
      jobLocationType: data.jobLocationType,
      workMode: data.workMode || data.jobLocationType,
      expectedClosureDate: data.expectedClosureDate ? new Date(data.expectedClosureDate) : null,
      jdFileName: data.jdFileName,
      hot: data.hot || false,
      aiMatch: data.aiMatch || false,
      noCandidates: data.noCandidates || false,
      slaRisk: data.slaRisk || false,
      applicationFormEnabled: data.applicationFormEnabled || false,
      applicationFormLogo: data.applicationFormLogo,
      applicationFormQuestions: data.applicationFormQuestions || [],
      applicationFormNote: data.applicationFormNote,
      applicationFormSchema: resolveApplicationFormSchemaFromPayload(data),
      distributionPlatforms: data.distributionPlatforms,
      priority: data.priority,
      nationality: data.nationality,
      country: data.country,
      state: data.state,
      city: data.city,
      forecastRevenue: data.forecastRevenue,
      videoMediaLink: data.videoMediaLink,
      languages: data.languages,
      supportingRecruiters: data.supportingRecruiters,
      showClientNamePublicly: data.showClientNamePublicly !== false,
      publicFieldVisibility:
        data.publicFieldVisibility && typeof data.publicFieldVisibility === 'object'
          ? normalizePublicFieldVisibility(data.publicFieldVisibility, null)
          : null,
    });

    if (data.clientId) {
      jobData.client = { connect: { id: data.clientId } };
    }

    if (data.assignedToId) {
      jobData.assignedTo = { connect: { id: data.assignedToId } };
    }

    if (data.managerId) {
      jobData.manager = { connect: { id: data.managerId } };
    }

    if (createdByUserId) {
      jobData.createdBy = { connect: { id: createdByUserId } };
    }

    jobData.participantIds = buildInitialParticipantIds(
      createdByUserId,
      data.assignedToId,
    );

    // Log data being stored
    dbLogger.logCreate('JOB', jobData);

    const job = await prisma.job.create({
      data: jobData,
      include: {
        client: {
          select: { id: true, companyName: true, industry: true, logo: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Create pipeline stages when provided, or seed from org default template (agency + standalone).
    let pipelineStages = Array.isArray(data.pipelineStages) ? data.pipelineStages : [];
    if (pipelineStages.length === 0) {
      try {
        pipelineStages = await getDefaultPipelineTemplate();
      } catch (modeErr) {
        console.warn('[job.create] default pipeline template read failed, skipping seed:', modeErr?.message || modeErr);
      }
    }
    if (pipelineStages.length > 0) {
      const stagesToCreate = pipelineStages.map((stage, index) => {
        const name = typeof stage === 'string' ? stage : stage.name || `Stage ${index + 1}`;
        const order = typeof stage === 'object' && stage.order != null ? Number(stage.order) : index + 1;
        const color =
          typeof stage === 'object' && stage.color
            ? String(stage.color)
            : getStageColor(name);
        const systemRoleRaw =
          typeof stage === 'object' && stage.systemRole != null && String(stage.systemRole).trim()
            ? String(stage.systemRole).trim().toUpperCase()
            : null;
        return {
          name,
          order,
          color,
          jobId: job.id,
          systemRole: systemRoleRaw,
        };
      });

      await Promise.all(
        stagesToCreate.map((row) =>
          prisma.pipelineStage.create({
            data: row,
          })
        )
      );
    }

    // Log created job with ID
    console.log(`✅ Job created successfully with ID: ${job.id}\n`);

    if (createdByUserId) {
      await activityService.logJobCreated({
        entityId: job.id,
        performedById: createdByUserId,
        entityName: job.title,
        metadata: {
          status: job.status,
          clientId: job.clientId || null,
        },
        clientId: job.clientId || undefined,
      });
    }

    if (job.assignedToId) {
      await this.notifyAssignment(job, createdByUserId);
    }

    if (Array.isArray(data.preScreenAssessments)) {
      await preScreenAssessmentService.replaceJobLinks(job.id, data.preScreenAssessments);
    }

    try {
      await syncJobToPortal(job, data);
      if (String(job.status || '').toUpperCase() === 'OPEN') {
        queueCandidateJobMatchAlerts(job.id);
      }
    } catch (syncError) {
      console.error(`Failed to sync job ${job.id} to job portal DB:`, syncError?.message || syncError);
    }

    queueAiEntryRecommendation({
      entityType: 'JOB',
      entityId: job.id,
      entityLabel: job.title || 'Job',
      snapshot: buildEntitySnapshot('JOB', job),
      recipientUserId: job.assignedToId || createdByUserId,
      actorUserId: createdByUserId,
      trigger: 'create',
    });

    return enrichJobWithAssessments(job);
  },

  async update(id, data) {
    const currentJob = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        overview: true,
        requirements: true,
        skills: true,
        preferredSkills: true,
        keyResponsibilities: true,
        location: true,
        type: true,
        status: true,
        clientId: true,
        assignedToId: true,
        createdById: true,
        participantIds: true,
        openings: true,
        salary: true,
        experienceRequired: true,
        education: true,
        benefits: true,
        postedDate: true,
        hiringManager: true,
        hiringManagerId: true,
        department: true,
        jobCategory: true,
        jobLocationType: true,
        expectedClosureDate: true,
        jdFileName: true,
        hot: true,
        aiMatch: true,
        noCandidates: true,
        slaRisk: true,
        workMode: true,
        priority: true,
        visibility: true,
        showClientNamePublicly: true,
        publicFieldVisibility: true,
        distributionPlatforms: true,
        supportingRecruiters: true,
        applicationFormEnabled: true,
        applicationFormLogo: true,
        applicationFormQuestions: true,
        applicationFormNote: true,
      },
    });

    if (!currentJob) {
      throw new Error('Job not found');
    }

    // Utility function to remove undefined values
    const removeUndefined = (obj) => {
      return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== undefined)
      );
    };

    const updateData = removeUndefined({
      title: data.title,
      description: data.description,
      overview: data.overview,
      requirements: data.requirements,
      skills: data.skills,
      preferredSkills: data.preferredSkills,
      keyResponsibilities: data.keyResponsibilities,
      candidateRequirements: data.candidateRequirements,
      location: data.location,
      type: data.type,
      status: data.status,
      clientId: data.clientId,
      assignedToId: data.assignedToId,
      openings: data.openings,
      salary: normalizeSalaryData(data.salary),
      experienceRequired: data.experienceRequired,
      education: data.education,
      benefits: data.benefits,
      postedDate: data.postedDate ? new Date(data.postedDate) : undefined,
      hiringManager: data.hiringManager,
      hiringManagerId: data.hiringManagerId,
      department: data.department,
      jobCategory: data.jobCategory,
      jobLocationType: data.jobLocationType,
      expectedClosureDate: data.expectedClosureDate ? new Date(data.expectedClosureDate) : undefined,
      jdFileName: data.jdFileName,
      hot: data.hot,
      aiMatch: data.aiMatch,
      noCandidates: data.noCandidates,
      slaRisk: data.slaRisk,
      workMode: data.workMode,
      priority: data.priority,
      visibility: data.visibility,
      showClientNamePublicly:
        data.showClientNamePublicly === undefined
          ? undefined
          : data.showClientNamePublicly !== false,
      publicFieldVisibility:
        data.publicFieldVisibility && typeof data.publicFieldVisibility === 'object'
          ? normalizePublicFieldVisibility(
              data.publicFieldVisibility,
              currentJob.publicFieldVisibility,
            )
          : undefined,
      distributionPlatforms: data.distributionPlatforms,
      supportingRecruiters: data.supportingRecruiters,
      applicationFormEnabled: data.applicationFormEnabled,
      applicationFormLogo: data.applicationFormLogo,
      applicationFormQuestions: data.applicationFormQuestions,
      applicationFormNote: data.applicationFormNote,
      applicationFormSchema:
        data.applicationFormSchema !== undefined
          ? resolveApplicationFormSchemaFromPayload(data)
          : undefined,
      nationality: data.nationality,
      country: data.country,
      state: data.state,
      city: data.city,
      forecastRevenue: data.forecastRevenue,
      videoMediaLink: data.videoMediaLink,
      languages: data.languages,
      managerId: data.managerId,
    });

    // Log data being updated
    dbLogger.logUpdate('JOB', id, updateData);

    const hasFieldUpdates = Object.keys(updateData).length > 0;
    const hasPipelineStageUpdates = Array.isArray(data.pipelineStages);

    if (!hasFieldUpdates && !hasPipelineStageUpdates) {
      if (Array.isArray(data.preScreenAssessments)) {
        await preScreenAssessmentService.replaceJobLinks(id, data.preScreenAssessments);
        return enrichJobWithAssessments(currentJob);
      }
      return enrichJobWithAssessments(currentJob);
    }

    stampVisibilityOnAssigneeChange({
      updateData,
      previous: currentJob,
      performerId: data.performedById || req?.user?.id,
    });

    if (!hasPipelineStageUpdates) {
      const updatedJob = await prisma.job.update({
        where: { id },
        data: updateData,
        include: {
          client: {
            select: { id: true, companyName: true, industry: true, logo: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      console.log(`âœ… Job updated successfully (ID: ${id})\n`);
      if (data.performedById && hasFieldUpdates) {
        await activityService.logJobFieldChanges({
          entityId: id,
          performedById: data.performedById,
          oldData: currentJob,
          newData: updateData,
          clientId: updatedJob.clientId || currentJob.clientId || undefined,
        });
      }

      if (
        data.assignedToId !== undefined &&
        data.assignedToId &&
        data.assignedToId !== currentJob.assignedToId
      ) {
        await this.notifyAssignment(updatedJob, data.performedById);
      }

      const nextStatus = String(updatedJob.status || '').toUpperCase();
      const prevStatus = String(currentJob.status || '').toUpperCase();
      if (
        ['CLOSED', 'FILLED'].includes(nextStatus) &&
        nextStatus !== prevStatus &&
        updatedJob?.assignedTo?.email
      ) {
        try {
          await sendJobClosedEmail({
            toEmail: updatedJob.assignedTo.email,
            recipientName: updatedJob.assignedTo.name,
            jobTitle: updatedJob.title,
            status: nextStatus,
            senderUserId: data.performedById,
          });
        } catch (emailErr) {
          console.warn('[job.update] job closed email failed:', emailErr?.message || emailErr);
        }
        try {
          const performer = data.performedById
            ? await prisma.user.findUnique({
                where: { id: data.performedById },
                select: { name: true, firstName: true, lastName: true, email: true },
              })
            : null;
          await notifyJobClosed({
            job: updatedJob,
            previousStatus: prevStatus,
            performedById: data.performedById,
            performedByName: personName(performer),
          });
        } catch (alertErr) {
          console.warn('[job.update] job closed alert failed:', alertErr?.message || alertErr);
        }
      }

      if (Array.isArray(data.preScreenAssessments)) {
        await preScreenAssessmentService.replaceJobLinks(id, data.preScreenAssessments);
      }

      try {
        await syncJobToPortal(updatedJob, data);
      } catch (syncError) {
        console.error(`Failed to sync job ${id} to job portal DB:`, syncError?.message || syncError);
      }

      return enrichJobWithAssessments(updatedJob);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const savedJob = await tx.job.update({
        where: { id },
        data: updateData,
        include: {
          client: {
            select: { id: true, companyName: true, industry: true, logo: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (hasPipelineStageUpdates) {
        const incoming = data.pipelineStages
          .map((stage, index) => ({
            id: stage?.id ? String(stage.id) : null,
            name: String(stage?.name || '').trim(),
            order: Number(stage?.order ?? index + 1),
            systemRole:
              stage?.systemRole != null && String(stage.systemRole).trim()
                ? String(stage.systemRole).trim().toUpperCase()
                : null,
          }))
          .filter((stage) => stage.name);

        if (incoming.length) {
          const existingStages = await tx.pipelineStage.findMany({
            where: { jobId: id },
            select: { id: true, name: true },
            orderBy: { order: 'asc' },
          });
          const existingIds = new Set(existingStages.map((s) => s.id));
          const existingStageNames = new Map(existingStages.map((stage) => [stage.id, stage.name]));

          // Upsert stages (update existing by id, create new otherwise)
          const keptIds = new Set();
          for (let idx = 0; idx < incoming.length; idx += 1) {
            const stage = incoming[idx];
            const order = idx + 1;
            const color = getStageColor(stage.name);
            if (stage.id && existingIds.has(stage.id)) {
              keptIds.add(stage.id);
              const previousName = existingStageNames.get(stage.id);
              await tx.pipelineStage.update({
                where: { id: stage.id },
                data: { name: stage.name, order, color, systemRole: stage.systemRole },
              });
              if (previousName && previousName !== stage.name) {
                const candidateIdsInStage = (
                  await tx.pipelineEntry.findMany({
                    where: { jobId: id, stageId: stage.id },
                    select: { candidateId: true },
                  })
                ).map((entry) => entry.candidateId);

                if (candidateIdsInStage.length) {
                  await tx.candidate.updateMany({
                    where: { id: { in: candidateIdsInStage } },
                    data: {
                      stage: stage.name,
                      lastActivity: new Date(),
                    },
                  });

                  await tx.match.updateMany({
                    where: { jobId: id, candidateId: { in: candidateIdsInStage } },
                    data: {
                      status: mapStageToMatchStatus(stage.name),
                    },
                  });
                }
              }
            } else {
              const created = await tx.pipelineStage.create({
                data: { name: stage.name, order, color, jobId: id, systemRole: stage.systemRole },
              });
              keptIds.add(created.id);
            }
          }

          // Re-home any entries from removed stages to the first kept stage
          const fallbackStageId = Array.from(keptIds.values())[0] || null;
          const toDelete = existingStages.map((s) => s.id).filter((stageId) => !keptIds.has(stageId));
          if (fallbackStageId && toDelete.length) {
            const fallbackStage = await tx.pipelineStage.findUnique({
              where: { id: fallbackStageId },
              select: { id: true, name: true },
            });

            await tx.pipelineEntry.updateMany({
              where: { jobId: id, stageId: { in: toDelete } },
              data: { stageId: fallbackStageId, movedAt: new Date() },
            });

            const movedCandidateIds = (
              await tx.pipelineEntry.findMany({
                where: { jobId: id, stageId: fallbackStageId },
                select: { candidateId: true },
              })
            ).map((entry) => entry.candidateId);

            if (fallbackStage?.name && movedCandidateIds.length) {
              await tx.candidate.updateMany({
                where: { id: { in: movedCandidateIds } },
                data: {
                  stage: fallbackStage.name,
                  lastActivity: new Date(),
                },
              });

              await tx.match.updateMany({
                where: { jobId: id, candidateId: { in: movedCandidateIds } },
                data: { status: mapStageToMatchStatus(fallbackStage.name) },
              });
            }
          }

          if (toDelete.length) {
            await tx.pipelineStage.deleteMany({
              where: { jobId: id, id: { in: toDelete } },
            });
          }
        } else {
          // Empty pipeline: remove all stages for this job
          await tx.pipelineStage.deleteMany({ where: { jobId: id } });
        }
      }

      return savedJob;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    console.log(`✅ Job updated successfully (ID: ${id})\n`);

    if (data.performedById && hasFieldUpdates) {
      await activityService.logJobFieldChanges({
        entityId: id,
        performedById: data.performedById,
        oldData: currentJob,
        newData: updateData,
        clientId: updated.clientId || currentJob.clientId || undefined,
      });
    }

    if (
      data.assignedToId !== undefined &&
      data.assignedToId &&
      data.assignedToId !== currentJob.assignedToId
    ) {
      await this.notifyAssignment(updated, data.performedById);
    }

    const nextStatus = String(updated.status || '').toUpperCase();
    const prevStatus = String(currentJob.status || '').toUpperCase();
    if (
      ['CLOSED', 'FILLED'].includes(nextStatus) &&
      nextStatus !== prevStatus &&
      updated?.assignedTo?.email
    ) {
      try {
        await sendJobClosedEmail({
          toEmail: updated.assignedTo.email,
          recipientName: updated.assignedTo.name,
          jobTitle: updated.title,
          status: nextStatus,
          senderUserId: data.performedById,
        });
      } catch (emailErr) {
        console.warn('[job.update] job closed email failed:', emailErr?.message || emailErr);
      }
      try {
        const performer = data.performedById
          ? await prisma.user.findUnique({
              where: { id: data.performedById },
              select: { name: true, firstName: true, lastName: true, email: true },
            })
          : null;
        await notifyJobClosed({
          job: updated,
          previousStatus: prevStatus,
          performedById: data.performedById,
          performedByName: personName(performer),
        });
      } catch (alertErr) {
        console.warn('[job.update] job closed alert failed:', alertErr?.message || alertErr);
      }
    }

    if (Array.isArray(data.preScreenAssessments)) {
      await preScreenAssessmentService.replaceJobLinks(id, data.preScreenAssessments);
    }

    try {
      await syncJobToPortal(updated, data);
    } catch (syncError) {
      console.error(`Failed to sync job ${id} to job portal DB:`, syncError?.message || syncError);
    }

    return enrichJobWithAssessments(updated);
  },

  async delete(id, performedById) {
    // Soft delete — flips isDeleted=true so the job shows on the Recycle Bin and can be
    // restored. We also drop the mirrored row from the job-portal DB so public listings
    // hide the job immediately; the mirror is recreated on restore via the existing
    // create/update mirror flow if needed.
    const currentJob = await prisma.job.findFirst({
      where: { id, isDeleted: { not: true } },
      select: { id: true, title: true, clientId: true },
    });

    if (!currentJob) {
      throw new Error('Job not found');
    }

    try {
      await deleteMirroredJobForPhase1(id);
    } catch (syncErr) {
      console.error(`deleteMirroredJobForPhase1 failed for job ${id}:`, syncErr?.message || syncErr);
      throw new Error(
        syncErr?.message
          ? `Could not remove job from shared portal database: ${syncErr.message}`
          : 'Could not remove job from shared portal database'
      );
    }

    await prisma.job.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: performedById || null,
      },
    });

    if (performedById) {
      await activityService.logJobDeleted({
        entityId: id,
        performedById,
        entityName: currentJob.title,
        clientId: currentJob.clientId || undefined,
      });
    }

    return { message: 'Job moved to Recycle Bin' };
  },

  /**
   * Recycle Bin — list soft-deleted jobs (newest first). Same access scope as getAll:
   * non-admins only see jobs they created or are assigned to (or that they deleted).
   */
  async listTrash(req) {
    const page = Math.max(Number.parseInt(String(req.query?.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query?.limit ?? '50'), 10) || 50, 1),
      500
    );
    const skip = (page - 1) * limit;

    let baseWhere = { isDeleted: true };
    if (!canViewAllJobs(req) && req?.user?.id) {
      baseWhere = {
        ...baseWhere,
        OR: [
          { createdById: req.user.id },
          ...buildAssigneeVisibilityOr(req.user.id),
          { deletedBy: req.user.id },
        ],
      };
    }
    const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    const where = mergeWhereWithScope(baseWhere, superAdminScope);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              companyName: true,
              logo: true,
              emails: true,
              teamMemberEmail: true,
              contacts: {
                where: { status: 'ACTIVE' },
                orderBy: { updatedAt: 'desc' },
                take: 10,
                select: { email: true, contactType: true },
              },
            },
          },
          assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
          createdBy: { select: USER_BRIEF_SELECT },
        },
      }),
      prisma.job.count({ where }),
    ]);
    const withAudit = await prepareListWithAuditMeta(jobs, ENTITY_TYPES.JOB);
    return formatPaginationResponse(withAudit, page, limit, total);
  },

  /** Recycle Bin — restore a soft-deleted job. */
  async restore(id, performedById = null) {
    const job = await prisma.job.findFirst({
      where: { id, isDeleted: true },
      select: { id: true, title: true, clientId: true },
    });
    if (!job) {
      throw new Error('Deleted job not found');
    }
    await prisma.job.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null, deletedBy: null },
    });
    if (performedById) {
      try {
        await activityService.logJobActivity({
          entityId: id,
          performedById,
          action: 'Job Restored',
          description: `Job "${job.title}" was restored from the Recycle Bin`,
          metadata: { title: job.title },
        });
      } catch (err) {
        console.error('Failed to log job restore activity:', err);
      }
    }
    return { message: 'Job restored' };
  },

  /** Recycle Bin — permanently delete a soft-deleted job. */
  /**
   * Bulk permanent-delete (Recycle Bin → Delete forever). Sequential so each job's
   * transactional cleanup is isolated.
   */
  async bulkPurge(ids, performedById) {
    const unique = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)));
    if (!unique.length) {
      return { success: 0, failed: 0, failures: [] };
    }
    let success = 0;
    const failures = [];
    for (const jobId of unique) {
      try {
        await this.purge(jobId, performedById);
        success += 1;
      } catch (err) {
        failures.push({ id: jobId, message: err?.message || 'Failed to purge job' });
      }
    }
    return { success, failed: failures.length, failures };
  },

  async purge(id) {
    const job = await prisma.job.findFirst({
      where: { id, isDeleted: true },
      select: { id: true },
    });
    if (!job) {
      throw new Error('Deleted job not found');
    }

    await this.purgeCompletely(id);
    return { message: 'Job permanently deleted' };
  },

  /** Hard-delete a tenant job regardless of recycle-bin state (HQ cascade delete). */
  async purgeCompletely(id) {
    const job = await prisma.job.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!job) {
      return { deleted: false };
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.deleteMany({ where: { jobId: id } });
      await tx.assessmentSession.deleteMany({ where: { jobId: id } });
      await tx.pipelineEntry.deleteMany({ where: { jobId: id } });
      await tx.job.delete({ where: { id } });
    });

    return { deleted: true };
  },

  async getMetrics(req) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const mineFilter = req?.query?.mine === 'true' || req?.query?.mine === '1';
    const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    const ownerScope = superAdminScope || (
      mineFilter && req?.user?.id
        ? { createdById: req.user.id }
        : !canViewAllJobs(req) && req?.user?.id
          ? { OR: buildAssigneeVisibilityOr(req.user.id) }
          : {}
    );

    // Recycle Bin: exclude soft-deleted jobs from every metric so counts match
    // the Jobs list. `not: true` matches false, null, and legacy missing-field rows.
    const scope = { AND: [ownerScope, { isDeleted: { not: true } }] };

    // Active Jobs (status = OPEN)
    const activeJobs = await prisma.job.count({
      where: { ...scope, status: 'OPEN' },
    });

    // New Jobs (This Week) - jobs created in the last 7 days
    const newJobsThisWeek = await prisma.job.count({
      where: {
        ...scope,
        createdAt: { gte: startOfWeek },
      },
    });

    // Applied = unique candidates who applied (applications + job-linked matches), not all AI matches
    const jobsForCandidateMetrics = await prisma.job.findMany({
      where: {
        ...scope,
      },
      select: {
        id: true,
      },
    });

    const appliedCountMap = await getMergedAppliedCountByJobId(
      jobsForCandidateMetrics.map((job) => job.id)
    );
    const appliedCounts = jobsForCandidateMetrics.map(
      (job) => Number(appliedCountMap.get(job.id) || 0)
    );

    const appliedCandidates = appliedCounts.reduce((sum, count) => sum + count, 0);
    const noCandidatesCount = appliedCounts.filter((count) => count === 0).length;

    // Near SLA - jobs with slaRisk = true
    const nearSlaCount = await prisma.job.count({
      where: {
        ...scope,
        slaRisk: true,
        status: { in: ['OPEN', 'DRAFT'] },
      },
    });

    // Closed This Month - jobs closed this month
    const closedThisMonth = await prisma.job.count({
      where: {
        ...scope,
        status: { in: ['CLOSED', 'FILLED'] },
        updatedAt: { gte: startOfMonth },
      },
    });

    return {
      activeJobs,
      newJobsThisWeek,
      appliedCandidates,
      noCandidates: noCandidatesCount,
      nearSla: nearSlaCount,
      closedThisMonth,
    };
  },
};
