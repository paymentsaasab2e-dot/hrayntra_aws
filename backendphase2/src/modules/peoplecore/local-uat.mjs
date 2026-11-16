/**
 * Local PeopleCore UAT against a disposable Mongo (never live).
 * Usage: DATABASE_URL=mongodb://127.0.0.1:27018/peoplecore_local_uat node src/modules/peoplecore/local-uat.mjs
 */
import assert from 'node:assert/strict';

const results = [];

function record(slice, name, ok, detail = '') {
  results.push({ slice, name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${slice} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function expectReject(fn, code) {
  try {
    await fn();
    const err = new Error(`expected ${code}`);
    err.code = 'DID_NOT_THROW';
    throw err;
  } catch (error) {
    if (error.code === 'DID_NOT_THROW') throw error;
    if (code && error.code !== code) {
      throw new Error(`expected ${code}, got ${error.code || error.message}`);
    }
    return error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required (local Mongo only — never live)');
  }
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.TENANT_WRITE_LOG = 'false';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'local-peoplecore-uat';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'local-peoplecore-uat-refresh';

  const { employeeService } = await import('./employee.service.js');
  const { orgService } = await import('./org.service.js');
  const { opsService } = await import('./ops.service.js');
  const { prisma } = await import('../../config/prisma.js');
  const { assertNoIndiaFallback, getCountryPack } = await import('./countryPacks.js');

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const cm = await orgService.createEmployer({
    name: 'UAT Douala Ltd',
    country: 'CM',
    identifiers: { niu: 'M123456789012A', cnpsEmployerNumber: 'CNPS-UAT-1' },
  });
  record('S1', 'Cameroon legal employer', cm.country === 'CM' && cm.payrollCapability === 'export', cm.id);

  const holidays = await orgService.listHolidays(cm.id, year);
  const holidayDates = (holidays.holidays || []).map((row) => String(row.date));
  record(
    'S1',
    'Cameroon holidays seeded',
    holidayDates.some((d) => d.includes('-05-20')),
    holidayDates.slice(0, 3).join(','),
  );

  const leaveTypes = await orgService.listLeaveTypes(cm.id);
  const codes = leaveTypes.map((row) => row.code);
  record(
    'S1',
    'Cameroon leave types are not CL/SL/EL',
    codes.includes('CONGE_ANNUEL') && !codes.includes('CL'),
    codes.join(','),
  );

  try {
    await orgService.createEmployer({
      name: 'Bad mix',
      country: 'CM',
      identifiers: { pan: 'ABCDE1234F' },
    });
    record('S1', 'Reject India PAN on Cameroon employer', false, 'did not throw');
  } catch (error) {
    record('S1', 'Reject India PAN on Cameroon employer', /India statutory|INDIA_FIELD/.test(String(error.message)));
  }

  const inEmp = await orgService.createEmployer({
    name: 'UAT India Pvt',
    country: 'IN',
    identifiers: { pan: 'ABCDE1234F', tan: 'ABCD12345E' },
  });
  record('S1', 'India legal employer', inEmp.country === 'IN' && inEmp.payrollCapability === 'calculate', inEmp.id);
  const inTypes = await orgService.listLeaveTypes(inEmp.id);
  record('S1', 'India leave types include CL', inTypes.some((row) => row.code === 'CL'));

  const candidate = await prisma.candidate.create({
    data: {
      firstName: 'Amina',
      lastName: 'Ngo',
      email: 'amina.uat@hryantra.test',
      stage: 'Hired',
      personId: 'uat-person-amina',
    },
  });
  const hired = await employeeService.hireFromCandidate(candidate.id, { legalEmployerId: cm.id });
  record(
    'S0/S2',
    'Hire from Hired candidate copies personId',
    hired.employee.personId === 'uat-person-amina' && hired.employee.status === 'PREBOARDING',
    hired.employee.id,
  );

  const hiredAgain = await employeeService.hireFromCandidate(candidate.id, { legalEmployerId: cm.id });
  record('S2', 'Re-hire is idempotent', hiredAgain.alreadyHired === true);

  const employee = await employeeService.create({
    firstName: 'Jean',
    lastName: 'Mbarga',
    legalEmployerId: cm.id,
    compensation: { amount: 2400000, period: 'ANNUAL', currency: 'XAF' },
  });
  record('S2', 'Direct employee on Cameroon employer', employee.legalEmployerCountry === 'CM', employee.id);

  try {
    await employeeService.update(employee.id, { countryFields: { pan: 'ABCDE1234F' } });
    record('S2', 'No India identity on Cameroon 360', false);
  } catch (error) {
    record('S2', 'No India identity on Cameroon 360', error.code === 'INDIA_FIELD_ON_FOREIGN_PACK' || /India statutory/.test(error.message));
  }

  const bankUpdate = await employeeService.update(employee.id, {
    bank: { rib: '10001-00001-12345678901-23', bankName: 'Afriland' },
    compensation: { amount: 2400000, period: 'ANNUAL', currency: 'XAF' },
  });
  record(
    'S8',
    'Bank/CTC queued for maker-checker',
    Array.isArray(bankUpdate.pendingMakerChecker) && bankUpdate.pendingMakerChecker.includes('BANK'),
    String(bankUpdate.pendingMakerChecker),
  );

  try {
    await opsService.joinEmployee(hired.employee.id);
    record('S3', 'Join blocked while PREBOARDING', false);
  } catch (error) {
    record('S3', 'Join blocked while PREBOARDING', error.code === 'NOT_READY');
  }

  const tasks = await opsService.listOnboarding(hired.employee.id);
  for (const task of tasks) {
    await opsService.completeOnboardingTask(task.id);
  }
  const ready = await employeeService.getById(hired.employee.id);
  record('S3', 'Checklist complete → READY', ready.status === 'READY', ready.status);

  const joined = await opsService.joinEmployee(hired.employee.id);
  record('S3', 'Day-1 join → JOINED', joined.status === 'JOINED', joined.status);

  const deferred = await employeeService.create({
    firstName: 'Claude',
    lastName: 'Fouda',
    legalEmployerId: cm.id,
  });
  const deferredRow = await opsService.deferEmployee(deferred.id);
  record('S3', 'Defer PREBOARDING → DEFERRED', deferredRow.status === 'DEFERRED');

  await opsService.addDocument(joined.id, { category: 'ID', fileName: 'cni.pdf' });
  const docs = await opsService.listDocuments(joined.id);
  record('S3', 'Docs vault write', docs.length >= 1);

  const loc = await orgService.createLocation({
    legalEmployerId: cm.id,
    name: 'Douala HQ',
    geofenceRadiusM: 10,
    latitude: 4.05,
    longitude: 9.7,
  });
  record('S1', 'Location geofence clamped 50–1000m', loc.geofenceRadiusM >= 50, String(loc.geofenceRadiusM));

  await opsService.punch({ employeeId: joined.id, timezone: 'Africa/Douala' });
  await opsService.punch({ employeeId: employee.id, timezone: 'Africa/Douala', proxy: true, proxyByUserId: joined.id });
  await opsService.punch({ employeeId: employee.id, timezone: 'Africa/Douala', source: 'HALF_DAY' });
  const punches = await opsService.listPunches(joined.id);
  record('S4', 'Punch stored with local work date', punches.length >= 1 && Boolean(punches[0].localWorkDate));
  const proxy = (await opsService.listPunches(employee.id)).some((row) => row.source === 'HR_PROXY' || row.source === 'HALF_DAY');
  record('S4', 'HR proxy / half-day sources stored', proxy);

  const unpaid = leaveTypes.find((row) => row.paid === false);
  const start = `${year}-${String(month).padStart(2, '0')}-02`;
  const end = `${year}-${String(month).padStart(2, '0')}-03`;
  const leave = await opsService.applyLeave({
    employeeId: joined.id,
    leaveTypeId: unpaid.id,
    startDate: start,
    endDate: end,
  });
  await opsService.decideLeave(leave.id, 'APPROVED');
  record('S4', 'Unpaid leave apply/approve', leave.days >= 1, `days=${leave.days}`);
  const ledger = await opsService.listLeaveBalances(joined.id);
  record('S4', 'Leave ledger taken > 0', Number(ledger[0]?.taken) > 0, String(ledger[0]?.taken));

  try {
    await opsService.runPayroll({ legalEmployerId: cm.id, year, month });
    record('S9', 'Payroll blocked before attendance lock', false);
  } catch (error) {
    record('S9', 'Payroll blocked before attendance lock', error.code === 'ATTENDANCE_NOT_LOCKED');
  }

  await opsService.lockPeriod(cm.id, year, month, 'uat');
  const period = await opsService.getPeriod(cm.id, year, month);
  record('S4', 'Attendance month locked', period?.locked === true);

  const muster = await opsService.muster(cm.id, year, month);
  record('S7', 'Muster rows exist', Array.isArray(muster.rows) && muster.rows.length >= 1, `rows=${muster.rows.length}`);

  const cmRun = await opsService.runPayroll({ legalEmployerId: cm.id, year, month });
  const cmSlip = cmRun.slips.find((row) => row.employeeId === employee.id) || cmRun.slips[0];
  record(
    'S9',
    'Cameroon export-only (no net, no PF)',
    cmRun.run.capability === 'export' &&
      cmSlip?.exportOnly === true &&
      cmSlip?.net == null &&
      !cmSlip?.lines?.pfEmployee,
    `status=${cmRun.run.status} net=${cmSlip?.net} exportOnly=${cmSlip?.exportOnly}`,
  );

  const inEmployee = await employeeService.create({
    firstName: 'Priya',
    lastName: 'Shah',
    legalEmployerId: inEmp.id,
    compensation: { amount: 1200000, period: 'ANNUAL', currency: 'INR' },
    status: 'ACTIVE',
  });
  await opsService.lockPeriod(inEmp.id, year, month, 'uat');
  const inRun = await opsService.runPayroll({ legalEmployerId: inEmp.id, year, month });
  const inSlip = inRun.slips[0];
  record(
    'S9',
    'India calculates PF after lock',
    inRun.run.capability === 'calculate' && inSlip?.exportOnly === false && Number(inSlip?.lines?.pfEmployee) > 0,
    `pf=${inSlip?.lines?.pfEmployee} net=${inSlip?.net}`,
  );
  const cmFile = await opsService.paymentFile(cmRun.run.id);
  record(
    'S9',
    'Cameroon payment file is export, not PF calc',
    cmFile.format.includes('cameroon') && cmFile.rows.every((row) => row.exportOnly && row.net == null),
    cmFile.format,
  );
  const inFile = await opsService.paymentFile(inRun.run.id);
  record('S9', 'India payment file has net', inFile.format.includes('india') && inFile.rows.some((row) => Number(row.net) > 0));

  const asset = await opsService.createAsset({ serial: 'UAT-LAP-1', name: 'Laptop' });
  const assignment = await opsService.assignAsset({ assetId: asset.id, employeeId: joined.id });
  try {
    await opsService.issueLetter({ employeeId: joined.id, letterType: 'certificat_de_travail' });
    record('S5', 'Relieving blocked while asset Allocated', false);
  } catch (error) {
    record(
      'S5',
      'Relieving blocked while asset Allocated',
      error.code === 'LETTER_BLOCKED_ASSETS' || /Allocated|asset/i.test(error.message),
      error.code || error.message,
    );
  }
  await opsService.returnAsset(assignment.id, 'GOOD');
  const letter = await opsService.issueLetter({ employeeId: joined.id, letterType: 'certificat_de_travail' });
  record('S5/S6', 'Letter after asset return', Boolean(letter?.id), letter?.type || '');

  const fnf = await opsService.saveFnf({
    exitCaseId: (await opsService.createExit({ employeeId: employee.id })).id,
    employeeId: employee.id,
    leaveEncashmentDays: 2,
    noticeRecoveryDays: 1,
    assetRecoveryAmount: 50000,
  });
  record('S5', 'FnF worksheet stores inputs only', fnf.leaveEncashmentDays === 2 && fnf.assetRecoveryAmount === 50000);

  const exit = await opsService.createExit({ employeeId: joined.id });
  record('S5', 'Exit case opened', Boolean(exit?.id), exit?.status);
  const cleared = await opsService.completeExit(exit.id, { lastWorkingDate: new Date().toISOString() });
  const afterExit = await employeeService.getById(joined.id);
  record('S5', 'Access cut on LWD', Boolean(afterExit.accessCutAt) && afterExit.status === 'EXITED', afterExit.status);

  const inbox = await opsService.listInbox();
  record('S6', 'People inbox has pending items', inbox.length >= 1, `count=${inbox.length}`);
  const pending = inbox.find((row) => row.status === 'PENDING' && row.kind === 'BANK');
  if (pending) {
    await opsService.decideInbox(pending.id, 'APPROVED');
    record('S6/S8', 'Maker-checker approve bank', true, pending.id);
  } else {
    record('S6/S8', 'Maker-checker approve bank', false, 'no BANK pending');
  }

  const home = await opsService.reportsHome();
  const inspector = await opsService.inspectorPack(cm.id, year);
  record('S7', 'Home + Cameroon inspector pack', home.employees >= 1 && inspector.country === 'CM');
  const alerts = await opsService.alerts();
  record('S10', 'INF alerts list pending work', Array.isArray(alerts.items), `n=${alerts.items.length}`);
  try {
    await opsService.publishPolicy({ country: 'CM', title: 'POSH IC', body: 'no' });
    record('S7', 'POSH blocked on Cameroon', false);
  } catch (error) {
    record('S7', 'POSH blocked on Cameroon', error.code === 'POSH_INDIA_ONLY');
  }
  const posh = await opsService.publishPolicy({ country: 'IN', title: 'POSH IC', body: 'India committee' });
  record('S7', 'POSH allowed on India pack', Boolean(posh?.id));

  const policy = await opsService.publishPolicy({
    country: 'CM',
    title: 'Règlement intérieur',
    body: 'UAT',
    version: 1,
  });
  await opsService.ackPolicy({ policyId: policy.id, employeeId: joined.id });
  record('S7', 'Versioned policy ack', Boolean(policy?.id));

  const flags = await opsService.getSecurityFlags();
  record(
    'S8',
    'Security flags present',
    flags.encryptBankAndNationalId === true &&
      flags.makerCheckerOnBankAndPay === true &&
      flags.reuseHqBilling === true &&
      flags.countryNotCertifiedIsNotPaywall === true &&
      flags.hrmsSeatsMeter === 'hq-billing',
  );

  const cmPack = getCountryPack('CM');
  try {
    assertNoIndiaFallback(cmPack, { pan: 'X' });
    record('S10', 'Golden pack isolation', false);
  } catch {
    record('S10', 'Golden pack isolation', true, 'CM rejects PAN');
  }

  const failed = results.filter((row) => !row.ok);
  console.log('\n--- LOCAL UAT SUMMARY ---');
  console.log(`passed ${results.filter((r) => r.ok).length}/${results.length}`);
  if (failed.length) {
    for (const row of failed) console.log(`  FAIL ${row.slice} ${row.name} ${row.detail}`);
    process.exitCode = 1;
  } else {
    console.log('LOCAL PEOPLECORE UAT PASS');
  }

  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
}

main().catch((error) => {
  console.error('LOCAL UAT CRASH', error);
  process.exit(1);
});
