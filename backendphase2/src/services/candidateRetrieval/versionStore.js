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
  if (hasRedisConfig()) {
    try {
      const raw = await getCache(versionRedisKey(tid));
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) {
        localVersions.set(tid, n);
        return n;
      }
    } catch {
      /* fall through */
    }
  }
  return localVersions.get(tid) || 1;
}

export async function bumpOrgCandidateVersion(tenantId, reason = '') {
  const tid = resolveTenantId(tenantId);
  const current = await getOrgCandidateVersion(tid);
  const next = current + 1;
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
