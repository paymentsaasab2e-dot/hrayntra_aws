/**
 * Limits concurrent bulk CV parse requests so production API / AI pipeline is not overwhelmed.
 * Default: 2 parallel parses per API instance — aligned with frontend bulk CV worker count.
 * Override with BULK_CV_PARSE_CONCURRENCY (do not exceed 3 on a single small VPS).
 */

const MAX_CONCURRENT = (() => {
  const raw = Number(process.env.BULK_CV_PARSE_CONCURRENCY);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 2;
})();

const QUEUE_WARN_AFTER = 4;

let active = 0;
const waitQueue = [];

function releaseSlot() {
  active = Math.max(0, active - 1);
  const next = waitQueue.shift();
  if (next) next();
}

function acquireSlot() {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (active < MAX_CONCURRENT) {
        active += 1;
        resolve(releaseSlot);
        return;
      }
      if (waitQueue.length === QUEUE_WARN_AFTER) {
        console.warn(
          `[bulk-cv] parse queue depth ${waitQueue.length + 1} — consider smaller batches or a second API node`
        );
      }
      waitQueue.push(tryAcquire);
    };
    tryAcquire();
  });
}

export async function withBulkCvProcessSlot(operation) {
  const release = await acquireSlot();
  try {
    return await operation();
  } finally {
    release();
  }
}

export function getBulkCvProcessLimiterStats() {
  return { active, queued: waitQueue.length, maxConcurrent: MAX_CONCURRENT };
}
