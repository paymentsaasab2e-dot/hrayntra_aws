/**
 * Pure CV parse job state machine helpers (no I/O).
 * Used by production claim path and concurrency soak tests.
 */

const STATUSES = Object.freeze({
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

/** Allowed transitions: from → Set(to) */
const ALLOWED = Object.freeze({
  [STATUSES.QUEUED]: new Set([STATUSES.PROCESSING]),
  [STATUSES.PROCESSING]: new Set([
    STATUSES.COMPLETED,
    STATUSES.FAILED,
    STATUSES.QUEUED, // retry or stale recovery
  ]),
  [STATUSES.FAILED]: new Set([STATUSES.QUEUED, STATUSES.PROCESSING]),
  [STATUSES.COMPLETED]: new Set([]), // terminal
});

function isValidTransition(from, to) {
  const f = String(from || '').toLowerCase();
  const t = String(to || '').toLowerCase();
  if (!f || !t) return false;
  if (f === t) return true;
  const allowed = ALLOWED[f];
  return Boolean(allowed && allowed.has(t));
}

function assertTransition(from, to, context = '') {
  if (!isValidTransition(from, to)) {
    const err = new Error(
      `Invalid CV job transition ${from} → ${to}${context ? ` (${context})` : ''}`,
    );
    err.code = 'CV_INVALID_TRANSITION';
    throw err;
  }
}

/**
 * In-memory atomic claim for soak tests (simulates Mongo findAndModify).
 * jobs: Map(candidateId → jobState)
 */
function claimInMemory(jobs, candidateId, workerId, opts = {}) {
  const staleMs = opts.staleMs ?? 10 * 60_000;
  const maxAttempts = opts.maxAttempts ?? 3;
  const now = opts.now ?? Date.now();
  const job = jobs.get(candidateId);
  if (!job) return null;

  if (job.status === STATUSES.COMPLETED) return null;

  const lockedAt = job.lockedAt ? Number(job.lockedAt) : 0;
  const isStale =
    job.status === STATUSES.PROCESSING &&
    lockedAt > 0 &&
    now - lockedAt > staleMs;

  const canClaim =
    job.status === STATUSES.QUEUED ||
    (job.status === STATUSES.FAILED && (job.attempts || 0) < maxAttempts) ||
    isStale;

  if (!canClaim) {
    if (job.status === STATUSES.PROCESSING && job.lockedBy === workerId) {
      return { ...job };
    }
    return null;
  }

  assertTransition(job.status, STATUSES.PROCESSING, 'claim');

  const attempts =
    (job.attempts || 0) +
    (job.status === STATUSES.QUEUED || isStale || job.status === STATUSES.FAILED ? 1 : 0);

  const next = {
    ...job,
    status: STATUSES.PROCESSING,
    stage: 'claimed',
    attempts,
    lockedBy: workerId,
    lockedAt: now,
    startedAt: now,
    error: null,
  };
  jobs.set(candidateId, next);
  return { ...next };
}

function completeInMemory(jobs, candidateId) {
  const job = jobs.get(candidateId);
  if (!job) return null;
  assertTransition(job.status, STATUSES.COMPLETED, 'complete');
  const next = {
    ...job,
    status: STATUSES.COMPLETED,
    stage: 'completed',
    lockedBy: null,
    lockedAt: null,
    completedAt: Date.now(),
    error: null,
  };
  jobs.set(candidateId, next);
  return next;
}

function failInMemory(jobs, candidateId, errorMessage, { requeue = false, maxAttempts = 3 } = {}) {
  const job = jobs.get(candidateId);
  if (!job) return null;
  const attempts = Number(job.attempts) || 0;
  const canRetry = requeue && attempts < maxAttempts;
  const to = canRetry ? STATUSES.QUEUED : STATUSES.FAILED;
  assertTransition(job.status, to, 'fail');
  const next = {
    ...job,
    status: to,
    stage: canRetry ? 'retry_queued' : 'failed',
    lockedBy: null,
    lockedAt: null,
    failedAt: Date.now(),
    error: errorMessage || 'Parse failed',
  };
  jobs.set(candidateId, next);
  return next;
}

function recoverStaleInMemory(jobs, { staleMs = 10 * 60_000, now = Date.now() } = {}) {
  const recovered = [];
  for (const [id, job] of jobs.entries()) {
    if (job.status !== STATUSES.PROCESSING) continue;
    const lockedAt = Number(job.lockedAt) || 0;
    if (!lockedAt || now - lockedAt <= staleMs) continue;
    assertTransition(job.status, STATUSES.QUEUED, 'stale-recover');
    const next = {
      ...job,
      status: STATUSES.QUEUED,
      stage: 'recovered',
      lockedBy: null,
      lockedAt: null,
      error: 'Recovered stale processing job',
    };
    jobs.set(id, next);
    recovered.push(id);
  }
  return recovered;
}

function countActiveClaims(jobs) {
  let n = 0;
  for (const job of jobs.values()) {
    if (job.status === STATUSES.PROCESSING) n += 1;
  }
  return n;
}

module.exports = {
  STATUSES,
  ALLOWED,
  isValidTransition,
  assertTransition,
  claimInMemory,
  completeInMemory,
  failInMemory,
  recoverStaleInMemory,
  countActiveClaims,
};
