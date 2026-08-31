/**
 * Assignment eligibility by module / permission.
 *
 * Reuses:
 * - DASHBOARD_MODULE_PERMISSIONS (same catalog as the UI module map)
 * - userHasAnyPermission / aliases from permission-aliases.js
 * - Super Admin role detection (existing unrestricted access)
 *
 * A user may receive a Lead/Job/… only if they have that module (any of its
 * permissions) and, when provided, every extra required permission.
 */
import { prisma } from '../config/prisma.js';
import { DASHBOARD_MODULE_PERMISSIONS } from '../modules/dashboard/dashboardModuleAccess.js';
import { userHasAnyPermission } from '../modules/role/permission-aliases.js';
import { isSuperAdminUserId } from './taskAssignmentScope.service.js';

const idStr = (id) => String(id || '').trim();

/** Canonical module → permissions that grant that module (aligned with MODULE_ACCESS_MAP). */
export const ASSIGNMENT_MODULE_PERMISSIONS = {
  Leads: [...(DASHBOARD_MODULE_PERMISSIONS.Leads || []), 'convert_lead'],
  Clients: [...(DASHBOARD_MODULE_PERMISSIONS.Clients || [])],
  Jobs: [...(DASHBOARD_MODULE_PERMISSIONS.Jobs || []), 'publish_job'],
  Candidates: [...(DASHBOARD_MODULE_PERMISSIONS.Candidates || [])],
  Interviews: [...(DASHBOARD_MODULE_PERMISSIONS.Interviews || []), 'interviews_feedback'],
  Placements: [...(DASHBOARD_MODULE_PERMISSIONS.Placements || [])],
  Tasks: [...(DASHBOARD_MODULE_PERMISSIONS['Task and activity'] || [])],
  Request: [...(DASHBOARD_MODULE_PERMISSIONS.Request || []), 'approve_requests'],
  Contacts: ['contacts_create', 'contacts_read', 'contacts_update', 'contacts_delete'],
  Calendar: ['calendar_read', 'calendar_manage'],
};

const MODULE_ALIASES = {
  leads: 'Leads',
  lead: 'Leads',
  crm: 'Leads',
  clients: 'Clients',
  client: 'Clients',
  jobs: 'Jobs',
  job: 'Jobs',
  candidates: 'Candidates',
  candidate: 'Candidates',
  interviews: 'Interviews',
  interview: 'Interviews',
  placements: 'Placements',
  placement: 'Placements',
  tasks: 'Tasks',
  task: 'Tasks',
  request: 'Request',
  requests: 'Request',
  contacts: 'Contacts',
  calendar: 'Calendar',
};

export function isSuperAdminRoleName(roleName) {
  const normalized = String(roleName || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  return normalized === 'SUPER_ADMIN' || normalized.replace(/_/g, '') === 'SUPERADMIN';
}

export function resolveAssignmentModules(raw) {
  const values = Array.isArray(raw) ? raw : raw != null && raw !== '' ? [raw] : [];
  const modules = [];
  for (const value of values) {
    const key = String(value || '').trim();
    if (!key) continue;
    if (ASSIGNMENT_MODULE_PERMISSIONS[key]) {
      modules.push(key);
      continue;
    }
    const aliased = MODULE_ALIASES[key.toLowerCase()];
    if (aliased) modules.push(aliased);
  }
  return [...new Set(modules)];
}

export function resolveAssignmentModulesFromReq(req, fallback = []) {
  return resolveAssignmentModules(req?.query?.module || req?.query?.modules || fallback);
}

/**
 * Pure eligibility check — used by list filters, write asserts, and tests.
 * Super Admin / permission `all` matches existing unrestricted access.
 */
export function userSatisfiesAssignmentAccess({
  permissionNames = [],
  roleName = '',
  modules = [],
  requiredPermissions = [],
} = {}) {
  if (isSuperAdminRoleName(roleName)) return true;
  const names = Array.isArray(permissionNames)
    ? permissionNames.map((name) => String(name || '').trim()).filter(Boolean)
    : [];
  if (names.includes('all')) return true;

  const requiredModules = resolveAssignmentModules(modules);
  for (const moduleName of requiredModules) {
    const modulePerms = ASSIGNMENT_MODULE_PERMISSIONS[moduleName] || [];
    if (!modulePerms.length) continue;
    if (!userHasAnyPermission(names, modulePerms)) return false;
  }

  const mustHave = Array.isArray(requiredPermissions)
    ? requiredPermissions.map((name) => String(name || '').trim()).filter(Boolean)
    : [];
  for (const permissionName of mustHave) {
    if (!userHasAnyPermission(names, [permissionName])) return false;
  }

  return true;
}

export async function loadPermissionNamesByRoleId(roleIds = []) {
  const ids = [...new Set((roleIds || []).map(idStr).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;

  const rows = await prisma.rolePermission.findMany({
    where: { roleId: { in: ids } },
    select: {
      roleId: true,
      permission: { select: { permissionName: true } },
    },
  });

  for (const row of rows) {
    const roleId = idStr(row.roleId);
    if (!map.has(roleId)) map.set(roleId, []);
    const name = String(row.permission?.permissionName || '').trim();
    if (name) map.get(roleId).push(name);
  }
  return map;
}

function roleNameOf(user) {
  return (
    user?.systemRole?.roleName ||
    user?.role?.roleName ||
    (typeof user?.role === 'string' ? user.role : '') ||
    ''
  );
}

export async function filterUsersByAssignmentAccess(
  users = [],
  { modules = [], requiredPermissions = [] } = {},
) {
  const requiredModules = resolveAssignmentModules(modules);
  const mustHave = Array.isArray(requiredPermissions)
    ? requiredPermissions.map((name) => String(name || '').trim()).filter(Boolean)
    : [];
  if (!requiredModules.length && !mustHave.length) return users;

  const roleIds = users.map((user) => user.roleId || user.role?.id).filter(Boolean);
  const permsByRole = await loadPermissionNamesByRoleId(roleIds);

  return users.filter((user) =>
    userSatisfiesAssignmentAccess({
      permissionNames: permsByRole.get(idStr(user.roleId || user.role?.id)) || [],
      roleName: roleNameOf(user),
      modules: requiredModules,
      requiredPermissions: mustHave,
    }),
  );
}

export async function assertUserHasAssignmentAccess(
  userId,
  { modules = [], requiredPermissions = [] } = {},
) {
  const id = idStr(userId);
  if (!id) return;

  const requiredModules = resolveAssignmentModules(modules);
  const mustHave = Array.isArray(requiredPermissions)
    ? requiredPermissions.map((name) => String(name || '').trim()).filter(Boolean)
    : [];
  if (!requiredModules.length && !mustHave.length) return;

  if (await isSuperAdminUserId(id)) return;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      roleId: true,
      role: true,
      systemRole: { select: { roleName: true } },
    },
  });
  if (!user) {
    const err = new Error('Selected team member was not found.');
    err.statusCode = 400;
    throw err;
  }

  const permsByRole = await loadPermissionNamesByRoleId([user.roleId].filter(Boolean));
  const ok = userSatisfiesAssignmentAccess({
    permissionNames: permsByRole.get(idStr(user.roleId)) || [],
    roleName: user.systemRole?.roleName || user.role || '',
    modules: requiredModules,
    requiredPermissions: mustHave,
  });

  if (!ok) {
    const err = new Error(
      'This team member does not have the required module or permission to receive this assignment.',
    );
    err.statusCode = 403;
    throw err;
  }
}
