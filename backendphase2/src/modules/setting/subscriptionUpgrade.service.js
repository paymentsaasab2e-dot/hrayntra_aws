import { getActiveTenantDbName, runWithTenantContext } from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { hqPackagesService } from '../hq/hq-packages.service.js';
import {
  computePlanEndDate,
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

function plansMatch(a, b) {
  if (!a || !b) return false;
  const aId = String(a.id || '').trim().toLowerCase();
  const bId = String(b.id || '').trim().toLowerCase();
  if (aId && bId && aId === bId) return true;
  return (
    String(a.name || '')
      .trim()
      .toLowerCase() ===
    String(b.name || '')
      .trim()
      .toLowerCase()
  );
}

/** True while the tenant still has remaining paid/trial days on the active package. */
export function isCurrentPlanPeriodActive(plan) {
  if (!plan) return false;
  const kind = String(plan.accountKind || '').trim().toLowerCase();
  if (kind === 'free_jobs' || kind === 'free') return false;
  const end = String(plan.planEndDate || '').trim();
  if (!end) return false;
  const endMs = Date.parse(`${end}T23:59:59.999Z`);
  return Number.isFinite(endMs) && endMs >= Date.now();
}

function dayAfterIso(dateIso) {
  const raw = String(dateIso || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayPlanStartDate();
  const d = new Date(`${raw}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function findHqTenantForActiveDb() {
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  if (!tenantDbName) return null;
  const tenants = await headquartersAuthService.listTenants();
  return tenants.find((t) => String(t.tenantDbName || '').trim() === tenantDbName) || null;
}

async function persistPlanForTenant(hqTenant, plan) {
  const updated = await headquartersAuthService.setSubscriptionPlanForEmail(hqTenant.email, plan);
  if (!updated) throw new Error('Failed to update HQ tenant plan');
  if (updated.tenantDbName) {
    await runWithTenantContext(updated.tenantDbName, () => setSubscriptionPlan(plan));
  } else {
    await setSubscriptionPlan(plan);
  }
  return updated;
}

/**
 * If a queued (recharge) plan's start date has arrived, swap it in as the active plan.
 * Safe to call on every Settings / plan-access read.
 */
export async function activatePendingSubscriptionPlanIfDue({ hqTenant: hqTenantHint } = {}) {
  let currentPlan = await getSubscriptionPlan();
  const pending = currentPlan?.pendingPlan;
  if (!pending || typeof pending !== 'object') {
    return { plan: currentPlan, activated: false };
  }

  const startsAt = String(pending.startsAt || pending.planStartDate || '').trim().slice(0, 10);
  if (!startsAt) return { plan: currentPlan, activated: false };

  const startMs = Date.parse(`${startsAt}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || startMs > Date.now()) {
    return { plan: currentPlan, activated: false, pendingPlan: pending };
  }

  const hqTenant = hqTenantHint || (await findHqTenantForActiveDb());
  if (!hqTenant?.email) {
    return { plan: currentPlan, activated: false, pendingPlan: pending };
  }

  const activatedPlan = {
    id: pending.id,
    name: pending.name,
    billingCycle: pending.billingCycle === 'annual' ? 'annual' : 'monthly',
    maxUsers: pending.maxUsers ?? null,
    maxJobs: pending.maxJobs ?? null,
    planStartDate: pending.planStartDate || startsAt,
    planEndDate: pending.planEndDate || computePlanEndDate(startsAt, pending.billingCycle),
    ...(pending.price ? { price: String(pending.price) } : {}),
    upgradedAt: new Date().toISOString(),
    upgradedFrom: currentPlan?.name || null,
    purchasedAt: pending.purchasedAt || new Date().toISOString(),
    lastPaymentReference: pending.lastPaymentReference || currentPlan?.lastPaymentReference || null,
    ...(pending.upgradedBy ? { upgradedBy: String(pending.upgradedBy) } : {}),
    note: 'activated_from_queue',
    ...(currentPlan?.coins != null ? { coins: currentPlan.coins } : {}),
    pendingPlan: null,
  };

  await persistPlanForTenant(hqTenant, activatedPlan);
  return { plan: activatedPlan, activated: true, previousPlan: currentPlan };
}

/** All HQ packages tenants can buy from Settings → Subscription & Plan. */
export async function listPurchasablePackages() {
  const packages = await hqPackagesService.listPackages();
  return (packages || []).filter((pkg) => {
    const price = Number.parseFloat(String(pkg?.price || '').replace(/,/g, ''));
    const yearly = Number.parseFloat(String(pkg?.yearlyPrice || '').replace(/,/g, ''));
    return (Number.isFinite(price) && price > 0) || (Number.isFinite(yearly) && yearly > 0);
  });
}

export async function listUpgradeOptions() {
  await activatePendingSubscriptionPlanIfDue().catch((err) => {
    console.warn('[subscription-upgrade] pending activation failed:', err?.message || err);
  });

  const [currentPlan, packages] = await Promise.all([
    getSubscriptionPlan(),
    listPurchasablePackages(),
  ]);
  const currentRank = planTierRank(currentPlan);

  const upgradePackages = packages.filter((pkg) => {
    const rank = packageTierRank(pkg);
    if (rank <= 0) return true;
    return rank > currentRank;
  });

  return {
    currentPlan,
    pendingPlan: currentPlan?.pendingPlan || null,
    /** Higher-tier upgrades only (legacy). */
    upgradePackages,
    /** Full HQ catalog for Settings plan picker. */
    availablePackages: packages,
    canUpgrade: upgradePackages.length > 0,
    currentPeriodActive: isCurrentPlanPeriodActive(currentPlan),
  };
}

/**
 * Purchase a package. Mobile-recharge style:
 * - If current plan period is still active → queue purchased plan to start the day after planEndDate.
 * - Otherwise → activate immediately.
 * Tenant keeps using current plan limits until the queued plan starts.
 */
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

  await activatePendingSubscriptionPlanIfDue().catch(() => {});

  const hqTenant = await findHqTenantForActiveDb();
  if (!hqTenant?.email) {
    throw new Error('Could not resolve tenant workspace for plan upgrade');
  }

  const currentPlan = await getSubscriptionPlan();
  const queue = isCurrentPlanPeriodActive(currentPlan);
  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';

  const startDate = queue
    ? dayAfterIso(currentPlan.planEndDate)
    : todayPlanStartDate();

  const targetPlan = await hqPackagesService.resolvePlanInput(pkgId, cycle, startDate);
  if (!targetPlan) throw new Error('Selected package was not found');

  const currentRank = planTierRank(currentPlan);
  const targetRank = Math.max(getPackageTierRank(targetPlan.id), getPackageTierRank(targetPlan.name));
  const isUpgrade = targetRank > currentRank;
  const samePlan = plansMatch(currentPlan, targetPlan);
  const purchasedAt = new Date().toISOString();

  let savedPlan;
  let queued = false;

  if (queue) {
    const pendingPlan = {
      ...targetPlan,
      startsAt: startDate,
      planStartDate: startDate,
      planEndDate: targetPlan.planEndDate || computePlanEndDate(startDate, cycle),
      purchasedAt,
      lastPaymentReference: paymentRef,
      ...(upgradedBy ? { upgradedBy: String(upgradedBy) } : {}),
      note: samePlan ? 'queued_renewal' : isUpgrade ? 'queued_upgrade' : 'queued_plan_change',
      queued: true,
    };

    savedPlan = {
      ...currentPlan,
      lastPaymentReference: paymentRef,
      ...(upgradedBy ? { upgradedBy: String(upgradedBy) } : {}),
      pendingPlan,
    };
    queued = true;
  } else {
    savedPlan = {
      ...targetPlan,
      upgradedAt: purchasedAt,
      upgradedFrom: currentPlan?.name || null,
      purchasedAt,
      lastPaymentReference: paymentRef,
      ...(upgradedBy ? { upgradedBy: String(upgradedBy) } : {}),
      ...(isUpgrade ? {} : { note: samePlan ? 'renewal' : 'plan_change' }),
      ...(currentPlan?.coins != null ? { coins: currentPlan.coins } : {}),
      pendingPlan: null,
    };
  }

  const updated = await persistPlanForTenant(hqTenant, savedPlan);

  try {
    const { appendTenantBillingTransaction } = await import('../hq/hq-billing-ledger.service.js');
    const priceRaw =
      cycle === 'annual'
        ? Number(targetPlan?.yearlyPrice ?? targetPlan?.price ?? 0)
        : Number(targetPlan?.price ?? 0);
    const action = queued
      ? samePlan
        ? 'Queued renewal'
        : 'Queued plan'
      : samePlan
        ? 'Renewed'
        : isUpgrade
          ? 'Upgraded'
          : 'Changed';
    await appendTenantBillingTransaction({
      tenantDbName: String(updated.tenantDbName || hqTenant.tenantDbName || ''),
      tenantEmail: String(updated.email || hqTenant.email || '').trim().toLowerCase(),
      actorEmail: String(upgradedBy || updated.email || '').trim().toLowerCase(),
      type: queued ? 'PLAN_QUEUED' : 'PLAN_UPGRADE',
      amount: Number.isFinite(priceRaw) ? Math.max(0, Math.round(priceRaw)) : 0,
      balanceAfter: 0,
      unit: 'INR',
      moneyAmount: Number.isFinite(priceRaw) ? priceRaw : null,
      moneyCurrency: 'INR',
      productName: String(targetPlan?.name || pkgId),
      packId: pkgId,
      description: queued
        ? `${action} ${targetPlan?.name || pkgId} (${cycle}) — starts ${startDate} after current plan ends`
        : `${action} subscription to ${targetPlan?.name || pkgId} (${cycle})`,
      reference: paymentRef,
    });
  } catch (err) {
    console.warn('[subscription-upgrade] HQ billing ledger append failed:', err?.message || err);
  }

  return {
    plan: savedPlan,
    pendingPlan: savedPlan.pendingPlan || null,
    queued,
    activatesAt: queued ? startDate : savedPlan.planStartDate || null,
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
