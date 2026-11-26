/**
 * Organization-aware candidate list retrieval wrapper.
 * Reuses candidateService.getAll untouched — this layer only decides WHEN to call it.
 *
 * Request flow (cache enabled):
 *   1. build key  → tenant + visibility + Mine/All + permission scope + filters + page + version
 *   2. L1 (memory)         fresh  → serve                         (0 MongoDB operations)
 *                          stale  → serve instantly + refresh in background (stale-while-revalidate)
 *   3. L2 (Redis, optional) hit   → serve + warm L1               (0 MongoDB operations)
 *   4. miss → single-flight   → candidateService.getAll → store L1 (+L2)
 *
 * Never cached: degraded results (a time-budget fallback fired), errors.
 * Always reported: REAL MongoDB operation counts per request (AsyncLocalStorage + Prisma $use).
 */

import {
  candidateService,
  clearCandidateServiceInternalCaches,
} from '../../modules/candidate/candidate.service.js';
import { clearCandidateCommonInternalCaches } from '../candidateCommon/candidateCommonPool.service.js';
import { parseIncludeCommonPoolQuery } from '../../modules/candidate/candidateListQuery.js';
import { getActiveTenantDbName, runWithTenantContext } from '../../config/prisma.js';
import { runWithQueryCounter } from '../../utils/prismaQueryCounter.js';
import {
  buildListCacheKey,
  stripKeyVersion,
  orgCachePrefix,
  isCandidateOrgCacheEnabled,
  isCacheEnvExplicit,
  cacheEnvNamespace,
  candidateOrgCacheTtlSec,
  candidateOrgStaleSec,
} from './cacheKeys.js';
import { l1GetEntry, l1Set, l1Stats } from './l1Cache.js';
import { l2Get, l2Set, l2Available } from './l2Cache.js';
import { coalesce, coalescerStats } from './coalescer.js';
import { getOrgCandidateVersion } from './versionStore.js';
import { recordPerfSample, getPerfCounters } from './metrics.service.js';
import { getModulesCached, clearModulesCache } from './modulesCache.js';
import { registerInvalidationHook } from './invalidation.service.js';
import {
  rememberHotView,
  setWarmFetcher,
  sanitizeRequestForReplay,
  warmerStats,
} from './warmer.js';

/** Keys currently being refreshed in the background (so we never start two). */
const backgroundInflight = new Set();

function parseMine(req) {
  return req?.query?.mine === 'true' || req?.query?.mine === '1' || req?.query?.mine === true;
}

function parseForceRefresh(req) {
  const q = req?.query || {};
  return (
    q.cacheRefresh === '1' ||
    q.cacheRefresh === 'true' ||
    q.forceMiss === '1' ||
    q.forceMiss === 'true' ||
    req?.headers?.['x-candidate-cache-refresh'] === '1'
  );
}

function parseBypass(req) {
  return (
    req?.query?.cacheBypass === '1' ||
    req?.query?.cacheBypass === 'true' ||
    req?.headers?.['x-candidate-cache-bypass'] === '1'
  );
}

/**
 * Mirror candidateService.resolveLoadCommonPool for the cache key.
 * Returns `null` when it cannot be determined → the caller bypasses the cache
 * (never guess: a wrong guess would file a result under the wrong visibility key).
 * Uses a 30s per-org memo, so a warm hit performs ZERO MongoDB operations here.
 */
async function estimateLoadCommonPool(req, mine) {
  if (mine) return false;
  const q = req?.query || {};
  const picker =
    q.picker === '1' || q.picker === 'true' || q.placementPicker === '1' || q.placementPicker === 'true';
  if (picker) return false;
  if (!parseIncludeCommonPoolQuery(q)) return false;
  try {
    if (!String(getActiveTenantDbName?.() || '').trim()) return true;
    const modules = await getModulesCached();
    return modules?.phase1CommonPoolEnabled !== false;
  } catch {
    return null;
  }
}

