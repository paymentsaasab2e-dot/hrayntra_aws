const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const PLATFORM_PERMISSIONS = {
  tabs: { platformConsole: true },
  actions: { platform_manage_tenants: true },
};

const FULL_PERMISSIONS = {
  tabs: {
    dashboard: true, employees: true, onboarding: true, tasks: true, attendance: true,
    leave: true, timeOff: true, assets: true, performance: true, approvals: true, documents: true,
    reports: true, settings: true, locations: true, fieldVisits: true, userManagement: true, orgStructure: true,
  },
  actions: {
    employees_create: true, employees_delete: true, employees_edit: true,
    tasks_create: true, tasks_delete: true, tasks_approve: true, tasks_submit: true,
    leaves_apply: true, leaves_approve: true, holidays_manage: true,
    attendance_punch_self: true, attendance_punch_hr: true, attendance_approve_late: true,
    attendance_punch_remote_self: true,
    assets_manage: true, documents_manage: true, performance_manage: true,
    reports_view: true, settings_edit: true, users_manage: true, locations_manage: true,
    field_visits_manage: true, org_manage: true,
  },
};

const TENANT_ID = '6a08259b752e15d6a06ec490';
const POLICY_DOC_ID = '6a08259b752e15d6a06ec4a0';
const POLICY_VERSION_ID = '6a08259b752e15d6a06ec4a1';

const DEFAULT_HR_RULES = {
  leave: {
    annualCasualLeave: 15,
    annualSickLeave: 12,
    annualEarnedLeave: 12,
    carryForwardLimit: 5,
    leaveAdvanceNoticeDays: 3,
    maxConsecutiveLeaveDays: 15,
    autoApproveUnderDays: 2,
  },
  attendance: {
    workStartTime: '09:30',
    workEndTime: '18:30',
    gracePeriodMinutes: 15,
    lateMarkAfterMinutes: 30,
    halfDayThresholdHours: 4,
    allowRemotePunch: true,
    requireGeofence: true,
  },
  exit: {
    standardNoticeDays: 30,
    probationNoticeDays: 15,
    probationMonths: 3,
    allowLeaveDuringNotice: false,
    requireExitInterview: true,
  },
};
const HQ_ID = '6a08259b752e15d6a06ec491';
const DIV_ENG_ID = '6a08259b752e15d6a06ec492';
const DIV_FIN_ID = '6a08259b752e15d6a06ec493';
const SITE_PUNE_ID = '6a08259b752e15d6a06ec494';
const SITE_MUMBAI_ID = '6a08259b752e15d6a06ec495';
const LOC_CLIENT_HINJ_ID = '6a08259b752e15d6a06ec496';
const LOC_CLIENT_BANER_ID = '6a08259b752e15d6a06ec497';
const LOC_CLIENT_ANDHERI_ID = '6a08259b752e15d6a06ec498';

