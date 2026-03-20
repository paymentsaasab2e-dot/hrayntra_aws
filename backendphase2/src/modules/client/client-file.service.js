import { prisma } from '../../config/prisma.js';

export const clientFileService = {
  async getAll(clientId) {
    return prisma.clientFile.findMany({
      where: { clientId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(fileId) {
    return prisma.clientFile.findUnique({
      where: { id: fileId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async create(clientId, data, uploadedById) {
    return prisma.clientFile.create({
      data: {
        clientId,
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
    await prisma.clientFile.delete({ where: { id: fileId } });
    return { message: 'File deleted successfully' };
  },
};
