import { prisma } from '../config/prisma.js';
import { canViewAllAssignments, hasAnyPermission } from '../utils/permissionScope.js';
import {
  assertCanAssignTask,
  canAssignTaskTo,
  isSuperAdminUserId,
  listTaskAssigneeCandidates,
} from './taskAssignmentScope.service.js';

const idStr = (id) => String(id || '').trim();

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
 * CRM (leads/clients) assignees are limited to the actor's department.
 * Cross-department client transfers must use cross-department handoff requests.
 */
export async function listCrmAssigneeCandidates(actorUserId) {
  const candidates = await listTaskAssigneeCandidates(actorUserId);
  if (await isSuperAdminUserId(actorUserId)) return candidates;

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { departmentId: true },
  });
  const actorDeptId = idStr(actor?.departmentId);
  if (!actorDeptId) {
    return candidates.filter((member) => idStr(member.id) === idStr(actorUserId));
  }

  return candidates.filter(
    (member) =>
      idStr(member.id) === idStr(actorUserId) || idStr(member.departmentId) === actorDeptId,
  );
}

export async function canAssignCrmTo(actorUserId, assigneeUserId) {
  if (!actorUserId || !assigneeUserId) return false;
  const allowed = await listCrmAssigneeCandidates(actorUserId);
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

  if (idStr(actor?.departmentId) !== idStr(assignee?.departmentId)) {
    throw new Error(
      'You can only assign leads and clients within your department. Use "Hand off to another department" to transfer clients to another team.',
    );
  }

  return assertCanAssignTask(actorUserId, assigneeUserId);
}
