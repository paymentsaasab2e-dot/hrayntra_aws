import { prisma } from '../../config/prisma.js';

export const leadFileService = {
  async getAll(leadId) {
    return prisma.leadFile.findMany({
      where: { leadId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(fileId) {
    return prisma.leadFile.findUnique({
      where: { id: fileId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async create(leadId, data, uploadedById) {
    return prisma.leadFile.create({
      data: {
        leadId,
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
    await prisma.leadFile.delete({ where: { id: fileId } });
    return { message: 'File deleted successfully' };
  },
};
