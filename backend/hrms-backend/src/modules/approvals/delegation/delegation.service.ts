import prisma from '../../../shared/prisma';
import { OrgScopeContext } from '../../../shared/org/org-scope.service';
import { requireTenantId } from '../../../shared/tenant/tenant-scope';

export interface CreateDelegationDto {
  delegateeUserId: string;
  startDate: string | Date;
  endDate: string | Date;
  scope?: 'ALL' | 'LEAVE' | 'ATTENDANCE' | 'EXIT';
  reason?: string;
}

export class DelegationService {
  /**
   * Creates a new approval delegation from delegator to delegatee
   */
  static async createDelegation(
    scope: OrgScopeContext,
    delegatorUserId: string,
    dto: CreateDelegationDto
  ) {
    const tenantId = requireTenantId(scope);

    if (delegatorUserId === dto.delegateeUserId) {
      throw new Error('You cannot delegate approvals to yourself');
    }

    // Verify delegatee exists and belongs to the same tenant
    const delegatee = await prisma.user.findFirst({
      where: { id: dto.delegateeUserId, tenantId, status: 'ACTIVE' },
      include: { employees: { select: { firstName: true, lastName: true, designation: true } } },
    });

    if (!delegatee) {
      throw new Error('Delegatee user not found or inactive');
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid start or end date provided');
    }

    if (end < start) {
      throw new Error('End date must be on or after start date');
    }

    // Deactivate any overlapping active delegation for the same delegator & scope
    await prisma.approvalDelegation.updateMany({
      where: {
        tenantId,
        delegatorId: delegatorUserId,
        isActive: true,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      data: { isActive: false },
    });

    const delegation = await prisma.approvalDelegation.create({
      data: {
        tenantId,
        delegatorId: delegatorUserId,
        delegateeId: dto.delegateeUserId,
        scope: dto.scope || 'ALL',
        startDate: start,
        endDate: end,
        reason: dto.reason || null,
        isActive: true,
      },
      include: {
        delegator: {
          select: {
            id: true,
            email: true,
            displayName: true,
            employees: { select: { firstName: true, lastName: true, designation: true } },
          },
        },
        delegatee: {
          select: {
            id: true,
            email: true,
            displayName: true,
            employees: { select: { firstName: true, lastName: true, designation: true } },
          },
        },
      },
    });

    return {
      id: delegation.id,
      delegator: {
        id: delegation.delegator.id,
        name: delegation.delegator.displayName || delegation.delegator.email,
      },
      delegatee: {
        id: delegation.delegatee.id,
        name: delegation.delegatee.displayName || delegation.delegatee.email,
      },
      scope: delegation.scope,
      startDate: delegation.startDate,
      endDate: delegation.endDate,
      reason: delegation.reason,
      isActive: delegation.isActive,
    };
  }

  /**
   * Lists delegations where user is delegator or delegatee
   */
  static async listDelegations(scope: OrgScopeContext, userId?: string) {
    const tenantId = requireTenantId(scope);
    const now = new Date();

    const delegations = await prisma.approvalDelegation.findMany({
      where: {
        tenantId,
        ...(userId ? { OR: [{ delegatorId: userId }, { delegateeId: userId }] } : {}),
      },
      include: {
        delegator: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            employees: { select: { firstName: true, lastName: true, designation: true } },
          },
        },
        delegatee: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            employees: { select: { firstName: true, lastName: true, designation: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return delegations.map((d) => {
      const isCurrentlyActive = d.isActive && now >= d.startDate && now <= d.endDate;
      const delegatorName =
        d.delegator.employees?.[0]
          ? `${d.delegator.employees[0].firstName} ${d.delegator.employees[0].lastName}`
          : d.delegator.displayName || d.delegator.email;

      const delegateeName =
        d.delegatee.employees?.[0]
          ? `${d.delegatee.employees[0].firstName} ${d.delegatee.employees[0].lastName}`
          : d.delegatee.displayName || d.delegatee.email;

      return {
        id: d.id,
        delegatorId: d.delegatorId,
        delegatorName,
        delegatorRole: d.delegator.role,
        delegateeId: d.delegateeId,
        delegateeName,
        delegateeRole: d.delegatee.role,
        scope: d.scope,
        startDate: d.startDate,
        endDate: d.endDate,
        reason: d.reason,
        isActive: d.isActive,
        isCurrentlyActive,
        createdAt: d.createdAt,
      };
    });
  }

  /**
   * Revokes an active delegation early
   */
  static async revokeDelegation(scope: OrgScopeContext, delegationId: string, userId: string) {
    const tenantId = requireTenantId(scope);

    const existing = await prisma.approvalDelegation.findFirst({
      where: { id: delegationId, tenantId },
    });

    if (!existing) {
      throw new Error('Delegation record not found');
    }

    if (existing.delegatorId !== userId && (scope as any).role !== 'ADMIN') {
      throw new Error('Only the delegator or an Administrator can revoke this delegation');
    }

    await prisma.approvalDelegation.update({
      where: { id: delegationId },
      data: { isActive: false },
    });

    return { success: true, message: 'Delegation successfully revoked' };
  }

  /**
   * Returns IDs of delegators who have currently delegated authority to this user
   */
  static async getActiveDelegatorIdsForUser(
    tenantId: string,
    delegateeUserId: string,
    scopeType?: string
  ): Promise<string[]> {
    const now = new Date();

    const activeDelegations = await prisma.approvalDelegation.findMany({
      where: {
        tenantId,
        delegateeId: delegateeUserId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        ...(scopeType ? { scope: { in: ['ALL', scopeType] } } : {}),
      },
      select: { delegatorId: true },
    });

    return activeDelegations.map((d) => d.delegatorId);
  }
}
