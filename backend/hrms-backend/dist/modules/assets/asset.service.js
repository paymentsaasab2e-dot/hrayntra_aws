"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const org_scope_service_1 = require("../../shared/org/org-scope.service");
const tenant_scope_1 = require("../../shared/tenant/tenant-scope");
class AssetService {
    static async getAll(scope) {
        return prisma_1.default.asset.findMany({
            where: (0, tenant_scope_1.tenantWhereFromScope)(scope),
            include: {
                allocations: {
                    include: {
                        employee: { select: { firstName: true, lastName: true, employeeId: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    static async getById(scope, id) {
        return prisma_1.default.asset.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
            include: { allocations: { include: { employee: true } } },
        });
    }
    static async create(scope, data) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        return prisma_1.default.asset.create({
            data: {
                name: data.name,
                type: data.type,
                serialNumber: data.serialNumber,
                brand: data.brand,
                model: data.model,
                status: data.status || 'Available',
                condition: data.condition || 'New',
                purchasedOn: data.purchasedOn,
                warrantyUntil: data.warrantyUntil,
                notes: data.notes,
                tenantId,
            },
        });
    }
    static async update(scope, id, data) {
        const existing = await prisma_1.default.asset.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Asset not found');
        const { tenantId: _ignore, ...safe } = data;
        return prisma_1.default.asset.update({ where: { id }, data: safe });
    }
    static async delete(scope, id) {
        const existing = await prisma_1.default.asset.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Asset not found');
        return prisma_1.default.asset.delete({ where: { id } });
    }
    static async getAllocations(scope) {
        return prisma_1.default.assetAllocation.findMany({
            where: {
                asset: (0, tenant_scope_1.tenantWhereFromScope)(scope),
                ...(scope.scopedEmployeeIds !== null
                    ? { employeeId: { in: scope.scopedEmployeeIds } }
                    : {}),
            },
            include: {
                asset: true,
                employee: {
                    select: { firstName: true, lastName: true, employeeId: true, department: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    static async assignAsset(scope, data) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        const asset = await prisma_1.default.asset.findFirst({
            where: { id: data.assetId, tenantId },
        });
        if (!asset)
            throw new Error('Asset not found');
        let empId = data.employeeId;
        if (!empId.match(/^[0-9a-fA-F]{24}$/)) {
            const emp = await prisma_1.default.employee.findFirst({
                where: { employeeId: empId, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            });
            if (!emp)
                throw new Error(`Employee ${empId} not found`);
            empId = emp.id;
        }
        else {
            const emp = await prisma_1.default.employee.findFirst({
                where: { id: empId, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            });
            if (!emp)
                throw new Error('Employee not found in your company');
        }
        const allocation = await prisma_1.default.assetAllocation.create({
            data: {
                assetId: data.assetId,
                employeeId: empId,
                issuedOn: data.issuedOn || new Date().toISOString().split('T')[0],
                expectedReturn: data.expectedReturn,
                conditionOnIssue: data.conditionOnIssue || 'Good',
                issuedBy: data.issuedBy || 'SYSTEM',
                notes: data.notes,
                status: 'Active',
            },
        });
        await prisma_1.default.asset.update({ where: { id: data.assetId }, data: { status: 'Assigned' } });
        return allocation;
    }
    static async returnAsset(scope, allocationId, data) {
        const allocation = await prisma_1.default.assetAllocation.findFirst({
            where: {
                id: allocationId,
                asset: (0, tenant_scope_1.tenantWhereFromScope)(scope),
            },
        });
        if (!allocation)
            throw new Error('Allocation not found');
        const updated = await prisma_1.default.assetAllocation.update({
            where: { id: allocationId },
            data: {
                returnedOn: data.returnedOn || new Date().toISOString().split('T')[0],
                conditionOnReturn: data.conditionOnReturn || 'Good',
                notes: data.notes,
                status: 'Returned',
            },
        });
        await prisma_1.default.asset.update({
            where: { id: updated.assetId },
            data: { status: 'Available' },
        });
        return updated;
    }
}
exports.AssetService = AssetService;
//# sourceMappingURL=asset.service.js.map