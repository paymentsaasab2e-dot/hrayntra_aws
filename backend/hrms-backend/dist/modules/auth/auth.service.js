"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const permissions_1 = require("../../shared/permissions");
const tenant_packages_1 = require("../../shared/tenant-packages");
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
function mapLocationResponse(location) {
    if (!location)
        return null;
    return {
        id: location.id,
        name: location.name,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        radiusMeters: location.radiusMeters,
    };
}
function mapOrgUnitResponse(orgUnit) {
    if (!orgUnit)
        return null;
    return {
        id: orgUnit.id,
        name: orgUnit.name,
        levelOrder: orgUnit.levelOrder,
        isLeaf: orgUnit.isLeaf,
        path: orgUnit.path,
    };
}
function mapEmployeeResponse(employee) {
    if (!employee)
        return null;
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
function buildUserResponse(user, tenantRecord) {
    const employee = user.employees?.[0] || null;
    let permissions = (0, permissions_1.normalizePermissions)(user.role, user.permissions);
    if (user.tenantId && tenantRecord && user.role !== 'PLATFORM_OWNER') {
        const pkg = (0, tenant_packages_1.getTenantPackage)(tenantRecord.packageKey);
        const ceiling = tenantRecord.packagePermissions || pkg.permissions;
        permissions = (0, tenant_packages_1.resolveTenantUserPermissions)(user.role, ceiling);
    }
    const pkg = user.tenantId && tenantRecord ? (0, tenant_packages_1.getTenantPackage)(tenantRecord.packageKey) : null;
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
async function loadTenantForUser(user) {
    if (!user?.tenantId)
        return null;
    return prisma_1.default.tenant.findUnique({
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
class AuthService {
    static async login(email, password) {
        const user = await prisma_1.default.user.findUnique({
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
            const tenant = await prisma_1.default.tenant.findUnique({ where: { id: user.tenantId }, select: { status: true } });
            if (tenant?.status === 'SUSPENDED' || tenant?.status === 'INACTIVE') {
                throw new Error('This client account is inactive or suspended. Contact platform support.');
            }
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }
        const employeeRecordId = user.employees[0]?.id;
        const tenantRecord = await loadTenantForUser(user);
        let permissions = (0, permissions_1.normalizePermissions)(user.role, user.permissions);
        if (tenantRecord && user.role !== 'PLATFORM_OWNER') {
            const pkg = (0, tenant_packages_1.getTenantPackage)(tenantRecord.packageKey);
            permissions = (0, tenant_packages_1.resolveTenantUserPermissions)(user.role, tenantRecord.packagePermissions || pkg.permissions);
        }
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: user.role,
            employeeId: employeeRecordId,
            tenantId: user.tenantId || null,
            orgUnitId: user.orgUnitId || user.employees[0]?.orgUnit?.id || null,
            permissions,
        }, JWT_SECRET, { expiresIn: '7d' });
        return { token, user: buildUserResponse(user, tenantRecord) };
    }
    static async register(data) {
        const hashedPassword = await bcryptjs_1.default.hash(data.password, 10);
        const role = data.role || 'EMPLOYEE';
        return prisma_1.default.user.create({
            data: {
                email: data.email,
                password: hashedPassword,
                role,
                displayName: data.displayName || data.email,
                permissions: data.permissions || (0, permissions_1.defaultPermissionsForRole)(role),
                status: data.status || 'ACTIVE',
            },
        });
    }
    static async getProfile(userId) {
        const user = await prisma_1.default.user.findUnique({
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
        if (!user)
            throw new Error('User not found');
        const tenantRecord = await loadTenantForUser(user);
        return buildUserResponse(user, tenantRecord);
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map