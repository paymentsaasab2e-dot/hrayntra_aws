"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const compensation_service_1 = require("../compensation/compensation.service");
const policy_service_1 = require("../policies/policy.service");
const memberProvisioning_1 = require("../../shared/provisioning/memberProvisioning");
const resend_service_1 = require("../../shared/email/resend.service");
const permissions_1 = require("../../shared/permissions");
const tenant_packages_1 = require("../../shared/tenant-packages");
const DEFAULT_TASKS = [
    { label: 'Salary & CTC Structure Assigned', done: false },
    { label: 'Hardware Allocation', done: false },
    { label: 'Email & Workspace Setup', done: false },
    { label: 'Policy Documentation Signature', done: false },
    { label: 'Induction Meeting', done: false },
    { label: 'Team Introduction', done: false },
];
function splitName(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return { firstName: 'New', lastName: 'Hire' };
    if (parts.length === 1)
        return { firstName: parts[0], lastName: 'Hire' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
function recalcProgress(tasks) {
    const completedCount = tasks.filter((t) => t.done).length;
    const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
    const status = progress === 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Pending';
    return { progress, status };
}
class OnboardingService {
    static async getAll(filters = {}, tenantId) {
        // Fail closed: no tenant → empty list (never leak across companies)
        if (!tenantId)
            return [];
        const where = { tenantId };
        if (filters.status)
            where.status = filters.status;
        return prisma_1.default.onboardingHire.findMany({
            where,
            include: { compensation: { include: { complianceProfile: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    static async getById(id, tenantId) {
        const hire = await prisma_1.default.onboardingHire.findUnique({
            where: { id },
            include: { compensation: { include: { complianceProfile: true } } },
        });
        if (!hire)
            return null;
        if (tenantId && hire.tenantId && hire.tenantId !== tenantId)
            return null;
        return hire;
    }
    static async create(data, tenantId) {
        if (!tenantId)
            throw new Error('Tenant context required to create onboarding hire');
        const tasks = data.tasks || DEFAULT_TASKS;
        const { progress, status } = recalcProgress(tasks);
        const hire = await prisma_1.default.onboardingHire.create({
            data: {
                tenantId,
                name: data.name,
                role: data.role,
                department: data.department,
                email: data.email || null,
                phone: data.phone || null,
                country: data.country || null,
                region: data.region || null,
                city: data.city || null,
                locality: data.locality || null,
                source: data.source || 'MANUAL',
                joinDate: data.joinDate || new Date().toISOString().slice(0, 10),
                progress,
                status,
                tasks,
            },
        });
        if (tenantId && data.compensation) {
            await compensation_service_1.CompensationService.upsertCompensation(tenantId, {
                onboardingHireId: hire.id,
                ...data.compensation,
            });
            const tasksWithSalary = tasks.map((t) => t.label === 'Salary & CTC Structure Assigned' ? { ...t, done: true } : t);
            const recalc = recalcProgress(tasksWithSalary);
            return prisma_1.default.onboardingHire.update({
                where: { id: hire.id },
                data: { tasks: tasksWithSalary, ...recalc },
                include: { compensation: { include: { complianceProfile: true } } },
            });
        }
        return prisma_1.default.onboardingHire.findUnique({
            where: { id: hire.id },
            include: { compensation: { include: { complianceProfile: true } } },
        });
    }
    static async bulkCreate(candidates, tenantId, source = 'BULK_IMPORT') {
        const created = [];
        for (const candidate of candidates) {
            const hire = await this.create({ ...candidate, source }, tenantId);
            created.push(hire);
        }
        return created;
    }
    static async update(id, data, tenantId) {
        const existing = await this.getById(id, tenantId);
        if (!existing)
            throw new Error('Onboarding hire not found');
        const updated = await prisma_1.default.onboardingHire.update({
            where: { id },
            data: {
                name: data.name,
                role: data.role,
                department: data.department,
                email: data.email,
                phone: data.phone,
                country: data.country,
                region: data.region,
                city: data.city,
                locality: data.locality,
                joinDate: data.joinDate,
                source: data.source,
                employeeId: data.employeeId,
                userId: data.userId,
                tasks: data.tasks,
                progress: data.progress,
                status: data.status,
            },
            include: { compensation: { include: { complianceProfile: true } } },
        });
        if (tenantId && data.compensation) {
            await compensation_service_1.CompensationService.upsertCompensation(tenantId, {
                onboardingHireId: id,
                ...data.compensation,
            });
        }
        return prisma_1.default.onboardingHire.findUnique({
            where: { id },
            include: { compensation: { include: { complianceProfile: true } } },
        }) || updated;
    }
    static async updateTask(id, taskLabel, done, tenantId) {
        const hire = await this.getById(id, tenantId);
        if (!hire)
            throw new Error('Onboarding hire not found');
        const tasks = hire.tasks.map((t) => t.label === taskLabel ? { ...t, done } : t);
        const recalc = recalcProgress(tasks);
        return prisma_1.default.onboardingHire.update({
            where: { id },
            data: { tasks, ...recalc },
            include: { compensation: { include: { complianceProfile: true } } },
        });
    }
    static async complete(id, tenantId, options = {}) {
        const hire = await this.getById(id, tenantId);
        if (!hire)
            throw new Error('Onboarding hire not found');
        const { firstName, lastName } = splitName(hire.name);
        const email = hire.email?.trim() ||
            `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}@company.local`;
        // 1. Resolve or Create Employee
        let employee = null;
        if (hire.employeeId) {
            employee = await prisma_1.default.employee.findUnique({ where: { id: hire.employeeId } });
        }
        if (!employee) {
            // Check if employee with same email already exists
            const existingEmployee = await prisma_1.default.employee.findUnique({ where: { email } });
            if (existingEmployee) {
                employee = existingEmployee;
            }
            else {
                let employeeCode = options.employeeCode?.trim() || (await (0, memberProvisioning_1.nextEmployeeCode)());
                const codeConflict = await prisma_1.default.employee.findUnique({ where: { employeeId: employeeCode } });
                if (codeConflict) {
                    employeeCode = await (0, memberProvisioning_1.nextEmployeeCode)();
                }
                const joiningDate = hire.joinDate ? new Date(hire.joinDate) : new Date();
                let probationEndDate = null;
                if (tenantId) {
                    try {
                        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
                        const probationMonths = rules?.exit?.probationMonths ?? 3;
                        probationEndDate = new Date(joiningDate);
                        probationEndDate.setMonth(probationEndDate.getMonth() + probationMonths);
                    }
                    catch {
                        probationEndDate = new Date(joiningDate);
                        probationEndDate.setMonth(probationEndDate.getMonth() + 3);
                    }
                }
                employee = await prisma_1.default.employee.create({
                    data: {
                        employeeId: employeeCode,
                        firstName,
                        lastName,
                        email,
                        phone: hire.phone || null,
                        designation: hire.role,
                        department: hire.department,
                        joiningDate,
                        probationEndDate,
                        status: 'ACTIVE',
                        tenantId: tenantId || null,
                        locationId: options.locationId || null,
                        orgUnitId: options.orgUnitId || null,
                    },
                });
            }
        }
        // Link compensation if present
        if (tenantId && employee?.id) {
            try {
                await compensation_service_1.CompensationService.linkCompensationToEmployee(id, employee.id, tenantId);
            }
            catch (e) {
                console.warn('Compensation link notice during graduation:', e?.message || e);
            }
        }
        // 2. Resolve or Create User Login Account
        let user = null;
        let plainPassword = options.password?.trim() || '';
        let isNewUser = false;
        let emailSent = false;
        let userMessage = '';
        const shouldCreateLogin = options.createLogin !== false;
        if (shouldCreateLogin && employee) {
            // Check if user already exists
            let existingUser = null;
            if (hire.userId || employee.userId) {
                const uId = hire.userId || employee.userId;
                existingUser = await prisma_1.default.user.findUnique({ where: { id: uId } });
            }
            if (!existingUser && employee.email) {
                existingUser = await prisma_1.default.user.findUnique({ where: { email: employee.email } });
            }
            if (existingUser) {
                user = existingUser;
                isNewUser = false;
                userMessage = 'Existing login account linked';
                if (!employee.userId || employee.userId !== user.id) {
                    employee = await prisma_1.default.employee.update({
                        where: { id: employee.id },
                        data: { userId: user.id },
                    });
                }
            }
            else {
                // Check seat limit
                if (tenantId) {
                    const tenant = await prisma_1.default.tenant.findUnique({
                        where: { id: tenantId },
                        select: { maxUsers: true, packageKey: true, packagePermissions: true },
                    });
                    if (tenant) {
                        const userCount = await prisma_1.default.user.count({ where: { tenantId } });
                        if (userCount >= (tenant.maxUsers || 25)) {
                            throw new Error(`User seat limit reached (${tenant.maxUsers}). Cannot create login account. Please upgrade plan.`);
                        }
                    }
                }
                // Auto-generate secure clean temporary password if not supplied
                if (!plainPassword) {
                    const randNum = Math.floor(1000 + Math.random() * 9000);
                    plainPassword = `Welcome@${randNum}`;
                }
                const role = options.role || 'EMPLOYEE';
                let permissions = (0, permissions_1.normalizePermissions)(role, (0, permissions_1.defaultPermissionsForRole)(role));
                if (tenantId) {
                    const tenant = await prisma_1.default.tenant.findUnique({
                        where: { id: tenantId },
                        select: { packageKey: true, packagePermissions: true },
                    });
                    if (tenant) {
                        const pkg = (0, tenant_packages_1.getTenantPackage)(tenant.packageKey);
                        const ceiling = tenant.packagePermissions || pkg.permissions;
                        permissions = (0, tenant_packages_1.resolveTenantUserPermissions)(role, ceiling);
                    }
                }
                const hashedPassword = await bcryptjs_1.default.hash(plainPassword, 10);
                const displayName = `${employee.firstName} ${employee.lastName}`.trim();
                user = await prisma_1.default.user.create({
                    data: {
                        email: employee.email,
                        password: hashedPassword,
                        role,
                        displayName,
                        permissions,
                        status: 'ACTIVE',
                        tenantId: tenantId || null,
                        orgUnitId: employee.orgUnitId || options.orgUnitId || null,
                    },
                });
                isNewUser = true;
                userMessage = 'New login account created';
                // Link User to Employee
                employee = await prisma_1.default.employee.update({
                    where: { id: employee.id },
                    data: { userId: user.id },
                });
                // Dispatch Welcome Email
                if (options.sendWelcomeEmail !== false) {
                    try {
                        const emailRes = await (0, resend_service_1.sendWelcomeUserEmail)({
                            to: employee.email,
                            displayName,
                            email: employee.email,
                            password: plainPassword,
                            role,
                            employeeId: employee.employeeId,
                        });
                        emailSent = emailRes?.sent ?? false;
                    }
                    catch (err) {
                        console.warn('Welcome email delivery error:', err?.message || err);
                        emailSent = false;
                    }
                }
            }
        }
        // 3. Mark Tasks Done & Graduate Hire
        let tasks = Array.isArray(hire.tasks) ? [...hire.tasks] : [...DEFAULT_TASKS];
        tasks = tasks.map((t) => ({ ...t, done: true }));
        const hasLoginTask = tasks.some((t) => t.label === 'HRMS Login Account Created');
        if (!hasLoginTask && shouldCreateLogin) {
            tasks.unshift({ label: 'HRMS Login Account Created', done: true });
        }
        const recalc = recalcProgress(tasks);
        const updatedHire = await prisma_1.default.onboardingHire.update({
            where: { id },
            data: {
                employeeId: employee?.id || null,
                userId: user?.id || hire.userId || null,
                tasks,
                ...recalc,
                status: 'Completed',
            },
            include: { compensation: { include: { complianceProfile: true } } },
        });
        return {
            hire: updatedHire,
            employee: employee
                ? {
                    id: employee.id,
                    employeeId: employee.employeeId,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    name: `${employee.firstName} ${employee.lastName}`.trim(),
                    email: employee.email,
                    department: employee.department,
                    designation: employee.designation,
                    joiningDate: employee.joiningDate,
                    status: employee.status,
                }
                : null,
            user: user
                ? {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    displayName: user.displayName,
                    status: user.status,
                }
                : null,
            credentials: {
                email: employee?.email || hire.email,
                password: plainPassword || null,
                role: user?.role || 'EMPLOYEE',
                isNewUser,
                emailSent,
                message: userMessage,
            },
        };
    }
    static async delete(id, tenantId) {
        const hire = await this.getById(id, tenantId);
        if (!hire)
            throw new Error('Onboarding hire not found');
        await prisma_1.default.employeeCompensation.deleteMany({ where: { onboardingHireId: id } });
        return prisma_1.default.onboardingHire.delete({ where: { id } });
    }
}
exports.OnboardingService = OnboardingService;
//# sourceMappingURL=onboarding.service.js.map