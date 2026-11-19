"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STANDARD_SHIFTS = exports.WORK_WEEK_OPTIONS = exports.DEFAULT_HR_RULES = exports.DEFAULT_MASTER_DATA = void 0;
exports.mergeRules = mergeRules;
exports.totalAnnualLeaveDays = totalAnnualLeaveDays;
exports.getSaturdayOccurrence = getSaturdayOccurrence;
exports.isDateWeekOff = isDateWeekOff;
exports.matchesIpAllowlist = matchesIpAllowlist;
exports.calculateEffectiveLeaveDays = calculateEffectiveLeaveDays;
exports.getMonthlySaturdayRoster = getMonthlySaturdayRoster;
exports.getMonthFullRoster = getMonthFullRoster;
exports.calculateLeaveBreakdown = calculateLeaveBreakdown;
exports.DEFAULT_MASTER_DATA = {
    departments: [
        { id: 'dept-eng', code: 'ENG', name: 'Engineering', description: 'Software engineering, tech infrastructure, and architecture', status: 'ACTIVE' },
        { id: 'dept-prod', code: 'PROD', name: 'Product & Design', description: 'Product management, UI/UX design, and user research', status: 'ACTIVE' },
        { id: 'dept-sales', code: 'SALES', name: 'Sales & BD', description: 'Enterprise sales, account management, and business development', status: 'ACTIVE' },
        { id: 'dept-mktg', code: 'MKTG', name: 'Marketing', description: 'Growth marketing, brand, content, and lead generation', status: 'ACTIVE' },
        { id: 'dept-hr', code: 'HR', name: 'Human Resources', description: 'Talent acquisition, employee engagement, payroll, and culture', status: 'ACTIVE' },
        { id: 'dept-fin', code: 'FIN', name: 'Finance & Accounts', description: 'Financial planning, accounting, compliance, and taxation', status: 'ACTIVE' },
        { id: 'dept-ops', code: 'OPS', name: 'Operations', description: 'Customer success, logistics, facilities, and administration', status: 'ACTIVE' },
    ],
    designations: [
        { id: 'desig-sde1', code: 'SDE-1', title: 'Software Engineer', departmentId: 'dept-eng', departmentName: 'Engineering', gradeId: 'grd-l1', gradeCode: 'L1', approvalLevel: 'NONE', status: 'ACTIVE' },
        { id: 'desig-sde2', code: 'SDE-2', title: 'Senior Software Engineer', departmentId: 'dept-eng', departmentName: 'Engineering', gradeId: 'grd-l2', gradeCode: 'L2', approvalLevel: 'NONE', status: 'ACTIVE' },
        { id: 'desig-tl', code: 'TL', title: 'Tech Lead', departmentId: 'dept-eng', departmentName: 'Engineering', gradeId: 'grd-l3', gradeCode: 'L3', approvalLevel: 'L1', status: 'ACTIVE' },
        { id: 'desig-em', code: 'EM', title: 'Engineering Manager', departmentId: 'dept-eng', departmentName: 'Engineering', gradeId: 'grd-l4', gradeCode: 'L4', approvalLevel: 'L2', status: 'ACTIVE' },
        { id: 'desig-pm', code: 'PM', title: 'Product Manager', departmentId: 'dept-prod', departmentName: 'Product & Design', gradeId: 'grd-l2', gradeCode: 'L2', approvalLevel: 'NONE', status: 'ACTIVE' },
        { id: 'desig-ae', code: 'AE', title: 'Account Executive', departmentId: 'dept-sales', departmentName: 'Sales & BD', gradeId: 'grd-l1', gradeCode: 'L1', approvalLevel: 'NONE', status: 'ACTIVE' },
        { id: 'desig-sm', code: 'SM', title: 'Sales Manager', departmentId: 'dept-sales', departmentName: 'Sales & BD', gradeId: 'grd-l3', gradeCode: 'L3', approvalLevel: 'L1', status: 'ACTIVE' },
        { id: 'desig-hre', code: 'HRE', title: 'HR Executive', departmentId: 'dept-hr', departmentName: 'Human Resources', gradeId: 'grd-l1', gradeCode: 'L1', approvalLevel: 'NONE', status: 'ACTIVE' },
        { id: 'desig-hrm', code: 'HRM', title: 'HR Manager', departmentId: 'dept-hr', departmentName: 'Human Resources', gradeId: 'grd-l3', gradeCode: 'L3', approvalLevel: 'L2', status: 'ACTIVE' },
        { id: 'desig-fa', code: 'FA', title: 'Financial Analyst', departmentId: 'dept-fin', departmentName: 'Finance & Accounts', gradeId: 'grd-l2', gradeCode: 'L2', approvalLevel: 'NONE', status: 'ACTIVE' },
        { id: 'desig-om', code: 'OM', title: 'Operations Lead', departmentId: 'dept-ops', departmentName: 'Operations', gradeId: 'grd-l3', gradeCode: 'L3', approvalLevel: 'L1', status: 'ACTIVE' },
    ],
    grades: [
        { id: 'grd-l1', code: 'L1', name: 'Junior Associate / Entry Level', minSalary: 350000, maxSalary: 700000, leaveQuota: 18, noticePeriodDays: 30, status: 'ACTIVE' },
        { id: 'grd-l2', code: 'L2', name: 'Mid-Level Professional', minSalary: 700000, maxSalary: 1400000, leaveQuota: 20, noticePeriodDays: 45, status: 'ACTIVE' },
        { id: 'grd-l3', code: 'L3', name: 'Senior Professional / Team Lead', minSalary: 1400000, maxSalary: 2500000, leaveQuota: 24, noticePeriodDays: 60, status: 'ACTIVE' },
        { id: 'grd-l4', code: 'L4', name: 'Principal / Functional Manager', minSalary: 2500000, maxSalary: 4500000, leaveQuota: 26, noticePeriodDays: 90, status: 'ACTIVE' },
        { id: 'grd-exec', code: 'M1', name: 'Director / Executive Leadership', minSalary: 4500000, maxSalary: 8000000, leaveQuota: 30, noticePeriodDays: 90, status: 'ACTIVE' },
    ],
    costCentres: [
        { id: 'cc-100', code: 'CC-100', name: 'Core Product & R&D', departmentId: 'dept-eng', departmentName: 'Engineering', annualBudget: 45000000, currency: 'INR', status: 'ACTIVE' },
        { id: 'cc-200', code: 'CC-200', name: 'Direct Sales & Growth', departmentId: 'dept-sales', departmentName: 'Sales & BD', annualBudget: 25000000, currency: 'INR', status: 'ACTIVE' },
        { id: 'cc-300', code: 'CC-300', name: 'Corporate & HR Operations', departmentId: 'dept-hr', departmentName: 'Human Resources', annualBudget: 15000000, currency: 'INR', status: 'ACTIVE' },
        { id: 'cc-400', code: 'CC-400', name: 'Finance & Compliance', departmentId: 'dept-fin', departmentName: 'Finance & Accounts', annualBudget: 10000000, currency: 'INR', status: 'ACTIVE' },
        { id: 'cc-500', code: 'CC-500', name: 'Customer Success & Support', departmentId: 'dept-ops', departmentName: 'Operations', annualBudget: 18000000, currency: 'INR', status: 'ACTIVE' },
    ],
};
exports.DEFAULT_HR_RULES = {
    leave: {
        annualCasualLeave: 15,
        annualSickLeave: 12,
        annualEarnedLeave: 12,
        carryForwardLimit: 5,
        leaveAdvanceNoticeDays: 3,
        maxConsecutiveLeaveDays: 15,
        autoApproveUnderDays: 2,
        excludeWeekendsFromLeave: true,
        sandwichLeaveRule: false,
    },
    workWeek: {
        pattern: 'FIVE_DAY',
        customWeekOffDays: [0, 6],
    },
    attendance: {
        workStartTime: '09:30',
        workEndTime: '18:30',
        gracePeriodMinutes: 15,
        lateMarkAfterMinutes: 30,
        halfDayThresholdHours: 4,
        allowRemotePunch: true,
        requireGeofence: true,
        allowWebPunch: true,
        webPunchValidation: 'ANYWHERE',
        officeIpAllowlist: ['127.0.0.1', '::1', 'localhost', '192.168.*', '10.*'],
        maxLocationAccuracyMeters: 500,
        allowedWebPunchDepartments: ['ALL'],
        enableAutoCheckout: true,
        autoCheckoutBufferMinutes: 60,
        monthlyAutoCheckoutQuota: 2,
        penaltyAfterQuotaExceeded: 'REQUIRE_REGULARIZATION',
        enableMissingPunchReminders: true,
        reminderInPunchGraceMinutes: 15,
        reminderOutPunchGraceMinutes: 15,
        autoMarkAbsentUnclocked: true,
        isFlexiHours: false,
        flexiWindowStartTime: '08:00',
        flexiWindowEndTime: '20:00',
        flexiMinHoursPerDay: 8,
        flexiCoreHoursStartTime: '11:00',
        flexiCoreHoursEndTime: '16:00',
        maxShortLeaveHours: 2,
        monthlyShortLeaveQuota: 2,
        departmentPolicies: {},
    },
    overtime: {
        enabled: true,
        minimumOtMinutes: 60,
        dailyMaxOtHours: 4,
        requiresApproval: false,
        enableCompOffForOffDayWork: true,
        compOffMinHoursForHalfDay: 4,
        compOffMinHoursForFullDay: 7,
    },
    exit: {
        standardNoticeDays: 30,
        probationNoticeDays: 15,
        probationMonths: 3,
        allowLeaveDuringNotice: false,
        requireExitInterview: true,
    },
    rosterSchedules: {
        defaultShift: 'GS',
        customShifts: [],
        departmentOverrides: {},
        employeeOverrides: {},
        cellOverrides: {},
    },
    attendanceRequests: [],
    attendanceBreaks: {},
    attendanceWebPunches: {},
    employeeWebPunchOverrides: {},
    compOffCredits: {},
    masterData: exports.DEFAULT_MASTER_DATA,
};
function mergeRules(partial) {
    if (!partial)
        return exports.DEFAULT_HR_RULES;
    return {
        leave: { ...exports.DEFAULT_HR_RULES.leave, ...(partial.leave || {}) },
        workWeek: { ...exports.DEFAULT_HR_RULES.workWeek, ...(partial.workWeek || {}) },
        attendance: { ...exports.DEFAULT_HR_RULES.attendance, ...(partial.attendance || {}) },
        overtime: { ...exports.DEFAULT_HR_RULES.overtime, ...(partial.overtime || {}) },
        exit: { ...exports.DEFAULT_HR_RULES.exit, ...(partial.exit || {}) },
        rosterSchedules: {
            ...(exports.DEFAULT_HR_RULES.rosterSchedules || {}),
            ...(partial.rosterSchedules || {}),
            customShifts: partial.rosterSchedules?.customShifts || exports.DEFAULT_HR_RULES.rosterSchedules?.customShifts || [],
        },
        attendanceRequests: partial.attendanceRequests || exports.DEFAULT_HR_RULES.attendanceRequests || [],
        attendanceBreaks: partial.attendanceBreaks || exports.DEFAULT_HR_RULES.attendanceBreaks || {},
        attendanceWebPunches: partial.attendanceWebPunches || exports.DEFAULT_HR_RULES.attendanceWebPunches || {},
        employeeWebPunchOverrides: partial.employeeWebPunchOverrides || exports.DEFAULT_HR_RULES.employeeWebPunchOverrides || {},
        compOffCredits: partial.compOffCredits || exports.DEFAULT_HR_RULES.compOffCredits || {},
        masterData: partial.masterData || exports.DEFAULT_HR_RULES.masterData || exports.DEFAULT_MASTER_DATA,
    };
}
function totalAnnualLeaveDays(rules) {
    return rules.leave.annualCasualLeave + rules.leave.annualSickLeave + rules.leave.annualEarnedLeave;
}
/**
 * Calculates which Saturday of the month a date is (1st, 2nd, 3rd, 4th, 5th Saturday).
 */
