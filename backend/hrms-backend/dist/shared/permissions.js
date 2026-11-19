"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TENANT_ADMIN_PERMISSIONS = exports.FULL_PERMISSIONS = exports.ACTION_KEYS = exports.TAB_KEYS = void 0;
exports.buildPermissionsFromPartial = buildPermissionsFromPartial;
exports.ensurePermissionShape = ensurePermissionShape;
exports.defaultPermissionsForRole = defaultPermissionsForRole;
exports.normalizePermissions = normalizePermissions;
exports.hasFullAccess = hasFullAccess;
const allTrue = (keys) => Object.fromEntries(keys.map((key) => [key, true]));
const allFalse = (keys) => Object.fromEntries(keys.map((key) => [key, false]));
function buildPermissions(tabOverrides, actionOverrides) {
    return {
        tabs: { ...allFalse(exports.TAB_KEYS), ...tabOverrides },
        actions: { ...allFalse(exports.ACTION_KEYS), ...actionOverrides },
    };
}
function buildPermissionsFromPartial(tabOverrides, actionOverrides) {
    return buildPermissions(tabOverrides, actionOverrides);
}
function ensurePermissionShape(role, raw) {
    const base = defaultPermissionsForRole(role);
    return {
        tabs: { ...allFalse(exports.TAB_KEYS), ...base.tabs, ...(raw?.tabs || {}) },
        actions: { ...allFalse(exports.ACTION_KEYS), ...base.actions, ...(raw?.actions || {}) },
    };
}
exports.TAB_KEYS = [
    'dashboard', 'employees', 'onboarding', 'tasks', 'attendance', 'leave', 'timeOff',
    'assets', 'performance', 'approvals', 'documents', 'reports', 'settings', 'locations', 'fieldVisits', 'userManagement', 'orgStructure', 'platformConsole',
];
exports.ACTION_KEYS = [
    'employees_create', 'employees_delete', 'employees_edit', 'tasks_create', 'tasks_delete',
    'tasks_approve', 'tasks_submit', 'leaves_apply', 'leaves_approve', 'holidays_manage',
    'attendance_punch_self', 'attendance_punch_hr', 'attendance_punch_remote_self', 'attendance_approve_late', 'assets_manage',
    'documents_manage', 'performance_manage', 'reports_view', 'settings_edit', 'users_manage', 'locations_manage', 'field_visits_manage', 'org_manage', 'platform_manage_tenants',
];
exports.FULL_PERMISSIONS = {
    tabs: allTrue(exports.TAB_KEYS),
    actions: allTrue(exports.ACTION_KEYS),
};
/** Tenant HQ admin — all tenant modules, never platform console. */
exports.TENANT_ADMIN_PERMISSIONS = {
    tabs: {
        ...allTrue(exports.TAB_KEYS),
        platformConsole: false,
    },
    actions: {
        ...allTrue(exports.ACTION_KEYS),
        platform_manage_tenants: false,
    },
};
function defaultPermissionsForRole(role) {
    if (role === 'PLATFORM_OWNER') {
        return buildPermissions({ platformConsole: true }, { platform_manage_tenants: true });
    }
    // Tenant HQ (ADMIN / tenant_admin): full company ops, not platform owner tools
    if (role === 'ADMIN')
        return exports.TENANT_ADMIN_PERMISSIONS;
    if (role === 'HR') {
        return buildPermissions({
            dashboard: true, employees: true, onboarding: true, tasks: true, attendance: true,
            leave: true, timeOff: true, assets: true, performance: true, approvals: true, documents: true,
            reports: true, settings: true, locations: true, fieldVisits: true, orgStructure: true,
        }, {
            employees_create: true, employees_delete: true, employees_edit: true,
            tasks_create: true, tasks_delete: true, tasks_approve: true,
            leaves_apply: true, leaves_approve: true, holidays_manage: true,
            attendance_punch_self: true, attendance_punch_hr: true, attendance_punch_remote_self: true, attendance_approve_late: true,
            assets_manage: true, documents_manage: true, performance_manage: true,
            reports_view: true, settings_edit: true, locations_manage: true, field_visits_manage: true, org_manage: true,
        });
    }
    if (role === 'MANAGER') {
        return buildPermissions({
            dashboard: true, employees: true, tasks: true, attendance: true, leave: true,
            approvals: true, documents: true, fieldVisits: true, locations: true, orgStructure: true,
        }, {
            tasks_create: true, tasks_delete: true, tasks_approve: true,
            leaves_apply: true, leaves_approve: true,
            attendance_punch_self: true, attendance_punch_hr: true, attendance_approve_late: true,
            field_visits_manage: true, org_manage: true,
        });
    }
    return buildPermissions({
        dashboard: true, tasks: true, attendance: true, leave: true, documents: true, fieldVisits: true,
    }, {
        tasks_submit: true, leaves_apply: true, attendance_punch_self: true,
    });
}
function normalizePermissions(role, raw) {
    if (!raw || typeof raw !== 'object')
        return ensurePermissionShape(role);
    return ensurePermissionShape(role, raw);
}
function hasFullAccess(role, permissions) {
    return role === 'ADMIN' || permissions.tabs.userManagement === true;
}
//# sourceMappingURL=permissions.js.map