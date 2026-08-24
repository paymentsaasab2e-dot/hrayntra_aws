import { getActiveTenantDbName, prisma, runWithTenantContext } from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { getSubscriptionPlan, setSubscriptionPlan } from './recruitmentMode.service.js';
import {
  DEFAULT_HQ_PACKAGES,
  resolvePackageSlug,
  toAssignablePlan,
} from '../hq/hq-packages.config.js';
import { hqPackagesService } from '../hq/hq-packages.service.js';

function planIdentity(plan) {
  if (!plan) return '';
  const slug = resolvePackageSlug(plan.id, plan.name);
  const cycle =
    String(plan.billingCycle || 'monthly').trim().toLowerCase() === 'annual' ? 'annual' : 'monthly';
  return `${slug || String(plan.name || '').trim().toLowerCase()}:${cycle}`;
}

function planRecordsMatch(local, target) {
  if (!local && !target) return true;
  if (!local || !target) return false;
  return (
    planIdentity(local) === planIdentity(target) &&
    (local.maxUsers ?? null) === (target.maxUsers ?? null) &&
    (local.maxJobs ?? null) === (target.maxJobs ?? null) &&
    String(local.planStartDate || '') === String(target.planStartDate || '') &&
    String(local.planEndDate || '') === String(target.planEndDate || '') &&
    Boolean(local.isTrial) === Boolean(target.isTrial) &&
    (Number(local.trialDays) || 0) === (Number(target.trialDays) || 0) &&
    (Number(local.coins) || 0) === (Number(target.coins) || 0)
  );
}

/** Strip trailing "Trial" so package lookup still finds Starter/Basic/etc. */
function packageLookupName(name) {
  return String(name || '')
    .replace(/\s*trial\s*$/i, '')
    .trim();
}

/**
 * Prefer HQ trial window / labels over package defaults.
 * syncSubscriptionPlanFromHq used to re-resolve monthly packages and wipe 5-day
 * trial end dates back to +30 days.
 */
function mergeHqPlanMetadata(resolvedPlan, hqPlan) {
  if (!resolvedPlan && !hqPlan) return null;
  if (!resolvedPlan) {
    return {
      ...hqPlan,
      ...(hqPlan?.isTrial ? { isTrial: true } : {}),
    };
  }
  return {
    ...resolvedPlan,
    // Keep HQ trial display name (e.g. "Starter Trial") instead of bare package name.
    ...(hqPlan?.isTrial && hqPlan?.name ? { name: String(hqPlan.name).trim() } : {}),
    ...(hqPlan?.planStartDate
      ? { planStartDate: String(hqPlan.planStartDate).trim().slice(0, 10) }
      : {}),
    // HQ end date wins — never replace a 5-day trial with monthly +30.
    ...(hqPlan?.planEndDate
      ? { planEndDate: String(hqPlan.planEndDate).trim().slice(0, 10) }
      : {}),
    ...(hqPlan?.upgradedAt ? { upgradedAt: String(hqPlan.upgradedAt) } : {}),
    ...(hqPlan?.upgradedFrom ? { upgradedFrom: String(hqPlan.upgradedFrom) } : {}),
    ...(hqPlan?.upgradedBy ? { upgradedBy: String(hqPlan.upgradedBy) } : {}),
    ...(hqPlan?.lastPaymentReference
      ? { lastPaymentReference: String(hqPlan.lastPaymentReference) }
      : {}),
    ...(hqPlan?.isTrial ? { isTrial: true } : {}),
    ...(hqPlan?.trialDays ? { trialDays: Number(hqPlan.trialDays) || undefined } : {}),
    ...(hqPlan?.purchasedAt ? { purchasedAt: String(hqPlan.purchasedAt) } : {}),
    ...(hqPlan?.coins !== undefined && hqPlan?.coins !== null
      ? { coins: Math.max(0, Number(hqPlan.coins) || 0) }
      : {}),
    ...(hqPlan?.price ? { price: String(hqPlan.price) } : {}),
    ...(hqPlan?.maxUsers !== undefined ? { maxUsers: hqPlan.maxUsers } : {}),
    ...(hqPlan?.maxJobs !== undefined ? { maxJobs: hqPlan.maxJobs } : {}),
  };
}

/** Push the HQ-assigned plan into the active tenant workspace (Phase 2 org settings). */
export async function applyTenantSubscriptionPlan(tenantDbName, plan, { throwOnFailure = false } = {}) {
  const dbName = String(tenantDbName || '').trim();
  if (!dbName || !plan) return;
  try {
    await runWithTenantContext(dbName, () => setSubscriptionPlan(plan));
  } catch (err) {
    console.warn('[planAccess] failed to update tenant subscription plan:', err?.message || err);
    if (throwOnFailure) throw err;
  }
}

/**
 * HQ is the source of truth for tenant packages. When HQ assigns Starter → Enterprise,
 * Phase 2 reads the updated plan on the next API call.
 */
