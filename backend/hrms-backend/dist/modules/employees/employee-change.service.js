"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeChangeService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const org_scope_service_1 = require("../../shared/org/org-scope.service");
const tenant_scope_1 = require("../../shared/tenant/tenant-scope");
class EmployeeChangeService {
    /**
     * Submit an employee profile or job change request for HR approval.
     */
    static async submitChangeRequest(scope, employeeId, requestedByUserId, data) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        const employee = await prisma_1.default.employee.findFirst({
            where: { id: employeeId, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            include: {
                orgUnit: { select: { id: true, name: true } },
                location: { select: { id: true, name: true } },
            },
        });
        if (!employee) {
            throw new Error('Employee not found or access unauthorized');
        }
        if (!data.changes || Object.keys(data.changes).length === 0) {
            throw new Error('No field changes provided');
        }
        const effectiveDate = data.effectiveDate ? new Date(data.effectiveDate) : new Date();
        const category = data.category || 'JOB_ROLE';
        // Create the change request record
        const changeReq = await prisma_1.default.employeeChangeRequest.create({
            data: {
                tenantId,
                employeeId: employee.id,
                requestedByUserId,
                category,
                effectiveDate,
                reason: data.reason || 'Employee profile update request',
                changes: data.changes,
                status: 'PENDING',
            },
        });
        // Mirror to unified ApprovalRequest so it immediately shows up in /approvals hub
        await prisma_1.default.approvalRequest.create({
            data: {
                tenantId,
                type: 'EMPLOYEE_CHANGE',
                status: 'PENDING',
                currentLevel: 1,
                maxLevel: 1,
                referenceId: changeReq.id,
                orgUnitId: employee.orgUnitId || null,
                requesterId: requestedByUserId,
                payload: {
                    changeRequestId: changeReq.id,
                    employeeId: employee.id,
                    employeeCode: employee.employeeId,
                    employeeName: `${employee.firstName} ${employee.lastName}`,
                    category,
                    effectiveDate,
                    reason: data.reason,
                    changes: data.changes,
                },
            },
        });
        return changeReq;
    }
    /**
     * Get change requests with optional filters.
     */
    static async getChangeRequests(scope, options) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        const where = { tenantId };
        if (options?.employeeId) {
            where.employeeId = options.employeeId;
        }
        if (options?.status) {
            where.status = options.status;
        }
        const list = await prisma_1.default.employeeChangeRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        designation: true,
                        department: true,
                        orgUnit: { select: { id: true, name: true } },
                        location: { select: { id: true, name: true } },
                    },
                },
            },
        });
        return list;
    }
    /**
     * Get single change request details.
     */
    static async getChangeRequestById(scope, id) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        const item = await prisma_1.default.employeeChangeRequest.findFirst({
            where: { id, tenantId },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        designation: true,
                        department: true,
                        email: true,
                        phone: true,
                        orgUnit: { select: { id: true, name: true } },
                        location: { select: { id: true, name: true } },
                    },
                },
            },
        });
        return item;
    }
    /**
     * Approve or reject an employee change request.
     * If approved: updates employee record and writes to EmploymentHistory.
     */
    static async updateChangeRequestStatus(scope, id, reviewedByUserId, action, reviewRemark) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        const changeReq = await prisma_1.default.employeeChangeRequest.findFirst({
            where: { id, tenantId },
            include: {
                employee: {
                    include: {
                        orgUnit: { select: { id: true, name: true } },
                        location: { select: { id: true, name: true } },
                    },
                },
            },
        });
        if (!changeReq) {
            throw new Error('Employee change request not found');
        }
        if (changeReq.status !== 'PENDING') {
            throw new Error(`Change request is already ${changeReq.status}`);
        }
        const reviewedAt = new Date();
        if (action === 'REJECTED') {
            const updated = await prisma_1.default.employeeChangeRequest.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    reviewedByUserId,
                    reviewedAt,
                    reviewRemark: reviewRemark || 'Rejected by HR',
                },
            });
            // Update linked ApprovalRequest
            await prisma_1.default.approvalRequest.updateMany({
                where: { referenceId: id, type: 'EMPLOYEE_CHANGE' },
                data: {
                    status: 'REJECTED',
                    payload: {
                        ...(changeReq.changes || {}),
                        remark: reviewRemark || 'Rejected by HR',
                    },
                },
            });
            return updated;
        }
        // --- APPROVED FLOW ---
        const rawChanges = changeReq.changes || {};
        const employee = changeReq.employee;
        // Build payload of fields to update on Employee
        const employeeUpdates = {};
        const allowedFields = [
            'firstName',
            'lastName',
            'phone',
            'designation',
            'department',
            'locationId',
            'orgUnitId',
            'reportsToUserId',
            'probationEndDate',
            'totalLeaves',
        ];
        for (const key of allowedFields) {
            if (rawChanges[key] && rawChanges[key].newValue !== undefined) {
                let val = rawChanges[key].newValue;
                if (key === 'probationEndDate' && val) {
                    val = new Date(val);
                }
                employeeUpdates[key] = val;
            }
        }
        // Check if any job milestone field changed
        const jobMilestoneFields = ['designation', 'department', 'locationId', 'orgUnitId', 'reportsToUserId'];
        const hasJobMilestoneChange = jobMilestoneFields.some((f) => rawChanges[f] !== undefined);
        // Apply updates to Employee record
        if (Object.keys(employeeUpdates).length > 0) {
            await prisma_1.default.employee.update({
                where: { id: employee.id },
                data: employeeUpdates,
            });
        }
        // If job milestones changed, create an EmploymentHistory entry
        if (hasJobMilestoneChange) {
            const effectiveDate = changeReq.effectiveDate ? new Date(changeReq.effectiveDate) : new Date();
            // Determine Change Type
            let changeType = 'REVISION';
            if (rawChanges.designation) {
                changeType = 'PROMOTION';
            }
            else if (rawChanges.department || rawChanges.orgUnitId || rawChanges.locationId) {
                changeType = 'TRANSFER';
            }
            else if (rawChanges.reportsToUserId) {
                changeType = 'REPORTING_CHANGE';
            }
            // Resolve display names for historical stability
            const newOrgUnitId = employeeUpdates.orgUnitId || employee.orgUnitId;
            const newLocationId = employeeUpdates.locationId || employee.locationId;
            const newReportsToId = employeeUpdates.reportsToUserId || employee.reportsToUserId;
            let orgUnitName = employee.orgUnit?.name || null;
            if (employeeUpdates.orgUnitId && employeeUpdates.orgUnitId !== employee.orgUnitId) {
                const ou = await prisma_1.default.orgUnit.findUnique({ where: { id: employeeUpdates.orgUnitId }, select: { name: true } });
                orgUnitName = ou?.name || null;
            }
            let locationName = employee.location?.name || null;
            if (employeeUpdates.locationId && employeeUpdates.locationId !== employee.locationId) {
                const loc = await prisma_1.default.workLocation.findUnique({ where: { id: employeeUpdates.locationId }, select: { name: true } });
                locationName = loc?.name || null;
            }
            let reportsToName = null;
            if (newReportsToId) {
                const mgrUser = await prisma_1.default.user.findUnique({ where: { id: newReportsToId }, select: { displayName: true, email: true } });
                reportsToName = mgrUser?.displayName || mgrUser?.email || null;
            }
            // Close previous history entry's endDate if any
            const dayBefore = new Date(effectiveDate);
            dayBefore.setDate(dayBefore.getDate() - 1);
            await prisma_1.default.employmentHistory.updateMany({
                where: {
                    employeeId: employee.id,
                    endDate: null,
                    effectiveDate: { lt: effectiveDate },
                },
                data: { endDate: dayBefore },
            });
            // Insert new milestone
            await prisma_1.default.employmentHistory.create({
                data: {
                    tenantId,
                    employeeId: employee.id,
                    changeType,
                    effectiveDate,
                    designation: employeeUpdates.designation || employee.designation,
                    department: employeeUpdates.department || employee.department,
                    orgUnitId: newOrgUnitId || null,
                    orgUnitName,
                    locationId: newLocationId || null,
                    locationName,
                    reportsToUserId: newReportsToId || null,
                    reportsToName,
                    remarks: reviewRemark || changeReq.reason || `Approved ${changeType.toLowerCase()} change`,
                    changeRequestId: changeReq.id,
                    recordedBy: reviewedByUserId,
                },
            });
        }
        // Update EmployeeChangeRequest status
        const approvedChangeReq = await prisma_1.default.employeeChangeRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                reviewedByUserId,
                reviewedAt,
                reviewRemark: reviewRemark || 'Approved by HR',
            },
        });
        // Update linked ApprovalRequest
        await prisma_1.default.approvalRequest.updateMany({
            where: { referenceId: id, type: 'EMPLOYEE_CHANGE' },
            data: {
                status: 'APPROVED',
            },
        });
        return approvedChangeReq;
    }
    // ─────────────────────────────────────────────────────────────
    // EMPLOYMENT HISTORY METHODS
    // ─────────────────────────────────────────────────────────────
    /**
     * Get all employment history records for an employee.
     * Auto-seeds INITIAL_HIRE from employee joining details if empty!
     */
    static async getEmploymentHistory(scope, employeeId) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        const employee = await prisma_1.default.employee.findFirst({
            where: { id: employeeId, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            include: {
                orgUnit: { select: { id: true, name: true } },
                location: { select: { id: true, name: true } },
            },
        });
        if (!employee) {
            throw new Error('Employee not found or unauthorized');
        }
        let history = await prisma_1.default.employmentHistory.findMany({
            where: { employeeId: employee.id, tenantId },
            orderBy: { effectiveDate: 'desc' },
        });
        // If no history exists yet, auto-seed the INITIAL_HIRE record!
        if (history.length === 0) {
            let reportsToName = null;
            if (employee.reportsToUserId) {
                const mgr = await prisma_1.default.user.findUnique({
                    where: { id: employee.reportsToUserId },
                    select: { displayName: true, email: true },
                });
                reportsToName = mgr?.displayName || mgr?.email || null;
            }
            const initialHire = await prisma_1.default.employmentHistory.create({
                data: {
                    tenantId,
                    employeeId: employee.id,
                    changeType: 'INITIAL_HIRE',
                    effectiveDate: employee.joiningDate || new Date(),
                    designation: employee.designation,
                    department: employee.department,
                    orgUnitId: employee.orgUnitId || null,
                    orgUnitName: employee.orgUnit?.name || null,
                    locationId: employee.locationId || null,
                    locationName: employee.location?.name || null,
                    reportsToUserId: employee.reportsToUserId || null,
                    reportsToName,
                    remarks: 'Joined the organization (Initial Hire record)',
                },
            });
            history = [initialHire];
        }
        return history;
    }
    /**
     * Direct manual addition of a career milestone by HR.
     */
    static async addEmploymentHistoryMilestone(scope, employeeId, recordedBy, data) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        const employee = await prisma_1.default.employee.findFirst({
            where: { id: employeeId, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            include: {
                orgUnit: { select: { id: true, name: true } },
                location: { select: { id: true, name: true } },
            },
        });
        if (!employee) {
            throw new Error('Employee not found or unauthorized');
        }
        const effectiveDate = new Date(data.effectiveDate);
        // Resolve display names
        let orgUnitName = employee.orgUnit?.name || null;
        if (data.orgUnitId) {
            const ou = await prisma_1.default.orgUnit.findUnique({ where: { id: data.orgUnitId }, select: { name: true } });
            orgUnitName = ou?.name || null;
        }
        let locationName = employee.location?.name || null;
        if (data.locationId) {
            const loc = await prisma_1.default.workLocation.findUnique({ where: { id: data.locationId }, select: { name: true } });
            locationName = loc?.name || null;
        }
        let reportsToName = null;
        if (data.reportsToUserId) {
            const mgr = await prisma_1.default.user.findUnique({
                where: { id: data.reportsToUserId },
                select: { displayName: true, email: true },
            });
            reportsToName = mgr?.displayName || mgr?.email || null;
        }
        // Close previous open history
        const dayBefore = new Date(effectiveDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        await prisma_1.default.employmentHistory.updateMany({
            where: {
                employeeId: employee.id,
                endDate: null,
                effectiveDate: { lt: effectiveDate },
            },
            data: { endDate: dayBefore },
        });
        const milestone = await prisma_1.default.employmentHistory.create({
            data: {
                tenantId,
                employeeId: employee.id,
                changeType: data.changeType,
                effectiveDate,
                designation: data.designation,
                department: data.department,
                orgUnitId: data.orgUnitId || null,
                orgUnitName,
                locationId: data.locationId || null,
                locationName,
                reportsToUserId: data.reportsToUserId || null,
                reportsToName,
                remarks: data.remarks || `Recorded ${data.changeType.toLowerCase()}`,
                recordedBy,
            },
        });
        // If updateActiveProfile requested or effective date is today or past, update employee
        if (data.updateActiveProfile || effectiveDate <= new Date()) {
            await prisma_1.default.employee.update({
                where: { id: employee.id },
                data: {
                    designation: data.designation,
                    department: data.department,
                    orgUnitId: data.orgUnitId !== undefined ? data.orgUnitId : undefined,
                    locationId: data.locationId !== undefined ? data.locationId : undefined,
                    reportsToUserId: data.reportsToUserId !== undefined ? data.reportsToUserId : undefined,
                },
            });
        }
        return milestone;
    }
    /**
     * Delete an employment history record (HR correction).
     */
    static async deleteEmploymentHistoryMilestone(scope, employeeId, historyId) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        const record = await prisma_1.default.employmentHistory.findFirst({
            where: { id: historyId, employeeId, tenantId },
        });
        if (!record) {
            throw new Error('Employment history record not found');
        }
        await prisma_1.default.employmentHistory.delete({ where: { id: historyId } });
        return { success: true };
    }
}
exports.EmployeeChangeService = EmployeeChangeService;
//# sourceMappingURL=employee-change.service.js.map