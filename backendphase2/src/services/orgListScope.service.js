import {
  ACTIVE_ORG_COMPANY_WHERE,
  collectDescendantIds,
  resolveViewerOrgScope,
} from '../modules/org/org.service.js';
import { mergeWhereWithScope, isSuperAdminUser } from '../utils/superAdminScope.js';
import { hasPermission } from '../utils/permissionScope.js';
import { prisma } from '../config/prisma.js';

const NONE = '000000000000000000000000';

export const VIEW_CROSS_COMPANY_MEMBERS = 'view_cross_company_members';
export const VIEW_CROSS_COMPANY_MEMBERS_ALIAS = 'VIEW_CROSS_COMPANY_MEMBERS';

export async function getRequestOrgScope(req) {
  try {
    return await resolveViewerOrgScope(req);
  } catch {
    return null;
  }
}

export function isOrgHeadPurpose(scope) {
  const purpose = String(scope?.hierarchyPurpose || '');
  return purpose === 'company_head' || purpose === 'site_head';
}

/** Super Admin / tenant HQ has picked a company, a company admin is forced onto one,
 *  or Switch companies granted a subset of organizations (including none). */
export function isOrgCompanyScoped(scope) {
  if (!scope || scope.isTenantWide) return false;
  if (scope.orgUnitId) return true;
  if (Array.isArray(scope.unitIds) && scope.unitIds.length) return true;
  return Boolean(scope.restrictToSelectedCompanies);
}

/** Super Admin, or a role granted View Members Across Companies (same tenant only). */
export function canViewCrossCompanyMembers(req) {
  if (!req) return false;
  return Boolean(
    isSuperAdminUser(req) ||
      hasPermission(req, VIEW_CROSS_COMPANY_MEMBERS) ||
      hasPermission(req, VIEW_CROSS_COMPANY_MEMBERS_ALIAS),
  );
}

/** @deprecated use canViewCrossCompanyMembers(req) */
export function canAssignAcrossOrgUnits(scope) {
  return Boolean(scope?.canSwitchCompanies);
}

export function requestedAssignCompanyId(req) {
  return String(req?.query?.companyId || req?.query?.orgUnitId || '').trim();
}

/** Prefer first+last name, then name, then email — never a raw user id. */
export function formatUserDisplayName(user) {
  if (!user) return '';
  const id = String(user.id || '').trim();
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const named = String(user.name || '').trim();
  const email = String(user.email || '').trim();
  const pick = full || named || email;
  if (!pick) return '';
  if (id && pick === id) return email && email !== id ? email : '';
  if (/^[a-f\d]{24}$/i.test(pick) && !full) return email && email !== pick ? email : '';
  return pick;
}

/** Walk site → company so Select Company can preselect the assignee's organization. */
export async function resolveAssignableCompanyIdFromOrgUnitId(orgUnitId) {
  let currentId = String(orgUnitId || '').trim();
  const seen = new Set();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const unit = await prisma.orgUnit.findUnique({
      where: { id: currentId },
      select: { id: true, parentId: true, levelOrder: true, isLeaf: true, status: true },
    });
    if (!unit) return null;
    const active = String(unit.status || 'active').toLowerCase() === 'active';
    if (active && Number(unit.levelOrder) === 2 && unit.isLeaf === false) {
      return String(unit.id);
    }
    currentId = unit.parentId ? String(unit.parentId) : '';
  }
  return null;
}

export async function decorateAssigneeUser(user) {
  if (!user) return user;
  const assignCompanyId = await resolveAssignableCompanyIdFromOrgUnitId(user.orgUnitId);
  return {
    ...user,
    name: formatUserDisplayName(user) || user.name || '',
    assignCompanyId: assignCompanyId || null,
  };
}

/**
 * Companies in this tenant for Super Admin / cross-company assignment pickers.
 * Never returns units from another tenant (tenant DB isolation).
 */
export async function listAssignableCompanies(req) {
  if (!canViewCrossCompanyMembers(req)) return [];
  const companies = await prisma.orgUnit.findMany({
    where: ACTIVE_ORG_COMPANY_WHERE,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, isLeaf: true },
  });
  return companies.map((unit) => ({
    id: String(unit.id),
    name: unit.name,
    kind: 'company',
  }));
}

/** Reject company ids that do not exist in the current tenant database. */
export async function assertTenantOrgUnitId(unitId) {
  const id = String(unitId || '').trim();
  if (!id) return null;
  const unit = await prisma.orgUnit.findFirst({
    where: { id, status: 'active' },
    select: { id: true },
  });
  if (!unit) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return String(unit.id);
}

