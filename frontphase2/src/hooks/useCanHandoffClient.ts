'use client';

import { useCallback, useEffect, useState } from 'react';
import { refreshLocalUserPermissions, USER_PERMISSIONS_CHANGED_EVENT } from '../lib/api';
import { userHasAnyPermission } from '../lib/rbac/permissionAliases';
import { usePermissions } from './usePermissions';

function hasHandoffPermission(permissions: string[]): boolean {
  return userHasAnyPermission(permissions, ['clients_handoff']);
}

/**
 * Whether the current user may hand off clients to another department.
 * Server refresh is authoritative once loaded; until then we fall back to the
 * cached permission list in localStorage.
 */
export function useCanHandoffClient(): boolean {
  const { hasPermission } = usePermissions();
  const [serverAllowed, setServerAllowed] = useState<boolean | null>(null);

  const applyFromServer = useCallback((permissions: string[]) => {
    setServerAllowed(hasHandoffPermission(permissions));
  }, []);

  useEffect(() => {
    const applyFromPayload = (data: { permissions?: string[] } | null | undefined) => {
      if (!data) return;
      const next = Array.isArray(data.permissions) ? data.permissions : [];
      applyFromServer(next);
    };

    const refresh = async () => {
      const data = await refreshLocalUserPermissions();
      applyFromPayload(data);
    };

    void refresh();

    const onPermissionsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ permissions?: string[] }>).detail;
      if (detail) {
        applyFromPayload(detail);
        return;
      }
      void refresh();
    };

    window.addEventListener(USER_PERMISSIONS_CHANGED_EVENT, onPermissionsChanged);
    return () => {
      window.removeEventListener(USER_PERMISSIONS_CHANGED_EVENT, onPermissionsChanged);
    };
  }, [applyFromServer]);

  if (serverAllowed !== null) return serverAllowed;
  return hasPermission('clients_handoff');
}
