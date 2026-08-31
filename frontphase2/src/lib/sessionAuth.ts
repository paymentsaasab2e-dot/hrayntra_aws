import {
  apiFetch,
  apiGetMe,
  apiGetMyPermissions,
  buildApiUrl,
  getTenantDbName,
  syncAuthCookie,
  syncOrgRecruitmentSummaryFromApi,
  syncTenantDbName,
} from './api';
import { clearAllEmployerPageCaches } from './employerPageCache';

export type ActiveSessionView = {
  sessionId?: string;
  browserInfo?: string;
  operatingSystem?: string;
  deviceType?: string;
  macAddress?: string;
  location?: string;
  deviceLabel?: string;
};

export function parseSessionIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return json.sessionId ? String(json.sessionId) : null;
  } catch {
    return null;
  }
}

export function getStoredSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return parseSessionIdFromToken(localStorage.getItem('accessToken'));
}

export function persistAuthTokens(data: {
  accessToken?: string;
  refreshToken?: string;
  tenantDbName?: string;
}) {
  if (typeof window === 'undefined') return;
  if (data.accessToken) {
    localStorage.setItem('accessToken', data.accessToken);
    syncAuthCookie('accessToken', data.accessToken);
  }
  if (data.refreshToken) {
    localStorage.setItem('refreshToken', data.refreshToken);
    syncAuthCookie('refreshToken', data.refreshToken);
  }
  if (data.tenantDbName) syncTenantDbName(data.tenantDbName);
}

export function clearAuthStorage() {
  if (typeof window === 'undefined') return;
  clearAllEmployerPageCaches();
  [
    'accessToken',
    'refreshToken',
    'currentUser',
    'userPermissions',
    'requirePasswordReset',
    'lastLoginId',
    'tenantDbName',
    'orgRecruitmentMode',
    'orgBillingEnabled',
  ].forEach((key) => localStorage.removeItem(key));
  syncAuthCookie('accessToken', null);
  syncAuthCookie('refreshToken', null);
  syncTenantDbName(null);
}

const INTENTIONAL_LOGOUT_FLAG = 'hrayntra:intentional-logout';

/** Set before POST /auth/logout so the session-ended modal is not shown. */
export function markIntentionalLogout() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(INTENTIONAL_LOGOUT_FLAG, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function isIntentionalLogout() {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(INTENTIONAL_LOGOUT_FLAG) === '1';
  } catch {
    return false;
  }
}

export function clearIntentionalLogout() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(INTENTIONAL_LOGOUT_FLAG);
  } catch {
    /* ignore */
  }
}

export function loginPathForCurrentPage() {
  if (typeof window === 'undefined') return '/login';
  return window.location.pathname.startsWith('/hq') ? '/hq/login' : '/login';
}

/** Login / password / public apply screens — no grammar assist or overdue popups. */
export function isEmployerPublicAuthPath(pathname: string | null | undefined) {
  const p = (pathname || '/').split('?')[0].toLowerCase();
  if (p === '/' || p === '') return true;
  return [
    '/login',
    '/hq/login',
    '/forgot-password',
    '/reset-password',
    '/session-transfer',
    '/apply',
    '/client-review',
    '/lead-form',
  ].some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/** Tell the API to end the active session row before wiping local tokens (timeout / logout). */
export async function endSessionOnServer() {
  if (typeof window === 'undefined') return;
  const sessionId = getStoredSessionId();
  const token = localStorage.getItem('accessToken');
  if (!token) return;
  try {
    const tenantDbName = getTenantDbName();
    await fetch(buildApiUrl('/auth/logout'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(tenantDbName ? { 'X-Tenant-Db-Name': tenantDbName } : {}),
      },
      body: JSON.stringify(sessionId ? { sessionId } : {}),
      keepalive: true,
    });
  } catch {
    /* best effort — login will auto-release same-device stale sessions */
  }
}

export async function apiRequestSessionTransfer(body: {
  email?: string;
  loginId?: string;
  password: string;
  deviceId?: string;
  macAddress?: string;
  userAgent?: string;
}) {
  const tenantDbName = getTenantDbName();
  const mac = body.macAddress || body.deviceId;
  return apiFetch<{ requestId: string; status: string; expiresAt: string }>(
    '/auth/request-session-transfer',
    {
      method: 'POST',
      body: {
        ...body,
        macAddress: mac,
        macId: mac,
        deviceId: mac,
        tenantDbName: tenantDbName || undefined,
      },
      includeTenantHeader: !!tenantDbName,
    },
  );
}

