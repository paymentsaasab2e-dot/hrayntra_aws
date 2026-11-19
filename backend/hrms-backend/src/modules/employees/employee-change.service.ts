import prisma from '../../shared/prisma';
import { OrgScopeContext, employeeWhereFromScope } from '../../shared/org/org-scope.service';
import { requireTenantId } from '../../shared/tenant/tenant-scope';
import { ChangeRequestCategory, EmploymentChangeType, ApprovalRequestStatus } from '@prisma/client';
export class EmployeeChangeService {
  /**
   * Helper: resolve employee by either Mongo ObjectId or employeeId code
   */
  private static async resolveEmployee(scope: OrgScopeContext, employeeId: string) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(employeeId);
    const employee = await prisma.employee.findFirst({
      where: {
        ...(isObjectId ? { id: employeeId } : { employeeId }),
        ...employeeWhereFromScope(scope),
      },
      include: {
        orgUnit: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });
    if (!employee) {
      throw new Error('Employee not found or access unauthorized');
    }
    return employee;
  }

  /**
   * Submit an employee profile or job change request for HR approval.
   */
  static async submitChangeRequest(
    scope: OrgScopeContext,
    employeeId: string,
    requestedByUserId: string,
    data: {
      category?: ChangeRequestCategory;
      effectiveDate?: string | Date;
      reason: string;
      changes: Record<string, { oldValue: any; newValue: any }>;
    }
  ) {
    const tenantId = requireTenantId(scope);
    const employee = await this.resolveEmployee(scope, employeeId);

    if (!data.changes || Object.keys(data.changes).length === 0) {
      throw new Error('No field changes provided');
    }

    const effectiveDate = data.effectiveDate ? new Date(data.effectiveDate) : new Date();
    const category: ChangeRequestCategory = data.category || 'JOB_ROLE';

    // Create the change request record
    const changeReq = await prisma.employeeChangeRequest.create({
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
    await prisma.approvalRequest.create({
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
  static async getChangeRequests(
    scope: OrgScopeContext,
    options?: { employeeId?: string; status?: ApprovalRequestStatus }
  ) {
    const tenantId = requireTenantId(scope);
    const where: any = { tenantId };

    if (options?.employeeId) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(options.employeeId);
      if (isObjectId) {
        where.employeeId = options.employeeId;
      } else {
        const emp = await prisma.employee.findFirst({
          where: { employeeId: options.employeeId, tenantId },
          select: { id: true },
        });
        where.employeeId = emp ? emp.id : options.employeeId;
      }
    }
    if (options?.status) {
      where.status = options.status;
    }

    const list = await prisma.employeeChangeRequest.findMany({
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
  static async getChangeRequestById(scope: OrgScopeContext, id: string) {
    const tenantId = requireTenantId(scope);
    const item = await prisma.employeeChangeRequest.findFirst({
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
  static async updateChangeRequestStatus(
    scope: OrgScopeContext,
    id: string,
    reviewedByUserId: string,
    action: 'APPROVED' | 'REJECTED',
    reviewRemark?: string
  ) {
    const tenantId = requireTenantId(scope);
    const changeReq = await prisma.employeeChangeRequest.findFirst({
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
      const updated = await prisma.employeeChangeRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedByUserId,
          reviewedAt,
          reviewRemark: reviewRemark || 'Rejected by HR',
        },
      });

      // Update linked ApprovalRequest
      await prisma.approvalRequest.updateMany({
        where: { referenceId: id, type: 'EMPLOYEE_CHANGE' },
        data: {
          status: 'REJECTED',
          payload: {
            ...((changeReq.changes as object) || {}),
            remark: reviewRemark || 'Rejected by HR',
          },
        },
      });

      return updated;
    }

    // --- APPROVED FLOW ---
    const rawChanges = (changeReq.changes as Record<string, { oldValue: any; newValue: any }>) || {};
    const employee = changeReq.employee;

    // Build payload of fields to update on Employee
    const employeeUpdates: Record<string, any> = {};
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

    // Merge any custom field changes into employee customFields
    const currentCustomFields = (employee.customFields as Record<string, any>) || {};
    const updatedCustomFields = { ...currentCustomFields };
    let hasCustomFieldChanges = false;

    if (rawChanges.customFields && typeof rawChanges.customFields.newValue === 'object') {
      Object.assign(updatedCustomFields, rawChanges.customFields.newValue);
      hasCustomFieldChanges = true;
    }

    for (const [key, val] of Object.entries(rawChanges)) {
      if (!allowedFields.includes(key) && key !== 'customFields' && val && (val as any).newValue !== undefined) {
        updatedCustomFields[key] = (val as any).newValue;
        hasCustomFieldChanges = true;
      }
    }

    if (hasCustomFieldChanges) {
      employeeUpdates.customFields = updatedCustomFields;
    }

    // Check if any job milestone field changed
    const jobMilestoneFields = ['designation', 'department', 'locationId', 'orgUnitId', 'reportsToUserId'];
    const hasJobMilestoneChange = jobMilestoneFields.some((f) => rawChanges[f] !== undefined);

    // Apply updates to Employee record
    if (Object.keys(employeeUpdates).length > 0) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: employeeUpdates,
      });
    }

    // If job milestones changed, create an EmploymentHistory entry
    if (hasJobMilestoneChange) {
      const effectiveDate = changeReq.effectiveDate ? new Date(changeReq.effectiveDate) : new Date();

      // Determine Change Type
      let changeType: EmploymentChangeType = 'REVISION';
      if (rawChanges.designation) {
        changeType = 'PROMOTION';
      } else if (rawChanges.department || rawChanges.orgUnitId || rawChanges.locationId) {
        changeType = 'TRANSFER';
      } else if (rawChanges.reportsToUserId) {
        changeType = 'REPORTING_CHANGE';
      }

      // Resolve display names for historical stability
      const newOrgUnitId = employeeUpdates.orgUnitId || employee.orgUnitId;
      const newLocationId = employeeUpdates.locationId || employee.locationId;
      const newReportsToId = employeeUpdates.reportsToUserId || employee.reportsToUserId;

      let orgUnitName = employee.orgUnit?.name || null;
      if (employeeUpdates.orgUnitId && employeeUpdates.orgUnitId !== employee.orgUnitId) {
        const ou = await prisma.orgUnit.findUnique({ where: { id: employeeUpdates.orgUnitId }, select: { name: true } });
        orgUnitName = ou?.name || null;
      }

      let locationName = employee.location?.name || null;
      if (employeeUpdates.locationId && employeeUpdates.locationId !== employee.locationId) {
        const loc = await prisma.workLocation.findUnique({ where: { id: employeeUpdates.locationId }, select: { name: true } });
        locationName = loc?.name || null;
      }

      let reportsToName: string | null = null;
      if (newReportsToId) {
        const mgrUser = await prisma.user.findUnique({ where: { id: newReportsToId }, select: { displayName: true, email: true } });
        reportsToName = mgrUser?.displayName || mgrUser?.email || null;
      }

      // Close previous history entry's endDate if any
      const dayBefore = new Date(effectiveDate);
      dayBefore.setDate(dayBefore.getDate() - 1);

      await prisma.employmentHistory.updateMany({
        where: {
          employeeId: employee.id,
          endDate: null,
          effectiveDate: { lt: effectiveDate },
        },
        data: { endDate: dayBefore },
      });

      // Insert new milestone
      await prisma.employmentHistory.create({
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
    const approvedChangeReq = await prisma.employeeChangeRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedByUserId,
        reviewedAt,
        reviewRemark: reviewRemark || 'Approved by HR',
      },
    });

    // Update linked ApprovalRequest
    await prisma.approvalRequest.updateMany({
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
  static async getEmploymentHistory(scope: OrgScopeContext, employeeId: string) {
    const tenantId = requireTenantId(scope);
    const employee = await this.resolveEmployee(scope, employeeId);

    let history = await prisma.employmentHistory.findMany({
      where: { employeeId: employee.id, tenantId },
      orderBy: { effectiveDate: 'desc' },
    });

    // If no history exists yet, auto-seed the INITIAL_HIRE record!
    if (history.length === 0) {
      let reportsToName: string | null = null;
      if (employee.reportsToUserId) {
        const mgr = await prisma.user.findUnique({
          where: { id: employee.reportsToUserId },
          select: { displayName: true, email: true },
        });
        reportsToName = mgr?.displayName || mgr?.email || null;
      }

      const initialHire = await prisma.employmentHistory.create({
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
  static async addEmploymentHistoryMilestone(
    scope: OrgScopeContext,
    employeeId: string,
    recordedBy: string,
    data: {
      changeType: EmploymentChangeType;
      effectiveDate: string | Date;
      designation: string;
      department: string;
      locationId?: string | null;
      orgUnitId?: string | null;
      reportsToUserId?: string | null;
      remarks?: string;
      updateActiveProfile?: boolean;
    }
  ) {
    const tenantId = requireTenantId(scope);
    const employee = await this.resolveEmployee(scope, employeeId);

    const effectiveDate = new Date(data.effectiveDate);

    // Resolve display names
    let orgUnitName = employee.orgUnit?.name || null;
    if (data.orgUnitId) {
      const ou = await prisma.orgUnit.findUnique({ where: { id: data.orgUnitId }, select: { name: true } });
      orgUnitName = ou?.name || null;
    }

    let locationName = employee.location?.name || null;
    if (data.locationId) {
      const loc = await prisma.workLocation.findUnique({ where: { id: data.locationId }, select: { name: true } });
      locationName = loc?.name || null;
    }

    let reportsToName: string | null = null;
    if (data.reportsToUserId) {
      const mgr = await prisma.user.findUnique({
        where: { id: data.reportsToUserId },
        select: { displayName: true, email: true },
      });
      reportsToName = mgr?.displayName || mgr?.email || null;
    }

    // Close previous open history
    const dayBefore = new Date(effectiveDate);
    dayBefore.setDate(dayBefore.getDate() - 1);

    await prisma.employmentHistory.updateMany({
      where: {
        employeeId: employee.id,
        endDate: null,
        effectiveDate: { lt: effectiveDate },
      },
      data: { endDate: dayBefore },
    });

    const milestone = await prisma.employmentHistory.create({
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
      await prisma.employee.update({
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
  static async deleteEmploymentHistoryMilestone(
    scope: OrgScopeContext,
    employeeId: string,
    historyId: string
  ) {
    const tenantId = requireTenantId(scope);
    const employee = await this.resolveEmployee(scope, employeeId);
    const record = await prisma.employmentHistory.findFirst({
      where: { id: historyId, employeeId: employee.id, tenantId },
    });

    if (!record) {
      throw new Error('Employment history record not found');
    }

    await prisma.employmentHistory.delete({ where: { id: historyId } });
    return { success: true };
  }
}
