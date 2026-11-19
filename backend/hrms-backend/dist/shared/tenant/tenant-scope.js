"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantWhereFromScope = tenantWhereFromScope;
exports.requireTenantId = requireTenantId;
exports.orgUnitTenantWhere = orgUnitTenantWhere;
/** Fail closed: no tenant → empty result set. */
function tenantWhereFromScope(scope) {
    if (!scope?.tenantId)
        return { tenantId: { in: [] } };
    return { tenantId: scope.tenantId };
}
function requireTenantId(scope) {
    if (!scope?.tenantId) {
        throw new Error('Tenant context required. Your account is not bound to a company.');
    }
    return scope.tenantId;
}
/** Combine tenant isolation with org-unit visibility. */
function orgUnitTenantWhere(scope) {
    const tenant = tenantWhereFromScope(scope);
    if (!scope || scope.allowedOrgUnitIds === null) {
        return tenant;
    }
    if (scope.allowedOrgUnitIds.length === 0) {
        return { ...tenant, id: { in: [] } };
    }
    return { ...tenant, id: { in: scope.allowedOrgUnitIds } };
}
//# sourceMappingURL=tenant-scope.js.map