export type TabKey = 'dashboard' | 'employees' | 'onboarding' | 'tasks' | 'attendance' | 'leave' | 'timeOff' | 'assets' | 'performance' | 'approvals' | 'documents' | 'reports' | 'settings' | 'locations' | 'fieldVisits' | 'userManagement' | 'orgStructure' | 'platformConsole';
export type ActionKey = 'employees_create' | 'employees_delete' | 'employees_edit' | 'tasks_create' | 'tasks_delete' | 'tasks_approve' | 'tasks_submit' | 'leaves_apply' | 'leaves_approve' | 'holidays_manage' | 'attendance_punch_self' | 'attendance_punch_hr' | 'attendance_punch_remote_self' | 'attendance_approve_late' | 'assets_manage' | 'documents_manage' | 'performance_manage' | 'reports_view' | 'settings_edit' | 'users_manage' | 'locations_manage' | 'field_visits_manage' | 'org_manage' | 'platform_manage_tenants';
export type UserPermissions = {
    tabs: Record<TabKey, boolean>;
    actions: Record<ActionKey, boolean>;
};
export declare function buildPermissionsFromPartial(tabOverrides: Partial<Record<TabKey, boolean>>, actionOverrides: Partial<Record<ActionKey, boolean>>): UserPermissions;
export declare function ensurePermissionShape(role: string, raw?: Partial<UserPermissions>): UserPermissions;
export declare const TAB_KEYS: TabKey[];
export declare const ACTION_KEYS: ActionKey[];
export declare const FULL_PERMISSIONS: UserPermissions;
/** Tenant HQ admin — all tenant modules, never platform console. */
export declare const TENANT_ADMIN_PERMISSIONS: UserPermissions;
export declare function defaultPermissionsForRole(role: string): UserPermissions;
export declare function normalizePermissions(role: string, raw?: unknown): UserPermissions;
export declare function hasFullAccess(role: string, permissions: UserPermissions): boolean;
