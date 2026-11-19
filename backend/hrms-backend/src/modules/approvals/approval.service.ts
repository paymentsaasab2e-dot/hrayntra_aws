import prisma from '../../shared/prisma';
import { OrgScopeContext } from '../../shared/org/org-scope.service';
import { SeparationService } from '../separation/separation.service';
import { PolicyService } from '../policies/policy.service';
import { AttendanceService } from '../attendance/attendance.service';
import { EmployeeChangeService } from '../employees/employee-change.service';
import { DelegationService } from './delegation/delegation.service';

const LEAVE_DAYS_L2_THRESHOLD = 3;
const HQ_ROLES = new Set(['ADMIN', 'HR']);

export class ApprovalService {
  static async createLeaveApproval(leave: {
    id: string;
    employeeId: string;
    startDate: Date;
    endDate: Date;
    tenantId: string;
    orgUnitId?: string | null;
    requesterUserId?: string | null;
  }) {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const maxLevel = days > LEAVE_DAYS_L2_THRESHOLD ? 2 : 1;

    return prisma.approvalRequest.create({
      data: {
        tenantId: leave.tenantId,
        type: 'LEAVE',
        status: 'PENDING',
        currentLevel: 1,
        maxLevel,
        referenceId: leave.id,
        orgUnitId: leave.orgUnitId || null,
        requesterId: leave.requesterUserId || null,
        payload: { leaveId: leave.id, days, startDate: leave.startDate, endDate: leave.endDate },
      },
    });
  }

  static async createExitApproval(data: {
    id: string;
    tenantId: string;
    orgUnitId?: string | null;
    requesterUserId?: string | null;
    requestedLWD: Date;
    noticePeriodDays: number;
    reason: string;
  }) {
    return prisma.approvalRequest.create({
      data: {
        tenantId: data.tenantId,
        type: 'EXIT',
        status: 'PENDING',
        currentLevel: 1,
        maxLevel: 2,
        referenceId: data.id,
        orgUnitId: data.orgUnitId || null,
        requesterId: data.requesterUserId || null,
        payload: {
          separationId: data.id,
          requestedLWD: data.requestedLWD,
          noticePeriodDays: data.noticePeriodDays,
          reason: data.reason,
        },
      },
    });
  }

  static async createOrgSiteRequest(data: {
    tenantId: string;
    orgUnitId: string;
    requesterId: string;
    name: string;
    parentName: string;
  }) {
    return prisma.approvalRequest.create({
      data: {
        tenantId: data.tenantId,
        type: 'ORG_SETTINGS',
        status: 'PENDING',
        currentLevel: 3,
        maxLevel: 3,
        referenceId: data.orgUnitId,
        orgUnitId: data.orgUnitId,
        requesterId: data.requesterId,
        payload: { orgUnitId: data.orgUnitId, name: data.name, parentName: data.parentName },
      },
    });
  }

  static async completeOrgSiteApproval(orgUnitId: string, approved: boolean) {
    const pending = await prisma.approvalRequest.findFirst({
      where: {
        type: 'ORG_SETTINGS',
        referenceId: orgUnitId,
        status: 'PENDING',
      },
    });
    if (!pending) return null;
    return prisma.approvalRequest.update({
      where: { id: pending.id },
      data: { status: approved ? 'APPROVED' : 'REJECTED' },
    });
  }

