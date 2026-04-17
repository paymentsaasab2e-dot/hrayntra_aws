import { prisma } from '../../config/prisma.js';

export const settingService = {
  async getAll(req) {
    const { userId, scope } = req.query;
    const where = {};
    if (userId) where.userId = userId;
    if (scope) where.scope = scope;

    return prisma.setting.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async getByKey(userId, key, scope) {
    return prisma.setting.findUnique({
      where: {
        userId_key_scope: {
          userId: userId || null,
          key,
          scope: scope || 'USER',
        },
      },
    });
  },

  async create(data) {
    return prisma.setting.create({
      data: {
        userId: data.userId,
        key: data.key,
        value: data.value,
        scope: data.scope || 'USER',
      },
    });
  },

  async update(userId, key, scope, value) {
    return prisma.setting.upsert({
      where: {
        userId_key_scope: {
          userId: userId || null,
          key,
          scope: scope || 'USER',
        },
      },
      update: { value },
      create: {
        userId: userId || null,
        key,
        value,
        scope: scope || 'USER',
      },
    });
  },

  async delete(userId, key, scope) {
    await prisma.setting.delete({
      where: {
        userId_key_scope: {
          userId: userId || null,
          key,
          scope: scope || 'USER',
        },
      },
    });
    return { message: 'Setting deleted successfully' };
  },
};
