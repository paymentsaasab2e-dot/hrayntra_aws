/* Core API helpers, base fetch, tenant/auth cookies */
import { CONNECTION_STATUS, formatPortalStatusLine } from '../portalStatusCopy';
import { orgSideFromPathname } from '../org/orgSide';
import { createHttpApiError, normalizeFetchError, readApiJson } from '../apiNetworkErrors';
import type { AiCoinPack, HqAiFeature, InboxThread, MyPermissionsPayload } from './types';


/* Simple API client for talking to the Express backend */

export const LOCAL_API_BASE = 'http://127.0.0.1:5001/api/v1';

export const PRODUCTION_API_BASE = 'https://api2.hryantra.com/api/v1';

export const PROD_PROXY_BASE = '/api/proxy';

export const isLocalBrowser =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local'));

/** Paths that can exceed the Next.js/Vercel proxy limit (e.g. large or slow DOCX parsing). */

export const LONG_RUNNING_API_PATH_PREFIXES = [
  '/candidates/bulk-cv/',
  '/candidates/parse-resume',
  '/cv/parse-jobs',
  '/candidates/bulk-import',
  '/candidates/repair-bad-names',
  '/jobs/process-jd-file',
  '/hq/portal/jobs/push-to-feeds',
  '/hq/portal/jobs/sync-to-phase1',
  '/agreements/parse-document',
  '/kyc/parse-document',
];

export function isLongRunningApiPath(path: string): boolean {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return LONG_RUNNING_API_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix)
  );
}

export const LONG_RUNNING_FETCH_TIMEOUT_MS = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_LONG_RUNNING_FETCH_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10 * 60 * 1000;
})();

export function mergeAbortSignals(
  userSignal: AbortSignal | undefined,
  timeoutMs: number | undefined
): AbortSignal | undefined {
  if (!userSignal && !timeoutMs) return undefined;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) {
      abort();
    } else {
      userSignal.addEventListener('abort', abort, { once: true });
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs && timeoutMs > 0) {
    timer = setTimeout(() => {
      try {
        controller.abort(new DOMException('Request timed out', 'TimeoutError'));
      } catch {
        abort();
      }
    }, timeoutMs);
  }
  controller.signal.addEventListener(
    'abort',
    () => {
      if (timer) clearTimeout(timer);
    },
    { once: true }
  );
  return controller.signal;
}

// Determination of API base based on environment
/** Deployed app hosts should call `/api/proxy` (same origin) — avoids CORS and hides 502 as "network error". */

export function shouldUseProductionProxy(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false;
  return (
    host.endsWith('.hryantra.com') ||
    host.endsWith('.poyeso.com') ||
    host.endsWith('.vercel.app')
  );
}

export function resolveApiBase(): string {
  if (isLocalBrowser) return LOCAL_API_BASE;
  if (shouldUseProductionProxy()) return PROD_PROXY_BASE;
  const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicApi) return publicApi.replace(/\/$/, '');
  return PROD_PROXY_BASE;
}

/** Direct backend URL for uploads/parsing — avoids same-origin proxy timeouts on slow files. */

export function resolveDirectApiBase(): string {
  if (isLocalBrowser) return LOCAL_API_BASE;
  const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicApi) return publicApi.replace(/\/$/, '');
  return PRODUCTION_API_BASE;
}

export function resolveApiBaseForPath(path: string): string {
  // Long JD/CV posts used to skip the proxy and hit api2.*.com directly (Vercel
  // timeout). On Poyeso UAT that host is a different origin, so Chrome's cert
  // exception for employers.poyeso.com does not apply and fetch fails as
  // "Unable to connect". Same-origin /api/proxy already allows 600s.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.endsWith('.poyeso.com')) return PROD_PROXY_BASE;
  }
  if (isLongRunningApiPath(path)) return resolveDirectApiBase();
  return resolveApiBase();
}

export const API_BASE = resolveApiBase();

/** User-facing message for login/signup failures (maps backend + proxy errors). */

