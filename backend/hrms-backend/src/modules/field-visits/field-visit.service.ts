import prisma from '../../shared/prisma';
import { isInsideGeofence } from '../../shared/utils/geo';

function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey(d = new Date()) {
  return localDateKey(d);
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error('Invalid date format. Use YYYY-MM-DD');
  return dateKey;
}

const VISIT_USAGES = ['VISITS', 'BOTH'] as const;

function isVisitEnabledLocation(loc: { usage?: string | null; isActive?: boolean }) {
  const usage = loc.usage ?? 'BOTH';
  return VISIT_USAGES.includes(usage as (typeof VISIT_USAGES)[number]);
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
function assignmentLocationId(row: { locationId?: string; stopId?: string }) {
  return row.locationId || row.stopId || '';
}

async function loadLocationsMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map<string, Awaited<ReturnType<typeof prisma.workLocation.findFirst>>>();
  const rows = await prisma.workLocation.findMany({ where: { id: { in: unique } } });
  return new Map(rows.map((loc) => [loc.id, loc]));
}

async function enrichAssignments<T extends { locationId?: string; stopId?: string; employeeId: string }>(
  rows: T[],
  withEmployee = false
) {
  const locMap = await loadLocationsMap(rows.map(assignmentLocationId));
  let employeeMap = new Map<string, any>();
  if (withEmployee) {
    const empIds = [...new Set(rows.map((r) => r.employeeId))];
    const employees = await prisma.employee.findMany({
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

export class FieldVisitService {
  static async listVisitLocations(activeOnly = false) {
    const rows = await prisma.workLocation.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
    return rows.filter((loc) => isVisitEnabledLocation(loc) && (!activeOnly || loc.isActive));
  }

  static async listRoster(dateKey: string, scopedEmployeeIds: string[] | null, employeeId?: string) {
    const key = parseDateKey(dateKey);
    const where: any = { dateKey: key };
    if (employeeId) {
      where.employeeId = employeeId;
    } else if (scopedEmployeeIds !== null) {
      where.employeeId = { in: scopedEmployeeIds };
    }

    const rows = await prisma.fieldVisitAssignment.findMany({
      where,
      orderBy: [{ employeeId: 'asc' }, { sequence: 'asc' }],
    });
    return enrichAssignments(rows, true);
  }

  static async assignRoster(data: {
    dateKey: string;
    employeeId: string;
    locationIds: string[];
    plannedTimes?: string[];
  }) {
    const key = parseDateKey(data.dateKey);
    if (!data.employeeId) throw new Error('Employee is required');
    if (!Array.isArray(data.locationIds) || data.locationIds.length === 0) {
      throw new Error('At least one location is required');
    }

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new Error('Employee not found');

    const locations = await prisma.workLocation.findMany({
      where: { id: { in: data.locationIds }, isActive: true },
    });
    const visitLocations = locations.filter(isVisitEnabledLocation);
    if (visitLocations.length !== data.locationIds.length) {
      throw new Error('One or more locations not found or not enabled for tracking');
    }

    await prisma.fieldVisitAssignment.deleteMany({
      where: { dateKey: key, employeeId: data.employeeId },
    });

    const rows = await Promise.all(
      data.locationIds.map((locationId, index) =>
        prisma.fieldVisitAssignment.create({
          data: {
            dateKey: key,
            employeeId: data.employeeId,
            locationId,
            sequence: index,
            plannedTime: data.plannedTimes?.[index] || null,
            status: 'PENDING',
          },
        })
      )
    );

    return enrichAssignments(rows, true);
  }

  static async removeAssignment(id: string) {
    const row = await prisma.fieldVisitAssignment.findUnique({ where: { id } });
    if (!row) throw new Error('Assignment not found');
    await prisma.fieldVisitAssignment.delete({ where: { id } });
    return { success: true };
  }

  static async getMineToday(userId: string) {
    const employee = await prisma.employee.findFirst({ where: { userId } });
    if (!employee) return { employee: null, assignments: [] };

    const assignments = await prisma.fieldVisitAssignment.findMany({
      where: { employeeId: employee.id, dateKey: todayKey() },
      orderBy: { sequence: 'asc' },
    });

    const lastPing = await prisma.fieldVisitLocationPing.findFirst({
      where: { employeeId: employee.id },
      orderBy: { recordedAt: 'desc' },
    });

    return {
      employee,
      assignments: await enrichAssignments(assignments),
      lastPing,
    };
  }

  static async verifyVisit(
    assignmentId: string,
    userId: string,
    lat: number,
    lng: number,
    allowHrOverride = false
  ) {
    const assignment = await prisma.fieldVisitAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) throw new Error('Assignment not found');
    if (assignment.status === 'VERIFIED') throw new Error('Location already verified');

    const owner = await prisma.employee.findUnique({
      where: { id: assignment.employeeId },
      select: { userId: true },
    });
    const isOwner = owner?.userId === userId;
    if (!isOwner && !allowHrOverride) {
      throw new Error('You can only verify your own visit assignments');
    }

    const location = await prisma.workLocation.findUnique({
      where: { id: assignmentLocationId(assignment) },
    });
    if (!location) throw new Error('Location not found for this assignment');

    const userLat = Number(lat);
    const userLng = Number(lng);
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      throw new Error('Valid GPS coordinates are required');
    }

    const { inside, distanceMeters } = isInsideGeofence(
      userLat,
      userLng,
      location.lat,
      location.lng,
      location.radiusMeters
    );

    if (!inside && !allowHrOverride) {
      throw new Error(
        `You are ${Math.round(distanceMeters)}m from ${location.name}. Move within ${location.radiusMeters}m to verify.`
      );
    }

    const updated = await prisma.fieldVisitAssignment.update({
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

  static async markMissed(id: string) {
    const updated = await prisma.fieldVisitAssignment.update({
      where: { id },
      data: { status: 'MISSED' },
    });
    const [enriched] = await enrichAssignments([updated], true);
    return enriched;
  }

  static async recordPing(userId: string, lat: number, lng: number) {
    const employee = await prisma.employee.findFirst({ where: { userId } });
    if (!employee) throw new Error('Employee profile required');

    const userLat = Number(lat);
    const userLng = Number(lng);
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      throw new Error('Valid GPS coordinates are required');
    }

    return prisma.fieldVisitLocationPing.create({
      data: { employeeId: employee.id, lat: userLat, lng: userLng },
    });
  }

  static async getLiveSnapshot(dateKey: string, scopedEmployeeIds: string[] | null) {
    const key = parseDateKey(dateKey);
    const employeeWhere: any = {};
    if (scopedEmployeeIds !== null) {
      employeeWhere.id = { in: scopedEmployeeIds };
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: employeeSelect,
    });

    const employeeIds = employees.map((e) => e.id);
    if (employeeIds.length === 0) return [];

    const [assignments, pings] = await Promise.all([
      prisma.fieldVisitAssignment.findMany({
        where: { dateKey: key, employeeId: { in: employeeIds } },
        orderBy: [{ employeeId: 'asc' }, { sequence: 'asc' }],
      }),
      prisma.fieldVisitLocationPing.findMany({
        where: { employeeId: { in: employeeIds } },
        orderBy: { recordedAt: 'desc' },
      }),
    ]);

    const enriched = await enrichAssignments(assignments);

    const lastPingByEmployee = new Map<string, (typeof pings)[0]>();
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
