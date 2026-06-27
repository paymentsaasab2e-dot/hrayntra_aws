import { getActiveTenantDbName, runWithTenantContext } from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { hqPackagesService } from '../hq/hq-packages.service.js';
import {
  getPackageTierRank,
  todayPlanStartDate,
} from '../hq/hq-packages.config.js';
import { getSubscriptionPlan, setSubscriptionPlan } from './recruitmentMode.service.js';

function planTierRank(plan) {
  if (!plan) return 0;
  const name = String(plan.name || '');
  const id = String(plan.id || '');
  return Math.max(getPackageTierRank(id), getPackageTierRank(name));
}

function packageTierRank(pkg) {
  if (!pkg) return 0;
  return Math.max(getPackageTierRank(pkg.slug), getPackageTierRank(pkg.name));
}

async function findHqTenantForActiveDb() {
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  if (!tenantDbName) return null;
  const tenants = await headquartersAuthService.listTenants();
  return tenants.find((t) => String(t.tenantDbName || '').trim() === tenantDbName) || null;
}

export async function listUpgradeOptions() {
  const [currentPlan, packages] = await Promise.all([
    getSubscriptionPlan(),
    hqPackagesService.listPackages(),
  ]);
  const currentRank = planTierRank(currentPlan);

  const upgradePackages = packages.filter((pkg) => {
    const rank = packageTierRank(pkg);
    if (rank <= 0) return false;
    return rank > currentRank;
  });

  return {
    currentPlan,
    upgradePackages,
    canUpgrade: upgradePackages.length > 0,
  };
}

export async function upgradeSubscriptionPlan({
  packageId,
  billingCycle = 'monthly',
  paymentReference,
  upgradedBy,
}) {
  const paymentRef = String(paymentReference || '').trim();
  if (!paymentRef) {
    throw new Error('Payment reference is required to confirm upgrade');
  }

  const pkgId = String(packageId || '').trim();
  if (!pkgId) throw new Error('packageId is required');

  const [currentPlan, targetPlan, hqTenant] = await Promise.all([
    getSubscriptionPlan(),
    hqPackagesService.resolvePlanInput(pkgId, billingCycle, todayPlanStartDate()),
    findHqTenantForActiveDb(),
  ]);

  if (!targetPlan) throw new Error('Selected package was not found');
  if (!hqTenant?.email) {
    throw new Error('Could not resolve tenant workspace for plan upgrade');
  }

  const currentRank = planTierRank(currentPlan);
  const targetRank = Math.max(getPackageTierRank(targetPlan.id), getPackageTierRank(targetPlan.name));
  if (targetRank <= currentRank) {
    throw new Error('You can only upgrade to a higher package tier');
  }

  const upgradedPlan = {
    ...targetPlan,
    upgradedAt: new Date().toISOString(),
    upgradedFrom: currentPlan?.name || null,
    lastPaymentReference: paymentRef,
    ...(upgradedBy ? { upgradedBy: String(upgradedBy) } : {}),
  };

  const updated = await headquartersAuthService.setSubscriptionPlanForEmail(
    hqTenant.email,
    upgradedPlan,
  );
  if (!updated) throw new Error('Failed to update HQ tenant plan');

  if (updated.tenantDbName) {
    await runWithTenantContext(updated.tenantDbName, () => setSubscriptionPlan(upgradedPlan));
  } else {
    await setSubscriptionPlan(upgradedPlan);
  }

  return {
    plan: upgradedPlan,
    hqEmail: updated.email,
    tenantDbName: updated.tenantDbName,
  };
}

export function describePlanLimits(plan) {
  const maxUsers = plan?.maxUsers;
  const maxJobs = plan?.maxJobs;
  return {
    maxUsers,
    maxJobs,
    usersLabel: maxUsers == null ? 'Unlimited users' : `Up to ${maxUsers} users`,
    jobsLabel: maxJobs == null ? 'Unlimited jobs' : `Up to ${maxJobs} jobs`,
  };
}
