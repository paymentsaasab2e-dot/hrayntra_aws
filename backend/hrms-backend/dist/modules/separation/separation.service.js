"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeparationService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const policy_service_1 = require("../policies/policy.service");
const approval_service_1 = require("../approvals/approval.service");
const notice_calculator_1 = require("./notice-calculator");
const ACTIVE_SEPARATION_STATUSES = ['SUBMITTED', 'MANAGER_APPROVED', 'ACCEPTED', 'IN_NOTICE', 'CLEARANCE_PENDING'];
class SeparationService {
    static async getExitPolicy(tenantId) {
        const active = await policy_service_1.PolicyService.getActive(tenantId);
        return active.rules.exit;
    }
    static async getMine(userId) {
        const employee = await prisma_1.default.employee.findFirst({
            where: { userId },
            select: {
                id: true,
                joiningDate: true,
                probationEndDate: true,
                separationRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
        });
        if (!employee)
            return null;
        const onboarding = await prisma_1.default.onboardingHire.findFirst({
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
    static async list(tenantId, scopedEmployeeIds) {
        const where = { tenantId };
        if (scopedEmployeeIds !== null) {
            where.employeeId = { in: scopedEmployeeIds };
        }
        const rows = await prisma_1.default.separationRequest.findMany({
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
    static async getById(id, tenantId) {
        const row = await prisma_1.default.separationRequest.findFirst({
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
        if (!row)
            throw new Error('Separation request not found');
        return row;
    }
    static async createOrSubmit(userId, tenantId, data) {
        const employee = await prisma_1.default.employee.findFirst({
            where: { userId },
            select: {
                id: true,
                orgUnitId: true,
                probationEndDate: true,
                status: true,
            },
        });
        if (!employee)
            throw new Error('Employee profile required');
        if (employee.status === 'TERMINATED')
            throw new Error('Employee already terminated');
        const existing = await prisma_1.default.separationRequest.findFirst({
            where: {
                employeeId: employee.id,
                status: { in: [...ACTIVE_SEPARATION_STATUSES] },
            },
        });
        if (existing)
            throw new Error('An active separation request already exists');
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const noticePeriodDays = (0, notice_calculator_1.calculateNoticePeriodDays)(rules, employee.probationEndDate);
        const requestedLWD = new Date(data.requestedLWD);
        const submit = data.submit !== false;
        const separation = await prisma_1.default.separationRequest.create({
            data: {
                tenantId,
                employeeId: employee.id,
                requesterUserId: userId,
                orgUnitId: employee.orgUnitId,
                exitType: 'RESIGNATION',
                reason: String(data.reason || '').trim(),
                requestedLWD,
                noticePeriodDays,
                checklist: notice_calculator_1.DEFAULT_EXIT_CHECKLIST,
                status: submit ? 'SUBMITTED' : 'DRAFT',
                submittedAt: submit ? new Date() : null,
            },
        });
        if (submit) {
            await approval_service_1.ApprovalService.createExitApproval({
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
    static async withdraw(id, userId, tenantId) {
        const row = await this.getById(id, tenantId);
        const employee = await prisma_1.default.employee.findFirst({ where: { userId } });
        if (!employee || row.employeeId !== employee.id)
            throw new Error('Unauthorized');
        if (!['DRAFT', 'SUBMITTED'].includes(row.status)) {
            throw new Error('Cannot withdraw after manager review');
        }
        await prisma_1.default.approvalRequest.updateMany({
            where: { type: 'EXIT', referenceId: id, status: 'PENDING' },
            data: { status: 'REJECTED', payload: { withdrawn: true } },
        });
        return prisma_1.default.separationRequest.update({
            where: { id },
            data: { status: 'WITHDRAWN' },
        });
    }
    static async updateChecklist(id, tenantId, items, actorUserId) {
        const row = await this.getById(id, tenantId);
        const current = row.checklist || notice_calculator_1.DEFAULT_EXIT_CHECKLIST;
        const updated = current.map((item) => {
            const patch = items.find((i) => i.label === item.label);
            if (!patch)
                return item;
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
        return prisma_1.default.separationRequest.update({
            where: { id },
            data: { checklist: updated, status },
        });
    }
    static async completeExit(id, tenantId) {
        const row = await this.getById(id, tenantId);
        const lwd = row.approvedLWD || row.requestedLWD;
        if (new Date() < new Date(lwd)) {
            throw new Error('Cannot complete before approved last working day');
        }
        await prisma_1.default.employee.update({
            where: { id: row.employeeId },
            data: { status: 'TERMINATED' },
        });
        if (row.employee.userId) {
            await prisma_1.default.user.update({
                where: { id: row.employee.userId },
                data: { status: 'INACTIVE' },
            });
        }
        return prisma_1.default.separationRequest.update({
            where: { id },
            data: { status: 'COMPLETED', completedAt: new Date() },
        });
    }
    static async onExitApproved(separationId, approvedLWD, hrRemark) {
        const row = await prisma_1.default.separationRequest.findUnique({ where: { id: separationId } });
        if (!row)
            throw new Error('Separation not found');
        const submittedAt = row.submittedAt || new Date();
        const expectedLWD = (0, notice_calculator_1.addCalendarDays)(submittedAt, row.noticePeriodDays);
        const shortfall = (0, notice_calculator_1.calculateShortfall)(expectedLWD, approvedLWD);
        const now = new Date();
        const status = approvedLWD <= now ? 'CLEARANCE_PENDING' : 'IN_NOTICE';
        return prisma_1.default.separationRequest.update({
            where: { id: separationId },
            data: {
                approvedLWD,
                noticeShortfallDays: shortfall > 0 ? shortfall : null,
                status,
                hrRemark: hrRemark || row.hrRemark,
            },
        });
    }
    static async onExitManagerApproved(separationId, managerRemark) {
        return prisma_1.default.separationRequest.update({
            where: { id: separationId },
            data: { status: 'MANAGER_APPROVED', managerRemark: managerRemark || undefined },
        });
    }
    static async onExitRejected(separationId, remark) {
        return prisma_1.default.separationRequest.update({
            where: { id: separationId },
            data: { status: 'REJECTED', hrRemark: remark || undefined },
        });
    }
    static async hasActiveSeparationInNotice(employeeId) {
        const row = await prisma_1.default.separationRequest.findFirst({
            where: {
                employeeId,
                status: { in: ['ACCEPTED', 'IN_NOTICE', 'CLEARANCE_PENDING', 'MANAGER_APPROVED'] },
            },
        });
        return Boolean(row);
    }
}
exports.SeparationService = SeparationService;
//# sourceMappingURL=separation.service.js.map