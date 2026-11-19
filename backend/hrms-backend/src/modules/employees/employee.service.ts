import prisma from '../../shared/prisma';
import { provisionOnboardingForEmployeeOnly } from '../../shared/provisioning/memberProvisioning';
import { OrgScopeContext, employeeWhereFromScope } from '../../shared/org/org-scope.service';
import { requireTenantId } from '../../shared/tenant/tenant-scope';

export class EmployeeService {
  static async getAll(scope?: OrgScopeContext) {
    if (!scope?.tenantId) return [];
    return prisma.employee.findMany({
      where: employeeWhereFromScope(scope),
      include: {
        user: { select: { email: true, role: true } },
        location: true,
        orgUnit: { select: { id: true, name: true, levelOrder: true, isLeaf: true } },
      },
    });
  }

  static async getById(id: string, scope?: OrgScopeContext) {
    if (!scope?.tenantId) return null;
    const employee = await prisma.employee.findFirst({
      where: { id, ...employeeWhereFromScope(scope) },
      include: {
        user: { select: { email: true, role: true } },
        location: true,
        orgUnit: { select: { id: true, name: true, levelOrder: true, isLeaf: true } },
      },
    });
    return employee;
  }

  static async create(scope: OrgScopeContext, data: any) {
    const tenantId = requireTenantId(scope);

    if (data.orgUnitId) {
      const ou = await prisma.orgUnit.findFirst({
        where: { id: data.orgUnitId, tenantId },
      });
      if (!ou) throw new Error('Org unit not found in your company');
    }

    const employee = await prisma.employee.create({
      data: {
        employeeId: data.employeeId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        designation: data.designation,
        department: data.department,
        joiningDate: new Date(data.joiningDate),
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        avatar: data.avatar || null,
        status: data.status || 'ACTIVE',
        locationId: data.locationId,
        orgUnitId: data.orgUnitId || null,
        reportsToUserId: data.reportsToUserId || null,
        totalLeaves: data.totalLeaves || 12,
        tenantId,
        ...(data.userId && { user: { connect: { id: data.userId } } }),
      },
    });

    await provisionOnboardingForEmployeeOnly({
      name: `${employee.firstName} ${employee.lastName}`,
      role: employee.designation,
      department: employee.department,
      email: employee.email,
      employeeId: employee.id,
    });

    return employee;
  }

  static async update(scope: OrgScopeContext, id: string, data: any) {
    const existing = await prisma.employee.findFirst({
      where: { id, ...employeeWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Employee not found');

    if (data.orgUnitId) {
      const tenantId = requireTenantId(scope);
      const ou = await prisma.orgUnit.findFirst({
        where: { id: data.orgUnitId, tenantId },
      });
      if (!ou) throw new Error('Org unit not found in your company');
    }

    const { tenantId: _ignore, ...safe } = data;
    return prisma.employee.update({
      where: { id },
      data: {
        ...safe,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
        dateOfBirth: data.dateOfBirth !== undefined ? (data.dateOfBirth ? new Date(data.dateOfBirth) : null) : undefined,
        avatar: data.avatar !== undefined ? data.avatar : undefined,
        locationId: data.locationId,
        orgUnitId: data.orgUnitId,
        reportsToUserId: data.reportsToUserId,
        totalLeaves: data.totalLeaves,
      },
    });
  }

  static async delete(scope: OrgScopeContext, id: string) {
    const employee = await prisma.employee.findFirst({
      where: { id, ...employeeWhereFromScope(scope) },
      select: { id: true, userId: true },
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    await prisma.$transaction([
      prisma.attendance.deleteMany({ where: { employeeId: id } }),
      prisma.leave.deleteMany({ where: { employeeId: id } }),
      prisma.task.deleteMany({ where: { assignedTo: id } }),
      prisma.assetAllocation.deleteMany({ where: { employeeId: id } }),
      prisma.document.deleteMany({ where: { employeeId: id } }),
      prisma.performanceReview.deleteMany({ where: { employeeId: id } }),
      prisma.employeeEmergencyContact.deleteMany({ where: { employeeId: id } }),
      prisma.employeeDependent.deleteMany({ where: { employeeId: id } }),
      prisma.employeeNominee.deleteMany({ where: { employeeId: id } }),
      prisma.employmentHistory.deleteMany({ where: { employeeId: id } }),
      prisma.employeeChangeRequest.deleteMany({ where: { employeeId: id } }),
      prisma.employee.delete({ where: { id } }),
    ]);

    return { success: true };
  }
}
