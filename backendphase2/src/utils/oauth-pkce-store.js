import { deleteCache, getCache, setCache } from '../cache/redis.js';

const memory = new Map();

function cacheKey(stateId) {
  return `oauth_pkce:${String(stateId || '').trim()}`;
}

function pruneMemory() {
  const now = Date.now();
  for (const [key, entry] of memory.entries()) {
    if (!entry || entry.expires <= now) memory.delete(key);
  }
}

export async function storeOAuthPkce(stateId, payload, ttlSeconds = 600) {
  const id = String(stateId || '').trim();
  if (!id) return false;

  const value = JSON.stringify(payload);
  const stored = await setCache(cacheKey(id), value, ttlSeconds);
  if (!stored) {
    pruneMemory();
    memory.set(cacheKey(id), { value, expires: Date.now() + ttlSeconds * 1000 });
  }
  return true;
}

export async function peekOAuthPkce(stateId) {
  const id = String(stateId || '').trim();
  if (!id) return null;

  const cached = await getCache(cacheKey(id));
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  pruneMemory();
  const entry = memory.get(cacheKey(id));
  if (!entry || entry.expires <= Date.now()) {
    memory.delete(cacheKey(id));
    return null;
  }

  try {
    return JSON.parse(entry.value);
  } catch {
    return null;
  }
}

export async function consumeOAuthPkce(stateId) {
  const id = String(stateId || '').trim();
  if (!id) return null;

  const payload = await peekOAuthPkce(id);
  await deleteCache(cacheKey(id));
  memory.delete(cacheKey(id));
  return payload;
}
