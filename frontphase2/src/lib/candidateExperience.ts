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

const WORK_DISPLAY_HEADLINE_RE =
  /^\[(\d+)\]\s*(.+?)\s*@\s*(.+?)(?:\s*\(([^)]+)\))?\s*$/;

const WORK_DATE_RANGE_RE =
  /^(.+?)\s*[–—-]\s*(Present|.+)$/i;

function parseWorkResponsibilityLines(bodyLines: string[]): string[] {
  if (!bodyLines.length) return [];
  if (bodyLines.length === 1 && bodyLines[0].includes(';')) {
    return bodyLines[0]
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return bodyLines.map((line) => line.trim()).filter(Boolean);
}

/** Profile / client preview: `[n] Title @ Company (Location)` blocks with date line and bullet paragraphs. */
export function looksLikeWorkExperienceDisplayText(value: string): boolean {
  return /^\[\d+\]\s*.+@\s*.+/m.test(String(value || '').trim());
}

export function parseWorkExperienceDisplayText(value: string): CvWorkEntryLike[] {
  const trimmed = String(value || '').trim();
  if (!trimmed || !looksLikeWorkExperienceDisplayText(trimmed)) return [];

  return trimmed
    .split(/(?=^\[\d+\]\s)/m)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim());
      const headline = lines[0] || '';
      const headlineMatch = headline.match(WORK_DISPLAY_HEADLINE_RE);
      if (!headlineMatch) return null;

      const title = headlineMatch[2].trim();
      const company = headlineMatch[3].trim();
      const location = (headlineMatch[4] || '').trim();
      let startDate = '';
      let endDate = '';
      const responsibilities: string[] = [];

      let index = 1;
      while (index < lines.length && !lines[index]) index += 1;

      if (index < lines.length && WORK_DATE_RANGE_RE.test(lines[index])) {
        const dateMatch = lines[index].match(WORK_DATE_RANGE_RE);
        if (dateMatch) {
          startDate = dateMatch[1].trim();
          endDate = dateMatch[2].trim();
        }
        index += 1;
      }

      while (index < lines.length) {
        while (index < lines.length && !lines[index]) index += 1;
        if (index >= lines.length) break;
        if (/^\[\d+\]\s/.test(lines[index])) break;
        responsibilities.push(lines[index]);
        index += 1;
      }

      return { title, company, location, startDate, endDate, responsibilities };
    })
    .filter((entry): entry is CvWorkEntryLike => Boolean(entry?.title || entry?.company));
}

/** ATS editor / submit form: `Title | Company | Location | Start | End` blocks separated by blank lines. */
export function parseWorkExperienceEditorValue(value: string): CvWorkEntryLike[] {
  return String(value || '')
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const headerLine = lines[0] || '';
      const bodyLines = lines.slice(1);
      const [title = '', company = '', location = '', startDate = '', endDate = ''] = headerLine
        .split('|')
        .map((part) => part.trim());
      const responsibilities = parseWorkResponsibilityLines(bodyLines);
      return { title, company, location, startDate, endDate, responsibilities };
    })
    .filter((entry) => String(entry.title || '').trim() || String(entry.company || '').trim());
}

function looksLikeWorkExperienceEditorText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || looksLikeWorkExperienceDisplayText(trimmed)) return false;
  return trimmed
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .some((block) => {
      const firstLine = (block.split(/\r?\n/)[0] || '').trim();
      return firstLine.includes('|') && firstLine.split('|').length >= 2;
    });
}

function normalizeWorkEntryRecord(entry: Record<string, unknown>): Record<string, unknown> {
  const responsibilities = entry.responsibilities;
  if (Array.isArray(responsibilities) && responsibilities.length === 1) {
    const single = String(responsibilities[0] || '').trim();
    if (single && looksLikeWorkExperienceDisplayText(single)) {
      return parseWorkExperienceDisplayText(single)[0] as Record<string, unknown>;
    }
    if (single.includes('\n') && !single.includes(';')) {
      return {
        ...entry,
        responsibilities: single
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      };
    }
  }
  const description = String(entry.description || '').trim();
  if (description && looksLikeWorkExperienceDisplayText(description)) {
    return parseWorkExperienceDisplayText(description)[0] as Record<string, unknown>;
  }
  return entry;
}

/** Coalesce a single blob or normalize multiline responsibilities on structured entries. */
export function normalizeWorkEntryRecords(entries: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (!entries.length) return entries;

  if (entries.length === 1) {
    const only = entries[0];
    const blob = [
      String(only.title || '').trim(),
      String(only.description || '').trim(),
      Array.isArray(only.responsibilities)
        ? only.responsibilities.map((line) => String(line || '').trim()).filter(Boolean).join('\n')
        : String(only.responsibilities || '').trim(),
    ]
      .filter(Boolean)
      .join('\n\n');
    if (looksLikeWorkExperienceDisplayText(blob)) {
      return parseWorkExperienceDisplayText(blob) as Array<Record<string, unknown>>;
    }
  }

  return entries.map((entry) => normalizeWorkEntryRecord(entry));
}

/** Arrays, JSON arrays, display text, or pipe-separated editor text → entry objects for client review. */
export function parseWorkEntriesFromUnknown(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return normalizeWorkEntryRecords(
      value
        .filter((item) => item && typeof item === 'object')
        .map((item) => item as Record<string, unknown>),
    );
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (looksLikeWorkExperienceDisplayText(trimmed)) {
      return parseWorkExperienceDisplayText(trimmed) as Array<Record<string, unknown>>;
    }

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return normalizeWorkEntryRecords(
            parsed
              .filter((item) => item && typeof item === 'object')
              .map((item) => item as Record<string, unknown>),
          );
        }
      } catch {
        /* not JSON — try other parsers below */
      }
    }

    if (looksLikeWorkExperienceEditorText(trimmed)) {
      return parseWorkExperienceEditorValue(trimmed) as Array<Record<string, unknown>>;
    }
  }
  return [];
}
