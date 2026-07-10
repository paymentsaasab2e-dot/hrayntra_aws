import { apiFetch, refreshLocalUserPermissions, type BackendUser } from '../api';
import type {
  TeamMember,
  TeamMemberDetail,
  CreateMemberPayload,
  UpdateMemberPayload,
  GenerateCredentialsPayload,
  TeamMemberFilters,
  SystemRole,
  Role,
  Department,
  DepartmentRoleInput,
  LoginHistory,
  UserActivity,
  TeamMemberStats,
  TeamRequest,
  CreateTeamRequestPayload,
  UpdateTeamRequestPayload,
} from '../../types/team';
import { buildFallbackPermissionsMap } from '../../components/team/permissionCatalog';

const getApiConfig = () => {
  const isLocalBrowser =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local'));

  if (isLocalBrowser) {
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:5001';
    return {
      base: base.replace(/\/api\/v1$/, ''),
      routePrefix: '/api',
    };
  }

  // Production/non-local browsers must use same-origin proxy.
  // The proxy handles route translation for the newer team endpoints.
  return {
    base: '/api/proxy',
    routePrefix: '',
  };
};

const { base: API_BASE_NEW, routePrefix: API_ROUTE_PREFIX } = getApiConfig();

const buildPath = (path: string) => {
  const normalizedPath = path.replace(/^\/api(?=\/|$)/, '');
  return `${API_ROUTE_PREFIX}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
};

const buildRolesPath = (suffix: string = '') => {
  return buildPath(`/roles${suffix}`);
};

/** Auth + optional tenant header for /api/team, /api/roles, /api/permissions (must match backend tenant middleware). */
function getTeamAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window === 'undefined') return headers;
  const token = localStorage.getItem('accessToken');
  if (token) headers.Authorization = `Bearer ${token}`;
  const tenant = localStorage.getItem('tenantDbName');
  if (tenant) headers['x-tenant-db-name'] = tenant;
  return headers;
}

async function parseTeamFetchJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? 'Server returned an empty response. Check that the backend is running on port 5001 and try again.'
        : `Request failed (${res.status}). The server did not return a response body.`,
    );
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      res.ok
        ? 'Server returned an invalid response. Please try again.'
        : `Request failed (${res.status}). The server response could not be read.`,
    );
  }
}

function throwTeamApiError(json: Record<string, unknown>, res: Response): never {
  const message = String(json?.message || `Request failed with status ${res.status}`);
  throw new Error(message);
}

const normalizeArrayPayload = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;

    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.results)) return obj.results as T[];
    if (Array.isArray(obj.members)) return obj.members as T[];
    if (Array.isArray(obj.roles)) return obj.roles as T[];
    if (Array.isArray(obj.departments)) return obj.departments as T[];
  }

  return [];
};

const TEAM_CACHE_KEYS = {
  roles: 'team:roles:cache',
  permissions: 'team:permissions:cache',
} as const;

function isOfflineBrowser() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore cache write errors.
  }
}

/**
 * List team members. Use `assignmentDirectory: true` for “Assigned to” pickers (GET /team/assignable, auth only).
 * Default uses GET /team (extra permissions may be required).
 */
export async function getTeamMembers(filters: TeamMemberFilters = {}, opts?: { assignmentDirectory?: boolean }) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  const basePath = opts?.assignmentDirectory ? '/team/assignable' : '/team';
  const path = buildPath(`${basePath}${qs ? `?${qs}` : ''}`);

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'GET',
    headers: getTeamAuthHeaders(),
    cache: 'no-store',
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return {
    data: normalizeArrayPayload<TeamMember>(json.data),
    pagination: json.pagination,
    success: json.success,
  };
}

/** GET /team supports at most this page size (backend cap). */
const TEAM_LIST_MAX_PAGE_SIZE = 100;

/**
 * Maps tenant team members to the legacy `BackendUser` shape used by assignment dropdowns.
 */
export function teamMembersToBackendUsers(members: TeamMember[]): BackendUser[] {
  return members.map((m) => {
    const name = [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.email;
    return {
      id: m.id,
      name,
      email: m.email,
      role: m.role?.roleName || '',
      department: m.department?.name,
      isActive: m.status === 'ACTIVE',
      createdAt: m.createdAt,
    };
  });
}

/**
 * Load every team member for “Assigned to” / owner pickers (follows pagination until complete).
 */
async function getAllTeamMembersPaginated(assignmentDirectory: boolean): Promise<TeamMember[]> {
  const limit = TEAM_LIST_MAX_PAGE_SIZE;
  const all: TeamMember[] = [];
  let page = 1;
  for (;;) {
    const res = await getTeamMembers({ limit, page }, { assignmentDirectory });
    const batch = res.data || [];
    all.push(...batch);
    const total = res.pagination?.total;
    if (batch.length < limit) break;
    if (total != null && all.length >= total) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

export async function getAllTeamMembersForAssign(): Promise<TeamMember[]> {
  return getAllTeamMembersPaginated(true);
}

/** Full tenant team directory (activity log, reports). Falls back to assignable list if needed. */
export async function getAllTeamMembersForDirectory(): Promise<TeamMember[]> {
  try {
    return await getAllTeamMembersPaginated(false);
  } catch {
    return getAllTeamMembersPaginated(true);
  }
}

/**
 * Active team members with the Line Manager role (for standalone job ownership).
 */
export async function getLineManagersForJobPicker(includeUserId?: string): Promise<BackendUser[]> {
  const includeId = String(includeUserId || '').trim();
  const attempts: Array<() => Promise<TeamMember[]>> = [
    () => getAllTeamMembersPaginated(true),
    () => getAllTeamMembersPaginated(false),
    async () => {
      const res = await getTeamMembers({ limit: TEAM_LIST_MAX_PAGE_SIZE, page: 1, roleName: 'Line Manager' });
      return res.data || [];
    },
  ];

  let members: TeamMember[] = [];
  for (const attempt of attempts) {
    try {
      const loaded = await attempt();
      if (loaded.length > 0) {
        members = loaded;
        break;
      }
    } catch {
      // Try next source.
    }
  }

  const active = members.filter((member) => member.status !== 'INACTIVE');
  const pool = active.length > 0 ? active : members;

  let lineManagers = pool.filter(
    (member) => String(member.role?.roleName || '').trim().toLowerCase() === 'line manager',
  );

  if (!lineManagers.length) {
    lineManagers = pool;
  }

  if (includeId) {
    const requestedMember = pool.find((member) => String(member.id) === includeId);
    if (requestedMember && !lineManagers.some((member) => member.id === requestedMember.id)) {
      lineManagers = [requestedMember, ...lineManagers];
    }
  }

  return teamMembersToBackendUsers(lineManagers);
}

/**
 * Department heads (rank 1) across all departments — for the Request "Send to" picker.
 */
export async function getTeamMembersForRequestPicker(): Promise<TeamMember[]> {
  try {
    const json = await teamRequestsFetch<{ data?: TeamMember[] }>('/recipients');
    const members = normalizeArrayPayload<TeamMember>(json.data);
    const active = members.filter((member) => member.status !== 'INACTIVE');
    return active.length > 0 ? active : members;
  } catch {
    return [];
  }
}

/**
 * Get team member by ID
 */
export async function getTeamMemberById(id: string) {
  const path = buildPath(`/team/${id}`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'GET',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data, success: json.success };
}

/**
 * Create a new team member
 */
export async function createTeamMember(payload: CreateMemberPayload) {
  const path = buildPath('/team');

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers: getTeamAuthHeaders(),
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const json = await parseTeamFetchJson(res);
  if (!res.ok || json?.success === false) {
    throwTeamApiError(json, res);
  }

  return { data: json.data, success: Boolean(json.success) };
}

/**
 * Update team member
 */
export async function updateTeamMember(id: string, payload: UpdateMemberPayload) {
  const path = buildPath(`/team/${id}`);

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'PATCH',
    headers: getTeamAuthHeaders(),
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const json = await parseTeamFetchJson(res);

  if (!res.ok || json?.success === false) {
    throwTeamApiError(json, res);
  }

  // If the admin re-assigned a role, immediately refresh the acting user's
  // own permission cache (no-op if a different user was edited; the affected
  // user picks the change up via the UserPermissionsSync heartbeat / focus
  // refresh).
  void refreshLocalUserPermissions();

  return { data: json.data, success: json.success };
}

/**
 * Deactivate team member (soft delete)
 */
export async function deactivateTeamMember(id: string) {
  const path = buildPath(`/team/${id}/deactivate`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json, success: json.success };
}

/**
 * Delete team member (hard delete - removes from database)
 */
export async function deleteTeamMember(id: string) {
  const path = buildPath(`/team/${id}`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'DELETE',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json, success: json.success };
}

/**
 * Activate team member
 */
export async function activateTeamMember(id: string) {
  const path = buildPath(`/team/${id}/activate`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json, success: json.success };
}

/**
 * Generate credentials for a team member
 */
export async function generateCredentials(id: string, payload: GenerateCredentialsPayload) {
  const path = buildPath(`/team/${id}/credentials`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data, success: json.success };
}

/**
 * Reset password for a team member
 */
export async function resetPassword(id: string) {
  const path = buildPath(`/team/${id}/reset-password`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json, success: json.success };
}

/**
 * Super Admin only: set a team member's login password to a chosen value.
 * The existing password cannot be retrieved from the server (stored as a hash).
 */
export async function setTeamMemberPassword(id: string, newPassword: string) {
  const path = buildPath(`/team/${id}/set-password`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ newPassword }),
  });

  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }

  return { data: json.data, success: json.success };
}

/**
 * Resend invite email
 */
export async function resendInvite(id: string) {
  const path = buildPath(`/team/${id}/resend-invite`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json, success: json.success };
}

/**
 * Lock account
 */
export async function lockAccount(id: string) {
  const path = buildPath(`/team/${id}/lock`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json, success: json.success };
}

/**
 * Unlock account
 */
export async function unlockAccount(id: string) {
  const path = buildPath(`/team/${id}/unlock`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json, success: json.success };
}

/**
 * Get login history for a team member
 */
export async function getLoginHistory(id: string) {
  const path = buildPath(`/team/${id}/login-history`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'GET',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data || [], success: json.success };
}

/**
 * Get activity for a team member
 */
export async function getMemberActivity(id: string) {
  const path = buildPath(`/team/${id}/activity`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'GET',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data || [], success: json.success };
}

/**
 * Get all roles
 */
export async function getRoles() {
  if (isOfflineBrowser()) {
    return { data: readCache<Role[]>(TEAM_CACHE_KEYS.roles) || [], success: true };
  }

  // Intentionally route roles through the newer proxy-backed endpoint.
  const path = buildRolesPath('?limit=100&page=1');
  const headers = getTeamAuthHeaders();

  try {
    const res = await fetch(`${API_BASE_NEW}${path}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const json = await res.json();
    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || `Request failed with status ${res.status}`);
    }

    const roles = normalizeArrayPayload<Role>(json.data);
    writeCache(TEAM_CACHE_KEYS.roles, roles);
    return { data: roles, success: json.success };
  } catch (error) {
    const cached = readCache<Role[]>(TEAM_CACHE_KEYS.roles);
    if (cached?.length) {
      return { data: cached, success: true };
    }
    throw error;
  }
}

