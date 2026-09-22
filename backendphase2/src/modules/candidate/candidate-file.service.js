import { prisma } from '../../config/prisma.js';

function isResumeFileType(fileType) {
  return /^resume$/i.test(String(fileType || '').trim()) || /^cv$/i.test(String(fileType || '').trim());
}

/** Dedicated resume rows only — never Files-tab Other/Offer/etc. documents. */
function isDedicatedResumeFile(file) {
  if (isResumeFileType(file?.fileType)) return true;
  const url = String(file?.fileUrl || '');
  return /\/resumes\/|\/cv-files\//i.test(url);
}

/** Latest uploaded resume file URL for a candidate (Resume tab / primary resume). */
export async function getLatestCandidateResumeFileUrl(candidateId, options = {}) {
  const id = String(candidateId || '').trim();
  if (!id) return null;
  const skipUrl = String(options.skipUrl || '').trim();

  const files = await prisma.candidateFile.findMany({
    where: { candidateId: id },
    orderBy: { createdAt: 'desc' },
    select: { fileUrl: true, fileType: true, fileName: true },
  });

  for (const file of files) {
    const url = String(file?.fileUrl || '').trim();
    if (!url || url === skipUrl) continue;
    if (isDedicatedResumeFile(file)) return url;
  }

  const row = await prisma.candidate.findUnique({
    where: { id },
    select: { resume: true, resumeUrl: true },
  });
  const fromRow = String(row?.resumeUrl || row?.resume || '').trim();
  if (fromRow && fromRow !== skipUrl) return fromRow;
  return null;
}

export const candidateFileService = {
  async getAll(candidateId) {
    return prisma.candidateFile.findMany({
      where: { candidateId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(fileId) {
    return prisma.candidateFile.findUnique({
      where: { id: fileId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async create(candidateId, data, uploadedById) {
    const file = await prisma.candidateFile.create({
      data: {
        candidateId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        uploadedById,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const fileType = String(data.fileType || '').trim().toLowerCase();
    if (fileType === 'photo' || fileType === 'avatar' || fileType === 'profile photo') {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { avatar: data.fileUrl },
      });
    } else if (fileType === 'resume' || fileType === 'cv') {
      // Promote uploaded resume/CV to the candidate's primary resume so Overview,
      // Resume tab, client review, and exports all resolve the new file.
      const existing = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { extraData: true },
      });
      const existingExtra =
        existing?.extraData && typeof existing.extraData === 'object' && !Array.isArray(existing.extraData)
          ? { ...existing.extraData }
          : {};
      const snap =
        existingExtra.phase1ProfileSnapshot &&
        typeof existingExtra.phase1ProfileSnapshot === 'object' &&
        !Array.isArray(existingExtra.phase1ProfileSnapshot)
          ? { ...existingExtra.phase1ProfileSnapshot }
          : null;
      if (snap) {
        const prevResume =
          snap.resume && typeof snap.resume === 'object' && !Array.isArray(snap.resume)
            ? { ...snap.resume }
            : {};
        snap.resume = {
          ...prevResume,
          fileUrl: data.fileUrl,
          fileName: data.fileName || prevResume.fileName || null,
        };
        existingExtra.phase1ProfileSnapshot = snap;
      }
      existingExtra.originalResumeUrl = data.fileUrl;
      existingExtra.originalResumeFileName = data.fileName || existingExtra.originalResumeFileName || null;
      existingExtra.resumeCvViewMode = 'original';

      await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          resume: data.fileUrl,
          resumeUrl: data.fileUrl,
          lastActivity: new Date(),
          extraData: existingExtra,
        },
      });
    }

    return file;
  },

  async delete(fileId) {
    await prisma.candidateFile.delete({ where: { id: fileId } });
    return { message: 'File deleted successfully' };
  },
};

