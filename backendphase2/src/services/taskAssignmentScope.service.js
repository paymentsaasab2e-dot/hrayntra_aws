import { prisma } from '../config/prisma.js';
import { getDepartmentRoleRank } from './departmentRole.service.js';

const idStr = (id) => String(id || '').trim();

const memberSelect = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
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

function normalizeMember(user) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    email: user.email,
    departmentId: user.departmentId,
    roleId: user.roleId,
    status: user.status,
    role: user.systemRole || null,
    department: user.departmentRelation || null,
  };
}

export async function isSuperAdminUserId(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      systemRole: { select: { roleName: true } },
    },
  });
  if (!user) return false;
  const roleName = user.systemRole?.roleName || user.role || '';
  const normalized = String(roleName).trim().toUpperCase().replace(/\s+/g, '_');
  return normalized === 'SUPER_ADMIN' || normalized.replace(/_/g, '') === 'SUPERADMIN';
}

/**
 * Users the actor may assign tasks to:
 * - self (personal tasks)
 * - direct reports (Reports To = actor)
 * - same department members with a lower rank (higher rank number)
 * Super Admin: all active users
 */
export async function listTaskAssigneeCandidates(actorUserId) {
  if (!actorUserId) return [];

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: memberSelect,
  });
  if (!actor || actor.status !== 'ACTIVE') return [];

  if (await isSuperAdminUserId(actorUserId)) {
    const all = await prisma.user.findMany({
      where: { status: 'ACTIVE', isActive: true },
      select: memberSelect,
      orderBy: { firstName: 'asc' },
    });
    return all.map(normalizeMember).filter(Boolean);
  }

  const byId = new Map();
  byId.set(actor.id, normalizeMember(actor));

  const directReports = await prisma.user.findMany({
    where: {
      managerId: actorUserId,
      status: 'ACTIVE',
      isActive: true,
    },
    select: memberSelect,
  });
  for (const row of directReports) {
    byId.set(row.id, normalizeMember(row));
  }

  const actorDeptId = idStr(actor.departmentId);
  const actorRoleId = idStr(actor.roleId);
  if (actorDeptId && actorRoleId) {
    const actorRank = await getDepartmentRoleRank(actorDeptId, actorRoleId);
    if (actorRank != null) {
      const lowerRankMembers = await prisma.user.findMany({
        where: {
          departmentId: actorDeptId,
          status: 'ACTIVE',
          isActive: true,
        },
        select: memberSelect,
      });

      for (const row of lowerRankMembers) {
        const memberRank = await getDepartmentRoleRank(actorDeptId, row.roleId);
        if (memberRank != null && memberRank > actorRank) {
          byId.set(row.id, normalizeMember(row));
        }
      }
    }
  }

  return [...byId.values()].sort((a, b) => {
    const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || '';
    const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || '';
    return nameA.localeCompare(nameB);
  });
}

export async function canAssignTaskTo(actorUserId, assigneeUserId) {
  if (!actorUserId || !assigneeUserId) return false;
  if (idStr(actorUserId) === idStr(assigneeUserId)) return true;

  if (await isSuperAdminUserId(actorUserId)) return true;

  const allowed = await listTaskAssigneeCandidates(actorUserId);
  return allowed.some((m) => idStr(m.id) === idStr(assigneeUserId));
}

export async function assertCanAssignTask(actorUserId, assigneeUserId) {
  const ok = await canAssignTaskTo(actorUserId, assigneeUserId);
  if (!ok) {
    throw new Error(
      'You can only assign tasks to yourself, your direct reports, or lower-ranked members in your department. Super Admin can assign to anyone.',
    );
  }
}
