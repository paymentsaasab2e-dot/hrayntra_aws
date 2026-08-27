/**
 * Convert a wall-clock date/time in an IANA timezone to a UTC instant,
 * and format instants back in that timezone. Used for interview scheduling.
 */

export function isValidIanaTimeZone(value: string): boolean {
  const tz = String(value || '').trim();
  if (!tz) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function getTimeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const d = new Date(utcMs);
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}

export function zonedWallClockToUtcIso(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string,
): string {
  const desiredAsUtc = Date.UTC(year, month - 1, day, hours, minutes, 0);
  let utcMs = desiredAsUtc;
  for (let i = 0; i < 4; i += 1) {
    utcMs = desiredAsUtc - getTimeZoneOffsetMs(utcMs, timeZone);
  }
  return new Date(utcMs).toISOString();
}

export function getYmdInTimeZone(timeZone?: string | null, instant = new Date()): string {
  const tz = String(timeZone || '').trim();
  if (!tz || !isValidIanaTimeZone(tz)) {
    const d = instant;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function formatInstantDateDMY(iso: string, timeZone?: string | null): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tz = String(timeZone || '').trim();
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  if (tz && isValidIanaTimeZone(tz)) options.timeZone = tz;
  return new Intl.DateTimeFormat('en-GB', options).format(d);
}

export function formatInstantTime12h(iso: string, timeZone?: string | null): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tz = String(timeZone || '').trim();
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  if (tz && isValidIanaTimeZone(tz)) options.timeZone = tz;
  return d.toLocaleTimeString('en-US', options);
}