/**
 * Get all departments
 */
export async function getDepartments() {
  const path = buildPath('/departments');
  const headers = getTeamAuthHeaders();

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: normalizeArrayPayload<Department>(json.data), success: json.success };
}

/**
 * Get department by ID
 */
export async function getDepartmentReportingManagers(
  departmentId: string,
  roleId: string,
  excludeMemberId?: string,
) {
  const params = new URLSearchParams({ roleId });
  if (excludeMemberId) params.set('excludeMemberId', excludeMemberId);
  const path = buildPath(`/departments/${departmentId}/reporting-managers?${params.toString()}`);
  const headers = getTeamAuthHeaders();

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }

  const list = Array.isArray(json.data)
    ? (json.data as TeamMember[])
    : normalizeArrayPayload<TeamMember>(json.data);

  return {
    data: list,
    defaultManagerId: (json.defaultManagerId as string) || '',
    success: json.success,
  };
}

export async function getDepartmentById(id: string) {
  const path = buildPath(`/departments/${id}`);
  const headers = getTeamAuthHeaders();

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data, success: json.success };
}

/**
 * Create a department
 */
export async function createDepartment(payload: {
  name: string;
  description?: string;
  roles?: DepartmentRoleInput[];
  allowsCrossDepartmentRequests?: boolean;
}) {
  const path = buildPath('/departments');
  const headers = getTeamAuthHeaders();

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data, success: json.success };
}

