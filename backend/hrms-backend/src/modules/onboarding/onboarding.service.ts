import prisma from '../../shared/prisma';
import bcrypt from 'bcryptjs';
import { CompensationService } from '../compensation/compensation.service';
import { PolicyService } from '../policies/policy.service';
import { nextEmployeeCode } from '../../shared/provisioning/memberProvisioning';
import { sendWelcomeUserEmail } from '../../shared/email/resend.service';
import { defaultPermissionsForRole, normalizePermissions } from '../../shared/permissions';
import { getTenantPackage, resolveTenantUserPermissions } from '../../shared/tenant-packages';

const DEFAULT_TASKS = [
  { label: 'Salary & CTC Structure Assigned', done: false },
  { label: 'Hardware Allocation', done: false },
  { label: 'Email & Workspace Setup', done: false },
  { label: 'Policy Documentation Signature', done: false },
  { label: 'Induction Meeting', done: false },
  { label: 'Team Introduction', done: false },
];

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'New', lastName: 'Hire' };
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Hire' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function recalcProgress(tasks: { label: string; done: boolean }[]) {
  const completedCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const status = progress === 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Pending';
  return { progress, status };
}

export interface GraduationOptions {
  createLogin?: boolean;
  password?: string;
  role?: string;
  sendWelcomeEmail?: boolean;
  locationId?: string;
  orgUnitId?: string;
  employeeCode?: string;
}

