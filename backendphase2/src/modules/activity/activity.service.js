import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { emitTenantActionFromActivity } from '../../utils/tenantAuditLog.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';

function buildActivityWhere(req) {
  const {
    entityType,
    entityId,
    performedById,
    category,
    search,
    from,
    to,
    mine,
  } = req.query || {};

  const where = {};

  if (entityType) where.entityType = String(entityType).toUpperCase();
  if (entityId) where.entityId = String(entityId);
  if (category) where.category = String(category);
  if (performedById) where.performedById = String(performedById);

  const mineOnly = mine === 'true' || mine === '1';
  if (mineOnly && req.user?.id) {
    where.performedById = req.user.id;
  } else if (!isSuperAdminUser(req) && req.user?.id && !performedById && !entityId) {
    // Regular members see their own actions on the company feed unless a filter is set.
    where.performedById = req.user.id;
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  if (search) {
    const term = String(search).trim();
    if (term) {
      where.OR = [
        { action: { contains: term } },
        { description: { contains: term } },
        { relatedLabel: { contains: term } },
      ];
    }
  }

  return where;
}

export const activityService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const where = buildActivityWhere(req);

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: limit,
        include: {
          performedBy: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              systemRole: { select: { roleName: true } },
            },
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
          select: { id: true, name: true, email: true, avatar: true },
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
        category: data.category,
        relatedType: data.relatedType,
        relatedLabel: data.relatedLabel,
        relatedId: data.relatedId,
        metadata: data.metadata,
        clientId: data.clientId,
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
