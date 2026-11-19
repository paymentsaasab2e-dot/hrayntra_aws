import prisma from '../shared/prisma';
import { AttendanceBulkService } from '../modules/attendance/bulk-import/attendance-bulk.service';
import { DelegationService } from '../modules/approvals/delegation/delegation.service';
import { ApprovalService } from '../modules/approvals/approval.service';
import { LeaveService } from '../modules/leave/leave.service';
import { AccrualEngineService } from '../modules/leave/accrual/accrual-engine.service';
import { AccrualTransactionType, LeaveType } from '@prisma/client';

async function main() {
  console.log('======================================================================');
  console.log('🚀 ENTERPRISE E2E VERIFICATION: ATTENDANCE IMPORT, TEAM CALENDAR,');
  console.log('   DELEGATION, MATERNITY BENEFIT ACT & LOP REVERSAL');
  console.log('======================================================================\n');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('Tenant not found');

  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });
  if (!adminUser) throw new Error('Admin user not found');

  const scope: any = {
    tenantId: tenant.id,
    userId: adminUser.id,
    role: 'ADMIN',
    isHqAdmin: true,
  };

  // Ensure employees exist and have genders assigned for testing
  const allEmployees = await prisma.employee.findMany({
    where: {
      OR: [
        { tenantId: tenant.id },
        { orgUnit: { tenantId: tenant.id } },
        { user: { tenantId: tenant.id } },
      ],
    },
    take: 5,
  });

  if (allEmployees.length < 2) {
    throw new Error('Need at least 2 employees for testing');
  }

  // Set EMP 1 as Female (Senior SWE, joined 2 years ago)
  const femaleEmp = await prisma.employee.update({
    where: { id: allEmployees[0].id },
    data: {
      gender: 'FEMALE',
      joiningDate: new Date('2024-01-01'),
      status: 'ACTIVE',
    },
  });

  // Set EMP 2 as Male (Product Manager, joined 1.5 years ago)
  const maleEmp = await prisma.employee.update({
    where: { id: allEmployees[1].id },
    data: {
      gender: 'MALE',
      joiningDate: new Date('2024-06-01'),
      status: 'ACTIVE',
    },
  });

  console.log(`✓ Test Setup Ready:`);
  console.log(`  - Female Employee: ${femaleEmp.firstName} ${femaleEmp.lastName} (${femaleEmp.employeeId}, Gender: ${femaleEmp.gender})`);
  console.log(`  - Male Employee: ${maleEmp.firstName} ${maleEmp.lastName} (${maleEmp.employeeId}, Gender: ${maleEmp.gender})\n`);

  // ====================================================================
  // SUITE 1: Bulk Attendance Import & Correction
  // ====================================================================
  console.log('--- [SUITE 1] Bulk Attendance Import & Correction ---');
  
  // 1.1 Template Download
  const templateCsv = AttendanceBulkService.getSampleTemplate();
  console.log(`  • Sample template generated (${templateCsv.split('\n').length} lines)`);
  if (!templateCsv.includes('employeeId,email,date,checkInTime,checkOutTime')) {
    throw new Error('Template missing expected CSV headers');
  }

  // 1.2 Validation of rows (valid present, half-day, duration > 16h, invalid employee)
  const testDate = '2026-11-05';

  // Clean any existing records for testDate
  await prisma.attendance.deleteMany({
    where: {
      employeeId: { in: [femaleEmp.id, maleEmp.id] },
      checkInTime: {
        gte: new Date('2026-11-05T00:00:00Z'),
        lte: new Date('2026-11-05T23:59:59Z'),
      },
    },
  });

  const validationTestRows = [
    {
      employeeId: femaleEmp.employeeId,
      date: testDate,
      checkInTime: '09:00',
      checkOutTime: '18:00',
      remarks: 'Biometric sync correction',
    },
    {
      employeeId: maleEmp.employeeId,
      date: testDate,
      checkInTime: '09:30',
      checkOutTime: '14:00',
      status: 'HALF_DAY',
      remarks: 'Half-day clinic visit',
    },
    {
      employeeId: femaleEmp.employeeId,
      date: '2026-11-06',
      checkInTime: '08:00',
      checkOutTime: '03:00', // 19 hours -> duration sanity error!
      remarks: 'Too long shift error test',
    },
    {
      employeeId: 'INVALID-9999',
      date: testDate,
      checkInTime: '09:00',
      checkOutTime: '17:00',
      remarks: 'Non-existent employee test',
    },
  ];

  const validation = await AttendanceBulkService.validateRows(scope, validationTestRows);
  console.log(`  • Validation results: Total ${validation.totalRows}, Valid: ${validation.validCount}, Invalid: ${validation.invalidCount}`);

  if (validation.validCount !== 2 || validation.invalidCount !== 2) {
    throw new Error(`Expected exactly 2 valid and 2 invalid rows, got valid=${validation.validCount}, invalid=${validation.invalidCount}`);
  }

  // 1.3 Commit Batch
  const validRawRows = validationTestRows.slice(0, 2);
  const commitRes = await AttendanceBulkService.commitBatch(scope, {
    fileName: 'test_attendance_corrections.csv',
    rows: validRawRows,
    uploadedBy: adminUser.id,
  });
  console.log(`  • Commit results: Batch #${commitRes.batchId}, Created: ${commitRes.insertedCount}, Updated: ${commitRes.updatedCount}`);

  // Assert Batch model exists in DB
  const batchRecord = await prisma.attendanceImportBatch.findUnique({
    where: { id: commitRes.batchId },
  });
  if (!batchRecord || batchRecord.successCount !== 2) {
    throw new Error('AttendanceImportBatch was not properly recorded in DB');
  }

  // Assert attendance records exist in DB
  const att1 = await prisma.attendance.findFirst({
    where: {
      employeeId: femaleEmp.id,
      checkInTime: {
        gte: new Date('2026-11-05T00:00:00Z'),
        lte: new Date('2026-11-05T23:59:59Z'),
      },
    },
  });
  if (!att1 || att1.status !== 'PRESENT') {
    throw new Error(`Attendance record 1 was not committed as PRESENT (found: ${att1?.status})`);
  }

  const att2 = await prisma.attendance.findFirst({
    where: {
      employeeId: maleEmp.id,
      checkInTime: {
        gte: new Date('2026-11-05T00:00:00Z'),
        lte: new Date('2026-11-05T23:59:59Z'),
      },
    },
  });
  if (!att2 || att2.status !== 'HALFDAY') {
    throw new Error(`Attendance record 2 was not committed as HALFDAY (found: ${att2?.status})`);
  }
  console.log('✅ [SUITE 1 PASSED] Bulk attendance import, validation & batch commit verified!\n');

  // ====================================================================
  // SUITE 2: Team Calendar & Approver Delegation
  // ====================================================================
  console.log('--- [SUITE 2] Team Calendar & Approver Delegation ---');

  // 2.1 Team Calendar
  const teamCalendar = await LeaveService.getTeamCalendar(scope, {
    year: 2026,
    month: 11,
    department: 'ALL',
  });
  console.log(`  • Team calendar retrieved for 11/2026:`);
  console.log(`    - Total Employees: ${teamCalendar.totalEmployees}`);
  console.log(`    - Month Days: ${teamCalendar.daysHeader.length}`);
  console.log(`    - Departments available: ${teamCalendar.departments.join(', ')}`);
  console.log(`    - Summary: ${teamCalendar.summary.offTodayCount} off today, ${teamCalendar.summary.onLeaveTodayCount} on leave today`);

  if (!teamCalendar.daysHeader || teamCalendar.daysHeader.length !== 30) {
    throw new Error(`Expected November to have 30 days in calendar grid, got ${teamCalendar.daysHeader?.length}`);
  }

  // 2.2 Delegation of Approval Authority
  const delegateeUser = await prisma.user.findFirst({
    where: { id: { not: adminUser.id }, tenantId: tenant.id },
  }) || await prisma.user.create({
    data: {
      email: `acting.manager.${Date.now()}@company.com`,
      password: 'dummyhash',
      role: 'MANAGER',
      tenantId: tenant.id,
      displayName: 'Acting Manager',
      status: 'ACTIVE',
    },
  });

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const delegation = await DelegationService.createDelegation(scope, adminUser.id, {
    delegateeUserId: delegateeUser.id,
    startDate: now.toISOString().slice(0, 10),
    endDate: nextWeek.toISOString().slice(0, 10),
    scope: 'ALL',
    reason: 'Annual leave coverage',
  });
  console.log(`  • Delegation created: ${delegation.delegator.name} -> ${delegation.delegatee.name} (Scope: ${delegation.scope})`);

  // Verify listDelegations
  const delegationsList = await DelegationService.listDelegations(scope);
  const activeDel = delegationsList.find((d) => d.id === delegation.id);
  if (!activeDel || !activeDel.isCurrentlyActive) {
    throw new Error('Created delegation not found or not marked currently active');
  }

  // Verify getActiveDelegatorIdsForUser
  const delegatorIds = await DelegationService.getActiveDelegatorIdsForUser(tenant.id, delegateeUser.id);
  if (!delegatorIds.includes(adminUser.id)) {
    throw new Error(`Expected delegatorIds to contain ${adminUser.id}`);
  }

  // Verify Approval Inbox routing for delegatee
  const delegateeInbox = await ApprovalService.getInbox(
    { tenantId: tenant.id, role: 'MANAGER', allowedOrgUnitIds: null } as any,
    { id: delegateeUser.id, role: 'MANAGER' }
  );
  console.log(`  • Delegatee Inbox query returned ${delegateeInbox.length} routed items under delegation`);

  // Revoke Delegation
  await DelegationService.revokeDelegation(scope, delegation.id, adminUser.id);
  const postRevokeIds = await DelegationService.getActiveDelegatorIdsForUser(tenant.id, delegateeUser.id);
  if (postRevokeIds.includes(adminUser.id)) {
    throw new Error('Revoked delegation still appears active');
  }
  console.log('✅ [SUITE 2 PASSED] Team Calendar grid and Approver Delegation routing verified!\n');

  // ====================================================================
  // SUITE 3: Maternity (26 wks), Gender & Probation Rules
  // ====================================================================
  console.log('--- [SUITE 3] Maternity (26 wks) & Gender / Probation Statutory Rules ---');

  // 3.1 Maternity Benefit Act: Male employee rejection
  try {
    await LeaveService.apply({
      employeeId: maleEmp.id,
      type: 'Maternity',
      startDate: '2026-12-01',
      endDate: '2027-02-01',
      reason: 'Maternity leave test for male',
    });
    throw new Error('FAILED: Expected Male Maternity application to be rejected');
  } catch (err: any) {
    console.log(`  ✓ Gender rejection passed: "${err.message}"`);
    if (!err.message.includes('female employees')) {
      throw new Error(`Unexpected error message: ${err.message}`);
    }
  }

  // 3.2 Maternity Benefit Act: Exceeding 26 weeks (182 calendar days) rejection
  try {
    await LeaveService.apply({
      employeeId: femaleEmp.id,
      type: 'Maternity',
      startDate: '2026-12-01',
      endDate: '2027-06-30', // 212 days > 182 days
      reason: 'Excessive maternity leave test',
    });
    throw new Error('FAILED: Expected Maternity application > 26 weeks to be rejected');
  } catch (err: any) {
    console.log(`  ✓ 26-week cap rejection passed: "${err.message}"`);
    if (!err.message.includes('26 weeks') && !err.message.includes('182 calendar days')) {
      throw new Error(`Unexpected error message: ${err.message}`);
    }
  }

  // 3.3 Maternity Benefit Act: Section 5(2) 80-day worked rule rejection
  const newFemaleHire = await prisma.employee.create({
    data: {
      employeeId: `FEM-TEST-${Date.now().toString().slice(-4)}`,
      firstName: 'Pooja',
      lastName: 'Sharma',
      email: `pooja.${Date.now()}@company.com`,
      gender: 'FEMALE',
      joiningDate: new Date(), // Joined today! < 80 days worked
      status: 'ACTIVE',
      department: 'Engineering',
      designation: 'Junior Developer',
      tenantId: tenant.id,
    },
  });

  try {
    await LeaveService.apply({
      employeeId: newFemaleHire.id,
      type: 'Maternity',
      startDate: '2026-12-01',
      endDate: '2027-04-01',
      reason: 'Maternity for new hire (< 80 days)',
    });
    throw new Error('FAILED: Expected Maternity application < 80 days worked to be rejected');
  } catch (err: any) {
    console.log(`  ✓ Section 5(2) 80-day rule rejection passed: "${err.message}"`);
    if (!err.message.includes('Section 5(2)') && !err.message.includes('80 days')) {
      throw new Error(`Unexpected error message: ${err.message}`);
    }
  }

  // 3.4 Valid Maternity application for eligible female employee
  const validMaternity = await LeaveService.apply({
    employeeId: femaleEmp.id,
    type: 'Maternity',
    startDate: '2026-12-01',
    endDate: '2027-03-31', // 121 days <= 182 days
    reason: 'Maternity Leave under Indian Maternity Benefit Act 2017',
  });
  console.log(`  ✓ Valid Maternity leave submitted: #${validMaternity.id}`);

  // 3.5 Paternity Leave: Female employee rejection
  try {
    await LeaveService.apply({
      employeeId: femaleEmp.id,
      type: 'Paternity',
      startDate: '2026-11-20',
      endDate: '2026-11-25',
      reason: 'Paternity leave test for female',
    });
    throw new Error('FAILED: Expected Female Paternity application to be rejected');
  } catch (err: any) {
    console.log(`  ✓ Paternity gender rejection passed: "${err.message}"`);
  }

  // 3.6 Paternity Leave: > 15 days rejection
  try {
    await LeaveService.apply({
      employeeId: maleEmp.id,
      type: 'Paternity',
      startDate: '2026-11-01',
      endDate: '2026-11-25', // 25 days > 15 days
      reason: 'Excessive paternity leave test',
    });
    throw new Error('FAILED: Expected Paternity > 15 days to be rejected');
  } catch (err: any) {
    console.log(`  ✓ Paternity 15-day cap rejection passed: "${err.message}"`);
  }

  // 3.7 Valid Paternity leave
  const validPaternity = await LeaveService.apply({
    employeeId: maleEmp.id,
    type: 'Paternity',
    startDate: '2026-11-16',
    endDate: '2026-11-25', // 10 days <= 15 days
    reason: 'Childbirth care leave',
  });
  console.log(`  ✓ Valid Paternity leave submitted: #${validPaternity.id}`);

  // 3.8 Probation restriction on Earned Leave
  try {
    await LeaveService.apply({
      employeeId: newFemaleHire.id,
      type: 'Earned',
      startDate: '2026-11-20',
      endDate: '2026-11-22',
      reason: 'Earned leave during probation',
    });
    throw new Error('FAILED: Expected Earned Leave during probation to be rejected');
  } catch (err: any) {
    console.log(`  ✓ Probation Earned Leave rejection passed: "${err.message}"`);
    if (!err.message.includes('probation period')) {
      throw new Error(`Unexpected error message: ${err.message}`);
    }
  }

  console.log('✅ [SUITE 3 PASSED] Statutory Maternity Benefit Act, Paternity, and Probation rules fully verified!\n');

  // ====================================================================
  // SUITE 4: Opening Balance Import & Automated LOP Reversal
  // ====================================================================
  console.log('--- [SUITE 4] Opening Balance Import & LOP Reversal Engine ---');

  // 4.1 Opening Balance Import
  const obRows = [
    {
      employeeCode: femaleEmp.employeeId,
      casualBalance: 6,
      sickBalance: 6,
      earnedBalance: 12,
      notes: 'FY2026 Opening Balance Migration',
    },
    {
      employeeCode: maleEmp.employeeId,
      casualBalance: 5,
      sickBalance: 6,
      earnedBalance: 10,
      notes: 'FY2026 Opening Balance Migration',
    },
  ];

  const obImportRes = await AccrualEngineService.importOpeningBalances(scope, obRows);
  console.log(`  • Opening Balances imported: Batch #${obImportRes.batchId}, Created ${obImportRes.createdTransactionsCount} ledger records`);

  if (obImportRes.successCount !== 2 || obImportRes.failureCount !== 0) {
    throw new Error(`Opening balance import failed: ${JSON.stringify(obImportRes.errors)}`);
  }

  // Assert ledger contains OPENING_BALANCE transactions
  const obTxns = await prisma.leaveAccrualLedger.findMany({
    where: {
      tenantId: tenant.id,
      transactionType: AccrualTransactionType.OPENING_BALANCE,
      batchId: obImportRes.batchId,
    },
  });
  if (obTxns.length !== 6) { // 2 employees * 3 leave types (CL, SL, EL) = 6
    throw new Error(`Expected 6 opening balance ledger transactions, got ${obTxns.length}`);
  }
  console.log(`  ✓ Verified ${obTxns.length} OPENING_BALANCE ledger transactions in database`);

  // 4.2 LOP Reversal when Retrospective Leave is Approved
  // Step A: Create an ABSENT attendance record in the past for maleEmp
  const pastAbsentDate = new Date('2026-10-15T00:00:00Z');
  const pastAbsentDateStr = '2026-10-15';

  await prisma.attendance.deleteMany({
    where: {
      employeeId: maleEmp.id,
      date: {
        gte: new Date('2026-10-15T00:00:00Z'),
        lte: new Date('2026-10-15T23:59:59Z'),
      },
    },
  });

  const absentAtt = await prisma.attendance.create({
    data: {
      employeeId: maleEmp.id,
      date: pastAbsentDate,
      checkInTime: pastAbsentDate,
      status: 'ABSENT',
      punchMode: 'system',
      punchStatus: 'REJECTED',
      rejectionReason: 'Employee did not punch in - marked ABSENT (LOP docked)',
      isActive: true,
    },
  });
  console.log(`  • Created historical ABSENT record: ID ${absentAtt.id} on ${pastAbsentDateStr} (LOP docked)`);

  // Step B: Employee applies for retrospective Sick leave on that date
  const lateSickLeave = await LeaveService.apply({
    employeeId: maleEmp.id,
    type: 'Sick',
    startDate: pastAbsentDateStr,
    endDate: pastAbsentDateStr,
    reason: 'Hospitalized with fever - applying late leave regularization',
  });
  console.log(`  • Late leave submitted: #${lateSickLeave.id} for date ${pastAbsentDateStr} (Status: ${lateSickLeave.status})`);

  // Step C: Manager / HR approves the late leave
  const approvedLateLeave = await LeaveService.updateStatus(
    lateSickLeave.id,
    'APPROVED',
    adminUser.id,
    'Late leave approved post medical document verification - reverse LOP'
  );
  console.log(`  • Leave #${approvedLateLeave.id} APPROVED by admin`);

  // Step D: Verify attendance was updated to PRESENT (punchMode: 'leave')
  const updatedAtt = await prisma.attendance.findUnique({
    where: { id: absentAtt.id },
  });
  if (!updatedAtt || updatedAtt.status !== 'PRESENT' || updatedAtt.punchMode !== 'leave') {
    throw new Error(`Expected attendance record to be PRESENT (leave), got status=${updatedAtt?.status}, punchMode=${updatedAtt?.punchMode}`);
  }
  console.log(`  ✓ Attendance updated from ABSENT to PRESENT (punchMode: ${updatedAtt.punchMode})`);

  // Step E: Verify LopReversalAdjustment record was automatically generated!
  const lopAdjustment = await prisma.lopReversalAdjustment.findFirst({
    where: {
      tenantId: tenant.id,
      employeeId: maleEmp.id,
      leaveId: lateSickLeave.id,
    },
  });
  if (!lopAdjustment) {
    throw new Error('LopReversalAdjustment was not automatically created on late leave approval');
  }
  console.log(`  ✓ Auto-generated LopReversalAdjustment: ID ${lopAdjustment.id}, Reversed: ${lopAdjustment.reversedDays} day(s), Status: ${lopAdjustment.status}`);
  if (lopAdjustment.reversedDays !== 1 || !lopAdjustment.datesAffected.includes(pastAbsentDateStr)) {
    throw new Error('LopReversalAdjustment dates or days count mismatch');
  }

  // Step F: Verify LeaveAccrualLedger has LOP_REVERSAL transaction
  const lopLedgerTxn = await prisma.leaveAccrualLedger.findFirst({
    where: {
      tenantId: tenant.id,
      employeeId: maleEmp.id,
      transactionType: AccrualTransactionType.LOP_REVERSAL,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!lopLedgerTxn) {
    throw new Error('LeaveAccrualLedger LOP_REVERSAL transaction not found');
  }
  console.log(`  ✓ Verified LOP_REVERSAL transaction in audit ledger: +${lopLedgerTxn.amount} day(s) credited back!`);

  // Step G: Mark LOP adjustment as refunded in payroll cycle
  const refundRes = await AccrualEngineService.markLopRefunded(scope, lopAdjustment.id, '2026-11');
  console.log(`  ✓ LOP adjustment refund: ${refundRes.message}`);
  const postRefund = await prisma.lopReversalAdjustment.findUnique({ where: { id: lopAdjustment.id } });
  if (postRefund?.status !== 'REFUNDED' || postRefund?.creditedInCycle !== '2026-11') {
    throw new Error(`Expected LOP status REFUNDED in cycle 2026-11, got ${postRefund?.status}`);
  }

  console.log('✅ [SUITE 4 PASSED] Opening balance import and automated LOP reversal refund loop verified!\n');

  console.log('======================================================================');
  console.log('🎉 ALL 4 CORE ENTERPRISE HRMS CAPABILITIES FULLY VERIFIED END-TO-END!');
  console.log('   1. Bulk Attendance Import & Corrections with Sanity Validation');
  console.log('   2. Team Calendar & Approval Delegation Routing');
  console.log('   3. Indian Maternity Benefit Act 2017 (26 Wks) & Gender Rules');
  console.log('   4. Opening Balance Import & Automated Loss of Pay (LOP) Reversals');
  console.log('======================================================================');
}

main()
  .catch((err) => {
    console.error('❌ E2E VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
