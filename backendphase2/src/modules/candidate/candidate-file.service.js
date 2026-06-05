import { prisma } from '../../config/prisma.js';

function isResumeFileType(fileType) {
  return /^resume$/i.test(String(fileType || '').trim());
}

function looksLikePdfResume(file) {
  const url = String(file?.fileUrl || '');
  const name = String(file?.fileName || '');
  if (/\.pdf($|[?#])/i.test(url) || /\.pdf$/i.test(name)) return true;
  if (isResumeFileType(file?.fileType)) return true;
  return /\/resumes\/|\/cv-files\//i.test(url);
}

/** Latest uploaded resume file URL for a candidate (Files tab / primary resume). */
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
    if (isResumeFileType(file.fileType)) return url;
  }

  for (const file of files) {
    const url = String(file?.fileUrl || '').trim();
    if (!url || url === skipUrl) continue;
    if (looksLikePdfResume(file)) return url;
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

    return file;
  },

  async delete(fileId) {
    await prisma.candidateFile.delete({ where: { id: fileId } });
    return { message: 'File deleted successfully' };
  },
};

