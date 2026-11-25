'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Play, RefreshCw, Trash2, Zap } from 'lucide-react';
import {
  apiCandidatePerfCacheClear,
  apiCandidatePerfCacheRefresh,
  apiCandidatePerfConcurrencyTest,
  apiCandidatePerfHistory,
  apiCandidatePerfOverview,
  apiCandidatePerfResetStats,
  apiCandidatePerfRunTest,
  type CandidatePerfOverview,
} from '@/lib/api/candidatePerformance';

type RunResult = Record<string, unknown> | null;

function Metric({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
        {value == null || value === '' ? 'N/A' : value}
      </p>
    </div>
  );
}

export default function CandidateSpeedPage() {
  const [overview, setOverview] = useState<CandidatePerfOverview | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [lastRun, setLastRun] = useState<RunResult>(null);
  const [coldWarm, setColdWarm] = useState<{ cold: RunResult; warm: RunResult } | null>(null);
  const [concurrency, setConcurrency] = useState(5);
  const [mine, setMine] = useState(false);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [ov, hist] = await Promise.all([
        apiCandidatePerfOverview(),
        apiCandidatePerfHistory(40),
      ]);
      setOverview(ov.data || null);
      setHistory(hist.data?.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (mode: 'cached' | 'bypass' | 'refresh' | 'forceMiss') => {
    setBusy(mode);
    setError('');
    try {
      const res = await apiCandidatePerfRunTest({
        mode,
        mine,
        page: 1,
        limit: pageSize,
      });
      setLastRun(res.data || null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setBusy('');
    }
  };

  const runColdWarm = async () => {
    setBusy('cold-warm');
    setError('');
    try {
      await apiCandidatePerfCacheClear();
      const cold = await apiCandidatePerfRunTest({
        mode: 'forceMiss',
        mine,
        page: 1,
        limit: pageSize,
      });
      const warm = await apiCandidatePerfRunTest({
        mode: 'cached',
        mine,
        page: 1,
        limit: pageSize,
      });
      setColdWarm({ cold: cold.data || null, warm: warm.data || null });
      setLastRun(warm.data || null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cold/warm test failed');
    } finally {
      setBusy('');
    }
  };

  const runConcurrency = async () => {
    setBusy('concurrency');
    setError('');
    try {
      const res = await apiCandidatePerfConcurrencyTest({
        concurrency,
        mine,
        page: 1,
        limit: pageSize,
        mode: 'cached',
      });
      setLastRun(res.data || null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Concurrency test failed');
    } finally {
      setBusy('');
    }
  };

  const perf = (lastRun?.perf || null) as Record<string, unknown> | null;
  const timings = (perf?.timings || null) as Record<string, number> | null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Candidate Speed</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live org-aware retrieval cache metrics from the backend (not simulated).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading && !overview ? (
        <div className="mt-10 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading overview…
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Cache enabled" value={overview?.cacheEnabled ? 'YES' : 'NO'} />
            <Metric label="Tenant" value={overview?.tenantId || 'N/A'} />
            <Metric label="Cache version" value={overview?.version ?? 'N/A'} />
            <Metric label="TTL (sec)" value={overview?.ttlSec ?? 'N/A'} />
            <Metric label="L1 size" value={overview?.l1?.size ?? 'N/A'} />
            <Metric
              label="L1 hit rate"
              value={
                overview?.l1?.hitRate != null
                  ? `${Math.round(Number(overview.l1.hitRate) * 100)}%`
                  : 'N/A'
              }
            />
            <Metric label="L2 Redis" value={overview?.l2Available ? 'UP' : 'DOWN / N/A'} />
            <Metric label="Requests tracked" value={overview?.counters?.requests ?? 0} />
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Test controls</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
                Mine only
              </label>
              <label className="inline-flex items-center gap-2">
                Page size
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded-md border border-slate-200 px-2 py-1"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2">
                Concurrency
                <select
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="rounded-md border border-slate-200 px-2 py-1"
                >
                  {[1, 5, 10, 20].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void run('cached')}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {busy === 'cached' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Cached request
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void run('bypass')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Bypass cache (legacy path)
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void runColdWarm()}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              >
                {busy === 'cold-warm' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Cold → warm compare
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void runConcurrency()}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-60"
              >
                {busy === 'concurrency' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Concurrency ×{concurrency}
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void apiCandidatePerfCacheRefresh().then(() => refresh())}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Bump version
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void apiCandidatePerfCacheClear().then(() => refresh())}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
              >
                <Trash2 className="h-4 w-4" />
                Clear org cache
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void apiCandidatePerfResetStats(true).then(() => refresh())}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Reset stats
              </button>
            </div>
          </section>

          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Last cache state" value={String(perf?.cacheState || 'N/A')} />
            <Metric
              label="Last total (ms)"
              value={timings?.totalMs ?? (lastRun?.durationMs as number) ?? 'N/A'}
            />
            <Metric label="Last L1 (ms)" value={timings?.l1Ms ?? 'N/A'} />
            <Metric label="Last L2 (ms)" value={timings?.l2Ms ?? 'N/A'} />
            <Metric label="Last Mongo path (ms)" value={timings?.mongoMs ?? 'N/A'} />
            <Metric label="Returned" value={(lastRun?.returned as number) ?? 'N/A'} />
            <Metric label="Total count" value={(lastRun?.total as number) ?? 'N/A'} />
            <Metric label="Coalesced" value={perf?.coalesced ? 'YES' : 'NO'} />
          </section>

          {coldWarm ? (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Cold vs warm</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-slate-800">Cold (force miss)</p>
                  <p className="mt-1 tabular-nums text-slate-600">
                    {String((coldWarm.cold?.durationMs as number) ?? 'N/A')} ms ·{' '}
                    {String(
                      (coldWarm.cold?.perf as { cacheState?: string } | undefined)?.cacheState ||
                        'N/A',
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-emerald-900">Warm (cached)</p>
                  <p className="mt-1 tabular-nums text-emerald-800">
                    {String((coldWarm.warm?.durationMs as number) ?? 'N/A')} ms ·{' '}
                    {String(
                      (coldWarm.warm?.perf as { cacheState?: string } | undefined)?.cacheState ||
                        'N/A',
                    )}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent measurements</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-2 py-2">Time</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">State</th>
                    <th className="px-2 py-2">ms</th>
                    <th className="px-2 py-2">Returned</th>
                    <th className="px-2 py-2">Version</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-6 text-slate-500">
                        No samples yet — run a test above.
                      </td>
                    </tr>
                  ) : (
                    history.map((row) => (
                      <tr key={String(row.id)} className="border-t border-slate-100">
                        <td className="px-2 py-2 text-xs text-slate-500">
                          {String(row.at || '').replace('T', ' ').slice(0, 19)}
                        </td>
                        <td className="px-2 py-2">{String(row.testType || '—')}</td>
                        <td className="px-2 py-2 font-medium">{String(row.cacheState || '—')}</td>
                        <td className="px-2 py-2 tabular-nums">{String(row.durationMs ?? '—')}</td>
                        <td className="px-2 py-2 tabular-nums">{String(row.returned ?? '—')}</td>
                        <td className="px-2 py-2 tabular-nums">{String(row.version ?? '—')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-6 text-xs text-slate-500">
            Enable with <code className="rounded bg-slate-100 px-1">CANDIDATE_ORG_CACHE_ENABLED=1</code>{' '}
            and optionally Redis (<code className="rounded bg-slate-100 px-1">REDIS_URL</code>).
            Namespace: <code className="rounded bg-slate-100 px-1">{overview?.env || 'test'}</code>.
            Prefer <code className="rounded bg-slate-100 px-1">/candidate/speed</code> (inherits
            Candidates auth). Testing only.
          </p>
        </>
      )}
    </div>
  );
}