export function formatAuthErrorMessage(
  err: { status?: number; message?: string; code?: string; data?: { code?: string } } | null | undefined,
  fallback = 'Failed to sign in. Please try again.'
): string {
  const status = err?.status;
  const raw = String(err?.message || '').trim();
  const lowered = raw.toLowerCase();
  const code = String(err?.code || err?.data?.code || '').trim();

  if (
    code === 'TENANT_NOT_FOUND' ||
    code === 'TENANT_NOT_RESOLVED' ||
    lowered.includes('tenant not recognized')
  ) {
    return 'We could not match this login to a company workspace. Contact your admin.';
  }

  if (
    status === 401 ||
    lowered.includes('invalid credentials') ||
    lowered.includes('invalid email') ||
    lowered.includes('invalid password')
  ) {
    return 'Invalid email or password.';
  }

  if (status === 423 || lowered.includes('locked')) {
    return raw || 'Account is temporarily locked. Try again later.';
  }

  if (
    status === 403 ||
    lowered.includes('trial_expired') ||
    lowered.includes('trial has ended') ||
    lowered.includes('trial expired')
  ) {
    return raw || formatPortalStatusLine({
      title: 'Your trial has ended',
      message: 'Sign in again after choosing a plan. Your data is kept.',
    });
  }

  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lowered.includes('backend is unreachable') ||
    lowered.includes('unable to connect to server') ||
    lowered.includes('bad gateway') ||
    lowered.includes('gateway error') ||
    lowered.includes('service unavailable') ||
    lowered.includes('gateway timeout') ||
    lowered.includes('invalid server response') ||
    lowered.includes('invalid response')
  ) {
    return formatPortalStatusLine(CONNECTION_STATUS.failed);
  }

  if (
    lowered.includes('network error') ||
    lowered.includes('could not reach the server') ||
    lowered.includes('failed to fetch')
  ) {
    return CONNECTION_STATUS.offline.message;
  }

  return raw || fallback;
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

/** Socket.IO (same host as API in local dev; override with NEXT_PUBLIC_SOCKET_URL in prod if needed). */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  try {
    const fromStorage = localStorage.getItem('accessToken');
    if (fromStorage) return fromStorage;

    // Middleware auth uses the cookie; recover if localStorage was cleared but cookie remains.
    const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]*)/);
    const fromCookie = match?.[1] ? decodeURIComponent(match[1]) : null;
    if (fromCookie) {
      localStorage.setItem('accessToken', fromCookie);
      return fromCookie;
    }
    return null;
  } catch (error) {
    console.error('Error accessing localStorage:', error);
    return null;
  }
}

/** Single-flight refresh so parallel 401s do not rotate/reuse the refresh token. */

export let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessTokenSingleFlight(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) return null;
      const refreshResponse = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        auth: false,
        // Token already names the workspace. A saved tenant header from another
        // account makes refresh look in the wrong database and ends the session.
        includeTenantHeader: false,
      });
      const nextAccess = refreshResponse?.data?.accessToken;
      if (!nextAccess) return null;
      localStorage.setItem('accessToken', nextAccess);
      if (refreshResponse.data.refreshToken) {
        localStorage.setItem('refreshToken', refreshResponse.data.refreshToken);
      }
      syncAuthCookie('accessToken', nextAccess);
      syncAuthCookie('refreshToken', refreshResponse.data.refreshToken || refreshToken);
      return nextAccess;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function getTenantDbName() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('tenantDbName');
  } catch (error) {
    console.error('Error accessing localStorage tenantDbName:', error);
    return null;
  }
}

export function getActiveOrgUnitIdFromStorage() {
  if (typeof window === 'undefined') return '';
  try {
    const id = String(localStorage.getItem('activeOrgUnitId') || '').trim();
    if (!id || id === 'null' || id === 'undefined') return '';
    return /^[a-fA-F0-9]{24}$/.test(id) ? id : '';
  } catch {
    return '';
  }
}

