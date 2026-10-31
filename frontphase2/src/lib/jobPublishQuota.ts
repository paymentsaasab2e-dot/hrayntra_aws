import type { JobPublishQuota } from '@/lib/api/jobs';
import { ApiRequestError } from '@/lib/apiNetworkErrors';

export const JOB_PUBLISH_QUOTA_CODE = 'JOB_PUBLISH_QUOTA_EXCEEDED';
export const JOB_PUBLISH_QUOTA_EVENT = 'hryantra:job-publish-quota';
export const JOB_PUBLISH_QUOTA_UPGRADE_HREF = '/setting?section=billing';

export type JobPublishQuotaExceededDetail = {
  jobId?: string;
  draftSaved: boolean;
  quota: JobPublishQuota;
  message: string;
};

function toInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeJobPublishQuota(raw: unknown): JobPublishQuota | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const used = toInt(row.used ?? row.publishedThisMonth ?? row.published);
  const limit = toInt(row.limit ?? row.maxJobs ?? row.quota);
  if (used == null || limit == null || limit <= 0) return null;
  const remaining = toInt(row.remaining) ?? Math.max(0, limit - used);
  const blocked = typeof row.blocked === 'boolean' ? row.blocked : remaining <= 0;
  const warnAt = toInt(row.warnAt) ?? Math.max(1, limit - 2);
  const warning =
    typeof row.warning === 'boolean' ? row.warning : !blocked && used >= warnAt;
  return {
    used,
    limit,
    remaining,
    blocked,
    warnAt,
    warning,
    upgradeRequired:
      typeof row.upgradeRequired === 'boolean' ? row.upgradeRequired : blocked,
    plan: typeof row.plan === 'string' ? row.plan : undefined,
    period: typeof row.period === 'string' ? row.period : undefined,
    monthKey: typeof row.monthKey === 'string' ? row.monthKey : undefined,
    monthLabel: typeof row.monthLabel === 'string' ? row.monthLabel : undefined,
  };
}

function readErrorPayload(error: unknown): Record<string, unknown> | null {
  if (error instanceof ApiRequestError && error.data && typeof error.data === 'object') {
    return error.data as Record<string, unknown>;
  }
  const data = (error as { data?: unknown })?.data;
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  const raw = (error as { raw?: { data?: unknown } })?.raw?.data;
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  return null;
}

export function parseJobPublishQuotaError(error: unknown): JobPublishQuotaExceededDetail | null {
  const payload = readErrorPayload(error);
  const nestedQuota = payload?.quota;
  const quota = normalizeJobPublishQuota(nestedQuota) || normalizeJobPublishQuota(payload);
  const code = typeof payload?.code === 'string' ? payload.code : '';
  const status = error instanceof ApiRequestError ? error.status : (error as { status?: number })?.status;
  const isQuota =
    code === JOB_PUBLISH_QUOTA_CODE ||
    (status === 402 && Boolean(quota) && code !== 'INSUFFICIENT_COINS');
  if (!isQuota || !quota) return null;
  const jobId = typeof payload?.jobId === 'string' ? payload.jobId : undefined;
  return {
    jobId,
    draftSaved: payload?.draftSaved === true,
    quota,
    message:
      error instanceof Error && error.message
        ? error.message
        : 'You have used this month’s free job posts.',
  };
}

export function reportJobPublishQuotaError(error: unknown): boolean {
  const detail = parseJobPublishQuotaError(error);
  if (!detail) return false;
  if (typeof window === 'undefined') return true;
  window.dispatchEvent(new CustomEvent(JOB_PUBLISH_QUOTA_EVENT, { detail }));
  window.dispatchEvent(new CustomEvent('jobportal:jobs-changed'));
  return true;
}

export function openJobPublishQuotaModal(detail: JobPublishQuotaExceededDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(JOB_PUBLISH_QUOTA_EVENT, { detail }));
}
