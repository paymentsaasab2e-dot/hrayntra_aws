import prisma from '../../shared/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { defaultPermissionsForRole, normalizePermissions } from '../../shared/permissions';
import { getTenantPackage, resolveTenantUserPermissions } from '../../shared/tenant-packages';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function mapLocationResponse(location: any) {
  if (!location) return null;
  return {
    id: location.id,
    name: location.name,
    address: location.address,
    lat: location.lat,
    lng: location.lng,
    radiusMeters: location.radiusMeters,
  };
}

function mapOrgUnitResponse(orgUnit: any) {
  if (!orgUnit) return null;
  return {
    id: orgUnit.id,
    name: orgUnit.name,
    levelOrder: orgUnit.levelOrder,
    isLeaf: orgUnit.isLeaf,
    path: orgUnit.path,
  };
}

function mapEmployeeResponse(employee: any) {
  if (!employee) return null;
  const location = mapLocationResponse(employee.location);
  const orgUnit = mapOrgUnitResponse(employee.orgUnit);
  return {
    id: employee.id,
    employeeId: employee.employeeId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    designation: employee.designation,
    department: employee.department,
    locationId: employee.locationId || location?.id || null,
    location,
    orgUnitId: employee.orgUnitId || orgUnit?.id || null,
    orgUnit,
    workLocationLat: location?.lat ?? null,
    workLocationLng: location?.lng ?? null,
    workLocationRadius: location?.radiusMeters ?? null,
    workLocationName: location?.name ?? null,
  };
}

function buildUserResponse(user: any, tenantRecord?: any) {
  const employee = user.employees?.[0] || null;
  let permissions = normalizePermissions(user.role, user.permissions);

  if (user.tenantId && tenantRecord && user.role !== 'PLATFORM_OWNER') {
    const pkg = getTenantPackage(tenantRecord.packageKey);
    const ceiling = (tenantRecord.packagePermissions as any) || pkg.permissions;
    permissions = resolveTenantUserPermissions(user.role, ceiling);
  }

  const pkg = user.tenantId && tenantRecord ? getTenantPackage(tenantRecord.packageKey) : null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName || user.email,
    status: user.status,
    permissions,
    tenantId: user.tenantId || null,
    tenantStatus: tenantRecord?.status || null,
    packageKey: tenantRecord?.packageKey || null,
    packageLabel: pkg?.label || null,
    maxUsers: tenantRecord?.maxUsers ?? pkg?.maxUsers ?? null,
    showUsersLocationColumn: Boolean(tenantRecord?.showUsersLocationColumn),
    orgUnitId: user.orgUnitId || employee?.orgUnitId || null,
    orgUnit: mapOrgUnitResponse(user.orgUnit || employee?.orgUnit),
    employee: mapEmployeeResponse(employee),
    employeeId: employee?.employeeId || null,
  };
}

async function loadTenantForUser(user: any) {
  if (!user?.tenantId) return null;
  return prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      packageKey: true,
      maxUsers: true,
      packagePermissions: true,
      showUsersLocationColumn: true,
    },
  });
}

export class AuthService {
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        employees: {
          take: 1,
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
            department: true,
            locationId: true,
            location: {
              select: {
                id: true,
                name: true,
                address: true,
                lat: true,
                lng: true,
                radiusMeters: true,
              },
            },
            orgUnit: {
              select: { id: true, name: true, levelOrder: true, isLeaf: true, path: true },
            },
          },
        },
        orgUnit: {
          select: { id: true, name: true, levelOrder: true, isLeaf: true, path: true },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('Invalid credentials');
    }

    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { status: true } });
      if (tenant?.status === 'SUSPENDED' || tenant?.status === 'INACTIVE') {
        throw new Error('This client account is inactive or suspended. Contact platform support.');
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const employeeRecordId = user.employees[0]?.id;
    const tenantRecord = await loadTenantForUser(user);
    let permissions = normalizePermissions(user.role, user.permissions);
    if (tenantRecord && user.role !== 'PLATFORM_OWNER') {
      const pkg = getTenantPackage(tenantRecord.packageKey);
      permissions = resolveTenantUserPermissions(
        user.role,
        (tenantRecord.packagePermissions as any) || pkg.permissions
      );
    }
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        employeeId: employeeRecordId,
        tenantId: user.tenantId || null,
        orgUnitId: user.orgUnitId || user.employees[0]?.orgUnit?.id || null,
        permissions,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { token, user: buildUserResponse(user, tenantRecord) };
  }

  static async register(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const role = data.role || 'EMPLOYEE';

    return prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role,
        displayName: data.displayName || data.email,
        permissions: data.permissions || defaultPermissionsForRole(role),
        status: data.status || 'ACTIVE',
      },
    });
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employees: {
          take: 1,
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
            department: true,
            locationId: true,
            location: {
              select: {
                id: true,
                name: true,
                address: true,
                lat: true,
                lng: true,
                radiusMeters: true,
              },
            },
            orgUnit: {
              select: { id: true, name: true, levelOrder: true, isLeaf: true, path: true },
            },
          },
        },
        orgUnit: {
          select: { id: true, name: true, levelOrder: true, isLeaf: true, path: true },
        },
      },
    });

    if (!user) throw new Error('User not found');
    const tenantRecord = await loadTenantForUser(user);
    return buildUserResponse(user, tenantRecord);
  }
}
