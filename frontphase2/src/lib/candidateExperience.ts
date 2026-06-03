import type { BackendCandidate } from './api';
import {
  enrichBackendCandidateFromPhase1Snapshot,
  getPhase1ProfileSnapshot,
  type Phase1ProfileSnapshot,
} from './phase1ProfileSnapshot';

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

function isOpenEndedEndDate(value: string | null | undefined): boolean {
  const raw = String(value || '').trim();
  return !raw || /^[\u2014\u2013\-–—]+$/.test(raw) || /^present$/i.test(raw) || /^current$/i.test(raw);
}

function parseDateMs(value: string | null | undefined): number | null {
  const raw = String(value || '').trim();
  if (!raw || isOpenEndedEndDate(raw)) return null;

  let ms = Date.parse(raw);
  if (Number.isFinite(ms)) return ms;

  const monthYear = raw.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (monthYear) {
    ms = Date.parse(`${monthYear[1]} 1, ${monthYear[2]}`);
    if (Number.isFinite(ms)) return ms;
  }

  const slashMY = raw.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (slashMY) {
    ms = Date.parse(`${slashMY[1]}/1/${slashMY[2]}`);
    if (Number.isFinite(ms)) return ms;
  }

  const yearMonth = raw.match(/^(\d{4})[/.-](\d{1,2})$/);
  if (yearMonth) {
    ms = Date.parse(`${yearMonth[2]}/1/${yearMonth[1]}`);
    if (Number.isFinite(ms)) return ms;
  }

  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) {
    ms = Date.parse(`Jan 1, ${yearOnly[1]}`);
    if (Number.isFinite(ms)) return ms;
  }

  return null;
}

export function normalizeCvWorkEntry(entry: CvWorkEntryLike): CvWorkEntryLike {
  const end = String(entry.endDate || '').trim();
  const isCurrent = entry.isCurrentJob === true || isOpenEndedEndDate(end);
  return {
    ...entry,
    isCurrentJob: isCurrent,
    endDate: isCurrent ? null : entry.endDate,
  };
}

function workRecordToCvEntry(row: Record<string, unknown>): CvWorkEntryLike {
  const entry = normalizeCvWorkEntry({
    title: (row.jobTitle as string) || (row.title as string) || null,
    company: (row.company as string) || (row.companyName as string) || null,
    location: (row.workLocation as string) || (row.location as string) || null,
    startDate: (row.startDate as string) || null,
    endDate: (row.endDate as string) || null,
    durationText: (row.durationText as string) || null,
    isCurrentJob:
      row.currentlyWorking === true ||
      row.currentlyWorkHere === true ||
      row.isCurrentJob === true ||
      isOpenEndedEndDate(row.endDate as string),
    responsibilities: Array.isArray(row.responsibilities)
      ? (row.responsibilities as string[])
      : row.description
        ? [String(row.description)]
        : null,
  });
  const durationText = entry.durationText || extractDurationTextFromEntry(entry);
  return durationText ? { ...entry, durationText } : entry;
}

export type CandidateExperienceSource = Pick<
  BackendCandidate,
  'experience' | 'cvWorkExperienceEntries' | 'extraData'
> & {
  experienceYears?: number | null;
  cvSummary?: string | null;
  cvNotes?: string | null;
};

function dedupeWorkEntries(entries: CvWorkEntryLike[]): CvWorkEntryLike[] {
  const seen = new Set<string>();
  const out: CvWorkEntryLike[] = [];
  for (const entry of entries) {
    const title = String(entry.title || '').trim().toLowerCase();
    const company = String(entry.company || '').trim().toLowerCase();
    const key = `${title}|${company}`;
    if (!title && !company) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalizeCvWorkEntry(entry));
  }
  return out;
}

/** Pull "2 year experience" (etc.) from durationText, responsibilities, or headline lines. */
export function extractDurationTextFromEntry(entry: CvWorkEntryLike): string {
  const explicit = String(entry.durationText || '').trim();
  if (explicit) return explicit;
  const blob = [
    entry.title,
    entry.company,
    entry.location,
    ...(Array.isArray(entry.responsibilities) ? entry.responsibilities : []),
  ]
    .filter(Boolean)
    .join('\n');
  const match =
    blob.match(/(\d+(?:\.\d+)?)\s*years?\s+(?:experience|exp\.?)?/i) ||
    blob.match(/(\d+(?:\.\d+)?)\s*years?\s+on[- ]?site/i) ||
    blob.match(/(\d+(?:\.\d+)?)\s*yr\s+experience/i);
  return match ? match[0] : '';
}