function getSaturdayOccurrence(date) {
    return Math.ceil(date.getDate() / 7);
}
/**
 * Checks whether a given calendar date is a scheduled Week-Off based on tenant workWeek policy.
 */
function isDateWeekOff(date, workWeek) {
    const pattern = workWeek?.pattern || 'FIVE_DAY';
    const customDays = workWeek?.customWeekOffDays || [0, 6];
    const day = date.getDay(); // 0 = Sun, 6 = Sat
    if (pattern === 'FIVE_DAY') {
        return day === 0 || day === 6;
    }
    if (pattern === 'SIX_DAY') {
        return day === 0;
    }
    if (pattern === 'ALTERNATE_SAT_2ND_4TH') {
        if (day === 0)
            return true;
        if (day === 6) {
            const occurrence = Math.ceil(date.getDate() / 7);
            return occurrence === 2 || occurrence === 4;
        }
        return false;
    }
    if (pattern === 'ALTERNATE_SAT_1ST_3RD') {
        if (day === 0)
            return true;
        if (day === 6) {
            const occurrence = Math.ceil(date.getDate() / 7);
            return occurrence === 1 || occurrence === 3;
        }
        return false;
    }
    if (pattern === 'CUSTOM') {
        return customDays.includes(day);
    }
    return day === 0 || day === 6;
}
/**
 * Validates a client IP address against a configured allowlist of IPs, subnets or wildcards.
 */
