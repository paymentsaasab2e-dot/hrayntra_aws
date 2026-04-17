import { prisma } from '../../config/prisma.js';

export const interviewFileService = {
  async getAll(interviewId) {
    return prisma.interviewFile.findMany({
      where: { interviewId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(fileId) {
    return prisma.interviewFile.findUnique({
      where: { id: fileId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async create(interviewId, data, uploadedById) {
    return prisma.interviewFile.create({
      data: {
        interviewId,
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
    await prisma.interviewFile.delete({ where: { id: fileId } });
    return { message: 'File deleted successfully' };
  },
};
