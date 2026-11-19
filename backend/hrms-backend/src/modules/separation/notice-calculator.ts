import { TenantHrRules } from '../policies/policy-rules';

export function calculateNoticePeriodDays(
  rules: TenantHrRules,
  probationEndDate?: Date | null,
  asOf: Date = new Date()
): number {
  if (probationEndDate && new Date(probationEndDate) > asOf) {
    return rules.exit.probationNoticeDays;
  }
  return rules.exit.standardNoticeDays;
}

export function addCalendarDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function calculateShortfall(expectedLWD: Date, approvedLWD: Date): number {
  const diff = Math.ceil((expectedLWD.getTime() - approvedLWD.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export const DEFAULT_EXIT_CHECKLIST = [
  { label: 'Manager handover sign-off', done: false },
  { label: 'Asset return', done: false },
  { label: 'Pending leave cleared', done: false },
  { label: 'IT access revocation', done: false },
  { label: 'HR exit interview', done: false },
  { label: 'Experience letter issued', done: false },
];
