import { sendResponse, sendError } from '../../utils/response.js';
import { getActiveTenantDbName } from '../../config/prisma.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';
import { getCandidatesCached, getEngineStatus } from '../../services/candidateRetrieval/engine.service.js';
import {
  listPerfHistory,
  getPerfCounters,
  resetPerfCounters,
  clearPerfHistory,
  recordPerfSample,
} from '../../services/candidateRetrieval/metrics.service.js';
import { getOrgCandidateVersion, bumpOrgCandidateVersion } from '../../services/candidateRetrieval/versionStore.js';
import { invalidateOrgCandidateCaches } from '../../services/candidateRetrieval/invalidation.service.js';
import { l1Stats, l1ResetStats, l1DeleteByPrefix } from '../../services/candidateRetrieval/l1Cache.js';
import { l2Available, l2DeleteByPattern } from '../../services/candidateRetrieval/l2Cache.js';
import {
  isCandidateOrgCacheEnabled,
  cacheEnvNamespace,
  orgCachePrefix,
  candidateOrgCacheTtlSec,
} from '../../services/candidateRetrieval/cacheKeys.js';
import { coalescerStats } from '../../services/candidateRetrieval/coalescer.js';

function assertPerfAccess(req) {
  const enabled =
    String(process.env.CANDIDATE_PERF_ENABLED || '').trim().toLowerCase() === '1' ||
    String(process.env.CANDIDATE_PERF_ENABLED || '').trim().toLowerCase() === 'true' ||
    isCandidateOrgCacheEnabled();
  if (!enabled) {
    const err = new Error('Candidate performance tools are disabled on this environment');
    err.statusCode = 403;
    throw err;
  }
  // Allow super-admins and users who can view all candidates (internal testing).
  const ok =
    isSuperAdminUser({ user: req.user }) ||
    (Array.isArray(req.user?.permissions) &&
      req.user.permissions.some((p) =>
        ['view_all_candidates', 'candidates_read', 'manage_settings'].includes(String(p)),
      ));
  if (!ok && req.user?.role !== 'SUPER_ADMIN') {
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

export const candidatePerformanceController = {
  async overview(req, res) {
    try {
      assertPerfAccess(req);
      const tenantId = String(getActiveTenantDbName() || '').trim() || 'default';
      const version = await getOrgCandidateVersion(tenantId);
      sendResponse(res, 200, 'OK', {
        tenantId,
        env: cacheEnvNamespace(),
        cacheEnabled: isCandidateOrgCacheEnabled(),
        ttlSec: candidateOrgCacheTtlSec(),
        version,
        engine: getEngineStatus(),
        counters: getPerfCounters(),
        l1: l1Stats(),
        l2Available: l2Available(),
        coalescer: coalescerStats(),
      });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async cacheStats(req, res) {
    try {
      assertPerfAccess(req);
      sendResponse(res, 200, 'OK', {
        l1: l1Stats(),
        l2Available: l2Available(),
        coalescer: coalescerStats(),
        counters: getPerfCounters(),
        version: await getOrgCandidateVersion(),
      });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async history(req, res) {
    try {
      assertPerfAccess(req);
      const limit = Number(req.query?.limit || 50);
      const tenantId = String(req.query?.tenantId || getActiveTenantDbName() || '').trim();
      sendResponse(res, 200, 'OK', {
        items: listPerfHistory({ limit, tenantId }),
      });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async runTest(req, res) {
    try {
      assertPerfAccess(req);
      const body = req.body || {};
      const mode = String(body.mode || 'cached').toLowerCase();
      const mine = Boolean(body.mine);
      const page = Math.max(1, Number(body.page || 1) || 1);
      const limit = Math.min(100, Math.max(1, Number(body.limit || 20) || 20));
      const search = String(body.search || '').trim();

      // Mutate a shallow clone of query for the retrieval call.
      const fakeReq = {
        ...req,
        query: {
          ...(req.query || {}),
          page: String(page),
          limit: String(limit),
          mine: mine ? 'true' : undefined,
          search: search || undefined,
          cacheBypass: mode === 'legacy' || mode === 'bypass' ? 'true' : undefined,
          forceMiss: mode === 'forceMiss' ? 'true' : undefined,
          cacheRefresh: mode === 'refresh' ? 'true' : undefined,
        },
        headers: { ...(req.headers || {}) },
      };

      const t0 = Date.now();
      const result = await getCandidatesCached(fakeReq, {
        bypass: mode === 'legacy' || mode === 'bypass',
        forceRefresh: mode === 'refresh' || mode === 'forceMiss',
        testType: `run-test:${mode}`,
      });
      const durationMs = Date.now() - t0;
      const perf = result?._retrievalPerf || null;
      sendResponse(res, 200, 'OK', {
        durationMs,
        mode,
        mine,
        page,
        limit,
        returned: Array.isArray(result?.data)
          ? result.data.length
          : Array.isArray(result?.items)
            ? result.items.length
            : null,
        total: result?.pagination?.total ?? result?.total ?? null,
        perf,
      });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async concurrencyTest(req, res) {
    try {
      assertPerfAccess(req);
      const n = Math.min(20, Math.max(1, Number(req.body?.concurrency || 5) || 5));
      const mine = Boolean(req.body?.mine);
      const page = Math.max(1, Number(req.body?.page || 1) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.body?.limit || 20) || 20));
      const mode = String(req.body?.mode || 'cached').toLowerCase();

      const tasks = Array.from({ length: n }, async () => {
        const fakeReq = {
          ...req,
          query: {
            ...(req.query || {}),
            page: String(page),
            limit: String(limit),
            mine: mine ? 'true' : undefined,
            cacheBypass: mode === 'bypass' ? 'true' : undefined,
          },
          headers: { ...(req.headers || {}) },
        };
        const t0 = Date.now();
        try {
          const result = await getCandidatesCached(fakeReq, {
            bypass: mode === 'bypass',
            testType: 'concurrency',
          });
          return {
            ok: true,
            durationMs: Date.now() - t0,
            cacheState: result?._retrievalPerf?.cacheState || null,
            coalesced: Boolean(result?._retrievalPerf?.coalesced),
          };
        } catch (err) {
          return { ok: false, durationMs: Date.now() - t0, error: err?.message || 'failed' };
        }
      });

      const rows = await Promise.all(tasks);
      const durations = rows
        .filter((r) => r.ok)
        .map((r) => r.durationMs)
        .sort((a, b) => a - b);
      const summary = {
        concurrency: n,
        success: rows.filter((r) => r.ok).length,
        failed: rows.filter((r) => !r.ok).length,
        l1Hits: rows.filter((r) => r.cacheState === 'L1_HIT').length,
        l2Hits: rows.filter((r) => r.cacheState === 'L2_HIT').length,
        misses: rows.filter((r) => r.cacheState === 'MISS' || r.cacheState === 'REFRESH').length,
        coalesced: rows.filter((r) => r.coalesced).length,
        avgMs: durations.length
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null,
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
        maxMs: durations.length ? durations[durations.length - 1] : null,
      };
      recordPerfSample({
        tenantId: String(getActiveTenantDbName() || ''),
        testType: 'concurrency',
        cacheState: 'MIXED',
        durationMs: summary.avgMs,
        concurrency: n,
        ...summary,
      });
      sendResponse(res, 200, 'OK', { summary, rows });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async cacheRefresh(req, res) {
    try {
      assertPerfAccess(req);
      const version = await bumpOrgCandidateVersion(undefined, 'manual-refresh');
      sendResponse(res, 200, 'OK', { version });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async cacheClear(req, res) {
    try {
      assertPerfAccess(req);
      const tenantId = String(getActiveTenantDbName() || '').trim() || 'default';
      // Only clear current org namespace — never global.
      const prefix = orgCachePrefix(tenantId);
      const removedL1 = l1DeleteByPrefix(prefix);
      if (l2Available()) {
        await l2DeleteByPattern(`${prefix}*`);
      }
      const version = await invalidateOrgCandidateCaches('manual-clear', tenantId);
      sendResponse(res, 200, 'OK', { tenantId, removedL1, version, prefix });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async resetStats(req, res) {
    try {
      assertPerfAccess(req);
      resetPerfCounters();
      l1ResetStats();
      if (req.body?.clearHistory) clearPerfHistory();
      sendResponse(res, 200, 'OK', { counters: getPerfCounters(), l1: l1Stats() });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },
};
