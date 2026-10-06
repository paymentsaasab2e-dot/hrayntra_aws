/**
 * Durable CV parse job state (Mongo Resume.resumeJson) + optional in-memory cache.
 * Survives process restart and multi-instance status reads.
 * Redis/BullMQ not required — migration path documented in PHASE1_PERFORMANCE_REPORT.
 */

const { prisma, retryQuery } = require('../lib/prisma');
const {
  STATUSES,
  isValidTransition,
  assertTransition,
} = require('./cv-parse-state-machine');

const MAX_ATTEMPTS = Math.max(1, Number(process.env.CV_PARSE_MAX_ATTEMPTS) || 3);
const STALE_PROCESSING_MS = Math.max(
  60_000,
  Number(process.env.CV_PARSE_STALE_MS) || 10 * 60_000,
);
const RETRY_DELAY_MS = Math.max(1000, Number(process.env.CV_PARSE_RETRY_DELAY_MS) || 5000);

/** Per-process cache for fast status (authoritative source is Mongo). */
const jobs = new Map();

function setJob(candidateId, patch) {
  const id = String(candidateId || '').trim();
  if (!id) return null;
  const prev = jobs.get(id) || {
    candidateId: id,
    status: STATUSES.QUEUED,
    updatedAt: Date.now(),
    error: null,
    stage: null,
    attempts: 0,
  };
  if (patch.status && prev.status && !isValidTransition(prev.status, patch.status)) {
    console.warn(
      `[cv-parse-job] rejected mem transition ${prev.status} → ${patch.status} for ${id}`,
    );
    return prev;
  }
  const next = {
    ...prev,
    ...patch,
    candidateId: id,
    updatedAt: Date.now(),
  };
  jobs.set(id, next);
  return next;
}

function getJob(candidateId) {
  const id = String(candidateId || '').trim();
  if (!id) return null;
  return jobs.get(id) || null;
}

function clearJob(candidateId) {
  jobs.delete(String(candidateId || '').trim());
}

async function readPersistedJob(candidateId) {
  const id = String(candidateId || '').trim();
  if (!id) return null;
  const resume = await retryQuery(() =>
    prisma.resume.findUnique({
      where: { candidateId: id },
      select: {
        resumeJson: true,
        aiAnalyzed: true,
        fileUrl: true,
        fileName: true,
        mimeType: true,
      },
    }),
  );
  if (!resume) return null;
  const json =
    resume.resumeJson && typeof resume.resumeJson === 'object' ? resume.resumeJson : {};
  return {
    candidateId: id,
    status: json.parseStatus || (resume.aiAnalyzed ? STATUSES.COMPLETED : null),
    stage: json.parseStage || null,
    error: json.parseError || null,
    attempts: Number(json.parseAttempts) || 0,
    parseJobId: json.parseJobId || null,
    lockedBy: json.parseLockedBy || null,
    lockedAt: json.parseLockedAt || null,
    fileUrl: resume.fileUrl || json.fileUrl || null,
    fileName: resume.fileName || null,
    mimeType: resume.mimeType || null,
    updatedAt: json.parseUpdatedAt ? Date.parse(json.parseUpdatedAt) : Date.now(),
  };
}

async function patchPersistedJob(candidateId, patch) {
  const id = String(candidateId || '').trim();
  if (!id) return null;
  const current = await retryQuery(() =>
    prisma.resume.findUnique({ where: { candidateId: id }, select: { resumeJson: true } }),
  );
  const base =
    current?.resumeJson && typeof current.resumeJson === 'object' ? current.resumeJson : {};
  const fromStatus = base.parseStatus || null;
  const toStatus = patch.parseStatus;
  if (fromStatus && toStatus && !isValidTransition(fromStatus, toStatus)) {
    console.warn(
      `[cv-parse-job] rejected persisted transition ${fromStatus} → ${toStatus} for ${id}`,
    );
    return base;
  }
  const nextJson = {
    ...base,
    ...patch,
    parseUpdatedAt: new Date().toISOString(),
  };
  await retryQuery(() =>
    prisma.resume.update({
      where: { candidateId: id },
      data: { resumeJson: nextJson, updatedAt: new Date() },
    }),
  );
  setJob(id, {
    status: nextJson.parseStatus,
    stage: nextJson.parseStage,
    error: nextJson.parseError || null,
    attempts: Number(nextJson.parseAttempts) || 0,
  });
  return nextJson;
}

