import { prisma } from '../config/prisma.js';
import {
  assertCanAssignTask,
  canAssignTaskTo,
  isSuperAdminUserId,
  listTaskAssigneeCandidates,
} from './taskAssignmentScope.service.js';

const idStr = (id) => String(id || '').trim();

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

export async function assertCanAssignCrm(actorUserId, assigneeUserId) {
  if (await isSuperAdminUserId(actorUserId)) return;

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
