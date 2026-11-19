import prisma from '../shared/prisma';
import { ComplianceService } from '../modules/compliance/compliance.service';
import { TrainingService } from '../modules/training/training.service';

async function main() {
  console.log('\n=============================================================');
  console.log('--- STARTING VERIFICATION: TERMS ACCEPTANCE & MANDATORY TRAINING ---');
  console.log('=============================================================\n');

  // 1. Resolve test tenant and test user/employee
  const tenant = await prisma.tenant.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      users: { where: { role: 'ADMIN' }, take: 1 },
      employees: { where: { status: 'ACTIVE' }, take: 3 },
    },
  });

  if (!tenant) {
    throw new Error('No active tenant found in database.');
  }

  const tenantId = tenant.id;
  const adminUser = tenant.users[0] || (await prisma.user.findFirst({ where: { tenantId } }));
  if (!adminUser) {
    throw new Error('No user found for tenant');
  }

  const totalActiveEmployees = await prisma.employee.count({ where: { tenantId, status: 'ACTIVE' } });
  const testEmployees = await prisma.employee.findMany({ where: { tenantId, status: 'ACTIVE' } });
  if (testEmployees.length === 0) {
    throw new Error('No active employees found for tenant');
  }

  console.log(`[Setup] Tenant: ${tenant.name} (${tenantId})`);
  console.log(`[Setup] Test User: ${adminUser.email} (${adminUser.id})`);
  console.log(`[Setup] Total active employees in tenant: ${totalActiveEmployees}`);

  // Clean previous test run records for reproducibility
  await prisma.complianceAcceptance.deleteMany({ where: { tenantId, userId: adminUser.id } });
  await prisma.complianceDocument.deleteMany({ where: { tenantId } });
  await prisma.trainingAssignment.deleteMany({ where: { tenantId } });
  await prisma.trainingCourse.deleteMany({ where: { tenantId } });

  console.log('[Setup] Cleaned previous test run compliance & training artifacts.');

  // =========================================================================
  // SUITE 1: TERMS & PRIVACY ACCEPTANCE TRACKING (ToS, Privacy, DPA, SLA)
  // =========================================================================
  console.log('\n--- SUITE 1: TERMS & PRIVACY ACCEPTANCE TRACKING ---');

  // 1.1 Seed standard versioned legal documents
  console.log('1.1 Seeding standard versioned legal documents (v1.0)...');
  const seededDocs = await ComplianceService.seedDefaultDocuments(tenantId, adminUser.id);
  console.log(`✓ Seeded ${seededDocs.length} legal documents:`, seededDocs.map((d: any) => `${d.type} (v${d.version})`));
  if (seededDocs.length < 4) {
    throw new Error(`Expected at least 4 seeded legal documents, got ${seededDocs.length}`);
  }

  // 1.2 Verify listDocuments returns documents with acceptance state
  console.log('1.2 Checking document list with user acceptance status...');
  const docList = await ComplianceService.listDocuments(tenantId, adminUser.id);
  const unaccepted = docList.filter((d: any) => !d.isAccepted);
  console.log(`✓ User has ${unaccepted.length} unaccepted documents out of ${docList.length} total.`);
  if (unaccepted.length !== docList.length) {
    throw new Error('Initially all documents should be unaccepted for user.');
  }

  // 1.3 Verify getPendingAcceptances returns active mandatory agreements
  console.log('1.3 Verifying pending mandatory agreements...');
  const pendingBefore = await ComplianceService.getPendingAcceptances(tenantId, adminUser.id);
  console.log(`✓ Pending mandatory agreements: ${pendingBefore.length} (${pendingBefore.map((d: any) => d.type).join(', ')})`);
  const mandatoryCount = seededDocs.filter((d: any) => d.isMandatory).length;
  if (pendingBefore.length !== mandatoryCount) {
    throw new Error(`Expected ${mandatoryCount} mandatory agreements pending, found ${pendingBefore.length}`);
  }

  // 1.4 Accept a single document (ToS) and verify IP & timestamp logging
  console.log('1.4 Accepting ToS agreement with client IP and timestamp logging...');
  const tosDoc = pendingBefore.find((d: any) => d.type === 'TOS');
  if (!tosDoc) throw new Error('ToS document missing');

  const testIp = '103.45.12.89';
  const testAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0';
  const acceptResult = await ComplianceService.acceptDocument({
    tenantId,
    userId: adminUser.id,
    employeeId: testEmployees[0]?.id,
    documentId: tosDoc.id,
    ipAddress: testIp,
    userAgent: testAgent,
    metadata: { consentMethod: 'CLICKWRAP_CHECKBOX' },
  });

  console.log('✓ Acceptance recorded:', {
    documentId: acceptResult.acceptance.documentId,
    version: acceptResult.acceptance.versionAccepted,
    ipAddress: acceptResult.acceptance.ipAddress,
    acceptedAt: acceptResult.acceptance.acceptedAt,
  });

  if (acceptResult.acceptance.versionAccepted !== '1.0' || acceptResult.acceptance.ipAddress !== testIp) {
    throw new Error('Accepted document details do not match input parameters');
  }

  // 1.5 Verify idempotent duplicate acceptance returns alreadyAccepted: true
  console.log('1.5 Testing idempotent duplicate acceptance...');
  const duplicateResult = await ComplianceService.acceptDocument({
    tenantId,
    userId: adminUser.id,
    documentId: tosDoc.id,
    ipAddress: testIp,
  });
  console.log(`✓ Idempotency verified: alreadyAccepted = ${duplicateResult.alreadyAccepted}`);
  if (!duplicateResult.alreadyAccepted) {
    throw new Error('Duplicate acceptance should return alreadyAccepted: true');
  }

  // 1.6 Accept all remaining pending agreements
  console.log('1.6 Testing acceptAllPending for remaining documents...');
  const acceptAllRes = await ComplianceService.acceptAllPending({
    tenantId,
    userId: adminUser.id,
    ipAddress: testIp,
  });
  console.log(`✓ Accepted remaining ${acceptAllRes.count} documents.`);
  const pendingAfterAll = await ComplianceService.getPendingAcceptances(tenantId, adminUser.id);
  console.log(`✓ Pending documents after bulk accept: ${pendingAfterAll.length}`);
  if (pendingAfterAll.length !== 0) {
    throw new Error(`Expected 0 pending documents after bulk accept, got ${pendingAfterAll.length}`);
  }

  // 1.7 Version Bump & Re-Acceptance Enforcement
  console.log('1.7 Publishing new version (v2.0) of ToS to test re-acceptance enforcement...');
  const v2Doc = await ComplianceService.publishNewVersion(
    tenantId,
    tosDoc.id,
    {
      newVersion: '2.0',
      title: 'Master Terms of Service (ToS) - 2026 Revision',
      summary: 'Updated terms with enhanced data governance and IT Act compliance clauses.',
    },
    adminUser.id
  );
  console.log(`✓ Published new active version: ${v2Doc.title} (v${v2Doc.version})`);

  // Verify that the user now has pending acceptance again for the new version
  const pendingAfterBump = await ComplianceService.getPendingAcceptances(tenantId, adminUser.id);
  console.log(`✓ Pending mandatory documents after version bump: ${pendingAfterBump.length}`);
  const pendingV2 = pendingAfterBump.find((d: any) => d.id === v2Doc.id && d.version === '2.0');
  if (!pendingV2) {
    throw new Error('Expected v2.0 document to appear in pending acceptances for user');
  }
  console.log(`✓ Re-acceptance successfully enforced for new version ${pendingV2.version}!`);

  // 1.8 Acceptance Audit Trail & Overview
  console.log('1.8 Verifying statutory acceptance audit trail...');
  const auditTrail = await ComplianceService.getAcceptanceAuditTrail(tenantId, {});
  console.log(`✓ Audit trail records count: ${auditTrail.total}`);
  if (auditTrail.total < 3) {
    throw new Error(`Expected at least 3 audit entries, found ${auditTrail.total}`);
  }

  const overview = await ComplianceService.getComplianceOverview(tenantId);
  console.log(`✓ Compliance Overview calculated:`, {
    totalUsers: overview.totalUsers,
    mandatoryDocsCount: overview.mandatoryDocumentsCount,
    overallRate: `${overview.overallComplianceRatePercent}%`,
  });

  // =========================================================================
  // SUITE 2: MANDATORY TRAINING (POSH ACT, SAFETY DRILL, DPDP)
  // =========================================================================
  console.log('\n--- SUITE 2: MANDATORY TRAINING & STATUTORY COURSES ---');

  // 2.1 Seed standard statutory courses
  console.log('2.1 Seeding standard courses (POSH, Safety, DPDP, Ethics)...');
  const seededCourses = await TrainingService.seedStandardCourses(tenantId);
  console.log(`✓ Seeded ${seededCourses.length} courses:`, seededCourses.map((c: any) => `${c.code} [${c.category}]`));
  if (seededCourses.length < 4) {
    throw new Error(`Expected 4 standard courses, got ${seededCourses.length}`);
  }

  // 2.2 Assign POSH course to all active employees
  const poshCourse = seededCourses.find((c: any) => c.category === 'POSH');
  if (!poshCourse) throw new Error('POSH course not found');

  console.log(`2.2 Assigning ${poshCourse.title} to all active employees...`);
  const assignResult = await TrainingService.assignCourse(tenantId, {
    courseId: poshCourse.id,
    targetAll: true,
    dueInDays: 30,
    notes: 'Mandatory annual statutory training per POSH Act 2013',
  });

  console.log(`✓ Assigned course to ${assignResult.assignedCount} employees (Due: ${assignResult.dueDate.toISOString()})`);
  if (assignResult.assignedCount !== testEmployees.length) {
    throw new Error(`Expected ${testEmployees.length} employees assigned, got ${assignResult.assignedCount}`);
  }

  // 2.3 Verify duplicate assignment prevention
  console.log('2.3 Testing duplicate assignment prevention...');
  const dupAssign = await TrainingService.assignCourse(tenantId, {
    courseId: poshCourse.id,
    targetAll: true,
  });
  console.log(`✓ Duplicate check: assignedCount = ${dupAssign.assignedCount}, alreadyAssigned = ${dupAssign.alreadyAssignedCount}`);
  if (dupAssign.assignedCount !== 0 || dupAssign.alreadyAssignedCount !== testEmployees.length) {
    throw new Error('Duplicate assignment did not correctly skip already assigned employees');
  }

  // 2.4 Verify employee assignments listing
  const sampleEmp = testEmployees[0];
  console.log(`2.4 Fetching assignments for employee ${sampleEmp.firstName} ${sampleEmp.lastName}...`);
  const empAssignments = await TrainingService.getEmployeeAssignments(tenantId, sampleEmp.id);
  console.log(`✓ Employee has ${empAssignments.length} assignment(s). Status: ${empAssignments[0]?.status}`);
  if (empAssignments.length === 0 || empAssignments[0].status !== 'NOT_STARTED') {
    throw new Error('Employee assignment missing or status incorrect');
  }

  // 2.5 Update progress: Start course and complete assessment
  const targetAssignment = empAssignments[0];
  console.log('2.5 Updating progress to IN_PROGRESS...');
  const inProgressRes = await TrainingService.updateProgress({
    tenantId,
    assignmentId: targetAssignment.id,
    status: 'IN_PROGRESS',
  });
  console.log(`✓ Assignment status updated: ${inProgressRes.status}`);

  console.log('2.5 Completing course with passing score (90%)...');
  const completedRes = await TrainingService.updateProgress({
    tenantId,
    assignmentId: targetAssignment.id,
    status: 'COMPLETED',
    score: 90,
    notes: 'Section 19 assessment successfully passed with 90%',
  });
  console.log('✓ Assignment completed:', {
    status: completedRes.status,
    score: completedRes.score,
    completedAt: completedRes.completedAt,
    certificateUrl: completedRes.certificateUrl,
  });
  if (completedRes.status !== 'COMPLETED' || completedRes.score !== 90 || !completedRes.certificateUrl) {
    throw new Error('Course completion record or certificate URL failed to update');
  }

  // 2.6 Test Automated Reminders Dispatch
  console.log('2.6 Simulating upcoming/overdue assignment to test automated reminders...');
  // Assign Fire Safety course and set due date to tomorrow
  const safetyCourse = seededCourses.find((c: any) => c.category === 'SAFETY');
  if (!safetyCourse) throw new Error('Safety course not found');

  const secondEmp = testEmployees[1] || testEmployees[0];
  await TrainingService.assignCourse(tenantId, {
    courseId: safetyCourse.id,
    employeeIds: [secondEmp.id],
    dueInDays: 2, // Within 7-day reminder threshold
  });

  const reminderResult = await TrainingService.sendReminders(tenantId);
  console.log(`✓ Reminders dispatched: count = ${reminderResult.remindersSent}`);
  console.log(`✓ Reminded employee details:`, reminderResult.remindedEmployees.map((r: any) => `${r.employeeName}: ${r.courseCode}`));
  if (reminderResult.remindersSent < 1) {
    throw new Error('Expected at least 1 reminder to be dispatched');
  }

  // 2.7 Verify Statutory Compliance Dashboard
  console.log('2.7 Verifying tenant training compliance dashboard...');
  const trainingDashboard = await TrainingService.getComplianceDashboard(tenantId);
  console.log(`✓ Total assignments: ${trainingDashboard.totalAssignments}`);
  console.log(`✓ Completed assignments: ${trainingDashboard.completedAssignments}`);
  console.log(`✓ POSH statutory compliance:`, trainingDashboard.statutoryCompliance.posh);
  console.log(`✓ Safety compliance:`, trainingDashboard.statutoryCompliance.safety);

  if (trainingDashboard.totalAssignments < 2) {
    throw new Error('Dashboard assignments count mismatch');
  }

  console.log('\n=============================================================');
  console.log('--- ALL SUITES PASSED (100% SUCCESS) ---');
  console.log('=============================================================\n');
}

main()
  .catch((err) => {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
