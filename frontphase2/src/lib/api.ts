/* Simple API client for talking to the Express backend */

import type {
  CreatePlacementPayload,
  MarkFailedPayload,
  MarkJoinedPayload,
  PaginatedResponse as PlacementPaginatedResponse,
  Placement,
  PlacementFilters,
  PlacementStats,
  RequestReplacementPayload,
} from '../types/placement';

const LOCAL_API_BASE = 'http://127.0.0.1:5001/api/v1';
const PRODUCTION_API_BASE = 'https://api2.hryantra.com/api/v1';
const PROD_PROXY_BASE = '/api/proxy';

const isLocalBrowser =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local'));

// Determination of API base based on environment
const API_BASE = isLocalBrowser ? LOCAL_API_BASE : PROD_PROXY_BASE;

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
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

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('accessToken');
  } catch (error) {
    console.error('Error accessing localStorage:', error);
    return null;
  }
}

function syncAuthCookie(name: string, value: string | null) {
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
    signal?: AbortSignal;
  } = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
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
        // Redirect to login if we're in the browser
        if (window.location.pathname !== '/login') {
          const currentPath = window.location.pathname + window.location.search;
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
      }
      throw new Error('Authentication required. Please log in.');
    }
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
    // Handle network errors (server not running, no internet, etc.)
    if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please ensure the backend server is running.');
    }
    throw fetchError;
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error('Invalid server response');
  }

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

            let retryJson: any;
            try {
              retryJson = await retryRes.json();
            } catch {
              throw new Error('Invalid server response');
            }

            if (retryRes.ok && retryJson?.success !== false) {
              return retryJson as ApiResponse<T>;
            }
          }
        } catch (refreshError) {
          // Refresh failed, proceed to clear tokens and redirect
          console.error('Token refresh failed:', refreshError);
        }
      }

      // If refresh failed or no refresh token, clear tokens and redirect
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('currentUser');
        syncAuthCookie('accessToken', null);
        syncAuthCookie('refreshToken', null);
        
        // Redirect to login page if not already there
        if (window.location.pathname !== '/login') {
          const currentPath = window.location.pathname + window.location.search;
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
      }
      throw new Error('Authentication required. Please log in.');
    }
    const msg = json?.message || `Request failed with status ${res.status}`;
    const error: any = new Error(msg);
    error.status = res.status;
    error.data = json?.data;
    error.raw = json;
    throw error;
  }

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

  return json as ApiResponse<T>;
}

async function apiFetchFormData<T>(
  path: string,
  formData: FormData,
  options: {
    method?: HttpMethod;
    auth?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {};

  if (debugApiLogs) {
    const entries = Array.from(formData.entries()).slice(0, 10).map(([k, v]) => [k, typeof v === 'string' ? v : typeof v]);
    console.log('[apiFetchFormData] request', { method: options.method || 'POST', path, auth: !!options.auth, entries });
  }

  if (options.auth) {
    const token = getAccessToken();
    if (!token) {
      throw new Error('Authentication required. Please log in.');
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method || 'POST',
      headers,
      body: formData,
      signal: options.signal,
    });
  } catch (fetchError: any) {
    if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please ensure the backend server is running.');
    }
    throw fetchError;
  }

  const json = await res.json().catch(() => {
    throw new Error('Invalid server response');
  });

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
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }

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

  return json as ApiResponse<T>;
}

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  roleName?: string;
  roleColor?: string;
}

interface AuthPayload {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  permissions?: string[];
  requirePasswordReset?: boolean;
}