/**
 * Atomically claim a queued (or stale processing) job for this worker.
 * Never claims COMPLETED jobs. Prefer Mongo findAndModify for multi-instance.
 */
async function claimQueuedJob(candidateId, workerId) {
  const id = String(candidateId || '').trim();
  if (!id) return null;

  const persisted = await readPersistedJob(id);
  if (!persisted) return null;

  const status = persisted.status;
  if (status === STATUSES.COMPLETED) return null;

  const lockedAt = persisted.lockedAt ? Date.parse(persisted.lockedAt) : 0;
  const isStale =
    status === STATUSES.PROCESSING &&
    lockedAt > 0 &&
    Date.now() - lockedAt > STALE_PROCESSING_MS;

  const canClaim =
    status === STATUSES.QUEUED ||
    (status === STATUSES.FAILED && (persisted.attempts || 0) < MAX_ATTEMPTS) ||
    isStale;

  if (!canClaim) {
    if (status === STATUSES.PROCESSING && persisted.lockedBy === workerId) {
      return persisted;
    }
    return null;
  }

  try {
    assertTransition(status, STATUSES.PROCESSING, 'claim');
  } catch {
    return null;
  }

  const attempts =
    (persisted.attempts || 0) +
    (status === STATUSES.QUEUED || isStale || status === STATUSES.FAILED ? 1 : 0);

  const nowIso = new Date().toISOString();
  let claimedOk = false;
  let usedRaw = false;

  try {
    const result = await prisma.$runCommandRaw({
      findAndModify: 'resumes',
      query: {
        candidateId: { $oid: id },
        $and: [
          {
            $or: [
              { 'resumeJson.parseStatus': { $exists: false } },
              { 'resumeJson.parseStatus': { $ne: STATUSES.COMPLETED } },
            ],
          },
          {
            $or: [
              { 'resumeJson.parseStatus': STATUSES.QUEUED },
              { 'resumeJson.parseStatus': STATUSES.FAILED },
              {
                'resumeJson.parseStatus': STATUSES.PROCESSING,
                'resumeJson.parseLockedAt': {
                  $lt: new Date(Date.now() - STALE_PROCESSING_MS).toISOString(),
                },
              },
            ],
          },
        ],
      },
      update: {
        $set: {
          'resumeJson.parseStatus': STATUSES.PROCESSING,
          'resumeJson.parseStage': 'claimed',
          'resumeJson.parseError': null,
          'resumeJson.parseAttempts': attempts,
          'resumeJson.parseLockedBy': workerId,
          'resumeJson.parseLockedAt': nowIso,
          'resumeJson.parseStartedAt': nowIso,
          'resumeJson.parseUpdatedAt': nowIso,
          updatedAt: new Date(),
        },
      },
      new: true,
    });
    usedRaw = true;
    claimedOk = Boolean(result?.value);
  } catch (err) {
    console.warn('[cv-parse-job] findAndModify claim failed, falling back:', err?.message || err);
  }

  if (usedRaw && !claimedOk) {
    return null;
  }

  if (!claimedOk) {
    const again = await readPersistedJob(id);
    if (!again || again.status === STATUSES.COMPLETED) return null;
    if (
      again.status === STATUSES.PROCESSING &&
      again.lockedBy &&
      again.lockedBy !== workerId
    ) {
      const againLocked = again.lockedAt ? Date.parse(again.lockedAt) : 0;
      if (againLocked && Date.now() - againLocked <= STALE_PROCESSING_MS) {
        return null;
      }
    }
    await patchPersistedJob(id, {
      parseStatus: STATUSES.PROCESSING,
      parseStage: 'claimed',
      parseError: null,
      parseAttempts: attempts,
      parseLockedBy: workerId,
      parseLockedAt: nowIso,
      parseStartedAt: nowIso,
    });
  } else {
    setJob(id, {
      status: STATUSES.PROCESSING,
      stage: 'claimed',
      error: null,
      attempts,
    });
  }

  return {
    ...persisted,
    status: STATUSES.PROCESSING,
    attempts,
    lockedBy: workerId,
  };
}

