import { prisma } from '../config/prisma.js';
import {
  canViewAllCrmClients,
  canViewAllRecruitmentClients,
} from '../utils/permissionScope.js';
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

export function recruitmentClientMatchWhere() {
  return {
    OR: [
      { recruitmentEnabled: { equals: true } },
      { createdInRecruitment: { equals: true } },
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

async function buildMemberVisibilityWhere(userId) {
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
  return visibility;
}

/**
 * Restrict client lists/detail to records the actor may access.
 *
 * CRM and Recruitment “view all” are independent:
 * - `view_all_clients` → all CRM clients in the org (not recruitment-native)
 * - `view_all_recruitment_clients` → all company recruitment clients
 * - Without those: assignee / creator / participant (and forwarded recruitment)
 *
 * @param {object} scopedWhere
 * @param {object} req
 * @param {{ listMode?: 'crm' | 'recruitment' | 'any' }} [options]
 */
export async function applyMemberClientScope(scopedWhere, req, options = {}) {
  if (req?._bypassClientScope) {
    return scopedWhere;
  }

  const listMode = options.listMode === 'recruitment' || options.listMode === 'crm'
    ? options.listMode
    : options.recruitmentOnly === true
      ? 'recruitment'
      : 'any';

  const userId = idStr(req?.user?.id);
  const viewAllCrm = canViewAllCrmClients(req);
  const viewAllRecruitment = canViewAllRecruitmentClients(req);
  const orgWhere = await applyOrgCompanyAssigneeWhere(req, {
    assignedToIdField: 'assignedToId',
    createdByField: 'createdById',
    // Company members with “all company recruitment clients” also see
    // Super Admin–created rows that were never stamped with orgUnitId.
    includeAllUntagged: listMode === 'recruitment' && viewAllRecruitment,
  });

  if (listMode === 'recruitment' && (viewAllRecruitment || !userId)) {
    return mergeWhereWithScope(scopedWhere, orgWhere);
  }

  if (listMode === 'crm' && (viewAllCrm || !userId)) {
    return mergeWhereWithScope(scopedWhere, orgWhere);
  }

  if (listMode === 'any' && ((viewAllCrm && viewAllRecruitment) || !userId)) {
    return mergeWhereWithScope(scopedWhere, orgWhere);
  }

  const org = await getRequestOrgScope(req);
  if (isOrgHeadPurpose(org)) {
    const forwarded = userId
      ? {
          AND: [{ recruitmentEnabled: { equals: true } }, { participantIds: { has: userId } }],
        }
      : null;
    return mergeWhereWithScope(scopedWhere, {
      OR: [orgWhere || { id: { not: undefined } }, ...(forwarded ? [forwarded] : [])],
    });
  }

  const orBranches = [];

  if (listMode !== 'recruitment' && viewAllCrm) {
    const crmAll = { createdInRecruitment: { not: true } };
    orBranches.push(orgWhere ? { AND: [orgWhere, crmAll] } : crmAll);
  }

  if (listMode !== 'crm' && viewAllRecruitment) {
    const recruitmentAll = recruitmentClientMatchWhere();
    orBranches.push(orgWhere ? { AND: [orgWhere, recruitmentAll] } : recruitmentAll);
  }

  if (userId) {
    const visibility = await buildMemberVisibilityWhere(userId);
    const inCompany = orgWhere ? { AND: [orgWhere, visibility] } : visibility;
    orBranches.push(inCompany);
    orBranches.push({
      AND: [{ recruitmentEnabled: { equals: true } }, { participantIds: { has: userId } }],
    });
  } else if (orgWhere) {
    orBranches.push(orgWhere);
  }

  if (!orBranches.length) {
    return mergeWhereWithScope(scopedWhere, orgWhere || { id: { in: [] } });
  }

  return mergeWhereWithScope(scopedWhere, { OR: orBranches });
}

export async function buildClientsListScopeWhere(req, options = {}) {
  let where = { isDeleted: { not: true } };
  where = {
    AND: [where, systemWorkspaceClientExclusionWhere()],
  };
  const superAdminScope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
  let scopedWhere = mergeWhereWithScope(where, superAdminScope);
  scopedWhere = await applyMemberClientScope(scopedWhere, req, options);
  return scopedWhere;
}
