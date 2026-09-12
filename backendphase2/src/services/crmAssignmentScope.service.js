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
  filterUsersByAssignableCompany,
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
  managerId: true,
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
  managerRelation: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
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
  const manager = user.managerRelation
    ? {
        id: user.managerRelation.id,
        firstName: user.managerRelation.firstName || '',
        lastName: user.managerRelation.lastName || '',
        name:
          user.managerRelation.name ||
          `${user.managerRelation.firstName || ''} ${user.managerRelation.lastName || ''}`.trim(),
        email: user.managerRelation.email || '',
      }
    : null;
  return {
    id: user.id,
    firstName: firstName || nameParts[0] || '',
    lastName: lastName || nameParts.slice(1).join(' ') || '',
    name,
    email: user.email,
    departmentId: user.departmentId,
    roleId: user.roleId,
    managerId: user.managerId || null,
    status: user.status,
    role,
    department: user.departmentRelation || null,
    manager,
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
 * Prefer sales-team members (Team.kind = SALES). Organization is not required
 * in the UI — Super Admin / cross-company without companyId gets the tenant
 * sales-team pool instead of an empty list.
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

  const viewAll =
    isSuperAdmin ||
    (req &&
      (canViewAllAssignments(req) ||
        hasAnyPermission(req, [
          'all',
          'view_all_clients',
          'view_all_recruitment_clients',
          'view_all_leads',
        ])));

  const actorDeptId = idStr(actor.departmentId);
  const emailExclude = hqPlatformUserEmailNotClause();
  const requestedCompany = requestedAssignCompanyId(req);
  const requiredModules = resolveAssignmentModules(
    modules?.length ? modules : resolveAssignmentModulesFromReq(req),
  );
  const clauses = [
    { OR: [{ status: 'ACTIVE' }, { status: null }] },
    ...(Object.keys(emailExclude).length ? [emailExclude] : []),
  ];

  const useCompanyWalk = Boolean((isSuperAdmin || crossCompany) && requestedCompany);
  /** Cross-company / SA with no org pick: tenant pool, then sales-team filter. */
  const tenantSalesPool = Boolean((isSuperAdmin || crossCompany) && !requestedCompany);

  if (!useCompanyWalk) {
    if (!(isSuperAdmin || crossCompany) && !viewAll && actorDeptId) {
      clauses.push({ departmentId: actorDeptId });
    }
    if (req && !tenantSalesPool) {
      const orgWhere = await applyOrgCompanyUserWhere(req, { forAssign: true });
      if (orgWhere) clauses.push(orgWhere);
    }
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

  let labeled = await labelUsersWithOrgUnit(sortMembers([...byId.values()]));
  if (useCompanyWalk) {
    const orgUnits = await prisma.orgUnit.findMany({
      select: { id: true, parentId: true },
    });
    labeled = filterUsersByAssignableCompany(labeled, requestedCompany, orgUnits);
  }
  if (!requiredModules.length) {
    return filterBySalesTeams(labeled, requestedCompany || null);
  }
  const moduleFiltered = filterUsersByAssignmentAccess(labeled, { modules: requiredModules });
  return filterBySalesTeams(moduleFiltered, requestedCompany || null);
}

async function filterBySalesTeams(members, orgUnitId = null) {
  try {
    const { getActiveSalesTeamMemberIdSet } = await import('../modules/team/team.service.js');
    const allowed = await getActiveSalesTeamMemberIdSet({ orgUnitId });
    if (!allowed) return members;
    if (!allowed.size) return [];
    return (members || []).filter((member) => allowed.has(String(member.id)));
  } catch (error) {
    console.warn('[crm-assign] sales team filter skipped:', error?.message || error);
    return members;
  }
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
