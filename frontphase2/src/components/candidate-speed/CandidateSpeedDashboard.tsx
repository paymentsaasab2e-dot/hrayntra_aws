'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleHelp, Loader2, Play, RefreshCw, Trash2, Zap } from 'lucide-react';
import {
  apiCandidatePerfCacheClear,
  apiCandidatePerfCompare,
  apiCandidatePerfConcurrencyTest,
  apiCandidatePerfHistory,
  apiCandidatePerfOverview,
  apiCandidatePerfResetStats,
  apiCandidatePerfRunTest,
  type CandidatePerfOverview,
  type CompareResult,
  type ConcurrencySummary,
  type HistoryRow,
  type HistorySource,
  type RunResult,
  type StateSummary,
} from '@/lib/api/candidatePerformance';
import { CandidateSpeedGuide, STATE_META, StateBadge, toneClasses } from './candidateSpeedGuide';

type Busy =
  | ''
  | 'cached'
  | 'bypass'
  | 'refresh'
  | 'compare'
  | 'concurrency'
  | 'clear'
  | 'reset';

const fmtMs = (v: number | null | undefined) => (v == null || Number.isNaN(Number(v)) ? 'N/A' : `${v} ms`);
const fmtBytes = (n: number | null | undefined) => {
  if (n == null) return 'N/A';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

function Card({
  title,
  hint,
  children,
  className = '',
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number | null | undefined;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3" title={hint}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
        {value == null || value === '' ? 'N/A' : value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ActionButton({
  label,
  description,
  onClick,
  busy,
  active,
  disabled,
  tone = 'default',
  icon,
}: {
  label: string;
  description: string;
  onClick: () => void;
  busy?: boolean;
  active?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'default' | 'warn' | 'danger' | 'indigo';
  icon?: ReactNode;
}) {
  const toneCls: Record<string, string> = {
    primary: 'bg-sky-600 text-white hover:bg-sky-700 border-sky-600',
    default: 'bg-white text-slate-800 hover:bg-slate-50 border-slate-200',
    warn: 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 hover:bg-rose-100 border-rose-200',
    indigo: 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border-indigo-200',
  };
  return (
    <div className="flex w-full flex-col sm:w-56">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneCls[tone]} ${active ? 'ring-2 ring-sky-300' : ''}`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {label}
      </button>
      <p className="mt-1 px-0.5 text-[11px] leading-snug text-slate-500">{description}</p>
    </div>
  );
}

/** Plain-English verdict for one request. */
function verdictFor(run: RunResult): { tone: 'good' | 'warn' | 'bad' | 'neutral'; text: string } {
  const perf = run.perf;
  if (!perf) return { tone: 'neutral', text: 'No details were returned for this request.' };
  const meta = STATE_META[perf.cacheState];
  const ops = perf.mongo?.ops;
  const ms = perf.timings?.totalMs ?? run.durationMs;
  const opsText = ops == null ? '' : ` It made ${ops} database operation${ops === 1 ? '' : 's'}.`;
  const degraded = perf.degraded
    ? ` The database was slow so a reduced result was returned and NOT saved to the cache (${perf.degraded}).`
    : '';
  return {
    tone: perf.degraded ? 'bad' : meta?.tone || 'neutral',
    text: `${meta?.short || perf.cacheState} in ${ms} ms.${opsText}${degraded}`,
  };
}

function RunCard({ title, run }: { title: string; run: RunResult | null }) {
  if (!run) return null;
  const perf = run.perf;
  const verdict = verdictFor(run);
  const byOp = perf?.mongo?.byOp ? Object.entries(perf.mongo.byOp) : [];
  const byDb = perf?.mongo?.byDb ? Object.entries(perf.mongo.byDb) : [];
  return (
    <Card title={title}>
      <div className={`rounded-xl border px-4 py-3 text-sm ${toneClasses[verdict.tone]}`}>
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge state={perf?.cacheState} />
          <span className="font-medium">{verdict.text}</span>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total time" value={fmtMs(perf?.timings?.totalMs ?? run.durationMs)} />
        <Metric label="Memory lookup (L1)" value={fmtMs(perf?.timings?.l1Ms)} hint="Time to check server memory" />
        <Metric
          label="Redis lookup (L2)"
          value={perf?.l2Configured ? fmtMs(perf?.timings?.l2Ms) : 'Not configured'}
          hint={perf?.l2Configured ? undefined : 'Optional — not needed'}
        />
        <Metric label="Database load" value={fmtMs(perf?.timings?.loadMs)} hint="Time spent building from MongoDB" />
        <Metric label="Mongo operations" value={perf?.mongo?.ops ?? 'N/A'} hint="Real DB calls for this request" />
        <Metric
          label="Mongo time (sum)"
          value={fmtMs(perf?.mongo?.dbMsSum)}
          hint="Sum of each call's duration (calls can overlap)"
        />
        <Metric label="Docs examined" value="N/A" hint="Needs explain(); never estimated" />
        <Metric
          label="Rows returned / total"
          value={`${run.returned ?? 'N/A'} / ${run.total ?? 'N/A'}`}
        />
      </div>
      <div className="mt-3 grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
        <div>
          <p className="font-semibold text-slate-700">Mongo operations by type</p>
          <p className="mt-1">
            {byOp.length ? byOp.map(([k, v]) => `${k}: ${v}`).join(' · ') : 'None (nothing hit the database)'}
          </p>
          {byDb.length ? <p className="mt-1">By database: {byDb.map(([k, v]) => `${k}: ${v}`).join(' · ')}</p> : null}
        </div>
        <div>
          <p className="font-semibold text-slate-700">Cache details</p>
          <p className="mt-1">
            View: {perf?.tab === 'mine' ? 'Mine (per user)' : 'All'} · Visibility: {perf?.visibility || 'N/A'} ·
            Version: {perf?.version ?? 'N/A'} · Shared across users: {perf?.shareable ? 'yes (Super Admin)' : 'no (per user)'}
          </p>
          {perf?.freshness ? (
            <p className="mt-1">
              Entry age: {Math.round(perf.freshness.ageMs / 1000)}s · Fresh for another:{' '}
              {Math.round(perf.freshness.ttlLeftMs / 1000)}s
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function LiveCard({ ov, loadingHistory }: { ov: CandidatePerfOverview; loadingHistory: boolean }) {
  const live = ov.counters.live;
  const s = ov.liveSummary;
  const served = (live?.l1Hits || 0) + (live?.l1StaleHits || 0) + (live?.l2Hits || 0);
  const hitPct = live?.requests ? Math.round((served / live.requests) * 100) : null;
  const hitAvg = ['L1_HIT', 'L1_STALE', 'L2_HIT']
    .map((k) => s[k])
    .filter(Boolean) as StateSummary[];
  const hitMs = hitAvg.length
    ? Math.round(hitAvg.reduce((a, b) => a + (b.avgMs || 0) * b.samples, 0) / hitAvg.reduce((a, b) => a + b.samples, 0))
    : null;
  const missMs = s.MISS?.avgMs ?? null;

  let verdict = 'No real Candidates-tab requests have been recorded yet. Open the Candidates tab, then press Refresh here.';
  if (live?.requests) {
    verdict = `${live.requests} real Candidates-tab request${live.requests === 1 ? '' : 's'} so far: ${hitPct}% served from the cache without waiting for the database.`;
    if (hitMs != null && missMs != null) {
      verdict += ` Cached loads averaged ${hitMs} ms; loads that had to hit the database averaged ${missMs} ms.`;
    } else if (hitMs != null) {
      verdict += ` Cached loads averaged ${hitMs} ms.`;
    } else if (missMs != null) {
      verdict += ` Every load so far had to hit the database (average ${missMs} ms) — open the tab again to see a cached load.`;
    }
  }

  return (
    <Card
      title="Live Candidates tab (real traffic)"
      hint="Counts only the real requests made by the Candidates tab in this organization since the server started or stats were reset."
    >
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-800">{verdict}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Real requests" value={live?.requests ?? 0} />
        <Metric label="Served from cache" value={hitPct == null ? 'N/A' : `${hitPct}%`} />
        <Metric label="Loaded from DB" value={(live?.misses || 0) + (live?.refreshes || 0)} hint="MISS + forced rebuilds" />
        <Metric label="Waited & shared" value={live?.coalesced ?? 0} hint="Coalesced duplicates" />
        <Metric label="Mongo ops (total)" value={live?.mongoOps ?? 0} />
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-2 py-2">Result kind</th>
              <th className="px-2 py-2">Samples</th>
              <th className="px-2 py-2">Avg</th>
              <th className="px-2 py-2">p50</th>
              <th className="px-2 py-2">p95</th>
              <th className="px-2 py-2">Max</th>
              <th className="px-2 py-2">Avg Mongo ops</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(s).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-slate-500">
                  {loadingHistory ? 'Loading…' : 'No live samples yet.'}
                </td>
              </tr>
            ) : (
              Object.entries(s).map(([state, row]) => (
                <tr key={state} className="border-t border-slate-100">
                  <td className="px-2 py-2"><StateBadge state={state} /></td>
                  <td className="px-2 py-2 tabular-nums">{row.samples}</td>
                  <td className="px-2 py-2 tabular-nums">{fmtMs(row.avgMs)}</td>
                  <td className="px-2 py-2 tabular-nums">{fmtMs(row.p50Ms)}</td>
                  <td className="px-2 py-2 tabular-nums">{fmtMs(row.p95Ms)}</td>
                  <td className="px-2 py-2 tabular-nums">{fmtMs(row.maxMs)}</td>
                  <td className="px-2 py-2 tabular-nums">{row.avgMongoOps ?? 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CompareCard({ data }: { data: CompareResult }) {
  const s = data.summary;
  return (
    <Card title="Compare result: no cache vs cached" hint={s.note}>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Without the cache this list took <strong>{s.baselineMs} ms</strong>. First load after clearing took{' '}
        <strong>{s.coldMs} ms</strong>. Repeat loads from the cache took a median of{' '}
        <strong>{s.warmMedianMs ?? 'N/A'} ms</strong>
        {s.speedup ? (
          <>
            {' '}— about <strong>{s.speedup}× faster</strong> than no cache
          </>
        ) : null}
        .
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-2 py-2">Step</th>
              <th className="px-2 py-2">Result</th>
              <th className="px-2 py-2">Time</th>
              <th className="px-2 py-2">Mongo ops</th>
              <th className="px-2 py-2">Rows</th>
            </tr>
          </thead>
          <tbody>
            {data.steps.map((st, i) => (
              <tr key={`${st.label}-${i}`} className="border-t border-slate-100">
                <td className="px-2 py-2 text-slate-700">{i + 1}. {st.label}</td>
                <td className="px-2 py-2"><StateBadge state={st.perf?.cacheState} /></td>
                <td className="px-2 py-2 tabular-nums">{fmtMs(st.durationMs)}</td>
                <td className="px-2 py-2 tabular-nums">{st.perf?.mongo?.ops ?? 'N/A'}</td>
                <td className="px-2 py-2 tabular-nums">{st.returned ?? 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ConcurrencyCard({ s }: { s: ConcurrencySummary }) {
  let verdict = '';
  if (s.mode === 'bypass') {
    verdict = `${s.concurrency} simultaneous requests with no cache: every one went to the database.`;
  } else if (s.coldStart) {
    verdict = `Cold start with ${s.concurrency} simultaneous identical requests: ${s.misses} database load${s.misses === 1 ? '' : 's'}, ${s.coalesced} shared the result (coalesced), ${s.l1Hits} hit memory. Total Mongo operations: ${s.totalMongoOps ?? 'N/A'}.`;
  } else {
    verdict = `Warm cache with ${s.concurrency} simultaneous requests: ${s.l1Hits + s.staleHits + s.l2Hits} served from cache, ${s.misses} loaded from the database. Total Mongo operations: ${s.totalMongoOps ?? 'N/A'}.`;
  }
  return (
    <Card title={`Concurrency result (${s.concurrency} at once)`}>
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{verdict}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Succeeded / failed" value={`${s.success} / ${s.failed}`} />
        <Metric label="Memory hits" value={s.l1Hits} />
        <Metric label="DB loads (MISS)" value={s.misses} />
        <Metric label="Coalesced" value={s.coalesced} />
        <Metric label="Total Mongo ops" value={s.totalMongoOps ?? 'N/A'} />
        <Metric label="Average" value={fmtMs(s.avgMs)} />
        <Metric label="p95" value={fmtMs(s.p95)} />
        <Metric label="Slowest" value={fmtMs(s.maxMs)} />
      </div>
    </Card>
  );
}

export default function CandidateSpeedPage() {
  const [overview, setOverview] = useState<CandidatePerfOverview | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historySource, setHistorySource] = useState<HistorySource>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Busy>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [concResult, setConcResult] = useState<ConcurrencySummary | null>(null);

  const [mine, setMine] = useState(false);
  const [includeCommonPool, setIncludeCommonPool] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [concurrency, setConcurrency] = useState(10);
  const [coldStart, setColdStart] = useState(true);
  const [search, setSearch] = useState('');

  const scope = useMemo(
    () => ({
      mine,
      includeCommonPool: mine ? false : includeCommonPool,
      page: 1,
      limit: pageSize,
      search: search.trim() || undefined,
    }),
    [mine, includeCommonPool, pageSize, search],
  );

  const refresh = useCallback(
    async (source: HistorySource = historySource) => {
      setError('');
      try {
        const [ov, hist] = await Promise.all([
          apiCandidatePerfOverview(),
          apiCandidatePerfHistory(40, source),
        ]);
        setOverview(ov.data || null);
        setHistory(hist.data?.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load performance data');
      } finally {
        setLoading(false);
      }
    },
    [historySource],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [autoRefresh, refresh]);

  const exec = async (kind: Busy, fn: () => Promise<void>) => {
    setBusy(kind);
    setError('');
    setNotice('');
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy('');
    }
  };

  const run = (mode: 'cached' | 'bypass' | 'refresh') =>
    exec(mode, async () => {
      const res = await apiCandidatePerfRunTest({ ...scope, mode });
      setLastRun(res.data || null);
    });

  const runCompare = () =>
    exec('compare', async () => {
      const res = await apiCandidatePerfCompare(scope);
      setCompare(res.data || null);
      setLastRun(res.data?.steps?.[res.data.steps.length - 1] || null);
    });

  const runConcurrency = () =>
    exec('concurrency', async () => {
      const res = await apiCandidatePerfConcurrencyTest({ ...scope, concurrency, mode: 'cached', coldStart });
      setConcResult(res.data?.summary || null);
    });

  const clearCache = () =>
    exec('clear', async () => {
      const res = await apiCandidatePerfCacheClear();
      setNotice(
        `Cleared this organization's cache (${res.data?.removedL1 ?? 0} in-memory entr${res.data?.removedL1 === 1 ? 'y' : 'ies'}). The next load will be a MISS.`,
      );
    });

  const resetStats = () =>
    exec('reset', async () => {
      await apiCandidatePerfResetStats(true);
      setLastRun(null);
      setCompare(null);
      setConcResult(null);
      setNotice('Stats and history reset. The cache itself was not touched.');
    });

  const redis = overview?.redis;
  const redisText = !redis
    ? 'N/A'
    : !redis.configured
      ? 'Not configured'
      : redis.reachable
        ? `Connected (${redis.ms ?? '?'} ms)`
        : 'Configured but unreachable';
  const redisHint = !redis
    ? ''
    : !redis.configured
      ? 'Optional. The in-memory cache (L1) is doing the work.'
      : redis.reachable
        ? 'Shared cache between servers is active.'
        : 'Falling back to memory only; requests still work.';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Candidate Speed</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live statistics for the Candidates tab list cache. Real measurements from the server — nothing is
            simulated. Stats are shown only on this page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-pressed={showHelp}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${showHelp ? 'border-sky-300 bg-sky-100 text-sky-900' : 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'}`}
          >
            <CircleHelp className="h-4 w-4" />
            How to read this page
          </button>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh (5s)
          </label>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {showHelp ? <CandidateSpeedGuide onClose={() => setShowHelp(false)} /> : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {notice ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      ) : null}

      {loading && !overview ? (
        <div className="mt-10 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : overview ? (
        <>
          {!overview.cacheEnabled ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              The cache is <strong>OFF</strong> on this server, so the Candidates tab is not being sped up. Set{' '}
              <code className="rounded bg-white px-1">CANDIDATE_ORG_CACHE_ENABLED=1</code> in the backend{' '}
              <code className="rounded bg-white px-1">.env</code> and restart it.
            </div>
          ) : null}

          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Cache" value={overview.cacheEnabled ? 'ON' : 'OFF'} hint="Server-side candidate list cache" />
            <Metric label="Organization" value={overview.tenantId} hint="Only this organization's data is shown" />
            <Metric
              label="Cache version"
              value={overview.version}
              hint="Goes up every time candidates, jobs or access change"
            />
            <Metric
              label="Fresh / servable"
              value={`${overview.ttlSec}s / +${overview.staleSec}s`}
              hint="Fresh window, then shown instantly while refreshing"
            />
            <Metric
              label="Memory cache (L1)"
              value={`${overview.l1.size} lists · ${fmtBytes(overview.l1.bytes)}`}
              hint={`Limit ${fmtBytes(overview.l1.maxBytes)} · evictions ${overview.l1.evictions}`}
            />
            <Metric label="Redis (L2)" value={redisText} hint={redisHint} />
            <Metric
              label="Auto warm-up"
              value={overview.warmEnabled ? 'ON' : 'OFF'}
              hint={`Rebuilds recent views after a change (${overview.warmer.hotViews} remembered)`}
            />
            <Metric
              label="Login-check memory"
              value={overview.authMemo.enabled ? `ON (${overview.authMemo.ttlSec}s)` : 'OFF'}
              hint={
                overview.authMemo.enabled
                  ? `${overview.authMemo.hits} saved lookups`
                  : 'Set AUTH_LOCAL_CACHE_TTL_SEC to skip repeated user / permission DB lookups'
              }
            />
          </section>

          <div className="mt-6">
            <LiveCard ov={overview} loadingHistory={loading} />
          </div>

          <Card
            title="Run a test"
            hint="Pick what to measure, then press a button. Each button says what it does. Press “How to read this page” for combinations."
            className="mt-6"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="mr-1 font-medium text-slate-600">Candidates tab:</span>
              <button
                type="button"
                onClick={() => setMine(false)}
                className={`rounded-lg border px-3 py-1.5 font-semibold ${!mine ? 'border-sky-500 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setMine(true)}
                className={`rounded-lg border px-3 py-1.5 font-semibold ${mine ? 'border-sky-500 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Mine
              </button>
              <label className={`ml-2 inline-flex items-center gap-2 ${mine ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  disabled={mine}
                  checked={mine ? false : includeCommonPool}
                  onChange={(e) => setIncludeCommonPool(e.target.checked)}
                />
                Include Phase 1 common pool
              </label>
              <label className="ml-2 inline-flex items-center gap-2">
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
              <label className="ml-2 inline-flex items-center gap-2">
                Search
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="optional"
                  className="w-32 rounded-md border border-slate-200 px-2 py-1"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Measuring: <strong>{mine ? 'Mine' : 'All'}</strong> list, {pageSize} rows
              {!mine && includeCommonPool ? ', with Phase 1 common pool' : ''}
              {search.trim() ? `, search "${search.trim()}"` : ''}. &quot;Mine&quot; is cached separately for each
              user.
            </p>

            <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Single request</p>
            <div className="mt-2 flex flex-wrap gap-4">
              <ActionButton
                label="Run once (cached)"
                tone="primary"
                busy={busy === 'cached'}
                disabled={Boolean(busy)}
                onClick={() => void run('cached')}
                icon={<Play className="h-4 w-4" />}
                description="Loads the list the way the Candidates tab does. Press twice: MISS first, then fast L1_HIT."
              />
              <ActionButton
                label="Run once (no cache)"
                busy={busy === 'bypass'}
                disabled={Boolean(busy)}
                onClick={() => void run('bypass')}
                description="Original code, cache skipped. This is your ‘before’ number."
              />
              <ActionButton
                label="Force rebuild"
                busy={busy === 'refresh'}
                disabled={Boolean(busy)}
                onClick={() => void run('refresh')}
                description="Ignores the cache, rebuilds from MongoDB and saves the fresh result."
              />
            </div>

            <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Guided tests</p>
            <div className="mt-2 flex flex-wrap items-start gap-4">
              <ActionButton
                label="Compare: no cache vs cached"
                tone="warn"
                busy={busy === 'compare'}
                disabled={Boolean(busy)}
                onClick={() => void runCompare()}
                icon={<Zap className="h-4 w-4" />}
                description="One click proof: no cache → clear → first load → 3 repeat loads. Clears this organization's cache first."
              />
              <div className="flex w-full flex-col sm:w-72">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void runConcurrency()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-60"
                  >
                    {busy === 'concurrency' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Concurrency ×{concurrency}
                  </button>
                  <select
                    value={concurrency}
                    onChange={(e) => setConcurrency(Number(e.target.value))}
                    aria-label="Number of simultaneous requests"
                    className="rounded-md border border-slate-200 px-2 py-2 text-sm"
                  >
                    {[2, 5, 10, 20].map((n) => (
                      <option key={n} value={n}>
                        ×{n}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={coldStart} onChange={(e) => setColdStart(e.target.checked)} />
                  Start cold (clear this org&apos;s cache first)
                </label>
                <p className="mt-1 px-0.5 text-[11px] leading-snug text-slate-500">
                  {coldStart
                    ? `Simulates ${concurrency} people opening the tab at once on an empty cache. Expect 1 database load, the rest COALESCED.`
                    : `${concurrency} simultaneous requests on a warm cache. Expect all L1_HIT and 0 Mongo operations (run a cached request first).`}
                </p>
              </div>
            </div>

            <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Maintenance</p>
            <div className="mt-2 flex flex-wrap gap-4">
              <ActionButton
                label="Clear cache (this org)"
                tone="danger"
                busy={busy === 'clear'}
                disabled={Boolean(busy)}
                onClick={() => void clearCache()}
                icon={<Trash2 className="h-4 w-4" />}
                description="Deletes this organization's cached lists. The next load is a MISS. Other organizations are untouched."
              />
              <ActionButton
                label="Reset stats"
                busy={busy === 'reset'}
                disabled={Boolean(busy)}
                onClick={() => void resetStats()}
                description="Zeroes counters and history on this page only. The cache is not touched."
              />
            </div>
          </Card>

          <div className="mt-6 space-y-6">
            {compare ? <CompareCard data={compare} /> : null}
            {concResult ? <ConcurrencyCard s={concResult} /> : null}
            <RunCard title="Last single request" run={lastRun} />
          </div>

          <Card
            title="Recent measurements"
            hint="Newest first. “Live” rows are real Candidates-tab loads; “Tests” are buttons on this page."
            className="mt-6"
          >
            <div className="flex flex-wrap gap-2 text-sm">
              {(['all', 'live', 'tests'] as HistorySource[]).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => {
                    setHistorySource(src);
                    void refresh(src);
                  }}
                  className={`rounded-lg border px-3 py-1 font-medium ${historySource === src ? 'border-sky-500 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {src === 'all' ? 'All' : src === 'live' ? 'Live Candidates tab' : 'Tests'}
                </button>
              ))}
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-2 py-2">Time</th>
                    <th className="px-2 py-2">Source</th>
                    <th className="px-2 py-2">View</th>
                    <th className="px-2 py-2">Result</th>
                    <th className="px-2 py-2">ms</th>
                    <th className="px-2 py-2">Mongo ops</th>
                    <th className="px-2 py-2">Rows</th>
                    <th className="px-2 py-2">Version</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-6 text-slate-500">
                        No samples yet — open the Candidates tab or run a test, then press Refresh.
                      </td>
                    </tr>
                  ) : (
                    history.map((row) => {
                      const live = row.testType === 'list' || !row.testType;
                      return (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-2 py-2 text-xs text-slate-500">
                            {String(row.at || '').replace('T', ' ').slice(0, 19)}
                          </td>
                          <td className="px-2 py-2 text-xs">
                            {live ? (
                              <span className="font-semibold text-sky-700">Candidates tab</span>
                            ) : (
                              <span className="text-slate-600">{row.testType}</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-xs">{row.tab === 'mine' ? 'Mine' : 'All'}</td>
                          <td className="px-2 py-2">
                            <StateBadge state={row.cacheState} />
                            {row.error ? <span className="ml-1 text-xs text-rose-600">error</span> : null}
                            {row.degraded ? <span className="ml-1 text-xs text-amber-600">not cached</span> : null}
                          </td>
                          <td className="px-2 py-2 tabular-nums">{row.durationMs ?? '—'}</td>
                          <td className="px-2 py-2 tabular-nums">{row.mongoOps ?? '—'}</td>
                          <td className="px-2 py-2 tabular-nums">{row.returned ?? '—'}</td>
                          <td className="px-2 py-2 tabular-nums">{row.version ?? '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="mt-6 text-xs text-slate-500">
            Environment namespace: <code className="rounded bg-slate-100 px-1">{overview.env}</code>. Numbers
            reset when the backend restarts. Each backend server keeps its own memory cache.
          </p>
        </>
      ) : null}
    </div>
  );
}
