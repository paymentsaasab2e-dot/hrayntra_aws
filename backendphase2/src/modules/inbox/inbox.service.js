import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';

export const inboxService = {
  async getThreads(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { relatedEntityType, relatedEntityId, userId } = req.query;

    const where = {};
    if (relatedEntityType) where.relatedEntityType = relatedEntityType;
    if (relatedEntityId) where.relatedEntityId = relatedEntityId;
    if (userId) {
      where.participants = {
        some: { userId },
      };
    }

    const [threads, total] = await Promise.all([
      prisma.thread.findMany({
        where,
        skip,
        take: limit,
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              sender: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.thread.count({ where }),
    ]);

    return formatPaginationResponse(threads, page, limit, total);
  },

  async getThreadById(id) {
    return prisma.thread.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        messages: {
          include: {
            sender: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  async createThread(data) {
    const thread = await prisma.thread.create({
      data: {
        subject: data.subject,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
        participants: {
          create: data.participantIds.map((userId) => ({ userId })),
        },
      },
    });

    if (data.initialMessage) {
      await prisma.message.create({
        data: {
          threadId: thread.id,
          senderId: data.senderId,
          body: data.initialMessage,
          attachments: data.attachments || [],
        },
      });
    }

    return prisma.thread.findUnique({
      where: { id: thread.id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        messages: {
          include: {
            sender: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  async addMessage(threadId, data) {
    return prisma.message.create({
      data: {
        threadId,
        senderId: data.senderId,
        body: data.body,
        attachments: data.attachments || [],
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  },

  async markAsRead(threadId, userId) {
    await prisma.message.updateMany({
      where: {
        threadId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { message: 'Messages marked as read' };
  },
};
