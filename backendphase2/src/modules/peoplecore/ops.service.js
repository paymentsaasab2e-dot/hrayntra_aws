import { prisma } from '../../config/prisma.js';
import { getCountryPack, assertKnownCountry, timezoneForCountry } from './countryPacks.js';
import { calculateForPack, indiaAccountsFile } from './payroll.calc.js';
import { leaveDecisionMessage, notifyEmployeeWhatsApp, overtimeMessage } from './peopleAlert.js';
import {
  distanceMeters,
  eachIsoDate,
  httpError,
  isoDateUtc,
  isValidObjectId,
  isWeekendIso,
  localWorkDate,
  monthDateRange,
  parseDate,
  requireModel,
} from './peoplecore.util.js';
import { orgService } from './org.service.js';

function isoDateInLeave(leave, iso) {
  const start = isoDateUtc(leave.startDate);
  const end = isoDateUtc(leave.endDate);
  return iso >= start && iso <= end;
}

async function loadEmployee(id) {
  requireModel('Employee', 'employee');
  if (!isValidObjectId(id)) throw httpError(400, 'Invalid employee id', 'INVALID_ID');
  const row = await prisma.employee.findFirst({ where: { id, isDeleted: { not: true } } });
  if (!row) throw httpError(404, 'Employee not found', 'EMPLOYEE_NOT_FOUND');
  return row;
}

async function assertPeriodUnlocked(legalEmployerId, date) {
  if (!legalEmployerId || !isValidObjectId(legalEmployerId)) return;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const period = await prisma.attendancePeriod.findFirst({
    where: { legalEmployerId, year, month },
  });
  if (period?.locked) {
    throw httpError(409, 'Attendance period is locked. Unlock is payroll-only.', 'PERIOD_LOCKED');
  }
}

export async function seedOnboarding(employee) {
  const tasks = requireModel('OnboardingTask', 'onboardingTask');
  const pack = getCountryPack(employee.legalEmployerCountry);
  if (!pack) return [];
  const existing = await tasks.count({ where: { employeeId: employee.id } });
  if (existing > 0) {
    return tasks.findMany({ where: { employeeId: employee.id } });
  }
  await requireModel('PeopleApproval', 'peopleApproval').create({
    data: {
      kind: 'ONBOARDING',
      subjectId: employee.id,
      employeeId: employee.id,
    },
  }).catch(() => null);
  return Promise.all(
    (pack.onboardingItems || []).map((item) =>
      tasks.create({
        data: {
          employeeId: employee.id,
          legalEmployerId: employee.legalEmployerId || null,
          code: item.id,
          label: item.label,
          status: 'PENDING',
        },
      }),
    ),
  );
}

