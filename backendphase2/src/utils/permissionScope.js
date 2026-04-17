import { isSuperAdminUser } from './superAdminScope.js';

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

export function canViewAllAssignments(req) {
  if (isSuperAdminUser(req) || req?.userWithPermissions?.isSuperAdmin) return true;
  return hasAnyPermission(req, ['system_select_all', 'manage_settings', 'assign_roles']);
}
