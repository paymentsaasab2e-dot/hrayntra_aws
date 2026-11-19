import { OrgScopeContext } from '../../shared/org/org-scope.service';
import { ShiftCategory, TenantHrRules, DepartmentAttendancePolicy } from '../policies/policy-rules';
export interface EffectiveShiftInfo {
    code: string;
    name: string;
    timings: string;
    category?: ShiftCategory;
    startTime: string;
    endTime: string;
    firstSlotStartTime?: string;
    firstSlotEndTime?: string;
    secondSlotStartTime?: string;
    secondSlotEndTime?: string;
    isFlexiHours?: boolean;
    flexiMinHoursPerDay?: number;
    flexiWindowStartTime?: string;
    flexiWindowEndTime?: string;
    gracePeriodMinutes: number;
    halfDayThresholdHours: number;
    color: string;
    badgeClass: string;
    isWeeklyOff: boolean;
    weeklyOffReason?: string;
    isHoliday?: boolean;
    holidayName?: string;
    isOverride: boolean;
}
export type AttendanceRequestType = 'WFH' | 'ON_DUTY' | 'REGULARIZATION' | 'SHORT_LEAVE';
export interface AttendanceRequestItem {
    id: string;
    tenantId: string;
    employeeId: string;
    type: AttendanceRequestType;
    startDate: string;
    endDate: string;
    reason: string;
    location?: string;
    inTime?: string;
    outTime?: string;
    shortLeaveType?: 'EARLY_EXIT' | 'LATE_ENTRY';
    shortLeaveHours?: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    appliedAt: string;
    adminRemark?: string | null;
    processedAt?: string | null;
    processedBy?: string | null;
}
export type PunchOptions = {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    skipGeofence?: boolean;
    punchMode?: string;
    punchInTime?: string;
    punchOutTime?: string;
    ipAddress?: string;
    deviceInfo?: string;
    browser?: string;
    breakType?: string;
};
export declare class AttendanceService {
    static resolveEmployeeId(employeeId: string): Promise<string>;
    static loadEmployeeWithLocation(empId: string): Promise<{
        orgUnit: {
            tenantId: string;
        } | null;
        user: {
            tenantId: string | null;
        } | null;
        location: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string | null;
            orgUnitId: string | null;
            address: string | null;
            lat: number;
            lng: number;
            radiusMeters: number;
            isActive: boolean;
            usage: import(".prisma/client").$Enums.LocationUsage;
        } | null;
    } & {
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
    }>;
    static evaluateGeofence(employee: {
        location: any | null;
    }, coords: {
        lat: number;
        lng: number;
    } | null, skipGeofence: boolean): {
        allowed: boolean;
        distanceMeters: number | null;
        inside: boolean;
    };
    static resolveEffectiveAttendancePolicy(rules: TenantHrRules, department?: string): DepartmentAttendancePolicy;
    static getEffectiveShiftForDate(tenantId: string, employeeId: string, department: string, dateInput: Date | string): Promise<EffectiveShiftInfo>;
    static syncLeaveToAttendance(tenantId: string, leaveId: string, employeeId: string, startDate: Date | string, endDate: Date | string, leaveType: string, action: 'APPROVED' | 'REJECTED' | 'CANCELLED'): Promise<void>;
    static checkIn(employeeId: string, options?: PunchOptions): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        lat: number | null;
        lng: number | null;
        isActive: boolean;
        date: Date;
        distanceMeters: number | null;
        checkInTime: Date;
        checkOutTime: Date | null;
        punchStatus: import(".prisma/client").$Enums.AttendancePunchStatus;
        rejectionReason: string | null;
        punchMode: string | null;
    }>;
    static checkOut(id: string, options?: PunchOptions): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        lat: number | null;
        lng: number | null;
        isActive: boolean;
        date: Date;
        distanceMeters: number | null;
        checkInTime: Date;
        checkOutTime: Date | null;
        punchStatus: import(".prisma/client").$Enums.AttendancePunchStatus;
        rejectionReason: string | null;
        punchMode: string | null;
    }>;
    static startBreak(tenantId: string, employeeId: string, breakType?: string): Promise<any>;
    static endBreak(tenantId: string, employeeId: string): Promise<any>;
    static getTodayStatus(employeeId: string, tenantIdOverride?: string): Promise<{
        status: string;
        latest: {
            id: string;
            status: import(".prisma/client").$Enums.AttendanceStatus;
            createdAt: Date;
            updatedAt: Date;
            employeeId: string;
            lat: number | null;
            lng: number | null;
            isActive: boolean;
            date: Date;
            distanceMeters: number | null;
            checkInTime: Date;
            checkOutTime: Date | null;
            punchStatus: import(".prisma/client").$Enums.AttendancePunchStatus;
            rejectionReason: string | null;
            punchMode: string | null;
        } | null;
        isActive: boolean;
        onBreak: boolean;
        onLeave: boolean;
        leaveType: import(".prisma/client").$Enums.LeaveType | null;
        isWeeklyOff: boolean;
        weeklyOffReason: string | null;
        isHoliday: boolean;
        holidayName: string | null;
        currentBreak: {
            id: any;
            type: any;
            startTime: any;
            elapsedSeconds: number;
        } | null;
        todayBreaks: any;
        totalBreakMinutes: number;
        totalDurationMinutes: number;
        totalWorkedSeconds: number;
        activeSessionStart: string | null;
        checkInTime: string | null;
        checkOutTime: string | null;
        punchMode: string | null;
        segments: number;
        shiftInfo: {
            code: string;
            name: string;
            timings: string;
            startTime: string;
            endTime: string;
            gracePeriodMinutes: number;
            isWeeklyOff: boolean;
        };
        assignedLocation: {
            name: string;
            address: string | null;
            radiusMeters: number;
            lat: number;
            lng: number;
        } | null;
        webPunchPolicy: {
            allowed: boolean;
            validationMode: "BOTH" | "ANYWHERE" | "GPS_ONLY" | "IP_ONLY";
            officeIps: string[];
            allowRemote: boolean;
            isWfhToday: any;
        };
        quotaInfo: {
            enabled: boolean;
            monthlyQuota: number;
            monthlyUsed: number;
            remainingQuota: number;
            isExceeded: boolean;
            penaltyPolicy: "HALFDAY" | "REQUIRE_REGULARIZATION" | "MARK_ABSENT";
        } | {
            enabled: boolean;
            monthlyQuota: number;
            monthlyUsed: number;
            remainingQuota: number;
            isExceeded: boolean;
            penaltyPolicy: "HALFDAY" | "REQUIRE_REGULARIZATION" | "MARK_ABSENT";
        };
        reminders: {
            inPunch: string | null;
            outPunch: string | null;
        } | {
            inPunch: null;
            outPunch: null;
        };
    }>;
    static getHistory(employeeId?: string, scope?: OrgScopeContext): Promise<({
        employee: {
            email: string;
            employeeId: string;
            firstName: string;
            lastName: string;
            department: string;
            location: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string | null;
                orgUnitId: string | null;
                address: string | null;
                lat: number;
                lng: number;
                radiusMeters: number;
                isActive: boolean;
                usage: import(".prisma/client").$Enums.LocationUsage;
            } | null;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        lat: number | null;
        lng: number | null;
        isActive: boolean;
        date: Date;
        distanceMeters: number | null;
        checkInTime: Date;
        checkOutTime: Date | null;
        punchStatus: import(".prisma/client").$Enums.AttendancePunchStatus;
        rejectionReason: string | null;
        punchMode: string | null;
    })[]>;
    static submitAttendanceRequest(tenantId: string, userId: string, employeeId: string, data: {
        type: AttendanceRequestType;
        startDate: string;
        endDate?: string;
        reason: string;
        location?: string;
        inTime?: string;
        outTime?: string;
        shortLeaveType?: 'EARLY_EXIT' | 'LATE_ENTRY';
        shortLeaveHours?: number;
    }): Promise<AttendanceRequestItem>;
    static getAttendanceRequests(tenantId: string, filters?: {
        employeeId?: string;
        status?: string;
        type?: string;
    }): Promise<{
        employee: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
        } | {
            id: string;
            name: string;
            department: string;
            employeeId?: undefined;
            designation?: undefined;
        };
        id: string;
        tenantId: string;
        employeeId: string;
        type: AttendanceRequestType;
        startDate: string;
        endDate: string;
        reason: string;
        location?: string;
        inTime?: string;
        outTime?: string;
        shortLeaveType?: "EARLY_EXIT" | "LATE_ENTRY";
        shortLeaveHours?: number;
        status: "PENDING" | "APPROVED" | "REJECTED";
        appliedAt: string;
        adminRemark?: string | null;
        processedAt?: string | null;
        processedBy?: string | null;
    }[]>;
    static updateAttendanceRequestStatus(tenantId: string, userId: string, requestId: string, data: {
        status: 'APPROVED' | 'REJECTED';
        adminRemark?: string;
    }): Promise<AttendanceRequestItem>;
    static creditCompOffForAttendance(tenantId: string, userId: string, attendanceId: string): Promise<{
        success: boolean;
        attendanceId: string;
        employeeId: string;
        creditedDays: number;
        message: string;
    }>;
    static getMusterRoll(tenantId: string, options: {
        year?: number;
        month?: number;
        department?: string;
        employeeId?: string;
    }): Promise<{
        year: number;
        month: number;
        monthLabel: string;
        daysInMonth: number;
        daysHeader: any[];
        rows: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
            cells: {
                dateStr: any;
                statusCode: string;
                label: any;
                isWorked: boolean;
            }[];
            summary: {
                totalDaysInMonth: number;
                totalPresent: number;
                totalWfh: number;
                totalOd: number;
                totalLeaves: number;
                totalWeeklyOffs: number;
                totalHolidays: number;
                totalAbsent: number;
                payableDays: number;
            };
        }[];
    }>;
    static getLiveMonitoring(tenantId: string, options?: {
        department?: string;
        status?: string;
        search?: string;
    }): Promise<{
        summary: {
            totalEmployees: number;
            clockedInNow: number;
            onBreakNow: number;
            clockedOutToday: number;
            onLeaveToday: number;
            weeklyOffToday: number;
            notClockedInToday: number;
            webPunchEnabledCount: number;
        };
        employees: {
            id: string;
            employeeId: string;
            attendanceId: string | null;
            name: string;
            department: string;
            designation: string;
            webPunchAllowed: boolean;
            liveStatus: "ON_LEAVE" | "WEEK_OFF" | "HOLIDAY" | "WFH" | "ON_BREAK" | "CLOCKED_IN" | "CLOCKED_OUT" | "NOT_CLOCKED_IN";
            workedSecondsToday: number;
            workedFormatted: string;
            firstCheckIn: string | null;
            lastCheckOut: string | null;
            punchMode: string | null;
            rejectionReason: string | null;
            isFlexi: boolean;
            overtimeHours: number | null;
            isOffDayWork: boolean;
            isCompOffEligible: boolean;
            compOffDays: number;
            shortLeaveInfo: {
                type: any;
                hours: any;
                reason: any;
            } | null;
            currentBreak: any;
            todayBreaksCount: any;
            totalBreakMinutes: number;
            clientIp: any;
            accuracyMeters: any;
            isOfficeIp: any;
            isSuspicious: any;
            assignedLocation: string | null;
            onLeaveInfo: {
                type: import(".prisma/client").$Enums.LeaveType;
                startDate: Date;
                endDate: Date;
            } | null;
            holidayInfo: {
                name: string;
            } | null;
            shiftInfo: {
                code: string;
                name: string;
                category: ShiftCategory;
                timings: string;
                firstSlotStartTime: string | undefined;
                firstSlotEndTime: string | undefined;
                secondSlotStartTime: string | undefined;
                secondSlotEndTime: string | undefined;
                isWeeklyOff: boolean;
            };
        }[];
    }>;
    static getEmployeeWebPunchPermission(tenantId: string, employeeId: string): Promise<{
        employeeId: string;
        allowed: any;
        isOverridden: boolean;
        defaultAllowed: any;
    }>;
    static setEmployeeWebPunchPermission(tenantId: string, employeeId: string, allowed: boolean): Promise<{
        employeeId: string;
        allowed: boolean;
    }>;
    static getMonthlyAutoCheckoutCount(tenantId: string, employeeId: string, referenceDate?: Date): Promise<number>;
    static getTodayReminders(tenantId: string, rawEmployeeId: string, dateInput?: Date | string): Promise<{
        reminders: {
            inPunch: string | null;
            outPunch: string | null;
        };
        quotaInfo: {
            enabled: boolean;
            monthlyQuota: number;
            monthlyUsed: number;
            remainingQuota: number;
            isExceeded: boolean;
            penaltyPolicy: "HALFDAY" | "REQUIRE_REGULARIZATION" | "MARK_ABSENT";
        };
    }>;
    static runDailyAttendanceClosure(tenantId: string, dateInput?: Date | string): Promise<{
        date: string;
        autoCheckoutsWithinQuota: number;
        autoCheckoutsExceededQuota: number;
        autoAbsentsCreated: number;
        processedSessions: Array<{
            attendanceId: string;
            employeeId: string;
            employeeName: string;
            action: "AUTO_CHECKOUT_WITHIN_QUOTA" | "AUTO_CHECKOUT_EXCEEDED_QUOTA" | "AUTO_ABSENT";
            details: string;
        }>;
    }>;
}