async function markJobCompleted(candidateId, extra = {}) {
  return patchPersistedJob(candidateId, {
    parseStatus: STATUSES.COMPLETED,
    parseStage: 'completed',
    parseError: null,
    parseCompletedAt: new Date().toISOString(),
    parseLockedBy: null,
    parseLockedAt: null,
    ...extra,
  });
}

async function markJobFailed(candidateId, errorMessage, { requeue = false } = {}) {
  const persisted = await readPersistedJob(candidateId);
  const attempts = Number(persisted?.attempts) || 0;
  const canRetry = requeue && attempts < MAX_ATTEMPTS;

  return patchPersistedJob(candidateId, {
    parseStatus: canRetry ? STATUSES.QUEUED : STATUSES.FAILED,
    parseStage: canRetry ? 'retry_queued' : 'failed',
    parseError: errorMessage || 'Parse failed',
    parseFailedAt: new Date().toISOString(),
    parseLockedBy: null,
    parseLockedAt: null,
  });
}

async function recoverOrphanedJobs({ limit = 20 } = {}) {
  const resumes = await retryQuery(() =>
    prisma.resume.findMany({
      orderBy: { updatedAt: 'desc' },
      take: Math.min(100, Math.max(1, limit * 5)),
      select: {
        candidateId: true,
        fileUrl: true,
        fileName: true,
        mimeType: true,
        resumeJson: true,
        aiAnalyzed: true,
        updatedAt: true,
      },
    }),
  ).catch((err) => {
    console.warn('[cv-parse-job] recover scan failed:', err?.message || err);
    return [];
  });

  const recoverable = [];
  for (const resume of resumes || []) {
    const json =
      resume.resumeJson && typeof resume.resumeJson === 'object' ? resume.resumeJson : {};
    const status = json.parseStatus;
    if (status === STATUSES.COMPLETED || resume.aiAnalyzed) continue;

    const lockedAt = json.parseLockedAt ? Date.parse(json.parseLockedAt) : 0;
    const stale =
      status === STATUSES.PROCESSING &&
      (!lockedAt || Date.now() - lockedAt > STALE_PROCESSING_MS);
    const queued = status === STATUSES.QUEUED;
    const retryableFailed =
      status === STATUSES.FAILED && (Number(json.parseAttempts) || 0) < MAX_ATTEMPTS;

    if (!resume.fileUrl) continue;
    if (!(queued || stale || retryableFailed)) continue;

    await patchPersistedJob(resume.candidateId, {
      parseStatus: STATUSES.QUEUED,
      parseStage: 'recovered',
      parseLockedBy: null,
      parseLockedAt: null,
      parseError: stale ? 'Recovered stale processing job' : json.parseError || null,
    });
    recoverable.push({
      candidateId: resume.candidateId,
      fileUrl: resume.fileUrl,
      fileName: resume.fileName,
      mimeType: resume.mimeType,
      parseJobId: json.parseJobId || resume.candidateId,
    });
    if (recoverable.length >= limit) break;
  }

  return recoverable;
}

module.exports = {
  STATUSES,
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  STALE_PROCESSING_MS,
  isValidTransition,
  setJob,
  getJob,
  clearJob,
  readPersistedJob,
  patchPersistedJob,
  claimQueuedJob,
  markJobCompleted,
  markJobFailed,
  recoverOrphanedJobs,
};
