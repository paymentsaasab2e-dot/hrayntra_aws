import { prisma } from '../config/prisma.js';
import { isSuperAdminUser } from '../utils/superAdminScope.js';
import {
  getDepartmentRoleRank,
  loadDepartmentRankMaps,
} from './departmentRole.service.js';

const idStr = (id) => String(id || '').trim();

const memberListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
  designation: true,
  avatar: true,
  departmentId: true,
  roleId: true,
  status: true,
  systemRole: {
    select: {
      id: true,
      roleName: true,
      color: true,
    },
  },
  departmentRelation: {
    select: {
      id: true,
      name: true,
    },
  },
};

function formatUserName(user) {
  const parts = [user?.firstName, user?.lastName].filter(Boolean);
  const joined = parts.join(' ').trim();
  return String(user?.name || '').trim() || joined || String(user?.email || '').trim() || 'Team member';
}

function normalizeMemberRow(member) {
  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    name: formatUserName(member),
    email: member.email,
    designation: member.designation,
    avatar: member.avatar,
    departmentId: member.departmentId,
    roleId: member.roleId,
    status: member.status,
    role: member.systemRole || null,
    department: member.departmentRelation || null,
  };
}

async function loadViewer(userId) {
  return prisma.user.findUnique({
    where: { id: idStr(userId) },
    select: {
      id: true,
      departmentId: true,
      roleId: true,
      status: true,
      isActive: true,
      systemRole: { select: { roleName: true } },
    },
  });
}

async function resolveUserRank(user, rankMaps = null) {
  if (!user?.departmentId || !user?.roleId) return null;
  const deptId = idStr(user.departmentId);
  const maps = rankMaps || (await loadDepartmentRankMaps(deptId));
  const roleId = idStr(user.roleId);
  if (maps.rankByRoleId.has(roleId)) return maps.rankByRoleId.get(roleId);

  const roleName = String(user.systemRole?.roleName || '').trim().toLowerCase();
  if (roleName && maps.rankByRoleName.has(roleName)) return maps.rankByRoleName.get(roleName);

  return getDepartmentRoleRank(deptId, roleId);
}

/**
 * Resolve which activity records a viewer may access.
 * - Super Admin: entire tenant
 * - Rank 1 dept head: self + same-department members with rank > 1
 * - Rank 2+: self only
 */
export async function resolveActivityViewerScope(viewerUserId) {
  const viewer = await loadViewer(viewerUserId);
  if (!viewer || viewer.status !== 'ACTIVE' || !viewer.isActive) {
    return {
      level: 'self',
      userIds: [],
      canViewMembers: false,
      canViewDepartments: false,
      canViewTeam: false,
      viewerRank: null,
      departmentId: null,
      departmentName: null,
    };
  }

  if (isSuperAdminUser(viewer)) {
    return {
      level: 'tenant',
      userIds: null,
      canViewMembers: true,
      canViewDepartments: true,
      canViewTeam: true,
      viewerRank: 0,
      departmentId: viewer.departmentId || null,
      departmentName: null,
    };
  }

  const viewerRank = await resolveUserRank(viewer);
  const deptId = idStr(viewer.departmentId);

  if (viewerRank === 1 && deptId) {
    const rankMaps = await loadDepartmentRankMaps(deptId);
    const members = await prisma.user.findMany({
      where: {
        departmentId: deptId,
        status: 'ACTIVE',
        isActive: true,
      },
      select: {
        id: true,
        roleId: true,
        systemRole: { select: { roleName: true } },
      },
    });

    const allowedIds = new Set([viewer.id]);
    for (const member of members) {
      const memberRank = await resolveUserRank(member, rankMaps);
      if (memberRank == null || memberRank > 1) {
        allowedIds.add(member.id);
      }
    }

    const dept = await prisma.department.findUnique({
      where: { id: deptId },
      select: { name: true },
    });

    return {
      level: 'department',
      userIds: [...allowedIds],
      canViewMembers: true,
      canViewDepartments: false,
      canViewTeam: true,
      viewerRank: 1,
      departmentId: deptId,
      departmentName: dept?.name || null,
    };
  }

  return {
    level: 'self',
    userIds: [viewer.id],
    canViewMembers: false,
    canViewDepartments: false,
    canViewTeam: false,
    viewerRank: viewerRank,
    departmentId: deptId || null,
    departmentName: null,
  };
}