function matchesIpAllowlist(clientIp, allowlist) {
    if (!clientIp || !Array.isArray(allowlist) || allowlist.length === 0)
        return true;
    if (allowlist.includes('*') || allowlist.includes('ANY') || allowlist.includes('any'))
        return true;
    // Normalize IPv4-mapped IPv6 addresses, e.g. ::ffff:192.168.1.10 -> 192.168.1.10
    const cleanIp = clientIp.replace(/^::ffff:/, '').trim().toLowerCase();
    for (const pattern of allowlist) {
        const cleanPattern = pattern.replace(/^::ffff:/, '').trim().toLowerCase();
        if (cleanPattern === cleanIp)
            return true;
        if (cleanPattern === 'localhost' && (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost'))
            return true;
        // Wildcard support: e.g. 192.168.1.* or 10.0.*
        if (cleanPattern.endsWith('*')) {
            const prefix = cleanPattern.slice(0, -1);
            if (cleanIp.startsWith(prefix))
                return true;
        }
    }
    return false;
}
/**
 * Calculates real working days between two dates, excluding scheduled week-offs (e.g. alternate Saturdays, Sundays)
 * and optional gazetted public holidays unless sandwich rule is active.
 */
function calculateEffectiveLeaveDays(startDate, endDate, rules, holidayDates = new Set()) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalCalendarDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // If sandwich leave rule is enabled, or week-offs are not excluded:
    if (rules.leave.sandwichLeaveRule || !rules.leave.excludeWeekendsFromLeave) {
        return {
            totalCalendarDays,
            effectiveWorkingDays: totalCalendarDays,
            weekOffDays: 0,
            holidayDays: 0,
        };
    }
    let workingDays = 0;
    let weekOffs = 0;
    let holidays = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
        const isOff = isDateWeekOff(cursor, rules.workWeek);
        const dateStr = cursor.toISOString().slice(0, 10);
        const isHol = holidayDates.has(dateStr);
        if (isOff) {
            weekOffs += 1;
        }
        else if (isHol) {
            holidays += 1;
        }
        else {
            workingDays += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return {
        totalCalendarDays,
        effectiveWorkingDays: workingDays,
        weekOffDays: weekOffs,
        holidayDays: holidays,
    };
}
/**
 * Available Work Week / Weekend Roster pattern options for organizations.
 */
exports.WORK_WEEK_OPTIONS = [
    {
        key: 'FIVE_DAY',
        label: 'Complete Weekend Off (5-Day Work Week: Saturday & Sunday Off)',
        shortLabel: '5-Day (Sat & Sun Off)',
        description: 'Both Saturday and Sunday are complete weekly offs. Standard for software, IT, technology, and multinational corporations.',
        badge: 'Saturday & Sunday Off',
    },
    {
        key: 'ALTERNATE_SAT_2ND_4TH',
        label: 'Alternate Saturdays Off (2nd & 4th Saturday Off) — Indian Standard',
        shortLabel: 'Alternate Sat (2nd & 4th Off)',
        description: '2nd & 4th Saturdays and all Sundays are scheduled weekly offs. 1st, 3rd, and 5th Saturdays are active working days. Standard Indian Corporate & Banking (RBI) model.',
        badge: '2nd & 4th Sat Off + Sundays Off',
    },
    {
        key: 'ALTERNATE_SAT_1ST_3RD',
        label: 'Alternate Saturdays Off (1st & 3rd Saturday Off)',
        shortLabel: 'Alternate Sat (1st & 3rd Off)',
        description: '1st & 3rd Saturdays and all Sundays are weekly offs. 2nd, 4th, and 5th Saturdays are active working days.',
        badge: '1st & 3rd Sat Off + Sundays Off',
    },
    {
        key: 'SIX_DAY',
        label: '6-Day Work Week (Only Sunday Off — All Saturdays Working)',
        shortLabel: '6-Day (Sunday Only Off)',
        description: 'All Saturdays are full working days. Only Sunday is scheduled off. Standard for manufacturing, field operations, retail, and logistics.',
        badge: 'Sunday Only Off',
    },
    {
        key: 'CUSTOM',
        label: 'Custom Weekly Off Days',
        shortLabel: 'Custom Off Days',
        description: 'Customize specific days of the week as scheduled off days (e.g., Monday or Wednesday off for rotational support and hospital shifts).',
        badge: 'Custom Selected Days',
    },
];
exports.STANDARD_SHIFTS = [
    {
        code: 'GS',
        name: 'General Shift',
        category: 'GENERAL',
        shortLabel: 'General (09:30 - 18:30)',
        timings: '09:30 AM – 06:30 PM',
        startTime: '09:30',
        endTime: '18:30',
        color: '#0f172a',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    },
    {
        code: 'MS',
        name: 'Morning Shift',
        category: 'ROTATIONAL',
        shortLabel: 'Morning (06:00 - 14:30)',
        timings: '06:00 AM – 02:30 PM',
        startTime: '06:00',
        endTime: '14:30',
        color: '#0284c7',
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-300',
    },
    {
        code: 'ES',
        name: 'Evening Shift',
        category: 'ROTATIONAL',
        shortLabel: 'Evening (14:00 - 22:30)',
        timings: '02:00 PM – 10:30 PM',
        startTime: '14:00',
        endTime: '22:30',
        color: '#d97706',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    },
    {
        code: 'NS',
        name: 'Night Shift',
        category: 'NIGHT',
        shortLabel: 'Night (22:00 - 06:30)',
        timings: '10:00 PM – 06:30 AM',
        startTime: '22:00',
        endTime: '06:30',
        color: '#7c3aed',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-300',
    },
    {
        code: 'SS',
        name: 'Split Shift (Morning + Evening)',
        category: 'SPLIT',
        shortLabel: 'Split (10:00-14:00 & 17:00-21:00)',
        timings: '10:00 AM – 02:00 PM & 05:00 PM – 09:00 PM',
        startTime: '10:00',
        endTime: '21:00',
        firstSlotStartTime: '10:00',
        firstSlotEndTime: '14:00',
        secondSlotStartTime: '17:00',
        secondSlotEndTime: '21:00',
        color: '#0891b2',
        badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-300',
    },
    {
        code: 'WO',
        name: 'Weekly Off',
        shortLabel: 'Weekly Off / Alternate Sat',
        timings: 'Scheduled Off',
        startTime: '00:00',
        endTime: '00:00',
        color: '#059669',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
];
/**
 * Generates the Saturday roster for a given year and month (1-12) showing working vs off status.
 */
function getMonthlySaturdayRoster(year, month, workWeek) {
    const saturdays = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const checkDate = new Date(year, month - 1, d);
        if (checkDate.getDay() === 6) {
            const occurrence = Math.ceil(d / 7);
            const isOff = isDateWeekOff(checkDate, workWeek);
            const ordinals = ['1st', '2nd', '3rd', '4th', '5th'];
            saturdays.push({
                date: d,
                occurrence,
                isOff,
                label: `${ordinals[occurrence - 1] || `${occurrence}th`} Saturday`,
            });
        }
    }
    return saturdays;
}
/**
 * Generates a full month calendar roster with detailed working vs weekly off status for each day.
 */
function getMonthFullRoster(year, month, // 1 - 12
workWeek) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const ordinals = ['1st', '2nd', '3rd', '4th', '5th'];
    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const checkDate = new Date(year, month - 1, d);
        const day = checkDate.getDay();
        const isOff = isDateWeekOff(checkDate, workWeek);
        const isSat = day === 6;
        const isSun = day === 0;
        const occurrence = isSat ? Math.ceil(d / 7) : undefined;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        let offReason;
        if (isOff) {
            if (isSun)
                offReason = 'Sunday Weekly Off';
            else if (isSat)
                offReason = `${ordinals[(occurrence || 1) - 1] || `${occurrence}th`} Saturday Off`;
            else
                offReason = `${dayNames[day]} Scheduled Off`;
        }
        result.push({
            dateStr,
            dayOfMonth: d,
            dayOfWeek: day,
            dayName: dayNames[day],
            isOff,
            offReason,
            isSaturday: isSat,
            saturdayOccurrence: occurrence,
            isSunday: isSun,
        });
    }
    return result;
}
/**
 * Itemizes every calendar day between start and end date for leave preview and calculation.
 */
