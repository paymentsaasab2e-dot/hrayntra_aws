import { prisma } from '../../config/prisma.js';

const ORG_SCOPE = 'ORG';
const KEY_RECRUITMENT_MODE = 'recruitmentMode';
const KEY_PIPELINE_TEMPLATE = 'defaultPipelineTemplate';
const KEY_SUBSCRIPTION_PLAN = 'subscriptionPlan';
const KEY_DEFAULT_CURRENCY = 'defaultCurrency';

export const SUBSCRIPTION_PLAN_OPTIONS = [
  { id: 'basic', name: 'Basic' },
  { id: 'pro', name: 'Pro' },
  { id: 'enterprise', name: 'Enterprise' },
];

// Tenant-wide default currency. Super admin sets this once and every other
// surface (invoices, placements, dashboards, candidate "expected pay") falls
// back to it instead of a hard-coded "USD".
export const DEFAULT_ORG_CURRENCY = 'USD';
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'CNY'];

function normalizeCurrencyCode(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return DEFAULT_ORG_CURRENCY;
  // Accept any 3-letter ISO code; we only validate for the picker, not for save,
  // so legacy values from BillingSettings round-trip cleanly.
  return s.length === 3 ? s : DEFAULT_ORG_CURRENCY;
}

/** Keep in sync with PIPELINE_STAGES in candidateStage.service.js */
const BUCKETS = {
  APPLIED: 'APPLIED',
  SCREENING: 'SCREENING',
  INTERVIEW: 'INTERVIEW',
  OFFER: 'OFFER',
  HIRED: 'HIRED',
  REJECTED: 'REJECTED',
};

/** Default org template when standalone mode is enabled (new jobs copy this). */
export function getBuiltinDefaultPipelineTemplate() {
  return [
    { name: 'Applied', order: 1, color: '#3b82f6', systemRole: BUCKETS.APPLIED },
    { name: 'Screening', order: 2, color: '#8b5cf6', systemRole: BUCKETS.SCREENING },
    { name: 'Interviewing', order: 3, color: '#f59e0b', systemRole: BUCKETS.INTERVIEW },
    { name: 'Offer', order: 4, color: '#10b981', systemRole: BUCKETS.OFFER },
    { name: 'Hired', order: 5, color: '#059669', systemRole: BUCKETS.HIRED },
    { name: 'Rejected', order: 6, color: '#ef4444', systemRole: BUCKETS.REJECTED },
  ];
}

function normalizeMode(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return s === 'standalone' ? 'standalone' : 'agency';
}

function parseModeFromSettingValue(value) {
  if (value === null || value === undefined) return 'agency';
  if (typeof value === 'string') return normalizeMode(value);
  if (typeof value === 'object' && value && typeof value.mode === 'string') {
    return normalizeMode(value.mode);
  }
  return 'agency';
}

