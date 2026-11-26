import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { opsService } from '../peoplecore/ops.service.js';
import { undoService } from './undo.service.js';
import { assertKnownCountry } from '../peoplecore/countryPacks.js';
import {
  matchKnownPeopleCommand,
  parseCommandDate,
  listReply,
} from './ariaCommandMatch.js';

// Re-exported so existing callers can keep importing from this module.
export {
  matchKnownPeopleCommand,
  parseCommandDate,
  resolvePendingReply,
  isPeopleCommand,
} from './ariaCommandMatch.js';

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const PENDING_TTL_MS = 10 * 60 * 1000;

/** First match wins. Anything not listed stays with the normal Brain question path. */
// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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
    : new Date(Date.now() + PENDING_TTL_MS).toISOString();
  return { available: true, actionId, expiresAt, label };
}

async function currentEmployer() {
  return prisma.legalEmployer.findFirst({
    where: { isDeleted: { not: true } },
    orderBy: { createdAt: 'asc' },
  });
}

function employeeName(row) {
  return `${row?.firstName || ''} ${row?.lastName || ''}`.trim() || row?.email || 'employee';
}

async function findEmployees(name) {
  const rows = await prisma.employee.findMany({
    where: { isDeleted: { not: true } },
    take: 200,
    orderBy: { createdAt: 'desc' },
  });
  const q = String(name || '').toLowerCase();
  if (!q) return [];
  return rows.filter((row) => {
    const full = employeeName(row).toLowerCase();
    const email = String(row.email || '').toLowerCase();
    return full.includes(q) || email === q;
  });
}

async function getEmployee(id) {
  if (!OBJECT_ID.test(String(id || ''))) return null;
  return prisma.employee.findFirst({ where: { id, isDeleted: { not: true } } });
}

function choiceOptions(rows, labelOf, commandOf) {
  const labels = rows.map(labelOf);
  const dup = (l) => labels.filter((x) => x === l).length > 1;
  return rows.slice(0, 5).map((row, i) => {
    const base = labels[i];
    const email = row.email ? ` · ${row.email}` : '';
    const label = dup(base) ? `${base}${email}` : base;
    return { n: i + 1, label, match: base.toLowerCase(), command: commandOf(row) };
  });
}

/** Resolve `name` to one employee. Returns {employee} | {error} | {pending}. */
async function pickEmployee(name, intro, commandOf) {
  const hits = await findEmployees(name);
  if (!hits.length) {
    return { error: `No employee matches “${name}”. Try the full name.` };
  }
  if (hits.length === 1) return { employee: hits[0] };
  const makeCommand = typeof commandOf === 'function' ? commandOf : (e) => ({ employeeId: e.id });
  const options = choiceOptions(hits, employeeName, makeCommand);
  return {
    pending: {
      expects: 'choice',
      options,
      prompt: listReply(intro || `${hits.length} employees match “${name}”. Which one?`, options),
    },
    summary: null,
  };
}

function confirmPending(label, command) {
  return {
    pending: { expects: 'confirm', command, prompt: `${label} Reply yes to confirm, or cancel.` },
  };
}

function fieldPending(prompt, command, field) {
  return { pending: { expects: 'field', field, command, prompt } };
}

// ---------------------------------------------------------------------------
// Phase A handlers
// ---------------------------------------------------------------------------

async function runPunch(user, parsed) {
  if (parsed.employeeId) {
    const employee = await getEmployee(parsed.employeeId);
    if (!employee) return { ok: false, summary: 'That employee is no longer available. Ask again.' };
    return doPunch(user, employee);
  }
  if (!parsed.name) {
    return {
      ok: false,
      summary: 'Who should I punch? Say a name, for example: punch Ada.',
      ...fieldPending('Who should I punch? Say a name, for example: punch Ada.', { kind: 'punch' }, 'name'),
    };
  }
  const pick = await pickEmployee(parsed.name, null, (e) => ({ kind: 'punch', employeeId: e.id }));
  if (pick.error) return { ok: false, summary: pick.error };
  if (pick.pending) return { ok: false, summary: pick.pending.prompt, pending: pick.pending };
  return doPunch(user, pick.employee);
}

async function doPunch(user, employee) {
  const punch = await opsService.punch({ employeeId: employee.id, proxy: true }, user?.id);
  const undoPayload = await remember(
    user,
    'PUNCH',
    [punch.id],
    { punchId: punch.id },
    `Undo punch for ${employeeName(employee)}`,
  );
  const when = punch.localWorkDate || punch.workDate || '';
  return {
    ok: true,
    summary: `Punched ${employeeName(employee)}${when ? ` for ${String(when).slice(0, 10)}` : ''}.`,
    undoPayload,
    refresh: 'people',
  };
}

async function loadPendingLeaves() {
  const rows = await prisma.leaveRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  if (!rows.length) return [];
  const employeeIds = [...new Set(rows.map((r) => r.employeeId))];
  const typeIds = [...new Set(rows.map((r) => r.leaveTypeId))];
  const [employees, types] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: employeeIds } } }),
    prisma.leaveType.findMany({ where: { id: { in: typeIds } } }),
  ]);
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const typeMap = new Map(types.map((t) => [t.id, t]));
  return rows.map((row) => ({
    ...row,
    employee: empMap.get(row.employeeId) || null,
    leaveType: typeMap.get(row.leaveTypeId) || null,
  }));
}

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(d).slice(0, 10);
  }
}

function leaveLabel(row) {
  return `${employeeName(row.employee)} · ${row.leaveType?.name || 'Leave'} · ${fmtDate(row.startDate)} to ${fmtDate(row.endDate)}`;
}

