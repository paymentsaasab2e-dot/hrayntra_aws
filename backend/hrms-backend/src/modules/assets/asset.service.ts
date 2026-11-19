import prisma from '../../shared/prisma';
import { OrgScopeContext, employeeWhereFromScope } from '../../shared/org/org-scope.service';
import { requireTenantId, tenantWhereFromScope } from '../../shared/tenant/tenant-scope';

export class AssetService {
  static async getAll(scope: OrgScopeContext) {
    return prisma.asset.findMany({
      where: tenantWhereFromScope(scope),
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

  static async getById(scope: OrgScopeContext, id: string) {
    return prisma.asset.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
      include: { allocations: { include: { employee: true } } },
    });
  }

  static async create(scope: OrgScopeContext, data: any) {
    const tenantId = requireTenantId(scope);
    return prisma.asset.create({
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

  static async update(scope: OrgScopeContext, id: string, data: any) {
    const existing = await prisma.asset.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Asset not found');
    const { tenantId: _ignore, ...safe } = data;
    return prisma.asset.update({ where: { id }, data: safe });
  }

  static async delete(scope: OrgScopeContext, id: string) {
    const existing = await prisma.asset.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Asset not found');
    return prisma.asset.delete({ where: { id } });
  }

  static async getAllocations(scope: OrgScopeContext) {
    return prisma.assetAllocation.findMany({
      where: {
        asset: tenantWhereFromScope(scope),
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

  static async assignAsset(scope: OrgScopeContext, data: any) {
    const tenantId = requireTenantId(scope);
    const asset = await prisma.asset.findFirst({
      where: { id: data.assetId, tenantId },
    });
    if (!asset) throw new Error('Asset not found');

    let empId = data.employeeId;
    if (!empId.match(/^[0-9a-fA-F]{24}$/)) {
      const emp = await prisma.employee.findFirst({
        where: { employeeId: empId, ...employeeWhereFromScope(scope) },
      });
      if (!emp) throw new Error(`Employee ${empId} not found`);
      empId = emp.id;
    } else {
      const emp = await prisma.employee.findFirst({
        where: { id: empId, ...employeeWhereFromScope(scope) },
      });
      if (!emp) throw new Error('Employee not found in your company');
    }

    const allocation = await prisma.assetAllocation.create({
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

    await prisma.asset.update({ where: { id: data.assetId }, data: { status: 'Assigned' } });
    return allocation;
  }

  static async returnAsset(scope: OrgScopeContext, allocationId: string, data: any) {
    const allocation = await prisma.assetAllocation.findFirst({
      where: {
        id: allocationId,
        asset: tenantWhereFromScope(scope),
      },
    });
    if (!allocation) throw new Error('Allocation not found');

    const updated = await prisma.assetAllocation.update({
      where: { id: allocationId },
      data: {
        returnedOn: data.returnedOn || new Date().toISOString().split('T')[0],
        conditionOnReturn: data.conditionOnReturn || 'Good',
        notes: data.notes,
        status: 'Returned',
      },
    });

    await prisma.asset.update({
      where: { id: updated.assetId },
      data: { status: 'Available' },
    });

    return updated;
  }
}
