import { prisma } from '../config/prisma.js';
import { canViewAllAssignments, hasAnyPermission } from '../utils/permissionScope.js';
import { isSuperAdminUser } from '../utils/superAdminScope.js';
import {
  assertCanAssignTask,
  isSuperAdminUserId,
} from './taskAssignmentScope.service.js';

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

/** HQ platform roles must never appear in tenant CRM Assigned To. */
function isHqPlatformRole(roleName) {
  const n = String(roleName || '').trim().toLowerCase();
  if (!n) return false;
  return n.startsWith('hq ') || n.includes('hq platform') || n.includes('hq team');
}

function normalizeMember(user) {
  if (!user) return null;
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const name =
    user.name ||
    `${firstName} ${lastName}`.trim() ||
    user.email ||
    'User';
  const nameParts = String(name).split(/\s+/).filter(Boolean);
  const role = user.systemRole || null;
  if (isHqPlatformRole(role?.roleName)) return null;
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
  };
}

function sortMembers(members) {
  return [...members].sort((a, b) => {
    const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || '';
    const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || '';
    return nameA.localeCompare(nameB);
  });
}

/** Same visibility rule as Team → Members for Super Admin. */
function buildSuperAdminTeamMemberScope(actorUserId) {
  if (!actorUserId) return null;
  return {
    OR: [
      { id: actorUserId },
      { credential: { is: { createdBy: actorUserId } } },
    ],
  };
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
 * Matches Team → Members: tenant users only (Super Admin = self + members they created).
 * Never includes HQ platform accounts.
 */
export async function listCrmAssigneeCandidates(actorUserId, { req = null } = {}) {
  if (!actorUserId) return [];

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: memberSelect,
  });
  if (!actor || String(actor.status || '').toUpperCase() !== 'ACTIVE') return [];

  const isSuperAdmin =
    (req && isSuperAdminUser(req)) || (await isSuperAdminUserId(actorUserId));

  const viewAll =
    isSuperAdmin ||
    (req &&
      (canViewAllAssignments(req) ||
        hasAnyPermission(req, ['all', 'view_all_clients', 'view_all_leads'])));

  const actorDeptId = idStr(actor.departmentId);
  const clauses = [{ OR: [{ status: 'ACTIVE' }, { status: null }] }];

  // Super Admin: same scope as Team page (self + credentials they created).
  if (isSuperAdmin) {
    const saScope = buildSuperAdminTeamMemberScope(actorUserId);
    if (saScope) clauses.push(saScope);
  } else if (!viewAll && actorDeptId) {
    clauses.push({ departmentId: actorDeptId });
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
  const self = normalizeMember(actor);
  if (self) byId.set(self.id, self);

  return sortMembers([...byId.values()]);
}

export async function canAssignCrmTo(actorUserId, assigneeUserId, { req = null } = {}) {
  if (!actorUserId || !assigneeUserId) return false;
  const allowed = await listCrmAssigneeCandidates(actorUserId, { req });
  return allowed.some((member) => idStr(member.id) === idStr(assigneeUserId));
}

export async function assertCanAssignCrm(actorUserId, assigneeUserId, { req = null } = {}) {
  if (await isSuperAdminUserId(actorUserId)) return;
  if (
    req &&
    (canViewAllAssignments(req) ||
      hasAnyPermission(req, ['all', 'view_all_clients', 'view_all_leads']))
  ) {
    return;
  }

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

  return assertCanAssignTask(actorUserId, assigneeUserId);
}