export async function apiLogin(email: string, password: string) {
  const res = await apiFetch<AuthPayload>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  if (typeof window !== 'undefined') {
    // backendphase2 sometimes returns the JWT as `data.token` (credential login)
    // and sometimes as `data.accessToken` (legacy/email login).
    const accessToken = (res.data as any)?.accessToken || (res.data as any)?.token;
    const refreshToken = (res.data as any)?.refreshToken;

    if (accessToken) localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    syncAuthCookie('accessToken', accessToken || null);
    syncAuthCookie('refreshToken', refreshToken || null);
    
    const permissions = Array.isArray(res.data.permissions)
      ? res.data.permissions
      : [];
    const resolvedRoleName =
      res.data.user?.roleName ||
      (typeof res.data.user?.role === 'string'
        ? res.data.user.role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
        : '');

    // Store user data with permissions
    const userData = {
      ...res.data.user,
      roleName: resolvedRoleName,
      roleColor: res.data.user?.roleColor || '',
      permissions,
      requirePasswordReset: res.data.requirePasswordReset || false,
    };
    localStorage.setItem('currentUser', JSON.stringify(userData));
    
    // Also store permissions separately for easy access
    localStorage.setItem('userPermissions', JSON.stringify(permissions));
    if (res.data.requirePasswordReset) {
      localStorage.setItem('requirePasswordReset', 'true');
    }
  }

  return res;
}

export async function apiRegister(name: string, email: string, password: string, role?: string) {
  const res = await apiFetch<AuthPayload>('/auth/register', {
    method: 'POST',
    body: { name, email, password, role },
  });

  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', res.data.accessToken);
    if (res.data.refreshToken) {
      localStorage.setItem('refreshToken', res.data.refreshToken);
    }
    syncAuthCookie('accessToken', res.data.accessToken);
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
  }

  return res;
}

export async function apiRefreshToken() {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const res = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    auth: false, // Don't require auth for refresh endpoint
  });

  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', res.data.accessToken);
    if (res.data.refreshToken) {
      localStorage.setItem('refreshToken', res.data.refreshToken);
    }
    syncAuthCookie('accessToken', res.data.accessToken);
    syncAuthCookie('refreshToken', res.data.refreshToken || null);
  }

  return res;
}

