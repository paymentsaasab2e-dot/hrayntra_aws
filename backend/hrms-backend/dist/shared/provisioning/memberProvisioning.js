"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitDisplayName = splitDisplayName;
exports.nextEmployeeCode = nextEmployeeCode;
exports.ensureOnboardingPipeline = ensureOnboardingPipeline;
exports.provisionEmployeeForUser = provisionEmployeeForUser;
exports.provisionOnboardingForEmployeeOnly = provisionOnboardingForEmployeeOnly;
const prisma_1 = __importDefault(require("../prisma"));
const DEFAULT_ONBOARDING_TASKS = [
    { label: 'HRMS Login Account Created', done: false },
    { label: 'Salary & CTC Structure Assigned', done: false },
    { label: 'Hardware Allocation', done: false },
    { label: 'Email & Workspace Setup', done: false },
    { label: 'Policy Documentation Signature', done: false },
    { label: 'Induction Meeting', done: false },
    { label: 'Team Introduction', done: false },
];
function splitDisplayName(displayName, email) {
    const source = (displayName || email.split('@')[0] || 'User').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return { firstName: 'User', lastName: 'Member' };
    if (parts.length === 1)
        return { firstName: parts[0], lastName: 'Member' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
async function nextEmployeeCode() {
    const rows = await prisma_1.default.employee.findMany({ select: { employeeId: true } });
    let max = 0;
    for (const row of rows) {
        const match = row.employeeId.match(/EMP-(\d+)/i);
        if (match)
            max = Math.max(max, parseInt(match[1], 10));
    }
    return `EMP-${String(max + 1).padStart(3, '0')}`;
}
function roleToDesignation(role, override) {
    if (override?.trim())
        return override.trim();
    if (role === 'ADMIN')
        return 'System Administrator';
    if (role === 'HR')
        return 'HR Executive';
    if (role === 'MANAGER')
        return 'Manager';
    return 'Employee';
}
async function ensureOnboardingPipeline(input) {
    const existing = await prisma_1.default.onboardingHire.findFirst({
        where: {
            OR: [
                input.employeeId ? { employeeId: input.employeeId } : undefined,
                input.email ? { email: input.email } : undefined,
            ].filter(Boolean),
        },
        orderBy: { createdAt: 'desc' },
    });
    const tasks = DEFAULT_ONBOARDING_TASKS.map((task) => ({
        ...task,
        done: task.label === 'HRMS Login Account Created'
            ? Boolean(input.loginCreated)
            : task.done,
    }));
    const joinDate = new Date().toISOString().slice(0, 10);
    const completedCount = tasks.filter((t) => t.done).length;
    const progress = Math.round((completedCount / tasks.length) * 100);
    const status = progress === 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Pending';
    if (existing) {
        return prisma_1.default.onboardingHire.update({
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
    return prisma_1.default.onboardingHire.create({
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
async function provisionEmployeeForUser(input) {
    const { firstName, lastName } = splitDisplayName(input.displayName, input.email);
    const employeeId = input.employeeCode?.trim() || (await nextEmployeeCode());
    const existingCode = await prisma_1.default.employee.findUnique({ where: { employeeId } });
    if (existingCode)
        throw new Error(`Employee ID ${employeeId} already exists`);
    const existingEmail = await prisma_1.default.employee.findUnique({ where: { email: input.email } });
    if (existingEmail) {
        if (existingEmail.userId && existingEmail.userId !== input.userId) {
            throw new Error('Email already linked to another employee');
        }
        return prisma_1.default.employee.update({
            where: { id: existingEmail.id },
            data: {
                userId: input.userId,
                ...(input.tenantId ? { tenantId: input.tenantId } : {}),
                ...(input.orgUnitId ? { orgUnitId: input.orgUnitId } : {}),
            },
        });
    }
    return prisma_1.default.employee.create({
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
async function provisionOnboardingForEmployeeOnly(input) {
    return ensureOnboardingPipeline({
        ...input,
        loginCreated: false,
    });
}
//# sourceMappingURL=memberProvisioning.js.map