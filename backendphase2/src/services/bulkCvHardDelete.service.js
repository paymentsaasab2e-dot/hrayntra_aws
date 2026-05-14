import { prisma } from '../config/prisma.js';

/**
 * Permanently removes a candidate and best-effort cleanup of non-cascading references.
 */
export async function hardDeleteCandidateById(candidateId) {
  const id = String(candidateId || '').trim();
  if (!id) throw new Error('Candidate id required');

  await prisma.$transaction(async (tx) => {
    await tx.lead.updateMany({
      where: { convertedToCandidateId: id },
      data: { convertedToCandidateId: null },
    });

    await tx.activity.deleteMany({
      where: {
        OR: [
          { entityType: 'CANDIDATE', entityId: id },
          { relatedType: 'candidate', relatedId: id },
        ],
      },
    });

    await tx.notification.deleteMany({
      where: {
        OR: [
          { entityType: 'CANDIDATE', entityId: id },
          { entityType: 'candidate', entityId: id },
        ],
      },
    });

    await tx.thread.deleteMany({
      where: { relatedEntityType: 'CANDIDATE', relatedEntityId: id },
    });

    await tx.candidate.delete({
      where: { id },
    });
  });

  console.log('[bulk-cv] hardDeleteCandidateById completed', id);
}
