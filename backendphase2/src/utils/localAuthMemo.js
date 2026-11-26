/**
 * Tiny in-process memo for the per-request auth lookups (user row, session check, permissions).
 *
 * Why: without Redis, every API call repeats 3–5 sequential MongoDB round trips in the auth /
 * session / permission middleware before the handler even starts. On a remote database that
 * costs more than the (now cached) candidate list itself.
 *
 * Safety:
 *  - OFF by default. Enable with AUTH_LOCAL_CACHE_TTL_SEC=<seconds> (recommended 10–30).
 *  - Only successful lookups are stored (a denied / inactive / expired result is never cached,
 *    so a rejection is always re-evaluated against the database).
 *  - Entries are dropped by the SAME events that already invalidate the Redis copies:
 *    deleteCache(key) / deleteCacheByPattern(pattern) (logout, new login, role / team edits).
 *  - Hard upper bound on staleness = the TTL. Per-process (each instance has its own memo).
 */

const MAX_ENTRIES = 2000;

/** @type {Map<string, { value: unknown, exp: number }>} */
const store = new Map();
const stats = { hits: 0, misses: 0, sets: 0, invalidations: 0 };

export function authMemoTtlMs() {
  const sec = Number(process.env.AUTH_LOCAL_CACHE_TTL_SEC || 0);
  if (!Number.isFinite(sec) || sec <= 0) return 0;
  return Math.min(120, sec) * 1000;
}

export function authMemoGet(key) {
  if (authMemoTtlMs() <= 0) return undefined;
  const hit = store.get(key);
  if (!hit) {
    stats.misses += 1;
    return undefined;
  }
  if (hit.exp <= Date.now()) {
    store.delete(key);
    stats.misses += 1;
    return undefined;
  }
  stats.hits += 1;
  return hit.value;
}

export function authMemoSet(key, value) {
  const ttl = authMemoTtlMs();
  if (ttl <= 0) return;
  if (store.size >= MAX_ENTRIES) {
    // Drop the oldest insertion (Map keeps insertion order).
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, exp: Date.now() + ttl });
  stats.sets += 1;
}

const baseKey = (k) => String(k).split('|')[0];

/** Remove `key` and every variant stored as `key|<suffix>`. */
export function authMemoInvalidateKey(key) {
  if (store.size === 0) return;
  const target = String(key);
  for (const k of [...store.keys()]) {
    if (baseKey(k) === target) {
      store.delete(k);
      stats.invalidations += 1;
    }
  }
}

/** Remove entries whose base key matches a Redis-style glob (`*` wildcard). */
export function authMemoInvalidatePattern(pattern) {
  if (store.size === 0) return;
  const source = String(pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  const re = new RegExp(`^${source}$`);
  for (const k of [...store.keys()]) {
    if (re.test(baseKey(k))) {
      store.delete(k);
      stats.invalidations += 1;
    }
  }
}

export function authMemoClear() {
  store.clear();
}

export function authMemoStats() {
  return { enabled: authMemoTtlMs() > 0, ttlSec: authMemoTtlMs() / 1000, entries: store.size, ...stats };
}
