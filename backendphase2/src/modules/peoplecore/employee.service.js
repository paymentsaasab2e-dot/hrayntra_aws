import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import {
  ENGAGEMENT_TYPES,
  EMPLOYEE_STATUSES,
  assertKnownCountry,
  assertNoIndiaFallback,
  getCountryPack,
  listCountryPacks,
  settingsFromPack,
} from './countryPacks.js';
import { orgService } from './org.service.js';
import { seedOnboarding } from './ops.service.js';
import { maskSecret, sanitizePackFields } from './peoplecore.util.js';

const HIRE_ALLOWED_STAGES = new Set(['hired', 'offered', 'offer']);
const SETTINGS_KEY = 'default';

function isValidObjectId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value.trim());
}

function httpError(statusCode, message, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function requireEmployeeModel() {
  if (!prisma?.employee || typeof prisma.employee.findMany !== 'function') {
    throw httpError(
      503,
      'PeopleCore Employee model is not on this Prisma client. Run npx prisma generate in backendphase2 and restart the API. Do not prisma db push.',
      'PEOPLECORE_CLIENT_STALE',
    );
  }
}

function requireSettingsModel() {
  if (!prisma?.peopleCoreSettings || typeof prisma.peopleCoreSettings.findFirst !== 'function') {
    throw httpError(
      503,
      'PeopleCore settings model is not on this Prisma client. Run npx prisma generate in backendphase2 and restart the API. Do not prisma db push.',
      'PEOPLECORE_CLIENT_STALE',
    );
  }
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

function normalizeName(value) {
  const name = String(value || '').trim();
  return name || null;
}

function personIdForCandidate(candidate) {
  const existing = String(candidate?.personId || '').trim();
  if (existing) return existing;
  return `crm:${candidate.id}`;
}

function sanitizeCountryFields(pack, raw) {
  const incoming = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const field of pack.identityFields) {
    const value = incoming[field.id];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) out[field.id] = text;
  }
  return out;
}

function sanitizeCompensation(raw, currency) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const amount = Number(raw.amount);
  const period = String(raw.period || 'ANNUAL').toUpperCase();
  return {
    amount: Number.isFinite(amount) ? amount : null,
    currency: String(raw.currency || currency || '').trim().toUpperCase() || null,
    period: period === 'MONTHLY' ? 'MONTHLY' : 'ANNUAL',
    notes: raw.notes ? String(raw.notes).trim() : undefined,
  };
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function publicBank(bank) {
  if (!bank || typeof bank !== 'object') return null;
  const out = { ...bank };
  if (out.accountNumber) out.accountNumberMasked = maskSecret(out.accountNumber);
  if (out.aadhaar) out.aadhaarMasked = maskSecret(out.aadhaar);
  if (out.rib) out.ribMasked = maskSecret(out.rib);
  delete out.accountNumber;
  delete out.aadhaar;
  return out;
}

