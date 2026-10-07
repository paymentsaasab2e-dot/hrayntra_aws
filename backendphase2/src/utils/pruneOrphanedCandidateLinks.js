/**
 * MongoDB does not enforce Prisma relation FKs. When a Candidate is deleted
 * (or never synced) while Match / Application / Interview / PipelineEntry
 * rows still reference it, `include: { candidate: true }` throws:
 *   Inconsistent query result: Field candidate is required to return data, got null
 *
 * Delete those orphan link rows so job/match queries stay healthy.
 */

function asIdList(rows) {
  return [...new Set((rows || []).map((row) => String(row?.candidateId || '').trim()).filter(Boolean))];
}

async function pruneModel(client, modelName, where) {
  if (!client?.[modelName]?.findMany || !client?.[modelName]?.deleteMany) return 0;

  const rows = await client[modelName].findMany({
    where,
    select: { id: true, candidateId: true },
    take: 5000,
  });
  if (!rows.length) return 0;

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

  if (!orphanIds.length) return 0;

  await client[modelName].deleteMany({ where: { id: { in: orphanIds } } });
  return orphanIds.length;
}

/**
 * @param {import('@prisma/client').PrismaClient} client
 * @param {{ jobId?: string }} [options]
 * @returns {Promise<{ match: number, application: number, interview: number, pipelineEntry: number }>}
 */
export async function pruneOrphanedCandidateLinks(client, options = {}) {
  const jobId = String(options?.jobId || '').trim();
  const where = jobId ? { jobId } : {};
  const result = {
    match: 0,
    application: 0,
    interview: 0,
    pipelineEntry: 0,
  };

  try {
    result.match = await pruneModel(client, 'match', where);
    result.application = await pruneModel(client, 'application', where);
    result.interview = await pruneModel(client, 'interview', where);
    result.pipelineEntry = await pruneModel(client, 'pipelineEntry', where);
  } catch (error) {
    console.warn(
      '[pruneOrphanedCandidateLinks] failed:',
      error?.message || error,
      jobId ? { jobId } : {},
    );
  }

  const total =
    result.match + result.application + result.interview + result.pipelineEntry;
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
