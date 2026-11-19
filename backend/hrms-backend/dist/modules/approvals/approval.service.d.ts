import { OrgScopeContext } from '../../shared/org/org-scope.service';
export declare class ApprovalService {
    static createLeaveApproval(leave: {
        id: string;
        employeeId: string;
        startDate: Date;
        endDate: Date;
        tenantId: string;
        orgUnitId?: string | null;
        requesterUserId?: string | null;
    }): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ApprovalRequestStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        orgUnitId: string | null;
        type: import(".prisma/client").$Enums.ApprovalRequestType;
        currentLevel: number;
        maxLevel: number;
        payload: import("@prisma/client/runtime/library").JsonValue;
        requesterId: string | null;
        referenceId: string | null;
    }>;
    static createExitApproval(data: {
        id: string;
        tenantId: string;
        orgUnitId?: string | null;
        requesterUserId?: string | null;
        requestedLWD: Date;
        noticePeriodDays: number;
        reason: string;
    }): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ApprovalRequestStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        orgUnitId: string | null;
        type: import(".prisma/client").$Enums.ApprovalRequestType;
        currentLevel: number;
        maxLevel: number;
        payload: import("@prisma/client/runtime/library").JsonValue;
        requesterId: string | null;
        referenceId: string | null;
    }>;
    static createOrgSiteRequest(data: {
        tenantId: string;
        orgUnitId: string;
        requesterId: string;
        name: string;
        parentName: string;
    }): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ApprovalRequestStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        orgUnitId: string | null;
        type: import(".prisma/client").$Enums.ApprovalRequestType;
        currentLevel: number;
        maxLevel: number;
        payload: import("@prisma/client/runtime/library").JsonValue;
        requesterId: string | null;
        referenceId: string | null;
    }>;
    static completeOrgSiteApproval(orgUnitId: string, approved: boolean): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ApprovalRequestStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        orgUnitId: string | null;
        type: import(".prisma/client").$Enums.ApprovalRequestType;
        currentLevel: number;
        maxLevel: number;
        payload: import("@prisma/client/runtime/library").JsonValue;
        requesterId: string | null;
        referenceId: string | null;
    } | null>;
    static getInboxEnriched(scope: OrgScopeContext, actor: {
        role: string;
    }): Promise<any[]>;
    static getInbox(scope: OrgScopeContext, actor: {
        role: string;
    }): Promise<({
        orgUnit: {
            id: string;
            name: string;
            levelOrder: number;
            isLeaf: boolean;
        } | null;
    } & {
        id: string;
        status: import(".prisma/client").$Enums.ApprovalRequestStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        orgUnitId: string | null;
        type: import(".prisma/client").$Enums.ApprovalRequestType;
        currentLevel: number;
        maxLevel: number;
        payload: import("@prisma/client/runtime/library").JsonValue;
        requesterId: string | null;
        referenceId: string | null;
    })[]>;
    static actOnRequest(id: string, action: 'approve' | 'reject', actor: {
        id: string;
        role: string;
    }, scope: OrgScopeContext, remark?: string, approvedLWD?: string): Promise<{
        status: string;
        data: import("../attendance/attendance.service").AttendanceRequestItem;
        currentLevel?: undefined;
    } | {
        status: string;
        data: {
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
        };
        currentLevel?: undefined;
    } | {
        status: string;
        data?: undefined;
        currentLevel?: undefined;
    } | {
        status: string;
        currentLevel: number;
        data?: undefined;
    }>;
}
