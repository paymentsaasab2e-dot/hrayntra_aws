/* Simple API client for talking to the Express backend */

import {
  createHttpApiError,
  normalizeFetchError,
  readApiJson,
} from './apiNetworkErrors';
import { CONNECTION_STATUS, formatPortalStatusLine } from './portalStatusCopy';
import type {
  BillingSettingsSnapshot,
  CreatePlacementInvoicePayload,
} from '../types/recruitmentInvoice';
import type {
  CreatePlacementPayload,
  MarkFailedPayload,
  MarkJoinedPayload,
  PaginatedResponse as PlacementPaginatedResponse,
  Placement,
  PlacementFilters,
  PlacementStats,
  RequestReplacementPayload,
  ScheduleJoiningPayload,
} from '../types/placement';
import type { PostServiceKycFormValues } from './clientKycForm';
import type { InterviewClientReviewContext } from './clientReviewTypes';
import { cacheClientPageFieldVisibility, normalizeClientPageFieldVisibility } from './clientPageFieldVisibility';

export type { BillingSettingsSnapshot, CreatePlacementInvoicePayload };

const LOCAL_API_BASE = 'http://127.0.0.1:5001/api/v1';
const PRODUCTION_API_BASE = 'https://api2.hryantra.com/api/v1';
const PROD_PROXY_BASE = '/api/proxy';

const isLocalBrowser =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local'));

/** Paths that can exceed the Next.js/Vercel proxy limit (e.g. large or slow DOCX parsing). */
const LONG_RUNNING_API_PATH_PREFIXES = [
  '/candidates/bulk-cv/',
  '/candidates/parse-resume',
  '/candidates/bulk-import',
  '/jobs/process-jd-file',
  '/hq/portal/jobs/push-to-feeds',
  '/agreements/parse-document',
  '/kyc/parse-document',
];

function isLongRunningApiPath(path: string): boolean {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return LONG_RUNNING_API_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix)
  );
}

const LONG_RUNNING_FETCH_TIMEOUT_MS = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_LONG_RUNNING_FETCH_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10 * 60 * 1000;
})();

function mergeAbortSignals(
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
function shouldUseProductionProxy(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false;
  return (
    host.endsWith('.hryantra.com') ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.hryantra.com')
  );
}

function resolveApiBase(): string {
  if (isLocalBrowser) return LOCAL_API_BASE;
  if (shouldUseProductionProxy()) return PROD_PROXY_BASE;
  const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicApi) return publicApi.replace(/\/$/, '');
  return PROD_PROXY_BASE;
}

/** Direct backend URL for uploads/parsing — avoids same-origin proxy timeouts on slow files. */
function resolveDirectApiBase(): string {
  if (isLocalBrowser) return LOCAL_API_BASE;
  const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicApi) return publicApi.replace(/\/$/, '');
  return PRODUCTION_API_BASE;
}

function resolveApiBaseForPath(path: string): string {
  if (isLongRunningApiPath(path)) return resolveDirectApiBase();
  return resolveApiBase();
}

const API_BASE = resolveApiBase();

/** User-facing message for login/signup failures (maps backend + proxy errors). */
export function formatAuthErrorMessage(
  err: { status?: number; message?: string } | null | undefined,
  fallback = 'Failed to sign in. Please try again.'
): string {
  const status = err?.status;
  const raw = String(err?.message || '').trim();
  const lowered = raw.toLowerCase();

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
export function buildSocketBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const local =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local');
  if (local) return 'http://127.0.0.1:5001';
  const fromEnv = typeof process.env.NEXT_PUBLIC_SOCKET_URL === 'string' && process.env.NEXT_PUBLIC_SOCKET_URL.trim();
  return fromEnv || 'https://api2.hryantra.com';
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

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

export function getTenantDbName() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('tenantDbName');
  } catch (error) {
    console.error('Error accessing localStorage tenantDbName:', error);
    return null;
  }
}

function getActiveOrgUnitIdFromStorage() {
  if (typeof window === 'undefined') return '';
  try {
    return String(localStorage.getItem('activeOrgUnitId') || '').trim();
  } catch {
    return '';
  }
}

function getSuperAdminWorkScopeFromStorage(): 'own' | 'all' {
  if (typeof window === 'undefined') return 'all';
  try {
    const raw = String(localStorage.getItem('superAdminWorkScope') || 'all').trim().toLowerCase();
    return raw === 'own' ? 'own' : 'all';
  } catch {
    return 'all';
  }
}

function attachWorkScopeHeader(headers: Record<string, string>) {
  if (getSuperAdminWorkScopeFromStorage() === 'own') {
    headers['x-work-scope'] = 'own';
  }
}

/** Persist workspace DB name so API calls (including login) send `x-tenant-db-name`. */
export function syncTenantDbName(value: string | null | undefined) {
  if (typeof window === 'undefined') return;

  const normalized = String(value || '').trim();
  if (!normalized) {
    localStorage.removeItem('tenantDbName');
    document.cookie = `tenantDbName=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }

  localStorage.setItem('tenantDbName', normalized);
  document.cookie = `tenantDbName=${encodeURIComponent(normalized)}; Path=/; SameSite=Lax`;
}

export function syncAuthCookie(name: string, value: string | null) {
  if (typeof document === 'undefined') return;

  if (!value) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

const debugApiLogs =
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_DEBUG_LOGS === 'true') ||
  process.env.NODE_ENV === 'development';

/** Public pages that must never hard-redirect to /login on missing/expired auth. */
function isPublicUnauthenticatedPath(pathname?: string) {
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
    path === '/hq/login' ||
    path.startsWith('/hq/login/')
  );
}

const debugApiLogsFull = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_DEBUG_LOGS_FULL === 'true';

function summarizeForLog(value: unknown) {
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
      // Try to refresh the token automatically
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
      
      if (refreshToken && path !== '/auth/refresh') {
        try {
          // Attempt to refresh the token
          const refreshResponse = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
            method: 'POST',
            body: { refreshToken },
            auth: false,
            includeTenantHeader: true,
          });

          if (refreshResponse.data.accessToken) {
            // Store new tokens
            if (typeof window !== 'undefined') {
              localStorage.setItem('accessToken', refreshResponse.data.accessToken);
              if (refreshResponse.data.refreshToken) {
                localStorage.setItem('refreshToken', refreshResponse.data.refreshToken);
              }
              syncAuthCookie('accessToken', refreshResponse.data.accessToken);
              syncAuthCookie('refreshToken', refreshResponse.data.refreshToken || refreshToken);
            }

            // Retry the original request with new token
            const newHeaders = { ...headers };
            newHeaders.Authorization = `Bearer ${refreshResponse.data.accessToken}`;
            
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
          // Refresh failed, proceed to clear tokens and redirect
          console.error('Token refresh failed:', refreshError);
        }
      }

      const sessionCode = json?.data?.code as string | undefined;
      const sessionEnded =
        sessionCode === 'SESSION_SUPERSEDED' ||
        sessionCode === 'SESSION_EXPIRED' ||
        sessionCode === 'SESSION_INVALID' ||
        /session.*(expired|no longer active)/i.test(String(json?.message || ''));

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
      ? formatAuthErrorMessage({ status: res.status, message: detailedMsg }, detailedMsg)
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
    import('./tenant-behavior-engine/track').then(({ trackTenantApiCall }) => {
      trackTenantApiCall(path, options.method || 'GET', options.body);
    }).catch(() => {});
  }

  return json as ApiResponse<T>;
}

export const TENANT_COINS_REFRESH_EVENT = 'hrayntra:tenant-coins-refresh';
/** Fired after HQ saves AI feature coin costs (same-origin tabs pick this up). */
export const AI_FEATURE_COSTS_UPDATED_EVENT = 'hrayntra:ai-feature-costs-updated';
export const AI_FEATURE_COSTS_UPDATED_STORAGE_KEY = 'hrayntra:ai-feature-costs-updated-at';

/** Notify UI to refresh AI coin balance (optional known balance for instant update). */
export function notifyTenantCoinsChanged(detail?: { coins?: number; spent?: number }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TENANT_COINS_REFRESH_EVENT, { detail: detail || {} }));
}

/** Tell Phase 2 tenants (other tabs) to reload AI feature spend costs. */
export function notifyAiFeatureCostsUpdated(detail?: {
  updatedAt?: string;
  changed?: Array<{ id: string; name?: string; previous?: number; coins?: number }>;
}) {
  if (typeof window === 'undefined') return;
  const payload = {
    updatedAt: detail?.updatedAt || new Date().toISOString(),
    changed: detail?.changed || [],
  };
  try {
    localStorage.setItem(AI_FEATURE_COSTS_UPDATED_STORAGE_KEY, payload.updatedAt);
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new CustomEvent(AI_FEATURE_COSTS_UPDATED_EVENT, { detail: payload }));
}

function shouldRefreshTenantCoins(path: string, method: string, res: Response): boolean {
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

function coinsSpentFromResponse(res: Response, json: any): number | undefined {
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

function coinBalanceFromResponse(res: Response, json: any): number | undefined {
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

function jsonHasCoinSpend(_res: Response, json: any): boolean {
  return (
    json?.data?.coinBalance != null ||
    json?.coinBalance != null ||
    json?.data?.coinsSpent != null ||
    json?.coinsSpent != null
  );
}

/** Shared by apiFetch + apiFetchFormData so sidenav balance updates without a page reload. */
function maybeNotifyTenantCoinsChanged(
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
export const ORG_RECRUITMENT_CACHE_EVENT = 'hrayntra:org-recruitment-cache';

export function getCachedOrgRecruitmentMode(): 'agency' | 'standalone' {
  if (typeof window === 'undefined') return 'agency';
  return localStorage.getItem('orgRecruitmentMode') === 'standalone' ? 'standalone' : 'agency';
}

/** When unset, billing nav is shown (matches legacy agency behavior). */
export function isOrgBillingNavEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('orgBillingEnabled') !== '0';
}

export function getCachedOrgSubscriptionPlanName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('orgSubscriptionPlanName') || '';
}

export type OrgPlanUsageCache = {
  activeJobs: number;
  activeUsers: number;
  maxJobs: number | null;
  maxUsers: number | null;
};

export function getCachedOrgPlanUsage(): OrgPlanUsageCache | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('orgPlanUsage');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OrgPlanUsageCache;
  } catch {
    return null;
  }
}

/** Tenant-wide default currency code (ISO 4217). Falls back to USD when unset. */
export function getCachedOrgDefaultCurrency(): string {
  if (typeof window === 'undefined') return 'USD';
  const v = localStorage.getItem('orgDefaultCurrency');
  return v && v.length === 3 ? v.toUpperCase() : 'USD';
}

/** When false, HQ has not restricted tabs — Phase 2 shows all RBAC-allowed modules. */
export function isOrgModulesRestricted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('orgModulesRestricted') === '1';
}

export function getCachedOrgEnabledModules(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('orgEnabledModules');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((m) => String(m || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

/** HQ module gate for Phase 2 sidenav / routes. Unrestricted tenants always return true. */
export function isOrgModuleEnabled(moduleId: string): boolean {
  if (!moduleId) return true;
  if (!isOrgModulesRestricted()) return true;
  const list = getCachedOrgEnabledModules();
  if (list.length === 0) return false;
  return list.includes(moduleId);
}

/**
 * Phase 1 (Hrayntra candidatecommon) access for this tenant.
 * Missing cache → true (legacy tenants keep All candidates + Phase 1 pool).
 */
export function getCachedPhase1CommonPoolEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem('orgPhase1CommonPoolEnabled');
  if (raw === null || raw === '') return true;
  return raw !== '0' && raw !== 'false';
}

export function getCachedTenantPaused(): { paused: boolean; pausedAt: string | null } {
  if (typeof window === 'undefined') return { paused: false, pausedAt: null };
  return {
    paused: localStorage.getItem('orgTenantPaused') === '1',
    pausedAt: localStorage.getItem('orgTenantPausedAt') || null,
  };
}

export function applyOrgRecruitmentSummaryPayload(
  payload:
    | {
        recruitmentMode?: string;
        billingEnabled?: boolean;
        subscriptionPlan?: HqTenantSubscriptionPlan | null;
        planUsage?: OrgPlanUsageCache | null;
        defaultCurrency?: string | null;
        tenantPaused?: boolean;
        tenantPausedAt?: string | null;
        productLine?: string | null;
        enabledModules?: string[] | null;
        modulesRestricted?: boolean;
        phase1CommonPoolEnabled?: boolean;
        organizationName?: string | null;
        companyName?: string | null;
        clientPageFieldVisibility?: {
          interestLevel?: boolean;
          status?: boolean;
          assignedTo?: boolean;
        } | null;
      }
    | null
    | undefined
): void {
  if (typeof window === 'undefined') return;
  const mode = payload?.recruitmentMode === 'standalone' ? 'standalone' : 'agency';
  const billing = payload?.billingEnabled !== false;
  localStorage.setItem('orgRecruitmentMode', mode);
  localStorage.setItem('orgBillingEnabled', billing ? '1' : '0');
  const planName = String(payload?.subscriptionPlan?.name || '').trim();
  if (planName) {
    localStorage.setItem('orgSubscriptionPlanName', planName);
  } else {
    localStorage.removeItem('orgSubscriptionPlanName');
  }
  const sp = payload?.subscriptionPlan as
    | {
        name?: string;
        planStartDate?: string;
        planEndDate?: string;
        isTrial?: boolean;
        trialDays?: number;
      }
    | null
    | undefined;
  if (sp && (sp.name || sp.planStartDate || sp.planEndDate)) {
    localStorage.setItem(
      'orgSubscriptionPlan',
      JSON.stringify({
        name: sp.name || planName || undefined,
        planStartDate: sp.planStartDate || undefined,
        planEndDate: sp.planEndDate || undefined,
        isTrial: Boolean(sp.isTrial),
        trialDays: sp.trialDays ?? undefined,
      })
    );
  } else {
    localStorage.removeItem('orgSubscriptionPlan');
  }
  if (payload?.planUsage) {
    localStorage.setItem(
      'orgPlanUsage',
      JSON.stringify({
        activeJobs: Number(payload.planUsage.activeJobs) || 0,
        activeUsers: Number(payload.planUsage.activeUsers) || 0,
        maxJobs: payload.planUsage.maxJobs ?? null,
        maxUsers: payload.planUsage.maxUsers ?? null,
      })
    );
  }
  const currency = String(payload?.defaultCurrency || '').trim().toUpperCase();
  if (currency && currency.length === 3) {
    localStorage.setItem('orgDefaultCurrency', currency);
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'clientPageFieldVisibility')) {
    cacheClientPageFieldVisibility(
      normalizeClientPageFieldVisibility(payload.clientPageFieldVisibility),
    );
  }
  if (
    payload &&
    (Object.prototype.hasOwnProperty.call(payload, 'modulesRestricted') ||
      Object.prototype.hasOwnProperty.call(payload, 'enabledModules'))
  ) {
    const modules = Array.isArray(payload.enabledModules)
      ? payload.enabledModules.map((m) => String(m || '').trim()).filter(Boolean)
      : [];
    const restricted =
      payload.modulesRestricted === true ||
      modules.length > 0;
    localStorage.setItem('orgModulesRestricted', restricted ? '1' : '0');
    localStorage.setItem('orgEnabledModules', JSON.stringify(modules));
    const line = String(payload.productLine || '').trim().toLowerCase();
    if (line === 'crm' || line === 'recruitment') {
      localStorage.setItem('orgProductLine', line);
    } else if (Object.prototype.hasOwnProperty.call(payload, 'productLine')) {
      localStorage.removeItem('orgProductLine');
    }
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'phase1CommonPoolEnabled')) {
    localStorage.setItem(
      'orgPhase1CommonPoolEnabled',
      payload.phase1CommonPoolEnabled === false ? '0' : '1',
    );
  }
  if (payload?.tenantPaused) {
    localStorage.setItem('orgTenantPaused', '1');
    if (payload.tenantPausedAt) {
      localStorage.setItem('orgTenantPausedAt', String(payload.tenantPausedAt));
    } else {
      localStorage.removeItem('orgTenantPausedAt');
    }
  } else if (payload && Object.prototype.hasOwnProperty.call(payload, 'tenantPaused')) {
    localStorage.setItem('orgTenantPaused', '0');
    localStorage.removeItem('orgTenantPausedAt');
  }
  const orgName = String(payload?.organizationName || payload?.companyName || '').trim();
  if (orgName) {
    try {
      const raw = localStorage.getItem('currentUser');
      const current = raw ? JSON.parse(raw) : {};
      if (current && typeof current === 'object') {
        localStorage.setItem(
          'currentUser',
          JSON.stringify({ ...current, organizationName: orgName, companyName: orgName }),
        );
      }
    } catch {
      /* ignore corrupt currentUser */
    }
  }
  window.dispatchEvent(new CustomEvent(ORG_RECRUITMENT_CACHE_EVENT));
}

/** Refreshes org recruitment mode + billing flags + plan after login or when settings change. */
export async function syncOrgRecruitmentSummaryFromApi(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!getAccessToken()) return;
  try {
    const res = await apiFetch<{
      recruitmentMode?: string;
      billingEnabled?: boolean;
      subscriptionPlan?: HqTenantSubscriptionPlan | null;
      planUsage?: OrgPlanUsageCache | null;
      tenantPaused?: boolean;
      tenantPausedAt?: string | null;
      defaultCurrency?: string | null;
      productLine?: string | null;
      enabledModules?: string[] | null;
      modulesRestricted?: boolean;
      phase1CommonPoolEnabled?: boolean;
      organizationName?: string | null;
      companyName?: string | null;
      clientPageFieldVisibility?: {
        interestLevel?: boolean;
        status?: boolean;
        assignedTo?: boolean;
      };
    }>('/settings/org/recruitment-summary', { auth: true });
    applyOrgRecruitmentSummaryPayload(res.data as Parameters<typeof applyOrgRecruitmentSummaryPayload>[0]);
  } catch {
    applyOrgRecruitmentSummaryPayload({ recruitmentMode: 'agency', billingEnabled: true, subscriptionPlan: null });
  }
}

/** Tenant own-company record used when creating jobs for this organization. */
export async function apiGetWorkspaceClient(): Promise<{
  data?: {
    recruitmentMode?: string;
    workspaceClient?: BackendClient | null;
  };
}> {
  return apiFetch('/settings/org/workspace-client', { auth: true });
}

export function isOwnCompanyWorkspaceClient(
  client?: { website?: string | null; industry?: string | null } | null,
): boolean {
  if (!client) return false;
  return (
    String(client.website || '').startsWith('tenant://') ||
    String(client.industry || '') === 'Workspace'
  );
}

export async function apiGetClientPageFieldVisibility() {
  return apiFetch<{
    clientPageFieldVisibility: {
      interestLevel: boolean;
      status: boolean;
      assignedTo: boolean;
    };
    defaults: {
      interestLevel: boolean;
      status: boolean;
      assignedTo: boolean;
    };
  }>('/settings/org/client-page-fields', { auth: true });
}

export async function apiSetClientPageFieldVisibility(fields: {
  interestLevel?: boolean;
  status?: boolean;
  assignedTo?: boolean;
}) {
  const res = await apiFetch<{
    clientPageFieldVisibility: {
      interestLevel: boolean;
      status: boolean;
      assignedTo: boolean;
    };
  }>('/settings/org/client-page-fields', {
    method: 'PUT',
    auth: true,
    body: { clientPageFieldVisibility: fields },
  });
  if (typeof window !== 'undefined' && res.data?.clientPageFieldVisibility) {
    cacheClientPageFieldVisibility(normalizeClientPageFieldVisibility(res.data.clientPageFieldVisibility));
    window.dispatchEvent(new CustomEvent(ORG_RECRUITMENT_CACHE_EVENT));
  }
  return res;
}

/** Tenant-wide table Columns prefs (synced across browsers). */
export async function apiGetTableColumnVisibility() {
  return apiFetch<{ columns: Record<string, string[]> }>('/settings/org/table-columns', {
    auth: true,
  });
}

export async function apiSetTableColumnModuleVisibility(
  moduleKey: string,
  visibleIds: string[],
) {
  return apiFetch<{ columns: Record<string, string[]>; moduleKey: string }>(
    '/settings/org/table-columns',
    {
      method: 'PUT',
      auth: true,
      body: { moduleKey, visibleIds },
    },
  );
}

export async function apiGetOrgDefaultCurrency() {
  return apiFetch<{ code: string; supportedCurrencies: string[]; fallback: string }>(
    '/settings/org/default-currency',
    { auth: true }
  );
}

export async function apiGetOrgCommissionSlabs() {
  return apiFetch<{
    commissionSlabs: import('./commissionSlabs').CommissionSlabSettings;
    defaults: import('./commissionSlabs').CommissionSlabSettings;
  }>('/settings/org/commission-slabs', { auth: true });
}

export async function apiSetOrgCommissionSlabs(
  commissionSlabs: import('./commissionSlabs').CommissionSlabSettings,
) {
  return apiFetch<{ commissionSlabs: import('./commissionSlabs').CommissionSlabSettings }>(
    '/settings/org/commission-slabs',
    { method: 'PUT', auth: true, body: { commissionSlabs } },
  );
}

export async function apiSetOrgDefaultCurrency(code: string) {
  const res = await apiFetch<{ code: string }>('/settings/org/default-currency', {
    method: 'PUT',
    auth: true,
    body: { code },
  });
  // Push the new currency into local cache + broadcast so every open tab
  // (Billing, Dashboard, Candidate "expected pay", etc.) refreshes its formatter.
  if (typeof window !== 'undefined') {
    const next = String(res.data?.code || code || '').trim().toUpperCase();
    if (next && next.length === 3) {
      localStorage.setItem('orgDefaultCurrency', next);
      window.dispatchEvent(new CustomEvent(ORG_RECRUITMENT_CACHE_EVENT));
    }
  }
  return res;
}

export interface HqSubscriptionPackage {
  id: string;
  slug: string;
  name: string;
  displayName?: string;
  description: string;
  price?: string;
  yearlyPrice?: string;
  pricePeriod?: string;
  features?: string[];
  isPopular?: boolean;
  maxUsers: number | null;
  maxJobs: number | null;
  annualMaxUsers?: number | null;
  annualMaxJobs?: number | null;
  isSystem: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type SubscriptionPlanOption = HqSubscriptionPackage;

export interface HqTenantSubscriptionPlan {
  id?: string;
  name: string;
  billingCycle?: 'monthly' | 'annual';
  maxUsers?: number | null;
  maxJobs?: number | null;
  planStartDate?: string;
  planEndDate?: string;
  isTrial?: boolean;
  trialDays?: number;
  upgradedAt?: string;
  upgradedFrom?: string;
  lastPaymentReference?: string;
  purchasedAt?: string;
  employerDemoRequestId?: string;
  upgradedBy?: string;
  coins?: number;
  price?: string;
}

export async function apiGetSubscriptionPlan() {
  return apiFetch<{
    plan: HqTenantSubscriptionPlan | null;
    planUsage?: {
      activeJobs: number;
      activeUsers: number;
      maxJobs: number | null;
      maxUsers: number | null;
      jobsRemaining: number | null;
      usersRemaining: number | null;
    };
    options: SubscriptionPlanOption[];
    upgradeOptions?: {
      currentPlan: HqTenantSubscriptionPlan | null;
      upgradePackages: SubscriptionPlanOption[];
      canUpgrade: boolean;
    };
  }>('/settings/org/subscription-plan', { auth: true });
}

export async function apiUpgradeSubscriptionPlan(body: {
  packageId: string;
  billingCycle: 'monthly' | 'annual';
  paymentReference?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}) {
  return apiFetch<{
    plan: HqTenantSubscriptionPlan;
    planUsage?: {
      activeJobs: number;
      activeUsers: number;
      maxJobs: number | null;
      maxUsers: number | null;
      jobsRemaining: number | null;
      usersRemaining: number | null;
    };
  }>('/settings/org/subscription-plan/upgrade', {
    method: 'POST',
    auth: true,
    body,
  });
}

export type SubscriptionPaymentOrder = {
  mode?: 'clone' | 'live';
  orderId: string;
  amount: number;
  amountPaise: number;
  amountInr?: string;
  currency: string;
  keyId?: string;
  merchantName: string;
  merchantUpi: string;
  packageName: string;
  billingCycle: 'monthly' | 'annual';
  packageId: string;
  description: string;
  upiPayLink?: string;
};

export async function apiCreateSubscriptionPaymentOrder(body: {
  packageId: string;
  billingCycle: 'monthly' | 'annual';
}) {
  return apiFetch<SubscriptionPaymentOrder>('/settings/org/subscription-plan/payment-order', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiGetRazorpayConfig() {
  return apiFetch<{
    enabled: boolean;
    mode?: 'clone' | 'live';
    keyId: string;
    merchantName: string;
    merchantUpi: string;
    currency: string;
  }>('/settings/org/subscription-plan/razorpay-config', { auth: true });
}

export async function apiSetSubscriptionPlan(plan: { name: string }) {
  return apiFetch<{ plan: { name: string } }>('/settings/org/subscription-plan', {
    method: 'PUT',
    auth: true,
    body: { plan },
  });
}

export async function apiGetCompanyServices() {
  return apiFetch<{
    services: string[];
    recommended?: string[];
    defaults?: string[];
    aiEnabled?: boolean;
  }>('/settings/org/company-services', { auth: true });
}

export type IndustrySuggestionSource = 'history' | 'catalog' | 'ai';

export interface IndustrySuggestion {
  label: string;
  source: IndustrySuggestionSource;
}

export async function apiSuggestIndustries(params: {
  q?: string;
  selected?: string[];
  limit?: number;
  companyName?: string;
}) {
  const sp = new URLSearchParams();
  const q = String(params.q ?? '').trim();
  if (q) sp.set('q', q);
  if (params.companyName?.trim()) sp.set('companyName', params.companyName.trim());
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.selected?.length) sp.set('selected', params.selected.join(';'));
  const qs = sp.toString();
  return apiFetch<{
    suggestions: IndustrySuggestion[];
    aiEnabled: boolean;
  }>(`/settings/org/industries/suggest${qs ? `?${qs}` : ''}`, { auth: true });
}

export type LanguageSuggestionSource = 'history' | 'catalog' | 'ai';

export interface LanguageSuggestion {
  label: string;
  source: LanguageSuggestionSource;
}

export async function apiSuggestLanguages(params: {
  q?: string;
  selected?: string[];
  limit?: number;
  jobTitle?: string;
}) {
  const sp = new URLSearchParams();
  const q = String(params.q ?? '').trim();
  if (q) sp.set('q', q);
  if (params.jobTitle?.trim()) sp.set('jobTitle', params.jobTitle.trim());
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.selected?.length) sp.set('selected', params.selected.join(';'));
  const qs = sp.toString();
  return apiFetch<{
    suggestions: LanguageSuggestion[];
    aiEnabled: boolean;
  }>(`/settings/org/languages/suggest${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function apiSuggestProficiencies(params: {
  q?: string;
  selected?: string[];
  limit?: number;
  language?: string;
}) {
  const sp = new URLSearchParams();
  const q = String(params.q ?? '').trim();
  if (q) sp.set('q', q);
  if (params.language?.trim()) sp.set('language', params.language.trim());
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.selected?.length) sp.set('selected', params.selected.join(';'));
  const qs = sp.toString();
  return apiFetch<{
    suggestions: LanguageSuggestion[];
    aiEnabled: boolean;
  }>(`/settings/org/proficiencies/suggest${qs ? `?${qs}` : ''}`, { auth: true });
}

export type CompanyServiceSuggestionSource = 'history' | 'catalog' | 'ai';

export interface CompanyServiceSuggestion {
  label: string;
  source: CompanyServiceSuggestionSource;
}

export async function apiSuggestCompanyServices(params: {
  q?: string;
  selected?: string[];
  limit?: number;
  industry?: string;
}) {
  const sp = new URLSearchParams();
  const q = String(params.q ?? '').trim();
  if (q) sp.set('q', q);
  if (params.industry?.trim()) sp.set('industry', params.industry.trim());
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.selected?.length) sp.set('selected', params.selected.join(';'));
  const qs = sp.toString();
  return apiFetch<{
    suggestions: CompanyServiceSuggestion[];
    aiEnabled: boolean;
  }>(`/settings/org/company-services/suggest${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function apiSetCompanyServices(services: string[]) {
  return apiFetch<{ services: string[] }>('/settings/org/company-services', {
    method: 'PUT',
    auth: true,
    body: { services },
  });
}

export async function apiAppendCompanyService(service: string) {
  return apiFetch<{ services: string[] }>('/settings/org/company-services/append', {
    method: 'POST',
    auth: true,
    body: { service },
  });
}

export interface StatusCatalogResponse {
  statuses: string[];
  defaults?: string[];
  custom?: string[];
}

export async function apiGetLeadStatusCatalog() {
  return apiFetch<StatusCatalogResponse>('/settings/org/lead-statuses', { auth: true });
}

export async function apiAppendLeadStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/lead-statuses/append', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiRemoveLeadStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/lead-statuses/remove', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiGetJobStatusCatalog() {
  return apiFetch<StatusCatalogResponse>('/settings/org/job-statuses', { auth: true });
}

export async function apiAppendJobStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/job-statuses/append', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiRemoveJobStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/job-statuses/remove', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiGetClientLeadStatusCatalog() {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-lead-statuses', { auth: true });
}

export async function apiAppendClientLeadStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-lead-statuses/append', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiRemoveClientLeadStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-lead-statuses/remove', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiGetClientPriorityCatalog() {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-priorities', { auth: true });
}

export async function apiAppendClientPriority(priority: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-priorities/append', {
    method: 'POST',
    auth: true,
    body: { priority },
  });
}

export async function apiRemoveClientPriority(priority: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-priorities/remove', {
    method: 'POST',
    auth: true,
    body: { priority },
  });
}

export async function apiGetAgreementLevelCatalog() {
  return apiFetch<StatusCatalogResponse>('/settings/org/agreement-levels', { auth: true });
}

export async function apiAppendAgreementLevel(level: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/agreement-levels/append', {
    method: 'POST',
    auth: true,
    body: { level },
  });
}

export async function apiRemoveAgreementLevel(level: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/agreement-levels/remove', {
    method: 'POST',
    auth: true,
    body: { level },
  });
}

export async function apiApplyPipelineTemplateToEmptyJobs() {
  return apiFetch<{
    updatedJobs: number;
    emptySeeded?: number;
    legacyReseeded?: number;
    removedStages?: number;
  }>('/settings/org/pipeline-template/apply-to-empty-jobs', { method: 'POST', auth: true, body: {} });
}

export async function apiResetJobPipelineToOrgTemplate(jobId: string) {
  return apiFetch<{ stages: Array<{ id: string; name: string; order: number; color?: string | null; systemRole?: string | null }> }>(
    `/settings/org/pipeline-template/apply-to-job/${jobId}`,
    { method: 'POST', auth: true, body: {} }
  );
}

export async function apiHqProvisionTenant(body: {
  name: string;
  organizationName?: string;
  email: string;
  loginId: string;
  password: string;
  organizationType?: 'agency' | 'standalone';
  billingCycle?: 'monthly' | 'annual';
  planStartDate?: string;
  planEndDate?: string;
  /** Phase 2 workspace line: CRM or Recruitment */
  productLine?: 'crm' | 'recruitment';
  /** Enabled Phase 2 sidebar module ids for this tenant */
  enabledModules?: string[];
  /** When true, All candidates includes Phase 1 (Hrayntra) candidatecommon pool. Default true. */
  phase1CommonPoolEnabled?: boolean;
  /** Optional HQ company id (Lead → Client → Company funnel) */
  companyId?: string;
  plan?: {
    id?: string;
    name?: string;
    billingCycle?: 'monthly' | 'annual';
    planStartDate?: string;
    planEndDate?: string;
    price?: string;
    maxUsers?: number | null;
    maxJobs?: number | null;
    coins?: number;
  };
}) {
  return apiFetch<{
    tenantDbName?: string;
    tenantDatabaseUrl?: string;
    tenantProvisioningMode?: string;
    organizationType?: string;
    productLine?: 'crm' | 'recruitment';
    enabledModules?: string[];
    phase1CommonPoolEnabled?: boolean;
    subscriptionPlan?: { name: string } | null;
    user?: { id: string; email: string; loginId: string };
    companyId?: string | null;
  }>('/hq/provision-tenant', { method: 'POST', auth: true, body });
}

export interface HqTenantRow {
  id: string;
  name: string;
  email: string;
  loginId: string;
  organizationType: 'agency' | 'standalone';
  organizationName?: string;
  signupSource?: 'landing_purchase' | 'landing_trial' | 'hq_manual' | string;
  productLine?: 'crm' | 'recruitment' | string;
  enabledModules?: string[];
  modulesRestricted?: boolean;
  /** When false, Phase 2 All candidates hides Phase 1 common pool. Default true. */
  phase1CommonPoolEnabled?: boolean;
  subscriptionPlan: HqTenantSubscriptionPlan | null;
  tenantDbName: string;
  tenantProvisioningMode: string;
  status?: string;
  pausedAt?: string | null;
  pausedBy?: string;
  createdAt: string | null;
  updatedAt: string | null;
  isLandingSignupOnly?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string;
  source?: 'tenant' | 'landing' | string;
}

export async function apiHqListPackages() {
  return apiFetch<{
    packages: HqSubscriptionPackage[];
  }>('/hq/packages', { auth: true });
}

export async function apiHqCreatePackage(body: {
  name: string;
  displayName?: string;
  description?: string;
  price?: string;
  yearlyPrice?: string;
  pricePeriod?: string;
  features?: string[];
  isPopular?: boolean;
  maxUsers?: number | null;
  maxJobs?: number | null;
  annualMaxUsers?: number | null;
  annualMaxJobs?: number | null;
}) {
  return apiFetch<{ package: HqSubscriptionPackage }>('/hq/packages', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqUpdatePackage(
  packageId: string,
  body: {
    name?: string;
    displayName?: string;
    description?: string;
    price?: string;
    yearlyPrice?: string;
    pricePeriod?: string;
    features?: string[];
    isPopular?: boolean;
    maxUsers?: number | null;
    maxJobs?: number | null;
    annualMaxUsers?: number | null;
    annualMaxJobs?: number | null;
  }
) {
  return apiFetch<{ package: HqSubscriptionPackage }>(`/hq/packages/${encodeURIComponent(packageId)}`, {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqDeletePackage(packageId: string) {
  return apiFetch<{ deleted: boolean; id: string }>(`/hq/packages/${encodeURIComponent(packageId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiHqListTenants() {
  return apiFetch<{
    tenants: HqTenantRow[];
    stats: {
      total: number;
      agency: number;
      standalone: number;
      landingPurchases?: number;
      landingTrials?: number;
      planCounts: Record<string, number>;
    };
    planOptions: HqSubscriptionPackage[];
  }>('/hq/tenants', { auth: true });
}

export type HqTenantImpersonationAccess = {
  token: string;
  loginUrl: string;
  expiresAt: string;
  loginId: string;
  tenantEmail: string;
  tenantDbName: string;
  tenantName: string;
};

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

export type HqLeadStorageInfo = {
  engine: string;
  database: string;
  collection: string;
};

export type HqLeadStats = {
  total: number;
  newLeads: number;
  followUpsToday: number;
  converted: number;
  lost: number;
  conversionRate: number;
};

export type HqDemoStats = {
  total: number;
  verified: number;
  pending: number;
  expired: number;
  trials?: number;
  trialsLive?: number;
  purchases?: number;
  purchasesLive?: number;
};

export type HqDemoRequestApiRow = {
  id: string;
  fullName: string;
  email: string;
  organizationName: string;
  countryCode: string;
  dialCode: string;
  phoneNumber: string;
  companySize: string;
  outcome: string;
  requestKind?: 'demo' | 'trial' | 'purchase';
  packageSlug?: string;
  packageName?: string;
  billingCycle?: string;
  trialProvisioned?: boolean;
  trialTenantDbName?: string;
  trialLoginId?: string;
  trialDays?: number | null;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  trialLoginUrl?: string;
  credentialsSentAt?: string | null;
  status: 'PENDING' | 'VERIFIED' | 'EXPIRED';
  emailVerifiedAt: string | null;
  createdAt: string | null;
  submittedAt: string;
};

export type HqLeadApiRow = {
  id: string;
  name: string;
  company: string;
  industry: string;
  score: 'Hot' | 'Warm' | 'Cold';
  users: number;
  owner: string;
  stage: 'new' | 'demo' | 'trial' | 'contacted' | 'qualified' | 'converted' | 'lost';
  nextFollowUp: string;
  nextFollowUpAt?: string | null;
  email?: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  estimatedDealValue?: number;
  leadSource?: string;
  leadSourceDetail?: string;
  interestedModules?: string[];
  initialNotes?: string;
  createdAt?: string | null;
  followUps?: HqLeadFollowUp[];
  remarks?: HqLeadRemark[];
  convertedToCompanyId?: string | null;
  contactPerson?: string;
  directorName?: string;
  directorSalutation?: string | null;
  emails?: string[];
  phones?: string[];
  type?: string;
  source?: string | null;
  status?: string;
  priority?: string;
  website?: string | null;
  companyLinks?: string[];
  linkedIn?: string | null;
  location?: string | null;
  designation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  campaignName?: string | null;
  campaignLink?: string | null;
  referralName?: string | null;
  sourceWebsiteUrl?: string | null;
  sourceLinkedInUrl?: string | null;
  sourceEmail?: string | null;
  sourceOther?: string | null;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  otherDetails?: Array<{ label: string; value: string }>;
  interestedNeeds?: string | null;
  servicesNeeded?: string | null;
  expectedBusinessValue?: string | null;
  notes?: string | null;
  assignedToId?: string | null;
  assignedToIds?: string[];
  assignedToUsers?: Array<{
    id: string;
    name: string;
    email?: string;
    role?: string;
    roleId?: string | null;
  }>;
  formSchema?: string | null;
  hqProductLine?: string | null;
  hqProductLines?: string[];
  employerDemoRequestId?: string | null;
  preferredDemoDate?: string | null;
  preferredDemoTime?: string | null;
};

export type HqLeadFollowUp = {
  id: string;
  type: string;
  scheduledAt: string | null;
  notes: string;
  status: string;
  createdAt: string | null;
  createdByEmail?: string | null;
  completedAt?: string | null;
};

export type HqLeadRemark = {
  id: string;
  text: string;
  createdAt: string | null;
  createdByEmail?: string | null;
};

export async function apiHqListLeads() {
  return apiFetch<{
    leads: HqLeadApiRow[];
    stats: HqLeadStats;
    storage: HqLeadStorageInfo;
  }>('/hq/leads', { auth: true });
}

export async function apiHqListDemoRequests() {
  return apiFetch<{
    demos: HqDemoRequestApiRow[];
    stats: HqDemoStats;
    storage: HqLeadStorageInfo;
  }>('/hq/demos', { auth: true });
}

export async function apiHqDeleteDemoRequest(demoId: string) {
  return apiFetch<{
    deleted: boolean;
    id: string;
    storage: HqLeadStorageInfo;
  }>(`/hq/demos/${encodeURIComponent(demoId)}`, { method: 'DELETE', auth: true });
}

export async function apiHqGrantDemoTrial(
  demoId: string,
  body: { trialDays?: number; note?: string } = {}
) {
  return apiFetch<{
    alreadyProvisioned?: boolean;
    tenantDbName?: string;
    loginId?: string;
    loginUrl?: string;
    trialEndsAt?: string | null;
    trialStartsAt?: string | null;
    trialDays?: number;
    credentialEmailSent?: boolean;
    credentialEmailError?: string | null;
    message?: string;
  }>(`/hq/demos/${encodeURIComponent(demoId)}/grant-trial`, {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqGrantLeadTrial(
  leadId: string,
  body: { email: string; trialDays?: number; note?: string; notifyEmails?: string[] }
) {
  return apiFetch<{
    alreadyProvisioned?: boolean;
    tenantDbName?: string;
    loginId?: string;
    loginUrl?: string;
    trialEndsAt?: string | null;
    trialStartsAt?: string | null;
    trialDays?: number;
    credentialEmailSent?: boolean;
    credentialEmailError?: string | null;
    extraEmailResults?: Array<{ email: string; sent: boolean; error?: string }>;
    message?: string;
    lead?: HqLeadApiRow;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/grant-trial`, {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqCreateLead(
  body:
    | CreateLeadData
    | {
        contactName: string;
        companyName: string;
        email: string;
        phone?: string;
        industry: string;
        country: string;
        expectedUsers: string | number;
        estimatedDealValue: string | number;
        leadSource: string;
        leadSourceDetail?: string;
        stage?: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
        nextFollowUpAt?: string;
        interestedModules: string[];
        initialNotes?: string;
      },
) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>('/hq/leads', { method: 'POST', auth: true, body });
}

export async function apiHqUpdateLead(
  leadId: string,
  body:
    | CreateLeadData
    | Record<string, unknown>
    | {
        contactName: string;
        companyName: string;
        email: string;
        phone?: string;
        industry: string;
        country: string;
        expectedUsers: string | number;
        estimatedDealValue: string | number;
        leadSource: string;
        leadSourceDetail?: string;
        nextFollowUpAt?: string;
        interestedModules: string[];
        initialNotes?: string;
        stage: HqLeadApiRow['stage'];
      },
) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}`, { method: 'PUT', auth: true, body });
}

export async function apiHqDeleteLead(leadId: string) {
  return apiFetch<{
    deleted: boolean;
    id: string;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}`, { method: 'DELETE', auth: true });
}

export async function apiHqAddLeadFollowUp(
  leadId: string,
  body: {
    type: string;
    scheduledAt: string;
    notes?: string;
  }
) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/follow-ups`, { method: 'POST', auth: true, body });
}

export async function apiHqUpdateLeadFollowUp(
  leadId: string,
  followUpId: string,
  body: {
    type: string;
    scheduledAt: string;
    notes?: string;
  }
) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/follow-ups/${encodeURIComponent(followUpId)}`, {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqCompleteLeadFollowUp(
  leadId: string,
  followUpId: string,
  body?: { notes?: string; remark?: string; type?: string; scheduledAt?: string },
) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(
    `/hq/leads/${encodeURIComponent(leadId)}/follow-ups/${encodeURIComponent(followUpId)}/complete`,
    { method: 'POST', auth: true, body: body || {} },
  );
}

export async function apiHqDeleteLeadFollowUp(leadId: string, followUpId: string) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/follow-ups/${encodeURIComponent(followUpId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiHqAddLeadRemark(leadId: string, body: { text: string }) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/remarks`, { method: 'POST', auth: true, body });
}

export async function apiHqConvertLeadToCompany(leadId: string) {
  return apiFetch<{
    company: HqCompanyApiRow;
    lead: HqLeadApiRow;
    alreadyConverted?: boolean;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/convert-to-company`, {
    method: 'POST',
    auth: true,
    body: {},
  });
}

export type HqCompanyApiRow = {
  id: string;
  name: string;
  contact: string;
  industry: string;
  score: 'Hot' | 'Warm' | 'Cold';
  users: number;
  owner: string;
  status: 'active' | 'inactive' | 'on_hold' | 'closed';
  nextFollowUp: string;
  nextFollowUpAt?: string | null;
  email?: string;
  phone?: string;
  website?: string;
  logo?: string | null;
  country?: string;
  state?: string;
  city?: string;
  estimatedDealValue?: number;
  companySource?: string;
  interestedModules?: string[];
  initialNotes?: string;
  createdAt?: string | null;
  followUps?: HqLeadFollowUp[];
  remarks?: HqLeadRemark[];
  directorName?: string;
  directorSalutation?: string | null;
  emails?: string[];
  phones?: string[];
  companySize?: string;
  location?: string;
  hiringLocations?: string;
  servicesNeeded?: string;
  expectedBusinessValue?: string;
  linkedin?: string;
  timezone?: string;
  priority?: string;
  sla?: string;
  leadStatus?: string;
  latitude?: number | null;
  longitude?: number | null;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  otherDetails?: Array<{ label: string; value: string }>;
  assignedToId?: string | null;
  formSchema?: string | null;
  convertedFromLeadId?: string | null;
  companyTag?: string | null;
  hqProductLine?: string | null;
  tenantDbName?: string | null;
  tenantAdminEmail?: string | null;
  tenantProvisionedAt?: string | null;
};

export type HqCompanyStats = {
  total: number;
  active: number;
  inactive: number;
  onHold: number;
  closed: number;
  followUpsToday: number;
};

export async function apiHqListCompanies() {
  return apiFetch<{
    companies: HqCompanyApiRow[];
    stats: HqCompanyStats;
    storage: HqLeadStorageInfo;
  }>('/hq/companies', { auth: true });
}

export type HqSupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type HqSupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type HqSupportTicketCategory = 'general' | 'billing' | 'technical' | 'account' | 'feature';

export type HqSupportTicket = {
  id: string;
  ticketNumber?: string;
  subject: string;
  description: string;
  priority: HqSupportTicketPriority;
  status: HqSupportTicketStatus;
  category: HqSupportTicketCategory;
  tenantDbName: string;
  organizationName: string;
  raisedByUserId: string;
  raisedByName: string;
  raisedByEmail: string;
  hqNotes: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type HqSupportTicketMessage = {
  id: string;
  ticketId: string;
  senderRole: 'employer' | 'hq';
  senderName: string;
  senderId?: string | null;
  body: string;
  createdAt: string | null;
};

export type HqSupportTicketStats = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  highPriority: number;
};

export async function apiHqListTickets(params?: {
  status?: string;
  priority?: string;
  tenantDbName?: string;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.priority) query.set('priority', params.priority);
  if (params?.tenantDbName) query.set('tenantDbName', params.tenantDbName);
  const qs = query.toString();
  return apiFetch<{ tickets: HqSupportTicket[]; stats: HqSupportTicketStats }>(
    `/hq/tickets${qs ? `?${qs}` : ''}`,
    { auth: true },
  );
}

export async function apiHqUpdateTicket(
  ticketId: string,
  body: { status?: HqSupportTicketStatus; priority?: HqSupportTicketPriority; hqNotes?: string },
) {
  return apiFetch<{ ticket: HqSupportTicket }>(`/hq/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body,
    auth: true,
  });
}

/** Phase 1 Help-page tickets (candidate portal `/help` → `/api/hq-tickets`). */
export type HqHelpTicketStatus = 'open' | 'in_progress' | 'closed';

export type HqHelpTicket = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  description: string;
  problemId?: string | null;
  userId?: string | null;
  status: HqHelpTicketStatus;
  source?: string;
};

export type HqHelpTicketStats = {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
};

export type HqHelpTicketMessage = {
  id: string;
  ticketId: string;
  senderRole: 'candidate' | 'hq';
  senderName?: string;
  senderId?: string | null;
  body: string;
  createdAt: string;
};

export async function apiHqListHelpTickets(params?: {
  status?: HqHelpTicketStatus | '';
  email?: string;
  id?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.email) query.set('email', params.email);
  if (params?.id) query.set('id', params.id);
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<{
    tickets: HqHelpTicket[];
    stats: HqHelpTicketStats;
    openCount?: number;
    count?: number;
    note?: string | null;
    source?: string;
  }>(`/hq/help-tickets${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function apiHqUpdateHelpTicket(ticketId: string, status: HqHelpTicketStatus) {
  return apiFetch<{ ticket: HqHelpTicket }>(
    `/hq/help-tickets/${encodeURIComponent(ticketId)}`,
    {
      method: 'PATCH',
      body: { status },
      auth: true,
    },
  );
}

export async function apiHqListHelpTicketMessages(ticketId: string) {
  return apiFetch<{
    ticketId: string;
    subject: string;
    status: HqHelpTicketStatus;
    messages: HqHelpTicketMessage[];
  }>(`/hq/help-tickets/${encodeURIComponent(ticketId)}/messages`, { auth: true });
}

export async function apiHqSendHelpTicketMessage(ticketId: string, body: string) {
  return apiFetch<{ message: HqHelpTicketMessage }>(
    `/hq/help-tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: 'POST',
      body: { body },
      auth: true,
    },
  );
}

export async function apiCreateSupportTicket(body: {
  subject: string;
  description: string;
  priority?: HqSupportTicketPriority;
  category?: HqSupportTicketCategory;
  organizationName?: string;
}) {
  return apiFetch<{ ticket: HqSupportTicket }>('/support/tickets', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiListMySupportTickets() {
  return apiFetch<{ tickets: HqSupportTicket[]; stats: HqSupportTicketStats }>('/support/tickets', {
    auth: true,
  });
}

export async function apiUpdateMySupportTicket(ticketId: string, status: 'closed') {
  return apiFetch<{ ticket: HqSupportTicket }>(`/support/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: { status },
    auth: true,
  });
}

export async function apiListSupportTicketMessages(ticketId: string) {
  return apiFetch<{
    ticketId: string;
    subject: string;
    status: HqSupportTicketStatus;
    messages: HqSupportTicketMessage[];
  }>(`/support/tickets/${encodeURIComponent(ticketId)}/messages`, { auth: true });
}

export async function apiSendSupportTicketMessage(ticketId: string, body: string) {
  return apiFetch<{ message: HqSupportTicketMessage }>(
    `/support/tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: 'POST',
      body: { body },
      auth: true,
    },
  );
}

export async function apiHqListSupportTicketMessages(ticketId: string) {
  return apiFetch<{
    ticketId: string;
    subject: string;
    status: HqSupportTicketStatus;
    messages: HqSupportTicketMessage[];
  }>(`/hq/tickets/${encodeURIComponent(ticketId)}/messages`, { auth: true });
}

export async function apiHqSendSupportTicketMessage(ticketId: string, body: string) {
  return apiFetch<{ message: HqSupportTicketMessage }>(
    `/hq/tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: 'POST',
      body: { body },
      auth: true,
    },
  );
}

export async function apiHqCreateCompany(
  body:
    | CreateClientData
    | {
        companyName: string;
        primaryContactName: string;
        email: string;
        phone?: string;
        website?: string;
        industry: string;
        country: string;
        expectedUsers: string | number;
        estimatedDealValue: string | number;
        pricePerUser?: string | number;
        billingCycle?: 'monthly' | 'yearly' | 'annual';
        finalPrice?: string | number;
        accountOwner: string;
        companySource: string;
        nextFollowUpAt: string;
        interestedModules: string[];
        initialNotes?: string;
      },
) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    '/hq/companies',
    { method: 'POST', auth: true, body }
  );
}

export async function apiHqUploadCompanyLogo(companyId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<{
    company: HqCompanyApiRow;
    logo: string;
    storage: HqLeadStorageInfo;
  }>(`/hq/companies/${encodeURIComponent(companyId)}/logo`, formData, {
    method: 'POST',
    auth: true,
  });
}

export async function apiHqUpdateCompany(
  companyId: string,
  body:
    | CreateClientData
    | Record<string, unknown>
    | {
        companyName: string;
        primaryContactName: string;
        email: string;
        phone?: string;
        website?: string;
        industry: string;
        country: string;
        expectedUsers: string | number;
        estimatedDealValue: string | number;
        pricePerUser?: string | number;
        billingCycle?: 'monthly' | 'yearly' | 'annual';
        finalPrice?: string | number;
        accountOwner: string;
        companySource: string;
        nextFollowUpAt: string;
        interestedModules: string[];
        initialNotes?: string;
        status: HqCompanyApiRow['status'];
      },
) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}`,
    { method: 'PUT', auth: true, body }
  );
}

export async function apiHqDeleteCompany(companyId: string) {
  return apiFetch<{ deleted: boolean; id: string; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}`,
    { method: 'DELETE', auth: true },
  );
}

export async function apiHqAddCompanyFollowUp(
  companyId: string,
  body: { type: string; scheduledAt: string; notes?: string }
) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}/follow-ups`,
    { method: 'POST', auth: true, body }
  );
}

export async function apiHqUpdateCompanyFollowUp(
  companyId: string,
  followUpId: string,
  body: { type: string; scheduledAt: string; notes?: string }
) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}/follow-ups/${encodeURIComponent(followUpId)}`,
    { method: 'PUT', auth: true, body }
  );
}

export async function apiHqCompleteCompanyFollowUp(companyId: string, followUpId: string) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}/follow-ups/${encodeURIComponent(followUpId)}/complete`,
    { method: 'POST', auth: true, body: {} }
  );
}

