/** Education row shape for Add Candidate drawer (step 2). */
export type CandidateEducationRow = {
  educationLevel: string;
  qualification: string;
  instituteName: string;
  instituteLocation: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  currentlyStudying: boolean;
};

export const EMPTY_EDUCATION_ENTRY: CandidateEducationRow = {
  educationLevel: '',
  qualification: '',
  instituteName: '',
  instituteLocation: '',
  startMonth: '',
  startYear: '',
  endMonth: '',
  endYear: '',
  currentlyStudying: false,
};

export const EDUCATION_LEVEL_OPTIONS = [
  'SSC',
  'HSC',
  'Diploma',
  "Associate Degree",
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
];

export function isSchoolCertificateEntry(educationLevel: string, qualification = ''): boolean {
  const text = `${educationLevel} ${qualification}`.toLowerCase();
  return (
    /\b(ssc|hsc)\b/.test(text) ||
    educationLevel === 'High School' ||
    educationLevel === 'Secondary School' ||
    educationLevel === 'Higher Secondary'
  );
}

export function formatEducationTitle(educationLevel: string, qualification: string): string {
  const degree = String(qualification || '').trim();
  if (degree) return degree;
  return String(educationLevel || '').trim() || '—';
}

export function formatInstitutionLine(institutionName: string, institutionLocation?: string): string {
  const name = String(institutionName || '').trim();
  const location = String(institutionLocation || '').trim();
  if (name && location) return `${name}, ${location}`;
  return name || location || '—';
}

function formatMonthYearFull(year: string, month: string): string {
  const y = String(year || '').trim();
  const m = parseInt(String(month || '').trim(), 10);
  if (!y) return '';
  if (m >= 1 && m <= 12) return `${MONTH_FULL[m]} ${y}`;
  return y;
}

export function formatEducationDateLine(
  _educationLevel: string,
  _qualification: string,
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
  return startPart || endPart || '—';
}

export function normalizeEducationRow(raw: Partial<CandidateEducationRow> | null | undefined): CandidateEducationRow {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_EDUCATION_ENTRY };
  return {
    educationLevel: String(raw.educationLevel || '').trim(),
    qualification: String(raw.qualification || '').trim(),
    instituteName: String(raw.instituteName || '').trim(),
    instituteLocation: String(raw.instituteLocation || '').trim(),
    startMonth: String(raw.startMonth || '').trim(),
    startYear: String(raw.startYear || '').trim(),
    endMonth: String(raw.endMonth || '').trim(),
    endYear: String(raw.endYear || '').trim(),
    currentlyStudying: Boolean(raw.currentlyStudying),
  };
}

export function mapParsedEducationToRow(entry: {
  degree?: string;
  qualification?: string;
  institution?: string;
  instituteName?: string;
  educationLevel?: string;
  institutionLocation?: string;
  startYear?: string;
  startMonth?: string;
  endYear?: string;
  endMonth?: string;
  currentlyStudying?: boolean;
}): CandidateEducationRow {
  const level = String(entry.educationLevel || '').trim();
  const degree = String(entry.qualification || entry.degree || '').trim();
  let instituteName = String(entry.instituteName || entry.institution || '').trim();
  let instituteLocation = String(entry.institutionLocation || '').trim();
  if (!instituteLocation && instituteName.includes(',')) {
    const parts = instituteName.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      instituteName = parts.slice(0, -1).join(', ');
      instituteLocation = parts[parts.length - 1];
    }
  }
  const row: CandidateEducationRow = {
    educationLevel: level,
    qualification: degree,
    instituteName,
    instituteLocation,
    startMonth: String(entry.startMonth || '').trim(),
    startYear: String(entry.startYear || '').trim(),
    endMonth: String(entry.endMonth || '').trim(),
    endYear: String(entry.endYear || '').trim(),
    currentlyStudying: Boolean(entry.currentlyStudying),
  };
  if (isSchoolCertificateEntry(row.educationLevel, row.qualification) && !row.qualification && row.educationLevel) {
    row.qualification = row.educationLevel;
  }
  return row;
}

export function educationRowToCvEntry(row: CandidateEducationRow) {
  const normalized = normalizeEducationRow(row);
  const isSchool = isSchoolCertificateEntry(normalized.educationLevel, normalized.qualification);
  const degree =
    normalized.qualification ||
    (isSchool ? normalized.educationLevel : '') ||
    undefined;
  const institution = formatInstitutionLine(
    normalized.instituteName,
    normalized.instituteLocation,
  );
  return {
    degree: degree || undefined,
    institution: institution !== '—' ? institution : undefined,
    educationLevel: normalized.educationLevel || undefined,
    institutionLocation: normalized.instituteLocation || undefined,
    startYear: normalized.startYear || undefined,
    startMonth: normalized.startMonth || undefined,
    endYear: normalized.endYear || undefined,
    endMonth: normalized.endMonth || undefined,
    currentlyStudying: normalized.currentlyStudying || undefined,
    period: formatEducationDateLine(
      normalized.educationLevel,
      normalized.qualification,
      normalized.startYear,
      normalized.startMonth,
      normalized.endYear,
      normalized.endMonth,
      normalized.currentlyStudying,
    ),
  };
}

export function formatEducationRowSummary(row: CandidateEducationRow): string {
  const n = normalizeEducationRow(row);
  if (!n.qualification && !n.instituteName && !n.educationLevel) return '';
  const title = formatEducationTitle(n.educationLevel, n.qualification);
  const inst = formatInstitutionLine(n.instituteName, n.instituteLocation);
  const dates = formatEducationDateLine(
    n.educationLevel,
    n.qualification,
    n.startYear,
    n.startMonth,
    n.endYear,
    n.endMonth,
    n.currentlyStudying,
  );
  return [title, inst, dates].filter((p) => p && p !== '—').join(' · ');
}

export function buildEducationYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 2; y >= currentYear - 55; y -= 1) {
    years.push(y);
  }
  return years;
}

/** True when regex fallback captured a work line instead of education. */
export function isGarbageEducationSummary(text: unknown): boolean {
  const t = String(text ?? '').trim();
  if (!t) return false;
  return (
    /experience on-site/i.test(t) ||
    /TECHNOLGIES,\s*Panvel/i.test(t) ||
    (/information technol/i.test(t) && !/\b(B\.E|HSC|SSC|Computer Science|VIMEET|College|School)\b/i.test(t))
  );
}

/** Build ATS education summary from structured entries (matches backend pipeline). */
export function buildEducationSummaryFromCvEntries(
  entries: Array<Record<string, unknown>> | null | undefined
): string {
  if (!Array.isArray(entries) || !entries.length) return '';
  return entries
    .map((e) => {
      const q = String(e.qualification || e.degree || '').trim();
      const i = String(e.instituteName || e.institution || '').trim();
      return [q, i].filter(Boolean).join(' — ');
    })
    .filter(Boolean)
    .join(' | ');
}
