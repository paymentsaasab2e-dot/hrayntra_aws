import { prisma } from '../../config/prisma.js';
import { getSubscriptionPlan, setSubscriptionPlan } from './recruitmentMode.service.js';
import { DEFAULT_HQ_PACKAGES, toAssignablePlan } from '../hq/hq-packages.config.js';
import { hqPackagesService } from '../hq/hq-packages.service.js';

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
    const resolved = await hqPackagesService.resolvePlanInput(current.name);
    if (resolved) {
      current = {
        id: current.id || resolved.id,
        name: current.name || resolved.name,
        maxUsers: current.maxUsers ?? resolved.maxUsers ?? null,
        maxJobs: current.maxJobs ?? resolved.maxJobs ?? null,
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
