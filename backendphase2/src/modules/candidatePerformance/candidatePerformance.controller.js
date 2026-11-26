/**
 * /candidate-speed dashboard API.
 *
 * Everything here is scoped to the ACTIVE organization (tenant): counters, history, cache
 * entries and the tests only ever see / touch that organization's data. No candidate rows are
 * returned — only timings, counts and cache metadata.
 */

import { sendResponse, sendError } from '../../utils/response.js';
import { getActiveTenantDbName } from '../../config/prisma.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';
import {
  getCandidatesCachedWithMeta,
  getEngineStatus,
} from '../../services/candidateRetrieval/engine.service.js';
import {
  listPerfHistory,
  getPerfCounters,
  resetPerfCounters,
  clearPerfHistory,
  summarizePerf,
} from '../../services/candidateRetrieval/metrics.service.js';
import { getOrgCandidateVersion } from '../../services/candidateRetrieval/versionStore.js';
import { invalidateOrgCandidateCaches } from '../../services/candidateRetrieval/invalidation.service.js';
import { l1Stats, l1ResetStats, l1DeleteByPrefix } from '../../services/candidateRetrieval/l1Cache.js';
import { l2Status } from '../../services/candidateRetrieval/l2Cache.js';
import {
  isCandidateOrgCacheEnabled,
  cacheEnvNamespace,
  orgCachePrefix,
  candidateOrgCacheTtlSec,
  candidateOrgStaleSec,
  isCandidateOrgWarmEnabled,
} from '../../services/candidateRetrieval/cacheKeys.js';
import { coalescerStats } from '../../services/candidateRetrieval/coalescer.js';
import { warmerStats } from '../../services/candidateRetrieval/warmer.js';
import { authMemoStats } from '../../utils/localAuthMemo.js';

const ALLOWED_PERMS = ['all', 'view_all_candidates', 'candidates_read', 'manage_settings'];

function currentTenant() {
  return String(getActiveTenantDbName() || '').trim() || 'default';
}