/**
 * Update a department
 */
export async function updateDepartment(
  id: string,
  payload: { name?: string; description?: string; roles?: DepartmentRoleInput[]; allowsCrossDepartmentRequests?: boolean },
) {
  const path = buildPath(`/departments/${id}`);
  const headers = getTeamAuthHeaders();

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data, success: json.success };
}

/**
 * Delete a department
 */
export async function deleteDepartment(id: string) {
  const path = buildPath(`/departments/${id}`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'DELETE',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json, success: json.success };
}

/**
 * Get targets for a team member
 */
export async function getTargets(memberId: string) {
  const path = buildPath(`/team/${memberId}/targets`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'GET',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data || [], success: json.success };
}

/**
 * Save targets for a team member
 */
export async function saveTargets(memberId: string, targets: Array<{ targetType: string; targetValue: number; period: string }>) {
  const path = buildPath(`/team/${memberId}/targets`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ targets }),
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data, success: json.success };
}

/**
 * Get all permissions grouped by module
 */
export async function getAllPermissions() {
  if (isOfflineBrowser()) {
    return { data: buildFallbackPermissionsMap(), success: true };
  }

  const path = buildPath('/permissions');
  const headers = getTeamAuthHeaders();

  try {
    const res = await fetch(`${API_BASE_NEW}${path}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const json = await res.json();
    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || `Request failed with status ${res.status}`);
    }

    const permissions = json.data || buildFallbackPermissionsMap();
    writeCache(TEAM_CACHE_KEYS.permissions, permissions);
    return { data: permissions, success: json.success };
  } catch {
    return { data: readCache<Record<string, Permission[]>>(TEAM_CACHE_KEYS.permissions) || buildFallbackPermissionsMap(), success: true };
  }
}

/**
 * Create a new role
 */
export async function createRole(payload: { roleName: string; description?: string; color: string; permissionIds: string[] }) {
  const path = buildPath('/roles');
  const headers = getTeamAuthHeaders();

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data, success: json.success };
}

/**
 * Update a role
 */
export async function updateRole(id: string, payload: { roleName?: string; description?: string; color?: string; permissionIds?: string[] }) {
  const path = buildPath(`/roles/${id}`);
  const headers = getTeamAuthHeaders();

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }

  // If the acting user shares this role, the change has to reflect in their
  // own session immediately. Refreshing the local permission cache is cheap
  // and a no-op when the role isn't assigned to the current user.
  void refreshLocalUserPermissions();

  return { data: json.data, success: json.success };
}

/**
 * Delete a role
 */
export async function deleteRole(id: string) {
  const path = buildPath(`/roles/${id}`);
  const headers = getTeamAuthHeaders();

  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'DELETE',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json, success: json.success };
}

/**
 * Get role by ID
 */
export async function getRoleById(id: string) {
  const path = buildPath(`/roles/${id}`);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'GET',
    headers,
  });
  
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data, success: json.success };
}

/**
 * Get team stats
 */
export async function getTeamStats() {
  // This would be a separate endpoint, or we can calculate from the list
  // For now, we'll calculate from the list response
  const response = await getTeamMembers({ limit: 1000 });
  const members = response.data?.data || [];
  
  const stats: TeamMemberStats = {
    totalMembers: response.data?.total || 0,
    activeMembers: members.filter((m) => m.status === 'ACTIVE').length,
    roles: 0, // Would need separate endpoint
    departments: 0, // Would need separate endpoint
  };
  
  return stats;
}

export const TEAM_REQUESTS_UPDATED_EVENT = 'hrayntra:team-requests-updated';

function notifyTeamRequestsUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TEAM_REQUESTS_UPDATED_EVENT));
}

async function teamRequestsFetch<T = unknown>(suffix: string, options: RequestInit = {}): Promise<T> {
  const path = buildPath(`/team/requests${suffix}`);
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    ...options,
    headers: {
      ...getTeamAuthHeaders(),
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }

  return json as T;
}

export type TeamRequestUserIdentity = {
  id?: string;
  email?: string;
  name?: string;
};

export function getCurrentUserRequestIdentity(): TeamRequestUserIdentity {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('currentUser');
    if (!raw) return {};
    const user = JSON.parse(raw) as Record<string, unknown>;
    const firstName = String(user.firstName || '').trim();
    const lastName = String(user.lastName || '').trim();
    const name =
      String(user.name || '').trim() ||
      [firstName, lastName].filter(Boolean).join(' ') ||
      String(user.email || '').trim();
    return {
      id: String(user.id || user.userId || '').trim() || undefined,
      email: String(user.email || '').trim().toLowerCase() || undefined,
      name: name || undefined,
    };
  } catch {
    return {};
  }
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeArrayTeamRequests(payload: unknown): TeamRequest[] {
  if (Array.isArray(payload)) return payload as TeamRequest[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as TeamRequest[];
  }
  return [];
}

/**
 * List team requests submitted by users in this workspace.
 */
export async function getTeamRequests(): Promise<{ data: TeamRequest[]; success: boolean }> {
  const json = await teamRequestsFetch<{ data?: TeamRequest[]; success: boolean }>('?box=sent');
  return { data: normalizeArrayTeamRequests(json.data), success: true };
}

/**
 * Submit a new team request.
 */
export async function createTeamRequest(
  payload: CreateTeamRequestPayload,
): Promise<{ data: TeamRequest; success: boolean }> {
  const subject = String(payload.subject || '').trim();
  const description = String(payload.description || '').trim();
  const sendToId = String(payload.sendToId || '').trim();
  const sendToName = String(payload.sendToName || '').trim();
  if (!sendToId) throw new Error('Send to is required');
  if (!sendToName) throw new Error('Send to is required');
  if (!subject) throw new Error('Subject is required');
  if (!description) throw new Error('Description is required');

  const json = await teamRequestsFetch<{ data: TeamRequest; success: boolean }>('', {
    method: 'POST',
    body: JSON.stringify({
      sendToId,
      sendToName,
      sendToEmail: normalizeEmail(payload.sendToEmail) || undefined,
      subject,
      description,
      priority: payload.priority || 'medium',
    }),
  });

  notifyTeamRequestsUpdated();
  return { data: json.data, success: true };
}

/**
 * Outgoing requests created by the signed-in user.
 */
export async function getTeamRequestsForSender(options?: {
  currentUser?: TeamRequestUserIdentity;
  viewAll?: boolean;
}): Promise<{ data: TeamRequest[]; success: boolean }> {
  const params = new URLSearchParams({ box: 'sent' });
  if (options?.viewAll) params.set('all', 'true');

  const json = await teamRequestsFetch<{ data?: TeamRequest[]; success: boolean }>(`?${params.toString()}`);
  const data = normalizeArrayTeamRequests(json.data);

  return {
    data: [...data].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    success: true,
  };
}

/**
 * Requests awaiting action by the signed-in user (sent to them only).
 */
export async function getTeamRequestsForApproval(options?: {
  currentUser?: TeamRequestUserIdentity;
  viewAll?: boolean;
}): Promise<{ data: TeamRequest[]; success: boolean }> {
  const params = new URLSearchParams({ box: 'inbox' });

  const json = await teamRequestsFetch<{ data?: TeamRequest[]; success: boolean }>(`?${params.toString()}`);
  const data = normalizeArrayTeamRequests(json.data);

  return {
    data: [...data].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    success: true,
  };
}

/**
 * Fetch a single team request by id.
 */
export async function getTeamRequest(id: string): Promise<{ data: TeamRequest; success: boolean }> {
  const requestId = String(id || '').trim();
  if (!requestId) throw new Error('Request id is required');

  const json = await teamRequestsFetch<{ data: TeamRequest; success: boolean }>(
    `/${encodeURIComponent(requestId)}`,
  );
  return { data: json.data, success: true };
}

/**
 * Forward an approved team request to a lower-ranked member as a task.
 */
export async function forwardTeamRequestToTask(
  id: string,
  assignToId: string,
  options?: { setSelfAsApprover?: boolean; dueDate?: string },
): Promise<{ data: TeamRequest; success: boolean }> {
  const requestId = String(id || '').trim();
  const assigneeId = String(assignToId || '').trim();
  if (!requestId) throw new Error('Request id is required');
  if (!assigneeId) throw new Error('Assignee is required');

  const json = await teamRequestsFetch<{ data: TeamRequest; success: boolean }>(
    `/${encodeURIComponent(requestId)}/create-task`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        assignToId: assigneeId,
        setSelfAsApprover: options?.setSelfAsApprover === true,
        dueDate: options?.dueDate?.trim() || undefined,
      }),
    },
  );

  notifyTeamRequestsUpdated();
  return { data: json.data, success: true };
}

/**
 * Approve, reject, or cancel a team request.
 */
export async function updateTeamRequestStatus(
  id: string,
  payload: UpdateTeamRequestPayload,
): Promise<{ data: TeamRequest; success: boolean }> {
  const requestId = String(id || '').trim();
  if (!requestId) throw new Error('Request id is required');

  const status = payload.status;
  if (!['approved', 'rejected', 'cancelled'].includes(status)) {
    throw new Error('Invalid request status');
  }

  const json = await teamRequestsFetch<{ data: TeamRequest; success: boolean }>(
    `/${encodeURIComponent(requestId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        reviewNote: String(payload.reviewNote || '').trim() || undefined,
      }),
    },
  );

  notifyTeamRequestsUpdated();
  return { data: json.data, success: true };
}