export function getSuperAdminWorkScopeFromStorage(): 'own' | 'all' {
  if (typeof window === 'undefined') return 'all';
  try {
    const raw = String(localStorage.getItem('superAdminWorkScope') || 'all').trim().toLowerCase();
    return raw === 'own' ? 'own' : 'all';
  } catch {
    return 'all';
  }
}

export function attachWorkScopeHeader(headers: Record<string, string>) {
  if (getSuperAdminWorkScopeFromStorage() === 'own') {
    headers['x-work-scope'] = 'own';
  }
}

export function attachOrgSideHeader(headers: Record<string, string>) {
  const side = orgSideFromPathname();
  if (side === 'crm' || side === 'recruitment') {
    headers['x-org-side'] = side;
  }
}

/** Persist workspace DB name so API calls (including login) send `x-tenant-db-name`. */

export function syncTenantDbName(value: string | null | undefined) {
  if (typeof window === 'undefined') return;

  const previous = String(localStorage.getItem('tenantDbName') || '').trim();
  const normalized = String(value || '').trim();
  if (!normalized) {
    localStorage.removeItem('tenantDbName');
    document.cookie = `tenantDbName=; Path=/; Max-Age=0; SameSite=Lax`;
  } else {
    localStorage.setItem('tenantDbName', normalized);
    document.cookie = `tenantDbName=${encodeURIComponent(normalized)}; Path=/; SameSite=Lax`;
  }

  if (previous !== normalized) {
    try {
      // Lazy imports avoid circular deps with intelligence / dialog modules.
      void import('../phase2-intelligence').then((m) => m.clearTenantIntelligenceCache?.());
      void import('../appDialog').then((m) => m.flushAppDialogs?.());
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent('hryantra:tenant-changed', {
        detail: { previous, next: normalized || null },
      }),
    );
  }
}

export function syncAuthCookie(name: string, value: string | null) {
  if (typeof document === 'undefined') return;

  if (!value) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

export const debugApiLogs =
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_DEBUG_LOGS === 'true') ||
  process.env.NODE_ENV === 'development';

/** Public pages that must never hard-redirect to /login on missing/expired auth. */

export function isPublicUnauthenticatedPath(pathname?: string) {
  const path =
    pathname ||
    (typeof window !== 'undefined' ? window.location.pathname : '') ||
    '';
  return (
    path === '/login' ||
    path.startsWith('/login/') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/lead-form/') ||
    path.startsWith('/apply/') ||
    path.startsWith('/client-review/') ||
    path === '/interview-rsvp' ||
    path.startsWith('/interview-rsvp/') ||
    path.startsWith('/session-transfer') ||
    path === '/hq/login' ||
    path.startsWith('/hq/login/')
  );
}

export const debugApiLogsFull = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_DEBUG_LOGS_FULL === 'true';

export function summarizeForLog(value: unknown) {
  if (!debugApiLogsFull) {
    if (Array.isArray(value)) return { type: 'array', length: value.length };
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>;
      return { type: 'object', keys: Object.keys(v).slice(0, 25) };
    }
    return value;
  }

  // Full logging but still truncate to avoid huge console output.
  try {
    const str = JSON.stringify(value);
    return str.length > 1200 ? `${str.slice(0, 1200)}... (truncated)` : str;
  } catch {
    return '[unserializable]';
  }
}

