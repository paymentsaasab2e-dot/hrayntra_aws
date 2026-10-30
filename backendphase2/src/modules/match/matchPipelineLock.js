/**
 * Shared per-job match-pipeline lock (AI and Applied share one key).
 * Production requires Redis — no process-local fallback when Redis is down.
 */

const PIPELINE_LOCK_TTL_SEC = Number(process.env.MATCH_PIPELINE_LOCK_TTL_SEC || 600) || 600;
const localPipelineLocks = new Map();

export function pipelineLockKey(jobId) {
  return `match:pipeline:${String(jobId)}`;
}

function pipelineLockError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export function allowLocalPipelineLock(hasRedisConfigFn = null) {
  const hasRedis =
    typeof hasRedisConfigFn === 'function'
      ? hasRedisConfigFn()
      : Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
  if (hasRedis) return false;
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ALLOW_LOCAL_MATCH_PIPELINE_LOCK !== '0';
}

/**
 * @param {string} jobId
 * @param {{ hasRedisConfig: Function, acquireLock: Function }} redis
 */
export async function acquirePipelineLock(jobId, redis) {
  const key = pipelineLockKey(jobId);

  if (redis.hasRedisConfig()) {
    const result = await redis.acquireLock(key, PIPELINE_LOCK_TTL_SEC);
    if (result.ok) return { key, token: result.token, local: false };
    if (result.reason === 'held') {
      throw pipelineLockError(
        'Match pipeline already running for this job. Try again shortly.',
        409,
        'PIPELINE_LOCKED',
      );
    }
    throw pipelineLockError(
      'Match pipeline lock unavailable (Redis unreachable). Retry when Redis is healthy.',
      503,
      'PIPELINE_LOCK_UNAVAILABLE',
    );
  }

  if (!allowLocalPipelineLock(() => redis.hasRedisConfig())) {
    throw pipelineLockError(
      'Match pipeline requires Redis locking. Configure REDIS_URL or REDIS_HOST.',
      503,
      'PIPELINE_LOCK_UNAVAILABLE',
    );
  }

  const now = Date.now();
  const existing = localPipelineLocks.get(key);
  if (existing && existing.expiresAt > now) {
    throw pipelineLockError(
      'Match pipeline already running for this job. Try again shortly.',
      409,
      'PIPELINE_LOCKED',
    );
  }
  const token = `local_${now}`;
  localPipelineLocks.set(key, { token, expiresAt: now + PIPELINE_LOCK_TTL_SEC * 1000 });
  return { key, token, local: true };
}

export async function releasePipelineLock(lock, redis) {
  if (!lock?.key) return;
  if (lock.local) {
    const cur = localPipelineLocks.get(lock.key);
    if (cur?.token === lock.token) localPipelineLocks.delete(lock.key);
    return;
  }
  await redis.releaseLock(lock.key, lock.token);
}

export const __pipelineLockTest = { localPipelineLocks, PIPELINE_LOCK_TTL_SEC };
