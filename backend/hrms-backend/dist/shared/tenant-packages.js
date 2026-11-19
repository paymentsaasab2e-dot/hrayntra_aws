"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TENANT_PACKAGES = void 0;
exports.getTenantPackage = getTenantPackage;
exports.applyTenantPackageCeiling = applyTenantPackageCeiling;
exports.resolveTenantUserPermissions = resolveTenantUserPermissions;
const permissions_1 = require("./permissions");
function buildPkgPermissions(tabs, actions) {
    const tabMap = Object.fromEntries(permissions_1.TAB_KEYS.map((k) => [k, Boolean(tabs[k])]));
    const actionMap = Object.fromEntries(permissions_1.ACTION_KEYS.map((k) => [k, Boolean(actions[k])]));
    return { tabs: tabMap, actions: actionMap };
}
function pkg(key, label, description, maxUsers, tabs, actions) {
    return { key, label, description, maxUsers, permissions: buildPkgPermissions(tabs, actions) };
}
exports.TENANT_PACKAGES = [
    pkg('STARTER', 'Starter', 'Core HR: employees, attendance, leave, tasks', 25, {
        dashboard: true,
        employees: true,
        attendance: true,
        leave: true,
        tasks: true,
        documents: true,
    }, {
        employees_create: true,
        employees_edit: true,
        tasks_submit: true,
        leaves_apply: true,
        attendance_punch_self: true,
        documents_manage: true,
    }),
    pkg('PROFESSIONAL', 'Professional', 'Starter + org structure, approvals, performance, locations, reports', 100, {
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
    }, {
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
    }),
    pkg('ENTERPRISE', 'Enterprise', 'Full tenant feature set including assets and settings', 9999, Object.fromEntries(permissions_1.TAB_KEYS.filter((t) => t !== 'platformConsole').map((t) => [t, true])), Object.fromEntries(permissions_1.ACTION_KEYS.filter((a) => a !== 'platform_manage_tenants').map((a) => [a, true]))),
];
function getTenantPackage(key) {
    const found = exports.TENANT_PACKAGES.find((p) => p.key === key);
    return found || exports.TENANT_PACKAGES[0];
}
function applyTenantPackageCeiling(userPermissions, packagePermissions) {
    const tabs = Object.fromEntries(permissions_1.TAB_KEYS.map((k) => [k, Boolean(userPermissions.tabs[k] && packagePermissions.tabs[k])]));
    const actions = Object.fromEntries(permissions_1.ACTION_KEYS.map((k) => [k, Boolean(userPermissions.actions[k] && packagePermissions.actions[k])]));
    return { tabs, actions };
}
/** Effective permissions for a tenant user: role capabilities capped by tenant package. */
function resolveTenantUserPermissions(role, packagePermissions) {
    // Tenant HQ gets every module the platform owner enabled for this client (not Platform Console).
    return applyTenantPackageCeiling((0, permissions_1.defaultPermissionsForRole)(role), packagePermissions);
}
//# sourceMappingURL=tenant-packages.js.map