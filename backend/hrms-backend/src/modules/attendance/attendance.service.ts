import prisma from '../../shared/prisma';
import { LeaveType, AccrualTransactionType } from '@prisma/client';
import { isInsideGeofence } from '../../shared/utils/geo';
import { OrgScopeContext, employeeWhereFromScope } from '../../shared/org/org-scope.service';
import { PolicyService } from '../policies/policy.service';
import {
  isDateWeekOff,
  matchesIpAllowlist,
  STANDARD_SHIFTS,
  ShiftType,
  ShiftCategory,
  TenantHrRules,
  DepartmentAttendancePolicy,
} from '../policies/policy-rules';

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

function parseCoords(options: PunchOptions) {
  const lat = Number(options.latitude ?? options.lat);
  const lng = Number(options.longitude ?? options.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalDayRange(d: Date = new Date()): { today: Date; tomorrow: Date; todayStr: string } {
  const today = new Date(d);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = getLocalDateString(d);
  return { today, tomorrow, todayStr };
}

export class AttendanceService {
  static async resolveEmployeeId(employeeId: string): Promise<string> {
    if (!employeeId) throw new Error('Employee ID is required');
    const str = String(employeeId);
    if (str.match(/^[0-9a-fA-F]{24}$/)) {
      return str;
    }
    const emp = await prisma.employee.findUnique({ where: { employeeId } });
    if (!emp) throw new Error(`Employee with ID ${employeeId} not found`);
    return emp.id;
  }

  static async loadEmployeeWithLocation(empId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      include: {
        location: true,
        orgUnit: { select: { tenantId: true } },
        user: { select: { tenantId: true } },
      },
    });
    if (!employee) throw new Error('Employee not found');
    return employee;
  }

  static evaluateGeofence(
    employee: { location: any | null },
    coords: { lat: number; lng: number } | null,
    skipGeofence: boolean
  ) {
    // If geofence is disabled, we still compute distance for auditing/tracking.
    if (!employee.location || !coords) {
      return { allowed: true, distanceMeters: null as number | null, inside: true };
    }

    const { inside, distanceMeters } = isInsideGeofence(
      coords.lat,
      coords.lng,
      employee.location.lat,
      employee.location.lng,
      employee.location.radiusMeters
    );

    return { allowed: skipGeofence ? true : inside, distanceMeters, inside };
  }

  static resolveEffectiveAttendancePolicy(
    rules: TenantHrRules,
    department?: string
  ): DepartmentAttendancePolicy {
    const defaultAtt = rules.attendance;
    const deptPolicies = defaultAtt.departmentPolicies || {};
    const deptPolicy = department ? deptPolicies[department] : undefined;

    return {
      departmentId: department || 'DEFAULT',
      departmentName: deptPolicy?.departmentName || department || 'Default Policy',
      workStartTime: deptPolicy?.workStartTime || defaultAtt.workStartTime || '09:30',
      workEndTime: deptPolicy?.workEndTime || defaultAtt.workEndTime || '18:30',
      gracePeriodMinutes: deptPolicy?.gracePeriodMinutes ?? defaultAtt.gracePeriodMinutes ?? 15,
      lateMarkAfterMinutes: deptPolicy?.lateMarkAfterMinutes ?? defaultAtt.lateMarkAfterMinutes ?? 30,
      halfDayThresholdHours: deptPolicy?.halfDayThresholdHours ?? defaultAtt.halfDayThresholdHours ?? 4,
      allowRemotePunch: deptPolicy?.allowRemotePunch ?? defaultAtt.allowRemotePunch ?? true,
      requireGeofence: deptPolicy?.requireGeofence ?? defaultAtt.requireGeofence ?? true,
      allowWebPunch: deptPolicy?.allowWebPunch ?? defaultAtt.allowWebPunch ?? true,
      isFlexiHours: deptPolicy?.isFlexiHours ?? defaultAtt.isFlexiHours ?? false,
      flexiMinHoursPerDay: deptPolicy?.flexiMinHoursPerDay ?? defaultAtt.flexiMinHoursPerDay ?? 8,
      flexiWindowStartTime: deptPolicy?.flexiWindowStartTime ?? defaultAtt.flexiWindowStartTime ?? '08:00',
      flexiWindowEndTime: deptPolicy?.flexiWindowEndTime ?? defaultAtt.flexiWindowEndTime ?? '20:00',
    };
  }

  static async getEffectiveShiftForDate(
    tenantId: string,
    employeeId: string,
    department: string,
    dateInput: Date | string
  ): Promise<EffectiveShiftInfo> {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const dateStr = getLocalDateString(d);
    const dayOfWeek = d.getDay();

    const rules = await PolicyService.getActiveRules(tenantId);
    const attRules = rules.attendance;
    const effectiveGroupPolicy = this.resolveEffectiveAttendancePolicy(rules, department);
    const roster = (rules as any).rosterSchedules || {};
    const departmentOverrides = roster.departmentOverrides || {};
    const employeeOverrides = roster.employeeOverrides || {};
    const cellOverrides = roster.cellOverrides || {};
    const defaultShiftCode = roster.defaultShift || 'GS';
    const customShifts: ShiftType[] = roster.customShifts || [];

    const shiftMap = new Map<string, ShiftType>();
    STANDARD_SHIFTS.forEach((s) => shiftMap.set(s.code, { ...s }));
    customShifts.forEach((s) => shiftMap.set(s.code, { ...s, isCustom: true }));

    const getShiftTimes = (shift?: ShiftType, code?: string) => {
      let startTime = shift?.startTime;
      let endTime = shift?.endTime;
      if (!startTime || !endTime) {
        const c = (code || shift?.code || 'GS').toUpperCase();
        if (c === 'MS') {
          startTime = '06:00';
          endTime = '14:30';
        } else if (c === 'ES') {
          startTime = '14:00';
          endTime = '22:30';
        } else if (c === 'NS') {
          startTime = '22:00';
          endTime = '06:30';
        } else if (c === 'SS') {
          startTime = '10:00';
          endTime = '21:00';
        } else {
          startTime = effectiveGroupPolicy.workStartTime || attRules.workStartTime || '09:30';
          endTime = effectiveGroupPolicy.workEndTime || attRules.workEndTime || '18:30';
        }
      }
      return { startTime, endTime };
    };

    // 0. Holiday check
    const holidays = await prisma.holiday.findMany({ where: { tenantId, isActive: true } });
    const holidayMatch = holidays.find((h) => new Date(h.date).toISOString().slice(0, 10) === dateStr);
    const isHoliday = !!holidayMatch;
    const holidayName = holidayMatch ? holidayMatch.name : undefined;

    // 1. Manual Cell Override takes highest priority
    const cellKey = `${employeeId}:${dateStr}`;
    const manualOverride = cellOverrides[cellKey];

    if (manualOverride) {
      if (manualOverride === 'WO') {
        return {
          code: 'WO',
          name: 'Weekly Off (Override)',
          timings: 'Scheduled Off',
          category: 'GENERAL',
          startTime: '00:00',
          endTime: '00:00',
          gracePeriodMinutes: 0,
          halfDayThresholdHours: 0,
          color: '#059669',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
          isWeeklyOff: true,
          weeklyOffReason: 'Weekly Off (Override)',
          isHoliday,
          holidayName,
          isOverride: true,
          isFlexiHours: effectiveGroupPolicy.isFlexiHours,
          flexiMinHoursPerDay: effectiveGroupPolicy.flexiMinHoursPerDay,
          flexiWindowStartTime: effectiveGroupPolicy.flexiWindowStartTime,
          flexiWindowEndTime: effectiveGroupPolicy.flexiWindowEndTime,
        };
      }

      const shift = shiftMap.get(manualOverride) || STANDARD_SHIFTS[0];
      const { startTime, endTime } = getShiftTimes(shift, manualOverride);
      return {
        code: shift.code,
        name: shift.name,
        timings: shift.timings || `${startTime} – ${endTime}`,
        category: shift.category || 'GENERAL',
        startTime,
        endTime,
        firstSlotStartTime: shift.firstSlotStartTime,
        firstSlotEndTime: shift.firstSlotEndTime,
        secondSlotStartTime: shift.secondSlotStartTime,
        secondSlotEndTime: shift.secondSlotEndTime,
        gracePeriodMinutes: shift.gracePeriodMinutes ?? effectiveGroupPolicy.gracePeriodMinutes ?? 15,
        halfDayThresholdHours: shift.halfDayHours ?? effectiveGroupPolicy.halfDayThresholdHours ?? 4,
        color: shift.color || '#0f172a',
        badgeClass: shift.badgeClass || 'bg-slate-100 text-slate-800 font-bold',
        isWeeklyOff: false,
        isHoliday,
        holidayName,
        isOverride: true,
        isFlexiHours: effectiveGroupPolicy.isFlexiHours,
        flexiMinHoursPerDay: effectiveGroupPolicy.flexiMinHoursPerDay,
        flexiWindowStartTime: effectiveGroupPolicy.flexiWindowStartTime,
        flexiWindowEndTime: effectiveGroupPolicy.flexiWindowEndTime,
      };
    }

    // 2. Work Week & Shift Hierarchy
    const empOverride = employeeOverrides[employeeId];
    const deptOverride = department ? departmentOverrides[department] : undefined;
    const effectiveWorkWeek = empOverride?.workWeek || deptOverride?.workWeek || rules.workWeek;

    const isOff = isDateWeekOff(d, effectiveWorkWeek);
    if (isOff) {
      let reason = 'Weekly Off';
      if (dayOfWeek === 0) reason = 'Sunday Off';
      else if (dayOfWeek === 6) {
        const occ = Math.ceil(d.getDate() / 7);
        const ordinals = ['1st', '2nd', '3rd', '4th', '5th'];
        reason = `${ordinals[(occ || 1) - 1]} Sat Off`;
      }
      return {
        code: 'WO',
        name: reason,
        timings: 'Scheduled Off',
        category: 'GENERAL',
        startTime: '00:00',
        endTime: '00:00',
        gracePeriodMinutes: 0,
        halfDayThresholdHours: 0,
        color: '#059669',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
        isWeeklyOff: true,
        weeklyOffReason: reason,
        isHoliday,
        holidayName,
        isOverride: false,
        isFlexiHours: effectiveGroupPolicy.isFlexiHours,
        flexiMinHoursPerDay: effectiveGroupPolicy.flexiMinHoursPerDay,
        flexiWindowStartTime: effectiveGroupPolicy.flexiWindowStartTime,
        flexiWindowEndTime: effectiveGroupPolicy.flexiWindowEndTime,
      };
    }

    // 3. Effective assigned shift
    const effectiveShiftCode = empOverride?.shiftCode || deptOverride?.shiftCode || defaultShiftCode;
    const shift = shiftMap.get(effectiveShiftCode) || STANDARD_SHIFTS[0];
    const { startTime, endTime } = getShiftTimes(shift, effectiveShiftCode);

    return {
      code: shift.code,
      name: shift.name,
      timings: shift.timings || `${startTime} – ${endTime}`,
      category: shift.category || 'GENERAL',
      startTime,
      endTime,
      firstSlotStartTime: shift.firstSlotStartTime,
      firstSlotEndTime: shift.firstSlotEndTime,
      secondSlotStartTime: shift.secondSlotStartTime,
      secondSlotEndTime: shift.secondSlotEndTime,
      gracePeriodMinutes: shift.gracePeriodMinutes ?? effectiveGroupPolicy.gracePeriodMinutes ?? 15,
      halfDayThresholdHours: shift.halfDayHours ?? effectiveGroupPolicy.halfDayThresholdHours ?? 4,
      color: shift.color || '#0f172a',
      badgeClass: shift.badgeClass || 'bg-slate-100 text-slate-800 font-bold',
      isWeeklyOff: false,
      isHoliday,
      holidayName,
      isOverride: false,
      isFlexiHours: effectiveGroupPolicy.isFlexiHours,
      flexiMinHoursPerDay: effectiveGroupPolicy.flexiMinHoursPerDay,
      flexiWindowStartTime: effectiveGroupPolicy.flexiWindowStartTime,
      flexiWindowEndTime: effectiveGroupPolicy.flexiWindowEndTime,
    };
  }

  static async syncLeaveToAttendance(
    tenantId: string,
    leaveId: string,
    employeeId: string,
    startDate: Date | string,
    endDate: Date | string,
    leaveType: string,
    action: 'APPROVED' | 'REJECTED' | 'CANCELLED'
  ) {
    const empId = await this.resolveEmployeeId(employeeId);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (action === 'APPROVED') {
      const holidays = await prisma.holiday.findMany({ where: { tenantId, isActive: true } });
      const holidayDates = new Set(holidays.map((h) => new Date(h.date).toISOString().slice(0, 10)));
      const emp = await prisma.employee.findUnique({
        where: { id: empId },
        select: { id: true, department: true },
      });

      const cur = new Date(start);
      const reversedAbsentDates: string[] = [];
      while (cur <= end) {
        const curDate = new Date(cur);
        curDate.setHours(0, 0, 0, 0);
        const curDateEnd = new Date(cur);
        curDateEnd.setHours(23, 59, 59, 999);
        const dateStr = getLocalDateString(curDate);

        const shift = await this.getEffectiveShiftForDate(tenantId, empId, emp?.department || '', curDate);
        const isHoliday = holidayDates.has(dateStr);

        // Record attendance as approved paid leave on working days
        if (!shift.isWeeklyOff && !isHoliday) {
          const existing = await prisma.attendance.findFirst({
            where: {
              employeeId: empId,
              date: { gte: curDate, lte: curDateEnd },
            },
          });

          const inTime = new Date(curDate);
          inTime.setHours(9, 0, 0, 0);
          const outTime = new Date(curDate);
          outTime.setHours(18, 0, 0, 0);

          if (existing) {
            const wasAbsent = existing.status === 'ABSENT';
            if (existing.punchMode === 'leave' || wasAbsent || !existing.isActive) {
              await prisma.attendance.update({
                where: { id: existing.id },
                data: {
                  status: 'PRESENT',
                  punchMode: 'leave',
                  punchStatus: 'ACCEPTED',
                  isActive: false,
                  rejectionReason: `Approved Leave: ${leaveType} [${leaveId}]`,
                },
              });
              if (wasAbsent) {
                reversedAbsentDates.push(dateStr);
              }
            }
          } else {
            await prisma.attendance.create({
              data: {
                employeeId: empId,
                date: curDate,
                checkInTime: inTime,
                checkOutTime: outTime,
                status: 'PRESENT',
                punchMode: 'leave',
                punchStatus: 'ACCEPTED',
                isActive: false,
                rejectionReason: `Approved Leave: ${leaveType} [${leaveId}]`,
              },
            });
          }
        }

        cur.setDate(cur.getDate() + 1);
      }

      // If any dates were previously marked ABSENT, generate LOP reversal adjustment & audit ledger credit
      if (reversedAbsentDates.length > 0) {
        const payrollMonth = new Date().toISOString().slice(0, 7);
        const reversedDays = reversedAbsentDates.length;

        await prisma.lopReversalAdjustment.create({
          data: {
            tenantId,
            employeeId: empId,
            leaveId,
            reversedDays,
            datesAffected: reversedAbsentDates,
            payrollMonth,
            status: 'PENDING_PAYROLL',
            notes: `Auto-generated LOP reversal for ${reversedDays} absent day(s) upon approval of ${leaveType} leave [${leaveId}]`,
          },
        }).catch((err) => console.error('Failed to create LopReversalAdjustment:', err));

        // Credit to leave ledger
        const mappedType =
          leaveType === 'CASUAL' ? LeaveType.CASUAL :
          leaveType === 'SICK' ? LeaveType.SICK : LeaveType.EARNED;

        const lastLedger = await prisma.leaveAccrualLedger.findFirst({
          where: { tenantId, employeeId: empId, leaveType: mappedType },
          orderBy: { effectiveDate: 'desc' },
        });
        const prevBal = lastLedger ? lastLedger.closingBalance : 0;

        await prisma.leaveAccrualLedger.create({
          data: {
            tenantId,
            employeeId: empId,
            leaveType: mappedType,
            transactionType: AccrualTransactionType.LOP_REVERSAL,
            amount: reversedDays,
            openingBalance: prevBal,
            closingBalance: prevBal + reversedDays,
            effectiveDate: new Date(),
            description: `LOP Reversal: ${reversedDays} day(s) refunded (${reversedAbsentDates.join(', ')})`,
          },
        }).catch((err) => console.error('Failed to create LeaveAccrualLedger LOP_REVERSAL entry:', err));
      }

      // If today is within [start, end], update employee status to ON_LEAVE
      const now = new Date();
      if (now >= start && now <= end) {
        await prisma.employee.update({
          where: { id: empId },
          data: { status: 'ON_LEAVE' },
        }).catch(() => {});
      }
    } else {
      // REJECTED or CANCELLED: Revert attendance records created for this leave
      await prisma.attendance.deleteMany({
        where: {
          employeeId: empId,
          rejectionReason: { contains: leaveId },
          punchMode: 'leave',
        },
      });

      // If employee is currently ON_LEAVE, check if any other approved leaves exist today
      const now = new Date();
      const { today, tomorrow } = getLocalDayRange(now);
      const otherActiveLeave = await prisma.leave.findFirst({
        where: {
          employeeId: empId,
          id: { not: leaveId },
          status: 'APPROVED',
          startDate: { lte: tomorrow },
          endDate: { gte: today },
        },
      });

      if (!otherActiveLeave) {
        const currentEmp = await prisma.employee.findUnique({
          where: { id: empId },
          select: { status: true },
        });
        if (currentEmp?.status === 'ON_LEAVE') {
          await prisma.employee.update({
            where: { id: empId },
            data: { status: 'ACTIVE' },
          }).catch(() => {});
        }
      }
    }
  }

  static async checkIn(employeeId: string, options: PunchOptions = {}) {
    const empId = await this.resolveEmployeeId(employeeId);
    const employee = await this.loadEmployeeWithLocation(empId);
    const coords = parseCoords(options);
    const tenantId = employee.tenantId || employee.orgUnit?.tenantId || employee.user?.tenantId || 'default-tenant';
    const rules = await PolicyService.getActiveRules(tenantId);
    const attRules = rules.attendance;

    const rawMode = String(options.punchMode || 'web').trim();
    const isWeb = rawMode.toUpperCase() === 'WEB';
    const punchMode = isWeb ? 'WEB' : rawMode.toLowerCase();

    // 1. Check if Web Punch is permitted for this employee
    if (isWeb) {
      const isAllowedGlobal = attRules.allowWebPunch !== false;
      const deptAllowed =
        !attRules.allowedWebPunchDepartments ||
        attRules.allowedWebPunchDepartments.includes('ALL') ||
        attRules.allowedWebPunchDepartments.includes(employee.department || '');
      if (!isAllowedGlobal || !deptAllowed) {
        const err: any = new Error(
          'Web clock-in is restricted for your employee group. Please use the mobile punch app or contact HR.'
        );
        err.statusCode = 403;
        throw err;
      }
    }

    const now = options.punchInTime ? new Date(options.punchInTime) : new Date();
    const { today, tomorrow, todayStr } = getLocalDayRange(now);

    // 2. Check for an already active session
    const openSession = await prisma.attendance.findFirst({
      where: {
        employeeId: empId,
        isActive: true,
        date: { gte: today, lt: tomorrow },
      },
      orderBy: { checkInTime: 'desc' },
    });

    if (openSession) {
      return openSession;
    }

    // 3. Remote / WFH status check
    const allRequests: AttendanceRequestItem[] = (rules as any).attendanceRequests || [];
    const isApprovedWfh = allRequests.some(
      (r) =>
        r.employeeId === empId &&
        r.status === 'APPROVED' &&
        (r.type === 'WFH' || r.type === 'ON_DUTY') &&
        r.startDate <= todayStr &&
        r.endDate >= todayStr
    );
    const isRemoteAllowed = isApprovedWfh || attRules.allowRemotePunch === true || options.skipGeofence === true;

    // 4. IP Validation
    const clientIp = options.ipAddress || '127.0.0.1';
    const isOfficeIp = matchesIpAllowlist(
      clientIp,
      attRules.officeIpAllowlist || ['127.0.0.1', '::1', 'localhost', '192.168.*', '10.*']
    );

    // 5. Geofence evaluation
    const geofence = this.evaluateGeofence(employee, coords, isRemoteAllowed || !attRules.requireGeofence);

    // 6. Validation Rule check based on webPunchValidation
    const validationMode = attRules.webPunchValidation || 'ANYWHERE';
    let isPunchAllowed = true;
    let rejectionMessage = '';

    if (isWeb && !isRemoteAllowed) {
      if (validationMode === 'IP_ONLY') {
        if (!isOfficeIp) {
          isPunchAllowed = false;
          rejectionMessage = `Web clock-in restricted to office network. Connected IP: ${clientIp}`;
        }
      } else if (validationMode === 'GPS_ONLY') {
        if (!geofence.allowed && employee.location) {
          isPunchAllowed = false;
          rejectionMessage = `Outside office premises (${Math.round(geofence.distanceMeters || 0)}m from ${employee.location.name}, radius: ${employee.location.radiusMeters}m)`;
        }
      } else if (validationMode === 'BOTH') {
        if (!isOfficeIp || (!geofence.allowed && employee.location)) {
          isPunchAllowed = false;
          rejectionMessage = `Web clock-in requires both office Wi-Fi IP and GPS proximity. (${clientIp}, distance: ${Math.round(geofence.distanceMeters || 0)}m)`;
        }
      }
    } else if (!isRemoteAllowed && employee.location && !geofence.allowed) {
      isPunchAllowed = false;
      rejectionMessage = `Outside work area (${Math.round(geofence.distanceMeters || 0)}m from ${employee.location.name}, limit ${employee.location.radiusMeters}m)`;
    }

    // 7. Accuracy check / suspicious flagging
    let isSuspicious = false;
    let auditNote = '';
    const maxAccuracy = attRules.maxLocationAccuracyMeters || 500;
    if (options.accuracy !== undefined && options.accuracy > maxAccuracy) {
      isSuspicious = true;
      auditNote = `Low GPS Accuracy (±${Math.round(options.accuracy)}m > limit ${maxAccuracy}m)`;
    }

    if (!isPunchAllowed) {
      const rejected = await prisma.attendance.create({
        data: {
          employeeId: empId,
          date: today,
          checkInTime: now,
          status: 'ABSENT',
          lat: coords?.lat,
          lng: coords?.lng,
          distanceMeters: geofence.distanceMeters ?? undefined,
          punchStatus: 'REJECTED',
          isActive: false,
          rejectionReason: rejectionMessage,
          punchMode,
        },
      });

      const err: any = new Error(rejectionMessage);
      err.statusCode = 403;
      err.data = {
        attendanceId: rejected.id,
        distanceMeters: Math.round(geofence.distanceMeters || 0),
        locationRadius: employee.location?.radiusMeters,
        locationName: employee.location?.name,
        clientIp,
      };
      throw err;
    }

    // 8. Late mark / Half-day calculation with dynamic shift resolution
    const effectiveShift = await this.getEffectiveShiftForDate(
      tenantId,
      empId,
      employee.department || '',
      now
    );

    // Check for approved short leave (late entry permission)
    const approvedShortLeaveLate = allRequests.find(
      (r: any) =>
        r.employeeId === empId &&
        r.status === 'APPROVED' &&
        r.type === 'SHORT_LEAVE' &&
        r.startDate <= todayStr &&
        r.endDate >= todayStr &&
        r.shortLeaveType === 'LATE_ENTRY'
    );

    let calculatedStatus: 'PRESENT' | 'LATE' | 'HALFDAY' = 'PRESENT';
    if (effectiveShift.startTime && !effectiveShift.isWeeklyOff && !effectiveShift.isHoliday) {
      if (effectiveShift.isFlexiHours) {
        // Flexi hours: Within flexi window, no late penalty applies
        const [wStartH, wStartM] = (effectiveShift.flexiWindowStartTime || '08:00').split(':').map(Number);
        const [wEndH, wEndM] = (effectiveShift.flexiWindowEndTime || '20:00').split(':').map(Number);
        const windowStart = new Date(now);
        windowStart.setHours(wStartH || 8, wStartM || 0, 0, 0);
        const windowEnd = new Date(now);
        windowEnd.setHours(wEndH || 20, wEndM || 0, 0, 0);

        if (now < windowStart || now > windowEnd) {
          calculatedStatus = 'LATE';
        } else {
          calculatedStatus = 'PRESENT';
        }
      } else if (approvedShortLeaveLate) {
        // Approved permission pass / short leave
        calculatedStatus = 'PRESENT';
        auditNote = `Short-Leave Approved (Late Entry: ${approvedShortLeaveLate.shortLeaveHours || 2}h)`;
      } else {
        const [shH, shM] = effectiveShift.startTime.split(':').map(Number);
        const shiftStartTime = new Date(now);
        shiftStartTime.setHours(shH || 9, shM || 30, 0, 0);

        const graceMinutes = effectiveShift.gracePeriodMinutes;
        const lateThreshold = new Date(shiftStartTime.getTime() + graceMinutes * 60000);
        const halfDayHours = effectiveShift.halfDayThresholdHours;
        const halfDayThreshold = new Date(shiftStartTime.getTime() + halfDayHours * 3600000);

        if (now > halfDayThreshold) {
          calculatedStatus = 'HALFDAY';
        } else if (now > lateThreshold) {
          calculatedStatus = 'LATE';
        }
      }
    } else if (effectiveShift.isWeeklyOff || effectiveShift.isHoliday) {
      // Off-day punch -> Eligible for Comp-Off
      calculatedStatus = 'PRESENT';
      auditNote = `Off-Day Work (${effectiveShift.isHoliday ? 'Holiday' : 'Weekly Off'}) - Comp-Off Eligible`;
    }

    const finalMode = isApprovedWfh ? 'wfh' : punchMode;

    const record = await prisma.attendance.create({
      data: {
        employeeId: empId,
        date: today,
        checkInTime: now,
        status: calculatedStatus,
        lat: coords?.lat,
        lng: coords?.lng,
        distanceMeters: geofence.distanceMeters ?? undefined,
        punchStatus: 'ACCEPTED',
        isActive: true,
        punchMode: finalMode,
        rejectionReason: auditNote ? `Audit: ${auditNote}` : undefined,
      },
    });

    // Save audit metadata for HR
    const currentWebPunches = (rules as any).attendanceWebPunches || {};
    currentWebPunches[record.id] = {
      attendanceId: record.id,
      employeeId: empId,
      punchType: 'CHECK_IN',
      punchMode: finalMode,
      timestamp: now.toISOString(),
      clientIp,
      accuracy: options.accuracy,
      deviceInfo: options.deviceInfo || options.browser || 'Web Browser',
      isOfficeIp,
      isInsideGeofence: geofence.inside,
      isRemoteAllowed,
      isSuspicious,
      auditNote,
    };

    await PolicyService.updateActiveRules(tenantId, empId, {
      ...rules,
      attendanceWebPunches: currentWebPunches,
    } as any).catch(() => {});

    return record;
  }

  static async checkOut(id: string, options: PunchOptions = {}) {
    const record = await prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            location: true,
            orgUnit: { select: { tenantId: true } },
            user: { select: { tenantId: true } },
          },
        },
      },
    });
    if (!record) throw new Error('Attendance record not found');
    if (!record.isActive) return record;

    const coords = parseCoords(options);
    const skipGeofence = options.skipGeofence === true;
    const geofence = this.evaluateGeofence(record.employee, coords, skipGeofence);

    if (!geofence.allowed && record.employee.location && !skipGeofence) {
      const err: any = new Error(
        `Outside work area (${Math.round(geofence.distanceMeters || 0)}m from ${record.employee.location.name}, limit ${record.employee.location.radiusMeters}m)`
      );
      err.statusCode = 403;
      err.data = {
        distanceMeters: Math.round(geofence.distanceMeters || 0),
        locationRadius: record.employee.location.radiusMeters,
        locationName: record.employee.location.name,
      };
      throw err;
    }

    const punchOut = options.punchOutTime ? new Date(options.punchOutTime) : new Date();
    const rawMode = String(options.punchMode || record.punchMode || 'web').trim();
    const finalMode = rawMode.toUpperCase() === 'WEB' ? 'WEB' : rawMode.toLowerCase();

    // Auto-end any active break on check out
    const emp = record.employee as any;
    const tenantId = emp?.tenantId || emp?.orgUnit?.tenantId || emp?.user?.tenantId || 'default-tenant';
    await this.endBreak(tenantId, record.employeeId).catch(() => {});

    // Duration & status recalculation
    const rules = await PolicyService.getActiveRules(tenantId);
    const allBreaks = (rules as any).attendanceBreaks || {};
    const empBreaks = (allBreaks[record.employeeId] || []).filter(
      (b: any) => b.dateStr === getLocalDateString(record.date)
    );
    let totalBreakSecs = 0;
    empBreaks.forEach((b: any) => {
      if (b.durationMinutes) totalBreakSecs += b.durationMinutes * 60;
    });

    const totalDurationSecs = Math.max(0, Math.floor((punchOut.getTime() - record.checkInTime.getTime()) / 1000));
    const netWorkedHours = Math.max(0, (totalDurationSecs - totalBreakSecs) / 3600);

    const effectiveShift = await this.getEffectiveShiftForDate(
      tenantId,
      record.employeeId,
      record.employee.department || '',
      record.date
    );

    let finalStatus: 'PRESENT' | 'LATE' | 'HALFDAY' = record.status as any;
    const allRequests: AttendanceRequestItem[] = (rules as any).attendanceRequests || [];
    const dateStr = getLocalDateString(record.date);
    const approvedShortLeaveEarly = allRequests.find(
      (r: any) =>
        r.employeeId === record.employeeId &&
        r.status === 'APPROVED' &&
        r.type === 'SHORT_LEAVE' &&
        r.startDate <= dateStr &&
        r.endDate >= dateStr &&
        r.shortLeaveType === 'EARLY_EXIT'
    );

    // Flexi hours status check on checkout
    if (effectiveShift.isFlexiHours) {
      const minHours = effectiveShift.flexiMinHoursPerDay || 8;
      if (netWorkedHours >= minHours) {
        finalStatus = 'PRESENT';
      } else if (netWorkedHours >= effectiveShift.halfDayThresholdHours) {
        finalStatus = 'HALFDAY';
      }
    } else if (approvedShortLeaveEarly) {
      // Early departure protected by approved short-leave
      if (finalStatus === 'HALFDAY') finalStatus = 'PRESENT';
    }

    // Overtime (OT) evaluation
    let otNote = '';
    const otRules = rules.overtime || { enabled: true, minimumOtMinutes: 60, dailyMaxOtHours: 4 };
    if (otRules.enabled && effectiveShift.startTime && effectiveShift.endTime && !effectiveShift.isWeeklyOff) {
      const [sH, sM] = effectiveShift.startTime.split(':').map(Number);
      const [eH, eM] = effectiveShift.endTime.split(':').map(Number);
      let scheduledShiftMins = (eH * 60 + eM) - (sH * 60 + sM);
      if (scheduledShiftMins <= 0) scheduledShiftMins += 24 * 60; // night shift

      const workedMinutes = Math.floor(netWorkedHours * 60);
      if (workedMinutes > scheduledShiftMins + (otRules.minimumOtMinutes || 60)) {
        const rawOtHours = Math.round(((workedMinutes - scheduledShiftMins) / 60) * 10) / 10;
        const otHours = Math.min(otRules.dailyMaxOtHours || 4, rawOtHours);
        otNote = `OT: ${otHours}h`;
      }
    }

    // Comp-off eligibility for off-day work
    let compOffNote = '';
    if (effectiveShift.isWeeklyOff || effectiveShift.isHoliday) {
      const minFull = rules.overtime?.compOffMinHoursForFullDay || 7;
      const minHalf = rules.overtime?.compOffMinHoursForHalfDay || 4;
      if (netWorkedHours >= minFull) {
        compOffNote = 'Comp-Off Eligible: 1.0 Day';
      } else if (netWorkedHours >= minHalf) {
        compOffNote = 'Comp-Off Eligible: 0.5 Day';
      }
    }

    // Notes consolidation
    const existingNotes = record.rejectionReason || '';
    const notesArr = [existingNotes, otNote, compOffNote].filter(Boolean);
    const combinedReason = notesArr.length > 0 ? notesArr.join(' | ') : null;

    return prisma.attendance.update({
      where: { id },
      data: {
        checkOutTime: punchOut,
        status: finalStatus,
        isActive: false,
        lat: coords?.lat ?? record.lat,
        lng: coords?.lng ?? record.lng,
        distanceMeters: geofence.distanceMeters ?? record.distanceMeters,
        punchMode: finalMode,
        rejectionReason: combinedReason,
      },
    });
  }

  static async startBreak(tenantId: string, employeeId: string, breakType: string = 'GENERAL') {
    const empId = await this.resolveEmployeeId(employeeId);
    const rules = await PolicyService.getActiveRules(tenantId);
    const allBreaks = (rules as any).attendanceBreaks || {};
    const empBreaks = allBreaks[empId] || [];

    const now = new Date();
    const { todayStr } = getLocalDayRange(now);

    const existingOpen = empBreaks.find((b: any) => b.dateStr === todayStr && !b.endTime);
    if (existingOpen) {
      return existingOpen;
    }

    const newBreak = {
      id: `brk-${Date.now()}`,
      employeeId: empId,
      dateStr: todayStr,
      type: breakType.toUpperCase(),
      startTime: now.toISOString(),
      endTime: null,
      durationMinutes: 0,
    };

    allBreaks[empId] = [...empBreaks, newBreak];
    await PolicyService.updateActiveRules(tenantId, empId, {
      ...rules,
      attendanceBreaks: allBreaks,
    } as any);

    return newBreak;
  }

  static async endBreak(tenantId: string, employeeId: string) {
    const empId = await this.resolveEmployeeId(employeeId);
    const rules = await PolicyService.getActiveRules(tenantId);
    const allBreaks = (rules as any).attendanceBreaks || {};
    const empBreaks = allBreaks[empId] || [];

    const now = new Date();
    const { todayStr } = getLocalDayRange(now);
    const openIndex = empBreaks.findIndex((b: any) => b.dateStr === todayStr && !b.endTime);
    if (openIndex === -1) {
      return null;
    }

    const openBreak = empBreaks[openIndex];
    const durationMinutes = Math.max(1, Math.round((now.getTime() - new Date(openBreak.startTime).getTime()) / 60000));
    empBreaks[openIndex] = {
      ...openBreak,
      endTime: now.toISOString(),
      durationMinutes,
    };

    allBreaks[empId] = empBreaks;
    await PolicyService.updateActiveRules(tenantId, empId, {
      ...rules,
      attendanceBreaks: allBreaks,
    } as any);

    return empBreaks[openIndex];
  }

  static async getTodayStatus(employeeId: string, tenantIdOverride?: string) {
    const empId = await this.resolveEmployeeId(employeeId);
    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      include: {
        location: true,
        orgUnit: { select: { tenantId: true } },
        user: { select: { tenantId: true } },
      },
    });
    const tenantId = tenantIdOverride || employee?.tenantId || employee?.orgUnit?.tenantId || employee?.user?.tenantId || 'default-tenant';
    const rules = await PolicyService.getActiveRules(tenantId);
    const attRules = rules.attendance;

    const now = new Date();
    const { today, tomorrow, todayStr } = getLocalDayRange(now);

    const acceptedToday = await prisma.attendance.findMany({
      where: {
        employeeId: empId,
        punchStatus: 'ACCEPTED',
        date: { gte: today, lt: tomorrow },
      },
      orderBy: { checkInTime: 'asc' },
    });

    let totalClosedSeconds = 0;
    acceptedToday.forEach((row) => {
      if (row.checkInTime && row.checkOutTime) {
        totalClosedSeconds += Math.floor(
          (row.checkOutTime.getTime() - row.checkInTime.getTime()) / 1000
        );
      }
    });

    const latest = await prisma.attendance.findFirst({
      where: {
        employeeId: empId,
        date: { gte: today, lt: tomorrow },
        punchStatus: 'ACCEPTED',
      },
      orderBy: { checkInTime: 'desc' },
    });

    // Check breaks today
    const allBreaks = (rules as any).attendanceBreaks || {};
    const empBreaks = allBreaks[empId] || [];
    const todayBreaks = empBreaks.filter((b: any) => b.dateStr === todayStr);
    const activeBreak = todayBreaks.find((b: any) => !b.endTime);

    // Calculate break elapsed seconds
    let totalBreakSeconds = 0;
    todayBreaks.forEach((b: any) => {
      if (b.endTime) {
        totalBreakSeconds += (b.durationMinutes || 0) * 60;
      } else {
        totalBreakSeconds += Math.floor((now.getTime() - new Date(b.startTime).getTime()) / 1000);
      }
    });

    const isActive = latest?.isActive === true && !latest.checkOutTime;
    let activeSessionElapsedSeconds = 0;
    if (isActive && latest?.checkInTime) {
      activeSessionElapsedSeconds = Math.max(0, Math.floor((now.getTime() - latest.checkInTime.getTime()) / 1000));
    }

    const netWorkedSeconds = Math.max(0, totalClosedSeconds + activeSessionElapsedSeconds - totalBreakSeconds);
    const totalDurationMinutes = Math.floor(netWorkedSeconds / 60);

    const isWfhToday = ((rules as any).attendanceRequests || []).some(
      (r: any) =>
        r.employeeId === empId &&
        r.status === 'APPROVED' &&
        (r.type === 'WFH' || r.type === 'ON_DUTY') &&
        r.startDate <= todayStr &&
        r.endDate >= todayStr
    );

    const effectiveShift = await this.getEffectiveShiftForDate(
      tenantId,
      empId,
      employee?.department || '',
      now
    );

    const todayLeave = await prisma.leave.findFirst({
      where: {
        employeeId: empId,
        status: 'APPROVED',
        startDate: { lte: tomorrow },
        endDate: { gte: today },
      },
    });

    const holidays = await prisma.holiday.findMany({ where: { tenantId, isActive: true } });
    const todayHoliday = holidays.find((h) => new Date(h.date).toISOString().slice(0, 10) === todayStr);

    let statusText = 'Not Marked';
    if (activeBreak) {
      statusText = 'On Break';
    } else if (isActive) {
      statusText = latest?.status === 'LATE' ? 'Late (Present)' : 'Present';
    } else if (todayLeave) {
      statusText = latest ? 'Present (On Leave)' : `On Leave (${todayLeave.type})`;
    } else if (todayHoliday) {
      statusText = latest ? 'Present (Holiday)' : `Holiday (${todayHoliday.name})`;
    } else if (effectiveShift.isWeeklyOff) {
      statusText = latest ? 'Present (Weekly Off)' : (effectiveShift.weeklyOffReason || 'Weekly Off');
    } else if (latest?.checkOutTime) {
      statusText = 'Clocked Out';
    }

    const reminderData = await this.getTodayReminders(tenantId, empId, now).catch(() => ({
      reminders: { inPunch: null, outPunch: null },
      quotaInfo: {
        enabled: attRules.enableAutoCheckout !== false,
        monthlyQuota: attRules.monthlyAutoCheckoutQuota ?? 2,
        monthlyUsed: 0,
        remainingQuota: attRules.monthlyAutoCheckoutQuota ?? 2,
        isExceeded: false,
        penaltyPolicy: attRules.penaltyAfterQuotaExceeded || 'REQUIRE_REGULARIZATION',
      },
    }));

    return {
      status: statusText,
      latest: latest || null,
      isActive,
      onBreak: !!activeBreak,
      onLeave: !!todayLeave,
      leaveType: todayLeave?.type || null,
      isWeeklyOff: effectiveShift.isWeeklyOff,
      weeklyOffReason: effectiveShift.weeklyOffReason || null,
      isHoliday: !!todayHoliday,
      holidayName: todayHoliday?.name || null,
      currentBreak: activeBreak
        ? {
            id: activeBreak.id,
            type: activeBreak.type,
            startTime: activeBreak.startTime,
            elapsedSeconds: Math.floor((now.getTime() - new Date(activeBreak.startTime).getTime()) / 1000),
          }
        : null,
      todayBreaks,
      totalBreakMinutes: Math.floor(totalBreakSeconds / 60),
      totalDurationMinutes,
      totalWorkedSeconds: netWorkedSeconds,
      activeSessionStart: isActive ? latest?.checkInTime?.toISOString() || null : null,
      checkInTime: latest?.checkInTime?.toISOString() || null,
      checkOutTime: latest?.checkOutTime?.toISOString() || null,
      punchMode: latest?.punchMode || (todayLeave ? 'leave' : null),
      segments: acceptedToday.length,
      shiftInfo: {
        code: effectiveShift.code,
        name: effectiveShift.name,
        timings: effectiveShift.timings,
        startTime: effectiveShift.startTime,
        endTime: effectiveShift.endTime,
        gracePeriodMinutes: effectiveShift.gracePeriodMinutes,
        isWeeklyOff: effectiveShift.isWeeklyOff,
      },
      assignedLocation: employee?.location
        ? {
            name: employee.location.name,
            address: employee.location.address,
            radiusMeters: employee.location.radiusMeters,
            lat: employee.location.lat,
            lng: employee.location.lng,
          }
        : null,
      webPunchPolicy: {
        allowed: attRules.allowWebPunch !== false,
        validationMode: attRules.webPunchValidation || 'ANYWHERE',
        officeIps: attRules.officeIpAllowlist || ['127.0.0.1', '::1', 'localhost'],
        allowRemote: attRules.allowRemotePunch === true,
        isWfhToday,
      },
      quotaInfo: reminderData.quotaInfo,
      reminders: reminderData.reminders,
    };
  }

  static async getHistory(employeeId?: string, scope?: OrgScopeContext) {
    if (!scope?.tenantId) return [];

    const visibleEmployees = await prisma.employee.findMany({
      where: employeeWhereFromScope(scope),
      select: { id: true },
    });
    const visibleIds = visibleEmployees.map((e) => e.id);
    if (visibleIds.length === 0) return [];

    const where: { employeeId?: string | { in: string[] } } = {};

    if (employeeId) {
      const resolved = await this.resolveEmployeeId(employeeId);
      if (!visibleIds.includes(resolved)) return [];
      where.employeeId = resolved;
    } else {
      where.employeeId = { in: visibleIds };
    }

    return prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            location: true,
          },
        },
      },
      orderBy: { checkInTime: 'desc' },
      take: 500,
    });
  }

  static async submitAttendanceRequest(
    tenantId: string,
    userId: string,
    employeeId: string,
    data: {
      type: AttendanceRequestType;
      startDate: string;
      endDate?: string;
      reason: string;
      location?: string;
      inTime?: string;
      outTime?: string;
      shortLeaveType?: 'EARLY_EXIT' | 'LATE_ENTRY';
      shortLeaveHours?: number;
    }
  ) {
    const empId = await this.resolveEmployeeId(employeeId);
    const rules = await PolicyService.getActiveRules(tenantId);
    const currentRequests: AttendanceRequestItem[] = [...((rules as any).attendanceRequests || [])];

    // Validate short-leave quota and hours if SHORT_LEAVE
    if (data.type === 'SHORT_LEAVE') {
      const maxHours = rules.attendance.maxShortLeaveHours || 2;
      const requestedHours = Number(data.shortLeaveHours) || 2;
      if (requestedHours > maxHours) {
        throw new Error(`Short leave exceeds maximum permitted duration of ${maxHours} hour(s) per request.`);
      }

      // Check monthly quota
      const monthPrefix = data.startDate.slice(0, 7);
      const monthlyCount = currentRequests.filter(
        (r) =>
          r.employeeId === empId &&
          r.type === 'SHORT_LEAVE' &&
          r.status !== 'REJECTED' &&
          r.startDate.startsWith(monthPrefix)
      ).length;

      const monthlyQuota = rules.attendance.monthlyShortLeaveQuota || 2;
      if (monthlyCount >= monthlyQuota) {
        throw new Error(`Monthly short-leave quota (${monthlyQuota} per month) has been reached for this month.`);
      }
    }

    const newReq: AttendanceRequestItem = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenantId,
      employeeId: empId,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate || data.startDate,
      reason: data.reason,
      location: data.location || (data.type === 'WFH' ? 'Home Office' : data.type === 'SHORT_LEAVE' ? 'Permission Pass' : 'Client Site'),
      inTime: data.inTime,
      outTime: data.outTime,
      shortLeaveType: data.shortLeaveType,
      shortLeaveHours: data.shortLeaveHours ? Number(data.shortLeaveHours) : undefined,
      status: 'PENDING',
      appliedAt: new Date().toISOString(),
    };

    currentRequests.unshift(newReq);

    await PolicyService.updateActiveRules(tenantId, userId, {
      ...rules,
      attendanceRequests: currentRequests,
    } as any);

    return newReq;
  }

  static async getAttendanceRequests(
    tenantId: string,
    filters?: { employeeId?: string; status?: string; type?: string }
  ) {
    const rules = await PolicyService.getActiveRules(tenantId);
    let list: AttendanceRequestItem[] = (rules as any).attendanceRequests || [];

    if (filters?.employeeId) {
      const empId = await this.resolveEmployeeId(filters.employeeId);
      list = list.filter((r) => r.employeeId === empId);
    }
    if (filters?.status && filters.status !== 'ALL') {
      const targetStatus = filters.status.toUpperCase();
      list = list.filter((r) => r.status === targetStatus);
    }
    if (filters?.type && filters.type !== 'ALL') {
      const targetType = filters.type.toUpperCase();
      list = list.filter((r) => r.type === targetType);
    }

    const empIds = [...new Set(list.map((r) => r.employeeId))];
    const emps = await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        department: true,
        designation: true,
      },
    });
    const empMap = new Map(emps.map((e) => [e.id, e]));

    return list.map((r) => {
      const emp = empMap.get(r.employeeId);
      return {
        ...r,
        employee: emp
          ? {
              id: emp.id,
              employeeId: emp.employeeId,
              name: `${emp.firstName} ${emp.lastName}`,
              department: emp.department,
              designation: emp.designation,
            }
          : { id: r.employeeId, name: 'Employee', department: 'General' },
      };
    });
  }

  static async updateAttendanceRequestStatus(
    tenantId: string,
    userId: string,
    requestId: string,
    data: { status: 'APPROVED' | 'REJECTED'; adminRemark?: string }
  ) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const currentRequests: AttendanceRequestItem[] = [...((rules as any).attendanceRequests || [])];
    const targetIdx = currentRequests.findIndex((r) => r.id === requestId);
    if (targetIdx === -1) {
      throw new Error(`Attendance request ${requestId} not found`);
    }

    const req = currentRequests[targetIdx];
    req.status = data.status;
    req.adminRemark = data.adminRemark || null;
    req.processedAt = new Date().toISOString();
    req.processedBy = userId;

    currentRequests[targetIdx] = req;

    // IF APPROVED:
    if (data.status === 'APPROVED') {
      const [sY, sM, sD] = req.startDate.split('-').map(Number);
      const [eY, eM, eD] = req.endDate.split('-').map(Number);
      const cur = new Date(Date.UTC(sY, sM - 1, sD));
      const end = new Date(Date.UTC(eY, eM - 1, eD));

      while (cur <= end) {
        const dStr = cur.toISOString().slice(0, 10);
        const dayStart = new Date(cur);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(cur);
        dayEnd.setUTCHours(23, 59, 59, 999);

        const existingRecord = await prisma.attendance.findFirst({
          where: {
            employeeId: req.employeeId,
            date: { gte: dayStart, lte: dayEnd },
          },
        });

        if (req.type === 'WFH') {
          if (existingRecord) {
            await prisma.attendance.update({
              where: { id: existingRecord.id },
              data: {
                status: 'PRESENT',
                punchMode: 'wfh',
                punchStatus: 'ACCEPTED',
                rejectionReason: null,
              },
            });
          } else {
            await prisma.attendance.create({
              data: {
                employeeId: req.employeeId,
                date: dayStart,
                checkInTime: new Date(dStr + 'T09:30:00.000Z'),
                checkOutTime: new Date(dStr + 'T18:30:00.000Z'),
                status: 'PRESENT',
                punchMode: 'wfh',
                punchStatus: 'ACCEPTED',
                isActive: false,
                distanceMeters: 0,
              },
            });
          }
        } else if (req.type === 'ON_DUTY') {
          if (existingRecord) {
            await prisma.attendance.update({
              where: { id: existingRecord.id },
              data: {
                status: 'PRESENT',
                punchMode: 'on_duty',
                punchStatus: 'ACCEPTED',
                rejectionReason: null,
              },
            });
          } else {
            await prisma.attendance.create({
              data: {
                employeeId: req.employeeId,
                date: dayStart,
                checkInTime: new Date(dStr + 'T09:30:00.000Z'),
                checkOutTime: new Date(dStr + 'T18:30:00.000Z'),
                status: 'PRESENT',
                punchMode: 'on_duty',
                punchStatus: 'ACCEPTED',
                isActive: false,
                distanceMeters: 0,
              },
            });
          }
        } else if (req.type === 'SHORT_LEAVE') {
          const leaveDesc = `Approved Short-Leave (${req.shortLeaveType === 'EARLY_EXIT' ? 'Early Departure' : 'Late Arrival'}: ${req.shortLeaveHours || 2}h)`;
          if (existingRecord) {
            await prisma.attendance.update({
              where: { id: existingRecord.id },
              data: {
                status: 'PRESENT',
                punchStatus: 'ACCEPTED',
                rejectionReason: leaveDesc,
              },
            });
          } else {
            await prisma.attendance.create({
              data: {
                employeeId: req.employeeId,
                date: dayStart,
                checkInTime: new Date(dStr + 'T09:30:00.000Z'),
                checkOutTime: new Date(dStr + 'T18:30:00.000Z'),
                status: 'PRESENT',
                punchStatus: 'ACCEPTED',
                isActive: false,
                rejectionReason: leaveDesc,
              },
            });
          }
        } else if (req.type === 'REGULARIZATION') {
          const inTimeIso = req.inTime ? new Date(`${dStr}T${req.inTime}:00.000Z`) : new Date(`${dStr}T09:30:00.000Z`);
          const outTimeIso = req.outTime ? new Date(`${dStr}T${req.outTime}:00.000Z`) : new Date(`${dStr}T18:30:00.000Z`);
          if (existingRecord) {
            await prisma.attendance.update({
              where: { id: existingRecord.id },
              data: {
                checkInTime: inTimeIso,
                checkOutTime: outTimeIso,
                status: 'PRESENT',
                punchStatus: 'ACCEPTED',
                isActive: false,
                rejectionReason: null,
              },
            });
          } else {
            await prisma.attendance.create({
              data: {
                employeeId: req.employeeId,
                date: dayStart,
                checkInTime: inTimeIso,
                checkOutTime: outTimeIso,
                status: 'PRESENT',
                punchStatus: 'ACCEPTED',
                isActive: false,
              },
            });
          }
        }

        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    await PolicyService.updateActiveRules(tenantId, userId, {
      ...rules,
      attendanceRequests: currentRequests,
    } as any);

    return req;
  }

  static async creditCompOffForAttendance(tenantId: string, userId: string, attendanceId: string) {
    const record = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { employee: true },
    });
    if (!record) throw new Error('Attendance record not found');

    const rules = await PolicyService.getActiveRules(tenantId);
    const effectiveShift = await this.getEffectiveShiftForDate(
      tenantId,
      record.employeeId,
      record.employee.department || '',
      record.date
    );

    if (!effectiveShift.isWeeklyOff && !effectiveShift.isHoliday) {
      throw new Error('Comp-off can only be granted for work performed on scheduled Weekly Offs or Public Holidays.');
    }

    const durationSeconds = record.checkOutTime
      ? Math.max(0, Math.floor((record.checkOutTime.getTime() - record.checkInTime.getTime()) / 1000))
      : 0;
    const hoursWorked = durationSeconds / 3600;

    const minFull = rules.overtime?.compOffMinHoursForFullDay || 7;
    const minHalf = rules.overtime?.compOffMinHoursForHalfDay || 4;

    let compOffDays = 1.0;
    if (hoursWorked < minFull && hoursWorked >= minHalf) {
      compOffDays = 0.5;
    } else if (hoursWorked < minHalf) {
      throw new Error(`Minimum ${minHalf} hours of work required on off-day to earn comp-off. Worked: ${Math.round(hoursWorked * 10) / 10}h`);
    }

    // Call LeaveService to credit comp-off days
    const { LeaveService } = await import('../leave/leave.service');
    await LeaveService.creditCompOff(tenantId, userId, record.employeeId, compOffDays);

    // Update attendance record note
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        rejectionReason: `Comp-Off Credited: +${compOffDays} Day (${effectiveShift.isHoliday ? 'Holiday Work' : 'Weekly Off Work'})`,
      },
    });

    return {
      success: true,
      attendanceId,
      employeeId: record.employeeId,
      creditedDays: compOffDays,
      message: `Successfully credited ${compOffDays} Comp-Off day(s) for ${record.employee.firstName} ${record.employee.lastName}`,
    };
  }

  static async getMusterRoll(
    tenantId: string,
    options: {
      year?: number;
      month?: number;
      department?: string;
      employeeId?: string;
    }
  ) {
    const now = new Date();
    const targetYear = Number(options.year) || now.getFullYear();
    const targetMonth = Number(options.month) || now.getMonth() + 1;

    const rules = await PolicyService.getActiveRules(tenantId);
    const rosterSchedules = (rules as any).rosterSchedules || {};
    const departmentOverrides = rosterSchedules.departmentOverrides || {};
    const employeeOverrides = rosterSchedules.employeeOverrides || {};
    const cellOverrides = rosterSchedules.cellOverrides || {};

    const empWhere: any = {
      OR: [{ tenantId }, { orgUnit: { tenantId } }, { user: { tenantId } }],
      status: 'ACTIVE',
    };
    if (options.department && options.department !== 'ALL') {
      empWhere.department = options.department;
    }
    if (options.employeeId) {
      const resolved = await this.resolveEmployeeId(options.employeeId);
      empWhere.id = resolved;
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
      },
      orderBy: { firstName: 'asc' },
    });

    const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const endOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59));
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    // 1. Holidays
    const holidays = await prisma.holiday.findMany({
      where: { tenantId, isActive: true },
    });
    const holidayMap = new Map<string, string>();
    holidays.forEach((h) => {
      const dStr = new Date(h.date).toISOString().slice(0, 10);
      holidayMap.set(dStr, h.name);
    });

    // 2. Approved Leaves
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
        leaveMap.set(`${l.employeeId}:${cur.toISOString().slice(0, 10)}`, l.type);
        cur.setDate(cur.getDate() + 1);
      }
    });

    // 3. Approved Attendance Requests (WFH & OD)
    const allRequests: AttendanceRequestItem[] = (rules as any).attendanceRequests || [];
    const approvedWfhMap = new Map<string, string>();
    const approvedOdMap = new Map<string, string>();
    const approvedShortLeaveMap = new Map<string, string>();

    allRequests
      .filter((r) => r.status === 'APPROVED')
      .forEach((r) => {
        const [sY, sM, sD] = r.startDate.split('-').map(Number);
        const [eY, eM, eD] = r.endDate.split('-').map(Number);
        const cur = new Date(Date.UTC(sY, sM - 1, sD));
        const end = new Date(Date.UTC(eY, eM - 1, eD));
        while (cur <= end) {
          const key = `${r.employeeId}:${cur.toISOString().slice(0, 10)}`;
          if (r.type === 'WFH') approvedWfhMap.set(key, r.reason);
          if (r.type === 'ON_DUTY') approvedOdMap.set(key, r.reason);
          if (r.type === 'SHORT_LEAVE') approvedShortLeaveMap.set(key, `Short Leave (${r.shortLeaveType === 'EARLY_EXIT' ? 'Early Departure' : 'Late Arrival'}: ${r.shortLeaveHours || 2}h)`);
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      });

    // 4. Attendance punches
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });
    const attendanceMap = new Map<string, any>();
    attendanceRecords.forEach((att) => {
      const dStr = new Date(att.date).toISOString().slice(0, 10);
      attendanceMap.set(`${att.employeeId}:${dStr}`, att);
    });

    // Days headers
    const daysHeader: any[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(targetYear, targetMonth - 1, d));
      const dayOfWeek = dt.getUTCDay();
      const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysHeader.push({
        day: d,
        dateStr,
        dayName: dayNames[dayOfWeek],
        isSunday: dayOfWeek === 0,
        isSaturday: dayOfWeek === 6,
        isHoliday: holidayMap.has(dateStr),
        holidayName: holidayMap.get(dateStr) || null,
      });
    }

    const todayStr = now.toISOString().slice(0, 10);

    // Build rows
    const rows = employees.map((emp) => {
      let totalPresent = 0;
      let totalWfh = 0;
      let totalOd = 0;
      let totalLeaves = 0;
      let totalWeeklyOffs = 0;
      let totalHolidays = 0;
      let totalAbsent = 0;

      const empOverride = employeeOverrides[emp.id];
      const deptOverride = departmentOverrides[emp.department];
      const effectiveWorkWeek = empOverride?.workWeek || deptOverride?.workWeek || rules.workWeek;

      const cells = daysHeader.map((d) => {
        const key = `${emp.id}:${d.dateStr}`;
        const isFuture = d.dateStr > todayStr;

        // 1. Holiday
        if (d.isHoliday) {
          if (!isFuture) totalHolidays++;
          return { dateStr: d.dateStr, statusCode: 'H', label: d.holidayName || 'Public Holiday', isWorked: false };
        }

        // 2. Approved Leave
        const leaveType = leaveMap.get(key);
        if (leaveType) {
          if (!isFuture) totalLeaves++;
          return { dateStr: d.dateStr, statusCode: 'L', label: `Leave (${leaveType})`, isWorked: false };
        }

        // 3. Approved WFH (CORE REQUIREMENT: Shows WFH, NOT Absent!)
        if (approvedWfhMap.has(key)) {
          if (!isFuture) {
            totalWfh++;
            totalPresent++;
          }
          return { dateStr: d.dateStr, statusCode: 'WFH', label: 'Work From Home (Approved)', isWorked: true };
        }

        // 4. Approved On-Duty
        if (approvedOdMap.has(key)) {
          if (!isFuture) {
            totalOd++;
            totalPresent++;
          }
          return { dateStr: d.dateStr, statusCode: 'OD', label: 'On Duty (Approved)', isWorked: true };
        }

        // 4.5. Approved Short-Leave
        if (approvedShortLeaveMap.has(key)) {
          if (!isFuture) {
            totalPresent++;
          }
          return { dateStr: d.dateStr, statusCode: 'SL', label: approvedShortLeaveMap.get(key) || 'Short Leave (Approved)', isWorked: true };
        }

        // 5. Attendance punch
        const punch = attendanceMap.get(key);
        if (punch) {
          if (punch.punchMode === 'wfh') {
            if (!isFuture) {
              totalWfh++;
              totalPresent++;
            }
            return { dateStr: d.dateStr, statusCode: 'WFH', label: 'Work From Home', isWorked: true };
          }
          if (punch.punchMode === 'on_duty') {
            if (!isFuture) {
              totalOd++;
              totalPresent++;
            }
            return { dateStr: d.dateStr, statusCode: 'OD', label: 'On Duty', isWorked: true };
          }
          if (punch.status === 'PRESENT') {
            if (!isFuture) totalPresent++;
            return { dateStr: d.dateStr, statusCode: 'P', label: 'Present', isWorked: true };
          }
          if (punch.status === 'HALFDAY') {
            if (!isFuture) totalPresent += 0.5;
            return { dateStr: d.dateStr, statusCode: 'HD', label: 'Half Day', isWorked: true };
          }
          if (punch.status === 'LATE') {
            if (!isFuture) totalPresent++;
            return { dateStr: d.dateStr, statusCode: 'Lt', label: 'Late Arrival', isWorked: true };
          }
        }

        // 6. Scheduled Weekly Off or Roster Cell Override
        const cellOverride = cellOverrides[key];
        if (cellOverride === 'WO') {
          if (!isFuture) totalWeeklyOffs++;
          return { dateStr: d.dateStr, statusCode: 'WO', label: 'Weekly Off (Roster)', isWorked: false };
        }

        const dt = new Date(targetYear, targetMonth - 1, d.day);
        const isOff = cellOverride ? false : isDateWeekOff(dt, effectiveWorkWeek);
        if (isOff) {
          if (!isFuture) totalWeeklyOffs++;
          return { dateStr: d.dateStr, statusCode: 'WO', label: 'Weekly Off', isWorked: false };
        }

        // 7. Future day
        if (isFuture) {
          return { dateStr: d.dateStr, statusCode: '-', label: 'Upcoming', isWorked: false };
        }

        // 8. Otherwise Absent
        totalAbsent++;
        return { dateStr: d.dateStr, statusCode: 'A', label: 'Absent', isWorked: false };
      });

      const payableDays = totalPresent + totalLeaves + totalWeeklyOffs + totalHolidays;

      return {
        id: emp.id,
        employeeId: emp.employeeId,
        name: `${emp.firstName} ${emp.lastName}`,
        department: emp.department,
        designation: emp.designation,
        cells,
        summary: {
          totalDaysInMonth: daysInMonth,
          totalPresent,
          totalWfh,
          totalOd,
          totalLeaves,
          totalWeeklyOffs,
          totalHolidays,
          totalAbsent,
          payableDays,
        },
      };
    });

    return {
      year: targetYear,
      month: targetMonth,
      monthLabel: new Date(targetYear, targetMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      daysInMonth,
      daysHeader,
      rows,
    };
  }

  static async getLiveMonitoring(
    tenantId: string,
    options?: {
      department?: string;
      status?: string;
      search?: string;
    }
  ) {
    const now = new Date();
    const { today, tomorrow, todayStr } = getLocalDayRange(now);

    const empWhere: any = {
      OR: [{ tenantId }, { orgUnit: { tenantId } }, { user: { tenantId } }],
      status: { in: ['ACTIVE', 'ON_LEAVE'] },
    };
    if (options?.department && options.department !== 'ALL') {
      empWhere.department = options.department;
    }

    const employees = await prisma.employee.findMany({
      where: empWhere,
      include: {
        location: true,
        user: { select: { email: true, role: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    const rules = await PolicyService.getActiveRules(tenantId);
    const attRules = rules.attendance;
    const allBreaks = (rules as any).attendanceBreaks || {};
    const allWebPunches = (rules as any).attendanceWebPunches || {};
    const employeeOverrides = (rules as any).employeeWebPunchOverrides || {};
    const allRequests = (rules as any).attendanceRequests || [];

    const employeeIds = employees.map((e) => e.id);
    const todayAttendance = await prisma.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: today, lt: tomorrow },
        punchStatus: 'ACCEPTED',
      },
      orderBy: { checkInTime: 'asc' },
    });

    const punchByEmp = new Map<string, typeof todayAttendance>();
    todayAttendance.forEach((rec) => {
      const list = punchByEmp.get(rec.employeeId) || [];
      list.push(rec);
      punchByEmp.set(rec.employeeId, list);
    });

    // Query approved leaves active today for all employees
    const todayLeaves = await prisma.leave.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'APPROVED',
        startDate: { lte: tomorrow },
        endDate: { gte: today },
      },
    });
    const leaveByEmp = new Map<string, (typeof todayLeaves)[0]>();
    todayLeaves.forEach((l) => leaveByEmp.set(l.employeeId, l));

    // Holiday check
    const holidays = await prisma.holiday.findMany({ where: { tenantId, isActive: true } });
    const todayHoliday = holidays.find((h) => new Date(h.date).toISOString().slice(0, 10) === todayStr);

    const rosterSchedules = (rules as any).rosterSchedules || {};
    const customShifts: ShiftType[] = rosterSchedules.customShifts || [];
    const shiftMap = new Map<string, ShiftType>();
    STANDARD_SHIFTS.forEach((s) => shiftMap.set(s.code, { ...s }));
    customShifts.forEach((s) => shiftMap.set(s.code, { ...s, isCustom: true }));

    let clockedInNow = 0;
    let onBreakNow = 0;
    let clockedOutToday = 0;
    let onLeaveToday = 0;
    let weeklyOffToday = 0;
    let notClockedInToday = 0;
    let webPunchEnabledCount = 0;

    const rows = employees.map((emp) => {
      const empPunches = punchByEmp.get(emp.id) || [];
      const latestPunch = empPunches[empPunches.length - 1];
      const firstPunch = empPunches[0];

      // Web punch permitted check
      const hasOverride = employeeOverrides[emp.id] !== undefined;
      const webPunchAllowed = hasOverride
        ? Boolean(employeeOverrides[emp.id])
        : Boolean(
            (attRules.allowWebPunch ?? true) &&
            (!attRules.allowedWebPunchDepartments ||
              attRules.allowedWebPunchDepartments.includes('ALL') ||
              (emp.department && attRules.allowedWebPunchDepartments.includes(emp.department)))
          );

      if (webPunchAllowed) {
        webPunchEnabledCount++;
      }

      // Breaks
      const empBreaks = allBreaks[emp.id] || [];
      const todayBreaks = empBreaks.filter((b: any) => b.dateStr === todayStr);
      const activeBreak = todayBreaks.find((b: any) => !b.endTime);

      let totalBreakSeconds = 0;
      todayBreaks.forEach((b: any) => {
        if (b.endTime) {
          totalBreakSeconds += (b.durationMinutes || 0) * 60;
        } else {
          totalBreakSeconds += Math.floor((now.getTime() - new Date(b.startTime).getTime()) / 1000);
        }
      });

      // Calculate worked seconds
      let totalClosedSeconds = 0;
      empPunches.forEach((p) => {
        if (p.checkInTime && p.checkOutTime) {
          totalClosedSeconds += Math.floor(
            (p.checkOutTime.getTime() - p.checkInTime.getTime()) / 1000
          );
        }
      });

      const isActive = latestPunch?.isActive === true && !latestPunch?.checkOutTime;
      let activeElapsed = 0;
      if (isActive && latestPunch?.checkInTime) {
        activeElapsed = Math.max(0, Math.floor((now.getTime() - latestPunch.checkInTime.getTime()) / 1000));
      }

      const netWorkedSeconds = Math.max(0, totalClosedSeconds + activeElapsed - totalBreakSeconds);
      const hrs = Math.floor(netWorkedSeconds / 3600);
      const mins = Math.floor((netWorkedSeconds % 3600) / 60);
      const workedFormatted = `${hrs}h ${mins}m`;

      // WFH check
      const isApprovedWfh = allRequests.some(
        (r: any) =>
          r.employeeId === emp.id &&
          r.status === 'APPROVED' &&
          (r.type === 'WFH' || r.type === 'ON_DUTY') &&
          r.startDate <= todayStr &&
          r.endDate >= todayStr
      );

      // Leave check
      const empLeave = leaveByEmp.get(emp.id);

      // Effective shift calculation for today
      const cellKey = `${emp.id}:${todayStr}`;
      const manualCell = (rosterSchedules.cellOverrides || {})[cellKey];
      const empOverride = (rosterSchedules.employeeOverrides || {})[emp.id];
      const deptOverride = emp.department ? (rosterSchedules.departmentOverrides || {})[emp.department] : undefined;
      const effectiveWorkWeek = empOverride?.workWeek || deptOverride?.workWeek || rules.workWeek;
      const isOff = manualCell === 'WO' || (!manualCell && isDateWeekOff(now, effectiveWorkWeek));

      const effectiveShiftCode = manualCell && manualCell !== 'WO'
        ? manualCell
        : empOverride?.shiftCode || deptOverride?.shiftCode || rosterSchedules.defaultShift || 'GS';
      const shiftObj = shiftMap.get(effectiveShiftCode) || STANDARD_SHIFTS[0];

      // Department & Group Attendance Policy
      const effectiveGroupPolicy = this.resolveEffectiveAttendancePolicy(rules, emp.department);
      const isFlexi = effectiveGroupPolicy.isFlexiHours || false;

      // Short leave check for today
      const todayShortLeave = allRequests.find(
        (r: any) =>
          r.employeeId === emp.id &&
          r.status === 'APPROVED' &&
          r.type === 'SHORT_LEAVE' &&
          r.startDate <= todayStr &&
          r.endDate >= todayStr
      );

      // Overtime & Comp-Off calculation
      const isOffDayWork = (isOff || !!todayHoliday) && netWorkedSeconds > 0;
      const isCompOffEligible = (isOff || !!todayHoliday) && netWorkedSeconds >= 4 * 3600;
      const compOffDays = netWorkedSeconds >= 7 * 3600 ? 1.0 : netWorkedSeconds >= 4 * 3600 ? 0.5 : 0;

      let overtimeHours: number | null = null;
      if (rules.overtime?.enabled && shiftObj.startTime && shiftObj.endTime && !isOff && !todayHoliday) {
        const [sH, sM] = shiftObj.startTime.split(':').map(Number);
        const [eH, eM] = shiftObj.endTime.split(':').map(Number);
        let shiftDurationMins = (eH * 60 + eM) - (sH * 60 + sM);
        if (shiftDurationMins <= 0) shiftDurationMins += 24 * 60;

        const workedMins = Math.floor(netWorkedSeconds / 60);
        if (workedMins > shiftDurationMins + (rules.overtime.minimumOtMinutes || 60)) {
          overtimeHours = Math.min(
            rules.overtime.dailyMaxOtHours || 4,
            Math.round(((workedMins - shiftDurationMins) / 60) * 10) / 10
          );
        }
      }

      // Status determination
      let liveStatus: 'ON_BREAK' | 'CLOCKED_IN' | 'CLOCKED_OUT' | 'WFH' | 'ON_LEAVE' | 'WEEK_OFF' | 'HOLIDAY' | 'NOT_CLOCKED_IN' = 'NOT_CLOCKED_IN';
      if (activeBreak) {
        liveStatus = 'ON_BREAK';
        onBreakNow++;
      } else if (isActive) {
        liveStatus = 'CLOCKED_IN';
        clockedInNow++;
      } else if (empLeave || latestPunch?.punchMode === 'leave') {
        liveStatus = 'ON_LEAVE';
        onLeaveToday++;
      } else if (latestPunch?.checkOutTime && latestPunch?.punchMode !== 'leave') {
        liveStatus = 'CLOCKED_OUT';
        clockedOutToday++;
      } else if (isApprovedWfh) {
        liveStatus = 'WFH';
      } else if (todayHoliday) {
        liveStatus = 'HOLIDAY';
        weeklyOffToday++;
      } else if (isOff) {
        liveStatus = 'WEEK_OFF';
        weeklyOffToday++;
      } else {
        notClockedInToday++;
      }

      // Web punch audit
      const auditMeta = latestPunch ? allWebPunches[latestPunch.id] : null;

      let currentBreakInfo: any = null;
      if (activeBreak) {
        const breakElapsed = Math.max(0, Math.floor((now.getTime() - new Date(activeBreak.startTime).getTime()) / 1000));
        const bMins = Math.floor(breakElapsed / 60);
        const bSecs = breakElapsed % 60;
        currentBreakInfo = {
          id: activeBreak.id,
          type: activeBreak.type,
          startTime: activeBreak.startTime,
          elapsedSeconds: breakElapsed,
          elapsedFormatted: `${bMins}m ${bSecs}s`,
        };
      }

      return {
        id: emp.id,
        employeeId: emp.employeeId,
        attendanceId: latestPunch?.id || null,
        name: `${emp.firstName} ${emp.lastName}`,
        department: emp.department || 'General',
        designation: emp.designation || 'Staff',
        webPunchAllowed,
        liveStatus,
        workedSecondsToday: netWorkedSeconds,
        workedFormatted,
        firstCheckIn: firstPunch?.checkInTime ? firstPunch.checkInTime.toISOString() : null,
        lastCheckOut: latestPunch?.checkOutTime ? latestPunch.checkOutTime.toISOString() : null,
        punchMode: latestPunch?.punchMode || (empLeave ? 'leave' : isApprovedWfh ? 'WFH' : null),
        rejectionReason: latestPunch?.rejectionReason || null,
        isFlexi,
        overtimeHours,
        isOffDayWork,
        isCompOffEligible,
        compOffDays,
        shortLeaveInfo: todayShortLeave
          ? {
              type: todayShortLeave.shortLeaveType,
              hours: todayShortLeave.shortLeaveHours,
              reason: todayShortLeave.reason,
            }
          : null,
        currentBreak: currentBreakInfo,
        todayBreaksCount: todayBreaks.length,
        totalBreakMinutes: Math.floor(totalBreakSeconds / 60),
        clientIp: auditMeta?.clientIp || null,
        accuracyMeters: auditMeta?.accuracy || null,
        isOfficeIp: auditMeta?.isOfficeIp ?? null,
        isSuspicious: auditMeta?.isSuspicious ?? false,
        assignedLocation: emp.location?.name || null,
        onLeaveInfo: empLeave
          ? {
              type: empLeave.type,
              startDate: empLeave.startDate,
              endDate: empLeave.endDate,
            }
          : null,
        holidayInfo: todayHoliday ? { name: todayHoliday.name } : null,
        shiftInfo: {
          code: shiftObj.code,
          name: shiftObj.name,
          category: shiftObj.category || 'GENERAL',
          timings: shiftObj.timings || `${shiftObj.startTime || '09:30'} – ${shiftObj.endTime || '18:30'}`,
          firstSlotStartTime: shiftObj.firstSlotStartTime,
          firstSlotEndTime: shiftObj.firstSlotEndTime,
          secondSlotStartTime: shiftObj.secondSlotStartTime,
          secondSlotEndTime: shiftObj.secondSlotEndTime,
          isWeeklyOff: isOff,
        },
      };
    });

    // Filter by search & status if requested
    let filtered = rows;
    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.employeeId.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q)
      );
    }
    if (options?.status && options.status !== 'ALL') {
      filtered = filtered.filter((r) => r.liveStatus === options.status);
    }

    return {
      summary: {
        totalEmployees: employees.length,
        clockedInNow,
        onBreakNow,
        clockedOutToday,
        onLeaveToday,
        weeklyOffToday,
        notClockedInToday,
        webPunchEnabledCount,
      },
      employees: filtered,
    };
  }

  static async getEmployeeWebPunchPermission(tenantId: string, employeeId: string) {
    const empId = await this.resolveEmployeeId(employeeId);
    const rules = await PolicyService.getActiveRules(tenantId);
    const overrides = (rules as any).employeeWebPunchOverrides || {};
    const defaultAllowed = (rules as any).allowWebPunch ?? true;
    const allowed = typeof overrides[empId] === 'boolean' ? overrides[empId] : defaultAllowed;

    return {
      employeeId: empId,
      allowed,
      isOverridden: typeof overrides[empId] === 'boolean',
      defaultAllowed,
    };
  }

  static async setEmployeeWebPunchPermission(tenantId: string, employeeId: string, allowed: boolean) {
    const empId = await this.resolveEmployeeId(employeeId);
    const rules = await PolicyService.getActiveRules(tenantId);
    const overrides = (rules as any).employeeWebPunchOverrides || {};
    overrides[empId] = Boolean(allowed);

    await PolicyService.updateActiveRules(tenantId, 'system', {
      ...rules,
      employeeWebPunchOverrides: overrides,
    } as any);

    return { employeeId: empId, allowed: Boolean(allowed) };
  }

  static async getMonthlyAutoCheckoutCount(
    tenantId: string,
    employeeId: string,
    referenceDate: Date = new Date()
  ): Promise<number> {
    const empId = await this.resolveEmployeeId(employeeId);
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    return prisma.attendance.count({
      where: {
        employeeId: empId,
        date: { gte: startOfMonth, lte: endOfMonth },
        OR: [
          { punchMode: 'auto_checkout' },
          { rejectionReason: { contains: 'Auto Check-Out' } },
        ],
      },
    });
  }

  static async getTodayReminders(tenantId: string, rawEmployeeId: string, dateInput?: Date | string) {
    const empId = await this.resolveEmployeeId(rawEmployeeId);
    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      select: { id: true, department: true },
    });
    const rules = await PolicyService.getActiveRules(tenantId);
    const attRules = rules.attendance;

    const now = dateInput ? new Date(dateInput) : new Date();
    const { today, tomorrow, todayStr } = getLocalDayRange(now);

    const usedCount = await this.getMonthlyAutoCheckoutCount(tenantId, empId, now);
    const maxQuota = attRules.monthlyAutoCheckoutQuota ?? 2;
    const remainingQuota = Math.max(0, maxQuota - usedCount);
    const isExceeded = usedCount >= maxQuota;

    const quotaInfo = {
      enabled: attRules.enableAutoCheckout !== false,
      monthlyQuota: maxQuota,
      monthlyUsed: usedCount,
      remainingQuota,
      isExceeded,
      penaltyPolicy: attRules.penaltyAfterQuotaExceeded || 'REQUIRE_REGULARIZATION',
    };

    if (attRules.enableMissingPunchReminders === false) {
      return { reminders: { inPunch: null, outPunch: null }, quotaInfo };
    }

    const effectiveShift = await this.getEffectiveShiftForDate(
      tenantId,
      empId,
      employee?.department || '',
      now
    );

    const holidays = await prisma.holiday.findMany({ where: { tenantId, isActive: true } });
    const isTodayHoliday = holidays.some((h) => new Date(h.date).toISOString().slice(0, 10) === todayStr);

    if (effectiveShift.isWeeklyOff || isTodayHoliday) {
      return { reminders: { inPunch: null, outPunch: null }, quotaInfo };
    }

    const todayLeave = await prisma.leave.findFirst({
      where: {
        employeeId: empId,
        status: 'APPROVED',
        startDate: { lte: tomorrow },
        endDate: { gte: today },
      },
    });
    if (todayLeave) {
      return { reminders: { inPunch: null, outPunch: null }, quotaInfo };
    }

    const todayRecords = await prisma.attendance.findMany({
      where: {
        employeeId: empId,
        date: { gte: today, lt: tomorrow },
        punchStatus: 'ACCEPTED',
      },
      orderBy: { checkInTime: 'desc' },
    });

    let inPunchReminder: string | null = null;
    let outPunchReminder: string | null = null;

    if (todayRecords.length === 0) {
      if (effectiveShift.startTime) {
        const [shH, shM] = effectiveShift.startTime.split(':').map(Number);
        const shiftStart = new Date(now);
        shiftStart.setHours(shH || 9, shM || 30, 0, 0);
        const inGrace = attRules.reminderInPunchGraceMinutes ?? 15;
        const reminderThreshold = new Date(shiftStart.getTime() + inGrace * 60000);
        if (now > reminderThreshold) {
          inPunchReminder = `Reminder: Your ${effectiveShift.name} started at ${effectiveShift.startTime}. Please clock in to avoid a late or half-day mark.`;
        }
      }
    } else {
      const activeRecord = todayRecords.find((r) => r.isActive && !r.checkOutTime);
      if (activeRecord && effectiveShift.endTime) {
        const [endH, endM] = effectiveShift.endTime.split(':').map(Number);
        const shiftEnd = new Date(now);
        shiftEnd.setHours(endH || 18, endM || 30, 0, 0);
        const outGrace = attRules.reminderOutPunchGraceMinutes ?? 15;
        const reminderThreshold = new Date(shiftEnd.getTime() + outGrace * 60000);
        if (now > reminderThreshold) {
          if (!isExceeded) {
            outPunchReminder = `Reminder: Your shift ended at ${effectiveShift.endTime}. Please clock out to avoid consuming your monthly auto-checkout quota (${remainingQuota} free remaining).`;
          } else {
            outPunchReminder = `Urgent: Your shift ended at ${effectiveShift.endTime}. Please clock out immediately! You have used all ${maxQuota} free auto-checkouts; automated closure will penalize this shift.`;
          }
        }
      }
    }

    return {
      reminders: {
        inPunch: inPunchReminder,
        outPunch: outPunchReminder,
      },
      quotaInfo,
    };
  }

  static async runDailyAttendanceClosure(tenantId: string, dateInput?: Date | string) {
    const now = dateInput ? new Date(dateInput) : new Date();
    const { today, tomorrow, todayStr } = getLocalDayRange(now);
    const rules = await PolicyService.getActiveRules(tenantId);
    const attRules = rules.attendance;

    const enableAutoCheckout = attRules.enableAutoCheckout !== false;
    const bufferMinutes = attRules.autoCheckoutBufferMinutes ?? 60;
    const maxQuota = attRules.monthlyAutoCheckoutQuota ?? 2;
    const penaltyPolicy = attRules.penaltyAfterQuotaExceeded || 'REQUIRE_REGULARIZATION';
    const autoMarkAbsent = attRules.autoMarkAbsentUnclocked !== false;

    const summary = {
      date: todayStr,
      autoCheckoutsWithinQuota: 0,
      autoCheckoutsExceededQuota: 0,
      autoAbsentsCreated: 0,
      processedSessions: [] as Array<{
        attendanceId: string;
        employeeId: string;
        employeeName: string;
        action: 'AUTO_CHECKOUT_WITHIN_QUOTA' | 'AUTO_CHECKOUT_EXCEEDED_QUOTA' | 'AUTO_ABSENT';
        details: string;
      }>,
    };

    // 1. Process Open Active Sessions
    if (enableAutoCheckout) {
      const openSessions = await prisma.attendance.findMany({
        where: {
          isActive: true,
          date: { lt: tomorrow },
          employee: {
            OR: [
              { tenantId },
              { orgUnit: { tenantId } },
              { user: { tenantId } },
            ],
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
            },
          },
        },
      });

      for (const session of openSessions) {
        const emp = session.employee;
        const effectiveShift = await this.getEffectiveShiftForDate(
          tenantId,
          session.employeeId,
          emp.department || '',
          session.date
        );

        let shiftEnd = new Date(session.date);
        if (effectiveShift.endTime) {
          const [endH, endM] = effectiveShift.endTime.split(':').map(Number);
          shiftEnd.setHours(endH || 18, endM || 30, 0, 0);
          if (effectiveShift.startTime && effectiveShift.startTime > effectiveShift.endTime) {
            shiftEnd.setDate(shiftEnd.getDate() + 1); // Overnight shift
          }
        } else {
          shiftEnd.setHours(18, 30, 0, 0);
        }

        const cutoffTime = new Date(shiftEnd.getTime() + bufferMinutes * 60000);
        const isPastCutoff = now >= cutoffTime || session.date < today;

        if (isPastCutoff) {
          const usedCount = await this.getMonthlyAutoCheckoutCount(tenantId, session.employeeId, session.date);
          const isWithinQuota = usedCount < maxQuota;
          const punchOutTime = shiftEnd <= now ? shiftEnd : now;

          await this.endBreak(tenantId, session.employeeId).catch(() => {});

          if (isWithinQuota) {
            const quotaNum = usedCount + 1;
            const note = `Auto Check-Out (Quota ${quotaNum}/${maxQuota})`;
            await prisma.attendance.update({
              where: { id: session.id },
              data: {
                checkOutTime: punchOutTime,
                isActive: false,
                punchMode: 'auto_checkout',
                rejectionReason: session.rejectionReason ? `${session.rejectionReason} | ${note}` : note,
              },
            });
            summary.autoCheckoutsWithinQuota += 1;
            summary.processedSessions.push({
              attendanceId: session.id,
              employeeId: emp.employeeId,
              employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
              action: 'AUTO_CHECKOUT_WITHIN_QUOTA',
              details: note,
            });
          } else {
            const quotaNum = usedCount + 1;
            let newStatus = session.status;
            let newPunchStatus: 'ACCEPTED' | 'REJECTED' = 'ACCEPTED';
            let note = `Auto Check-Out Quota Exceeded (${quotaNum}/${maxQuota})`;

            if (penaltyPolicy === 'HALFDAY') {
              newStatus = 'HALFDAY';
              newPunchStatus = 'ACCEPTED';
              note += ' - Marked Half-Day';
            } else if (penaltyPolicy === 'REQUIRE_REGULARIZATION') {
              newStatus = 'HALFDAY';
              newPunchStatus = 'REJECTED';
              note += ' - Regularization Required';
            } else if (penaltyPolicy === 'MARK_ABSENT') {
              newStatus = 'ABSENT';
              newPunchStatus = 'REJECTED';
              note += ' - Marked Absent';
            }

            await prisma.attendance.update({
              where: { id: session.id },
              data: {
                checkOutTime: punchOutTime,
                isActive: false,
                status: newStatus,
                punchStatus: newPunchStatus,
                punchMode: 'auto_checkout',
                rejectionReason: session.rejectionReason ? `${session.rejectionReason} | ${note}` : note,
              },
            });
            summary.autoCheckoutsExceededQuota += 1;
            summary.processedSessions.push({
              attendanceId: session.id,
              employeeId: emp.employeeId,
              employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
              action: 'AUTO_CHECKOUT_EXCEEDED_QUOTA',
              details: note,
            });
          }
        }
      }
    }

    // 2. Auto-Mark Absent for Unclocked Active Employees
    if (autoMarkAbsent) {
      const activeEmployees = await prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { tenantId },
            { orgUnit: { tenantId } },
            { user: { tenantId } },
          ],
        },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          department: true,
        },
      });

      const existingRecords = await prisma.attendance.findMany({
        where: {
          date: { gte: today, lt: tomorrow },
          employeeId: { in: activeEmployees.map((e) => e.id) },
        },
        select: { employeeId: true },
      });
      const clockedEmpIds = new Set(existingRecords.map((r) => r.employeeId));

      const leavesToday = await prisma.leave.findMany({
        where: {
          status: 'APPROVED',
          startDate: { lte: tomorrow },
          endDate: { gte: today },
          employeeId: { in: activeEmployees.map((e) => e.id) },
        },
        select: { employeeId: true },
      });
      const leaveEmpIds = new Set(leavesToday.map((l) => l.employeeId));

      const holidays = await prisma.holiday.findMany({ where: { tenantId, isActive: true } });
      const isTodayHoliday = holidays.some((h) => new Date(h.date).toISOString().slice(0, 10) === todayStr);

      const allRequests: AttendanceRequestItem[] = (rules as any).attendanceRequests || [];
      const onDutyEmpIds = new Set(
        allRequests
          .filter(
            (r) =>
              r.status === 'APPROVED' &&
              r.type === 'ON_DUTY' &&
              r.startDate <= todayStr &&
              r.endDate >= todayStr
          )
          .map((r) => r.employeeId)
      );

      for (const emp of activeEmployees) {
        if (clockedEmpIds.has(emp.id) || leaveEmpIds.has(emp.id) || onDutyEmpIds.has(emp.id)) continue;

        const effectiveShift = await this.getEffectiveShiftForDate(
          tenantId,
          emp.id,
          emp.department || '',
          today
        );

        if (effectiveShift.isWeeklyOff || isTodayHoliday) continue;

        let shiftEnd = new Date(today);
        if (effectiveShift.endTime) {
          const [endH, endM] = effectiveShift.endTime.split(':').map(Number);
          shiftEnd.setHours(endH || 18, endM || 30, 0, 0);
          if (effectiveShift.startTime && effectiveShift.startTime > effectiveShift.endTime) {
            shiftEnd.setDate(shiftEnd.getDate() + 1); // Overnight night shift (e.g. 22:00 - 06:30)
          }
        } else {
          shiftEnd.setHours(18, 30, 0, 0);
        }

        // Only mark absent if current time is past shift end time or processing a past date
        if (now >= shiftEnd || today < new Date(now.toISOString().slice(0, 10))) {
          let shiftStart = new Date(today);
          if (effectiveShift.startTime) {
            const [shH, shM] = effectiveShift.startTime.split(':').map(Number);
            shiftStart.setHours(shH || 9, shM || 30, 0, 0);
          } else {
            shiftStart.setHours(9, 30, 0, 0);
          }

          const created = await prisma.attendance.create({
            data: {
              employeeId: emp.id,
              date: today,
              checkInTime: shiftStart,
              checkOutTime: shiftEnd,
              status: 'ABSENT',
              punchStatus: 'ACCEPTED',
              punchMode: 'system_auto_absent',
              isActive: false,
              rejectionReason: 'System: Unclocked working day',
            },
          });

          summary.autoAbsentsCreated += 1;
          summary.processedSessions.push({
            attendanceId: created.id,
            employeeId: emp.employeeId,
            employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
            action: 'AUTO_ABSENT',
            details: `Unclocked scheduled ${effectiveShift.name} (${effectiveShift.timings})`,
          });
        }
      }
    }

    return summary;
  }
}
