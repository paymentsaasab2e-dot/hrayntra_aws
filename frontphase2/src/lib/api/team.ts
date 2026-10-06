/* team API */
import { PERMISSIONS_REFRESH_MIN_INTERVAL_MS, apiFetch, getPermissionsRefreshInFlight, setPermissionsRefreshInFlight, getPermissionsRefreshLastAt, setPermissionsRefreshLastAt, getPermissionsRefreshLastResult, setPermissionsRefreshLastResult } from './core';
import type { ActivityViewableDepartment, ActivityViewableMember, ActivityVisibilityCapabilities, MyPermissionsPayload, PortalAccessMember, TaskAssignableMember } from './types';


export const USER_PERMISSIONS_CHANGED_EVENT = 'hrayntra:user-permissions-changed';

export async function apiGetMyPermissions() {
  return apiFetch<MyPermissionsPayload>('/users/me/permissions', { auth: true });
}

/**
 * Pull the user's effective permissions from the API and write them into
 * localStorage so `usePermissions` reflects role/permission changes the admin
 * made in Teams (without requiring the user to log out and back in). Returns
 * the latest permissions (or null on failure).
 */

export async function refreshLocalUserPermissions(): Promise<MyPermissionsPayload | null> {
  if (typeof window === 'undefined') return null;
  const accessToken = window.localStorage.getItem('accessToken');
  if (!accessToken) return null;

  const now = Date.now();
  if (getPermissionsRefreshInFlight()) {
    return getPermissionsRefreshInFlight();
  }
  if (
    getPermissionsRefreshLastResult() &&
    now - getPermissionsRefreshLastAt() < PERMISSIONS_REFRESH_MIN_INTERVAL_MS
  ) {
    return getPermissionsRefreshLastResult();
  }

  setPermissionsRefreshInFlight((async () => {
  try {
    const res = await apiGetMyPermissions();
    const data = res?.data;
    if (!data) return null;

    const rawCurrent = window.localStorage.getItem('currentUser');
    if (rawCurrent) {
      try {
        const currentUser = JSON.parse(rawCurrent);
        const next = {
          ...currentUser,
          role: data.role || currentUser?.role || '',
          roleName: data.roleName || currentUser?.roleName || '',
          roleColor: data.roleColor ?? currentUser?.roleColor,
          permissions: Array.isArray(data.permissions) ? data.permissions : [],
        };
        window.localStorage.setItem('currentUser', JSON.stringify(next));
      } catch {
        // ignore corrupted currentUser blob
      }
    }
    window.localStorage.setItem(
      'userPermissions',
      JSON.stringify(Array.isArray(data.permissions) ? data.permissions : [])
    );

    try {
      window.dispatchEvent(
        new CustomEvent(USER_PERMISSIONS_CHANGED_EVENT, { detail: data })
      );
    } catch {
      // CustomEvent may not exist in some old envs; best-effort.
    }

    setPermissionsRefreshLastAt(Date.now());
    setPermissionsRefreshLastResult(data);
    return data;
  } catch (error) {
    console.warn('Failed to refresh user permissions', error);
    return null;
  } finally {
    setPermissionsRefreshInFlight(null);
  }
  })());

  return getPermissionsRefreshInFlight();
}

export async function apiGetPortalAccessMembers() {
  return apiFetch<PortalAccessMember[]>('/jobs/portal-access/members', { auth: true });
}

export async function apiGetActivityViewableMembers() {
  return apiFetch<{
    scope: ActivityVisibilityCapabilities;
    members: ActivityViewableMember[];
  }>('/activities/viewable-members', { auth: true });
}

export async function apiGetActivityViewableDepartments() {
  return apiFetch<{
    scope: ActivityVisibilityCapabilities;
    departments: ActivityViewableDepartment[];
  }>('/activities/viewable-departments', { auth: true });
}

export const apiGetTaskAssignableMembers = async (companyId?: string) => {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiFetch<TaskAssignableMember[]>(`/tasks/assignable-members${query}`, { auth: true });
};
