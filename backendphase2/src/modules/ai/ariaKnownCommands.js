import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { opsService } from '../peoplecore/ops.service.js';
import { undoService } from './undo.service.js';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

function clean(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

/** Phrases the command line runs itself. Anything else stays with the chat. */
export function matchKnownPeopleCommand(text) {
  const raw = clean(text);
  const t = raw.toLowerCase();
  if (!t) return null;

  const punch = t.match(/^(?:punch|punch now|punch attendance)(?:\s+(?:for|employee))?\s+(.+)$/);
  if (punch) return { kind: 'punch', name: punch[1].trim() };

  if (/^(?:approve|reject)(?:\s+the)?\s+oldest\s+leave$/.test(t) || /^(?:approve|reject)\s+leave$/.test(t)) {
    return { kind: 'leave', decision: t.startsWith('reject') ? 'REJECTED' : 'APPROVED' };
  }

  if (/^lock(?:\s+(?:this|the))?\s+month$/.test(t) || t === 'lock attendance') {
    return { kind: 'lock' };
  }

  if (t === 'run payroll' || /^close(?:\s+(?:this|the))?\s+month$/.test(t)) {
    return { kind: 'payroll' };
  }

  return null;
}

async function remember(user, action, targetIds, reverseData, label) {
  const actionId = crypto.randomUUID();
  const undoRecord = await undoService.pushToStack({
    actionId,
    userId: user?.id,
    module: 'People',
    action,
    endpoint: '/api/v1/ai/known-command/undo',
    method: 'POST',
    targetIds,
    reverseData,
  });
  const expiresAt = undoRecord?.expiresAt
    ? new Date(undoRecord.expiresAt).toISOString()
    : new Date(Date.now() + 10 * 60 * 1000).toISOString();
  return {
    available: true,
    actionId,
    expiresAt,
    label,
  };
}

async function currentEmployer() {
  return prisma.legalEmployer.findFirst({
    where: { isDeleted: { not: true } },
    orderBy: { createdAt: 'asc' },
  });
}

async function findEmployees(name) {
  const rows = await prisma.employee.findMany({
    where: { isDeleted: { not: true } },
    take: 200,
    orderBy: { createdAt: 'desc' },
  });
  const q = name.toLowerCase();
  return rows.filter((row) => {
    const full = `${row.firstName || ''} ${row.lastName || ''}`.trim().toLowerCase();
    const email = String(row.email || '').toLowerCase();
    return full.includes(q) || email === q;
  });
}

async function runPunch(user, parsed) {
  if (!parsed.name) return { ok: false, summary: 'Say who to punch. Example: punch Ada Lovelace.' };
  const hits = await findEmployees(parsed.name);
  if (hits.length === 0) {
    return { ok: false, summary: `No employee matches “${parsed.name}”.` };
  }
  if (hits.length > 1) {
    const names = hits.slice(0, 5).map((row) => `${row.firstName || ''} ${row.lastName || ''}`.trim()).join(', ');
    return { ok: false, summary: `More than one employee matches. Be more specific: ${names}.` };
  }
  const employee = hits[0];
  const punch = await opsService.punch({ employeeId: employee.id, proxy: true }, user?.id);
  const label = `Undo punch for ${employee.firstName || ''} ${employee.lastName || ''}`.trim();
  const undoPayload = await remember(user, 'PUNCH', [punch.id], { punchId: punch.id }, label);
  return { ok: true, summary: `Punched ${employee.firstName || 'employee'}.`, undoPayload, refresh: 'people' };
}

async function runLeave(user, parsed) {
  const row = await prisma.leaveRequest.findFirst({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
  if (!row) return { ok: false, summary: 'No leave is waiting.' };
  const decided = await opsService.decideLeave(row.id, parsed.decision, 'ARIA', user?.id);
  let balanceId = null;
  let previousTaken = null;
  if (parsed.decision === 'APPROVED' && decided?.startDate) {
    const year = new Date(decided.startDate).getUTCFullYear();
    const balance = await prisma.leaveBalance.findFirst({
      where: { employeeId: decided.employeeId, leaveTypeId: decided.leaveTypeId, year },
    });
    if (balance) {
      balanceId = balance.id;
      previousTaken = Math.max(0, (balance.taken || 0) - (decided.days || 0));
    }
  }
  const verb = parsed.decision === 'APPROVED' ? 'Approved' : 'Rejected';
  const undoPayload = await remember(
    user,
    'LEAVE',
    [row.id],
    { leaveId: row.id, balanceId, previousTaken },
    `Undo ${verb.toLowerCase()} leave`,
  );
  return { ok: true, summary: `${verb} the oldest leave request.`, undoPayload, refresh: 'people' };
}

async function runLock(user) {
  const employer = await currentEmployer();
  if (!employer) return { ok: false, summary: 'Add a legal employer before locking a month.' };
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const existing = await opsService.getPeriod(employer.id, year, month);
  const wasLocked = Boolean(existing?.locked);
  const period = await opsService.lockPeriod(employer.id, year, month, user?.id);
  const undoPayload = await remember(
    user,
    'LOCK',
    [period.id],
    { periodId: period.id, wasLocked },
    `Undo lock for ${year}-${String(month).padStart(2, '0')}`,
  );
  return {
    ok: true,
    summary: wasLocked ? 'This month was already locked.' : `Locked attendance for ${month}/${year}.`,
    undoPayload,
    refresh: 'people',
  };
}

async function runPayroll(user) {
  const employer = await currentEmployer();
  if (!employer) return { ok: false, summary: 'Add a legal employer before running payroll.' };
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const result = await opsService.runPayroll({ legalEmployerId: employer.id, year, month }, user);
  const run = result?.run || result;
  const undoPayload = await remember(
    user,
    'PAYROLL',
    [run.id],
    { payrollRunId: run.id },
    `Undo payroll run ${month}/${year}`,
  );
  return { ok: true, summary: `Payroll run started for ${month}/${year}.`, undoPayload, refresh: 'people' };
}

export async function executeKnownPeopleCommand(user, parsed) {
  try {
    if (parsed.kind === 'punch') return await runPunch(user, parsed);
    if (parsed.kind === 'leave') return await runLeave(user, parsed);
    if (parsed.kind === 'lock') return await runLock(user);
    if (parsed.kind === 'payroll') return await runPayroll(user);
    return { ok: false, summary: 'That command is not one ARIA runs directly.' };
  } catch (error) {
    return { ok: false, summary: error?.message || 'Could not run that command.' };
  }
}

export async function undoKnownPeopleCommand(user, actionId) {
  const undo = await undoService.getValidUndo(actionId);
  if (!undo || String(undo.userId) !== String(user?.id)) {
    return { ok: false, summary: 'Undo is no longer available.' };
  }
  if (String(undo.module).toLowerCase() !== 'people') {
    return { ok: false, summary: 'That undo is not a People action.' };
  }
  const reverse = undo.reverseData || {};
  if (undo.action === 'PUNCH' && OBJECT_ID.test(String(reverse.punchId || ''))) {
    await prisma.attendancePunch.delete({ where: { id: reverse.punchId } }).catch(() => null);
  } else if (undo.action === 'LEAVE' && OBJECT_ID.test(String(reverse.leaveId || ''))) {
    await prisma.leaveRequest.update({
      where: { id: reverse.leaveId },
      data: { status: 'PENDING', remark: null, approverId: null },
    });
    if (reverse.balanceId && OBJECT_ID.test(String(reverse.balanceId))) {
      await prisma.leaveBalance.update({
        where: { id: reverse.balanceId },
        data: { taken: Number(reverse.previousTaken) || 0 },
      });
    }
  } else if (undo.action === 'LOCK' && OBJECT_ID.test(String(reverse.periodId || ''))) {
    if (!reverse.wasLocked) {
      await prisma.attendancePeriod.update({
        where: { id: reverse.periodId },
        data: { locked: false, lockedAt: null, lockedById: null },
      });
    }
  } else if (undo.action === 'PAYROLL' && OBJECT_ID.test(String(reverse.payrollRunId || ''))) {
    const run = await prisma.payrollRun.findFirst({ where: { id: reverse.payrollRunId } });
    const status = String(run?.status || '').toUpperCase();
    if (run && !['APPROVED', 'LOCKED', 'PAID'].includes(status)) {
      await prisma.payslip.deleteMany({ where: { payrollRunId: run.id } });
      await prisma.payrollException.deleteMany({ where: { payrollRunId: run.id } });
      await prisma.payrollRun.delete({ where: { id: run.id } });
    } else {
      return { ok: false, summary: 'That payroll run can no longer be undone.' };
    }
  } else {
    return { ok: false, summary: 'Nothing to undo.' };
  }
  await undoService.removeFromStack(actionId);
  return { ok: true, summary: 'Undone.' };
}
