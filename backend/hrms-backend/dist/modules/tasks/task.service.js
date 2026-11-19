"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const org_scope_service_1 = require("../../shared/org/org-scope.service");
const tenant_scope_1 = require("../../shared/tenant/tenant-scope");
const TASK_INCLUDE = {
    employee: true,
    project: true,
};
function normalizePriority(priority) {
    const value = String(priority || 'MEDIUM').toUpperCase().replace(/-/g, '_');
    if (['LOW', 'LESS_URGENT', 'MEDIUM', 'HIGH', 'URGENT'].includes(value)) {
        return value;
    }
    return 'MEDIUM';
}
function normalizeScheduleType(value) {
    const normalized = String(value || 'NONE').toUpperCase().replace(/-/g, '_');
    if (['NONE', 'SPECIFIC_DATE', 'DAY_OF_WEEK'].includes(normalized)) {
        return normalized;
    }
    return 'NONE';
}
class TaskService {
    static async resolveEmployeeId(employeeId, scope) {
        if (!employeeId)
            throw new Error('Assignee is required');
        const whereBase = scope ? (0, org_scope_service_1.employeeWhereFromScope)(scope) : {};
        if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
            const employee = await prisma_1.default.employee.findFirst({
                where: { id: employeeId, ...whereBase },
                select: { id: true },
            });
            if (!employee)
                throw new Error('Employee not found in your company');
            return employee.id;
        }
        const employee = await prisma_1.default.employee.findFirst({
            where: { employeeId, ...whereBase },
            select: { id: true },
        });
        if (!employee) {
            throw new Error(`Employee with ID ${employeeId} not found`);
        }
        return employee.id;
    }
    static async resolveAssigneeIds(rawIds, scope) {
        if (!Array.isArray(rawIds) || rawIds.length === 0)
            return [];
        const resolved = [];
        for (const id of rawIds) {
            resolved.push(await this.resolveEmployeeId(String(id), scope));
        }
        return [...new Set(resolved)];
    }
    static buildTaskData(data, options) {
        return {
            title: data.title,
            description: data.description || data.remarks || null,
            remarks: data.remarks || data.description || null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            priority: normalizePriority(data.priority),
            workDonePercent: Number.isFinite(Number(data.workDonePercent))
                ? Math.min(100, Math.max(0, Number(data.workDonePercent)))
                : 0,
            extraDescriptions: Array.isArray(data.extraDescriptions) ? data.extraDescriptions : [],
            reminderDates: Array.isArray(data.reminderDates) ? data.reminderDates : [],
            reminderWeekdays: Array.isArray(data.reminderWeekdays) ? data.reminderWeekdays : [],
            scheduleType: normalizeScheduleType(data.scheduleType),
            scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
            scheduledWeekday: data.scheduledWeekday || null,
            tags: Array.isArray(data.tags) ? data.tags : [],
            isSelfTask: options?.isSelfTask ?? Boolean(data.isSelfTask),
            assignedBy: options?.assignedBy ?? data.assignedBy ?? null,
            projectId: data.projectId || null,
            projectHeadId: data.projectHeadId || null,
        };
    }
    static async assertProjectInTenant(scope, projectId) {
        if (!projectId)
            return;
        const project = await prisma_1.default.project.findFirst({
            where: { id: projectId, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
            select: { id: true },
        });
        if (!project)
            throw new Error('Project not found in your company');
    }
    static async create(scope, data, assignedBy) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        const assigneeIds = await this.resolveAssigneeIds(data.assigneeIds, scope);
        const primaryAssignee = assigneeIds[0] || (await this.resolveEmployeeId(data.assignedTo, scope));
        const projectHeadId = data.projectHeadId
            ? await this.resolveEmployeeId(data.projectHeadId, scope)
            : null;
        await this.assertProjectInTenant(scope, data.projectId);
        const taskData = this.buildTaskData(data, { isSelfTask: Boolean(data.isSelfTask), assignedBy });
        return prisma_1.default.task.create({
            data: {
                ...taskData,
                assignedTo: primaryAssignee,
                assigneeIds: assigneeIds.length > 0 ? assigneeIds : [primaryAssignee],
                projectHeadId,
                status: 'TODO',
                tenantId,
            },
            include: TASK_INCLUDE,
        });
    }
    static async createSelf(scope, data, employeeRecordId, assignedBy) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        await this.assertProjectInTenant(scope, data.projectId);
        const assigneeIds = [employeeRecordId];
        const taskData = this.buildTaskData(data, { isSelfTask: true, assignedBy });
        return prisma_1.default.task.create({
            data: {
                ...taskData,
                assignedTo: employeeRecordId,
                assigneeIds,
                projectHeadId: data.projectHeadId
                    ? await this.resolveEmployeeId(data.projectHeadId, scope)
                    : null,
                status: 'TODO',
                tenantId,
            },
            include: TASK_INCLUDE,
        });
    }
    static async update(scope, id, data) {
        const existing = await prisma_1.default.task.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Task not found');
        const assigneeIds = data.assigneeIds !== undefined ? await this.resolveAssigneeIds(data.assigneeIds, scope) : undefined;
        const assignedTo = assigneeIds && assigneeIds.length > 0
            ? assigneeIds[0]
            : data.assignedTo
                ? await this.resolveEmployeeId(data.assignedTo, scope)
                : undefined;
        if (data.projectId !== undefined) {
            await this.assertProjectInTenant(scope, data.projectId);
        }
        const taskData = this.buildTaskData({ ...existing, ...data });
        const nextStatus = data.status !== undefined ? String(data.status).toUpperCase() : existing.status;
        const markingDone = nextStatus === 'DONE' && existing.status !== 'DONE';
        return prisma_1.default.task.update({
            where: { id },
            data: {
                ...taskData,
                ...(data.status !== undefined ? { status: nextStatus } : {}),
                ...(markingDone ? { completedAt: new Date(), workDonePercent: taskData.workDonePercent || 100 } : {}),
                ...(data.status !== undefined && nextStatus !== 'DONE' ? { completedAt: null } : {}),
                ...(assignedTo ? { assignedTo } : {}),
                ...(assigneeIds ? { assigneeIds } : {}),
                ...(data.projectHeadId !== undefined
                    ? {
                        projectHeadId: data.projectHeadId
                            ? await this.resolveEmployeeId(data.projectHeadId, scope)
                            : null,
                    }
                    : {}),
                ...(data.projectId !== undefined ? { projectId: data.projectId || null } : {}),
                ...(data.approvalStatus !== undefined ? { approvalStatus: data.approvalStatus } : {}),
                ...(data.completedAt !== undefined
                    ? { completedAt: data.completedAt ? new Date(data.completedAt) : null }
                    : {}),
            },
            include: TASK_INCLUDE,
        });
    }
    static async updateStatus(scope, id, status) {
        const normalized = String(status || '').toUpperCase();
        const finalStatus = normalized === 'DONE' || normalized === 'COMPLETED'
            ? 'DONE'
            : normalized === 'IN_PROGRESS' || normalized === 'BLOCKED'
                ? 'IN_PROGRESS'
                : 'TODO';
        const existing = await prisma_1.default.task.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Task not found');
        return prisma_1.default.task.update({
            where: { id },
            data: {
                status: finalStatus,
                ...(finalStatus === 'DONE' && !existing.completedAt
                    ? { completedAt: new Date(), workDonePercent: existing.workDonePercent || 100 }
                    : {}),
                ...(finalStatus !== 'DONE' ? { completedAt: null } : {}),
            },
            include: TASK_INCLUDE,
        });
    }
    static async delete(scope, id) {
        const existing = await prisma_1.default.task.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Task not found');
        return prisma_1.default.task.delete({ where: { id } });
    }
    static async getByEmployee(scope, employeeId) {
        const assigneeId = await this.resolveEmployeeId(employeeId, scope);
        return prisma_1.default.task.findMany({
            where: {
                ...(0, tenant_scope_1.tenantWhereFromScope)(scope),
                OR: [{ assignedTo: assigneeId }, { assigneeIds: { has: assigneeId } }],
            },
            include: TASK_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
    }
    static async getAllForUser(user, scope) {
        const tenantFilter = (0, tenant_scope_1.tenantWhereFromScope)(scope);
        if (scope?.employeeSelfOnly && user.employeeId) {
            return prisma_1.default.task.findMany({
                where: {
                    ...tenantFilter,
                    OR: [
                        { assignedTo: user.employeeId },
                        { assigneeIds: { has: user.employeeId } },
                        { isSelfTask: true, assignedTo: user.employeeId },
                    ],
                },
                include: TASK_INCLUDE,
                orderBy: { createdAt: 'desc' },
            });
        }
        if (scope && scope.scopedEmployeeIds !== null) {
            const ids = scope.scopedEmployeeIds;
            if (ids.length === 0)
                return [];
            return prisma_1.default.task.findMany({
                where: {
                    ...tenantFilter,
                    OR: [{ assignedTo: { in: ids } }, { assigneeIds: { hasSome: ids } }],
                },
                include: TASK_INCLUDE,
                orderBy: { createdAt: 'desc' },
            });
        }
        // HQ: all tasks in tenant only (never cross-tenant)
        return prisma_1.default.task.findMany({
            where: tenantFilter,
            include: TASK_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
    }
    static async getById(scope, id) {
        return prisma_1.default.task.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
            include: TASK_INCLUDE,
        });
    }
}
exports.TaskService = TaskService;
//# sourceMappingURL=task.service.js.map