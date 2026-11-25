/**
 * In-process single-flight coalescing for identical candidate list fetches.
 */

/** @type {Map<string, Promise<any>>} */
const inflight = new Map();
let coalescedCount = 0;

export async function coalesce(key, producer) {
  const existing = inflight.get(key);
  if (existing) {
    coalescedCount += 1;
    return { result: await existing, coalesced: true };
  }

  const promise = Promise.resolve()
    .then(producer)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return { result: await promise, coalesced: false };
}

export function coalescerStats() {
  return {
    inflight: inflight.size,
    coalescedTotal: coalescedCount,
  };
}

export function coalescerResetStats() {
  coalescedCount = 0;
}
