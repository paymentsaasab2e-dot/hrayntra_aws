/**
 * In-memory performance history for /candidate-speed (test env).
 * Does not store candidate PII — only timings and counts.
 */

const MAX_HISTORY = Math.min(
  500,
  Math.max(50, Number(process.env.CANDIDATE_PERF_HISTORY_MAX || 200) || 200),
);

/** @type {Array<object>} */
const history = [];

let counters = {
  requests: 0,
  l1Hits: 0,
  l2Hits: 0,
  misses: 0,
  coalesced: 0,
  errors: 0,
};

export function recordPerfSample(sample) {
  const row = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...sample,
  };
  history.unshift(row);
  while (history.length > MAX_HISTORY) history.pop();

  counters.requests += 1;
  if (sample.cacheState === 'L1_HIT') counters.l1Hits += 1;
  else if (sample.cacheState === 'L2_HIT') counters.l2Hits += 1;
  else if (sample.cacheState === 'MISS' || sample.cacheState === 'BYPASS') counters.misses += 1;
  if (sample.coalesced) counters.coalesced += 1;
  if (sample.error) counters.errors += 1;

  return row;
}

export function listPerfHistory({ limit = 50, tenantId } = {}) {
  const max = Math.min(200, Math.max(1, Number(limit) || 50));
  const tid = String(tenantId || '').trim();
  const rows = tid
    ? history.filter((h) => String(h.tenantId || '') === tid)
    : history;
  return rows.slice(0, max);
}

export function getPerfCounters() {
  return { ...counters };
}

export function resetPerfCounters() {
  counters = {
    requests: 0,
    l1Hits: 0,
    l2Hits: 0,
    misses: 0,
    coalesced: 0,
    errors: 0,
  };
}

export function clearPerfHistory() {
  history.length = 0;
}
