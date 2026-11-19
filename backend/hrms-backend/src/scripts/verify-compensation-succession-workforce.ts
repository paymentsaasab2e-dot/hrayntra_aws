import prisma from '../shared/prisma';
import { CompensationPlanningService } from '../modules/compensation/planning/compensation-planning.service';
import { TalentSuccessionService } from '../modules/performance/succession/talent-succession.service';
import { WorkforcePlanningService } from '../modules/onboarding/workforce/workforce-planning.service';

async function main() {
  console.log('\n======================================================================');
  console.log('--- STARTING VERIFICATION: COMPENSATION, SUCCESSION & WORKFORCE ---');
  console.log('======================================================================\n');

  // 1. Resolve test tenant
  const tenant = await prisma.tenant.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      users: { where: { role: 'ADMIN' }, take: 1 },
      employees: { where: { status: 'ACTIVE' } },
    },
  });

  if (!tenant) throw new Error('No active tenant found.');
  const tenantId = tenant.id;
  const adminUser = tenant.users[0] || (await prisma.user.findFirst({ where: { tenantId } }));
  if (!adminUser) throw new Error('No admin user found.');

  const employees = tenant.employees;
  console.log(`[Setup] Tenant: ${tenant.name} (${tenantId})`);
  console.log(`[Setup] Admin User: ${adminUser.email}`);
  console.log(`[Setup] Active Employees Count: ${employees.length}`);

  // Clean test artifacts
  await prisma.employeeIncrementRecommendation.deleteMany({ where: { tenantId } });
  await prisma.departmentBudgetPool.deleteMany({ where: { tenantId } });
  await prisma.compensationCycle.deleteMany({ where: { tenantId } });
  await prisma.talentAssessment.deleteMany({ where: { tenantId } });
  await prisma.employeeSkill.deleteMany({ where: { tenantId } });
  await prisma.successionCandidate.deleteMany({ where: { tenantId } });
  await prisma.successionPlan.deleteMany({ where: { tenantId } });
  await prisma.jobRequisition.deleteMany({ where: { tenantId } });
  await prisma.headcountPlan.deleteMany({ where: { tenantId } });

  console.log('[Setup] Cleaned previous test run artifacts.');

  // =========================================================================
  // SUITE 1: COMPENSATION PLANNING, COMPA-RATIO & INCREMENT RATING MATRIX
  // =========================================================================
  console.log('\n--- SUITE 1: COMPENSATION PLANNING & INCREMENT CYCLES ---');

  // 1.1 Mathematical verification of Compa-Ratio formula
  console.log('1.1 Testing Compa-Ratio calculations and band positioning...');
  const gradeMidpoint = 1000000; // ₹10,00,000

  const lowCompa = CompensationPlanningService.calculateCompaRatio(750000, gradeMidpoint);
  console.log(`✓ Low Salary (₹7.5L vs ₹10L Midpoint): ratio = ${lowCompa.compaRatio}%, band = ${lowCompa.bandPosition}`);
  if (lowCompa.compaRatio !== 75.0 || lowCompa.bandPosition !== 'BELOW_MARKET') {
    throw new Error('Compa-Ratio below market band failed');
  }

  const midCompa = CompensationPlanningService.calculateCompaRatio(1000000, gradeMidpoint);
  console.log(`✓ Target Salary (₹10.0L vs ₹10L Midpoint): ratio = ${midCompa.compaRatio}%, band = ${midCompa.bandPosition}`);
  if (midCompa.compaRatio !== 100.0 || midCompa.bandPosition !== 'TARGET_BAND') {
    throw new Error('Compa-Ratio target band failed');
  }

  const highCompa = CompensationPlanningService.calculateCompaRatio(1250000, gradeMidpoint);
  console.log(`✓ High Salary (₹12.5L vs ₹10L Midpoint): ratio = ${highCompa.compaRatio}%, band = ${highCompa.bandPosition}`);
  if (highCompa.compaRatio !== 125.0 || highCompa.bandPosition !== 'ABOVE_MARKET') {
    throw new Error('Compa-Ratio above market band failed');
  }

  // 1.2 Merit Rating Matrix Hike Calculation
  console.log('1.2 Testing Merit Rating Matrix recommendation rules...');
  // Rating 5 + Low Compa -> 20%
  const hikeR5Low = CompensationPlanningService.getRecommendedHike(5, 75.0);
  console.log(`✓ Rating 5 + Below Market (<85%): ${hikeR5Low}% hike recommended`);
  if (hikeR5Low !== 20.0) throw new Error(`Expected 20% hike, got ${hikeR5Low}%`);

  // Rating 5 + High Compa -> 12%
  const hikeR5High = CompensationPlanningService.getRecommendedHike(5, 125.0);
  console.log(`✓ Rating 5 + Above Market (>115%): ${hikeR5High}% hike recommended`);
  if (hikeR5High !== 12.0) throw new Error(`Expected 12% hike, got ${hikeR5High}%`);

  // Rating 3 + Mid Compa -> 8%
  const hikeR3Mid = CompensationPlanningService.getRecommendedHike(3, 100.0);
  console.log(`✓ Rating 3 + Target Band (85-115%): ${hikeR3Mid}% hike recommended`);
  if (hikeR3Mid !== 8.0) throw new Error(`Expected 8% hike, got ${hikeR3Mid}%`);

  // 1.3 Create Compensation Cycle
  console.log('1.3 Creating Compensation Cycle FY2026-27 with budget pool...');
  const cycle = await CompensationPlanningService.createCycle(tenantId, {
    name: 'Annual Merit Appraisal Cycle 2026',
    code: 'INC-2026-ANNUAL',
    fiscalYear: 'FY2026-27',
    effectiveDate: '2026-04-01',
    totalBudgetAmount: 5000000, // ₹50 Lakhs pool
    overallHikePercent: 10.0,
  });
  console.log(`✓ Cycle created: ${cycle.name} (${cycle.code}), Status: ${cycle.status}`);

  // 1.4 Generate Recommendations for Active Employees
  console.log('1.4 Generating recommendations for eligible employees...');
  const genResult = await CompensationPlanningService.generateRecommendationsForCycle(tenantId, cycle.id);
  console.log(`✓ Generated ${genResult.totalRecommendations} increment recommendations across workforce.`);
  if (genResult.totalRecommendations !== employees.length) {
    throw new Error(`Expected ${employees.length} recommendations, got ${genResult.totalRecommendations}`);
  }

  // 1.5 Verify Department Pools & Cycle Dashboard
  console.log('1.5 Inspecting Cycle Analytics Dashboard & Department Pools...');
  const dash = await CompensationPlanningService.getCycleDashboard(tenantId, cycle.id);
  console.log('✓ Cycle Dashboard Summary:', {
    eligible: dash.metrics.eligibleEmployees,
    currentPayroll: `₹${dash.metrics.totalCurrentPayroll.toLocaleString('en-IN')}`,
    proposedPayroll: `₹${dash.metrics.totalProposedPayroll.toLocaleString('en-IN')}`,
    hikeCommitted: `₹${dash.metrics.totalHikeCommitted.toLocaleString('en-IN')}`,
    utilization: `${dash.metrics.budgetUtilizationPercent}%`,
    averageHike: `${dash.metrics.averageHikePercent}%`,
  });
  console.log(`✓ Department budget pools created: ${dash.departmentPools.length}`);
  if (dash.departmentPools.length === 0) {
    throw new Error('Department budget pools were not generated');
  }

  // 1.6 Update / Override a Recommendation
  console.log('1.6 Updating individual recommendation with managerial adjustment...');
  const targetRec = dash.recommendations[0];
  const updatedRec = await CompensationPlanningService.updateRecommendation(tenantId, targetRec.id, {
    recommendedPercent: 15.0,
    managerNotes: 'Outperformed sprint milestones; special managerial adjustment approved.',
  });
  console.log(`✓ Recommendation updated: +${updatedRec.recommendedPercent}% hike (₹${updatedRec.recommendedHikeAmount}) $\to$ New CTC: ₹${updatedRec.newProposedCtc}`);
  if (updatedRec.recommendedPercent !== 15.0) {
    throw new Error('Failed to update recommendation hike %');
  }

  // 1.7 Apply Cycle to Employee Payroll
  console.log('1.7 Applying increment cycle to payroll...');
  const applyResult = await CompensationPlanningService.applyCycle(tenantId, cycle.id, adminUser.id);
  console.log(`✓ Applied increments to ${applyResult.appliedCount} employees effective ${applyResult.effectiveDate.toISOString()}`);
  if (applyResult.appliedCount !== employees.length) {
    throw new Error('Increment cycle application count mismatch');
  }

  // Verify employee compensation was updated in database
  const empComp = await prisma.employeeCompensation.findUnique({
    where: { employeeId: targetRec.employeeId },
  });
  console.log(`✓ Verified employee compensation updated: anchorValue = ₹${empComp?.anchorValue}`);
  if (!empComp || empComp.anchorValue !== updatedRec.newProposedCtc) {
    throw new Error('Employee compensation record did not match applied increment');
  }

  // =========================================================================
  // SUITE 2: SUCCESSION PLANNING, SKILL MATRIX & 9-BOX GRID
  // =========================================================================
  console.log('\n--- SUITE 2: SUCCESSION PLANNING, SKILL MATRIX & 9-BOX ---');

  // 2.1 9-Box Formula Verification
  console.log('2.1 Verifying 9-Box Grid coordinate mappings...');
  const boxStar = TalentSuccessionService.calculateNineBox(3, 3);
  console.log(`✓ Perf 3, Pot 3: ${boxStar.key} ("${boxStar.title}")`);
  if (boxStar.key !== 'STAR') throw new Error('Expected STAR for (3,3)');

  const boxRoughDiamond = TalentSuccessionService.calculateNineBox(1, 3);
  console.log(`✓ Perf 1, Pot 3: ${boxRoughDiamond.key} ("${boxRoughDiamond.title}")`);
  if (boxRoughDiamond.key !== 'ROUGH_DIAMOND') throw new Error('Expected ROUGH_DIAMOND for (1,3)');

  const boxWorkhorse = TalentSuccessionService.calculateNineBox(3, 1);
  console.log(`✓ Perf 3, Pot 1: ${boxWorkhorse.key} ("${boxWorkhorse.title}")`);
  if (boxWorkhorse.key !== 'TRUSTED_PROFESSIONAL') throw new Error('Expected TRUSTED_PROFESSIONAL for (3,1)');

  const boxRisk = TalentSuccessionService.calculateNineBox(1, 1);
  console.log(`✓ Perf 1, Pot 1: ${boxRisk.key} ("${boxRisk.title}")`);
  if (boxRisk.key !== 'UNDERPERFORMER') throw new Error('Expected UNDERPERFORMER for (1,1)');

  // 2.2 Seed Standard Competency Library
  console.log('2.2 Seeding standard competency framework...');
  const seededSkills = await TalentSuccessionService.seedStandardSkills(tenantId);
  console.log(`✓ Seeded ${seededSkills.length} competencies across Technical, Leadership, Compliance, Domain.`);
  if (seededSkills.length < 6) throw new Error('Expected at least 6 standard skills');

  // 2.3 Record Employee Skill Proficiency & Evaluate Skill Gap
  const sampleEmp = employees[0];
  const archSkill = seededSkills.find((s: any) => s.code === 'SKILL-SYS-ARCH') || seededSkills[0];
  console.log(`2.3 Evaluating skill proficiency and gap for ${sampleEmp.firstName}...`);

  // First record proficiency level 2 (below required level 4)
  await TalentSuccessionService.recordSkillProficiency(tenantId, sampleEmp.id, archSkill.id, 2);
  let matrix = await TalentSuccessionService.getEmployeeSkillMatrix(tenantId, sampleEmp.id);
  let evaluatedSkill = matrix.find((m: any) => m.skillId === archSkill.id);
  if (!evaluatedSkill) throw new Error('Evaluated skill not found in matrix');
  console.log(`✓ Evaluated proficiency: Level ${evaluatedSkill.currentProficiencyLevel}/${evaluatedSkill.minRequiredLevel}, Gap: ${evaluatedSkill.skillGap} (hasGap = ${evaluatedSkill.hasGap})`);
  if (!evaluatedSkill.hasGap || evaluatedSkill.skillGap !== 2) {
    throw new Error('Skill gap analysis calculation failed');
  }

  // Update proficiency to 4 (meets benchmark)
  await TalentSuccessionService.recordSkillProficiency(tenantId, sampleEmp.id, archSkill.id, 4);
  matrix = await TalentSuccessionService.getEmployeeSkillMatrix(tenantId, sampleEmp.id);
  evaluatedSkill = matrix.find((m: any) => m.skillId === archSkill.id);
  if (!evaluatedSkill) throw new Error('Evaluated skill not found after update');
  console.log(`✓ Updated proficiency to Level 4: Gap = ${evaluatedSkill.skillGap} (hasGap = ${evaluatedSkill.hasGap})`);
  if (evaluatedSkill.hasGap || evaluatedSkill.skillGap !== 0) {
    throw new Error('Skill gap was not closed after proficiency upgrade');
  }

  // 2.4 Assess Employees into 9-Box Grid
  console.log('2.4 Assessing employees into 9-Box Grid...');
  const empA = employees[0];
  const empB = employees[1] || employees[0];
  const empC = employees[2] || employees[0];

  await TalentSuccessionService.assessEmployeeTalent(tenantId, empA.id, {
    performanceLevel: 3,
    potentialLevel: 3,
    flightRisk: 'LOW',
    impactOfLoss: 'CRITICAL',
    strengths: ['Architecture', 'Technical Execution'],
  });

  await TalentSuccessionService.assessEmployeeTalent(tenantId, empB.id, {
    performanceLevel: 2,
    potentialLevel: 3,
    flightRisk: 'MEDIUM',
    impactOfLoss: 'HIGH',
    strengths: ['High Learning Velocity'],
  });

  await TalentSuccessionService.assessEmployeeTalent(tenantId, empC.id, {
    performanceLevel: 1,
    potentialLevel: 1,
    flightRisk: 'HIGH',
    impactOfLoss: 'LOW',
  });

  const nineBoxMatrix = await TalentSuccessionService.getNineBoxMatrix(tenantId, '2026');
  console.log('✓ 9-Box Grid Matrix Summary:', {
    totalAssessed: nineBoxMatrix.totalAssessed,
    hiPoCount: nineBoxMatrix.hiPoCount,
    riskCount: nineBoxMatrix.riskCount,
  });
  if (nineBoxMatrix.totalAssessed < 2) {
    throw new Error('9-Box matrix assessed count mismatch');
  }

  // 2.5 Create Critical Position Succession Plan & Bench
  console.log('2.5 Creating Critical Position Succession Plan...');
  const plan = await TalentSuccessionService.createSuccessionPlan(tenantId, {
    positionTitle: 'VP of Engineering',
    department: 'Engineering',
    currentIncumbentId: empA.id,
    criticality: 'CRITICAL',
  });
  console.log(`✓ Created succession plan for ${plan.positionTitle} (Current Incumbent: ${empA.firstName})`);

  // Nominate candidate with READY_NOW
  const cand1 = await TalentSuccessionService.addCandidate(tenantId, plan.id, {
    candidateEmployeeId: empB.id,
    readiness: 'READY_NOW',
    ranking: 1,
    notes: 'Primary successor with proven engineering execution.',
  });
  console.log(`✓ Added Successor #1: ${cand1.candidateEmployee.firstName} (${cand1.readiness})`);

  const plans = await TalentSuccessionService.listSuccessionPlans(tenantId, 'Engineering');
  if (plans.length === 0 || plans[0].candidates.length === 0) {
    throw new Error('Succession plans or candidate bench not retrieved');
  }

  // =========================================================================
  // SUITE 3: WORKFORCE PLANNING & HEADCOUNT BUDGET GOVERNANCE
  // =========================================================================
  console.log('\n--- SUITE 3: WORKFORCE PLANNING (HEADCOUNT BUDGET VS ACTUAL) ---');

  // 3.1 Seed Standard Headcount Plans
  console.log('3.1 Seeding standard departmental headcount plans...');
  const hcPlans = await WorkforcePlanningService.seedStandardHeadcountPlans(tenantId, 'FY2026-27');
  console.log(`✓ Seeded ${hcPlans.length} departmental headcount budget plans.`);
  if (hcPlans.length === 0) throw new Error('Headcount plans failed to seed');

  // 3.2 Compute Headcount Budget vs Actual Variance
  console.log('3.2 Calculating Headcount Budget vs Actual analysis...');
  const analysis = await WorkforcePlanningService.getHeadcountBudgetVsActual(tenantId, 'FY2026-27');
  console.log('✓ Workforce Variance Analysis Summary:', {
    totalApproved: analysis.summary.totalApprovedHeadcount,
    totalActual: analysis.summary.totalActualHeadcount,
    totalInFlight: analysis.summary.totalInFlightRequisitions,
    remainingCapacity: analysis.summary.totalRemainingCapacity,
    utilization: `${analysis.summary.overallUtilizationPercent}%`,
  });
  if (analysis.departments.length === 0) throw new Error('Department variance breakdown empty');

  // 3.3 Create Job Requisition within Authorized Budget Cap
  console.log('3.3 Creating Job Requisition within authorized headcount limit...');
  const validReqRes = await WorkforcePlanningService.createJobRequisition(
    tenantId,
    {
      title: 'Senior Distributed Systems Engineer',
      department: 'Engineering',
      numberOfOpenings: 1,
      budgetedMinCtc: 1800000,
      budgetedMaxCtc: 2400000,
      justification: 'Scaling backend platform architecture',
      fiscalYear: 'FY2026-27',
    },
    adminUser.id
  );

  console.log(`✓ Requisition Created: ${validReqRes.requisition.requisitionNumber}, Status: ${validReqRes.requisition.status}, Budget Exceeded: ${validReqRes.requisition.budgetExceeded}`);
  if (validReqRes.requisition.status !== 'APPROVED' || validReqRes.requisition.budgetExceeded) {
    throw new Error('Requisition within budget should be APPROVED without budget exception');
  }

  // 3.4 Create Job Requisition Exceeding Authorized Headcount Limit
  console.log('3.4 Testing Headcount Ceiling Enforcement (Requisitions exceeding approved budget)...');
  // Set Marketing approved headcount to 1
  await WorkforcePlanningService.setHeadcountPlan(tenantId, {
    fiscalYear: 'FY2026-27',
    department: 'Marketing',
    approvedHeadcount: 1,
  });

  // Attempt to open requisition for 3 positions in Marketing
  const exceededReqRes = await WorkforcePlanningService.createJobRequisition(
    tenantId,
    {
      title: 'Performance Marketing Specialist',
      department: 'Marketing',
      numberOfOpenings: 3, // Exceeds cap of 1
      budgetedMinCtc: 800000,
      budgetedMaxCtc: 1200000,
      fiscalYear: 'FY2026-27',
    },
    adminUser.id
  );

  console.log(`✓ Requisition Created: ${exceededReqRes.requisition.requisitionNumber}`);
  console.log(`  Status: ${exceededReqRes.requisition.status}`);
  console.log(`  Budget Exceeded Flag: ${exceededReqRes.requisition.budgetExceeded}`);
  console.log(`  Governance Action: ${exceededReqRes.governanceCheck.actionRequired}`);

  if (
    exceededReqRes.requisition.status !== 'BUDGET_EXCEPTION_REQUIRED' ||
    !exceededReqRes.requisition.budgetExceeded
  ) {
    throw new Error('Requisition exceeding approved budget must require BUDGET_EXCEPTION_REQUIRED');
  }

  // 3.5 Test Exception Approval Workflow
  console.log('3.5 Authorizing budget exception by CFO / HR Leadership...');
  const approvedEx = await WorkforcePlanningService.approveJobRequisition(
    tenantId,
    exceededReqRes.requisition.id,
    adminUser.id,
    'Board approved expansion exception for Q3'
  );
  console.log(`✓ Requisition Exception Approved: Status = ${approvedEx.status}, Notes = ${approvedEx.approvalNotes}`);
  if (approvedEx.status !== 'APPROVED') {
    throw new Error('Requisition exception approval failed');
  }

  console.log('\n======================================================================');
  console.log('--- ALL SUITES PASSED (100% SUCCESS) ---');
  console.log('======================================================================\n');
}

main()
  .catch((err) => {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
