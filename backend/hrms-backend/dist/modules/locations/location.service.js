"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const tenant_scope_1 = require("../../shared/tenant/tenant-scope");
function locationWhere(scope, activeOnly = false) {
    const where = { ...(0, tenant_scope_1.tenantWhereFromScope)(scope) };
    if (activeOnly)
        where.isActive = true;
    // Org-wise: managers only see locations linked to their subtree (or unlinked tenant-wide HQ locs)
    if (scope.allowedOrgUnitIds !== null) {
        where.OR = [
            { orgUnitId: null },
            { orgUnitId: { in: scope.allowedOrgUnitIds } },
        ];
    }
    return where;
}
class LocationService {
    static async getAll(scope, activeOnly = false) {
        return prisma_1.default.workLocation.findMany({
            where: locationWhere(scope, activeOnly),
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { employees: true } },
            },
        });
    }
    static async getById(scope, id) {
        const location = await prisma_1.default.workLocation.findFirst({
            where: { id, ...locationWhere(scope) },
            include: {
                employees: {
                    select: {
                        id: true,
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
        if (!location)
            throw new Error('Work location not found');
        return location;
    }
    static async create(scope, data) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        const lat = Number(data.lat);
        const lng = Number(data.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new Error('Valid latitude and longitude are required');
        }
        let orgUnitId = data.orgUnitId || null;
        if (orgUnitId) {
            const ou = await prisma_1.default.orgUnit.findFirst({
                where: { id: orgUnitId, tenantId },
            });
            if (!ou)
                throw new Error('Org unit not found in your company');
            if (scope.allowedOrgUnitIds && !scope.allowedOrgUnitIds.includes(orgUnitId)) {
                throw new Error('You cannot attach a location outside your org scope');
            }
        }
        return prisma_1.default.workLocation.create({
            data: {
                name: data.name,
                address: data.address || null,
                lat,
                lng,
                radiusMeters: Number(data.radiusMeters) > 0 ? Number(data.radiusMeters) : 100,
                isActive: data.isActive !== false,
                usage: data.usage || 'BOTH',
                tenantId,
                orgUnitId,
            },
        });
    }
    static async update(scope, id, data) {
        const existing = await prisma_1.default.workLocation.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Work location not found');
        const updateData = {
            name: data.name ?? existing.name,
            address: data.address ?? existing.address,
            isActive: data.isActive ?? existing.isActive,
            usage: data.usage ?? existing.usage,
        };
        if (data.lat !== undefined)
            updateData.lat = Number(data.lat);
        if (data.lng !== undefined)
            updateData.lng = Number(data.lng);
        if (data.radiusMeters !== undefined) {
            updateData.radiusMeters = Number(data.radiusMeters) > 0 ? Number(data.radiusMeters) : 100;
        }
        if (data.orgUnitId !== undefined) {
            updateData.orgUnitId = data.orgUnitId || null;
        }
        return prisma_1.default.workLocation.update({ where: { id }, data: updateData });
    }
    static async delete(scope, id) {
        const existing = await prisma_1.default.workLocation.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Work location not found');
        const assigned = await prisma_1.default.employee.count({ where: { locationId: id } });
        if (assigned > 0) {
            throw new Error(`Cannot delete location: ${assigned} employee(s) still assigned`);
        }
        const visitAssignments = await prisma_1.default.fieldVisitAssignment.count({ where: { locationId: id } });
        if (visitAssignments > 0) {
            throw new Error(`Cannot delete location: used in ${visitAssignments} visit roster assignment(s)`);
        }
        await prisma_1.default.workLocation.delete({ where: { id } });
        return { success: true };
    }
}
exports.LocationService = LocationService;
//# sourceMappingURL=location.service.js.map