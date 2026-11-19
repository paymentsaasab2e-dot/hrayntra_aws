/**
 * Comprehensive & Mutually Consistent Demo Data Seeder for HRMS (Hryantra)
 * Run with: node seed_consistent_demo_data.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const TENANT_ID = '6a08259b752e15d6a06ec490';
const HQ_ORG_UNIT_ID = '6a08259b752e15d6a06ec491';
const ENG_ORG_UNIT_ID = '6a08259b752e15d6a06ec494';
const FINANCE_ORG_UNIT_ID = '6a08259b752e15d6a06ec495';
const HQ_LOCATION_ID = '6a08259b752e15d6a06ec480';
const MUMBAI_LOCATION_ID = '6a08259b752e15d6a06ec481';

const FULL_PERMISSIONS = {
  tabs: {
    dashboard: true,
    employees: true,
    onboarding: true,
    tasks: true,
    attendance: true,
    leave: true,
    timeOff: true,
    assets: true,
    performance: true,
    approvals: true,
    documents: true,
    reports: true,
    settings: true,
    locations: true,
    fieldVisits: true,
    userManagement: true,
    orgStructure: true,
    platformConsole: false,
  },
  actions: {
    employees_create: true,
    employees_delete: true,
    employees_edit: true,
    tasks_create: true,
    tasks_delete: true,
    tasks_approve: true,
    tasks_submit: true,
    leaves_apply: true,
    leaves_approve: true,
    holidays_manage: true,
    attendance_punch_self: true,
    attendance_punch_hr: true,
    attendance_approve_late: true,
    attendance_punch_remote_self: true,
    assets_manage: true,
    documents_manage: true,
    performance_manage: true,
    reports_view: true,
    settings_edit: true,
    users_manage: true,
    locations_manage: true,
    field_visits_manage: true,
    org_manage: true,
    platform_manage_tenants: false,
  },
};

async function seed() {
  console.log('Seeding rich & consistent demo data for tenant:', TENANT_ID);

  // 1. Password hash
  const defaultPasswordHash = await bcrypt.hash('password123', 10);
  const adminPasswordHash = await bcrypt.hash('SuperAdmin@123', 10);
  const tenantAdminPasswordHash = await bcrypt.hash('Admin@123456', 10);

  // 2. Ensure Tenant
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: { name: 'Hryantra', slug: 'hryantra', packageKey: 'ENTERPRISE', status: 'ACTIVE' },
    create: {
      id: TENANT_ID,
      name: 'Hryantra',
      slug: 'hryantra',
      packageKey: 'ENTERPRISE',
      status: 'ACTIVE',
      maxUsers: 9999,
    },
  });

  // 3. Ensure Locations
  await prisma.workLocation.upsert({
    where: { id: HQ_LOCATION_ID },
    update: { tenantId: TENANT_ID, name: 'Yantra HQ — Pune', address: 'Hinjawadi Phase 1, Pune', lat: 18.5912, lng: 73.7389, radiusMeters: 150, isActive: true },
    create: { id: HQ_LOCATION_ID, tenantId: TENANT_ID, orgUnitId: ENG_ORG_UNIT_ID, name: 'Yantra HQ — Pune', address: 'Hinjawadi Phase 1, Pune', lat: 18.5912, lng: 73.7389, radiusMeters: 150, isActive: true, usage: 'BOTH' },
  });

  await prisma.workLocation.upsert({
    where: { id: MUMBAI_LOCATION_ID },
    update: { tenantId: TENANT_ID, name: 'Yantra Branch — Mumbai', address: 'Andheri East, Mumbai', lat: 19.1136, lng: 72.8697, radiusMeters: 100, isActive: true },
    create: { id: MUMBAI_LOCATION_ID, tenantId: TENANT_ID, orgUnitId: FINANCE_ORG_UNIT_ID, name: 'Yantra Branch — Mumbai', address: 'Andheri East, Mumbai', lat: 19.1136, lng: 72.8697, radiusMeters: 100, isActive: true, usage: 'BOTH' },
  });

  // 4. Upsert Users
  const users = [
    {
      id: '6a08259b752e15d6a06ec470',
      email: 'superadmin@hrms.local',
      password: adminPasswordHash,
      displayName: 'Hryantra Tenant Admin',
      role: 'ADMIN',
      tenantId: TENANT_ID,
      orgUnitId: HQ_ORG_UNIT_ID,
      permissions: FULL_PERMISSIONS,
      status: 'ACTIVE',
    },
    {
      id: '6a08259b752e15d6a06ec46e',
      email: 'admin@hryantra.com',
      password: tenantAdminPasswordHash,
      displayName: 'Tenant Admin',
      role: 'ADMIN',
      tenantId: TENANT_ID,
      orgUnitId: HQ_ORG_UNIT_ID,
      permissions: FULL_PERMISSIONS,
      status: 'ACTIVE',
    },
    {
      id: '6a08259b752e15d6a06ec471',
      email: 'sarah.connor@hryantra.com',
      password: defaultPasswordHash,
      displayName: 'Sarah Connor',
      role: 'HR',
      tenantId: TENANT_ID,
      orgUnitId: HQ_ORG_UNIT_ID,
      permissions: FULL_PERMISSIONS,
      status: 'ACTIVE',
    },
    {
      id: '6a08259b752e15d6a06ec472',
      email: 'michael.c@hryantra.com',
      password: defaultPasswordHash,
      displayName: 'Michael Chang',
      role: 'MANAGER',
      tenantId: TENANT_ID,
      orgUnitId: ENG_ORG_UNIT_ID,
      permissions: FULL_PERMISSIONS,
      status: 'ACTIVE',
    },
    {
      id: '6a08259b752e15d6a06ec473',
      email: 'david.wallace@hryantra.com',
      password: defaultPasswordHash,
      displayName: 'David Wallace',
      role: 'EMPLOYEE',
      tenantId: TENANT_ID,
      orgUnitId: FINANCE_ORG_UNIT_ID,
      permissions: FULL_PERMISSIONS,
      status: 'ACTIVE',
    },
    {
      id: '6a08259b752e15d6a06ec474',
      email: 'priya.sharma@hryantra.com',
      password: defaultPasswordHash,
      displayName: 'Priya Sharma',
      role: 'EMPLOYEE',
      tenantId: TENANT_ID,
      orgUnitId: ENG_ORG_UNIT_ID,
      permissions: FULL_PERMISSIONS,
      status: 'ACTIVE',
    },
  ];

  for (const u of users) {
    const { id, ...uData } = u;
    await prisma.user.upsert({
      where: { id },
      update: uData,
      create: u,
    });
  }

  // 5. Upsert Employees
  // Note: Link Sarah Connor to EMP-001 with userId of superadmin@hrms.local so admin user has an employee linkage,
  // or link superadmin to EMP-001 and Sarah to EMP-001 or EMP-000.
  const employees = [
    {
      id: '6a08259b752e15d6a06ec477',
      employeeId: 'EMP-001',
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 'sarah.connor@hryantra.com',
      phone: '+91 98230 11223',
      designation: 'Head of People & Operations',
      department: 'Human Resources',
      joiningDate: new Date('2023-01-15T00:00:00.000Z'),
      status: 'ACTIVE',
      locationId: HQ_LOCATION_ID,
      orgUnitId: HQ_ORG_UNIT_ID,
      tenantId: TENANT_ID,
      userId: '6a08259b752e15d6a06ec471',
    },
    {
      id: '6a08259b752e15d6a06ec478',
      employeeId: 'EMP-002',
      firstName: 'Michael',
      lastName: 'Chang',
      email: 'michael.c@hryantra.com',
      phone: '+91 98230 22334',
      designation: 'VP of Engineering',
      department: 'Engineering',
      joiningDate: new Date('2023-03-01T00:00:00.000Z'),
      status: 'ACTIVE',
      locationId: HQ_LOCATION_ID,
      orgUnitId: ENG_ORG_UNIT_ID,
      tenantId: TENANT_ID,
      userId: '6a08259b752e15d6a06ec472',
    },
    {
      id: '6a08259b752e15d6a06ec479',
      employeeId: 'EMP-003',
      firstName: 'David',
      lastName: 'Wallace',
      email: 'david.wallace@hryantra.com',
      phone: '+91 98230 33445',
      designation: 'Finance Controller',
      department: 'Finance',
      joiningDate: new Date('2023-06-15T00:00:00.000Z'),
      status: 'ACTIVE',
      locationId: MUMBAI_LOCATION_ID,
      orgUnitId: FINANCE_ORG_UNIT_ID,
      tenantId: TENANT_ID,
      userId: '6a08259b752e15d6a06ec473',
    },
    {
      id: '6a08259b752e15d6a06ec475',
      employeeId: 'EMP-004',
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.sharma@hryantra.com',
      phone: '+91 98230 44556',
      designation: 'Senior Solutions Architect',
      department: 'Engineering',
      joiningDate: new Date('2023-09-01T00:00:00.000Z'),
      status: 'ACTIVE',
      locationId: HQ_LOCATION_ID,
      orgUnitId: ENG_ORG_UNIT_ID,
      tenantId: TENANT_ID,
      userId: '6a08259b752e15d6a06ec474',
    },
    {
      id: '6a08259b752e15d6a06ec47a',
      employeeId: 'EMP-005',
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'alex.morgan@hryantra.com',
      phone: '+91 98230 55667',
      designation: 'Lead UI/UX Engineer',
      department: 'Engineering',
      joiningDate: new Date('2024-01-10T00:00:00.000Z'),
      status: 'ACTIVE',
      locationId: HQ_LOCATION_ID,
      orgUnitId: ENG_ORG_UNIT_ID,
      tenantId: TENANT_ID,
      userId: null,
    },
    {
      id: '6a08259b752e15d6a06ec47b',
      employeeId: 'EMP-006',
      firstName: 'Rachel',
      lastName: 'Green',
      email: 'rachel.green@hryantra.com',
      phone: '+91 98230 66778',
      designation: 'People Partner & Talent Acquisition',
      department: 'Human Resources',
      joiningDate: new Date('2024-02-01T00:00:00.000Z'),
      status: 'ACTIVE',
      locationId: HQ_LOCATION_ID,
      orgUnitId: HQ_ORG_UNIT_ID,
      tenantId: TENANT_ID,
      userId: null,
    },
  ];

  for (const emp of employees) {
    const { id, ...empData } = emp;
    await prisma.employee.upsert({
      where: { id },
      update: empData,
      create: emp,
    });
  }

  // 6. Projects
  const projects = [
    {
      id: '6afd2f97a4b81b5d85db3c50',
      name: 'HRMS Platform Deployment',
      description: 'End-to-end enterprise rollout of HRMS, Roster & Time Attendance across Pune & Mumbai.',
      status: 'ACTIVE',
      tenantId: TENANT_ID,
    },
    {
      id: '6afd2f97a4b81b5d85db3c51',
      name: 'Cloud Infrastructure & Security',
      description: 'Zero-trust network architecture, MongoDB clustering, and SOC-2 audit preparations.',
      status: 'ACTIVE',
      tenantId: TENANT_ID,
    },
    {
      id: '6afd2f97a4b81b5d85db3c52',
      name: 'Annual Compensation & Merit Cycle',
      description: 'Appraisal calibration, salary slab review, and localized CTC policy execution.',
      status: 'ACTIVE',
      tenantId: TENANT_ID,
    },
  ];

  await prisma.task.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.project.deleteMany({ where: { tenantId: TENANT_ID } });
  for (const proj of projects) {
    await prisma.project.create({ data: proj });
  }

  // 7. Tasks
  await prisma.task.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.task.createMany({
    data: [
      {
        id: '6afd2f97a4b81b5d85db3c53',
        title: 'Finalize biometric device webhook sync',
        description: 'Verify TCP push protocol from Hinjawadi punch terminals to HRMS backend.',
        priority: 'URGENT',
        status: 'IN_PROGRESS',
        workDonePercent: 65,
        remarks: 'Biometric API integrated. Testing failover retry queues.',
        assignedTo: '6a08259b752e15d6a06ec477',
        assigneeIds: ['6a08259b752e15d6a06ec477'],
        projectId: '6afd2f97a4b81b5d85db3c50',
        tenantId: TENANT_ID,
      },
      {
        id: '6afd2f97a4b81b5d85db3c54',
        title: 'Implement GPS geofencing radius validation',
        description: 'Enforce 150m boundary check on mobile and web check-ins for Pune HQ.',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        workDonePercent: 40,
        remarks: 'Haversine formula verified against Hinjawadi coordinates.',
        assignedTo: '6a08259b752e15d6a06ec475',
        assigneeIds: ['6a08259b752e15d6a06ec475'],
        projectId: '6afd2f97a4b81b5d85db3c50',
        tenantId: TENANT_ID,
      },
      {
        id: '6afd2f97a4b81b5d85db3c55',
        title: 'Review Q4 payroll tax compliance worksheets',
        description: 'Confirm TDS 10% deduction thresholds and EPF employee/employer matching slabs.',
        priority: 'MEDIUM',
        status: 'TODO',
        workDonePercent: 20,
        remarks: 'Waiting on updated Central Board of Direct Taxes notification.',
        assignedTo: '6a08259b752e15d6a06ec479',
        assigneeIds: ['6a08259b752e15d6a06ec479'],
        projectId: '6afd2f97a4b81b5d85db3c52',
        tenantId: TENANT_ID,
      },
      {
        id: '6afd2f97a4b81b5d85db3c56',
        title: 'Audit SOC-2 compliance access logs',
        description: 'Verify multi-tenant isolation, role permission gates, and token expirations.',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        workDonePercent: 50,
        remarks: 'Auditing JWT verify middleware on all Express sub-routes.',
        assignedTo: '6a08259b752e15d6a06ec478',
        assigneeIds: ['6a08259b752e15d6a06ec478'],
        projectId: '6afd2f97a4b81b5d85db3c51',
        tenantId: TENANT_ID,
      },
      {
        id: '6afd2f97a4b81b5d85db3c57',
        title: 'Design dark mode palette and UI tokens',
        description: 'Refactor Tailwind color utilities for seamless enterprise dark theme.',
        priority: 'LOW',
        status: 'DONE',
        workDonePercent: 100,
        remarks: 'Shipped high-contrast CSS variable tokens.',
        assignedTo: '6a08259b752e15d6a06ec47a',
        assigneeIds: ['6a08259b752e15d6a06ec47a'],
        projectId: '6afd2f97a4b81b5d85db3c50',
        tenantId: TENANT_ID,
      },
      {
        id: '6afd2f97a4b81b5d85db3c58',
        title: 'Annual benefit enrollment communication draft',
        description: 'Prepare medical insurance and accidental cover advisory email blast for staff.',
        priority: 'LOW',
        status: 'DONE',
        workDonePercent: 100,
        remarks: 'Approved by People Partner leadership.',
        assignedTo: '6a08259b752e15d6a06ec47b',
        assigneeIds: ['6a08259b752e15d6a06ec47b'],
        projectId: '6afd2f97a4b81b5d85db3c52',
        tenantId: TENANT_ID,
      },
    ],
  });

  // 8. Leaves (5 real records: 3 PENDING, 2 APPROVED)
  await prisma.leave.deleteMany({});
  await prisma.leave.createMany({
    data: [
      {
        id: '6afd2f97a4b81b5d85db3c5d',
        employeeId: '6a08259b752e15d6a06ec477', // Sarah Connor
        type: 'CASUAL',
        startDate: new Date('2026-11-28T00:00:00.000Z'),
        endDate: new Date('2026-11-29T00:00:00.000Z'),
        reason: 'Personal family event in Pune',
        status: 'PENDING',
        appliedAt: new Date(),
      },
      {
        id: '6afd2f97a4b81b5d85db3c5e',
        employeeId: '6a08259b752e15d6a06ec479', // David Wallace
        type: 'CASUAL',
        startDate: new Date('2026-11-23T00:00:00.000Z'),
        endDate: new Date('2026-11-25T00:00:00.000Z'),
        reason: 'Family wedding event in Mumbai',
        status: 'PENDING',
        appliedAt: new Date(),
      },
      {
        id: '6afd2f97a4b81b5d85db3c5f',
        employeeId: '6a08259b752e15d6a06ec478', // Michael Chang
        type: 'EARNED',
        startDate: new Date('2026-11-30T00:00:00.000Z'),
        endDate: new Date('2026-12-03T00:00:00.000Z'),
        reason: 'Annual family holiday leave',
        status: 'PENDING',
        appliedAt: new Date(),
      },
      {
        id: '6afd2f97a4b81b5d85db3c60',
        employeeId: '6a08259b752e15d6a06ec475', // Priya Sharma
        type: 'SICK',
        startDate: new Date('2026-11-17T00:00:00.000Z'),
        endDate: new Date('2026-11-17T00:00:00.000Z'),
        reason: 'Viral fever recovery & medical checkup',
        status: 'APPROVED',
        appliedAt: new Date(Date.now() - 86400000),
        processedAt: new Date(Date.now() - 43200000),
      },
      {
        id: '6afd2f97a4b81b5d85db3c61',
        employeeId: '6a08259b752e15d6a06ec47a', // Alex Morgan
        type: 'CASUAL',
        startDate: new Date('2026-11-15T00:00:00.000Z'),
        endDate: new Date('2026-11-16T00:00:00.000Z'),
        reason: 'Personal administration work',
        status: 'APPROVED',
        appliedAt: new Date(Date.now() - 259200000),
        processedAt: new Date(Date.now() - 172800000),
      },
    ],
  });

  // 9. Attendance (Midday UTC timestamps so all timezones format to TODAY)
  await prisma.attendance.deleteMany({});
  
  // Today's date midday:
  const now = new Date();
  const todayMidday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0));
  const yesterdayMidday = new Date(todayMidday.getTime() - 86400000);

  await prisma.attendance.createMany({
    data: [
      {
        id: '6afd2f98a4b81b5d85db3c62',
        employeeId: '6a08259b752e15d6a06ec475', // Priya Sharma: Currently Active
        date: todayMidday,
        checkInTime: new Date(todayMidday.getTime() - 3 * 3600000), // 3 hours ago
        checkOutTime: null,
        status: 'PRESENT',
        lat: 18.5912,
        lng: 73.7389,
        distanceMeters: 38,
        punchStatus: 'ACCEPTED',
        isActive: true,
        punchMode: 'office',
      },
      {
        id: '6afd2f98a4b81b5d85db3c63',
        employeeId: '6a08259b752e15d6a06ec478', // Michael Chang: Clocked Out
        date: todayMidday,
        checkInTime: new Date(todayMidday.getTime() - 5 * 3600000),
        checkOutTime: new Date(todayMidday.getTime() + 3600000),
        status: 'PRESENT',
        lat: 18.5910,
        lng: 73.7390,
        distanceMeters: 52,
        punchStatus: 'ACCEPTED',
        isActive: false,
        punchMode: 'office',
      },
      {
        id: '6afd2f98a4b81b5d85db3c64',
        employeeId: '6a08259b752e15d6a06ec477', // Sarah Connor: Clocked Out
        date: todayMidday,
        checkInTime: new Date(todayMidday.getTime() - 6 * 3600000),
        checkOutTime: new Date(todayMidday.getTime() + 1800000),
        status: 'PRESENT',
        lat: 18.5912,
        lng: 73.7389,
        distanceMeters: 25,
        punchStatus: 'ACCEPTED',
        isActive: false,
        punchMode: 'office',
      },
      {
        id: '6afd2f98a4b81b5d85db3c65',
        employeeId: '6a08259b752e15d6a06ec479', // David Wallace: Remote WFH
        date: todayMidday,
        checkInTime: new Date(todayMidday.getTime() - 4 * 3600000),
        checkOutTime: null,
        status: 'PRESENT',
        lat: 19.1136,
        lng: 72.8697,
        distanceMeters: 12,
        punchStatus: 'ACCEPTED',
        isActive: true,
        punchMode: 'remote',
      },
      // Yesterday logs for history
      {
        id: '6afd2f98a4b81b5d85db3c66',
        employeeId: '6a08259b752e15d6a06ec475',
        date: yesterdayMidday,
        checkInTime: new Date(yesterdayMidday.getTime() - 5 * 3600000),
        checkOutTime: new Date(yesterdayMidday.getTime() + 3 * 3600000),
        status: 'PRESENT',
        lat: 18.5912,
        lng: 73.7389,
        distanceMeters: 40,
        punchStatus: 'ACCEPTED',
        isActive: false,
        punchMode: 'office',
      },
      {
        id: '6afd2f98a4b81b5d85db3c67',
        employeeId: '6a08259b752e15d6a06ec478',
        date: yesterdayMidday,
        checkInTime: new Date(yesterdayMidday.getTime() - 4 * 3600000),
        checkOutTime: new Date(yesterdayMidday.getTime() + 4 * 3600000),
        status: 'PRESENT',
        lat: 18.5910,
        lng: 73.7390,
        distanceMeters: 45,
        punchStatus: 'ACCEPTED',
        isActive: false,
        punchMode: 'office',
      },
    ],
  });

  // 10. Onboarding Hires (5 candidates: 2 Ready to Graduate, 2 In Progress, 1 Graduated)
  await prisma.onboardingHire.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.onboardingHire.createMany({
    data: [
      {
        id: '6afd2f98a4b81b5d85db3c70',
        name: 'Arjun Mehta',
        role: 'Field Solutions Engineer',
        department: 'Engineering',
        email: 'arjun.mehta@hryantra.com',
        source: 'MANUAL',
        progress: 33,
        joinDate: '2026-11-20',
        status: 'In Progress',
        tasks: [
          { label: 'Salary & CTC Structure Assigned', done: true },
          { label: 'Hardware Allocation & Laptop Setup', done: false },
          { label: 'Compliance & NDA Signature', done: false },
        ],
        tenantId: TENANT_ID,
      },
      {
        id: '6afd2f98a4b81b5d85db3c71',
        name: 'Neha Gupta',
        role: 'Senior Product Designer',
        department: 'Product',
        email: 'neha.gupta@hryantra.com',
        source: 'MANUAL',
        progress: 100,
        joinDate: '2026-11-18',
        status: 'In Progress',
        tasks: [
          { label: 'Salary & CTC Structure Assigned', done: true },
          { label: 'MacBook Pro Setup & Figma Access', done: true },
          { label: 'All Statutory Documents Verified', done: true },
        ],
        tenantId: TENANT_ID,
      },
      {
        id: '6afd2f98a4b81b5d85db3c72',
        name: 'Kavita Rao',
        role: 'DevOps & Cloud Specialist',
        department: 'Engineering',
        email: 'kavita.rao@hryantra.com',
        source: 'MANUAL',
        progress: 100,
        joinDate: '2026-11-19',
        status: 'In Progress',
        tasks: [
          { label: 'Salary & CTC Structure Assigned', done: true },
          { label: 'AWS IAM & GitHub Access Configured', done: true },
          { label: 'NDA & Security Compliance Signed', done: true },
        ],
        tenantId: TENANT_ID,
      },
      {
        id: '6afd2f98a4b81b5d85db3c73',
        name: 'Marcus Vance',
        role: 'People Partner Analyst',
        department: 'Human Resources',
        email: 'marcus.v@hryantra.com',
        source: 'MANUAL',
        progress: 66,
        joinDate: '2026-11-25',
        status: 'In Progress',
        tasks: [
          { label: 'Salary & CTC Structure Assigned', done: true },
          { label: 'Background Check & ID Verification', done: true },
          { label: 'IT Asset Issuance', done: false },
        ],
        tenantId: TENANT_ID,
      },
      {
        id: '6afd2f98a4b81b5d85db3c74',
        name: 'Rohan Deshmukh',
        role: 'Full Stack Engineer',
        department: 'Engineering',
        email: 'rohan.d@hryantra.com',
        source: 'MANUAL',
        progress: 100,
        joinDate: '2026-11-04',
        status: 'Graduated',
        tasks: [
          { label: 'Induction Completed', done: true },
          { label: 'Direct User Account Created', done: true },
        ],
        tenantId: TENANT_ID,
      },
    ],
  });

  // 11. Assets
  await prisma.assetAllocation.deleteMany({});
  await prisma.asset.deleteMany({ where: { tenantId: TENANT_ID } });

  const macbook = await prisma.asset.create({
    data: {
      name: 'MacBook Pro 14" M3',
      type: 'Laptop',
      brand: 'Apple',
      model: 'MacBook Pro 14" M3 Pro',
      serialNumber: 'MBP-M3-2024-001',
      status: 'Assigned',
      condition: 'Excellent',
      purchasedOn: '2024-01-10',
      warrantyUntil: '2027-01-10',
      tenantId: TENANT_ID,
    },
  });

  const dellMonitor = await prisma.asset.create({
    data: {
      name: 'Dell UltraSharp 27" 4K Monitor',
      type: 'Monitor',
      brand: 'Dell',
      model: 'UltraSharp U2723QE',
      serialNumber: 'DELL-U2723QE-042',
      status: 'Assigned',
      condition: 'Good',
      purchasedOn: '2024-01-20',
      warrantyUntil: '2027-01-20',
      tenantId: TENANT_ID,
    },
  });

  const thinkpad = await prisma.asset.create({
    data: {
      name: 'Lenovo ThinkPad X1 Carbon Gen 11',
      type: 'Laptop',
      brand: 'Lenovo',
      model: 'ThinkPad X1 Carbon Gen 11',
      serialNumber: 'TP-X1-GEN11-889',
      status: 'Assigned',
      condition: 'Excellent',
      purchasedOn: '2024-02-01',
      warrantyUntil: '2027-02-01',
      tenantId: TENANT_ID,
    },
  });

  await prisma.assetAllocation.createMany({
    data: [
      {
        assetId: macbook.id,
        employeeId: '6a08259b752e15d6a06ec477', // Sarah Connor
        issuedOn: '2024-01-15',
        conditionOnIssue: 'New',
        issuedBy: 'IT Asset Ops',
        status: 'Active',
      },
      {
        assetId: dellMonitor.id,
        employeeId: '6a08259b752e15d6a06ec47a', // Alex Morgan
        issuedOn: '2024-02-01',
        conditionOnIssue: 'Good',
        issuedBy: 'IT Asset Ops',
        status: 'Active',
      },
      {
        assetId: thinkpad.id,
        employeeId: '6a08259b752e15d6a06ec479', // David Wallace
        issuedOn: '2024-02-15',
        conditionOnIssue: 'New',
        issuedBy: 'IT Asset Ops',
        status: 'Active',
      },
    ],
  });

  // 12. Holidays
  await prisma.holiday.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.holiday.createMany({
    data: [
      {
        name: "New Year's Day",
        date: new Date('2026-01-01T00:00:00.000Z'),
        type: 'Public Holiday',
        isActive: true,
        tenantId: TENANT_ID,
      },
      {
        name: 'Republic Day',
        date: new Date('2026-01-26T00:00:00.000Z'),
        type: 'Public Holiday',
        isActive: true,
        tenantId: TENANT_ID,
      },
      {
        name: 'Holi Festival',
        date: new Date('2026-03-25T00:00:00.000Z'),
        type: 'Public Holiday',
        isActive: true,
        tenantId: TENANT_ID,
      },
      {
        name: 'Independence Day',
        date: new Date('2026-08-15T00:00:00.000Z'),
        type: 'Public Holiday',
        isActive: true,
        tenantId: TENANT_ID,
      },
      {
        name: 'Diwali Festival',
        date: new Date('2026-11-01T00:00:00.000Z'),
        type: 'Public Holiday',
        isActive: true,
        tenantId: TENANT_ID,
      },
    ],
  });

  console.log('Finished seeding demo data successfully.');
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  prisma.$disconnect();
  process.exit(1);
});
