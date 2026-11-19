import prisma from '../../shared/prisma';
import { OrgScopeContext, employeeWhereFromScope } from '../../shared/org/org-scope.service';
import { requireTenantId, tenantWhereFromScope } from '../../shared/tenant/tenant-scope';

export class DocumentService {
  static async getAll(scope: OrgScopeContext, filters: any = {}) {
    const where: any = { ...tenantWhereFromScope(scope) };
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;

    if (filters.employeeId) {
      let empId = filters.employeeId;
      if (!String(empId).match(/^[0-9a-fA-F]{24}$/)) {
        const emp = await prisma.employee.findFirst({
          where: { employeeId: empId, ...employeeWhereFromScope(scope) },
        });
        if (emp) empId = emp.id;
        else return [];
      } else if (scope.scopedEmployeeIds !== null && !scope.scopedEmployeeIds.includes(empId)) {
        return [];
      }
      where.employeeId = empId;
    } else if (scope.scopedEmployeeIds !== null) {
      if (scope.scopedEmployeeIds.length === 0) return [];
      where.OR = [
        { employeeId: { in: scope.scopedEmployeeIds } },
        { employeeId: null },
      ];
    }

    return prisma.document.findMany({
      where,
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeId: true, department: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  static async getById(scope: OrgScopeContext, id: string) {
    return prisma.document.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
      include: { employee: true },
    });
  }

  static async create(scope: OrgScopeContext, data: any) {
    const tenantId = requireTenantId(scope);
    let empId = data.employeeId || null;
    if (empId && !String(empId).match(/^[0-9a-fA-F]{24}$/)) {
      const emp = await prisma.employee.findFirst({
        where: { employeeId: empId, ...employeeWhereFromScope(scope) },
      });
      if (!emp) throw new Error('Employee not found in your company');
      empId = emp.id;
    } else if (empId) {
      const emp = await prisma.employee.findFirst({
        where: { id: empId, ...employeeWhereFromScope(scope) },
      });
      if (!emp) throw new Error('Employee not found in your company');
    }

    return prisma.document.create({
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

  static async update(scope: OrgScopeContext, id: string, data: any) {
    const existing = await prisma.document.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Document not found');
    const { tenantId: _ignore, ...safe } = data;
    return prisma.document.update({ where: { id }, data: safe });
  }

  static async archive(scope: OrgScopeContext, id: string) {
    const existing = await prisma.document.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Document not found');
    return prisma.document.update({
      where: { id },
      data: { status: 'Archived' },
    });
  }

  static async delete(scope: OrgScopeContext, id: string) {
    const existing = await prisma.document.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Document not found');
    return prisma.document.delete({ where: { id } });
  }
}
