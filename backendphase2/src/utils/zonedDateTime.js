export function isValidIanaTimeZone(value) {
  const tz = String(value || '').trim();
  if (!tz) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveInterviewTimeZone(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Asia/Kolkata';
  if (isValidIanaTimeZone(raw)) return raw;
  if (/ist|kolkata|india/i.test(raw)) return 'Asia/Kolkata';
  if (/^utc$/i.test(raw) || /^gmt$/i.test(raw)) return 'UTC';
  return 'Asia/Kolkata';
}

function getTimeZoneOffsetMs(utcMs, timeZone) {
  const d = new Date(utcMs);
  const parts = {};
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
    Number(parts.second)
  );
  return asUtc - utcMs;
}

export function zonedWallClockToDate(year, month, day, hours, minutes, timeZone) {
  const tz = resolveInterviewTimeZone(timeZone);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hours, minutes, 0);
  let utcMs = desiredAsUtc;
  for (let i = 0; i < 4; i += 1) {
    utcMs = desiredAsUtc - getTimeZoneOffsetMs(utcMs, tz);
  }
  return new Date(utcMs);
}