export const opsService = {
  async listOnboarding(employeeId) {
    const employee = await loadEmployee(employeeId);
    return seedOnboarding(employee);
  },

  async completeOnboardingTask(taskId) {
    const tasks = requireModel('OnboardingTask', 'onboardingTask');
    if (!isValidObjectId(taskId)) throw httpError(400, 'Invalid task id', 'INVALID_ID');
    const task = await tasks.findFirst({ where: { id: taskId } });
    if (!task) throw httpError(404, 'Onboarding task not found', 'NOT_FOUND');
    const updated = await tasks.update({
      where: { id: taskId },
      data: { status: 'DONE', completedAt: new Date() },
    });
    const remaining = await tasks.count({
      where: { employeeId: task.employeeId, status: { not: 'DONE' } },
    });
    if (remaining === 0) {
      await prisma.employee.update({
        where: { id: task.employeeId },
        data: { status: 'READY' },
      });
    }
    return updated;
  },

  async markNoShow(employeeId) {
    await loadEmployee(employeeId);
    return prisma.employee.update({
      where: { id: employeeId },
      data: { status: 'NO_SHOW' },
    });
  },

  async joinEmployee(employeeId, body = {}) {
    const employee = await loadEmployee(employeeId);
    if (employee.status === 'PREBOARDING') {
      throw httpError(409, 'Complete the onboarding checklist before Day-1 join.', 'NOT_READY');
    }
    if (!['READY', 'DEFERRED'].includes(employee.status)) {
      throw httpError(400, `Cannot join from status ${employee.status}`, 'BAD_STATUS');
    }
    return prisma.employee.update({
      where: { id: employeeId },
      data: {
        status: 'JOINED',
        employmentStartDate: parseDate(body.employmentStartDate) || employee.employmentStartDate || new Date(),
      },
    });
  },

  async deferEmployee(employeeId, body = {}) {
    const employee = await loadEmployee(employeeId);
    if (!['PREBOARDING', 'READY'].includes(employee.status)) {
      throw httpError(400, `Cannot defer from status ${employee.status}`, 'BAD_STATUS');
    }
    return prisma.employee.update({
      where: { id: employeeId },
      data: {
        status: 'DEFERRED',
        employmentStartDate: parseDate(body.employmentStartDate) || employee.employmentStartDate,
      },
    });
  },

  async listOnboardingQueue() {
    requireModel('Employee', 'employee');
    const rows = await prisma.employee.findMany({
      where: {
        isDeleted: { not: true },
        status: { in: ['PREBOARDING', 'READY', 'DEFERRED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      status: row.status,
      personId: row.personId,
      legalEmployerId: row.legalEmployerId,
      legalEmployerCountry: row.legalEmployerCountry,
      employmentStartDate: row.employmentStartDate,
    }));
  },

  async addDocument(employeeId, body = {}) {
    await loadEmployee(employeeId);
    const docs = requireModel('EmployeeDocument', 'employeeDocument');
    const category = String(body.category || 'OTHER').trim();
    const fileName = String(body.fileName || '').trim();
    if (!fileName) throw httpError(400, 'fileName is required', 'FILE_REQUIRED');
    return docs.create({
      data: {
        employeeId,
        category,
        fileName,
        fileUrl: String(body.fileUrl || '').trim() || null,
      },
    });
  },

  async listDocuments(employeeId) {
    await loadEmployee(employeeId);
    const docs = requireModel('EmployeeDocument', 'employeeDocument');
    return docs.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' } });
  },

  async punch(body = {}, userId) {
    const punches = requireModel('AttendancePunch', 'attendancePunch');
    const employee = await loadEmployee(body.employeeId);
    const now = parseDate(body.punchedAtUtc) || new Date();
    await assertPeriodUnlocked(employee.legalEmployerId, now);
    const timezone = String(
      body.timezone || timezoneForCountry(employee.legalEmployerCountry),
    );
    let outsideGeofence = false;
    if (isValidObjectId(body.locationId) && body.latitude != null && body.longitude != null) {
      const loc = await prisma.peopleLocation.findFirst({
        where: { id: body.locationId, isDeleted: { not: true } },
      });
      if (loc?.latitude != null && loc?.longitude != null) {
        const dist = distanceMeters(body.latitude, body.longitude, loc.latitude, loc.longitude);
        if (dist != null && dist > (loc.geofenceRadiusM || 100)) {
          if (!body.allowOutside) {
            throw httpError(400, `Punch rejected: ${Math.round(dist)} m outside the allowed circle.`, 'OUTSIDE_GEOFENCE');
          }
          outsideGeofence = true;
        }
      }
    }
    const created = await punches.create({
      data: {
        employeeId: employee.id,
        locationId: isValidObjectId(body.locationId) ? body.locationId : null,
        punchedAtUtc: now,
        timezone,
        localWorkDate: localWorkDate(now, timezone),
        source:
          String(body.source || '').toUpperCase() === 'HALF_DAY'
            ? 'HALF_DAY'
            : body.proxyByUserId || (userId && body.proxy)
              ? 'HR_PROXY'
              : 'WEB',
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
        outsideGeofence,
        proxyByUserId: isValidObjectId(body.proxyByUserId) ? body.proxyByUserId : userId || null,
        overtimeMinutes: Math.max(0, Math.min(720, Math.round(Number(body.overtimeMinutes) || 0))),
        notes: String(body.notes || '').trim() || null,
      },
    });
    if (created.overtimeMinutes > 0) {
      const name = [employee.firstName, employee.lastName].filter(Boolean).join(' ');
      void notifyEmployeeWhatsApp(
        employee,
        overtimeMessage({
          employeeName: name,
          localWorkDate: created.localWorkDate,
          overtimeMinutes: created.overtimeMinutes,
        }),
      );
    }
    return created;
  },

  async listPunches(employeeId, localWorkDateValue) {
    const punches = requireModel('AttendancePunch', 'attendancePunch');
    const where = {};
    if (employeeId && isValidObjectId(employeeId)) where.employeeId = employeeId;
    if (localWorkDateValue) where.localWorkDate = String(localWorkDateValue);
    return punches.findMany({ where, orderBy: { punchedAtUtc: 'desc' }, take: 200 });
  },

  async lockPeriod(legalEmployerId, year, month, userId) {
    const model = requireModel('AttendancePeriod', 'attendancePeriod');
    if (!isValidObjectId(legalEmployerId)) throw httpError(400, 'legalEmployerId required', 'INVALID_ID');
    const y = Number(year);
    const m = Number(month);
    const existing = await model.findFirst({ where: { legalEmployerId, year: y, month: m } });
    const data = { locked: true, lockedAt: new Date(), lockedById: userId || null };
    if (existing) return model.update({ where: { id: existing.id }, data });
    return model.create({ data: { legalEmployerId, year: y, month: m, ...data } });
  },

  async getPeriod(legalEmployerId, year, month) {
    const model = requireModel('AttendancePeriod', 'attendancePeriod');
    return model.findFirst({
      where: { legalEmployerId, year: Number(year), month: Number(month) },
    });
  },

  async holidaySet(legalEmployerId, year) {
    if (!legalEmployerId || !isValidObjectId(legalEmployerId)) return new Set();
    const cal = await orgService.listHolidays(legalEmployerId, year);
    return new Set((cal.holidays || []).map((row) => String(row.date).slice(0, 10)));
  },

  async requestRegularisation(body = {}, userId) {
    const employee = await loadEmployee(body.employeeId);
    const workDate = String(body.localWorkDate || '').slice(0, 10);
    if (!workDate) throw httpError(400, 'localWorkDate required', 'DATE_REQUIRED');
    await assertPeriodUnlocked(employee.legalEmployerId, new Date(`${workDate}T12:00:00.000Z`));
    return this.openApproval({
      kind: 'REGULARISATION',
      subjectId: workDate,
      employeeId: employee.id,
      assignedToId: userId || null,
    });
  },

  async muster(legalEmployerId, year, month) {
    const employer = await orgService.getEmployer(legalEmployerId);
    const y = Number(year);
    const m = Number(month);
    const { start, end } = monthDateRange(y, m);
    const days = eachIsoDate(start, end);
    const holidays = await this.holidaySet(employer.id, y);
    const employees = await prisma.employee.findMany({
      where: {
        legalEmployerId: employer.id,
        isDeleted: { not: true },
        status: { in: ['JOINED', 'ACTIVE', 'READY', 'PREBOARDING', 'EXITED'] },
      },
      take: 500,
    });
    const employeeIds = employees.map((e) => e.id);
    const punches = employeeIds.length
      ? await prisma.attendancePunch.findMany({
          where: {
            employeeId: { in: employeeIds },
            localWorkDate: { gte: start, lte: end },
          },
        })
      : [];
    const leaves = employeeIds.length
      ? await prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: 'APPROVED',
          },
        })
      : [];
    const leaveTypeIds = [...new Set(leaves.map((leave) => leave.leaveTypeId).filter(Boolean))];
    const leaveTypes = leaveTypeIds.length
      ? await prisma.leaveType.findMany({ where: { id: { in: leaveTypeIds } } })
      : [];
    const unpaidTypeIds = new Set(leaveTypes.filter((row) => row.paid === false).map((row) => row.id));
    const punchMap = new Map();
    for (const punch of punches) {
      const key = `${punch.employeeId}:${punch.localWorkDate}`;
      const current = punchMap.get(key) || { count: 0, late: false, half: false, overtimeMinutes: 0 };
      current.count += 1;
      current.overtimeMinutes += Number(punch.overtimeMinutes) || 0;
      if (String(punch.source || '').toUpperCase() === 'HALF_DAY') current.half = true;
      const hour = new Date(punch.punchedAtUtc).getUTCHours();
      if (hour >= 11) current.late = true;
      punchMap.set(key, current);
    }
    const rows = employees.map((employee) => {
      const cells = {};
      let overtimeMinutes = 0;
      for (const iso of days) {
        const punchForOt = punchMap.get(`${employee.id}:${iso}`);
        if (punchForOt) overtimeMinutes += punchForOt.overtimeMinutes || 0;
        if (holidays.has(iso)) {
          cells[iso] = 'H';
          continue;
        }
        if (isWeekendIso(iso)) {
          cells[iso] = 'W';
          continue;
        }
        const covering = leaves.filter(
          (leave) => leave.employeeId === employee.id && isoDateInLeave(leave, iso),
        );
        if (covering.length) {
          cells[iso] = covering.some((leave) => unpaidTypeIds.has(leave.leaveTypeId)) ? 'U' : 'L';
          continue;
        }
        const punch = punchMap.get(`${employee.id}:${iso}`);
        if (!punch) {
          cells[iso] = 'A';
        } else if (punch.half) {
          cells[iso] = 'HD';
        } else if (punch.late) {
          cells[iso] = 'T';
        } else {
          cells[iso] = 'P';
        }
      }
      const marks = Object.values(cells);
      return {
        employeeId: employee.id,
        name: [employee.firstName, employee.lastName].filter(Boolean).join(' '),
        status: employee.status,
        cells,
        present: marks.filter((v) => v === 'P' || v === 'T' || v === 'HD').length,
        absent: marks.filter((v) => v === 'A' || v === 'U').length,
        leave: marks.filter((v) => v === 'L').length,
        unpaid: marks.filter((v) => v === 'U').length,
        overtimeHours: Math.round((overtimeMinutes / 60) * 100) / 100,
      };
    });
    return { legalEmployerId: employer.id, country: employer.country, year: y, month: m, days, rows };
  },

  async lopDaysForEmployee(employee, year, month) {
    const muster = await this.muster(employee.legalEmployerId, year, month);
    const row = muster.rows.find((item) => item.employeeId === employee.id);
    return row?.absent || 0;
  },

  async listAssignments() {
    const assignments = requireModel('AssetAssignment', 'assetAssignment');
    return assignments.findMany({ orderBy: { assignedAt: 'desc' }, take: 200 });
  },

  async listPayrollExceptions(runId) {
    if (!isValidObjectId(runId)) throw httpError(400, 'Invalid payroll run id', 'INVALID_ID');
    return requireModel('PayrollException', 'payrollException').findMany({
      where: { payrollRunId: runId },
    });
  },

  async applyLeave(body = {}) {
    const requests = requireModel('LeaveRequest', 'leaveRequest');
    const employee = await loadEmployee(body.employeeId);
    if (!isValidObjectId(body.leaveTypeId)) throw httpError(400, 'leaveTypeId required', 'INVALID_ID');
    const leaveType = await prisma.leaveType.findFirst({
      where: { id: body.leaveTypeId, isDeleted: { not: true } },
    });
    if (!leaveType) throw httpError(404, 'Leave type not found', 'NOT_FOUND');
    if (leaveType.country !== employee.legalEmployerCountry) {
      throw httpError(400, 'Leave type does not belong to this country pack', 'LEAVE_PACK_MISMATCH');
    }
    const startDate = parseDate(body.startDate);
    const endDate = parseDate(body.endDate);
    if (!startDate || !endDate) throw httpError(400, 'startDate and endDate required', 'DATES_REQUIRED');
    let days = Number(body.days);
    if (!Number.isFinite(days) || days <= 0) {
      const holidaySet = new Set();
      if (employee.legalEmployerId) {
        const cal = await orgService.listHolidays(employee.legalEmployerId, startDate.getUTCFullYear());
        for (const row of cal.holidays || []) holidaySet.add(String(row.date).slice(0, 10));
      }
      days = eachIsoDate(startDate, endDate).filter((iso) => !isWeekendIso(iso) && !holidaySet.has(iso)).length;
      if (days < 1) days = 1;
    }
    await assertPeriodUnlocked(employee.legalEmployerId, startDate);
    const row = await requests.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate,
        endDate,
        days,
        status: 'PENDING',
      },
    });
    await this.openApproval({
      kind: 'LEAVE',
      subjectId: row.id,
      employeeId: employee.id,
    });
    return row;
  },

  async decideLeave(id, status, remark, actorId) {
    const requests = requireModel('LeaveRequest', 'leaveRequest');
    if (!isValidObjectId(id)) throw httpError(400, 'Invalid leave id', 'INVALID_ID');
    const next = String(status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(next)) throw httpError(400, 'status must be APPROVED or REJECTED', 'BAD_STATUS');
    const row = await requests.update({
      where: { id },
      data: { status: next, remark: String(remark || '').trim() || null, approverId: actorId || null },
    });
    if (next === 'APPROVED') {
      const year = row.startDate.getUTCFullYear();
      const balanceModel = requireModel('LeaveBalance', 'leaveBalance');
      const existing = await balanceModel.findFirst({
        where: { employeeId: row.employeeId, leaveTypeId: row.leaveTypeId, year },
      });
      if (existing) {
        await balanceModel.update({
          where: { id: existing.id },
          data: { taken: (existing.taken || 0) + row.days },
        });
      } else {
        await balanceModel.create({
          data: {
            employeeId: row.employeeId,
            leaveTypeId: row.leaveTypeId,
            year,
            taken: row.days,
          },
        });
      }
    }
    const employee = await prisma.employee.findFirst({ where: { id: row.employeeId } });
    if (employee) {
      const start = row.startDate ? row.startDate.toISOString().slice(0, 10) : '';
      const end = row.endDate ? row.endDate.toISOString().slice(0, 10) : '';
      const name = [employee.firstName, employee.lastName].filter(Boolean).join(' ');
      void notifyEmployeeWhatsApp(
        employee,
        leaveDecisionMessage({ employeeName: name, status: next, startDate: start, endDate: end }),
      );
    }
    return row;
  },

  async listLeave(employeeId) {
    const requests = requireModel('LeaveRequest', 'leaveRequest');
    const where = {};
    if (employeeId && isValidObjectId(employeeId)) where.employeeId = employeeId;
    return requests.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  },

  async createExit(body = {}) {
    const employee = await loadEmployee(body.employeeId);
    const exits = requireModel('ExitCase', 'exitCase');
    const allocated = await prisma.assetAssignment.count({
      where: { employeeId: employee.id, OR: [{ returnedAt: null }, { returnedAt: { isSet: false } }] },
    });
    const row = await exits.create({
      data: {
        employeeId: employee.id,
        kind: String(body.kind || 'RESIGNATION').toUpperCase(),
        noticeDays: body.noticeDays != null ? Number(body.noticeDays) : null,
        lastWorkingDate: parseDate(body.lastWorkingDate),
        lastPresentDate: parseDate(body.lastPresentDate),
        clearance: { assetsAllocated: allocated },
      },
    });
    await this.openApproval({ kind: 'EXIT', subjectId: row.id, employeeId: employee.id });
    return row;
  },

  async completeExit(id, body = {}) {
    const exits = requireModel('ExitCase', 'exitCase');
    if (!isValidObjectId(id)) throw httpError(400, 'Invalid exit id', 'INVALID_ID');
    const existing = await exits.findFirst({ where: { id } });
    if (!existing) throw httpError(404, 'Exit case not found', 'NOT_FOUND');
    const allocated = await prisma.assetAssignment.count({
      where: {
        employeeId: existing.employeeId,
        OR: [{ returnedAt: null }, { returnedAt: { isSet: false } }],
      },
    });
    if (allocated > 0) {
      throw httpError(409, 'Cannot complete exit while assets are still Allocated.', 'ASSETS_ALLOCATED');
    }
    const updated = await exits.update({
      where: { id },
      data: {
        status: 'CLEARED',
        lastWorkingDate: parseDate(body.lastWorkingDate) || existing.lastWorkingDate,
        lastPresentDate: parseDate(body.lastPresentDate) || existing.lastPresentDate,
        settlementDate: parseDate(body.settlementDate) || new Date(),
      },
    });
    await prisma.employee.update({
      where: { id: existing.employeeId },
      data: {
        status: 'EXITED',
        lastWorkingDate: updated.lastWorkingDate,
        lastPresentDate: updated.lastPresentDate,
        doNotRehire: body.doNotRehire === true,
        accessCutAt: updated.lastWorkingDate || new Date(),
      },
    });
    return updated;
  },

  async listExits() {
    return requireModel('ExitCase', 'exitCase').findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  },

  async createAsset(body = {}) {
    const assets = requireModel('AssetItem', 'assetItem');
    const serial = String(body.serial || '').trim();
    const name = String(body.name || '').trim();
    if (!serial || !name) throw httpError(400, 'serial and name are required', 'ASSET_REQUIRED');
    return assets.create({
      data: {
        serial,
        name,
        recoveryValue: body.recoveryValue != null ? Number(body.recoveryValue) : null,
      },
    });
  },

  async listAssets() {
    return requireModel('AssetItem', 'assetItem').findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  },

  async assignAsset(body = {}) {
    const assignments = requireModel('AssetAssignment', 'assetAssignment');
    await loadEmployee(body.employeeId);
    if (!isValidObjectId(body.assetId)) throw httpError(400, 'assetId required', 'INVALID_ID');
    await prisma.assetItem.update({
      where: { id: body.assetId },
      data: { status: 'ALLOCATED' },
    });
    return assignments.create({
      data: { assetId: body.assetId, employeeId: body.employeeId, returnedAt: null },
    });
  },

  async returnAsset(assignmentId, condition) {
    const assignments = requireModel('AssetAssignment', 'assetAssignment');
    if (!isValidObjectId(assignmentId)) throw httpError(400, 'Invalid assignment id', 'INVALID_ID');
    const row = await assignments.update({
      where: { id: assignmentId },
      data: { returnedAt: new Date(), condition: String(condition || '').trim() || null },
    });
    await prisma.assetItem.update({
      where: { id: row.assetId },
      data: { status: 'AVAILABLE' },
    });
    return row;
  },

  async saveFnf(body = {}) {
    const model = requireModel('FnFWorksheet', 'fnFWorksheet');
    if (!isValidObjectId(body.exitCaseId) || !isValidObjectId(body.employeeId)) {
      throw httpError(400, 'exitCaseId and employeeId required', 'INVALID_ID');
    }
    return model.create({
      data: {
        exitCaseId: body.exitCaseId,
        employeeId: body.employeeId,
        leaveEncashmentDays: body.leaveEncashmentDays != null ? Number(body.leaveEncashmentDays) : null,
        noticeRecoveryDays: body.noticeRecoveryDays != null ? Number(body.noticeRecoveryDays) : null,
        assetRecoveryAmount: body.assetRecoveryAmount != null ? Number(body.assetRecoveryAmount) : null,
        notes: String(body.notes || '').trim() || null,
      },
    });
  },

  async issueLetter(body = {}) {
    const letters = requireModel('PeopleLetter', 'peopleLetter');
    const employee = await loadEmployee(body.employeeId);
    const pack = assertKnownCountry(employee.legalEmployerCountry);
    const letterType = String(body.letterType || '').trim();
    const allowed = (pack.letterTypes || []).some((row) => row.id === letterType);
    if (!allowed) throw httpError(400, 'Letter type is not in this country pack', 'LETTER_PACK_MISMATCH');
    let blockedReason = null;
    if (letterType === 'relieving' || letterType === 'certificat_de_travail') {
      const allocated = await prisma.assetAssignment.count({
        where: {
          employeeId: employee.id,
          OR: [{ returnedAt: null }, { returnedAt: { isSet: false } }],
        },
      });
      if (allocated > 0) {
        blockedReason = 'Assets still Allocated. Relieving / certificat de travail cannot go out.';
      }
    }
    if (blockedReason) {
      throw httpError(409, blockedReason, 'LETTER_BLOCKED_ASSETS');
    }
    const serial = `LTR-${Date.now()}`;
    const bodyText = String(
      body.body ||
        `${pack.letterTypes.find((r) => r.id === letterType)?.label} for ${employee.firstName || ''} ${employee.lastName || ''} (${employee.personId || employee.id}).`,
    );
    return letters.create({
      data: {
        employeeId: employee.id,
        letterType,
        language: pack.locale,
        body: bodyText,
        serial,
      },
    });
  },

  async listLetters(employeeId) {
    const letters = requireModel('PeopleLetter', 'peopleLetter');
    const where = {};
    if (employeeId && isValidObjectId(employeeId)) where.employeeId = employeeId;
    return letters.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  },

  async openApproval(body = {}) {
    const approvals = requireModel('PeopleApproval', 'peopleApproval');
    return approvals.create({
      data: {
        kind: String(body.kind || 'OTHER').toUpperCase(),
        subjectId: String(body.subjectId),
        employeeId: isValidObjectId(body.employeeId) ? body.employeeId : null,
        assignedToId: body.assignedToId || null,
        payload: body.payload && typeof body.payload === 'object' ? body.payload : undefined,
      },
    });
  },

  async listInbox() {
    return requireModel('PeopleApproval', 'peopleApproval').findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  },

  async decideInbox(id, status, remark, delegatedToId) {
    const approvals = requireModel('PeopleApproval', 'peopleApproval');
    if (!isValidObjectId(id)) throw httpError(400, 'Invalid approval id', 'INVALID_ID');
    const nextStatus = String(status || 'APPROVED').toUpperCase();
    const row = await approvals.update({
      where: { id },
      data: {
        status: nextStatus,
        remark: String(remark || '').trim() || null,
        delegatedToId: isValidObjectId(delegatedToId) ? delegatedToId : null,
      },
    });
    if (nextStatus === 'APPROVED') {
      await this.applyApprovedInbox(row);
    }
    return row;
  },

  async applyApprovedInbox(row) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    if (row.kind === 'BANK' && row.employeeId && payload.bank) {
      await prisma.employee.update({ where: { id: row.employeeId }, data: { bank: payload.bank } });
    }
    if (row.kind === 'CTC' && row.employeeId && payload.compensation) {
      await prisma.employee.update({
        where: { id: row.employeeId },
        data: { compensation: payload.compensation },
      });
    }
    if (row.kind === 'REGULARISATION' && row.employeeId && row.subjectId) {
      const punches = requireModel('AttendancePunch', 'attendancePunch');
      const iso = String(row.subjectId).slice(0, 10);
      await punches.create({
        data: {
          employeeId: row.employeeId,
          punchedAtUtc: new Date(`${iso}T12:00:00.000Z`),
          timezone: 'UTC',
          localWorkDate: iso,
          source: 'REGULARISED',
          notes: 'Approved regularisation',
        },
      });
    }
  },

  async delegateInbox(id, delegatedToId) {
    const approvals = requireModel('PeopleApproval', 'peopleApproval');
    if (!isValidObjectId(id) || !isValidObjectId(delegatedToId)) {
      throw httpError(400, 'id and delegatedToId required', 'INVALID_ID');
    }
    return approvals.update({
      where: { id },
      data: { delegatedToId },
    });
  },

  async reportsHome() {
    const today = isoDateUtc(new Date());
    const [employees, pendingLeave, pendingInbox, exits, onLeave, payrollExceptions] = await Promise.all([
      prisma.employee.count({ where: { isDeleted: { not: true } } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }).catch(() => 0),
      prisma.peopleApproval.count({ where: { status: 'PENDING' } }).catch(() => 0),
      prisma.exitCase.count({ where: { status: 'OPEN' } }).catch(() => 0),
      prisma.leaveRequest
        .count({
          where: { status: 'APPROVED', startDate: { lte: new Date() }, endDate: { gte: new Date() } },
        })
        .catch(() => 0),
      prisma.payrollException.count({ where: { severity: 'BLOCK' } }).catch(() => 0),
    ]);
    return {
      employees,
      pendingLeave,
      pendingInbox,
      openExits: exits,
      onLeave,
      payrollExceptions,
      today,
      payslipsEnabled: false,
    };
  },

  async alerts() {
    const home = await this.reportsHome();
    const items = [];
    if (home.pendingInbox) items.push({ code: 'INBOX', severity: 'WARN', message: `${home.pendingInbox} pending People approvals` });
    if (home.pendingLeave) items.push({ code: 'LEAVE', severity: 'WARN', message: `${home.pendingLeave} leave requests waiting` });
    if (home.openExits) items.push({ code: 'EXIT', severity: 'WARN', message: `${home.openExits} open exits` });
    if (home.payrollExceptions) {
      items.push({ code: 'PAYROLL_BLOCK', severity: 'BLOCK', message: `${home.payrollExceptions} payroll BLOCK exceptions` });
    }
    return { items, payslipsEnabled: false };
  },

  async listLeaveBalances(employeeId) {
    const model = requireModel('LeaveBalance', 'leaveBalance');
    const where = {};
    if (employeeId && isValidObjectId(employeeId)) where.employeeId = employeeId;
    return model.findMany({ where, take: 200 });
  },

  async paymentFile(runId) {
    if (!isValidObjectId(runId)) throw httpError(400, 'Invalid payroll run id', 'INVALID_ID');
    const run = await requireModel('PayrollRun', 'payrollRun').findFirst({ where: { id: runId } });
    if (!run) throw httpError(404, 'Payroll run not found', 'NOT_FOUND');
    const slips = await this.listPayslips(runId);
    return {
      format:
        run.capability === 'export'
          ? 'cameroon-local-provider-export'
          : run.capability === 'calculate'
            ? 'india-payslip-file'
            : 'payroll-not-certified',
      country: run.country,
      currency: slips[0]?.currency || getCountryPack(run.country)?.currency || null,
      year: run.year,
      month: run.month,
      rows: slips.map((slip) => ({
        employeeId: slip.employeeId,
        gross: slip.gross,
        net: slip.net,
        exportOnly: slip.exportOnly,
        lines: slip.lines,
      })),
      ...(run.capability === 'calculate' ? indiaAccountsFile(slips) : {}),
    };
  },

  async inspectorPack(legalEmployerId, year) {
    const employer = await orgService.getEmployer(legalEmployerId);
    const pack = assertKnownCountry(employer.country);
    const y = Number(year) || new Date().getFullYear();
    const employees = await prisma.employee.findMany({
      where: { legalEmployerId, isDeleted: { not: true } },
      take: 500,
    });
    const holidays = await orgService.listHolidays(legalEmployerId, y);
    return {
      country: pack.iso,
      readyReports: pack.inspectorReports,
      headcount: employees.length,
      joiners: employees.filter((e) => e.employmentStartDate && e.employmentStartDate.getFullYear() === y).length,
      leavers: employees.filter((e) => e.status === 'EXITED').length,
      holidays: holidays.holidays,
    };
  },

  async publishPolicy(body = {}) {
    const policies = requireModel('HrPolicy', 'hrPolicy');
    const title = String(body.title || '').trim();
    const content = String(body.body || '').trim();
    if (!title || !content) throw httpError(400, 'title and body required', 'POLICY_REQUIRED');
    const country = body.country ? assertKnownCountry(body.country).iso : null;
    if (/posh/i.test(title) && country && country !== 'IN') {
      throw httpError(400, 'POSH Internal Committee is India-pack only.', 'POSH_INDIA_ONLY');
    }
    const latest = await policies.findFirst({
      where: { title, country },
      orderBy: { version: 'desc' },
    });
    return policies.create({
      data: {
        title,
        body: content,
        country,
        version: (latest?.version || 0) + 1,
      },
    });
  },

  async listPolicies() {
    return requireModel('HrPolicy', 'hrPolicy').findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  },

  async ackPolicy(body = {}) {
    const acks = requireModel('HrPolicyAck', 'hrPolicyAck');
    await loadEmployee(body.employeeId);
    if (!isValidObjectId(body.policyId)) throw httpError(400, 'policyId required', 'INVALID_ID');
    const policy = await prisma.hrPolicy.findFirst({ where: { id: body.policyId } });
    if (!policy) throw httpError(404, 'Policy not found', 'NOT_FOUND');
    return acks.create({
      data: {
        policyId: policy.id,
        employeeId: body.employeeId,
        version: policy.version,
      },
    });
  },

  async getSecurityFlags() {
    const settings = await prisma.peopleCoreSettings.findFirst({ where: { singletonKey: 'default' } });
    return {
      mfaRequiredForPayroll: settings?.mfaRequiredForPayroll !== false,
      hrmsModuleEnabled: settings?.hrmsModuleEnabled !== false,
      payrollModuleEnabled: settings?.payrollModuleEnabled === true,
      encryptBankAndNationalId: true,
      makerCheckerOnBankAndPay: true,
      reuseHqBilling: true,
      hrmsSeatsMeter: 'hq-billing',
      payrollPackMeter: 'hq-billing',
      countryNotCertifiedIsNotPaywall: true,
    };
  },

  async updateSecurityFlags(body = {}) {
    const settings = requireModel('PeopleCoreSettings', 'peopleCoreSettings');
    const data = {};
    if (body.mfaRequiredForPayroll != null) data.mfaRequiredForPayroll = Boolean(body.mfaRequiredForPayroll);
    if (body.hrmsModuleEnabled != null) data.hrmsModuleEnabled = Boolean(body.hrmsModuleEnabled);
    if (body.payrollModuleEnabled != null) data.payrollModuleEnabled = Boolean(body.payrollModuleEnabled);
    const saved = await settings.upsert({
      where: { singletonKey: 'default' },
      create: { singletonKey: 'default', ...data },
      update: data,
    });
    return this.getSecurityFlags();
  },

  async runPayroll(body = {}, user) {
    const runs = requireModel('PayrollRun', 'payrollRun');
    const employer = await orgService.getEmployer(body.legalEmployerId);
    const pack = assertKnownCountry(employer.country);
    const year = Number(body.year);
    const month = Number(body.month);
    const period = await prisma.attendancePeriod.findFirst({
      where: { legalEmployerId: employer.id, year, month },
    });
    if (!period?.locked) {
      throw httpError(
        409,
        'Lock attendance and leave for this month before payroll close.',
        'ATTENDANCE_NOT_LOCKED',
      );
    }
    const settings = await prisma.peopleCoreSettings.findFirst({ where: { singletonKey: 'default' } });
    if (settings?.mfaRequiredForPayroll !== false && user && user.mfaVerified === false) {
      throw httpError(403, 'MFA required for Owner/Admin/payroll-run users.', 'MFA_REQUIRED');
    }
    const employees = await prisma.employee.findMany({
      where: {
        legalEmployerId: employer.id,
        isDeleted: { not: true },
        status: { in: ['JOINED', 'ACTIVE', 'READY', 'EXITED'] },
      },
    });
    const run = await runs.create({
      data: {
        legalEmployerId: employer.id,
        country: pack.iso,
        year,
        month,
        status: 'CALCULATE',
        capability: pack.payrollCapability,
      },
    });
    const muster = await this.muster(employer.id, year, month);
    const lopByEmployee = new Map(muster.rows.map((row) => [row.employeeId, row.absent || 0]));
    const otByEmployee = new Map(muster.rows.map((row) => [row.employeeId, row.overtimeHours || 0]));
    const exceptions = [];
    const slips = [];
    for (const employee of employees) {
      const lopDays = lopByEmployee.get(employee.id) || 0;
      const result = calculateForPack(pack.iso, {
        compensation: employee.compensation,
        lopDays,
        overtimeHours: otByEmployee.get(employee.id) || 0,
      });
      for (const ex of result.exceptions || []) {
        exceptions.push(
          await prisma.payrollException.create({
            data: {
              payrollRunId: run.id,
              employeeId: employee.id,
              code: ex.code,
              message: ex.message,
              severity: ex.severity,
            },
          }),
        );
      }
      if (result.certified === false) {
        continue;
      }
      if (result.exportOnly) {
        slips.push(
          await prisma.payslip.create({
            data: {
              payrollRunId: run.id,
              employeeId: employee.id,
              currency: result.currency,
              gross: result.gross || 0,
              net: result.net == null ? null : result.net,
              lines: result.lines,
              exportOnly: true,
            },
          }),
        );
      } else if (!(result.exceptions || []).some((e) => e.severity === 'BLOCK')) {
        slips.push(
          await prisma.payslip.create({
            data: {
              payrollRunId: run.id,
              employeeId: employee.id,
              currency: result.currency,
              gross: result.gross,
              net: result.net,
              lines: result.lines,
              exportOnly: false,
            },
          }),
        );
      }
    }
    const blocked = exceptions.some((e) => e.severity === 'BLOCK');
    const updated = await runs.update({
      where: { id: run.id },
      data: {
        status: blocked ? 'EXCEPTIONS' : 'REVIEW',
        totals: { employees: employees.length, slips: slips.length, exceptions: exceptions.length },
      },
    });
    return { run: updated, exceptions, slips };
  },

  async approvePayroll(runId) {
    const runs = requireModel('PayrollRun', 'payrollRun');
    if (!isValidObjectId(runId)) throw httpError(400, 'Invalid payroll run id', 'INVALID_ID');
    const run = await runs.findFirst({ where: { id: runId } });
    if (!run) throw httpError(404, 'Payroll run not found', 'NOT_FOUND');
    const blocked = await prisma.payrollException.count({
      where: { payrollRunId: runId, severity: 'BLOCK' },
    });
    if (blocked > 0) throw httpError(409, 'Clear BLOCK exceptions before approve.', 'PAYROLL_BLOCKED');
    return runs.update({
      where: { id: runId },
      data: { status: 'APPROVED' },
    });
  },

  async lockPayroll(runId) {
    const runs = requireModel('PayrollRun', 'payrollRun');
    if (!isValidObjectId(runId)) throw httpError(400, 'Invalid payroll run id', 'INVALID_ID');
    const run = await runs.findFirst({ where: { id: runId } });
    if (!run) throw httpError(404, 'Payroll run not found', 'NOT_FOUND');
    if (run.status !== 'APPROVED') {
      throw httpError(409, 'Approve the run before locking payroll.', 'PAYROLL_NOT_APPROVED');
    }
    return runs.update({
      where: { id: runId },
      data: { status: 'LOCKED', lockedAt: new Date() },
    });
  },

  async listPayrollRuns(legalEmployerId) {
    const runs = requireModel('PayrollRun', 'payrollRun');
    const where = {};
    if (legalEmployerId && isValidObjectId(legalEmployerId)) where.legalEmployerId = legalEmployerId;
    return runs.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
  },

  async listPayslips(runId) {
    return requireModel('Payslip', 'payslip').findMany({
      where: { payrollRunId: runId },
    });
  },
};
