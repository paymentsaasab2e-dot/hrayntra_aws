/** Work experience row from CV parse / candidate profile. */
export type CvWorkEntryLike = {
  title?: string | null;
  company?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  durationText?: string | null;
  responsibilities?: string[] | null;
  isCurrentJob?: boolean | null;
};

function parseDurationYears(text: string): number | null {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;

  const yearMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*years?/);
  if (yearMatch) {
    const n = Number(yearMatch[1]);
    return Number.isFinite(n) ? n : null;
  }

  const monthMatch = t.match(/(\d+(?:\.\d+)?)\s*months?/);
  if (monthMatch) {
    const n = Number(monthMatch[1]);
    return Number.isFinite(n) ? n / 12 : null;
  }

  const yrAbbr = t.match(/(\d+(?:\.\d+)?)\s*yr\b/);
  if (yrAbbr) {
    const n = Number(yrAbbr[1]);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function parseDateMs(value: string | null | undefined): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

/** Sum non-overlapping ranges when start/end exist; otherwise sum durationText per role. */
export function computeTotalExperienceYears(
  entries: CvWorkEntryLike[] | null | undefined,
  fallbackYears?: number | null | undefined,
): number | null {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!list.length) {
    if (fallbackYears != null && Number.isFinite(Number(fallbackYears))) {
      return Math.max(0, Number(fallbackYears));
    }
    return null;
  }

  const ranges: Array<{ start: number; end: number }> = [];
  for (const entry of list) {
    const start = parseDateMs(entry.startDate);
    const end = entry.isCurrentJob
      ? Date.now()
      : parseDateMs(entry.endDate) ?? (start != null ? Date.now() : null);
    if (start != null && end != null && end >= start) {
      ranges.push({ start, end });
    }
  }

  if (ranges.length > 0) {
    ranges.sort((a, b) => a.start - b.start);
    let totalMs = 0;
    let cursorEnd = -1;
    for (const range of ranges) {
      const start = range.start < cursorEnd ? cursorEnd : range.start;
      const end = range.end;
      if (end > start) {
        totalMs += end - start;
        cursorEnd = end;
      }
    }
    if (totalMs > 0) {
      return Math.max(0, Math.round((totalMs / (1000 * 60 * 60 * 24 * 365)) * 10) / 10);
    }
  }

  let durationSum = 0;
  let anyDuration = false;
  for (const entry of list) {
    const years = parseDurationYears(String(entry.durationText || ''));
    if (years != null) {
      durationSum += years;
      anyDuration = true;
    }
  }
  if (anyDuration) {
    return Math.max(0, Math.round(durationSum * 10) / 10);
  }

  if (fallbackYears != null && Number.isFinite(Number(fallbackYears))) {
    return Math.max(0, Number(fallbackYears));
  }
  return null;
}

export function formatExperienceYearsLabel(years: number | null | undefined): string {
  if (years == null || !Number.isFinite(Number(years))) return '';
  const n = Number(years);
  if (n === 0) return '0 years';
  if (Number.isInteger(n)) return `${n} year${n === 1 ? '' : 's'}`;
  return `${n.toFixed(1)} years`;
}

export function formatWorkEntryHeadline(entry: CvWorkEntryLike, index: number): string {
  const title = String(entry.title || '').trim() || 'Role';
  const company = String(entry.company || '').trim();
  const location = String(entry.location || '').trim();
  const role = company ? `${title} @ ${company}` : title;
  return location ? `[${index + 1}] ${role} (${location})` : `[${index + 1}] ${role}`;
}

export function formatWorkEntryMeta(entry: CvWorkEntryLike): string {
  const parts: string[] = [];
  const duration = String(entry.durationText || '').trim();
  const start = String(entry.startDate || '').trim();
  const end = String(entry.endDate || '').trim();
  if (duration) parts.push(duration);
  if (start || end) {
    parts.push([start, end].filter(Boolean).join(' – ') || '');
  }
  return parts.filter(Boolean).join(' · ');
}
