import prisma from '../prisma';

const DEFAULT_ONBOARDING_TASKS = [
  { label: 'HRMS Login Account Created', done: false },
  { label: 'Salary & CTC Structure Assigned', done: false },
  { label: 'Hardware Allocation', done: false },
  { label: 'Email & Workspace Setup', done: false },
  { label: 'Policy Documentation Signature', done: false },
  { label: 'Induction Meeting', done: false },
  { label: 'Team Introduction', done: false },
];

export function splitDisplayName(displayName: string, email: string) {
  const source = (displayName || email.split('@')[0] || 'User').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'User', lastName: 'Member' };
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Member' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export async function nextEmployeeCode() {
  const rows = await prisma.employee.findMany({ select: { employeeId: true } });
  let max = 0;
  for (const row of rows) {
    const match = row.employeeId.match(/EMP-(\d+)/i);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `EMP-${String(max + 1).padStart(3, '0')}`;
}

function roleToDesignation(role: string, override?: string) {
  if (override?.trim()) return override.trim();
  if (role === 'ADMIN') return 'System Administrator';
  if (role === 'HR') return 'HR Executive';
  if (role === 'MANAGER') return 'Manager';
  return 'Employee';
}

export async function ensureOnboardingPipeline(input: {
  name: string;
  role: string;
  department: string;
  email: string;
  employeeId?: string | null;
  userId?: string | null;
  loginCreated?: boolean;
}) {
  const existing = await prisma.onboardingHire.findFirst({
    where: {
      OR: [
        input.employeeId ? { employeeId: input.employeeId } : undefined,
        input.email ? { email: input.email } : undefined,
      ].filter(Boolean) as any[],
    },
    orderBy: { createdAt: 'desc' },
  });

  const tasks = DEFAULT_ONBOARDING_TASKS.map((task) => ({
    ...task,
    done:
      task.label === 'HRMS Login Account Created'
        ? Boolean(input.loginCreated)
        : task.done,
  }));

  const joinDate = new Date().toISOString().slice(0, 10);
  const completedCount = tasks.filter((t) => t.done).length;
  const progress = Math.round((completedCount / tasks.length) * 100);
  const status = progress === 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Pending';

  if (existing) {
    return prisma.onboardingHire.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        role: input.role,
        department: input.department,
        email: input.email,
        employeeId: input.employeeId || existing.employeeId,
        userId: input.userId || existing.userId,
        tasks,
        progress,
        status,
      },
    });
  }

  return prisma.onboardingHire.create({
    data: {
      name: input.name,
      role: input.role,
      department: input.department,
      email: input.email,
      employeeId: input.employeeId || null,
      userId: input.userId || null,
      joinDate,
      progress,
      status,
      tasks,
    },
  });
}

export async function provisionEmployeeForUser(input: {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  department?: string;
  designation?: string;
  employeeCode?: string;
  locationId?: string;
  orgUnitId?: string;
  tenantId?: string | null;
}) {
  const { firstName, lastName } = splitDisplayName(input.displayName, input.email);
  const employeeId = input.employeeCode?.trim() || (await nextEmployeeCode());

  const existingCode = await prisma.employee.findUnique({ where: { employeeId } });
  if (existingCode) throw new Error(`Employee ID ${employeeId} already exists`);

  const existingEmail = await prisma.employee.findUnique({ where: { email: input.email } });
  if (existingEmail) {
    if (existingEmail.userId && existingEmail.userId !== input.userId) {
      throw new Error('Email already linked to another employee');
    }
    return prisma.employee.update({
      where: { id: existingEmail.id },
      data: {
        userId: input.userId,
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        ...(input.orgUnitId ? { orgUnitId: input.orgUnitId } : {}),
      },
    });
  }

  return prisma.employee.create({
    data: {
      employeeId,
      firstName,
      lastName,
      email: input.email,
      designation: roleToDesignation(input.role, input.designation),
      department: input.department?.trim() || 'General',
      joiningDate: new Date(),
      status: 'ACTIVE',
      userId: input.userId,
      tenantId: input.tenantId || null,
      orgUnitId: input.orgUnitId || null,
      ...(input.locationId ? { locationId: input.locationId } : {}),
    },
  });
}

export async function provisionOnboardingForEmployeeOnly(input: {
  name: string;
  role: string;
  department: string;
  email: string;
  employeeId: string;
}) {
  return ensureOnboardingPipeline({
    ...input,
    loginCreated: false,
  });
}