export async function syncSubscriptionPlanFromHq() {
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  if (!tenantDbName) return null;

  let hqTenant = null;
  try {
    hqTenant = await headquartersAuthService.findTenantByDbName(tenantDbName);
  } catch (err) {
    console.warn('[planAccess] HQ tenant lookup failed:', err?.message || err);
    return null;
  }

  const hqPlan = hqTenant?.subscriptionPlan;
  if (!hqPlan?.name && !hqPlan?.id) return null;

  let resolvedPlan = null;
  try {
    // Pass the full HQ plan object so planEndDate / trial fields are not dropped.
    // For trials, look up the base package (without "Trial" suffix) for limits only.
    const lookupRaw = hqPlan.isTrial
      ? {
          ...hqPlan,
          name: packageLookupName(hqPlan.name) || hqPlan.name,
        }
      : hqPlan;
    resolvedPlan = await hqPackagesService.resolvePlanInput(
      lookupRaw,
      hqPlan.billingCycle,
      hqPlan.planStartDate,
    );
  } catch (err) {
    console.warn('[planAccess] failed to resolve HQ plan:', err?.message || err);
  }

  const targetPlan = mergeHqPlanMetadata(resolvedPlan, hqPlan) || hqPlan;
  const localPlan = await getSubscriptionPlan();
  if (planRecordsMatch(localPlan, targetPlan)) {
    return localPlan;
  }

  await setSubscriptionPlan(targetPlan);
  return targetPlan;
}

function enterpriseFallbackPlan() {
  const pkg = DEFAULT_HQ_PACKAGES.find((item) => item.slug === 'enterprise');
  return toAssignablePlan(pkg ? { ...pkg, id: 'enterprise' } : null);
}

async function resolveEnterprisePlan() {
  try {
    const packages = await hqPackagesService.listPackages();
    const enterprise = packages.find(
      (item) => item.slug === 'enterprise' || item.name.toLowerCase() === 'enterprise'
    );
    if (enterprise) return toAssignablePlan(enterprise);
  } catch (err) {
    console.warn('[planAccess] failed to load Enterprise package from HQ:', err?.message || err);
  }
  return enterpriseFallbackPlan();
}

export async function getEffectiveSubscriptionPlan({ assignIfMissing = true } = {}) {
  if (assignIfMissing) {
    try {
      await syncSubscriptionPlanFromHq();
    } catch (err) {
      console.warn('[planAccess] HQ plan sync failed:', err?.message || err);
    }
  }

  let current = await getSubscriptionPlan();

  if (!current?.name) {
    const enterprise = await resolveEnterprisePlan();
    if (!enterprise) {
      throw new Error('Enterprise package is not configured');
    }
    if (assignIfMissing) {
      await setSubscriptionPlan(enterprise);
    }
    return enterprise;
  }

  const needsEnrichment =
    current.maxUsers === undefined && current.maxJobs === undefined && !current.id;

  if (needsEnrichment) {
    const resolved = await hqPackagesService.resolvePlanInput(
      current.id || current.name,
      current.billingCycle
    );
    if (resolved) {
      current = {
        id: current.id || resolved.id,
        name: current.name || resolved.name,
        billingCycle: current.billingCycle || resolved.billingCycle || 'monthly',
        maxUsers: resolved.maxUsers ?? current.maxUsers ?? null,
        maxJobs: resolved.maxJobs ?? current.maxJobs ?? null,
        ...(current.planStartDate || resolved.planStartDate
          ? { planStartDate: current.planStartDate || resolved.planStartDate }
          : {}),
        ...(current.planEndDate || resolved.planEndDate
          ? { planEndDate: current.planEndDate || resolved.planEndDate }
          : {}),
        ...(current.isTrial || resolved.isTrial ? { isTrial: true } : {}),
        ...(current.trialDays || resolved.trialDays
          ? { trialDays: current.trialDays || resolved.trialDays }
          : {}),
      };
      if (assignIfMissing) {
        await setSubscriptionPlan(current);
      }
    }
  }

  return current;
}

export async function countActiveJobPostings() {
  return prisma.job.count({
    where: {
      status: { in: ['OPEN', 'DRAFT'] },
    },
  });
}

export async function countBillableUsers() {
  return prisma.user.count({
    where: {
      isActive: true,
      OR: [{ status: null }, { status: { not: 'INACTIVE' } }],
    },
  });
}

export async function getPlanUsageSnapshot() {
  const plan = await getEffectiveSubscriptionPlan();
  const [activeJobs, activeUsers] = await Promise.all([countActiveJobPostings(), countBillableUsers()]);
  return {
    plan,
    activeJobs,
    activeUsers,
    maxJobs: plan.maxJobs ?? null,
    maxUsers: plan.maxUsers ?? null,
    jobsRemaining: plan.maxJobs == null ? null : Math.max(0, plan.maxJobs - activeJobs),
    usersRemaining: plan.maxUsers == null ? null : Math.max(0, plan.maxUsers - activeUsers),
  };
}

export async function assertCanCreateJob() {
  const plan = await getEffectiveSubscriptionPlan();
  if (plan.maxJobs != null) {
    const activeJobs = await countActiveJobPostings();
    if (activeJobs >= plan.maxJobs) {
      throw new Error(
        `Job posting limit reached (${plan.maxJobs} active jobs on the ${plan.name} package). Upgrade your package to add more jobs.`
      );
    }
  }
  return plan;
}

export async function assertCanCreateUser() {
  const plan = await getEffectiveSubscriptionPlan();
  if (plan.maxUsers != null) {
    const activeUsers = await countBillableUsers();
    if (activeUsers >= plan.maxUsers) {
      throw new Error(
        `User limit reached (${plan.maxUsers} users on the ${plan.name} package). Upgrade your package to add more team members.`
      );
    }
  }
  return plan;
}

export async function backfillEnterprisePlanForTenant() {
  return getEffectiveSubscriptionPlan({ assignIfMissing: true });
}
