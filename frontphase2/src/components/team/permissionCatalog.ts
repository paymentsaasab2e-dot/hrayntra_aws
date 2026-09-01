import type { Permission } from '../../types/team';
import {
  RBAC_CATALOG_TOTAL,
  RBAC_MODULE_GROUPS,
  RBAC_MODULE_ORDER,
  RBAC_PERMISSION_SEED,
  MODULE_DISPLAY_LABELS,
  PERMISSION_DISPLAY_LABELS,
  rbacGroupForModule,
} from '../../lib/rbac/permissions';

export {
  RBAC_CATALOG_TOTAL,
  RBAC_MODULE_GROUPS,
  RBAC_MODULE_ORDER,
  RBAC_PERMISSION_SEED,
  MODULE_DISPLAY_LABELS,
  PERMISSION_DISPLAY_LABELS,
  rbacGroupForModule,
};

/** @deprecated use RBAC_PERMISSION_SEED */
export const DEFAULT_PERMISSION_SEED = RBAC_PERMISSION_SEED;

/** Pre-ticked on every new role (matches backend DEFAULT_EVERYONE_PERMISSIONS). */
export const DEFAULT_EVERYONE_PERMISSION_NAMES = ['access_integrations'];

export function permissionIdsForNames(
  permissions: Record<string, Permission[]>,
  names: string[],
): string[] {
  const want = new Set(names);
  return Object.values(permissions || {})
    .flat()
    .filter((permission) => want.has(permission.permissionName))
    .map((permission) => permission.id);
}

export function defaultEveryonePermissionIds(
  permissions: Record<string, Permission[]>,
): string[] {
  return permissionIdsForNames(permissions, DEFAULT_EVERYONE_PERMISSION_NAMES);
}

export function buildFallbackPermissionsMap(): Record<string, Permission[]> {
  return RBAC_PERMISSION_SEED.reduce<Record<string, Permission[]>>((acc, permission) => {
    if (!acc[permission.module]) acc[permission.module] = [];
    acc[permission.module].push({
      id: permission.permissionName,
      permissionName: permission.permissionName,
      module: permission.module,
      description: permission.description,
      createdAt: new Date().toISOString(),
    });
    return acc;
  }, {});
}

export function mergePermissionMaps(
  apiPermissions: Record<string, Permission[]> | undefined | null
): Record<string, Permission[]> {
  const fallback = buildFallbackPermissionsMap();
  const merged = { ...fallback };

  Object.entries(apiPermissions || {}).forEach(([module, permissions]) => {
    if (!Array.isArray(permissions) || permissions.length === 0) return;
    merged[module] = permissions.map((permission) => {
      const catalog = RBAC_PERMISSION_SEED.find(
        (row) => row.permissionName === (permission.permissionName || permission.id),
      );
      return {
        ...permission,
        id: permission.id || permission.permissionName,
        permissionName: permission.permissionName || permission.id,
        module: permission.module || module,
        description: catalog?.description || permission.description || undefined,
      };
    });
  });

  return merged;
}

export function sortModules(modules: string[]): string[] {
  return [...modules].sort((a, b) => {
    const aIndex = RBAC_MODULE_ORDER.indexOf(a as (typeof RBAC_MODULE_ORDER)[number]);
    const bIndex = RBAC_MODULE_ORDER.indexOf(b as (typeof RBAC_MODULE_ORDER)[number]);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

export function formatModuleLabel(module: string): string {
  const key = String(module || '').trim();
  return MODULE_DISPLAY_LABELS[key] || key;
}

export function formatPermissionLabel(name: string): string {
  const key = String(name || '').trim();
  if (PERMISSION_DISPLAY_LABELS[key]) return PERMISSION_DISPLAY_LABELS[key];
  if (key.startsWith('hq_')) {
    return key
      .replace(/^hq_/, '')
      .split('_')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return key
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatPermissionDescription(name: string, fallback?: string): string {
  const key = String(name || '').trim();
  const catalog = RBAC_PERMISSION_SEED.find((row) => row.permissionName === key);
  return catalog?.description || fallback || '';
}

/** Scope permissions controlled by the Dashboard level dropdown (hidden from tick list). */
export const DASHBOARD_LEVEL_PERMISSIONS = [
  'dash_dept_scope',
  'dash_company_scope',
  'dash_full_scope',
] as const;

/** Hours & scores tabs follow Team tab — hidden; auto-synced when Team is ticked. */
export const DASHBOARD_PEOPLE_FOLLOW_TEAM: Record<string, string> = {
  dash_crm_team: 'dash_crm_people',
  dash_rec_team: 'dash_rec_people',
};

export const DASHBOARD_HIDDEN_TICK_PERMISSIONS = [
  ...DASHBOARD_LEVEL_PERMISSIONS,
  'dash_crm_people',
  'dash_rec_people',
] as const;

/** @deprecated use DASHBOARD_LEVEL_PERMISSIONS */
export const DASHBOARD_LEVEL_PERMISSION = 'dash_full_scope';

export type RoleDashboardLevelChoice = 'self' | 'department' | 'company' | 'tenant';

export function isDashboardLevelPermissionName(name: string | undefined | null): boolean {
  return Boolean(name && (DASHBOARD_LEVEL_PERMISSIONS as readonly string[]).includes(name));
}

export function isDashboardHiddenTickPermission(name: string | undefined | null): boolean {
  return Boolean(name && (DASHBOARD_HIDDEN_TICK_PERMISSIONS as readonly string[]).includes(name));
}

export function findPermissionIdsByNames(
  permissionsByModule: Record<string, { id?: string; permissionName?: string }[]>,
  names: readonly string[],
): Record<string, string> {
  const wanted = new Set(names);
  const out: Record<string, string> = {};
  for (const list of Object.values(permissionsByModule || {})) {
    for (const p of list || []) {
      const n = String(p.permissionName || '').trim();
      if (!wanted.has(n)) continue;
      out[n] = String(p.id || p.permissionName || n);
    }
  }
  for (const n of names) {
    if (!out[n]) out[n] = n;
  }
  return out;
}

export function dashboardLevelFromSelectedIds(
  selectedIds: Set<string>,
  idByName?: Record<string, string>,
): RoleDashboardLevelChoice {
  const ids = idByName || {
    dash_dept_scope: 'dash_dept_scope',
    dash_company_scope: 'dash_company_scope',
    dash_full_scope: 'dash_full_scope',
  };
  if (selectedIds.has(ids.dash_full_scope) || selectedIds.has('dash_full_scope')) return 'tenant';
  if (selectedIds.has(ids.dash_company_scope) || selectedIds.has('dash_company_scope')) {
    return 'company';
  }
  if (selectedIds.has(ids.dash_dept_scope) || selectedIds.has('dash_dept_scope')) {
    return 'department';
  }
  return 'self';
}

export function applyDashboardLevelToSelectedIds(
  selectedIds: Set<string>,
  level: RoleDashboardLevelChoice,
  idByName?: Record<string, string>,
): Set<string> {
  const ids = idByName || {
    dash_dept_scope: 'dash_dept_scope',
    dash_company_scope: 'dash_company_scope',
    dash_full_scope: 'dash_full_scope',
  };
  const next = new Set(selectedIds);
  for (const name of DASHBOARD_LEVEL_PERMISSIONS) {
    next.delete(ids[name] || name);
    next.delete(name);
  }
  if (level === 'department') next.add(ids.dash_dept_scope || 'dash_dept_scope');
  if (level === 'company') next.add(ids.dash_company_scope || 'dash_company_scope');
  if (level === 'tenant') next.add(ids.dash_full_scope || 'dash_full_scope');
  return next;
}
