/** True for Prisma Mongo write conflicts / transient transaction failures. */
export function isMongoTransientWriteConflict(e) {
  if (!e) return false;
  const code = e.code;
  if (code === 'P2034' || code === 2034) return true;
  const msg = String(e.message || '').toLowerCase();
  return (
    msg.includes('write conflict') ||
    msg.includes('deadlock') ||
    msg.includes('please retry your transaction')
  );
}

/** Retry MongoDB writes that fail with P2034 (concurrent updates). */
export async function withMongoWriteConflictRetry(fn, maxAttempts = 8) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (isMongoTransientWriteConflict(e) && attempt < maxAttempts - 1) {
        const backoff = Math.min(2000, 40 * 2 ** attempt + Math.floor(Math.random() * 80));
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
