/**
 * Brain RBAC — never expose unauthorized entities/tools.
 */

import { userHasFullDbAccess } from '../../ai/assistantDataTools.js';
import { getEntitySchema } from '../schema/brainSchemaRegistry.service.js';

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['*'],
  MANAGER: [
    'leads_read',
    'leads_write',
    'clients_read',
    'clients_write',
    'jobs_read',
    'jobs_write',
    'candidates_read',
    'candidates_write',
    'interviews_read',
    'interviews_write',
    'placements_read',
    'placements_write',
    'tasks_read',
    'tasks_write',
    'reports_read',
    'export_data',
    'team_read',
    'notifications_read',
    'brain_ask',
    'brain_workflow',
  ],
  RECRUITER: [
    'leads_read',
    'leads_write',
    'clients_read',
    'jobs_read',
    'jobs_write',
    'candidates_read',
    'candidates_write',
    'interviews_read',
    'interviews_write',
    'placements_read',
    'placements_write',
    'tasks_read',
    'tasks_write',
    'reports_read',
    'notifications_read',
    'brain_ask',
  ],
  USER: [
    'leads_read',
    'clients_read',
    'jobs_read',
    'candidates_read',
    'interviews_read',
    'tasks_read',
    'notifications_read',
    'brain_ask',
  ],
};

function normalizeRole(user) {
  return String(user?.systemRole?.roleName || user?.role || 'USER')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

export function resolveUserPermissions(user) {
  if (userHasFullDbAccess(user)) return ['*'];
  const role = normalizeRole(user);
  const fromJwt = Array.isArray(user?.permissions) ? user.permissions.map(String) : [];
  const fromRole = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.USER;
  return [...new Set([...fromRole, ...fromJwt])];
}

export function hasPermission(user, permission) {
  const perms = resolveUserPermissions(user);
  if (perms.includes('*')) return true;
  if (!permission) return true;
  if (perms.includes(permission)) return true;
  // Authenticated CRM readers can always ask the Brain
  if (permission === 'brain_ask') {
    return (
      perms.includes('leads_read') ||
      perms.includes('jobs_read') ||
      perms.includes('candidates_read') ||
      perms.includes('clients_read')
    );
  }
  return false;
}

export function assertPermission(user, permission) {
  if (!hasPermission(user, permission)) {
    const err = new Error(`Forbidden: missing permission "${permission}"`);
    err.code = 'FORBIDDEN';
    throw err;
  }
}

export function canAccessEntity(user, entityId, mode = 'read') {
  const schema = getEntitySchema(entityId);
  if (!schema) return false;
  const needed = schema.permissions.find((p) =>
    mode === 'write' ? p.endsWith('_write') || p === 'export_data' : p.endsWith('_read') || p === 'export_data',
  );
  if (!needed) return hasPermission(user, 'brain_ask');
  return hasPermission(user, needed) || hasPermission(user, '*');
}

export function filterEntitiesForUser(user, entityIds) {
  return (entityIds || []).filter((id) => canAccessEntity(user, id, 'read'));
}

export function canExecuteWorkflow(user) {
  return hasPermission(user, 'brain_workflow') || hasPermission(user, '*') || userHasFullDbAccess(user);
}

export const brainPermissions = {
  resolveUserPermissions,
  hasPermission,
  assertPermission,
  canAccessEntity,
  filterEntitiesForUser,
  canExecuteWorkflow,
};