function publicEmployee(row) {
  if (!row) return null;
  return {
    id: row.id,
    personId: row.personId,
    candidateId: row.candidateId,
    firstName: row.firstName,
    lastName: row.lastName,
    legalName: row.legalName,
    email: row.email,
    phone: row.phone,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    legalEmployerCountry: row.legalEmployerCountry,
    legalEmployerId: row.legalEmployerId,
    engagementType: row.engagementType,
    status: row.status,
    employmentStartDate: row.employmentStartDate,
    employmentEndDate: row.employmentEndDate,
    lastWorkingDate: row.lastWorkingDate,
    lastPresentDate: row.lastPresentDate,
    designation: row.designation,
    departmentId: row.departmentId,
    orgUnitId: row.orgUnitId,
    reportingManagerEmployeeId: row.reportingManagerEmployeeId,
    workLocation: row.workLocation,
    workLocationId: row.workLocationId,
    emergencyContact: row.emergencyContact,
    bank: publicBank(row.bank),
    nominees: row.nominees,
    doNotRehire: row.doNotRehire === true,
    accessCutAt: row.accessCutAt,
    compensation: row.compensation,
    countryFields: row.countryFields,
    hiredFromCandidateAt: row.hiredFromCandidateAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const employeeService = {
  listCountryPacks() {
    return listCountryPacks();
  },

  async getSettings() {
    requireSettingsModel();
    const row = await prisma.peopleCoreSettings.findFirst({
      where: { singletonKey: SETTINGS_KEY },
    });
    const pack = row?.legalEmployerCountry ? getCountryPack(row.legalEmployerCountry) : null;
    return {
      legalEmployerCountry: row?.legalEmployerCountry || null,
      payrollCapability: row?.payrollCapability || pack?.payrollCapability || 'unavailable',
      hrEnabled: row?.hrEnabled !== false,
      timezone: row?.timezone || pack?.timezone || null,
      currency: row?.currency || pack?.currency || null,
      locale: row?.locale || pack?.locale || null,
      pack: pack || null,
      defaultLegalEmployerId: row?.defaultLegalEmployerId || null,
      hrmsModuleEnabled: row?.hrmsModuleEnabled !== false,
      payrollModuleEnabled: row?.payrollModuleEnabled === true,
      mfaRequiredForPayroll: row?.mfaRequiredForPayroll !== false,
      payslipsEnabled: false,
      phase: 3,
    };
  },

  async updateSettings(body = {}) {
    requireSettingsModel();
    const iso = String(body.legalEmployerCountry || '').trim().toUpperCase();
    const pack = assertKnownCountry(iso);
    const fromPack = settingsFromPack(pack);
    const data = {
      ...fromPack,
      singletonKey: SETTINGS_KEY,
    };
    const saved = await prisma.peopleCoreSettings.upsert({
      where: { singletonKey: SETTINGS_KEY },
      create: data,
      update: fromPack,
    });
    return {
      legalEmployerCountry: saved.legalEmployerCountry,
      payrollCapability: saved.payrollCapability,
      hrEnabled: saved.hrEnabled,
      timezone: saved.timezone,
      currency: saved.currency,
      locale: saved.locale,
      pack,
      defaultLegalEmployerId: saved.defaultLegalEmployerId || null,
      hrmsModuleEnabled: saved.hrmsModuleEnabled !== false,
      payrollModuleEnabled: saved.payrollModuleEnabled === true,
      mfaRequiredForPayroll: saved.mfaRequiredForPayroll !== false,
      payslipsEnabled: false,
      phase: 3,
    };
  },

  async getAll(filters = {}) {
    requireEmployeeModel();
    const { page, limit, skip } = getPaginationParams({ query: filters });
    const where = { isDeleted: { not: true } };

    if (filters.status && EMPLOYEE_STATUSES.includes(String(filters.status).toUpperCase())) {
      where.status = String(filters.status).toUpperCase();
    }
    if (filters.engagementType && ENGAGEMENT_TYPES.includes(String(filters.engagementType).toUpperCase())) {
      where.engagementType = String(filters.engagementType).toUpperCase();
    }
    if (filters.legalEmployerCountry) {
      where.legalEmployerCountry = String(filters.legalEmployerCountry).trim().toUpperCase();
    }
    if (filters.candidateId && isValidObjectId(filters.candidateId)) {
      where.candidateId = filters.candidateId;
    }

    const search = String(filters.search || '').trim();
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { personId: { contains: search } },
        { designation: { contains: search } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
    ]);

    return formatPaginationResponse(rows.map(publicEmployee), page, limit, total);
  },

  async getById(id) {
    requireEmployeeModel();
    if (!isValidObjectId(id)) throw httpError(400, 'Invalid employee id', 'INVALID_ID');
    const row = await prisma.employee.findFirst({
      where: { id, isDeleted: { not: true } },
    });
    if (!row) throw httpError(404, 'Employee not found', 'EMPLOYEE_NOT_FOUND');
    return publicEmployee(row);
  },

  async create(body = {}) {
    requireEmployeeModel();
    const settings = await this.getSettings();
    let legalEmployerId = isValidObjectId(body.legalEmployerId)
      ? body.legalEmployerId
      : settings.defaultLegalEmployerId;
    let country = String(body.legalEmployerCountry || settings.legalEmployerCountry || '').trim().toUpperCase();
    if (legalEmployerId) {
      const employer = await orgService.getEmployer(legalEmployerId);
      country = employer.country;
    }
    const pack = assertKnownCountry(country);
    assertNoIndiaFallback(pack, body.countryFields);
    const countryFields = sanitizeCountryFields(pack, body.countryFields);
    const firstName = normalizeName(body.firstName);
    const lastName = normalizeName(body.lastName);
    if (!firstName) throw httpError(400, 'First name is required', 'FIRST_NAME_REQUIRED');

    const engagementType = String(body.engagementType || 'EMPLOYEE').toUpperCase();
    if (!ENGAGEMENT_TYPES.includes(engagementType)) {
      throw httpError(400, 'Invalid engagement type', 'INVALID_ENGAGEMENT_TYPE');
    }
    const status = String(body.status || 'PREBOARDING').toUpperCase();
    if (!EMPLOYEE_STATUSES.includes(status)) {
      throw httpError(400, 'Invalid employee status', 'INVALID_STATUS');
    }

    const row = await prisma.employee.create({
      data: {
        personId: String(body.personId || '').trim() || null,
        candidateId: isValidObjectId(body.candidateId) ? body.candidateId : null,
        firstName,
        lastName,
        email: normalizeEmail(body.email),
        phone: String(body.phone || '').trim() || null,
        legalEmployerCountry: pack.iso,
        legalEmployerId: isValidObjectId(legalEmployerId) ? legalEmployerId : null,
        legalName: String(body.legalName || '').trim() || [firstName, lastName].filter(Boolean).join(' '),
        dateOfBirth: parseDate(body.dateOfBirth),
        gender: String(body.gender || '').trim() || null,
        engagementType,
        status,
        employmentStartDate: parseDate(body.employmentStartDate),
        employmentEndDate: parseDate(body.employmentEndDate),
        designation: String(body.designation || '').trim() || null,
        departmentId: isValidObjectId(body.departmentId) ? body.departmentId : null,
        orgUnitId: isValidObjectId(body.orgUnitId) ? body.orgUnitId : null,
        reportingManagerEmployeeId: isValidObjectId(body.reportingManagerEmployeeId)
          ? body.reportingManagerEmployeeId
          : null,
        workLocation: String(body.workLocation || '').trim() || null,
        workLocationId: isValidObjectId(body.workLocationId) ? body.workLocationId : null,
        emergencyContact: body.emergencyContact && typeof body.emergencyContact === 'object' ? body.emergencyContact : null,
        bank: body.bank && typeof body.bank === 'object' ? sanitizePackFields(pack.bankFields, body.bank) : null,
        nominees: body.nominees && typeof body.nominees === 'object' ? body.nominees : null,
        compensation: sanitizeCompensation(body.compensation, pack.currency),
        countryFields,
      },
    });
    await seedOnboarding(row);
    return publicEmployee(row);
  },

  async update(id, body = {}) {
    requireEmployeeModel();
    if (!isValidObjectId(id)) throw httpError(400, 'Invalid employee id', 'INVALID_ID');
    const existing = await prisma.employee.findFirst({
      where: { id, isDeleted: { not: true } },
    });
    if (!existing) throw httpError(404, 'Employee not found', 'EMPLOYEE_NOT_FOUND');

    const pack = assertKnownCountry(existing.legalEmployerCountry);
    const data = {};
    if (body.firstName !== undefined) data.firstName = normalizeName(body.firstName);
    if (body.lastName !== undefined) data.lastName = normalizeName(body.lastName);
    if (body.email !== undefined) data.email = normalizeEmail(body.email);
    if (body.phone !== undefined) data.phone = String(body.phone || '').trim() || null;
    if (body.designation !== undefined) data.designation = String(body.designation || '').trim() || null;
    if (body.workLocation !== undefined) data.workLocation = String(body.workLocation || '').trim() || null;
    if (body.employmentStartDate !== undefined) data.employmentStartDate = parseDate(body.employmentStartDate);
    if (body.employmentEndDate !== undefined) data.employmentEndDate = parseDate(body.employmentEndDate);
    if (body.engagementType !== undefined) {
      const engagementType = String(body.engagementType).toUpperCase();
      if (!ENGAGEMENT_TYPES.includes(engagementType)) {
        throw httpError(400, 'Invalid engagement type', 'INVALID_ENGAGEMENT_TYPE');
      }
      data.engagementType = engagementType;
    }
    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();
      if (!EMPLOYEE_STATUSES.includes(status)) {
        throw httpError(400, 'Invalid employee status', 'INVALID_STATUS');
      }
      data.status = status;
    }
    const pendingApprovals = [];
    if (body.compensation !== undefined) {
      pendingApprovals.push({
        kind: 'CTC',
        payload: { compensation: sanitizeCompensation(body.compensation, pack.currency) },
      });
    }
    if (body.countryFields !== undefined) {
      assertNoIndiaFallback(pack, body.countryFields);
      data.countryFields = sanitizeCountryFields(pack, body.countryFields);
    }
    if (body.orgUnitId !== undefined) {
      data.orgUnitId = isValidObjectId(body.orgUnitId) ? body.orgUnitId : null;
    }
    if (body.legalName !== undefined) data.legalName = String(body.legalName || '').trim() || null;
    if (body.dateOfBirth !== undefined) data.dateOfBirth = parseDate(body.dateOfBirth);
    if (body.gender !== undefined) data.gender = String(body.gender || '').trim() || null;
    if (body.workLocationId !== undefined) {
      data.workLocationId = isValidObjectId(body.workLocationId) ? body.workLocationId : null;
    }
    if (body.legalEmployerId !== undefined && isValidObjectId(body.legalEmployerId)) {
      const employer = await orgService.getEmployer(body.legalEmployerId);
      data.legalEmployerId = employer.id;
      data.legalEmployerCountry = employer.country;
    }
    if (body.emergencyContact !== undefined) data.emergencyContact = body.emergencyContact;
    if (body.bank !== undefined) {
      pendingApprovals.push({
        kind: 'BANK',
        payload: { bank: sanitizePackFields(pack.bankFields, body.bank) },
      });
    }
    if (body.nominees !== undefined) data.nominees = body.nominees;

    const row = Object.keys(data).length
      ? await prisma.employee.update({ where: { id }, data })
      : existing;
    for (const pending of pendingApprovals) {
      await prisma.peopleApproval.create({
        data: {
          kind: pending.kind,
          subjectId: id,
          employeeId: id,
          payload: pending.payload,
        },
      });
    }
    return {
      ...publicEmployee(row),
      pendingMakerChecker: pendingApprovals.map((row) => row.kind),
    };
  },

  async hireFromCandidate(candidateId, body = {}) {
    requireEmployeeModel();
    if (!isValidObjectId(candidateId)) {
      throw httpError(400, 'Invalid candidate id', 'INVALID_ID');
    }

    const settings = await this.getSettings();
    const legalEmployerId = isValidObjectId(body.legalEmployerId)
      ? body.legalEmployerId
      : settings.defaultLegalEmployerId;
    if (!legalEmployerId && !settings.legalEmployerCountry) {
      throw httpError(
        400,
        'Create a legal employer (Cameroon or India) before hiring a candidate as an employee.',
        'COUNTRY_PACK_REQUIRED',
      );
    }
    const employer = legalEmployerId ? await orgService.getEmployer(legalEmployerId) : null;
    const pack = assertKnownCountry(employer?.country || settings.legalEmployerCountry);

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, isDeleted: { not: true } },
    });
    if (!candidate) throw httpError(404, 'Candidate not found', 'CANDIDATE_NOT_FOUND');

    const stage = String(candidate.stage || '').trim().toLowerCase();
    if (!HIRE_ALLOWED_STAGES.has(stage)) {
      throw httpError(
        400,
        `Hire as employee is for Hired (or Offered) candidates. This candidate is "${candidate.stage || 'unspecified'}".`,
        'CANDIDATE_NOT_HIRED',
      );
    }

    const personId = personIdForCandidate(candidate);
    const existing = await prisma.employee.findFirst({
      where: {
        isDeleted: { not: true },
        OR: [{ candidateId }, ...(personId ? [{ personId }] : [])],
      },
    });
    if (existing) {
      return { employee: publicEmployee(existing), alreadyHired: true };
    }

    const row = await prisma.employee.create({
      data: {
        personId,
        candidateId: candidate.id,
        firstName: normalizeName(candidate.firstName) || 'Unknown',
        lastName: normalizeName(candidate.lastName),
        email: normalizeEmail(candidate.email),
        phone: String(candidate.phone || '').trim() || null,
        legalEmployerCountry: pack.iso,
        legalEmployerId: employer?.id || null,
        legalName: [normalizeName(candidate.firstName), normalizeName(candidate.lastName)].filter(Boolean).join(' '),
        engagementType: ENGAGEMENT_TYPES.includes(String(body.engagementType || '').toUpperCase())
          ? String(body.engagementType).toUpperCase()
          : 'EMPLOYEE',
        status: 'PREBOARDING',
        employmentStartDate: parseDate(body.employmentStartDate),
        designation: String(body.designation || candidate.designation || candidate.currentTitle || '').trim() || null,
        orgUnitId: isValidObjectId(candidate.orgUnitId) ? candidate.orgUnitId : null,
        workLocation: String(candidate.location || '').trim() || null,
        workLocationId: isValidObjectId(body.workLocationId) ? body.workLocationId : null,
        compensation: sanitizeCompensation(body.compensation, pack.currency),
        countryFields: sanitizeCountryFields(pack, body.countryFields),
        hiredFromCandidateAt: new Date(),
      },
    });
    await seedOnboarding(row);

    return { employee: publicEmployee(row), alreadyHired: false };
  },
};