async function runLeave(user, parsed) {
  if (parsed.leaveId) {
    const row = await prisma.leaveRequest.findFirst({ where: { id: parsed.leaveId, status: 'PENDING' } });
    if (!row) return { ok: false, summary: 'That leave is no longer pending.' };
    const [employee, leaveType] = await Promise.all([getEmployee(row.employeeId), prisma.leaveType.findFirst({ where: { id: row.leaveTypeId } })]);
    return doDecideLeave(user, { ...row, employee, leaveType }, parsed.decision);
  }

  const rows = await loadPendingLeaves();
  let pool = rows;
  if (parsed.name) {
    const emps = await findEmployees(parsed.name);
    const ids = new Set(emps.map((e) => e.id));
    pool = rows.filter((r) => ids.has(r.employeeId));
    if (!pool.length) return { ok: false, summary: `No pending leave for “${parsed.name}”.` };
  }
  if (!pool.length) return { ok: false, summary: 'No leave is waiting.' };

  if (parsed.oldest) return doDecideLeave(user, pool[0], parsed.decision);
  if (pool.length === 1) return doDecideLeave(user, pool[0], parsed.decision);

  const verb = parsed.decision === 'APPROVED' ? 'approve' : 'reject';
  const options = choiceOptions(pool, leaveLabel, (r) => ({ kind: 'leave', decision: parsed.decision, leaveId: r.id }));
  const prompt = listReply(`${pool.length} leave requests are waiting. Which one should I ${verb}?`, options);
  return { ok: false, summary: prompt, pending: { expects: 'choice', options, prompt } };
}

