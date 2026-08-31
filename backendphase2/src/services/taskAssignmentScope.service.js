import { prisma } from '../config/prisma.js';
import { getDepartmentRoleRank, isDepartmentHeadUser } from './departmentRole.service.js';
import {
  excludeHqPlatformUsers,
  hqPlatformUserEmailNotClause,
  isHqPlatformUser,
} from '../utils/hqPlatformUser.js';
import { labelUsersWithOrgUnit, applyOrgCompanyUserWhere, canViewCrossCompanyMembers, requestedAssignCompanyId } from './orgListScope.service.js';
import {
  assertUserHasAssignmentAccess,
  filterUsersByAssignmentAccess,
} from './assigneeModuleAccess.service.js';

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
  orgUnitId: true,
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
  credential: {
    select: {
      loginId: true,
    },
  },
};

function normalizeMember(user) {
  if (!user || isHqPlatformUser(user)) return null;
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
    orgUnitId: user.orgUnitId || null,
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
 * - direct reports in the same department (Reports To = actor)
 * - same department members with a lower rank (higher rank number)
 * Super Admin / view_cross_company_members: active members of the selected company
 */
export async function listTaskAssigneeCandidates(actorUserId, { req = null } = {}) {
  if (!actorUserId) return [];

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: memberSelect,
  });
  if (!actor || actor.status !== 'ACTIVE') return [];

  const orgWhere = req ? await applyOrgCompanyUserWhere(req, { forAssign: true }) : null;
  const crossCompany = Boolean(req && canViewCrossCompanyMembers(req));

  if (crossCompany && !requestedAssignCompanyId(req)) {
    return [];
  }

  if ((await isSuperAdminUserId(actorUserId)) || crossCompany) {
    const all = await prisma.user.findMany({
      where: {
        AND: [
          { status: 'ACTIVE' },
          { isActive: true },
          hqPlatformUserEmailNotClause(),
          ...(orgWhere ? [orgWhere] : []),
        ].filter((clause) => clause && Object.keys(clause).length),
      },
      select: memberSelect,
      orderBy: { firstName: 'asc' },
    });
    return filterUsersByAssignmentAccess(
      labelUsersWithOrgUnit(
        excludeHqPlatformUsers(all).map(normalizeMember).filter(Boolean),
      ),
      { modules: ['Tasks'] },
    );
  }

  const actorDeptId = idStr(actor.departmentId);
  const byId = new Map();
  byId.set(actor.id, normalizeMember(actor));

  if (!actorDeptId) {
    return filterUsersByAssignmentAccess(
      labelUsersWithOrgUnit([normalizeMember(actor)].filter(Boolean)),
      { modules: ['Tasks'] },
    );
  }

  const deptWhere = {
    departmentId: actorDeptId,
    status: 'ACTIVE',
    isActive: true,
    ...(orgWhere || {}),
  };

  const directReports = await prisma.user.findMany({
    where: {
      managerId: actorUserId,
      ...deptWhere,
    },
    select: memberSelect,
  });
  for (const row of directReports) {
    byId.set(row.id, normalizeMember(row));
  }

  const actorRoleId = idStr(actor.roleId);
  if (actorRoleId) {
    const actorRank = await getDepartmentRoleRank(actorDeptId, actorRoleId);
    if (actorRank != null) {
      const lowerRankMembers = await prisma.user.findMany({
        where: deptWhere,
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

  return filterUsersByAssignmentAccess(
    labelUsersWithOrgUnit(
      [...byId.values()]
        .filter(
          (member) =>
            idStr(member.id) === idStr(actorUserId) || idStr(member.departmentId) === actorDeptId,
        )
        .sort((a, b) => {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || '';
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || '';
          return nameA.localeCompare(nameB);
        }),
    ),
    { modules: ['Tasks'] },
  );
}

export async function canAssignTaskTo(actorUserId, assigneeUserId) {
  if (!actorUserId || !assigneeUserId) return false;
  if (idStr(actorUserId) === idStr(assigneeUserId)) return true;

  if (await isSuperAdminUserId(actorUserId)) return true;

  const allowed = await listTaskAssigneeCandidates(actorUserId);
  return allowed.some((m) => idStr(m.id) === idStr(assigneeUserId));
}

export async function assertCanAssignTask(actorUserId, assigneeUserId) {
  await assertUserHasAssignmentAccess(assigneeUserId, { modules: ['Tasks'] });
  const ok = await canAssignTaskTo(actorUserId, assigneeUserId);
  if (!ok) {
    throw new Error(
      'You can only assign tasks to yourself or lower-ranked members in your department. Super Admin can assign to anyone.',
    );
  }
}

/**
 * Department heads and members who can assign to lower-ranked peers may set themselves
 * as completion approver when delegating (even if they did not create the task).
 */
export async function canSetSelfAsTaskCompletionApprover(userId) {
  if (!userId) return false;
  if (await isSuperAdminUserId(userId)) return true;
  if (await isDepartmentHeadUser(userId)) return true;

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, departmentId: true, roleId: true, status: true },
  });
  if (!actor || actor.status !== 'ACTIVE') return false;

  const actorDeptId = idStr(actor.departmentId);
  const actorRoleId = idStr(actor.roleId);
  if (!actorDeptId || !actorRoleId) return false;

  const actorRank = await getDepartmentRoleRank(actorDeptId, actorRoleId);
  if (actorRank == null) return false;

  const deptMembers = await prisma.user.findMany({
    where: { departmentId: actorDeptId, status: 'ACTIVE', isActive: true },
    select: { id: true, roleId: true },
  });

  for (const member of deptMembers) {
    if (idStr(member.id) === idStr(userId)) continue;
    const memberRank = await getDepartmentRoleRank(actorDeptId, member.roleId);
    if (memberRank != null && memberRank > actorRank) {
      return true;
    }
  }

  return false;
}

export async function assertCanSetSelfAsTaskCompletionApprover(userId) {
  const ok = await canSetSelfAsTaskCompletionApprover(userId);
  if (!ok) {
    throw new Error(
      'Only department heads or members who can assign to lower-ranked colleagues can verify completion themselves.',
    );
  }
}

export async function assertValidTaskCompletionApprover(actorUserId, approverUserId, assigneeUserId) {
  const approverId = idStr(approverUserId);
  const assigneeId = idStr(assigneeUserId);
  if (!approverId) return;

  if (approverId === assigneeId) {
    throw new Error('Completion approver must be different from the task assignee');
  }

  const approver = await prisma.user.findFirst({
    where: { id: approverId, status: 'ACTIVE', isActive: true },
    select: { id: true },
  });
  if (!approver) {
    throw new Error('Completion approver must be an active team member');
  }

  if (approverId === idStr(actorUserId)) {
    await assertCanSetSelfAsTaskCompletionApprover(actorUserId);
    return;
  }
}
