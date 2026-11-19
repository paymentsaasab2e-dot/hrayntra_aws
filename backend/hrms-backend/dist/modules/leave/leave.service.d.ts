import { OrgScopeContext } from '../../shared/org/org-scope.service';
import { TenantHrRules, ShiftType, WorkWeekPattern, WorkWeekConfig } from '../policies/policy-rules';
export declare class LeaveService {
    static resolveEmployeeId(employeeId: string): Promise<string>;
    static calculateUsedLeaves(employeeId: string, rules?: TenantHrRules | null, holidayDates?: Set<string>): Promise<number>;
    static resolveTenantIdForEmployee(employee: {
        tenantId?: string | null;
        orgUnitId?: string | null;
        user?: {
            tenantId?: string | null;
        } | null;
    }): Promise<string | null>;
    static getLeaveBalance(employeeId: string): Promise<{
        total: number;
        used: number;
        remaining: number;
        compOffCredits?: undefined;
        policy?: undefined;
        workWeek?: undefined;
    } | {
        total: any;
        used: number;
        remaining: number;
        compOffCredits: any;
        policy: {
            annualCasualLeave: number;
            annualSickLeave: number;
            annualEarnedLeave: number;
            carryForwardLimit: number;
            leaveAdvanceNoticeDays: number;
            maxConsecutiveLeaveDays: number;
            autoApproveUnderDays: number;
            excludeWeekendsFromLeave: boolean;
            sandwichLeaveRule: boolean;
        } | null;
        workWeek: WorkWeekConfig | null;
    }>;
    static creditCompOff(tenantId: string, userId: string, employeeId: string, days?: number): Promise<{
        success: boolean;
        employeeId: string;
        creditedDays: number;
        totalCompOffBalance: any;
    }>;
    static apply(data: any): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.LeaveStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        reason: string;
        type: import(".prisma/client").$Enums.LeaveType;
        endDate: Date;
        startDate: Date;
        appliedAt: Date;
        processedBy: string | null;
        processedAt: Date | null;
        adminRemark: string | null;
    }>;
    static updateStatus(id: string, status: any, processedBy: string, adminRemark?: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.LeaveStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        reason: string;
        type: import(".prisma/client").$Enums.LeaveType;
        endDate: Date;
        startDate: Date;
        appliedAt: Date;
        processedBy: string | null;
        processedAt: Date | null;
        adminRemark: string | null;
    } | {
        id: string;
        status: string;
        adminRemark: string | undefined;
        processedBy: string;
        attendanceRequest: import("../attendance/attendance.service").AttendanceRequestItem;
    }>;
    static getByEmployee(employeeId: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.LeaveStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        reason: string;
        type: import(".prisma/client").$Enums.LeaveType;
        endDate: Date;
        startDate: Date;
        appliedAt: Date;
        processedBy: string | null;
        processedAt: Date | null;
        adminRemark: string | null;
    }[]>;
    static getAll(filters?: any, scope?: OrgScopeContext): Promise<{
        employee: {
            id: string;
            email: string;
            employeeId: string;
            firstName: string;
            lastName: string;
            department: string;
        } | null;
        id: string;
        status: import(".prisma/client").$Enums.LeaveStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        reason: string;
        type: import(".prisma/client").$Enums.LeaveType;
        endDate: Date;
        startDate: Date;
        appliedAt: Date;
        processedBy: string | null;
        processedAt: Date | null;
        adminRemark: string | null;
    }[]>;
    static cancel(id: string, employeeId: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.LeaveStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        reason: string;
        type: import(".prisma/client").$Enums.LeaveType;
        endDate: Date;
        startDate: Date;
        appliedAt: Date;
        processedBy: string | null;
        processedAt: Date | null;
        adminRemark: string | null;
    } | {
        id: string;
        cancelled: boolean;
    }>;
    static getWorkWeekRoster(tenantId: string, year?: number, month?: number): Promise<{
        workWeek: WorkWeekConfig;
        currentOption: {
            key: WorkWeekPattern;
            label: string;
            shortLabel: string;
            description: string;
            badge: string;
        };
        options: {
            key: WorkWeekPattern;
            label: string;
            shortLabel: string;
            description: string;
            badge: string;
        }[];
        targetYear: number;
        targetMonth: number;
        saturdays: {
            date: number;
            occurrence: number;
            isOff: boolean;
            label: string;
        }[];
        calendarDays: {
            isHoliday: boolean;
            holidayName: string | null;
            effectiveStatus: string;
            dateStr: string;
            dayOfMonth: number;
            dayOfWeek: number;
            dayName: string;
            isOff: boolean;
            offReason?: string;
            isSaturday: boolean;
            saturdayOccurrence?: number;
            isSunday: boolean;
        }[];
        sandwichLeaveRule: boolean;
        excludeWeekendsFromLeave: boolean;
        summary: {
            totalDays: number;
            workingDays: number;
            weeklyOffDays: number;
            holidayDays: number;
            saturdaysOff: number;
            saturdaysWorking: number;
        };
    }>;
    static updateWorkWeekRoster(tenantId: string, userId: string, data: {
        pattern: WorkWeekPattern;
        customWeekOffDays?: number[];
    }): Promise<{
        workWeek: WorkWeekConfig;
        currentOption: {
            key: WorkWeekPattern;
            label: string;
            shortLabel: string;
            description: string;
            badge: string;
        };
        options: {
            key: WorkWeekPattern;
            label: string;
            shortLabel: string;
            description: string;
            badge: string;
        }[];
        targetYear: number;
        targetMonth: number;
        saturdays: {
            date: number;
            occurrence: number;
            isOff: boolean;
            label: string;
        }[];
        calendarDays: {
            isHoliday: boolean;
            holidayName: string | null;
            effectiveStatus: string;
            dateStr: string;
            dayOfMonth: number;
            dayOfWeek: number;
            dayName: string;
            isOff: boolean;
            offReason?: string;
            isSaturday: boolean;
            saturdayOccurrence?: number;
            isSunday: boolean;
        }[];
        sandwichLeaveRule: boolean;
        excludeWeekendsFromLeave: boolean;
        summary: {
            totalDays: number;
            workingDays: number;
            weeklyOffDays: number;
            holidayDays: number;
            saturdaysOff: number;
            saturdaysWorking: number;
        };
    }>;
    static calculateDaysBreakdown(tenantId: string, startDate: string, endDate: string, overridePattern?: WorkWeekPattern): Promise<{
        totalCalendarDays: number;
        effectiveWorkingDays: number;
        weekOffDays: number;
        holidayDays: number;
        breakdown: import("../policies/policy-rules").LeaveDayItem[];
    }>;
    static getRosterGrid(tenantId: string, options: {
        year?: number;
        month?: number;
        view?: 'weekly' | 'monthly';
        weekIndex?: number;
        department?: string;
        search?: string;
    }): Promise<{
        targetYear: number;
        targetMonth: number;
        view: "weekly" | "monthly";
        weekIndex: number;
        daysHeader: {
            dateStr: string;
            dayOfMonth: number;
            dayOfWeek: number;
            dayName: string;
            isSaturday: boolean;
            saturdayOccurrence: number | undefined;
            isSunday: boolean;
            isHoliday: boolean;
            holidayName: string | null;
            label: string;
        }[];
        rows: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
            assignedPattern: any;
            assignedShift: any;
            cells: {
                dateStr: string;
                status: any;
                label: any;
                color: string;
                badgeClass: string;
                isOverride: boolean;
            }[];
        }[];
        shifts: ShiftType[];
        departments: string[];
        summary: {
            totalEmployees: number;
            totalWeekOffs: number;
            totalWorkingShifts: number;
            totalLeaves: number;
            totalHolidays: number;
        };
    }>;
    static getShifts(tenantId: string): Promise<ShiftType[]>;
    static createOrUpdateShift(tenantId: string, userId: string, shiftData: Partial<ShiftType>): Promise<ShiftType[]>;
    static deleteShift(tenantId: string, userId: string, code: string): Promise<ShiftType[]>;
    static bulkAssignRoster(tenantId: string, userId: string, data: {
        employeeIds?: string[];
        department?: string;
        pattern: WorkWeekPattern;
        shiftCode?: string;
        customWeekOffDays?: number[];
        applyToAll?: boolean;
    }): Promise<{
        targetYear: number;
        targetMonth: number;
        view: "weekly" | "monthly";
        weekIndex: number;
        daysHeader: {
            dateStr: string;
            dayOfMonth: number;
            dayOfWeek: number;
            dayName: string;
            isSaturday: boolean;
            saturdayOccurrence: number | undefined;
            isSunday: boolean;
            isHoliday: boolean;
            holidayName: string | null;
            label: string;
        }[];
        rows: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
            assignedPattern: any;
            assignedShift: any;
            cells: {
                dateStr: string;
                status: any;
                label: any;
                color: string;
                badgeClass: string;
                isOverride: boolean;
            }[];
        }[];
        shifts: ShiftType[];
        departments: string[];
        summary: {
            totalEmployees: number;
            totalWeekOffs: number;
            totalWorkingShifts: number;
            totalLeaves: number;
            totalHolidays: number;
        };
    }>;
    static overrideRosterCell(tenantId: string, userId: string, data: {
        employeeId: string;
        dateStr: string;
        shiftCode: string;
    }): Promise<{
        key: string;
        shiftCode: string;
    }>;
    static createRosterSchedule(tenantId: string, userId: string, data: {
        employeeIds?: string[];
        department?: string;
        applyToAll?: boolean;
        startDate: string;
        endDate: string;
        shiftCode: string;
        workingDays?: number[];
        saturdayRule?: 'ALL_WORKING' | '2ND_4TH_OFF' | '1ST_3RD_OFF' | 'ALL_OFF';
    }): Promise<{
        success: boolean;
        employeesCount: number;
        daysCount: number;
        dateRange: {
            startDate: string;
            endDate: string;
        };
        shiftCode: string;
        saturdayRule: "ALL_WORKING" | "2ND_4TH_OFF" | "1ST_3RD_OFF" | "ALL_OFF";
        workWeekPattern: "FIVE_DAY" | "SIX_DAY" | "ALTERNATE_SAT_2ND_4TH" | "ALTERNATE_SAT_1ST_3RD";
        message: string;
    }>;
}
