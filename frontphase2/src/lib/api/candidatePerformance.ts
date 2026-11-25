import { apiFetch } from './core';

export type CandidatePerfOverview = {
  tenantId: string;
  env: string;
  cacheEnabled: boolean;
  ttlSec: number;
  version: number;
  engine: Record<string, unknown>;
  counters: Record<string, number>;
  l1: Record<string, number>;
  l2Available: boolean;
  coalescer: Record<string, number>;
};

export async function apiCandidatePerfOverview() {
  return apiFetch<CandidatePerfOverview>('/candidate-performance/overview', { auth: true });
}

export async function apiCandidatePerfCacheStats() {
  return apiFetch<Record<string, unknown>>('/candidate-performance/cache-stats', { auth: true });
}

export async function apiCandidatePerfHistory(limit = 50) {
  return apiFetch<{ items: Array<Record<string, unknown>> }>(
    `/candidate-performance/history?limit=${encodeURIComponent(String(limit))}`,
    { auth: true },
  );
}

export async function apiCandidatePerfRunTest(body: {
  mode?: 'cached' | 'bypass' | 'legacy' | 'refresh' | 'forceMiss';
  mine?: boolean;
  page?: number;
  limit?: number;
  search?: string;
}) {
  return apiFetch<Record<string, unknown>>('/candidate-performance/run-test', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiCandidatePerfConcurrencyTest(body: {
  concurrency?: number;
  mine?: boolean;
  page?: number;
  limit?: number;
  mode?: 'cached' | 'bypass';
}) {
  return apiFetch<{ summary: Record<string, unknown>; rows: Array<Record<string, unknown>> }>(
    '/candidate-performance/concurrency-test',
    { method: 'POST', auth: true, body },
  );
}

export async function apiCandidatePerfCacheRefresh() {
  return apiFetch<{ version: number }>('/candidate-performance/cache-refresh', {
    method: 'POST',
    auth: true,
    body: {},
  });
}

export async function apiCandidatePerfCacheClear() {
  return apiFetch<Record<string, unknown>>('/candidate-performance/cache-clear', {
    method: 'POST',
    auth: true,
    body: {},
  });
}

export async function apiCandidatePerfResetStats(clearHistory = false) {
  return apiFetch<Record<string, unknown>>('/candidate-performance/reset-stats', {
    method: 'POST',
    auth: true,
    body: { clearHistory },
  });
}
