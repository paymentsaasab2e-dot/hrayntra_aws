import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { emitTenantActionFromActivity } from '../../utils/tenantAuditLog.js';

export const activityService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { entityType, entityId, performedById } = req.query;

    const where = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (performedById) where.performedById = performedById;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: limit,
        include: {
          performedBy: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activity.count({ where }),
    ]);

    return formatPaginationResponse(activities, page, limit, total);
  },

  async getById(id) {
    return prisma.activity.findUnique({
      where: { id },
      include: {
        performedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async create(data) {
    const activity = await prisma.activity.create({
      data: {
        action: data.action,
        description: data.description,
        performedById: data.performedById,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata,
      },
      include: {
        performedBy: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            systemRole: { select: { roleName: true } },
          },
        },
      },
    });
    emitTenantActionFromActivity(activity);
    return activity;
  },

  async delete(id) {
    await prisma.activity.delete({ where: { id } });
    return { message: 'Activity deleted successfully' };
  },
};
