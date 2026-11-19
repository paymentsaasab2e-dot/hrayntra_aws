"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const org_scope_service_1 = require("../../shared/org/org-scope.service");
const approval_service_1 = require("../approvals/approval.service");
const policy_service_1 = require("../policies/policy.service");
const attendance_service_1 = require("../attendance/attendance.service");
const policy_rules_1 = require("../policies/policy-rules");
const separation_service_1 = require("../separation/separation.service");
class LeaveService {
    static async resolveEmployeeId(employeeId) {
        if (!employeeId)
            throw new Error("Employee ID is required");
        if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
            return employeeId;
        }
        const emp = await prisma_1.default.employee.findUnique({ where: { employeeId } });
        if (!emp)
            throw new Error(`Employee with ID ${employeeId} not found`);
        return emp.id;
    }
    static async calculateUsedLeaves(employeeId, rules, holidayDates = new Set()) {
        const empId = await this.resolveEmployeeId(employeeId);
        const approvedLeaves = await prisma_1.default.leave.findMany({
            where: {
                employeeId: empId,
                status: 'APPROVED'
            }
        });
        let totalUsed = 0;
        approvedLeaves.forEach(leave => {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            if (rules) {
                const { effectiveWorkingDays } = (0, policy_rules_1.calculateEffectiveLeaveDays)(start, end, rules, holidayDates);
                totalUsed += effectiveWorkingDays;
            }
            else {
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                totalUsed += diffDays;
            }
        });
        return totalUsed;
    }
    static async resolveTenantIdForEmployee(employee) {
        if (employee.tenantId)
            return employee.tenantId;
        if (employee.user?.tenantId)
            return employee.user.tenantId;
        if (employee.orgUnitId) {
            const ou = await prisma_1.default.orgUnit.findUnique({
                where: { id: employee.orgUnitId },
                select: { tenantId: true },
            });
            if (ou?.tenantId)
                return ou.tenantId;
        }
        // Fail closed: never invent a tenant via findFirst()
        return null;
    }
    static async getLeaveBalance(employeeId) {
        const empId = await this.resolveEmployeeId(employeeId);
        const employee = await prisma_1.default.employee.findUnique({
            where: { id: empId },
            select: { totalLeaves: true, tenantId: true, orgUnitId: true, user: { select: { tenantId: true } } },
        });
        if (!employee)
            return { total: 12, used: 0, remaining: 12 };
        const tenantId = await this.resolveTenantIdForEmployee(employee);
        const rules = tenantId ? await policy_service_1.PolicyService.getActiveRules(tenantId) : null;
        let holidayDates = new Set();
        if (tenantId) {
            const holidays = await prisma_1.default.holiday.findMany({ where: { tenantId, isActive: true } });
            holidayDates = new Set(holidays.map(h => new Date(h.date).toISOString().slice(0, 10)));
        }
        const used = await this.calculateUsedLeaves(empId, rules, holidayDates);
        const compOffEarned = rules?.compOffCredits?.[empId] || 0;
        const total = (rules ? (0, policy_rules_1.totalAnnualLeaveDays)(rules) : employee.totalLeaves || 12) + compOffEarned;
        const remaining = Math.max(0, total - used);
        return {
            total,
            used,
            remaining,
            compOffCredits: compOffEarned,
            policy: rules?.leave || null,
            workWeek: rules?.workWeek || null,
        };
    }
    static async creditCompOff(tenantId, userId, employeeId, days = 1.0) {
        const empId = await this.resolveEmployeeId(employeeId);
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const compOffCredits = { ...(rules.compOffCredits || {}) };
        compOffCredits[empId] = (compOffCredits[empId] || 0) + Number(days);
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, {
            ...rules,
            compOffCredits,
        });
        return {
            success: true,
            employeeId: empId,
            creditedDays: days,
            totalCompOffBalance: compOffCredits[empId],
        };
    }
    static async apply(data) {
        const empId = await this.resolveEmployeeId(data.employeeId);
        const employee = await prisma_1.default.employee.findUnique({
            where: { id: empId },
            select: { tenantId: true, orgUnitId: true, userId: true, user: { select: { tenantId: true } } },
        });
        const tenantId = employee ? await this.resolveTenantIdForEmployee(employee) : null;
        const tenant = tenantId ? await prisma_1.default.tenant.findUnique({ where: { id: tenantId } }) : null;
        if (!tenant)
            throw new Error('Tenant context required to apply leave');
        if (tenantId) {
            const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
            const holidays = await prisma_1.default.holiday.findMany({ where: { tenantId, isActive: true } });
            const holidayDates = new Set(holidays.map(h => new Date(h.date).toISOString().slice(0, 10)));
            const start = new Date(data.startDate);
            const end = new Date(data.endDate);
            const { totalCalendarDays, effectiveWorkingDays, weekOffDays, holidayDays } = (0, policy_rules_1.calculateEffectiveLeaveDays)(start, end, rules, holidayDates);
            const noticeDays = Math.ceil((start.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (noticeDays < rules.leave.leaveAdvanceNoticeDays) {
                throw new Error(`Leave must be applied at least ${rules.leave.leaveAdvanceNoticeDays} day(s) in advance per company policy`);
            }
            if (effectiveWorkingDays > rules.leave.maxConsecutiveLeaveDays) {
                throw new Error(`Maximum consecutive working leave allowed is ${rules.leave.maxConsecutiveLeaveDays} day(s) per company policy`);
            }
            const inNotice = await separation_service_1.SeparationService.hasActiveSeparationInNotice(empId);
            if (inNotice && !rules.exit.allowLeaveDuringNotice) {
                throw new Error('Leave applications are restricted during notice period per company policy');
            }
            const balance = await this.getLeaveBalance(empId);
            if (effectiveWorkingDays > balance.remaining) {
                throw new Error(`Insufficient leave balance. Applying for ${effectiveWorkingDays} working day(s) (${weekOffDays} week-off(s) excluded). Remaining: ${balance.remaining} day(s)`);
            }
        }
        const leave = await prisma_1.default.leave.create({
            data: {
                employeeId: empId,
                type: data.type,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                reason: data.reason,
                status: 'PENDING',
            },
        });
        if (tenant) {
            await approval_service_1.ApprovalService.createLeaveApproval({
                id: leave.id,
                employeeId: empId,
                startDate: leave.startDate,
                endDate: leave.endDate,
                tenantId: tenant.id,
                orgUnitId: employee?.orgUnitId,
                requesterUserId: employee?.userId || data.requesterUserId || null,
            });
        }
        return leave;
    }
    static async updateStatus(id, status, processedBy, adminRemark) {
        if (!id || !String(id).match(/^[0-9a-fA-F]{24}$/)) {
            if (id && String(id).startsWith('req_')) {
                let tenantId = '6a08259b752e15d6a06ec490';
                if (processedBy && String(processedBy).match(/^[0-9a-fA-F]{24}$/)) {
                    const user = await prisma_1.default.user.findUnique({ where: { id: processedBy }, select: { tenantId: true } }).catch(() => null);
                    const employee = !user?.tenantId ? await prisma_1.default.employee.findFirst({ where: { userId: processedBy } }).catch(() => null) : null;
                    tenantId = user?.tenantId || employee?.tenantId || tenantId;
                }
                const normStatus = String(status).toUpperCase() === 'APPROVED' ? 'APPROVED' : 'REJECTED';
                const res = await attendance_service_1.AttendanceService.updateAttendanceRequestStatus(tenantId, processedBy, String(id), {
                    status: normStatus,
                    adminRemark,
                });
                return {
                    id,
                    status: normStatus,
                    adminRemark,
                    processedBy,
                    attendanceRequest: res,
                };
            }
            throw new Error(`Invalid Leave record ID: ${id}`);
        }
        const existingLeave = await prisma_1.default.leave.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        tenantId: true,
                        orgUnit: { select: { tenantId: true } },
                        user: { select: { tenantId: true } },
                    },
                },
            },
        });
        if (!existingLeave) {
            throw new Error('Leave record not found');
        }
        const updated = await prisma_1.default.leave.update({
            where: { id },
            data: {
                status,
                processedBy,
                processedAt: new Date(),
                adminRemark,
            },
        });
        const tenantId = existingLeave.employee?.tenantId ||
            existingLeave.employee?.orgUnit?.tenantId ||
            existingLeave.employee?.user?.tenantId ||
            'default-tenant';
        if (status === 'APPROVED') {
            await attendance_service_1.AttendanceService.syncLeaveToAttendance(tenantId, id, existingLeave.employeeId, existingLeave.startDate, existingLeave.endDate, existingLeave.type, 'APPROVED').catch((err) => console.error('Error syncing leave to attendance:', err));
        }
        else if (status === 'REJECTED') {
            await attendance_service_1.AttendanceService.syncLeaveToAttendance(tenantId, id, existingLeave.employeeId, existingLeave.startDate, existingLeave.endDate, existingLeave.type, 'REJECTED').catch((err) => console.error('Error syncing leave rejection to attendance:', err));
        }
        return updated;
    }
    static async getByEmployee(employeeId) {
        const empId = await this.resolveEmployeeId(employeeId);
        return prisma_1.default.leave.findMany({
            where: { employeeId: empId },
            orderBy: { appliedAt: 'desc' }
        });
    }
    static async getAll(filters = {}, scope) {
        if (!scope?.tenantId)
            return [];
        if (filters.employeeId) {
            filters.employeeId = await this.resolveEmployeeId(filters.employeeId);
        }
        const visibleEmployees = await prisma_1.default.employee.findMany({
            where: (0, org_scope_service_1.employeeWhereFromScope)(scope),
            select: { id: true },
        });
        const visibleIds = visibleEmployees.map((e) => e.id);
        if (visibleIds.length === 0)
            return [];
        if (filters.employeeId && !visibleIds.includes(filters.employeeId)) {
            return [];
        }
        const where = {
            employeeId: filters.employeeId || { in: visibleIds },
        };
        if (filters.status)
            where.status = filters.status;
        if (filters.type)
            where.type = filters.type;
        const leaves = await prisma_1.default.leave.findMany({
            where,
            orderBy: { appliedAt: 'desc' },
        });
        const employeeIds = Array.from(new Set(leaves.map((leave) => leave.employeeId)));
        const employees = employeeIds.length
            ? await prisma_1.default.employee.findMany({
                where: { id: { in: employeeIds } },
                select: {
                    id: true,
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    department: true,
                },
            })
            : [];
        const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
        return leaves.map((leave) => ({
            ...leave,
            employee: employeeMap.get(leave.employeeId) || null,
        }));
    }
    static async cancel(id, employeeId) {
        if (!id || !String(id).match(/^[0-9a-fA-F]{24}$/)) {
            if (id && String(id).startsWith('req_')) {
                return { id, cancelled: true };
            }
            throw new Error(`Invalid Leave record ID: ${id}`);
        }
        const empId = await this.resolveEmployeeId(employeeId);
        const leave = await prisma_1.default.leave.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        tenantId: true,
                        orgUnit: { select: { tenantId: true } },
                        user: { select: { tenantId: true } },
                    },
                },
            },
        });
        if (!leave || leave.employeeId !== empId) {
            throw new Error("Leave not found or unauthorized");
        }
        if (leave.status !== 'PENDING' && leave.status !== 'APPROVED') {
            throw new Error("Only pending or approved leaves can be cancelled");
        }
        const tenantId = leave.employee?.tenantId ||
            leave.employee?.orgUnit?.tenantId ||
            leave.employee?.user?.tenantId ||
            'default-tenant';
        await attendance_service_1.AttendanceService.syncLeaveToAttendance(tenantId, id, leave.employeeId, leave.startDate, leave.endDate, leave.type, 'CANCELLED').catch((err) => console.error('Error syncing leave cancellation to attendance:', err));
        return prisma_1.default.leave.delete({ where: { id } });
    }
    static async getWorkWeekRoster(tenantId, year, month) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const now = new Date();
        const targetYear = Number(year) || now.getFullYear();
        const targetMonth = Number(month) || now.getMonth() + 1; // 1-12
        const saturdays = (0, policy_rules_1.getMonthlySaturdayRoster)(targetYear, targetMonth, rules.workWeek);
        const fullRoster = (0, policy_rules_1.getMonthFullRoster)(targetYear, targetMonth, rules.workWeek);
        // Holidays in tenant
        const holidays = await prisma_1.default.holiday.findMany({
            where: {
                tenantId,
                isActive: true,
            },
        });
        const holidayMap = new Map();
        holidays.forEach((h) => {
            const dStr = new Date(h.date).toISOString().slice(0, 10);
            holidayMap.set(dStr, h.name);
        });
        const enrichedCalendar = fullRoster.map((d) => {
            const holidayName = holidayMap.get(d.dateStr);
            return {
                ...d,
                isHoliday: !!holidayName,
                holidayName: holidayName || null,
                effectiveStatus: d.isOff ? 'WEEK_OFF' : holidayName ? 'HOLIDAY' : 'WORKING',
            };
        });
        const currentOption = policy_rules_1.WORK_WEEK_OPTIONS.find((opt) => opt.key === rules.workWeek.pattern) || policy_rules_1.WORK_WEEK_OPTIONS[0];
        return {
            workWeek: rules.workWeek,
            currentOption,
            options: policy_rules_1.WORK_WEEK_OPTIONS,
            targetYear,
            targetMonth,
            saturdays,
            calendarDays: enrichedCalendar,
            sandwichLeaveRule: rules.leave.sandwichLeaveRule,
            excludeWeekendsFromLeave: rules.leave.excludeWeekendsFromLeave,
            summary: {
                totalDays: enrichedCalendar.length,
                workingDays: enrichedCalendar.filter((d) => d.effectiveStatus === 'WORKING').length,
                weeklyOffDays: enrichedCalendar.filter((d) => d.isOff).length,
                holidayDays: enrichedCalendar.filter((d) => !d.isOff && d.isHoliday).length,
                saturdaysOff: saturdays.filter((s) => s.isOff).length,
                saturdaysWorking: saturdays.filter((s) => !s.isOff).length,
            },
        };
    }
    static async updateWorkWeekRoster(tenantId, userId, data) {
        if (!data.pattern)
            throw new Error('Work week pattern is required');
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, {
            workWeek: {
                pattern: data.pattern,
                customWeekOffDays: data.customWeekOffDays || (data.pattern === 'FIVE_DAY' ? [0, 6] : [0]),
            },
        });
        return this.getWorkWeekRoster(tenantId);
    }
    static async calculateDaysBreakdown(tenantId, startDate, endDate, overridePattern) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const activeRules = overridePattern
            ? {
                ...rules,
                workWeek: {
                    ...rules.workWeek,
                    pattern: overridePattern,
                },
            }
            : rules;
        const holidays = await prisma_1.default.holiday.findMany({
            where: { tenantId, isActive: true },
        });
        const holidayMap = new Map();
        holidays.forEach((h) => {
            holidayMap.set(new Date(h.date).toISOString().slice(0, 10), h.name);
        });
        return (0, policy_rules_1.calculateLeaveBreakdown)(startDate, endDate, activeRules, holidayMap);
    }
    static async getRosterGrid(tenantId, options) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const now = new Date();
        const targetYear = Number(options.year) || now.getFullYear();
        const targetMonth = Number(options.month) || now.getMonth() + 1;
        const view = options.view || 'monthly';
        const empWhere = {
            OR: [
                { tenantId },
                { orgUnit: { tenantId } },
                { user: { tenantId } },
            ],
            status: 'ACTIVE',
        };
        if (options.department && options.department !== 'ALL') {
            empWhere.department = options.department;
        }
        if (options.search) {
            empWhere.OR = [
                { firstName: { contains: options.search, mode: 'insensitive' } },
                { lastName: { contains: options.search, mode: 'insensitive' } },
                { employeeId: { contains: options.search, mode: 'insensitive' } },
            ];
        }
        const employees = await prisma_1.default.employee.findMany({
            where: empWhere,
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
                designation: true,
            },
            orderBy: { firstName: 'asc' },
        });
        const holidays = await prisma_1.default.holiday.findMany({
            where: { tenantId, isActive: true },
        });
        const holidayMap = new Map();
        holidays.forEach((h) => {
            const dStr = new Date(h.date).toISOString().slice(0, 10);
            holidayMap.set(dStr, h.name);
        });
        const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
        const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59);
        const leaves = await prisma_1.default.leave.findMany({
            where: {
                employeeId: { in: employees.map((e) => e.id) },
                status: 'APPROVED',
                startDate: { lte: endOfMonth },
                endDate: { gte: startOfMonth },
            },
        });
        const leaveMap = new Map();
        leaves.forEach((l) => {
            const cur = new Date(l.startDate);
            const end = new Date(l.endDate);
            while (cur <= end) {
                const dStr = cur.toISOString().slice(0, 10);
                leaveMap.set(`${l.employeeId}:${dStr}`, l.type);
                cur.setDate(cur.getDate() + 1);
            }
        });
        const rosterOverrides = rules.rosterSchedules || {};
        const departmentOverrides = rosterOverrides.departmentOverrides || {};
        const employeeOverrides = rosterOverrides.employeeOverrides || {};
        const cellOverrides = rosterOverrides.cellOverrides || {};
        const activeShifts = await this.getShifts(tenantId);
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const dayNumbers = [];
        if (view === 'weekly') {
            const weekIndex = options.weekIndex !== undefined ? options.weekIndex : Math.min(Math.floor((now.getDate() - 1) / 7), 3);
            const startDay = weekIndex * 7 + 1;
            const endDay = Math.min(startDay + 6, daysInMonth);
            for (let d = startDay; d <= endDay; d++)
                dayNumbers.push(d);
        }
        else {
            for (let d = 1; d <= daysInMonth; d++)
                dayNumbers.push(d);
        }
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const ordinals = ['1st', '2nd', '3rd', '4th', '5th'];
        const daysHeader = dayNumbers.map((d) => {
            const dt = new Date(targetYear, targetMonth - 1, d);
            const dayOfWeek = dt.getDay();
            const isSat = dayOfWeek === 6;
            const isSun = dayOfWeek === 0;
            const occ = isSat ? Math.ceil(d / 7) : undefined;
            const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const holidayName = holidayMap.get(dateStr);
            return {
                dateStr,
                dayOfMonth: d,
                dayOfWeek,
                dayName: dayNames[dayOfWeek],
                isSaturday: isSat,
                saturdayOccurrence: occ,
                isSunday: isSun,
                isHoliday: !!holidayName,
                holidayName: holidayName || null,
                label: isSat ? `${ordinals[(occ || 1) - 1]} Sat` : dayNames[dayOfWeek],
            };
        });
        const gridRows = employees.map((emp) => {
            const empOverride = employeeOverrides[emp.id];
            const deptOverride = departmentOverrides[emp.department];
            const effectiveWorkWeek = empOverride?.workWeek || deptOverride?.workWeek || rules.workWeek;
            const defaultShift = rules.rosterSchedules?.defaultShift || 'GS';
            const effectiveShift = empOverride?.shiftCode || deptOverride?.shiftCode || defaultShift;
            const cells = daysHeader.map((d) => {
                const cellKey = `${emp.id}:${d.dateStr}`;
                const manualOverride = cellOverrides[cellKey];
                const leaveType = leaveMap.get(cellKey);
                if (leaveType) {
                    return {
                        dateStr: d.dateStr,
                        status: 'L',
                        label: `Leave (${leaveType})`,
                        color: '#0284c7',
                        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 font-bold',
                        isOverride: false,
                    };
                }
                if (d.isHoliday) {
                    return {
                        dateStr: d.dateStr,
                        status: 'H',
                        label: d.holidayName || 'Holiday',
                        color: '#7c3aed',
                        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
                        isOverride: false,
                    };
                }
                if (manualOverride) {
                    if (manualOverride === 'WO') {
                        return {
                            dateStr: d.dateStr,
                            status: 'WO',
                            label: 'Weekly Off (Override)',
                            color: '#059669',
                            badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
                            isOverride: true,
                        };
                    }
                    const shift = activeShifts.find((s) => s.code === manualOverride);
                    return {
                        dateStr: d.dateStr,
                        status: manualOverride,
                        label: shift?.name || manualOverride,
                        color: shift?.color || '#0f172a',
                        badgeClass: shift?.badgeClass || 'bg-slate-100 text-slate-800 font-bold',
                        isOverride: true,
                    };
                }
                const dt = new Date(targetYear, targetMonth - 1, d.dayOfMonth);
                const isOff = (0, policy_rules_1.isDateWeekOff)(dt, effectiveWorkWeek);
                if (isOff) {
                    let reason = 'Weekly Off';
                    if (d.isSunday)
                        reason = 'Sunday Off';
                    else if (d.isSaturday)
                        reason = `${ordinals[(d.saturdayOccurrence || 1) - 1]} Sat Off`;
                    return {
                        dateStr: d.dateStr,
                        status: 'WO',
                        label: reason,
                        color: '#059669',
                        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
                        isOverride: false,
                    };
                }
                const shift = activeShifts.find((s) => s.code === effectiveShift) || activeShifts[0];
                return {
                    dateStr: d.dateStr,
                    status: effectiveShift,
                    label: shift.name,
                    color: shift.color,
                    badgeClass: shift.badgeClass,
                    isOverride: false,
                };
            });
            return {
                id: emp.id,
                employeeId: emp.employeeId,
                name: `${emp.firstName} ${emp.lastName}`.trim(),
                department: emp.department,
                designation: emp.designation,
                assignedPattern: effectiveWorkWeek.pattern,
                assignedShift: effectiveShift,
                cells,
            };
        });
        const allCells = gridRows.flatMap((r) => r.cells);
        const totalWeekOffs = allCells.filter((c) => c.status === 'WO').length;
        const totalWorkingShifts = allCells.filter((c) => c.status !== 'WO' && c.status !== 'H' && c.status !== 'L').length;
        const totalLeaves = allCells.filter((c) => c.status === 'L').length;
        const totalHolidays = allCells.filter((c) => c.status === 'H').length;
        const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));
        return {
            targetYear,
            targetMonth,
            view,
            weekIndex: options.weekIndex ?? 0,
            daysHeader,
            rows: gridRows,
            shifts: activeShifts,
            departments,
            summary: {
                totalEmployees: employees.length,
                totalWeekOffs,
                totalWorkingShifts,
                totalLeaves,
                totalHolidays,
            },
        };
    }
    static async getShifts(tenantId) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const customShifts = rules.rosterSchedules?.customShifts || [];
        const shiftMap = new Map();
        policy_rules_1.STANDARD_SHIFTS.forEach((s) => shiftMap.set(s.code, { ...s, isCustom: false }));
        customShifts.forEach((s) => shiftMap.set(s.code, { ...s, isCustom: true }));
        return Array.from(shiftMap.values());
    }
    static async createOrUpdateShift(tenantId, userId, shiftData) {
        if (!shiftData.code || !shiftData.name) {
            throw new Error('Shift code and name are required');
        }
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const currentRoster = rules.rosterSchedules || {};
        const customShifts = [...(currentRoster.customShifts || [])];
        const code = shiftData.code.toUpperCase().trim();
        const category = shiftData.category || 'GENERAL';
        const startTime = shiftData.startTime || (category === 'SPLIT' ? (shiftData.firstSlotStartTime || '10:00') : '09:30');
        const endTime = shiftData.endTime || (category === 'SPLIT' ? (shiftData.secondSlotEndTime || '21:00') : '18:30');
        let timings = `${startTime} – ${endTime}`;
        if (category === 'SPLIT') {
            const s1 = `${shiftData.firstSlotStartTime || '10:00'}–${shiftData.firstSlotEndTime || '14:00'}`;
            const s2 = `${shiftData.secondSlotStartTime || '17:00'}–${shiftData.secondSlotEndTime || '21:00'}`;
            timings = `${s1} & ${s2}`;
        }
        const shortLabel = `${shiftData.name} (${timings})`;
        const color = shiftData.color || (category === 'SPLIT' ? '#0891b2' : category === 'NIGHT' ? '#7c3aed' : '#2563eb');
        const badgeClass = shiftData.badgeClass || (category === 'SPLIT' ? 'bg-cyan-100 text-cyan-800 border-cyan-300 font-bold' : 'bg-blue-100 text-blue-800 border-blue-300 font-bold');
        const normalized = {
            code,
            name: shiftData.name.trim(),
            category,
            shortLabel,
            timings,
            color,
            badgeClass,
            startTime,
            endTime,
            firstSlotStartTime: shiftData.firstSlotStartTime,
            firstSlotEndTime: shiftData.firstSlotEndTime,
            secondSlotStartTime: shiftData.secondSlotStartTime,
            secondSlotEndTime: shiftData.secondSlotEndTime,
            rotationCycleDays: shiftData.rotationCycleDays,
            gracePeriodMinutes: shiftData.gracePeriodMinutes || 15,
            halfDayHours: shiftData.halfDayHours || 4,
            isCustom: true,
        };
        const existingIdx = customShifts.findIndex((s) => s.code === code);
        if (existingIdx >= 0) {
            customShifts[existingIdx] = normalized;
        }
        else {
            customShifts.push(normalized);
        }
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, {
            ...rules,
            rosterSchedules: {
                ...currentRoster,
                customShifts,
            },
        });
        return this.getShifts(tenantId);
    }
    static async deleteShift(tenantId, userId, code) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const currentRoster = rules.rosterSchedules || {};
        let customShifts = [...(currentRoster.customShifts || [])];
        customShifts = customShifts.filter((s) => s.code !== code.toUpperCase().trim());
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, {
            ...rules,
            rosterSchedules: {
                ...currentRoster,
                customShifts,
            },
        });
        return this.getShifts(tenantId);
    }
    static async bulkAssignRoster(tenantId, userId, data) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const currentRoster = rules.rosterSchedules || {};
        const departmentOverrides = { ...(currentRoster.departmentOverrides || {}) };
        const employeeOverrides = { ...(currentRoster.employeeOverrides || {}) };
        const workWeekConfig = {
            pattern: data.pattern,
            customWeekOffDays: data.customWeekOffDays || (data.pattern === 'FIVE_DAY' ? [0, 6] : [0]),
        };
        const shiftCode = data.shiftCode || 'GS';
        const isOrgWide = data.applyToAll || data.department === 'ALL' || (!data.department && (!data.employeeIds || data.employeeIds.length === 0));
        if (data.department && data.department !== 'ALL') {
            departmentOverrides[data.department] = {
                workWeek: workWeekConfig,
                shiftCode,
            };
        }
        if (Array.isArray(data.employeeIds) && data.employeeIds.length > 0) {
            data.employeeIds.forEach((empId) => {
                employeeOverrides[empId] = {
                    workWeek: workWeekConfig,
                    shiftCode,
                };
            });
        }
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, {
            ...rules,
            workWeek: isOrgWide ? workWeekConfig : rules.workWeek,
            rosterSchedules: {
                ...currentRoster,
                defaultShift: isOrgWide ? shiftCode : (currentRoster.defaultShift || 'GS'),
                departmentOverrides,
                employeeOverrides,
            },
        });
        return this.getRosterGrid(tenantId, {});
    }
    static async overrideRosterCell(tenantId, userId, data) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const currentRoster = rules.rosterSchedules || {};
        const cellOverrides = { ...(currentRoster.cellOverrides || {}) };
        const key = `${data.employeeId}:${data.dateStr}`;
        if (data.shiftCode === 'RESET' || data.shiftCode === 'DEFAULT') {
            delete cellOverrides[key];
        }
        else {
            cellOverrides[key] = data.shiftCode;
        }
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, {
            ...rules,
            rosterSchedules: {
                ...currentRoster,
                cellOverrides,
            },
        });
        return { key, shiftCode: data.shiftCode };
    }
    static async createRosterSchedule(tenantId, userId, data) {
        if (!data.startDate || !data.endDate) {
            throw new Error('startDate and endDate are required');
        }
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const currentRoster = rules.rosterSchedules || {};
        const cellOverrides = { ...(currentRoster.cellOverrides || {}) };
        const employeeOverrides = { ...(currentRoster.employeeOverrides || {}) };
        let targetEmpIds = [];
        if (data.applyToAll || (!data.employeeIds?.length && (!data.department || data.department === 'ALL'))) {
            const allEmps = await prisma_1.default.employee.findMany({
                where: {
                    OR: [{ tenantId }, { orgUnit: { tenantId } }, { user: { tenantId } }],
                    status: 'ACTIVE',
                },
                select: { id: true },
            });
            targetEmpIds = allEmps.map((e) => e.id);
        }
        else if (data.department && data.department !== 'ALL') {
            const deptEmps = await prisma_1.default.employee.findMany({
                where: {
                    OR: [{ tenantId }, { orgUnit: { tenantId } }, { user: { tenantId } }],
                    department: data.department,
                    status: 'ACTIVE',
                },
                select: { id: true },
            });
            targetEmpIds = deptEmps.map((e) => e.id);
        }
        else if (Array.isArray(data.employeeIds) && data.employeeIds.length > 0) {
            targetEmpIds = data.employeeIds;
        }
        if (targetEmpIds.length === 0) {
            throw new Error('No active employees selected for roster schedule');
        }
        const workingDays = data.workingDays !== undefined && Array.isArray(data.workingDays)
            ? data.workingDays
            : [1, 2, 3, 4, 5, 6];
        let saturdayRule = data.saturdayRule || '2ND_4TH_OFF';
        const shiftCode = data.shiftCode || 'GS';
        // Synchronize Saturday rule if workingDays has 6 days or lacks Saturday
        const satWorking = workingDays.includes(6);
        if (!satWorking) {
            saturdayRule = 'ALL_OFF';
        }
        else if (satWorking && saturdayRule === 'ALL_OFF') {
            saturdayRule = 'ALL_WORKING';
        }
        // Determine consistent WorkWeekPattern for employeeOverrides
        let workWeekPattern = 'SIX_DAY';
        if (!satWorking || saturdayRule === 'ALL_OFF') {
            workWeekPattern = 'FIVE_DAY';
        }
        else if (saturdayRule === '2ND_4TH_OFF') {
            workWeekPattern = 'ALTERNATE_SAT_2ND_4TH';
        }
        else if (saturdayRule === '1ST_3RD_OFF') {
            workWeekPattern = 'ALTERNATE_SAT_1ST_3RD';
        }
        else if (saturdayRule === 'ALL_WORKING') {
            workWeekPattern = 'SIX_DAY';
        }
        const employeeWorkWeek = {
            pattern: workWeekPattern,
            customWeekOffDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !workingDays.includes(d)),
        };
        const [sY, sM, sD] = data.startDate.split('-').map(Number);
        const [eY, eM, eD] = data.endDate.split('-').map(Number);
        const cur = new Date(Date.UTC(sY, sM - 1, sD));
        const end = new Date(Date.UTC(eY, eM - 1, eD));
        if (cur > end) {
            throw new Error('startDate must be before or equal to endDate');
        }
        const datesToSet = [];
        while (cur <= end) {
            const dayOfWeek = cur.getUTCDay();
            const dayOfMonth = cur.getUTCDate();
            const dateStr = cur.toISOString().slice(0, 10);
            let status = shiftCode;
            if (dayOfWeek === 0) {
                status = workingDays.includes(0) ? shiftCode : 'WO';
            }
            else if (dayOfWeek === 6) {
                if (!satWorking || saturdayRule === 'ALL_OFF') {
                    status = 'WO';
                }
                else if (saturdayRule === 'ALL_WORKING') {
                    status = shiftCode;
                }
                else if (saturdayRule === '2ND_4TH_OFF') {
                    const occ = Math.ceil(dayOfMonth / 7);
                    status = occ === 2 || occ === 4 ? 'WO' : shiftCode;
                }
                else if (saturdayRule === '1ST_3RD_OFF') {
                    const occ = Math.ceil(dayOfMonth / 7);
                    status = occ === 1 || occ === 3 ? 'WO' : shiftCode;
                }
            }
            else {
                status = workingDays.includes(dayOfWeek) ? shiftCode : 'WO';
            }
            datesToSet.push({ dateStr, status });
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
        for (const empId of targetEmpIds) {
            for (const d of datesToSet) {
                const key = `${empId}:${d.dateStr}`;
                if (shiftCode === 'RESET') {
                    delete cellOverrides[key];
                }
                else {
                    cellOverrides[key] = d.status;
                }
            }
            if (shiftCode !== 'RESET') {
                employeeOverrides[empId] = {
                    ...(employeeOverrides[empId] || {}),
                    shiftCode,
                    workWeek: employeeWorkWeek,
                };
            }
        }
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, {
            ...rules,
            rosterSchedules: {
                ...currentRoster,
                cellOverrides,
                employeeOverrides,
            },
        });
        return {
            success: true,
            employeesCount: targetEmpIds.length,
            daysCount: datesToSet.length,
            dateRange: { startDate: data.startDate, endDate: data.endDate },
            shiftCode,
            saturdayRule,
            workWeekPattern,
            message: `Roster schedule created successfully for ${targetEmpIds.length} employees across ${datesToSet.length} days (${workWeekPattern === 'SIX_DAY' ? '6-Day Work Week' : workWeekPattern === 'FIVE_DAY' ? '5-Day Work Week' : 'Alternate Saturday Week'})`,
        };
    }
}
exports.LeaveService = LeaveService;
//# sourceMappingURL=leave.service.js.map