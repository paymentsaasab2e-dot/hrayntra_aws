"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const separation_service_1 = require("../separation/separation.service");
const policy_service_1 = require("../policies/policy.service");
const attendance_service_1 = require("../attendance/attendance.service");
const employee_change_service_1 = require("../employees/employee-change.service");
const LEAVE_DAYS_L2_THRESHOLD = 3;
const HQ_ROLES = new Set(['ADMIN', 'HR']);
class ApprovalService {
    static async createLeaveApproval(leave) {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const maxLevel = days > LEAVE_DAYS_L2_THRESHOLD ? 2 : 1;
        return prisma_1.default.approvalRequest.create({
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
    static async createExitApproval(data) {
        return prisma_1.default.approvalRequest.create({
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
    static async createOrgSiteRequest(data) {
        return prisma_1.default.approvalRequest.create({
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
    static async completeOrgSiteApproval(orgUnitId, approved) {
        const pending = await prisma_1.default.approvalRequest.findFirst({
            where: {
                type: 'ORG_SETTINGS',
                referenceId: orgUnitId,
                status: 'PENDING',
            },
        });
        if (!pending)
            return null;
        return prisma_1.default.approvalRequest.update({
            where: { id: pending.id },
            data: { status: approved ? 'APPROVED' : 'REJECTED' },
        });
    }
    static async getInboxEnriched(scope, actor) {
        const inbox = await this.getInbox(scope, actor);
        const leaveIds = inbox.filter((r) => r.type === 'LEAVE' && r.referenceId).map((r) => r.referenceId);
        const exitIds = inbox.filter((r) => r.type === 'EXIT' && r.referenceId).map((r) => r.referenceId);
        const leaves = leaveIds.length
            ? await prisma_1.default.leave.findMany({ where: { id: { in: leaveIds } } })
            : [];
        const leaveEmployeeIds = [...new Set(leaves.map((l) => l.employeeId))];
        const employees = leaveEmployeeIds.length
            ? await prisma_1.default.employee.findMany({
                where: { id: { in: leaveEmployeeIds } },
                select: { id: true, employeeId: true, firstName: true, lastName: true, department: true, designation: true },
            })
            : [];
        const employeeMap = new Map(employees.map((e) => [e.id, e]));
        const leaveMap = new Map(leaves.map((l) => [l.id, l]));
        const separations = exitIds.length
            ? await prisma_1.default.separationRequest.findMany({
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
                const payload = req.payload;
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
                const p = req.payload;
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
        let attendanceItems = [];
        const tenantId = scope.tenantId;
        if (tenantId) {
            try {
                const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
                const reqs = (rules.attendanceRequests || []).filter((r) => r.status === 'PENDING');
                if (reqs.length > 0) {
                    const empIds = [...new Set(reqs.map((r) => r.employeeId))];
                    const attEmps = await prisma_1.default.employee.findMany({
                        where: { id: { in: empIds } },
                        select: { id: true, employeeId: true, firstName: true, lastName: true, department: true, designation: true },
                    });
                    const attEmpMap = new Map(attEmps.map((e) => [e.id, e]));
                    attendanceItems = reqs.map((r) => {
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
            }
            catch (err) { }
        }
        return [...mappedInbox, ...attendanceItems];
    }
    static async getInbox(scope, actor) {
        const isHq = HQ_ROLES.has(actor.role);
        const isManager = actor.role === 'MANAGER';
        const requests = await prisma_1.default.approvalRequest.findMany({
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
                return isHq && req.currentLevel === 3;
            }
            if (req.type === 'LEAVE') {
                if (isHq)
                    return true;
                if (isManager && req.currentLevel <= 2) {
                    if (!req.orgUnitId || scope.allowedOrgUnitIds === null)
                        return true;
                    return scope.allowedOrgUnitIds.includes(req.orgUnitId);
                }
                if (actor.role === 'EMPLOYEE')
                    return false;
                return req.currentLevel === 1 && scope.allowedOrgUnitIds?.includes(req.orgUnitId || '');
            }
            if (req.type === 'EXIT') {
                if (req.currentLevel === 2)
                    return isHq;
                if (isManager && req.currentLevel === 1) {
                    if (!req.orgUnitId || scope.allowedOrgUnitIds === null)
                        return true;
                    return scope.allowedOrgUnitIds.includes(req.orgUnitId);
                }
                return isHq && req.currentLevel === 1;
            }
            return isHq;
        });
    }
    static async actOnRequest(id, action, actor, scope, remark, approvedLWD) {
        if (id.startsWith('att-') || id.startsWith('req_')) {
            const realId = id.startsWith('att-') ? id.replace('att-', '') : id;
            const tenantId = scope.tenantId || 'default-tenant';
            const updated = await attendance_service_1.AttendanceService.updateAttendanceRequestStatus(tenantId, actor.id, realId, {
                status: action === 'approve' ? 'APPROVED' : 'REJECTED',
                adminRemark: remark,
            });
            return { status: action === 'approve' ? 'APPROVED' : 'REJECTED', data: updated };
        }
        if (id.startsWith('ecr-')) {
            const realId = id.replace('ecr-', '');
            const changeStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
            const updated = await employee_change_service_1.EmployeeChangeService.updateChangeRequestStatus(scope, realId, actor.id, changeStatus, remark);
            return { status: changeStatus, data: updated };
        }
        const request = await prisma_1.default.approvalRequest.findUnique({ where: { id } });
        if (!request || request.status !== 'PENDING')
            throw new Error('Approval request not found');
        const inbox = await this.getInbox(scope, actor);
        if (!inbox.find((r) => r.id === id))
            throw new Error('Not authorized for this approval');
        if (action === 'reject') {
            await prisma_1.default.approvalRequest.update({
                where: { id },
                data: { status: 'REJECTED', payload: { ...request.payload, remark } },
            });
            if (request.type === 'LEAVE' && request.referenceId) {
                const rejectedLeave = await prisma_1.default.leave.update({
                    where: { id: request.referenceId },
                    data: { status: 'REJECTED', processedBy: actor.id, processedAt: new Date(), adminRemark: remark },
                });
                await attendance_service_1.AttendanceService.syncLeaveToAttendance(request.tenantId, request.referenceId, rejectedLeave.employeeId, rejectedLeave.startDate, rejectedLeave.endDate, rejectedLeave.type, 'REJECTED').catch(() => { });
            }
            if (request.type === 'EMPLOYEE_CHANGE' && request.referenceId) {
                await employee_change_service_1.EmployeeChangeService.updateChangeRequestStatus(scope, request.referenceId, actor.id, 'REJECTED', remark);
            }
            if (request.type === 'ORG_SETTINGS' && request.referenceId) {
                await prisma_1.default.orgUnit.delete({ where: { id: request.referenceId } }).catch(() => undefined);
            }
            if (request.type === 'EXIT' && request.referenceId) {
                await separation_service_1.SeparationService.onExitRejected(request.referenceId, remark);
            }
            return { status: 'REJECTED' };
        }
        if (request.currentLevel < request.maxLevel) {
            if (request.type === 'EXIT' && request.referenceId) {
                await separation_service_1.SeparationService.onExitManagerApproved(request.referenceId, remark);
            }
            await prisma_1.default.approvalRequest.update({
                where: { id },
                data: { currentLevel: request.currentLevel + 1 },
            });
            return { status: 'PENDING', currentLevel: request.currentLevel + 1 };
        }
        await prisma_1.default.approvalRequest.update({
            where: { id },
            data: { status: 'APPROVED', payload: { ...request.payload, remark } },
        });
        if (request.type === 'LEAVE' && request.referenceId) {
            const approvedLeave = await prisma_1.default.leave.update({
                where: { id: request.referenceId },
                data: { status: 'APPROVED', processedBy: actor.id, processedAt: new Date(), adminRemark: remark },
            });
            await attendance_service_1.AttendanceService.syncLeaveToAttendance(request.tenantId, request.referenceId, approvedLeave.employeeId, approvedLeave.startDate, approvedLeave.endDate, approvedLeave.type, 'APPROVED').catch(() => { });
        }
        if (request.type === 'ORG_SETTINGS' && request.referenceId) {
            await prisma_1.default.orgUnit.update({
                where: { id: request.referenceId },
                data: { status: 'ACTIVE' },
            });
        }
        if (request.type === 'EXIT' && request.referenceId) {
            const payload = request.payload;
            const lwd = approvedLWD ? new Date(approvedLWD) : new Date(payload.requestedLWD || Date.now());
            await separation_service_1.SeparationService.onExitApproved(request.referenceId, lwd, remark);
        }
        if (request.type === 'EMPLOYEE_CHANGE' && request.referenceId) {
            await employee_change_service_1.EmployeeChangeService.updateChangeRequestStatus(scope, request.referenceId, actor.id, 'APPROVED', remark);
        }
        return { status: 'APPROVED' };
    }
}
exports.ApprovalService = ApprovalService;
//# sourceMappingURL=approval.service.js.map