function staleSecFor(visibility) {
  const staleSec = candidateOrgStaleSec();
  // Combined (tenant + Phase 1 common pool) views can change from the portal side, which
  // this process cannot see — keep their stale window shorter.
  return visibility === 'combined' ? Math.min(staleSec, 120) : staleSec;
}

function storeResult(key, fresh, built) {
  const ttlSec = candidateOrgCacheTtlSec();
  // Small TTL jitter spreads expiries so many keys do not expire in the same second.
  const jitter = Math.floor(Math.random() * Math.min(10, Math.floor(ttlSec / 5)));
  l1Set(key, fresh, (ttlSec + jitter) * 1000, staleSecFor(built.meta.visibility) * 1000);
  if (l2Available()) {
    void l2Set(key, fresh, ttlSec + jitter);
  }
}

function countReturned(payload) {
  if (Array.isArray(payload?.data)) return payload.data.length;
  if (Array.isArray(payload?.items)) return payload.items.length;
  if (Array.isArray(payload)) return payload.length;
  return null;
}

function newContext() {
  return {
    cacheState: 'BYPASS',
    coalesced: false,
    degraded: null,
    key: null,
    meta: null,
    version: null,
    shareable: false,
    tenantId: String(getActiveTenantDbName?.() || '').trim() || 'default',
    tab: 'all',
    visibility: null,
    freshness: null,
    timings: { totalMs: 0, l1Ms: 0, l2Ms: 0, loadMs: 0 },
  };
}

/** Run the original service (no cache read/write). */
async function runUncached(req, ctx, state) {
  delete req.__candidateListDegraded;
  const t0 = Date.now();
  const result = await candidateService.getAll(req);
  ctx.timings.loadMs = Date.now() - t0;
  ctx.cacheState = state;
  return result;
}

/** Load from MongoDB and store. Degraded results are returned but NOT cached. */
async function loadAndStore(req, key, built, ctx) {
  delete req.__candidateListDegraded;
  const t0 = Date.now();
  const fresh = await candidateService.getAll(req);
  if (ctx) ctx.timings.loadMs = Date.now() - t0;
  const degraded = req.__candidateListDegraded;
  if (degraded) {
    if (ctx) ctx.degraded = String(degraded);
    return fresh;
  }
  storeResult(key, fresh, built);
  return fresh;
}

/** Refresh an expired-but-servable entry without making the user wait. */
function triggerBackgroundRefresh(req, key, built, tenantId, testTypeOverride) {
  if (backgroundInflight.has(key)) return;
  backgroundInflight.add(key);
  const snapshot = sanitizeRequestForReplay(req);
  const tid = tenantId === 'default' ? '' : tenantId;
  const t0 = Date.now();
  void runWithTenantContext(tid, async () => {
    const ctx = newContext();
    ctx.tenantId = tenantId;
    ctx.key = key;
    ctx.tab = built.tab;
    ctx.visibility = built.meta.visibility;
    ctx.version = built.meta.version;
    let stats = null;
    let error = null;
    let payload = null;
    try {
      const out = await runWithQueryCounter(async () => {
        const { result } = await coalesce(key, () => loadAndStore(snapshot, key, built, ctx));
        return result;
      });
      payload = out.result;
      stats = out.stats;
    } catch (err) {
      error = err;
      stats = err?.queryStats || null;
    } finally {
      backgroundInflight.delete(key);
    }
    recordPerfSample({
      tenantId,
      tab: built.tab,
      cacheState: 'REFRESH',
      coalesced: false,
      durationMs: Date.now() - t0,
      l1Ms: 0,
      l2Ms: 0,
      loadMs: ctx.timings.loadMs,
      mongoOps: stats?.ops ?? null,
      mongoDbMsSum: stats?.dbMsSum ?? null,
      mongoByOp: stats?.byOp || null,
      returned: countReturned(payload),
      total: payload?.pagination?.total ?? payload?.total ?? null,
      version: built.meta.version,
      visibility: built.meta.visibility,
      testType: testTypeOverride || 'background-refresh',
      degraded: ctx.degraded,
      error: error ? String(error.message || error).slice(0, 160) : null,
    });
  });
}