async function doDecideLeave(user, row, decision) {
  const decided = await opsService.decideLeave(row.id, decision, 'Brain', user?.id);
  let balanceId = null;
  let previousTaken = null;
  if (decision === 'APPROVED' && decided?.startDate) {
    const year = new Date(decided.startDate).getUTCFullYear();
    const balance = await prisma.leaveBalance.findFirst({
      where: { employeeId: decided.employeeId, leaveTypeId: decided.leaveTypeId, year },
    });
    if (balance) {
      balanceId = balance.id;
      previousTaken = Math.max(0, (balance.taken || 0) - (decided.days || 0));
    }
  }
  const verb = decision === 'APPROVED' ? 'Approved' : 'Rejected';
  const undoPayload = await remember(
    user,
    'LEAVE',
    [row.id],
    { leaveId: row.id, balanceId, previousTaken },
    `Undo ${verb.toLowerCase()} leave`,
  );
  const name = employeeName(row.employee);
  const type = row.leaveType?.name || 'leave';
  const days = row.days != null ? ` (${row.days} day${row.days === 1 ? '' : 's'})` : '';
  return {
    ok: true,
    summary: `${verb} ${name}’s ${type} leave, ${fmtDate(row.startDate)} to ${fmtDate(row.endDate)}${days}.`,
    undoPayload,
    refresh: 'people',
  };
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
    summary: wasLocked ? 'This month is already locked.' : `Locked attendance for ${month}/${year}.`,
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
  try {
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
  } catch (error) {
    if (error?.code === 'ATTENDANCE_NOT_LOCKED' || /lock/i.test(String(error?.message || ''))) {
      return { ok: false, summary: 'Attendance is not locked for this month. Lock this month first, then run payroll.' };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Phase B handlers
// ---------------------------------------------------------------------------

async function runApplyLeave(user, parsed) {
  const startDate = parseCommandDate(parsed.startDate);
  const endDate = parseCommandDate(parsed.endDate);
  if (!startDate || !endDate) {
    return { ok: false, summary: 'I could not read those dates. Try “26 Nov 2026” or “2026-11-26”.' };
  }
  const types = await prisma.leaveType.findMany({ where: { isDeleted: { not: true } }, take: 200 });
  const blob = parsed.blob;
  const words = blob.split(/\s+/);
  let best = null;
  for (let take = Math.min(3, words.length - 1); take >= 1 && !best; take -= 1) {
    const typeGuess = words.slice(-take).join(' ').toLowerCase();
    const nameGuess = words.slice(0, -take).join(' ');
    const matches = types.filter(
      (row) => row.name.toLowerCase() === typeGuess || row.code.toLowerCase() === typeGuess,
    );
    if (matches.length) best = { nameGuess, typeMatches: matches };
  }
  if (!best) {
    return { ok: false, summary: 'I could not find the leave type in that sentence. Try: apply leave <name> <type> from <date> to <date>.' };
  }
  const pick = await pickEmployee(best.nameGuess, null, null);
  if (pick.error) return { ok: false, summary: pick.error };
  if (pick.pending) {
    // Re-resolve the leave type once the employee is chosen.
    const options = pick.pending.options.map((o) => ({
      ...o,
      command: {
        kind: 'apply-leave-resolve-type',
        employeeId: o.command.employeeId,
        typeCandidates: best.typeMatches.map((t) => t.id),
        startDate,
        endDate,
      },
    }));
    const pending = { expects: 'choice', options, prompt: pick.pending.prompt };
    return { ok: false, summary: pick.pending.prompt, pending };
  }
  return finishApplyLeave(user, pick.employee, best.typeMatches, startDate, endDate);
}

async function finishApplyLeave(user, employee, typeMatches, startDate, endDate) {
  const typed = typeMatches.filter((t) => !employee.legalEmployerCountry || t.country === employee.legalEmployerCountry);
  const pool = typed.length ? typed : typeMatches;
  if (pool.length > 1) {
    const options = choiceOptions(pool, (t) => t.name, (t) => ({
      kind: 'apply-leave-final', employeeId: employee.id, leaveTypeId: t.id, startDate, endDate,
    }));
    const prompt = listReply(`Two leave types match. Which one for ${employeeName(employee)}?`, options);
    return { ok: false, summary: prompt, pending: { expects: 'choice', options, prompt } };
  }
  return doApplyLeave(user, employee, pool[0], startDate, endDate);
}

async function doApplyLeave(user, employee, leaveType, startDate, endDate) {
  const row = await opsService.applyLeave({
    employeeId: employee.id,
    leaveTypeId: leaveType.id,
    startDate,
    endDate,
  });
  return {
    ok: true,
    summary: `Applied ${leaveType.name} leave for ${employeeName(employee)}, ${fmtDate(startDate)} to ${fmtDate(endDate)} — it is waiting for approval.`,
    refresh: 'people',
  };
}

async function runApplyLeaveResolveType(user, parsed) {
  const employee = await getEmployee(parsed.employeeId);
  if (!employee) return { ok: false, summary: 'That employee is no longer available.' };
  const types = await prisma.leaveType.findMany({ where: { id: { in: parsed.typeCandidates || [] } } });
  if (!types.length) return { ok: false, summary: 'I lost the leave type. Type the command again.' };
  return finishApplyLeave(user, employee, types, parsed.startDate, parsed.endDate);
}

async function runApplyLeaveFinal(user, parsed) {
  const employee = await getEmployee(parsed.employeeId);
  const leaveType = await prisma.leaveType.findFirst({ where: { id: parsed.leaveTypeId } });
  if (!employee || !leaveType) return { ok: false, summary: 'That leave request is no longer possible. Type the command again.' };
  return doApplyLeave(user, employee, leaveType, parsed.startDate, parsed.endDate);
}

async function runRegularise(user, parsed) {
  const workDate = parseCommandDate(parsed.date);
  if (!workDate) return { ok: false, summary: 'I could not read that date. Try “regularise Ada 26 Nov 2026”.' };
  if (parsed.employeeId) {
    const employee = await getEmployee(parsed.employeeId);
    if (!employee) return { ok: false, summary: 'That employee is no longer available.' };
    return doRegularise(user, employee, workDate);
  }
  const pick = await pickEmployee(parsed.name, null, (e) => ({ kind: 'regularise', employeeId: e.id, date: parsed.date }));
  if (pick.error) return { ok: false, summary: pick.error };
  if (pick.pending) return { ok: false, summary: pick.pending.prompt, pending: pick.pending };
  return doRegularise(user, pick.employee, workDate);
}

async function doRegularise(user, employee, workDate) {
  await opsService.requestRegularisation({ employeeId: employee.id, localWorkDate: workDate }, user?.id);
  return {
    ok: true,
    summary: `Regularisation request opened for ${employeeName(employee)} on ${workDate} — it is in the inbox for approval.`,
    refresh: 'people',
  };
}

async function runOnboarding(user, parsed) {
  if (parsed.taskId) {
    const task = await prisma.onboardingTask.findFirst({ where: { id: parsed.taskId } });
    if (!task) return { ok: false, summary: 'That task is no longer available.' };
    if (task.status === 'DONE') return { ok: false, summary: 'That task is already done.' };
    return doCompleteTask(user, task);
  }
  const words = parsed.blob.split(/\s+/);
  for (let take = Math.min(4, words.length - 1); take >= 1; take -= 1) {
    const nameGuess = words.slice(0, take).join(' ');
    const taskGuess = words.slice(take).join(' ').toLowerCase();
    const emps = await findEmployees(nameGuess);
    if (emps.length !== 1) continue;
    const tasks = await opsService.listOnboarding(emps[0].id);
    const pendingTasks = (Array.isArray(tasks) ? tasks : []).filter(
      (row) => String(row.status).toUpperCase() !== 'DONE' && String(row.label || '').toLowerCase().includes(taskGuess),
    );
    if (pendingTasks.length === 1) return doCompleteTask(user, pendingTasks[0], emps[0]);
    if (pendingTasks.length > 1) {
      const options = choiceOptions(pendingTasks, (row) => row.label, (row) => ({ kind: 'onboarding', taskId: row.id }));
      const prompt = listReply(`${emps[0].firstName || 'That employee'} has a few open tasks. Which one?`, options);
      return { ok: false, summary: prompt, pending: { expects: 'choice', options, prompt } };
    }
  }
  return { ok: false, summary: 'I could not match that person or task. Try: complete onboarding <name> <task>.' };
}

async function doCompleteTask(user, task, employee) {
  const done = await opsService.completeOnboardingTask(task.id);
  const emp = employee || (await getEmployee(task.employeeId));
  const remaining = await prisma.onboardingTask.count({ where: { employeeId: task.employeeId, status: { not: 'DONE' } } });
  const suffix = remaining === 0 ? ` ${employeeName(emp)} is now marked ready.` : ` ${remaining} task(s) left before ${employeeName(emp)} is ready.`;
  return { ok: true, summary: `Completed “${task.label}” for ${employeeName(emp)}.${suffix}`, refresh: 'people' };
}

async function runEmployeeStatus(user, parsed, { kind, prompt }) {
  const resolved = parsed.employeeId ? { employee: await getEmployee(parsed.employeeId) } : await pickEmployee(
    parsed.name,
    null,
    (e) => ({ kind, employeeId: e.id }),
  );
  if (resolved?.error) return { ok: false, summary: resolved.error };
  if (resolved?.pending) return { ok: false, summary: resolved.pending.prompt, pending: resolved.pending };
  const employee = resolved?.employee;
  if (!employee) return { ok: false, summary: 'That employee is no longer available.' };
  if (parsed.awaitingConfirm !== true) {
    const c = confirmPending(prompt(employee), { ...parsed, employeeId: employee.id, awaitingConfirm: true });
    return { ok: false, summary: c.pending.prompt, pending: c.pending };
  }
  if (kind === 'join') {
    await opsService.joinEmployee(employee.id, {});
    return { ok: true, summary: `${employeeName(employee)} joined today.`, refresh: 'people' };
  }
  if (kind === 'defer') {
    await opsService.deferEmployee(employee.id, {});
    return { ok: true, summary: `${employeeName(employee)} is deferred.`, refresh: 'people' };
  }
  await opsService.markNoShow(employee.id);
  return { ok: true, summary: `Marked ${employeeName(employee)} as no-show.`, refresh: 'people' };
}

async function runExitStart(user, parsed) {
  const resolved = parsed.employeeId ? { employee: await getEmployee(parsed.employeeId) } : await pickEmployee(
    parsed.name,
    null,
    (e) => ({ kind: 'exit-start', employeeId: e.id }),
  );
  if (resolved?.error) return { ok: false, summary: resolved.error };
  if (resolved?.pending) return { ok: false, summary: resolved.pending.prompt, pending: resolved.pending };
  const employee = resolved?.employee;
  if (!employee) return { ok: false, summary: 'That employee is no longer available.' };
  if (parsed.awaitingConfirm !== true) {
    const c = confirmPending(`Start an exit for ${employeeName(employee)}?`, { ...parsed, employeeId: employee.id, awaitingConfirm: true });
    return { ok: false, summary: c.pending.prompt, pending: c.pending };
  }
  const open = await prisma.exitCase.findFirst({ where: { employeeId: employee.id, status: { not: 'CLEARED' } } });
  if (open) return { ok: false, summary: `${employeeName(employee)} already has an open exit.` };
  await opsService.createExit({ employeeId: employee.id });
  return { ok: true, summary: `Exit opened for ${employeeName(employee)} — it is in the inbox for approval.`, refresh: 'people' };
}

async function runExitComplete(user, parsed) {
  if (parsed.exitId) {
    const exitCase = await prisma.exitCase.findFirst({ where: { id: parsed.exitId, status: { not: 'CLEARED' } } });
    if (!exitCase) return { ok: false, summary: 'That exit is no longer open.' };
    if (parsed.awaitingConfirm !== true) {
      const employee = await getEmployee(exitCase.employeeId);
      const c = confirmPending(`Complete the exit for ${employeeName(employee)}?`, { ...parsed, awaitingConfirm: true });
      return { ok: false, summary: c.pending.prompt, pending: c.pending };
    }
    try {
      await opsService.completeExit(exitCase.id, {});
    } catch (error) {
      if (error?.code === 'ASSETS_ALLOCATED') {
        return { ok: false, summary: 'Cannot complete the exit — assets are still allocated. Return them first.' };
      }
      throw error;
    }
    const employee = await getEmployee(exitCase.employeeId);
    return { ok: true, summary: `Exit completed for ${employeeName(employee)}.`, refresh: 'people' };
  }
  const employee = parsed.employeeId ? await getEmployee(parsed.employeeId) : null;
  if (parsed.employeeId && !employee) return { ok: false, summary: 'That employee is no longer available.' };
  if (!employee) {
    const pick = await pickEmployee(parsed.name, null, (e) => ({ kind: 'exit-complete', employeeId: e.id }));
    if (pick.error) return { ok: false, summary: pick.error };
    if (pick.pending) return { ok: false, summary: pick.pending.prompt, pending: pick.pending };
    return runExitComplete(user, { ...parsed, employeeId: pick.employee.id });
  }
  const openCases = await prisma.exitCase.findMany({
    where: { employeeId: employee.id, status: { not: 'CLEARED' } },
    orderBy: { createdAt: 'desc' },
  });
  if (!openCases.length) return { ok: false, summary: `No open exit for ${employeeName(employee)}.` };
  if (openCases.length > 1) {
    const options = choiceOptions(openCases, (r) => `${r.kind || 'Exit'} opened ${fmtDate(r.createdAt)}`, (r) => ({ kind: 'exit-complete', exitId: r.id }));
    const prompt = listReply(`${employeeName(employee)} has ${openCases.length} open exits. Which one?`, options);
    return { ok: false, summary: prompt, pending: { expects: 'choice', options, prompt } };
  }
  return runExitComplete(user, { ...parsed, exitId: openCases[0].id });
}

async function runAssetAssign(user, parsed) {
  if (parsed.assetId && parsed.employeeId) {
    const [asset, employee] = await Promise.all([
      prisma.assetItem.findFirst({ where: { id: parsed.assetId } }),
      getEmployee(parsed.employeeId),
    ]);
    if (!asset || !employee) return { ok: false, summary: 'That asset or employee is no longer available.' };
    await opsService.assignAsset({ assetId: asset.id, employeeId: employee.id });
    return { ok: true, summary: `Assigned ${asset.name} (${asset.serial}) to ${employeeName(employee)}.`, refresh: 'people' };
  }
  const assets = await prisma.assetItem.findMany({ take: 200, orderBy: { createdAt: 'desc' } });
  const q = parsed.asset.toLowerCase();
  const available = assets.filter((a) => String(a.status || '').toUpperCase() !== 'ALLOCATED');
  const matches = available.filter(
    (a) => a.serial.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
  );
  if (!matches.length) {
    const taken = assets.find((a) => a.serial.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
    if (taken) return { ok: false, summary: `${taken.name} (${taken.serial}) is already allocated.` };
    return { ok: false, summary: `No asset matches “${parsed.asset}”. Try the serial number.` };
  }
  let asset = matches[0];
  if (matches.length > 1) {
    const options = choiceOptions(matches, (a) => `${a.name} (${a.serial})`, (a) => ({
      kind: 'asset-assign-pick-person', assetId: a.id, name: parsed.name,
    }));
    const prompt = listReply(`${matches.length} assets match “${parsed.asset}”. Which one?`, options);
    return { ok: false, summary: prompt, pending: { expects: 'choice', options, prompt } };
  }
  const pick = await pickEmployee(parsed.name, null, (e) => ({ kind: 'asset-assign', assetId: asset.id, employeeId: e.id }));
  if (pick.error) return { ok: false, summary: pick.error };
  if (pick.pending) return { ok: false, summary: pick.pending.prompt, pending: pick.pending };
  return runAssetAssign(user, { ...parsed, assetId: asset.id, employeeId: pick.employee.id });
}

async function runAssetAssignPickPerson(user, parsed) {
  const pick = await pickEmployee(parsed.name, null, (e) => ({ kind: 'asset-assign', assetId: parsed.assetId, employeeId: e.id }));
  if (pick.error) return { ok: false, summary: pick.error };
  if (pick.pending) return { ok: false, summary: pick.pending.prompt, pending: pick.pending };
  return runAssetAssign(user, { ...parsed, employeeId: pick.employee.id });
}

async function runAssetReturn(user, parsed) {
  if (parsed.assignmentId) {
    const assignment = await prisma.assetAssignment.findFirst({ where: { id: parsed.assignmentId, returnedAt: null } });
    if (!assignment) return { ok: false, summary: 'That assignment is already returned.' };
    return doReturnAsset(assignment);
  }
  const q = parsed.asset.toLowerCase();
  const assets = await prisma.assetItem.findMany({ take: 200 });
  const matches = assets.filter((a) => a.serial.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  if (!matches.length) return { ok: false, summary: `No asset matches “${parsed.asset}”. Try the serial number.` };
  const open = await prisma.assetAssignment.findMany({
    where: { assetId: { in: matches.map((a) => a.id) }, returnedAt: null },
  });
  if (!open.length) return { ok: false, summary: `No open assignment for “${parsed.asset}”.` };
  if (open.length > 1) {
    const options = await Promise.all(open.slice(0, 5).map(async (a, i) => {
      const [asset, emp] = await Promise.all([prisma.assetItem.findFirst({ where: { id: a.assetId } }), getEmployee(a.employeeId)]);
      const label = `${asset?.name || 'Asset'} (${asset?.serial || '—'}) with ${employeeName(emp)}`;
      return { n: i + 1, label, match: label.toLowerCase(), command: { kind: 'asset-return', assignmentId: a.id } };
    }));
    const prompt = listReply('More than one assignment is open. Which one?', options);
    return { ok: false, summary: prompt, pending: { expects: 'choice', options, prompt } };
  }
  return doReturnAsset(open[0]);
}

async function doReturnAsset(assignment) {
  await opsService.returnAsset(assignment.id, null);
  const [asset, emp] = await Promise.all([
    prisma.assetItem.findFirst({ where: { id: assignment.assetId } }),
    getEmployee(assignment.employeeId),
  ]);
  return { ok: true, summary: `Returned ${asset?.name || 'the asset'} (${asset?.serial || ''}) from ${employeeName(emp)}.`, refresh: 'people' };
}

async function runLetter(user, parsed) {
  const resolved = parsed.employeeId ? { employee: await getEmployee(parsed.employeeId) } : await pickEmployee(
    parsed.name,
    null,
    (e) => ({ kind: 'letter', letterType: parsed.letterType, employeeId: e.id }),
  );
  if (resolved?.error) return { ok: false, summary: resolved.error };
  if (resolved?.pending) return { ok: false, summary: resolved.pending.prompt, pending: resolved.pending };
  const employee = resolved?.employee;
  if (!employee) return { ok: false, summary: 'That employee is no longer available.' };
  let pack = null;
  try {
    pack = assertKnownCountry(employee.legalEmployerCountry);
  } catch {
    return { ok: false, summary: `${employeeName(employee)} is not on a known country pack.` };
  }
  const q = parsed.letterType.toLowerCase().replace(/[\s_-]+/g, ' ');
  const matches = (pack.letterTypes || []).filter((t) => {
    const id = String(t.id || '').toLowerCase().replace(/[\s_-]+/g, ' ');
    const label = String(t.label || t.id || '').toLowerCase().replace(/[\s_-]+/g, ' ');
    return id === q || label === q || label.includes(q) || id.includes(q.replace(/\s+/g, '_'));
  });
  if (!matches.length) {
    const list = (pack.letterTypes || []).map((t) => t.label || t.id).join(', ');
    return { ok: false, summary: `No letter type “${parsed.letterType}” in the ${employee.legalEmployerCountry} pack. Available: ${list || 'none'}.` };
  }
  if (matches.length > 1) {
    const options = choiceOptions(matches, (t) => t.label || t.id, (t) => ({
      kind: 'letter-final', employeeId: employee.id, letterType: t.id, awaitingConfirm: true,
    }));
    const prompt = listReply(`More than one letter type matches. Which one for ${employeeName(employee)}?`, options);
    return { ok: false, summary: prompt, pending: { expects: 'choice', options, prompt } };
  }
  return runLetter(user, { ...parsed, letterType: matches[0].id, employeeId: employee.id, letterResolved: true });
}

async function runLetterFinal(user, parsed) {
  const employee = await getEmployee(parsed.employeeId);
  if (!employee) return { ok: false, summary: 'That employee is no longer available.' };
  let pack;
  try {
    pack = assertKnownCountry(employee.legalEmployerCountry);
  } catch {
    return { ok: false, summary: `${employeeName(employee)} is not on a known country pack.` };
  }
  const type = (pack.letterTypes || []).find((t) => t.id === parsed.letterType);
  if (!type) return { ok: false, summary: 'That letter type is no longer available.' };
  if (parsed.awaitingConfirm !== true) {
    const c = confirmPending(`Issue a ${type.label || type.id} to ${employeeName(employee)}?`, { ...parsed, awaitingConfirm: true });
    return { ok: false, summary: c.pending.prompt, pending: c.pending };
  }
  await opsService.issueLetter({ employeeId: employee.id, letterType: type.id });
  return { ok: true, summary: `Issued ${type.label || type.id} to ${employeeName(employee)}.`, refresh: 'people' };
}

async function runInbox(user, parsed) {
  if (parsed.inboxId) {
    const row = await prisma.peopleApproval.findFirst({ where: { id: parsed.inboxId, status: 'PENDING' } });
    if (!row) return { ok: false, summary: 'That inbox item is no longer pending.' };
    return doDecideInbox(user, row, parsed.decision);
  }
  const rows = (await opsService.listInbox()).filter((r) => String(r.status || '').toUpperCase() === 'PENDING');
  if (!rows.length) return { ok: false, summary: 'Nothing is waiting in the inbox.' };
  const emps = await prisma.employee.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.employeeId).filter(Boolean))] } },
  });
  const empMap = new Map(emps.map((e) => [e.id, e]));
  const labelOf = (r) => `${r.kind || 'Item'} for ${employeeName(empMap.get(r.employeeId))}`;
  let pool = rows;
  const pickVal = String(parsed.pick || '').trim();
  if (pickVal) {
    const asNum = pickVal.match(/^\d{1,2}$/);
    if (asNum) {
      const idx = Number(asNum[1]) - 1;
      if (!pool[idx]) return { ok: false, summary: `There is no item number ${asNum[1]}. Say “approve inbox” to see the list.` };
      return doDecideInbox(user, pool[idx], parsed.decision, labelOf(pool[idx]));
    }
    const q = pickVal.toLowerCase();
    pool = rows.filter((r) => employeeName(empMap.get(r.employeeId)).toLowerCase().includes(q));
    if (!pool.length) return { ok: false, summary: `No pending inbox item for “${pickVal}”.` };
  }
  if (pool.length === 1) return doDecideInbox(user, pool[0], parsed.decision, labelOf(pool[0]));
  const verb = parsed.decision === 'APPROVED' ? 'approve' : 'reject';
  const options = choiceOptions(pool, labelOf, (r) => ({ kind: 'inbox', decision: parsed.decision, inboxId: r.id }));
  const prompt = listReply(`${pool.length} items are waiting. Which one should I ${verb}?`, options);
  return { ok: false, summary: prompt, pending: { expects: 'choice', options, prompt } };
}

