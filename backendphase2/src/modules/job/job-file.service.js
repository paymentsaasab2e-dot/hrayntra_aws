import { prisma } from '../../config/prisma.js';

export const jobFileService = {
  async getAll(jobId) {
    return prisma.jobFile.findMany({
      where: { jobId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(fileId) {
    return prisma.jobFile.findUnique({
      where: { id: fileId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async create(jobId, data, uploadedById) {
    return prisma.jobFile.create({
      data: {
        jobId,
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
    await prisma.jobFile.delete({ where: { id: fileId } });
    return { message: 'File deleted successfully' };
  },
};
