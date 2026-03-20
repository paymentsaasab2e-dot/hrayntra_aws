import { prisma } from '../../config/prisma.js';

export const clientNoteService = {
  async getAll(clientId) {
    return prisma.clientNote.findMany({
      where: { clientId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(noteId) {
    return prisma.clientNote.findUnique({
      where: { id: noteId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  },

  async create(clientId, data, createdById) {
    return prisma.clientNote.create({
      data: {
        clientId,
        title: data.title,
        content: data.content,
        tags: data.tags || [],
        createdById,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  },

  async update(noteId, data) {
    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
    
    return prisma.clientNote.update({
      where: { id: noteId },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  },

  async delete(noteId) {
    await prisma.clientNote.delete({ where: { id: noteId } });
    return { message: 'Note deleted successfully' };
  },
};