async function doDecideInbox(user, row, decision, label) {
  await opsService.decideInbox(row.id, decision, 'Brain', null);
  const verb = decision === 'APPROVED' ? 'Approved' : 'Rejected';
  const name = label || `${row.kind || 'Item'} in the inbox`;
  return { ok: true, summary: `${verb} ${name}.`, refresh: 'people' };
}

async function runPayrollDecide(user, parsed) {
  const runs = await prisma.payrollRun.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  const wanted = parsed.decision === 'LOCKED' ? 'APPROVED' : 'REVIEW';
  const pool = runs.filter((r) => String(r.status || '').toUpperCase() === wanted || (parsed.decision !== 'LOCKED' && String(r.status || '').toUpperCase() === 'EXCEPTIONS'));
  if (!pool.length) {
    return {
      ok: false,
      summary: parsed.decision === 'LOCKED'
        ? 'No approved payroll run is waiting to be locked.'
        : 'No payroll run is waiting for approval.',
    };
  }
  const run = pool[0];
  if (parsed.awaitingConfirm !== true) {
    const label = `${parsed.decision === 'LOCKED' ? 'Lock' : 'Approve'} payroll run ${run.month || ''}/${run.year || ''}`.trim();
    const c = confirmPending(`${label}?`, { ...parsed, runId: run.id, awaitingConfirm: true });
    return { ok: false, summary: c.pending.prompt, pending: c.pending };
  }
  const target = run.id && parsed.runId ? parsed.runId : run.id;
  if (parsed.decision === 'LOCKED') {
    await opsService.lockPayroll(target);
    return { ok: true, summary: 'Payroll run locked.', refresh: 'people' };
  }
  await opsService.approvePayroll(target);
  return { ok: true, summary: 'Payroll run approved.', refresh: 'people' };
}

