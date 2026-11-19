import prisma from '../../shared/prisma';
import { PolicyService } from '../policies/policy.service';
import { ApprovalService } from '../approvals/approval.service';
import {
  addCalendarDays,
  calculateNoticePeriodDays,
  calculateShortfall,
  DEFAULT_EXIT_CHECKLIST,
} from './notice-calculator';

const ACTIVE_SEPARATION_STATUSES = ['SUBMITTED', 'MANAGER_APPROVED', 'ACCEPTED', 'IN_NOTICE', 'CLEARANCE_PENDING'] as const;

export class SeparationService {
  static async getExitPolicy(tenantId: string) {
    const active = await PolicyService.getActive(tenantId);
    return active.rules.exit;
  }

  static async getMine(userId: string) {
    const employee = await prisma.employee.findFirst({
      where: { userId },
      select: {
        id: true,
        joiningDate: true,
        probationEndDate: true,
        separationRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!employee) return null;

    const onboarding = await prisma.onboardingHire.findFirst({
      where: { employeeId: employee.id },
      select: { id: true, joinDate: true, status: true, name: true },
      orderBy: { createdAt: 'desc' },
    });

    const { separationRequests, ...employeeProfile } = employee;
    return {
      employee: employeeProfile,
      onboarding,
      separation: separationRequests[0] || null,
    };
  }

  static async list(tenantId: string, scopedEmployeeIds: string[] | null) {
    const where: any = { tenantId };
    if (scopedEmployeeIds !== null) {
      where.employeeId = { in: scopedEmployeeIds };
    }
    const rows = await prisma.separationRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
            email: true,
          },
        },
      },
    });
    return rows;
  }

  static async getById(id: string, tenantId: string) {
    const row = await prisma.separationRequest.findFirst({
      where: { id, tenantId },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
            email: true,
            userId: true,
            probationEndDate: true,
          },
        },
      },
    });
    if (!row) throw new Error('Separation request not found');
    return row;
  }

  static async createOrSubmit(
    userId: string,
    tenantId: string,
    data: { reason: string; requestedLWD: string; submit?: boolean }
  ) {
    const employee = await prisma.employee.findFirst({
      where: { userId },
      select: {
        id: true,
        orgUnitId: true,
        probationEndDate: true,
        status: true,
      },
    });
    if (!employee) throw new Error('Employee profile required');
    if (employee.status === 'TERMINATED') throw new Error('Employee already terminated');

    const existing = await prisma.separationRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: [...ACTIVE_SEPARATION_STATUSES] },
      },
    });
    if (existing) throw new Error('An active separation request already exists');

    const rules = await PolicyService.getActiveRules(tenantId);
    const noticePeriodDays = calculateNoticePeriodDays(rules, employee.probationEndDate);
    const requestedLWD = new Date(data.requestedLWD);
    const submit = data.submit !== false;

    const separation = await prisma.separationRequest.create({
      data: {
        tenantId,
        employeeId: employee.id,
        requesterUserId: userId,
        orgUnitId: employee.orgUnitId,
        exitType: 'RESIGNATION',
        reason: String(data.reason || '').trim(),
        requestedLWD,
        noticePeriodDays,
        checklist: DEFAULT_EXIT_CHECKLIST as any,
        status: submit ? 'SUBMITTED' : 'DRAFT',
        submittedAt: submit ? new Date() : null,
      },
    });

    if (submit) {
      await ApprovalService.createExitApproval({
        id: separation.id,
        tenantId,
        orgUnitId: employee.orgUnitId,
        requesterUserId: userId,
        requestedLWD,
        noticePeriodDays,
        reason: separation.reason,
      });
    }

    return separation;
  }

  static async withdraw(id: string, userId: string, tenantId: string) {
    const row = await this.getById(id, tenantId);
    const employee = await prisma.employee.findFirst({ where: { userId } });
    if (!employee || row.employeeId !== employee.id) throw new Error('Unauthorized');
    if (!['DRAFT', 'SUBMITTED'].includes(row.status)) {
      throw new Error('Cannot withdraw after manager review');
    }

    await prisma.approvalRequest.updateMany({
      where: { type: 'EXIT', referenceId: id, status: 'PENDING' },
      data: { status: 'REJECTED', payload: { withdrawn: true } },
    });

    return prisma.separationRequest.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    });
  }

  static async updateChecklist(
    id: string,
    tenantId: string,
    items: { label: string; done: boolean }[],
    actorUserId: string
  ) {
    const row = await this.getById(id, tenantId);
    const current = (row.checklist as any[]) || DEFAULT_EXIT_CHECKLIST;
    const updated = current.map((item) => {
      const patch = items.find((i) => i.label === item.label);
      if (!patch) return item;
      return {
        ...item,
        done: patch.done,
        doneAt: patch.done ? new Date().toISOString() : item.doneAt,
        doneBy: patch.done ? actorUserId : item.doneBy,
      };
    });

    const allDone = updated.every((i) => i.done);
    const lwd = row.approvedLWD || row.requestedLWD;
    const lwdPassed = new Date() >= new Date(lwd);
    let status = row.status;
    if (['ACCEPTED', 'IN_NOTICE'].includes(row.status) && lwdPassed) {
      status = 'CLEARANCE_PENDING';
    }
    if (allDone && lwdPassed && ['ACCEPTED', 'IN_NOTICE', 'CLEARANCE_PENDING'].includes(status)) {
      return this.completeExit(id, tenantId);
    }

    return prisma.separationRequest.update({
      where: { id },
      data: { checklist: updated as any, status },
    });
  }

  static async completeExit(id: string, tenantId: string) {
    const row = await this.getById(id, tenantId);
    const lwd = row.approvedLWD || row.requestedLWD;
    if (new Date() < new Date(lwd)) {
      throw new Error('Cannot complete before approved last working day');
    }

    await prisma.employee.update({
      where: { id: row.employeeId },
      data: { status: 'TERMINATED' },
    });

    if (row.employee.userId) {
      await prisma.user.update({
        where: { id: row.employee.userId },
        data: { status: 'INACTIVE' },
      });
    }

    return prisma.separationRequest.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  static async onExitApproved(
    separationId: string,
    approvedLWD: Date,
    hrRemark?: string
  ) {
    const row = await prisma.separationRequest.findUnique({ where: { id: separationId } });
    if (!row) throw new Error('Separation not found');

    const submittedAt = row.submittedAt || new Date();
    const expectedLWD = addCalendarDays(submittedAt, row.noticePeriodDays);
    const shortfall = calculateShortfall(expectedLWD, approvedLWD);

    const now = new Date();
    const status = approvedLWD <= now ? 'CLEARANCE_PENDING' : 'IN_NOTICE';

    return prisma.separationRequest.update({
      where: { id: separationId },
      data: {
        approvedLWD,
        noticeShortfallDays: shortfall > 0 ? shortfall : null,
        status,
        hrRemark: hrRemark || row.hrRemark,
      },
    });
  }

  static async onExitManagerApproved(separationId: string, managerRemark?: string) {
    return prisma.separationRequest.update({
      where: { id: separationId },
      data: { status: 'MANAGER_APPROVED', managerRemark: managerRemark || undefined },
    });
  }

  static async onExitRejected(separationId: string, remark?: string) {
    return prisma.separationRequest.update({
      where: { id: separationId },
      data: { status: 'REJECTED', hrRemark: remark || undefined },
    });
  }

  static async hasActiveSeparationInNotice(employeeId: string): Promise<boolean> {
    const row = await prisma.separationRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['ACCEPTED', 'IN_NOTICE', 'CLEARANCE_PENDING', 'MANAGER_APPROVED'] },
      },
    });
    return Boolean(row);
  }
}
