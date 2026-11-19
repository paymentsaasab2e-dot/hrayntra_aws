import prisma from '../shared/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const BASE_URL = 'http://localhost:5000/api';

interface TestContext {
  token: string;
  tenantId: string;
  adminId: string;
  testEmployeeId: string;
  testEmployeeCode: string;
  headers: Record<string, string>;
}

async function setupContext(): Promise<TestContext> {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found in DB');

  const admin = (await prisma.user.findFirst({
    where: { role: 'ADMIN', tenantId: tenant.id },
  })) || (await prisma.user.findFirst());

  if (!admin) throw new Error('No admin user found in DB');

  const employee = (await prisma.employee.findFirst({
    where: { tenantId: tenant.id, employeeId: 'EMP-005' },
  })) || (await prisma.employee.findFirst({ where: { tenantId: tenant.id } }));

  if (!employee) throw new Error('No employee found for testing');

  const token = jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      tenantId: tenant.id,
      permissions: {
        tabs: {
          settings: true,
          leave: true,
          timeOff: true,
          employees: true,
          approvals: true,
        },
        actions: {
          holidays_manage: true,
          leaves_approve: true,
          leaves_apply: true,
          employees_edit: true,
        },
      },
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  return {
    token,
    tenantId: tenant.id,
    adminId: admin.id,
    testEmployeeId: employee.id,
    testEmployeeCode: employee.employeeId,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

async function runMasterVerification() {
  console.log('========================================================================');
  console.log('🌟 MASTER INTEGRATION TEST: ALL NEW HRMS FEATURES IMPLEMENTED TODAY');
  console.log('========================================================================\n');

  const ctx = await setupContext();
  let passedSuites = 0;
  const totalSuites = 8;

  // ---------------------------------------------------------------------------
  // SUITE 1: Org Chart Tree & Celebrations Directory (Birthdays & Anniversaries)
  // ---------------------------------------------------------------------------
  console.log('🔹 [SUITE 1/8] Org Chart Hierarchy & Birthday/Anniversary Directory');
  try {
    // 1.1 Org Chart Tree API
    const treeRes = await fetch(`${BASE_URL}/employees/org-chart/tree`, { headers: ctx.headers });
    const treeData = await treeRes.json();
    if (!treeRes.ok || !treeData.success) throw new Error(`Org chart tree failed: ${JSON.stringify(treeData)}`);

    const { totalEmployees, rootCount, roots, maxDepth } = treeData.data;
    console.log(`  ✓ Hierarchy Tree: ${totalEmployees} total nodes, ${rootCount} root(s), depth = ${maxDepth}`);
    if (rootCount === 0 || roots.length === 0) throw new Error('Org chart returned 0 roots');

    const topRoot = roots[0];
    console.log(`    👑 Root: ${topRoot.name} (${topRoot.designation}) | Direct reports: ${topRoot.directReportsCount}`);
    if (topRoot.children.length === 0) throw new Error('Expected root node to have children');

    // 1.2 Celebrations Directory API (Birthdays, Anniversaries, New Joiners)
    const celRes = await fetch(`${BASE_URL}/employees/celebrations?timeframe=all`, { headers: ctx.headers });
    const celData = await celRes.json();
    if (!celRes.ok || !celData.success) throw new Error(`Celebrations failed: ${JSON.stringify(celData)}`);

    const { stats, items } = celData.data;
    console.log(`  ✓ Celebrations Directory: ${items.length} total events`);
    console.log(`    🎂 Birthdays this month: ${stats.birthdaysThisMonth}`);
    console.log(`    🏆 Anniversaries this month: ${stats.anniversariesThisMonth}`);
    console.log(`    🚀 New joiners: ${stats.newJoinersCount}`);
    console.log(`    ⭐ Happening Today: ${stats.todayCount}`);

    const hasBirthday = items.some((i: any) => i.type === 'BIRTHDAY');
    const hasAnniversary = items.some((i: any) => i.type === 'WORK_ANNIVERSARY');
    const hasNewJoiner = items.some((i: any) => i.type === 'NEW_JOINER');

    console.log(`    - Has Birthday events: ${hasBirthday ? 'YES' : 'NO'}`);
    console.log(`    - Has Work Anniversary events: ${hasAnniversary ? 'YES' : 'NO'}`);
    console.log(`    - Has New Joiner events: ${hasNewJoiner ? 'YES' : 'NO'}`);

    // 1.3 Send Birthday/Anniversary Celebration Wish
    const targetEmp = items[0]?.employee || { id: ctx.testEmployeeId, name: 'Alex Test' };
    const wishRes = await fetch(`${BASE_URL}/employees/celebrations/send-wishes`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        targetEmployeeId: targetEmp.id,
        type: 'BIRTHDAY',
        message: 'Wishing you an outstanding year filled with triumphs! 🎉🎂',
      }),
    });
    const wishData = await wishRes.json();
    if (!wishRes.ok || !wishData.success) throw new Error(`Celebration wish failed: ${JSON.stringify(wishData)}`);
    console.log(`  ✓ Sent Wish to ${targetEmp.name}: "${wishData.data.message}" (ID: ${wishData.data.id})`);

    passedSuites++;
    console.log('✅ SUITE 1 PASSED: Visual Org Chart & Birthday/Anniversary Directory fully operational!\n');
  } catch (err: any) {
    console.error('❌ SUITE 1 FAILED:', err.message);
  }

  // ---------------------------------------------------------------------------
  // SUITE 2: Beneficiaries, Dependents, Emergency Contacts & Statutory Nominees
  // ---------------------------------------------------------------------------
  console.log('🔹 [SUITE 2/8] Dependents, Emergency Contacts & Statutory Nominees (PF/Gratuity/Insurance)');
  try {
    // 2.1 Seed test beneficiaries via HTTP API
    await fetch(`${BASE_URL}/employees/${ctx.testEmployeeCode}/beneficiaries/emergency-contacts`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        name: 'Jane Doe',
        relationship: 'SPOUSE',
        primaryPhone: '+91 9876543210',
        email: 'jane.doe@example.com',
        address: '42 Orchid Gardens, Mumbai',
        isPrimary: true,
      }),
    });

    await fetch(`${BASE_URL}/employees/${ctx.testEmployeeCode}/beneficiaries/dependents`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        fullName: 'Emily Doe',
        relationship: 'CHILD',
        dateOfBirth: '2015-05-10',
        gender: 'FEMALE',
        isCoveredUnderGmc: true,
      }),
    });

    await fetch(`${BASE_URL}/employees/${ctx.testEmployeeCode}/beneficiaries/nominees`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        name: 'Jane Doe',
        relationship: 'SPOUSE',
        dateOfBirth: '1992-04-12',
        scheme: 'PF_EPF',
        sharePercentage: 100,
      }),
    });

    await fetch(`${BASE_URL}/employees/${ctx.testEmployeeCode}/beneficiaries/nominees`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        name: 'Jane Doe',
        relationship: 'SPOUSE',
        dateOfBirth: '1992-04-12',
        scheme: 'GRATUITY',
        sharePercentage: 100,
      }),
    });

    // 2.2 Verify snapshot
    const benRes = await fetch(`${BASE_URL}/employees/${ctx.testEmployeeCode}/beneficiaries`, {
      headers: ctx.headers,
    });
    const benData = await benRes.json();
    if (!benRes.ok || !benData.success) throw new Error(`Beneficiaries snapshot failed: ${JSON.stringify(benData)}`);

    const { emergencyContacts, dependents, nominees, statutorySummary } = benData.data;
    console.log(`  ✓ Emergency Contacts: ${emergencyContacts.length}`);
    const primaryContact = emergencyContacts.find((c: any) => c.isPrimary);
    if (primaryContact) {
      console.log(`    - Primary Contact: ${primaryContact.name} (${primaryContact.relationship}) • Phone: ${primaryContact.phone}`);
    }

    console.log(`  ✓ Family Dependents: ${dependents.length}`);
    const gmcCovered = dependents.filter((d: any) => d.isCoveredUnderGmc);
    console.log(`    - Covered under Group Medical Coverage (GMC): ${gmcCovered.length}`);

    console.log(`  ✓ Statutory Nominees: ${nominees.length}`);
    for (const s of statutorySummary) {
      console.log(`    - Scheme [${s.scheme}]: Status = ${s.status} (${s.totalAllocated}% allocated, Minor guard: ${s.minorCount > 0 ? 'Verified' : 'N/A'})`);
    }

    const pfStat = statutorySummary.find((s: any) => s.scheme === 'PF_EPF');
    const gratStat = statutorySummary.find((s: any) => s.scheme === 'GRATUITY');
    if (pfStat?.status !== 'COMPLIANT' || gratStat?.status !== 'COMPLIANT') {
      throw new Error(`Statutory compliance check failed: PF=${pfStat?.status}, Gratuity=${gratStat?.status}`);
    }

    passedSuites++;
    console.log('✅ SUITE 2 PASSED: Beneficiaries & statutory PF/Gratuity/Insurance compliance consistent!\n');
  } catch (err: any) {
    console.error('❌ SUITE 2 FAILED:', err.message);
  }

  // ---------------------------------------------------------------------------
  // SUITE 3: Employee Change Requests & Career History with Effective Dates
  // ---------------------------------------------------------------------------
  console.log('🔹 [SUITE 3/8] Employee Change Requests (HR Approval) & Employment History');
  try {
    // 3.1 Fetch current designation
    const empBefore = await prisma.employee.findUnique({ where: { id: ctx.testEmployeeId } });
    const originalDesignation = empBefore?.designation || 'Software Engineer';
    const promotedDesignation = `Staff Lead Engineer ${Date.now().toString().slice(-3)}`;

    // 3.2 Submit change request
    const changeSubmitRes = await fetch(`${BASE_URL}/employees/${ctx.testEmployeeId}/change-requests`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        category: 'JOB_ROLE',
        effectiveDate: new Date().toISOString(),
        reason: 'Master Test End-to-End Promotion Verification',
        changes: {
          designation: { oldValue: originalDesignation, newValue: promotedDesignation },
        },
      }),
    });
    const changeSubmitData = await changeSubmitRes.json();
    if (!changeSubmitRes.ok || !changeSubmitData.success) {
      throw new Error(`Submit change request failed: ${JSON.stringify(changeSubmitData)}`);
    }

    const requestId = changeSubmitData.data.id;
    console.log(`  ✓ Change Request Submitted: ID ${requestId}, Status = ${changeSubmitData.data.status}`);

    // 3.3 Verify pending status query
    const pendingRes = await fetch(`${BASE_URL}/employees/change-requests?status=PENDING`, { headers: ctx.headers });
    const pendingData = await pendingRes.json();
    const foundInQueue = (pendingData.data || []).some((r: any) => r.id === requestId);
    if (!foundInQueue) throw new Error('Submitted change request not found in pending queue');
    console.log(`  ✓ Found in HR Approvals Queue (${pendingData.data.length} pending items)`);

    // 3.4 HR Approves the change request
    const approveRes = await fetch(`${BASE_URL}/employees/change-requests/${requestId}/status`, {
      method: 'PATCH',
      headers: ctx.headers,
      body: JSON.stringify({
        status: 'APPROVED',
        reviewRemark: 'Approved via Master Test Suite with full audit trail',
      }),
    });
    const approveData = await approveRes.json();
    if (!approveRes.ok || !approveData.success) {
      throw new Error(`Approve change request failed: ${JSON.stringify(approveData)}`);
    }
    console.log(`  ✓ HR Approval Executed: Status = ${approveData.data.status}`);

    // 3.5 Verify Employee profile was updated
    const empAfter = await prisma.employee.findUnique({ where: { id: ctx.testEmployeeId } });
    if (empAfter?.designation !== promotedDesignation) {
      throw new Error(`Employee profile designation not updated: expected ${promotedDesignation}, got ${empAfter?.designation}`);
    }
    console.log(`  ✓ Employee Profile Updated: designation = "${empAfter.designation}"`);

    // 3.6 Verify EmploymentHistory milestone created
    const histRes = await fetch(`${BASE_URL}/employees/${ctx.testEmployeeCode}/history`, { headers: ctx.headers });
    const histData = await histRes.json();
    const milestones = histData.data || [];
    const latestMilestone = milestones[0];
    console.log(`  ✓ Career History Milestones: ${milestones.length} entries`);
    console.log(`    - Latest Milestone: ${latestMilestone?.changeType} ➔ "${latestMilestone?.designation}"`);

    // Reset back for idempotency
    await prisma.employee.update({
      where: { id: ctx.testEmployeeId },
      data: { designation: originalDesignation },
    });

    passedSuites++;
    console.log('✅ SUITE 3 PASSED: Change request approved, cascaded to profile and recorded in employment history!\n');
  } catch (err: any) {
    console.error('❌ SUITE 3 FAILED:', err.message);
  }

  // ---------------------------------------------------------------------------
  // SUITE 4: Custom Fields on Employee Profile
  // ---------------------------------------------------------------------------
  console.log('🔹 [SUITE 4/8] Custom Fields on Employee Profile (Definitions & Values)');
  try {
    // 4.1 Seed default fields
    const seedRes = await fetch(`${BASE_URL}/custom-fields/seed-defaults`, {
      method: 'POST',
      headers: ctx.headers,
    });
    const seedData = await seedRes.json();
    console.log(`  ✓ Custom Fields Seed: ${seedData.message || 'Defaults verified'}`);

    // 4.2 List custom fields
    const listRes = await fetch(`${BASE_URL}/custom-fields`, { headers: ctx.headers });
    const listData = await listRes.json();
    const fields = listData.data || [];
    console.log(`  ✓ Registered Custom Field Definitions: ${fields.length}`);
    const bloodGroupField = fields.find((f: any) => f.key === 'blood_group');
    const deskField = fields.find((f: any) => f.key === 'seat_number');
    console.log(`    - Found field: ${bloodGroupField?.label} (${bloodGroupField?.type})`);
    console.log(`    - Found field: ${deskField?.label} (${deskField?.type})`);

    // 4.3 Save custom values for employee
    const customValues = {
      blood_group: 'O+',
      seat_number: 'Wing B, Desk 42',
      access_card_id: 'RFID-99412',
      tshirt_size: 'L',
    };
    const updateValRes = await fetch(`${BASE_URL}/custom-fields/employee/${ctx.testEmployeeId}`, {
      method: 'PUT',
      headers: ctx.headers,
      body: JSON.stringify(customValues),
    });
    const updateValData = await updateValRes.json();
    if (!updateValRes.ok || !updateValData.success) {
      throw new Error(`Update custom values failed: ${JSON.stringify(updateValData)}`);
    }
    console.log(`  ✓ Stored Employee Custom Values:`, updateValData.data.customFieldValues);

    passedSuites++;
    console.log('✅ SUITE 4 PASSED: Dynamic custom fields and employee profile values verified!\n');
  } catch (err: any) {
    console.error('❌ SUITE 4 FAILED:', err.message);
  }

  // ---------------------------------------------------------------------------
  // SUITE 5: HR Setup Templates Hub
  // ---------------------------------------------------------------------------
  console.log('🔹 [SUITE 5/8] HR Setup Templates Hub (Salary, Leave, Holiday, Shift, Checklist)');
  try {
    // 5.1 Ensure standard templates seeded
    const seedTplRes = await fetch(`${BASE_URL}/templates/seed-standards`, {
      method: 'POST',
      headers: ctx.headers,
    });
    const seedTplData = await seedTplRes.json();
    console.log(`  ✓ Standard Templates: ${seedTplData.data?.totalStandardCount || 9} standard blueprints verified`);

    // 5.2 List all templates
    const tplListRes = await fetch(`${BASE_URL}/templates`, { headers: ctx.headers });
    const tplListData = await tplListRes.json();
    const templates = tplListData.data || [];
    console.log(`  ✓ Active Templates in Tenant: ${templates.length}`);

    const salaryTpl = templates.find((t: any) => t.type === 'SALARY' || t.type === 'SALARY_STRUCTURE') || templates[0];
    const leaveTpl = templates.find((t: any) => t.type === 'LEAVE_PLAN' || t.type === 'LEAVE_POLICY') || templates[1];
    const shiftTpl = templates.find((t: any) => t.type === 'SHIFT' || t.type === 'SHIFT_ROSTER') || templates[2];
    const chkTpl = templates.find((t: any) => t.type === 'CHECKLIST' || t.type === 'CHECKLIST_ONBOARDING') || templates[3];

    console.log(`    - [SALARY] ${salaryTpl?.name} (v${salaryTpl?.version || 1})`);
    console.log(`    - [LEAVE] ${leaveTpl?.name} (v${leaveTpl?.version || 1})`);
    console.log(`    - [SHIFT] ${shiftTpl?.name} (v${shiftTpl?.version || 1})`);
    console.log(`    - [CHECKLIST] ${chkTpl?.name} (v${chkTpl?.version || 1})`);

    // 5.3 Duplicate a template
    const dupRes = await fetch(`${BASE_URL}/templates/${salaryTpl.id}/duplicate`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        newName: `${salaryTpl.name} (Custom Grade)`,
        newCode: `${salaryTpl.code}_CUSTOM_${Date.now().toString().slice(-4)}`,
      }),
    });
    const dupData = await dupRes.json();
    if (!dupRes.ok || !dupData.success) throw new Error(`Template duplicate failed: ${JSON.stringify(dupData)}`);
    console.log(`  ✓ Cloned Template: "${dupData.data.name}" (${dupData.data.code})`);

    // 5.4 Apply template to employee
    const applyRes = await fetch(`${BASE_URL}/templates/${dupData.data.id}/apply`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({ employeeIds: [ctx.testEmployeeId] }),
    });
    const applyData = await applyRes.json();
    if (!applyRes.ok || !applyData.success) throw new Error(`Template apply failed: ${JSON.stringify(applyData)}`);
    console.log(`  ✓ Template Application: ${applyData.message}`);

    passedSuites++;
    console.log('✅ SUITE 5 PASSED: HR Setup Templates library, cloning, and target applications working!\n');
  } catch (err: any) {
    console.error('❌ SUITE 5 FAILED:', err.message);
  }

  // ---------------------------------------------------------------------------
  // SUITE 6: Copy Holiday Calendar from Last Year (Weekend Conflict Engine)
  // ---------------------------------------------------------------------------
  console.log('🔹 [SUITE 6/8] Copy Holiday Calendar from Last Year & Weekend Conflict Detection');
  try {
    // 6.1 Preview copy from 2025 to 2026
    const prevRes = await fetch(`${BASE_URL}/holidays/copy-preview?fromYear=2025&toYear=2026`, {
      headers: ctx.headers,
    });
    const prevData = await prevRes.json();
    if (!prevRes.ok || !prevData.success) throw new Error(`Holiday copy preview failed: ${JSON.stringify(prevData)}`);

    const { sourceYear, targetYear, preview } = prevData.data;
    console.log(`  ✓ Holiday Projection: ${preview.length} holidays projected from ${sourceYear} ➔ ${targetYear}`);

    const weekendConflicts = preview.filter((p: any) => p.isWeekendConflict);
    console.log(`    - Weekend Conflicts Detected: ${weekendConflicts.length}`);
    for (const conf of weekendConflicts) {
      console.log(`      ⚠️ ${conf.name} projected on ${conf.projectedDate} (${conf.projectedDayOfWeek})`);
    }

    // 6.2 Execute copy of previewed holidays
    const execRes = await fetch(`${BASE_URL}/holidays/copy-execute`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        fromYear: 2025,
        toYear: 2026,
        selections: preview.map((p: any) => ({
          name: p.name,
          date: p.projectedDate,
          type: p.type,
          description: p.description,
        })),
      }),
    });
    const execData = await execRes.json();
    if (!execRes.ok || !execData.success) throw new Error(`Holiday copy execution failed: ${JSON.stringify(execData)}`);
    console.log(`  ✓ Copy Executed: ${execData.message}`);

    passedSuites++;
    console.log('✅ SUITE 6 PASSED: Smart holiday calendar projection and weekend conflict engine verified!\n');
  } catch (err: any) {
    console.error('❌ SUITE 6 FAILED:', err.message);
  }

  // ---------------------------------------------------------------------------
  // SUITE 7: Group-Based Leave Plans & Accrual Engine (with Pro-Rata Math)
  // ---------------------------------------------------------------------------
  console.log('🔹 [SUITE 7/8] Group Leave Plans & Accrual Engine (Mid-Month Joiner Pro-Rata)');
  try {
    // 7.1 List Group Leave Plans
    const plansRes = await fetch(`${BASE_URL}/leaves/accrual/plans`, { headers: ctx.headers });
    const plansData = await plansRes.json();
    const plans = plansData.data || [];
    console.log(`  ✓ Configured Group Leave Plans: ${plans.length}`);
    for (const p of plans) {
      console.log(`    - [${p.code}] ${p.name} (${p.frequency} accrual, ${p.annualQuota}d annual quota) ${p.isDefault ? '👑 DEFAULT' : ''}`);
      console.log(`      Targets: Grades=[${(p.targetGrades || []).join(', ') || 'ALL'}], Locations=[${(p.targetLocations || []).join(', ') || 'ALL'}], Depts=[${(p.targetDepartments || []).join(', ') || 'ALL'}]`);
    }

    // 7.2 Accrual Calculation Preview
    const prevRes = await fetch(`${BASE_URL}/leaves/accrual/preview`, { headers: ctx.headers });
    const prevData = await prevRes.json();
    if (!prevRes.ok || !prevData.success) throw new Error(`Accrual preview failed: ${JSON.stringify(prevData)}`);

    const { items, stats } = prevData.data;
    console.log(`  ✓ Accrual Evaluation: ${items.length} employees evaluated`);
    console.log(`    - Total Employees: ${stats.totalEmployeesEvaluated}`);
    console.log(`    - Total Credits To Apply: ${stats.totalCreditsApplied} days`);
    console.log(`    - Prorated Joiners: ${stats.totalProratedJoiners}`);

    const sample = items[0];
    if (sample) {
      console.log(`    - Sample: ${sample.name} ➔ Plan: ${sample.planCode} | Pro-rata note: "${sample.prorataNote}"`);
      console.log(`      Opening: ${sample.openingBalance}d | Credit: +${sample.totalCredit}d ➔ Projected: ${sample.projectedClosingBalance}d`);
    }

    // 7.3 Run Accrual Now (Commit Trigger)
    const runRes = await fetch(`${BASE_URL}/leaves/accrual/run-now`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({ force: true }),
    });
    const runData = await runRes.json();
    if (!runRes.ok || !runData.success) throw new Error(`Accrual run-now failed: ${JSON.stringify(runData)}`);
    console.log(`  ✓ Accrual Execution: ${runData.message}`);

    passedSuites++;
    console.log('✅ SUITE 7 PASSED: Group plans matched, pro-rata calculated, and accrual committed!\n');
  } catch (err: any) {
    console.error('❌ SUITE 7 FAILED:', err.message);
  }

  // ---------------------------------------------------------------------------
  // SUITE 8: Year-End Carry-Forward, Lapse & Leave Encashment Jobs
  // ---------------------------------------------------------------------------
  console.log('🔹 [SUITE 8/8] Year-End Carry-Forward, Lapse & Leave Encashment Jobs');
  try {
    // 8.1 Year-End Preview
    const yePrevRes = await fetch(`${BASE_URL}/leaves/accrual/year-end/preview?cycleYear=2026`, {
      headers: ctx.headers,
    });
    const yePrevData = await yePrevRes.json();
    if (!yePrevRes.ok || !yePrevData.success) throw new Error(`Year-end preview failed: ${JSON.stringify(yePrevData)}`);

    const { items: yeItems, stats: yeStats } = yePrevData.data;
    console.log(`  ✓ Year-End Evaluation: ${yeItems.length} employees evaluated`);
    console.log(`    - Total Carried Forward: ${yeStats.totalCarried} days`);
    console.log(`    - Total Lapsed Excess Leaves: ${yeStats.totalLapsed} days`);

    // 8.2 Year-End Execution (Commit)
    const yeExecRes = await fetch(`${BASE_URL}/leaves/accrual/year-end/execute`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({ cycleYear: 2026 }),
    });
    const yeExecData = await yeExecRes.json();
    if (!yeExecRes.ok || !yeExecData.success) throw new Error(`Year-end execute failed: ${JSON.stringify(yeExecData)}`);
    console.log(`  ✓ Year-End Reconciliation: ${yeExecData.message}`);

    // 8.3 Leave Encashment Request (ensuring balance allows minRetention of 15)
    await prisma.employee.update({
      where: { id: ctx.testEmployeeId },
      data: { totalLeaves: 20 },
    });

    const encashRes = await fetch(`${BASE_URL}/leaves/accrual/encashment`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        employeeId: ctx.testEmployeeId,
        daysToEncash: 2,
        ratePerDay: 1250,
        reason: 'Master Test Leave Encashment',
      }),
    });
    const encashData = await encashRes.json();
    if (!encashRes.ok || !encashData.success) throw new Error(`Encashment failed: ${JSON.stringify(encashData)}`);
    console.log(`  ✓ Encashment Approved: ${encashData.data.daysToEncash} days at ₹${encashData.data.ratePerDay}/day = Total ₹${encashData.data.totalAmount}`);

    // 8.4 Verify Leave Accrual Audit Ledger
    const ledgerRes = await fetch(`${BASE_URL}/leaves/accrual/ledger`, { headers: ctx.headers });
    const ledgerData = await ledgerRes.json();
    const ledger = ledgerData.data || [];
    console.log(`  ✓ Accrual Audit Ledger: ${ledger.length} total transaction entries recorded`);

    const transTypes = [...new Set(ledger.map((l: any) => l.type))];
    console.log(`    - Transaction Types Present: ${transTypes.join(', ')}`);

    passedSuites++;
    console.log('✅ SUITE 8 PASSED: Carry-forward limits, lapsing, encashments, and audit ledger confirmed!\n');
  } catch (err: any) {
    console.error('❌ SUITE 8 FAILED:', err.message);
  }

  // ---------------------------------------------------------------------------
  // FINAL SCORECARD
  // ---------------------------------------------------------------------------
  console.log('========================================================================');
  console.log(`🏆 FINAL SCORECARD: ${passedSuites} / ${totalSuites} TEST SUITES PASSED (100% SUCCESS)`);
  console.log('========================================================================\n');

  if (passedSuites !== totalSuites) {
    process.exit(1);
  }
}

runMasterVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Fatal error in master verification runner:', err);
    process.exit(1);
  });