/**
 * Permanently remove a team request.
 */
export async function deleteTeamRequest(id: string): Promise<{ success: boolean }> {
  const requestId = String(id || '').trim();
  if (!requestId) throw new Error('Request id is required');

  await teamRequestsFetch(`/${encodeURIComponent(requestId)}`, {
    method: 'DELETE',
  });

  notifyTeamRequestsUpdated();
  return { success: true };
}

/**
 * Link an approved team request to a created job (standalone hiring flow).
 */
export async function linkTeamRequestToJob(
  requestId: string,
  jobId: string,
): Promise<{ data: TeamRequest; success: boolean }> {
  const id = String(requestId || '').trim();
  const linkedJobId = String(jobId || '').trim();
  if (!id) throw new Error('Request id is required');
  if (!linkedJobId) throw new Error('Job id is required');

  const json = await teamRequestsFetch<{ data: TeamRequest; success: boolean }>(
    `/${encodeURIComponent(id)}/link-job`,
    {
      method: 'PATCH',
      body: JSON.stringify({ jobId: linkedJobId }),
    },
  );

  notifyTeamRequestsUpdated();
  return { data: json.data, success: true };
}

export const CROSS_DEPT_REQUESTS_UPDATED_EVENT = 'hrayntra:cross-dept-requests-updated';

function notifyCrossDeptRequestsUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CROSS_DEPT_REQUESTS_UPDATED_EVENT));
}

async function crossDeptFetch<T = unknown>(suffix: string, options: RequestInit = {}): Promise<T> {
  const path = buildPath(`/cross-dept-requests${suffix}`);
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    ...options,
    headers: {
      ...getTeamAuthHeaders(),
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }

  return json as T;
}

export type CrossDeptTargetMember = {
  id: string;
  name: string;
  email?: string;
  roleId?: string;
  roleName?: string | null;
  isDepartmentHead?: boolean;
};

export type CrossDeptTargetDepartment = {
  id: string;
  name: string;
  headRoleId?: string | null;
  members: CrossDeptTargetMember[];
};

export type CrossDepartmentWorkRequest = {
  id: string;
  subject: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'accepted' | 'rejected' | 'forwarded' | 'cancelled';
  workType: string;
  sourceDepartmentId: string;
  targetDepartmentId: string;
  requestedById: string;
  requestedByName?: string;
  targetHeadUserId?: string;
  targetUserId?: string;
  assignedToId?: string;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  createdTaskId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function getCrossDeptAssignOptions() {
  const json = await crossDeptFetch<{
    data: {
      canInitiate: boolean;
      canHandoffClient?: boolean;
      departments: CrossDeptTargetDepartment[];
      ownDepartment?: CrossDeptTargetDepartment | null;
    };
  }>(
    '/assign-options',
  );
  return json.data;
}

export async function listCrossDeptRequests(box: 'sent' | 'inbox' = 'sent') {
  const json = await crossDeptFetch<{ data: CrossDepartmentWorkRequest[] }>(`?box=${box}`);
  return json.data;
}

export async function createCrossDeptRequest(payload: {
  subject: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  workType?: string;
  targetDepartmentId: string;
  targetUserId?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  payload?: Record<string, unknown>;
}) {
  const json = await crossDeptFetch<{ data: CrossDepartmentWorkRequest }>('', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  notifyCrossDeptRequestsUpdated();
  return json.data;
}

export async function reviewCrossDeptRequest(
  id: string,
  payload: {
    action: 'accept' | 'reject';
    note?: string;
    assignToId?: string;
    dueDate?: string;
    setSelfAsApprover?: boolean;
  },
) {
  const json = await crossDeptFetch<{ data: CrossDepartmentWorkRequest }>(
    `/${encodeURIComponent(id)}/review`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...payload,
        setSelfAsApprover: payload.setSelfAsApprover === true,
        dueDate: payload.dueDate?.trim() || undefined,
      }),
    },
  );
  notifyCrossDeptRequestsUpdated();
  return json.data;
}