export async function apiFetch<T>(
  path: string,
  options: {
    method?: HttpMethod;
    body?: any;
    auth?: boolean;
    includeTenantHeader?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<ApiResponse<T>> {
  const apiBase = resolveApiBaseForPath(path);
  const url = `${apiBase}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (debugApiLogs) {
    console.log('[apiFetch] request', {
      method: options.method || 'GET',
      path,
      auth: !!options.auth,
      body: options.body ? summarizeForLog(options.body) : undefined,
    });
  }

  // Handle authentication
  if (options.auth) {
    const token = getAccessToken();
    
    // Debug logging (only in development)
    if (debugApiLogs) {
      console.log(`[apiFetch] ${options.method || 'GET'} ${path}`);
      console.log('[apiFetch] Token exists:', !!token);
      if (token) {
        console.log('[apiFetch] Token length:', token.length);
      }
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      // If auth is required but no token exists, throw early to prevent unnecessary requests
      if (typeof window !== 'undefined') {
        // Clear any stale tokens
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        // Public intake / apply pages must not bounce to login for background auth calls.
        if (!isPublicUnauthenticatedPath()) {
          const currentPath = window.location.pathname + window.location.search;
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
      }
      throw new Error('Authentication required. Please log in.');
    }
  }

  const tenantDbName = getTenantDbName();
  if (tenantDbName && (options.auth || options.includeTenantHeader)) {
    headers['x-tenant-db-name'] = tenantDbName;
  }
  const orgUnitId = getActiveOrgUnitIdFromStorage();
  if (orgUnitId && (options.auth || options.includeTenantHeader)) {
    headers['x-org-unit-id'] = orgUnitId;
  }
  if (options.auth || options.includeTenantHeader) {
    attachWorkScopeHeader(headers);
    attachOrgSideHeader(headers);
  }

  // Debug: Log request headers (only when debug enabled)
  if (debugApiLogs && options.auth) {
    console.log('[apiFetch] Request headers:', {
      'Content-Type': headers['Content-Type'],
      'Authorization': headers.Authorization ? 'Bearer ***' : 'Not set',
    });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      cache: 'no-store',
    });
  } catch (fetchError: any) {
    throw normalizeFetchError(fetchError);
  }

  const json = await readApiJson<any>(res);

  if (!res.ok || json?.success === false) {
    if (debugApiLogs) {
      console.warn('[apiFetch] response error', {
        path,
        status: res.status,
        success: json?.success,
        message: json?.message,
        data: summarizeForLog(json?.data),
      });
    }
    // Handle 401 specifically - try to refresh token first
    if (res.status === 401 && options.auth) {
      if (path !== '/auth/refresh') {
        try {
          const nextAccess = await refreshAccessTokenSingleFlight();
          if (nextAccess) {
            const newHeaders = { ...headers };
            newHeaders.Authorization = `Bearer ${nextAccess}`;

            const retryRes = await fetch(url, {
              method: options.method || 'GET',
              headers: newHeaders,
              body: options.body ? JSON.stringify(options.body) : undefined,
              signal: options.signal,
              cache: 'no-store',
            });

            const retryJson = await readApiJson<any>(retryRes);

            if (retryRes.ok && retryJson?.success !== false) {
              maybeNotifyTenantCoinsChanged(path, options.method || 'GET', retryRes, retryJson);
              return retryJson as ApiResponse<T>;
            }
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      }

      const sessionCode = json?.data?.code as string | undefined;
      const sessionEnded =
        sessionCode === 'SESSION_SUPERSEDED' ||
        sessionCode === 'SESSION_EXPIRED' ||
        sessionCode === 'SESSION_INVALID' ||
        sessionCode === 'SESSION_REQUIRED' ||
        sessionCode === 'REFRESH_REUSED' ||
        sessionCode === 'TOKEN_INVALID' ||
        /session.*(expired|no longer active|required)/i.test(String(json?.message || ''));

      // If refresh failed or no refresh token, clear tokens and redirect
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userPermissions');
        localStorage.removeItem('tenantDbName');
        localStorage.removeItem('orgRecruitmentMode');
        localStorage.removeItem('orgBillingEnabled');
        localStorage.removeItem('orgEnabledModules');
        localStorage.removeItem('orgModulesRestricted');
        localStorage.removeItem('orgProductLine');
        localStorage.removeItem('orgPhase1CommonPoolEnabled');
        syncAuthCookie('accessToken', null);
        syncAuthCookie('refreshToken', null);
        syncTenantDbName(null);
        
        // Redirect to login page if not already on a public unauthenticated surface
        if (!isPublicUnauthenticatedPath()) {
          let intentional = false;
          try {
            intentional = sessionStorage.getItem('hrayntra:intentional-logout') === '1';
          } catch {
            intentional = false;
          }
          if (intentional) {
            const dest = window.location.pathname.startsWith('/hq') ? '/hq/login' : '/login';
            window.location.href = dest;
          } else {
            const currentPath = window.location.pathname + window.location.search;
            const sessionHint = sessionEnded
              ? `&session=${encodeURIComponent(json?.message || 'Session ended')}`
              : '';
            window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}${sessionHint}`;
          }
        }
      }
      throw new Error(
        sessionEnded
          ? json?.message || 'Your session is no longer active. Please log in again.'
          : 'Authentication required. Please log in.',
      );
    }
    // When the backend returns Zod validation errors as `data.errors[]`, surface
    // the per-field details in the thrown message so existing toasts/UI strings
    // become actionable instead of showing a generic "Validation failed".
    const baseMsg = json?.message || `Request failed with status ${res.status}`;
    const validationIssues = Array.isArray(json?.data?.errors)
      ? (json.data.errors as Array<{ path?: string | string[]; message?: string } | string>)
          .map((entry) => {
            if (typeof entry === 'string') return entry;
            const path = Array.isArray(entry?.path)
              ? entry.path.join('.')
              : entry?.path || '';
            const message = entry?.message || 'Invalid value';
            return path ? `${path}: ${message}` : message;
          })
          .filter(Boolean)
      : [];
    const detailedMsg = validationIssues.length
      ? `${baseMsg} — ${validationIssues.join('; ')}`
      : baseMsg;
    if (debugApiLogs && validationIssues.length) {
      console.warn('[apiFetch] validation issues', validationIssues);
    }
    const authPaths = ['/auth/login', '/auth/register'];
    const friendlyMsg = authPaths.some((p) => path === p || path.startsWith(`${p}?`))
      ? formatAuthErrorMessage(
          {
            status: res.status,
            message: detailedMsg,
            code: typeof json?.data?.code === 'string' ? json.data.code : undefined,
            data: json?.data,
          },
          detailedMsg,
        )
      : detailedMsg;
    if (
      typeof window !== 'undefined' &&
      (res.status === 402 || json?.data?.code === 'INSUFFICIENT_COINS')
    ) {
      notifyTenantCoinsChanged({
        coins:
          json?.data?.balance != null && Number.isFinite(Number(json.data.balance))
            ? Number(json.data.balance)
            : undefined,
      });
    }
    throw createHttpApiError(res.status, friendlyMsg, {
      data: json?.data,
      raw: json,
      validationIssues,
    });
  }

  maybeNotifyTenantCoinsChanged(path, options.method || 'GET', res, json);

  if (debugApiLogs) {
    console.log('[apiFetch] response ok', {
      path,
      status: res.status,
      success: json?.success,
      message: json?.message,
      data: summarizeForLog(json?.data),
      pagination: json?.pagination,
    });
  }

  // Intelligent tenant behaviour: track successful CRM mutations end-to-end
  if (typeof window !== 'undefined' && res.ok && json?.success !== false) {
    import('../tenant-behavior-engine/track').then(({ trackTenantApiCall }) => {
      trackTenantApiCall(path, options.method || 'GET', options.body);
    }).catch(() => {});
  }

  return json as ApiResponse<T>;
}

