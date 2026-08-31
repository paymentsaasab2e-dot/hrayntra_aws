/**
 * Legacy permission names still stored on older roles / used in routes.
 * Only true synonyms belong in the same group — never mix read vs write vs scope permissions.
 */
export const PERMISSION_ALIAS_GROUPS = [
  ['jobs_create', 'create_job'],
  ['jobs_read', 'view_jobs'],
  ['jobs_update', 'edit_job'],
  ['jobs_delete', 'delete_job'],
  ['candidates_create', 'add_candidate'],
  ['candidates_update', 'edit_candidate'],
  ['candidates_delete', 'delete_candidate'],
  ['view_activity_log', 'reports_read'],
  ['view_cross_company_members', 'VIEW_CROSS_COMPANY_MEMBERS'],
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
