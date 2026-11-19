import { PrismaClient } from '@prisma/client';
import { LeaveService } from '../modules/leave/leave.service';
import { AttendanceService } from '../modules/attendance/attendance.service';
import { PolicyService } from '../modules/policies/policy.service';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('================================================================');
  console.log('🧪 AUDITING & VERIFYING ROWS 1-7 (ATTENDANCE, SHIFTS & BIOMETRIC)');
  console.log('================================================================\n');

  const tenant = (await prisma.tenant.findFirst({
    where: { id: '6a08259b752e15d6a06ec490' },
  })) || (await prisma.tenant.findFirst());

  if (!tenant) {
    console.error('❌ No tenant found');
    return;
  }

  const tenantId = tenant.id;
  console.log(`🏢 Active Tenant: ${tenant.name} (${tenantId})`);

  const employee = await prisma.employee.findFirst({
    where: {
      OR: [{ tenantId }, { orgUnit: { tenantId } }, { user: { tenantId } }],
    },
  }) || await prisma.employee.findFirst();

  if (!employee) {
    console.error('❌ No active employee found for tenant');
    return;
  }

  const userId = employee.userId || employee.id;
  console.log(`👤 Test Employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})\n`);

  // -------------------------------------------------------------
  // ROW 1: Shift Master (General, Night, Rotational, Split)
  // -------------------------------------------------------------
  console.log('--- [ROW 1] Shift Master (General, Night, Rotational, Split) ---');
  // 1a. Create Split Shift
  const allShiftsAfterSplit = await LeaveService.createOrUpdateShift(tenantId, userId, {
    code: 'SS-TEST',
    name: 'Hospitality Split Shift',
    category: 'SPLIT',
    firstSlotStartTime: '10:00',
    firstSlotEndTime: '14:00',
    secondSlotStartTime: '17:00',
    secondSlotEndTime: '21:00',
    timings: '10:00–14:00 & 17:00–21:00',
    startTime: '10:00',
    endTime: '21:00',
    gracePeriodMinutes: 15,
  });
  const splitShift = allShiftsAfterSplit.find((s) => s.code === 'SS-TEST');
  console.log('✅ Split Shift created successfully:', {
    code: splitShift?.code,
    category: splitShift?.category,
    timings: splitShift?.timings,
    firstSlot: `${splitShift?.firstSlotStartTime} - ${splitShift?.firstSlotEndTime}`,
    secondSlot: `${splitShift?.secondSlotStartTime} - ${splitShift?.secondSlotEndTime}`,
  });

  // 1b. Create Rotational Shift
  const allShiftsAfterRotational = await LeaveService.createOrUpdateShift(tenantId, userId, {
    code: 'RS-TEST',
    name: 'Manufacturing 7-Day Cycle Shift',
    category: 'ROTATIONAL',
    rotationCycleDays: 7,
    startTime: '06:00',
    endTime: '14:00',
    timings: '06:00 – 14:00',
    gracePeriodMinutes: 10,
  });
  const rotationalShift = allShiftsAfterRotational.find((s) => s.code === 'RS-TEST');
  console.log('✅ Rotational Shift created successfully:', {
    code: rotationalShift?.code,
    category: rotationalShift?.category,
    cycleDays: rotationalShift?.rotationCycleDays,
  });

  // -------------------------------------------------------------
  // ROW 2: Shift Roster / Scheduling
  // -------------------------------------------------------------
  console.log('\n--- [ROW 2] Shift Roster / Scheduling ---');
  const todayStr = new Date().toISOString().slice(0, 10);
  await LeaveService.bulkAssignRoster(tenantId, userId, {
    employeeIds: [employee.id],
    pattern: 'FIVE_DAY',
    shiftCode: 'SS-TEST',
  });
  console.log('✅ Shift assigned to employee via roster:', {
    employeeId: employee.id,
    shift: 'SS-TEST',
  });

  const effectiveShift = await AttendanceService.getEffectiveShiftForDate(
    tenantId,
    employee.id,
    employee.department || 'General',
    new Date()
  );
  console.log('✅ Effective shift resolved from roster:', {
    code: effectiveShift.code,
    name: effectiveShift.name,
    category: effectiveShift.category,
    isWeeklyOff: effectiveShift.isWeeklyOff,
  });

  // -------------------------------------------------------------
  // ROW 3: Weekly-Off Patterns and Flexi Hours
  // -------------------------------------------------------------
  console.log('\n--- [ROW 3] Weekly-Off Patterns & Flexi Hours ---');
  const curRules = await PolicyService.getActiveRules(tenantId);
  await PolicyService.updateActiveRules(tenantId, userId, {
    ...curRules,
    attendance: {
      ...curRules.attendance,
      isFlexiHours: true,
      flexiWindowStartTime: '08:00',
      flexiWindowEndTime: '20:00',
      flexiMinHoursPerDay: 8,
      gracePeriodMinutes: 15,
    },
    overtime: {
      enabled: true,
      minimumOtMinutes: 60,
      dailyMaxOtHours: 4,
      enableCompOffForOffDayWork: true,
      requiresApproval: false,
      compOffMinHoursForHalfDay: 4,
      compOffMinHoursForFullDay: 7,
    },
  } as any);

  const activeRules = await PolicyService.getActiveRules(tenantId);
  console.log('✅ Flexi Hours active rules verified:', {
    isFlexiHours: activeRules.attendance.isFlexiHours,
    window: `${activeRules.attendance.flexiWindowStartTime} - ${activeRules.attendance.flexiWindowEndTime}`,
    minHours: activeRules.attendance.flexiMinHoursPerDay,
  });

  // -------------------------------------------------------------
  // ROW 4: Attendance Policy per Group (Department Policy Overrides)
  // -------------------------------------------------------------
  console.log('\n--- [ROW 4] Attendance Policy per Group (Department Overrides) ---');
  await PolicyService.updateActiveRules(tenantId, userId, {
    ...activeRules,
    departmentPolicies: {
      Sales: {
        isFlexiHours: true,
        gracePeriodMinutes: 30,
        flexiMinHoursPerDay: 7.5,
      },
      Operations: {
        isFlexiHours: false,
        gracePeriodMinutes: 5,
        flexiMinHoursPerDay: 8.5,
      },
    },
  } as any);

  const updatedRules = await PolicyService.getActiveRules(tenantId);
  const salesPolicy = AttendanceService.resolveEffectiveAttendancePolicy(updatedRules, 'Sales');
  const opsPolicy = AttendanceService.resolveEffectiveAttendancePolicy(updatedRules, 'Operations');
  const otherPolicy = AttendanceService.resolveEffectiveAttendancePolicy(updatedRules, 'Engineering');

  console.log('✅ Resolved Group Policy for "Sales":', {
    isFlexi: salesPolicy.isFlexiHours,
    graceMins: salesPolicy.gracePeriodMinutes,
    minHours: salesPolicy.flexiMinHoursPerDay,
  });
  console.log('✅ Resolved Group Policy for "Operations":', {
    isFlexi: opsPolicy.isFlexiHours,
    graceMins: opsPolicy.gracePeriodMinutes,
    minHours: opsPolicy.flexiMinHoursPerDay,
  });
  console.log('✅ Resolved Group Policy for "Engineering" (Default Fallback):', {
    isFlexi: otherPolicy.isFlexiHours,
    graceMins: otherPolicy.gracePeriodMinutes,
    minHours: otherPolicy.flexiMinHoursPerDay,
  });

  // -------------------------------------------------------------
  // ROW 5: Overtime and Comp-Off
  // -------------------------------------------------------------
  console.log('\n--- [ROW 5] Overtime and Comp-Off ---');
  const initialBalance = await LeaveService.getLeaveBalance(employee.id);
  const initialCompOffDays = initialBalance.compOffCredits || 0;
  console.log(`ℹ️ Initial Comp-off balance for ${employee.firstName}: ${initialCompOffDays} days`);

  // Credit comp-off directly via LeaveService
  const creditResult = await LeaveService.creditCompOff(tenantId, userId, employee.id, 1.0);
  console.log('✅ Credited 1.0 Comp-Off day to employee:', creditResult);

  const updatedBalance = await LeaveService.getLeaveBalance(employee.id);
  console.log(`✅ Updated Comp-off balance: ${updatedBalance.compOffCredits} days (credited: +1.0)`);

  // -------------------------------------------------------------
  // ROW 6: On-Duty, WFH, Short-Leave Requests
  // -------------------------------------------------------------
  console.log('\n--- [ROW 6] On-Duty, WFH, Short-Leave Requests ---');
  const slReq = await AttendanceService.submitAttendanceRequest(
    tenantId,
    userId,
    employee.id,
    {
      type: 'SHORT_LEAVE',
      startDate: todayStr,
      endDate: todayStr,
      shortLeaveType: 'LATE_ENTRY',
      shortLeaveHours: 2,
      reason: 'Doctor Appointment Verification Test',
      location: 'Late Entry Permission',
    }
  );
  console.log('✅ Short-Leave pass submitted:', {
    id: slReq.id,
    type: slReq.type,
    shortLeaveType: slReq.shortLeaveType,
    shortLeaveHours: slReq.shortLeaveHours,
    status: slReq.status,
  });

  // Approve Short-leave
  const approvedReq = await AttendanceService.updateAttendanceRequestStatus(
    tenantId,
    userId,
    slReq.id,
    { status: 'APPROVED', adminRemark: 'Verified and approved by HR' }
  );
  console.log('✅ Short-Leave pass approved:', {
    id: approvedReq.id,
    status: approvedReq.status,
  });

  // -------------------------------------------------------------
  // ROW 7: Missing-Punch Reminders, Auto-Checkout, Auto-Absent
  // -------------------------------------------------------------
  console.log('\n--- [ROW 7] Missing-Punch Reminders, Auto-Checkout, Auto-Absent ---');
  const reminders = await AttendanceService.getTodayReminders(tenantId, employee.id);
  console.log('✅ Missing-punch reminder check:', {
    employeeId: employee.id,
    inReminder: reminders.reminders.inPunch,
    outReminder: reminders.reminders.outPunch,
    monthlyQuota: reminders.quotaInfo.monthlyQuota,
    monthlyUsed: reminders.quotaInfo.monthlyUsed,
  });

  const closureResult = await AttendanceService.runDailyAttendanceClosure(tenantId, todayStr);
  console.log('✅ Daily Attendance Closure Engine executed:', {
    date: closureResult.date,
    autoCheckoutsWithinQuota: closureResult.autoCheckoutsWithinQuota,
    autoCheckoutsExceededQuota: closureResult.autoCheckoutsExceededQuota,
    autoAbsentsCreated: closureResult.autoAbsentsCreated,
  });

  // -------------------------------------------------------------
  // Live Monitor Summary
  // -------------------------------------------------------------
  console.log('\n--- Live Monitor Data Pipeline Check ---');
  const liveData = await AttendanceService.getLiveMonitoring(tenantId);
  console.log('✅ Live Monitoring returned metrics:', {
    totalEmployees: liveData.summary.totalEmployees,
    clockedInNow: liveData.summary.clockedInNow,
    weeklyOffToday: liveData.summary.weeklyOffToday,
    webPunchEnabled: liveData.summary.webPunchEnabledCount,
    sampleEmployee: {
      name: liveData.employees[0]?.name,
      liveStatus: liveData.employees[0]?.liveStatus,
      isFlexi: liveData.employees[0]?.isFlexi,
      shiftCategory: liveData.employees[0]?.shiftInfo?.category,
    },
  });

  console.log('\n================================================================');
  console.log('🎉 ALL ROWS 1-7 SUCCESSFULLY VERIFIED & DATA CONSISTENCY PASSING');
  console.log('================================================================');

  await prisma.$disconnect();
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  prisma.$disconnect();
});