export async function assertCanViewMemberActivity(viewerUserId, targetUserId) {
  const scope = await resolveActivityViewerScope(viewerUserId);
  const targetId = idStr(targetUserId);
  if (!targetId) {
    throw new Error('Member id is required');
  }
  if (scope.userIds === null) return scope;
  if (!scope.userIds.includes(targetId)) {
    throw new Error('You do not have permission to view this member\'s activity');
  }
  return scope;
}

export async function assertCanViewDepartmentActivity(viewerUserId, departmentId) {
  const scope = await resolveActivityViewerScope(viewerUserId);
  if (!scope.canViewDepartments) {
    throw new Error('You do not have permission to view department activity');
  }
  const deptId = idStr(departmentId);
  if (!deptId) {
    throw new Error('Department id is required');
  }
  return scope;
}

export async function listViewableMembers(viewerUserId) {
  const scope = await resolveActivityViewerScope(viewerUserId);
  if (!scope.canViewMembers) {
    return { scope, members: [] };
  }

  if (scope.userIds === null) {
    const rows = await prisma.user.findMany({
      where: { status: 'ACTIVE', isActive: true },
      select: memberListSelect,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return { scope, members: rows.map(normalizeMemberRow) };
  }

  if (!scope.userIds.length) {
    return { scope, members: [] };
  }

  const rows = await prisma.user.findMany({
    where: {
      id: { in: scope.userIds },
      status: 'ACTIVE',
      isActive: true,
    },
    select: memberListSelect,
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  const members = rows
    .map(normalizeMemberRow)
    .filter((member) => (scope.level === 'department' ? member.id !== idStr(viewerUserId) : true));

  return { scope, members };
}

export async function listViewableDepartments(viewerUserId) {
  const scope = await resolveActivityViewerScope(viewerUserId);
  if (!scope.canViewDepartments) {
    return { scope, departments: [] };
  }

  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          users: {
            where: { status: 'ACTIVE', isActive: true },
          },
        },
      },
    },
  });

  return {
    scope,
    departments: departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      memberCount: dept._count?.users ?? 0,
    })),
  };
}

export async function getDepartmentMemberIds(departmentId) {
  const deptId = idStr(departmentId);
  if (!deptId) return [];
  const rows = await prisma.user.findMany({
    where: {
      departmentId: deptId,
      status: 'ACTIVE',
      isActive: true,
    },
    select: { id: true },
  });
  return rows.map((row) => row.id).filter(Boolean);
}

/**
 * Apply viewer scope to an Activity where clause.
 */
export async function applyActivityVisibilityWhere(req, baseWhere = {}) {
  const viewerId = req.user?.id;
  if (!viewerId) {
    throw new Error('Unauthorized');
  }

  const scope = await resolveActivityViewerScope(viewerId);
  const {
    performedById,
    departmentId,
    scope: scopeParam,
    mine,
  } = req.query || {};

  const normalizedScope = String(scopeParam || '').trim().toLowerCase();
  const mineOnly = mine === 'true' || mine === '1' || normalizedScope === 'self';

  const where = { ...baseWhere };

  if (mineOnly) {
    where.performedById = idStr(viewerId);
    return where;
  }

  if (normalizedScope === 'tenant') {
    if (scope.level !== 'tenant') {
      throw new Error('You do not have permission to view company-wide activity');
    }
    return where;
  }

  if (normalizedScope === 'department' || departmentId) {
    const deptId = idStr(departmentId);
    if (scope.canViewDepartments) {
      await assertCanViewDepartmentActivity(viewerId, deptId);
      const memberIds = await getDepartmentMemberIds(deptId);
      where.performedById = memberIds.length ? { in: memberIds } : idStr('__none__');
      return where;
    }
    if (scope.level === 'department' && scope.departmentId === deptId) {
      const memberIds = scope.userIds || [];
      where.performedById = memberIds.length ? { in: memberIds } : idStr(viewerId);
      return where;
    }
    throw new Error('You do not have permission to view this department\'s activity');
  }

  if (normalizedScope === 'team' && scope.canViewTeam && scope.userIds?.length) {
    where.performedById = { in: scope.userIds };
    return where;
  }

  if (performedById) {
    const targetId = idStr(performedById);
    await assertCanViewMemberActivity(viewerId, targetId);
    where.performedById = targetId;
    return where;
  }

  if (scope.userIds === null) {
    return where;
  }

  if (scope.userIds.length === 1) {
    where.performedById = scope.userIds[0];
    return where;
  }

  where.performedById = { in: scope.userIds };
  return where;
}
