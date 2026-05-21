import { prisma } from '../config/prisma.js';
import { deleteS3ObjectByUrl } from '../utils/s3.js';

function collectRemoteAssetUrls(candidate, files = []) {
  const urls = new Set();
  const push = (value) => {
    const url = String(value || '').trim();
    if (/^https?:\/\//i.test(url)) urls.add(url);
  };

  if (candidate) {
    push(candidate.resume);
    push(candidate.resumeUrl);
    push(candidate.avatar);
    push(candidate.portfolio);
    push(candidate.website);
  }

  for (const file of files) {
    push(file?.fileUrl);
  }

  return [...urls];
}

async function safeDeleteMany(tx, delegateName, args) {
  try {
    if (tx[delegateName]?.deleteMany) {
      await tx[delegateName].deleteMany(args);
    }
  } catch (err) {
    console.warn(`[candidate.purge] ${delegateName}.deleteMany failed:`, err?.message || err);
  }
}

/**
 * Permanently removes a candidate from the tenant DB, deletes linked S3 assets,
 * and records the id so portal merge / duplicate checks ignore this profile.
 */
export async function permanentDeleteCandidateById(candidateId) {
  const id = String(candidateId || '').trim();
  if (!id) throw new Error('Candidate id required');

  const candidate = await prisma.candidate.findFirst({
    where: { id },
    select: {
      id: true,
      resume: true,
      resumeUrl: true,
      avatar: true,
      portfolio: true,
      website: true,
    },
  });

  const files = candidate
    ? await prisma.candidateFile.findMany({
        where: { candidateId: id },
        select: { fileUrl: true },
      })
    : [];

  const assetUrls = collectRemoteAssetUrls(candidate, files);
  await Promise.all(assetUrls.map((url) => deleteS3ObjectByUrl(url)));

  if (candidate) {
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

      await safeDeleteMany(tx, 'match', { where: { candidateId: id } });
      await safeDeleteMany(tx, 'pipelineEntry', { where: { candidateId: id } });
      await safeDeleteMany(tx, 'interview', { where: { candidateId: id } });
      await safeDeleteMany(tx, 'placement', { where: { candidateId: id } });
      await safeDeleteMany(tx, 'application', { where: { candidateId: id } });
      await safeDeleteMany(tx, 'candidateFile', { where: { candidateId: id } });

      await tx.candidate.delete({ where: { id } });
    });
  }

  await prisma.purgedCandidateRef.upsert({
    where: { candidateId: id },
    create: { candidateId: id },
    update: { purgedAt: new Date() },
  });

  console.log('[candidate] permanentDeleteCandidateById completed', {
    id,
    s3AssetsRemoved: assetUrls.length,
    hadTenantRow: Boolean(candidate),
  });
}