function assertPerfAccess(req) {
  const flag = String(process.env.CANDIDATE_PERF_ENABLED || '').trim().toLowerCase();
  const enabled = flag === '1' || flag === 'true' || isCandidateOrgCacheEnabled();
  if (!enabled) {
    const err = new Error('Candidate performance tools are disabled on this environment');
    err.statusCode = 403;
    throw err;
  }
  // Permissions are attached to req.userWithPermissions by requireAnyPermission (req.user has none).
  const perms = Array.isArray(req.userWithPermissions?.permissions)
    ? req.userWithPermissions.permissions.map(String)
    : [];
  const ok =
    isSuperAdminUser({ user: req.user }) ||
    Boolean(req.userWithPermissions?.isSuperAdmin) ||
    perms.some((p) => ALLOWED_PERMS.includes(p));
  if (!ok) {
    const err = new Error('Not authorized for candidate performance tools');
    err.statusCode = 403;
    throw err;
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

const FILTER_KEYS = ['search', 'status', 'stage', 'company', 'location', 'jobId', 'experienceRange'];

/**
 * Build a request that looks like the real Candidates tab call. Prototype-linked to the real
 * request (keeps user / permissions / tenant context) with query + headers overridden.
 */
function buildTestRequest(req, body = {}) {
  const mine = Boolean(body.mine);
  const page = Math.max(1, Number(body.page || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(body.limit || 20) || 20));
  const query = {
    page: String(page),
    limit: String(limit),
    mine: mine ? 'true' : 'false',
    // The real tab sends includeCommonPool explicitly; tests must do the same to hit the same key.
    includeCommonPool: !mine && body.includeCommonPool ? 'true' : 'false',
  };
  for (const key of FILTER_KEYS) {
    const v = String(body[key] ?? '').trim();
    if (v) query[key] = v.slice(0, 200);
  }
  const fake = Object.create(req, {
    query: { value: query, enumerable: true, writable: true },
    headers: { value: { ...(req.headers || {}) }, enumerable: true, writable: true },
  });
  return { fake, mine, page, limit, includeCommonPool: query.includeCommonPool === 'true' };
}

function modeOpts(mode) {
  switch (mode) {
    case 'bypass':
    case 'legacy':
      return { bypass: true };
    case 'refresh':
    case 'forceMiss':
      return { forceRefresh: true };
    default:
      return {};
  }
}

function normalizeMode(raw) {
  const m = String(raw || 'cached');
  if (m === 'legacy') return 'bypass';
  if (m === 'forceMiss') return 'refresh';
  return ['cached', 'bypass', 'refresh'].includes(m) ? m : 'cached';
}

function countReturned(payload) {
  if (Array.isArray(payload?.data)) return payload.data.length;
  if (Array.isArray(payload?.items)) return payload.items.length;
  if (Array.isArray(payload)) return payload.length;
  return null;
}

async function runOne(req, body, mode, testType) {
  const { fake, mine, page, limit, includeCommonPool } = buildTestRequest(req, body);
  const t0 = Date.now();
  const { payload, perf } = await getCandidatesCachedWithMeta(fake, {
    ...modeOpts(mode),
    testType,
  });
  return {
    mode,
    mine,
    page,
    limit,
    includeCommonPool,
    durationMs: Date.now() - t0,
    returned: countReturned(payload),
    total: payload?.pagination?.total ?? payload?.total ?? null,
    perf,
  };
}

/** Drop this org's entries (no refresh-ahead, so a test is not skewed by background rebuilds). */
async function coldStartOrg() {
  const tenantId = currentTenant();
  const removedL1 = l1DeleteByPrefix(orgCachePrefix(tenantId));
  const version = await invalidateOrgCandidateCaches('perf-tool:cold-start', tenantId, { warm: false });
  return { tenantId, removedL1, version };
}

export const candidatePerformanceController = {
  async overview(req, res) {
    try {
      assertPerfAccess(req);
      const tenantId = currentTenant();
      const prefix = orgCachePrefix(tenantId);
      const [version, redis] = await Promise.all([getOrgCandidateVersion(tenantId), l2Status()]);
      const engine = getEngineStatus(tenantId);
      sendResponse(res, 200, 'OK', {
        tenantId,
        env: cacheEnvNamespace(),
        cacheEnabled: isCandidateOrgCacheEnabled(),
        ttlSec: candidateOrgCacheTtlSec(),
        staleSec: candidateOrgStaleSec(),
        warmEnabled: isCandidateOrgWarmEnabled(),
        version,
        viewer: {
          isSuperAdmin: isSuperAdminUser({ user: req.user }) || Boolean(req.userWithPermissions?.isSuperAdmin),
        },
        redis,
        counters: getPerfCounters(tenantId),
        liveSummary: summarizePerf(tenantId, { source: 'live' }),
        testSummary: summarizePerf(tenantId, { source: 'tests' }),
        l1: l1Stats(prefix),
        coalescer: coalescerStats(),
        warmer: warmerStats(tenantId),
        authMemo: authMemoStats(),
        engine,
      });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async cacheStats(req, res) {
    try {
      assertPerfAccess(req);
      const tenantId = currentTenant();
      sendResponse(res, 200, 'OK', {
        l1: l1Stats(orgCachePrefix(tenantId)),
        redis: await l2Status(),
        coalescer: coalescerStats(),
        counters: getPerfCounters(tenantId),
        version: await getOrgCandidateVersion(tenantId),
      });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async history(req, res) {
    try {
      assertPerfAccess(req);
      const limit = Number(req.query?.limit || 50);
      const source = ['live', 'tests', 'background', 'all'].includes(String(req.query?.source))
        ? String(req.query.source)
        : 'all';
      // Always the caller's own organization — a client-supplied tenant id is ignored.
      sendResponse(res, 200, 'OK', {
        items: listPerfHistory({ limit, tenantId: currentTenant(), source }),
      });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  /** One request through the engine. Modes: cached (normal) | bypass (no cache) | refresh (force rebuild). */
  async runTest(req, res) {
    try {
      assertPerfAccess(req);
      const body = req.body || {};
      const mode = normalizeMode(body.mode);
      const out = await runOne(req, body, mode, `run-test:${mode}`);
      sendResponse(res, 200, 'OK', out);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  /**
   * One-click proof: (1) no-cache baseline, (2) cold start → first cached call (MISS),
   * (3) three repeat cached calls (should be HITs). Only this organization's cache is cleared.
   */
  async compare(req, res) {
    try {
      assertPerfAccess(req);
      const body = req.body || {};
      const steps = [];
      steps.push({ label: 'No cache (original code path)', ...(await runOne(req, body, 'bypass', 'compare:bypass')) });
      const cold = await coldStartOrg();
      steps.push({ label: 'Cached — first call after clearing (MISS)', ...(await runOne(req, body, 'cached', 'compare:cold')) });
      for (let i = 1; i <= 3; i += 1) {
        steps.push({ label: `Cached — repeat #${i}`, ...(await runOne(req, body, 'cached', 'compare:warm')) });
      }
      const baseline = steps[0].durationMs;
      const warm = steps.slice(2).map((s) => s.durationMs).sort((a, b) => a - b);
      const warmMedian = warm.length ? warm[Math.floor(warm.length / 2)] : null;
      sendResponse(res, 200, 'OK', {
        cleared: cold,
        steps,
        summary: {
          baselineMs: baseline,
          coldMs: steps[1].durationMs,
          warmMedianMs: warmMedian,
          warmMongoOps: steps.slice(2).map((s) => s.perf?.mongo?.ops ?? null),
          speedup:
            warmMedian && warmMedian > 0 ? Math.round((baseline / warmMedian) * 10) / 10 : null,
          note: 'Measured on this server just now; only the server-side list time (not browser or network).',
        },
      });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async concurrencyTest(req, res) {
    try {
      assertPerfAccess(req);
      const body = req.body || {};
      const n = Math.min(20, Math.max(1, Number(body.concurrency || 5) || 5));
      const mode = normalizeMode(body.mode) === 'bypass' ? 'bypass' : 'cached';
      const cold = Boolean(body.coldStart) && mode === 'cached' ? await coldStartOrg() : null;

      const rows = await Promise.all(
        Array.from({ length: n }, async () => {
          const t0 = Date.now();
          try {
            const out = await runOne(req, body, mode, 'concurrency');
            return {
              ok: true,
              durationMs: out.durationMs,
              cacheState: out.perf?.cacheState || null,
              coalesced: Boolean(out.perf?.coalesced),
              mongoOps: out.perf?.mongo?.ops ?? null,
            };
          } catch (err) {
            return { ok: false, durationMs: Date.now() - t0, error: err?.message || 'failed' };
          }
        }),
      );

      const durations = rows.filter((r) => r.ok).map((r) => r.durationMs).sort((a, b) => a - b);
      const ops = rows.filter((r) => r.ok && Number.isFinite(r.mongoOps)).map((r) => r.mongoOps);
      const summary = {
        concurrency: n,
        mode,
        coldStart: Boolean(cold),
        success: rows.filter((r) => r.ok).length,
        failed: rows.filter((r) => !r.ok).length,
        l1Hits: rows.filter((r) => r.cacheState === 'L1_HIT').length,
        staleHits: rows.filter((r) => r.cacheState === 'L1_STALE').length,
        l2Hits: rows.filter((r) => r.cacheState === 'L2_HIT').length,
        misses: rows.filter((r) => r.cacheState === 'MISS' || r.cacheState === 'REFRESH').length,
        coalesced: rows.filter((r) => r.coalesced || r.cacheState === 'COALESCED').length,
        // Sum over requests; coalesced followers report 0, so this is the TRUE DB work done.
        totalMongoOps: ops.length ? ops.reduce((a, b) => a + b, 0) : null,
        avgMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
        maxMs: durations.length ? durations[durations.length - 1] : null,
      };
      sendResponse(res, 200, 'OK', { summary, rows });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  /** Rotate the version only: old entries become unreachable (cheap), memory frees by TTL/eviction. */
  async cacheRefresh(req, res) {
    try {
      assertPerfAccess(req);
      const version = await invalidateOrgCandidateCaches('manual-refresh', currentTenant(), { warm: false });
      sendResponse(res, 200, 'OK', { tenantId: currentTenant(), version });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  /** Remove this organization's cached lists (L1, and Redis when configured). Never global. */
  async cacheClear(req, res) {
    try {
      assertPerfAccess(req);
      const out = await coldStartOrg();
      sendResponse(res, 200, 'OK', { ...out, prefix: orgCachePrefix(out.tenantId) });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async resetStats(req, res) {
    try {
      assertPerfAccess(req);
      const tenantId = currentTenant();
      resetPerfCounters(tenantId);
      l1ResetStats();
      if (req.body?.clearHistory) clearPerfHistory(tenantId);
      sendResponse(res, 200, 'OK', { counters: getPerfCounters(tenantId), l1: l1Stats(orgCachePrefix(tenantId)) });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },
};
