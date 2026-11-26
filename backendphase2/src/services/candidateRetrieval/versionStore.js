/**
 * Per-organization candidate cache version (L1 + optional Redis).
 * Bumping the version invalidates all list keys that embed it.
 */

import { getActiveTenantDbName } from '../../config/prisma.js';
import { getCache, setCache, hasRedisConfig } from '../../cache/redis.js';
import { cacheEnvNamespace } from './cacheKeys.js';

/** @type {Map<string, number>} */
const localVersions = new Map();

function versionRedisKey(tenantId) {
  return `candver:${cacheEnvNamespace()}:${tenantId || 'default'}`;
}

export function resolveTenantId(explicit) {
  const fromArg = String(explicit || '').trim();
  if (fromArg) return fromArg;
  try {
    return String(getActiveTenantDbName?.() || '').trim() || 'default';
  } catch {
    return 'default';
  }
}

export async function getOrgCandidateVersion(tenantId) {
  const tid = resolveTenantId(tenantId);
  const local = localVersions.get(tid) || 1;
  if (hasRedisConfig()) {
    try {
      const raw = await getCache(versionRedisKey(tid));
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) {
        // max(): a synchronous local bump (made just before a mutation response is sent)
        // must win over a Redis value that has not been updated yet.
        const merged = Math.max(n, local);
        localVersions.set(tid, merged);
        return merged;
      }
    } catch {
      /* fall through */
    }
  }
  return local;
}

/**
 * Synchronous, process-local bump. Used right before a mutation response is flushed so a
 * client that immediately re-requests the list can never read the pre-mutation entry.
 * The Redis copy is updated afterwards by bumpOrgCandidateVersion().
 */
export function bumpOrgCandidateVersionLocalSync(tenantId) {
  const tid = resolveTenantId(tenantId);
  const next = (localVersions.get(tid) || 1) + 1;
  localVersions.set(tid, next);
  return next;
}

/** Tenants this process has seen (used only when a mutation's tenant cannot be determined). */
export function knownLocalTenants() {
  return [...localVersions.keys()];
}

/**
 * @param {{ alreadyBumped?: boolean }} [opts] alreadyBumped: the local version was just rotated
 *   synchronously (see bumpOrgCandidateVersionLocalSync) — only publish it to Redis, do not +1 again.
 */
export async function bumpOrgCandidateVersion(tenantId, reason = '', opts = {}) {
  const tid = resolveTenantId(tenantId);
  const current = await getOrgCandidateVersion(tid);
  const next = opts.alreadyBumped ? current : current + 1;
  localVersions.set(tid, next);
  if (hasRedisConfig()) {
    try {
      await setCache(versionRedisKey(tid), String(next), 60 * 60 * 24 * 30);
    } catch {
      /* ignore */
    }
  }
  if (process.env.CANDIDATE_ORG_CACHE_DEBUG === '1') {
    console.info(`[candidateRetrieval] bump version ${tid} → ${next} (${reason || 'event'})`);
  }
  return next;
}
