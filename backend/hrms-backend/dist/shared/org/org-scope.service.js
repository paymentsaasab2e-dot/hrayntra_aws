"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDescendantOrgUnitIds = getDescendantOrgUnitIds;
exports.resolveOrgScope = resolveOrgScope;
exports.employeeWhereFromScope = employeeWhereFromScope;
exports.orgUnitWhereFromScope = orgUnitWhereFromScope;
const prisma_1 = __importDefault(require("../prisma"));
const HQ_ROLES = new Set(['ADMIN', 'HR']);
async function getDescendantOrgUnitIds(rootOrgUnitId) {
    const root = await prisma_1.default.orgUnit.findUnique({ where: { id: rootOrgUnitId } });
    if (!root)
        return [rootOrgUnitId];
    const all = await prisma_1.default.orgUnit.findMany({
        where: { tenantId: root.tenantId, status: 'ACTIVE' },
        select: { id: true, path: true },
    });
    return all.filter((unit) => unit.id === root.id || unit.path.startsWith(root.path)).map((u) => u.id);
}
async function resolveOrgScope(user) {
    // Platform owner is not attached to a tenant — empty scope (no ops data).
    if (user.role === 'PLATFORM_OWNER' && !user.tenantId) {
        return {
            tenantId: null,
            orgUnitId: null,
            allowedOrgUnitIds: [],
            scopedEmployeeIds: [],
            employeeSelfOnly: false,
            isHqAdmin: false,
        };
    }
    let tenantId = null;
    if (user.tenantId) {
        tenantId = (await prisma_1.default.tenant.findUnique({ where: { id: user.tenantId }, select: { id: true } }))?.id || null;
    }
    else if (user.orgUnitId) {
        const ou = await prisma_1.default.orgUnit.findUnique({
            where: { id: user.orgUnitId },
            select: { tenantId: true },
        });
        tenantId = ou?.tenantId || null;
    }
    // Fail closed: never invent a tenant via findFirst().
    if (!tenantId) {
        return {
            tenantId: null,
            orgUnitId: user.orgUnitId || null,
            allowedOrgUnitIds: [],
            scopedEmployeeIds: [],
            employeeSelfOnly: false,
            isHqAdmin: false,
        };
    }
    const isHqAdmin = HQ_ROLES.has(user.role);
    if (isHqAdmin) {
        return {
            tenantId,
            orgUnitId: user.orgUnitId || null,
            allowedOrgUnitIds: null,
            scopedEmployeeIds: null,
            employeeSelfOnly: false,
            isHqAdmin: true,
        };
    }
    const bindingOrgUnitId = user.orgUnitId || null;
    if (user.role === 'EMPLOYEE') {
        const employeeId = user.employeeId || null;
        return {
            tenantId,
            orgUnitId: bindingOrgUnitId,
            allowedOrgUnitIds: bindingOrgUnitId ? [bindingOrgUnitId] : [],
            scopedEmployeeIds: employeeId ? [employeeId] : [],
            employeeSelfOnly: true,
            isHqAdmin: false,
        };
    }
    // MANAGER / site head: self + subtree within the same tenant
    if (user.role === 'MANAGER' && bindingOrgUnitId) {
        const allowedOrgUnitIds = await getDescendantOrgUnitIds(bindingOrgUnitId);
        const employees = await prisma_1.default.employee.findMany({
            where: {
                orgUnitId: { in: allowedOrgUnitIds },
                OR: [{ tenantId }, { tenantId: null, orgUnit: { tenantId } }],
            },
            select: { id: true },
        });
        return {
            tenantId,
            orgUnitId: bindingOrgUnitId,
            allowedOrgUnitIds,
            scopedEmployeeIds: employees.map((e) => e.id),
            employeeSelfOnly: false,
            isHqAdmin: false,
        };
    }
    return {
        tenantId,
        orgUnitId: bindingOrgUnitId,
        allowedOrgUnitIds: bindingOrgUnitId ? [bindingOrgUnitId] : [],
        scopedEmployeeIds: [],
        employeeSelfOnly: false,
        isHqAdmin: false,
    };
}
/**
 * Employees visible to this caller.
 * HQ (scopedEmployeeIds === null) → all employees in tenant.
 * Manager → subtree employee ids.
 * Employee → self only.
 */
function employeeWhereFromScope(scope) {
    if (!scope.tenantId) {
        return { id: { in: [] } };
    }
    const tenantClause = {
        OR: [
            { tenantId: scope.tenantId },
            { tenantId: null, orgUnit: { tenantId: scope.tenantId } },
            { tenantId: null, user: { tenantId: scope.tenantId } },
        ],
    };
    if (scope.scopedEmployeeIds == null) {
        return tenantClause;
    }
    if (scope.scopedEmployeeIds.length === 0) {
        return { id: { in: [] } };
    }
    return {
        AND: [{ id: { in: scope.scopedEmployeeIds } }, tenantClause],
    };
}
function orgUnitWhereFromScope(scope) {
    if (!scope.tenantId) {
        return { id: { in: [] } };
    }
    if (scope.allowedOrgUnitIds === null) {
        return { tenantId: scope.tenantId };
    }
    if (scope.allowedOrgUnitIds.length === 0) {
        return { id: { in: [] } };
    }
    return { tenantId: scope.tenantId, id: { in: scope.allowedOrgUnitIds } };
}
//# sourceMappingURL=org-scope.service.js.map