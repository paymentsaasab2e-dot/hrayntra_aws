/**
 * Cache invalidation for candidate lifecycle events.
 *
 * Contract:
 *  - Bumps the organization's cache version (old keys become unreachable immediately),
 *  - clears that organization's L1 entries (and L2 when Redis is configured),
 *  - runs registered hooks (clears the service's own short-lived caches),
 *  - schedules a debounced refresh-ahead of the views people were using.
 *  - NEVER throws into a request path (a failed invalidation must not fail a mutation).
 *
 * Only the given organization is touched. `invalidateAllOrgCandidateCaches` exists for the
 * rare case where the organization of a mutation cannot be determined (safe over-clear).
 */

import {
  bumpOrgCandidateVersion,
  bumpOrgCandidateVersionLocalSync,
  resolveTenantId,
  knownLocalTenants,
} from './versionStore.js';
import { l1DeleteByPrefix, l1Clear } from './l1Cache.js';
import { l2DeleteByPattern, l2Available } from './l2Cache.js';
import { orgCachePrefix, isCandidateOrgCacheEnabled, cacheEnvNamespace } from './cacheKeys.js';
import { scheduleWarm } from './warmer.js';

/** @type {Set<(tenantId: string | null, reason: string) => void>} */
const hooks = new Set();

/** hook(tenantId|null, reason) — tenantId is null when ALL organizations were invalidated. */
export function registerInvalidationHook(fn) {
  if (typeof fn === 'function') hooks.add(fn);
}

function runHooks(tenantId, reason) {
  for (const fn of hooks) {
    try {
      fn(tenantId, reason);
    } catch {
      /* hooks must never break invalidation */
    }
  }
}

/**
 * Synchronous part of an invalidation (no I/O): rotate this process's version, drop this
 * org's L1 entries, clear short-lived service caches. Safe to call from a hot path.
 */
export function invalidateOrgCandidateCachesSync(reason = 'mutation', tenantId) {
  try {
    if (!isCandidateOrgCacheEnabled()) return null;
    const tid = resolveTenantId(tenantId);
    const version = bumpOrgCandidateVersionLocalSync(tid);
    l1DeleteByPrefix(orgCachePrefix(tid));
    runHooks(tid, reason);
    return version;
  } catch (error) {
    console.warn('[candidateRetrieval] sync invalidate failed:', error?.message || error);
    return null;
  }
}

/**
 * @param {{ alreadyBumped?: boolean, warm?: boolean }} [opts]
 *   alreadyBumped — invalidateOrgCandidateCachesSync() already ran for this mutation.
 *   warm          — set false to skip refresh-ahead (used by the performance test tools).
 */
export async function invalidateOrgCandidateCaches(reason = 'mutation', tenantId, opts = {}) {
  try {
    if (!isCandidateOrgCacheEnabled()) {
      // Still bump the version so keys rotate if the flag is turned on later.
      return await bumpOrgCandidateVersion(tenantId, reason);
    }
    const tid = resolveTenantId(tenantId);
    const version = await bumpOrgCandidateVersion(tid, reason, { alreadyBumped: opts.alreadyBumped });
    l1DeleteByPrefix(orgCachePrefix(tid));
    if (!opts.alreadyBumped) runHooks(tid, reason);
    if (l2Available()) {
      await l2DeleteByPattern(`${orgCachePrefix(tid)}*`);
    }
    if (opts.warm !== false) scheduleWarm(tid);
    return version;
  } catch (error) {
    console.warn('[candidateRetrieval] invalidate failed:', error?.message || error);
    return null;
  }
}

/** Over-clear fallback: tenant unknown → drop every org's L1 + this env's L2 keys. */
export async function invalidateAllOrgCandidateCaches(reason = 'mutation:unknown-tenant') {
  try {
    if (!isCandidateOrgCacheEnabled()) return null;
    for (const tid of knownLocalTenants()) {
      await bumpOrgCandidateVersion(tid, reason);
    }
    l1Clear();
    runHooks(null, reason);
    if (l2Available()) {
      await l2DeleteByPattern(`candidate:${cacheEnvNamespace()}:*`);
    }
    for (const tid of knownLocalTenants()) scheduleWarm(tid);
    return true;
  } catch (error) {
    console.warn('[candidateRetrieval] invalidate-all failed:', error?.message || error);
    return null;
  }
}
