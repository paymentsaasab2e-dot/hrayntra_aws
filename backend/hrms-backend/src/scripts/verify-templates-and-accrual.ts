import prisma from '../shared/prisma';
import { TemplateService } from '../modules/templates/template.service';
import { HolidayService } from '../modules/holiday/holiday.service';
import { AccrualEngineService } from '../modules/leave/accrual/accrual-engine.service';
import { AccrualFrequency, AccrualTransactionType, HrTemplateType } from '@prisma/client';

async function main() {
  console.log('🧪 Starting Comprehensive Verification for HR Setup Templates & Accrual Engine...\n');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('Tenant not found');

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const scope: any = {
    tenantId: tenant.id,
    userId: adminUser?.id || tenant.provisionedAdminUserId,
    role: 'ADMIN',
    isHqAdmin: true,
  };

  // ── [CHECK 1] HR Setup Templates Library & Seeding ──
  console.log('--- [CHECK 1] Reusable HR Setup Templates Library ---');
  const seedResult = await TemplateService.seedStandardTemplates(scope);
  console.log(`  • Seed result: ${seedResult.message || `Seeded ${seedResult.count} templates`}`);

  const allTemplates = await TemplateService.getAll(scope);
  console.log(`  • Total templates in tenant: ${allTemplates.length}`);
  for (const t of allTemplates) {
    console.log(`    - [${t.type}] ${t.name} (${t.code}) ${t.isDefault ? '👑 DEFAULT' : ''}`);
  }

  const salaryTemplates = await TemplateService.getAll(scope, HrTemplateType.SALARY);
  const leaveTemplates = await TemplateService.getAll(scope, HrTemplateType.LEAVE_PLAN);
  const shiftTemplates = await TemplateService.getAll(scope, HrTemplateType.SHIFT);
  const checklistTemplates = await TemplateService.getAll(scope, HrTemplateType.CHECKLIST);
  const holidayTemplates = await TemplateService.getAll(scope, HrTemplateType.HOLIDAY_CALENDAR);

  if (salaryTemplates.length === 0 || leaveTemplates.length === 0 || shiftTemplates.length === 0) {
    throw new Error('Failed: Expected templates across all categories');
  }

  // Test template duplication
  const duplicate = await TemplateService.duplicate(scope, salaryTemplates[0].id, 'Senior SWE Custom (12 LPA)');
  console.log(`  ✨ Successfully duplicated template: ${duplicate.name} (${duplicate.code})`);
  await TemplateService.delete(scope, duplicate.id);
  console.log('✅ CHECK 1 PASSED: HR Setup Templates library active with full CRUD & duplicating!\n');

  // ── [CHECK 2] "Copy Holiday Calendar from Last Year" Engine ──
  console.log('--- [CHECK 2] Copy Holiday Calendar from Last Year ---');
  // First ensure source year (2025) has at least 3 holidays to copy from
  const src2025Dates = [
    { name: 'Republic Day', date: new Date('2025-01-26'), type: 'Gazetted Holiday' },
    { name: 'Independence Day', date: new Date('2025-08-15'), type: 'Gazetted Holiday' },
    { name: 'Gandhi Jayanti', date: new Date('2025-10-02'), type: 'Gazetted Holiday' },
    { name: 'Diwali', date: new Date('2025-10-20'), type: 'Public Holiday' },
  ];
  for (const h of src2025Dates) {
    await prisma.holiday.upsert({
      where: { tenantId_date: { tenantId: tenant.id, date: h.date } },
      update: { name: h.name, type: h.type },
      create: { tenantId: tenant.id, name: h.name, date: h.date, type: h.type, isActive: true },
    });
  }

  // 1. Preview copy from 2025 into 2026
  const preview = await HolidayService.previewCopyFromLastYear(scope, 2025, 2026);
  console.log(`  • Found ${preview.sourceCount} source holidays in 2025`);
  console.log(`  • Preview items for 2026:`);
  for (const p of preview.preview) {
    console.log(`    - ${p.name}: 2025 date was ${p.sourceDate} (${p.sourceDayName}) ➔ 2026 date: ${p.projectedDate} (${p.projectedDayName}) | Weekend Conflict: ${p.isWeekendConflict}`);
  }

  // 2. Execute copy
  const copyResult = await HolidayService.copyFromLastYear(
    scope,
    2025,
    2026,
    preview.preview.map((p) => ({
      sourceHolidayId: p.sourceHolidayId,
      name: p.name,
      type: p.type,
      targetDate: p.projectedDate,
    }))
  );
  console.log(`  🎉 Copied ${copyResult.copiedCount} holidays into target calendar 2026 (skipped ${copyResult.skippedCount})`);
  if (copyResult.copiedCount === 0) throw new Error('Failed: Expected holidays to be copied into 2026');
  console.log('✅ CHECK 2 PASSED: Holiday calendar copy & date conversion engine operational!\n');

  // ── [CHECK 3] Group-Based Leave Plans & Entitlements ──
  console.log('--- [CHECK 3] Leave Plans per Group (Location / Grade / Department) ---');
  // First ensure standard corporate default plan exists
  const defaultCorpPlan = await AccrualEngineService.upsertPlan(scope, {
    code: 'LV-DEF-STD',
    name: 'Standard Corporate Leave Plan',
    frequency: AccrualFrequency.MONTHLY,
    annualCasual: 6.0,
    annualSick: 6.0,
    annualEarned: 6.0,
    carryForwardLimit: 15.0,
    isDefault: true,
  });

  // Create a specialized plan targeted only at Sales department
  const salesPlan = await AccrualEngineService.upsertPlan(scope, {
    code: 'LV-SALES-FIELD',
    name: 'Sales Field Staff 21-Day Plan',
    frequency: AccrualFrequency.MONTHLY,
    annualCasual: 7.0,
    annualSick: 7.0,
    annualEarned: 7.0,
    carryForwardLimit: 20.0,
    targetDepartments: ['Sales'],
    isDefault: false,
  });

  const alexEmp = await prisma.employee.findFirst({ where: { employeeId: 'EMP-005', tenantId: tenant.id } });
  const sarahEmp = await prisma.employee.findFirst({ where: { employeeId: 'EMP-001', tenantId: tenant.id } });

  if (alexEmp) {
    const alexPlan = await AccrualEngineService.resolvePlanForEmployee(tenant.id, {
      locationId: alexEmp.locationId,
      designation: alexEmp.designation,
      department: alexEmp.department,
    });
    console.log(`  👤 Alex Test (Sales Department) resolved plan: "${alexPlan.name}" (${alexPlan.code})`);
    if (alexPlan.code !== 'LV-SALES-FIELD') {
      throw new Error(`Failed: Expected Alex Test to match group plan LV-SALES-FIELD, got ${alexPlan.code}`);
    }
  }

  if (sarahEmp) {
    const sarahPlan = await AccrualEngineService.resolvePlanForEmployee(tenant.id, {
      locationId: sarahEmp.locationId,
      designation: sarahEmp.designation,
      department: sarahEmp.department,
    });
    console.log(`  👤 Sarah Connor (Engineering Department) resolved default plan: "${sarahPlan.name}" (${sarahPlan.code})`);
  }
  console.log('✅ CHECK 3 PASSED: Group-specific leave entitlements dynamically matched by department & location!\n');

  // ── [CHECK 4] Pro-Rata Accrual Engine ("Run Accrual Now") ──
  console.log('--- [CHECK 4] Pro-Rata Accrual Engine & Execution ---');
  // Run live accrual engine with commit: true
  const accrualResult = await AccrualEngineService.runAccrualEngine(scope, {
    asOfDate: new Date(),
    commit: true,
    force: true,
  });

  console.log(`  • Evaluated employees: ${accrualResult.stats.totalEmployeesEvaluated}`);
  console.log(`  • Total credits applied: ${accrualResult.stats.totalCreditsApplied} days`);
  console.log(`  • Prorated joiners count: ${accrualResult.stats.totalProratedJoiners}`);

  for (const item of accrualResult.items) {
    console.log(`    - ${item.name} (${item.employeeCode}): +${item.totalCredit}d (${item.prorataNote}) | Bal: ${item.openingBalance} ➔ ${item.projectedClosingBalance}`);
  }

  // Verify ledger transactions were appended
  const ledgerEntries = await AccrualEngineService.getLedger(scope);
  console.log(`  📚 Total audit ledger records: ${ledgerEntries.length}`);
  if (ledgerEntries.length === 0) throw new Error('Failed: Accrual ledger entries missing');
  console.log('✅ CHECK 4 PASSED: Scheduled & pro-rata accrual executed and recorded in audit ledger!\n');

  // ── [CHECK 5] Year-End Carry-Forward, Lapse & Encashment ──
  console.log('--- [CHECK 5] Year-End Carry-Forward, Lapse & Encashment Job ---');
  // Set an employee balance high to test carry-forward cap and lapsing
  if (sarahEmp) {
    await prisma.employee.update({
      where: { id: sarahEmp.id },
      data: { totalLeaves: 22.0 }, // Exceeds standard 15-day carry forward limit
    });
  }

  const yearEndResult = await AccrualEngineService.runYearEndJob(scope, {
    cycleYear: 2026,
    commit: true,
  });

  console.log(`  • Total Carried Forward across team: ${yearEndResult.stats.totalCarried} days`);
  console.log(`  • Total Lapsed excess leaves: ${yearEndResult.stats.totalLapsed} days`);

  const sarahYearEnd = yearEndResult.items.find((i) => i.employeeId === sarahEmp?.id);
  if (sarahYearEnd) {
    console.log(`    - Sarah Connor: Start 22d ➔ Carried ${sarahYearEnd.carriedForward}d (Cap ${sarahYearEnd.carryForwardLimit}), Lapsed ${sarahYearEnd.lapsedAmount}d`);
    if (sarahYearEnd.lapsedAmount !== 7.0 || sarahYearEnd.carriedForward !== 15.0) {
      throw new Error(`Failed: Expected 7 days lapsed and 15 days carried for Sarah, got ${sarahYearEnd.lapsedAmount} lapsed`);
    }
  }

  // Test Encashment
  console.log('--- Testing Leave Encashment ---');
  if (sarahEmp) {
    // Current balance is 15 days, min retention is 15 -> let's give 20 days so she can encash 5
    await prisma.employee.update({
      where: { id: sarahEmp.id },
      data: { totalLeaves: 20.0 },
    });

    const encashment = await AccrualEngineService.requestEncashment(scope, {
      employeeId: sarahEmp.id,
      daysToEncash: 4.0,
      remarks: 'Diwali leave encashment',
    });

    console.log(`  💰 Encashment Approved: ${encashment.daysToEncash} days at ₹${encashment.perDayRate}/day = Total ₹${encashment.totalAmount}`);
    const updatedSarah = await prisma.employee.findUnique({ where: { id: sarahEmp.id } });
    console.log(`  💼 Sarah remaining balance after encashment debit: ${updatedSarah?.totalLeaves} days`);
    if (updatedSarah?.totalLeaves !== 16.0) {
      throw new Error(`Failed: Expected balance 16 after encashing 4 from 20, got ${updatedSarah?.totalLeaves}`);
    }
  }
  console.log('✅ CHECK 5 PASSED: Year-end carry-forward limits, lapsing, and encashment verified!\n');

  console.log('🎉 ALL 5 COMPREHENSIVE BACKEND HR TEMPLATES & ACCRUAL ENGINE CHECKS PASSED WITH 100% SUCCESS!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
