/** Org-wide automatic daily AI workspace analyze (dashboard Analyze). */

export const DEFAULT_SCHEDULED_ANALYSIS = {
  enabled: true,
  /** 24-hour local time HH:mm */
  time: '10:00',
  /** IANA timezone for the daily run window */
  timezone: process.env.ALERT_SCHEDULED_ANALYSIS_TZ || 'Asia/Kolkata',
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseScheduledTime(value) {
  const raw = String(value || DEFAULT_SCHEDULED_ANALYSIS.time).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: 10, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
  const minute = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)));
  return { hour, minute };
}

export function normalizeScheduledAnalysis(raw) {
  const base = { ...DEFAULT_SCHEDULED_ANALYSIS };
  if (!isObject(raw)) return base;

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
    time:
      typeof raw.time === 'string' && /^\d{1,2}:\d{2}$/.test(raw.time.trim())
        ? raw.time.trim()
        : base.time,
    timezone:
      typeof raw.timezone === 'string' && raw.timezone.trim()
        ? raw.timezone.trim()
        : base.timezone,
  };
}

export function getZonedDateParts(date, timeZone) {
  const tz = String(timeZone || DEFAULT_SCHEDULED_ANALYSIS.timezone).trim();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date instanceof Date ? date : new Date(date));
    const read = (type) => parts.find((p) => p.type === type)?.value || '';
    return {
      year: read('year'),
      month: read('month'),
      day: read('day'),
      hour: Number.parseInt(read('hour'), 10) || 0,
      minute: Number.parseInt(read('minute'), 10) || 0,
      dateKey: `${read('year')}-${read('month')}-${read('day')}`,
    };
  } catch {
    const d = date instanceof Date ? date : new Date(date);
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      day: String(d.getDate()).padStart(2, '0'),
      hour: d.getHours(),
      minute: d.getMinutes(),
      dateKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    };
  }
}

/**
 * True during the scheduled hour, once the configured minute has passed.
 * Works with the hourly alert scheduler (runs once between e.g. 10:00–10:59).
 */
export function isScheduledAnalysisDueNow(settings, now = new Date()) {
  const normalized = normalizeScheduledAnalysis(settings);
  if (!normalized.enabled) return false;

  const { hour: targetHour, minute: targetMinute } = parseScheduledTime(normalized.time);
  const parts = getZonedDateParts(now, normalized.timezone);

  if (parts.hour !== targetHour) return false;
  if (parts.minute < targetMinute) return false;
  return true;
}

export function hasScheduledBriefToday(latestBrief, settings, now = new Date()) {
  if (!latestBrief || String(latestBrief.trigger || '') !== 'scheduled') return false;
  if (!latestBrief.createdAt) return false;

  const tz = normalizeScheduledAnalysis(settings).timezone;
  const todayKey = getZonedDateParts(now, tz).dateKey;
  const briefKey = getZonedDateParts(new Date(latestBrief.createdAt), tz).dateKey;
  return todayKey === briefKey;
}

export async function getScheduledAnalysisSettings(userId = null) {
  const { getAlertManagementSettings } = await import('./alert-settings.js');
  const settings = await getAlertManagementSettings(userId);
  return normalizeScheduledAnalysis(settings.scheduledAnalysis);
}
