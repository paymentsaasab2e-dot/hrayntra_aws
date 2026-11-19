import prisma from '../../shared/prisma';
import bcrypt from 'bcryptjs';
import { defaultPermissionsForRole, normalizePermissions } from '../../shared/permissions';
import { getTenantPackage, resolveTenantUserPermissions } from '../../shared/tenant-packages';
import { sendWelcomeUserEmail } from '../../shared/email/resend.service';
import {
  ensureOnboardingPipeline,
  provisionEmployeeForUser,
  splitDisplayName,
} from '../../shared/provisioning/memberProvisioning';

function serializeUser(user: any) {
  const employee = user.employees?.[0] || null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName || user.email,
    status: user.status,
    permissions: normalizePermissions(user.role, user.permissions),
    employee: employee
      ? {
          id: employee.id,
          employeeId: employee.employeeId,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          department: employee.department,
          designation: employee.designation,
          locationId: employee.locationId || null,
          locationName: employee.location?.name || null,
          orgUnitId: employee.orgUnitId || null,
          orgUnitName: employee.orgUnit?.name || null,
        }
      : null,
    orgUnitId: user.orgUnitId || null,
    orgUnitName: user.orgUnit?.name || null,
    createdAt: user.createdAt,
  };
}

export class UserService {
  static async getAll(scope?: { tenantId?: string | null; allowedOrgUnitIds?: string[] | null }) {
    if (!scope?.tenantId) {
      return [];
    }

    const where: any = { tenantId: scope.tenantId };
    if (scope.allowedOrgUnitIds !== null && scope.allowedOrgUnitIds !== undefined) {
      if (scope.allowedOrgUnitIds.length === 0) return [];
      where.orgUnitId = { in: scope.allowedOrgUnitIds };
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employees: {
          take: 1,
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            designation: true,
            locationId: true,
            location: { select: { id: true, name: true } },
            orgUnitId: true,
            orgUnit: { select: { id: true, name: true } },
          },
        },
        orgUnit: { select: { id: true, name: true } },
      },
    });
    return users.map(serializeUser);
  }

  static async create(data: any, actorTenantId?: string | null) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Email already in use');

    const role = data.role || 'EMPLOYEE';
    const displayName = data.displayName || data.email;
    const department = data.department || 'General';

    let tenantId: string | null = data.tenantId || actorTenantId || null;
    if (!tenantId && data.orgUnitId) {
      const ou = await prisma.orgUnit.findUnique({ where: { id: data.orgUnitId }, select: { tenantId: true } });
      tenantId = ou?.tenantId || null;
    }
    if (!tenantId) throw new Error('Tenant context required to create a user');

    // Org unit must belong to same tenant
    if (data.orgUnitId) {
      const ou = await prisma.orgUnit.findFirst({ where: { id: data.orgUnitId, tenantId } });
      if (!ou) throw new Error('Org unit not found in your company');
    }

    // Seat limit
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxUsers: true, packageKey: true, packagePermissions: true },
    });
    if (tenant) {
      const userCount = await prisma.user.count({ where: { tenantId } });
      if (userCount >= (tenant.maxUsers || 25)) {
        throw new Error(`User seat limit reached (${tenant.maxUsers}). Upgrade the package or remove users.`);
      }
    }

    let permissions = normalizePermissions(role, data.permissions || defaultPermissionsForRole(role));
    if (tenant) {
      const pkg = getTenantPackage(tenant.packageKey);
      const ceiling = (tenant.packagePermissions as any) || pkg.permissions;
      permissions = resolveTenantUserPermissions(role, ceiling);
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: await bcrypt.hash(data.password, 10),
        role,
        displayName,
        permissions,
        status: data.status || 'ACTIVE',
        tenantId,
        orgUnitId: data.orgUnitId || null,
      },
    });

    let employeeRecord: any = null;

    if (data.linkEmployeeRecordId) {
      employeeRecord = await prisma.employee.update({
        where: { id: data.linkEmployeeRecordId },
        data: {
          userId: user.id,
          email: data.email,
          tenantId,
          ...(data.locationId !== undefined ? { locationId: data.locationId || null } : {}),
          ...(data.orgUnitId !== undefined ? { orgUnitId: data.orgUnitId || null } : {}),
        },
      });
    } else if (data.createEmployee !== false) {
      employeeRecord = await provisionEmployeeForUser({
        userId: user.id,
        email: data.email,
        displayName,
        role,
        department,
        designation: data.designation,
        employeeCode: data.employeeCode,
        locationId: data.locationId,
        orgUnitId: data.orgUnitId,
        tenantId,
      });
    }

    const onboarding = await ensureOnboardingPipeline({
      name: displayName,
      role,
      department: employeeRecord?.department || department,
      email: data.email,
      employeeId: employeeRecord?.id || data.linkEmployeeRecordId || null,
      userId: user.id,
      loginCreated: true,
    });

    const created = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        employees: {
          take: 1,
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            designation: true,
            locationId: true,
            location: { select: { id: true, name: true } },
          },
        },
      },
    });

    const serialized = serializeUser(created);
    const plainPassword = String(data.password || '');

    const emailResult = plainPassword
      ? await sendWelcomeUserEmail({
          to: serialized.email,
          displayName: serialized.displayName,
          email: serialized.email,
          password: plainPassword,
          role: serialized.role,
          employeeId: serialized.employee?.employeeId || employeeRecord?.employeeId || null,
        })
      : { sent: false, skipped: true, message: 'Password missing — email not sent' };

    return {
      user: serialized,
      employee: employeeRecord
        ? {
            id: employeeRecord.id,
            employeeId: employeeRecord.employeeId,
            name: `${employeeRecord.firstName} ${employeeRecord.lastName}`,
          }
        : serialized.employee,
      onboarding: { id: onboarding.id, status: onboarding.status },
      email: emailResult,
    };
  }

  static async update(id: string, data: any, actorTenantId?: string | null) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error('User not found');
    if (actorTenantId && existing.tenantId && existing.tenantId !== actorTenantId) {
      throw new Error('User not found in your company');
    }

    const role = data.role || existing.role;
    const updateData: any = {
      email: data.email ?? existing.email,
      role,
      displayName: data.displayName ?? existing.displayName,
      status: data.status ?? existing.status,
    };

    if (data.permissions) {
      updateData.permissions = normalizePermissions(role, data.permissions);
    }
    if (data.orgUnitId !== undefined) {
      if (data.orgUnitId && actorTenantId) {
        const ou = await prisma.orgUnit.findFirst({ where: { id: data.orgUnitId, tenantId: actorTenantId } });
        if (!ou) throw new Error('Org unit not found in your company');
      }
      updateData.orgUnitId = data.orgUnitId || null;
    }

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    await prisma.user.update({ where: { id }, data: updateData });

    const linkedEmployee = await prisma.employee.findFirst({ where: { userId: id } });
    if (linkedEmployee) {
      const employeePatch: any = {};
      if (data.email) employeePatch.email = data.email;
      if (data.locationId !== undefined) employeePatch.locationId = data.locationId || null;
      if (data.orgUnitId !== undefined) employeePatch.orgUnitId = data.orgUnitId || null;
      if (actorTenantId) employeePatch.tenantId = actorTenantId;
      if (Object.keys(employeePatch).length > 0) {
        await prisma.employee.update({
          where: { id: linkedEmployee.id },
          data: employeePatch,
        });
      }
    }

    if (data.linkEmployeeRecordId) {
      await prisma.employee.updateMany({ where: { userId: id }, data: { userId: null } });
      const employeeRecord = await prisma.employee.update({
        where: { id: data.linkEmployeeRecordId },
        data: {
          userId: id,
          email: updateData.email,
          ...(actorTenantId ? { tenantId: actorTenantId } : {}),
          ...(data.locationId !== undefined ? { locationId: data.locationId || null } : {}),
          ...(data.orgUnitId !== undefined ? { orgUnitId: data.orgUnitId || null } : {}),
        },
      });

      await ensureOnboardingPipeline({
        name: updateData.displayName,
        role,
        department: employeeRecord.department,
        email: updateData.email,
        employeeId: employeeRecord.id,
        userId: id,
        loginCreated: true,
      });
    }

    const updated = await prisma.user.findUnique({
      where: { id },
      include: {
        employees: {
          take: 1,
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            designation: true,
            locationId: true,
            location: { select: { id: true, name: true } },
          },
        },
      },
    });

    return serializeUser(updated);
  }

  static async delete(id: string, actorTenantId?: string | null) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');
    if (actorTenantId && user.tenantId && user.tenantId !== actorTenantId) {
      throw new Error('User not found in your company');
    }
    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', ...(actorTenantId ? { tenantId: actorTenantId } : {}) },
      });
      if (adminCount <= 1) throw new Error('Cannot delete the last tenant admin account');
    }

    await prisma.employee.updateMany({ where: { userId: id }, data: { userId: null } });
    await prisma.user.delete({ where: { id } });
    return { success: true };
  }
}
