/**
 * Legacy permission names still stored on older roles / used in routes.
 * Any name in a group satisfies a check for any other name in the same group.
 */
export const PERMISSION_ALIAS_GROUPS = [
  ['jobs_create', 'create_job'],
  ['jobs_read', 'view_jobs'],
  ['jobs_update', 'edit_job'],
  ['jobs_delete', 'delete_job'],
  ['candidates_create', 'add_candidate'],
  ['candidates_read', 'view_all_candidates', 'view_assigned_candidates'],
  ['candidates_update', 'edit_candidate'],
  ['candidates_delete', 'delete_candidate'],
  ['manage_roles', 'assign_roles', 'system_select_all'],
  ['view_team', 'add_team_member', 'edit_team_member'],
  ['view_activity_log', 'reports_read'],
  ['recycle_bin_manage', 'clients_delete', 'jobs_delete', 'leads_delete', 'candidates_delete'],
];

const aliasLookup = new Map();

function registerAlias(name, group) {
  if (!aliasLookup.has(name)) aliasLookup.set(name, new Set());
  group.forEach((member) => aliasLookup.get(name).add(member));
}

PERMISSION_ALIAS_GROUPS.forEach((group) => {
  group.forEach((name) => registerAlias(name, group));
});

/** Expand a permission name to all equivalent names (including itself). */
export function expandPermissionName(name) {
  const key = String(name || '').trim();
  if (!key) return [];
  const set = aliasLookup.get(key);
  return set ? [...set] : [key];
}

/** True if userPerms grants any of requiredPerms (with alias expansion). */
export function userHasAnyPermission(userPermissions = [], requiredPermissions = []) {
  const normalized = Array.isArray(userPermissions)
    ? userPermissions.map((p) => String(p).trim()).filter(Boolean)
    : [];
  if (normalized.includes('all')) return true;

  const granted = new Set();
  normalized.forEach((perm) => {
    expandPermissionName(perm).forEach((p) => granted.add(p));
  });

  const required = Array.isArray(requiredPermissions)
    ? requiredPermissions.map((p) => String(p).trim()).filter(Boolean)
    : [];
  return required.some((req) => {
    const expanded = expandPermissionName(req);
    return expanded.some((p) => granted.has(p));
  });
}
