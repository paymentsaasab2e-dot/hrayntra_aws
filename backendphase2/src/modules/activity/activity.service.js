import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { presentActivityForFeed } from '../../utils/activityPresentation.js';
import { emitTenantActionFromActivity } from '../../utils/tenantAuditLog.js';
import { applyActivityVisibilityWhere,
  assertCanViewMemberActivity,
  listViewableDepartments,
  listViewableMembers,
  resolveActivityViewerScope,
} from '../../services/activityVisibility.service.js';

async function buildActivityWhere(req) {
  const {
    entityType,
    entityId,
    category,
    search,
    from,
    to,
  } = req.query || {};

  const where = {};

  if (entityType) where.entityType = String(entityType).toUpperCase();
  if (entityId) where.entityId = String(entityId);
  if (category) where.category = String(category);

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

  return applyActivityVisibilityWhere(req, where);
}

export const activityService = {
  async getCapabilities(req) {
    const scope = await resolveActivityViewerScope(req.user?.id);
    return {
      level: scope.level,
      canViewMembers: scope.canViewMembers,
      canViewDepartments: scope.canViewDepartments,
      canViewTeam: scope.canViewTeam,
      viewerRank: scope.viewerRank,
      departmentId: scope.departmentId,
      departmentName: scope.departmentName,
    };
  },

  async getViewableMembers(req) {
    const { scope, members } = await listViewableMembers(req.user?.id);
    return {
      scope: {
        level: scope.level,
        canViewMembers: scope.canViewMembers,
        canViewDepartments: scope.canViewDepartments,
        canViewTeam: scope.canViewTeam,
        viewerRank: scope.viewerRank,
        departmentId: scope.departmentId,
        departmentName: scope.departmentName,
      },
      members,
    };
  },

  async getViewableDepartments(req) {
    const { scope, departments } = await listViewableDepartments(req.user?.id);
    return {
      scope: {
        level: scope.level,
        canViewMembers: scope.canViewMembers,
        canViewDepartments: scope.canViewDepartments,
      },
      departments,
    };
  },

  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const where = await buildActivityWhere(req);

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
              departmentId: true,
              systemRole: { select: { roleName: true } },
              departmentRelation: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activity.count({ where }),
    ]);

    return formatPaginationResponse(activities.map(presentActivityForFeed), page, limit, total);
  },

  async getById(id, req) {
    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        performedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            departmentId: true,
            departmentRelation: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!activity) return null;

    if (req?.user?.id && activity.performedById) {
      await assertCanViewMemberActivity(req.user.id, activity.performedById);
    }

    return presentActivityForFeed(activity);
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
    return presentActivityForFeed(activity);
  },

  async delete(id) {
    await prisma.activity.delete({ where: { id } });
    return { message: 'Activity deleted successfully' };
  },
};