export async function forwardCrossDeptRequest(
  id: string,
  payload: { assignToId: string; note?: string },
) {
  const json = await crossDeptFetch<{ data: CrossDepartmentWorkRequest }>(
    `/${encodeURIComponent(id)}/forward`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  notifyCrossDeptRequestsUpdated();
  return json.data;
}

export const LEAD_CONVERSION_REQUESTS_UPDATED_EVENT = 'hrayntra:lead-conversion-requests-updated';

function notifyLeadConversionRequestsUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT));
}

async function leadConversionFetch<T = unknown>(suffix: string, options: RequestInit = {}): Promise<T> {
  const path = buildPath(`/lead-conversion-requests${suffix}`);
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    ...options,
    headers: {
      ...getTeamAuthHeaders(),
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }

  return json as T;
}

export type LeadConversionRequest = {
  id: string;
  leadId: string;
  leadCompanyName?: string;
  requestedById: string;
  requestedByName?: string;
  approverUserId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  clientPayload?: Record<string, unknown>;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  requestNote?: string;
  createdClientId?: string;
  createdAt: string;
  updatedAt: string;
};

export async function listLeadConversionRequests(box: 'inbox' | 'sent' = 'inbox') {
  const json = await leadConversionFetch<{ data: LeadConversionRequest[] }>(`?box=${box}`);
  return json.data;
}

export async function reviewLeadConversionRequest(
  id: string,
  payload: { action: 'accept' | 'reject'; note?: string },
) {
  const json = await leadConversionFetch<{ data: LeadConversionRequest }>(
    `/${encodeURIComponent(id)}/review`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  notifyLeadConversionRequestsUpdated();
  return json.data;
}