export async function apiHqDeleteCompanyFollowUp(companyId: string, followUpId: string) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}/follow-ups/${encodeURIComponent(followUpId)}`,
    { method: 'DELETE', auth: true }
  );
}

export async function apiHqAddCompanyRemark(companyId: string, body: { text: string }) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}/remarks`,
    { method: 'POST', auth: true, body }
  );
}

export type HqTeamMemberStatus = 'active' | 'inactive';

export type HqTeamMemberRow = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  roleId?: string;
  roleColor?: string;
  permissionIds?: string[];
  phone: string;
  designation?: string;
  status: HqTeamMemberStatus;
  department: string;
  /** 1 = top of hierarchy */
  rank?: number;
  reportsToId?: string;
  reportsToName?: string;
  loginId?: string;
  loginPassword?: string;
  hasCredentials?: boolean;
  createdAt: string | null;
  updatedAt?: string | null;
};

export type HqTeamStats = {
  total: number;
  active: number;
  inactive: number;
};

export type HqRoleRow = {
  id: string;
  roleName: string;
  description: string;
  color: string;
  permissionIds: string[];
  isSystem?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type HqPermissionRow = {
  id: string;
  permissionName: string;
  module: string;
  description: string;
};

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

export async function apiHqListTeam() {
  return apiFetch<{
    members: HqTeamMemberRow[];
    stats: HqTeamStats;
    storage: HqLeadStorageInfo;
  }>('/hq/team', { auth: true });
}

export async function apiHqCreateTeamMember(body: {
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role?: string;
  roleId?: string;
  permissionIds?: string[];
  phone?: string;
  designation?: string;
  status?: HqTeamMemberStatus;
  department?: string;
  rank?: number;
  reportsToId?: string | null;
  generateCredentials?: boolean;
  sendInvite?: boolean;
  customLoginId?: string;
  tempPassword?: string;
}) {
  return apiFetch<{
    member: HqTeamMemberRow;
    credentials?: {
      loginId: string;
      tempPassword: string;
      email: string;
      sendInvite: boolean;
      inviteEmailSent?: boolean;
      inviteEmailError?: string | null;
      platformTenantDbName?: string | null;
    } | null;
    storage: HqLeadStorageInfo;
  }>('/hq/team', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqUpdateTeamMember(
  memberId: string,
  body: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email: string;
    role?: string;
    roleId?: string;
    permissionIds?: string[];
    phone?: string;
    designation?: string;
    status?: HqTeamMemberStatus;
    department?: string;
    rank?: number;
    reportsToId?: string | null;
  },
) {
  return apiFetch<{ member: HqTeamMemberRow; storage: HqLeadStorageInfo }>(
    `/hq/team/${encodeURIComponent(memberId)}`,
    { method: 'PUT', auth: true, body },
  );
}

export async function apiHqDeleteTeamMember(memberId: string) {
  return apiFetch<{ deleted: boolean; id: string; storage: HqLeadStorageInfo }>(
    `/hq/team/${encodeURIComponent(memberId)}`,
    { method: 'DELETE', auth: true },
  );
}

export async function apiHqListPermissions() {
  return apiFetch<{
    permissions: HqPermissionRow[];
    permissionsByModule: Record<string, HqPermissionRow[]>;
    moduleOrder?: string[];
  }>('/hq/permissions', { auth: true });
}

export async function apiHqListRoles() {
  return apiFetch<{ roles: HqRoleRow[] }>('/hq/roles', { auth: true });
}

export async function apiHqCreateRole(body: {
  roleName: string;
  description?: string;
  color?: string;
  permissionIds: string[];
}) {
  return apiFetch<{ role: HqRoleRow }>('/hq/roles', { method: 'POST', auth: true, body });
}

export async function apiHqUpdateRole(
  roleId: string,
  body: {
    roleName: string;
    description?: string;
    color?: string;
    permissionIds: string[];
  },
) {
  return apiFetch<{ role: HqRoleRow }>(`/hq/roles/${encodeURIComponent(roleId)}`, {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqDeleteRole(roleId: string) {
  return apiFetch<{ deleted: boolean; id: string }>(`/hq/roles/${encodeURIComponent(roleId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export type HqPortalCandidateRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  location: string;
  status: string;
  source: string;
  stage: string;
  tenantDbName: string;
  updatedAt: string | null;
  createdAt: string | null;
  origin: 'phase1_portal' | 'phase1_common' | 'phase2_crm';
  kycVerified?: boolean;
  isInterviewer?: boolean;
};

export type HqPortalJobRow = {
  id: string;
  title: string;
  company: string;
  /** Real client name, always visible inside HQ even when hidden on Phase 1. */
  clientName?: string;
  /** Whether the client name is shown on the Phase 1 job cards / job pages. */
  showClientNamePublicly?: boolean;
  /** True when HQ has locked the client name hidden — tenant edits cannot re-expose it. */
  hqHideClientName?: boolean;
  location: string;
  status: string;
  workMode: string;
  tenantDbName: string;
  postedBy: string;
  openings: number;
  visibility: string;
  origin: 'phase1_portal' | 'phase2_crm';
  updatedAt: string | null;
  postedDate: string | null;
};

export type HqPortalStats = {
  totalCandidates: number;
  portalCandidates: number;
  commonCandidates: number;
  phase2Candidates: number;
  totalJobs: number;
  phase2Jobs: number;
  tenantJobs: number;
  portalOnlyJobs: number;
  tenantCount: number;
};

export type HqPortalStorageInfo = {
  portal: {
    engine: string;
    database: string;
    collections: { candidates: string; jobs: string };
  };
  common: {
    engine: string;
    database: string;
    collection: string;
  } | null;
  phase2: {
    engine: string;
    tenantDatabases: string[];
  };
};

export async function apiHqListPortal() {
  return apiFetch<{
    candidates: HqPortalCandidateRow[];
    jobs: HqPortalJobRow[];
    stats: HqPortalStats;
    storage: HqPortalStorageInfo;
  }>('/hq/portal', { auth: true });
}

export async function apiHqListCandidates() {
  return apiFetch<{
    candidates: HqPortalCandidateRow[];
    stats: Pick<
      HqPortalStats,
      'totalCandidates' | 'portalCandidates' | 'commonCandidates' | 'phase2Candidates' | 'tenantCount'
    >;
    storage: HqPortalStorageInfo;
  }>('/hq/candidates', { auth: true });
}

export type HqKycInterviewerRow = {
  id: string;
  applicationId?: string | null;
  name: string;
  email: string;
  phone: string;
  currentRole: string;
  currentCompany: string;
  yearsOfExperience: number;
  interviewPrice: number;
  expertiseAreas: string[];
  interviewTypes: string[];
  languages: string[];
  weeklyAvailability?: string;
  aboutYourself?: string;
  feedbackStyle?: string;
  linkedinUrl?: string;
  resumeUrl?: string;
  profilePhotoUrl?: string;
  dateOfBirth?: string | null;
  passportNumber?: string;
  applicationStatus: string;
  profileStatus?: string | null;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  kycVerified: boolean;
  kycMissing: string[];
  hqVerified: boolean;
  liveForCandidates: boolean;
  kind?: 'applicant' | 'interviewer';
  createdAt?: string | null;
  updatedAt: string | null;
};

export async function apiHqListKycInterviewers() {
  return apiFetch<{
    interviewers: HqKycInterviewerRow[];
    stats: {
      total: number;
      applicants?: number;
      interviewers?: number;
      kycVerified: number;
      pendingHqVerify: number;
      liveForCandidates: number;
    };
  }>('/hq/kyc-interviewers', { auth: true });
}

export async function apiHqVerifyKycInterviewer(candidateId: string) {
  return apiFetch<{
    candidateId: string;
    hqVerified: boolean;
    kycVerified: boolean;
    liveForCandidates: boolean;
  }>(`/hq/kyc-interviewers/${encodeURIComponent(candidateId)}/verify`, {
    method: 'POST',
    auth: true,
  });
}

export async function apiHqRejectKycInterviewer(candidateId: string, reviewNotes?: string) {
  return apiFetch<{
    candidateId: string;
    hqVerified: boolean;
    applicationStatus: string;
    reviewNotes: string;
  }>(`/hq/kyc-interviewers/${encodeURIComponent(candidateId)}/reject`, {
    method: 'POST',
    auth: true,
    body: { reviewNotes: reviewNotes || '' },
  });
}

export type HqCourseLessonSummary = {
  id: string;
  title: string;
  order: number;
};

export type HqCertificateSlot = {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right' | string;
  fontFamily?: string;
};

export type HqCourseCertificate = {
  mode: 'preset' | 'uploaded' | string;
  presetId: string;
  backgroundUrl?: string | null;
  slots?: Record<string, HqCertificateSlot>;
};

export type HqCourseCheckpoint = {
  id: string;
  type: 'quiz' | 'assignment' | 'manual' | string;
  title: string;
  order: number;
  required: boolean;
  afterLessonId?: string | null;
  quizId?: string | null;
  passPercent?: number;
};

export type HqCourseRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  instructorName?: string | null;
  instructorAvatar?: string | null;
  totalLessons: number;
  estimatedHours: number;
  tags: string[];
  isPublished: boolean;
  accessTier: string;
  tokenCost: number;
  isCertified: boolean;
  certificate?: HqCourseCertificate | null;
  checkpoints?: HqCourseCheckpoint[];
  lessons?: HqCourseLessonSummary[];
  enrolledCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type HqCourseStats = {
  total: number;
  published: number;
  draft: number;
  premium: number;
  enrollments?: number;
};

export type HqCourseLearner = {
  id: string;
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  title?: string | null;
  location?: string | null;
  progressPercent: number;
  completedLessonCount: number;
  completedAt?: string | null;
  startedAt?: string | null;
  lastAccessedAt?: string | null;
  savedAt?: string | null;
  certificateId?: string | null;
  certificateIssuedAt?: string | null;
  checkpointProgress?: Record<string, { passed?: boolean; at?: string; source?: string }>;
  status: 'joined' | 'in_progress' | 'completed' | string;
};

export type HqCourseEnrollmentResult = {
  course: HqCourseRow;
  learners: HqCourseLearner[];
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    joined: number;
  };
};

export type HqCoursePayload = {
  title: string;
  description?: string;
  category?: string;
  level?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  instructorName?: string;
  estimatedHours?: number;
  totalLessons?: number;
  tags?: string[] | string;
  isPublished?: boolean;
  accessTier?: string;
  tokenCost?: number;
  isCertified?: boolean;
  certificate?: HqCourseCertificate | null;
  checkpoints?: HqCourseCheckpoint[];
};

export async function apiHqListCourses() {
  return apiFetch<{ courses: HqCourseRow[]; stats: HqCourseStats }>('/hq/courses', { auth: true });
}

export async function apiHqListCourseEnrollments(id: string) {
  return apiFetch<HqCourseEnrollmentResult>(`/hq/courses/${encodeURIComponent(id)}/enrollments`, {
    auth: true,
  });
}

export async function apiHqCreateCourse(body: HqCoursePayload) {
  return apiFetch<{ course: HqCourseRow }>('/hq/courses', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqUpdateCourse(id: string, body: Partial<HqCoursePayload>) {
  return apiFetch<{ course: HqCourseRow }>(`/hq/courses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqDeleteCourse(id: string) {
  return apiFetch<{ deleted: boolean; id: string }>(`/hq/courses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiHqBulkDeleteCourses(ids: string[]) {
  return apiFetch<{
    deleted: boolean;
    deletedCount: number;
    requested: number;
    invalid?: string[];
  }>('/hq/courses/bulk-delete', {
    method: 'POST',
    auth: true,
    body: { ids },
  });
}

export async function apiHqUploadCourseThumbnail(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<{ thumbnail: { url: string; name?: string; size?: number } }>(
    '/hq/courses/thumbnail',
    formData,
    { method: 'POST', auth: true },
  );
}

export async function apiHqUploadCourseVideo(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<{ video: { url: string; name?: string; size?: number } }>(
    '/hq/courses/video',
    formData,
    { method: 'POST', auth: true },
  );
}

export async function apiHqUploadCourseCertificateBackground(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<{ background: { url: string; name?: string; size?: number } }>(
    '/hq/courses/certificate-background',
    formData,
    { method: 'POST', auth: true },
  );
}

export async function apiHqPreviewCourseCertificate(body: {
  learnerName?: string;
  courseTitle?: string;
  instructorName?: string;
  certificate?: HqCourseCertificate | null;
}) {
  return apiFetch<{ html: string; certificate: HqCourseCertificate }>('/hq/courses/certificate-preview', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqPassCourseCheckpoint(courseId: string, enrollmentId: string, checkpointId: string) {
  return apiFetch<{ passed: boolean; checkpointId: string }>(
    `/hq/courses/${encodeURIComponent(courseId)}/enrollments/${encodeURIComponent(enrollmentId)}/checkpoints/${encodeURIComponent(checkpointId)}/pass`,
    { method: 'POST', auth: true },
  );
}

export type HqCandidateBehaviorInsight = {
  id: string;
  label: string;
  severity: 'info' | 'watch' | 'action';
  summary: string;
  evidence: string[];
};

export type HqCandidateBehaviorRollup = {
  userId?: string;
  range?: string;
  fromDate?: string;
  toDate?: string;
  logins?: number;
  visits?: number;
  jobCardClicks?: number;
  applies?: number;
  activeMs?: number;
  sessionCount?: number;
  daysActive?: number;
  avgActiveMsPerDay?: number;
  topFirstOpen?: string;
  pageVisitsByCategory?: Record<string, number>;
  activeMsByCategory?: Record<string, number>;
  firstOpenBreakdown?: Record<string, number>;
  insights?: HqCandidateBehaviorInsight[];
  behaviourSignals?: {
    preferSlotIds?: string[];
    deprioritizeSlotIds?: string[];
    insightIds?: string[];
  };
  recentEvents?: Array<{
    id: string;
    at: string;
    type: string;
    category: string;
    path?: string;
    sessionId?: string;
    meta?: Record<string, unknown>;
  }>;
  recentSessions?: Array<{
    id: string;
    startedAt: string;
    endedAt?: string;
    durationMs: number;
    pageCount: number;
    firstPath?: string;
    lastPath?: string;
    deviceType?: string;
    browser?: string;
    operatingSystem?: string;
    country?: string;
    state?: string;
    city?: string;
  }>;
  profileSnapshot?: {
    skillsCount?: number | null;
    profileCompleteness?: number | null;
    cvScore?: number | null;
    applicationsTotal?: number;
    rejectionsTotal?: number;
  };
  hqTriggers?: Array<{
    id: string;
    flag: string;
    title: string;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    priority: number;
  }>;
};

export type HqCandidateBehaviorAnalysis = {
  candidateId: string;
  candidate: {
    id: string;
    name: string;
    email: string;
    phone: string;
    title: string;
    location: string;
    status: string;
    source: string;
    lastActivity: string | null;
  } | null;
  capturedAt: string | null;
  activityStateUpdatedAt: string | null;
  rollup7d: HqCandidateBehaviorRollup | null;
  triggers: HqCandidateBehaviorRollup['hqTriggers'];
  suggestionMetrics: Record<string, unknown> | null;
  portalSessions: Array<{
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationMs: number;
    durationLabel: string;
    ipAddress?: string | null;
    deviceType: string | null;
    browser: string | null;
    operatingSystem: string | null;
    country: string | null;
    state: string | null;
    city: string | null;
    timezone?: string | null;
    isActive: boolean;
  }>;
  sessionEngagement?: {
    sessionCount: number;
    activeCount: number;
    totalDurationMs: number;
    avgDurationMs: number;
    medianDurationMs: number;
    uniqueIps: number;
    uniqueDevices: number;
    locations: Array<{
      key: string;
      city: string | null;
      state: string | null;
      country: string | null;
      sessions: number;
      totalDurationMs: number;
    }>;
    byHour: Array<{
      hour: number;
      label: string;
      sessions: number;
      totalDurationMs: number;
    }>;
    byWeekday: Array<{
      weekday: number;
      label: string;
      sessions: number;
      totalDurationMs: number;
    }>;
  } | null;
  alertTiming?: {
    bestHours: number[];
    bestHourLabels: string[];
    bestWeekdays: string[];
    bestWindowLabel: string;
    avoidHours: number[];
    timezone: string | null;
    confidence: 'low' | 'medium' | 'high';
    reason: string;
    sampleSessions: number;
    avgDurationMs: number;
    medianDurationMs: number;
  } | null;
  locations?: Array<{
    key: string;
    city: string | null;
    state: string | null;
    country: string | null;
    sessions: number;
    totalDurationMs: number;
  }>;
  applications: Array<{
    id: string;
    status: string;
    jobTitle: string;
    company: string;
    createdAt: string;
  }>;
  applicationStats: { total: number; rejections: number };
  dbSummary: {
    logins: number;
    applies: number;
    activeMs: number;
    sessionCount: number;
    activeSessions: number;
    rejectionsTotal: number;
  };
  dataSource: 'phase1_behavior_tracker' | 'portal_db_sessions' | 'none';
  phase1BehaviorUrl: string;
};

export async function apiHqGetCandidateBehavior(candidateId: string) {
  return apiFetch<HqCandidateBehaviorAnalysis>(
    `/hq/candidates/${encodeURIComponent(candidateId)}/behavior`,
    { auth: true },
  );
}

export type HqTenantBehaviorAnalysis = {
  tenantDbName: string;
  tenantName: string;
  tenantEmail?: string;
  organizationType?: string;
  planName?: string;
  capturedAt: string;
  dataSource: 'behavior_engine' | 'sessions_fallback' | 'none';
  range?: 'today' | 'week' | 'month' | 'year';
  engagement: {
    trackedUsers: number;
    usersCreated?: number;
    usersLoaded?: number;
    teamMembersTotal: number;
    activeUsers7d: number;
    onlineNow: number;
    totalLogins7d: number;
    totalLogouts7d: number;
    totalSessions7d: number;
    totalActiveMs7d: number;
    totalActiveMsToday: number;
    totalVisits7d: number;
    totalActions7d: number;
    totalApiMutations7d: number;
    totalEntityViews7d: number;
    totalSearches7d: number;
    avgTimePerUser7d: number;
    lastActivityAt: string | null;
    firstActivityAt: string | null;
  };
  periodMetrics?: {
    range: 'today' | 'week' | 'month' | 'year';
    windowDays: number;
    visits: number;
    actions: number;
    apiMutations: number;
    entityViews: number;
    searches: number;
    activeMs: number;
    logins: number;
    sessions: number;
    activeUsers: number;
    avgWorkflow: number;
  };
  tenantHealthScore: number;
  weekMetrics: {
    visits: number;
    actions: number;
    apiMutations: number;
    entityViews: number;
    searches: number;
    activeMs: number;
    avgWorkflow: number;
  };
  todayMetrics: { visits: number; actions: number; activeMs: number };
  crmContext: Record<string, number | string | null> | null;
  moduleMatrix: Array<{
    category: string;
    label: string;
    visits: number;
    activeMs: number;
    actions: number;
    entityViews: number;
    conversionRate: number;
  }>;
  funnelSteps: Array<{ category: string; label: string; visits: number }>;
  actionBreakdown: Record<string, number>;
  topTriggers: Array<{
    id: string;
    flag: string;
    title: string;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    priority: number;
  }>;
  intelligenceSummary: string[];
  insights: Array<{
    id: string;
    label: string;
    severity: string;
    summary: string;
    evidence: string[];
  }>;
  liveFeed: Array<{
    at: string;
    type: string;
    category: string;
    path?: string;
  }>;
};

export async function apiHqGetTenantBehavior(
  tenantDbName: string,
  range: 'today' | 'week' | 'month' | 'year' = 'week',
) {
  const q = new URLSearchParams({ range });
  return apiFetch<HqTenantBehaviorAnalysis>(
    `/hq/tenants/${encodeURIComponent(tenantDbName)}/behavior?${q.toString()}`,
    { auth: true },
  );
}

/** Stats + entity ids (no duplicated names). Tenant-wide and per-user. Not wired into HQ UI yet. */
export async function apiHqGetTenantBehaviorEngine(
  tenantDbName: string,
  opts?: { range?: 'today' | 'week' | 'month' | 'year'; userId?: string },
) {
  const q = new URLSearchParams({ range: opts?.range || 'week' });
  if (opts?.userId) q.set('userId', opts.userId);
  return apiFetch<unknown>(
    `/hq/tenants/${encodeURIComponent(tenantDbName)}/behavior-engine?${q.toString()}`,
    { auth: true },
  );
}

export type HqAnalyticsChartPoint = { name: string; value: number; [key: string]: string | number };

export type HqAnalyticsInsight = {
  tone: 'info' | 'good' | 'warn';
  text: string;
};

export type HqEmployeeAnalytics = {
  available: boolean;
  live?: boolean;
  kpis: {
    totalCandidates: number;
    commonCandidates: number;
    new1d?: number;
    new7d: number;
    new30d: number;
    portalJobs: number;
    openJobs: number;
    closedJobs?: number;
    jobsPostedToday?: number;
    jobsPosted7d?: number;
    jobsPosted30d?: number;
    applications: number;
    activeApplications: number;
    applicationsToday?: number;
    applications7d?: number;
    applications30d?: number;
    selectedApplications?: number;
    rejectedApplications?: number;
    avgMatchScore: number | null;
    avgCvScore?: number | null;
    avgAtsScore?: number | null;
    savedJobs?: number;
    interviewRequests?: number;
    interviewPending?: number;
    interviewCompleted?: number;
    cvAnalyses?: number;
    lmsEnrollments?: number;
    aiMatches?: number;
    profileCompleteness?: number;
    loginsToday?: number;
    logins7d?: number;
    logins30d?: number;
    activeSessions?: number;
    totalSessionsTracked?: number;
    avgSessionDurationMs?: number | null;
    liveTrackedUsers?: number;
    liveVisits7d?: number;
    liveApplies7d?: number;
    liveJobClicks7d?: number;
    liveActiveMs7d?: number;
    resumesUploaded?: number;
    candidatesWithSkills?: number;
  };
  liveTracking?: {
    available: boolean;
    source: 'phase1_behavior_tracker' | 'portal_db_sessions' | string;
    trackedUsers: number;
    onlineNow: number;
    totalActiveMs7d: number;
    totalVisits7d: number;
    totalApplies7d: number;
    totalJobClicks7d: number;
    totalLogins7d: number;
    totalSessions7d: number;
    avgActiveMsPerUser7d: number;
    /** Visits on premium / LMS / AI CV / interview prep surfaces (7d). */
    premiumVisits7d?: number;
    /** Tokens spent on premium catalog services (7d). */
    premiumTokensSpent7d?: number;
    /** Visits on community / Office Gossip / chat / reference-check surfaces (7d). */
    communityVisits7d?: number;
    pageVisitsByCategory: HqAnalyticsChartPoint[];
    /** Premium-services-wise usage (most → least) — named catalog spends when available. */
    premiumServicesUsage?: Array<HqAnalyticsChartPoint & { tokens?: number; kind?: string }>;
    /** Most popular features: premium spends + earn + free surfaces. */
    popularFeatures?: Array<HqAnalyticsChartPoint & { kind?: string }>;
    tokenUsage?: {
      available?: boolean;
      premiumSpendEvents?: number;
      premiumTokensSpent?: number;
      earnEvents?: number;
    } | null;
    /** First-open entry points (e.g. landed on Services before/at first meaningful open). */
    entryPoints?: HqAnalyticsChartPoint[];
    /** Office Gossip, chat, reference-check style behaviour. */
    communityBehavior?: HqAnalyticsChartPoint[];
    /** Product rollup from Office Gossips bundle (users + reference-check statuses). */
    officeGossip?: {
      available?: boolean;
      updatedAt?: string | null;
      usersOnOfficeGossip?: number;
      identities?: number;
      communities?: number;
      companyPages?: number;
      posts?: number;
      comments?: number;
      openForReference?: number;
      referenceChecks?: number;
      referenceByStatus?: Record<string, number>;
      referenceChecksSummary?: {
        total?: number;
        initiated?: number;
        responded?: number;
        completed?: number;
        rejected?: number;
      };
    } | null;
    /** Top interest topics among candidates (affinity engine). */
    topInterests?: Array<HqAnalyticsChartPoint & { key?: string; avgScore?: number; scoreSum?: number }>;
    /** Trending topics (interests + roles + companies). */
    trendingTopics?: Array<HqAnalyticsChartPoint & { kind?: string }>;
    topTriggers: HqAnalyticsChartPoint[];
    liveFeed: Array<{
      userId: string;
      capturedAt: string | null;
      activityStateUpdatedAt: string | null;
      activeMs7d: number;
      visits7d: number;
      applies7d: number;
      jobCardClicks7d: number;
      topTrigger: string | null;
      topInterest?: string | null;
      topFirstOpen?: string | null;
    }>;
    capturedAt: string;
  };
  charts: {
    applicationsByStatus: HqAnalyticsChartPoint[];
    candidatesOverTime: HqAnalyticsChartPoint[];
    applicationsOverTime: HqAnalyticsChartPoint[];
    candidatesDaily?: HqAnalyticsChartPoint[];
    applicationsDaily?: HqAnalyticsChartPoint[];
    candidatesByStatus: HqAnalyticsChartPoint[];
    candidatesBySource: HqAnalyticsChartPoint[];
    topLocations: HqAnalyticsChartPoint[];
    topSkills: HqAnalyticsChartPoint[];
    experienceBands?: HqAnalyticsChartPoint[];
    jobsByStatus?: HqAnalyticsChartPoint[];
    matchScoreBuckets?: HqAnalyticsChartPoint[];
    interviewRequestsByStatus?: HqAnalyticsChartPoint[];
    loginsByCountry?: HqAnalyticsChartPoint[];
    loginsByState?: HqAnalyticsChartPoint[];
    loginsByCity?: HqAnalyticsChartPoint[];
    loginsByDevice?: HqAnalyticsChartPoint[];
    loginsByBrowser?: HqAnalyticsChartPoint[];
    loginsOverTime?: HqAnalyticsChartPoint[];
    loginsDaily?: HqAnalyticsChartPoint[];
  };
  tables: {
    recentCandidates: Array<{
      id: string;
      name: string;
      email: string;
      status: string;
      source: string;
      location: string;
      stage: string;
      skills?: string;
      experience?: number | null;
      updatedAt: string | null;
      createdAt: string | null;
    }>;
    recentApplications: Array<{
      id: string;
      candidate: string;
      email: string;
      job: string;
      status: string;
      matchScore: number | null;
      appliedAt: string | null;
    }>;
    topJobsByApplications: Array<{
      title: string;
      applications: number;
      status: string;
      location: string;
      openings?: number | null;
      avgMatchScore?: number | null;
      selected?: number;
      joined?: number;
    }>;
    recentOpenJobs?: Array<{
      id: string;
      title: string;
      status: string;
      location: string;
      workMode: string;
      openings: number;
      postedDate: string | null;
      updatedAt: string | null;
    }>;
    recentInterviewRequests?: Array<{
      role: string;
      status: string;
      difficulty: string;
      matchingScore: number | null;
      preferredDate: string | null;
      createdAt: string | null;
    }>;
    recentSessions?: Array<{
      candidateId: string;
      candidate: string;
      loginAt: string | null;
      logoutAt: string | null;
      durationMs: number;
      deviceType: string;
      browser: string;
      operatingSystem: string;
      country: string;
      state: string;
      city: string;
      isActive: boolean;
      status?: 'online' | 'idle' | 'closed' | string;
    }>;
  };
  insights: HqAnalyticsInsight[];
};

export type HqEmployerTenantRow = {
  tenantDbName: string;
  name: string;
  email: string;
  organizationType: string;
  plan: string;
  status: string;
  signupSource: string;
  jobs: number;
  openJobs: number;
  closedJobs?: number;
  candidates: number;
  candidates7d?: number;
  applications: number;
  applications7d?: number;
  interviews: number;
  interviewsToday?: number;
  interviewsScheduled?: number;
  interviewsCompleted?: number;
  placements: number;
  placementsJoined?: number;
  clients: number;
  leads: number;
  tasks?: number;
  tasksOpen?: number;
  activityScore?: number;
  health?: number;
  error: string | null;
};

export type HqEmployerAtRiskTenant = {
  tenantId: string;
  name: string;
  plan: string;
  health: number;
  openJobs: number;
  applications7d: number;
  reason: string;
  reasons?: string[];
};

export type HqEmployerAnalytics = {
  available: boolean;
  live?: boolean;
  kpis: {
    tenants: number;
    agency: number;
    standalone: number;
    paused: number;
    onPlan: number;
    landingPurchases: number;
    landingTrials: number;
    openJobs: number;
    closedJobs?: number;
    jobs: number;
    candidates: number;
    candidates7d?: number;
    applications: number;
    applications7d?: number;
    interviews: number;
    interviewsToday?: number;
    interviewsScheduled?: number;
    interviewsCompleted?: number;
    placements: number;
    placementsJoined?: number;
    clients: number;
    tenantLeads: number;
    tasks?: number;
    tasksOpen?: number;
    hqLeads: number;
    hqLeadConversionRate: number;
    hqCompanies: number;
    hotLeads?: number;
    pipelineValue?: number;
    monthlyBillingTotal?: number;
    billingTenants?: number;
    trialTenants?: number;
    demosVerified: number;
    demosPurchases: number;
    demosTrials: number;
    demosPending?: number;
    demosExpired?: number;
    demosTotal?: number;
    demosTrialsLive?: number;
    followUpsToday: number;
    mrr?: number;
    arr?: number;
    platformHealthScore?: number;
    concentrationTop1JobsPct?: number;
    concentrationTop3JobsPct?: number;
  };
  charts: {
    hiringFunnel: HqAnalyticsChartPoint[];
    landingFunnel?: HqAnalyticsChartPoint[];
    tenantsByPlan: HqAnalyticsChartPoint[];
    tenantsByType: HqAnalyticsChartPoint[];
    tenantsBySignup?: HqAnalyticsChartPoint[];
    leadsByStage: HqAnalyticsChartPoint[];
    leadsByScore?: HqAnalyticsChartPoint[];
    companiesByStatus: HqAnalyticsChartPoint[];
    demosByKind?: HqAnalyticsChartPoint[];
    demosByStatus?: HqAnalyticsChartPoint[];
    jobsByStatus?: HqAnalyticsChartPoint[];
    interviewsByStatus?: HqAnalyticsChartPoint[];
    placementsByStatus?: HqAnalyticsChartPoint[];
    tenantActivity: Array<HqAnalyticsChartPoint & { openJobs?: number; placements?: number }>;
    mrrByPlan?: Array<HqAnalyticsChartPoint & { tenantCount?: number }>;
    featureUsage?: HqAnalyticsChartPoint[];
  };
  tables: {
    rankedTenants: HqEmployerTenantRow[];
    atRiskTenants?: HqEmployerAtRiskTenant[];
    recentTenantActivity: Array<{
      tenant: string;
      tenantDbName: string;
      openJobs: number;
      candidates: number;
      candidates7d?: number;
      applications7d?: number;
      interviews: number;
      interviewsToday?: number;
      placements: number;
      placementsJoined?: number;
      tasksOpen?: number;
      plan: string;
      organizationType: string;
      health?: number;
    }>;
    recentJobs?: Array<{
      id: string;
      title: string;
      status: string;
      company: string;
      location: string;
      openings: number;
      updatedAt: string | null;
      tenant: string;
      tenantDbName: string;
    }>;
    recentPlacements?: Array<{
      id: string;
      candidate: string;
      job: string;
      company: string;
      status: string;
      salary: number | null;
      joiningDate: string | null;
      updatedAt: string | null;
      tenant: string;
      tenantDbName: string;
    }>;
    crmLeads: Array<{
      id: string;
      name: string;
      company: string;
      stage: string;
      score: string;
      owner: string;
      nextFollowUp: string;
      estimatedDealValue: number;
      industry?: string;
      country?: string;
    }>;
    crmCompanies?: Array<{
      id: string;
      name: string;
      status: string;
      score: string;
      industry: string;
      country: string;
      owner: string;
      nextFollowUp: string;
    }>;
    recentDemos?: Array<{
      id: string;
      name: string;
      company: string;
      email: string;
      requestKind: string;
      status: string;
      submittedAt: string | null;
    }>;
    crmLeadStats: Record<string, number>;
    crmCompanyStats: Record<string, number>;
    demoStats: Record<string, number>;
  };
  insights: HqAnalyticsInsight[];
};

export type HqAnalyticsPayload = {
  generatedAt: string;
  durationMs?: number;
  live?: boolean;
  employee: HqEmployeeAnalytics;
  employer: HqEmployerAnalytics;
};

export type HqBillingTransactionDirection = 'credit' | 'debit';

export type HqBillingCandidatePurchaseRow = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  packageId: string | null;
  packageName: string;
  tokens: number;
  balanceAfter: number;
  reference: string;
  description: string;
  purchasedAt: string | null;
};

export type HqBillingCandidateTransactionRow = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  type: string;
  label: string;
  amount: number;
  direction: HqBillingTransactionDirection;
  unit: string;
  balanceAfter: number;
  packageId: string | null;
  packageName: string;
  service: string;
  reference: string;
  description: string;
  occurredAt: string | null;
};

export type HqBillingEmployerTransactionRow = {
  id: string;
  tenantId: string;
  tenantName: string;
  email: string;
  tenantDbName: string;
  type: string;
  label: string;
  amount: number;
  direction: HqBillingTransactionDirection;
  unit: string;
  balanceAfter?: number;
  reference: string;
  description: string;
  featureId?: string;
  packId?: string;
  occurredAt: string | null;
  actorEmail: string;
};

export type HqBillingLedgerStats = {
  purchases: number;
  spends: number;
  grants: number;
  coinsIn: number;
  coinsOut: number;
  total: number;
};

export type HqBillingCandidateLedgerPayload = {
  entity: {
    id: string;
    name: string;
    email: string;
    phone: string;
    title: string;
    tokenBalance: number;
    phase: 'phase1';
  };
  transactions: HqBillingCandidateTransactionRow[];
  stats: HqBillingLedgerStats;
};

export type HqBillingEmployerLedgerPayload = {
  entity: {
    phase: 'phase2';
    tenantId: string;
    tenantName: string;
    email: string;
    tenantDbName: string;
    planName: string;
    billingCycle: 'monthly' | 'annual';
    aiCoins: number;
    price: string | null;
    planStartDate: string | null;
    planEndDate: string | null;
  };
  transactions: HqBillingEmployerTransactionRow[];
  stats: HqBillingLedgerStats;
};

export type HqBillingTenantCycleRow = {
  tenantId: string;
  tenantName: string;
  email: string;
  tenantDbName: string;
  signupSource: string;
  planName: string;
  planId: string | null;
  billingCycle: 'monthly' | 'annual';
  price: string | null;
  planStartDate: string | null;
  planEndDate: string | null;
  purchasedAt: string | null;
  lastPaymentReference: string | null;
  isTrial: boolean;
  aiCoins: number;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type HqBillingPurchaseRequestRow = {
  id: string;
  fullName: string;
  email: string;
  organizationName: string;
  requestKind: string;
  packageName: string;
  packageSlug: string;
  billingCycle: 'monthly' | 'annual';
  trialProvisioned: boolean;
  trialTenantDbName: string;
  status: string;
  submittedAt: string | null;
  createdAt: string | null;
};

export type HqBillingPayload = {
  overview: {
    employer: {
      totalTenants: number;
      tenantsOnPlan: number;
      monthlyCycles: number;
      annualCycles: number;
      landingPurchases: number;
      purchaseRequests: number;
      coinPurchases?: number;
      coinSpends?: number;
      totalTransactions?: number;
    };
    candidate: {
      totalPurchases: number;
      totalSpends?: number;
      totalGrants?: number;
      totalTokensSold: number;
      totalTokensSpent?: number;
      uniqueBuyers: number;
      activePackTypes: number;
      totalTransactions?: number;
    };
    generatedAt: string;
  };
  candidate: {
    transactions: HqBillingCandidateTransactionRow[];
    stats: HqBillingLedgerStats;
  };
  employer: {
    tenantCycles: HqBillingTenantCycleRow[];
    purchaseRequests: HqBillingPurchaseRequestRow[];
    transactions: HqBillingEmployerTransactionRow[];
    stats: {
      totalTenants: number;
      tenantsOnPlan: number;
      monthlyCycles: number;
      annualCycles: number;
      landingPurchases: number;
      purchaseRequests: number;
      totalTransactions?: number;
    };
  };
};

export async function apiHqGetBilling() {
  return apiFetch<HqBillingPayload>('/hq/billing', { auth: true });
}

export async function apiHqGetCandidateBillingLedger(candidateId: string) {
  return apiFetch<HqBillingCandidateLedgerPayload>(
    `/hq/billing/candidate/${encodeURIComponent(candidateId)}/ledger`,
    { auth: true },
  );
}

export async function apiHqGetEmployerBillingLedger(tenantKey: string) {
  return apiFetch<HqBillingEmployerLedgerPayload>(
    `/hq/billing/employer/${encodeURIComponent(tenantKey)}/ledger`,
    { auth: true },
  );
}

export async function apiHqGetAnalytics() {
  const bust = Date.now();
  return apiFetch<HqAnalyticsPayload>(`/hq/analytics?_=${bust}`, { auth: true });
}

export type HqCustomReportRow = {
  id: string;
  name: string;
  dataset:
    | 'leads'
    | 'clients'
    | 'demos'
    | 'tenants'
    | 'tickets'
    | 'team'
    | 'candidates'
    | 'kyc'
    | 'courses'
    | 'jobs'
    | 'events'
    | 'helpTickets'
    | 'companies';
  groupBy: string;
  metric: 'count' | 'pipeline';
  dateFrom?: string;
  dateTo?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdByEmail?: string | null;
};

export async function apiHqListCustomReports() {
  return apiFetch<{ reports: HqCustomReportRow[] }>('/hq/reports', { auth: true });
}

export async function apiHqCreateCustomReport(body: {
  name: string;
  dataset: HqCustomReportRow['dataset'];
  groupBy: string;
  metric?: HqCustomReportRow['metric'];
  dateFrom?: string;
  dateTo?: string;
}) {
  return apiFetch<{ report: HqCustomReportRow }>('/hq/reports', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqUpdateCustomReport(
  reportId: string,
  body: {
    name: string;
    dataset: HqCustomReportRow['dataset'];
    groupBy: string;
    metric?: HqCustomReportRow['metric'];
    dateFrom?: string;
    dateTo?: string;
  },
) {
  return apiFetch<{ report: HqCustomReportRow }>(`/hq/reports/${encodeURIComponent(reportId)}`, {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqDeleteCustomReport(reportId: string) {
  return apiFetch<{ deleted: boolean; id: string }>(`/hq/reports/${encodeURIComponent(reportId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiHqDeletePortalJob(
  jobId: string,
  body: { tenantDbName?: string } = {},
) {
  return apiFetch<{
    jobId: string;
    tenantDbName: string;
    deletedFromTenant: boolean;
    deletedFromPortal: boolean;
  }>(`/hq/portal/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
    auth: true,
    body,
  });
}

export async function apiHqSetPortalJobClientVisibility(
  jobId: string,
  body: { showClientNamePublicly: boolean; tenantDbName?: string },
) {
  return apiFetch<{
    jobId: string;
    tenantDbName: string;
    showClientNamePublicly: boolean;
    updatedTenant: boolean;
    updatedPortal: boolean;
  }>(`/hq/portal/jobs/${encodeURIComponent(jobId)}/client-visibility`, {
    method: 'PATCH',
    auth: true,
    body,
  });
}

export type HqPushJobsToFeedsResult = {
  scanned: number;
  eligible: number;
  updated: number;
  alreadyInFeed: number;
  mirroredToPortal: number;
  skipped: number;
  skippedByReason: Record<string, number>;
  feedUrls: {
    adzuna: string;
    careerjet: string;
  };
};

export async function apiHqPushJobsToExternalFeeds() {
  return apiFetch<HqPushJobsToFeedsResult>('/hq/portal/jobs/push-to-feeds', {
    method: 'POST',
    auth: true,
  });
}

export async function apiHqAssignTenantPlan(body: {
  email: string;
  billingCycle?: 'monthly' | 'annual';
  coins?: number;
  plan: { id?: string; name?: string; billingCycle?: 'monthly' | 'annual'; coins?: number };
}) {
  return apiFetch<{ email: string; subscriptionPlan: HqTenantSubscriptionPlan | null }>(
    '/hq/tenants/plan',
    { method: 'PUT', auth: true, body }
  );
}

export async function apiHqSetTenantCoins(body: { email: string; coins: number }) {
  return apiFetch<{
    email: string;
    coins: number;
    subscriptionPlan: HqTenantSubscriptionPlan | null;
  }>('/hq/tenants/coins', { method: 'PUT', auth: true, body });
}

export type HqAiFeature = {
  id: string;
  name: string;
  description: string;
  coins: number;
  category: string;
  defaultCoins?: number;
  isCustomCost?: boolean;
  locked?: boolean;
  affordable?: boolean;
};

export async function apiHqListAiFeatures() {
  return apiFetch<{ features: HqAiFeature[] }>('/hq/ai-features', { auth: true });
}

export async function apiHqUpdateAiFeatures(body: {
  features?: Array<{ id: string; coins: number }>;
  costs?: Record<string, number>;
}) {
  return apiFetch<{
    features: HqAiFeature[];
    costs: Record<string, number>;
    changed?: Array<{ id: string; name?: string; previous?: number; coins?: number }>;
    updatedAt?: string;
  }>('/hq/ai-features', {
    method: 'PUT',
    auth: true,
    body,
  });
}

export type HqAiCoinPack = {
  id: string;
  name: string;
  coins: number;
  priceUsd: number;
  priceLabel: string;
  description: string;
  popular?: boolean;
  active?: boolean;
  sortOrder?: number;
};

export async function apiHqListAiCoinPacks() {
  return apiFetch<{ packs: HqAiCoinPack[] }>('/hq/ai-coin-packs', { auth: true });
}

export async function apiHqSaveAiCoinPacks(body: { packs: HqAiCoinPack[] }) {
  return apiFetch<{ packs: HqAiCoinPack[] }>('/hq/ai-coin-packs', {
    method: 'PUT',
    auth: true,
    body,
  });
}

export type HqPhase1TokenPack = {
  id: string;
  name: string;
  tokens: number;
  priceAmount: number;
  priceLabel: string;
  currency?: string;
  description?: string;
  popular?: boolean;
  active?: boolean;
  sortOrder?: number;
};

export type HqPhase1TokenService = {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: string;
  defaultCost?: number;
  isCustomCost?: boolean;
};

export type HqPhase1EarnTask = {
  id: string;
  name: string;
  description: string;
  tokens: number;
  category: string;
  order?: number;
  defaultTokens?: number;
  isCustomTokens?: boolean;
};

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

export async function apiHqSetTenantPause(body: { email: string; paused: boolean }) {
  return apiFetch<{
    email: string;
    status: string;
    pausedAt?: string | null;
    pausedBy?: string;
  }>('/hq/tenants/pause', { method: 'PUT', auth: true, body });
}

export async function apiHqUpdateTenantModules(body: {
  email: string;
  productLine?: 'crm' | 'recruitment';
  enabledModules: string[];
  phase1CommonPoolEnabled?: boolean;
}) {
  return apiFetch<{
    email: string;
    productLine?: string;
    enabledModules?: string[];
    modulesRestricted?: boolean;
    phase1CommonPoolEnabled?: boolean;
    tenantDbName?: string;
  }>('/hq/tenants/modules', { method: 'PUT', auth: true, body });
}

export async function apiHqUpdateTenantOrganizationName(body: {
  email: string;
  organizationName: string;
}) {
  return apiFetch<{
    email: string;
    organizationName: string;
    tenantDbName?: string;
    syncedToTenant?: boolean;
  }>('/hq/tenants/organization-name', { method: 'PUT', auth: true, body });
}

export interface InvoicePaymentReminder {
  id: string;
  mode: 'now' | 'schedule';
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  toEmail: string;
  note?: string | null;
  scheduledAt: string;
  timezone?: string | null;
  createdAt?: string;
  sentAt?: string | null;
  error?: string | null;
}

export interface SendInvoiceReminderPayload {
  mode: 'now' | 'schedule';
  /** Wall-clock date `YYYY-MM-DD` — required when mode is `schedule`. */
  scheduledDate?: string;
  /** Wall-clock time `HH:mm` — required when mode is `schedule`. */
  scheduledTime?: string;
  /** IANA timezone the date/time is expressed in. */
  timezone?: string;
  toEmail?: string;
  note?: string;
}

export async function apiSendInvoiceReminder(invoiceId: string, payload: SendInvoiceReminderPayload) {
  return apiFetch<{ billingRecordId: string; reminder: InvoicePaymentReminder }>(
    `/billing/${encodeURIComponent(invoiceId)}/reminders`,
    { method: 'POST', auth: true, body: payload },
  );
}

export async function apiListInvoiceReminders(invoiceId: string) {
  return apiFetch<{
    billingRecordId: string;
    canRemind: boolean;
    status: string;
    reminders: InvoicePaymentReminder[];
  }>(`/billing/${encodeURIComponent(invoiceId)}/reminders`, { auth: true });
}

export async function apiCancelInvoiceReminder(invoiceId: string, reminderId: string) {
  return apiFetch<{ billingRecordId: string; reminderId: string; status: string }>(
    `/billing/${encodeURIComponent(invoiceId)}/reminders/${encodeURIComponent(reminderId)}`,
    { method: 'DELETE', auth: true },
  );
}

export interface InvoiceActivityEvent {
  kind:
    | 'lead'
    | 'client'
    | 'job'
    | 'candidate'
    | 'pipeline'
    | 'interview'
    | 'placement'
    | 'invoice'
    | 'payment'
    | 'reminder'
    | 'activity';
  title: string;
  description: string | null;
  at: string;
  meta?: Record<string, any>;
}

export interface InvoiceActivityResponse {
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    status: string;
    date: string;
    dueDate: string;
    paidAt: string | null;
    invoiceUrl?: string | null;
    hasInvoiceDocument?: boolean;
    canSendReminder?: boolean;
    reminders?: InvoicePaymentReminder[];
  };
  lead: { id: string; companyName: string | null; contactName: string | null; status: string | null; source: string | null } | null;
  client: { id: string; companyName: string | null; status: string | null; industry: string | null } | null;
  job: { id: string; title: string | null; status: string | null } | null;
  candidate: { id: string; name: string; email: string | null } | null;
  placement: {
    id: string;
    status: string | null;
    joiningDate: string | null;
    recruiter: string | null;
    fee: number;
  } | null;
  events: InvoiceActivityEvent[];
  auditMeta?: import('../types/audit').AuditMeta | null;
}

export async function apiGetInvoiceActivity(invoiceId: string) {
  return apiFetch<InvoiceActivityResponse>(`/billing/invoice/${encodeURIComponent(invoiceId)}/activity`, {
    auth: true,
  });
}

export async function apiUpdateInvoiceCurrency(invoiceId: string, currency: string) {
  return apiFetch<{ invoiceId: string; placementId: string | null; currency: string; updatedRecords: number }>(
    `/billing/invoice/${encodeURIComponent(invoiceId)}/currency`,
    { method: 'PATCH', auth: true, body: { currency } }
  );
}

export async function apiUpdateBillingRecord(
  invoiceId: string,
  payload: { status?: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'; paidAt?: string }
) {
  return apiFetch<{ id: string; status: string; paidAt: string | null }>(`/billing/${encodeURIComponent(invoiceId)}`, {
    method: 'PATCH',
    auth: true,
    body: payload,
  });
}

export async function apiGetBillingRecord(invoiceId: string) {
  return apiFetch<Record<string, any>>(`/billing/${encodeURIComponent(invoiceId)}`, { auth: true });
}

export async function apiUpdateBillingDraftInvoice(
  invoiceId: string,
  payload: CreatePlacementInvoicePayload
) {
  return apiFetch<Record<string, any>>(`/billing/${encodeURIComponent(invoiceId)}/draft-invoice`, {
    method: 'PATCH',
    auth: true,
    body: payload,
  });
}

export async function apiSendBillingInvoice(
  invoiceId: string,
  payload?: { toEmail?: string; pdfBase64?: string; pdfFilename?: string }
) {
  return apiFetch<{ billingRecordId: string; toEmail: string; invoiceNumber?: string }>(
    `/billing/${encodeURIComponent(invoiceId)}/send-invoice`,
    {
      method: 'POST',
      auth: true,
      body: payload || {},
    },
  );
}

export async function apiDeleteBillingRecord(invoiceId: string) {
  return apiFetch<{ message: string }>(`/billing/${encodeURIComponent(invoiceId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiHqDeleteTenant(body: { email: string; dropDatabase?: boolean }) {
  // Soft-delete: moves the tenant to HQ Recycle Bin. The tenant database is kept.
  const path = `/hq/tenants/${encodeURIComponent(body.email)}`;
  return apiFetch<{
    deleted: boolean;
    softDeleted?: boolean;
    movedToRecycleBin?: boolean;
    email: string;
    tenantDbName: string | null;
    databaseDropped: boolean;
  }>(path, { method: 'DELETE', auth: true });
}

export async function apiHqListRecycleBin() {
  return apiFetch<{ items: HqTenantRow[]; count: number }>('/hq/recycle-bin', { auth: true });
}

export async function apiHqRestoreTenant(email: string) {
  return apiFetch<{ restored: boolean; email: string; tenantDbName: string | null }>(
    '/hq/recycle-bin/restore',
    { method: 'POST', body: { email }, auth: true },
  );
}

export async function apiHqPurgeTenant(email: string, dropDatabase = true) {
  const path = `/hq/recycle-bin/${encodeURIComponent(email)}${
    dropDatabase ? '' : '?dropDatabase=false'
  }`;
  return apiFetch<{ purged: boolean; email: string; databaseDropped: boolean }>(path, {
    method: 'DELETE',
    auth: true,
  });
}

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
    import('./tenant-behavior-engine/track').then(({ trackTenantApiCall }) => {
      trackTenantApiCall(path, options.method || 'POST');
    }).catch(() => {});
  }

  return json as ApiResponse<T>;
}

export type BulkCvStoredFileMeta = {
  storedFileId: string;
  name: string;
  size: number;
};

export type BulkCvExpandZipResult = {
  total: number;
  skipped: number;
  maxAllowed: number;
  files: BulkCvStoredFileMeta[];
};

export async function apiBulkCvExpandZip(
  archive: File,
  sessionId: string,
  options: { signal?: AbortSignal; apiBase?: string } = {}
) {
  const formData = new FormData();
  formData.append('sessionId', sessionId);
  formData.append('archive', archive);
  return apiFetchFormData<BulkCvExpandZipResult>('/candidates/bulk-cv/expand-zip', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
    apiBase: options.apiBase,
  });
}

export async function apiBulkCvReleaseZip(
  sessionId: string,
  options: { apiBase?: string } = {}
) {
  const apiBase = options.apiBase?.replace(/\/$/, '') || resolveApiBaseForPath('/candidates/bulk-cv/release-zip');
  const url = `${apiBase}/candidates/bulk-cv/release-zip`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (!token) throw new Error('Authentication required. Please log in.');
  headers.Authorization = `Bearer ${token}`;
  const tenantDbName = getTenantDbName();
  if (tenantDbName) headers['x-tenant-db-name'] = tenantDbName;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId }),
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store',
    });
  } catch (fetchError: unknown) {
    throw normalizeFetchError(fetchError);
  }

  const json = await readApiJson<any>(res);
  if (!res.ok || json?.success === false) {
    throw createHttpApiError(res.status, json?.message || `Request failed with status ${res.status}`, {
      data: json?.data,
      raw: json,
    });
  }
  return json as ApiResponse<unknown>;
}

export async function apiBulkCvProcessFile(
  payload: { file?: File; storedFileId?: string },
  sessionId: string,
  fileIndex: number,
  options: { signal?: AbortSignal; apiBase?: string } = {}
) {
  const formData = new FormData();
  formData.append('sessionId', sessionId);
  formData.append('fileIndex', String(fileIndex));
  if (payload.storedFileId) {
    formData.append('storedFileId', payload.storedFileId);
  } else if (payload.file) {
    formData.append('resume', payload.file);
  }
  return apiFetchFormData<Record<string, unknown>>('/candidates/bulk-cv/process-file', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
    apiBase: options.apiBase,
  });
}

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

interface AuthUser {
  id: string;
  name: string;
  email: string;
  loginId?: string;
  role?: string;
  roleName?: string;
  roleColor?: string;
}

interface AuthPayload {
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
  if (typeof window !== 'undefined') {
    const fromUrl = new URLSearchParams(window.location.search).get('tenantDbName');
    if (fromUrl) {
      syncTenantDbName(fromUrl);
    }
  }
  const tenantDbNameHint = getTenantDbName();
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
      ? (res.data as { hqPermissionIds: string[] }).hqPermissionIds.filter((id) => String(id).startsWith('hq_'))
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

    await syncOrgRecruitmentSummaryFromApi();
  }

  return res;
}

function applyTenantDbNameFromUrl() {
  if (typeof window === 'undefined') return;
  const fromUrl = new URLSearchParams(window.location.search).get('tenantDbName');
  if (fromUrl) {
    syncTenantDbName(fromUrl);
  }
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

      await syncOrgRecruitmentSummaryFromApi();
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
    const { markIntentionalLogout } = await import('./sessionAuth');
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
      const { clearAllEmployerPageCaches } = await import('./employerPageCache');
      clearAllEmployerPageCaches();
    } catch {
      /* ignore */
    }
  }
}

// ────────────────────────────────────────────────────────────
// Users
// ────────────────────────────────────────────────────────────

export interface BackendUser {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  loginId?: string | null;
  role: string;
  department?: string | null;
  designation?: string | null;
  location?: string | null;
  status?: string | null;
  phone?: string | null;
  avatar?: string | null;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt?: string;
  /** Company name entered when HQ created this tenant. */
  organizationName?: string | null;
  companyName?: string | null;
}

export async function apiGetMe() {
  return apiFetch<BackendUser>('/users/me', { auth: true });
}

export async function apiUpdateMe(data: Partial<BackendUser>) {
  return apiFetch<BackendUser>('/users/me', {
    method: 'PATCH',
    body: data,
    auth: true,
  });
}

export type JobVisibilityDefaultsPayload = {
  publicFieldVisibility?: Record<string, boolean> | null;
  showClientNamePublicly?: boolean;
  updatedAt?: string | null;
};

export async function apiGetJobVisibilityDefaults() {
  return apiFetch<JobVisibilityDefaultsPayload>('/users/me/job-visibility-defaults', { auth: true });
}

export async function apiSaveJobVisibilityDefaults(body: JobVisibilityDefaultsPayload) {
  return apiFetch<JobVisibilityDefaultsPayload>('/users/me/job-visibility-defaults', {
    method: 'PUT',
    body,
    auth: true,
  });
}

export interface MyPermissionsPayload {
  id: string;
  role: string;
  roleName: string;
  roleColor?: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  permissions: string[];
}

export const USER_PERMISSIONS_CHANGED_EVENT = 'hrayntra:user-permissions-changed';

const PERMISSIONS_REFRESH_MIN_INTERVAL_MS = 5_000;
let permissionsRefreshInFlight: Promise<MyPermissionsPayload | null> | null = null;
let permissionsRefreshLastAt = 0;
let permissionsRefreshLastResult: MyPermissionsPayload | null = null;

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
  if (permissionsRefreshInFlight) {
    return permissionsRefreshInFlight;
  }
  if (
    permissionsRefreshLastResult &&
    now - permissionsRefreshLastAt < PERMISSIONS_REFRESH_MIN_INTERVAL_MS
  ) {
    return permissionsRefreshLastResult;
  }

  permissionsRefreshInFlight = (async () => {
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

    permissionsRefreshLastAt = Date.now();
    permissionsRefreshLastResult = data;
    return data;
  } catch (error) {
    console.warn('Failed to refresh user permissions', error);
    return null;
  } finally {
    permissionsRefreshInFlight = null;
  }
  })();

  return permissionsRefreshInFlight;
}

export async function apiUploadUserAvatar(userId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', 'user');
  formData.append('entityId', userId);
  formData.append('fileType', 'Avatar');
  
  return apiFetchFormData<{ fileUrl: string }>('/files', formData, {
    method: 'POST',
    auth: true,
  });
}

export async function apiUploadCandidateAvatar(candidateId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', 'candidate');
  formData.append('entityId', candidateId);
  formData.append('fileType', 'Photo');
  return apiFetchFormData<{ id?: string; fileUrl?: string }>('/files', formData, {
    method: 'POST',
    auth: true,
  });
}

// ────────────────────────────────────────────────────────────
// Jobs
// ────────────────────────────────────────────────────────────

export interface BackendJob {
  id: string;
  title: string;
  description?: string | null;
  overview?: string | null;
  location?: string | null;
  status: string;
  /** Tenant-facing label when org uses custom job statuses */
  statusLabel?: string | null;
  openings: number;
  createdAt: string;
  postedDate?: string | null;
  client?: {
    id: string;
    companyName: string;
  } | null;
  assignedToId?: string | null;
  createdById?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  } | null;
  _count?: {
    matches: number;
    interviews: number;
    placements?: number;
  };
  department?: string;
  hiringManager?: string;
  hiringManagerId?: string;
  type?: string;
  salary?: {
    min?: number;
    max?: number;
    amount?: string | number;
    type?: string;
    currency?: string;
  } | null;
  experienceRequired?: string | null;
  education?: string | null;
  priority?: string | null;
  keyResponsibilities?: string[];
  candidateRequirements?: string[];
  skills?: string[];
  preferredSkills?: string[];
  benefits?: string[];
  requirements?: string[];
  nationality?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  languages?: Array<{ language: string; proficiency: string }> | null;
  workMode?: string | null;
  expectedClosureDate?: string | null;
  jdFileName?: string | null;
  videoMediaLink?: string | null;
  forecastRevenue?: string | null;
  hot?: boolean;
  aiMatch?: boolean;
  noCandidates?: boolean;
  slaRisk?: boolean;
  visibility?: string | null;
  showClientNamePublicly?: boolean | null;
  publicFieldVisibility?: Record<string, boolean> | null;
  aboutCompany?: string | null;
  recruiterProfile?: {
    id?: string;
    name?: string;
    designation?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
  } | null;
  manager?: { id: string; name: string; email?: string } | null;
  managerId?: string | null;
  jobLocationType?: string | null;
  applicationFormEnabled?: boolean;
  applicationFormLogo?: string | null;
  applicationFormQuestions?: string[];
  applicationFormNote?: string | null;
  applicationFormSchema?: { version: number; fields: unknown[] } | null;
  preScreenAssessments?: unknown[];
  applyLinkToken?: string | null;
  applyUrl?: string | null;
  matches?: Array<{
    id?: string;
    candidateId?: string;
    score?: number;
    stage?: string;
    interviewStatus?: string;
    updatedAt?: string;
    createdAt?: string;
    recruiter?: { name?: string };
    candidate?: {
      id?: string;
      firstName?: string | null;
      lastName?: string | null;
      stage?: string;
      recruiter?: { name?: string };
    };
  }>;
  pipelineStages?: Array<{
    id: string;
    name: string;
    order: number;
    color?: string;
    systemRole?: string | null;
    _count?: { entries?: number };
  }>;
  applications?: Array<{
    id: string;
    candidateId: string;
    status?: string;
    appliedAt?: string;
    screeningAnswers?: Record<string, unknown> | null;
    candidate?: {
      id?: string;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } | null;
  }>;
}