export async function apiApproveSessionTransfer(requestId: string) {
  return apiFetch('/auth/approve-session-transfer', {
    method: 'POST',
    auth: true,
    body: { requestId },
  });
}

export async function apiRejectSessionTransfer(requestId: string) {
  return apiFetch('/auth/reject-session-transfer', {
    method: 'POST',
    auth: true,
    body: { requestId },
  });
}

export async function apiSessionTransferStatus(requestId: string) {
  return apiFetch<{ status: string }>(`/auth/session/transfer/${encodeURIComponent(requestId)}`, {
    method: 'GET',
    includeTenantHeader: !!getTenantDbName(),
  });
}

export async function apiCompleteSessionTransfer(body: {
  requestId: string;
  email?: string;
  loginId?: string;
  password: string;
  deviceId?: string;
  macAddress?: string;
  userAgent?: string;
}) {
  const mac = body.macAddress || body.deviceId;
  return apiFetch<{
    accessToken: string;
    refreshToken: string;
    sessionId?: string;
    tenantDbName?: string;
  }>('/auth/complete-session-transfer', {
    method: 'POST',
    body: {
      ...body,
      macAddress: mac,
      macId: mac,
      deviceId: mac,
      tenantDbName: getTenantDbName() || undefined,
    },
    includeTenantHeader: !!getTenantDbName(),
  });
}

export async function apiSessionHeartbeat(sessionId: string) {
  return apiFetch<{
    ok: boolean;
    inactivityWarning?: boolean;
    expiresInMs?: number;
    code?: string;
  }>('/auth/session/heartbeat', {
    method: 'POST',
    auth: true,
    body: { sessionId },
  });
}

const MAC_STORAGE_KEY = 'hrayntra_mac_id';
const LEGACY_DEVICE_STORAGE_KEY = 'hrayntra_device_id';

/** Stable per-browser device id used as MAC id for duplicate-login detection. */
export function getMacAddress(): string {
  if (typeof window === 'undefined') return 'server';
  let mac = localStorage.getItem(MAC_STORAGE_KEY);
  if (!mac) {
    mac = localStorage.getItem(LEGACY_DEVICE_STORAGE_KEY);
    if (mac) {
      localStorage.setItem(MAC_STORAGE_KEY, mac);
    } else {
      mac = crypto.randomUUID();
      localStorage.setItem(MAC_STORAGE_KEY, mac);
    }
  }
  return mac;
}

/** @deprecated Use getMacAddress — kept for callers that still read deviceId. */
export function getDeviceId(): string {
  return getMacAddress();
}

export type LoginDevicePayload = {
  macAddress: string;
  deviceId: string;
  userAgent: string;
};

export async function buildLoginDevicePayload(): Promise<LoginDevicePayload> {
  const macAddress = getMacAddress();
  return {
    macAddress,
    deviceId: macAddress,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
  };
}

export function resolveStoredLoginId(storedUser?: Record<string, unknown> | null): string {
  let user = storedUser;
  if (user === undefined && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('currentUser');
      user = raw ? JSON.parse(raw) : null;
    } catch {
      user = null;
    }
  }

  const loginId = String(user?.loginId || (user?.credential as { loginId?: string } | undefined)?.loginId || '').trim();
  if (loginId) return loginId;

  if (typeof window !== 'undefined') {
    const lastLoginId = String(localStorage.getItem('lastLoginId') || '').trim();
    if (lastLoginId) return lastLoginId;
  }

  return String(user?.email || '').trim();
}

export function persistLastLoginId(loginId: string | null | undefined) {
  if (typeof window === 'undefined') return;
  const trimmed = String(loginId || '').trim();
  if (trimmed) {
    localStorage.setItem('lastLoginId', trimmed);
  }
}

export function buildLoginIdentifierFields(identifier: string) {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    return { email: trimmed, loginId: undefined as string | undefined };
  }
  return { email: undefined as string | undefined, loginId: trimmed };
}