/**
 * Company / site id to stamp on new CRM/recruitment rows when Super Admin (or a
 * company head) is operating inside a selected org unit.
 */
export async function resolveWriteOrgUnitId(req) {
  const scope = await getRequestOrgScope(req);
  if (!isOrgCompanyScoped(scope)) return null;
  return String(scope.orgUnitId);
}

function buildPeopleOr(ids, options) {
  const {
    assignedToIdField = 'assignedToId',
    assignedToIdsField = null,
    createdByField = 'createdById',
    extraHasField = null,
    extraIdField = null,
  } = options;
  const or = [];
  if (assignedToIdField) or.push({ [assignedToIdField]: { in: ids } });
  if (extraIdField) or.push({ [extraIdField]: { in: ids } });
  if (createdByField) or.push({ [createdByField]: { in: ids } });
  if (assignedToIdsField) {
    for (const id of ids) or.push({ [assignedToIdsField]: { has: id } });
  }
  if (extraHasField) {
    for (const id of ids) or.push({ [extraHasField]: { has: id } });
  }
  return or;
}

function untaggedOrgUnitClause(orgUnitField, hqRootId) {
  const parts = [
    { [orgUnitField]: null },
    { [orgUnitField]: { isSet: false } },
  ];
  if (hqRootId) parts.push({ [orgUnitField]: hqRootId });
  return { OR: parts };
}

async function userWhereForUnit(unitId, { includeUntagged = false } = {}) {
  const unitIds = await collectDescendantIds(unitId);
  const ids = unitIds.length ? unitIds.map(String) : [NONE];
  const or = [{ orgUnitId: { in: ids } }];
  if (includeUntagged) {
    let hqRootId = null;
    try {
      const root = await prisma.orgUnit.findFirst({
        where: { parentId: null },
        select: { id: true },
      });
      hqRootId = root ? String(root.id) : null;
    } catch {
      hqRootId = null;
    }
    or.push(untaggedOrgUnitClause('orgUnitId', hqRootId));
  }
  return { OR: or };
}

function emptyUserWhere() {
  return { id: { in: [NONE] } };
}

/**
 * How many L2 companies exist in this tenant.
 * Do not use `scope.companies.length` — that array is empty for non-switchers
 * and was treating every org member as “only one company”, which leaked HQ /
 * untagged tenant rows into their lists.
 */
function tenantCompanyCount(scope) {
  const counted = Number(scope?.companyCount);
  if (Number.isFinite(counted) && counted >= 0) return counted;
  if (scope?.hasCompanies) return 2;
  return Array.isArray(scope?.companies) ? scope.companies.length : 0;
}

/** Label assignable people with company/branch when the tenant has more than one company. */
export async function labelUsersWithOrgUnit(members) {
  if (!Array.isArray(members) || members.length === 0) return members;

  const ids = [
    ...new Set(members.map((m) => m.orgUnitId).filter(Boolean).map(String)),
  ];
  if (!ids.length) return members;

  const [units, companyCount] = await Promise.all([
    prisma.orgUnit.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, isLeaf: true },
    }),
    prisma.orgUnit.count({
      where: ACTIVE_ORG_COMPANY_WHERE,
    }),
  ]);
  const byId = new Map(units.map((u) => [String(u.id), u]));
  const showCompany = companyCount > 1;

  return members.map((member) => {
    const unit = member.orgUnitId ? byId.get(String(member.orgUnitId)) : null;
    const orgUnit = unit
      ? {
          id: String(unit.id),
          name: unit.name,
          kind: unit.isLeaf ? 'branch' : 'company',
        }
      : null;
    const alreadyLabeled =
      orgUnit?.name && String(member.name || '').includes(orgUnit.name);
    const name =
      showCompany && orgUnit?.name && !alreadyLabeled
        ? `${member.name} · ${orgUnit.name}`
        : member.name;
    return { ...member, name, orgUnit };
  });
}

/**
 * Restrict lists to the active company/site tree.
 * Primary filter: record.orgUnitId in selected unit + descendants.
 * Legacy: untagged / HQ rows owned by people in that company.
 * If this tenant has only one company, untagged/HQ rows belong to that company
 * (covers Super Admin–owned leads that were never stamped).
 * Empty second companies stay empty until data is stamped or created there.
 */