export const TENANT_COINS_REFRESH_EVENT = 'hrayntra:tenant-coins-refresh';
/** Fired after HQ saves AI feature coin costs (same-origin tabs pick this up). */

export function notifyTenantCoinsChanged(detail?: { coins?: number; spent?: number }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TENANT_COINS_REFRESH_EVENT, { detail: detail || {} }));
}

/** Tell Phase 2 tenants (other tabs) to reload AI feature spend costs. */

export function shouldRefreshTenantCoins(path: string, method: string, res: Response): boolean {
  const p = (path.startsWith('/') ? path : `/${path}`).toLowerCase();
  const m = (method || 'GET').toUpperCase();
  const balanceHeader =
    res.headers.get('x-coin-balance') ?? res.headers.get('X-Coin-Balance');
  if (balanceHeader != null && balanceHeader !== '') return true;

  if (p.startsWith('/settings/org/coins')) {
    // Refresh after purchase; skip plain GET (avoids refresh loops)
    return m === 'POST' || m === 'PUT' || m === 'PATCH';
  }
  if (p.startsWith('/ai/')) {
    // History GET/PUT/DELETE should not count as spend
    if (p.includes('/assistant-history')) return false;
    if (p.includes('/workspace-brief/alerts') || p.includes('/workspace-brief/entity-alerts')) {
      return false;
    }
    if (p.includes('/entry-recommendations') && m === 'GET') return false;
    if (p.includes('/workspace-brief') && m === 'GET') return false;
    if (p.includes('/location/search') || p.includes('/location/reverse')) return false;
    return m === 'POST' || m === 'PUT' || m === 'PATCH';
  }
  if (p.includes('/kyc/parse-document')) return m === 'POST';
  return false;
}

