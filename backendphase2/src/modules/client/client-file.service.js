import { prisma } from '../../config/prisma.js';

async function attachUploadedBy(files) {
  const list = Array.isArray(files) ? files : files ? [files] : [];
  if (!list.length) return Array.isArray(files) ? [] : null;

  const uploaderIds = Array.from(
    new Set(
      list
        .map((item) => item?.uploadedById)
        .filter((id) => typeof id === 'string' && id.trim().length > 0)
    )
  );

  const users = uploaderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const usersById = new Map(users.map((user) => [user.id, user]));

  const hydrated = list.map((file) => ({
    ...file,
    uploadedBy: usersById.get(file.uploadedById) || null,
  }));

  return Array.isArray(files) ? hydrated : hydrated[0] || null;
}

export const clientFileService = {
  async getAll(clientId) {
    const files = await prisma.clientFile.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
    return attachUploadedBy(files);
  },

  async getById(fileId) {
    const file = await prisma.clientFile.findUnique({
      where: { id: fileId },
    });
    return attachUploadedBy(file);
  },

  async create(clientId, data, uploadedById) {
    const file = await prisma.clientFile.create({
      data: {
        clientId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        uploadedById,
      },
    });
    return attachUploadedBy(file);
  },

  async delete(fileId) {
    await prisma.clientFile.delete({ where: { id: fileId } });
    return { message: 'File deleted successfully' };
  },
};
