import type { CreateInterviewPayload } from './api';

const BACKEND_INTERVIEW_TYPES = new Set<string>([
  'VIDEO',
  'PHONE',
  'IN_PERSON',
  'TECHNICAL_TEST',
  'ASSESSMENT',
  'GROUP_DISCUSSION',
  'ONSITE',
  'TECHNICAL',
  'FINAL',
]);

/**
 * Maps UI labels ("In-Person", "Technical Test") to Prisma / Zod enum tokens (IN_PERSON, TECHNICAL_TEST).
 * Hyphens and spaces become underscores before upper-casing.
 */
export function mapInterviewUiTypeToBackend(type: string): CreateInterviewPayload['type'] {
  const normalized = String(type || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (BACKEND_INTERVIEW_TYPES.has(normalized)) {
    return normalized as CreateInterviewPayload['type'];
  }
  return 'VIDEO';
}

/**
 * Builds an ISO instant from `YYYY-MM-DD` + `10:30 AM` using the browser's local calendar
 * (same behavior as parsing a single local `Date`). Backend accepts any ISO datetime string.
 */
export function combineInterviewDateAndTimeToIso(dateYmd: string, time12h: string): string {
  const ymd = String(dateYmd || '').trim();
  if (!ymd) {
    return new Date().toISOString();
  }
  const parts = ymd.split('-').map((p) => Number(p));
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return new Date(ymd).toISOString();
  }
  const t = String(time12h || '').trim();
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let hours = 9;
  let minutes = 0;
  if (m) {
    hours = Number(m[1]) % 12;
    minutes = Number(m[2]);
    if (m[3].toUpperCase() === 'PM') hours += 12;
  }
  return new Date(y, mo - 1, d, hours, minutes, 0, 0).toISOString();
}