export async function applyOrgCompanyAssigneeWhere(req, options = {}) {
  const scope = await getRequestOrgScope(req);
  if (!isOrgCompanyScoped(scope)) return null;

  const {
    orgUnitField = 'orgUnitId',
    ...peopleOptions
  } = options;

  const unitIds = scope.unitIds?.length ? scope.unitIds.map(String) : [NONE];
  const memberIds = scope.memberIds?.length ? scope.memberIds.map(String) : [];
  const companyCount = tenantCompanyCount(scope);
  const onlyOneCompany = companyCount === 1;

  let hqRootId = null;
  try {
    const root = await prisma.orgUnit.findFirst({
      where: { parentId: null },
      select: { id: true },
    });
    hqRootId = root ? String(root.id) : null;
  } catch {
    hqRootId = null;
  }

  const or = [];

  if (orgUnitField) {
    or.push({ [orgUnitField]: { in: unitIds } });
  }

  if (orgUnitField && onlyOneCompany) {
    or.push(untaggedOrgUnitClause(orgUnitField, hqRootId));
  } else if (orgUnitField && memberIds.length) {
    const peopleOr = buildPeopleOr(memberIds, peopleOptions);
    if (peopleOr.length) {
      or.push({
        AND: [untaggedOrgUnitClause(orgUnitField, hqRootId), { OR: peopleOr }],
      });
    }
  } else if (!orgUnitField && memberIds.length) {
    const peopleOr = buildPeopleOr(memberIds, peopleOptions);
    if (peopleOr.length) or.push(...peopleOr);
  }

  if (!or.length) {
    return orgUnitField
      ? { [orgUnitField]: { in: [NONE] } }
      : { OR: [{ [peopleOptions.assignedToIdField || 'assignedToId']: { in: [NONE] } }] };
  }

  return { OR: or };
}

export async function mergeOrgCompanyListScope(where, req, options) {
  const orgWhere = await applyOrgCompanyAssigneeWhere(req, options);
  return mergeWhereWithScope(where, orgWhere);
}

/**
 * Restrict a user (team member) list to one company in this tenant.
 *
 * Assignment (forAssign):
 *   - Normal users: always their home company (query companyId is ignored).
 *   - Super Admin / view_cross_company_members: members of the requested
 *     company only. No companyId → empty list (UI must pick a company first).
 *
 * Team directory:
 *   - Without the cross-company permission: home company only.
 *   - Super Admin / cross-company: follow the workspace company selector.
 */
export async function applyOrgCompanyUserWhere(req, { forAssign = false } = {}) {
  const scope = await getRequestOrgScope(req);
  const cross = canViewCrossCompanyMembers(req);
  const homeId = String(scope?.homeOrgUnitId || scope?.orgUnitId || '').trim();
  const companyCount = tenantCompanyCount(scope);

  if (forAssign) {
    if (cross) {
      const hasCompanies = Boolean(scope?.hasCompanies);
      if (!hasCompanies) return null;
      const requested = requestedAssignCompanyId(req);
      if (!requested) return emptyUserWhere();
      const unitId = await assertTenantOrgUnitId(requested);
      return userWhereForUnit(unitId, { includeUntagged: true });
    }
    if (homeId) {
      return userWhereForUnit(homeId, {
        includeUntagged: companyCount === 1 && !scope?.homeOrgUnitId,
      });
    }
    const selfId = String(req?.user?.id || '').trim();
    return { id: { in: selfId ? [selfId] : [NONE] } };
  }

  if (!cross) {
    if (homeId) {
      return userWhereForUnit(homeId, { includeUntagged: companyCount === 1 });
    }
    const selfId = String(req?.user?.id || '').trim();
    return { id: { in: selfId ? [selfId] : [NONE] } };
  }

  if (!isOrgCompanyScoped(scope)) return null;

  const unitIds = scope.unitIds?.length ? scope.unitIds.map(String) : [NONE];
  const or = [{ orgUnitId: { in: unitIds } }];
  if (companyCount === 1) {
    let hqRootId = null;
    try {
      const root = await prisma.orgUnit.findFirst({
        where: { parentId: null },
        select: { id: true },
      });
      hqRootId = root ? String(root.id) : null;
    } catch {
      hqRootId = null;
    }
    or.push(untaggedOrgUnitClause('orgUnitId', hqRootId));
  }

  return { OR: or };
}

export async function mergeOrgCompanyUserScope(where, req) {
  const orgWhere = await applyOrgCompanyUserWhere(req);
  return mergeWhereWithScope(where, orgWhere);
}
