/** Client-side alias groups — mirror backend permission-aliases.js */
const PERMISSION_ALIAS_GROUPS: string[][] = [
  ['jobs_create', 'create_job'],
  ['jobs_read', 'view_jobs'],
  ['jobs_update', 'edit_job'],
  ['jobs_delete', 'delete_job'],
  ['candidates_create', 'add_candidate'],
  ['candidates_update', 'edit_candidate'],
  ['candidates_delete', 'delete_candidate'],
  ['view_activity_log', 'reports_read'],
];

const aliasLookup = new Map<string, Set<string>>();

function registerAlias(name: string, group: string[]) {
  if (!aliasLookup.has(name)) aliasLookup.set(name, new Set());
  group.forEach((member) => aliasLookup.get(name)!.add(member));
}

PERMISSION_ALIAS_GROUPS.forEach((group) => {
  group.forEach((name) => registerAlias(name, group));
});

export function expandPermissionName(name: string): string[] {
  const key = String(name || '').trim();
  if (!key) return [];
  const set = aliasLookup.get(key);
  return set ? [...set] : [key];
}

export function userHasAnyPermission(userPermissions: string[], required: string[]): boolean {
  const normalized = userPermissions.map((p) => String(p).trim()).filter(Boolean);
  if (normalized.includes('all')) return true;

  const granted = new Set<string>();
  normalized.forEach((perm) => {
    expandPermissionName(perm).forEach((p) => granted.add(p));
  });

  return required.some((req) => expandPermissionName(req).some((p) => granted.has(p)));
}
