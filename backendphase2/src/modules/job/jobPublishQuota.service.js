import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { getSubscriptionPlan } from '../setting/recruitmentMode.service.js';

/**
 * Freemium job-publish quota.
 *
 * Product law (one OS, freemium first):
 * - A company posts up to N jobs per CALENDAR MONTH for free (default 10).
 * - Only the FIRST successful publish of a job consumes a slot:
 *   draft = no slot, edit-while-live = no slot, close = no refund,
 *   duplicate-then-publish = new slot, unused slots do not carry over.
 * - The counter is `Job.firstPublishedAt` (stamped once per job). Counting jobs
 *   whose firstPublishedAt falls inside the current month == counting this
 *   month's successful publishes.
 * - Tenant scope is the tenant Mongo database itself (per-company workspace):
 *   `prisma` already routes to the active tenant DB, so counts are per company.
 *
 * Limit source for this ticket: flat `JOB_PUBLISH_MONTHLY_LIMIT` (default 10,
 * <= 0 means unlimited for premium tenants until HQ plans wire per-plan caps).
 */

export const JOB_PUBLISH_QUOTA_CODE = 'JOB_PUBLISH_QUOTA_EXCEEDED';
export const JOB_PUBLISH_QUOTA_HTTP_STATUS = 402; // Payment Required — drives the Premium modal
export const JOB_PUBLISH_WARN_AT = 8;
export const DEFAULT_JOB_PUBLISH_MONTHLY_LIMIT = 10;

export function resolveJobPublishMonthlyLimit(raw = env.JOB_PUBLISH_MONTHLY_LIMIT) {
  const text = String(raw ?? '').trim();
  if (!text) return DEFAULT_JOB_PUBLISH_MONTHLY_LIMIT;
  const value = Number(text);
  if (!Number.isFinite(value)) return DEFAULT_JOB_PUBLISH_MONTHLY_LIMIT;
  return Math.floor(value); // <= 0 => unlimited
}

/** Server-local calendar month window (codebase convention: new Date(y, m, 1)). */
export function jobPublishMonthWindow(now = new Date()) {
  const base = now instanceof Date ? now : new Date(now);
  const windowStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const windowEnd = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const monthKey = `${windowStart.getFullYear()}-${String(windowStart.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = windowStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return { monthKey, monthLabel, windowStart, windowEnd };
}

/** Jobs that consumed a publish slot inside the window (tenant DB scope). */
export async function countJobsPublishedInWindow({ windowStart, windowEnd }) {
  return prisma.job.count({
    where: {
      firstPublishedAt: { gte: windowStart, lt: windowEnd },
    },
  });
}

/** Full quota payload for the always-visible badge and the Premium modal. */
export async function getJobPublishQuotaStatus(now = new Date()) {
  const limit = resolveJobPublishMonthlyLimit();
  const { monthKey, monthLabel, windowStart, windowEnd } = jobPublishMonthWindow(now);
  const [used, plan] = await Promise.all([
    countJobsPublishedInWindow({ windowStart, windowEnd }),
    getSubscriptionPlan().catch(() => null),
  ]);
  const unlimited = !(limit > 0);
  const remaining = unlimited ? null : Math.max(0, limit - used);
  const upgradeRequired = !unlimited && remaining === 0;
  return {
    used,
    limit: unlimited ? null : limit,
    remaining,
    blocked: upgradeRequired,
    upgradeRequired,
    warnAt: JOB_PUBLISH_WARN_AT,
    warning: !unlimited && used >= JOB_PUBLISH_WARN_AT,
    plan: String(plan?.name || '').trim() || 'Free',
    period: monthLabel,
    monthKey,
    monthLabel,
    windowStart,
    windowEnd,
  };
}

/**
 * Gate for a publish attempt. Allowed while `used < limit`.
 * NOTE: check-then-write is not atomic; two simultaneous publishes could each
 * pass at `used = limit - 1` and overshoot by one. Publish is a human action —
 * the overshoot is bounded, never blocks a legitimate user, and the counter
 * (firstPublishedAt docs) stays self-consistent without compensation logic.
 */
export async function checkJobPublishAllowance(now = new Date()) {
  const quota = await getJobPublishQuotaStatus(now);
  return { allowed: quota.upgradeRequired !== true, quota };
}

/** Error for a rejected publish. `sendError` turns `code`/`meta` into `data` on the response. */
export function buildJobPublishQuotaError(quota, { jobId = null, draftSaved = false } = {}) {
  const used = quota?.used ?? null;
  const limit = quota?.limit ?? null;
  const monthLabel = quota?.monthLabel || 'this month';
  const error = new Error(
    `Monthly job publish limit reached — ${used ?? '?'} of ${limit ?? '?'} job posts used for ${monthLabel}. ` +
      `Upgrade to Premium to publish more jobs. Your job has been saved as a draft.`,
  );
  error.statusCode = JOB_PUBLISH_QUOTA_HTTP_STATUS;
  error.code = JOB_PUBLISH_QUOTA_CODE;
  error.meta = {
    jobId: jobId ? String(jobId) : null,
    draftSaved: draftSaved === true,
    quota: {
      used,
      limit,
      remaining: quota?.remaining ?? 0,
      warnAt: quota?.warnAt ?? JOB_PUBLISH_WARN_AT,
      blocked: true,
      upgradeRequired: true,
      plan: quota?.plan ?? null,
      period: quota?.period ?? quota?.monthLabel ?? null,
      monthKey: quota?.monthKey ?? null,
      monthLabel: quota?.monthLabel ?? null,
      windowStart: quota?.windowStart ?? null,
      windowEnd: quota?.windowEnd ?? null,
    },
  };
  return error;
}

/**
 * Classify a status write for quota purposes.
 * Returns 'none' (not a publish), 'republish' (already consumed a slot), or
 * 'first-publish' (must hold a free slot). A job "publishes" only when its
 * status becomes OPEN while firstPublishedAt is still null — that includes
 * DRAFT→OPEN and legacy CLOSED/ON_HOLD→OPEN rows never stamped before.
 */
export function resolveJobPublishCharge({ existingStatus, firstPublishedAt, requestedStatus } = {}) {
  const next = String(requestedStatus || '').trim().toUpperCase();
  const prev = String(existingStatus || '').trim().toUpperCase();
  if (next !== 'OPEN' || prev === 'OPEN') return 'none';
  if (firstPublishedAt) return 'republish';
  return 'first-publish';
}
