export type TabKey =
  | 'dashboard'
  | 'employees'
  | 'onboarding'
  | 'tasks'
  | 'attendance'
  | 'leave'
  | 'timeOff'
  | 'assets'
  | 'performance'
  | 'approvals'
  | 'documents'
  | 'reports'
  | 'settings'
  | 'locations'
  | 'fieldVisits'
  | 'userManagement'
  | 'orgStructure'
  | 'platformConsole'

export type ActionKey =
  | 'employees_create'
  | 'employees_delete'
  | 'employees_edit'
  | 'tasks_create'
  | 'tasks_delete'
  | 'tasks_approve'
  | 'tasks_submit'
  | 'leaves_apply'
  | 'leaves_approve'
  | 'holidays_manage'
  | 'attendance_punch_self'
  | 'attendance_punch_hr'
  | 'attendance_punch_remote_self'
  | 'attendance_approve_late'
  | 'assets_manage'
  | 'documents_manage'
  | 'performance_manage'
  | 'reports_view'
  | 'settings_edit'
  | 'users_manage'
  | 'locations_manage'
  | 'field_visits_manage'
  | 'org_manage'
  | 'platform_manage_tenants'

export type UserPermissions = {
  tabs: Record<TabKey, boolean>
  actions: Record<ActionKey, boolean>
}

const allTrue = <T extends string>(keys: readonly T[]) =>
  Object.fromEntries(keys.map((key) => [key, true])) as Record<T, boolean>

const allFalse = <T extends string>(keys: readonly T[]) =>
  Object.fromEntries(keys.map((key) => [key, false])) as Record<T, boolean>

function buildPermissions(
  tabOverrides: Partial<Record<TabKey, boolean>>,
  actionOverrides: Partial<Record<ActionKey, boolean>>
): UserPermissions {
  return {
    tabs: { ...allFalse(TAB_KEYS), ...tabOverrides },
    actions: { ...allFalse(ACTION_KEYS), ...actionOverrides },
  }
}

export function buildPermissionsFromPartial(
  tabOverrides: Partial<Record<TabKey, boolean>>,
  actionOverrides: Partial<Record<ActionKey, boolean>>
): UserPermissions {
  return buildPermissions(tabOverrides, actionOverrides);
}

export function ensurePermissionShape(
  role: string,
  raw?: Partial<UserPermissions>
): UserPermissions {
  const base = defaultPermissionsForRole(role)
  return {
    tabs: { ...allFalse(TAB_KEYS), ...base.tabs, ...(raw?.tabs || {}) },
    actions: { ...allFalse(ACTION_KEYS), ...base.actions, ...(raw?.actions || {}) },
  }
}

export const TAB_KEYS: TabKey[] = [
  'dashboard', 'employees', 'onboarding', 'tasks', 'attendance', 'leave', 'timeOff',
  'assets', 'performance', 'approvals', 'documents', 'reports', 'settings', 'locations', 'fieldVisits', 'userManagement', 'orgStructure', 'platformConsole',
]

export const ACTION_KEYS: ActionKey[] = [
  'employees_create', 'employees_delete', 'employees_edit', 'tasks_create', 'tasks_delete',
  'tasks_approve', 'tasks_submit', 'leaves_apply', 'leaves_approve', 'holidays_manage',
  'attendance_punch_self', 'attendance_punch_hr', 'attendance_punch_remote_self', 'attendance_approve_late', 'assets_manage',
  'documents_manage', 'performance_manage', 'reports_view', 'settings_edit', 'users_manage', 'locations_manage', 'field_visits_manage', 'org_manage', 'platform_manage_tenants',
]

export const FULL_PERMISSIONS: UserPermissions = {
  tabs: allTrue(TAB_KEYS),
  actions: allTrue(ACTION_KEYS),
}

/** Tenant HQ admin — all tenant modules, never platform console. */
export const TENANT_ADMIN_PERMISSIONS: UserPermissions = {
  tabs: {
    ...allTrue(TAB_KEYS),
    platformConsole: false,
  },
  actions: {
    ...allTrue(ACTION_KEYS),
    platform_manage_tenants: false,
  },
}

export function defaultPermissionsForRole(role: string): UserPermissions {
  if (role === 'PLATFORM_OWNER') {
    return buildPermissions(
      { platformConsole: true },
      { platform_manage_tenants: true }
    );
  }

  // Tenant HQ (ADMIN / tenant_admin): full company ops, not platform owner tools
  if (role === 'ADMIN') return TENANT_ADMIN_PERMISSIONS

  if (role === 'HR') {
    return buildPermissions(
      {
        dashboard: true, employees: true, onboarding: true, tasks: true, attendance: true,
        leave: true, timeOff: true, assets: true, performance: true, approvals: true, documents: true,
        reports: true, settings: true, locations: true, fieldVisits: true, orgStructure: true,
      },
      {
        employees_create: true, employees_delete: true, employees_edit: true,
        tasks_create: true, tasks_delete: true, tasks_approve: true,
        leaves_apply: true, leaves_approve: true, holidays_manage: true,
        attendance_punch_self: true, attendance_punch_hr: true, attendance_punch_remote_self: true, attendance_approve_late: true,
        assets_manage: true, documents_manage: true, performance_manage: true,
        reports_view: true, settings_edit: true, locations_manage: true, field_visits_manage: true, org_manage: true,
      }
    )
  }

  if (role === 'MANAGER') {
    return buildPermissions(
      {
        dashboard: true, employees: true, tasks: true, attendance: true, leave: true,
        approvals: true, documents: true, fieldVisits: true, locations: true, orgStructure: true,
      },
      {
        tasks_create: true, tasks_delete: true, tasks_approve: true,
        leaves_apply: true, leaves_approve: true,
        attendance_punch_self: true, attendance_punch_hr: true, attendance_approve_late: true,
        field_visits_manage: true, org_manage: true,
      }
    )
  }

  return buildPermissions(
    {
      dashboard: true, tasks: true, attendance: true, leave: true, documents: true, fieldVisits: true,
    },
    {
      tasks_submit: true, leaves_apply: true, attendance_punch_self: true,
    }
  )
}

export function normalizePermissions(role: string, raw?: unknown): UserPermissions {
  if (!raw || typeof raw !== 'object') return ensurePermissionShape(role)
  return ensurePermissionShape(role, raw as Partial<UserPermissions>)
}

export function hasFullAccess(role: string, permissions: UserPermissions) {
  return role === 'ADMIN' || permissions.tabs.userManagement === true
}
