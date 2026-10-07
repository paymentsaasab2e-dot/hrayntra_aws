/**
 * MongoDB does not enforce Prisma relation FKs. When a Candidate is deleted
 * (or never synced) while child rows still reference it, includes throw:
 *   Inconsistent query result: Field candidate is required to return data, got null
 *
 * Delete those orphan link rows so job/match/interview/placement queries stay healthy.
 */

/** Models scoped by jobId (safe to prune for one job). */
const JOB_SCOPED_MODELS = [
  'match',
  'application',
  'interview',
  'pipelineEntry',
  'placement',
];

/** Models with candidateId but no jobId — pruned on global heal only. */
const GLOBAL_MODELS = ['interviewApplication', 'candidateFile'];

function asIdList(rows) {
  return [...new Set((rows || []).map((row) => String(row?.candidateId || '').trim()).filter(Boolean))];
}

async function pruneModel(client, modelName, where, { maxPasses = 20, pageSize = 500 } = {}) {
  if (!client?.[modelName]?.findMany || !client?.[modelName]?.deleteMany) return 0;

  let removed = 0;
  let skip = 0;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const rows = await client[modelName].findMany({
      where,
      select: { id: true, candidateId: true },
      take: pageSize,
      skip,
      orderBy: { id: 'asc' },
    });
    if (!rows.length) break;

    const candidateIds = asIdList(rows);
    let aliveSet = new Set();
    if (candidateIds.length && client.candidate?.findMany) {
      const alive = await client.candidate.findMany({
        where: { id: { in: candidateIds } },
        select: { id: true },
      });
      aliveSet = new Set(alive.map((row) => String(row.id)));
    }

    const orphanIds = rows
      .filter((row) => !aliveSet.has(String(row.candidateId || '').trim()))
      .map((row) => row.id);

    if (orphanIds.length) {
      await client[modelName].deleteMany({ where: { id: { in: orphanIds } } });
      removed += orphanIds.length;
      // Deleted from this page — do not advance skip by pageSize (rows shifted).
    } else {
      skip += rows.length;
    }

    if (rows.length < pageSize) break;
  }

  return removed;
}

/**
 * @param {import('@prisma/client').PrismaClient} client
 * @param {{ jobId?: string }} [options]
 */
export async function pruneOrphanedCandidateLinks(client, options = {}) {
  const jobId = String(options?.jobId || '').trim();
  const where = jobId ? { jobId } : {};
  const result = {
    match: 0,
    application: 0,
    interview: 0,
    pipelineEntry: 0,
    placement: 0,
    interviewApplication: 0,
    candidateFile: 0,
  };

  try {
    for (const modelName of JOB_SCOPED_MODELS) {
      result[modelName] = await pruneModel(client, modelName, where);
    }
    // Global-only models: always safe; when jobId is set still prune a page of globals
    // so nested includes elsewhere don't keep failing after a job-scoped heal.
    if (!jobId) {
      for (const modelName of GLOBAL_MODELS) {
        result[modelName] = await pruneModel(client, modelName, {});
      }
    }
  } catch (error) {
    console.warn(
      '[pruneOrphanedCandidateLinks] failed:',
      error?.message || error,
      jobId ? { jobId } : {},
    );
  }

  const total = Object.values(result).reduce((sum, n) => sum + Number(n || 0), 0);
  if (total > 0) {
    console.warn('[pruneOrphanedCandidateLinks] removed orphan rows', {
      ...result,
      ...(jobId ? { jobId } : {}),
    });
  }

  return result;
}

export function isMissingRequiredCandidateError(error) {
  const msg = String(error?.message || error || '');
  return (
    /Inconsistent query result/i.test(msg) &&
    /Field candidate is required to return data/i.test(msg)
  );
}

/** Any required relation resolved to null (candidate, job, client, …). */
export function isMissingRequiredRelationError(error) {
  const msg = String(error?.message || error || '');
  return (
    /Inconsistent query result/i.test(msg) &&
    /is required to return data, got `null`/i.test(msg)
  );
}

export function extractJobIdFromPrismaArgs(params) {
  const model = String(params?.model || '');
  const where = params?.args?.where;
  if (!where || typeof where !== 'object') return '';

  const pick = (obj) => {
    if (!obj || typeof obj !== 'object') return '';
    if (typeof obj.jobId === 'string' && obj.jobId.trim()) return obj.jobId.trim();
    if (model === 'Job' && typeof obj.id === 'string' && obj.id.trim()) return obj.id.trim();
    return '';
  };

  const direct = pick(where);
  if (direct) return direct;

  if (Array.isArray(where.AND)) {
    for (const part of where.AND) {
      const found = pick(part);
      if (found) return found;
    }
  }
  if (Array.isArray(where.OR)) {
    for (const part of where.OR) {
      const found = pick(part);
      if (found) return found;
    }
  }
  return '';
}
