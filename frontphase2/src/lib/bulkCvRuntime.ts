import { bulkCvPoolSize } from './bulkCvApiPool';

/** Runtime tuning for Phase 2 bulk CV upload (parse + create). */

export function isLocalDevBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Parallel workers for bulk CV (parse + save).
 * Single API production default: 2 (fast but stable — matches backend parse queue).
 */
export function resolveBulkCvConcurrency(): number {
  const local = isLocalDevBrowser();
  const poolSize = bulkCvPoolSize();
  const singleApiProdDefault = 2;
  const poolAwareDefault = local ? 3 : poolSize > 1 ? poolSize : singleApiProdDefault;
  const maxConc = Math.min(
    12,
    readPositiveInt(
      process.env.NEXT_PUBLIC_BULK_CV_MAX_CONCURRENCY,
      local ? 12 : Math.max(singleApiProdDefault, poolSize)
    )
  );
  const configured = readPositiveInt(process.env.NEXT_PUBLIC_BULK_CV_CONCURRENCY, NaN);
  const desired = Number.isFinite(configured) ? configured : poolAwareDefault;
  return Math.min(maxConc, Math.max(1, desired));
}

export function resolveBulkCvMaxRetries(): number {
  return Math.max(1, readPositiveInt(process.env.NEXT_PUBLIC_BULK_CV_MAX_RETRIES, isLocalDevBrowser() ? 3 : 5));
}

export function resolveBulkCvRetryBaseDelayMs(): number {
  const configured = readPositiveInt(process.env.NEXT_PUBLIC_BULK_CV_RETRY_DELAY_MS, NaN);
  if (Number.isFinite(configured)) return configured;
  return isLocalDevBrowser() ? 1500 : 2500;
}

/** No artificial pause between files — backend parse queue handles pacing on a single API. */
export function resolveBulkCvInterFileDelayMs(): number {
  const configured = readPositiveInt(process.env.NEXT_PUBLIC_BULK_CV_INTER_FILE_DELAY_MS, NaN);
  if (Number.isFinite(configured)) return configured;
  return 0;
}

/**
 * Stagger parallel worker start on a single API so two parses do not spike at the same instant.
 * Keeps throughput high without the failures seen with 3+ simultaneous parses.
 */
export function resolveBulkCvWorkerStaggerMs(): number {
  const configured = readPositiveInt(process.env.NEXT_PUBLIC_BULK_CV_WORKER_STAGGER_MS, NaN);
  if (Number.isFinite(configured)) return configured;
  if (isLocalDevBrowser() || bulkCvPoolSize() > 1) return 0;
  return 400;
}
