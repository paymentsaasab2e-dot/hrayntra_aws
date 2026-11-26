/**
 * Tiny per-organization memo for getHqEnabledModules().
 *
 * Why: the list cache must know whether the Phase 1 common pool is enabled to build its
 * key. Reading that setting from MongoDB on EVERY request (even warm hits) cost one
 * round trip (~170 ms on Atlas) per request. This memo makes a warm hit zero-Mongo.
 *
 * Freshness: 30s TTL, and setHqEnabledModules() invalidates it through the candidate
 * cache invalidation hook (immediate on this instance).
 */

import { getHqEnabledModules } from '../../modules/setting/recruitmentMode.service.js';
import { getActiveTenantDbName } from '../../config/prisma.js';

const TTL_MS = 30_000;

/** @type {Map<string, { at: number, value: any, inflight: Promise<any> | null }>} */
const cache = new Map();

function tenantKey(tenantId) {
  return String(tenantId || getActiveTenantDbName?.() || '').trim() || '__default__';
}

export async function getModulesCached() {
  const key = tenantKey();
  const hit = cache.get(key);
  const now = Date.now();
  if (hit?.value && now - hit.at < TTL_MS) return hit.value;
  if (hit?.inflight) return hit.inflight;

  const inflight = getHqEnabledModules()
    .then((value) => {
      cache.set(key, { at: Date.now(), value, inflight: null });
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });
  cache.set(key, { at: hit?.at || 0, value: hit?.value || null, inflight });
  return inflight;
}

export function clearModulesCache(tenantId) {
  if (tenantId) cache.delete(tenantKey(tenantId));
  else cache.clear();
}
