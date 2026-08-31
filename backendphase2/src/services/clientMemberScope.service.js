import { prisma } from '../config/prisma.js';
import { canViewAllClients } from '../utils/permissionScope.js';
import { buildSuperAdminOwnerScope, mergeWhereWithScope } from '../utils/superAdminScope.js';
import { isDepartmentHeadUser } from './departmentRole.service.js';
import { buildAssigneeVisibilityOr } from './memberVisibility.service.js';
import {
  applyOrgCompanyAssigneeWhere,
  getRequestOrgScope,
  isOrgHeadPurpose,
} from './orgListScope.service.js';

const idStr = (id) => String(id || '').trim();

/**
 * Hide the synthetic own-company “Workspace” row from CRM client lists.
 *
 * Prisma MongoDB rewrites `NOT: { OR: [industry, website startsWith] }` into
 * AND-of-NOTs. `{ website: { $not: /^tenant:\\/\\// } }` does **not** match
 * documents where website/industry is missing, so new/imported clients vanish
 * from /client. Explicitly keep unset/null fields.
 */
export function systemWorkspaceClientExclusionWhere() {
  return {
    AND: [
      {
        OR: [
          { industry: { isSet: false } },
          { industry: { equals: null } },
          { industry: { not: 'Workspace' } },
        ],
      },
      {
        OR: [
          { website: { isSet: false } },
          { website: { equals: null } },
          { NOT: { website: { startsWith: 'tenant://' } } },
        ],
      },
    ],
  };
}

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

/**
 * Restrict client lists/detail to records the actor may access:
 * - organization-wide viewers (`view_all_clients`) stay inside their company
 * - Full access of all companies / Super Admin: every company in this tenant
 * - assignee or creator
 * - department heads: any client assigned to a member of their department
 */
export async function applyMemberClientScope(scopedWhere, req) {
  if (req?._bypassClientScope) {
    return scopedWhere;
  }

  const userId = idStr(req?.user?.id);
  const orgWhere = await applyOrgCompanyAssigneeWhere(req, {
    assignedToIdField: 'assignedToId',
    createdByField: 'createdById',
  });

  if (canViewAllClients(req) || !userId) {
    return mergeWhereWithScope(scopedWhere, orgWhere);
  }

  const forwarded = {
    AND: [{ recruitmentEnabled: { equals: true } }, { participantIds: { has: userId } }],
  };

  const org = await getRequestOrgScope(req);
  if (isOrgHeadPurpose(org)) {
    return mergeWhereWithScope(scopedWhere, {
      OR: [orgWhere || { id: { not: undefined } }, forwarded],
    });
  }

  let visibility = { OR: buildAssigneeVisibilityOr(userId) };
  if (await isDepartmentHeadUser(userId)) {
    const memberIds = await listActiveDepartmentMemberIds(userId);
    if (memberIds.length) {
      visibility = {
        OR: [
          { assignedToId: { in: memberIds } },
          { createdById: userId },
          { participantIds: { has: userId } },
        ],
      };
    }
  }

  const inCompany = orgWhere ? { AND: [orgWhere, visibility] } : visibility;
  return mergeWhereWithScope(scopedWhere, {
    OR: [inCompany, forwarded],
  });
}

export async function buildClientsListScopeWhere(req) {
  let where = { isDeleted: { not: true } };
  where = {
    AND: [where, systemWorkspaceClientExclusionWhere()],
  };
  const superAdminScope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
  let scopedWhere = mergeWhereWithScope(where, superAdminScope);
  scopedWhere = await applyMemberClientScope(scopedWhere, req);
  return scopedWhere;
}
