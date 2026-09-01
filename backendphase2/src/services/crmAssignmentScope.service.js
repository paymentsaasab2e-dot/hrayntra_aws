import { prisma } from '../config/prisma.js';
import { canViewAllAssignments, hasAnyPermission } from '../utils/permissionScope.js';
import { isSuperAdminUser } from '../utils/superAdminScope.js';
import {
  hqPlatformUserEmailNotClause,
  isHqPlatformUser,
} from '../utils/hqPlatformUser.js';
import {
  isSuperAdminUserId,
} from './taskAssignmentScope.service.js';
import {
  applyOrgCompanyUserWhere,
  canViewCrossCompanyMembers,
  labelUsersWithOrgUnit,
  requestedAssignCompanyId,
} from './orgListScope.service.js';
import {
  assertUserHasAssignmentAccess,
  filterUsersByAssignmentAccess,
  resolveAssignmentModules,
  resolveAssignmentModulesFromReq,
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
      rolePermissions: {
        select: {
          permission: { select: { permissionName: true, module: true } },
        },
      },
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
  if (!user) return null;
  if (isHqPlatformUser(user)) return null;
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const name =
    user.name ||
    `${firstName} ${lastName}`.trim() ||
    user.email ||
    'User';
  const nameParts = String(name).split(/\s+/).filter(Boolean);
  const role = user.systemRole || null;
  return {
    id: user.id,
    firstName: firstName || nameParts[0] || '',
    lastName: lastName || nameParts.slice(1).join(' ') || '',
    name,
    email: user.email,
    departmentId: user.departmentId,
    roleId: user.roleId,
    status: user.status,
    role,
    department: user.departmentRelation || null,
    orgUnitId: user.orgUnitId || null,
  };
}

function sortMembers(members) {
  return [...members].sort((a, b) => {
    const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || '';
    const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || '';
    return nameA.localeCompare(nameB);
  });
}

export function currentLeadAssigneeIds(lead) {
  const fromList = Array.isArray(lead?.assignedToIds)
    ? lead.assignedToIds.map(idStr).filter(Boolean)
    : [];
  if (fromList.length) return fromList;
  const primary = idStr(lead?.assignedToId);
  return primary ? [primary] : [];
}

export function newlyAddedAssigneeIds(previousIds, nextIds) {
  const previous = new Set((previousIds || []).map(idStr).filter(Boolean));
  return (nextIds || []).map(idStr).filter((id) => id && !previous.has(id));
}

/**
 * CRM (leads/clients) assignee list for Add Lead / Assign To.
 * Company members: only people in their own company.
 * Super Admin / view_cross_company_members: people in the requested company
 * (companyId query). No company selected → empty list.
 * Never includes HQ platform accounts or other tenants.
 * Optional `modules` (or ?module=) then keeps only users with that module access.
 */
export async function listCrmAssigneeCandidates(actorUserId, { req = null, modules = [] } = {}) {
  if (!actorUserId) return [];

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: memberSelect,
  });
  if (!actor) return [];
  const actorStatus = String(actor.status || 'ACTIVE').toUpperCase();
  if (actorStatus !== 'ACTIVE') return [];

  const isSuperAdmin =
    (req && isSuperAdminUser(req)) || (await isSuperAdminUserId(actorUserId));
  const crossCompany = Boolean(req && canViewCrossCompanyMembers(req));

  if (crossCompany && !requestedAssignCompanyId(req)) {
    return [];
  }

  const viewAll =
    isSuperAdmin ||
    (req &&
      (canViewAllAssignments(req) ||
        hasAnyPermission(req, ['all', 'view_all_clients', 'view_all_leads'])));

  const actorDeptId = idStr(actor.departmentId);
  const emailExclude = hqPlatformUserEmailNotClause();
  const clauses = [
    { OR: [{ status: 'ACTIVE' }, { status: null }] },
    ...(Object.keys(emailExclude).length ? [emailExclude] : []),
  ];

  if (isSuperAdmin || crossCompany) {
    // Selected company is applied via applyOrgCompanyUserWhere(forAssign).
  } else if (!viewAll && actorDeptId) {
    clauses.push({ departmentId: actorDeptId });
  }

  if (req) {
    const orgWhere = await applyOrgCompanyUserWhere(req, { forAssign: true });
    if (orgWhere) clauses.push(orgWhere);
  }

  const where = clauses.length === 1 ? clauses[0] : { AND: clauses };

  const rows = await prisma.user.findMany({
    where,
    select: memberSelect,
    orderBy: [{ firstName: 'asc' }, { name: 'asc' }],
  });

  const byId = new Map();
  for (const row of rows) {
    const normalized = normalizeMember(row);
    if (normalized) byId.set(normalized.id, normalized);
  }
  if (!crossCompany) {
    const self = normalizeMember(actor);
    if (self) byId.set(self.id, self);
  }

  const labeled = labelUsersWithOrgUnit(sortMembers([...byId.values()]));
  const requiredModules = resolveAssignmentModules(modules?.length ? modules : resolveAssignmentModulesFromReq(req));
  if (!requiredModules.length) return labeled;
  return filterUsersByAssignmentAccess(labeled, { modules: requiredModules });
}

export async function canAssignCrmTo(actorUserId, assigneeUserId, { req = null, modules = [] } = {}) {
  if (!actorUserId || !assigneeUserId) return false;
  const allowed = await listCrmAssigneeCandidates(actorUserId, { req, modules });
  return allowed.some((member) => idStr(member.id) === idStr(assigneeUserId));
}

export async function assertCanAssignCrm(actorUserId, assigneeUserId, { req = null, modules = [] } = {}) {
  const requiredModules = resolveAssignmentModules(
    modules?.length ? modules : resolveAssignmentModulesFromReq(req),
  );
  if (requiredModules.length) {
    await assertUserHasAssignmentAccess(assigneeUserId, { modules: requiredModules });
  }

  if (await isSuperAdminUserId(actorUserId)) return;
  if (req && canViewCrossCompanyMembers(req)) return;
  if (idStr(actorUserId) === idStr(assigneeUserId)) return;

  if (await canAssignCrmTo(actorUserId, assigneeUserId, { req, modules: requiredModules })) return;

  const [actor, assignee] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actorUserId },
      select: { departmentId: true },
    }),
    prisma.user.findUnique({
      where: { id: assigneeUserId },
      select: { departmentId: true },
    }),
  ]);

  const actorDept = idStr(actor?.departmentId);
  const assigneeDept = idStr(assignee?.departmentId);
  if (actorDept && assigneeDept && actorDept !== assigneeDept) {
    throw new Error(
      'You can only assign leads and clients within your department. Use "Hand off to another department" to transfer clients to another team.',
    );
  }

  throw new Error('You can only assign leads and clients to members in your company.');
}
