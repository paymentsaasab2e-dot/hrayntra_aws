export type WorkWeekPattern = 'FIVE_DAY' | 'SIX_DAY' | 'ALTERNATE_SAT_2ND_4TH' | 'ALTERNATE_SAT_1ST_3RD' | 'CUSTOM';
export type WorkWeekConfig = {
    pattern: WorkWeekPattern;
    customWeekOffDays: number[];
};
export type DepartmentMaster = {
    id: string;
    code: string;
    name: string;
    description?: string;
    headEmployeeId?: string;
    headEmployeeName?: string;
    costCenterId?: string;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt?: string;
};
export type DesignationMaster = {
    id: string;
    code: string;
    title: string;
    departmentId?: string;
    departmentName?: string;
    gradeId?: string;
    gradeCode?: string;
    approvalLevel?: 'L1' | 'L2' | 'L3' | 'NONE';
    status: 'ACTIVE' | 'INACTIVE';
    createdAt?: string;
};
export type GradeMaster = {
    id: string;
    code: string;
    name: string;
    minSalary?: number;
    maxSalary?: number;
    leaveQuota?: number;
    noticePeriodDays?: number;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt?: string;
};
export type CostCentreMaster = {
    id: string;
    code: string;
    name: string;
    description?: string;
    departmentId?: string;
    departmentName?: string;
    annualBudget?: number;
    currency?: string;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt?: string;
};
export type MasterDataConfig = {
    departments: DepartmentMaster[];
    designations: DesignationMaster[];
    grades: GradeMaster[];
    costCentres: CostCentreMaster[];
};
export type DepartmentAttendancePolicy = {
    departmentId: string;
    departmentName?: string;
    workStartTime?: string;
    workEndTime?: string;
    gracePeriodMinutes?: number;
    lateMarkAfterMinutes?: number;
    halfDayThresholdHours?: number;
    allowRemotePunch?: boolean;
    requireGeofence?: boolean;
    allowWebPunch?: boolean;
    isFlexiHours?: boolean;
    flexiMinHoursPerDay?: number;
    flexiWindowStartTime?: string;
    flexiWindowEndTime?: string;
};
export type OvertimePolicyConfig = {
    enabled: boolean;
    minimumOtMinutes: number;
    dailyMaxOtHours: number;
    requiresApproval: boolean;
    enableCompOffForOffDayWork: boolean;
    compOffMinHoursForHalfDay: number;
    compOffMinHoursForFullDay: number;
};
export type TenantHrRules = {
    leave: {
        annualCasualLeave: number;
        annualSickLeave: number;
        annualEarnedLeave: number;
        carryForwardLimit: number;
        leaveAdvanceNoticeDays: number;
        maxConsecutiveLeaveDays: number;
        autoApproveUnderDays: number;
        excludeWeekendsFromLeave: boolean;
        sandwichLeaveRule: boolean;
    };
    workWeek: WorkWeekConfig;
    attendance: {
        workStartTime: string;
        workEndTime: string;
        gracePeriodMinutes: number;
        lateMarkAfterMinutes: number;
        halfDayThresholdHours: number;
        allowRemotePunch: boolean;
        requireGeofence: boolean;
        allowWebPunch?: boolean;
        webPunchValidation?: 'ANYWHERE' | 'GPS_ONLY' | 'IP_ONLY' | 'BOTH';
        officeIpAllowlist?: string[];
        maxLocationAccuracyMeters?: number;
        allowedWebPunchDepartments?: string[];
        enableAutoCheckout?: boolean;
        autoCheckoutBufferMinutes?: number;
        monthlyAutoCheckoutQuota?: number;
        penaltyAfterQuotaExceeded?: 'HALFDAY' | 'REQUIRE_REGULARIZATION' | 'MARK_ABSENT';
        enableMissingPunchReminders?: boolean;
        reminderInPunchGraceMinutes?: number;
        reminderOutPunchGraceMinutes?: number;
        autoMarkAbsentUnclocked?: boolean;
        isFlexiHours?: boolean;
        flexiWindowStartTime?: string;
        flexiWindowEndTime?: string;
        flexiMinHoursPerDay?: number;
        flexiCoreHoursStartTime?: string;
        flexiCoreHoursEndTime?: string;
        maxShortLeaveHours?: number;
        monthlyShortLeaveQuota?: number;
        departmentPolicies?: Record<string, DepartmentAttendancePolicy>;
    };
    overtime: OvertimePolicyConfig;
    exit: {
        standardNoticeDays: number;
        probationNoticeDays: number;
        probationMonths: number;
        allowLeaveDuringNotice: boolean;
        requireExitInterview: boolean;
    };
    rosterSchedules?: {
        defaultShift?: string;
        customShifts?: ShiftType[];
        departmentOverrides?: Record<string, {
            workWeek?: WorkWeekConfig;
            shiftCode?: string;
        }>;
        employeeOverrides?: Record<string, {
            workWeek?: WorkWeekConfig;
            shiftCode?: string;
        }>;
        cellOverrides?: Record<string, string>;
    };
    attendanceRequests?: any[];
    attendanceBreaks?: Record<string, any[]>;
    attendanceWebPunches?: Record<string, any>;
    employeeWebPunchOverrides?: Record<string, boolean>;
    compOffCredits?: Record<string, number>;
    masterData?: MasterDataConfig;
};
export declare const DEFAULT_MASTER_DATA: MasterDataConfig;
export declare const DEFAULT_HR_RULES: TenantHrRules;
export declare function mergeRules(partial?: Partial<TenantHrRules> | null): TenantHrRules;
export declare function totalAnnualLeaveDays(rules: TenantHrRules): number;
/**
 * Calculates which Saturday of the month a date is (1st, 2nd, 3rd, 4th, 5th Saturday).
 */
