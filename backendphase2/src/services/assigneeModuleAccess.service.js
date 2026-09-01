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
import { DEFAULT_ROLE_PERMISSION_PRESETS } from '../modules/role/default-permissions.js';
import { userHasAnyPermission } from '../modules/role/permission-aliases.js';
import { excludeHqPlatformUsers, hqPlatformUserEmailNotClause } from '../utils/hqPlatformUser.js';
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
  permissionModules = [],
  roleName = '',
  modules = [],
  requiredPermissions = [],
} = {}) {
  if (isSuperAdminRoleName(roleName)) return true;
  const names = Array.isArray(permissionNames)
    ? permissionNames.map((name) => String(name || '').trim()).filter(Boolean)
    : [];
  if (names.includes('all')) return true;

  const grantedModules = new Set();
  for (const raw of Array.isArray(permissionModules) ? permissionModules : []) {
    const label = String(raw || '').trim();
    if (label) grantedModules.add(label);
    for (const aliased of resolveAssignmentModules(label)) grantedModules.add(aliased);
  }

  const requiredModules = resolveAssignmentModules(modules);
  for (const moduleName of requiredModules) {
    if (grantedModules.has(moduleName)) continue;
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

const ROLE_PERMISSION_SELECT = {
  permission: { select: { permissionName: true, module: true } },
};

function emptyRoleAccess() {
  return { names: [], modules: [] };
}

function pushPermissionAccess(access, permission) {
  const name = String(permission?.permissionName || '').trim();
  const moduleName = String(permission?.module || '').trim();
  if (name) access.names.push(name);
  if (moduleName) access.modules.push(moduleName);
}

export async function loadPermissionNamesByRoleId(roleIds = []) {
  const accessByRole = await loadRoleAccessByRoleId(roleIds);
  const map = new Map();
  for (const [roleId, access] of accessByRole) map.set(roleId, access.names);
  return map;
}

export async function loadRoleAccessByRoleId(roleIds = []) {
  const ids = [...new Set((roleIds || []).map(idStr).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;

  const rows = await prisma.rolePermission.findMany({
    where: { roleId: { in: ids } },
    select: {
      roleId: true,
      ...ROLE_PERMISSION_SELECT,
    },
  });

  for (const row of rows) {
    const roleId = idStr(row.roleId);
    if (!map.has(roleId)) map.set(roleId, emptyRoleAccess());
    pushPermissionAccess(map.get(roleId), row.permission);
  }
  return map;
}

function accessFromNestedRolePermissions(user) {
  const rows =
    user?.systemRole?.rolePermissions ||
    (user?.role && typeof user.role === 'object' ? user.role.rolePermissions : null) ||
    [];
  const access = emptyRoleAccess();
  for (const row of rows) pushPermissionAccess(access, row?.permission);
  return access;
}

function assignmentAccessOf(user, accessByRole) {
  const roleId = idStr(user?.roleId || user?.role?.id);
  const fromRole = (roleId && accessByRole.get(roleId)) || emptyRoleAccess();
  const nested = accessFromNestedRolePermissions(user);
  const names = [...fromRole.names, ...nested.names];
  const modules = [...fromRole.modules, ...nested.modules];
  if (!names.length && !modules.length) {
    const preset = DEFAULT_ROLE_PERMISSION_PRESETS[assignmentRoleNameOf(user)];
    if (Array.isArray(preset) && preset.length) names.push(...preset);
  }
  return { names, modules };
}

/** SystemRole name only — ignore the legacy Prisma Role enum (SUPER_ADMIN/RECRUITER). */
export function assignmentRoleNameOf(user) {
  const fromSystem = String(user?.systemRole?.roleName || '').trim();
  if (fromSystem) return fromSystem;
  if (user?.role && typeof user.role === 'object') {
    return String(user.role.roleName || '').trim();
  }
  return '';
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
  const accessByRole = await loadRoleAccessByRoleId(roleIds);

  return users.filter((user) => {
    const access = assignmentAccessOf(user, accessByRole);
    return userSatisfiesAssignmentAccess({
      permissionNames: access.names,
      permissionModules: access.modules,
      roleName: assignmentRoleNameOf(user),
      modules: requiredModules,
      requiredPermissions: mustHave,
    });
  });
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
      systemRole: {
        select: {
          roleName: true,
          rolePermissions: { select: ROLE_PERMISSION_SELECT },
        },
      },
    },
  });
  if (!user) {
    const err = new Error('Selected team member was not found.');
    err.statusCode = 400;
    throw err;
  }

  const accessByRole = await loadRoleAccessByRoleId([user.roleId].filter(Boolean));
  const access = assignmentAccessOf(user, accessByRole);
  const ok = userSatisfiesAssignmentAccess({
    permissionNames: access.names,
    permissionModules: access.modules,
    roleName: assignmentRoleNameOf(user),
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

/**
 * Keep a company in Select Company only when someone in that company tree
 * (company + sites/departments) is eligible for the assignment module.
 */
export function filterCompanyOptionsByEligibleUnits(
  companies = [],
  eligibleOrgUnitIds = [],
  orgUnits = [],
) {
  const eligibleSet = new Set(
    (eligibleOrgUnitIds || []).map((id) => idStr(id)).filter(Boolean),
  );
  if (!companies?.length || !eligibleSet.size) return [];

  const companyIds = new Set(companies.map((company) => idStr(company?.id)).filter(Boolean));
  const parentById = new Map();
  for (const unit of orgUnits || []) {
    const unitId = idStr(unit?.id);
    if (!unitId) continue;
    parentById.set(unitId, unit?.parentId ? String(unit.parentId) : '');
  }

  const eligibleCompanyIds = new Set();
  for (const unitId of eligibleSet) {
    let current = unitId;
    const seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      if (companyIds.has(current)) {
        eligibleCompanyIds.add(current);
        break;
      }
      current = parentById.get(current) || '';
    }
  }

  return companies.filter((company) => eligibleCompanyIds.has(idStr(company?.id)));
}

export async function filterCompaniesWithEligibleAssignees(companies = [], { modules = [] } = {}) {
  const requiredModules = resolveAssignmentModules(modules);
  if (!requiredModules.length) return companies || [];
  if (!companies?.length) return [];

  const emailExclude = hqPlatformUserEmailNotClause();
  const clauses = [
    { OR: [{ status: 'ACTIVE' }, { status: null }] },
    ...(Object.keys(emailExclude).length ? [emailExclude] : []),
  ];
  const where = clauses.length === 1 ? clauses[0] : { AND: clauses };

  const [orgUnits, users] = await Promise.all([
    prisma.orgUnit.findMany({
      where: { status: 'active' },
      select: { id: true, parentId: true },
    }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        orgUnitId: true,
        roleId: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        systemRole: {
          select: {
            roleName: true,
            rolePermissions: { select: ROLE_PERMISSION_SELECT },
          },
        },
        credential: { select: { loginId: true } },
      },
    }),
  ]);

  const eligible = await filterUsersByAssignmentAccess(excludeHqPlatformUsers(users), {
    modules: requiredModules,
  });
  return filterCompanyOptionsByEligibleUnits(
    companies,
    eligible.map((user) => user.orgUnitId),
    orgUnits,
  );
}
