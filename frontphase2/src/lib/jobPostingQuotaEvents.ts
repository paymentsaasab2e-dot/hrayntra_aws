import {
  isJobPostingQuotaError,
  readQuotaFromError,
  type JobPostingQuotaSnapshot,
} from './api/jobPostingPlan';

export const JOB_POSTING_QUOTA_EVENT = 'hryantra:job-posting-quota-exceeded';
export const JOB_POSTING_QUOTA_REFRESH_EVENT = 'hryantra:job-posting-quota-refresh';

export function emitJobPostingQuotaExceeded(quota?: JobPostingQuotaSnapshot | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(JOB_POSTING_QUOTA_EVENT, {
      detail: { quota: quota || null },
    }),
  );
}

export function emitJobPostingQuotaRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(JOB_POSTING_QUOTA_REFRESH_EVENT));
}

export function notifyJobPostingQuotaIfNeeded(error: unknown): boolean {
  if (!isJobPostingQuotaError(error)) return false;
  emitJobPostingQuotaExceeded(readQuotaFromError(error));
  return true;
}
