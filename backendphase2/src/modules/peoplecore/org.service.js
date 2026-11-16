import { prisma } from '../../config/prisma.js';
import {
  assertKnownCountry,
  assertNoIndiaFallback,
  holidaysForYear,
} from './countryPacks.js';
import {
  clampGeofence,
  httpError,
  isValidObjectId,
  requireModel,
  sanitizePackFields,
} from './peoplecore.util.js';

function publicEmployer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    identifiers: row.identifiers || {},
    payrollCapability: row.payrollCapability,
    timezone: row.timezone,
    currency: row.currency,
    locale: row.locale,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function seedPackMasters(employer, pack) {
  const leaveType = requireModel('LeaveType', 'leaveType');
  const holidayCalendar = requireModel('HolidayCalendar', 'holidayCalendar');
  const year = new Date().getFullYear();
  const existingTypes = await leaveType.count({
    where: { legalEmployerId: employer.id, isDeleted: { not: true } },
  });
  if (existingTypes === 0) {
    await Promise.all(
      (pack.leaveTypes || []).map((row) =>
        leaveType.create({
          data: {
            legalEmployerId: employer.id,
            country: pack.iso,
            code: row.code || row.id,
            name: row.label,
            paid: row.paid !== false,
          },
        }),
      ),
    );
  }
  const existingHolidays = await holidayCalendar.findFirst({
    where: { legalEmployerId: employer.id, year },
  });
  if (!existingHolidays) {
    await holidayCalendar.create({
      data: {
        legalEmployerId: employer.id,
        year,
        holidays: holidaysForYear(pack, year),
      },
    });
  }
}

export const orgService = {
  async listEmployers() {
    const model = requireModel('LegalEmployer', 'legalEmployer');
    const rows = await model.findMany({
      where: { isDeleted: { not: true } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(publicEmployer);
  },

  async createEmployer(body = {}) {
    const model = requireModel('LegalEmployer', 'legalEmployer');
    const pack = assertKnownCountry(body.country);
    const name = String(body.name || '').trim();
    if (!name) throw httpError(400, 'Legal employer name is required', 'NAME_REQUIRED');
    assertNoIndiaFallback(pack, body.identifiers);
    const identifiers = sanitizePackFields(pack.companyIdentifierFields, body.identifiers);
    const row = await model.create({
      data: {
        name,
        country: pack.iso,
        identifiers,
        payrollCapability: pack.payrollCapability,
        timezone: pack.timezone,
        currency: pack.currency,
        locale: pack.locale,
      },
    });
    await seedPackMasters(row, pack);
    const settings = requireModel('PeopleCoreSettings', 'peopleCoreSettings');
    const existing = await settings.findFirst({ where: { singletonKey: 'default' } });
    if (!existing?.defaultLegalEmployerId) {
      await settings.upsert({
        where: { singletonKey: 'default' },
        create: {
          singletonKey: 'default',
          legalEmployerCountry: pack.iso,
          defaultLegalEmployerId: row.id,
          payrollCapability: pack.payrollCapability,
          timezone: pack.timezone,
          currency: pack.currency,
          locale: pack.locale,
        },
        update: {
          legalEmployerCountry: pack.iso,
          defaultLegalEmployerId: row.id,
          payrollCapability: pack.payrollCapability,
          timezone: pack.timezone,
          currency: pack.currency,
          locale: pack.locale,
        },
      });
    }
    return publicEmployer(row);
  },

  async updateEmployer(id, body = {}) {
    const model = requireModel('LegalEmployer', 'legalEmployer');
    if (!isValidObjectId(id)) throw httpError(400, 'Invalid legal employer id', 'INVALID_ID');
    const existing = await model.findFirst({ where: { id, isDeleted: { not: true } } });
    if (!existing) throw httpError(404, 'Legal employer not found', 'NOT_FOUND');
    const pack = assertKnownCountry(existing.country);
    const data = {};
    if (body.name !== undefined) data.name = String(body.name || '').trim();
    if (body.identifiers !== undefined) {
      data.identifiers = sanitizePackFields(pack.companyIdentifierFields, body.identifiers);
      assertNoIndiaFallback(pack, data.identifiers);
    }
    const row = await model.update({ where: { id }, data });
    return publicEmployer(row);
  },

  async getEmployer(id) {
    const model = requireModel('LegalEmployer', 'legalEmployer');
    if (!isValidObjectId(id)) throw httpError(400, 'Invalid legal employer id', 'INVALID_ID');
    const row = await model.findFirst({ where: { id, isDeleted: { not: true } } });
    if (!row) throw httpError(404, 'Legal employer not found', 'NOT_FOUND');
    return publicEmployer(row);
  },

  async listLocations(legalEmployerId) {
    const model = requireModel('PeopleLocation', 'peopleLocation');
    const where = { isDeleted: { not: true } };
    if (legalEmployerId && isValidObjectId(legalEmployerId)) where.legalEmployerId = legalEmployerId;
    return model.findMany({ where, orderBy: { name: 'asc' } });
  },

  async createLocation(body = {}) {
    const model = requireModel('PeopleLocation', 'peopleLocation');
    const employer = await this.getEmployer(body.legalEmployerId);
    const name = String(body.name || '').trim();
    if (!name) throw httpError(400, 'Location name is required', 'NAME_REQUIRED');
    const pack = assertKnownCountry(employer.country);
    return model.create({
      data: {
        legalEmployerId: employer.id,
        name,
        timezone: String(body.timezone || pack.timezone).trim(),
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
        geofenceRadiusM: clampGeofence(body.geofenceRadiusM),
        orgUnitId: isValidObjectId(body.orgUnitId) ? body.orgUnitId : null,
      },
    });
  },

  async listHolidays(legalEmployerId, year) {
    const model = requireModel('HolidayCalendar', 'holidayCalendar');
    if (!isValidObjectId(legalEmployerId)) throw httpError(400, 'legalEmployerId is required', 'INVALID_ID');
    const y = Number(year) || new Date().getFullYear();
    let row = await model.findFirst({ where: { legalEmployerId, year: y } });
    if (!row) {
      const employer = await this.getEmployer(legalEmployerId);
      const pack = assertKnownCountry(employer.country);
      row = await model.create({
        data: {
          legalEmployerId,
          year: y,
          holidays: holidaysForYear(pack, y),
        },
      });
    }
    return row;
  },

  async listLeaveTypes(legalEmployerId) {
    const model = requireModel('LeaveType', 'leaveType');
    const where = { isDeleted: { not: true } };
    if (legalEmployerId && isValidObjectId(legalEmployerId)) where.legalEmployerId = legalEmployerId;
    return model.findMany({ where, orderBy: { name: 'asc' } });
  },
};
