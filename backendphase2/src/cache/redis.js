import Redis from 'ioredis';
import { authMemoInvalidateKey, authMemoInvalidatePattern } from '../utils/localAuthMemo.js';

let redisClient = null;
let redisDownUntil = 0;
const REDIS_DOWN_BACKOFF_MS = 15_000;

export function hasRedisConfig() {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

function createRedisClient() {
  if (!hasRedisConfig()) return null;

  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      connectTimeout: 2000,
    });
  }

  return new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    connectTimeout: 2000,
  });
}

async function getRedisClient() {
  if (!hasRedisConfig()) return null;
  if (!redisClient) {
    redisClient = createRedisClient();
    redisClient.on('error', () => {
      // Fail-open cache: ignore Redis errors in request path.
    });
  }

  if (redisClient.status !== 'ready') {
    // Circuit breaker: after a failed connect, skip Redis for a short window so an outage
    // costs ~0ms per request instead of a connect timeout on every call.
    if (Date.now() < redisDownUntil) return null;
    try {
      await redisClient.connect();
    } catch {
      if (redisClient.status === 'ready') return redisClient;
      if (redisClient.status !== 'connecting' && redisClient.status !== 'connect') {
        redisDownUntil = Date.now() + REDIS_DOWN_BACKOFF_MS;
      }
      return null;
    }
  }
  return redisClient;
}

export async function getCache(key) {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

export async function setCache(key, value, ttlSeconds = 300) {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    await client.set(key, value, 'EX', ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

export async function deleteCache(key) {
  // Always drop the in-process auth memo first (works with or without Redis).
  authMemoInvalidateKey(key);
  const client = await getRedisClient();
  if (!client) return false;

  try {
    await client.del(key);
    return true;
  } catch {
    return false;
  }
}

export async function deleteCacheByPattern(pattern) {
  authMemoInvalidatePattern(pattern);
  const client = await getRedisClient();
  if (!client) return false;

  try {
    // Cursor-based SCAN (non-blocking) instead of KEYS, which stalls Redis on big keyspaces.
    let cursor = '0';
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
      cursor = String(next);
      if (keys && keys.length > 0) await client.del(...keys);
    } while (cursor !== '0');
    return true;
  } catch {
    return false;
  }
}

/**
 * Reachability probe for diagnostics (never throws).
 * @returns {{ configured: boolean, reachable: boolean, ms: number | null }}
 */
export async function pingRedis() {
  if (!hasRedisConfig()) return { configured: false, reachable: false, ms: null };
  const t0 = Date.now();
  try {
    const client = await getRedisClient();
    if (!client) return { configured: true, reachable: false, ms: null };
    await client.ping();
    return { configured: true, reachable: true, ms: Date.now() - t0 };
  } catch {
    return { configured: true, reachable: false, ms: null };
  }
}

/**
 * Distributed lock via SET NX EX.
 * @returns {{ ok: true, token: string } | { ok: false, reason: 'held'|'unavailable' }}
 */
export async function acquireLock(key, ttlSeconds = 300) {
  if (!hasRedisConfig()) return { ok: false, reason: 'unavailable' };
  const client = await getRedisClient();
  if (!client) return { ok: false, reason: 'unavailable' };
  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    const result = await client.set(key, token, 'EX', Math.max(1, ttlSeconds), 'NX');
    if (result === 'OK') return { ok: true, token };
    return { ok: false, reason: 'held' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** Release only if token still owns the lock (best-effort). */
export async function releaseLock(key, token) {
  const client = await getRedisClient();
  if (!client || !token) return false;
  try {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `;
    await client.eval(script, 1, key, token);
    return true;
  } catch {
    return false;
  }
}