async function resolveList(req, opts, ctx) {
  const mine = parseMine(req);
  const forceRefresh = Boolean(opts.forceRefresh) || parseForceRefresh(req);
  ctx.tab = mine ? 'mine' : 'all';

  if (!isCandidateOrgCacheEnabled()) {
    return runUncached(req, ctx, 'DISABLED');
  }
  if (Boolean(opts.bypass) || parseBypass(req)) {
    return runUncached(req, ctx, 'BYPASS');
  }

  const loadCommonPool = await estimateLoadCommonPool(req, mine);
  if (loadCommonPool === null) {
    ctx.degraded = 'visibility-unknown';
    return runUncached(req, ctx, 'BYPASS');
  }

  const version = await getOrgCandidateVersion();
  const built = buildListCacheKey(req, { mine, loadCommonPool, version });
  const { key } = built;
  ctx.key = key;
  ctx.meta = built.meta;
  ctx.version = version;
  ctx.shareable = built.shareable;
  ctx.visibility = built.meta.visibility;
  ctx.tenantId = built.tenantId;

  const remember = () => {
    if (!opts.skipHotRemember && !opts.testType) {
      rememberHotView(built.tenantId, stripKeyVersion(key), req);
    }
  };

  if (!forceRefresh) {
    const tL1 = Date.now();
    const hit = l1GetEntry(key);
    ctx.timings.l1Ms = Date.now() - tL1;
    if (hit) {
      if (hit.fresh) {
        ctx.cacheState = 'L1_HIT';
        ctx.freshness = { ageMs: hit.ageMs, ttlLeftMs: hit.ttlLeftMs, stale: false };
        remember();
        return hit.value;
      }
      // Expired but still servable: answer now, refresh behind the scenes.
      ctx.cacheState = 'L1_STALE';
      ctx.freshness = { ageMs: hit.ageMs, ttlLeftMs: 0, stale: true };
      triggerBackgroundRefresh(req, key, built, built.tenantId);
      remember();
      return hit.value;
    }

    if (l2Available()) {
      const l2 = await l2Get(key);
      ctx.timings.l2Ms = l2.ms;
      if (l2.hit && l2.value != null) {
        ctx.cacheState = 'L2_HIT';
        l1Set(key, l2.value, candidateOrgCacheTtlSec() * 1000, staleSecFor(built.meta.visibility) * 1000);
        remember();
        return l2.value;
      }
    }
  }

  ctx.cacheState = forceRefresh ? 'REFRESH' : 'MISS';
  const { result, coalesced } = await coalesce(key, async () => {
    // Re-check after queueing: another request may have filled L1 meanwhile.
    if (!forceRefresh) {
      const again = l1GetEntry(key);
      if (again?.fresh) {
        ctx.cacheState = 'L1_HIT';
        return again.value;
      }
    }
    return loadAndStore(req, key, built, ctx);
  });
  ctx.coalesced = coalesced;
  if (coalesced && ctx.cacheState === 'MISS') ctx.cacheState = 'COALESCED';
  remember();
  return result;
}

function buildPerf(ctx, stats) {
  return {
    cacheState: ctx.cacheState,
    coalesced: ctx.coalesced,
    degraded: ctx.degraded,
    cacheKey: ctx.key,
    tenantId: ctx.tenantId,
    env: cacheEnvNamespace(),
    tab: ctx.tab,
    shareable: ctx.shareable,
    version: ctx.version,
    visibility: ctx.visibility,
    timings: ctx.timings,
    freshness: ctx.freshness,
    // REAL operation counts (Prisma middleware). docsExamined needs explain() per query, which
    // is not available at request time → reported as null on purpose (never invented).
    mongo: stats
      ? {
          ops: stats.ops,
          dbMsSum: stats.dbMsSum,
          byOp: stats.byOp,
          byDb: stats.byDb,
          docsExamined: null,
        }
      : null,
    l1: l1Stats(orgCachePrefix(ctx.tenantId)),
    l2Configured: l2Available(),
  };
}

