import type { CandidateWorkExperienceDocument } from './candidateWorkExperienceFields';

export const EDUCATION_LEVEL_OPTIONS = [
  'SSC',
  'HSC',
  'Diploma',
  'Associate Degree',
  "Bachelor's Degree",
  "Master's Degree",
  'Doctorate (PhD)',
  'Certification',
  'High School',
] as const;

export const EDUCATION_MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const;

export const EDUCATION_MODE_OPTIONS = [
  'Full-time',
  'Part-time',
  'Online',
  'Distance Learning',
] as const;

export type EducationGradeMetricType = 'percentage' | 'gpa' | 'grade';

export type CandidateEducationRecord = {
  id?: string;
  educationLevel?: string;
  degreeProgram?: string;
  degree?: string;
  institutionName?: string;
  institution?: string;
  institutionLocation?: string;
  fieldOfStudy?: string;
  field?: string;
  startYear?: string;
  startMonth?: string;
  endYear?: string;
  endMonth?: string;
  currentlyStudying?: boolean;
  grade?: string;
  modeOfStudy?: string;
  courseDuration?: string;
  documents?: CandidateWorkExperienceDocument[];
};

const MONTH_FULL = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function str(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/** Respect an explicit empty institutionLocation; only fall back to legacy `location` when unset. */
function readInstitutionLocation(row: Record<string, unknown>): string {
  if (Object.prototype.hasOwnProperty.call(row, 'institutionLocation')) {
    return str(row.institutionLocation);
  }
  return str(row.location);
}

function documentNameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return 'Document';
  try {
    const pathname = new URL(trimmed, 'https://placeholder.local').pathname;
    const tail = pathname.split('/').filter(Boolean).pop();
    if (tail) return decodeURIComponent(tail);
  } catch {
    const tail = trimmed.split('/').filter(Boolean).pop();
    if (tail) return decodeURIComponent(tail);
  }
  return 'Document';
}

function parseEducationDocuments(value: unknown): CandidateWorkExperienceDocument[] {
  if (!value) return [];
  const rawList = Array.isArray(value) ? value : [value];

  return rawList
    .map((doc, index) => {
      if (typeof doc === 'string') {
        const url = doc.trim();
        if (!url) return null;
        return {
          id: `doc-${index}-${url}`,
          url,
          name: documentNameFromUrl(url),
          fileName: documentNameFromUrl(url),
        };
      }
      if (!doc || typeof doc !== 'object') return null;
      const item = doc as Record<string, unknown>;
      const url = String(item.url || item.fileUrl || item.href || '').trim();
      const name =
        String(item.name || item.fileName || item.title || '').trim() ||
        (url ? documentNameFromUrl(url) : 'Document');
      const sizeValue = Number(item.size);
      return {
        id: String(item.id || url || `${name}-${index}`),
        name,
        fileName: String(item.fileName || name),
        url: url || undefined,
        size: Number.isFinite(sizeValue) && sizeValue > 0 ? sizeValue : undefined,
      };
    })
    .filter((doc): doc is CandidateWorkExperienceDocument => Boolean(doc?.name || doc?.url));
}

export function decodeStoredGrade(stored: string): { type: EducationGradeMetricType; value: string } {
  const raw = (stored || '').trim();
  if (!raw) return { type: 'percentage', value: '' };
  const match = /^(percentage|gpa|grade)\|(.*)$/i.exec(raw);
  if (match) {
    return { type: match[1].toLowerCase() as EducationGradeMetricType, value: match[2] };
  }
  if (/^\d+(\.\d+)?$/.test(raw)) return { type: 'percentage', value: raw };
  return { type: 'grade', value: raw };
}

export function encodeStoredGrade(type: EducationGradeMetricType, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return `${type}|${trimmed}`;
}

export function formatStoredGradeForDisplay(stored: string): string {
  const { type, value } = decodeStoredGrade(stored);
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (type === 'percentage') return `${trimmed}%`;
  if (type === 'gpa') return `GPA: ${trimmed}`;
  return trimmed;
}

export function isSchoolCertificateEntry(educationLevel: string, degreeProgram = ''): boolean {
  const text = `${educationLevel} ${degreeProgram}`.toLowerCase();
  return (
    /\b(ssc|hsc)\b/.test(text) ||
    educationLevel === 'High School' ||
    educationLevel === 'Secondary School' ||
    educationLevel === 'Higher Secondary'
  );
}

export function formatEducationTitle(educationLevel: string, degreeProgram: string): string {
  const degree = String(degreeProgram || '').trim();
  if (degree) return degree;
  return String(educationLevel || '').trim();
}

