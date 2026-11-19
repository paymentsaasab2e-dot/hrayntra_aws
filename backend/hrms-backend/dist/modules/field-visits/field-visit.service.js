"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldVisitService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const geo_1 = require("../../shared/utils/geo");
function localDateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function todayKey(d = new Date()) {
    return localDateKey(d);
}
function parseDateKey(dateKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
    if (!match)
        throw new Error('Invalid date format. Use YYYY-MM-DD');
    return dateKey;
}
const VISIT_USAGES = ['VISITS', 'BOTH'];
function isVisitEnabledLocation(loc) {
    const usage = loc.usage ?? 'BOTH';
    return VISIT_USAGES.includes(usage);
}
const employeeSelect = {
    id: true,
    employeeId: true,
    firstName: true,
    lastName: true,
    department: true,
    designation: true,
};
/** Resolve location FK — supports legacy stopId field name in DB. */
function assignmentLocationId(row) {
    return row.locationId || row.stopId || '';
}
async function loadLocationsMap(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0)
        return new Map();
    const rows = await prisma_1.default.workLocation.findMany({ where: { id: { in: unique } } });
    return new Map(rows.map((loc) => [loc.id, loc]));
}
async function enrichAssignments(rows, withEmployee = false) {
    const locMap = await loadLocationsMap(rows.map(assignmentLocationId));
    let employeeMap = new Map();
    if (withEmployee) {
        const empIds = [...new Set(rows.map((r) => r.employeeId))];
        const employees = await prisma_1.default.employee.findMany({
            where: { id: { in: empIds } },
            select: employeeSelect,
        });
        employeeMap = new Map(employees.map((e) => [e.id, e]));
    }
    return rows.map((row) => ({
        ...row,
        location: locMap.get(assignmentLocationId(row)) ?? null,
        ...(withEmployee ? { employee: employeeMap.get(row.employeeId) ?? null } : {}),
    }));
}
class FieldVisitService {
    static async listVisitLocations(activeOnly = false) {
        const rows = await prisma_1.default.workLocation.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: { name: 'asc' },
            include: { _count: { select: { employees: true } } },
        });
        return rows.filter((loc) => isVisitEnabledLocation(loc) && (!activeOnly || loc.isActive));
    }
    static async listRoster(dateKey, scopedEmployeeIds, employeeId) {
        const key = parseDateKey(dateKey);
        const where = { dateKey: key };
        if (employeeId) {
            where.employeeId = employeeId;
        }
        else if (scopedEmployeeIds !== null) {
            where.employeeId = { in: scopedEmployeeIds };
        }
        const rows = await prisma_1.default.fieldVisitAssignment.findMany({
            where,
            orderBy: [{ employeeId: 'asc' }, { sequence: 'asc' }],
        });
        return enrichAssignments(rows, true);
    }
    static async assignRoster(data) {
        const key = parseDateKey(data.dateKey);
        if (!data.employeeId)
            throw new Error('Employee is required');
        if (!Array.isArray(data.locationIds) || data.locationIds.length === 0) {
            throw new Error('At least one location is required');
        }
        const employee = await prisma_1.default.employee.findUnique({ where: { id: data.employeeId } });
        if (!employee)
            throw new Error('Employee not found');
        const locations = await prisma_1.default.workLocation.findMany({
            where: { id: { in: data.locationIds }, isActive: true },
        });
        const visitLocations = locations.filter(isVisitEnabledLocation);
        if (visitLocations.length !== data.locationIds.length) {
            throw new Error('One or more locations not found or not enabled for tracking');
        }
        await prisma_1.default.fieldVisitAssignment.deleteMany({
            where: { dateKey: key, employeeId: data.employeeId },
        });
        const rows = await Promise.all(data.locationIds.map((locationId, index) => prisma_1.default.fieldVisitAssignment.create({
            data: {
                dateKey: key,
                employeeId: data.employeeId,
                locationId,
                sequence: index,
                plannedTime: data.plannedTimes?.[index] || null,
                status: 'PENDING',
            },
        })));
        return enrichAssignments(rows, true);
    }
    static async removeAssignment(id) {
        const row = await prisma_1.default.fieldVisitAssignment.findUnique({ where: { id } });
        if (!row)
            throw new Error('Assignment not found');
        await prisma_1.default.fieldVisitAssignment.delete({ where: { id } });
        return { success: true };
    }
    static async getMineToday(userId) {
        const employee = await prisma_1.default.employee.findFirst({ where: { userId } });
        if (!employee)
            return { employee: null, assignments: [] };
        const assignments = await prisma_1.default.fieldVisitAssignment.findMany({
            where: { employeeId: employee.id, dateKey: todayKey() },
            orderBy: { sequence: 'asc' },
        });
        const lastPing = await prisma_1.default.fieldVisitLocationPing.findFirst({
            where: { employeeId: employee.id },
            orderBy: { recordedAt: 'desc' },
        });
        return {
            employee,
            assignments: await enrichAssignments(assignments),
            lastPing,
        };
    }
    static async verifyVisit(assignmentId, userId, lat, lng, allowHrOverride = false) {
        const assignment = await prisma_1.default.fieldVisitAssignment.findUnique({
            where: { id: assignmentId },
        });
        if (!assignment)
            throw new Error('Assignment not found');
        if (assignment.status === 'VERIFIED')
            throw new Error('Location already verified');
        const owner = await prisma_1.default.employee.findUnique({
            where: { id: assignment.employeeId },
            select: { userId: true },
        });
        const isOwner = owner?.userId === userId;
        if (!isOwner && !allowHrOverride) {
            throw new Error('You can only verify your own visit assignments');
        }
        const location = await prisma_1.default.workLocation.findUnique({
            where: { id: assignmentLocationId(assignment) },
        });
        if (!location)
            throw new Error('Location not found for this assignment');
        const userLat = Number(lat);
        const userLng = Number(lng);
        if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
            throw new Error('Valid GPS coordinates are required');
        }
        const { inside, distanceMeters } = (0, geo_1.isInsideGeofence)(userLat, userLng, location.lat, location.lng, location.radiusMeters);
        if (!inside && !allowHrOverride) {
            throw new Error(`You are ${Math.round(distanceMeters)}m from ${location.name}. Move within ${location.radiusMeters}m to verify.`);
        }
        const updated = await prisma_1.default.fieldVisitAssignment.update({
            where: { id: assignmentId },
            data: {
                status: inside ? 'VERIFIED' : allowHrOverride ? 'VERIFIED' : 'MISSED',
                verifiedAt: new Date(),
                verifyLat: userLat,
                verifyLng: userLng,
                distanceMeters,
            },
        });
        const [enriched] = await enrichAssignments([updated], true);
        return enriched;
    }
    static async markMissed(id) {
        const updated = await prisma_1.default.fieldVisitAssignment.update({
            where: { id },
            data: { status: 'MISSED' },
        });
        const [enriched] = await enrichAssignments([updated], true);
        return enriched;
    }
    static async recordPing(userId, lat, lng) {
        const employee = await prisma_1.default.employee.findFirst({ where: { userId } });
        if (!employee)
            throw new Error('Employee profile required');
        const userLat = Number(lat);
        const userLng = Number(lng);
        if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
            throw new Error('Valid GPS coordinates are required');
        }
        return prisma_1.default.fieldVisitLocationPing.create({
            data: { employeeId: employee.id, lat: userLat, lng: userLng },
        });
    }
    static async getLiveSnapshot(dateKey, scopedEmployeeIds) {
        const key = parseDateKey(dateKey);
        const employeeWhere = {};
        if (scopedEmployeeIds !== null) {
            employeeWhere.id = { in: scopedEmployeeIds };
        }
        const employees = await prisma_1.default.employee.findMany({
            where: employeeWhere,
            select: employeeSelect,
        });
        const employeeIds = employees.map((e) => e.id);
        if (employeeIds.length === 0)
            return [];
        const [assignments, pings] = await Promise.all([
            prisma_1.default.fieldVisitAssignment.findMany({
                where: { dateKey: key, employeeId: { in: employeeIds } },
                orderBy: [{ employeeId: 'asc' }, { sequence: 'asc' }],
            }),
            prisma_1.default.fieldVisitLocationPing.findMany({
                where: { employeeId: { in: employeeIds } },
                orderBy: { recordedAt: 'desc' },
            }),
        ]);
        const enriched = await enrichAssignments(assignments);
        const lastPingByEmployee = new Map();
        for (const ping of pings) {
            if (!lastPingByEmployee.has(ping.employeeId)) {
                lastPingByEmployee.set(ping.employeeId, ping);
            }
        }
        return employees.map((emp) => {
            const empAssignments = enriched.filter((a) => a.employeeId === emp.id);
            const verified = empAssignments.filter((a) => a.status === 'VERIFIED').length;
            return {
                employee: emp,
                assignments: empAssignments,
                lastPing: lastPingByEmployee.get(emp.id) || null,
                progress: {
                    total: empAssignments.length,
                    verified,
                    pending: empAssignments.filter((a) => a.status === 'PENDING').length,
                },
            };
        });
    }
}
exports.FieldVisitService = FieldVisitService;
//# sourceMappingURL=field-visit.service.js.map