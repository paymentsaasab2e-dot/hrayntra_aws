import { apiFetch } from '../api';
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
  LoginHistory,
  UserActivity,
  TeamMemberStats,
} from '../../types/team';

// Note: New API routes are at /api/team, not /api/v1/team
// We'll use a custom base or adjust the path
// Remove /api/v1 if present, as new routes are at /api/team, /api/roles, etc.
const getApiBase = () => {
  const isLocalBrowser =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local'));

  if (isLocalBrowser) {
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:5001';
    return base.replace(/\/api\/v1$/, '');
  }

  // Production/non-local browsers must use same-origin proxy to avoid mixed-content.
  return '/api/proxy';
};
const API_BASE_NEW = getApiBase();

/**
 * Get all team members with filters
 */
export async function getTeamMembers(filters: TeamMemberFilters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  const path = `/api/team${qs ? `?${qs}` : ''}`;
  
  // Use direct fetch for new API routes
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
 * Get team member by ID
 */
export async function getTeamMemberById(id: string) {
  const path = `/api/team/${id}`;
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
  const path = '/api/team';
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
 * Update team member
 */
export async function updateTeamMember(id: string, payload: UpdateMemberPayload) {
  const path = `/api/team/${id}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  console.log('📤 Updating team member API call:', { id, path, payload });
  
  const res = await fetch(`${API_BASE_NEW}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  
  const json = await res.json();
  console.log('📥 Update team member response:', { status: res.status, json });
  
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  
  return { data: json.data, success: json.success };
}

/**
 * Deactivate team member (soft delete)
 */
export async function deactivateTeamMember(id: string) {
  const path = `/api/team/${id}/deactivate`;
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
  const path = `/api/team/${id}`;
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
  const path = `/api/team/${id}/activate`;
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
  const path = `/api/team/${id}/credentials`;
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
  const path = `/api/team/${id}/reset-password`;
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
 * Resend invite email
 */
export async function resendInvite(id: string) {
  const path = `/api/team/${id}/resend-invite`;
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
  const path = `/api/team/${id}/lock`;
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
  const path = `/api/team/${id}/unlock`;
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
  const path = `/api/team/${id}/login-history`;
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
  const path = `/api/team/${id}/activity`;
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
  const path = '/api/roles';
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
 * Get all departments
 */
export async function getDepartments() {
  const path = '/api/departments';
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
 * Get department by ID
 */
export async function getDepartmentById(id: string) {
  const path = `/api/departments/${id}`;
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
 * Create a department
 */
export async function createDepartment(payload: { name: string; description?: string }) {
  const path = '/api/departments';
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
 * Update a department
 */
export async function updateDepartment(id: string, payload: { name?: string; description?: string }) {
  const path = `/api/departments/${id}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
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
  const path = `/api/departments/${id}`;
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
  const path = `/api/team/${memberId}/targets`;
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
  const path = `/api/team/${memberId}/targets`;
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
  const path = '/api/permissions';
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
  
  return { data: json.data || {}, success: json.success };
}

/**
 * Create a new role
 */
export async function createRole(payload: { roleName: string; description?: string; color: string; permissionIds: string[] }) {
  const path = '/api/roles';
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
 * Update a role
 */
export async function updateRole(id: string, payload: { roleName?: string; description?: string; color?: string; permissionIds?: string[] }) {
  const path = `/api/roles/${id}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
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
 * Delete a role
 */
export async function deleteRole(id: string) {
  const path = `/api/roles/${id}`;
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
 * Get role by ID
 */
export async function getRoleById(id: string) {
  const path = `/api/roles/${id}`;
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
