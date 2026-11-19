"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const tenant_packages_1 = require("../../shared/tenant-packages");
const permissions_1 = require("../../shared/permissions");
const credential_crypto_1 = require("../../shared/crypto/credential-crypto");
const resend_service_1 = require("../../shared/email/resend.service");
const DEFAULT_LEVELS = [
    { levelOrder: 1, code: 'L1', displayName: 'Main Branch', isLeaf: false },
    { levelOrder: 2, code: 'L2', displayName: 'Division', isLeaf: false },
    { levelOrder: 3, code: 'L3', displayName: 'Site', isLeaf: true },
];
const DEFAULT_APPROVAL_LEVELS = [
    { level: 1, displayName: 'Site Approver' },
    { level: 2, displayName: 'Division Approver' },
    { level: 3, displayName: 'HQ Approver' },
];
function sanitizeTenantPermissions(raw, fallback) {
    const source = raw?.tabs ? raw : fallback;
    return {
        tabs: { ...(source.tabs || {}), platformConsole: false },
        actions: { ...(source.actions || {}), platform_manage_tenants: false },
    };
}
function slugify(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
function validateLevels(levels) {
    if (!Array.isArray(levels) || levels.length < 2) {
        throw new Error('At least 2 hierarchy levels are required');
    }
    const leafCount = levels.filter((l) => l.isLeaf === true).length;
    if (leafCount !== 1) {
        throw new Error('Exactly one hierarchy level must be marked isLeaf: true');
    }
    return levels.map((l, idx) => ({
        levelOrder: Number(l.levelOrder || idx + 1),
        code: String(l.code || `level-${idx + 1}`),
        displayName: String(l.displayName || l.code || `Level ${idx + 1}`),
        isLeaf: Boolean(l.isLeaf),
    }));
}
async function getTenantStatsForId(tenantId) {
    const orgUnits = await prisma_1.default.orgUnit.findMany({
        where: { tenantId },
        select: { id: true, levelOrder: true, name: true },
    });
    const orgUnitIds = orgUnits.map((o) => o.id);
    const users = await prisma_1.default.user.findMany({
        where: { tenantId },
        select: { id: true, role: true, status: true, orgUnitId: true },
    });
    const [employeeCount, pendingApprovals] = await Promise.all([
        orgUnitIds.length
            ? prisma_1.default.employee.count({ where: { orgUnitId: { in: orgUnitIds } } })
            : Promise.resolve(0),
        prisma_1.default.approvalRequest.count({ where: { tenantId, status: 'PENDING' } }),
    ]);
    const usersByRole = {};
    const usersByStatus = {};
    for (const u of users) {
        usersByRole[u.role] = (usersByRole[u.role] || 0) + 1;
        usersByStatus[u.status] = (usersByStatus[u.status] || 0) + 1;
    }
    const levelCounts = {};
    for (const ou of orgUnits) {
        if (!levelCounts[ou.levelOrder])
            levelCounts[ou.levelOrder] = { orgUnitCount: 0, userCount: 0 };
        levelCounts[ou.levelOrder].orgUnitCount += 1;
    }
    for (const u of users) {
        if (!u.orgUnitId)
            continue;
        const ou = orgUnits.find((o) => o.id === u.orgUnitId);
        if (!ou)
            continue;
        if (!levelCounts[ou.levelOrder])
            levelCounts[ou.levelOrder] = { orgUnitCount: 0, userCount: 0 };
        levelCounts[ou.levelOrder].userCount += 1;
    }
    return {
        userCount: users.length,
        orgUnitCount: orgUnits.length,
        employeeCount,
        pendingApprovals,
        activeUsers: users.filter((u) => u.status === 'ACTIVE').length,
        managers: users.filter((u) => u.role === 'MANAGER' || u.role === 'HR').length,
        usersByRole,
        usersByStatus,
        byHierarchyLevel: Object.entries(levelCounts)
            .map(([levelOrder, counts]) => ({
            levelOrder: Number(levelOrder),
            orgUnitCount: counts.orgUnitCount,
            userCount: counts.userCount,
        }))
            .sort((a, b) => a.levelOrder - b.levelOrder),
    };
}
function serializeTenant(tenant, stats) {
    const pkg = (0, tenant_packages_1.getTenantPackage)(tenant.packageKey);
    return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        packageKey: tenant.packageKey,
        packageLabel: pkg.label,
        maxUsers: tenant.maxUsers ?? pkg.maxUsers,
        packagePermissions: tenant.packagePermissions || pkg.permissions,
        hierarchyLevels: tenant.hierarchyLevels,
        approvalLevels: tenant.approvalLevels,
        orgUnits: tenant.orgUnits?.map((u) => ({
            id: u.id,
            name: u.name,
            levelOrder: u.levelOrder,
            isLeaf: u.isLeaf,
            status: u.status,
            parentId: u.parentId,
        })),
        stats: stats || {
            userCount: tenant._count?.users ?? 0,
            orgUnitCount: tenant._count?.orgUnits ?? 0,
            employeeCount: 0,
            pendingApprovals: 0,
            activeUsers: 0,
            managers: 0,
            usersByRole: {},
            usersByStatus: {},
            byHierarchyLevel: [],
        },
        provisionedAdminEmail: tenant.provisionedAdminEmail || null,
        hasProvisionedCredentials: Boolean(tenant.provisionedAdminPassword),
        showUsersLocationColumn: Boolean(tenant.showUsersLocationColumn),
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
    };
}
async function deleteOrgUnitsForTenant(tenantId) {
    while (await prisma_1.default.orgUnit.count({ where: { tenantId } }) > 0) {
        const leaves = await prisma_1.default.orgUnit.findMany({
            where: { tenantId, children: { none: {} } },
            select: { id: true },
        });
        if (leaves.length === 0)
            break;
        await prisma_1.default.orgUnit.deleteMany({ where: { id: { in: leaves.map((l) => l.id) } } });
    }
}
class PlatformService {
    static listPackages() {
        return tenant_packages_1.TENANT_PACKAGES.map((p) => ({
            key: p.key,
            label: p.label,
            description: p.description,
            maxUsers: p.maxUsers,
            enabledTabs: Object.entries(p.permissions.tabs).filter(([, v]) => v).map(([k]) => k),
            enabledActions: Object.entries(p.permissions.actions).filter(([, v]) => v).map(([k]) => k),
        }));
    }
    static async getStatsSummary(filters) {
        const tenants = await prisma_1.default.tenant.findMany({ orderBy: { createdAt: 'desc' } });
        const rows = await Promise.all(tenants.map(async (t) => {
            const stats = await getTenantStatsForId(t.id);
            return serializeTenant(t, stats);
        }));
        let filtered = rows;
        if (filters?.packageKey) {
            filtered = filtered.filter((t) => t.packageKey === filters.packageKey);
        }
        if (filters?.status) {
            filtered = filtered.filter((t) => t.status === filters.status);
        }
        if (filters?.minUsers !== undefined) {
            filtered = filtered.filter((t) => t.stats.userCount >= Number(filters.minUsers));
        }
        if (filters?.maxUsers !== undefined) {
            filtered = filtered.filter((t) => t.stats.userCount <= Number(filters.maxUsers));
        }
        return {
            totals: {
                tenants: rows.length,
                users: rows.reduce((s, t) => s + t.stats.userCount, 0),
                employees: rows.reduce((s, t) => s + t.stats.employeeCount, 0),
                pendingApprovals: rows.reduce((s, t) => s + t.stats.pendingApprovals, 0),
            },
            tenants: filtered,
        };
    }
    static async listTenants() {
        const tenants = await prisma_1.default.tenant.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                hierarchyLevels: { orderBy: { levelOrder: 'asc' } },
                approvalLevels: { orderBy: { level: 'asc' } },
                orgUnits: { where: { parentId: null }, take: 1 },
                _count: { select: { users: true, orgUnits: true } },
            },
        });
        return Promise.all(tenants.map(async (t) => serializeTenant(t, await getTenantStatsForId(t.id))));
    }
    static async getTenant(id) {
        const tenant = await prisma_1.default.tenant.findUnique({
            where: { id },
            include: {
                hierarchyLevels: { orderBy: { levelOrder: 'asc' } },
                approvalLevels: { orderBy: { level: 'asc' } },
                orgUnits: { orderBy: [{ levelOrder: 'asc' }, { name: 'asc' }] },
                _count: { select: { users: true, orgUnits: true } },
            },
        });
        if (!tenant)
            throw new Error('Tenant not found');
        return serializeTenant(tenant, await getTenantStatsForId(id));
    }
    static async createTenant(data) {
        const name = String(data.name || '').trim();
        if (!name)
            throw new Error('Tenant name is required');
        const slug = slugify(data.slug || name);
        if (!slug)
            throw new Error('Valid tenant slug is required');
        const existing = await prisma_1.default.tenant.findUnique({ where: { slug } });
        if (existing)
            throw new Error(`Tenant slug "${slug}" already exists`);
        const adminEmail = data.tenantAdmin?.email?.trim().toLowerCase();
        const adminName = data.tenantAdmin?.displayName?.trim();
        const plainPassword = data.tenantAdmin?.password?.trim();
        if (!adminEmail || !plainPassword || !adminName) {
            throw new Error('Tenant admin name, email, and password are required');
        }
        const levels = validateLevels(data.levels?.length ? data.levels : DEFAULT_LEVELS);
        const rootOrgName = String(data.rootOrgName || `${name} Main Branch`).trim();
        const pkg = (0, tenant_packages_1.getTenantPackage)(data.packageKey || 'STARTER');
        const tenant = await prisma_1.default.$transaction(async (tx) => {
            const created = await tx.tenant.create({
                data: {
                    name,
                    slug,
                    status: 'ACTIVE',
                    packageKey: pkg.key,
                    maxUsers: data.maxUsers ?? pkg.maxUsers,
                    packagePermissions: sanitizeTenantPermissions(data.customPermissions, pkg.permissions),
                    provisionedAdminEmail: adminEmail,
                    provisionedAdminPassword: (0, credential_crypto_1.encryptCredential)(plainPassword),
                    hierarchyLevels: { create: levels },
                    approvalLevels: { create: DEFAULT_APPROVAL_LEVELS },
                },
            });
            const root = await tx.orgUnit.create({
                data: {
                    tenantId: created.id,
                    parentId: null,
                    levelOrder: 1,
                    name: rootOrgName,
                    path: '',
                    isLeaf: false,
                    status: 'ACTIVE',
                },
            });
            const path = `/${created.id}/${root.id}/`;
            await tx.orgUnit.update({ where: { id: root.id }, data: { path } });
            const dup = await tx.user.findUnique({ where: { email: adminEmail } });
            if (dup)
                throw new Error(`Email ${adminEmail} is already registered`);
            const tenantAdminUser = await tx.user.create({
                data: {
                    email: adminEmail,
                    password: await bcryptjs_1.default.hash(plainPassword, 10),
                    role: 'ADMIN',
                    displayName: adminName,
                    permissions: (0, tenant_packages_1.resolveTenantUserPermissions)('ADMIN', pkg.permissions),
                    status: 'ACTIVE',
                    tenantId: created.id,
                    orgUnitId: root.id,
                },
            });
            await tx.tenant.update({
                where: { id: created.id },
                data: { provisionedAdminUserId: tenantAdminUser.id },
            });
            return { tenant: created, root, tenantAdminUser, plainPassword };
        });
        let emailResult = null;
        if (tenant.tenantAdminUser && adminEmail && tenant.plainPassword) {
            emailResult = await (0, resend_service_1.sendTenantAdminWelcomeEmail)({
                to: adminEmail,
                displayName: tenant.tenantAdminUser.displayName || `${name} Admin`,
                email: adminEmail,
                password: tenant.plainPassword,
                role: 'ADMIN',
                tenantName: name,
            });
        }
        const full = await this.getTenant(tenant.tenant.id);
        return {
            ...full,
            tenantAdmin: {
                id: tenant.tenantAdminUser.id,
                email: tenant.tenantAdminUser.email,
                displayName: tenant.tenantAdminUser.displayName,
                role: tenant.tenantAdminUser.role,
                password: tenant.plainPassword || null,
            },
            email: emailResult,
            rootOrgUnitId: tenant.root.id,
        };
    }
    static async getTenantCredentials(id) {
        const tenant = await prisma_1.default.tenant.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                provisionedAdminUserId: true,
                provisionedAdminEmail: true,
                provisionedAdminPassword: true,
            },
        });
        if (!tenant)
            throw new Error('Tenant not found');
        let userId = tenant.provisionedAdminUserId;
        let email = tenant.provisionedAdminEmail;
        if (!userId || !email) {
            const adminUser = await prisma_1.default.user.findFirst({
                where: { tenantId: id, role: 'ADMIN' },
                orderBy: { createdAt: 'asc' },
                select: { id: true, email: true, displayName: true, role: true },
            });
            if (adminUser) {
                userId = adminUser.id;
                email = adminUser.email;
            }
        }
        if (!userId && !email) {
            return {
                tenantId: tenant.id,
                tenantName: tenant.name,
                userId: null,
                email: null,
                password: null,
                message: 'No tenant admin account found for this client.',
            };
        }
        const password = tenant.provisionedAdminPassword
            ? (0, credential_crypto_1.decryptCredential)(tenant.provisionedAdminPassword)
            : null;
        return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            userId,
            email,
            password,
            message: password
                ? null
                : 'Password not stored for this tenant. Reset the admin password or recreate provisioning.',
        };
    }
    static async updateTenant(id, data) {
        const tenant = await prisma_1.default.tenant.findUnique({ where: { id } });
        if (!tenant)
            throw new Error('Tenant not found');
        const slug = data.slug ? slugify(data.slug) : undefined;
        if (slug && slug !== tenant.slug) {
            const dup = await prisma_1.default.tenant.findUnique({ where: { slug } });
            if (dup)
                throw new Error(`Tenant slug "${slug}" already exists`);
        }
        await prisma_1.default.tenant.update({
            where: { id },
            data: {
                name: data.name?.trim() || tenant.name,
                slug: slug || tenant.slug,
                status: data.status || tenant.status,
                ...(typeof data.showUsersLocationColumn === 'boolean'
                    ? { showUsersLocationColumn: data.showUsersLocationColumn }
                    : {}),
            },
        });
        if (data.rootOrgName) {
            const root = await prisma_1.default.orgUnit.findFirst({ where: { tenantId: id, parentId: null } });
            if (root) {
                await prisma_1.default.orgUnit.update({ where: { id: root.id }, data: { name: data.rootOrgName.trim() } });
            }
        }
        return this.getTenant(id);
    }
    static async updateTenantAdmin(id, data) {
        const tenant = await prisma_1.default.tenant.findUnique({ where: { id } });
        if (!tenant)
            throw new Error('Tenant not found');
        let userId = tenant.provisionedAdminUserId;
        let adminUser = userId
            ? await prisma_1.default.user.findUnique({ where: { id: userId } })
            : null;
        if (!adminUser) {
            adminUser = await prisma_1.default.user.findFirst({
                where: { tenantId: id, role: 'ADMIN' },
                orderBy: { createdAt: 'asc' },
            });
            userId = adminUser?.id || null;
        }
        if (!adminUser || !userId) {
            throw new Error('No tenant admin account found for this client');
        }
        const email = data.email?.trim().toLowerCase();
        if (email && email !== adminUser.email) {
            const dup = await prisma_1.default.user.findUnique({ where: { email } });
            if (dup)
                throw new Error(`Email ${email} is already registered`);
        }
        const plainPassword = data.password?.trim();
        await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                displayName: data.displayName?.trim() || adminUser.displayName,
                email: email || adminUser.email,
                ...(plainPassword ? { password: await bcryptjs_1.default.hash(plainPassword, 10) } : {}),
            },
        });
        await prisma_1.default.tenant.update({
            where: { id },
            data: {
                provisionedAdminUserId: userId,
                provisionedAdminEmail: email || adminUser.email,
                ...(plainPassword ? { provisionedAdminPassword: (0, credential_crypto_1.encryptCredential)(plainPassword) } : {}),
            },
        });
        return this.getTenantCredentials(id);
    }
    static async updateTenantPackage(id, data) {
        const tenant = await prisma_1.default.tenant.findUnique({ where: { id } });
        if (!tenant)
            throw new Error('Tenant not found');
        const pkg = (0, tenant_packages_1.getTenantPackage)(data.packageKey);
        const packagePermissions = sanitizeTenantPermissions(data.customPermissions, pkg.permissions);
        await prisma_1.default.tenant.update({
            where: { id },
            data: {
                packageKey: pkg.key,
                maxUsers: data.maxUsers ?? pkg.maxUsers,
                packagePermissions: packagePermissions,
            },
        });
        await this.syncTenantUserPermissions(id, packagePermissions);
        return this.getTenant(id);
    }
    static async syncTenantUserPermissions(tenantId, packagePermissions) {
        const users = await prisma_1.default.user.findMany({
            where: { tenantId },
            select: { id: true, role: true },
        });
        await Promise.all(users.map((user) => {
            const effective = user.role === 'PLATFORM_OWNER'
                ? (0, permissions_1.defaultPermissionsForRole)(user.role)
                : (0, tenant_packages_1.resolveTenantUserPermissions)(user.role, packagePermissions);
            return prisma_1.default.user.update({
                where: { id: user.id },
                data: { permissions: effective },
            });
        }));
    }
    static async deleteTenant(id) {
        const tenant = await prisma_1.default.tenant.findUnique({ where: { id } });
        if (!tenant)
            throw new Error('Tenant not found');
        const orgUnitIds = (await prisma_1.default.orgUnit.findMany({ where: { tenantId: id }, select: { id: true } })).map((o) => o.id);
        const employeeIds = orgUnitIds.length
            ? (await prisma_1.default.employee.findMany({ where: { orgUnitId: { in: orgUnitIds } }, select: { id: true } })).map((e) => e.id)
            : [];
        if (employeeIds.length > 0) {
            await prisma_1.default.leave.deleteMany({ where: { employeeId: { in: employeeIds } } });
            await prisma_1.default.attendance.deleteMany({ where: { employeeId: { in: employeeIds } } });
            await prisma_1.default.task.deleteMany({ where: { assignedTo: { in: employeeIds } } });
            await prisma_1.default.performanceReview.deleteMany({ where: { employeeId: { in: employeeIds } } });
            await prisma_1.default.document.deleteMany({ where: { employeeId: { in: employeeIds } } });
            await prisma_1.default.assetAllocation.deleteMany({ where: { employeeId: { in: employeeIds } } });
            await prisma_1.default.employee.deleteMany({ where: { id: { in: employeeIds } } });
        }
        await prisma_1.default.approvalRequest.deleteMany({ where: { tenantId: id } });
        await prisma_1.default.user.updateMany({ where: { tenantId: id }, data: { tenantId: null, orgUnitId: null } });
        await prisma_1.default.user.deleteMany({ where: { tenantId: id } });
        await deleteOrgUnitsForTenant(id);
        await prisma_1.default.tenantHierarchyLevel.deleteMany({ where: { tenantId: id } });
        await prisma_1.default.tenantApprovalLevel.deleteMany({ where: { tenantId: id } });
        await prisma_1.default.tenant.delete({ where: { id } });
        return { success: true };
    }
}
exports.PlatformService = PlatformService;
//# sourceMappingURL=platform.service.js.map