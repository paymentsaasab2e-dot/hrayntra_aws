import prisma from '../../shared/prisma';
import { OrgScopeContext } from '../../shared/org/org-scope.service';
import { requireTenantId, tenantWhereFromScope } from '../../shared/tenant/tenant-scope';

function locationWhere(scope: OrgScopeContext, activeOnly = false) {
  const where: any = { ...tenantWhereFromScope(scope) };
  if (activeOnly) where.isActive = true;
  // Org-wise: managers only see locations linked to their subtree (or unlinked tenant-wide HQ locs)
  if (scope.allowedOrgUnitIds !== null) {
    where.OR = [
      { orgUnitId: null },
      { orgUnitId: { in: scope.allowedOrgUnitIds } },
    ];
  }
  return where;
}

export class LocationService {
  static async getAll(scope: OrgScopeContext, activeOnly = false) {
    return prisma.workLocation.findMany({
      where: locationWhere(scope, activeOnly),
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { employees: true } },
      },
    });
  }

  static async getById(scope: OrgScopeContext, id: string) {
    const location = await prisma.workLocation.findFirst({
      where: { id, ...locationWhere(scope) },
      include: {
        employees: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!location) throw new Error('Work location not found');
    return location;
  }

  static async create(scope: OrgScopeContext, data: any) {
    const tenantId = requireTenantId(scope);
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('Valid latitude and longitude are required');
    }

    let orgUnitId = data.orgUnitId || null;
    if (orgUnitId) {
      const ou = await prisma.orgUnit.findFirst({
        where: { id: orgUnitId, tenantId },
      });
      if (!ou) throw new Error('Org unit not found in your company');
      if (scope.allowedOrgUnitIds && !scope.allowedOrgUnitIds.includes(orgUnitId)) {
        throw new Error('You cannot attach a location outside your org scope');
      }
    }

    return prisma.workLocation.create({
      data: {
        name: data.name,
        address: data.address || null,
        lat,
        lng,
        radiusMeters: Number(data.radiusMeters) > 0 ? Number(data.radiusMeters) : 100,
        isActive: data.isActive !== false,
        usage: data.usage || 'BOTH',
        tenantId,
        orgUnitId,
      },
    });
  }

  static async update(scope: OrgScopeContext, id: string, data: any) {
    const existing = await prisma.workLocation.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Work location not found');

    const updateData: any = {
      name: data.name ?? existing.name,
      address: data.address ?? existing.address,
      isActive: data.isActive ?? existing.isActive,
      usage: data.usage ?? existing.usage,
    };

    if (data.lat !== undefined) updateData.lat = Number(data.lat);
    if (data.lng !== undefined) updateData.lng = Number(data.lng);
    if (data.radiusMeters !== undefined) {
      updateData.radiusMeters = Number(data.radiusMeters) > 0 ? Number(data.radiusMeters) : 100;
    }
    if (data.orgUnitId !== undefined) {
      updateData.orgUnitId = data.orgUnitId || null;
    }

    return prisma.workLocation.update({ where: { id }, data: updateData });
  }

  static async delete(scope: OrgScopeContext, id: string) {
    const existing = await prisma.workLocation.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Work location not found');

    const assigned = await prisma.employee.count({ where: { locationId: id } });
    if (assigned > 0) {
      throw new Error(`Cannot delete location: ${assigned} employee(s) still assigned`);
    }
    const visitAssignments = await prisma.fieldVisitAssignment.count({ where: { locationId: id } });
    if (visitAssignments > 0) {
      throw new Error(`Cannot delete location: used in ${visitAssignments} visit roster assignment(s)`);
    }
    await prisma.workLocation.delete({ where: { id } });
    return { success: true };
  }
}