function calculateLeaveBreakdown(startDate, endDate, rules, holidayMap = new Map() // dateStr -> holiday name
) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const ordinals = ['1st', '2nd', '3rd', '4th', '5th'];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    let workingDays = 0;
    let weekOffs = 0;
    let holidays = 0;
    const breakdown = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        const dateStr = cursor.toISOString().slice(0, 10);
        const day = cursor.getDay();
        const dayName = dayNames[day];
        const isOff = isDateWeekOff(cursor, rules.workWeek);
        const holidayName = holidayMap.get(dateStr);
        if (rules.leave.sandwichLeaveRule || !rules.leave.excludeWeekendsFromLeave) {
            // Sandwich rule: even weekends count as leave
            breakdown.push({
                dateStr,
                dayName,
                status: 'WORKING',
                reason: 'Sandwich leave rule active (includes weekends)',
            });
            workingDays += 1;
        }
        else if (isOff) {
            weekOffs += 1;
            let reason = 'Weekly Off';
            if (day === 0)
                reason = 'Sunday Weekly Off';
            else if (day === 6) {
                const occ = Math.ceil(cursor.getDate() / 7);
                reason = `${ordinals[occ - 1] || `${occ}th`} Saturday Off`;
            }
            breakdown.push({
                dateStr,
                dayName,
                status: 'WEEK_OFF',
                reason,
            });
        }
        else if (holidayName) {
            holidays += 1;
            breakdown.push({
                dateStr,
                dayName,
                status: 'HOLIDAY',
                reason: holidayName,
            });
        }
        else {
            workingDays += 1;
            breakdown.push({
                dateStr,
                dayName,
                status: 'WORKING',
            });
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return {
        totalCalendarDays: breakdown.length,
        effectiveWorkingDays: workingDays,
        weekOffDays: weekOffs,
        holidayDays: holidays,
        breakdown,
    };
}
//# sourceMappingURL=policy-rules.js.map