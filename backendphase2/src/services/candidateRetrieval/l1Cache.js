/**
 * Bounded in-process LRU for candidate list payloads (L1).
 *
 * Bounds (both enforced on every write):
 *  - entry count  : CANDIDATE_ORG_CACHE_L1_MAX        (default 400, clamp 50..2000)
 *  - total bytes  : CANDIDATE_ORG_CACHE_L1_MAX_MB     (default 64 MB, clamp 8..512)
 *
 * Each entry has two deadlines:
 *  - expiresAt  : after this the entry is STALE (still servable via stale-while-revalidate)
 *  - staleUntil : after this the entry is dropped
 *
 * Values are stored by reference. Callers MUST treat returned values as read-only
 * (the engine never mutates them; it shallow-copies before attaching metadata).
 */

const DEFAULT_MAX = Math.min(
  2000,
  Math.max(50, Number(process.env.CANDIDATE_ORG_CACHE_L1_MAX || 400) || 400),
);

const MAX_BYTES =
  Math.min(512, Math.max(8, Number(process.env.CANDIDATE_ORG_CACHE_L1_MAX_MB || 64) || 64)) *
  1024 *
  1024;

/** @type {Map<string, { at: number, expiresAt: number, staleUntil: number, value: any, bytes: number }>} */
const store = new Map();
let totalBytes = 0;
let hits = 0;
let misses = 0;
let evictions = 0;

function removeKey(key) {
  const entry = store.get(key);
  if (!entry) return false;
  totalBytes -= entry.bytes;
  store.delete(key);
  return true;
}

function touch(key, entry) {
  store.delete(key);
  store.set(key, entry);
}

/**
 * Fresh-only read (used by callers that do not want stale data).
 */
export function l1Get(key) {
  const hit = l1GetEntry(key);
  return hit && hit.fresh ? hit.value : null;
}

/**
 * Read with freshness info.
 * @returns {{ value: any, fresh: boolean, ageMs: number, ttlLeftMs: number } | null}
 */
export function l1GetEntry(key) {
  const entry = store.get(key);
  if (!entry) {
    misses += 1;
    return null;
  }
  const now = Date.now();
  if (now > entry.staleUntil) {
    removeKey(key);
    misses += 1;
    return null;
  }
  touch(key, entry);
  const fresh = now <= entry.expiresAt;
  if (fresh) hits += 1;
  return {
    value: entry.value,
    fresh,
    ageMs: now - entry.at,
    ttlLeftMs: Math.max(0, entry.expiresAt - now),
  };
}

/**
 * @param {string} key
 * @param {any} value
 * @param {number} ttlMs     fresh window
 * @param {number} [staleMs] extra window in which the entry may be served stale
 */
export function l1Set(key, value, ttlMs, staleMs = 0) {
  const ttl = Math.max(1_000, Number(ttlMs) || 60_000);
  const stale = Math.max(0, Number(staleMs) || 0);
  let bytes = 0;
  try {
    bytes = typeof value === 'string' ? value.length : JSON.stringify(value).length;
  } catch {
    bytes = 0;
  }
  // A single entry larger than the whole budget is never cached.
  if (bytes > MAX_BYTES) return false;

  removeKey(key);
  const now = Date.now();
  const entry = { at: now, expiresAt: now + ttl, staleUntil: now + ttl + stale, value, bytes };
  touch(key, entry);
  totalBytes += bytes;

  while ((store.size > DEFAULT_MAX || totalBytes > MAX_BYTES) && store.size > 1) {
    const oldest = store.keys().next().value;
    if (oldest === key) break;
    removeKey(oldest);
    evictions += 1;
  }
  return true;
}

export function l1Delete(key) {
  return removeKey(key);
}

export function l1DeleteByPrefix(prefix) {
  let n = 0;
  for (const key of [...store.keys()]) {
    if (String(key).startsWith(prefix)) {
      removeKey(key);
      n += 1;
    }
  }
  return n;
}

/** Drop every L1 entry (used only when the tenant of a mutation is unknown). */
export function l1Clear() {
  const n = store.size;
  store.clear();
  totalBytes = 0;
  return n;
}

/**
 * Stats. When `prefix` is given, `size`/`bytes` are for that organization only
 * (so one org's dashboard never reports another org's usage).
 */
export function l1Stats(prefix) {
  let size = store.size;
  let bytes = totalBytes;
  if (prefix) {
    size = 0;
    bytes = 0;
    for (const [key, entry] of store.entries()) {
      if (String(key).startsWith(prefix)) {
        size += 1;
        bytes += entry.bytes;
      }
    }
  }
  return {
    size,
    bytes,
    max: DEFAULT_MAX,
    maxBytes: MAX_BYTES,
    totalSize: store.size,
    totalBytes,
    evictions,
    // process-wide counters (kept for diagnostics; org dashboards use per-org counters)
    hits,
    misses,
    hitRate: hits + misses ? hits / (hits + misses) : 0,
  };
}

export function l1ResetStats() {
  hits = 0;
  misses = 0;
  evictions = 0;
}