export declare function getSaturdayOccurrence(date: Date): number;
/**
 * Checks whether a given calendar date is a scheduled Week-Off based on tenant workWeek policy.
 */
export declare function isDateWeekOff(date: Date, workWeek?: Partial<WorkWeekConfig> | null): boolean;
/**
 * Validates a client IP address against a configured allowlist of IPs, subnets or wildcards.
 */
export declare function matchesIpAllowlist(clientIp: string, allowlist?: string[]): boolean;
/**
 * Calculates real working days between two dates, excluding scheduled week-offs (e.g. alternate Saturdays, Sundays)
 * and optional gazetted public holidays unless sandwich rule is active.
 */
export declare function calculateEffectiveLeaveDays(startDate: Date | string, endDate: Date | string, rules: TenantHrRules, holidayDates?: Set<string>): {
    totalCalendarDays: number;
    effectiveWorkingDays: number;
    weekOffDays: number;
    holidayDays: number;
};
/**
 * Available Work Week / Weekend Roster pattern options for organizations.
 */
export declare const WORK_WEEK_OPTIONS: {
    key: WorkWeekPattern;
    label: string;
    shortLabel: string;
    description: string;
    badge: string;
}[];
export type ShiftCategory = 'GENERAL' | 'NIGHT' | 'ROTATIONAL' | 'SPLIT';
export type ShiftType = {
    code: string;
    name: string;
    shortLabel: string;
    timings: string;
    color: string;
    badgeClass: string;
    category?: ShiftCategory;
    startTime?: string;
    endTime?: string;
    firstSlotStartTime?: string;
    firstSlotEndTime?: string;
    secondSlotStartTime?: string;
    secondSlotEndTime?: string;
    rotationCycleDays?: number;
    gracePeriodMinutes?: number;
    halfDayHours?: number;
    isCustom?: boolean;
};
export declare const STANDARD_SHIFTS: ShiftType[];
/**
 * Generates the Saturday roster for a given year and month (1-12) showing working vs off status.
 */
export declare function getMonthlySaturdayRoster(year: number, month: number, workWeek?: Partial<WorkWeekConfig> | null): {
    date: number;
    occurrence: number;
    isOff: boolean;
    label: string;
}[];
export type DayRosterDetail = {
    dateStr: string;
    dayOfMonth: number;
    dayOfWeek: number;
    dayName: string;
    isOff: boolean;
    offReason?: string;
    isSaturday: boolean;
    saturdayOccurrence?: number;
    isSunday: boolean;
};
/**
 * Generates a full month calendar roster with detailed working vs weekly off status for each day.
 */
export declare function getMonthFullRoster(year: number, month: number, // 1 - 12
workWeek?: Partial<WorkWeekConfig> | null): DayRosterDetail[];
export type LeaveDayItem = {
    dateStr: string;
    dayName: string;
    status: 'WORKING' | 'WEEK_OFF' | 'HOLIDAY';
    reason?: string;
};
/**
 * Itemizes every calendar day between start and end date for leave preview and calculation.
 */
export declare function calculateLeaveBreakdown(startDate: Date | string, endDate: Date | string, rules: TenantHrRules, holidayMap?: Map<string, string>): {
    totalCalendarDays: number;
    effectiveWorkingDays: number;
    weekOffDays: number;
    holidayDays: number;
    breakdown: LeaveDayItem[];
};
