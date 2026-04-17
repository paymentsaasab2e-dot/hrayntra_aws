import Redis from 'ioredis';

let redisClient = null;

function hasRedisConfig() {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

function createRedisClient() {
  if (!hasRedisConfig()) return null;

  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
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
    try {
      await redisClient.connect();
    } catch {
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
  const client = await getRedisClient();
  if (!client) return false;

  try {
    const keys = await client.keys(pattern);
    if (!keys || keys.length === 0) return true;
    await client.del(keys);
    return true;
  } catch {
    return false;
  }
}
