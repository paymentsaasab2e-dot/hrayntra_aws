import { prisma } from '../../config/prisma.js';

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
    return prisma.candidateFile.create({
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
  },

  async delete(fileId) {
    await prisma.candidateFile.delete({ where: { id: fileId } });
    return { message: 'File deleted successfully' };
  },
};

