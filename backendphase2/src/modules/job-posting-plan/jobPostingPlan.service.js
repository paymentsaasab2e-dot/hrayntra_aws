import {
  findOrgSettingRow,
  upsertOrgSettingJson,
} from '../setting/orgSettingStore.util.js';
import {
  createRazorpayOrder,
  getRazorpayPublicConfig,
  verifyRazorpayPaymentSignature,
  assertRazorpayPaymentCaptured,
} from '../payment/razorpay.service.js';
import { buildUpiPayUri } from '../payment/upi.utils.js';
import { getActiveTenantDbName } from '../../config/prisma.js';
import {
  FREE_MONTHLY_PUBLISH_LIMIT,
  PREMIUM_MONTHLY_PUBLISH_LIMIT,
  PREMIUM_MONTHLY_PRICE_PAISE,
  PREMIUM_YEARLY_PRICE_PAISE,
  JOB_POSTING_PLAN_SETTING_KEY,
  JOB_POSTING_USAGE_SETTING_KEY,
  QUOTA_ERROR_CODE,
} from './jobPostingPlan.constants.js';

function calendarMonthKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function isPremiumActive(plan) {
  if (!plan || String(plan.tier || '').toLowerCase() !== 'premium') return false;
  const until = String(plan.premiumUntil || '').trim();
  if (!until) return true;
  const end = Date.parse(until);
  return Number.isFinite(end) ? end > Date.now() : true;
}

function defaultPlan() {
  return {
    tier: 'free',
    monthlyLimit: FREE_MONTHLY_PUBLISH_LIMIT,
    billingCycle: 'monthly',
    activatedAt: null,
    premiumUntil: null,
    lastPaymentReference: null,
  };
}

export async function getJobPostingPlan() {
  const row = await findOrgSettingRow(JOB_POSTING_PLAN_SETTING_KEY);
  const v = row?.value;
  if (v && typeof v === 'object') {
    const plan = {
      ...defaultPlan(),
      ...v,
      tier: String(v.tier || 'free').toLowerCase() === 'premium' ? 'premium' : 'free',
      monthlyLimit:
        Number(v.monthlyLimit) > 0
          ? Number(v.monthlyLimit)
          : String(v.tier || '').toLowerCase() === 'premium'
            ? PREMIUM_MONTHLY_PUBLISH_LIMIT
            : FREE_MONTHLY_PUBLISH_LIMIT,
    };
    if (!isPremiumActive(plan) && plan.tier === 'premium') {
      return {
        ...plan,
        tier: 'free',
        monthlyLimit: FREE_MONTHLY_PUBLISH_LIMIT,
        expiredPremium: true,
      };
    }
    return plan;
  }
  return defaultPlan();
}

async function saveJobPostingPlan(plan) {
  await upsertOrgSettingJson(JOB_POSTING_PLAN_SETTING_KEY, plan);
  return plan;
}

async function readUsageMap() {
  const row = await findOrgSettingRow(JOB_POSTING_USAGE_SETTING_KEY);
  const v = row?.value;
  return v && typeof v === 'object' ? { ...v } : {};
}

async function writeUsageMap(map) {
  await upsertOrgSettingJson(JOB_POSTING_USAGE_SETTING_KEY, map);
}

function monthBucket(usageMap, monthKey) {
  const raw = usageMap[monthKey];
  const jobIds = Array.isArray(raw?.jobIds)
    ? raw.jobIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  const unique = [...new Set(jobIds)];
  return {
    count: unique.length,
    jobIds: unique,
  };
}

export async function getJobPostingQuotaSnapshot(opts = {}) {
  const plan = await getJobPostingPlan();
  const monthKey = opts.monthKey || calendarMonthKey();
  const usageMap = await readUsageMap();
  const bucket = monthBucket(usageMap, monthKey);
  const limit = Number(plan.monthlyLimit) > 0 ? Number(plan.monthlyLimit) : FREE_MONTHLY_PUBLISH_LIMIT;
  const used = bucket.count;
  const remaining = Math.max(0, limit - used);
  return {
    monthKey,
    tier: plan.tier,
    billingCycle: plan.billingCycle || 'monthly',
    limit,
    used,
    remaining,
    canPublish: remaining > 0,
    premiumUntil: plan.premiumUntil || null,
    countedJobIds: bucket.jobIds,
    freeLimit: FREE_MONTHLY_PUBLISH_LIMIT,
    premiumLimit: PREMIUM_MONTHLY_PUBLISH_LIMIT,
    pricing: {
      monthlyPaise: PREMIUM_MONTHLY_PRICE_PAISE,
      yearlyPaise: PREMIUM_YEARLY_PRICE_PAISE,
      currency: 'INR',
    },
  };
}

