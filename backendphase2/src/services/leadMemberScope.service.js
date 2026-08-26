import { prisma } from '../config/prisma.js';
import { canViewAllLeads } from '../utils/permissionScope.js';
import { mergeWhereWithScope } from '../utils/superAdminScope.js';
import { isDepartmentHeadUser } from './departmentRole.service.js';
import {
  getRequestOrgScope,
  isOrgHeadPurpose,
  mergeOrgCompanyListScope,
} from './orgListScope.service.js';

const idStr = (id) => String(id || '').trim();

async function listActiveDepartmentMemberIds(userId) {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });
  const departmentId = idStr(actor?.departmentId);
  if (!departmentId) return [];

  const members = await prisma.user.findMany({
    where: {
      departmentId,
      status: 'ACTIVE',
      isActive: true,
    },
    select: { id: true },
  });
  return members.map((member) => member.id).filter(Boolean);
}

function buildAssigneeOrForUser(userId) {
  return [
    { assignedToId: userId },
    { assignedToIds: { has: userId } },
    { createdBy: userId },
  ];
}

function buildDeptMemberLeadOr(memberIds, headUserId) {
  const or = [
    { assignedToId: { in: memberIds } },
    { createdBy: headUserId },
  ];
  for (const memberId of memberIds) {
    or.push({ assignedToIds: { has: memberId } });
  }
  return or;
}

/**
 * Restrict lead lists/detail to records the actor may access:
 * - tenant-wide viewers (`view_all_leads`, super admin, etc.)
 * - assignee or creator
 * - department heads: leads assigned to any member of their department
 */
export async function applyMemberLeadScope(scopedWhere, req) {
  if (req?._bypassLeadScope) {
    return scopedWhere;
  }

  scopedWhere = await mergeOrgCompanyListScope(scopedWhere, req, {
    assignedToIdField: 'assignedToId',
    assignedToIdsField: 'assignedToIds',
    createdByField: 'createdBy',
  });

  if (canViewAllLeads(req) || !req?.user?.id) {
    return scopedWhere;
  }

  const org = await getRequestOrgScope(req);
  if (isOrgHeadPurpose(org)) {
    return scopedWhere;
  }

  const userId = idStr(req.user.id);

  if (await isDepartmentHeadUser(userId)) {
    const memberIds = await listActiveDepartmentMemberIds(userId);
    if (memberIds.length) {
      return mergeWhereWithScope(scopedWhere, {
        OR: buildDeptMemberLeadOr(memberIds, userId),
      });
    }
  }

  return mergeWhereWithScope(scopedWhere, {
    OR: buildAssigneeOrForUser(userId),
  });
}

export async function buildLeadAccessWhere(id, req) {
  return applyMemberLeadScope({ id }, req);
}