async function findOrgSettingRow(key) {
  return prisma.setting.findFirst({
    where: {
      key,
      scope: ORG_SCOPE,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Prisma MongoDB rejects `userId: null` on `upsert`/`create` for compound unique `userId_key_scope`
 * ("Argument `userId` must not be null"). Org-wide rows use `userId` omitted / null in DB via findFirst + update/create.
 */
async function upsertOrgSettingJson(key, value) {
  const existing = await findOrgSettingRow(key);
  if (existing) {
    await prisma.setting.update({
      where: { id: existing.id },
      data: { value },
    });
    return;
  }
  await prisma.setting.create({
    data: {
      key,
      scope: ORG_SCOPE,
      value,
    },
  });
}

export async function getRecruitmentMode() {
  const row = await findOrgSettingRow(KEY_RECRUITMENT_MODE);
  return parseModeFromSettingValue(row?.value);
}

export async function setRecruitmentMode(mode) {
  const normalized = normalizeMode(mode);
  await upsertOrgSettingJson(KEY_RECRUITMENT_MODE, { mode: normalized });
  // When flipping to standalone, backfill any jobs that don't yet have a pipeline
  // so the org template is the visible default everywhere — agency stays untouched.
  if (normalized === 'standalone') {
    try {
      await applyOrgPipelineTemplateToEmptyJobs();
    } catch (err) {
      console.warn('[recruitmentMode] template backfill failed:', err?.message || err);
    }
  }
  return normalized;
}

export async function getDefaultPipelineTemplate() {
  const row = await findOrgSettingRow(KEY_PIPELINE_TEMPLATE);
  const v = row?.value;
  if (Array.isArray(v) && v.length) return v;
  if (v && typeof v === 'object' && Array.isArray(v.stages)) return v.stages;
  return getBuiltinDefaultPipelineTemplate();
}

export async function setDefaultPipelineTemplate(stages) {
  if (!Array.isArray(stages) || stages.length === 0) {
    throw new Error('Pipeline template must be a non-empty array');
  }
  await upsertOrgSettingJson(KEY_PIPELINE_TEMPLATE, { stages });
  // If the org is in standalone mode, also backfill jobs without any pipeline
  // so the freshly saved template becomes the default everywhere immediately.
  try {
    const mode = await getRecruitmentMode();
    if (mode === 'standalone') {
      await applyOrgPipelineTemplateToEmptyJobs();
    }
  } catch (err) {
    console.warn('[recruitmentMode] template backfill failed:', err?.message || err);
  }
  return stages;
}

/** Used after HQ provisions a tenant — same Prisma helpers inside tenant context. */
export async function seedOrgRecruitmentFromOrganizationType(organizationType) {
  const mode = normalizeMode(organizationType);
  await setRecruitmentMode(mode);
  await setDefaultPipelineTemplate(getBuiltinDefaultPipelineTemplate());
  if (mode === 'standalone') {
    await applyOrgPipelineTemplateToEmptyJobs();
  }
  return mode;
}

function normalizeSubscriptionPlanName(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const found = SUBSCRIPTION_PLAN_OPTIONS.find(
    (o) => o.name.toLowerCase() === s.toLowerCase() || o.id.toLowerCase() === s.toLowerCase()
  );
  return found ? found.name : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export async function getSubscriptionPlan() {
  const row = await findOrgSettingRow(KEY_SUBSCRIPTION_PLAN);
  const v = row?.value;
  if (v && typeof v === 'object' && typeof v.name === 'string' && v.name.trim()) {
    return { name: normalizeSubscriptionPlanName(v.name) };
  }
  return null;
}

export async function setSubscriptionPlan(plan) {
  const name = normalizeSubscriptionPlanName(plan?.name ?? plan);
  if (!name) throw new Error('Plan name is required');
  await upsertOrgSettingJson(KEY_SUBSCRIPTION_PLAN, { name });
  return { name };
}

export async function getDefaultCurrency() {
  const row = await findOrgSettingRow(KEY_DEFAULT_CURRENCY);
  const v = row?.value;
  if (typeof v === 'string') return normalizeCurrencyCode(v);
  if (v && typeof v === 'object' && typeof v.code === 'string') return normalizeCurrencyCode(v.code);
  return DEFAULT_ORG_CURRENCY;
}

export async function setDefaultCurrency(code) {
  const normalized = normalizeCurrencyCode(code);
  await upsertOrgSettingJson(KEY_DEFAULT_CURRENCY, { code: normalized });
  return normalized;
}

const LEGACY_FOUR_STAGE_NAMES = new Set(['apply', 'interview', 'reject', 'placed']);

/** Map common legacy labels to canonical buckets so we still reseed old jobs. */
function legacyPipelineBucketName(name) {
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (['apply', 'applied', 'application'].includes(n)) return 'apply';
  if (['interview', 'interviews', 'interviewing'].includes(n)) return 'interview';
  if (['reject', 'rejected', 'rejection', 'declined'].includes(n)) return 'reject';
  if (['placed', 'placement', 'hired', 'joined'].includes(n)) return 'placed';
  return '';
}

function isLegacyFourStagePipeline(stageDocs) {
  if (!Array.isArray(stageDocs) || stageDocs.length !== 4) return false;
  const buckets = stageDocs.map((s) => legacyPipelineBucketName(s.name));
  if (buckets.some((b) => !b)) return false;
  const sorted = [...buckets].sort().join('|');
  const legacy = [...LEGACY_FOUR_STAGE_NAMES].sort().join('|');
  return sorted === legacy;
}

/**
 * Standalone: remove a stray "Apply" row when another stage is clearly the
 * APPLIED bucket (fixes UI showing APP twice after legacy drawer saves).
 */
export async function repairStandaloneDuplicateApplyStages() {
  const mode = await getRecruitmentMode();
  if (mode !== 'standalone') return { removedStages: 0 };

  const jobs = await prisma.job.findMany({ select: { id: true } });
  let removed = 0;
  for (const { id: jobId } of jobs) {
    const stages = await prisma.pipelineStage.findMany({
      where: { jobId },
      select: { id: true, name: true, systemRole: true },
      orderBy: { order: 'asc' },
    });
    const hasAppliedLike = stages.some(
      (s) =>
        String(s.systemRole || '').toUpperCase() === 'APPLIED' ||
        /^applied$/i.test(String(s.name || '').trim())
    );
    if (!hasAppliedLike) continue;
    const applyOnly = stages.filter((s) => String(s.name || '').trim().toLowerCase() === 'apply');
    if (applyOnly.length === 0) continue;
    await prisma.pipelineStage.deleteMany({ where: { id: { in: applyOnly.map((r) => r.id) } } });
    removed += applyOnly.length;
  }
  return { removedStages: removed };
}

/**
 * Backfill jobs using the saved org template:
 * - Jobs with zero stages (create only)
 * - Jobs whose stages are exactly the old four defaults Apply/Interview/Reject/Placed (delete + recreate)
 * Also runs `repairStandaloneDuplicateApplyStages` for standalone tenants.
 */
export async function applyOrgPipelineTemplateToEmptyJobs() {
  const mode = await getRecruitmentMode();
  const template = await getDefaultPipelineTemplate();
  if (!Array.isArray(template) || template.length === 0) return { updatedJobs: 0, legacyReseeded: 0, removedStages: 0 };

  let removedStages = 0;
  if (mode === 'standalone') {
    const dup = await repairStandaloneDuplicateApplyStages();
    removedStages = dup.removedStages || 0;
  }

  const allStages = await prisma.pipelineStage.findMany({
    select: { id: true, jobId: true, name: true },
    orderBy: [{ jobId: 'asc' }, { order: 'asc' }],
  });
  const byJob = new Map();
  for (const row of allStages) {
    if (!byJob.has(row.jobId)) byJob.set(row.jobId, []);
    byJob.get(row.jobId).push(row);
  }

  const allJobs = await prisma.job.findMany({ select: { id: true } });
  const emptyJobIds = [];
  const legacyJobIds = [];
  for (const j of allJobs) {
    const list = byJob.get(j.id);
    if (!list || list.length === 0) {
      emptyJobIds.push(j.id);
    } else if (mode === 'standalone' && isLegacyFourStagePipeline(list)) {
      legacyJobIds.push(j.id);
    }
  }

  let created = 0;
  let legacyReseeded = 0;

  for (const jobId of emptyJobIds) {
    await Promise.all(
      template.map((stage, index) =>
        prisma.pipelineStage.create({
          data: {
            jobId,
            name: String(stage.name || '').trim() || `Stage ${index + 1}`,
            order: typeof stage.order === 'number' ? stage.order : index + 1,
            color: stage.color || null,
            systemRole: stage.systemRole ? String(stage.systemRole).toUpperCase() : null,
          },
        })
      )
    );
    created += 1;
  }

  for (const jobId of legacyJobIds) {
    await prisma.pipelineStage.deleteMany({ where: { jobId } });
    await Promise.all(
      template.map((stage, index) =>
        prisma.pipelineStage.create({
          data: {
            jobId,
            name: String(stage.name || '').trim() || `Stage ${index + 1}`,
            order: typeof stage.order === 'number' ? stage.order : index + 1,
            color: stage.color || null,
            systemRole: stage.systemRole ? String(stage.systemRole).toUpperCase() : null,
          },
        })
      )
    );
    legacyReseeded += 1;
  }

  return {
    updatedJobs: created + legacyReseeded,
    emptySeeded: created,
    legacyReseeded,
    removedStages,
  };
}

/**
 * Replace ALL pipeline stages of one job with the org template.
 * Wipes existing stages + their pipeline entries (cascade) — destructive,
 * so it's exposed as an explicit per-job action, not a mode-change side effect.
 */
export async function resetJobPipelineToOrgTemplate(jobId) {
  if (!jobId) throw new Error('jobId is required');
  const template = await getDefaultPipelineTemplate();
  if (!Array.isArray(template) || template.length === 0) {
    throw new Error('No org pipeline template configured');
  }
  await prisma.pipelineStage.deleteMany({ where: { jobId } });
  await Promise.all(
    template.map((stage, index) =>
      prisma.pipelineStage.create({
        data: {
          jobId,
          name: String(stage.name || '').trim() || `Stage ${index + 1}`,
          order: typeof stage.order === 'number' ? stage.order : index + 1,
          color: stage.color || null,
          systemRole: stage.systemRole ? String(stage.systemRole).toUpperCase() : null,
        },
      })
    )
  );
  return prisma.pipelineStage.findMany({
    where: { jobId },
    orderBy: { order: 'asc' },
  });
}
