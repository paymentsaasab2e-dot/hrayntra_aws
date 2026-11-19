import {
  ACTION_KEYS,
  TAB_KEYS,
  UserPermissions,
  defaultPermissionsForRole,
} from './permissions';

function buildPkgPermissions(
  tabs: Partial<Record<string, boolean>>,
  actions: Partial<Record<string, boolean>>
): UserPermissions {
  const tabMap = Object.fromEntries(TAB_KEYS.map((k) => [k, Boolean(tabs[k])])) as UserPermissions['tabs'];
  const actionMap = Object.fromEntries(ACTION_KEYS.map((k) => [k, Boolean(actions[k])])) as UserPermissions['actions'];
  return { tabs: tabMap, actions: actionMap };
}

export type TenantPackageKey = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export type TenantPackageDefinition = {
  key: TenantPackageKey;
  label: string;
  description: string;
  maxUsers: number;
  permissions: UserPermissions;
};

function pkg(
  key: TenantPackageKey,
  label: string,
  description: string,
  maxUsers: number,
  tabs: Partial<Record<string, boolean>>,
  actions: Partial<Record<string, boolean>>
): TenantPackageDefinition {
  return { key, label, description, maxUsers, permissions: buildPkgPermissions(tabs, actions) };
}

export const TENANT_PACKAGES: TenantPackageDefinition[] = [
  pkg(
    'STARTER',
    'Starter',
    'Core HR: employees, attendance, leave, tasks',
    25,
    {
      dashboard: true,
      employees: true,
      attendance: true,
      leave: true,
      tasks: true,
      documents: true,
    },
    {
      employees_create: true,
      employees_edit: true,
      tasks_submit: true,
      leaves_apply: true,
      attendance_punch_self: true,
      documents_manage: true,
    }
  ),
  pkg(
    'PROFESSIONAL',
    'Professional',
    'Starter + org structure, approvals, performance, locations, reports',
    100,
    {
      dashboard: true,
      employees: true,
      onboarding: true,
      tasks: true,
      attendance: true,
      leave: true,
      timeOff: true,
      performance: true,
      approvals: true,
      documents: true,
      reports: true,
      locations: true,
      orgStructure: true,
      userManagement: true,
    },
    {
      employees_create: true,
      employees_edit: true,
      employees_delete: true,
      tasks_create: true,
      tasks_delete: true,
      tasks_approve: true,
      tasks_submit: true,
      leaves_apply: true,
      leaves_approve: true,
      holidays_manage: true,
      attendance_punch_self: true,
      attendance_punch_hr: true,
      attendance_punch_remote_self: true,
      attendance_approve_late: true,
      performance_manage: true,
      reports_view: true,
      locations_manage: true,
      org_manage: true,
      users_manage: true,
      documents_manage: true,
    }
  ),
  pkg(
    'ENTERPRISE',
    'Enterprise',
    'Full tenant feature set including assets and settings',
    9999,
    Object.fromEntries(TAB_KEYS.filter((t) => t !== 'platformConsole').map((t) => [t, true])),
    Object.fromEntries(ACTION_KEYS.filter((a) => a !== 'platform_manage_tenants').map((a) => [a, true]))
  ),
];

export function getTenantPackage(key?: string | null): TenantPackageDefinition {
  const found = TENANT_PACKAGES.find((p) => p.key === key);
  return found || TENANT_PACKAGES[0];
}

export function applyTenantPackageCeiling(
  userPermissions: UserPermissions,
  packagePermissions: UserPermissions
): UserPermissions {
  const tabs = Object.fromEntries(
    TAB_KEYS.map((k) => [k, Boolean(userPermissions.tabs[k] && packagePermissions.tabs[k])])
  ) as UserPermissions['tabs'];
  const actions = Object.fromEntries(
    ACTION_KEYS.map((k) => [k, Boolean(userPermissions.actions[k] && packagePermissions.actions[k])])
  ) as UserPermissions['actions'];
  return { tabs, actions };
}

/** Effective permissions for a tenant user: role capabilities capped by tenant package. */
export function resolveTenantUserPermissions(
  role: string,
  packagePermissions: UserPermissions
): UserPermissions {
  // Tenant HQ gets every module the platform owner enabled for this client (not Platform Console).
  return applyTenantPackageCeiling(defaultPermissionsForRole(role), packagePermissions);
}
