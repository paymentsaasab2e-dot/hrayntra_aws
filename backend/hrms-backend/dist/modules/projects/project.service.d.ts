import { OrgScopeContext } from '../../shared/org/org-scope.service';
export declare class ProjectService {
    static resolveEmployeeId(scope: OrgScopeContext, employeeId: string | undefined | null): Promise<string | null>;
    static getAll(scope: OrgScopeContext): Promise<({
        _count: {
            tasks: number;
        };
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        description: string | null;
        projectHeadId: string | null;
    })[]>;
    static getById(scope: OrgScopeContext, id: string): Promise<({
        tasks: ({
            employee: {
                id: string;
                status: import(".prisma/client").$Enums.EmployeeStatus;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                tenantId: string | null;
                orgUnitId: string | null;
                employeeId: string;
                firstName: string;
                lastName: string;
                userId: string | null;
                phone: string | null;
                designation: string;
                department: string;
                joiningDate: Date;
                locationId: string | null;
                reportsToUserId: string | null;
                totalLeaves: number;
                probationEndDate: Date | null;
            };
        } & {
            id: string;
            status: import(".prisma/client").$Enums.TaskStatus;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string | null;
            assignedTo: string;
            remarks: string | null;
            title: string;
            description: string | null;
            completedAt: Date | null;
            projectHeadId: string | null;
            assignedBy: string | null;
            assigneeIds: string[];
            isSelfTask: boolean;
            dueDate: Date | null;
            priority: import(".prisma/client").$Enums.TaskPriority;
            workDonePercent: number;
            extraDescriptions: import("@prisma/client/runtime/library").JsonValue | null;
            reminderDates: import("@prisma/client/runtime/library").JsonValue | null;
            reminderWeekdays: import("@prisma/client/runtime/library").JsonValue | null;
            scheduleType: import(".prisma/client").$Enums.TaskScheduleType;
            scheduledDate: Date | null;
            scheduledWeekday: string | null;
            tags: import("@prisma/client/runtime/library").JsonValue | null;
            approvalStatus: string | null;
            projectId: string | null;
        })[];
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        description: string | null;
        projectHeadId: string | null;
    }) | null>;
    static create(scope: OrgScopeContext, data: any): Promise<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        description: string | null;
        projectHeadId: string | null;
    }>;
    static update(scope: OrgScopeContext, id: string, data: any): Promise<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        description: string | null;
        projectHeadId: string | null;
    }>;
    static delete(scope: OrgScopeContext, id: string): Promise<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        description: string | null;
        projectHeadId: string | null;
    }>;
}