/** Tenure for one role — CV duration line first, then start/end dates. */
export function computeWorkEntryYears(entry: CvWorkEntryLike): number | null {
  const normalized = normalizeCvWorkEntry(entry);
  const fromDuration = parseDurationYears(extractDurationTextFromEntry(normalized));
  if (fromDuration != null && fromDuration > 0) {
    return Math.round(fromDuration * 10) / 10;
  }

  const start = parseDateMs(normalized.startDate);
  const end = normalized.isCurrentJob
    ? Date.now()
    : parseDateMs(normalized.endDate) ?? (start != null ? Date.now() : null);
  if (start != null && end != null && end >= start) {
    const years = (end - start) / (365.25 * 24 * 60 * 60 * 1000);
    const rounded = Math.round(years * 10) / 10;
    return rounded > 0 ? rounded : null;
  }
  return null;
}

/** Human label for one role's tenure (CV text or calculated dates). */
export function formatWorkEntryTenureLabel(entry: CvWorkEntryLike): string {
  const explicit = String(entry.durationText || '').trim();
  if (explicit) return explicit;

  const fromCvLine = extractDurationTextFromEntry(entry);
  if (fromCvLine) return fromCvLine;

  const years = computeWorkEntryYears(entry);
  if (years == null) return '';
  if (years >= 1) {
    return Number.isInteger(years) ? `${years} year${years === 1 ? '' : 's'}` : `${years.toFixed(1)} years`;
  }
  if (years > 0) return '< 1 year';
  return '';
}

/** Parse CV work blocks like "SDE at Company, City" + next line "2 year experience on-site". */
export function parseWorkEntriesFromCvNarrative(text: string): CvWorkEntryLike[] {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const entries: CvWorkEntryLike[] = [];
  const re =
    /([^\n]{2,120}?)\s*,?\s*at\s+([^,\n]+?)(?:,\s*([^\n]{2,80}?))?\s*[\n\r]+\s*(\d+(?:\.\d+)?)\s*years?\s+experience/gi;

  for (const match of normalized.matchAll(re)) {
    const title = String(match[1] || '')
      .trim()
      .replace(/\s+/g, ' ');
    const company = String(match[2] || '').trim();
    const location = String(match[3] || '').trim();
    const years = match[4];
    if (!title || !company) continue;
    entries.push(
      normalizeCvWorkEntry({
        title,
        company,
        location: location || null,
        durationText: `${years} years experience`,
        responsibilities: [],
      }),
    );
  }

  return dedupeWorkEntries(entries);
}

function mapRawWorkRow(row: Record<string, unknown>): CvWorkEntryLike {
  return workRecordToCvEntry(row);
}

function collectPipelineWorkEntries(extra: Record<string, unknown> | null): CvWorkEntryLike[] {
  if (!extra || typeof extra !== 'object') return [];
  const pipeline = (extra.pipeline || {}) as Record<string, unknown>;
  const workBlock = (pipeline.work || {}) as Record<string, unknown>;
  const raw =
    workBlock.entries ||
    workBlock.workExperienceEntries ||
    pipeline.workExperienceEntries ||
    extra.workExperienceEntries;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && typeof row === 'object')
    .map((row) => mapRawWorkRow(row as Record<string, unknown>));
}

function collectPhase1SnapshotNarrativeParts(extra: Record<string, unknown> | null): string[] {
  if (!extra || typeof extra !== 'object') return [];
  const snap = getPhase1ProfileSnapshot(extra);
  if (!snap) return [];

  const parts: string[] = [];
  const narrative = (snap as Phase1ProfileSnapshot & { cvWorkHistoryNarrative?: string })
    .cvWorkHistoryNarrative;
  if (typeof narrative === 'string' && narrative.trim()) {
    parts.push(narrative.trim());
  }

  if (Array.isArray(snap.workExperience)) {
    for (const row of snap.workExperience) {
      if (!row || typeof row !== 'object') continue;
      const title = String(row.jobTitle || row.title || '').trim();
      const company = String(row.company || row.companyName || '').trim();
      const location = String(row.workLocation || row.location || '').trim();
      const responsibilities = row.responsibilities ?? row.description;
      const respText = Array.isArray(responsibilities)
        ? responsibilities.join('\n')
        : String(responsibilities || '').trim();
      if (title || company) {
        parts.push(
          [title, company ? `at ${company}` : '', location ? `, ${location}` : '', respText ? `\n${respText}` : '']
            .filter(Boolean)
            .join(''),
        );
      }
    }
  }

  return parts;
}