export interface PaginatedJobs {
  items: BackendJob[];
}

export async function apiGetJobs(params: {
  status?: string;
  clientId?: string;
  assignedToId?: string;
  search?: string;
  page?: number;
  limit?: number;
  ids?: string;
  /** When true, backend returns only jobs created by the logged-in user */
  mine?: boolean;
}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'boolean') {
      if (value) query.set(key, 'true');
      return;
    }
    query.set(key, String(value));
  });
  const qs = query.toString();
  const path = `/jobs${qs ? `?${qs}` : ''}`;
  return apiFetch<BackendJob[]>(path, { auth: true });
}

export interface CreateJobData {
  title: string;
  description?: string;
  overview?: string;
  requirements?: string[];
  skills?: string[];
  preferredSkills?: string[];
  keyResponsibilities?: string[];
  candidateRequirements?: string[];
  location?: string;
  type?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP';
  status?: 'DRAFT' | 'OPEN' | 'ON_HOLD' | 'CLOSED' | 'FILLED';
  /** Display label (supports tenant custom statuses) */
  statusLabel?: string | null;
  clientId: string;
  /** Job assignee (recruiter). Use `null` on PATCH to unassign. */
  assignedToId?: string | null;
  openings?: number;
  salary?: any;
  experienceRequired?: string;
  education?: string;
  benefits?: string[];
  postedDate?: string;
  hiringManager?: string;
  hiringManagerId?: string;
  department?: string;
  jobCategory?: string;
  jobLocationType?: string;
  workMode?: string;
  expectedClosureDate?: string;
  jdFileName?: string;
  hot?: boolean;
  aiMatch?: boolean;
  noCandidates?: boolean;
  slaRisk?: boolean;
  pipelineStages?: Array<{
    id?: string;
    name: string;
    sla?: string;
    order?: number;
    systemRole?: string | null;
  }>;
  applicationFormEnabled?: boolean;
  applicationFormLogo?: string;
  applicationFormQuestions?: string[];
  applicationFormNote?: string;
  applicationFormSchema?: { version: number; fields: unknown[] };
  statusRemark?: string;
  priority?: string;
  nationality?: string;
  country?: string;
  state?: string;
  city?: string;
  forecastRevenue?: string;
  videoMediaLink?: string;
  languages?: Array<{ language: string; proficiency: string }>;
  managerId?: string | null;
  supportingRecruiters?: string[];
  /** When false, client name is hidden on Phase 1 listings and social posts. Default true. */
  showClientNamePublicly?: boolean;
  /** Per-field visibility for public apply page, Phase 1, and social posts. */
  publicFieldVisibility?: Record<string, boolean>;
  aboutCompany?: string | null;
  distributionPlatforms?: {
    internalCompany?: boolean;
    companyPage?: boolean;
    hryantra?: boolean;
    externalPlatforms?: boolean;
    adzuna?: boolean;
    careerjet?: boolean;
    socialMedia?: boolean;
  };
  preScreenAssessments?: Array<{
    assessmentId: string;
    sortOrder?: number;
    required?: boolean;
    timing?: string;
    durationOverrideMinutes?: number | null;
    passScoreOverridePercent?: number | null;
  }>;
}

