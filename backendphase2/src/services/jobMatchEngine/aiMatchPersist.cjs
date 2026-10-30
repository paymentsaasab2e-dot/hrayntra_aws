// Upsert one AI-authored Match per (candidateId, jobId). Never touches manual matches.

const AI_MATCH_AUTHOR_WHERE = { isSet: false };

/**
 * @param {object} prisma
 * @param {{ candidateId: string, jobId: string, score: number, status?: string, evaluation: object }} payload
 * @returns {Promise<{ id: string, action: 'updated'|'created', duplicatesRemoved: number }>}
 */
async function upsertAiAuthoredMatch(prisma, payload) {
  const candidateId = String(payload.candidateId || '').trim();
  const jobId = String(payload.jobId || '').trim();
  if (!candidateId || !jobId) {
    throw new Error('candidateId and jobId are required');
  }

  const existing = await prisma.match.findMany({
    where: {
      candidateId,
      jobId,
      createdById: AI_MATCH_AUTHOR_WHERE,
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });

  const keepId = existing[0]?.id || null;
  const dupIds = existing.slice(1).map((row) => row.id).filter(Boolean);
  if (dupIds.length) {
    await prisma.match.deleteMany({ where: { id: { in: dupIds } } });
  }

  const data = {
    score: payload.score,
    status: payload.status || 'SUGGESTED',
    evaluation: payload.evaluation,
  };

  if (keepId) {
    await prisma.match.update({ where: { id: keepId }, data });
    return { id: keepId, action: 'updated', duplicatesRemoved: dupIds.length };
  }

  const created = await prisma.match.create({
    data: {
      candidateId,
      jobId,
      ...data,
    },
  });

  // Collapse any race-created AI-authored duplicates (manual matches never match this filter).
  const after = await prisma.match.findMany({
    where: { candidateId, jobId, createdById: AI_MATCH_AUTHOR_WHERE },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  const raceDups = after.slice(1).map((row) => row.id).filter(Boolean);
  if (raceDups.length) {
    await prisma.match.deleteMany({ where: { id: { in: raceDups } } });
  }

  return {
    id: after[0]?.id || created.id,
    action: 'created',
    duplicatesRemoved: raceDups.length,
  };
}

module.exports = { upsertAiAuthoredMatch, AI_MATCH_AUTHOR_WHERE };