  static async getInboxEnriched(scope: OrgScopeContext, actor: { role: string }) {
    const inbox = await this.getInbox(scope, actor);
    const leaveIds = inbox.filter((r) => r.type === 'LEAVE' && r.referenceId).map((r) => r.referenceId!);
    const exitIds = inbox.filter((r) => r.type === 'EXIT' && r.referenceId).map((r) => r.referenceId!);

    const leaves = leaveIds.length
      ? await prisma.leave.findMany({ where: { id: { in: leaveIds } } })
      : [];
    const leaveEmployeeIds = [...new Set(leaves.map((l) => l.employeeId))];
    const employees = leaveEmployeeIds.length
      ? await prisma.employee.findMany({
          where: { id: { in: leaveEmployeeIds } },
          select: { id: true, employeeId: true, firstName: true, lastName: true, department: true, designation: true },
        })
      : [];
    const employeeMap = new Map(employees.map((e) => [e.id, e]));
    const leaveMap = new Map(leaves.map((l) => [l.id, l]));

    const separations = exitIds.length
      ? await prisma.separationRequest.findMany({
          where: { id: { in: exitIds } },
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                department: true,
                designation: true,
              },
            },
          },
        })
      : [];
    const separationMap = new Map(separations.map((s) => [s.id, s]));

    const mappedInbox = inbox.map((req) => {
      const base = {
        id: req.id,
        type: req.type,
        status: req.status,
        currentLevel: req.currentLevel,
        maxLevel: req.maxLevel,
        referenceId: req.referenceId,
        orgUnit: req.orgUnit,
        createdAt: req.createdAt,
        payload: req.payload,
      };

      if (req.type === 'LEAVE' && req.referenceId) {
        const leave = leaveMap.get(req.referenceId);
        const employee = leave ? employeeMap.get(leave.employeeId) : null;
        return {
          ...base,
          employee: employee
            ? {
                recordId: employee.id,
                employeeId: employee.employeeId,
                name: `${employee.firstName} ${employee.lastName}`,
                department: employee.department,
                designation: employee.designation,
              }
            : null,
          leave: leave
            ? {
                id: leave.id,
                type: leave.type,
                startDate: leave.startDate,
                endDate: leave.endDate,
                reason: leave.reason,
                status: leave.status,
              }
            : null,
        };
      }

      if (req.type === 'ORG_SETTINGS') {
        const payload = req.payload as { name?: string; parentName?: string };
        return {
          ...base,
          orgSite: {
            orgUnitId: req.referenceId,
            name: payload?.name,
            parentName: payload?.parentName,
          },
        };
      }

      if (req.type === 'EXIT' && req.referenceId) {
        const separation = separationMap.get(req.referenceId);
        return {
          ...base,
          employee: separation?.employee
            ? {
                recordId: separation.employee.id,
                employeeId: separation.employee.employeeId,
                name: `${separation.employee.firstName} ${separation.employee.lastName}`,
                department: separation.employee.department,
                designation: separation.employee.designation,
              }
            : null,
          separation: separation
            ? {
                id: separation.id,
                reason: separation.reason,
                requestedLWD: separation.requestedLWD,
                approvedLWD: separation.approvedLWD,
                noticePeriodDays: separation.noticePeriodDays,
                status: separation.status,
              }
            : null,
        };
      }

      if (req.type === 'EMPLOYEE_CHANGE') {
        const p = req.payload as any;
        return {
          ...base,
          employee: {
            recordId: p?.employeeId,
            employeeId: p?.employeeCode,
            name: p?.employeeName,
            department: p?.changes?.department?.newValue || p?.changes?.department?.oldValue || '',
            designation: p?.changes?.designation?.newValue || p?.changes?.designation?.oldValue || '',
          },
          employeeChange: {
            id: req.referenceId || p?.changeRequestId,
            category: p?.category,
            effectiveDate: p?.effectiveDate,
            reason: p?.reason,
            changes: p?.changes,
          },
        };
      }

      return base;
    });

    let attendanceItems: any[] = [];
    const tenantId = scope.tenantId;
    if (tenantId) {
      try {
        const rules = await PolicyService.getActiveRules(tenantId);
        const reqs = ((rules as any).attendanceRequests || []).filter((r: any) => r.status === 'PENDING');
        if (reqs.length > 0) {
          const empIds = [...new Set(reqs.map((r: any) => r.employeeId))];
          const attEmps = await prisma.employee.findMany({
            where: { id: { in: empIds as string[] } },
            select: { id: true, employeeId: true, firstName: true, lastName: true, department: true, designation: true },
          });
          const attEmpMap = new Map(attEmps.map((e) => [e.id, e]));

          attendanceItems = reqs.map((r: any) => {
            const emp = attEmpMap.get(r.employeeId);
            return {
              id: `att-${r.id}`,
              type: r.type,
              status: 'PENDING',
              currentLevel: 1,
              maxLevel: 1,
              referenceId: r.id,
              orgUnit: null,
              createdAt: r.appliedAt,
              payload: {
                requestId: r.id,
                type: r.type,
                startDate: r.startDate,
                endDate: r.endDate,
                reason: r.reason,
                location: r.location,
                inTime: r.inTime,
                outTime: r.outTime,
              },
              employee: emp
                ? {
                    recordId: emp.id,
                    employeeId: emp.employeeId,
                    name: `${emp.firstName} ${emp.lastName}`,
                    department: emp.department,
                    designation: emp.designation,
                  }
                : null,
              attendanceRequest: r,
            };
          });
        }
      } catch (err) {}
    }

    return [...mappedInbox, ...attendanceItems];
  }

  static async getInbox(scope: OrgScopeContext, actor: { id?: string; role: string }) {
    const isHq = HQ_ROLES.has(actor.role);
    const isManager = actor.role === 'MANAGER';

    // Delegation check: has any user delegated approvals to this actor?
    let delegatorUsers: any[] = [];
    if (actor.id && scope.tenantId) {
      const delegatorIds = await DelegationService.getActiveDelegatorIdsForUser(scope.tenantId, actor.id);
      if (delegatorIds.length > 0) {
        delegatorUsers = await prisma.user.findMany({
          where: { id: { in: delegatorIds }, tenantId: scope.tenantId },
          select: { id: true, role: true, email: true, displayName: true },
        });
      }
    }
    const hasDelegatedHq = delegatorUsers.some((u) => HQ_ROLES.has(u.role));
    const hasDelegatedManager = delegatorUsers.some((u) => u.role === 'MANAGER');

    const effectiveHq = isHq || hasDelegatedHq;
    const effectiveManager = isManager || hasDelegatedManager;

    const requests = await prisma.approvalRequest.findMany({
      where: {
        tenantId: scope.tenantId || undefined,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        orgUnit: { select: { id: true, name: true, levelOrder: true, isLeaf: true } },
      },
    });

    return requests.filter((req) => {
      if (req.type === 'ORG_SETTINGS') {
        return effectiveHq && req.currentLevel === 3;
      }
      if (req.type === 'LEAVE') {
        if (effectiveHq) return true;
        if (effectiveManager && req.currentLevel <= 2) {
          if (!req.orgUnitId || scope.allowedOrgUnitIds === null || hasDelegatedManager) return true;
          return scope.allowedOrgUnitIds.includes(req.orgUnitId);
        }
        if (actor.role === 'EMPLOYEE' && !hasDelegatedManager && !hasDelegatedHq) return false;
        return req.currentLevel === 1 && (hasDelegatedManager || scope.allowedOrgUnitIds?.includes(req.orgUnitId || ''));
      }
      if (req.type === 'EXIT') {
        if (req.currentLevel === 2) return effectiveHq;
        if (effectiveManager && req.currentLevel === 1) {
          if (!req.orgUnitId || scope.allowedOrgUnitIds === null || hasDelegatedManager) return true;
          return scope.allowedOrgUnitIds.includes(req.orgUnitId);
        }
        return effectiveHq && req.currentLevel === 1;
      }
      return effectiveHq;
    });
  }

  static async actOnRequest(
    id: string,
    action: 'approve' | 'reject',
    actor: { id: string; role: string },
    scope: OrgScopeContext,
    remark?: string,
    approvedLWD?: string
  ) {
    if (id.startsWith('att-') || id.startsWith('req_')) {
      const realId = id.startsWith('att-') ? id.replace('att-', '') : id;
      const tenantId = scope.tenantId || 'default-tenant';
      const updated = await AttendanceService.updateAttendanceRequestStatus(
        tenantId,
        actor.id,
        realId,
        {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          adminRemark: remark,
        }
      );
      return { status: action === 'approve' ? 'APPROVED' : 'REJECTED', data: updated };
    }

    if (id.startsWith('ecr-')) {
      const realId = id.replace('ecr-', '');
      const changeStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
      const updated = await EmployeeChangeService.updateChangeRequestStatus(
        scope,
        realId,
        actor.id,
        changeStatus,
        remark
      );
      return { status: changeStatus, data: updated };
    }

    const request = await prisma.approvalRequest.findUnique({ where: { id } });
    if (!request || request.status !== 'PENDING') throw new Error('Approval request not found');

    const inbox = await this.getInbox(scope, actor);
    if (!inbox.find((r) => r.id === id)) throw new Error('Not authorized for this approval');

    if (action === 'reject') {
      await prisma.approvalRequest.update({
        where: { id },
        data: { status: 'REJECTED', payload: { ...(request.payload as object), remark } },
      });

      if (request.type === 'LEAVE' && request.referenceId) {
        const rejectedLeave = await prisma.leave.update({
          where: { id: request.referenceId },
          data: { status: 'REJECTED', processedBy: actor.id, processedAt: new Date(), adminRemark: remark },
        });
        await AttendanceService.syncLeaveToAttendance(
          request.tenantId,
          request.referenceId,
          rejectedLeave.employeeId,
          rejectedLeave.startDate,
          rejectedLeave.endDate,
          rejectedLeave.type,
          'REJECTED'
        ).catch(() => {});
      }

      if (request.type === 'EMPLOYEE_CHANGE' && request.referenceId) {
        await EmployeeChangeService.updateChangeRequestStatus(
          scope,
          request.referenceId,
          actor.id,
          'REJECTED',
          remark
        );
      }
      if (request.type === 'ORG_SETTINGS' && request.referenceId) {
        await prisma.orgUnit.delete({ where: { id: request.referenceId } }).catch(() => undefined);
      }
      if (request.type === 'EXIT' && request.referenceId) {
        await SeparationService.onExitRejected(request.referenceId, remark);
      }
      return { status: 'REJECTED' };
    }

    if (request.currentLevel < request.maxLevel) {
      if (request.type === 'EXIT' && request.referenceId) {
        await SeparationService.onExitManagerApproved(request.referenceId, remark);
      }
      await prisma.approvalRequest.update({
        where: { id },
        data: { currentLevel: request.currentLevel + 1 },
      });
      return { status: 'PENDING', currentLevel: request.currentLevel + 1 };
    }

    await prisma.approvalRequest.update({
      where: { id },
      data: { status: 'APPROVED', payload: { ...(request.payload as object), remark } },
    });

    if (request.type === 'LEAVE' && request.referenceId) {
      const approvedLeave = await prisma.leave.update({
        where: { id: request.referenceId },
        data: { status: 'APPROVED', processedBy: actor.id, processedAt: new Date(), adminRemark: remark },
      });
      await AttendanceService.syncLeaveToAttendance(
        request.tenantId,
        request.referenceId,
        approvedLeave.employeeId,
        approvedLeave.startDate,
        approvedLeave.endDate,
        approvedLeave.type,
        'APPROVED'
      ).catch(() => {});
    }
    if (request.type === 'ORG_SETTINGS' && request.referenceId) {
      await prisma.orgUnit.update({
        where: { id: request.referenceId },
        data: { status: 'ACTIVE' },
      });
    }
    if (request.type === 'EXIT' && request.referenceId) {
      const payload = request.payload as { requestedLWD?: string };
      const lwd = approvedLWD ? new Date(approvedLWD) : new Date(payload.requestedLWD || Date.now());
      await SeparationService.onExitApproved(request.referenceId, lwd, remark);
    }
    if (request.type === 'EMPLOYEE_CHANGE' && request.referenceId) {
      await EmployeeChangeService.updateChangeRequestStatus(
        scope,
        request.referenceId,
        actor.id,
        'APPROVED',
        remark
      );
    }

    return { status: 'APPROVED' };
  }
}
