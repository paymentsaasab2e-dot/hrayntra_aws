/** In-memory waiters for bulk CV duplicate user decisions (one HTTP worker process). */

const pending = new Map();

export function bulkCvDuplicateWaitKey(userId, sessionId, fileIndex) {
  return `${String(userId)}::${String(sessionId)}::${Number(fileIndex)}`;
}

/**
 * @param {string} decision - 'create_anyway' | 'update_existing' | 'replace' | 'cancel'
 * @returns {Promise<string>}
 */
export function waitBulkCvDuplicateDecision(userId, sessionId, fileIndex, timeoutMs = 300_000) {
  const key = bulkCvDuplicateWaitKey(userId, sessionId, fileIndex);
  return new Promise((outerResolve) => {
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pending.delete(key);
      outerResolve(String(v || 'cancel'));
    };

    const timer = setTimeout(() => {
      console.log('[bulk-cv] duplicate decision TIMEOUT → cancel', key);
      finish('cancel');
    }, timeoutMs);

    pending.set(key, { finish });
  });
}

/**
 * @param {string} decision
 * @returns {boolean} true if a waiter was resolved
 */
export function completeBulkCvDuplicateDecision(userId, sessionId, fileIndex, decision) {
  const key = bulkCvDuplicateWaitKey(userId, sessionId, fileIndex);
  const entry = pending.get(key);
  if (!entry) {
    console.warn('[bulk-cv] duplicate_decision: no pending waiter for key', key, 'decision=', decision);
    return false;
  }
  console.log('[bulk-cv] duplicate_decision received', { key, decision });
  entry.finish(decision);
  return true;
}
