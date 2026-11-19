"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const org_scope_service_1 = require("../../shared/org/org-scope.service");
const tenant_scope_1 = require("../../shared/tenant/tenant-scope");
class DocumentService {
    static async getAll(scope, filters = {}) {
        const where = { ...(0, tenant_scope_1.tenantWhereFromScope)(scope) };
        if (filters.category)
            where.category = filters.category;
        if (filters.status)
            where.status = filters.status;
        if (filters.employeeId) {
            let empId = filters.employeeId;
            if (!String(empId).match(/^[0-9a-fA-F]{24}$/)) {
                const emp = await prisma_1.default.employee.findFirst({
                    where: { employeeId: empId, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
                });
                if (emp)
                    empId = emp.id;
                else
                    return [];
            }
            else if (scope.scopedEmployeeIds !== null && !scope.scopedEmployeeIds.includes(empId)) {
                return [];
            }
            where.employeeId = empId;
        }
        else if (scope.scopedEmployeeIds !== null) {
            if (scope.scopedEmployeeIds.length === 0)
                return [];
            where.OR = [
                { employeeId: { in: scope.scopedEmployeeIds } },
                { employeeId: null },
            ];
        }
        return prisma_1.default.document.findMany({
            where,
            include: {
                employee: {
                    select: { firstName: true, lastName: true, employeeId: true, department: true },
                },
            },
            orderBy: { uploadedAt: 'desc' },
        });
    }
    static async getById(scope, id) {
        return prisma_1.default.document.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
            include: { employee: true },
        });
    }
    static async create(scope, data) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        let empId = data.employeeId || null;
        if (empId && !String(empId).match(/^[0-9a-fA-F]{24}$/)) {
            const emp = await prisma_1.default.employee.findFirst({
                where: { employeeId: empId, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            });
            if (!emp)
                throw new Error('Employee not found in your company');
            empId = emp.id;
        }
        else if (empId) {
            const emp = await prisma_1.default.employee.findFirst({
                where: { id: empId, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            });
            if (!emp)
                throw new Error('Employee not found in your company');
        }
        return prisma_1.default.document.create({
            data: {
                name: data.name,
                type: data.type,
                category: data.category || 'Employee',
                employeeId: empId,
                uploadedBy: data.uploadedBy || 'SYSTEM',
                size: data.size || '0 KB',
                url: data.url || `/documents/${Date.now()}`,
                status: 'Active',
                tags: data.tags || [],
                tenantId,
            },
        });
    }
    static async update(scope, id, data) {
        const existing = await prisma_1.default.document.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Document not found');
        const { tenantId: _ignore, ...safe } = data;
        return prisma_1.default.document.update({ where: { id }, data: safe });
    }
    static async archive(scope, id) {
        const existing = await prisma_1.default.document.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Document not found');
        return prisma_1.default.document.update({
            where: { id },
            data: { status: 'Archived' },
        });
    }
    static async delete(scope, id) {
        const existing = await prisma_1.default.document.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Document not found');
        return prisma_1.default.document.delete({ where: { id } });
    }
}
exports.DocumentService = DocumentService;
//# sourceMappingURL=document.service.js.map