function getCvNarrativeText(
  extra: Record<string, unknown> | null,
  candidate?: { cvSummary?: string | null; cvNotes?: string | null },
): string {
  if (!extra || typeof extra !== 'object') {
    return [candidate?.cvNotes, candidate?.cvSummary].filter(Boolean).join('\n\n');
  }
  const pipeline = (extra.pipeline || {}) as Record<string, unknown>;
  const summary = (pipeline.summary || {}) as Record<string, unknown>;
  const parts = [
    extra.workHistoryText,
    extra.workHistory,
    summary.workHistory,
    pipeline.workHistory,
    extra.experienceRaw,
    extra.cvRawText,
    extra.resumeText,
    extra.parsedResumeText,
    candidate?.cvNotes,
    ...collectPhase1SnapshotNarrativeParts(extra),
  ];
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

function parseGlobalExperienceFromExtra(
  extra: Record<string, unknown> | null,
  narrative: string,
): number | null {
  const pipeline = (extra?.pipeline || {}) as Record<string, unknown>;
  const professional = (pipeline.professional || {}) as Record<string, unknown>;
  const personal = (pipeline.personal || {}) as Record<string, unknown>;
  const nums = [
    professional.totalExperience,
    professional.experience,
    professional.experienceYears,
    personal.experience,
    extra?.totalExperience,
    extra?.experience,
    pipeline.experience,
  ];
  for (const value of nums) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 10) / 10;
  }
  const blob = [narrative, String(extra?.experienceRaw || '')].filter(Boolean).join('\n');
  const totalMatch = blob.match(
    /(\d+(?:\.\d+)?)\s*(?:\+)?\s*years?\s+(?:of\s+)?(?:total\s+)?experience/i,
  );
  if (totalMatch) {
    const n = Number(totalMatch[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function mapCvWorkRows(
  rows: NonNullable<BackendCandidate['cvWorkExperienceEntries']>,
): CvWorkEntryLike[] {
  return rows.map((entry) => {
    const row = entry as CvWorkEntryLike & {
      currentlyWorkHere?: boolean;
      currentlyWorking?: boolean;
      isCurrentJob?: boolean;
      description?: string;
    };
    const responsibilities = Array.isArray(entry.responsibilities)
      ? entry.responsibilities
      : row.description
        ? [String(row.description)]
        : null;
    const base = normalizeCvWorkEntry({
      title: entry.title ?? null,
      company: entry.company ?? null,
      location: entry.location ?? null,
      startDate: entry.startDate ?? null,
      endDate: entry.endDate ?? null,
      durationText: row.durationText ?? null,
      isCurrentJob:
        row.isCurrentJob === true ||
        row.currentlyWorkHere === true ||
        row.currentlyWorking === true ||
        isOpenEndedEndDate(entry.endDate),
      responsibilities,
    });
    const durationText = base.durationText || extractDurationTextFromEntry(base);
    return durationText ? { ...base, durationText } : base;
  });
}

/** Collect work rows from CV parse, Phase 1 snapshot, portal profile, and resume narrative. */
export function collectCandidateWorkEntries(
  candidate: CandidateExperienceSource | BackendCandidate,
): CvWorkEntryLike[] {
  const enriched = enrichBackendCandidateFromPhase1Snapshot(candidate as BackendCandidate);
  const extra =
    enriched.extraData && typeof enriched.extraData === 'object' && !Array.isArray(enriched.extraData)
      ? (enriched.extraData as Record<string, unknown>)
      : null;
  const snap = getPhase1ProfileSnapshot(extra);

  const buckets: CvWorkEntryLike[][] = [];

  if (Array.isArray(enriched.cvWorkExperienceEntries) && enriched.cvWorkExperienceEntries.length) {
    buckets.push(mapCvWorkRows(enriched.cvWorkExperienceEntries));
  }

  if (Array.isArray(snap?.workExperience) && snap.workExperience.length) {
    buckets.push(snap.workExperience.map((row) => workRecordToCvEntry(row as Record<string, unknown>)));
  }

  buckets.push(collectPipelineWorkEntries(extra));

  const narrative = getCvNarrativeText(extra, {
    cvNotes: (candidate as CandidateExperienceSource).cvNotes,
    cvSummary: (candidate as CandidateExperienceSource).cvSummary,
  });
  if (narrative) {
    buckets.push(parseWorkEntriesFromCvNarrative(narrative));
  }

  const merged: CvWorkEntryLike[] = [];
  for (const bucket of buckets) {
    merged.push(...bucket);
  }
  return dedupeWorkEntries(merged);
}

function computeYearsFromDateRanges(list: CvWorkEntryLike[]): number | null {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const entry of list.map(normalizeCvWorkEntry)) {
    const start = parseDateMs(entry.startDate);
    const end = entry.isCurrentJob
      ? Date.now()
      : parseDateMs(entry.endDate) ?? (start != null ? Date.now() : null);
    if (start != null && end != null && end >= start) {
      ranges.push({ start, end });
    }
  }
  if (!ranges.length) return null;

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
  if (totalMs <= 0) return null;
  const years = totalMs / (365.25 * 24 * 60 * 60 * 1000);
  const rounded = Math.round(years * 10) / 10;
  return rounded > 0 ? rounded : 0.1;
}

/** Sum per-role duration claims from CV text ("1 year experience on-site", etc.). */
export function computeYearsFromDurationClaims(list: CvWorkEntryLike[]): number | null {
  let durationSum = 0;
  let anyDuration = false;
  for (const entry of list) {
    const years = parseDurationYears(extractDurationTextFromEntry(entry));
    if (years != null) {
      durationSum += years;
      anyDuration = true;
    }
  }
  if (!anyDuration) return null;
  const rounded = Math.round(durationSum * 10) / 10;
  return rounded > 0 ? rounded : 0.1;
}

/** Total years for list/drawer — prefers CV duration lines when dates understate tenure. */
export function resolveCandidateExperienceYears(
  candidate: CandidateExperienceSource | BackendCandidate,
): number | null {
  const enriched = enrichBackendCandidateFromPhase1Snapshot(candidate as BackendCandidate);
  const extra =
    enriched.extraData && typeof enriched.extraData === 'object' && !Array.isArray(enriched.extraData)
      ? (enriched.extraData as Record<string, unknown>)
      : null;
  const entries = collectCandidateWorkEntries(enriched);
  const narrative = getCvNarrativeText(extra, {
    cvNotes: (candidate as CandidateExperienceSource).cvNotes,
    cvSummary: (candidate as CandidateExperienceSource).cvSummary,
  });
  const apiYears =
    enriched.experience ??
    (enriched as BackendCandidate & { experienceYears?: number | null }).experienceYears ??
    null;
  const fallback =
    parseGlobalExperienceFromExtra(extra, narrative) ??
    (apiYears != null && Number.isFinite(Number(apiYears)) ? Number(apiYears) : null);
  const computed = computeTotalExperienceYears(entries, fallback);
  const apiNum = apiYears != null && Number.isFinite(Number(apiYears)) ? Number(apiYears) : null;
  if (computed != null && computed < 1 && apiNum != null && apiNum >= 1) {
    return apiNum;
  }
  return computed;
}

/** Calendar merge + CV duration claims + fallback total from parsed resume. */
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

  const durationSum = computeYearsFromDurationClaims(list);
  const calendarYears = computeYearsFromDateRanges(list);

  if (durationSum != null && durationSum > 0) {
    if (calendarYears == null || durationSum > calendarYears || calendarYears < 0.5) {
      return durationSum;
    }
  }
  if (calendarYears != null && calendarYears > 0) {
    const fallbackNum =
      fallbackYears != null && Number.isFinite(Number(fallbackYears)) ? Number(fallbackYears) : null;
    // Portal profile dates often understate tenure; trust CV/API total when calendar ≈ 0.
    if (fallbackNum != null && fallbackNum >= 1 && calendarYears < 1) {
      return fallbackNum;
    }
    if (fallbackNum != null && fallbackNum > calendarYears) {
      return fallbackNum;
    }
    return calendarYears;
  }

  if (fallbackYears != null && Number.isFinite(Number(fallbackYears))) {
    return Math.max(0, Number(fallbackYears));
  }
  if (list.length > 0) return 0.1;
  return null;
}

export function formatExperienceYearsLabel(years: number | null | undefined): string {
  if (years == null || !Number.isFinite(Number(years))) return '';
  const n = Number(years);
  if (n === 0) return '0 years';
  if (Number.isInteger(n)) return `${n} year${n === 1 ? '' : 's'}`;
  return `${n.toFixed(1)} years`;
}

/** Compact label for candidates table (e.g. `7y`, `<1y`, `—`). */
export function formatCandidateExperienceForTable(
  years: number | null | undefined,
  workEntryCount = 0,
): string {
  const hasWork = workEntryCount > 0;
  if (years == null || !Number.isFinite(Number(years))) {
    return hasWork ? '<1y' : '—';
  }
  const n = Number(years);
  if (n >= 1) {
    return Number.isInteger(n) ? `${n}y` : `${n.toFixed(1)}y`;
  }
  if (n > 0) return '<1y';
  return hasWork ? '<1y' : '—';
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
  const start = String(entry.startDate || '').trim();
  const end = String(entry.endDate || '').trim();
  if (start || end) {
    parts.push([start, end].filter(Boolean).join(' – ') || '');
  }
  const tenure = formatWorkEntryTenureLabel(entry);
  if (tenure) {
    const tenureLower = tenure.toLowerCase();
    const alreadyInMeta = parts.some((part) => part.toLowerCase().includes(tenureLower));
    if (!alreadyInMeta) parts.push(tenure);
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
