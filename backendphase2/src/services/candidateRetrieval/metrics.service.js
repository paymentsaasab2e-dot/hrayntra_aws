/**
 * In-memory performance metrics for /candidate/speed (per organization).
 *
 * - Everything is keyed by tenantId: one organization can never read, or reset,
 *   another organization's numbers.
 * - Only timings, counts and cache metadata are stored — no candidate data / PII.
 * - Process-local (resets on restart). Each backend instance has its own numbers.
 */

const MAX_HISTORY = Math.min(
  500,
  Math.max(50, Number(process.env.CANDIDATE_PERF_HISTORY_MAX || 200) || 200),
);

/** @type {Map<string, Array<object>>} */
const historyByTenant = new Map();

function emptyCounters() {
  return {
    requests: 0,
    l1Hits: 0,
    l1StaleHits: 0,
    l2Hits: 0,
    misses: 0,
    refreshes: 0,
    bypasses: 0,
    coalesced: 0,
    errors: 0,
    mongoOps: 0,
    backgroundRefreshes: 0,
    warmups: 0,
  };
}

/** @type {Map<string, ReturnType<typeof emptyCounters>>} */
const countersByTenant = new Map();

function tid(tenantId) {
  return String(tenantId || '').trim() || 'default';
}

function countersFor(tenantId) {
  const key = tid(tenantId);
  let c = countersByTenant.get(key);
  if (!c) {
    c = emptyCounters();
    c.live = emptyCounters(); // real Candidates-tab traffic only (testType 'list')
    countersByTenant.set(key, c);
  }
  return c;
}

export function recordPerfSample(sample) {
  const tenantId = tid(sample.tenantId);
  const row = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...sample,
    tenantId,
  };
  let list = historyByTenant.get(tenantId);
  if (!list) {
    list = [];
    historyByTenant.set(tenantId, list);
  }
  list.unshift(row);
  while (list.length > MAX_HISTORY) list.pop();

  const c = countersFor(tenantId);
  const background = sample.testType === 'background-refresh' || sample.testType === 'warmup';
  if (background) {
    // Background work is tracked separately so it never inflates request counters.
    if (sample.testType === 'warmup') c.warmups += 1;
    else c.backgroundRefreshes += 1;
    c.mongoOps += Number(sample.mongoOps) || 0;
    if (sample.error) c.errors += 1;
    return row;
  }

  const isLive = sample.testType === 'list' || sample.testType === undefined;
  tally(c, sample);
  if (isLive) tally(c.live, sample);
  return row;
}

function tally(c, sample) {
  c.requests += 1;
  switch (sample.cacheState) {
    case 'L1_HIT':
      c.l1Hits += 1;
      break;
    case 'L1_STALE':
      c.l1StaleHits += 1;
      break;
    case 'L2_HIT':
      c.l2Hits += 1;
      break;
    case 'MISS':
    case 'COALESCED':
      c.misses += 1;
      break;
    case 'REFRESH':
      c.refreshes += 1;
      break;
    case 'BYPASS':
    case 'DISABLED':
      c.bypasses += 1;
      break;
    default:
      break;
  }
  if (sample.coalesced) c.coalesced += 1;
  if (sample.error) c.errors += 1;
  c.mongoOps += Number(sample.mongoOps) || 0;
}

function matchesSource(row, source) {
  if (!source || source === 'all') return true;
  const live = row.testType === 'list' || row.testType === undefined;
  if (source === 'live') return live;
  if (source === 'tests') return !live && row.testType !== 'background-refresh' && row.testType !== 'warmup';
  if (source === 'background') return row.testType === 'background-refresh' || row.testType === 'warmup';
  return true;
}

export function listPerfHistory({ limit = 50, tenantId, source } = {}) {
  const max = Math.min(200, Math.max(1, Number(limit) || 50));
  return (historyByTenant.get(tid(tenantId)) || []).filter((r) => matchesSource(r, source)).slice(0, max);
}

export function getPerfCounters(tenantId) {
  const c = countersFor(tenantId);
  return { ...c, live: { ...c.live } };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

/**
 * Real per-cache-state statistics computed from this organization's recorded samples
 * (foreground requests only).
 */
export function summarizePerf(tenantId, { source = 'all' } = {}) {
  const rows = (historyByTenant.get(tid(tenantId)) || []).filter(
    (r) =>
      r.testType !== 'background-refresh' &&
      r.testType !== 'warmup' &&
      !r.error &&
      matchesSource(r, source),
  );
  const byState = {};
  for (const r of rows) {
    const state = String(r.cacheState || 'UNKNOWN');
    (byState[state] ||= []).push(r);
  }
  const out = {};
  for (const [state, list] of Object.entries(byState)) {
    const ms = list
      .map((r) => Number(r.durationMs))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    const ops = list.map((r) => Number(r.mongoOps)).filter((n) => Number.isFinite(n));
    out[state] = {
      samples: list.length,
      avgMs: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null,
      p50Ms: percentile(ms, 50),
      p95Ms: percentile(ms, 95),
      minMs: ms.length ? ms[0] : null,
      maxMs: ms.length ? ms[ms.length - 1] : null,
      avgMongoOps: ops.length ? Math.round((ops.reduce((a, b) => a + b, 0) / ops.length) * 10) / 10 : null,
    };
  }
  return out;
}

/** Reset ONE organization's counters (and optionally its history). */
export function resetPerfCounters(tenantId) {
  countersByTenant.set(tid(tenantId), emptyCounters());
}

export function clearPerfHistory(tenantId) {
  historyByTenant.delete(tid(tenantId));
}
