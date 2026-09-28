/* auth API */
import { ApiResponse, AuthPayload, LOCAL_API_BASE, apiFetch, applyTenantDbNameFromUrl, formatAuthErrorMessage, getTenantDbName, isLocalBrowser, syncAuthCookie, syncTenantDbName } from './core';
import { syncOrgRecruitmentSummaryFromApi } from './org';
import type { HqPhase1EarnTask, HqPhase1TokenPack, HqPhase1TokenService, HqTenantImpersonationAccess } from './types';


export async function apiHqAccountSupportRegeneratePassword(body: {
  email?: string;
  customerId?: string;
  tenantDbName?: string;
}) {
  return apiFetch<{
    email: string;
    loginId: string;
    tenantDbName: string;
    customerId?: string;
    credentialEmailSent: boolean;
    credentialEmailError?: string | null;
    loginUrl?: string;
    passwordEmailed?: boolean;
  }>('/hq/account-support/regenerate-password', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqAccountSupportImpersonateEmployer(body: {
  email: string;
}) {
  return apiFetch<HqTenantImpersonationAccess>('/hq/account-support/impersonate-employer', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqAccountSupportImpersonateEmployee(body: {
  email?: string;
  candidateId?: string;
}) {
  return apiFetch<{
    candidateId: string;
    email?: string | null;
    name?: string | null;
    loginUrl: string;
    token?: string | null;
    expiresIn?: string;
  }>('/hq/account-support/impersonate-employee', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqCreateTenantImpersonation(body: { email: string }) {
  return apiFetch<HqTenantImpersonationAccess>('/hq/tenants/impersonate', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiConsumeImpersonationToken(body: {
  token: string;
  macAddress?: string;
  deviceId?: string;
  userAgent?: string;
}) {
  return apiFetch<{
    accessToken: string;
    refreshToken: string;
    tenantDbName: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      roleName: string;
      loginId?: string;
    };
    permissions: string[];
    requirePasswordReset?: boolean;
  }>('/auth/consume-impersonation-token', { method: 'POST', body });
}

export async function apiHqGetSessionAccess() {
  return apiFetch<{
    isHqTeamMember: boolean;
    isPlatformOperator?: boolean;
    hqTeamMemberId?: string;
    email?: string;
    loginId?: string;
    hqPermissionIds: string[] | null;
  }>('/hq/session-access', { auth: true });
}

export async function apiHqGetPhase1TokenConfig() {
  return apiFetch<{
    packs: HqPhase1TokenPack[];
    services: HqPhase1TokenService[];
    serviceCosts: Record<string, number>;
    earns?: HqPhase1EarnTask[];
    earnRewards?: Record<string, number>;
    updatedAt?: string | null;
  }>('/hq/phase1-tokens', { auth: true });
}

export async function apiHqSavePhase1TokenPacks(body: { packs: HqPhase1TokenPack[] }) {
  return apiFetch<{ packs: HqPhase1TokenPack[]; updatedAt?: string }>('/hq/phase1-tokens/packs', {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqSavePhase1TokenCosts(body: {
  services?: Array<{ id: string; cost: number }>;
  costs?: Record<string, number>;
}) {
  return apiFetch<{
    services: HqPhase1TokenService[];
    serviceCosts: Record<string, number>;
    changed?: Array<{ id: string; name?: string; previous?: number; cost?: number }>;
    updatedAt?: string;
  }>('/hq/phase1-tokens/costs', {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqSavePhase1TokenEarns(body: {
  earns?: Array<{ id: string; tokens: number }>;
  rewards?: Record<string, number>;
}) {
  return apiFetch<{
    earns: HqPhase1EarnTask[];
    earnRewards: Record<string, number>;
    changed?: Array<{ id: string; name?: string; previous?: number; tokens?: number }>;
    updatedAt?: string;
  }>('/hq/phase1-tokens/earns', {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqLogin(
  identifier: string,
  password: string,
  devicePayload?: {
    deviceId?: string;
    macAddress?: string;
    macId?: string;
    userAgent?: string;
    forceSessionTakeover?: boolean;
  }
) {
  if (typeof window !== 'undefined') {
    syncTenantDbName(null);
  }
  const loginKey = identifier.includes('@')
    ? identifier.trim().toLowerCase()
    : identifier.trim();
  return apiLogin(loginKey, password.trim(), devicePayload);
}

export async function apiLogin(
  email: string,
  password: string,
  devicePayload?: {
    deviceId?: string;
    macAddress?: string;
    macId?: string;
    userAgent?: string;
    forceSessionTakeover?: boolean;
  }
) {
  // Invite links include ?tenantDbName= — apply right before login so first attempt works.
  // Do NOT reuse a cached tenant from a previous account: that makes Device 2/3 logins
  // hit the wrong DB and show "Invalid email or password" instead of duplicate-session.
  let tenantDbNameHint: string | null = null;
  if (typeof window !== 'undefined') {
    const fromUrl = new URLSearchParams(window.location.search).get('tenantDbName');
    if (fromUrl) {
      syncTenantDbName(fromUrl);
      tenantDbNameHint = fromUrl;
    } else {
      syncTenantDbName(null);
    }
  }
  let res: ApiResponse<AuthPayload>;
  try {
    res = await apiFetch<AuthPayload>('/auth/login', {
      method: 'POST',
      body: {
        email: email.includes('@') ? email : undefined,
        loginId: email.includes('@') ? undefined : email,
        password,
        deviceId: devicePayload?.deviceId,
        macAddress: devicePayload?.macAddress || devicePayload?.deviceId,
        macId: devicePayload?.macAddress || devicePayload?.deviceId,
        userAgent: devicePayload?.userAgent,
        tenantDbName: tenantDbNameHint || undefined,
        forceSessionTakeover: devicePayload?.forceSessionTakeover === true ? true : undefined,
      },
      includeTenantHeader: !!tenantDbNameHint,
    });
  } catch (err: any) {
    throw new Error(formatAuthErrorMessage(err));
  }

  if (res.data?.duplicateSession) {
    return res;
  }

  if (typeof window !== 'undefined') {
    // backendphase2 sometimes returns the JWT as `data.token` (credential login)
    // and sometimes as `data.accessToken` (legacy/email login).
    const accessToken = (res.data as any)?.accessToken || (res.data as any)?.token;
    const refreshToken = (res.data as any)?.refreshToken;

    if (accessToken) localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    syncAuthCookie('accessToken', accessToken || null);
    syncAuthCookie('refreshToken', refreshToken || null);
    syncTenantDbName(res.data?.tenantDbName || tenantDbNameHint || null);
    
    const permissions = Array.isArray(res.data.permissions)
      ? res.data.permissions
      : [];
    const resolvedRoleName =
      res.data.user?.roleName ||
      (typeof res.data.user?.role === 'string'
        ? res.data.user.role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
        : '');

    const resolvedLoginId =
      res.data.user?.loginId ||
      (!email.includes('@') ? email.trim() : '');
    if (resolvedLoginId) {
      localStorage.setItem('lastLoginId', resolvedLoginId);
    }

    // Store user data with permissions
    const userData = {
      ...res.data.user,
      loginId: resolvedLoginId || res.data.user?.loginId || '',
      roleName: resolvedRoleName,
      roleColor: res.data.user?.roleColor || '',
      permissions,
      requirePasswordReset: res.data.requirePasswordReset || false,
      hqTeamMemberId: (res.data.user as { hqTeamMemberId?: string })?.hqTeamMemberId || undefined,
      isHqTeamMember: Boolean(
        (res.data.user as { isHqTeamMember?: boolean; hqTeamMemberId?: string })?.isHqTeamMember ||
          (res.data.user as { hqTeamMemberId?: string })?.hqTeamMemberId,
      ),
    };
    localStorage.setItem('currentUser', JSON.stringify(userData));

    const hqPermissionIds = Array.isArray((res.data as { hqPermissionIds?: string[] })?.hqPermissionIds)
      ? (res.data as unknown as { hqPermissionIds: string[] }).hqPermissionIds.filter((id) => String(id).startsWith('hq_'))
      : userData.isHqTeamMember && Array.isArray(permissions)
        ? permissions.filter((id) => String(id).startsWith('hq_'))
        : [];

    if (userData.isHqTeamMember) {
      localStorage.setItem('hrayntra:hq-permission-ids', JSON.stringify(hqPermissionIds));
    } else {
      localStorage.removeItem('hrayntra:hq-permission-ids');
    }
    
    // Also store permissions separately for easy access
    localStorage.setItem('userPermissions', JSON.stringify(permissions));
    if (res.data.requirePasswordReset) {
      localStorage.setItem('requirePasswordReset', 'true');
    }

    await syncOrgRecruitmentSummaryFromApi({ force: true });
  }

  return res;
}

export async function apiForgotPassword(identifier: string) {
  applyTenantDbNameFromUrl();
  const trimmed = identifier.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const tenantDbNameHint = getTenantDbName();
  const tenantPayload = tenantDbNameHint ? { tenantDbName: tenantDbNameHint } : {};
  return apiFetch<{ email?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: isEmail
      ? { email: trimmed.toLowerCase(), ...tenantPayload }
      : { loginId: trimmed, ...tenantPayload },
    includeTenantHeader: !!tenantDbNameHint,
  });
}

export async function apiVerifyOtp(identifier: string, otp: string) {
  applyTenantDbNameFromUrl();
  const trimmed = identifier.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const tenantDbNameHint = getTenantDbName();
  const tenantPayload = tenantDbNameHint ? { tenantDbName: tenantDbNameHint } : {};
  return apiFetch<{ verified: boolean; email?: string }>('/auth/verify-otp', {
    method: 'POST',
    body: isEmail
      ? { email: trimmed.toLowerCase(), otp: otp.trim(), ...tenantPayload }
      : { loginId: trimmed, otp: otp.trim(), ...tenantPayload },
    includeTenantHeader: !!tenantDbNameHint,
  });
}

export async function apiResetPasswordWithOtp(identifier: string, otp: string, newPassword: string) {
  applyTenantDbNameFromUrl();
  const trimmed = identifier.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const tenantDbNameHint = getTenantDbName();
  const tenantPayload = tenantDbNameHint ? { tenantDbName: tenantDbNameHint } : {};
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: isEmail
      ? { email: trimmed.toLowerCase(), otp: otp.trim(), newPassword, ...tenantPayload }
      : { loginId: trimmed, otp: otp.trim(), newPassword, ...tenantPayload },
    includeTenantHeader: !!tenantDbNameHint,
  });
}

export async function apiRegister(name: string, email: string, password: string, role?: string) {
  const res = await apiFetch<AuthPayload>('/auth/register', {
    method: 'POST',
    body: { name, email, password, role },
  });

  if (typeof window !== 'undefined') {
    syncTenantDbName(res.data?.tenantDbName || null);
    const accessToken = (res.data as any)?.accessToken || (res.data as any)?.token;
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
      syncAuthCookie('accessToken', accessToken);

      if (res.data.refreshToken) {
        localStorage.setItem('refreshToken', res.data.refreshToken);
      }
      syncAuthCookie('refreshToken', res.data.refreshToken || null);

      localStorage.setItem('currentUser', JSON.stringify({
        ...res.data.user,
        roleName: res.data.user?.roleName || '',
        roleColor: res.data.user?.roleColor || '',
        permissions: res.data.permissions || [],
        requirePasswordReset: res.data.requirePasswordReset || false,
      }));
      if (res.data.permissions) {
        localStorage.setItem('userPermissions', JSON.stringify(res.data.permissions));
      }

      await syncOrgRecruitmentSummaryFromApi({ force: true });
    }
  }

  return res;
}

export async function apiRefreshToken() {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const tenantDbNameHint = getTenantDbName();
  const res = await apiFetch<{ accessToken: string; refreshToken: string; tenantDbName?: string }>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    auth: false, // Don't require auth for refresh endpoint
    includeTenantHeader: !!tenantDbNameHint,
  });

  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', res.data.accessToken);
    if (res.data.refreshToken) {
      localStorage.setItem('refreshToken', res.data.refreshToken);
    }
    syncAuthCookie('accessToken', res.data.accessToken);
    syncAuthCookie('refreshToken', res.data.refreshToken || null);
    syncTenantDbName(res.data?.tenantDbName || tenantDbNameHint || null);

    await syncOrgRecruitmentSummaryFromApi();
  }

  return res;
}

export async function apiLogout() {
  if (typeof window === 'undefined') return;

  try {
    const { markIntentionalLogout } = await import('../sessionAuth');
    markIntentionalLogout();
  } catch {
    /* ignore */
  }

  try {
    const token = localStorage.getItem('accessToken');
    if (token) {
      let sessionId: string | undefined;
      try {
        const part = token.split('.')[1];
        if (part) {
          const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
          if (json.sessionId) sessionId = String(json.sessionId);
        }
      } catch {
        /* ignore */
      }
      await apiFetch<{ success?: boolean; message?: string }>('/auth/logout', {
        method: 'POST',
        auth: true,
        body: sessionId ? { sessionId } : undefined,
      });
    }
  } catch (error) {
    console.warn('Logout API failed, clearing local session anyway.', error);
  } finally {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userPermissions');
    localStorage.removeItem('requirePasswordReset');
    localStorage.removeItem('lastLoginId');
    localStorage.removeItem('tenantDbName');
    localStorage.removeItem('activeOrgUnitId');
    localStorage.removeItem('activeOrgUnitName');
    localStorage.removeItem('orgRecruitmentMode');
    localStorage.removeItem('orgBillingEnabled');
    localStorage.removeItem('orgSubscriptionPlan');
    localStorage.removeItem('orgSubscriptionPlanName');
    localStorage.removeItem('orgPlanUsage');
    localStorage.removeItem('orgTenantPaused');
    localStorage.removeItem('orgTenantPausedAt');
    localStorage.removeItem('orgEnabledModules');
    localStorage.removeItem('orgModulesRestricted');
    localStorage.removeItem('orgProductLine');
    localStorage.removeItem('orgDefaultCurrency');
    syncAuthCookie('accessToken', null);
    syncAuthCookie('refreshToken', null);
    syncTenantDbName(null);
    try {
      const { clearAllEmployerPageCaches } = await import('../employerPageCache');
      clearAllEmployerPageCaches();
    } catch {
      /* ignore */
    }
  }
}

// ────────────────────────────────────────────────────────────
// Users
// ────────────────────────────────────────────────────────────

export const gradeAssessmentSession = async (
  sessionId: string,
  payload: { scorePercent: number; reviewNote?: string },
) => {
  return apiFetch<unknown>(`/pre-screen-assessments/sessions/${sessionId}/grade`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiInitiateLinkedInAuth = async () => {
  return apiFetch<{ authUrl: string; state: string }>('/linkedin/auth/linkedin', { auth: true });
};

export async function apiStartOAuthConnect(
  provider: 'google' | 'microsoft' | 'linkedin',
  scope?: string
) {
  const q = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  const path =
    provider === 'google'
      ? `/oauth/google/connect${q}`
      : provider === 'microsoft'
        ? `/oauth/microsoft/connect${q}`
        : `/oauth/linkedin/connect`;
  const res = await apiFetch<{ url: string }>(path, { auth: true });
  if (res.data?.url) {
    window.location.href = res.data.url;
  }
}

export async function apiOAuthDisconnectGoogle(body: {
  service: 'gmail' | 'calendar' | 'both';
}) {
  return apiFetch<{ success: boolean; service: string }>('/oauth/google/disconnect', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiOAuthDisconnectMicrosoft(body: {
  service: 'outlook' | 'teams' | 'both';
}) {
  return apiFetch<{ success: boolean; service: string }>('/oauth/microsoft/disconnect', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiOAuthDisconnectLinkedInSettings() {
  return apiFetch<{ success: boolean; service: string }>('/oauth/linkedin/disconnect', {
    method: 'POST',
    auth: true,
  });
}

export function getOAuthCallbackDisplayBase(): string {
  if (typeof window !== 'undefined' && isLocalBrowser) {
    return (process.env.NEXT_PUBLIC_API_URL || LOCAL_API_BASE).replace(/\/api\/v1\/?$/, '');
  }
  const pub = process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL?.replace(/\/+$/, '');
  return pub || '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications (CRM bell)
// ─────────────────────────────────────────────────────────────────────────────