// ---------------------------------------------------------------------------
// Phase C handlers — resolved ids -> workflow spec for executeApprovedWorkflow
// ---------------------------------------------------------------------------

async function findByName(model, fields, q, extraWhere = {}) {
  const rows = await prisma[model].findMany({ where: extraWhere, take: 200 });
  const needle = String(q || '').toLowerCase();
  return rows.filter(
    (row) => !row.isDeleted && fields.some((f) => String(row[f] || '').toLowerCase().includes(needle)),
  );
}

const crmLabel = {
  lead: (r) => r.companyName || r.email || 'lead',
  client: (r) => r.companyName || 'client',
  candidate: (r) => `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || 'candidate',
  job: (r) => r.title || 'job',
  task: (r) => r.title || 'task',
  user: (r) => r.name || r.email || 'user',
  stage: (r) => r.name || 'stage',
  placement: (r) => r.id,
};

async function findCrm(kind, q, extraWhere) {
  switch (kind) {
    case 'lead': return findByName('lead', ['companyName', 'email'], q, extraWhere);
    case 'client': return findByName('client', ['companyName'], q, extraWhere);
    case 'candidate': return findByName('candidate', ['firstName', 'lastName', 'email'], q, extraWhere);
    case 'job': return findByName('job', ['title'], q, extraWhere);
    case 'task': return findByName('task', ['title'], q, { status: { not: 'DONE' }, ...extraWhere });
    case 'user': return findByName('user', ['name', 'email'], q, extraWhere);
    case 'stage': return prisma.pipelineStage.findMany({
      where: { ...(extraWhere || {}) },
      take: 50,
    }).then((rows) => rows.filter((r) => String(r.name || '').toLowerCase().includes(String(q || '').toLowerCase())));
    default: return [];
  }
}

/** Resolve one CRM entity or produce a numbered choice. */
async function pickCrm(kind, q, noun, commandOf, extraWhere) {
  const hits = await findCrm(kind, q, extraWhere);
  if (!hits.length) return { error: `No ${noun} matches “${q}”.` };
  if (hits.length === 1) return { row: hits[0] };
  const options = choiceOptions(hits, crmLabel[kind] || ((r) => r.id), commandOf);
  const prompt = listReply(`${hits.length} ${noun}s match “${q}”. Which one?`, options);
  return { pending: { expects: 'choice', options, prompt }, summary: prompt };
}

async function runCrm(user, parsed) {
  const spec = await buildCrmSpec(user, parsed);
  if (spec.error) return { ok: false, summary: spec.error };
  if (spec.pending) return { ok: false, summary: spec.pending.prompt, pending: spec.pending };
  // Writes the screen confirms — the chat asks "yes" once before they run.
  const confirms = new Set(['convert_lead_to_client', 'move_candidate_stage', 'mark_placement_joined']);
  if (parsed.awaitingConfirm !== true && confirms.has(parsed.action)) {
    const c = confirmPending(`${spec.confirmLabel}?`, { ...parsed, awaitingConfirm: true });
    return { ok: false, summary: c.pending.prompt, pending: c.pending };
  }
  return {
    ok: true,
    summary: spec.summary,
    workflowSpec: spec.workflow,
    confirmLabel: spec.confirmLabel,
    refresh: 'crm',
  };
}

async function buildCrmSpec(user, parsed) {
  switch (parsed.action) {
    case 'create_lead': {
      return {
        workflow: { action_type: 'create_lead', payload: { companyName: parsed.company } },
        summary: `Creating lead for ${parsed.company}.`,
        confirmLabel: `Create a lead for ${parsed.company}`,
      };
    }
    case 'update_lead': {
      if (!parsed.recordId) {
        const pick = await pickCrm('lead', parsed.company, 'lead', (r) => ({ ...parsed, recordId: r.id }));
        if (pick.error) return { error: pick.error };
        if (pick.pending) return pick;
        parsed = { ...parsed, recordId: pick.row.id };
      }
      return {
        workflow: { action_type: 'update_lead', record_id: parsed.recordId, payload: { status: parsed.status.toUpperCase() } },
        summary: `Updating lead status to ${parsed.status}.`,
        confirmLabel: `Update the lead status to ${parsed.status}`,
      };
    }
    case 'convert_lead_to_client': {
      if (!parsed.recordId) {
        const pick = await pickCrm('lead', parsed.company, 'lead', (r) => ({ ...parsed, recordId: r.id }));
        if (pick.error) return { error: pick.error };
        if (pick.pending) return pick;
        parsed = { ...parsed, recordId: pick.row.id };
      }
      const lead = await prisma.lead.findFirst({ where: { id: parsed.recordId } });
      return {
        workflow: { action_type: 'convert_lead_to_client', record_id: parsed.recordId, payload: {} },
        summary: `Converting ${lead?.companyName || 'the lead'} to a client.`,
        confirmLabel: `Convert ${lead?.companyName || 'this lead'} to a client`,
      };
    }
    case 'create_client': {
      return {
        workflow: { action_type: 'create_client', payload: { companyName: parsed.company } },
        summary: `Creating client ${parsed.company}.`,
        confirmLabel: `Create a client named ${parsed.company}`,
      };
    }
    case 'create_job': {
      if (!parsed.clientId) {
        const pick = await pickCrm('client', parsed.client, 'client', (r) => ({ ...parsed, clientId: r.id }));
        if (pick.error) return { error: pick.error };
        if (pick.pending) return pick;
        parsed = { ...parsed, clientId: pick.row.id };
      }
      return {
        workflow: {
          action_type: 'create_job',
          payload: { title: parsed.title, clientId: parsed.clientId, status: 'DRAFT', statusLabel: 'Draft' },
        },
        summary: `Creating draft job “${parsed.title}”.`,
        confirmLabel: `Create a draft job “${parsed.title}”`,
      };
    }
    case 'move_candidate_stage': {
      if (!parsed.candidateId) {
        const pick = await pickCrm('candidate', parsed.candidate, 'candidate', (r) => ({ ...parsed, candidateId: r.id }));
        if (pick.error) return { error: pick.error };
        if (pick.pending) return pick;
        parsed = { ...parsed, candidateId: pick.row.id };
      }
      if (!parsed.jobId) {
        const pick = await pickCrm('job', parsed.job, 'job', (r) => ({ ...parsed, jobId: r.id }));
        if (pick.error) return { error: pick.error };
        if (pick.pending) return pick;
        parsed = { ...parsed, jobId: pick.row.id };
      }
      if (!parsed.stageId) {
        const pick = await pickCrm('stage', parsed.stage, 'stage', (r) => ({ ...parsed, stageId: r.id }), { jobId: parsed.jobId });
        if (pick.error) return { error: `No stage matches “${parsed.stage}” on that job.` };
        if (pick.pending) return pick;
        parsed = { ...parsed, stageId: pick.row.id };
      }
      const [cand, job, stage] = await Promise.all([
        prisma.candidate.findFirst({ where: { id: parsed.candidateId } }),
        prisma.job.findFirst({ where: { id: parsed.jobId } }),
        prisma.pipelineStage.findFirst({ where: { id: parsed.stageId } }),
      ]);
      return {
        workflow: {
          action_type: 'move_candidate_stage',
          payload: { candidateId: parsed.candidateId, jobId: parsed.jobId, stageId: parsed.stageId },
        },
        summary: `Moving ${crmLabel.candidate(cand || {})} to ${stage?.name || parsed.stage} on ${job?.title || parsed.job}.`,
        confirmLabel: `Move ${crmLabel.candidate(cand || {})} to ${stage?.name || 'that stage'} on ${job?.title || 'that job'}`,
      };
    }
    case 'schedule_interview': {
      if (!parsed.candidateId || !parsed.jobId) {
        const words = String(parsed.blob || '').split(/\s+/);
        for (let take = Math.min(4, words.length - 1); take >= 1; take -= 1) {
          const candGuess = words.slice(0, take).join(' ');
          const jobGuess = words.slice(take).join(' ');
          const cands = await findCrm('candidate', candGuess);
          if (cands.length !== 1) continue;
          const jobs = await findCrm('job', jobGuess);
          if (jobs.length === 1) {
            parsed = { ...parsed, candidateId: cands[0].id, jobId: jobs[0].id };
            break;
          }
          if (jobs.length > 1) {
            const options = choiceOptions(jobs, crmLabel.job, (j) => ({ ...parsed, candidateId: cands[0].id, jobId: j.id }));
            const prompt = listReply(`${jobs.length} jobs match. Which one?`, options);
            return { pending: { expects: 'choice', options, prompt } };
          }
        }
        if (!parsed.candidateId || !parsed.jobId) {
          return { error: 'I could not match the candidate and job. Try: schedule interview <candidate> <job> on <date>.' };
        }
      }
      const date = parseCommandDate(parsed.date);
      if (!date) return { error: 'I could not read that date. Try “on 26 Nov 2026” or “on 2026-11-26”.' };
      if (!parsed.time) {
        const pending = fieldPending('What time should the interview be? Say a time like 9:00 AM.', { ...parsed, date }, 'time');
        return { pending };
      }
      const [cand, job] = await Promise.all([
        prisma.candidate.findFirst({ where: { id: parsed.candidateId } }),
        prisma.job.findFirst({ where: { id: parsed.jobId } }),
      ]);
      return {
        workflow: {
          action_type: 'schedule_interview',
          payload: { candidateId: parsed.candidateId, jobId: parsed.jobId, date, time: parsed.time },
        },
        summary: `Scheduling an interview for ${crmLabel.candidate(cand || {})} on ${job?.title || 'the job'}, ${date} at ${parsed.time}.`,
        confirmLabel: `Schedule the interview for ${crmLabel.candidate(cand || {})} on ${date} at ${parsed.time}`,
      };
    }
    case 'create_task': {
      if (!parsed.assigneeId) {
        const pick = await pickCrm('user', parsed.assignee, 'person', (r) => ({ ...parsed, assigneeId: r.id }));
        if (pick.error) return { error: pick.error };
        if (pick.pending) return pick;
        parsed = { ...parsed, assigneeId: pick.row.id };
      }
      const assignee = await prisma.user.findFirst({ where: { id: parsed.assigneeId } });
      return {
        workflow: { action_type: 'create_task', payload: { title: parsed.title, assignedToId: parsed.assigneeId } },
        summary: `Adding task “${parsed.title}” for ${assignee?.name || 'that person'}.`,
        confirmLabel: `Add task “${parsed.title}” for ${assignee?.name || 'that person'}`,
      };
    }
    case 'complete_task': {
      if (!parsed.recordId) {
        const pick = await pickCrm('task', parsed.title, 'task', (r) => ({ ...parsed, recordId: r.id }));
        if (pick.error) return { error: pick.error };
        if (pick.pending) return pick;
        parsed = { ...parsed, recordId: pick.row.id };
      }
      return {
        workflow: { action_type: 'complete_task', record_id: parsed.recordId, payload: {} },
        summary: `Completing task “${parsed.title}”.`,
        confirmLabel: `Complete task “${parsed.title}”`,
      };
    }
    case 'create_placement': {
      if (!parsed.candidateId) {
        const pick = await pickCrm('candidate', parsed.candidate, 'candidate', (r) => ({ ...parsed, candidateId: r.id }));
        if (pick.error) return { error: pick.error };
        if (pick.pending) return pick;
        parsed = { ...parsed, candidateId: pick.row.id };
      }
      if (!parsed.jobId) {
        const pick = await pickCrm('job', parsed.job, 'job', (r) => ({ ...parsed, jobId: r.id }));
        if (pick.error) return { error: pick.error };
        if (pick.pending) return pick;
        parsed = { ...parsed, jobId: pick.row.id };
      }
      const [cand, job] = await Promise.all([
        prisma.candidate.findFirst({ where: { id: parsed.candidateId } }),
        prisma.job.findFirst({ where: { id: parsed.jobId } }),
      ]);
      return {
        workflow: {
          action_type: 'create_placement',
          payload: { candidateId: parsed.candidateId, jobId: parsed.jobId, startDate: new Date().toISOString().slice(0, 10) },
        },
        summary: `Creating a placement for ${crmLabel.candidate(cand || {})} on ${job?.title || 'the job'}.`,
        confirmLabel: `Create a placement for ${crmLabel.candidate(cand || {})} on ${job?.title || 'that job'}`,
      };
    }
    case 'mark_placement_joined': {
      if (!parsed.recordId) {
        if (!parsed.candidateId) {
          const pick = await pickCrm('candidate', parsed.candidate, 'candidate', (r) => ({ ...parsed, candidateId: r.id }));
          if (pick.error) return { error: pick.error };
          if (pick.pending) return pick;
          parsed = { ...parsed, candidateId: pick.row.id };
        }
        const placements = await prisma.placement.findMany({
          where: { candidateId: parsed.candidateId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        const open = placements.filter((p) => !['JOINED', 'ENDED', 'CANCELLED'].includes(String(p.status || '').toUpperCase()));
        if (!open.length) return { error: 'No open placement for that candidate.' };
        if (open.length > 1) {
          const options = choiceOptions(open, (p) => `Placement ${p.id.slice(-6)} on job ${p.jobId.slice(-6)}`, (p) => ({ ...parsed, recordId: p.id }));
          const prompt = listReply('More than one open placement. Which one?', options);
          return { pending: { expects: 'choice', options, prompt } };
        }
        parsed = { ...parsed, recordId: open[0].id };
      }
      const cand = await prisma.candidate.findFirst({ where: { id: parsed.candidateId } });
      return {
        workflow: { action_type: 'mark_placement_joined', record_id: parsed.recordId, payload: {} },
        summary: `Marking ${crmLabel.candidate(cand || {})} as joined.`,
        confirmLabel: `Mark ${crmLabel.candidate(cand || {})} as joined`,
      };
    }
    default:
      return { error: 'That command is not one Brain runs directly.' };
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function executeKnownPeopleCommand(user, parsed) {
  try {
    switch (parsed.kind) {
      case 'punch': return await runPunch(user, parsed);
      case 'leave': return await runLeave(user, parsed);
      case 'lock': return await runLock(user);
      case 'payroll': return await runPayroll(user);
      case 'apply-leave': return await runApplyLeave(user, parsed);
      case 'apply-leave-resolve-type': return await runApplyLeaveResolveType(user, parsed);
      case 'apply-leave-final': return await runApplyLeaveFinal(user, parsed);
      case 'regularise': return await runRegularise(user, parsed);
      case 'onboarding': return await runOnboarding(user, parsed);
      case 'join': return await runEmployeeStatus(user, parsed, { kind: 'join', prompt: (e) => `Join ${employeeName(e)} today?` });
      case 'defer': return await runEmployeeStatus(user, parsed, { kind: 'defer', prompt: (e) => `Defer ${employeeName(e)}?` });
      case 'noshow': return await runEmployeeStatus(user, parsed, { kind: 'noshow', prompt: (e) => `Mark ${employeeName(e)} as no-show?` });
      case 'exit-start': return await runExitStart(user, parsed);
      case 'exit-complete': return await runExitComplete(user, parsed);
      case 'asset-assign': return await runAssetAssign(user, parsed);
      case 'asset-assign-pick-person': return await runAssetAssignPickPerson(user, parsed);
      case 'asset-return': return await runAssetReturn(user, parsed);
      case 'letter': return parsed.letterResolved ? await runLetterFinal(user, parsed) : await runLetter(user, parsed);
      case 'letter-final': return await runLetterFinal(user, parsed);
      case 'inbox': return await runInbox(user, parsed);
      case 'payroll-decide': return await runPayrollDecide(user, parsed);
      case 'crm': return await runCrm(user, parsed);
      default:
        return { ok: false, summary: 'That command is not one Brain runs directly.' };
    }
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