/**
 * Core entry point. Returns the unmodified list payload plus a separate `perf` object.
 */
export async function getCandidatesCachedWithMeta(req, opts = {}) {
  const tStart = Date.now();
  const ctx = newContext();
  let payload;
  let stats = null;
  try {
    const out = await runWithQueryCounter(() => resolveList(req, opts, ctx));
    payload = out.result;
    stats = out.stats;
  } catch (error) {
    stats = error?.queryStats || null;
    ctx.timings.totalMs = Date.now() - tStart;
    recordPerfSample({
      tenantId: ctx.tenantId,
      tab: ctx.tab,
      cacheState: ctx.cacheState,
      coalesced: ctx.coalesced,
      durationMs: ctx.timings.totalMs,
      l1Ms: ctx.timings.l1Ms,
      l2Ms: ctx.timings.l2Ms,
      loadMs: ctx.timings.loadMs,
      mongoOps: stats?.ops ?? null,
      version: ctx.version,
      visibility: ctx.visibility,
      testType: opts.testType || 'list',
      error: String(error?.message || error).slice(0, 160),
    });
    throw error;
  }

  ctx.timings.totalMs = Date.now() - tStart;
  const perf = buildPerf(ctx, stats);
  recordPerfSample({
    tenantId: ctx.tenantId,
    tab: ctx.tab,
    cacheState: ctx.cacheState,
    coalesced: ctx.coalesced,
    durationMs: ctx.timings.totalMs,
    l1Ms: ctx.timings.l1Ms,
    l2Ms: ctx.timings.l2Ms,
    loadMs: ctx.timings.loadMs,
    mongoOps: stats?.ops ?? null,
    mongoDbMsSum: stats?.dbMsSum ?? null,
    mongoByOp: stats?.byOp || null,
    returned: countReturned(payload),
    total: payload?.pagination?.total ?? payload?.total ?? null,
    version: ctx.version,
    visibility: ctx.visibility,
    freshnessAgeMs: ctx.freshness?.ageMs ?? null,
    testType: opts.testType || 'list',
    degraded: ctx.degraded,
    error: null,
  });
  return { payload, perf };
}

/** Back-compat: payload with `_retrievalPerf` attached (used by the performance tools). */
export async function getCandidatesCached(req, opts = {}) {
  const { payload, perf } = await getCandidatesCachedWithMeta(req, opts);
  if (!payload || typeof payload !== 'object') return payload;
  // Shallow copy — never mutate the object that lives in the cache.
  return { ...payload, _retrievalPerf: perf };
}

export function getEngineStatus(tenantId) {
  return {
    enabled: isCandidateOrgCacheEnabled(),
    ttlSec: candidateOrgCacheTtlSec(),
    staleSec: candidateOrgStaleSec(),
    env: cacheEnvNamespace(),
    envExplicit: isCacheEnvExplicit(),
    l1: l1Stats(orgCachePrefix(tenantId)),
    l2Configured: l2Available(),
    coalescer: coalescerStats(),
    counters: getPerfCounters(tenantId),
    warmer: warmerStats(tenantId),
  };
}

// ── wiring ────────────────────────────────────────────────────────────────

// Invalidation also drops the service's own short-lived caches (45s count / 120s job ids / 15s
// common index) and the 30s modules memo, so a rebuilt list never pairs with a stale total.
registerInvalidationHook((tenantId) => {
  clearModulesCache(tenantId || undefined);
  clearCandidateServiceInternalCaches();
  clearCandidateCommonInternalCaches();
});

// Refresh-ahead: rebuild recently used views right after a change.
setWarmFetcher((tenantId, req) =>
  runWithTenantContext(tenantId === 'default' ? '' : tenantId, () =>
    getCandidatesCachedWithMeta(req, { testType: 'warmup', skipHotRemember: true }),
  ),
);
