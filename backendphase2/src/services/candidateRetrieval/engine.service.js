/**
 * Organization-aware candidate list retrieval wrapper.
 * Reuses existing candidateService.getAll — does not rewrite business logic.
 */

import { candidateService } from '../../modules/candidate/candidate.service.js';
import {
  buildListCacheKey,
  isCandidateOrgCacheEnabled,
  candidateOrgCacheTtlSec,
} from './cacheKeys.js';
import { l1Get, l1Set, l1Stats } from './l1Cache.js';
import { l2Get, l2Set, l2Available } from './l2Cache.js';
import { coalesce, coalescerStats } from './coalescer.js';
import { getOrgCandidateVersion } from './versionStore.js';
import { recordPerfSample, getPerfCounters } from './metrics.service.js';

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
 * Resolve whether this request would load common pool (mirrors getAll decision surface).
 * Exact decision still happens inside getAll; this is for cache-key visibility only.
 */
async function estimateLoadCommonPool(req, mine) {
  if (mine) return false;
  const picker =
    req?.query?.picker === '1' ||
    req?.query?.picker === 'true' ||
    req?.query?.placementPicker === '1' ||
    req?.query?.placementPicker === 'true';
  if (picker) return false;
  try {
    // Soft signal — actual gate is inside getAll / resolveLoadCommonPool.
    const q = String(req?.query?.includeCommonPool || req?.query?.commonPool || '').toLowerCase();
    if (q === '0' || q === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

function attachPerf(result, perf) {
  if (!result || typeof result !== 'object') return result;
  // Non-breaking: clients that ignore unknown fields keep working.
  return {
    ...result,
    _retrievalPerf: perf,
  };
}

export async function getCandidatesCached(req, opts = {}) {
  const tStart = Date.now();
  const mine = parseMine(req);
  const forceRefresh = Boolean(opts.forceRefresh) || parseForceRefresh(req);
  const bypass = Boolean(opts.bypass) || parseBypass(req) || !isCandidateOrgCacheEnabled();
  const loadCommonPool = await estimateLoadCommonPool(req, mine);
  const version = await getOrgCandidateVersion();
  const { key, tenantId, tab, shareable, meta } = buildListCacheKey(req, {
    mine,
    loadCommonPool,
    version,
  });

  const timings = {
    totalMs: 0,
    l1Ms: 0,
    l2Ms: 0,
    mongoMs: 0,
  };
  let cacheState = 'BYPASS';
  let coalesced = false;

  const finish = (payload, extra = {}) => {
    timings.totalMs = Date.now() - tStart;
    const perf = {
      cacheState,
      coalesced,
      cacheKey: key,
      tenantId,
      tab,
      shareable,
      version,
      visibility: meta.visibility,
      timings,
      l1: l1Stats(),
      l2Available: l2Available(),
      counters: getPerfCounters(),
      coalescer: coalescerStats(),
      ...extra,
    };
    recordPerfSample({
      tenantId,
      tab,
      cacheState,
      coalesced,
      durationMs: timings.totalMs,
      l1Ms: timings.l1Ms,
      l2Ms: timings.l2Ms,
      mongoMs: timings.mongoMs,
      returned: Array.isArray(payload?.data)
        ? payload.data.length
        : Array.isArray(payload?.items)
          ? payload.items.length
          : Array.isArray(payload)
            ? payload.length
            : null,
      total: payload?.pagination?.total ?? payload?.total ?? null,
      version,
      testType: opts.testType || 'list',
      error: null,
    });
    return attachPerf(payload, perf);
  };

  if (bypass) {
    const tMongo = Date.now();
    const result = await candidateService.getAll(req);
    timings.mongoMs = Date.now() - tMongo;
    cacheState = isCandidateOrgCacheEnabled() ? 'BYPASS' : 'DISABLED';
    return finish(result);
  }

  if (!forceRefresh) {
    const tL1 = Date.now();
    const l1 = l1Get(key);
    timings.l1Ms = Date.now() - tL1;
    if (l1 != null) {
      cacheState = 'L1_HIT';
      return finish(l1);
    }

    if (l2Available()) {
      const l2 = await l2Get(key);
      timings.l2Ms = l2.ms;
      if (l2.hit && l2.value != null) {
        cacheState = 'L2_HIT';
        l1Set(key, l2.value, candidateOrgCacheTtlSec() * 1000);
        return finish(l2.value);
      }
    }
  }

  cacheState = forceRefresh ? 'REFRESH' : 'MISS';
  const { result, coalesced: wasCoalesced } = await coalesce(key, async () => {
    // Double-check L1 after waiting (another waiter may have filled it).
    if (!forceRefresh) {
      const again = l1Get(key);
      if (again != null) return again;
    }
    const tMongo = Date.now();
    const fresh = await candidateService.getAll(req);
    timings.mongoMs = Date.now() - tMongo;
    const ttlSec = candidateOrgCacheTtlSec();
    // Jitter TTL slightly to reduce stampedes.
    const jitter = Math.floor(Math.random() * Math.min(10, Math.floor(ttlSec / 5)));
    l1Set(key, fresh, (ttlSec + jitter) * 1000);
    if (l2Available()) {
      await l2Set(key, fresh, ttlSec + jitter);
    }
    return fresh;
  });
  coalesced = wasCoalesced;
  if (wasCoalesced && cacheState === 'MISS') cacheState = 'COALESCED';

  return finish(result);
}

export function getEngineStatus() {
  return {
    enabled: isCandidateOrgCacheEnabled(),
    ttlSec: candidateOrgCacheTtlSec(),
    l1: l1Stats(),
    l2Available: l2Available(),
    coalescer: coalescerStats(),
    counters: getPerfCounters(),
  };
}