export function throwQuotaExceeded(snapshot) {
  const err = new Error(
    `You have used ${snapshot.used} of ${snapshot.limit} free job posts this month. Upgrade to Premium to post more.`,
  );
  err.code = QUOTA_ERROR_CODE;
  err.statusCode = 402;
  err.quota = snapshot;
  err.meta = { code: QUOTA_ERROR_CODE, quota: snapshot };
  throw err;
}

/**
 * Call before first publish of a job in the current calendar month.
 * Re-publish / edit of an already-counted job does not consume another slot.
 */
export async function assertCanPublishJobThisMonth(jobId) {
  const id = String(jobId || '').trim();
  const snapshot = await getJobPostingQuotaSnapshot();
  if (id && snapshot.countedJobIds.includes(id)) {
    return { ...snapshot, alreadyCounted: true };
  }
  if (!snapshot.canPublish) {
    throwQuotaExceeded(snapshot);
  }
  return { ...snapshot, alreadyCounted: false };
}

/** Record a successful first publish against this month's quota. */
export async function consumePublishSlot(jobId) {
  const id = String(jobId || '').trim();
  if (!id) throw new Error('jobId is required to consume a publish slot');

  const monthKey = calendarMonthKey();
  const usageMap = await readUsageMap();
  const bucket = monthBucket(usageMap, monthKey);
  if (bucket.jobIds.includes(id)) {
    return getJobPostingQuotaSnapshot({ monthKey });
  }

  const plan = await getJobPostingPlan();
  const limit =
    Number(plan.monthlyLimit) > 0 ? Number(plan.monthlyLimit) : FREE_MONTHLY_PUBLISH_LIMIT;
  if (bucket.count >= limit) {
    throwQuotaExceeded({
      monthKey,
      tier: plan.tier,
      limit,
      used: bucket.count,
      remaining: 0,
      canPublish: false,
      countedJobIds: bucket.jobIds,
    });
  }

  bucket.jobIds.push(id);
  usageMap[monthKey] = { count: bucket.jobIds.length, jobIds: bucket.jobIds };
  await writeUsageMap(usageMap);
  return getJobPostingQuotaSnapshot({ monthKey });
}

/**
 * Enforce + consume around a publish transition.
 * @param {string|null} jobId - existing job id; null when creating
 * @param {{ previousStatus?: string, nextStatus?: string }} transition
 */
export async function guardPublishTransition(jobId, transition = {}) {
  const prev = String(transition.previousStatus || '').toUpperCase();
  const next = String(transition.nextStatus || '').toUpperCase();
  if (next !== 'OPEN') return null;
  // First time becoming OPEN (from draft/hold/closed/new) counts once per job per month.
  if (prev === 'OPEN') return null;

  const id = String(jobId || '').trim();
  if (id) {
    await assertCanPublishJobThisMonth(id);
    return consumePublishSlot(id);
  }
  // Create path: assert now; caller must consume after job id exists.
  await assertCanPublishJobThisMonth('');
  return { pendingConsume: true };
}

export async function consumeAfterCreateIfOpen(jobId, status) {
  if (String(status || '').toUpperCase() !== 'OPEN') return null;
  return consumePublishSlot(jobId);
}

export function getPremiumOffer() {
  return {
    name: 'Premium Job Posting',
    description: `Post up to ${PREMIUM_MONTHLY_PUBLISH_LIMIT} jobs per calendar month`,
    monthly: {
      billingCycle: 'monthly',
      amountPaise: PREMIUM_MONTHLY_PRICE_PAISE,
      limit: PREMIUM_MONTHLY_PUBLISH_LIMIT,
    },
    yearly: {
      billingCycle: 'annual',
      amountPaise: PREMIUM_YEARLY_PRICE_PAISE,
      limit: PREMIUM_MONTHLY_PUBLISH_LIMIT,
    },
    freeLimit: FREE_MONTHLY_PUBLISH_LIMIT,
  };
}

