import { isSuperAdminUser, isSuperAdminOwnWork } from './superAdminScope.js';

function getUserPermissions(req) {
  const permissions = req?.userWithPermissions?.permissions || req?.user?.permissions || [];
  return Array.isArray(permissions) ? permissions.map((permission) => String(permission)) : [];
}

export function hasPermission(req, permissionName) {
  const permissions = getUserPermissions(req);
  return permissions.includes('all') || permissions.includes(permissionName);
}

export function hasAnyPermission(req, permissionNames = []) {
  const permissions = getUserPermissions(req);
  if (permissions.includes('all')) return true;
  return permissionNames.some((permissionName) => permissions.includes(permissionName));
}

function isFullAccessUser(req) {
  return Boolean(isSuperAdminUser(req) || req?.userWithPermissions?.isSuperAdmin);
}

/** Client/lead Agreements & Terms section — hide from roles without this permission. */
export function canViewAgreementTerms(req) {
  if (isFullAccessUser(req)) return true;
  return hasAnyPermission(req, ['agreements_read', 'agreements_manage']);
}

export function canManageAgreementTerms(req) {
  if (isFullAccessUser(req)) return true;
  return hasPermission(req, 'agreements_manage');
}

/** Tenant-wide CRM lists: Super Admin, system_select_all, manage_settings — not assign_roles (use view_all_* instead). */
export function canViewAllAssignments(req) {
  if (isSuperAdminOwnWork(req)) return false;
  if (isSuperAdminUser(req) || req?.userWithPermissions?.isSuperAdmin) return true;
  return hasAnyPermission(req, ['system_select_all', 'manage_settings']);
}

/**
 * See jobs/leads/clients/candidates across every company in this tenant.
 * Without this, View all (jobs/leads/clients/candidates) is limited to the
 * member’s own organization. Super Admin has this; manage_settings does not.
 */
export function canViewAllCompanies(req) {
  if (isSuperAdminOwnWork(req)) return false;
  if (isSuperAdminUser(req) || req?.userWithPermissions?.isSuperAdmin) return true;
  return hasPermission(req, 'view_all_companies');
}

export function canViewAllClients(req) {
  if (isSuperAdminOwnWork(req)) return false;
  return canViewAllAssignments(req) || hasAnyPermission(req, ['view_all_clients']);
}

export function canViewAllLeads(req) {
  if (isSuperAdminOwnWork(req)) return false;
  return canViewAllAssignments(req) || hasAnyPermission(req, ['view_all_leads']);
}

export function canViewAllJobs(req) {
  if (isSuperAdminOwnWork(req)) return false;
  return canViewAllAssignments(req) || hasAnyPermission(req, ['view_all_jobs']);
}

export function canViewAllCandidates(req) {
  if (isSuperAdminOwnWork(req)) return false;
  return canViewAllAssignments(req) || hasAnyPermission(req, ['view_all_candidates']);
}
