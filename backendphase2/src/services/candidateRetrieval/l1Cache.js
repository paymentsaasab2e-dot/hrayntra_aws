/**
 * Bounded in-process LRU for candidate list payloads (L1).
 */

const DEFAULT_MAX = Math.min(
  2000,
  Math.max(50, Number(process.env.CANDIDATE_ORG_CACHE_L1_MAX || 400) || 400),
);

/** @type {Map<string, { at: number, expiresAt: number, value: any, bytes: number }>} */
const store = new Map();
let hits = 0;
let misses = 0;

function touch(key, entry) {
  store.delete(key);
  store.set(key, entry);
}

export function l1Get(key) {
  const entry = store.get(key);
  if (!entry) {
    misses += 1;
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    misses += 1;
    return null;
  }
  touch(key, entry);
  hits += 1;
  return entry.value;
}

export function l1Set(key, value, ttlMs) {
  const ttl = Math.max(1_000, Number(ttlMs) || 60_000);
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const entry = {
    at: Date.now(),
    expiresAt: Date.now() + ttl,
    value,
    bytes: serialized.length,
  };
  touch(key, entry);
  while (store.size > DEFAULT_MAX) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
}

export function l1Delete(key) {
  return store.delete(key);
}

export function l1DeleteByPrefix(prefix) {
  let n = 0;
  for (const key of store.keys()) {
    if (String(key).startsWith(prefix)) {
      store.delete(key);
      n += 1;
    }
  }
  return n;
}

export function l1Stats() {
  return {
    size: store.size,
    max: DEFAULT_MAX,
    hits,
    misses,
    hitRate: hits + misses ? hits / (hits + misses) : 0,
  };
}

export function l1ResetStats() {
  hits = 0;
  misses = 0;
}
