import { prisma } from '../../config/prisma.js';

export const jobNoteService = {
  async getAll(jobId) {
    return prisma.jobNote.findMany({
      where: { jobId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(noteId) {
    return prisma.jobNote.findUnique({
      where: { id: noteId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  },

  async create(jobId, data, createdById) {
    return prisma.jobNote.create({
      data: {
        jobId,
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
    return prisma.jobNote.update({
      where: { id: noteId },
      data: {
        title: data.title,
        content: data.content,
        tags: data.tags,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  },

  async delete(noteId) {
    await prisma.jobNote.delete({ where: { id: noteId } });
    return { message: 'Note deleted successfully' };
  },
};