export function formatInstitutionLine(institutionName: string, institutionLocation?: string): string {
  const name = String(institutionName || '').trim();
  const location = String(institutionLocation || '').trim();
  if (name && location) return `${name}, ${location}`;
  return name || location;
}

function formatMonthYearFull(year: string, month: string): string {
  const y = String(year || '').trim();
  const m = parseInt(String(month || '').trim(), 10);
  if (!y) return '';
  if (m >= 1 && m <= 12) return `${MONTH_FULL[m]} ${y}`;
  return y;
}

export function formatEducationDateLine(
  startYear: string,
  startMonth: string,
  endYear: string,
  endMonth: string,
  currentlyStudying: boolean,
): string {
  const startPart = formatMonthYearFull(startYear, startMonth);
  if (currentlyStudying) {
    return startPart ? `${startPart} - Present` : 'Present';
  }
  const endPart = formatMonthYearFull(endYear, endMonth);
  if (startPart && endPart) return `${startPart} - ${endPart}`;
  return startPart || endPart;
}

function toMonthIndex(year: string, month: string): number | null {
  const y = parseInt(String(year || '').trim(), 10);
  const m = parseInt(String(month || '').trim(), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return y * 12 + m;
}

export function computeCourseDurationFromDates(
  startYear: string,
  startMonth: string,
  endYear: string,
  endMonth: string,
  currentlyStudying: boolean,
): string {
  const startIndex = toMonthIndex(startYear, startMonth);
  if (startIndex === null) return '';

  let endIndex: number | null;
  if (currentlyStudying) {
    const now = new Date();
    endIndex = now.getFullYear() * 12 + (now.getMonth() + 1);
  } else {
    endIndex = toMonthIndex(endYear, endMonth);
  }
  if (endIndex === null || endIndex < startIndex) return '';

  const totalMonths = Math.max(1, endIndex - startIndex);
  return String(parseFloat((totalMonths / 12).toFixed(2)));
}

export function formatCourseDurationDisplay(stored: string): string {
  const raw = String(stored || '').trim();
  if (!raw) return '';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return raw;
  if (n < 1) {
    const months = Math.max(1, Math.round(n * 12));
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }
  const rounded = parseFloat(n.toFixed(2));
  return `${rounded} ${rounded === 1 ? 'year' : 'years'}`;
}

export function buildEducationYearOptions(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let year = current + 6; year >= 1970; year -= 1) {
    years.push(year);
  }
  return years;
}

export function normalizeEducationRecord(
  entry: Record<string, unknown> | CandidateEducationRecord,
): CandidateEducationRecord {
  const row = entry as Record<string, unknown>;
  const educationLevel = str(row.educationLevel);
  const degreeProgram = str(row.degreeProgram) || str(row.degree);
  const institutionName = str(row.institutionName) || str(row.institution);
  const currentlyStudying = row.currentlyStudying === true;

  return {
    id: str(row.id) || undefined,
    educationLevel,
    degreeProgram,
    degree: degreeProgram,
    institutionName,
    institution: institutionName,
    institutionLocation: readInstitutionLocation(row),
    fieldOfStudy: str(row.fieldOfStudy) || str(row.field),
    field: str(row.fieldOfStudy) || str(row.field),
    startYear: str(row.startYear),
    startMonth: str(row.startMonth),
    endYear: currentlyStudying ? '' : str(row.endYear),
    endMonth: currentlyStudying ? '' : str(row.endMonth),
    currentlyStudying,
    grade: str(row.grade),
    modeOfStudy: str(row.modeOfStudy),
    courseDuration:
      str(row.courseDuration) ||
      computeCourseDurationFromDates(
        str(row.startYear),
        str(row.startMonth),
        currentlyStudying ? '' : str(row.endYear),
        currentlyStudying ? '' : str(row.endMonth),
        currentlyStudying,
      ),
    documents: parseEducationDocuments(row.documents ?? row.educationDocuments ?? row.certificates),
  };
}

export function educationRecordToSnapshotRow(
  entry: CandidateEducationRecord,
): Record<string, unknown> {
  const normalized = normalizeEducationRecord(entry);
  const institutionLocation = normalized.institutionLocation ?? '';
  return {
    ...normalized,
    institutionLocation,
    location: institutionLocation,
    documents: normalized.documents
      ?.filter((doc) => doc.url && !doc.url.startsWith('blob:'))
      .map((doc) => ({
        id: doc.id,
        name: doc.name,
        fileName: doc.fileName || doc.name,
        url: doc.url,
        size: doc.size,
      })),
  };
}
