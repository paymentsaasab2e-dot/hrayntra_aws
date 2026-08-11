/**
 * Derive optimal alert / notification send windows from CRM session patterns.
 * Ported from Phase 1 user-activity-tracker/alert-timing.ts, adapted for tenant CRM sessions.
 */

import type {
  TenantActivitySession,
  TenantAlertTiming,
  TenantHourBucket,
  TenantSessionEngagement,
  TenantWeekdayBucket,
} from './types';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function hourLabel(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:00 ${ampm}`;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function buildTenantSessionEngagement(
  sessions: TenantActivitySession[],
): TenantSessionEngagement {
  const list = Array.isArray(sessions) ? sessions : [];
  const hourMap = new Map<number, { sessions: number; totalDurationMs: number }>();
  const dayMap = new Map<number, { sessions: number; totalDurationMs: number }>();
  const devices = new Set<string>();
  const durations: number[] = [];
  let totalDurationMs = 0;
  let activeCount = 0;

  for (const s of list) {
    const ms = Math.max(0, s.durationMs || 0);
    durations.push(ms);
    totalDurationMs += ms;
    if (!s.endedAt) activeCount += 1;

    const deviceKey = [s.deviceType, s.browser, s.operatingSystem].filter(Boolean).join('|');
    if (deviceKey) devices.add(deviceKey);

    const start = s.startedAt ? new Date(s.startedAt) : null;
    if (start && Number.isFinite(start.getTime())) {
      const hour = start.getHours();
      const weekday = start.getDay();
      const h = hourMap.get(hour) || { sessions: 0, totalDurationMs: 0 };
      h.sessions += 1;
      h.totalDurationMs += ms;
      hourMap.set(hour, h);
      const d = dayMap.get(weekday) || { sessions: 0, totalDurationMs: 0 };
      d.sessions += 1;
      d.totalDurationMs += ms;
      dayMap.set(weekday, d);
    }
  }

  const avgDurationMs = list.length ? Math.round(totalDurationMs / list.length) : 0;
  const medianDurationMs = median(durations);

  const byHour: TenantHourBucket[] = [...hourMap.entries()]
    .map(([hour, v]) => ({
      hour,
      label: hourLabel(hour),
      sessions: v.sessions,
      totalDurationMs: v.totalDurationMs,
    }))
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs || b.sessions - a.sessions);

  const byWeekday: TenantWeekdayBucket[] = [...dayMap.entries()]
    .map(([weekday, v]) => ({
      weekday,
      label: WEEKDAY_LABELS[weekday] || String(weekday),
      sessions: v.sessions,
      totalDurationMs: v.totalDurationMs,
    }))
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs || b.sessions - a.sessions);

  const bestHours = byHour.slice(0, 3).map((h) => h.hour);
  const bestHourLabels = bestHours.map(hourLabel);
  const bestWeekdays = byWeekday.slice(0, 2).map((d) => d.label);

  const weakHours = [...byHour].sort(
    (a, b) => a.totalDurationMs - b.totalDurationMs || a.sessions - b.sessions,
  );
  const avoidHours = weakHours.slice(0, 3).map((h) => h.hour);

  let confidence: TenantAlertTiming['confidence'] = 'low';
  if (list.length >= 8 && byHour.length >= 3) confidence = 'high';
  else if (list.length >= 3) confidence = 'medium';

  const windowCore =
    bestHours.length && bestWeekdays.length
      ? `${bestWeekdays.join(' / ')} · ${bestHourLabels.slice(0, 2).join('–')}`
      : bestHourLabels.length
        ? bestHourLabels.slice(0, 2).join('–')
        : 'Not enough data yet';

  const reasonParts = [
    bestHours.length
      ? `Most active around ${bestHourLabels.slice(0, 2).join(' and ')} local time`
      : 'Need more CRM sessions to pin a send window',
    avgDurationMs > 0 ? `avg session ${Math.round(avgDurationMs / 60000)} min` : null,
  ].filter(Boolean);

  const alertTiming: TenantAlertTiming = {
    bestHours,
    bestHourLabels,
    bestWeekdays,
    bestWindowLabel: windowCore,
    avoidHours,
    confidence,
    reason: reasonParts.join(' · '),
    sampleSessions: list.length,
    avgDurationMs,
    medianDurationMs,
  };

  return {
    sessionCount: list.length,
    activeCount,
    totalDurationMs,
    avgDurationMs,
    medianDurationMs,
    uniqueDevices: devices.size,
    byHour,
    byWeekday,
    alertTiming,
  };
}
