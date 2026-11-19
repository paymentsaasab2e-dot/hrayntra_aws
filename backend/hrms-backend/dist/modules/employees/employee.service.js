"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const memberProvisioning_1 = require("../../shared/provisioning/memberProvisioning");
const org_scope_service_1 = require("../../shared/org/org-scope.service");
const tenant_scope_1 = require("../../shared/tenant/tenant-scope");
class EmployeeService {
    static async getAll(scope) {
        if (!scope?.tenantId)
            return [];
        return prisma_1.default.employee.findMany({
            where: (0, org_scope_service_1.employeeWhereFromScope)(scope),
            include: {
                user: { select: { email: true, role: true } },
                location: true,
                orgUnit: { select: { id: true, name: true, levelOrder: true, isLeaf: true } },
            },
        });
    }
    static async getById(id, scope) {
        if (!scope?.tenantId)
            return null;
        const employee = await prisma_1.default.employee.findFirst({
            where: { id, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            include: {
                user: { select: { email: true, role: true } },
                location: true,
                orgUnit: { select: { id: true, name: true, levelOrder: true, isLeaf: true } },
            },
        });
        return employee;
    }
    static async create(scope, data) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        if (data.orgUnitId) {
            const ou = await prisma_1.default.orgUnit.findFirst({
                where: { id: data.orgUnitId, tenantId },
            });
            if (!ou)
                throw new Error('Org unit not found in your company');
        }
        const employee = await prisma_1.default.employee.create({
            data: {
                employeeId: data.employeeId,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                designation: data.designation,
                department: data.department,
                joiningDate: new Date(data.joiningDate),
                status: data.status || 'ACTIVE',
                locationId: data.locationId,
                orgUnitId: data.orgUnitId || null,
                reportsToUserId: data.reportsToUserId || null,
                totalLeaves: data.totalLeaves || 12,
                tenantId,
                ...(data.userId && { user: { connect: { id: data.userId } } }),
            },
        });
        await (0, memberProvisioning_1.provisionOnboardingForEmployeeOnly)({
            name: `${employee.firstName} ${employee.lastName}`,
            role: employee.designation,
            department: employee.department,
            email: employee.email,
            employeeId: employee.id,
        });
        return employee;
    }
    static async update(scope, id, data) {
        const existing = await prisma_1.default.employee.findFirst({
            where: { id, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Employee not found');
        if (data.orgUnitId) {
            const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
            const ou = await prisma_1.default.orgUnit.findFirst({
                where: { id: data.orgUnitId, tenantId },
            });
            if (!ou)
                throw new Error('Org unit not found in your company');
        }
        const { tenantId: _ignore, ...safe } = data;
        return prisma_1.default.employee.update({
            where: { id },
            data: {
                ...safe,
                joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
                locationId: data.locationId,
                orgUnitId: data.orgUnitId,
                reportsToUserId: data.reportsToUserId,
                totalLeaves: data.totalLeaves,
            },
        });
    }
    static async delete(scope, id) {
        const employee = await prisma_1.default.employee.findFirst({
            where: { id, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            select: { id: true, userId: true },
        });
        if (!employee) {
            throw new Error('Employee not found');
        }
        await prisma_1.default.$transaction([
            prisma_1.default.attendance.deleteMany({ where: { employeeId: id } }),
            prisma_1.default.leave.deleteMany({ where: { employeeId: id } }),
            prisma_1.default.task.deleteMany({ where: { assignedTo: id } }),
            prisma_1.default.assetAllocation.deleteMany({ where: { employeeId: id } }),
            prisma_1.default.document.deleteMany({ where: { employeeId: id } }),
            prisma_1.default.performanceReview.deleteMany({ where: { employeeId: id } }),
            prisma_1.default.employee.delete({ where: { id } }),
        ]);
        return { success: true };
    }
}
exports.EmployeeService = EmployeeService;
//# sourceMappingURL=employee.service.js.map