function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function main() {
  // 1. Talent & Succession Planning (must be deleted before Employee & SuccessionPlan)
  if (prisma.successionCandidate) await prisma.successionCandidate.deleteMany({});
  if (prisma.successionPlan) await prisma.successionPlan.deleteMany({});
  if (prisma.employeeSkill) await prisma.employeeSkill.deleteMany({});
  if (prisma.skillDefinition) await prisma.skillDefinition.deleteMany({});
  if (prisma.talentAssessment) await prisma.talentAssessment.deleteMany({});

  // 2. Compensation & Increment Cycles (must be deleted before Employee & CompensationCycle)
  if (prisma.employeeIncrementRecommendation) await prisma.employeeIncrementRecommendation.deleteMany({});
  if (prisma.departmentBudgetPool) await prisma.departmentBudgetPool.deleteMany({});
  if (prisma.compensationCycle) await prisma.compensationCycle.deleteMany({});

  // 3. Workforce Planning & Job Requisitions
  if (prisma.jobRequisition) await prisma.jobRequisition.deleteMany({});
  if (prisma.headcountPlan) await prisma.headcountPlan.deleteMany({});

  // 4. Training & Compliance (must be deleted before Employee & User)
  if (prisma.trainingAssignment) await prisma.trainingAssignment.deleteMany({});
  if (prisma.trainingCourse) await prisma.trainingCourse.deleteMany({});
  if (prisma.complianceAcceptance) await prisma.complianceAcceptance.deleteMany({});
  if (prisma.complianceDocument) await prisma.complianceDocument.deleteMany({});

  // 5. Leave Extensions, Attendance Import & Celebrations
  if (prisma.leaveEncashmentRequest) await prisma.leaveEncashmentRequest.deleteMany({});
  if (prisma.leaveAccrualLedger) await prisma.leaveAccrualLedger.deleteMany({});
  if (prisma.leaveAccrualPlan) await prisma.leaveAccrualPlan.deleteMany({});
  if (prisma.lopReversalAdjustment) await prisma.lopReversalAdjustment.deleteMany({});
  if (prisma.attendanceImportBatch) await prisma.attendanceImportBatch.deleteMany({});
  if (prisma.approvalDelegation) await prisma.approvalDelegation.deleteMany({});
  if (prisma.hrTemplate) await prisma.hrTemplate.deleteMany({});
  if (prisma.celebrationWish) await prisma.celebrationWish.deleteMany({});

  // 6. Core operational entities
  await prisma.policyAcknowledgment.deleteMany({});
  await prisma.policyVersion.deleteMany({});
  await prisma.policyDocument.deleteMany({});
  await prisma.separationRequest.deleteMany({});
  await prisma.fieldVisitLocationPing.deleteMany({});
  await prisma.fieldVisitAssignment.deleteMany({});
  await prisma.approvalRequest.deleteMany({});
  await prisma.leave.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.assetAllocation.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.performanceReview.deleteMany({});
  await prisma.employeeCompensation.deleteMany({});
  await prisma.payrollComplianceProfile.deleteMany({});
  await prisma.onboardingHire.deleteMany({});
  await prisma.asset.deleteMany({});
  if (prisma.employmentHistory) await prisma.employmentHistory.deleteMany({});
  if (prisma.employeeChangeRequest) await prisma.employeeChangeRequest.deleteMany({});
  if (prisma.employeeEmergencyContact) await prisma.employeeEmergencyContact.deleteMany({});
  if (prisma.employeeDependent) await prisma.employeeDependent.deleteMany({});
  if (prisma.employeeNominee) await prisma.employeeNominee.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.workLocation.deleteMany({});
  await prisma.user.deleteMany({});
  if (prisma.customFieldDefinition) await prisma.customFieldDefinition.deleteMany({});
  while (await prisma.orgUnit.count() > 0) {
    const leaves = await prisma.orgUnit.findMany({
      where: { children: { none: {} } },
      select: { id: true },
    });
    if (leaves.length === 0) break;
    await prisma.orgUnit.deleteMany({ where: { id: { in: leaves.map((l) => l.id) } } });
  }
  await prisma.tenantApprovalLevel.deleteMany({});
  await prisma.tenantHierarchyLevel.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.holiday.deleteMany({});

  console.log('Cleared database successfully');

  // Platform owner (software HQ — no tenant)
  await prisma.user.create({
    data: {
      id: '6a08259b752e15d6a06ec469',
      email: 'platform.owner@hrms.local',
      password: await bcrypt.hash('PlatformOwner@123', 10),
      role: 'PLATFORM_OWNER',
      displayName: 'Platform Owner',
      permissions: PLATFORM_PERMISSIONS,
      status: 'ACTIVE',
      tenantId: null,
      orgUnitId: null,
    },
  });
  console.log('Seeded platform owner');

  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: 'Hryantra',
      slug: 'hryantra',
      status: 'ACTIVE',
      packageKey: 'ENTERPRISE',
      maxUsers: 9999,
      hierarchyLevels: {
        create: [
          { levelOrder: 1, code: 'hq', displayName: 'Headquarters', isLeaf: false },
          { levelOrder: 2, code: 'division', displayName: 'Division', isLeaf: false },
          { levelOrder: 3, code: 'site', displayName: 'Site', isLeaf: true },
        ],
      },
      approvalLevels: {
        create: [
          { level: 1, displayName: 'Site Supervisor' },
          { level: 2, displayName: 'Division Manager' },
          { level: 3, displayName: 'HQ Admin' },
        ],
      },
    },
  });

  const PAYROLL_PROFILES = [
    {
      name: 'India — Standard CTC',
      country: 'India',
      currencyCode: 'INR',
      anchorType: 'ANNUAL_CTC',
      isDefault: true,
      components: [
        { code: 'BASIC', name: 'Basic Salary', section: 'EARNING', calcType: 'PERCENT_OF_ANCHOR', value: 40, baseRef: 'ANCHOR', order: 1 },
        { code: 'HRA', name: 'House Rent Allowance', section: 'EARNING', calcType: 'PERCENT_OF_COMPONENT', value: 40, baseRef: 'BASIC', order: 2 },
        { code: 'CONVEYANCE', name: 'Conveyance', section: 'EARNING', calcType: 'FIXED', value: 1600, order: 3 },
        { code: 'SPECIAL', name: 'Special Allowance', section: 'EARNING', calcType: 'BALANCE_OF_GROSS', value: 0, order: 4 },
        { code: 'PF_EE', name: 'Employee PF', section: 'DEDUCTION', calcType: 'PERCENT_OF_COMPONENT', value: 12, baseRef: 'BASIC', cap: 1800, order: 5 },
        { code: 'PF_ER', name: 'Employer PF', section: 'EMPLOYER_CONTRIBUTION', calcType: 'PERCENT_OF_COMPONENT', value: 12, baseRef: 'BASIC', cap: 1800, order: 6 },
        { code: 'TDS', name: 'TDS (estimated)', section: 'DEDUCTION', calcType: 'PERCENT_OF_GROSS', value: 10, order: 7 },
      ],
    },
    {
      name: 'UAE — Standard Package',
      country: 'UAE',
      currencyCode: 'AED',
      anchorType: 'ANNUAL_CTC',
      isDefault: true,
      components: [
        { code: 'BASIC', name: 'Basic Salary', section: 'EARNING', calcType: 'PERCENT_OF_ANCHOR', value: 60, baseRef: 'ANCHOR', order: 1 },
        { code: 'HOUSING', name: 'Housing Allowance', section: 'EARNING', calcType: 'PERCENT_OF_COMPONENT', value: 25, baseRef: 'BASIC', order: 2 },
        { code: 'SPECIAL', name: 'Other Allowance', section: 'EARNING', calcType: 'BALANCE_OF_GROSS', value: 0, order: 3 },
        { code: 'GPSSA_EE', name: 'GPSSA Employee', section: 'DEDUCTION', calcType: 'PERCENT_OF_COMPONENT', value: 5, baseRef: 'BASIC', order: 4 },
        { code: 'GPSSA_ER', name: 'GPSSA Employer', section: 'EMPLOYER_CONTRIBUTION', calcType: 'PERCENT_OF_COMPONENT', value: 12.5, baseRef: 'BASIC', order: 5 },
      ],
    },
  ];

  for (const profile of PAYROLL_PROFILES) {
    await prisma.payrollComplianceProfile.create({
      data: { tenantId: TENANT_ID, ...profile },
    });
  }
  console.log('Seeded payroll compliance profiles');

  await prisma.orgUnit.create({
    data: {
      id: HQ_ID,
      tenantId: TENANT_ID,
      parentId: null,
      levelOrder: 1,
      name: 'Yantra HQ',
      path: `/${TENANT_ID}/${HQ_ID}/`,
      isLeaf: false,
      status: 'ACTIVE',
    },
  });

  await prisma.orgUnit.createMany({
    data: [
      {
        id: DIV_ENG_ID,
        tenantId: TENANT_ID,
        parentId: HQ_ID,
        levelOrder: 2,
        name: 'Engineering',
        path: `/${TENANT_ID}/${HQ_ID}/${DIV_ENG_ID}/`,
        isLeaf: false,
        status: 'ACTIVE',
      },
      {
        id: DIV_FIN_ID,
        tenantId: TENANT_ID,
        parentId: HQ_ID,
        levelOrder: 2,
        name: 'Finance & Operations',
        path: `/${TENANT_ID}/${HQ_ID}/${DIV_FIN_ID}/`,
        isLeaf: false,
        status: 'ACTIVE',
      },
      {
        id: SITE_PUNE_ID,
        tenantId: TENANT_ID,
        parentId: DIV_ENG_ID,
        levelOrder: 3,
        name: 'Pune Office',
        path: `/${TENANT_ID}/${HQ_ID}/${DIV_ENG_ID}/${SITE_PUNE_ID}/`,
        isLeaf: true,
        status: 'ACTIVE',
      },
      {
        id: SITE_MUMBAI_ID,
        tenantId: TENANT_ID,
        parentId: DIV_FIN_ID,
        levelOrder: 3,
        name: 'Mumbai Office',
        path: `/${TENANT_ID}/${HQ_ID}/${DIV_FIN_ID}/${SITE_MUMBAI_ID}/`,
        isLeaf: true,
        status: 'ACTIVE',
      },
    ],
  });
  console.log('Seeded tenant Hryantra and org structure');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = [
    {
      id: '6a08259b752e15d6a06ec470',
      email: 'superadmin@hrms.local',
      password: await bcrypt.hash('SuperAdmin@123', 10),
      role: 'ADMIN',
      displayName: 'Hryantra Tenant Admin',
      permissions: FULL_PERMISSIONS,
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      orgUnitId: HQ_ID,
    },
    {
      id: '6a08259b752e15d6a06ec471',
      email: 'sarah.connor@hryantra.com',
      password: hashedPassword,
      role: 'HR',
      displayName: 'Sarah Connor',
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      orgUnitId: HQ_ID,
    },
    {
      id: '6a08259b752e15d6a06ec472',
      email: 'michael.c@hryantra.com',
      password: hashedPassword,
      role: 'MANAGER',
      displayName: 'Michael Chang',
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      orgUnitId: DIV_ENG_ID,
    },
    {
      id: '6a08259b752e15d6a06ec473',
      email: 'david.wallace@hryantra.com',
      password: hashedPassword,
      role: 'EMPLOYEE',
      displayName: 'David Wallace',
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      orgUnitId: SITE_MUMBAI_ID,
    },
    {
      id: '6a08259b752e15d6a06ec474',
      email: 'priya.sharma@hryantra.com',
      password: hashedPassword,
      role: 'EMPLOYEE',
      displayName: 'Priya Sharma',
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      orgUnitId: SITE_PUNE_ID,
    },
  ];

  for (const u of users) {
    await prisma.user.create({ data: u });
  }
  console.log('Seeded tenant users');

  const locations = [
    {
      id: '6a08259b752e15d6a06ec480',
      name: 'Yantra HQ — Pune',
      address: 'Hinjawadi Phase 1, Pune',
      lat: 18.5912,
      lng: 73.7389,
      radiusMeters: 150,
      isActive: true,
      usage: 'BOTH',
      orgUnitId: SITE_PUNE_ID,
    },
    {
      id: '6a08259b752e15d6a06ec481',
      name: 'Yantra Branch — Mumbai',
      address: 'Andheri East, Mumbai',
      lat: 19.1136,
      lng: 72.8697,
      radiusMeters: 100,
      isActive: true,
      usage: 'BOTH',
      orgUnitId: SITE_MUMBAI_ID,
    },
    {
      id: LOC_CLIENT_HINJ_ID,
      name: 'Client Site — Hinjawadi',
      address: 'Rajiv Gandhi Infotech Park, Pune',
      lat: 18.5822,
      lng: 73.7281,
      radiusMeters: 120,
      isActive: true,
      usage: 'VISITS',
      orgUnitId: SITE_PUNE_ID,
    },
    {
      id: LOC_CLIENT_BANER_ID,
      name: 'Client Site — Baner',
      address: 'Baner Road, Pune',
      lat: 18.559,
      lng: 73.7868,
      radiusMeters: 100,
      isActive: true,
      usage: 'VISITS',
      orgUnitId: SITE_PUNE_ID,
    },
    {
      id: LOC_CLIENT_ANDHERI_ID,
      name: 'Client Site — Andheri',
      address: 'MIDC Andheri, Mumbai',
      lat: 19.1176,
      lng: 72.856,
      radiusMeters: 100,
      isActive: true,
      usage: 'VISITS',
      orgUnitId: SITE_MUMBAI_ID,
    },
  ];

  for (const loc of locations) {
    await prisma.workLocation.create({ data: loc });
  }

  const employees = [
    {
      id: '6a08259b752e15d6a06ec477',
      employeeId: 'EMP-001',
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 'sarah.connor@hryantra.com',
      designation: 'Lead Engineer',
      department: 'Engineering',
      joiningDate: new Date('2020-01-01'),
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      userId: '6a08259b752e15d6a06ec471',
      locationId: '6a08259b752e15d6a06ec480',
      orgUnitId: HQ_ID,
    },
    {
      id: '6a08259b752e15d6a06ec478',
      employeeId: 'EMP-002',
      firstName: 'Michael',
      lastName: 'Chang',
      email: 'michael.c@hryantra.com',
      designation: 'Product Manager',
      department: 'Product',
      joiningDate: new Date('2021-02-15'),
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      userId: '6a08259b752e15d6a06ec472',
      locationId: '6a08259b752e15d6a06ec480',
      orgUnitId: DIV_ENG_ID,
    },
    {
      id: '6a08259b752e15d6a06ec479',
      employeeId: 'EMP-003',
      firstName: 'David',
      lastName: 'Wallace',
      email: 'david.wallace@hryantra.com',
      designation: 'CFO',
      department: 'Finance',
      joiningDate: new Date('2019-05-10'),
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      userId: '6a08259b752e15d6a06ec473',
      locationId: '6a08259b752e15d6a06ec481',
      orgUnitId: SITE_MUMBAI_ID,
    },
    {
      id: '6a08259b752e15d6a06ec475',
      employeeId: 'EMP-004',
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.sharma@hryantra.com',
      designation: 'Software Engineer',
      department: 'Engineering',
      joiningDate: new Date('2022-08-01'),
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      userId: '6a08259b752e15d6a06ec474',
      locationId: '6a08259b752e15d6a06ec480',
      orgUnitId: SITE_PUNE_ID,
    },
  ];

  for (const emp of employees) {
    await prisma.employee.create({ data: emp });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = localDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // ── Attendance demo ──
  await prisma.attendance.createMany({
    data: [
      {
        employeeId: '6a08259b752e15d6a06ec475',
        date: today,
        checkInTime: new Date(today.getTime() + 9 * 60 * 60 * 1000 + 15 * 60 * 1000),
        status: 'PRESENT',
        lat: 18.5912,
        lng: 73.7389,
        distanceMeters: 42,
        punchMode: 'office',
        isActive: true,
      },
      {
        employeeId: '6a08259b752e15d6a06ec478',
        date: today,
        checkInTime: new Date(today.getTime() + 9 * 60 * 60 * 1000 + 45 * 60 * 1000),
        checkOutTime: new Date(today.getTime() + 18 * 60 * 60 * 1000),
        status: 'LATE',
        lat: 18.591,
        lng: 73.739,
        distanceMeters: 55,
        punchMode: 'office',
        isActive: false,
      },
      {
        employeeId: '6a08259b752e15d6a06ec479',
        date: yesterday,
        checkInTime: new Date(yesterday.getTime() + 10 * 60 * 60 * 1000),
        checkOutTime: new Date(yesterday.getTime() + 18 * 60 * 60 * 1000),
        status: 'PRESENT',
        lat: 19.1136,
        lng: 72.8697,
        punchMode: 'remote',
        isActive: false,
      },
    ],
  });

  // ── Leave demo ──
  await prisma.leave.createMany({
    data: [
      {
        employeeId: '6a08259b752e15d6a06ec479',
        type: 'CASUAL',
        startDate: new Date(today.getTime() + 7 * 86400000),
        endDate: new Date(today.getTime() + 8 * 86400000),
        reason: 'Family function',
        status: 'PENDING',
      },
      {
        employeeId: '6a08259b752e15d6a06ec475',
        type: 'SICK',
        startDate: yesterday,
        endDate: yesterday,
        reason: 'Medical appointment',
        status: 'APPROVED',
        processedAt: new Date(),
      },
    ],
  });

  // ── Project + tasks ──
  await prisma.project.create({
    data: {
      id: '6a08259b752e15d6a06ec4b0',
      name: 'HRMS Rollout',
      description: 'Phase 3 HRMS deployment',
      status: 'ACTIVE',
    },
  });

  await prisma.task.createMany({
    data: [
      {
        title: 'Complete onboarding checklist',
        description: 'Finish hardware and policy tasks for new hire',
        assignedTo: '6a08259b752e15d6a06ec475',
        assigneeIds: ['6a08259b752e15d6a06ec475'],
        projectId: '6a08259b752e15d6a06ec4b0',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        workDonePercent: 40,
        dueDate: new Date(today.getTime() + 3 * 86400000),
      },
      {
        title: 'Review Q2 performance metrics',
        assignedTo: '6a08259b752e15d6a06ec478',
        assigneeIds: ['6a08259b752e15d6a06ec478'],
        projectId: '6a08259b752e15d6a06ec4b0',
        status: 'TODO',
        priority: 'MEDIUM',
        dueDate: new Date(today.getTime() + 5 * 86400000),
      },
    ],
  });

  // ── Assets ──
  await prisma.asset.create({
    data: {
      id: '6a08259b752e15d6a06ec4c0',
      name: 'MacBook Pro 14"',
      type: 'Laptop',
      serialNumber: 'MBP-2024-0042',
      brand: 'Apple',
      model: 'M3 Pro',
      status: 'Assigned',
      condition: 'Good',
      purchasedOn: '2024-01-15',
      warrantyUntil: '2027-01-15',
    },
  });

  await prisma.assetAllocation.create({
    data: {
      assetId: '6a08259b752e15d6a06ec4c0',
      employeeId: '6a08259b752e15d6a06ec475',
      issuedOn: '2024-02-01',
      conditionOnIssue: 'New',
      issuedBy: 'Sarah Connor',
      status: 'Active',
    },
  });

  // ── Onboarding hire ──
  await prisma.onboardingHire.create({
    data: {
      tenantId: TENANT_ID,
      name: 'Arjun Mehta',
      role: 'Field Engineer',
      department: 'Engineering',
      email: 'arjun.mehta@hryantra.com',
      joinDate: todayKey,
      status: 'In Progress',
      progress: 33,
      tasks: [
        { label: 'Salary & CTC Structure Assigned', done: true },
        { label: 'Hardware Allocation', done: false },
        { label: 'Policy Documentation Signature', done: false },
      ],
    },
  });

  // ── Performance review ──
  await prisma.performanceReview.create({
    data: {
      employeeId: '6a08259b752e15d6a06ec475',
      cycle: '2026 H1',
      cycleType: 'Half-Yearly',
      metrics: {
        taskScore: 82,
        attendanceScore: 91,
        leaveScore: 88,
        managerScore: 85,
        finalScore: 86.5,
        category: 'Strong Performer',
      },
      insights: {
        strengths: ['Consistent delivery', 'Good attendance'],
        weaknesses: ['Could improve documentation'],
        recommendations: ['Lead one cross-team initiative in Q3'],
      },
      status: 'Pending Self Review',
    },
  });

  // ── Document ──
  await prisma.document.create({
    data: {
      name: 'Offer Letter — Priya Sharma.pdf',
      type: 'PDF',
      category: 'Employment',
      employeeId: '6a08259b752e15d6a06ec475',
      uploadedBy: 'Sarah Connor',
      size: '245 KB',
      url: '/uploads/demo/offer-letter.pdf',
      tags: ['onboarding', 'employment'],
    },
  });

  // ── Field tracking roster (today) ──
  await prisma.fieldVisitAssignment.createMany({
    data: [
      {
        dateKey: todayKey,
        employeeId: '6a08259b752e15d6a06ec475',
        locationId: LOC_CLIENT_HINJ_ID,
        sequence: 0,
        plannedTime: '10:00',
        status: 'VERIFIED',
        verifiedAt: new Date(today.getTime() + 10 * 60 * 60 * 1000),
        verifyLat: 18.5822,
        verifyLng: 73.7281,
        distanceMeters: 18,
      },
      {
        dateKey: todayKey,
        employeeId: '6a08259b752e15d6a06ec475',
        locationId: LOC_CLIENT_BANER_ID,
        sequence: 1,
        plannedTime: '14:00',
        status: 'PENDING',
      },
      {
        dateKey: todayKey,
        employeeId: '6a08259b752e15d6a06ec479',
        locationId: LOC_CLIENT_ANDHERI_ID,
        sequence: 0,
        plannedTime: '11:30',
        status: 'PENDING',
      },
    ],
  });

  await prisma.fieldVisitLocationPing.create({
    data: {
      employeeId: '6a08259b752e15d6a06ec475',
      lat: 18.5795,
      lng: 73.752,
      recordedAt: new Date(),
    },
  });

  console.log('Seeded demo data: attendance, leave, tasks, assets, onboarding, tracking roster');

  const holidays = [
    { name: "New Year's Day", date: new Date('2026-01-01'), type: 'Public Holiday' },
    { name: 'Republic Day', date: new Date('2026-01-26'), type: 'Public Holiday' },
  ];

  for (const holiday of holidays) {
    await prisma.holiday.create({ data: holiday });
  }

  await prisma.policyDocument.create({
    data: {
      id: POLICY_DOC_ID,
      tenantId: TENANT_ID,
      title: 'Hryantra Leave & Attendance Policy 2026',
      category: 'LEAVE_ATTENDANCE',
      draftRules: DEFAULT_HR_RULES,
      status: 'PUBLISHED',
      uploadedByUserId: '6a08259b752e15d6a06ec470',
      extractedText: 'Sample policy: employees must apply leave 3 days in advance. Standard office hours 09:30-18:30. Notice period 30 days for confirmed employees.',
    },
  });

  await prisma.policyVersion.create({
    data: {
      id: POLICY_VERSION_ID,
      policyDocumentId: POLICY_DOC_ID,
      tenantId: TENANT_ID,
      version: 1,
      effectiveFrom: new Date(),
      publishedAt: new Date(),
      publishedByUserId: '6a08259b752e15d6a06ec470',
      rules: DEFAULT_HR_RULES,
      isActive: true,
    },
  });

  console.log('Seeded tenant HR policy v1');
  console.log('Seed complete.');
  console.log('Platform owner: platform.owner@hrms.local / PlatformOwner@123');
  console.log('Hryantra tenant admin: superadmin@hrms.local / SuperAdmin@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
