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
    }
    // Resume / CV rows must NOT auto-replace Original CV (v1).
    // Use uploadCandidateFile with replacePrimary=true|false for replace vs add version.

    return file;
  },

  async delete(fileId) {
    await prisma.candidateFile.delete({ where: { id: fileId } });
    return { message: 'File deleted successfully' };
  },
};

