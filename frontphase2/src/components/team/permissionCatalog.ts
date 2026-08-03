import type { Permission } from '../../types/team';
import { RBAC_CATALOG_TOTAL, RBAC_MODULE_ORDER, RBAC_PERMISSION_SEED } from '../../lib/rbac/permissions';

export { RBAC_CATALOG_TOTAL, RBAC_MODULE_ORDER, RBAC_PERMISSION_SEED };

/** @deprecated use RBAC_PERMISSION_SEED */
export const DEFAULT_PERMISSION_SEED = RBAC_PERMISSION_SEED;

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
    merged[module] = permissions.map((permission) => ({
      ...permission,
      id: permission.id || permission.permissionName,
      permissionName: permission.permissionName || permission.id,
      module: permission.module || module,
      description: permission.description || undefined,
    }));
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

export function formatPermissionLabel(name: string): string {
  const normalized = String(name || '')
    .replace(/^hq_/, '')
    .trim();
  return normalized
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