export const apiCreateJob = async (data: CreateJobData) => {
  return apiFetch<BackendJob>('/jobs', {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiGetJob = async (id: string) => {
  return apiFetch<BackendJob>(`/jobs/${id}`, { auth: true });
};

function resolvePhase1CandidatePortalBase(): string | null {
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

export const apiGetJobApplyLink = async (jobId: string) => {
  const frontendBase = resolvePhase1CandidatePortalBase();
  const qs = frontendBase ? `?frontendBase=${encodeURIComponent(frontendBase)}` : '';
  return apiFetch<{ token: string; applyUrl: string }>(`/jobs/${jobId}/apply-link${qs}`, {
    auth: true,
  });
};

export const apiListApplicationFormTemplates = async () => {
  return apiFetch<Array<{ id: string; name: string; schema: unknown }>>(
    '/jobs/application-form-templates',
    { auth: true }
  );
};

export const apiCreateApplicationFormTemplate = async (payload: {
  name: string;
  schema: unknown;
}) => {
  return apiFetch<{ id: string; name: string; schema: unknown }>(
    '/jobs/application-form-templates',
    { method: 'POST', body: payload, auth: true }
  );
};

export const apiListLinkedInPostTemplates = async () => {
  return apiFetch<Array<{ id: string; name: string; schema: unknown; createdAt?: string; updatedAt?: string }>>(
    '/jobs/linkedin-post-templates',
    { auth: true },
  );
};

export const apiCreateLinkedInPostTemplate = async (payload: {
  name: string;
  schema: unknown;
}) => {
  return apiFetch<{ id: string; name: string; schema: unknown }>(
    '/jobs/linkedin-post-templates',
    { method: 'POST', body: payload, auth: true },
  );
};

export const apiUpdateLinkedInPostTemplate = async (
  id: string,
  payload: { name?: string; schema?: unknown },
) => {
  return apiFetch<{ id: string; name: string; schema: unknown }>(
    `/jobs/linkedin-post-templates/${id}`,
    { method: 'PATCH', body: payload, auth: true },
  );
};

export const apiDeleteLinkedInPostTemplate = async (id: string) => {
  return apiFetch<{ deleted: boolean }>(`/jobs/linkedin-post-templates/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const listPreScreenAssessments = async (type?: string) => {
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  return apiFetch<unknown[]>(`/pre-screen-assessments/library${qs}`, { auth: true });
};

export const createPreScreenAssessment = async (payload: Record<string, unknown>) => {
  return apiFetch<Record<string, unknown>>('/pre-screen-assessments/library', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const generatePreScreenAssessmentsWithAi = async (payload: {
  jobTitle: string;
  skills?: string[];
  jobDescription?: string;
}) => {
  return apiFetch<{
    mcq: Record<string, unknown>;
    coding: Record<string, unknown>;
    questionCount?: number;
    codingTestCaseCount?: number;
  }>('/pre-screen-assessments/library/generate', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const generateMcqPreScreenAssessmentWithAi = async (payload: {
  jobTitle: string;
  skills?: string[];
  jobDescription?: string;
}) => {
  return apiFetch<{
    title: string;
    type: 'MCQ';
    durationMinutes: number;
    passScorePercent: number;
    config: { questions: unknown[]; antiCheat?: unknown };
  }>('/pre-screen-assessments/library/generate', {
    method: 'POST',
    body: { ...payload, type: 'MCQ' },
    auth: true,
  });
};

export const generateCodingPreScreenAssessmentWithAi = async (payload: {
  jobTitle: string;
  skills?: string[];
  jobDescription?: string;
}) => {
  return apiFetch<{
    title: string;
    type: 'CODING';
    durationMinutes: number;
    passScorePercent: number;
    config: { questions?: unknown[]; language?: string; antiCheat?: unknown };
  }>('/pre-screen-assessments/library/generate', {
    method: 'POST',
    body: { ...payload, type: 'CODING' },
    auth: true,
  });
};

export const updatePreScreenAssessment = async (id: string, payload: Record<string, unknown>) => {
  return apiFetch<Record<string, unknown>>(`/pre-screen-assessments/library/${id}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const deletePreScreenAssessment = async (id: string) => {
  return apiFetch<unknown>(`/pre-screen-assessments/library/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const getJobPreScreenAssessments = async (jobId: string) => {
  return apiFetch<unknown[]>(`/pre-screen-assessments/jobs/${jobId}`, { auth: true });
};

export const replaceJobPreScreenAssessments = async (
  jobId: string,
  links: NonNullable<CreateJobData['preScreenAssessments']>
) => {
  return apiFetch<unknown[]>(`/pre-screen-assessments/jobs/${jobId}`, {
    method: 'PUT',
    body: { preScreenAssessments: links },
    auth: true,
  });
};

export const getApplicationAssessmentResults = async (applicationId: string) => {
  return apiFetch<unknown[]>(`/pre-screen-assessments/applications/${applicationId}/results`, {
    auth: true,
  });
};

export type CandidateAssessmentResultGroup = {
  jobId: string;
  jobTitle: string;
  applicationId?: string | null;
  results: Array<Record<string, unknown>>;
};

export const getCandidateAssessmentResults = async (
  candidateId: string,
  jobId?: string | null,
) => {
  const scopedJobId = String(jobId || '').trim();
  const qs = scopedJobId ? `?jobId=${encodeURIComponent(scopedJobId)}` : '';
  return apiFetch<CandidateAssessmentResultGroup[]>(
    `/pre-screen-assessments/candidates/${encodeURIComponent(candidateId)}/results${qs}`,
    { auth: true },
  );
};

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

export const apiGetPublicApplyPage = async (token: string, tenantDbName?: string) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  return apiFetch<{ job: Record<string, unknown>; formSchema: unknown }>(
    `/jobs/public/apply/${encodeURIComponent(token)}${qs}`,
    { auth: false, includeTenantHeader: Boolean(tenant) }
  );
};

export const apiSubmitPublicApply = async (
  token: string,
  formData: FormData,
  tenantDbName?: string
) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  const headers: Record<string, string> = {};
  if (tenant) headers['x-tenant-db-name'] = tenant;
  const res = await fetch(
    `${API_BASE}/jobs/public/apply/${encodeURIComponent(token)}/submit${qs}`,
    {
      method: 'POST',
      body: formData,
      headers,
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || 'Failed to submit application');
  }
  return json;
};

export interface JobMetrics {
  activeJobs: number;
  newJobsThisWeek: number;
  appliedCandidates: number;
  noCandidates: number;
  nearSla: number;
  closedThisMonth: number;
}

export const apiGetJobMetrics = async (params?: { mine?: boolean }) => {
  const qs =
    params?.mine === true ? '?mine=true' : '';
  return apiFetch<JobMetrics>(`/jobs/metrics${qs}`, { auth: true });
};

export interface UpdateJobData extends CreateJobData {
  id: string;
}

export const apiUpdateJob = async (id: string, data: CreateJobData) => {
  return apiFetch<BackendJob>(`/jobs/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteJob = async (id: string) => {
  return apiFetch<{ message: string }>(`/jobs/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Candidates
// ────────────────────────────────────────────────────────────

export interface BackendCandidate {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  phone?: string | null;
  linkedIn?: string | null;
  /** Stored on backend Candidate model; used for linked job and interview scheduling fallback */
  assignedJobs?: string[];
  /** Computed by backend candidates list for display */
  assignedJobTitles?: string[];
  experience?: number | null;
  location?: string | null;
  status: string;
  source?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  resume?: string | null;
  /** Profile photo URL (Cloudinary, S3, etc.) */
  avatar?: string | null;
  skills?: string[];
  address?: string | null;
  city?: string | null;
  country?: string | null;
  availability?: string | null;
  noticePeriod?: string | null;
  stage?: string | null;
  /** Phase 1 / candidatecommon pool row */
  isPhase1Candidate?: boolean;
  /** Discovery-only Phase 1 candidate (not yet on a tenant job) */
  isNewCandidate?: boolean;
  /** Assigned to a job and/or applied — CRM stage is Applied */
  isJobAppliedCandidate?: boolean;
  applications?: Array<{
    id?: string;
    jobId?: string;
    status?: string;
    job?: { id?: string; title?: string | null };
  }>;
  pipelineEntries?: Array<{ id?: string; jobId?: string }>;
  poolOrigin?: 'phase1_common' | 'phase1' | 'tenant' | string | null;
  tags?: string[];
  expectedSalary?: number | null;
  currentSalary?: number | null;
  education?: string | null;
  certifications?: string[];
  languages?: string[];
  portfolio?: string | null;
  website?: string | null;
  notes?: string | null;
  cvSummary?: string | null;
  cvEducationEntries?: Array<{
    degree?: string;
    institution?: string;
    startYear?: string;
    endYear?: string;
  }> | null;
  cvWorkExperienceEntries?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    responsibilities?: string[];
  }> | null;
  cvPortfolioLinks?: Array<{
    type?: string;
    url?: string;
  }> | null;
  preferredLocation?: string | null;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  } | null;
  /**
   * Candidate-self-entered career preferences from the job portal.
   * Backend merges this in from the portal `career_preferences` collection.
   */
  careerPreferences?: {
    currentRole?: string | null;
    preferredJobTitles?: string[];
    preferredRoles?: string[];
    preferredIndustries?: string[];
    preferredIndustry?: string | null;
    functionalAreas?: string[];
    functionalArea?: string | null;
    jobTypes?: string[];
    workModes?: string[];
    preferredWorkMode?: string | null;
    preferredLocations?: string[];
    relocationPreference?: string | null;
    salaryCurrency?: string | null;
    salaryAmount?: number | string | null;
    salaryFrequency?: string | null;
    preferredCurrency?: string | null;
    preferredSalary?: number | null;
    preferredSalaryType?: string | null;
    preferredBenefits?: string[];
    availabilityToStart?: string | null;
    noticePeriod?: string | null;
    noticePeriodDays?: number | null;
    openToRelocation?: boolean;
    currentLocation?: string | null;
    currentSalary?: number | null;
    currentCurrency?: string | null;
    currentSalaryType?: string | null;
    currentBenefits?: string[];
    passportNumbersByLocation?: Record<string, string> | null;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
  extraData?: Record<string, unknown> | null;
  matches?: Array<{
    id: string;
    jobId?: string;
    status?: string;
    score?: number;
    createdById?: string | null;
    evaluation?: { origin?: string; pending?: boolean } | null;
    job?: {
      id: string;
      title: string;
      client?: {
        companyName: string;
      };
    };
  }>;
  pipelineEntries?: Array<{
    id?: string;
    jobId?: string;
    stageId?: string;
    movedAt?: string;
    notes?: string | null;
    stage?: {
      id?: string;
      name?: string;
    } | null;
  }>;
  interviews?: Array<{
    id: string;
    status?: string;
    scheduledAt?: string;
    round?: string | null;
    duration?: number | null;
    mode?: string | null;
    timezone?: string | null;
    platform?: string | null;
    meetingLink?: string | null;
    location?: string | null;
    notes?: string | null;
    interviewer?: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      role?: string | null;
      department?: string | null;
    } | null;
    job?: {
      id: string;
      title: string;
    } | null;
  }>;
  placements?: Array<{
    id: string;
    jobId?: string;
    status?: string;
    updatedAt?: string;
    createdAt?: string;
    deletedAt?: string | null;
  }>;
  placementStatus?: string | null;
  tagObjects?: Array<{
    id: string;
    label: string;
    color: string;
  }>;
  internalNotes?: Array<{
    id: string;
    text: string;
    createdAt: string;
    recruiter: {
      id?: string;
      name: string;
      avatar?: string | null;
    };
    tags?: string[];
    isPinned?: boolean;
  }>;
  activityFeed?: Array<{
    id: string;
    type:
      | 'stage-movement'
      | 'email-sent'
      | 'resume-parsed'
      | 'added-to-pipeline'
      | 'interview-scheduled'
      | 'rejected'
      | 'note-added';
    title: string;
    description?: string | null;
    timestamp: string;
    performedBy: {
      name: string;
      avatar?: string | null;
    };
    relatedJob?: string | null;
  }>;
  aiCandidateAnalysis?: {
    source?: 'match' | 'estimated' | string;
    jobTitle?: string | null;
    overall?: number;
    breakdown?: {
      skillsMatch?: number;
      experienceFit?: number;
      educationFit?: number;
      keywordMatch?: number;
    };
    insights?: Array<{
      type?: 'strength' | 'gap' | string;
      text?: string;
    }>;
  };
  rating?: number | null;
  hotlist: boolean;
  avatar?: string | null;
  createdById?: string | null;
}

export async function apiGetCandidates(params: {
  status?: string;
  stage?: string;
  assignedToId?: string;
  search?: string;
  company?: string;
  location?: string;
  jobId?: string;
  experienceRange?: string;
  page?: number;
  limit?: number;
  ids?: string;
  mine?: boolean;
  /** Merge verified Phase 1 snapshots from candidatecommon DB */
  includeCommonPool?: boolean;
}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'boolean') {
      if (value) query.set(key, 'true');
      return;
    }
    query.set(key, String(value));
  });
  const qs = query.toString();
  const path = `/candidates${qs ? `?${qs}` : ''}`;
  return apiFetch<BackendCandidate[]>(path, { auth: true, includeTenantHeader: true });
}

export const apiGetCandidate = async (id: string) => {
  return apiFetch<BackendCandidate>(`/candidates/${id}`, { auth: true });
};

export interface UpdateCandidatePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  linkedIn?: string;
  resume?: string | null;
  skills?: string[];
  experience?: number | null;
  currentTitle?: string;
  currentCompany?: string;
  designation?: string;
  location?: string;
  status?: string;
  source?: string;
  assignedToId?: string | null;
  noticePeriod?: string;
  availability?: string;
  expectedSalary?: number | null;
  currentSalary?: number | null;
  education?: string;
  certifications?: string[];
  languages?: string[];
  portfolio?: string;
  website?: string;
  notes?: string;
  cvSummary?: string;
  cvEducationEntries?: Array<{
    degree?: string;
    institution?: string;
    startYear?: string;
    endYear?: string;
  }>;
  cvWorkExperienceEntries?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    responsibilities?: string[];
  }>;
  cvPortfolioLinks?: Array<{
    type?: string;
    url?: string;
  }>;
  preferredLocation?: string;
  address?: string;
  city?: string;
  country?: string;
  stage?: string;
  assignedJobs?: string[];
  avatar?: string | null;
  extraData?: Record<string, unknown> | null;
  salary?: {
    min?: number | null;
    max?: number | null;
    currency?: string;
  } | null;
}

export const apiUpdateCandidate = async (id: string, data: UpdateCandidatePayload) => {
  return apiFetch<BackendCandidate>(`/candidates/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteCandidate = async (id: string) => {
  return apiFetch<{ message: string }>(`/candidates/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export interface AddCandidatePayload {
  firstName: string;
  lastName: string;
  email: string | null;
  phone?: string;
  currentCompany?: string;
  designation?: string;
  currentDesignation?: string;
  experience: number | string;
  location?: string;
  linkedinUrl?: string;
  jobId?: string;
  stage?: string;
  recruiterId?: string;
  source: string;
  sourceUrl?: string;
  referrerName?: string;
  agencyName?: string;
  priority?: string;
  tags?: string[];
  expectedSalary?: number | string;
  currency?: string;
  noticePeriod?: string;
  availabilityStatus?: string;
  portfolioUrl?: string;
  skills?: string[];
  initialNote?: string;
  currentSalary?: number | string;
  education?: string;
  certifications?: string[];
  languages?: string[];
  notes?: string;
  cvSummary?: string;
  cvEducationEntries?: Array<{
    degree?: string;
    institution?: string;
    startYear?: string;
    endYear?: string;
  }>;
  cvWorkExperienceEntries?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    responsibilities?: string[];
  }>;
  cvPortfolioLinks?: Array<{
    type?: string;
    url?: string;
  }>;
  city?: string;
  country?: string;
  preferredLocation?: string;
  address?: string;
  website?: string;
  extraData?: Record<string, unknown>;
  resume?: string;
  duplicateAction?: 'create' | 'updateExisting' | 'createAnyway';
}

export interface DuplicateCheckCandidate {
  _id: string;
  name: string;
  email?: string;
  phone?: string | null;
  currentCompany?: string | null;
  designation?: string | null;
  stage?: string | null;
}

export interface DuplicateCheckResponse {
  isDuplicate: boolean;
  matchedOn?: 'email' | 'phone';
  candidate?: DuplicateCheckCandidate;
}

export interface ImportedProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  currentCompany?: string;
  designation?: string;
  currentDesignation?: string;
  experience?: number | string;
  location?: string;
  linkedinUrl?: string;
  source?: string;
  priority?: string;
  tags?: string[];
  skills?: string[];
  expectedSalary?: number;
  currentSalary?: number;
  currency?: string;
  portfolioUrl?: string;
  education?: string;
  certifications?: string[];
  languages?: string[];
  summary?: string;
  city?: string;
  country?: string;
  noticePeriod?: string;
  score?: {
    overall?: number;
    breakdown?: {
      skillsMatch?: number;
      experienceFit?: number;
      educationFit?: number;
      keywordMatch?: number;
    };
    insights?: string[];
  };
  resumeUrl?: string | null;
  resumeFileName?: string | null;
  /** Cloudinary (or other HTTPS) URL for a photo extracted from the CV PDF; null if none. */
  profilePhotoUrl?: string | null;
  educationEntries?: Array<{
    degree?: string;
    institution?: string;
    startYear?: string;
    endYear?: string;
  }>;
  workExperienceEntries?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    responsibilities?: string[];
  }>;
  portfolioLinks?: Array<{
    type?: string;
    url?: string;
  }>;
  githubUrl?: string;
  extraData?: Record<string, unknown>;
  rawEmailsFound?: string[];
  rawPhonesFound?: string[];
  tempFilePath?: string;
  parsedAt?: string;
  importedAt?: string;
  isMockData?: boolean;
}

export interface CandidateTagSuggestion {
  id: string;
  name: string;
  label?: string;
  usageCount?: number;
  color?: string;
}

export interface BulkImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  skippedDetails: Array<{
    row: number;
    email: string;
    reason: string;
  }>;
}

export interface ClientImportPreviewResult {
  fileName: string;
  sheetName: string;
  columns: string[];
  previewRows: Record<string, string | number | boolean | null>[];
  rows?: Record<string, string | number | boolean | null>[];
  totalRows: number;
  columnStats: Record<string, number>;
  suggestedMapping: Record<string, string>;
}

export interface ClientImportExecuteResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface ClientImportDuplicateField {
  key: string;
  label: string;
}

export interface ClientImportDuplicateRecord {
  rowIndex: number;
  matchedBy: string[];
  imported: Record<string, string | null>;
  existing: { id: string } & Record<string, string | null>;
}

export interface ClientImportDuplicateCheckResult {
  totalRows: number;
  duplicateCount: number;
  duplicates: ClientImportDuplicateRecord[];
  compareFields: ClientImportDuplicateField[];
}

export type LeadImportPreviewResult = ClientImportPreviewResult;
export type LeadImportExecuteResult = ClientImportExecuteResult;
export interface LeadImportDuplicateField {
  key: string;
  label: string;
}

export interface LeadImportDuplicateRecord {
  rowIndex: number;
  matchedBy: string[];
  imported: Record<string, string | null>;
  existing: { id: string } & Record<string, string | null>;
}

export interface LeadImportDuplicateCheckResult {
  totalRows: number;
  duplicateCount: number;
  duplicates: LeadImportDuplicateRecord[];
  compareFields: LeadImportDuplicateField[];
}

export const apiCreateCandidateFromDrawer = async (
  payload: AddCandidatePayload,
  options: { signal?: AbortSignal } = {}
) => {
  return apiFetch<BackendCandidate>('/candidates/create', {
    method: 'POST',
    body: payload,
    auth: true,
    signal: options.signal,
  });
};

export const apiParseCandidateResume = async (
  file: File,
  options: { signal?: AbortSignal } = {}
) => {
  const formData = new FormData();
  formData.append('resume', file);
  return apiFetchFormData<ImportedProfileData>('/candidates/parse-resume', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
};

export const apiImportCandidateFromLinkedIn = async (linkedinUrl: string) => {
  return apiFetch<ImportedProfileData>('/candidates/import-linkedin', {
    method: 'POST',
    body: { linkedinUrl },
    auth: true,
  });
};

export const apiCheckCandidateDuplicate = async (params: { email?: string; phone?: string }) => {
  const query = new URLSearchParams();
  if (params.email) query.set('email', params.email);
  if (params.phone) query.set('phone', params.phone);
  return apiFetch<DuplicateCheckResponse>(`/candidates/check-duplicate?${query.toString()}`, {
    auth: true,
  });
};

export const apiUploadCandidateResumeFile = async (
  candidateId: string,
  file: File,
  options: { signal?: AbortSignal } = {}
) => {
  const formData = new FormData();
  formData.append('resume', file);
  return apiFetchFormData<BackendCandidate>(`/candidates/${candidateId}/files`, formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
};

export const apiBulkImportCandidates = async (file: File) => {
  const formData = new FormData();
  formData.append('csvFile', file);
  return apiFetchFormData<BulkImportResult>('/candidates/bulk-import', formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiPreviewClientImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<ClientImportPreviewResult>('/clients/import/preview', formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiImportClients = async (payload: {
  rows: Record<string, string | number | boolean | null>[];
  mapping: Record<string, string>;
  duplicateRule: string;
}) => {
  return apiFetch<ClientImportExecuteResult>('/clients/import', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiCheckClientImportDuplicates = async (payload: {
  rows: Record<string, string | number | boolean | null>[];
  mapping: Record<string, string>;
}) => {
  return apiFetch<ClientImportDuplicateCheckResult>('/clients/import/check-duplicates', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export type AgreementDocumentParseData = {
  terms: {
    agreementLevel?: string;
    agreementServiceChargePercent?: string;
    agreementContractValidity?: string;
    agreementContractStartDate?: string;
    agreementContractEndDate?: string;
    agreementTimePeriod?: string;
    agreementAdvancePaymentPercent?: string;
    agreementFreeReplacementValue?: string;
    agreementFreeReplacementUnit?: 'MONTHS' | 'DAYS';
  };
  filledCount: number;
  textLength?: number;
};

export const apiParseAgreementDocument = async (
  file: File,
  options: { signal?: AbortSignal } = {},
) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetchFormData<AgreementDocumentParseData>('/agreements/parse-document', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
  return res.data;
};

export type KycDocumentParseData = {
  form: Partial<import('./clientKycForm').PostServiceKycFormValues>;
  filledCount: number;
  textLength?: number;
  sourceType?: string;
  message?: string | null;
};

export const apiParseKycDocument = async (file: File, options: { signal?: AbortSignal } = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetchFormData<KycDocumentParseData>('/kyc/parse-document', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
  return res.data;
};

export const apiPreviewLeadImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<LeadImportPreviewResult>('/leads/import/preview', formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiImportLeads = async (payload: {
  rows: Record<string, string | number | boolean | null>[];
  mapping: Record<string, string>;
  duplicateRule: string;
}) => {
  return apiFetch<LeadImportExecuteResult>('/leads/import', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiCheckLeadImportDuplicates = async (payload: {
  rows: Record<string, string | number | boolean | null>[];
  mapping: Record<string, string>;
}) => {
  return apiFetch<LeadImportDuplicateCheckResult>('/leads/import/check-duplicates', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiGetCandidateTagSuggestions = async () => {
  return apiFetch<CandidateTagSuggestion[]>('/tags', { auth: true });
};

export const apiAddCandidateNote = async (
  candidateId: string,
  note: { text: string; tags: string[] }
) => {
  return apiFetch(`/candidates/${candidateId}/notes`, {
    method: 'POST',
    body: note,
    auth: true,
  });
};

export const apiUpdateCandidateNote = async (
  candidateId: string,
  noteId: string,
  note: { text: string; tags: string[] }
) => {
  return apiFetch(`/candidates/${candidateId}/notes/${noteId}`, {
    method: 'PATCH',
    body: note,
    auth: true,
  });
};

export const apiDeleteCandidateNote = async (candidateId: string, noteId: string) => {
  return apiFetch(`/candidates/${candidateId}/notes/${noteId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiPinCandidateNote = async (
  candidateId: string,
  noteId: string,
  isPinned: boolean
) => {
  return apiFetch(`/candidates/${candidateId}/notes/${noteId}/pin`, {
    method: 'PATCH',
    body: { isPinned },
    auth: true,
  });
};

export const apiAddCandidateTag = async (
  candidateId: string,
  tag: { id?: string; label: string; color?: string }
) => {
  return apiFetch(`/candidates/${candidateId}/tags`, {
    method: 'POST',
    body: { tag },
    auth: true,
  });
};

export const apiRemoveCandidateTag = async (candidateId: string, tagId: string) => {
  return apiFetch(`/candidates/${candidateId}/tags/${tagId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiAddCandidateToPipeline = async (
  candidateId: string,
  payload: {
    jobId: string;
    stage: string;
    recruiterId?: string;
    priority: 'High' | 'Medium' | 'Low';
    notes?: string;
  }
) => {
  return apiFetch<BackendCandidate>(`/candidates/${candidateId}/pipeline`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiRemoveCandidateFromPipeline = async (candidateId: string, jobId: string) => {
  return apiFetch<BackendCandidate>(`/candidates/${candidateId}/pipeline`, {
    method: 'DELETE',
    body: { jobId },
    auth: true,
  });
};

export const apiGetPipelineStages = async (jobId: string) => {
  return apiFetch<Array<{ id: string; name: string; order?: number }>>(`/pipeline/job/${jobId}`, {
    auth: true,
  });
};

export const apiMoveCandidateStage = async (
  jobId: string,
  payload: {
    candidateId: string;
    stageId: string;
    notes?: string;
  }
) => {
  return apiFetch(`/pipeline/job/${jobId}/move`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiRejectCandidate = async (
  candidateId: string,
  payload: {
    reason: string;
    feedback: string;
    sendEmail: boolean;
    /** When true, the rejection feedback is shown on the candidate's job-portal application timeline. */
    showFeedbackToCandidate?: boolean;
    /** Required for correct portal sync when multiple jobs exist — e.g. pass the interview's job id. */
    jobId?: string;
  }
) => {
  return apiFetch<BackendCandidate>(`/candidates/${candidateId}/reject`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiGetCandidateStats = async (params?: {
  mine?: boolean;
  includeCommonPool?: boolean;
}) => {
  const query = new URLSearchParams();
  if (params?.mine === true) query.set('mine', 'true');
  if (params?.includeCommonPool === true) query.set('includeCommonPool', 'true');
  const qs = query.toString();
  return apiFetch<{
    all: number;
    applied: number;
    longlist: number;
    shortlist: number;
    screening: number;
    submitted: number;
    interviewing: number;
    offered: number;
    hired: number;
    rejected: number;
  }>(`/candidates/stats${qs ? `?${qs}` : ''}`, { auth: true });
};

export const apiBulkActionCandidates = async (
  action: 'assign_recruiter' | 'add_tag' | 'reject' | 'export',
  candidateIds: string[],
  payload?: any
) => {
  return apiFetch<any>(`/candidates/bulk-action`, {
    method: 'POST',
    body: { action, candidateIds, ...payload },
    auth: true,
  });
};

export const apiScheduleCandidateInterview = async (
  candidateId: string,
  payload: {
    jobId?: string | null;
    clientId?: string | null;
    type: string;
    round: number;
    date: string;
    time: string;
    duration: string;
    timezone?: string;
    mode: 'video' | 'in-person' | 'phone';
    platform?: 'GOOGLE_MEET' | 'ZOOM' | null;
    meetingLink?: string | null;
    location?: string | null;
    phoneNumber?: string | null;
    interviewers: Array<{
      id: string;
      name: string;
      role: 'Lead Interviewer' | 'Interviewer' | 'Observer';
    }>;
    notes?: string;
    sendCandidateInvite?: boolean;
    sendInterviewerInvite?: boolean;
  }
) => {
  return apiFetch(`/candidates/${candidateId}/interviews`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiUpdateCandidateInterview = async (
  candidateId: string,
  interviewId: string,
  payload: {
    jobId?: string | null;
    type?: string;
    round?: number;
    date?: string;
    time?: string;
    duration?: string;
    timezone?: string;
    mode?: 'video' | 'in-person' | 'phone';
    platform?: 'GOOGLE_MEET' | 'ZOOM' | null;
    meetingLink?: string | null;
    location?: string | null;
    phoneNumber?: string | null;
    interviewers?: Array<{
      id: string;
      name: string;
      role: 'Lead Interviewer' | 'Interviewer' | 'Observer';
    }>;
    notes?: string;
    sendCandidateInvite?: boolean;
    sendInterviewerInvite?: boolean;
    status?: 'scheduled' | 'completed' | 'cancelled';
  }
) => {
  return apiFetch(`/candidates/${candidateId}/interviews/${interviewId}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiGenerateCandidateInterviewMeetingLink = async (
  candidateId: string,
  payload: {
    jobId?: string | null;
    date: string;
    time: string;
    duration: string;
    timezone?: string;
    mode: 'video';
    platform: 'GOOGLE_MEET' | 'ZOOM';
    interviewers?: Array<{
      id: string;
      name: string;
      role: 'Lead Interviewer' | 'Interviewer' | 'Observer';
    }>;
    notes?: string;
  }
) => {
  const res = await apiFetch<{ meetingLink: string; platform: 'GOOGLE_MEET' | 'ZOOM' }>(`/candidates/${candidateId}/interviews/meeting-link`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
  return res.data;
};

// ────────────────────────────────────────────────────────────
// Interviews
// ────────────────────────────────────────────────────────────

export interface BackendInterviewListItem {
  id: string;
  scheduledAt: string;
  updatedAt?: string;
  createdAt?: string;
  duration: number;
  round?: string | null;
  type: string;
  mode?: string | null;
  platform?: string | null;
  timezone?: string | null;
  meetingLink?: string | null;
  location?: string | null;
  status: string;
  notes?: string | null;
  candidate: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email: string;
    phone?: string | null;
    avatar?: string | null;
    stage?: string | null;
    status?: string | null;
    extraData?: BackendCandidate['extraData'];
    isPhase1Candidate?: boolean;
  };
  job: {
    id: string;
    title: string;
    clientId?: string;
    client?: {
      id?: string;
      companyName: string;
    } | null;
  };
  client: {
    id: string;
    companyName: string;
    location?: string | null;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
  panel: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      department?: string | null;
      phone?: string | null;
    };
  }>;
  feedbackEntries: Array<{
    id: string;
    createdAt: string;
    strengths?: string | null;
    weakness?: string | null;
    comments?: string | null;
    recommendation: string;
    aiSummary?: string | null;
    technicalScore: number;
    communicationScore: number;
    problemSolvingScore: number;
    cultureFitScore: number;
    experienceMatchScore: number;
    overallScore: number;
    interviewer: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
    };
  }>;
  interviewNotes: Array<{
    id: string;
    note: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
    };
  }>;
  activityLogs: Array<{
    id: string;
    action: string;
    timestamp: string;
    metadata?: any;
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
    };
  }>;
  meetingLinkError?: string | null;
}

export interface BackendInterviewKpis {
  todayCount: number;
  upcomingCount: number;
  pendingFeedbackCount: number;
  completedCount: number;
  conversionRate?: number;
  avgFeedbackTime?: number;
}

export interface BackendInterviewListResponse {
  data: BackendInterviewListItem[];
  total: number;
  page: number;
  totalPages: number;
  kpis: BackendInterviewKpis;
}

export interface CreateInterviewPayload {
  candidateId: string;
  jobId: string;
  clientId: string;
  round: string;
  type: 'VIDEO' | 'PHONE' | 'IN_PERSON' | 'TECHNICAL_TEST' | 'ASSESSMENT' | 'GROUP_DISCUSSION';
  mode: 'ONLINE' | 'OFFLINE';
  date: string;
  duration: number;
  timezone: string;
  meetingPlatform?: 'ZOOM' | 'GOOGLE_MEET' | 'MS_TEAMS' | null;
  location?: string;
  panelUserIds: string[];
  panelRoles?: Record<string, 'HR' | 'TECHNICAL' | 'CLIENT' | 'HIRING_MANAGER'>;
  notes?: string;
  sendCalendarInvite: boolean;
  sendEmailNotification: boolean;
  sendWhatsappReminder: boolean;
}

export const apiGetInterviews = async (params: {
  page?: number;
  limit?: number;
  status?: string;
  round?: string;
  mode?: string;
  interviewerId?: string;
  candidateId?: string;
  jobId?: string;
  companyId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  ids?: string;
} = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  return apiFetch<BackendInterviewListResponse>(`/interviews${query.toString() ? `?${query.toString()}` : ''}`, {
    auth: true,
  });
};

export const apiGetInterview = async (id: string) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}`, { auth: true });
};

export const apiCreateInterview = async (payload: CreateInterviewPayload) => {
  return apiFetch<BackendInterviewListItem>('/interviews', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiUpdateInterview = async (
  id: string,
  payload: {
    candidateId?: string;
    jobId?: string;
    clientId?: string;
    round?: string;
    type?: string;
    mode?: string;
    date?: string;
    duration?: number;
    timezone?: string;
    meetingPlatform?: 'ZOOM' | 'GOOGLE_MEET' | 'MS_TEAMS' | null;
    location?: string | null;
    notes?: string | null;
    status?: string;
    panelUserIds?: string[];
    panelRoles?: Record<string, 'HR' | 'TECHNICAL' | 'CLIENT' | 'HIRING_MANAGER'>;
  }
) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiRescheduleInterview = async (
  id: string,
  payload: {
    newDate: string;
    newTime: string;
    reason: string;
    notifyCandidate: boolean;
    notifyInterviewer: boolean;
  }
) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}/reschedule`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiCancelInterview = async (
  id: string,
  payload: { reason: string; notes: string; notifyCandidate: boolean }
) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}/cancel`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiDeleteInterview = async (id: string) => {
  return apiFetch<{ message: string }>(`/interviews/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiSubmitInterviewToClient = async (
  id: string,
  payload: {
    toEmail?: string;
    message?: string;
    submissionType?: string;
    cvShareMode?: 'edited' | 'original' | 'saasa';
  }
) => {
  return apiFetch<{
    success: boolean;
    recipients: string[];
    reviewUrl: string;
    submissionType?: string;
  }>(`/interviews/${id}/submit-client`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export interface PublicClientReviewPayload {
  interviewId: string;
  submissionType: 'INITIAL_REVIEW' | 'INTERIM_REVIEW' | 'OFFER_CONFIRMATION' | 'GENERAL';
  candidate: {
    name: string;
    email: string;
    phone: string;
    currentCompany: string;
    designation: string;
    experience: number | null;
    skills: string[];
    languages: string[];
    education: string;
    certifications: string[];
    cvSummary: string;
    address: string;
    city: string;
    country: string;
    linkedIn: string;
    resume: string;
  };
  job: { title: string };
  client: { companyName: string };
  interviewFeedback: Array<{
    id: string;
    interviewerName: string;
    submittedAt: string;
    recommendation: string;
    comments: string;
    strengths: string;
    weakness: string;
    overallScore: number | null;
  }>;
  offerLetterUrl?: string | null;
}

export const apiGetPublicClientReview = async (token: string) => {
  return apiFetch<PublicClientReviewPayload>(
    `/interviews/public/review/${encodeURIComponent(token)}`,
    {
      method: 'GET',
      auth: false,
    }
  );
};

export const apiGetInterviewClientReviewContext = async (interviewId: string) => {
  return apiFetch<InterviewClientReviewContext>(`/interviews/${interviewId}/client-review`, {
    auth: true,
  });
};

export const apiSubmitPublicClientTag = async (
  token: string,
  data: { tag: string; comments?: string; offerLetter?: File | null }
) => {
  // We always send multipart so the same endpoint handles both the
  // tag-only case (initial / interim review) and the offer-letter upload
  // case without forking into two routes on the backend.
  const formData = new FormData();
  formData.append('tag', data.tag);
  if (data.comments) formData.append('comments', data.comments);
  if (data.offerLetter) formData.append('offerLetter', data.offerLetter);
  return apiFetchFormData<{
    success: boolean;
    tag: string;
    interviewId: string;
    offerLetterUrl?: string | null;
  }>(`/interviews/public/review/${encodeURIComponent(token)}/tag`, formData, {
    method: 'POST',
    auth: false,
  });
};

export const apiMarkInterviewNoShow = async (id: string, payload: { reason: string; notes: string }) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}/no-show`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiSubmitInterviewFeedback = async (
  id: string,
  payload: {
    technicalScore: number;
    communicationScore: number;
    problemSolvingScore: number;
    cultureFitScore: number;
    experienceMatchScore: number;
    overallScore?: number;
    strengths?: string;
    weakness?: string;
    comments?: string;
    recommendation: 'PASS' | 'REJECT' | 'HOLD' | 'NEXT_ROUND';
    salaryFit: boolean;
    availableToJoin: string;
  }
) => {
  return apiFetch(`/interviews/${id}/feedback`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiGenerateInterviewFeedbackSummary = async (id: string, feedbackId: string) => {
  return apiFetch<{ summary: string }>(`/interviews/${id}/feedback/ai-summary`, {
    method: 'POST',
    body: { feedbackId },
    auth: true,
  });
};

export const apiAddInterviewPanelMember = async (
  id: string,
  payload: { userId: string; role: 'HR' | 'TECHNICAL' | 'CLIENT' | 'HIRING_MANAGER' }
) => {
  return apiFetch(`/interviews/${id}/panel`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiRemoveInterviewPanelMember = async (id: string, panelId: string) => {
  return apiFetch(`/interviews/${id}/panel/${panelId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiGetInterviewNotes = async (id: string) => {
  return apiFetch(`/interviews/${id}/notes`, {
    auth: true,
  });
};

export const apiAddInterviewNote = async (id: string, note: string) => {
  return apiFetch(`/interviews/${id}/notes`, {
    method: 'POST',
    body: { note },
    auth: true,
  });
};

export const apiDeleteInterviewNote = async (id: string, noteId: string) => {
  return apiFetch(`/interviews/${id}/notes/${noteId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiGetInterviewKpis = async () => {
  return apiFetch<BackendInterviewKpis>('/interviews/kpis', {
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Interview application forms & Phase 1 submissions
// ────────────────────────────────────────────────────────────

export type InterviewApplicationFormStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type InterviewApplicationStatus =
  | 'SUBMITTED'
  | 'PENDING_REVIEW'
  | 'IN_INTERVIEW'
  | 'INTERVIEW_COMPLETED'
  | 'APPROVED'
  | 'REJECTED';

export type InterviewApplicationForm = {
  id: string;
  title: string;
  description?: string | null;
  schema: unknown;
  status: InterviewApplicationFormStatus;
  publicToken: string;
  publishedAt?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  applicationCount?: number;
};

export type InterviewApplicationRow = {
  id: string;
  interviewFormId: string;
  formName: string;
  candidateId: string;
  candidateName: string;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  resumeUrl?: string | null;
  responses?: unknown;
  status: InterviewApplicationStatus;
  assignedInterviewerIds: string[];
  interviewNotes?: string | null;
  rating?: number | null;
  feedback?: string | null;
  recommendation?: string | null;
  phase1SubmissionId?: string | null;
  reviewedAt?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  source?: string;
  formSchema?: unknown;
  candidate?: Record<string, unknown>;
};

export const apiListInterviewForms = async () => {
  return apiFetch<InterviewApplicationForm[]>('/interview-applications/forms', { auth: true });
};

export const apiGetInterviewForm = async (id: string) => {
  return apiFetch<InterviewApplicationForm>(`/interview-applications/forms/${id}`, { auth: true });
};

export const apiCreateInterviewForm = async (payload: {
  title: string;
  description?: string;
  schema?: unknown;
}) => {
  return apiFetch<InterviewApplicationForm>('/interview-applications/forms', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiUpdateInterviewForm = async (
  id: string,
  payload: { title?: string; description?: string; schema?: unknown },
) => {
  return apiFetch<InterviewApplicationForm>(`/interview-applications/forms/${id}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiPublishInterviewForm = async (id: string) => {
  return apiFetch<InterviewApplicationForm>(`/interview-applications/forms/${id}/publish`, {
    method: 'POST',
    auth: true,
  });
};

export const apiUnpublishInterviewForm = async (id: string) => {
  return apiFetch<InterviewApplicationForm>(`/interview-applications/forms/${id}/unpublish`, {
    method: 'POST',
    auth: true,
  });
};

export const apiArchiveInterviewForm = async (id: string) => {
  return apiFetch<InterviewApplicationForm>(`/interview-applications/forms/${id}/archive`, {
    method: 'POST',
    auth: true,
  });
};

export const apiDeleteInterviewForm = async (id: string) => {
  return apiFetch<{ deleted: boolean }>(`/interview-applications/forms/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiListInterviewApplications = async (params?: {
  formId?: string;
  status?: string;
  search?: string;
}) => {
  const query = new URLSearchParams();
  if (params?.formId) query.set('formId', params.formId);
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return apiFetch<InterviewApplicationRow[]>(
    `/interview-applications/applications${qs ? `?${qs}` : ''}`,
    { auth: true },
  );
};

export const apiListInterviewerApplications = async (params?: { status?: string }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return apiFetch<InterviewApplicationRow[]>(
    `/interview-applications/applications/interviewer${qs ? `?${qs}` : ''}`,
    { auth: true },
  );
};

export const apiGetInterviewApplication = async (id: string) => {
  return apiFetch<InterviewApplicationRow>(`/interview-applications/applications/${id}`, {
    auth: true,
  });
};

export const apiUpdateInterviewApplication = async (
  id: string,
  payload: Partial<{
    status: InterviewApplicationStatus;
    interviewNotes: string;
    rating: number;
    feedback: string;
    recommendation: string;
    assignedInterviewerIds: string[];
  }>,
) => {
  return apiFetch<InterviewApplicationRow>(`/interview-applications/applications/${id}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Placements
// ────────────────────────────────────────────────────────────

export const apiGetPlacements = async (params: PlacementFilters = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const path = `/placements${query.toString() ? `?${query.toString()}` : ''}`;
  return apiFetch<PlacementPaginatedResponse<Placement>>(path, { auth: true });
};

export const apiGetPlacementStats = async () => {
  return apiFetch<PlacementStats>('/placements/stats', { auth: true });
};

export const apiGetPlacement = async (id: string) => {
  return apiFetch<Placement>(`/placements/${id}`, { auth: true });
};

export const apiCreatePlacement = async (payload: CreatePlacementPayload, offerLetter?: File | null) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, String(value));
    }
  });
  if (offerLetter) {
    formData.append('offerLetter', offerLetter);
  }
  return apiFetchFormData<Placement>('/placements', formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiUpdatePlacement = async (
  id: string,
  payload: Partial<CreatePlacementPayload & { joiningDate?: string }>
) => {
  return apiFetch<Placement>(`/placements/${id}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiUpdatePlacementStatus = async (id: string, status: string) => {
  return apiFetch<Placement>(`/placements/${id}/status`, {
    method: 'PATCH',
    body: { status },
    auth: true,
  });
};

export const apiMarkPlacementJoined = async (
  id: string,
  payload: MarkJoinedPayload,
  joiningLetter?: File | null
) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, String(value));
    }
  });
  if (joiningLetter) {
    formData.append('joiningLetter', joiningLetter);
  }
  return apiFetchFormData<Placement>(`/placements/${id}/mark-joined`, formData, {
    method: 'PATCH',
    auth: true,
  });
};

export const apiMarkPlacementFailed = async (id: string, payload: MarkFailedPayload) => {
  return apiFetch<Placement>(`/placements/${id}/mark-failed`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export type PlacementInvoiceCreateResponse = Placement & {
  createdInvoice?: { id: string; invoiceNumber?: string | null };
};

export const apiGetBillingSettings = async () => {
  return apiFetch<BillingSettingsSnapshot>('/billing/settings', {
    auth: true,
  });
};

export const apiGetNextInvoiceNumber = async () => {
  return apiFetch<{ nextInvoiceNo: string }>('/billing/next-invoice-number', {
    auth: true,
  });
};

export const apiCreatePlacementInvoice = async (
  placementId: string,
  payload: CreatePlacementInvoicePayload = {} as CreatePlacementInvoicePayload
) => {
  return apiFetch<PlacementInvoiceCreateResponse>(`/placements/${placementId}/invoice`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiRequestPlacementReplacement = async (id: string, payload: RequestReplacementPayload) => {
  return apiFetch<Placement>(`/placements/${id}/request-replacement`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiSchedulePlacementJoining = async (id: string, payload: ScheduleJoiningPayload) => {
  return apiFetch<Placement>(`/placements/${id}/schedule-joining`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiResendPlacementOffer = async (id: string, offerLetter?: File | null) => {
  const formData = new FormData();
  if (offerLetter) {
    formData.append('offerLetter', offerLetter);
  }
  return apiFetchFormData<Placement>(`/placements/${id}/resend-offer`, formData, {
    method: 'PATCH',
    auth: true,
  });
};

export const apiUploadPlacementDocument = async (
  id: string,
  file: File,
  documentType: 'OFFER_LETTER' | 'JOINING_LETTER' | 'INVOICE' | 'AGREEMENT' | 'OTHER' = 'OTHER',
) => {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('documentType', documentType);
  return apiFetchFormData<Placement>(`/placements/${id}/documents`, formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiUndoPlacement = async (id: string) => {
  return apiFetch<{ message: string }>(`/placements/${id}/undo`, {
    method: 'PATCH',
    auth: true,
  });
};

export const apiDeletePlacement = async (id: string) => {
  return apiFetch<{ message: string }>(`/placements/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiExportPlacements = async (params: PlacementFilters = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const token = getAccessToken();
  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }

  const url = `${API_BASE}/placements/export${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json?.message || 'Failed to export placements');
  }

  return response.blob();
};

// ────────────────────────────────────────────────────────────
// Matches (Job Candidates)
// ────────────────────────────────────────────────────────────

export interface BackendMatch {
  id: string;
  candidateId: string;
  jobId: string;
  name: string;
  photo: string;
  initials: string;
  score: number;
  skills: string[];
  experience: number;
  location: string;
  salary: {
    expected: string;
    currency: string;
    amount: number;
    fit: 'excellent' | 'good' | 'average' | 'poor';
  };
  noticePeriod: string;
  status: string;
  /** CRM candidate.stage for job drawer — use this instead of match workflow status */
  candidateStage?: string | null;
  /** Raw Match.status enum (SUGGESTED, SHORTLISTED, …) */
  matchRecordStatus?: string | null;
  candidate?: { stage?: string | null };
  matchSource: 'ai' | 'manual';
  /** True when match came from Phase 1 / candidatecommon pool. */
  isPhase1Candidate?: boolean;
  /** True when match is from the applied-candidate pipeline (tenant assigned to job). */
  isAppliedCandidate?: boolean;
  explanation: {
    skills: boolean | 'partial';
    experience: boolean | 'partial';
    location: boolean | 'partial';
    salary: boolean | 'partial';
    text: string;
    matchedSkills: string[];
    missingSkills: string[];
    roleRequirement: string;
    /** Optional server-provided band; UI can derive from score if absent. */
    scoreBand?: string;
    /** Present when AI tab uses the 4-pass HR matching pipeline (v1). */
    aiEngine?: {
      deterministicScore: number;
      aiScore: number | null;
      verdict: string;
      confidenceLevel: string;
      confidenceScore: number;
      breakdown?: {
        skills?: number;
        experience?: number;
        semantic?: number;
        cultural?: number;
      } & Record<string, number>;
      pipelineWeights?: { p1?: number; p2?: number; p3?: number; p4?: number };
      suggestion?: string;
      runId?: string;
      formula?: string;
    };
  };
  currentTitle: string;
  currentCompany: string;
  email: string;
  phone: string;
  resumeName: string;
  portfolioUrl?: string;
  savedAt?: string | null;
  notes: Array<{
    id: string;
    text: string;
    createdAt: string;
    author: string;
  }>;
  activity: Array<{
    id: string;
    title: string;
    description: string;
    timestamp: string;
  }>;
  matchRating?: number | null;
  submittedHistory?: {
    date: string;
    status: string;
  } | null;
  createdBy?: { name: string };
  createdAt?: string;
  /** CRM candidate owner (assigned recruiter). */
  candidateOwner?: string | null;
  city?: string | null;
  country?: string | null;
  experienceYears?: number | null;
}

export async function apiGetMatches(params: {
  jobId?: string;
  candidateId?: string;
  status?: string;
  minScore?: number;
  /** Set to `'1'` to run the 4-pass AI pipeline (Scores + persist). Omit for list-only fetch. */
  runPipeline?: string;
  /** Set to `'1'` to bypass the 24h server-side evaluation cache and re-run the pipeline. */
  refresh?: string;
  forceRefresh?: string;
  source?: 'ai' | 'manual' | 'applied';
  saved?: boolean;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  const path = `/matches${qs ? `?${qs}` : ''}`;
  return apiFetch<{ data: BackendMatch[]; pagination?: any }>(path, { auth: true });
}

export const apiCreateMatch = async (payload: {
  candidateId: string;
  jobId: string;
  score?: number;
  status?: string;
  notes?: string;
}) => {
  return apiFetch<BackendMatch>('/matches', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

/** Find or create the Match row used by Submit to Client (handles applied-pool candidates). */
export const apiResolveMatchForSubmit = async (payload: {
  candidateId: string;
  jobId: string;
  score?: number;
}) => {
  return apiFetch<{ id: string }>('/matches/resolve-for-submit', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiToggleSavedMatch = async (matchId: string, saved: boolean) => {
  return apiFetch<BackendMatch>(`/matches/${matchId}/save`, {
    method: 'POST',
    body: { saved },
    auth: true,
  });
};

export const apiSubmitMatch = async (
  matchId: string,
  payload: {
    message: string;
    notifyClient: boolean;
    submissionType?: string;
    cvShareMode?: 'edited' | 'original' | 'saasa';
    toEmail?: string;
    additionalClients?: Array<{ clientId: string; toEmail?: string }>;
    batchMatchIds?: string[];
  }
) => {
  return apiFetch<BackendMatch>(`/matches/${matchId}/submit`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiRejectMatch = async (
  matchId: string,
  payload: { reason: string; notes: string }
) => {
  return apiFetch<BackendMatch>(`/matches/${matchId}/reject`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiBulkRejectMatches = async (payload: {
  matchIds: string[];
  reason: string;
  notes?: string;
}) => {
  return apiFetch<{ count: number; items: BackendMatch[] }>('/matches/bulk/reject', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiBulkAddMatchesToPipeline = async (payload: {
  candidateIds: string[];
  jobId: string;
  stage: string;
  recruiterId?: string;
  notes?: string;
  priority?: string;
}) => {
  return apiFetch<{ count: number; items: any[] }>('/matches/bulk/pipeline', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiBulkEmailMatches = async (payload: {
  matchIds: string[];
  subject: string;
  message: string;
  submissionType?: string;
}) => {
  return apiFetch<{ count: number; recipients: string[] }>('/matches/bulk/email', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Leads
// ────────────────────────────────────────────────────────────

export interface BackendLead {
  id: string;
  companyName: string | null;
  contactPerson: string | null;
  directorName?: string | null;
  directorSalutation?: string | null;
  email: string | null;
  phone?: string | null;
  emails?: string[];
  phones?: string[];
  type: 'Company' | 'Individual' | 'Referral';
  source?: 'Website' | 'LinkedIn' | 'Email' | 'Referral' | 'Campaign' | 'Other' | null;
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  convertedToClientId?: string | null;
  client?: {
    id: string;
    companyName: string;
  } | null;
  priority: 'High' | 'Medium' | 'Low';
  interestedNeeds?: string | null;
  notes?: string | null;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  linkedIn?: string | null;
  location?: string | null;
  designation?: string | null;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  country?: string | null;
  city?: string | null;
  /** Smart-location autofill metadata sourced from OpenStreetMap/Nominatim. */
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  campaignName?: string | null;
  campaignLink?: string | null;
  referralName?: string | null;
  sourceWebsiteUrl?: string | null;
  sourceLinkedInUrl?: string | null;
  sourceEmail?: string | null;
  sourceOther?: string | null;
  otherDetails?: Array<{ label: string; value: string }> | null;
  lastFollowUp?: string | null;
  nextFollowUp?: string | null;
  lostReason?: string | null;
  /** Agreements & Terms — single primary document uploaded against the lead. */
  agreementsFileName?: string | null;
  agreementsFileUrl?: string | null;
  agreementsUploadedAt?: string | null;
  agreementTotalPayment?: string | null;
  agreementLevel?: string | null;
  agreementServiceChargePercent?: string | null;
  agreementContractValidity?: string | null;
  agreementContractStartDate?: string | null;
  agreementContractEndDate?: string | null;
  agreementTimePeriod?: string | null;
  agreementAdvancePaymentPercent?: string | null;
  agreementFreeReplacementValue?: number | null;
  agreementFreeReplacementUnit?: 'MONTHS' | 'DAYS' | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
  /** Multi-assignee — all team members the lead is shared with. */
  assignedToIds?: string[];
  /** Hydrated user records for `assignedToIds`, ordered to match. */
  assignedToUsers?: Array<{
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadData {
  companyName?: string | null;
  contactPerson?: string | null;
  directorName?: string;
  directorSalutation?: string | null;
  email?: string | null;
  phone?: string;
  emails?: string[];
  phones?: string[];
  type?: 'Company' | 'Individual' | 'Referral';
  source?: 'Website' | 'LinkedIn' | 'Email' | 'Referral' | 'Campaign' | 'Other';
  status?: string;
  priority?: 'High' | 'Medium' | 'Low';
  interestedNeeds?: string;
  servicesNeeded?: string;
  notes?: string;
  expectedBusinessValue?: string;
  industry?: string;
  sector?: string;
  companySize?: string;
  teamName?: string;
  website?: string;
  companyLinks?: string[];
  linkedIn?: string;
  location?: string;
  designation?: string;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  country?: string;
  city?: string;
  /** Smart-location autofill metadata. Latitude/Longitude are decimal degrees. */
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  campaignName?: string;
  campaignLink?: string;
  referralName?: string;
  sourceWebsiteUrl?: string;
  sourceLinkedInUrl?: string;
  sourceEmail?: string;
  sourceOther?: string;
  otherDetails?: Array<{ label: string; value: string }>;
  lastFollowUp?: string;
  nextFollowUp?: string;
  lostReason?: string;
  /**
   * Structured follow-up / meet schedule (type, link, reminder, timezone, attendees).
   * Backend emails invitees for Meet and stores reminder metadata.
   */
  followUpSchedule?: {
    type?: string;
    followUpType?: string;
    contact?: string;
    followUpContact?: string;
    meetLink?: string;
    followUpMeetLink?: string;
    reminder?: string;
    followUpReminder?: string;
    timezone?: string;
    followUpTimezone?: string;
    attendeeIds?: string[];
    followUpAttendeeIds?: string[];
    notes?: string;
    followUpNotes?: string;
    postponed?: boolean;
    postponeReason?: string;
  };
  /** Agreements & Terms — single primary document uploaded against the lead. */
  agreementsFileName?: string | null;
  agreementsFileUrl?: string | null;
  agreementsUploadedAt?: string | null;
  agreementTotalPayment?: string | null;
  agreementLevel?: string | null;
  agreementServiceChargePercent?: string | null;
  agreementTimePeriod?: string | null;
  agreementAdvancePaymentPercent?: string | null;
  agreementFreeReplacementValue?: number | null;
  agreementFreeReplacementUnit?: 'MONTHS' | 'DAYS' | null;
  assignedToId?: string;
  /** Multi-assignee list. First item also written to `assignedToId` (primary). */
  assignedToIds?: string[];
  /** Display name(s) for assignee(s) — used by HQ leadOwner snapshot. */
  assignedToName?: string;
  /**
   * Optional remark when changing status from the leads table.
   * Used only for activity logging; not stored directly on the Lead model.
   */
  statusRemark?: string;
}

export const apiGetLeads = async (params: {
  status?: string;
  source?: string;
  type?: string;
  priority?: string;
  assignedToId?: string;
  search?: string;
  /** Comma-separated lead ids from AI smart search (tenant DB row ids). */
  ids?: string;
  page?: number;
  limit?: number;
} = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  const path = `/leads${qs ? `?${qs}` : ''}`;
  // Backend returns: { success: true, message: "...", data: { data: [...], pagination: {...} } }
  return apiFetch<{ data: BackendLead[]; pagination?: any } | BackendLead[]>(path, { auth: true });
};

export const apiGetLead = async (id: string) => {
  return apiFetch<BackendLead>(`/leads/${id}`, { auth: true });
};

export const apiCreateLead = async (data: CreateLeadData) => {
  return apiFetch<BackendLead>('/leads', {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiGetLeadPublicFormLink = async () => {
  const frontendBase =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : undefined;
  const qs = frontendBase ? `?frontendBase=${encodeURIComponent(frontendBase)}` : '';
  return apiFetch<{ token: string; formUrl: string; title?: string; tenantDbName?: string | null }>(
    `/leads/public-form-link${qs}`,
    { auth: true }
  );
};

export const apiGetLeadPublicFormAccess = async () => {
  return apiFetch<{
    tenantDbName?: string;
    token?: string;
    accessCount?: number;
    leadsFilledCount?: number;
    members?: Array<{ name?: string; email?: string; leadCount?: number }>;
  }>('/leads/public-form-link/access', { auth: true });
};

export const apiInviteLeadPublicFormMember = async (payload: {
  name: string;
  designation: string;
  email: string;
  password: string;
}) => {
  const frontendBase =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : undefined;
  return apiFetch<{
    memberCreated?: boolean;
    alreadyExisted?: boolean;
    name?: string;
    designation?: string;
    email?: string;
    loginId?: string;
    formUrl?: string;
    tenantDbName?: string;
    emailSent?: boolean;
  }>('/leads/public-form-link/invite', {
    method: 'POST',
    auth: true,
    body: { ...payload, frontendBase },
  });
};

export const apiGetPublicLeadForm = async (token: string, tenantDbName?: string) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  if (tenant && typeof window !== 'undefined') {
    syncTenantDbName(tenant);
  }
  return apiFetch<{
    title: string;
    token: string;
    fields: string[];
  }>(`/leads/public/form/${encodeURIComponent(token)}${qs}`, {
    auth: false,
    includeTenantHeader: Boolean(tenant),
  });
};

export const apiSubmitPublicLeadForm = async (
  token: string,
  body: Record<string, unknown>,
  tenantDbName?: string
) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  if (tenant && typeof window !== 'undefined') {
    syncTenantDbName(tenant);
  }
  return apiFetch<{
    id: string;
    companyName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    status?: string;
    source?: string;
    industry?: string;
    location?: string;
    createdAt?: string;
    message?: string;
  }>(`/leads/public/form/${encodeURIComponent(token)}/submit${qs}`, {
    method: 'POST',
    body: tenant ? { ...body, tenantDbName: tenant } : body,
    auth: true,
    includeTenantHeader: Boolean(tenant),
  });
};

export const apiUpdatePublicLeadFormLead = async (
  token: string,
  leadId: string,
  body: Record<string, unknown>,
  tenantDbName?: string
) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  if (tenant && typeof window !== 'undefined') {
    syncTenantDbName(tenant);
  }
  return apiFetch<BackendLead>(
    `/leads/public/form/${encodeURIComponent(token)}/leads/${encodeURIComponent(leadId)}${qs}`,
    {
      method: 'PATCH',
      body: tenant ? { ...body, tenantDbName: tenant } : body,
      auth: true,
      includeTenantHeader: Boolean(tenant),
    }
  );
};

export const apiDeletePublicLeadFormLead = async (
  token: string,
  leadId: string,
  tenantDbName?: string
) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  if (tenant && typeof window !== 'undefined') {
    syncTenantDbName(tenant);
  }
  return apiFetch<{ id: string; deleted?: boolean }>(
    `/leads/public/form/${encodeURIComponent(token)}/leads/${encodeURIComponent(leadId)}${qs}`,
    {
      method: 'DELETE',
      auth: true,
      includeTenantHeader: Boolean(tenant),
    }
  );
};

export const apiGetPublicLeadFormSubmissions = async (token: string, tenantDbName?: string) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  if (tenant && typeof window !== 'undefined') {
    syncTenantDbName(tenant);
  }
  return apiFetch<{
    token: string;
    tenantDbName: string;
    leads: Array<Record<string, unknown>>;
  }>(`/leads/public/form/${encodeURIComponent(token)}/submissions${qs}`, {
    auth: false,
    includeTenantHeader: Boolean(tenant),
  });
};

export const apiUpdateLead = async (id: string, data: Partial<CreateLeadData>) => {
  return apiFetch<BackendLead>(`/leads/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

/** Mark the lead’s current scheduled follow-up / meet as done with a completion remark. */
export const apiCompleteLeadFollowUp = async (leadId: string, body: { remark: string }) => {
  return apiFetch<BackendLead>(`/leads/${encodeURIComponent(leadId)}/follow-ups/complete`, {
    method: 'POST',
    body,
    auth: true,
  });
};

export const apiDeleteLead = async (id: string) => {
  return apiFetch<{ message: string }>(`/leads/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export interface BackendActivity {
  id: string;
  action: string;
  description: string | null;
  performedBy: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  entityType: string;
  entityId: string | null;
  metadata: any;
  createdAt: string;
}

export const apiGetLeadActivities = async (leadId: string) => {
  return apiFetch<BackendActivity[]>(`/leads/${leadId}/activities`, { auth: true });
};

export const apiConvertLeadToClient = async (id: string, clientData: ConvertLeadToClientData) => {
  return apiFetch<any>(`/leads/${id}/convert`, {
    method: 'POST',
    body: clientData,
    auth: true,
  });
};

export const apiSubmitLeadConversionRequest = async (id: string, clientData: ConvertLeadToClientData) => {
  return apiFetch<any>(`/leads/${id}/conversion-request`, {
    method: 'POST',
    body: clientData,
    auth: true,
  });
};

export const apiGetLeadConversionCapabilities = async () => {
  return apiFetch<{ canDirectConvert: boolean }>(`/leads/conversion-capabilities`, { auth: true });
};

export type CrmAssignableMember = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  role?: { id?: string; roleName?: string; color?: string };
  department?: { id?: string; name?: string };
  orgUnit?: { id?: string; name?: string; kind?: string } | null;
};

export const apiGetLeadAssignableMembers = async (companyId?: string) => {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiFetch<CrmAssignableMember[]>(`/leads/assignable-members${query}`, { auth: true });
};

export const apiGetClientAssignableMembers = async (companyId?: string) => {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiFetch<CrmAssignableMember[]>(`/clients/assignable-members${query}`, { auth: true });
};

export interface ConvertLeadToClientData {
  companyName?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  address?: string;
  linkedin?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  hiringLocations?: string;
  servicesNeeded?: string;
  expectedBusinessValue?: string;
  priority?: string;
  assignedToId?: string;
  directorSalutation?: string;
  directorName?: string;
  contactPerson?: string;
  primaryContact?: string;
  email?: string;
  phone?: string;
  emails?: string[];
  phones?: string[];
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  otherDetails?: Array<{ label: string; value: string }>;
  nextFollowUpDue?: string | null;
  agreementsFileName?: string | null;
  agreementsFileUrl?: string | null;
  agreementsUploadedAt?: string | null;
  agreementLevel?: string | null;
  agreementServiceChargePercent?: string | null;
  agreementContractValidity?: string | null;
  agreementContractStartDate?: string | null;
  agreementContractEndDate?: string | null;
  agreementTimePeriod?: string | null;
  agreementAdvancePaymentPercent?: string | null;
  agreementFreeReplacementValue?: number | null;
  agreementFreeReplacementUnit?: 'MONTHS' | 'DAYS' | null;
  requestNote?: string;
}

// ────────────────────────────────────────────────────────────
// Clients
// ────────────────────────────────────────────────────────────

export interface BackendClient {
  id: string;
  companyName: string;
  industry?: string | null;
  website?: string | null;
  logo?: string | null;
  location?: string | null;
  status: 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE';
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
  companySize?: string | null;
  hiringLocations?: string | null;
  servicesNeeded?: string | null;
  expectedBusinessValue?: string | null;
  leadStatus?: string | null;
  linkedin?: string | null;
  timezone?: string | null;
  clientSince?: string | null;
  priority?: string | null;
  sla?: string | null;
  nextFollowUpDue?: string | null;
  /** Smart-location autofill metadata (shared with Lead). */
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Salutation captured on the Add Client form alongside the primary director. */
  directorSalutation?: string | null;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  /** Director / company contact channels (primary also on Contact when applicable). */
  emails?: string[];
  phones?: string[];
  /** Agreements & Terms — single primary document uploaded against the client. */
  agreementsFileName?: string | null;
  agreementsFileUrl?: string | null;
  agreementsUploadedAt?: string | null;
  agreementTotalPayment?: string | null;
  agreementLevel?: string | null;
  agreementServiceChargePercent?: string | null;
  agreementContractValidity?: string | null;
  agreementContractStartDate?: string | null;
  agreementContractEndDate?: string | null;
  agreementTimePeriod?: string | null;
  agreementAdvancePaymentPercent?: string | null;
  agreementFreeReplacementValue?: number | null;
  agreementFreeReplacementUnit?: 'MONTHS' | 'DAYS' | null;
  postServiceKycForm?: PostServiceKycFormValues | null;
  otherDetails?: Array<{ label: string; value: string }> | null;
  avgTimeToFill?: string | null;
  healthStatus?: string | null;
  revenueGenerated?: string | null;
  billingTotalRevenue?: string | null;
  billingOutstanding?: string | null;
  billingPaid?: string | null;
  /** When true, this client appears in Recruitment Clients and Add Job. */
  recruitmentEnabled?: boolean | null;
  recruitmentEnabledAt?: string | null;
  recruitmentEnabledBy?: string | null;
  contacts?: Array<{
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    designation?: string | null;
    department?: string | null;
    email?: string | null;
    phone?: string | null;
    lastContacted?: string | null;
    createdAt?: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
  _count?: {
    jobs?: number;
    contacts?: number;
    placements?: number;
  };
}

export const apiGetClients = async (params: {
  status?: string;
  assignedToId?: string;
  search?: string;
  type?: string;
  page?: number;
  limit?: number;
  ids?: string;
  includeContacts?: boolean;
  includeLeadFields?: boolean;
  recruitmentEnabled?: boolean;
} = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  const path = `/clients${qs ? `?${qs}` : ''}`;
  return apiFetch<{ data: BackendClient[]; pagination?: any } | BackendClient[]>(path, { auth: true });
};

export const apiGetClient = async (id: string) => {
  return apiFetch<BackendClient>(`/clients/${id}`, { auth: true });
};

export const apiSendClientToRecruitment = async (id: string, memberIds?: string[]) => {
  return apiFetch<BackendClient>(`/clients/${id}/send-to-recruitment`, {
    method: 'POST',
    body: { memberIds: Array.isArray(memberIds) ? memberIds : [] },
    auth: true,
  });
};

export type RecruitmentForwardMember = {
  id: string;
  name: string;
  email?: string;
  isSelf?: boolean;
};

export type RecruitmentForwardOrganization = {
  id: string;
  name: string;
  members: RecruitmentForwardMember[];
};

export type RecruitmentForwardTargets = {
  companyName?: string;
  hasCompanies?: boolean;
  organizations?: RecruitmentForwardOrganization[];
};

export const apiGetRecruitmentForwardTargets = async () => {
  return apiFetch<RecruitmentForwardTargets>('/clients/recruitment-forward-targets', { auth: true });
};

export interface ClientMetrics {
  activeClients: {
    value: number;
    trend: number;
    trendUp: boolean;
  };
  openJobs: {
    value: number;
    trend: number;
    trendUp: boolean;
  };
  candidatesInProgress: {
    value: number;
    trend: number;
    trendUp: boolean;
  };
  placementsThisMonth: {
    value: number;
    trend: number;
    trendUp: boolean;
  };
  revenueGenerated: {
    value: number;
    formatted: string;
    trend: number;
    trendUp: boolean;
  };
}

export const apiGetClientMetrics = async () => {
  return apiFetch<ClientMetrics>('/clients/metrics', { auth: true });
};

export const apiGetClientActivities = async (clientId: string) => {
  return apiFetch<any[]>(`/clients/${clientId}/activities`, { auth: true });
};

// Scheduled Meetings API
export interface ScheduledMeeting {
  id: string;
  clientId: string;
  scheduledById: string;
  meetingType: string;
  scheduledAt: string;
  reminder?: string | null;
  notes?: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  createdAt: string;
  updatedAt: string;
  scheduledBy?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    avatar?: string | null;
  };
  cancelledByUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
}

export type UnifiedCalendarEventType =
  | 'JOB_CREATED'
  | 'TASK'
  | 'INTERVIEW'
  | 'CLIENT_MEETING'
  | 'CLIENT_FOLLOW_UP';

export interface UnifiedCalendarEvent {
  id: string;
  type: UnifiedCalendarEventType;
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string | null;
  start: string;
  end?: string | null;
  allDay: boolean;
  status?: string | null;
  priority?: string | null;
  color: string;
  route: string;
  description?: string | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface UnifiedCalendarResponse {
  range: {
    start: string;
    end: string;
  };
  scope?: {
    mineOnly: boolean;
    userId: string | null;
  };
  summary: {
    total: number;
    jobs: number;
    tasks: number;
    interviews: number;
    meetings: number;
    followUps: number;
  };
  events: UnifiedCalendarEvent[];
}

export interface CreateScheduledMeetingData {
  meetingType: string;
  scheduledAt: string; // ISO datetime string
  reminder?: string;
  notes?: string;
  contact?: string;
  meetLink?: string;
  timezone?: string;
  attendeeIds?: string[];
  followUpNotes?: string;
  followUpSchedule?: {
    type?: string;
    contact?: string;
    meetLink?: string;
    reminder?: string;
    timezone?: string;
    attendeeIds?: string[];
    notes?: string;
    postponed?: boolean;
    postponeReason?: string;
  };
}

export interface UpdateScheduledMeetingData {
  meetingType?: string;
  scheduledAt?: string;
  reminder?: string;
  notes?: string;
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
}

export const apiGetClientScheduledMeetings = async (
  clientId: string,
  params?: { status?: string; upcoming?: boolean }
) => {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.upcoming) queryParams.append('upcoming', 'true');
  
  const queryString = queryParams.toString();
  const url = `/clients/${clientId}/meetings${queryString ? `?${queryString}` : ''}`;
  
  return apiFetch<ScheduledMeeting[]>(url, {
    auth: true,
  });
};

export const apiCreateScheduledMeeting = async (
  clientId: string,
  data: CreateScheduledMeetingData
) => {
  return apiFetch<ScheduledMeeting>(`/clients/${clientId}/meetings`, {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiUpdateScheduledMeeting = async (
  clientId: string,
  meetingId: string,
  data: UpdateScheduledMeetingData
) => {
  return apiFetch<ScheduledMeeting>(`/clients/${clientId}/meetings/${meetingId}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteScheduledMeeting = async (
  clientId: string,
  meetingId: string
) => {
  return apiFetch<{ message: string }>(`/clients/${clientId}/meetings/${meetingId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiGetUnifiedCalendar = async (params?: {
  start?: string;
  end?: string;
  mineOnly?: boolean;
  /** When set, load that teammate’s calendar (overrides mineOnly). */
  userId?: string;
}) => {
  const queryParams = new URLSearchParams();
  if (params?.start) queryParams.set('start', params.start);
  if (params?.end) queryParams.set('end', params.end);
  if (params?.mineOnly !== undefined) queryParams.set('mineOnly', String(params.mineOnly));
  if (params?.userId) queryParams.set('userId', params.userId);

  const queryString = queryParams.toString();

  return apiFetch<UnifiedCalendarResponse>(`/calendar${queryString ? `?${queryString}` : ''}`, {
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Client Notes
// ────────────────────────────────────────────────────────────

export interface BackendClientNote {
  id: string;
  clientId: string;
  title: string;
  content?: string | null;
  tags: string[];
  createdById: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name?: string | null;
    email: string;
    avatar?: string | null;
  };
}

export interface CreateClientNoteData {
  title: string;
  content?: string;
  tags?: string[];
}

export interface UpdateClientNoteData {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
}

export const apiGetClientNotes = async (clientId: string) => {
  return apiFetch<BackendClientNote[]>(`/clients/${clientId}/notes`, {
    auth: true,
  });
};

export const apiCreateClientNote = async (
  clientId: string,
  data: CreateClientNoteData
) => {
  return apiFetch<BackendClientNote>(`/clients/${clientId}/notes`, {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiUpdateClientNote = async (
  clientId: string,
  noteId: string,
  data: UpdateClientNoteData
) => {
  return apiFetch<BackendClientNote>(`/clients/${clientId}/notes/${noteId}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteClientNote = async (
  clientId: string,
  noteId: string
) => {
  return apiFetch<{ message: string }>(`/clients/${clientId}/notes/${noteId}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Lead Notes
// ────────────────────────────────────────────────────────────

export interface BackendLeadNote {
  id: string;
  leadId: string;
  title: string;
  content?: string | null;
  tags: string[];
  createdById: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name?: string | null;
    email: string;
    avatar?: string | null;
  };
}

export interface CreateLeadNoteData {
  title: string;
  content?: string;
  tags?: string[];
}

export interface UpdateLeadNoteData {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
}

export const apiGetLeadNotes = async (leadId: string) => {
  return apiFetch<BackendLeadNote[]>(`/leads/${leadId}/notes`, {
    auth: true,
  });
};

export const apiCreateLeadNote = async (
  leadId: string,
  data: CreateLeadNoteData
) => {
  return apiFetch<BackendLeadNote>(`/leads/${leadId}/notes`, {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiUpdateLeadNote = async (
  leadId: string,
  noteId: string,
  data: UpdateLeadNoteData
) => {
  return apiFetch<BackendLeadNote>(`/leads/${leadId}/notes/${noteId}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteLeadNote = async (
  leadId: string,
  noteId: string
) => {
  return apiFetch<{ message: string }>(`/leads/${leadId}/notes/${noteId}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Job Notes API
// ────────────────────────────────────────────────────────────

export interface BackendJobNote {
  id: string;
  jobId: string;
  title: string;
  content?: string | null;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
}

export interface CreateJobNoteData {
  title: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
}

export interface UpdateJobNoteData {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
}

export const apiGetJobNotes = async (jobId: string) => {
  return apiFetch<BackendJobNote[]>(`/jobs/${jobId}/notes`, {
    auth: true,
  });
};

export const apiCreateJobNote = async (
  jobId: string,
  data: CreateJobNoteData
) => {
  return apiFetch<BackendJobNote>(`/jobs/${jobId}/notes`, {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiUpdateJobNote = async (
  jobId: string,
  noteId: string,
  data: UpdateJobNoteData
) => {
  return apiFetch<BackendJobNote>(`/jobs/${jobId}/notes/${noteId}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteJobNote = async (jobId: string, noteId: string) => {
  return apiFetch<{ message: string }>(`/jobs/${jobId}/notes/${noteId}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Job Activities API
// ────────────────────────────────────────────────────────────

export const apiGetJobActivities = async (jobId: string) => {
  return apiFetch<BackendActivity[]>(`/jobs/${jobId}/activities`, { auth: true });
};

// ────────────────────────────────────────────────────────────
// Contacts
// ────────────────────────────────────────────────────────────

export interface BackendContact {
  id: string;
  salutation?: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  designation?: string | null;
  department?: string | null;
  location?: string | null;
  contactType: 'CANDIDATE' | 'CLIENT' | 'HIRING_MANAGER' | 'INTERVIEWER' | 'VENDOR' | 'DECISION_MAKER' | 'FINANCE';
  status: 'ACTIVE' | 'INACTIVE';
  companyId?: string | null;
  ownerId?: string | null;
  avatarUrl?: string | null;
  tags: string[];
  associatedJobIds: string[];
  lastContacted?: string | null;
  createdAt: string;
  updatedAt: string;
  // Additional optional fields that may be present
  title?: string | null;
  isPrimary?: boolean;
  avatar?: string | null;
  preferredChannel?: 'Email' | 'Phone' | 'WhatsApp' | null;
  notesText?: string | null;
  company?: {
    id: string;
    companyName: string;
  };
  owner?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  notes?: BackendContactNote[];
  activities?: BackendContactActivity[];
  communications?: BackendContactCommunication[];
  associatedJobs?: Array<{ id: string; title: string; status: string }>;
  auditMeta?: import('../types/audit').AuditMeta | null;
}

export interface BackendContactNote {
  id: string;
  contactId: string;
  note: string;
  authorId: string;
  createdAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface BackendContactActivity {
  id: string;
  contactId: string;
  activityType: string;
  description: string;
  userId: string;
  timestamp: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface BackendContactCommunication {
  id: string;
  contactId: string;
  type: string;
  subject?: string | null;
  message: string;
  direction: string;
  timestamp: string;
}

export interface ContactFilters {
  contactType?: string;
  type?: string; // Alias for contactType
  companyId?: string;
  clientId?: string; // Alias for companyId when filtering by client
  location?: string;
  tags?: string[];
  ownerId?: string;
  status?: string;
  recentlyContacted?: '7d' | '30d' | 'all';
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateContactData {
  salutation?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyId?: string;
  clientId?: string; // Alias for companyId when creating for a client
  designation?: string;
  department?: string;
  location?: string;
  linkedinUrl?: string;
  contactType?: 'CANDIDATE' | 'CLIENT' | 'HIRING_MANAGER' | 'INTERVIEWER' | 'VENDOR' | 'DECISION_MAKER' | 'FINANCE';
  status?: 'ACTIVE' | 'INACTIVE';
  ownerId?: string;
  avatarUrl?: string;
  tags?: string[];
  associatedJobIds?: string[];
  isPrimary?: boolean;
  notes?: string;
  preferredChannel?: 'Email' | 'Phone' | 'WhatsApp';
  whatsAppSameAsPhone?: boolean;
}

export interface ContactStats {
  total: number;
  candidates: number;
  clientContacts: number;
  hiringManagers: number;
}

export interface ContactImportPreviewResult {
  sheetName: string;
  columns: string[];
  previewRows: Record<string, string | number | boolean | null>[];
  totalRows: number;
  suggestedMapping: Record<string, string>;
  columnStats: Record<string, number>;
}

export interface ContactImportExecuteResult {
  imported: number;
  skipped: number;
  updated: number;
}

export const apiGetContacts = async (filters?: ContactFilters) => {
  const query = new URLSearchParams();
  const processedFilters = { ...filters };
  
  // Convert clientId to companyId for backend compatibility
  if (processedFilters?.clientId) {
    processedFilters.companyId = processedFilters.clientId;
    delete processedFilters.clientId;
  }
  
  // Convert type to contactType for backend compatibility
  if (processedFilters?.type && !processedFilters.contactType) {
    processedFilters.contactType = processedFilters.type;
    delete processedFilters.type;
  }
  
  Object.entries(processedFilters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => query.append(key, String(v)));
      } else {
        query.append(key, String(value));
      }
    }
  });

  return apiFetch<ApiResponse<BackendContact[]>>(`/contacts?${query.toString()}`, { auth: true });
};

export const apiGetContact = async (id: string) => {
  return apiFetch<BackendContact>(`/contacts/${id}`, { auth: true });
};

export const apiCreateContact = async (data: CreateContactData) => {
  const processedData = { ...data };
  
  // Convert clientId to companyId for backend compatibility
  if (processedData.clientId && !processedData.companyId) {
    processedData.companyId = processedData.clientId;
    delete processedData.clientId;
  }
  
  return apiFetch<ApiResponse<BackendContact>>('/contacts', {
    method: 'POST',
    body: processedData,
    auth: true,
  });
};

export const apiUpdateContact = async (id: string, data: Partial<CreateContactData>) => {
  return apiFetch<ApiResponse<BackendContact>>(`/contacts/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteContact = async (id: string) => {
  return apiFetch<ApiResponse<{ message: string }>>(`/contacts/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiPreviewContactImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<ContactImportPreviewResult>('/contacts/import/preview', formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiImportContacts = async (payload: {
  rows: Record<string, string | number | boolean | null>[];
  mapping: Record<string, string>;
  duplicateRule: string;
}) => {
  return apiFetch<ContactImportExecuteResult>('/contacts/import', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiGetContactStats = async () => {
  return apiFetch<ApiResponse<ContactStats>>('/contacts/stats', { auth: true });
};

export const apiBulkActionContacts = async (action: string, contactIds: string[], payload?: any) => {
  return apiFetch<ApiResponse<any>>('/contacts/bulk', {
    method: 'POST',
    body: { action, contactIds, payload },
    auth: true,
  });
};

export const apiMergeContacts = async (primaryId: string, duplicateId: string) => {
  return apiFetch<ApiResponse<{ message: string }>>('/contacts/merge', {
    method: 'POST',
    body: { primaryId, duplicateId },
    auth: true,
  });
};

export const apiAddContactNote = async (contactId: string, note: string) => {
  return apiFetch<ApiResponse<BackendContactNote>>(`/contacts/${contactId}/notes`, {
    method: 'POST',
    body: { note },
    auth: true,
  });
};

export const apiAddContactActivity = async (contactId: string, activityType: string, description: string) => {
  return apiFetch<ApiResponse<BackendContactActivity>>(`/contacts/${contactId}/activities`, {
    method: 'POST',
    body: { activityType, description },
    auth: true,
  });
};

export const apiAddContactCommunication = async (
  contactId: string,
  type: string,
  message: string,
  direction: string,
  subject?: string
) => {
  return apiFetch<ApiResponse<BackendContactCommunication>>(`/contacts/${contactId}/communications`, {
    method: 'POST',
    body: { type, message, direction, subject },
    auth: true,
  });
};

export const apiDetectContactDuplicates = async (email?: string, name?: string) => {
  const query = new URLSearchParams();
  if (email) query.append('email', email);
  if (name) query.append('name', name);
  return apiFetch<{ duplicates: Array<{ match: string; contact: BackendContact }> }>(
    `/contacts/duplicates?${query.toString()}`,
    { auth: true }
  );
};

export interface CreateClientData {
  companyName: string;
  industry?: string;
  website?: string;
  logo?: string;
  location?: string;
  status?: 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE';
  /** Lead-style status snapshot. The Add Client form (mirroring Add Lead) writes here. */
  leadStatus?: string;
  assignedToId?: string;
  companySize?: string;
  hiringLocations?: string;
  servicesNeeded?: string;
  expectedBusinessValue?: string;
  linkedin?: string;
  timezone?: string;
  priority?: string;
  sla?: string;
  nextFollowUpDue?: string | null;
  /** Smart-location autofill metadata (shared with Lead). */
  city?: string;
  state?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Salutation captured on the Add Client form alongside the primary director. */
  directorSalutation?: string;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  email?: string;
  phone?: string;
  emails?: string[];
  phones?: string[];
  /** Agreements & Terms — single primary document uploaded against the client. */
  agreementsFileName?: string | null;
  agreementsFileUrl?: string | null;
  agreementsUploadedAt?: string | null;
  agreementTotalPayment?: string | null;
  agreementLevel?: string | null;
  agreementServiceChargePercent?: string | null;
  agreementContractValidity?: string | null;
  agreementContractStartDate?: string | null;
  agreementContractEndDate?: string | null;
  agreementTimePeriod?: string | null;
  agreementAdvancePaymentPercent?: string | null;
  agreementFreeReplacementValue?: number | null;
  agreementFreeReplacementUnit?: 'MONTHS' | 'DAYS' | null;
  postServiceKycForm?: PostServiceKycFormValues | null;
  otherDetails?: Array<{ label: string; value: string }>;
  recruitmentEnabled?: boolean;
}

export interface UpdateClientData {
  companyName?: string;
  industry?: string;
  website?: string;
  logo?: string;
  location?: string;
  status?: 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE';
  /** Lead-style status snapshot. The Add Client form (mirroring Add Lead) writes here. */
  leadStatus?: string | null;
  assignedToId?: string | null;
  companySize?: string | null;
  hiringLocations?: string | null;
  servicesNeeded?: string | null;
  expectedBusinessValue?: string | null;
  linkedin?: string | null;
  timezone?: string | null;
  priority?: string | null;
  sla?: string | null;
  nextFollowUpDue?: string | null;
  /** Smart-location autofill metadata (shared with Lead). */
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Salutation captured on the Add Client form alongside the primary director. */
  directorSalutation?: string | null;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  email?: string | null;
  phone?: string | null;
  emails?: string[];
  phones?: string[];
  /** Agreements & Terms — single primary document uploaded against the client. */
  agreementsFileName?: string | null;
  agreementsFileUrl?: string | null;
  agreementsUploadedAt?: string | null;
  agreementTotalPayment?: string | null;
  agreementLevel?: string | null;
  agreementServiceChargePercent?: string | null;
  agreementContractValidity?: string | null;
  agreementContractStartDate?: string | null;
  agreementContractEndDate?: string | null;
  agreementTimePeriod?: string | null;
  agreementAdvancePaymentPercent?: string | null;
  agreementFreeReplacementValue?: number | null;
  agreementFreeReplacementUnit?: 'MONTHS' | 'DAYS' | null;
  postServiceKycForm?: PostServiceKycFormValues | null;
  otherDetails?: Array<{ label: string; value: string }>;
  recruitmentEnabled?: boolean;
}

export const apiCreateClient = async (data: CreateClientData) => {
  return apiFetch<BackendClient>('/clients', {
    method: 'POST',
    body: data,
    auth: true,
  });
};

// User interfaces and API
// (Type-merged with the canonical `BackendUser` defined earlier in this file
// — the extra fields like `designation` are declared there.)

export const apiGetUsers = async (params?: {
  role?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  /** When true, returns only this tenant’s assignable team (excludes HQ / platform accounts). */
  assignable?: boolean;
  companyId?: string;
  orgUnitId?: string;
}) => {
  const queryParams = new URLSearchParams();
  if (params?.role) queryParams.append('role', params.role);
  if (params?.isActive !== undefined) queryParams.append('isActive', String(params.isActive));
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.assignable) queryParams.append('assignable', 'true');
  if (params?.companyId) queryParams.append('companyId', params.companyId);
  if (params?.orgUnitId) queryParams.append('orgUnitId', params.orgUnitId);

  const path = `/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiFetch<BackendUser[] | { data: BackendUser[]; pagination?: any }>(path, {
    method: 'GET',
    auth: true,
  });
};

/** Global activity feed (GET /activities) */
export interface BackendGlobalActivity {
  id: string;
  action: string;
  description?: string | null;
  entityType: string;
  entityId?: string | null;
  category?: string | null;
  relatedLabel?: string | null;
  metadata?: unknown;
  createdAt: string;
  displaySummary?: string | null;
  displayKind?: 'create' | 'update' | 'delete' | 'info' | string | null;
  performedBy: {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email: string;
    avatar?: string | null;
    systemRole?: { roleName?: string };
    departmentRelation?: { id: string; name: string } | null;
  };
}

export type ActivityVisibilityCapabilities = {
  level: 'self' | 'department' | 'tenant';
  canViewMembers: boolean;
  canViewDepartments: boolean;
  canViewTeam: boolean;
  viewerRank: number | null;
  departmentId?: string | null;
  departmentName?: string | null;
};

export type ActivityViewableMember = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  designation?: string;
  avatar?: string | null;
  departmentId?: string;
  role?: { roleName?: string; color?: string } | null;
  department?: { id: string; name: string } | null;
};

export type ActivityViewableDepartment = {
  id: string;
  name: string;
  memberCount: number;
};

export async function apiGetActivityCapabilities() {
  return apiFetch<ActivityVisibilityCapabilities>('/activities/capabilities', { auth: true });
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

export const apiGetActivityFeed = async (params?: {
  page?: number;
  limit?: number;
  entityType?: string;
  category?: string;
  search?: string;
  mine?: boolean;
  scope?: 'self' | 'team' | 'department' | 'tenant';
  performedById?: string;
  departmentId?: string;
  from?: string;
  to?: string;
}) => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.entityType) queryParams.append('entityType', params.entityType);
  if (params?.category) queryParams.append('category', params.category);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.mine) queryParams.append('mine', 'true');
  if (params?.scope) queryParams.append('scope', params.scope);
  if (params?.performedById) queryParams.append('performedById', params.performedById);
  if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  const qs = queryParams.toString();
  return apiFetch<{ data: BackendGlobalActivity[]; pagination: any }>(`/activities${qs ? `?${qs}` : ''}`, {
    auth: true,
  });
};

export async function apiGetTaskActivities(taskId: string) {
  return apiFetch<BackendActivity[]>(`/tasks/${encodeURIComponent(taskId)}/activities`, { auth: true });
}

export const apiUpdateClient = async (id: string, data: UpdateClientData) => {
  return apiFetch<BackendClient>(`/clients/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteClient = async (id: string) => {
  return apiFetch<{ message: string }>(`/clients/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Tasks
// ────────────────────────────────────────────────────────────

export interface BackendTask {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  dueTime?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'TODO' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'DONE' | 'CANCELLED';
  taskType?: string | null;
  assignedToId: string;
  createdById: string;
  participantIds?: string[];
  completionRequestedById?: string | null;
  completionRequestedAt?: string | null;
  completionApproverId?: string | null;
  linkedEntityType?: 'CANDIDATE' | 'JOB' | 'CLIENT' | 'INTERVIEW' | 'INTERNAL' | 'TEAM_REQUEST' | null;
  linkedEntityId?: string | null;
  reminder?: string | null;
  reminderChannel?: string | null;
  attachments: string[];
  notifyAssignee: boolean;
  notes: string[];
  createdAt: string;
  updatedAt: string;
  assignedTo: {
    id: string;
    name: string;
    email: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  files?: TaskFile[];
  isOverdue?: boolean;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  relatedTo?: 'Candidate' | 'Job' | 'Client' | 'Interview' | 'Internal' | 'Team Request';
  relatedEntityId?: string;
  assigneeId: string;
  priority: 'Low' | 'Medium' | 'High';
  dueDate: string;
  dueTime?: string;
  time?: string;
  reminder?: string;
  reminderChannel?: string;
  attachmentNames?: string;
  attachments?: string[];
  notifyAssignee?: boolean;
  notes?: string[];
  taskType?: string;
  type?: string;
  completionApproverId?: string;
  status?: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' | 'PENDING' | 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
}

export interface UpdateTaskData extends Partial<CreateTaskData> {
  id?: string;
}

export const apiGetTasks = async (params?: {
  assignedToId?: string;
  status?: string;
  priority?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  page?: number;
  limit?: number;
}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  const path = `/tasks${qs ? `?${qs}` : ''}`;
  return apiFetch<{ data: BackendTask[]; pagination?: any } | BackendTask[]>(path, { auth: true });
};

export const apiGetTask = async (id: string) => {
  return apiFetch<BackendTask>(`/tasks/${id}`, { auth: true });
};

export interface TaskStats {
  completedToday: number;
  overdueCount: number;
  avgCompletionTimeDays: number;
  productivityPercent: number;
  dueToday: number;
  overdue: number;
  upcoming7d: number;
  completed: number;
  trendCompletedToday?: string;
}

export const apiGetTaskStats = async (userId?: string) => {
  const query = userId ? `?userId=${userId}` : '';
  return apiFetch<TaskStats>(`/tasks/stats${query}`, { auth: true });
};

export type TaskAssignableMember = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  role?: { id?: string; roleName?: string; color?: string };
  department?: { id?: string; name?: string };
  orgUnit?: { id?: string; name?: string; kind?: string } | null;
};

export const apiGetTaskAssignableMembers = async (companyId?: string) => {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiFetch<TaskAssignableMember[]>(`/tasks/assignable-members${query}`, { auth: true });
};

export const apiCreateTask = async (data: CreateTaskData) => {
  return apiFetch<BackendTask>('/tasks', {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiUpdateTask = async (id: string, data: UpdateTaskData) => {
  return apiFetch<BackendTask>(`/tasks/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDelegateTask = async (
  id: string,
  payload: { assignToId: string; setSelfAsApprover?: boolean; completionApproverId?: string },
) => {
  return apiFetch<BackendTask>(`/tasks/${id}/delegate`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiDeleteTask = async (id: string) => {
  return apiFetch<{ message: string }>(`/tasks/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiMarkTaskCompleted = async (id: string) => {
  return apiFetch<{ task: BackendTask; submittedForApproval?: boolean }>(`/tasks/${id}/complete`, {
    method: 'POST',
    auth: true,
  });
};

export const apiApproveTaskCompletion = async (id: string) => {
  return apiFetch<BackendTask>(`/tasks/${id}/approve-completion`, {
    method: 'POST',
    auth: true,
  });
};

export const apiRejectTaskCompletion = async (id: string, note?: string) => {
  return apiFetch<BackendTask>(`/tasks/${id}/reject-completion`, {
    method: 'POST',
    body: note ? { note } : {},
    auth: true,
  });
};

export const apiAddTaskNote = async (taskId: string, note: string) => {
  return apiFetch<BackendTask>(`/tasks/${taskId}/notes`, {
    method: 'POST',
    body: { note },
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Task Files
// ────────────────────────────────────────────────────────────

export interface TaskFile {
  id: string;
  taskId: string;
  fileName: string;
  fileType?: string | null;
  fileUrl: string;
  fileSize?: number | null;
  uploadedById: string;
  uploadDate: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export const apiGetTaskFiles = async (taskId: string) => {
  return apiFetch<TaskFile[]>(`/tasks/${taskId}/files`, {
    method: 'GET',
    auth: true,
  });
};

export const apiUploadTaskFile = async (taskId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token found');
  }

  const url = `${API_BASE}/tasks/${taskId}/files`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    const msg = json?.message || `Request failed with status ${response.status}`;
    throw new Error(msg);
  }

  return response.json() as Promise<ApiResponse<TaskFile>>;
};

export const apiUploadTaskFiles = async (taskId: string, files: File[]) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token found');
  }

  const url = `${API_BASE}/tasks/${taskId}/files/multiple`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    const msg = json?.message || `Request failed with status ${response.status}`;
    throw new Error(msg);
  }

  return response.json() as Promise<ApiResponse<TaskFile[]>>;
};

// Job File Upload API
export interface JobFile {
  id: string;
  jobId: string;
  fileName: string;
  fileType: string;
  fileUrl: string | null;
  fileSize?: number;
  description?: string | null;
  uploadedById: string;
  uploadDate: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export const apiUploadJobFile = async (jobId: string, file: File, fileType: string = 'JD', description?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileType', fileType);
  if (description) {
    formData.append('description', description);
  }

  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token found');
  }

  const url = `${API_BASE}/jobs/${jobId}/files`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    const msg = json?.message || `Request failed with status ${response.status}`;
    throw new Error(msg);
  }

  return response.json() as Promise<ApiResponse<JobFile>>;
};

export const apiGetJobFiles = async (jobId: string) => {
  return apiFetch<JobFile[]>(`/jobs/${jobId}/files`, { auth: true });
};

export const apiDeleteJobFile = async (jobId: string, fileId: string) => {
  return apiFetch(`/jobs/${jobId}/files/${fileId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiDeleteTaskFile = async (taskId: string, fileId: string) => {
  return apiFetch<{ message: string }>(`/tasks/${taskId}/files/${fileId}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Generic Files Service (reusable for job, lead, client, etc.)
// ────────────────────────────────────────────────────────────

export type FileEntityType = 'job' | 'lead' | 'client' | 'candidate' | 'interview';

export interface EntityFile {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string | null;
  uploadDate: string;
  uploadedBy?: {
    id: string;
    name: string;
    email?: string;
    avatar?: string | null;
  };
}

/** Get files for any entity (job, lead, client). Use in job drawer, client drawer, etc. */
export const filesApiGet = async (entityType: FileEntityType, entityId: string) => {
  const params = new URLSearchParams({ entityType, entityId });
  return apiFetch<EntityFile[]>(`/files?${params}`, { auth: true });
};

/** Upload a file for an entity. Returns the created file record. */
export const filesApiUpload = async (
  entityType: FileEntityType,
  entityId: string,
  file: File,
  fileType: string = 'JD'
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', entityType);
  formData.append('entityId', entityId);
  formData.append('fileType', fileType);

  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json?.message || `Upload failed: ${response.status}`);
  }
  return response.json() as Promise<ApiResponse<EntityFile>>;
};

/** Delete a file by ID. */
export const filesApiDelete = async (entityType: FileEntityType, entityId: string, fileId: string) => {
  const params = new URLSearchParams({ entityType, entityId });
  return apiFetch(`/files/${fileId}?${params}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Internal Chat (Inbox) for entity drawers
// ────────────────────────────────────────────────────────────

export type EntityChatType =
  | 'CANDIDATE'
  | 'JOB'
  | 'CLIENT'
  | 'INTERVIEW'
  | 'TASK'
  | 'LEAD'
  | 'CONTACT'
  | 'USER';

export interface InboxMessage {
  id: string;
  threadId: string;
  body: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
}

export interface InboxThread {
  id: string;
  subject?: string | null;
  relatedEntityType?: EntityChatType | null;
  relatedEntityId?: string | null;
  createdAt: string;
  updatedAt: string;
  participants: {
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
    };
  }[];
  messages: InboxMessage[];
}

export interface GmailInboxMessage {
  id: string;
  threadId: string;
  sender: string;
  email: string;
  subject: string;
  preview: string;
  timestamp: string | null;
  unread: boolean;
  starred: boolean;
  hasAttachment: boolean;
  candidate?: string;
  job?: string;
  client?: string;
  type?: string;
  to?: string;
  cc?: string;
  body?: string;
  htmlBody?: string;
  attachments?: any[];
}

export interface GmailInboxResponse {
  connected: boolean;
  email?: string;
  messages: GmailInboxMessage[];
  nextPageToken?: string | null;
  requiresReconnect?: boolean;
  mailboxUnavailable?: boolean;
}

export interface GmailMessageActionResult {
  success: boolean;
  messageId: string;
  unread?: boolean;
  starred?: boolean;
  eventId?: string;
  eventLink?: string;
}

export const apiGetGmailInbox = async (params?: {
  q?: string;
  maxResults?: number;
  pageToken?: string;
  labelId?: 'INBOX' | 'STARRED' | 'SNOOZED' | 'SENT' | 'DRAFT';
}) => {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.maxResults) query.set('maxResults', String(params.maxResults));
  if (params?.pageToken) query.set('pageToken', params.pageToken);
  if (params?.labelId) query.set('labelId', params.labelId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch<GmailInboxResponse>(`/inbox/gmail/messages${suffix}`, {
    method: 'GET',
    auth: true,
  });
  return res.data;
};

export const apiGetGmailMessage = async (messageId: string) => {
  const res = await apiFetch<GmailInboxMessage>(`/inbox/gmail/messages/${messageId}`, {
    method: 'GET',
    auth: true,
  });
  return res.data;
};

export const apiArchiveGmailMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(`/inbox/gmail/messages/${messageId}/archive`, {
    method: 'POST',
    auth: true,
  });
  return res.data;
};

export const apiTrashGmailMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(`/inbox/gmail/messages/${messageId}/trash`, {
    method: 'POST',
    auth: true,
  });
  return res.data;
};

export const apiUpdateGmailMessageFlags = async (
  messageId: string,
  body: { unread?: boolean; starred?: boolean }
) => {
  const res = await apiFetch<GmailMessageActionResult>(`/inbox/gmail/messages/${messageId}/flags`, {
    method: 'PATCH',
    body,
    auth: true,
  });
  return res.data;
};

export const apiCreateCalendarEventFromGmailMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(`/inbox/gmail/messages/${messageId}/calendar-event`, {
    method: 'POST',
    auth: true,
  });
  return res.data;
};

export interface MailboxStatusResponse {
  gmail: { connected: boolean; email?: string };
  outlook: { connected: boolean; email?: string };
}

export const apiGetMailboxStatus = async () => {
  const res = await apiFetch<MailboxStatusResponse>('/inbox/mailboxes/status', {
    method: 'GET',
    auth: true,
  });
  return res.data;
};

export const apiGetOutlookInbox = async (params?: {
  q?: string;
  maxResults?: number;
  pageToken?: string;
  labelId?: 'INBOX' | 'STARRED' | 'SNOOZED' | 'SENT' | 'DRAFT';
}) => {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.maxResults) query.set('maxResults', String(params.maxResults));
  if (params?.pageToken) query.set('pageToken', params.pageToken);
  if (params?.labelId) query.set('labelId', params.labelId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch<GmailInboxResponse>(`/inbox/outlook/messages${suffix}`, {
    method: 'GET',
    auth: true,
  });
  return res.data;
};

export const apiGetOutlookMessage = async (messageId: string) => {
  const res = await apiFetch<GmailInboxMessage>(
    `/inbox/outlook/messages/${encodeURIComponent(messageId)}`,
    {
      method: 'GET',
      auth: true,
    }
  );
  return res.data;
};

export const apiArchiveOutlookMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(
    `/inbox/outlook/messages/${encodeURIComponent(messageId)}/archive`,
    {
      method: 'POST',
      auth: true,
    }
  );
  return res.data;
};

export const apiTrashOutlookMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(
    `/inbox/outlook/messages/${encodeURIComponent(messageId)}/trash`,
    {
      method: 'POST',
      auth: true,
    }
  );
  return res.data;
};

export const apiUpdateOutlookMessageFlags = async (
  messageId: string,
  body: { unread?: boolean; starred?: boolean }
) => {
  const res = await apiFetch<GmailMessageActionResult>(
    `/inbox/outlook/messages/${encodeURIComponent(messageId)}/flags`,
    {
      method: 'PATCH',
      body,
      auth: true,
    }
  );
  return res.data;
};

export const apiCreateCalendarEventFromOutlookMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(
    `/inbox/outlook/messages/${encodeURIComponent(messageId)}/calendar-event`,
    {
      method: 'POST',
      auth: true,
    }
  );
  return res.data;
};

function parseInboxThreadList(raw: unknown): InboxThread[] {
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
export const apiGetEntityChatThread = async (
  entityType: EntityChatType,
  entityId: string,
) => {
  const id = String(entityId || '').trim();
  if (!id) return null;

  const res = await apiFetch<any>(
    `/inbox/threads?relatedEntityType=${encodeURIComponent(entityType)}&relatedEntityId=${encodeURIComponent(id)}`,
    {
      method: 'GET',
      auth: true,
    },
  );

  const threads = parseInboxThreadList(res.data);
  return threads.length > 0 ? threads[0] : null;
};

// Get (at most one) chat thread for a task, if it exists
export const apiGetTaskChatThread = async (taskId: string) => {
  return apiGetEntityChatThread('TASK', taskId);
};

// Get full thread with all messages
export const apiGetInboxThread = async (threadId: string) => {
  const res = await apiFetch<InboxThread>(`/inbox/threads/${threadId}`, {
    method: 'GET',
    auth: true,
  });
  return res.data;
};

// Create a chat thread for an entity with an initial message
export const apiCreateEntityChatThread = async (
  entityType: EntityChatType,
  entityId: string,
  options: {
    subject?: string;
    initialMessage: string;
    participantIds?: string[];
  },
) => {
  const id = String(entityId || '').trim();
  if (!id) throw new Error('Entity id is required');

  const res = await apiFetch<InboxThread>('/inbox/threads', {
    method: 'POST',
    body: {
      subject: options.subject || 'Team chat',
      relatedEntityType: entityType,
      relatedEntityId: id,
      participantIds: options.participantIds || [],
      initialMessage: options.initialMessage,
      attachments: [],
    },
    auth: true,
  });
  return res.data;
};

// Create a chat thread for a task with an initial message
export const apiCreateTaskChatThread = async (taskId: string, initialMessage: string) => {
  return apiCreateEntityChatThread('TASK', taskId, {
    subject: 'Task Internal Chat',
    initialMessage,
  });
};

// Add a message to an existing thread
export const apiAddInboxChatMessage = async (threadId: string, body: string) => {
  const res = await apiFetch<InboxMessage>(`/inbox/threads/${threadId}/messages`, {
    method: 'POST',
    body: {
      body,
      attachments: [],
    },
    auth: true,
  });
  return res.data;
};

/** @deprecated Use apiAddInboxChatMessage */
export const apiAddTaskChatMessage = apiAddInboxChatMessage;

// ── LINKEDIN INTEGRATION ──

export type SocialPublishingAccount = {
  id: string;
  key: string;
  name: string;
  type?: 'personal' | 'page';
  picture?: string | null;
  accountEmail?: string | null;
  connected?: boolean;
  expired?: boolean;
  organizationId?: string;
  parentAccountId?: string;
};

export interface LinkedInStatus {
  connected: boolean;
  expired?: boolean;
  name?: string;
  picture?: string;
  accounts?: SocialPublishingAccount[];
}

export interface LinkedInPostJobData {
  jobTitle: string;
  company: string;
  description?: string;
  applyUrl: string;
  location?: string;
  postText?: string; // Optional custom post text
}

export interface LinkedInPostJobResponse {
  success: boolean;
  linkedinPostUrl: string;
  postId?: string;
}

export const apiGetLinkedInStatus = async () => {
  return apiFetch<LinkedInStatus>('/linkedin/status', { auth: true });
};

export const apiInitiateLinkedInAuth = async () => {
  return apiFetch<{ authUrl: string; state: string }>('/linkedin/auth/linkedin', { auth: true });
};

export const apiPostJobToLinkedIn = async (jobData: LinkedInPostJobData) => {
  return apiFetch<LinkedInPostJobResponse>('/linkedin/post-job', {
    method: 'POST',
    body: jobData,
    auth: true,
  });
};

export const apiDisconnectLinkedIn = async () => {
  return apiFetch<{ message: string }>('/linkedin/disconnect', {
    method: 'DELETE',
    auth: true,
  });
};

export const apiGetLinkedInAccounts = async () => {
  return apiFetch<{ accounts: SocialPublishingAccount[] }>('/linkedin/accounts', { auth: true });
};

export const apiDisconnectLinkedInAccount = async (accountId: string) => {
  return apiFetch<{ message: string }>(`/linkedin/accounts/${accountId}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ── GENERAL SOCIAL PUBLISHING ──

export interface SocialPublishData {
  jobId: string;
  title: string;
  companyName: string;
  showClientNamePublicly?: boolean;
  description?: string;
  applyUrl: string;
  location?: string;
  platforms: {
    linkedin?: boolean;
    twitter?: boolean;
    facebook?: boolean;
  };
  linkedinPostText?: string;
  twitterPostText?: string;
  facebookPostText?: string;
  linkedinTargets?: string[];
  twitterTargets?: string[];
  /** Public image URL attached to the LinkedIn share (JPG/PNG/GIF). */
  linkedinImageUrl?: string;
}

export const apiPublishSocialJob = async (data: SocialPublishData) => {
  return apiFetch<any>('/social/publish', {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiGetSocialStatus = async () => {
  return apiFetch<{
    linkedin: { connected: boolean; accountName?: string; accounts: SocialPublishingAccount[] };
    twitter: {
      connected: boolean;
      accountName?: string;
      accountEmail?: string;
      accounts: SocialPublishingAccount[];
    };
    facebook: { connected: boolean; accountName?: string; accountEmail?: string; accounts?: SocialPublishingAccount[] };
  }>('/social/status', { auth: true });
};

// ── User communication & OAuth (all secrets live on backend .env + encrypted DB) ──

export type CommunicationJobBoardKey = 'LinkedIn' | 'Indeed' | 'Naukri';

export interface CommunicationSettingsShape {
  defaultEmails: string[];
  defaultSendingEmail: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  smsAutoNotifications: boolean;
  googleCalendarSync: boolean;
  teamsCalendarSync: boolean;
  teamsTenantId: string;
  teamsClientId: string;
  teamsClientSecret: string;
  interviewAutoScheduling: boolean;
}

export type ConnectionStatus = { connected: boolean; email?: string; pageName?: string };

export type CommunicationConnections = {
  gmail: ConnectionStatus;
  googleCalendar: ConnectionStatus;
  outlook: ConnectionStatus;
  teams: ConnectionStatus;
  linkedin: ConnectionStatus;
};

export type CommunicationFullResponse = {
  settings: CommunicationSettingsShape;
  connections: CommunicationConnections;
  jobBoardKeys: {
    LinkedIn: { apiKey: string; clientId: string; connected: boolean };
    Indeed: { apiKey: string; publisherId: string; connected: boolean };
    Naukri: { apiKey: string; clientId: string; connected: boolean };
  };
  linkedinApp: { clientId: string; clientSecret: string };
};

export type PutCommunicationBody = {
  settings?: Partial<CommunicationSettingsShape>;
  jobBoardKeys?: Partial<CommunicationFullResponse['jobBoardKeys']>;
  linkedinApp?: Partial<CommunicationFullResponse['linkedinApp']>;
};

export const apiGetUserCommunication = async () => {
  return apiFetch<CommunicationFullResponse>('/settings/communication', { auth: true });
};

export const apiPutUserCommunication = async (body: PutCommunicationBody) => {
  return apiFetch<CommunicationFullResponse>('/settings/communication', {
    method: 'PUT',
    body,
    auth: true,
  });
};

export const apiPatchUserCommunicationPrefs = async (
  body: Partial<
    Pick<
      CommunicationSettingsShape,
      | 'googleCalendarSync'
      | 'teamsCalendarSync'
      | 'smsAutoNotifications'
      | 'interviewAutoScheduling'
    >
  > & { linkedinApp?: Partial<CommunicationFullResponse['linkedinApp']> }
) => {
  return apiFetch<CommunicationFullResponse>('/settings/communication', {
    method: 'PATCH',
    body,
    auth: true,
  });
};

export const apiResetUserCommunication = async () => {
  return apiFetch<CommunicationFullResponse>('/settings/communication/reset', {
    method: 'POST',
    auth: true,
  });
};

export const apiGetCommunicationConnections = async () => {
  return apiFetch<CommunicationConnections>('/settings/communication/connections', { auth: true });
};

export type NotificationTriggerSettingsPayload = {
  active: Record<string, boolean>;
  additional: Array<{ id: string; label: string; enabled: boolean }>;
};

export type NotificationTriggerEffectiveTemplate = {
  subject: string;
  bodyHtml: string;
  variables: string[];
  customized: boolean;
};

export type NotificationTriggerTemplateOverride = {
  subject?: string;
  bodyHtml?: string;
  customized?: boolean;
};

const NOTIFICATION_TRIGGER_SETTINGS_KEY = 'notification_email_trigger_points_v1';

export const apiGetNotificationTriggerSettings = async () => {
  return apiFetch<{
    key: string;
    value: NotificationTriggerSettingsPayload;
    scope: string;
    userId?: string | null;
  }>(`/settings/${encodeURIComponent(NOTIFICATION_TRIGGER_SETTINGS_KEY)}`, { auth: true });
};

export const apiUpdateNotificationTriggerSettings = async (
  value: NotificationTriggerSettingsPayload,
) => {
  return apiFetch<{
    key: string;
    value: NotificationTriggerSettingsPayload;
    scope: string;
    userId?: string | null;
  }>(`/settings/${encodeURIComponent(NOTIFICATION_TRIGGER_SETTINGS_KEY)}`, {
    method: 'PATCH',
    auth: true,
    body: {
      scope: 'USER',
      value,
    },
  });
};

// ── Notification trigger templates (subject + HTML) ──

export const apiGetNotificationTriggerTemplatesEffective = async (
  ids: string[],
) => {
  const qs = new URLSearchParams();
  qs.set('ids', Array.isArray(ids) ? ids.filter(Boolean).join(',') : '');
  return apiFetch<{
    effective: Record<string, NotificationTriggerEffectiveTemplate>;
  }>(`/settings/notification-trigger-templates/effective?${qs.toString()}`, { auth: true });
};

export const apiPatchNotificationTriggerTemplatesOverrides = async (
  templates: Record<string, NotificationTriggerTemplateOverride>,
) => {
  return apiFetch<{
    templates: Record<string, NotificationTriggerTemplateOverride>;
    effective: Record<string, NotificationTriggerEffectiveTemplate>;
  }>(`/settings/notification-trigger-templates`, {
    method: 'PATCH',
    auth: true,
    body: { templates },
  });
};

// ── Alerts Management (email + portal bell per event) ──

export type AlertChannelSettings = {
  email: boolean;
  portal: boolean;
};

export type AlertExamplePreview = {
  portalTitle: string;
  portalBody: string;
  emailSubject: string;
  shownIn: string;
};

export type AlertDefinition = {
  id: string;
  module: string;
  label: string;
  description: string;
  emailTriggerId?: string | null;
  category: string;
  severity: 'info' | 'warning' | 'critical' | string;
  defaultEmail: boolean;
  defaultPortal: boolean;
  examplePreview?: AlertExamplePreview | null;
};

export type AlertCatalogGroup = {
  module: string;
  alerts: AlertDefinition[];
};

export type ScheduledAnalysisSettings = {
  enabled: boolean;
  /** 24-hour local time HH:mm */
  time: string;
  /** IANA timezone */
  timezone: string;
};

export type AlertManagementPayload = {
  catalog: AlertCatalogGroup[];
  channels: Record<string, AlertChannelSettings>;
  scheduledAnalysis?: ScheduledAnalysisSettings;
  scope?: string;
  updatedAt?: string | null;
};

export const apiGetAlertManagement = async () => {
  return apiFetch<AlertManagementPayload>('/settings/alert-management', { auth: true });
};

export const apiUpdateAlertManagement = async (payload: {
  channels?: Record<string, AlertChannelSettings>;
  scheduledAnalysis?: ScheduledAnalysisSettings;
}) => {
  return apiFetch<AlertManagementPayload>('/settings/alert-management', {
    method: 'PATCH',
    auth: true,
    body: { ...payload, scope: 'ORG' },
  });
};

export const apiTestAlertEmail = async (alertId: string) => {
  return apiFetch<{ alertId: string; to: string }>('/settings/alert-management/test-email', {
    method: 'POST',
    auth: true,
    body: { alertId },
  });
};

export const apiTestAlertPortal = async (alertId: string) => {
  return apiFetch<{ alertId: string; notificationId: string }>(
    '/settings/alert-management/test-portal',
    {
      method: 'POST',
      auth: true,
      body: { alertId },
    },
  );
};

export type AriaUndoPayload = {
  available: boolean;
  actionId: string;
  expiresAt: string;
  expiresInSeconds: number;
  label: string;
  action: 'DELETE' | 'BULK_DELETE' | 'UPDATE' | 'RESTORE' | 'PLACEMENT_UNDO';
  endpoint: string;
  method: string;
  targetIds?: string[];
  reverseData?: {
    id: string;
    snapshot: any;
  };
  uiReverse: {
    action: 'DELETE_ROW' | 'BULK_DELETE_ROWS' | 'UPDATE_ROW' | 'FLASH_ROW' | 'RESTORE_ROW';
    target: string;
    rowId?: string;
    rowIds?: string[];
    metricsRollback?: Record<string, { delta: number }>;
    toast?: { type: 'success' | 'info' | 'warning'; message: string; duration: number };
  };
};

export type AriaUiPayload = {
  action: 'INSERT_ROW' | 'BULK_INSERT_ROWS' | 'UPDATE_ROW' | 'DELETE_ROW' | 'UPDATE_METRIC_CARDS' | 'OPEN_DRAWER' | 'NAVIGATE' | 'REFRESH_MODULE';
  target: string;
  data?: any;
  metricsUpdate?: Record<string, { delta: number; newTotal?: number }>;
  toast?: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    duration: number;
    actions?: Array<{ label: string; actionId: string; style?: string; expiresIn?: number }>;
  };
};

export type AriaChatDetail = { label: string; value: string };

export type AriaSuggestion = {
  label: string;
  action: string;
  params: Record<string, any>;
};

export type AriaChatOutput = {
  headline: string;
  summary: string;
  details: AriaChatDetail[];
  warnings?: string[];
  aiInsights?: string[];
  undoLine?: string;
  suggestions: AriaSuggestion[];
  bulkRows?: Array<{
    status: 'created' | 'skipped' | 'failed';
    label: string;
    id?: string;
    reason?: string;
  }>;
};

export type AssistantStructuredResponse = {
  intent: string;
  module: string;
  currentPage: string;
  isBulk: boolean;
  recordCount: number;
  clarificationNeeded: boolean;
  clarificationQuestion: string | null;
  sessionId: string;
  memoryUpdated: boolean;
  actions: Array<{
    step: number;
    method: string;
    endpoint: string;
    payload: any;
    idempotencyKey: string;
    status: string;
    responseId?: string;
  }>;
  result: {
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'PENDING' | 'CLARIFICATION_NEEDED';
    created: number;
    updated: number;
    deleted: number;
    skipped: number;
    failed: number;
    records: any[];
    errors: any[];
  };
  chatOutput: AriaChatOutput;
  uiPayload?: AriaUiPayload;
  undoPayload?: AriaUndoPayload;
  memoryUpdate?: {
    lastAction?: {
      type: string;
      module: string;
      recordId: string;
      recordLabel: string;
      timestamp: string;
      page: string;
    };
    addToRecentEntities?: {
      type: string;
      id: string;
      label: string;
    };
    addToUndoStack?: string;
  };
  plan?: string[];
  output?: string;
};

export type AriaLeadsUiPayload = {
  action: 'INSERT_ROW' | 'REPLACE_TABLE' | 'UPDATE_ROW' | 'DELETE_ROW' | 'BULK_INSERT' | string;
  target?: string;
  data?: any;
};

export type AriaLeadsResponse = {
  success: boolean;
  result?: any;
  uiPayload?: AriaLeadsUiPayload;
  clarificationNeeded?: boolean;
  message?: string;
  missingFields?: string[];
};

export const apiPatchJobBoard = async (body: {
  platform: CommunicationJobBoardKey;
  apiKey?: string;
  clientId?: string;
  publisherId?: string;
}) => {
  return apiFetch<{ platform: string; connected: boolean }>('/settings/communication/job-board', {
    method: 'PATCH',
    body,
    auth: true,
  });
};

export const apiDeleteJobBoardCredentials = async (platform: CommunicationJobBoardKey) => {
  return apiFetch<{ platform: string; connected: boolean }>('/settings/communication/job-board', {
    method: 'DELETE',
    body: { platform },
    auth: true,
  });
};

export const apiTestTwilioConnection = async () => {
  return apiFetch<{ success: boolean; message?: string; error?: string }>('/settings/twilio/test', {
    method: 'POST',
    auth: true,
  });
};

/** Fetch OAuth URL with Bearer token, then redirect browser to provider. */
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

export type IntegrationProvider =
  | 'gmail'
  | 'outlook'
  | 'google-calendar'
  | 'zoom'
  | 'google-meet'
  | 'microsoft-teams'
  | 'linkedin'
  | 'twitter'
  | 'facebook';

export type IntegrationStatusItem = {
  connected: boolean;
  provider: IntegrationProvider | string;
  label: string;
  accountEmail?: string;
  accountName?: string;
  scope?: string[];
  expiresAt?: string | null;
};

export type IntegrationStatusResponse = Record<string, IntegrationStatusItem>;

export async function apiGetIntegrationStatuses() {
  return apiFetch<IntegrationStatusResponse>('/integrations/status', { auth: true });
}

export async function apiConnectIntegration(
  provider: IntegrationProvider,
  returnUrl?: string,
  options?: { reopenCreateJobDrawer?: boolean },
) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oauth_navigation', '1');
    sessionStorage.setItem('oauth_provider', provider);
    if (options?.reopenCreateJobDrawer) {
      sessionStorage.setItem('reopen_create_job_drawer', '1');
    }
  }
  const qs = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
  const res = await apiFetch<{ url: string }>(`/auth/${provider}${qs}`, { auth: true });
  if (res.data?.url) {
    window.location.href = res.data.url;
    return;
  }
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('oauth_navigation');
    sessionStorage.removeItem('oauth_provider');
  }
  throw new Error(res.message || 'OAuth URL not available');
}

export async function apiDisconnectIntegration(
  provider: IntegrationProvider,
  connectionId?: string,
) {
  return apiFetch<{ provider: string; connected: boolean }>(`/disconnect/${provider}`, {
    method: 'POST',
    body: connectionId ? { connectionId } : undefined,
    auth: true,
  });
}

export type AssistantChatMessage = { role: 'user' | 'assistant'; content: string };
export type AssistantHistoryMessage = AssistantChatMessage & { id: string };

export type AssistantTaskChain = {
  task_id: string;
  goal: string;
  steps: string[];
  completed_steps: string[];
  pending_steps: string[];
  status: 'in_progress' | 'completed' | 'pending';
};

export type AssistantConversationMemory = {
  userIntent: string;
  lastActions: string[];
  currentPageContext: string;
  userPreferences: string[];
  frequentlyUsedActions: string[];
  updatedAt?: string | null;
};

export type AssistantActionLogItem = {
  action_id: string;
  entity: string;
  operation: string;
  previous_state?: unknown;
  new_state?: unknown;
  summary: string;
  createdAt?: string;
};

export type AssistantHistoryRecord = {
  pageKey: string;
  pathname?: string | null;
  messages: AssistantHistoryMessage[];
  conversationMemory?: AssistantConversationMemory;
  taskMemory?: {
    tasks: AssistantTaskChain[];
  };
  actionLog?: AssistantActionLogItem[];
  updatedAt?: string | null;
};

/** In-app AI assistant (floating bot). Requires backend OPENAI_API_KEY. */
export async function apiAssistantChat(body: {
  messages: AssistantChatMessage[];
  pageKey?: string;
  pathname?: string;
}) {
  const res = await apiFetch<{
    message: string;
    structured?: AssistantStructuredResponse;
    history?: AssistantHistoryRecord;
  }>('/ai/assistant-chat', {
    method: 'POST',
    body,
    auth: true,
  });

  if (res.data?.structured && !res.data.structured.chatOutput) {
    const fallback = res.data.structured as any;
    res.data.structured = {
      intent: fallback.intent || 'RESPONSE',
      module: fallback.module || '',
      currentPage: fallback.currentPage || body.pageKey || '',
      isBulk: false,
      recordCount: 0,
      clarificationNeeded: false,
      clarificationQuestion: null,
      sessionId: fallback.sessionId || '',
      memoryUpdated: false,
      actions: [],
      result: {
        status: 'SUCCESS',
        created: 0,
        updated: 0,
        deleted: 0,
        skipped: 0,
        failed: 0,
        records: [],
        errors: [],
      },
      chatOutput: {
        headline: '✳️ ARIA',
        summary: fallback.output || res.data.message || '',
        details: [],
        warnings: [],
        aiInsights: [],
        undoLine: '',
        suggestions: [],
      },
      uiPayload: fallback.uiPayload,
      undoPayload: fallback.undoPayload,
    };
  }

  return res;
}

/** HRYANTRA Enterprise Brain — orchestration over tenant data (no OpenAI required by default). */
export type BrainAskResult = {
  reply: string;
  intent?: string;
  entities?: string[];
  usedTools?: string[];
  retrieval?: { chunkIds?: string[]; entities?: string[] };
  auditId?: string;
  llmEnabled?: boolean;
  durationMs?: number;
};

export async function apiBrainAsk(body: {
  question: string;
  sessionKey?: string;
  pathname?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  executeWorkflow?: {
    action_type: string;
    record_id?: string;
    payload?: Record<string, unknown>;
    confirm?: boolean;
  } | null;
}) {
  return apiFetch<BrainAskResult>('/brain/ask', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiBrainSchema(entityId?: string) {
  const path = entityId ? `/brain/schema/${encodeURIComponent(entityId)}` : '/brain/schema';
  return apiFetch<{ modules?: unknown[]; entities?: unknown[]; entity?: unknown; relationships?: unknown }>(
    path,
    { auth: true },
  );
}

export async function apiBrainAnalytics() {
  return apiFetch<{ ok: boolean; metrics?: Record<string, number>; summary?: string }>('/brain/analytics', {
    auth: true,
  });
}

export async function apiBrainHealth() {
  return apiFetch<Record<string, unknown>>('/brain/health', { auth: true });
}

export async function apiAriaLeads(
  body: { userMessage: string; currentPage?: string },
  file?: File | null
) {
  if (file) {
    const formData = new FormData();
    formData.append('userMessage', body.userMessage || '');
    formData.append('currentPage', body.currentPage || 'leads');
    formData.append('file', file);
    return apiFetchFormData<AriaLeadsResponse>('/ai/aria', formData, {
      method: 'POST',
      auth: true,
    });
  }

  return apiFetch<AriaLeadsResponse>('/ai/aria', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiExecuteUndo(actionId: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    uiReverse?: AriaUndoPayload['uiReverse'];
  }>('/ai/aria/undo', {
    method: 'POST',
    body: { actionId },
    auth: true,
  });
}

export async function apiGetAssistantHistory(pageKey: string) {
  return apiFetch<AssistantHistoryRecord>(`/ai/assistant-history/${encodeURIComponent(pageKey)}`, {
    auth: true,
  });
}

export async function apiSaveAssistantHistory(
    pageKey: string,
    body: {
      pathname?: string;
      messages: AssistantHistoryMessage[];
      conversationMemory?: AssistantConversationMemory;
      taskMemory?: { tasks: AssistantTaskChain[] };
      actionLog?: AssistantActionLogItem[];
    }
  ) {
  return apiFetch<AssistantHistoryRecord>(`/ai/assistant-history/${encodeURIComponent(pageKey)}`, {
    method: 'PUT',
    body,
    auth: true,
  });
}

export async function apiDeleteAssistantHistory(pageKey: string) {
  return apiFetch<{ pageKey: string; deleted: boolean }>(`/ai/assistant-history/${encodeURIComponent(pageKey)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export type JobCreationPipelineResult = {
  nationality: string;
  jobTitle: string;
  priority: string;
  companyName: string;
  companyId: string;
  numberOfOpenings: string;
  country: string;
  state: string;
  city: string;
  industryType: string;
  employmentType: string;
  targetHireDate: string;
  minExperience: number;
  maxExperience: number;
  payRangeMin: string;
  payRangeMax: string;
  salaryCurrency: string;
  salaryInput: string;
  jobLocation: string;
  jobLocationType: string;
  jobType: string;
  languages: Array<{ language: string; proficiency: string }>;
  skills: string[];
  jobDescriptionHtml: string;
  jobSummary: string;
  keyResponsibilitiesText: string;
  qualificationsExperienceText: string;
  candidateRequirementsText: string;
  compensationBenefitsText: string;
  additionalSections?: Array<{ title: string; bodyText: string }>;
  educationalQualification: string;
  educationalSpecialization: string;
  extractedTextLength?: number;
  jobParseMeta?: Record<string, unknown>;
};

export async function apiProcessJobCreationPipeline(
  file: File,
  currentForm?: Record<string, unknown>,
  options: { signal?: AbortSignal } = {}
) {
  const formData = new FormData();
  formData.append('jdFile', file);
  if (currentForm && Object.keys(currentForm).length) {
    formData.append('currentForm', JSON.stringify(currentForm));
  }
  return apiFetchFormData<JobCreationPipelineResult>('/jobs/process-jd-file', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
}

export async function apiGenerateJobFromPrompt(body: {
  prompt: string;
  currentForm?: Record<string, unknown>;
}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }

  return apiFetch<JobCreationPipelineResult>('/ai/job-from-prompt', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiSuggestJobTitles(body: {
  query: string;
  company?: string;
  industry?: string;
  limit?: number;
}) {
  return apiFetch<{ suggestions: string[] }>('/ai/job-title-suggestions', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiGenerateJobDescription(body: {
  jobTitle: string;
  company?: string;
  jobType?: string;
  jobCategory?: string;
  locationType?: string;
  experience?: string;
  skills?: string[];
  customPrompt?: string;
}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }

  return apiFetch<{
    title: string;
    jobType: string;
    minExperience: number;
    maxExperience: number;
    educationalQualification: string;
    educationalSpecialization: string;
    skills: string[];
    screeningQuestions: string[];
    html: string;
  }>('/ai/job-description', {
    method: 'POST',
    body,
    auth: true,
  });
}

export type LeadAiGeneratedDetails = {
  companyName: string;
  contactPerson: string;
  directorSalutation?: string;
  designation: string;
  email: string;
  phone: string;
  emails?: string[];
  phones?: string[];
  type: 'Company' | 'Individual' | 'Referral';
  source: 'Website' | 'LinkedIn' | 'Email' | 'Referral' | 'Campaign' | 'Other';
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  priority: 'High' | 'Medium' | 'Low';
  interestedNeeds: string;
  notes: string;
  expectedBusinessValue?: string;
  industry: string;
  companySize: string;
  website: string;
  linkedIn: string;
  location: string;
  country: string;
  city: string;
  state?: string;
  campaignName: string;
  campaignLink: string;
  referralName: string;
  sourceWebsiteUrl: string;
  sourceLinkedInUrl: string;
  sourceEmail: string;
  sourceOther?: string;
  otherDetails: Array<{ label: string; value: string }>;
  lastFollowUp: string;
  nextFollowUp: string;
  assignedToId: string;
  assignedToName?: string;
  companyLinks?: string[];
  teamMemberSalutation?: string;
  teamMemberName?: string;
  teamMemberDesignation?: string;
  teamMemberEmail?: string;
  teamMemberPhone?: string;
};

export type LeadAiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function apiGenerateLeadDetails(body: {
  prompt: string;
  currentForm?: Record<string, unknown>;
}) {
  return apiFetch<LeadAiGeneratedDetails>('/ai/lead-details', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiLeadAiChat(body: {
  message: string;
  currentForm?: Record<string, unknown>;
  history?: LeadAiChatMessage[];
}) {
  return apiFetch<{
    reply: string;
    readyToCreate: boolean;
    lead: LeadAiGeneratedDetails;
  }>('/ai/lead-chat', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiCheckLeadDuplicate(body: {
  email?: string;
  phone?: string;
  companyName?: string;
  contactPerson?: string;
}) {
  return apiFetch<{
    duplicate: boolean;
    leadId?: string;
    matchedBy?: string[];
    existing?: {
      id: string;
      companyName?: string | null;
      contactPerson?: string | null;
      email?: string | null;
      phone?: string | null;
      ownerName?: string | null;
      createdAt?: string;
    };
  }>('/leads/duplicate-check', {
    method: 'POST',
    body,
    auth: true,
  });
}

export type ClientAiGeneratedDetails = {
  companyName: string;
  directorName: string;
  directorSalutation: string;
  designation: string;
  email: string;
  phone: string;
  emails?: string[];
  phones?: string[];
  industry: string;
  companySize: string;
  website: string;
  linkedIn: string;
  location: string;
  country: string;
  city: string;
  state?: string;
  timezone: string;
  leadStatus: string;
  priority: string;
  servicesNeeded: string;
  expectedBusinessValue: string;
  nextFollowUpDue: string;
  assignedToId: string;
  teamMemberName?: string;
  teamMemberEmail?: string;
  teamMemberPhone?: string;
  teamMemberDesignation?: string;
  agreementLevel?: string;
  agreementServiceChargePercent?: string;
  agreementContractStartDate?: string;
  agreementContractEndDate?: string;
  agreementTimePeriod?: string;
  agreementAdvancePaymentPercent?: string;
  agreementFreeReplacementValue?: string;
  agreementFreeReplacementUnit?: string;
  kycTradeName?: string;
  kycEntityType?: string;
  kycIncorporationDate?: string;
  kycCountryOfIncorporation?: string;
  kycLegalRegistrationNumber?: string;
  kycTaxIdVatNumber?: string;
  kycBusinessAddress?: string;
  kycSignatoryFullName?: string;
  kycSignatoryDesignation?: string;
  kycSignatoryNationality?: string;
  kycSignatoryEmail?: string;
  kycSignatoryPhone?: string;
  kycBankName?: string;
  kycAccountHolderName?: string;
  kycAccountNumber?: string;
  kycIban?: string;
  kycSwiftBic?: string;
  kycBankCurrency?: string;
  kycBankAddress?: string;
  kycShareholder1Name?: string;
  kycShareholder1Nationality?: string;
  kycShareholder1OwnershipPercent?: string;
  kycShareholder2Name?: string;
  kycShareholder2Nationality?: string;
  kycShareholder2OwnershipPercent?: string;
  otherDetails: Array<{ label: string; value: string }>;
};

export async function apiGenerateClientDetails(body: {
  prompt: string;
  currentForm?: Record<string, unknown>;
}) {
  return apiFetch<ClientAiGeneratedDetails>('/ai/client-details', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiClientAiChat(body: {
  message: string;
  currentForm?: Record<string, unknown>;
  history?: LeadAiChatMessage[];
}) {
  return apiFetch<{
    reply: string;
    readyToCreate: boolean;
    client: ClientAiGeneratedDetails;
  }>('/ai/client-chat', {
    method: 'POST',
    body,
    auth: true,
  });
}

export type CandidateAiGeneratedDetails = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  age?: string;
  cityState?: string;
  address?: string;
  zip?: string;
  nationality?: string;
  maritalStatus?: string;
  birthDate?: string;
  passportNumber?: string;
  currentCompany?: string;
  currentDesignation?: string;
  currentCompanyWebsite?: string;
  experience?: string;
  currentSalary?: string;
  currentSalaryCurrency?: string;
  currentBenefits?: string;
  expectedSalary?: string;
  currency?: string;
  expectedBenefits?: string;
  noticePeriodDays?: string;
  noticePeriod?: string;
  availabilityStatus?: string;
  courses?: string;
  extracurricularActivities?: string;
  volunteers?: string;
  linkedinUrl?: string;
  twitter?: string;
  facebook?: string;
  skypeId?: string;
  stackOverflow?: string;
  website?: string;
  portfolioUrl?: string;
  summary?: string;
  workHistory?: string;
  educationHistory?: string;
  honoursAwards?: string;
  source?: string;
  sourceUrl?: string;
  referrerName?: string;
  agencyName?: string;
  priority?: string;
  location?: string;
  remarks?: string;
  initialNote?: string;
  skills?: string[];
};

export async function apiGenerateCandidateDetails(body: {
  prompt: string;
  currentForm?: Record<string, unknown>;
}) {
  return apiFetch<CandidateAiGeneratedDetails>('/ai/candidate-details', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiCandidateAiChat(body: {
  message: string;
  currentForm?: Record<string, unknown>;
  history?: LeadAiChatMessage[];
}) {
  return apiFetch<{
    reply: string;
    readyToCreate: boolean;
    candidate: CandidateAiGeneratedDetails;
  }>('/ai/candidate-chat', {
    method: 'POST',
    body,
    auth: true,
  });
}

/** Display-only base for “register this redirect URI” (local: derived from NEXT_PUBLIC_API_URL). */
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

export type AppNotificationCategory =
  | 'CANDIDATE'
  | 'JOB'
  | 'INTERVIEW'
  | 'PLACEMENT'
  | 'CLIENT'
  | 'LEAD'
  | 'BILLING'
  | 'TASK'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  userId: string;
  category: AppNotificationCategory;
  title: string;
  description: string | null;
  actionLabel: string | null;
  actionPath: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  timestamp: string;
}

export interface NotificationsListResponse {
  notifications: AppNotification[];
  unreadCount: number;
  totalCount: number;
}

export const NOTIFICATIONS_UPDATED_EVENT = 'frontphase2:notifications-updated';

export function emitNotificationsUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

export async function apiListNotifications(params?: {
  category?: AppNotificationCategory | 'ALL';
  onlyUnread?: boolean;
  take?: number;
}) {
  const search = new URLSearchParams();
  if (params?.category && params.category !== 'ALL') {
    search.set('category', params.category);
  }
  if (params?.onlyUnread) search.set('onlyUnread', 'true');
  if (params?.take) search.set('take', String(params.take));
  const query = search.toString();
  return apiFetch<NotificationsListResponse>(
    `/notifications${query ? `?${query}` : ''}`,
    { method: 'GET', auth: true }
  );
}

export async function apiGetNotificationUnreadCount(): Promise<{
  success: boolean;
  count: number;
}> {
  const res = await apiFetch<undefined>('/notifications/unread-count', {
    method: 'GET',
    auth: true,
  });
  // Backend returns { success, count } at the top level (not inside `data`).
  return {
    success: !!(res as unknown as { success: boolean }).success,
    count: Number((res as unknown as { count?: number }).count ?? 0),
  };
}

export type AiCoinPack = {
  id: string;
  name: string;
  coins: number;
  priceUsd: number;
  priceLabel: string;
  description: string;
  popular?: boolean;
};

export async function apiGetTenantCoins(): Promise<{
  coins: number;
  planName: string | null;
  features: HqAiFeature[];
  packs: AiCoinPack[];
}> {
  const res = await apiFetch<{
    coins: number;
    planName: string | null;
    features?: HqAiFeature[];
    packs?: AiCoinPack[];
  }>('/settings/org/coins', {
    method: 'GET',
    auth: true,
  });
  return {
    coins: Number(res.data?.coins ?? 0),
    planName: res.data?.planName ?? null,
    features: Array.isArray(res.data?.features) ? res.data.features : [],
    packs: Array.isArray(res.data?.packs) ? res.data.packs : [],
  };
}

export async function apiGetAiCoinPacks() {
  return apiFetch<{ packs: AiCoinPack[]; demo: boolean }>('/settings/org/coins/packs', {
    method: 'GET',
    auth: true,
  });
}

export async function apiPurchaseAiCoinPack(packId: string) {
  return apiFetch<{
    demo: boolean;
    message: string;
    coins: number;
    previous: number;
    added: number;
    pack: AiCoinPack;
  }>('/settings/org/coins/purchase', {
    method: 'POST',
    auth: true,
    body: { packId },
  });
}

export async function apiMarkNotificationRead(id: string) {
  const res = await apiFetch<undefined>(`/notifications/${id}/read`, {
    method: 'PUT',
    auth: true,
  });
  emitNotificationsUpdated();
  return res;
}

export async function apiMarkAllNotificationsRead() {
  const res = await apiFetch<undefined>('/notifications/mark-all-read', {
    method: 'PUT',
    auth: true,
  });
  emitNotificationsUpdated();
  return res;
}

export async function apiDeleteNotification(id: string) {
  const res = await apiFetch<undefined>(`/notifications/${id}`, {
    method: 'DELETE',
    auth: true,
  });
  emitNotificationsUpdated();
  return res;
}

export async function apiCreateNotification(payload: {
  category?: AppNotificationCategory;
  title: string;
  description?: string;
  actionLabel?: string | null;
  actionPath?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const res = await apiFetch<AppNotification>('/notifications', {
    method: 'POST',
    body: payload,
    auth: true,
  });
  emitNotificationsUpdated();
  return res;
}

// ────────────────────────────────────────────────────────────
// Recycle Bin — soft-deleted records (leads / clients / candidates / jobs).
// Backed by GET /trash, POST /:id/restore, DELETE /:id/purge per entity module.
// ────────────────────────────────────────────────────────────

/** Lightweight shape every Recycle Bin row exposes (raw backend payload still flows through). */
export interface TrashRow {
  id: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  /** Pre-formatted name for the UI; computed from each entity's primary label field. */
  displayName?: string;
  /** Short secondary line (e.g. email, client name). */
  subtitle?: string;
  /** Pass-through original payload for entity-specific UIs. */
  raw?: unknown;
}

function buildTrashQuery(opts: { page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const apiGetLeadsTrash = async (opts: { page?: number; limit?: number } = {}) => {
  return apiFetch<any>(`/leads/trash${buildTrashQuery(opts)}`, { method: 'GET', auth: true });
};
export const apiRestoreLead = async (id: string) => {
  return apiFetch<{ message: string }>(`/leads/${id}/restore`, { method: 'POST', auth: true });
};
export const apiPurgeLead = async (id: string) => {
  return apiFetch<{ message: string }>(`/leads/${id}/purge`, { method: 'DELETE', auth: true });
};
export const apiBulkPurgeLeads = async (ids: string[]) => {
  return apiFetch<{ success: number; failed: number; failures: { id: string; message: string }[] }>(
    '/leads/trash/bulk-purge',
    { method: 'POST', auth: true, body: { ids } }
  );
};

export const apiGetClientsTrash = async (opts: { page?: number; limit?: number } = {}) => {
  return apiFetch<any>(`/clients/trash${buildTrashQuery(opts)}`, { method: 'GET', auth: true });
};
export const apiRestoreClient = async (id: string) => {
  return apiFetch<{ message: string }>(`/clients/${id}/restore`, { method: 'POST', auth: true });
};
export const apiPurgeClient = async (id: string) => {
  return apiFetch<{ message: string }>(`/clients/${id}/purge`, { method: 'DELETE', auth: true });
};
export const apiBulkPurgeClients = async (ids: string[]) => {
  return apiFetch<{ success: number; failed: number; failures: { id: string; message: string }[] }>(
    '/clients/trash/bulk-purge',
    { method: 'POST', auth: true, body: { ids } }
  );
};

export const apiGetCandidatesTrash = async (opts: { page?: number; limit?: number } = {}) => {
  return apiFetch<any>(`/candidates/trash${buildTrashQuery(opts)}`, { method: 'GET', auth: true });
};
export const apiRestoreCandidate = async (id: string) => {
  return apiFetch<{ message: string }>(`/candidates/${id}/restore`, { method: 'POST', auth: true });
};
export const apiPurgeCandidate = async (id: string) => {
  return apiFetch<{ message: string }>(`/candidates/${id}/purge`, { method: 'DELETE', auth: true });
};
export const apiBulkPurgeCandidates = async (ids: string[]) => {
  return apiFetch<{ success: number; failed: number; failures: { id: string; message: string }[] }>(
    '/candidates/trash/bulk-purge',
    { method: 'POST', auth: true, body: { ids } }
  );
};

export const apiGetJobsTrash = async (opts: { page?: number; limit?: number } = {}) => {
  return apiFetch<any>(`/jobs/trash${buildTrashQuery(opts)}`, { method: 'GET', auth: true });
};
export const apiRestoreJob = async (id: string) => {
  return apiFetch<{ message: string }>(`/jobs/${id}/restore`, { method: 'POST', auth: true });
};
export const apiPurgeJob = async (id: string) => {
  return apiFetch<{ message: string }>(`/jobs/${id}/purge`, { method: 'DELETE', auth: true });
};
export const apiBulkPurgeJobs = async (ids: string[]) => {
  return apiFetch<{ success: number; failed: number; failures: { id: string; message: string }[] }>(
    '/jobs/trash/bulk-purge',
    { method: 'POST', auth: true, body: { ids } }
  );
};
