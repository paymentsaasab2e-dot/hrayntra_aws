/**
 * Browser-local constraints for scheduling (tasks, interviews, meetings,
 * follow-ups). Do **not** use these for historical profile data (DOB, past
 * employment, visa issue dates, filter ranges, etc.).
 */

import { zonedWallClockToUtcIso } from './zonedDateTime';

/** `YYYY-MM-DD` for today's calendar date in the user's local timezone. */
export function getLocalDateInputMinToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Minimum value for `<input type="datetime-local" min="…">` — current local
 * moment truncated to whole minutes (seconds stripped for stable UX).
 */
export function getLocalDateTimeInputMinNow(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${min}`;
}

/** `HH:mm` for `<input type="time" min="…">` when the chosen date is today. */
export function getLocalTimeInputMinNow(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function clampDateToMinLocal(value: string, min: string): string {
  if (!value || !min) return value;
  return value < min ? min : value;
}

export function clampDateTimeLocalToMin(value: string, min: string): string {
  if (!value || !min) return value;
  return value < min ? min : value;
}

/** -1 = before today (local), 0 = today, 1 = after today */
export function compareLocalYmdToToday(ymd: string): number {
  if (!ymd) return 0;
  const t = getLocalDateInputMinToday();
  if (ymd < t) return -1;
  if (ymd > t) return 1;
  return 0;
}

/** `YYYY-MM-DD` + `HH:mm` (24h) must not be before now (30s slack). */
export function isLocalDateTimeNotPast(dateYmd: string, timeHm: string): boolean {
  if (!dateYmd || !timeHm) return false;
  const d = new Date(`${dateYmd}T${timeHm}`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() >= Date.now() - 30_000;
}

/** Interview slot grid: 9:00–17:30, 30-minute steps (labels match `toLocaleTimeString` en-US). */
export function generateStandardInterviewSlotDescriptors(): Array<{
  label: string;
  hour: number;
  minute: number;
}> {
  const out: Array<{ label: string; hour: number; minute: number }> = [];
  for (let hour = 9; hour <= 17; hour += 1) {
    for (const minute of [0, 30] as const) {
      if (hour === 17 && minute === 30) break;
      const d = new Date();
      d.setHours(hour, minute, 0, 0);
      out.push({
        label: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        hour,
        minute,
      });
    }
  }
  return out;
}

function getTodayYmd(timeZone?: string): string {
  const tz = String(timeZone || '').trim();
  if (!tz) return getLocalDateInputMinToday();
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return getLocalDateInputMinToday();
  }
}

export function filterInterviewSlotsForLocalDate(
  slots: Array<{ label: string; hour: number; minute: number }>,
  dateYmd: string,
  slackMs = 60_000,
  timeZone?: string,
): Array<{ label: string; hour: number; minute: number }> {
  if (!dateYmd || !String(dateYmd).trim()) return slots;
  const todayYmd = getTodayYmd(timeZone);
  if (dateYmd > todayYmd) return slots;
  if (dateYmd < todayYmd) return [];
  const now = Date.now();
  return slots.filter(({ hour, minute }) => {
    const parts = dateYmd.split('-').map((x) => Number.parseInt(x, 10));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return true;
    const [y, mo, d] = parts;
    const slotTime = timeZone
      ? new Date(zonedWallClockToUtcIso(y, mo, d, hour, minute, timeZone)).getTime()
      : new Date(y, mo - 1, d, hour, minute, 0, 0).getTime();
    return slotTime >= now - slackMs;
  });
}
