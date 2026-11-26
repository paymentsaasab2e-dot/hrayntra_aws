/**
 * Shared Redis L2 cache for candidate list payloads (optional).
 * Fail-open: if Redis is down or not configured, callers fall back to MongoDB.
 */

import {
  getCache,
  setCache,
  deleteCache,
  deleteCacheByPattern,
  hasRedisConfig,
  pingRedis,
} from '../../cache/redis.js';

/** True when Redis is CONFIGURED (not proof it is reachable — see l2Status). */
export function l2Available() {
  return hasRedisConfig();
}

/** Configured + actually reachable right now. */
export async function l2Status() {
  return pingRedis();
}

export async function l2Get(key) {
  const t0 = Date.now();
  const raw = await getCache(key);
  const ms = Date.now() - t0;
  if (raw == null) return { hit: false, value: null, ms };
  try {
    return { hit: true, value: JSON.parse(raw), ms };
  } catch {
    return { hit: false, value: null, ms };
  }
}

export async function l2Set(key, value, ttlSeconds) {
  const ttl = Math.max(5, Number(ttlSeconds) || 60);
  try {
    const payload = JSON.stringify(value);
    return await setCache(key, payload, ttl);
  } catch {
    return false;
  }
}

export async function l2Delete(key) {
  return deleteCache(key);
}

export async function l2DeleteByPattern(pattern) {
  return deleteCacheByPattern(pattern);
}
