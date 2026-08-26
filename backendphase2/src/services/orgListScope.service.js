import { resolveViewerOrgScope } from '../modules/org/org.service.js';
import { mergeWhereWithScope } from '../utils/superAdminScope.js';

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
 * Restrict lists to people in the active company/site (and descendants).
 * Super Admin keeps full module rights; only the record set is filtered.
 */
export async function applyOrgCompanyAssigneeWhere(req, options = {}) {
  const scope = await getRequestOrgScope(req);
  if (!isOrgCompanyScoped(scope)) return null;

  const ids = scope.memberIds?.length ? scope.memberIds.map(String) : [NONE];
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
  return or.length ? { OR: or } : null;
}

export async function mergeOrgCompanyListScope(where, req, options) {
  const orgWhere = await applyOrgCompanyAssigneeWhere(req, options);
  return mergeWhereWithScope(where, orgWhere);
}