export function coinsSpentFromResponse(res: Response, json: any): number | undefined {
  const spentHeader = res.headers.get('x-coins-spent') ?? res.headers.get('X-Coins-Spent');
  if (spentHeader != null && Number.isFinite(Number(spentHeader))) {
    return Number(spentHeader);
  }
  const bodySpent = json?.data?.coinsSpent ?? json?.coinsSpent;
  if (bodySpent != null && Number.isFinite(Number(bodySpent))) {
    return Number(bodySpent);
  }
  return undefined;
}

export function coinBalanceFromResponse(res: Response, json: any): number | undefined {
  const header =
    res.headers.get('x-coin-balance') ?? res.headers.get('X-Coin-Balance');
  if (header != null && header !== '' && Number.isFinite(Number(header))) {
    return Math.max(0, Number(header));
  }
  // Prefer explicit coinBalance from requireCoins middleware (safe on AI payloads).
  const bodyBalance = json?.data?.coinBalance ?? json?.coinBalance;
  if (bodyBalance != null && Number.isFinite(Number(bodyBalance))) {
    return Math.max(0, Number(bodyBalance));
  }
  // Purchase / overview payloads use data.coins as the tenant balance.
  const bodyCoins = json?.data?.coins;
  if (bodyCoins != null && Number.isFinite(Number(bodyCoins))) {
    return Math.max(0, Number(bodyCoins));
  }
  return undefined;
}

export function jsonHasCoinSpend(_res: Response, json: any): boolean {
  return (
    json?.data?.coinBalance != null ||
    json?.coinBalance != null ||
    json?.data?.coinsSpent != null ||
    json?.coinsSpent != null
  );
}

/** Shared by apiFetch + apiFetchFormData so sidenav balance updates without a page reload. */

export function maybeNotifyTenantCoinsChanged(
  path: string,
  method: string,
  res: Response,
  json: any
) {
  if (typeof window === 'undefined') return;
  const hasBodySpend = jsonHasCoinSpend(res, json);
  if (!shouldRefreshTenantCoins(path, method, res) && !hasBodySpend) return;
  notifyTenantCoinsChanged({
    coins: coinBalanceFromResponse(res, json),
    spent: coinsSpentFromResponse(res, json),
  });
}

/** Dispatched when org recruitment / billing visibility cache changes (login, settings save, etc.). */

export let orgSummaryInflight: Promise<void> | null = null;

export let orgSummaryLastAt = 0;

export const ORG_SUMMARY_CLIENT_TTL_MS = 45_000;

