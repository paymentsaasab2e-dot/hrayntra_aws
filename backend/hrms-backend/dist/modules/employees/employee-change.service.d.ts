import { OrgScopeContext } from '../../shared/org/org-scope.service';
import { ChangeRequestCategory, EmploymentChangeType, ApprovalRequestStatus } from '@prisma/client';
export declare class EmployeeChangeService {
    /**
     * Submit an employee profile or job change request for HR approval.
     */
    static submitChangeRequest(scope: OrgScopeContext, employeeId: string, requestedByUserId: string, data: {
        category?: ChangeRequestCategory;
        effectiveDate?: string | Date;
        reason: string;
        changes: Record<string, {
            oldValue: any;
            newValue: any;
        }>;
    }): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ApprovalRequestStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        employeeId: string;
        requestedByUserId: string;
        category: import(".prisma/client").$Enums.ChangeRequestCategory;
        effectiveDate: Date;
        reason: string;
        changes: import("@prisma/client/runtime/library").JsonValue;
        reviewedByUserId: string | null;
        reviewedAt: Date | null;
        reviewRemark: string | null;
    }>;
    /**
     * Get change requests with optional filters.
     */
    static getChangeRequests(scope: OrgScopeContext, options?: {
        employeeId?: string;
        status?: ApprovalRequestStatus;
    }): Promise<({
        employee: {
            id: string;
            orgUnit: {
                id: string;
                name: string;
            } | null;
            employeeId: string;
            firstName: string;
            lastName: string;
            designation: string;
            department: string;
            location: {
                id: string;
                name: string;
            } | null;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.ApprovalRequestStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        employeeId: string;
        requestedByUserId: string;
        category: import(".prisma/client").$Enums.ChangeRequestCategory;
        effectiveDate: Date;
        reason: string;
        changes: import("@prisma/client/runtime/library").JsonValue;
        reviewedByUserId: string | null;
        reviewedAt: Date | null;
        reviewRemark: string | null;
    })[]>;
    /**
     * Get single change request details.
     */
    static getChangeRequestById(scope: OrgScopeContext, id: string): Promise<({
        employee: {
            id: string;
            email: string;
            orgUnit: {
                id: string;
                name: string;
            } | null;
            employeeId: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            designation: string;
            department: string;
            location: {
                id: string;
                name: string;
            } | null;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.ApprovalRequestStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        employeeId: string;
        requestedByUserId: string;
        category: import(".prisma/client").$Enums.ChangeRequestCategory;
        effectiveDate: Date;
        reason: string;
        changes: import("@prisma/client/runtime/library").JsonValue;
        reviewedByUserId: string | null;
        reviewedAt: Date | null;
        reviewRemark: string | null;
    }) | null>;
    /**
     * Approve or reject an employee change request.
     * If approved: updates employee record and writes to EmploymentHistory.
     */
    static updateChangeRequestStatus(scope: OrgScopeContext, id: string, reviewedByUserId: string, action: 'APPROVED' | 'REJECTED', reviewRemark?: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ApprovalRequestStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        employeeId: string;
        requestedByUserId: string;
        category: import(".prisma/client").$Enums.ChangeRequestCategory;
        effectiveDate: Date;
        reason: string;
        changes: import("@prisma/client/runtime/library").JsonValue;
        reviewedByUserId: string | null;
        reviewedAt: Date | null;
        reviewRemark: string | null;
    }>;
    /**
     * Get all employment history records for an employee.
     * Auto-seeds INITIAL_HIRE from employee joining details if empty!
     */
    static getEmploymentHistory(scope: OrgScopeContext, employeeId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        orgUnitId: string | null;
        employeeId: string;
        designation: string;
        department: string;
        locationId: string | null;
        reportsToUserId: string | null;
        effectiveDate: Date;
        changeRequestId: string | null;
        endDate: Date | null;
        changeType: import(".prisma/client").$Enums.EmploymentChangeType;
        orgUnitName: string | null;
        locationName: string | null;
        reportsToName: string | null;
        remarks: string | null;
        recordedBy: string | null;
    }[]>;
    /**
     * Direct manual addition of a career milestone by HR.
     */
    static addEmploymentHistoryMilestone(scope: OrgScopeContext, employeeId: string, recordedBy: string, data: {
        changeType: EmploymentChangeType;
        effectiveDate: string | Date;
        designation: string;
        department: string;
        locationId?: string | null;
        orgUnitId?: string | null;
        reportsToUserId?: string | null;
        remarks?: string;
        updateActiveProfile?: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        orgUnitId: string | null;
        employeeId: string;
        designation: string;
        department: string;
        locationId: string | null;
        reportsToUserId: string | null;
        effectiveDate: Date;
        changeRequestId: string | null;
        endDate: Date | null;
        changeType: import(".prisma/client").$Enums.EmploymentChangeType;
        orgUnitName: string | null;
        locationName: string | null;
        reportsToName: string | null;
        remarks: string | null;
        recordedBy: string | null;
    }>;
    /**
     * Delete an employment history record (HR correction).
     */
    static deleteEmploymentHistoryMilestone(scope: OrgScopeContext, employeeId: string, historyId: string): Promise<{
        success: boolean;
    }>;
}
