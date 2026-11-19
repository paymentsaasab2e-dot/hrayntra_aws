import prisma from '../../shared/prisma';
import { OrgScopeContext, employeeWhereFromScope } from '../../shared/org/org-scope.service';
import { requireTenantId, tenantWhereFromScope } from '../../shared/tenant/tenant-scope';

export class ProjectService {
  static async resolveEmployeeId(scope: OrgScopeContext, employeeId: string | undefined | null): Promise<string | null> {
    if (!employeeId) return null;
    if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
      const emp = await prisma.employee.findFirst({
        where: { id: employeeId, ...employeeWhereFromScope(scope) },
        select: { id: true },
      });
      if (!emp) throw new Error('Employee not found in your company');
      return emp.id;
    }

    const employee = await prisma.employee.findFirst({
      where: { employeeId, ...employeeWhereFromScope(scope) },
      select: { id: true },
    });

    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} not found`);
    }

    return employee.id;
  }

  static async getAll(scope: OrgScopeContext) {
    return prisma.project.findMany({
      where: tenantWhereFromScope(scope),
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { tasks: true } },
      },
    });
  }

  static async getById(scope: OrgScopeContext, id: string) {
    return prisma.project.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
      include: {
        tasks: {
          include: { employee: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  static async create(scope: OrgScopeContext, data: any) {
    const tenantId = requireTenantId(scope);
    const projectHeadId = await this.resolveEmployeeId(scope, data.projectHeadId);
    return prisma.project.create({
      data: {
        name: String(data.name).trim(),
        description: data.description || null,
        projectHeadId,
        status: data.status || 'ACTIVE',
        tenantId,
      },
    });
  }

  static async update(scope: OrgScopeContext, id: string, data: any) {
    const existing = await prisma.project.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Project not found');

    const projectHeadId =
      data.projectHeadId === undefined
        ? undefined
        : await this.resolveEmployeeId(scope, data.projectHeadId);

    return prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(projectHeadId !== undefined ? { projectHeadId } : {}),
      },
    });
  }

  static async delete(scope: OrgScopeContext, id: string) {
    const existing = await prisma.project.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Project not found');

    await prisma.task.updateMany({
      where: { projectId: id, ...tenantWhereFromScope(scope) },
      data: { projectId: null },
    });
    return prisma.project.delete({ where: { id } });
  }
}
