import { resolveViewerOrgScope } from '../modules/org/org.service.js';
import { mergeWhereWithScope } from '../utils/superAdminScope.js';
import { prisma } from '../config/prisma.js';

const NONE = '000000000000000000000000';

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

/** Super Admin / tenant HQ has picked a company, or a company admin is forced onto one. */
export function isOrgCompanyScoped(scope) {
  return Boolean(scope && !scope.isTenantWide && scope.orgUnitId);
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
  const companyCount = Array.isArray(scope.companies) ? scope.companies.length : 0;
  // Forced company/site heads don't get the companies list — they still have one home.
  const onlyOneCompany = companyCount <= 1;

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
    // Single-company tenant: all leftover HQ / untagged CRM rows show here.
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