export class OnboardingService {
  static async getAll(filters: any = {}, tenantId?: string | null) {
    // Fail closed: no tenant → empty list (never leak across companies)
    if (!tenantId) return [];

    const where: any = { tenantId };
    if (filters.status) where.status = filters.status;

    return prisma.onboardingHire.findMany({
      where,
      include: { compensation: { include: { complianceProfile: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getById(id: string, tenantId?: string | null) {
    const hire = await prisma.onboardingHire.findUnique({
      where: { id },
      include: { compensation: { include: { complianceProfile: true } } },
    });
    if (!hire) return null;
    if (tenantId && hire.tenantId && hire.tenantId !== tenantId) return null;
    return hire;
  }

  static async create(data: any, tenantId?: string | null) {
    if (!tenantId) throw new Error('Tenant context required to create onboarding hire');
    const tasks = data.tasks || DEFAULT_TASKS;
    const { progress, status } = recalcProgress(tasks);

    const hire = await prisma.onboardingHire.create({
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
        source: ['MANUAL', 'BULK_IMPORT', 'EXTERNAL_ATS'].includes(data.source)
          ? data.source
          : (data.source && (data.source.toUpperCase().includes('ATS') || data.source === 'PREBOARDING'))
          ? 'EXTERNAL_ATS'
          : 'MANUAL',
        joinDate: data.joinDate || new Date().toISOString().slice(0, 10),
        progress,
        status,
        tasks,
      },
    });

    if (tenantId && data.compensation) {
      await CompensationService.upsertCompensation(tenantId, {
        onboardingHireId: hire.id,
        ...data.compensation,
      });
      const tasksWithSalary = tasks.map((t: any) =>
        t.label === 'Salary & CTC Structure Assigned' ? { ...t, done: true } : t
      );
      const recalc = recalcProgress(tasksWithSalary);
      return prisma.onboardingHire.update({
        where: { id: hire.id },
        data: { tasks: tasksWithSalary, ...recalc },
        include: { compensation: { include: { complianceProfile: true } } },
      });
    }

    return prisma.onboardingHire.findUnique({
      where: { id: hire.id },
      include: { compensation: { include: { complianceProfile: true } } },
    });
  }

  static async bulkCreate(candidates: any[], tenantId?: string | null, source = 'BULK_IMPORT') {
    const created = [];
    for (const candidate of candidates) {
      const hire = await this.create({ ...candidate, source }, tenantId);
      created.push(hire);
    }
    return created;
  }

  static async update(id: string, data: any, tenantId?: string | null) {
    const existing = await this.getById(id, tenantId);
    if (!existing) throw new Error('Onboarding hire not found');

    const updated = await prisma.onboardingHire.update({
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
      await CompensationService.upsertCompensation(tenantId, {
        onboardingHireId: id,
        ...data.compensation,
      });
    }

    return prisma.onboardingHire.findUnique({
      where: { id },
      include: { compensation: { include: { complianceProfile: true } } },
    }) || updated;
  }

  static async updateTask(id: string, taskLabel: string, done: boolean, tenantId?: string | null) {
    const hire = await this.getById(id, tenantId);
    if (!hire) throw new Error('Onboarding hire not found');

    const tasks = (hire.tasks as any[]).map((t) =>
      t.label === taskLabel ? { ...t, done } : t
    );
    const recalc = recalcProgress(tasks);

    return prisma.onboardingHire.update({
      where: { id },
      data: { tasks, ...recalc },
      include: { compensation: { include: { complianceProfile: true } } },
    });
  }

  static async complete(id: string, tenantId?: string | null, options: GraduationOptions = {}) {
    const hire = await this.getById(id, tenantId);
    if (!hire) throw new Error('Onboarding hire not found');

    const { firstName, lastName } = splitName(hire.name);
    const email =
      hire.email?.trim() ||
      `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}@company.local`;

    // 1. Resolve or Create Employee
    let employee: any = null;
    if (hire.employeeId) {
      employee = await prisma.employee.findUnique({ where: { id: hire.employeeId } });
    }

    if (!employee) {
      // Check if employee with same email already exists
      const existingEmployee = await prisma.employee.findUnique({ where: { email } });
      if (existingEmployee) {
        employee = existingEmployee;
      } else {
        let employeeCode = options.employeeCode?.trim() || (await nextEmployeeCode());
        const codeConflict = await prisma.employee.findUnique({ where: { employeeId: employeeCode } });
        if (codeConflict) {
          employeeCode = await nextEmployeeCode();
        }

        const joiningDate = hire.joinDate ? new Date(hire.joinDate) : new Date();
        let probationEndDate: Date | null = null;
        if (tenantId) {
          try {
            const rules = await PolicyService.getActiveRules(tenantId);
            const probationMonths = rules?.exit?.probationMonths ?? 3;
            probationEndDate = new Date(joiningDate);
            probationEndDate.setMonth(probationEndDate.getMonth() + probationMonths);
          } catch {
            probationEndDate = new Date(joiningDate);
            probationEndDate.setMonth(probationEndDate.getMonth() + 3);
          }
        }

        employee = await prisma.employee.create({
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
        await CompensationService.linkCompensationToEmployee(id, employee.id, tenantId);
      } catch (e: any) {
        console.warn('Compensation link notice during graduation:', e?.message || e);
      }
    }

    // 2. Resolve or Create User Login Account
    let user: any = null;
    let plainPassword = options.password?.trim() || '';
    let isNewUser = false;
    let emailSent = false;
    let userMessage = '';
    const shouldCreateLogin = options.createLogin !== false;

    if (shouldCreateLogin && employee) {
      // Check if user already exists
      let existingUser: any = null;
      if (hire.userId || employee.userId) {
        const uId = hire.userId || employee.userId;
        existingUser = await prisma.user.findUnique({ where: { id: uId } });
      }
      if (!existingUser && employee.email) {
        existingUser = await prisma.user.findUnique({ where: { email: employee.email } });
      }

      if (existingUser) {
        user = existingUser;
        isNewUser = false;
        userMessage = 'Existing login account linked';
        if (!employee.userId || employee.userId !== user.id) {
          employee = await prisma.employee.update({
            where: { id: employee.id },
            data: { userId: user.id },
          });
        }
      } else {
        // Check seat limit
        if (tenantId) {
          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { maxUsers: true, packageKey: true, packagePermissions: true },
          });
          if (tenant) {
            const userCount = await prisma.user.count({ where: { tenantId } });
            if (userCount >= (tenant.maxUsers || 25)) {
              throw new Error(
                `User seat limit reached (${tenant.maxUsers}). Cannot create login account. Please upgrade plan.`
              );
            }
          }
        }

        // Auto-generate secure clean temporary password if not supplied
        if (!plainPassword) {
          const randNum = Math.floor(1000 + Math.random() * 9000);
          plainPassword = `Welcome@${randNum}`;
        }

        const role = (options.role as any) || 'EMPLOYEE';
        let permissions = normalizePermissions(role, defaultPermissionsForRole(role));

        if (tenantId) {
          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { packageKey: true, packagePermissions: true },
          });
          if (tenant) {
            const pkg = getTenantPackage(tenant.packageKey);
            const ceiling = (tenant.packagePermissions as any) || pkg.permissions;
            permissions = resolveTenantUserPermissions(role, ceiling);
          }
        }

        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        const displayName = `${employee.firstName} ${employee.lastName}`.trim();

        user = await prisma.user.create({
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
        employee = await prisma.employee.update({
          where: { id: employee.id },
          data: { userId: user.id },
        });

        // Dispatch Welcome Email
        if (options.sendWelcomeEmail !== false) {
          try {
            const emailRes = await sendWelcomeUserEmail({
              to: employee.email,
              displayName,
              email: employee.email,
              password: plainPassword,
              role,
              employeeId: employee.employeeId,
            });
            emailSent = emailRes?.sent ?? false;
          } catch (err: any) {
            console.warn('Welcome email delivery error:', err?.message || err);
            emailSent = false;
          }
        }
      }
    }

    // 3. Mark Tasks Done & Graduate Hire
    let tasks = Array.isArray(hire.tasks) ? [...hire.tasks] : [...DEFAULT_TASKS];
    tasks = tasks.map((t: any) => ({ ...t, done: true }));

    const hasLoginTask = tasks.some((t: any) => t.label === 'HRMS Login Account Created');
    if (!hasLoginTask && shouldCreateLogin) {
      tasks.unshift({ label: 'HRMS Login Account Created', done: true });
    }

    const recalc = recalcProgress(tasks);

    const updatedHire = await prisma.onboardingHire.update({
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

  static async delete(id: string, tenantId?: string | null) {
    const hire = await this.getById(id, tenantId);
    if (!hire) throw new Error('Onboarding hire not found');
    await prisma.employeeCompensation.deleteMany({ where: { onboardingHireId: id } });
    return prisma.onboardingHire.delete({ where: { id } });
  }
}
