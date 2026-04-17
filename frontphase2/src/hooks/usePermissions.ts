'use client';

import { useMemo } from 'react';

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

/**
 * Hook to check user permissions
 */
export function usePermissions() {
  const userData = useMemo<UserData>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const currentUser = localStorage.getItem('currentUser');
      if (!currentUser) return {};
      const user = JSON.parse(currentUser);
      const rawPermissions = user?.permissions || JSON.parse(localStorage.getItem('userPermissions') || '[]');
      const normalizedPermissions = Array.isArray(rawPermissions)
        ? rawPermissions
            .map((perm) => {
              if (typeof perm === 'string') return perm;
              if (perm && typeof perm.permissionName === 'string') return perm.permissionName;
              if (perm && typeof perm.name === 'string') return perm.name;
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
  }, []);

  const permissions = userData.permissions || [];
  const role = userData.role || '';
  const roleName = userData.roleName || '';
  const normalizedRole = normalizeRole(role);
  const normalizedRoleName = normalizeRole(roleName);
  const isSuperAdminRole =
    normalizedRole === 'super admin' ||
    normalizedRoleName === 'super admin';
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
    return normalizeRole(role) === 'admin' || normalizeRole(roleName) === 'admin' || hasFullAccess;
  };

  const canAccess = (module: string): boolean => {
    // Map module names to permission patterns
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
}
