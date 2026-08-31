import { createSessionCache, clearSessionStorageByPrefixes } from '@/lib/session-cache';

export const EMPLOYER_LIST_STALE_MS = 2 * 60_000;
export const EMPLOYER_DASH_STALE_MS = 5 * 60_000;

const PREFIX = 'hrayntra:page-cache:v1:';
const LEGACY_JOBS_PAGE_KEY = 'jobs:page-cache:v1';
const LEGACY_JOBS_METRICS_KEY = 'jobs:metrics-cache:v1';

export type EmployerJobsSnapshot = {
  page: number;
  pageSize: number;
  totalEntries: number;
  jobs: unknown[];
};

export type EmployerCandidatesSnapshot = {
  tab: string;
  page: number;
  pageSize: number;
  search: string;
  totalEntries: number;
  candidates: unknown[];
};

function scopeId(): string {
  if (typeof window === 'undefined') return 'ssr';
  const tenant = String(localStorage.getItem('tenantDbName') || 'none').trim() || 'none';
  let userId = 'anon';
  try {
    const raw = localStorage.getItem('currentUser');
    const parsed = raw ? (JSON.parse(raw) as { id?: string; _id?: string }) : null;
    userId = String(parsed?.id || parsed?._id || 'anon');
  } catch {
    userId = 'anon';
  }
  const orgUnit = String(localStorage.getItem('activeOrgUnitId') || '').trim() || 'all-org';
  const work = String(localStorage.getItem('superAdminWorkScope') || 'all').trim() || 'all';
  return `${tenant}::${userId}::${orgUnit}::${work}`;
}

function isJobsSnap(value: unknown): value is EmployerJobsSnapshot {
  const v = value as EmployerJobsSnapshot;
  return Boolean(v && Array.isArray(v.jobs) && typeof v.page === 'number');
}

function isCandidatesSnap(value: unknown): value is EmployerCandidatesSnapshot {
  const v = value as EmployerCandidatesSnapshot;
  return Boolean(v && Array.isArray(v.candidates) && typeof v.page === 'number');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const jobsCache = createSessionCache<EmployerJobsSnapshot>({
  prefix: `${PREFIX}jobs:`,
  staleMs: EMPLOYER_LIST_STALE_MS,
  isValid: isJobsSnap,
});

const jobsMetricsCache = createSessionCache<Record<string, unknown>>({
  prefix: `${PREFIX}job-metrics:`,
  staleMs: EMPLOYER_LIST_STALE_MS,
  isValid: isObject,
});

const candidatesCache = createSessionCache<EmployerCandidatesSnapshot>({
  // v2: stage dropdown needs pipelineJobId from applications/matches, not only assignedJobs
  prefix: `${PREFIX}candidates:v2:`,
  staleMs: EMPLOYER_LIST_STALE_MS,
  isValid: isCandidatesSnap,
});

const crmCache = createSessionCache<Record<string, unknown>>({
  prefix: `${PREFIX}crm:`,
  staleMs: EMPLOYER_DASH_STALE_MS,
  isValid: isObject,
});

const recCache = createSessionCache<Record<string, unknown>>({
  prefix: `${PREFIX}rec:`,
  staleMs: EMPLOYER_DASH_STALE_MS,
  isValid: isObject,
});

export function jobsListCacheKey(page: number, pageSize: number, filterSig = '') {
  return `${scopeId()}::${page}::${pageSize}::${filterSig || 'default'}`;
}

export function readJobsListCache(page: number, pageSize: number, filterSig = '') {
  return jobsCache.read(jobsListCacheKey(page, pageSize, filterSig));
}

export function writeJobsListCache(snap: EmployerJobsSnapshot, filterSig = '') {
  jobsCache.write(jobsListCacheKey(snap.page, snap.pageSize, filterSig), snap);
}

export function isJobsListCacheFresh(
  entry: ReturnType<typeof readJobsListCache>,
) {
  return jobsCache.isFresh(entry);
}

export function readJobsMetricsCache() {
  return jobsMetricsCache.read(scopeId());
}

export function writeJobsMetricsCache(metrics: Record<string, unknown>) {
  jobsMetricsCache.write(scopeId(), metrics);
}

export function candidatesListCacheKey(tab: string, page: number, pageSize: number, search = '') {
  return `${scopeId()}::${tab}::${page}::${pageSize}::${search || ''}`;
}

export function readCandidatesListCache(tab: string, page: number, pageSize: number, search = '') {
  return candidatesCache.read(candidatesListCacheKey(tab, page, pageSize, search));
}

export function writeCandidatesListCache(snap: EmployerCandidatesSnapshot) {
  candidatesCache.write(
    candidatesListCacheKey(snap.tab, snap.page, snap.pageSize, snap.search),
    snap,
  );
}

export function isCandidatesListCacheFresh(
  entry: ReturnType<typeof readCandidatesListCache>,
) {
  return candidatesCache.isFresh(entry);
}

export function dashboardFilterKey(filters?: Record<string, string | undefined | null>) {
  if (!filters) return 'default';
  return Object.entries(filters)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&') || 'default';
}

export function readCrmOverviewCache(filters?: Record<string, string | undefined | null>) {
  return crmCache.read(`${scopeId()}::${dashboardFilterKey(filters)}`);
}

export function writeCrmOverviewCache(
  data: Record<string, unknown>,
  filters?: Record<string, string | undefined | null>,
) {
  crmCache.write(`${scopeId()}::${dashboardFilterKey(filters)}`, data);
}

export function isCrmOverviewCacheFresh(entry: ReturnType<typeof readCrmOverviewCache>) {
  return crmCache.isFresh(entry);
}

export function readRecOverviewCache(filters?: Record<string, string | undefined | null>) {
  return recCache.read(`${scopeId()}::${dashboardFilterKey(filters)}`);
}

export function writeRecOverviewCache(
  data: Record<string, unknown>,
  filters?: Record<string, string | undefined | null>,
) {
  recCache.write(`${scopeId()}::${dashboardFilterKey(filters)}`, data);
}

export function isRecOverviewCacheFresh(entry: ReturnType<typeof readRecOverviewCache>) {
  return recCache.isFresh(entry);
}

export function clearAllEmployerPageCaches() {
  jobsCache.clear();
  jobsMetricsCache.clear();
  candidatesCache.clear();
  crmCache.clear();
  recCache.clear();
  clearSessionStorageByPrefixes([PREFIX]);
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(LEGACY_JOBS_PAGE_KEY);
    sessionStorage.removeItem(LEGACY_JOBS_METRICS_KEY);
  } catch {
    /* ignore */
  }
}

export function invalidateEmployerJobsCache() {
  jobsCache.clear();
  jobsMetricsCache.clear();
}

export function invalidateEmployerCandidatesCache() {
  candidatesCache.clear();
}