export async function apiLogout() {
  if (typeof window === 'undefined') return;

  try {
    const token = localStorage.getItem('accessToken');
    if (token) {
      await apiFetch<{ success?: boolean; message?: string }>('/auth/logout', {
        method: 'POST',
        auth: true,
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
    syncAuthCookie('accessToken', null);
    syncAuthCookie('refreshToken', null);
  }
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
  skills?: string[];
  preferredSkills?: string[];
  benefits?: string[];
  pipelineStages?: Array<{
    id: string;
    name: string;
    order: number;
    color?: string;
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
  location?: string;
  type?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP';
  status?: 'DRAFT' | 'OPEN' | 'ON_HOLD' | 'CLOSED' | 'FILLED';
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
  }>;
  applicationFormEnabled?: boolean;
  applicationFormLogo?: string;
  applicationFormQuestions?: string[];
  applicationFormNote?: string;
  statusRemark?: string;
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

export interface JobMetrics {
  activeJobs: number;
  newJobsThisWeek: number;
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
  skills?: string[];
  address?: string | null;
  city?: string | null;
  country?: string | null;
  availability?: string | null;
  noticePeriod?: string | null;
  stage?: string | null;
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
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
  matches?: Array<{
    id: string;
    status?: string;
    score?: number;
    job?: {
      id: string;
      title: string;
      client?: {
        companyName: string;
      };
    };
  }>;
  interviews?: Array<{
    id: string;
    status?: string;
    scheduledAt?: string;
    round?: string | null;
    duration?: number | null;
    mode?: string | null;
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
    status?: string;
    createdAt?: string;
  }>;
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
  page?: number;
  limit?: number;
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
  const path = `/candidates${qs ? `?${qs}` : ''}`;
  return apiFetch<BackendCandidate[]>(path, { auth: true });
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
  email: string;
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

export type LeadImportPreviewResult = ClientImportPreviewResult;
export type LeadImportExecuteResult = ClientImportExecuteResult;

export const apiCreateCandidateFromDrawer = async (payload: AddCandidatePayload) => {
  return apiFetch<BackendCandidate>('/candidates/create', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiParseCandidateResume = async (file: File) => {
  const formData = new FormData();
  formData.append('resume', file);
  return apiFetchFormData<ImportedProfileData>('/candidates/parse-resume', formData, {
    method: 'POST',
    auth: true,
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

export const apiUploadCandidateResumeFile = async (candidateId: string, file: File) => {
  const formData = new FormData();
  formData.append('resume', file);
  return apiFetchFormData<BackendCandidate>(`/candidates/${candidateId}/files`, formData, {
    method: 'POST',
    auth: true,
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
  payload: { reason: string; feedback: string; sendEmail: boolean }
) => {
  return apiFetch<BackendCandidate>(`/candidates/${candidateId}/reject`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiGetCandidateStats = async (params?: { mine?: boolean }) => {
  const qs = params?.mine === true ? '?mine=true' : '';
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
  }>(`/candidates/stats${qs}`, { auth: true });
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
    type: string;
    round: number;
    date: string;
    time: string;
    duration: string;
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
    lastName: string;
    email: string;
    avatar?: string | null;
    stage?: string | null;
    status?: string | null;
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

export const apiRequestPlacementReplacement = async (id: string, payload: RequestReplacementPayload) => {
  return apiFetch<Placement>(`/placements/${id}/request-replacement`, {
    method: 'PATCH',
    body: payload,
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
  matchSource: 'ai' | 'manual';
  explanation: {
    skills: boolean | 'partial';
    experience: boolean | 'partial';
    location: boolean | 'partial';
    salary: boolean | 'partial';
    text: string;
    matchedSkills: string[];
    missingSkills: string[];
    roleRequirement: string;
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
}

export async function apiGetMatches(params: {
  jobId?: string;
  candidateId?: string;
  status?: string;
  minScore?: number;
  source?: 'ai' | 'manual';
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

export const apiToggleSavedMatch = async (matchId: string, saved: boolean) => {
  return apiFetch<BackendMatch>(`/matches/${matchId}/save`, {
    method: 'POST',
    body: { saved },
    auth: true,
  });
};

export const apiSubmitMatch = async (
  matchId: string,
  payload: { message: string; notifyClient: boolean }
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
  email: string | null;
  phone?: string | null;
  type: 'Company' | 'Individual' | 'Referral';
  source: 'Website' | 'LinkedIn' | 'Email' | 'Referral' | 'Campaign';
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  priority: 'High' | 'Medium' | 'Low';
  interestedNeeds?: string | null;
  notes?: string | null;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  linkedIn?: string | null;
  location?: string | null;
  designation?: string | null;
  country?: string | null;
  city?: string | null;
  campaignName?: string | null;
  campaignLink?: string | null;
  referralName?: string | null;
  sourceWebsiteUrl?: string | null;
  sourceLinkedInUrl?: string | null;
  sourceEmail?: string | null;
  otherDetails?: Array<{ label: string; value: string }> | null;
  lastFollowUp?: string | null;
  nextFollowUp?: string | null;
  lostReason?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadData {
  companyName?: string | null;
  contactPerson?: string | null;
  directorName?: string;
  email?: string | null;
  phone?: string;
  type?: 'Company' | 'Individual' | 'Referral';
  source?: 'Website' | 'LinkedIn' | 'Email' | 'Referral' | 'Campaign';
  status?: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
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
  country?: string;
  city?: string;
  campaignName?: string;
  campaignLink?: string;
  referralName?: string;
  sourceWebsiteUrl?: string;
  sourceLinkedInUrl?: string;
  sourceEmail?: string;
  otherDetails?: Array<{ label: string; value: string }>;
  lastFollowUp?: string;
  nextFollowUp?: string;
  lostReason?: string;
  assignedToId?: string;
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

export const apiUpdateLead = async (id: string, data: Partial<CreateLeadData>) => {
  return apiFetch<BackendLead>(`/leads/${id}`, {
    method: 'PATCH',
    body: data,
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

export const apiConvertLeadToClient = async (id: string, clientData: {
  companyName?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  address?: string;
  linkedin?: string;
  location?: string;
  hiringLocations?: string;
  servicesNeeded?: string;
  expectedBusinessValue?: string;
  priority?: string;
}) => {
  return apiFetch<any>(`/leads/${id}/convert`, {
    method: 'POST',
    body: clientData,
    auth: true,
  });
};

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
  avgTimeToFill?: string | null;
  healthStatus?: string | null;
  revenueGenerated?: string | null;
  billingTotalRevenue?: string | null;
  billingOutstanding?: string | null;
  billingPaid?: string | null;
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
}) => {
  const queryParams = new URLSearchParams();
  if (params?.start) queryParams.set('start', params.start);
  if (params?.end) queryParams.set('end', params.end);
  if (params?.mineOnly !== undefined) queryParams.set('mineOnly', String(params.mineOnly));

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
  return apiFetch<ApiResponse<{ duplicates: Array<{ match: string; contact: BackendContact }> }>>(
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
  assignedToId?: string;
  companySize?: string;
  hiringLocations?: string;
  servicesNeeded?: string;
  expectedBusinessValue?: string;
  linkedin?: string;
  timezone?: string;
  priority?: string;
  sla?: string;
}

export interface UpdateClientData {
  companyName?: string;
  industry?: string;
  website?: string;
  logo?: string;
  location?: string;
  status?: 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE';
  assignedToId?: string;
  companySize?: string;
  hiringLocations?: string;
  servicesNeeded?: string;
  expectedBusinessValue?: string;
  linkedin?: string;
  timezone?: string;
  priority?: string;
  sla?: string;
}

export const apiCreateClient = async (data: CreateClientData) => {
  return apiFetch<BackendClient>('/clients', {
    method: 'POST',
    body: data,
    auth: true,
  });
};

// User interfaces and API
export interface BackendUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  avatar?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export const apiGetUsers = async (params?: {
  role?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const queryParams = new URLSearchParams();
  if (params?.role) queryParams.append('role', params.role);
  if (params?.isActive !== undefined) queryParams.append('isActive', String(params.isActive));
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.limit) queryParams.append('limit', String(params.limit));

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
  performedBy: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
}

export const apiGetActivityFeed = async (params?: { page?: number; limit?: number }) => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.limit) queryParams.append('limit', String(params.limit));
  const qs = queryParams.toString();
  return apiFetch<{ data: BackendGlobalActivity[]; pagination: any }>(`/activities${qs ? `?${qs}` : ''}`, {
    auth: true,
  });
};

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
  status: 'PENDING' | 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  taskType?: string | null;
  assignedToId: string;
  createdById: string;
  linkedEntityType?: 'CANDIDATE' | 'JOB' | 'CLIENT' | 'INTERVIEW' | 'INTERNAL' | null;
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
  relatedTo?: 'Candidate' | 'Job' | 'Client' | 'Interview' | 'Internal';
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

export const apiDeleteTask = async (id: string) => {
  return apiFetch<{ message: string }>(`/tasks/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiMarkTaskCompleted = async (id: string) => {
  return apiFetch<BackendTask>(`/tasks/${id}/complete`, {
    method: 'POST',
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
// Internal Chat (Inbox) for Tasks
// ────────────────────────────────────────────────────────────

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
  relatedEntityType?: 'CANDIDATE' | 'JOB' | 'CLIENT' | 'INTERVIEW' | 'TASK' | null;
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

// Get (at most one) chat thread for a task, if it exists
export const apiGetTaskChatThread = async (taskId: string) => {
  const res = await apiFetch<any>(`/inbox/threads?relatedEntityType=TASK&relatedEntityId=${taskId}`, {
    method: 'GET',
    auth: true,
  });

  let threads: InboxThread[] = [];

  // Backend returns paginated shape { data: [...], pagination: {...} }
  const raw = res.data;
  if (Array.isArray(raw)) {
    threads = raw as InboxThread[];
  } else if (raw && Array.isArray(raw.data)) {
    threads = raw.data as InboxThread[];
  } else if (raw && Array.isArray(raw.items)) {
    threads = raw.items as InboxThread[];
  }

  return threads.length > 0 ? threads[0] : null;
};

// Get full thread with all messages
export const apiGetInboxThread = async (threadId: string) => {
  const res = await apiFetch<InboxThread>(`/inbox/threads/${threadId}`, {
    method: 'GET',
    auth: true,
  });
  return res.data;
};

// Create a chat thread for a task with an initial message
export const apiCreateTaskChatThread = async (taskId: string, initialMessage: string) => {
  const res = await apiFetch<InboxThread>('/inbox/threads', {
    method: 'POST',
    body: {
      subject: 'Task Internal Chat',
      relatedEntityType: 'TASK',
      relatedEntityId: taskId,
      participantIds: [], // optional, can be extended later
      initialMessage,
      attachments: [],
    },
    auth: true,
  });
  return res.data;
};

// Add a message to an existing thread
export const apiAddTaskChatMessage = async (threadId: string, body: string) => {
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

// ── LINKEDIN INTEGRATION ──

export interface LinkedInStatus {
  connected: boolean;
  expired?: boolean;
  name?: string;
  picture?: string;
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

// ── GENERAL SOCIAL PUBLISHING ──

export interface SocialPublishData {
  jobId: string;
  title: string;
  companyName: string;
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
    twitter: { connected: boolean };
    facebook: { connected: boolean };
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

export async function apiConnectIntegration(provider: IntegrationProvider) {
  const res = await apiFetch<{ url: string }>(`/auth/${provider}`, { auth: true });
  if (res.data?.url) {
    window.location.href = res.data.url;
  }
}

export async function apiDisconnectIntegration(provider: IntegrationProvider) {
  return apiFetch<{ provider: string; connected: boolean }>(`/disconnect/${provider}`, {
    method: 'POST',
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

export type AssistantStructuredResponse = {
  plan: string[];
  memory_used: {
    conversation: string;
    task: string;
    long_term: string;
    page_context: string;
  };
  actions: Array<{
    type: string;
    status: string;
    entity: string;
    details: string;
  }>;
  task_update: AssistantTaskChain;
  output: string;
  files: Array<{
    type: string;
    fileName: string;
    reason: string;
  }>;
  memory_update: {
    userIntent: string;
    lastActions: string[];
    currentPageContext: string;
    userPreferences: string[];
    frequentlyUsedActions: string[];
    taskMemory: {
      tasks: AssistantTaskChain[];
    };
    actionLog: AssistantActionLogItem[];
  };
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
  return apiFetch<{
    message: string;
    structured?: AssistantStructuredResponse;
    history?: AssistantHistoryRecord;
  }>('/ai/assistant-chat', {
    method: 'POST',
    body,
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

export async function apiGenerateLeadDetails(body: {
  prompt: string;
  currentForm?: Record<string, unknown>;
}) {
  return apiFetch<{
    companyName: string;
    contactPerson: string;
    designation: string;
    email: string;
    phone: string;
    type: 'Company' | 'Individual' | 'Referral';
    source: 'Website' | 'LinkedIn' | 'Email' | 'Referral' | 'Campaign';
    status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
    priority: 'High' | 'Medium' | 'Low';
    interestedNeeds: string;
    notes: string;
    industry: string;
    companySize: string;
    website: string;
    linkedIn: string;
    location: string;
    country: string;
    city: string;
    campaignName: string;
    campaignLink: string;
    referralName: string;
    sourceWebsiteUrl: string;
    sourceLinkedInUrl: string;
    sourceEmail: string;
    otherDetails: Array<{ label: string; value: string }>;
    lastFollowUp: string;
    nextFollowUp: string;
    assignedToId: string;
  }>('/ai/lead-details', {
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
