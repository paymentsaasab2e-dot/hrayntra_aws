/**
 * INF restore drill helper — does not connect to live Mongo and does not mongorestore.
 * Prints the go-live checklist and verifies PeopleCore Prisma models exist after generate.
 *
 * Usage (from backendphase2): node src/modules/peoplecore/restore-drill.mjs
 */
import { Prisma } from '@prisma/client';

const REQUIRED = [
  'Employee',
  'LegalEmployer',
  'PeopleLocation',
  'HolidayCalendar',
  'LeaveType',
  'OnboardingTask',
  'AttendancePunch',
  'AttendancePeriod',
  'LeaveRequest',
  'ExitCase',
  'AssetItem',
  'FnFWorksheet',
  'PeopleLetter',
  'PeopleApproval',
  'HrPolicy',
  'PayrollRun',
  'PayrollException',
  'Payslip',
  'AssetAssignment',
  'EmployeeDocument',
];

const missing = REQUIRED.filter((name) => !Prisma.ModelName[name]);
if (missing.length) {
  console.error('RESTORE DRILL FAIL — generate Prisma client first. Missing:', missing.join(', '));
  process.exit(1);
}

console.log('RESTORE DRILL CHECKLIST (do not run against live Mongo)');
console.log('1. RPO/RTO: last nightly dump of the *testing* tenant DB only.');
console.log('2. Restore onto empty hardware / empty testing DB — never ~/apps/hrayntra_aws live.');
console.log('3. Two parallel payroll months vs client Excel after Slice 9.');
console.log('4. Golden pack: node --test src/modules/peoplecore/payroll.calc.test.js');
console.log('5. Non-India locale: Country=CM, fr-CM, XAF, Africa/Douala, no PAN.');
console.log('Prisma models present:', REQUIRED.join(', '));
console.log('RESTORE DRILL STRUCTURAL PASS');
