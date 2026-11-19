"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Backfill tenantId on operational records that still have null tenantId.
 * Run from hrms-backend: npx ts-node src/scripts/backfill-tenant-ids.ts
 */
const prisma_1 = __importDefault(require("../shared/prisma"));
async function inferTenantFromOrgUnit(orgUnitId) {
    if (!orgUnitId)
        return null;
    const ou = await prisma_1.default.orgUnit.findUnique({ where: { id: orgUnitId }, select: { tenantId: true } });
    return ou?.tenantId || null;
}
async function inferTenantFromUser(userId) {
    if (!userId)
        return null;
    const user = await prisma_1.default.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    return user?.tenantId || null;
}
async function main() {
    let employeesUpdated = 0;
    const employees = await prisma_1.default.employee.findMany({
        where: { tenantId: null },
        select: { id: true, orgUnitId: true, userId: true },
    });
    for (const emp of employees) {
        const tenantId = (await inferTenantFromOrgUnit(emp.orgUnitId)) || (await inferTenantFromUser(emp.userId));
        if (!tenantId)
            continue;
        await prisma_1.default.employee.update({ where: { id: emp.id }, data: { tenantId } });
        employeesUpdated += 1;
    }
    let usersUpdated = 0;
    const users = await prisma_1.default.user.findMany({
        where: { tenantId: null, role: { not: 'PLATFORM_OWNER' } },
        select: { id: true, orgUnitId: true },
    });
    for (const user of users) {
        const tenantId = await inferTenantFromOrgUnit(user.orgUnitId);
        if (!tenantId)
            continue;
        await prisma_1.default.user.update({ where: { id: user.id }, data: { tenantId } });
        usersUpdated += 1;
    }
    // For assets/docs/holidays/projects/tasks/locations with null tenantId:
    // assign to the single tenant if only one exists; otherwise leave for manual review.
    const tenants = await prisma_1.default.tenant.findMany({ select: { id: true, name: true } });
    let singleTenantAssigned = 0;
    if (tenants.length === 1) {
        const tenantId = tenants[0].id;
        const updates = await Promise.all([
            prisma_1.default.asset.updateMany({ where: { tenantId: null }, data: { tenantId } }),
            prisma_1.default.document.updateMany({ where: { tenantId: null }, data: { tenantId } }),
            prisma_1.default.holiday.updateMany({ where: { tenantId: null }, data: { tenantId } }),
            prisma_1.default.project.updateMany({ where: { tenantId: null }, data: { tenantId } }),
            prisma_1.default.task.updateMany({ where: { tenantId: null }, data: { tenantId } }),
            prisma_1.default.workLocation.updateMany({ where: { tenantId: null }, data: { tenantId } }),
            prisma_1.default.onboardingHire.updateMany({ where: { tenantId: null }, data: { tenantId } }),
        ]);
        singleTenantAssigned = updates.reduce((sum, u) => sum + u.count, 0);
    }
    console.log(JSON.stringify({
        employeesUpdated,
        usersUpdated,
        tenantsFound: tenants.length,
        singleTenantRowsAssigned: singleTenantAssigned,
        note: tenants.length !== 1
            ? 'Multiple/zero tenants: asset/doc/holiday/project/task/location nulls were not auto-assigned'
            : 'OK',
    }, null, 2));
}
main()
    .catch((err) => {
    console.error(err);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.default.$disconnect();
});
//# sourceMappingURL=backfill-tenant-ids.js.map