/** After tokens are issued (login or transfer complete), hydrate local user state. */
export async function finalizeAuthAfterTokens(data: {
  accessToken: string;
  refreshToken?: string;
  tenantDbName?: string;
  requirePasswordReset?: boolean;
}) {
  persistAuthTokens(data);

  const meRes = await apiGetMe();
  const permRes = await apiGetMyPermissions();
  const user = meRes.data;
  const permissions = Array.isArray(permRes.data?.permissions) ? permRes.data.permissions : [];

  const resolvedRoleName =
    permRes.data?.roleName ||
    user?.roleName ||
    (typeof user?.role === 'string'
      ? user.role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
      : '');

  const userData = {
    ...user,
    loginId: user?.loginId || resolveStoredLoginId(user as Record<string, unknown>),
    roleName: resolvedRoleName,
    roleColor: permRes.data?.roleColor || user?.roleColor || '',
    permissions,
    requirePasswordReset: data.requirePasswordReset || false,
  };

  persistLastLoginId(userData.loginId);

  localStorage.setItem('currentUser', JSON.stringify(userData));
  localStorage.setItem('userPermissions', JSON.stringify(permissions));
  if (data.requirePasswordReset) {
    localStorage.setItem('requirePasswordReset', 'true');
  }

  await syncOrgRecruitmentSummaryFromApi();
  return { user: userData, permissions, requirePasswordReset: data.requirePasswordReset || false };
}

const TENANT_IMPERSONATION_RETURN_KEY = 'tenantImpersonationReturn';
const TENANT_IMPERSONATION_META_KEY = 'tenantImpersonationMeta';

export type TenantImpersonationMeta = {
  memberId: string;
  memberName: string;
  memberEmail?: string;
  actorName: string;
};

export function parseAccessTokenPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isImpersonationAccessToken(token?: string | null): boolean {
  const payload = parseAccessTokenPayload(token ?? (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null));
  return Boolean(payload?.tenantImpersonation || payload?.hqImpersonation);
}

/** HQ opened a tenant workspace, but is not already inside a nested team-member account. */
export function isHqTenantSupportSession(): boolean {
  if (typeof window === 'undefined') return false;
  const payload = parseAccessTokenPayload(localStorage.getItem('accessToken'));
  if (!payload) return false;
  if (payload.tenantImpersonation) return false;
  return Boolean(payload.hqImpersonation);
}

export function getTenantImpersonationMeta(): TenantImpersonationMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TENANT_IMPERSONATION_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TenantImpersonationMeta;
    if (!parsed?.memberId || !parsed?.memberName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasTenantImpersonationReturn(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(TENANT_IMPERSONATION_RETURN_KEY));
}

function captureAuthSnapshot() {
  if (typeof window === 'undefined') return null;
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: localStorage.getItem('refreshToken') || '',
    tenantDbName: localStorage.getItem('tenantDbName') || '',
    currentUser: localStorage.getItem('currentUser') || '',
    userPermissions: localStorage.getItem('userPermissions') || '[]',
  };
}

export function enterTenantImpersonation(data: {
  accessToken: string;
  refreshToken?: string;
  tenantDbName?: string;
  user: Record<string, unknown>;
  permissions?: string[];
  impersonation: TenantImpersonationMeta;
}) {
  if (typeof window === 'undefined') return;
  const snapshot = captureAuthSnapshot();
  if (snapshot) {
    localStorage.setItem(TENANT_IMPERSONATION_RETURN_KEY, JSON.stringify(snapshot));
  }
  persistAuthTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    tenantDbName: data.tenantDbName,
  });
  const permissions = Array.isArray(data.permissions) ? data.permissions : [];
  localStorage.setItem(
    'currentUser',
    JSON.stringify({
      ...data.user,
      permissions,
    }),
  );
  localStorage.setItem('userPermissions', JSON.stringify(permissions));
  localStorage.setItem(TENANT_IMPERSONATION_META_KEY, JSON.stringify(data.impersonation));
}

export function exitTenantImpersonation(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(TENANT_IMPERSONATION_RETURN_KEY);
    if (!raw) return false;
    const snapshot = JSON.parse(raw) as {
      accessToken?: string;
      refreshToken?: string;
      tenantDbName?: string;
      currentUser?: string;
      userPermissions?: string;
    };
    persistAuthTokens({
      accessToken: snapshot.accessToken,
      refreshToken: snapshot.refreshToken,
      tenantDbName: snapshot.tenantDbName,
    });
    if (snapshot.currentUser) localStorage.setItem('currentUser', snapshot.currentUser);
    if (snapshot.userPermissions) localStorage.setItem('userPermissions', snapshot.userPermissions);
    localStorage.removeItem(TENANT_IMPERSONATION_RETURN_KEY);
    localStorage.removeItem(TENANT_IMPERSONATION_META_KEY);
    return true;
  } catch {
    return false;
  }
}