export async function apiFetchFormData<T>(
  path: string,
  formData: FormData,
  options: {
    method?: HttpMethod;
    auth?: boolean;
    includeTenantHeader?: boolean;
    signal?: AbortSignal;
    /** Override API host for bulk CV load distribution (must include `/api/v1`). */
    apiBase?: string;
  } = {}
): Promise<ApiResponse<T>> {
  const apiBase = options.apiBase?.replace(/\/$/, '') || resolveApiBaseForPath(path);
  const url = `${apiBase}${path}`;
  const headers: Record<string, string> = {};

  if (debugApiLogs) {
    const entries = Array.from(formData.entries()).slice(0, 10).map(([k, v]) => [k, typeof v === 'string' ? v : typeof v]);
    console.log('[apiFetchFormData] request', { method: options.method || 'POST', path, apiBase, auth: !!options.auth, entries });
  }

  if (options.auth) {
    const token = getAccessToken();
    if (!token) {
      throw new Error('Authentication required. Please log in.');
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const tenantDbName = getTenantDbName();
  if (tenantDbName && (options.auth || options.includeTenantHeader)) {
    headers['x-tenant-db-name'] = tenantDbName;
  }
  const orgUnitId = getActiveOrgUnitIdFromStorage();
  if (orgUnitId && (options.auth || options.includeTenantHeader)) {
    headers['x-org-unit-id'] = orgUnitId;
  }
  if (options.auth || options.includeTenantHeader) {
    attachWorkScopeHeader(headers);
    attachOrgSideHeader(headers);
  }

  const longRunning = isLongRunningApiPath(path);
  const fetchSignal = mergeAbortSignals(
    options.signal,
    longRunning ? LONG_RUNNING_FETCH_TIMEOUT_MS : undefined
  );

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method || 'POST',
      headers,
      body: formData,
      signal: fetchSignal,
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store',
    });
  } catch (fetchError: any) {
    throw normalizeFetchError(fetchError);
  }

  const json = await readApiJson<any>(res);

  if (!res.ok || json?.success === false) {
    if (debugApiLogs) {
      console.warn('[apiFetchFormData] response error', {
        path,
        status: res.status,
        success: json?.success,
        message: json?.message,
        data: summarizeForLog(json?.data),
      });
    }

    // Access JWT expired mid-upload: refresh once and retry the same FormData.
    if (res.status === 401 && options.auth && path !== '/auth/refresh') {
      try {
        const nextAccess = await refreshAccessTokenSingleFlight();
        if (nextAccess) {
          headers.Authorization = `Bearer ${nextAccess}`;
          const retryRes = await fetch(url, {
            method: options.method || 'POST',
            headers,
            body: formData,
            signal: fetchSignal,
            credentials: 'include',
            mode: 'cors',
            cache: 'no-store',
          });
          const retryJson = await readApiJson<any>(retryRes);
          if (retryRes.ok && retryJson?.success !== false) {
            maybeNotifyTenantCoinsChanged(path, options.method || 'POST', retryRes, retryJson);
            return retryJson as ApiResponse<T>;
          }
        }
      } catch {
        /* fall through to throw original error */
      }
    }

    if (
      typeof window !== 'undefined' &&
      (res.status === 402 || json?.data?.code === 'INSUFFICIENT_COINS')
    ) {
      notifyTenantCoinsChanged({
        coins:
          json?.data?.balance != null && Number.isFinite(Number(json.data.balance))
            ? Number(json.data.balance)
            : undefined,
      });
    }
    throw createHttpApiError(res.status, json?.message || `Request failed with status ${res.status}`, {
      data: json?.data,
      raw: json,
    });
  }

  maybeNotifyTenantCoinsChanged(path, options.method || 'POST', res, json);

  if (debugApiLogs) {
    console.log('[apiFetchFormData] response ok', {
      path,
      status: res.status,
      success: json?.success,
      message: json?.message,
      data: summarizeForLog(json?.data),
      pagination: json?.pagination,
    });
  }

  if (typeof window !== 'undefined' && res.ok && json?.success !== false) {
    import('../tenant-behavior-engine/track').then(({ trackTenantApiCall }) => {
      trackTenantApiCall(path, options.method || 'POST');
    }).catch(() => {});
  }

  return json as ApiResponse<T>;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  loginId?: string;
  role?: string;
  roleName?: string;
  roleColor?: string;
  hqTeamMemberId?: string;
}

