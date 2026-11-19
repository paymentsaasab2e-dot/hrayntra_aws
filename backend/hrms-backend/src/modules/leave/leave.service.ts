import prisma from '../../shared/prisma';
import { OrgScopeContext, employeeWhereFromScope } from '../../shared/org/org-scope.service';
import { ApprovalService } from '../approvals/approval.service';
import { PolicyService } from '../policies/policy.service';
import { AttendanceService } from '../attendance/attendance.service';
import {
  totalAnnualLeaveDays,
  TenantHrRules,
  calculateEffectiveLeaveDays,
  WORK_WEEK_OPTIONS,
  STANDARD_SHIFTS,
  ShiftType,
  getMonthlySaturdayRoster,
  getMonthFullRoster,
  calculateLeaveBreakdown,
  WorkWeekPattern,
  WorkWeekConfig,
  isDateWeekOff,
} from '../policies/policy-rules';
import { SeparationService } from '../separation/separation.service';

export class LeaveService {
  static async resolveEmployeeId(employeeId: string): Promise<string> {
    if (!employeeId) throw new Error("Employee ID is required");
    if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
      return employeeId;
    }
    const emp = await prisma.employee.findUnique({ where: { employeeId } });
    if (!emp) throw new Error(`Employee with ID ${employeeId} not found`);
    return emp.id;
  }

  static async calculateUsedLeaves(employeeId: string, rules?: TenantHrRules | null, holidayDates: Set<string> = new Set()) {
    const empId = await this.resolveEmployeeId(employeeId);
    const approvedLeaves = await prisma.leave.findMany({
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
        const { effectiveWorkingDays } = calculateEffectiveLeaveDays(start, end, rules, holidayDates);
        totalUsed += effectiveWorkingDays;
      } else {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        totalUsed += diffDays;
      }
    });

    return totalUsed;
  }

  static async resolveTenantIdForEmployee(employee: {
    tenantId?: string | null;
    orgUnitId?: string | null;
    user?: { tenantId?: string | null } | null;
  }) {
    if (employee.tenantId) return employee.tenantId;
    if (employee.user?.tenantId) return employee.user.tenantId;
    if (employee.orgUnitId) {
      const ou = await prisma.orgUnit.findUnique({
        where: { id: employee.orgUnitId },
        select: { tenantId: true },
      });
      if (ou?.tenantId) return ou.tenantId;
    }
    // Fail closed: never invent a tenant via findFirst()
    return null;
  }

  static async getLeaveBalance(employeeId: string) {
    const empId = await this.resolveEmployeeId(employeeId);
    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      select: { totalLeaves: true, tenantId: true, orgUnitId: true, user: { select: { tenantId: true } } },
    });

    if (!employee) return { total: 12, used: 0, remaining: 12 };

    const tenantId = await this.resolveTenantIdForEmployee(employee);
    const rules = tenantId ? await PolicyService.getActiveRules(tenantId) : null;

    let holidayDates = new Set<string>();
    if (tenantId) {
      const holidays = await prisma.holiday.findMany({ where: { tenantId, isActive: true } });
      holidayDates = new Set(holidays.map(h => new Date(h.date).toISOString().slice(0, 10)));
    }

    const used = await this.calculateUsedLeaves(empId, rules, holidayDates);
    const compOffEarned = (rules as any)?.compOffCredits?.[empId] || 0;
    const total = (rules ? totalAnnualLeaveDays(rules) : employee.totalLeaves || 12) + compOffEarned;
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

  static async creditCompOff(tenantId: string, userId: string, employeeId: string, days: number = 1.0) {
    const empId = await this.resolveEmployeeId(employeeId);
    const rules = await PolicyService.getActiveRules(tenantId);
    const compOffCredits = { ...((rules as any).compOffCredits || {}) };
    compOffCredits[empId] = (compOffCredits[empId] || 0) + Number(days);

    await PolicyService.updateActiveRules(tenantId, userId, {
      ...rules,
      compOffCredits,
    } as any);

    return {
      success: true,
      employeeId: empId,
      creditedDays: days,
      totalCompOffBalance: compOffCredits[empId],
    };
  }

  static async apply(data: any) {
    const empId = await this.resolveEmployeeId(data.employeeId);
    const normalizedType = String(data.type || '').toUpperCase();
    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      select: {
        tenantId: true,
        orgUnitId: true,
        userId: true,
        gender: true,
        joiningDate: true,
        probationEndDate: true,
        firstName: true,
        lastName: true,
        user: { select: { tenantId: true } },
      },
    });
    const tenantId = employee ? await this.resolveTenantIdForEmployee(employee) : null;
    const tenant = tenantId ? await prisma.tenant.findUnique({ where: { id: tenantId } }) : null;
    if (!tenant) throw new Error('Tenant context required to apply leave');

    if (tenantId) {
      const rules = await PolicyService.getActiveRules(tenantId);
      const holidays = await prisma.holiday.findMany({ where: { tenantId, isActive: true } });
      const holidayDates = new Set(holidays.map(h => new Date(h.date).toISOString().slice(0, 10)));

      const start = new Date(data.startDate);
      const end = new Date(data.endDate);

      const { totalCalendarDays, effectiveWorkingDays, weekOffDays, holidayDays } = calculateEffectiveLeaveDays(
        start,
        end,
        rules,
        holidayDates
      );

      // ── Statutory Maternity Benefit Act (26 Weeks) & Gender / Probation Rules ──
      const calDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const empGender = employee?.gender ? employee.gender.toUpperCase() : 'UNKNOWN';
      const normalizedType = String(data.type || '').toUpperCase();

      if (normalizedType === 'MATERNITY') {
        if (empGender === 'MALE') {
          throw new Error('Maternity leave is applicable only to female employees under the Maternity Benefit (Amendment) Act 2017.');
        }

        // Max statutory duration: 26 weeks (182 calendar days)
        const MAX_MATERNITY_DAYS = 182;
        if (calDays > MAX_MATERNITY_DAYS) {
          throw new Error(`Maximum statutory maternity leave entitlement is 26 weeks (182 calendar days) under the Maternity Benefit Act. Requested: ${calDays} days.`);
        }

        // Section 5(2): Must have worked at least 80 days in prior 12 months
        if (employee?.joiningDate) {
          const daysSinceJoining = Math.floor((start.getTime() - new Date(employee.joiningDate).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceJoining < 80) {
            throw new Error(`Under Section 5(2) of the Maternity Benefit Act, employee must have completed at least 80 working days prior to delivery. Completed: ${daysSinceJoining} days.`);
          }
        }
      }

      if (normalizedType === 'PATERNITY') {
        if (empGender === 'FEMALE') {
          throw new Error('Paternity leave is applicable only to male employees.');
        }
        const MAX_PATERNITY_DAYS = 15;
        if (calDays > MAX_PATERNITY_DAYS) {
          throw new Error(`Maximum paternity leave entitlement is 15 calendar days. Requested: ${calDays} days.`);
        }
      }

      // Probation restriction: Earned leave is locked during probation (180 days from joining)
      const now = new Date();
      const isOnProbation = employee?.probationEndDate
        ? new Date(employee.probationEndDate) > now
        : employee?.joiningDate
        ? (now.getTime() - new Date(employee.joiningDate).getTime()) < 180 * 24 * 60 * 60 * 1000
        : false;

      if (isOnProbation && (normalizedType === 'EARNED' || normalizedType === 'PRIVILEGE')) {
        throw new Error('Earned Leave (EL) cannot be availed during probation period per company policy. Casual or Sick leave can be availed.');
      }

      const noticeDays = Math.ceil((start.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (
        noticeDays < rules.leave.leaveAdvanceNoticeDays &&
        normalizedType !== 'MATERNITY' &&
        normalizedType !== 'PATERNITY' &&
        normalizedType !== 'SICK'
      ) {
        throw new Error(
          `Leave must be applied at least ${rules.leave.leaveAdvanceNoticeDays} day(s) in advance per company policy`
        );
      }
      if (effectiveWorkingDays > rules.leave.maxConsecutiveLeaveDays && normalizedType !== 'MATERNITY') {
        throw new Error(
          `Maximum consecutive working leave allowed is ${rules.leave.maxConsecutiveLeaveDays} day(s) per company policy`
        );
      }
      const inNotice = await SeparationService.hasActiveSeparationInNotice(empId);
      if (inNotice && !rules.exit.allowLeaveDuringNotice) {
        throw new Error('Leave applications are restricted during notice period per company policy');
      }

      // Balance check applies to General leaves (Casual, Sick, Earned)
      if (normalizedType !== 'MATERNITY' && normalizedType !== 'PATERNITY' && normalizedType !== 'LOSS_OF_PAY') {
        const balance = await this.getLeaveBalance(empId);
        if (effectiveWorkingDays > balance.remaining) {
          throw new Error(
            `Insufficient leave balance. Applying for ${effectiveWorkingDays} working day(s) (${weekOffDays} week-off(s) excluded). Remaining: ${balance.remaining} day(s)`
          );
        }
      }
    }

    const mappedLeaveType =
      normalizedType === 'MATERNITY' ? 'MATERNITY' :
      normalizedType === 'PATERNITY' ? 'PATERNITY' :
      normalizedType === 'SICK' ? 'SICK' :
      normalizedType === 'EARNED' || normalizedType === 'PRIVILEGE' ? 'EARNED' :
      normalizedType === 'LOSS_OF_PAY' || normalizedType === 'UNPAID' ? 'LOSS_OF_PAY' :
      'CASUAL';

    const leave = await prisma.leave.create({
      data: {
        employeeId: empId,
        type: mappedLeaveType as any,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        status: 'PENDING',
      },
    });

    if (tenant) {
      await ApprovalService.createLeaveApproval({
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

  static async updateStatus(id: string, status: any, processedBy: string, adminRemark?: string) {
    if (!id || !String(id).match(/^[0-9a-fA-F]{24}$/)) {
      if (id && String(id).startsWith('req_')) {
        let tenantId = '6a08259b752e15d6a06ec490';
        if (processedBy && String(processedBy).match(/^[0-9a-fA-F]{24}$/)) {
          const user = await prisma.user.findUnique({ where: { id: processedBy }, select: { tenantId: true } }).catch(() => null);
          const employee = !user?.tenantId ? await prisma.employee.findFirst({ where: { userId: processedBy } }).catch(() => null) : null;
          tenantId = user?.tenantId || employee?.tenantId || tenantId;
        }
        const normStatus = String(status).toUpperCase() === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        const res = await AttendanceService.updateAttendanceRequestStatus(tenantId, processedBy, String(id), {
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

    const existingLeave = await prisma.leave.findUnique({
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

    const updated = await prisma.leave.update({
      where: { id },
      data: {
        status,
        processedBy,
        processedAt: new Date(),
        adminRemark,
      },
    });

    const tenantId =
      existingLeave.employee?.tenantId ||
      existingLeave.employee?.orgUnit?.tenantId ||
      existingLeave.employee?.user?.tenantId ||
      'default-tenant';

    if (status === 'APPROVED') {
      await AttendanceService.syncLeaveToAttendance(
        tenantId,
        id,
        existingLeave.employeeId,
        existingLeave.startDate,
        existingLeave.endDate,
        existingLeave.type,
        'APPROVED'
      ).catch((err) => console.error('Error syncing leave to attendance:', err));
    } else if (status === 'REJECTED') {
      await AttendanceService.syncLeaveToAttendance(
        tenantId,
        id,
        existingLeave.employeeId,
        existingLeave.startDate,
        existingLeave.endDate,
        existingLeave.type,
        'REJECTED'
      ).catch((err) => console.error('Error syncing leave rejection to attendance:', err));
    }

    return updated;
  }

  static async getByEmployee(employeeId: string) {
    const empId = await this.resolveEmployeeId(employeeId);
    return prisma.leave.findMany({
      where: { employeeId: empId },
      orderBy: { appliedAt: 'desc' }
    });
  }

  static async getAll(filters: any = {}, scope?: OrgScopeContext) {
    if (!scope?.tenantId) return [];

    if (filters.employeeId) {
      filters.employeeId = await this.resolveEmployeeId(filters.employeeId);
    }

    const visibleEmployees = await prisma.employee.findMany({
      where: employeeWhereFromScope(scope),
      select: { id: true },
    });
    const visibleIds = visibleEmployees.map((e) => e.id);
    if (visibleIds.length === 0) return [];

    if (filters.employeeId && !visibleIds.includes(filters.employeeId)) {
      return [];
    }

    const where: any = {
      employeeId: filters.employeeId || { in: visibleIds },
    };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;

    const leaves = await prisma.leave.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
    });

    const employeeIds = Array.from(new Set(leaves.map((leave) => leave.employeeId)));
    const employees = employeeIds.length
      ? await prisma.employee.findMany({
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

  static async cancel(id: string, employeeId: string) {
    if (!id || !String(id).match(/^[0-9a-fA-F]{24}$/)) {
      if (id && String(id).startsWith('req_')) {
        return { id, cancelled: true };
      }
      throw new Error(`Invalid Leave record ID: ${id}`);
    }
    const empId = await this.resolveEmployeeId(employeeId);
    const leave = await prisma.leave.findUnique({
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

    const tenantId =
      leave.employee?.tenantId ||
      leave.employee?.orgUnit?.tenantId ||
      leave.employee?.user?.tenantId ||
      'default-tenant';

    await AttendanceService.syncLeaveToAttendance(
      tenantId,
      id,
      leave.employeeId,
      leave.startDate,
      leave.endDate,
      leave.type,
      'CANCELLED'
    ).catch((err) => console.error('Error syncing leave cancellation to attendance:', err));

    return prisma.leave.delete({ where: { id } });
  }

  static async getWorkWeekRoster(tenantId: string, year?: number, month?: number) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const now = new Date();
    const targetYear = Number(year) || now.getFullYear();
    const targetMonth = Number(month) || now.getMonth() + 1; // 1-12

    const saturdays = getMonthlySaturdayRoster(targetYear, targetMonth, rules.workWeek);
    const fullRoster = getMonthFullRoster(targetYear, targetMonth, rules.workWeek);

    // Holidays in tenant
    const holidays = await prisma.holiday.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    const holidayMap = new Map<string, string>();
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

    const currentOption =
      WORK_WEEK_OPTIONS.find((opt) => opt.key === rules.workWeek.pattern) || WORK_WEEK_OPTIONS[0];

    return {
      workWeek: rules.workWeek,
      currentOption,
      options: WORK_WEEK_OPTIONS,
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

  static async updateWorkWeekRoster(
    tenantId: string,
    userId: string,
    data: { pattern: WorkWeekPattern; customWeekOffDays?: number[] }
  ) {
    if (!data.pattern) throw new Error('Work week pattern is required');

    await PolicyService.updateActiveRules(tenantId, userId, {
      workWeek: {
        pattern: data.pattern,
        customWeekOffDays: data.customWeekOffDays || (data.pattern === 'FIVE_DAY' ? [0, 6] : [0]),
      },
    });

    return this.getWorkWeekRoster(tenantId);
  }

  static async calculateDaysBreakdown(
    tenantId: string,
    startDate: string,
    endDate: string,
    overridePattern?: WorkWeekPattern
  ) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const activeRules = overridePattern
      ? {
          ...rules,
          workWeek: {
            ...rules.workWeek,
            pattern: overridePattern,
          },
        }
      : rules;

    const holidays = await prisma.holiday.findMany({
      where: { tenantId, isActive: true },
    });
    const holidayMap = new Map<string, string>();
    holidays.forEach((h) => {
      holidayMap.set(new Date(h.date).toISOString().slice(0, 10), h.name);
    });

    return calculateLeaveBreakdown(startDate, endDate, activeRules, holidayMap);
  }

  static async getRosterGrid(
    tenantId: string,
    options: {
      year?: number;
      month?: number;
      view?: 'weekly' | 'monthly';
      weekIndex?: number;
      department?: string;
      search?: string;
    }
  ) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const now = new Date();
    const targetYear = Number(options.year) || now.getFullYear();
    const targetMonth = Number(options.month) || now.getMonth() + 1;
    const view = options.view || 'monthly';

    const empWhere: any = {
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

    const employees = await prisma.employee.findMany({
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

    const holidays = await prisma.holiday.findMany({
      where: { tenantId, isActive: true },
    });
    const holidayMap = new Map<string, string>();
    holidays.forEach((h) => {
      const dStr = new Date(h.date).toISOString().slice(0, 10);
      holidayMap.set(dStr, h.name);
    });

    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const leaves = await prisma.leave.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        status: 'APPROVED',
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
      },
    });

    const leaveMap = new Map<string, string>();
    leaves.forEach((l) => {
      const cur = new Date(l.startDate);
      const end = new Date(l.endDate);
      while (cur <= end) {
        const dStr = cur.toISOString().slice(0, 10);
        leaveMap.set(`${l.employeeId}:${dStr}`, l.type);
        cur.setDate(cur.getDate() + 1);
      }
    });

    const rosterOverrides = (rules as any).rosterSchedules || {};
    const departmentOverrides = rosterOverrides.departmentOverrides || {};
    const employeeOverrides = rosterOverrides.employeeOverrides || {};
    const cellOverrides = rosterOverrides.cellOverrides || {};

    const activeShifts = await this.getShifts(tenantId);

    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const dayNumbers: number[] = [];

    if (view === 'weekly') {
      const weekIndex = options.weekIndex !== undefined ? options.weekIndex : Math.min(Math.floor((now.getDate() - 1) / 7), 3);
      const startDay = weekIndex * 7 + 1;
      const endDay = Math.min(startDay + 6, daysInMonth);
      for (let d = startDay; d <= endDay; d++) dayNumbers.push(d);
    } else {
      for (let d = 1; d <= daysInMonth; d++) dayNumbers.push(d);
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
      const defaultShift = (rules as any).rosterSchedules?.defaultShift || 'GS';
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
        const isOff = isDateWeekOff(dt, effectiveWorkWeek);

        if (isOff) {
          let reason = 'Weekly Off';
          if (d.isSunday) reason = 'Sunday Off';
          else if (d.isSaturday) reason = `${ordinals[(d.saturdayOccurrence || 1) - 1]} Sat Off`;
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

  static async getShifts(tenantId: string): Promise<ShiftType[]> {
    const rules = await PolicyService.getActiveRules(tenantId);
    const customShifts: ShiftType[] = (rules as any).rosterSchedules?.customShifts || [];

    const shiftMap = new Map<string, ShiftType>();
    STANDARD_SHIFTS.forEach((s) => shiftMap.set(s.code, { ...s, isCustom: false }));
    customShifts.forEach((s) => shiftMap.set(s.code, { ...s, isCustom: true }));

    return Array.from(shiftMap.values());
  }

  static async createOrUpdateShift(tenantId: string, userId: string, shiftData: Partial<ShiftType>) {
    if (!shiftData.code || !shiftData.name) {
      throw new Error('Shift code and name are required');
    }
    const rules = await PolicyService.getActiveRules(tenantId);
    const currentRoster = (rules as any).rosterSchedules || {};
    const customShifts: ShiftType[] = [...(currentRoster.customShifts || [])];

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

    const normalized: ShiftType = {
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
    } else {
      customShifts.push(normalized);
    }

    await PolicyService.updateActiveRules(tenantId, userId, {
      ...rules,
      rosterSchedules: {
        ...currentRoster,
        customShifts,
      },
    } as any);

    return this.getShifts(tenantId);
  }

  static async deleteShift(tenantId: string, userId: string, code: string) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const currentRoster = (rules as any).rosterSchedules || {};
    let customShifts: ShiftType[] = [...(currentRoster.customShifts || [])];

    customShifts = customShifts.filter((s) => s.code !== code.toUpperCase().trim());

    await PolicyService.updateActiveRules(tenantId, userId, {
      ...rules,
      rosterSchedules: {
        ...currentRoster,
        customShifts,
      },
    } as any);

    return this.getShifts(tenantId);
  }

  static async bulkAssignRoster(
    tenantId: string,
    userId: string,
    data: {
      employeeIds?: string[];
      department?: string;
      pattern: WorkWeekPattern;
      shiftCode?: string;
      customWeekOffDays?: number[];
      applyToAll?: boolean;
    }
  ) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const currentRoster = (rules as any).rosterSchedules || {};
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

    await PolicyService.updateActiveRules(tenantId, userId, {
      ...rules,
      workWeek: isOrgWide ? workWeekConfig : rules.workWeek,
      rosterSchedules: {
        ...currentRoster,
        defaultShift: isOrgWide ? shiftCode : (currentRoster.defaultShift || 'GS'),
        departmentOverrides,
        employeeOverrides,
      },
    } as any);

    return this.getRosterGrid(tenantId, {});
  }

  static async overrideRosterCell(
    tenantId: string,
    userId: string,
    data: {
      employeeId: string;
      dateStr: string;
      shiftCode: string;
    }
  ) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const currentRoster = (rules as any).rosterSchedules || {};
    const cellOverrides = { ...(currentRoster.cellOverrides || {}) };

    const key = `${data.employeeId}:${data.dateStr}`;
    if (data.shiftCode === 'RESET' || data.shiftCode === 'DEFAULT') {
      delete cellOverrides[key];
    } else {
      cellOverrides[key] = data.shiftCode;
    }

    await PolicyService.updateActiveRules(tenantId, userId, {
      ...rules,
      rosterSchedules: {
        ...currentRoster,
        cellOverrides,
      },
    } as any);

    return { key, shiftCode: data.shiftCode };
  }

  static async createRosterSchedule(
    tenantId: string,
    userId: string,
    data: {
      employeeIds?: string[];
      department?: string;
      applyToAll?: boolean;
      startDate: string;
      endDate: string;
      shiftCode: string;
      workingDays?: number[];
      saturdayRule?: 'ALL_WORKING' | '2ND_4TH_OFF' | '1ST_3RD_OFF' | 'ALL_OFF';
    }
  ) {
    if (!data.startDate || !data.endDate) {
      throw new Error('startDate and endDate are required');
    }

    const rules = await PolicyService.getActiveRules(tenantId);
    const currentRoster = (rules as any).rosterSchedules || {};
    const cellOverrides = { ...(currentRoster.cellOverrides || {}) };
    const employeeOverrides = { ...(currentRoster.employeeOverrides || {}) };

    let targetEmpIds: string[] = [];
    if (data.applyToAll || (!data.employeeIds?.length && (!data.department || data.department === 'ALL'))) {
      const allEmps = await prisma.employee.findMany({
        where: {
          OR: [{ tenantId }, { orgUnit: { tenantId } }, { user: { tenantId } }],
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      targetEmpIds = allEmps.map((e) => e.id);
    } else if (data.department && data.department !== 'ALL') {
      const deptEmps = await prisma.employee.findMany({
        where: {
          OR: [{ tenantId }, { orgUnit: { tenantId } }, { user: { tenantId } }],
          department: data.department,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      targetEmpIds = deptEmps.map((e) => e.id);
    } else if (Array.isArray(data.employeeIds) && data.employeeIds.length > 0) {
      targetEmpIds = data.employeeIds;
    }

    if (targetEmpIds.length === 0) {
      throw new Error('No active employees selected for roster schedule');
    }

    const workingDays =
      data.workingDays !== undefined && Array.isArray(data.workingDays)
        ? data.workingDays
        : [1, 2, 3, 4, 5, 6];
    let saturdayRule = data.saturdayRule || '2ND_4TH_OFF';
    const shiftCode = data.shiftCode || 'GS';

    // Synchronize Saturday rule if workingDays has 6 days or lacks Saturday
    const satWorking = workingDays.includes(6);
    if (!satWorking) {
      saturdayRule = 'ALL_OFF';
    } else if (satWorking && saturdayRule === 'ALL_OFF') {
      saturdayRule = 'ALL_WORKING';
    }

    // Determine consistent WorkWeekPattern for employeeOverrides
    let workWeekPattern: WorkWeekPattern = 'SIX_DAY';
    if (!satWorking || saturdayRule === 'ALL_OFF') {
      workWeekPattern = 'FIVE_DAY';
    } else if (saturdayRule === '2ND_4TH_OFF') {
      workWeekPattern = 'ALTERNATE_SAT_2ND_4TH';
    } else if (saturdayRule === '1ST_3RD_OFF') {
      workWeekPattern = 'ALTERNATE_SAT_1ST_3RD';
    } else if (saturdayRule === 'ALL_WORKING') {
      workWeekPattern = 'SIX_DAY';
    }

    const employeeWorkWeek: WorkWeekConfig = {
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

    const datesToSet: { dateStr: string; status: string }[] = [];

    while (cur <= end) {
      const dayOfWeek = cur.getUTCDay();
      const dayOfMonth = cur.getUTCDate();
      const dateStr = cur.toISOString().slice(0, 10);

      let status = shiftCode;

      if (dayOfWeek === 0) {
        status = workingDays.includes(0) ? shiftCode : 'WO';
      } else if (dayOfWeek === 6) {
        if (!satWorking || saturdayRule === 'ALL_OFF') {
          status = 'WO';
        } else if (saturdayRule === 'ALL_WORKING') {
          status = shiftCode;
        } else if (saturdayRule === '2ND_4TH_OFF') {
          const occ = Math.ceil(dayOfMonth / 7);
          status = occ === 2 || occ === 4 ? 'WO' : shiftCode;
        } else if (saturdayRule === '1ST_3RD_OFF') {
          const occ = Math.ceil(dayOfMonth / 7);
          status = occ === 1 || occ === 3 ? 'WO' : shiftCode;
        }
      } else {
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
        } else {
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

    await PolicyService.updateActiveRules(tenantId, userId, {
      ...rules,
      rosterSchedules: {
        ...currentRoster,
        cellOverrides,
        employeeOverrides,
      },
    } as any);

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

  static async getTeamCalendar(
    scope: OrgScopeContext,
    options: {
      department?: string;
      locationId?: string;
      year?: number;
      month?: number;
    }
  ) {
    const tenantId = scope.tenantId;
    if (!tenantId) throw new Error('Tenant context is required');

    const now = new Date();
    const year = Number(options.year) || now.getFullYear();
    const month = Number(options.month) || (now.getMonth() + 1); // 1-12

    // Dates for the month in UTC
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    // Today in UTC YYYY-MM-DD
    const todayStr = now.toISOString().slice(0, 10);

    // Active rules for work week
    const rules = await PolicyService.getActiveRules(tenantId);
    const workWeek = rules.workWeek;

    // Holidays in tenant
    const holidays = await prisma.holiday.findMany({
      where: { tenantId, isActive: true },
    });
    const holidayMap = new Map<string, string>();
    holidays.forEach((h) => {
      const dStr = new Date(h.date).toISOString().slice(0, 10);
      holidayMap.set(dStr, h.name);
    });

    // Employees in scope
    const empWhere: any = {
      ...employeeWhereFromScope(scope),
      status: 'ACTIVE',
    };
    if (options.department && options.department !== 'ALL') {
      empWhere.department = options.department;
    }
    if (options.locationId && options.locationId !== 'ALL') {
      empWhere.locationId = options.locationId;
    }

    const employees = await prisma.employee.findMany({
      where: empWhere,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        department: true,
        designation: true,
        avatar: true,
        locationId: true,
      },
      orderBy: [{ department: 'asc' }, { firstName: 'asc' }],
    });

    // Distinct departments for filter
    const allDepartments = await prisma.employee.findMany({
      where: {
        ...employeeWhereFromScope(scope),
        status: 'ACTIVE',
      },
      distinct: ['department'],
      select: { department: true },
    });
    const departmentList = allDepartments.map((d) => d.department).filter(Boolean);

    const empIds = employees.map((e) => e.id);

    // Fetch leaves for these employees overlapping this month
    const leaves = empIds.length > 0 ? await prisma.leave.findMany({
      where: {
        employeeId: { in: empIds },
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
      },
      select: {
        id: true,
        employeeId: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        reason: true,
      },
    }) : [];

    // Map leaves by employeeId -> Map<dateStr, leaveInfo>
    const employeeLeavesMap = new Map<string, Map<string, any>>();
    for (const l of leaves) {
      if (!employeeLeavesMap.has(l.employeeId)) {
        employeeLeavesMap.set(l.employeeId, new Map());
      }
      const lMap = employeeLeavesMap.get(l.employeeId)!;

      const lStart = new Date(l.startDate);
      const lEnd = new Date(l.endDate);

      const cur = new Date(Date.UTC(lStart.getUTCFullYear(), lStart.getUTCMonth(), lStart.getUTCDate()));
      const maxEnd = new Date(Date.UTC(lEnd.getUTCFullYear(), lEnd.getUTCMonth(), lEnd.getUTCDate()));

      while (cur <= maxEnd) {
        const dStr = cur.toISOString().slice(0, 10);
        lMap.set(dStr, {
          leaveId: l.id,
          leaveType: l.type,
          status: l.status,
          reason: l.reason,
        });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    // Days header
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysHeader: any[] = [];
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(Date.UTC(year, month - 1, day));
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getUTCDay();
      const holidayName = holidayMap.get(dateStr) || null;

      const isWeekOff = isDateWeekOff(d, workWeek);

      daysHeader.push({
        day,
        date: dateStr,
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isWeekOff,
        isHoliday: !!holidayName,
        holidayName,
        isToday: dateStr === todayStr,
      });
    }

    // Build per-employee grid and aggregate who is off today
    const onLeaveToday: any[] = [];
    const pendingToday: any[] = [];
    let offTodayCount = 0;
    let upcomingLeavesCount = 0;

    const calendarGrid = employees.map((emp) => {
      const lMap = employeeLeavesMap.get(emp.id);
      let empOffToday = false;

      const employeeDays = daysHeader.map((dHeader) => {
        const leave = lMap?.get(dHeader.date);

        let status: 'PRESENT' | 'LEAVE' | 'PENDING_LEAVE' | 'WEEK_OFF' | 'HOLIDAY' = 'PRESENT';
        let leaveType: string | null = null;
        let leaveId: string | null = null;
        let reason: string | null = null;

        if (leave) {
          if (leave.status === 'APPROVED') {
            status = 'LEAVE';
            leaveType = leave.leaveType;
            leaveId = leave.leaveId;
            reason = leave.reason;
            upcomingLeavesCount++;
            if (dHeader.date === todayStr) {
              empOffToday = true;
              onLeaveToday.push({
                employeeId: emp.id,
                employeeCode: emp.employeeId,
                name: `${emp.firstName} ${emp.lastName}`,
                department: emp.department,
                designation: emp.designation,
                leaveType: leave.leaveType,
                reason: leave.reason,
              });
            }
          } else if (leave.status === 'PENDING') {
            status = 'PENDING_LEAVE';
            leaveType = leave.leaveType;
            leaveId = leave.leaveId;
            reason = leave.reason;
            if (dHeader.date === todayStr) {
              pendingToday.push({
                employeeId: emp.id,
                employeeCode: emp.employeeId,
                name: `${emp.firstName} ${emp.lastName}`,
                department: emp.department,
                designation: emp.designation,
                leaveType: leave.leaveType,
                reason: leave.reason,
              });
            }
          }
        } else if (dHeader.isHoliday) {
          status = 'HOLIDAY';
          if (dHeader.date === todayStr) empOffToday = true;
        } else if (dHeader.isWeekOff) {
          status = 'WEEK_OFF';
          if (dHeader.date === todayStr) empOffToday = true;
        }

        return {
          day: dHeader.day,
          date: dHeader.date,
          status,
          leaveType,
          leaveId,
          reason,
          holidayName: dHeader.holidayName,
        };
      });

      if (empOffToday) {
        offTodayCount++;
      }

      return {
        employee: {
          id: emp.id,
          employeeCode: emp.employeeId,
          name: `${emp.firstName} ${emp.lastName}`,
          department: emp.department,
          designation: emp.designation,
          avatar: emp.avatar,
        },
        days: employeeDays,
      };
    });

    return {
      year,
      month,
      todayStr,
      totalEmployees: employees.length,
      daysHeader,
      calendar: calendarGrid,
      departments: departmentList,
      summary: {
        totalEmployees: employees.length,
        offTodayCount,
        onLeaveTodayCount: onLeaveToday.length,
        onLeaveToday,
        pendingTodayCount: pendingToday.length,
        pendingToday,
        upcomingLeavesCount,
      },
    };
  }
}


