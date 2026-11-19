"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const org_scope_service_1 = require("../../shared/org/org-scope.service");
const tenant_scope_1 = require("../../shared/tenant/tenant-scope");
class ProjectService {
    static async resolveEmployeeId(scope, employeeId) {
        if (!employeeId)
            return null;
        if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
            const emp = await prisma_1.default.employee.findFirst({
                where: { id: employeeId, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
                select: { id: true },
            });
            if (!emp)
                throw new Error('Employee not found in your company');
            return emp.id;
        }
        const employee = await prisma_1.default.employee.findFirst({
            where: { employeeId, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            select: { id: true },
        });
        if (!employee) {
            throw new Error(`Employee with ID ${employeeId} not found`);
        }
        return employee.id;
    }
    static async getAll(scope) {
        return prisma_1.default.project.findMany({
            where: (0, tenant_scope_1.tenantWhereFromScope)(scope),
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { tasks: true } },
            },
        });
    }
    static async getById(scope, id) {
        return prisma_1.default.project.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
            include: {
                tasks: {
                    include: { employee: true },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
    }
    static async create(scope, data) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        const projectHeadId = await this.resolveEmployeeId(scope, data.projectHeadId);
        return prisma_1.default.project.create({
            data: {
                name: String(data.name).trim(),
                description: data.description || null,
                projectHeadId,
                status: data.status || 'ACTIVE',
                tenantId,
            },
        });
    }
    static async update(scope, id, data) {
        const existing = await prisma_1.default.project.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Project not found');
        const projectHeadId = data.projectHeadId === undefined
            ? undefined
            : await this.resolveEmployeeId(scope, data.projectHeadId);
        return prisma_1.default.project.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.status !== undefined ? { status: data.status } : {}),
                ...(projectHeadId !== undefined ? { projectHeadId } : {}),
            },
        });
    }
    static async delete(scope, id) {
        const existing = await prisma_1.default.project.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Project not found');
        await prisma_1.default.task.updateMany({
            where: { projectId: id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
            data: { projectId: null },
        });
        return prisma_1.default.project.delete({ where: { id } });
    }
}
exports.ProjectService = ProjectService;
//# sourceMappingURL=project.service.js.map