'use client';

import { useEffect, useMemo, useState } from 'react';

import { USER_PERMISSIONS_CHANGED_EVENT } from '../lib/api';

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

function readUserData(): UserData {
  if (typeof window === 'undefined') return {};
  try {
    const currentUser = window.localStorage.getItem('currentUser');
    if (!currentUser) return {};
    const user = JSON.parse(currentUser);
    const rawPermissions =
      user?.permissions ||
      JSON.parse(window.localStorage.getItem('userPermissions') || '[]');
    const normalizedPermissions = Array.isArray(rawPermissions)
      ? rawPermissions
          .map((perm: unknown) => {
            if (typeof perm === 'string') return perm;
            if (perm && typeof (perm as any).permissionName === 'string') return (perm as any).permissionName;
            if (perm && typeof (perm as any).name === 'string') return (perm as any).name;
            return '';
          })
          .filter(Boolean)
      : [];
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

    const hasPermission = (permissionName: string): boolean => {
      if (hasFullAccess) {
        return true;
      }
      return permissions.includes(permissionName);
    };

    const hasAnyPermission = (permissionNames: string[]): boolean => {
      if (hasFullAccess) {
        return true;
      }
      return permissionNames.some((perm) => permissions.includes(perm));
    };

    const hasAllPermissions = (permissionNames: string[]): boolean => {
      if (hasFullAccess) {
        return true;
      }
      return permissionNames.every((perm) => permissions.includes(perm));
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
      const modulePermissionMap: Record<string, string[]> = {
        Leads: ['leads_create', 'leads_read', 'leads_update', 'leads_delete'],
        Clients: ['clients_create', 'clients_read', 'clients_update', 'clients_delete'],
        Jobs: ['jobs_create', 'jobs_read', 'jobs_update', 'jobs_delete', 'assign_job', 'create_job', 'edit_job', 'delete_job', 'view_jobs'],
        Candidates: ['candidates_create', 'candidates_read', 'candidates_update', 'candidates_delete', 'view_all_candidates', 'view_assigned_candidates', 'add_candidate', 'edit_candidate', 'delete_candidate', 'move_pipeline', 'submit_candidate'],
        Interviews: ['interviews_create', 'interviews_read', 'interviews_update', 'interviews_delete'],
        Placements: ['placements_create', 'placements_read', 'placements_update', 'placements_delete'],
        Billing: ['access_billing', 'create_invoice', 'record_payment'],
        Reports: ['reports_create', 'reports_read', 'reports_update', 'reports_delete'],
        Team: ['add_team_member', 'edit_team_member', 'assign_roles', 'generate_credentials', 'manage_commission', 'manage_targets'],
        System: ['manage_settings', 'access_integrations', 'export_data'],
      };

      const modulePermissions = modulePermissionMap[module] || [];
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