export interface AuthPayload {
  user: AuthUser;
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  permissions?: string[];
  requirePasswordReset?: boolean;
  requiresLogin?: boolean;
  tenantDbName?: string;
  tenantDatabaseUrl?: string;
  tenantProvisioningStatus?: 'CREATED' | 'READY';
  message?: string;
  duplicateSession?: boolean;
  activeSession?: {
    sessionId?: string;
    browserInfo?: string;
    operatingSystem?: string;
    deviceType?: string;
    macAddress?: string;
    location?: string;
    deviceLabel?: string;
  };
}

export function applyTenantDbNameFromUrl() {
  if (typeof window === 'undefined') return;
  const fromUrl = new URLSearchParams(window.location.search).get('tenantDbName');
  if (fromUrl) {
    syncTenantDbName(fromUrl);
  }
}

export const PERMISSIONS_REFRESH_MIN_INTERVAL_MS = 5_000;

export let permissionsRefreshInFlight: Promise<MyPermissionsPayload | null> | null = null;

export let permissionsRefreshLastAt = 0;

export let permissionsRefreshLastResult: MyPermissionsPayload | null = null;

export function resolvePhase1CandidatePortalBase(): string | null {
  const envBase =
    process.env.NEXT_PUBLIC_PHASE1_FRONTEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_JOB_PORTAL_URL?.trim() ||
    '';
  if (envBase) return envBase.replace(/\/$/, '');
  if (typeof window === 'undefined') return null;

  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3000`;
  }
  if (hostname.endsWith('.hryantra.com')) {
    return `${protocol}//hryantra.com`;
  }
  return `${protocol}//${hostname}`;
}

export function parseInboxThreadList(raw: unknown): InboxThread[] {
  if (Array.isArray(raw)) return raw as InboxThread[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: InboxThread[] }).data;
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) {
    return (raw as { items: InboxThread[] }).items;
  }
  return [];
}

// Get (at most one) chat thread for an entity, if it exists

export const NOTIFICATION_TRIGGER_SETTINGS_KEY = 'notification_email_trigger_points_v1';

export let tenantCoinsInflight: Promise<{
  coins: number;
  planName: string | null;
  features: HqAiFeature[];
  packs: AiCoinPack[];
}> | null = null;

export let tenantCoinsCache: {
  at: number;
  data: {
    coins: number;
    planName: string | null;
    features: HqAiFeature[];
    packs: AiCoinPack[];
  };
} | null = null;

export const TENANT_COINS_CLIENT_TTL_MS = 45_000;

export function buildTrashQuery(opts: { page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/* W2 split: ESM-safe accessors for mutable module state */
export function getRefreshInFlight() { return refreshInFlight; }
export function setRefreshInFlight(value: typeof refreshInFlight) { refreshInFlight = value; }
export function getOrgSummaryInflight() { return orgSummaryInflight; }
export function setOrgSummaryInflight(value: typeof orgSummaryInflight) { orgSummaryInflight = value; }
export function getOrgSummaryLastAt() { return orgSummaryLastAt; }
export function setOrgSummaryLastAt(value: typeof orgSummaryLastAt) { orgSummaryLastAt = value; }
export function getPermissionsRefreshInFlight() { return permissionsRefreshInFlight; }
export function setPermissionsRefreshInFlight(value: typeof permissionsRefreshInFlight) { permissionsRefreshInFlight = value; }
export function getPermissionsRefreshLastAt() { return permissionsRefreshLastAt; }
export function setPermissionsRefreshLastAt(value: typeof permissionsRefreshLastAt) { permissionsRefreshLastAt = value; }
export function getPermissionsRefreshLastResult() { return permissionsRefreshLastResult; }
export function setPermissionsRefreshLastResult(value: typeof permissionsRefreshLastResult) { permissionsRefreshLastResult = value; }
export function getTenantCoinsInflight() { return tenantCoinsInflight; }
export function setTenantCoinsInflight(value: typeof tenantCoinsInflight) { tenantCoinsInflight = value; }
export function getTenantCoinsCache() { return tenantCoinsCache; }
export function setTenantCoinsCache(value: typeof tenantCoinsCache) { tenantCoinsCache = value; }
