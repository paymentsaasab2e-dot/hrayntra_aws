import prisma from '../../shared/prisma';
import { OrgScopeContext, getDescendantOrgUnitIds, orgUnitWhereFromScope } from '../../shared/org/org-scope.service';
import { ApprovalService } from '../approvals/approval.service';

const HQ_ROLES = new Set(['ADMIN', 'HR']);

function serializeOrgUnit(unit: any) {
  return {
    id: unit.id,
    tenantId: unit.tenantId,
    parentId: unit.parentId,
    levelOrder: unit.levelOrder,
    name: unit.name,
    path: unit.path,
    isLeaf: unit.isLeaf,
    status: unit.status,
    createdByUserId: unit.createdByUserId,
    children: unit.children?.map(serializeOrgUnit),
    _count: unit._count,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}

export class OrgUnitService {
  static async getTree(scope: OrgScopeContext) {
    const where: any = { tenantId: scope.tenantId || undefined, ...orgUnitWhereFromScope(scope) };
    const units = await prisma.orgUnit.findMany({
      where,
      orderBy: [{ levelOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { employees: true, children: true } } },
    });
    return units.map(serializeOrgUnit);
  }

  static async getById(id: string, scope: OrgScopeContext) {
    const unit = await prisma.orgUnit.findUnique({
      where: { id },
      include: { _count: { select: { employees: true, children: true } } },
    });
    if (!unit) throw new Error('Org unit not found');
    if (scope.allowedOrgUnitIds !== null && !scope.allowedOrgUnitIds.includes(id)) {
      throw new Error('Org unit not in scope');
    }
    return serializeOrgUnit(unit);
  }

  static async create(
    data: { parentId: string; name: string; isLeaf: boolean },
    actor: { id: string; role: string },
    scope: OrgScopeContext
  ) {
    if (!scope.tenantId) throw new Error('Tenant not configured');

    const parent = await prisma.orgUnit.findUnique({ where: { id: data.parentId } });
    if (!parent || parent.tenantId !== scope.tenantId) throw new Error('Parent org unit not found');

    if (scope.allowedOrgUnitIds !== null && !scope.allowedOrgUnitIds.includes(parent.id)) {
      throw new Error('Cannot create under org unit outside your scope');
    }

    if (data.isLeaf && parent.isLeaf) {
      throw new Error('Cannot add a site under another site');
    }

    const isHq = HQ_ROLES.has(actor.role);
    const isManager = actor.role === 'MANAGER';

    if (!isHq && !isManager) {
      throw new Error('Only HQ or division managers can create org units');
    }

    if (isManager && !data.isLeaf) {
      throw new Error('Division managers can only create leaf sites');
    }

    const levelOrder = parent.levelOrder + 1;
    const status = isHq || !data.isLeaf ? 'ACTIVE' : 'PENDING_HQ_APPROVAL';

    const created = await prisma.orgUnit.create({
      data: {
        tenantId: scope.tenantId,
        parentId: parent.id,
        levelOrder,
        name: data.name.trim(),
        path: '',
        isLeaf: data.isLeaf,
        status,
        createdByUserId: actor.id,
      },
    });

    const path = `${parent.path}${created.id}/`;
    const unit = await prisma.orgUnit.update({
      where: { id: created.id },
      data: { path },
      include: { _count: { select: { employees: true, children: true } } },
    });

    if (status === 'PENDING_HQ_APPROVAL') {
      await ApprovalService.createOrgSiteRequest({
        tenantId: scope.tenantId,
        orgUnitId: unit.id,
        requesterId: actor.id,
        name: unit.name,
        parentName: parent.name,
      });
    }

    return serializeOrgUnit(unit);
  }

  static async approvePending(orgUnitId: string, actor: { id: string; role: string }) {
    if (!HQ_ROLES.has(actor.role)) throw new Error('Only HQ can approve org units');

    const unit = await prisma.orgUnit.findUnique({ where: { id: orgUnitId } });
    if (!unit) throw new Error('Org unit not found');
    if (unit.status !== 'PENDING_HQ_APPROVAL') throw new Error('Org unit is not pending approval');

    const updated = await prisma.orgUnit.update({
      where: { id: orgUnitId },
      data: { status: 'ACTIVE' },
      include: { _count: { select: { employees: true, children: true } } },
    });

    await ApprovalService.completeOrgSiteApproval(orgUnitId, true);
    return serializeOrgUnit(updated);
  }

  static async rejectPending(orgUnitId: string, actor: { id: string; role: string }) {
    if (!HQ_ROLES.has(actor.role)) throw new Error('Only HQ can reject org units');

    const unit = await prisma.orgUnit.findUnique({ where: { id: orgUnitId } });
    if (!unit) throw new Error('Org unit not found');
    if (unit.status !== 'PENDING_HQ_APPROVAL') throw new Error('Org unit is not pending approval');

    await ApprovalService.completeOrgSiteApproval(orgUnitId, false);
    await prisma.orgUnit.delete({ where: { id: orgUnitId } });
    return { success: true };
  }

  static async update(id: string, data: { name?: string }, scope: OrgScopeContext) {
    const existing = await this.getById(id, scope);
    const updated = await prisma.orgUnit.update({
      where: { id },
      data: { name: data.name?.trim() || existing.name },
      include: { _count: { select: { employees: true, children: true } } },
    });
    return serializeOrgUnit(updated);
  }

  static async delete(id: string, scope: OrgScopeContext, actorRole: string) {
    if (!HQ_ROLES.has(actorRole)) throw new Error('Only HQ can delete org units');
    await this.getById(id, scope);

    const descendants = await getDescendantOrgUnitIds(id);
    const employeeCount = await prisma.employee.count({ where: { orgUnitId: { in: descendants } } });
    if (employeeCount > 0) {
      throw new Error(`Cannot delete: ${employeeCount} employee(s) assigned in this subtree`);
    }

    const childCount = await prisma.orgUnit.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new Error('Cannot delete org unit with children');
    }

    await prisma.orgUnit.delete({ where: { id } });
    return { success: true };
  }
}
