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

export type ActiveSessionView = {
  sessionId?: string;
  browserInfo?: string;
  operatingSystem?: string;
  deviceType?: string;
  ipAddress?: string;
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
  [
    'accessToken',
    'refreshToken',
    'currentUser',
    'userPermissions',
    'requirePasswordReset',
    'tenantDbName',
    'orgRecruitmentMode',
    'orgBillingEnabled',
  ].forEach((key) => localStorage.removeItem(key));
  syncAuthCookie('accessToken', null);
  syncAuthCookie('refreshToken', null);
  syncTenantDbName(null);
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
  userAgent?: string;
}) {
  const tenantDbName = getTenantDbName();
  return apiFetch<{ requestId: string; status: string; expiresAt: string }>(
    '/auth/request-session-transfer',
    {
      method: 'POST',
      body: {
        ...body,
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
  userAgent?: string;
}) {
  return apiFetch<{
    accessToken: string;
    refreshToken: string;
    sessionId?: string;
    tenantDbName?: string;
  }>('/auth/complete-session-transfer', {
    method: 'POST',
    body: {
      ...body,
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

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'hrayntra_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export type LoginDevicePayload = {
  deviceId: string;
  userAgent: string;
  clientPublicIp?: string;
  ipAddress?: string;
};

export async function buildLoginDevicePayload(): Promise<LoginDevicePayload> {
  const { fetchClientPublicIp } = await import('../utils/clientPublicIp');
  const clientPublicIp = await fetchClientPublicIp();

  return {
    deviceId: getDeviceId(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    ...(clientPublicIp ? { clientPublicIp, ipAddress: clientPublicIp } : {}),
  };
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
    roleName: resolvedRoleName,
    roleColor: permRes.data?.roleColor || user?.roleColor || '',
    permissions,
    requirePasswordReset: data.requirePasswordReset || false,
  };

  localStorage.setItem('currentUser', JSON.stringify(userData));
  localStorage.setItem('userPermissions', JSON.stringify(permissions));
  if (data.requirePasswordReset) {
    localStorage.setItem('requirePasswordReset', 'true');
  }

  await syncOrgRecruitmentSummaryFromApi();
  return { user: userData, permissions, requirePasswordReset: data.requirePasswordReset || false };
}
