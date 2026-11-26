import { apiFetch } from './core';

export type CacheState =
  | 'L1_HIT'
  | 'L1_STALE'
  | 'L2_HIT'
  | 'MISS'
  | 'COALESCED'
  | 'REFRESH'
  | 'BYPASS'
  | 'DISABLED'
  | string;

export type MongoStats = {
  ops: number;
  dbMsSum: number;
  byOp: Record<string, number>;
  byDb: Record<string, number>;
  /** Always null: documents-examined needs explain() and is never invented. */
  docsExamined: number | null;
} | null;

export type RequestPerf = {
  cacheState: CacheState;
  coalesced: boolean;
  degraded: string | null;
  cacheKey: string | null;
  tenantId: string;
  env: string;
  tab: 'all' | 'mine';
  shareable: boolean;
  version: number | null;
  visibility: string | null;
  timings: { totalMs: number; l1Ms: number; l2Ms: number; loadMs: number };
  freshness: { ageMs: number; ttlLeftMs: number; stale: boolean } | null;
  mongo: MongoStats;
  l2Configured: boolean;
};

export type RunResult = {
  mode: 'cached' | 'bypass' | 'refresh';
  mine: boolean;
  page: number;
  limit: number;
  includeCommonPool: boolean;
  durationMs: number;
  returned: number | null;
  total: number | null;
  perf: RequestPerf | null;
};

export type StateSummary = {
  samples: number;
  avgMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  minMs: number | null;
  maxMs: number | null;
  avgMongoOps: number | null;
};

export type PerfCounters = {
  requests: number;
  l1Hits: number;
  l1StaleHits: number;
  l2Hits: number;
  misses: number;
  refreshes: number;
  bypasses: number;
  coalesced: number;
  errors: number;
  mongoOps: number;
  backgroundRefreshes: number;
  warmups: number;
  live: Omit<PerfCounters, 'live'>;
};

export type CandidatePerfOverview = {
  tenantId: string;
  env: string;
  cacheEnabled: boolean;
  ttlSec: number;
  staleSec: number;
  warmEnabled: boolean;
  version: number;
  viewer: { isSuperAdmin: boolean };
  redis: { configured: boolean; reachable: boolean; ms: number | null };
  counters: PerfCounters;
  liveSummary: Record<string, StateSummary>;
  testSummary: Record<string, StateSummary>;
  l1: {
    size: number;
    bytes: number;
    max: number;
    maxBytes: number;
    evictions: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  coalescer: { inflight: number; coalescedTotal: number };
  warmer: { enabled: boolean; hotViews: number; pending: boolean } & Record<string, unknown>;
  authMemo: { enabled: boolean; ttlSec: number; entries: number; hits: number; misses: number };
  engine: Record<string, unknown>;
};

export type HistoryRow = {
  id: string;
  at: string;
  testType?: string;
  tab?: string;
  cacheState?: CacheState;
  durationMs?: number;
  mongoOps?: number | null;
  returned?: number | null;
  version?: number | null;
  coalesced?: boolean;
  degraded?: string | null;
  error?: string | null;
};

export type HistorySource = 'live' | 'tests' | 'all';

export type TestScope = {
  mine?: boolean;
  includeCommonPool?: boolean;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  stage?: string;
};

export type CompareStep = RunResult & { label: string };

export type CompareResult = {
  cleared: { tenantId: string; removedL1: number; version: number | null };
  steps: CompareStep[];
  summary: {
    baselineMs: number;
    coldMs: number;
    warmMedianMs: number | null;
    warmMongoOps: Array<number | null>;
    speedup: number | null;
    note: string;
  };
};

export type ConcurrencySummary = {
  concurrency: number;
  mode: 'cached' | 'bypass';
  coldStart: boolean;
  success: number;
  failed: number;
  l1Hits: number;
  staleHits: number;
  l2Hits: number;
  misses: number;
  coalesced: number;
  totalMongoOps: number | null;
  avgMs: number | null;
  p50: number | null;
  p95: number | null;
  maxMs: number | null;
};

const BASE = '/candidate-performance';

export async function apiCandidatePerfOverview() {
  return apiFetch<CandidatePerfOverview>(`${BASE}/overview`, { auth: true });
}

export async function apiCandidatePerfHistory(limit = 50, source: HistorySource = 'all') {
  return apiFetch<{ items: HistoryRow[] }>(
    `${BASE}/history?limit=${encodeURIComponent(String(limit))}&source=${source}`,
    { auth: true },
  );
}

export async function apiCandidatePerfRunTest(body: TestScope & { mode?: 'cached' | 'bypass' | 'refresh' }) {
  return apiFetch<RunResult>(`${BASE}/run-test`, { method: 'POST', auth: true, body });
}

export async function apiCandidatePerfCompare(body: TestScope) {
  return apiFetch<CompareResult>(`${BASE}/compare`, { method: 'POST', auth: true, body });
}

export async function apiCandidatePerfConcurrencyTest(
  body: TestScope & { concurrency?: number; mode?: 'cached' | 'bypass'; coldStart?: boolean },
) {
  return apiFetch<{ summary: ConcurrencySummary; rows: Array<Record<string, unknown>> }>(
    `${BASE}/concurrency-test`,
    { method: 'POST', auth: true, body },
  );
}

export async function apiCandidatePerfCacheClear() {
  return apiFetch<{ tenantId: string; removedL1: number; version: number | null }>(
    `${BASE}/cache-clear`,
    { method: 'POST', auth: true, body: {} },
  );
}

export async function apiCandidatePerfResetStats(clearHistory = false) {
  return apiFetch<Record<string, unknown>>(`${BASE}/reset-stats`, {
    method: 'POST',
    auth: true,
    body: { clearHistory },
  });
}