export async function createPremiumPaymentOrder({ billingCycle = 'monthly', userEmail } = {}) {
  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
  const amountPaise = cycle === 'annual' ? PREMIUM_YEARLY_PRICE_PAISE : PREMIUM_MONTHLY_PRICE_PAISE;
  const publicConfig = getRazorpayPublicConfig();
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  const description = `HRYantra Premium job posting (${cycle})`;
  const amountInr = (amountPaise / 100).toFixed(2);

  if (!publicConfig.enabled) {
    const orderId = `order_jobprem_${Date.now()}`;
    const upiPayLink = buildUpiPayUri({
      merchantUpi: publicConfig.merchantUpi,
      merchantName: publicConfig.merchantName,
      amountInr: Number(amountInr),
      transactionNote: description,
      transactionRef: orderId,
    });
    return {
      mode: 'clone',
      orderId,
      amount: amountPaise,
      amountPaise,
      amountInr,
      currency: publicConfig.currency || 'INR',
      merchantName: publicConfig.merchantName,
      merchantUpi: publicConfig.merchantUpi,
      packageId: 'job-posting-premium',
      packageName: 'Premium Job Posting',
      billingCycle: cycle,
      description,
      keyId: publicConfig.keyId || null,
      enabled: false,
      upiPayLink,
    };
  }

  const order = await createRazorpayOrder({
    amountPaise,
    receipt: `jpp_${Date.now()}`,
    notes: {
      product: 'job_posting_premium',
      billingCycle: cycle,
      tenantDbName,
      payerEmail: String(userEmail || '').trim(),
    },
  });

  return {
    mode: 'live',
    orderId: order.id,
    amount: amountPaise,
    amountPaise,
    amountInr,
    currency: order.currency || 'INR',
    merchantName: publicConfig.merchantName,
    merchantUpi: publicConfig.merchantUpi,
    packageId: 'job-posting-premium',
    packageName: 'Premium Job Posting',
    billingCycle: cycle,
    description,
    keyId: publicConfig.keyId,
    enabled: true,
  };
}

export async function activatePremium({
  billingCycle = 'monthly',
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  paymentReference,
  activatedBy,
} = {}) {
  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
  const publicConfig = getRazorpayPublicConfig();

  const expectedAmountPaise =
    cycle === 'annual' ? PREMIUM_YEARLY_PRICE_PAISE : PREMIUM_MONTHLY_PRICE_PAISE;

  if (publicConfig.enabled) {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new Error('Complete Razorpay payment is required to activate Premium');
    }
    verifyRazorpayPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
    const tenantDbName = String(getActiveTenantDbName() || '').trim();
    await assertRazorpayPaymentCaptured({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      expectedAmountPaise,
      expectedNotes: {
        product: 'job_posting_premium',
        billingCycle: cycle,
        ...(tenantDbName ? { tenantDbName } : {}),
      },
    });
  } else if (!paymentReference && !(razorpayOrderId && razorpayPaymentId)) {
    throw new Error('Payment reference is required to activate Premium');
  }

  const now = new Date();
  const until = new Date(now);
  if (cycle === 'annual') until.setUTCFullYear(until.getUTCFullYear() + 1);
  else until.setUTCMonth(until.getUTCMonth() + 1);

  const plan = {
    tier: 'premium',
    monthlyLimit: PREMIUM_MONTHLY_PUBLISH_LIMIT,
    billingCycle: cycle,
    activatedAt: now.toISOString(),
    premiumUntil: until.toISOString(),
    lastPaymentReference:
      paymentReference || razorpayPaymentId || razorpayOrderId || `manual_${Date.now()}`,
    activatedBy: activatedBy || null,
  };
  await saveJobPostingPlan(plan);
  const snapshot = await getJobPostingQuotaSnapshot();
  return { plan, snapshot };
}

export async function ensureFreePlanIfMissing() {
  const row = await findOrgSettingRow(JOB_POSTING_PLAN_SETTING_KEY);
  if (row?.value && typeof row.value === 'object') return getJobPostingPlan();
  return saveJobPostingPlan(defaultPlan());
}

/**
 * HQ override: set monthly publish limit / Premium tier for the active tenant context.
 */
export async function hqSetJobPostingPlan({
  monthlyLimit,
  tier = 'free',
  billingCycle = 'monthly',
  premiumUntilDays = 30,
  note,
  activatedBy = 'hq',
} = {}) {
  const limit = Math.max(1, Math.floor(Number(monthlyLimit) || FREE_MONTHLY_PUBLISH_LIMIT));
  const nextTier = String(tier || '').toLowerCase() === 'premium' ? 'premium' : 'free';
  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
  const now = new Date();
  let premiumUntil = null;
  if (nextTier === 'premium') {
    const until = new Date(now);
    const days = Math.max(1, Math.floor(Number(premiumUntilDays) || 30));
    until.setUTCDate(until.getUTCDate() + days);
    premiumUntil = until.toISOString();
  }

  const plan = {
    tier: nextTier,
    monthlyLimit: limit,
    billingCycle: cycle,
    activatedAt: now.toISOString(),
    premiumUntil,
    lastPaymentReference: String(note || '').trim() || `hq_grant_${Date.now()}`,
    activatedBy: activatedBy || 'hq',
  };
  await saveJobPostingPlan(plan);
  return getJobPostingQuotaSnapshot();
}
