import { prisma } from '../../config/prisma.js';

export function isValidObjectId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value.trim());
}

export function httpError(statusCode, message, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export function requireModel(name, clientKey) {
  const model = prisma?.[clientKey];
  if (!model || typeof model.findMany !== 'function') {
    throw httpError(
      503,
      `PeopleCore ${name} is not on this Prisma client. Run npx prisma generate in backendphase2 and restart the API. Do not prisma db push.`,
      'PEOPLECORE_CLIENT_STALE',
    );
  }
  return model;
}

export function maskSecret(value) {
  const text = String(value || '');
  if (text.length <= 4) return text ? '****' : '';
  return `${text.slice(0, 2)}****${text.slice(-2)}`;
}

export function sanitizePackFields(fieldsSpec = [], raw) {
  const incoming = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const field of fieldsSpec) {
    const value = incoming[field.id];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) out[field.id] = text;
  }
  return out;
}

export function clampGeofence(meters) {
  const n = Number(meters);
  if (!Number.isFinite(n)) return 100;
  return Math.min(1000, Math.max(50, Math.round(n)));
}

export function currentYearMonth(date = new Date()) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function localWorkDate(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function isoDateUtc(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

export function eachIsoDate(start, end) {
  const out = [];
  const cursor = new Date(`${isoDateUtc(start)}T00:00:00.000Z`);
  const last = new Date(`${isoDateUtc(end)}T00:00:00.000Z`);
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function isWeekendIso(iso) {
  const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function monthDateRange(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0));
  return { start, end: endDate.toISOString().slice(0, 10) };
}

export function distanceMeters(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(Number(n)))) return null;
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
