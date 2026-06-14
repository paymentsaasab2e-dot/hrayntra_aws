'use client';

import { useEffect, useMemo, useState } from 'react';

import { USER_PERMISSIONS_CHANGED_EVENT } from '../lib/api';
import { MODULE_ACCESS_MAP } from '../lib/rbac/moduleAccess';
import { userHasAnyPermission as checkAnyPermission } from '../lib/rbac/permissionAliases';

interface UserData {
  role?: string;
  roleName?: string;
  permissions?: string[];
}

function normalizeRole(value?: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function normalizePermissionList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((perm: unknown) => {
      if (typeof perm === 'string') return perm.trim();
      if (perm && typeof (perm as { permissionName?: string }).permissionName === 'string') {
        return String((perm as { permissionName: string }).permissionName).trim();
      }
      if (perm && typeof (perm as { name?: string }).name === 'string') {
        return String((perm as { name: string }).name).trim();
      }
      return '';
    })
    .filter(Boolean);
}

function readUserData(): UserData {
  if (typeof window === 'undefined') return {};
  try {
    const currentUser = window.localStorage.getItem('currentUser');
    if (!currentUser) return {};
    const user = JSON.parse(currentUser);
    const fromUser = normalizePermissionList(user?.permissions);
    let fromStorage: string[] = [];
    try {
      fromStorage = normalizePermissionList(
        JSON.parse(window.localStorage.getItem('userPermissions') || '[]'),
      );
    } catch {
      fromStorage = [];
    }
    // Merge both stores — currentUser.permissions can be stale after an admin edits the role.
    const normalizedPermissions = Array.from(new Set([...fromUser, ...fromStorage]));
    return {
      role: user?.role || '',
      roleName: user?.roleName || '',
      permissions: normalizedPermissions,
    };
  } catch {
    return {};
  }
}

/**
 * Hook to check user permissions. The cached values live in localStorage and
 * are refreshed whenever `refreshLocalUserPermissions` runs (e.g. on focus or
 * route change), so role/permission changes the admin made in Teams reflect
 * on the active session without forcing a logout.
 */
export function usePermissions() {
  const [userData, setUserData] = useState<UserData>(() => readUserData());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => setUserData(readUserData());

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === 'currentUser' ||
        event.key === 'userPermissions'
      ) {
        handler();
      }
    };

    window.addEventListener(USER_PERMISSIONS_CHANGED_EVENT, handler as EventListener);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', handler);

    return () => {
      window.removeEventListener(USER_PERMISSIONS_CHANGED_EVENT, handler as EventListener);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', handler);
    };
  }, []);

  const result = useMemo(() => {
    const permissions = userData.permissions || [];
    const role = userData.role || '';
    const roleName = userData.roleName || '';
    const normalizedRole = normalizeRole(role);
    const normalizedRoleName = normalizeRole(roleName);
    const isSuperAdminRole =
      normalizedRole === 'super admin' || normalizedRoleName === 'super admin';
    const hasFullAccess = isSuperAdminRole || permissions.includes('all');

    const hasAnyPermission = (permissionNames: string[]): boolean => {
      if (hasFullAccess) return true;
      return checkAnyPermission(permissions, permissionNames);
    };

    const hasPermission = (permissionName: string): boolean => {
      if (hasFullAccess) return true;
      return checkAnyPermission(permissions, [permissionName]);
    };

    const hasAllPermissions = (permissionNames: string[]): boolean => {
      if (hasFullAccess) return true;
      return permissionNames.every((perm) => checkAnyPermission(permissions, [perm]));
    };

    const isSuperAdmin = (): boolean => {
      return hasFullAccess;
    };

    const isAdmin = (): boolean => {
      return (
        normalizeRole(role) === 'admin' ||
        normalizeRole(roleName) === 'admin' ||
        hasFullAccess
      );
    };

    const canAccess = (module: string): boolean => {
      const modulePermissions = MODULE_ACCESS_MAP[module] || [];
      return hasAnyPermission(modulePermissions);
    };

    return {
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      isSuperAdmin,
      isAdmin,
      canAccess,
      permissions,
      role,
      roleName,
    };
  }, [userData]);

  return result;
}
