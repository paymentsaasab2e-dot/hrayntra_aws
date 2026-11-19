import prisma from '../../shared/prisma';
import { OrgScopeContext, employeeWhereFromScope } from '../../shared/org/org-scope.service';
import { requireTenantId, tenantWhereFromScope } from '../../shared/tenant/tenant-scope';

const TASK_INCLUDE = {
  employee: true,
  project: true,
};

function normalizePriority(priority: string | undefined) {
  const value = String(priority || 'MEDIUM').toUpperCase().replace(/-/g, '_');
  if (['LOW', 'LESS_URGENT', 'MEDIUM', 'HIGH', 'URGENT'].includes(value)) {
    return value;
  }
  return 'MEDIUM';
}

function normalizeScheduleType(value: string | undefined) {
  const normalized = String(value || 'NONE').toUpperCase().replace(/-/g, '_');
  if (['NONE', 'SPECIFIC_DATE', 'DAY_OF_WEEK'].includes(normalized)) {
    return normalized;
  }
  return 'NONE';
}

export class TaskService {
  static async resolveEmployeeId(employeeId: string, scope?: OrgScopeContext): Promise<string> {
    if (!employeeId) throw new Error('Assignee is required');
    const whereBase = scope ? employeeWhereFromScope(scope) : {};

    if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, ...whereBase },
        select: { id: true },
      });
      if (!employee) throw new Error('Employee not found in your company');
      return employee.id;
    }

    const employee = await prisma.employee.findFirst({
      where: { employeeId, ...whereBase },
      select: { id: true },
    });

    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} not found`);
    }

    return employee.id;
  }

  static async resolveAssigneeIds(rawIds: unknown, scope?: OrgScopeContext): Promise<string[]> {
    if (!Array.isArray(rawIds) || rawIds.length === 0) return [];
    const resolved: string[] = [];
    for (const id of rawIds) {
      resolved.push(await this.resolveEmployeeId(String(id), scope));
    }
    return [...new Set(resolved)];
  }

  static buildTaskData(data: any, options?: { isSelfTask?: boolean; assignedBy?: string | null }) {
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

  static async assertProjectInTenant(scope: OrgScopeContext, projectId: string | null | undefined) {
    if (!projectId) return;
    const project = await prisma.project.findFirst({
      where: { id: projectId, ...tenantWhereFromScope(scope) },
      select: { id: true },
    });
    if (!project) throw new Error('Project not found in your company');
  }

  static async create(scope: OrgScopeContext, data: any, assignedBy?: string | null) {
    const tenantId = requireTenantId(scope);
    const assigneeIds = await this.resolveAssigneeIds(data.assigneeIds, scope);
    const primaryAssignee = assigneeIds[0] || (await this.resolveEmployeeId(data.assignedTo, scope));
    const projectHeadId = data.projectHeadId
      ? await this.resolveEmployeeId(data.projectHeadId, scope)
      : null;
    await this.assertProjectInTenant(scope, data.projectId);

    const taskData = this.buildTaskData(data, { isSelfTask: Boolean(data.isSelfTask), assignedBy });

    return prisma.task.create({
      data: {
        ...taskData,
        assignedTo: primaryAssignee,
        assigneeIds: assigneeIds.length > 0 ? assigneeIds : [primaryAssignee],
        projectHeadId,
        status: 'TODO',
        tenantId,
      } as any,
      include: TASK_INCLUDE,
    });
  }

  static async createSelf(
    scope: OrgScopeContext,
    data: any,
    employeeRecordId: string,
    assignedBy?: string | null
  ) {
    const tenantId = requireTenantId(scope);
    await this.assertProjectInTenant(scope, data.projectId);
    const assigneeIds = [employeeRecordId];
    const taskData = this.buildTaskData(data, { isSelfTask: true, assignedBy });

    return prisma.task.create({
      data: {
        ...taskData,
        assignedTo: employeeRecordId,
        assigneeIds,
        projectHeadId: data.projectHeadId
          ? await this.resolveEmployeeId(data.projectHeadId, scope)
          : null,
        status: 'TODO',
        tenantId,
      } as any,
      include: TASK_INCLUDE,
    });
  }

  static async update(scope: OrgScopeContext, id: string, data: any) {
    const existing = await prisma.task.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Task not found');

    const assigneeIds =
      data.assigneeIds !== undefined ? await this.resolveAssigneeIds(data.assigneeIds, scope) : undefined;
    const assignedTo =
      assigneeIds && assigneeIds.length > 0
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

    return prisma.task.update({
      where: { id },
      data: {
        ...taskData,
        ...(data.status !== undefined ? { status: nextStatus as any } : {}),
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
      } as any,
      include: TASK_INCLUDE,
    });
  }

  static async updateStatus(scope: OrgScopeContext, id: string, status: any) {
    const normalized = String(status || '').toUpperCase();
    const finalStatus =
      normalized === 'DONE' || normalized === 'COMPLETED'
        ? 'DONE'
        : normalized === 'IN_PROGRESS' || normalized === 'BLOCKED'
          ? 'IN_PROGRESS'
          : 'TODO';

    const existing = await prisma.task.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Task not found');

    return prisma.task.update({
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

  static async delete(scope: OrgScopeContext, id: string) {
    const existing = await prisma.task.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Task not found');
    return prisma.task.delete({ where: { id } });
  }

  static async getByEmployee(scope: OrgScopeContext, employeeId: string) {
    const assigneeId = await this.resolveEmployeeId(employeeId, scope);
    return prisma.task.findMany({
      where: {
        ...tenantWhereFromScope(scope),
        OR: [{ assignedTo: assigneeId }, { assigneeIds: { has: assigneeId } }],
      },
      include: TASK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getAllForUser(user: { role?: string; employeeId?: string }, scope?: OrgScopeContext) {
    const tenantFilter = tenantWhereFromScope(scope);

    if (scope?.employeeSelfOnly && user.employeeId) {
      return prisma.task.findMany({
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
      if (ids.length === 0) return [];
      return prisma.task.findMany({
        where: {
          ...tenantFilter,
          OR: [{ assignedTo: { in: ids } }, { assigneeIds: { hasSome: ids } }],
        },
        include: TASK_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
    }

    // HQ: all tasks in tenant only (never cross-tenant)
    return prisma.task.findMany({
      where: tenantFilter,
      include: TASK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getById(scope: OrgScopeContext, id: string) {
    return prisma.task.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
      include: TASK_INCLUDE,
    });
  }
}
