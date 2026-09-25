import type {
  ClientPresentationSectionId,
  ClientReviewSection,
  ClientSectionVisibility,
} from './clientPresentationSections';
import {
  DEFAULT_CLIENT_SECTION_VISIBILITY,
  CLIENT_PRESENTATION_SECTION_IDS,
} from './clientPresentationSections';
import {
  DEFAULT_PHASE1_CLIENT_SECTION_VISIBILITY,
  type Phase1ClientSectionId,
  type Phase1ClientSectionVisibility,
} from './phase1ClientPresentationSections';

export const SUBMIT_TO_CLIENT_FIELDS = [
  'fullName',
  'email',
  'phoneCode',
  'phone',
  'age',
  'candidateScore',
  'city',
  'state',
  'country',
  'address',
  'zip',
  'avatar',
  'nationality',
  'currentCompanyWebsite',
  'gender',
  'employment',
  'maritalStatus',
  'birthDate',
  'passportNumber',
  'preferredLocation',
  'cvEducationEntries',
  'educationSummary',
  'educationCourses',
  'remarks',
  'experience',
  'currentTitle',
  'currentCompany',
  'currentSalary',
  'currentSalaryCurrency',
  'currentBenefits',
  'expectedSalary',
  'expectedSalaryCurrency',
  'expectedBenefits',
  'noticePeriod',
  'workHistoryText',
  'extracurricular',
  'volunteers',
  'p1PreferredJobTitles',
  'p1PreferredIndustries',
  'p1FunctionalAreas',
  'p1JobTypes',
  'p1WorkModes',
  'p1Relocation',
  'p1AvailabilityToStart',
  'cvWorkExperienceEntries',
  'linkedIn',
  'twitter',
  'xing',
  'skypeId',
  'facebook',
  'stackOverflow',
  'website',
  'cvPortfolioLinks',
  'cvSummary',
  'skills',
  'languageProficiency',
  'honours',
  'certifications',
  'projects',
  'hackathons',
  'notes',
  'p1Resume',
  'p1Internships',
  'p1Gap',
  'p1Academic',
  'p1Exams',
  'p1Accomplishments',
  'p1Visa',
  'p1Vaccination',
] as const;

export type SubmitToClientFieldId = (typeof SUBMIT_TO_CLIENT_FIELDS)[number];

export type SubmitToClientFieldVisibility = Record<SubmitToClientFieldId, boolean>;

export const DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY: SubmitToClientFieldVisibility =
  Object.fromEntries(SUBMIT_TO_CLIENT_FIELDS.map((key) => [key, true])) as SubmitToClientFieldVisibility;

export type SubmitToClientFieldGroup = {
  id: string;
  title: string;
  description?: string;
  fields: Array<{ id: SubmitToClientFieldId; label: string }>;
};

export const SUBMIT_TO_CLIENT_FIELD_GROUPS: SubmitToClientFieldGroup[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Name, contact, and identity fields on the client review.',
    fields: [
      { id: 'fullName', label: 'Full Name' },
      { id: 'email', label: 'E-mail' },
      { id: 'phoneCode', label: 'Phone code' },
      { id: 'phone', label: 'Mobile No' },
      { id: 'birthDate', label: 'Birth Date' },
      { id: 'age', label: 'Age' },
      { id: 'gender', label: 'Gender' },
      { id: 'maritalStatus', label: 'Marital Status' },
      { id: 'employment', label: 'Employment status' },
      { id: 'passportNumber', label: 'Passport Number' },
      { id: 'address', label: 'Current Address' },
      { id: 'city', label: 'City' },
      { id: 'state', label: 'State' },
      { id: 'zip', label: 'Zip' },
      { id: 'country', label: 'Country' },
      { id: 'nationality', label: 'Nationality' },
      { id: 'avatar', label: 'Candidate Image' },
      { id: 'candidateScore', label: 'Candidate Score' },
    ],
  },
  {
    id: 'education',
    title: 'Education',
    fields: [
      { id: 'cvEducationEntries', label: 'Education entries' },
      { id: 'educationSummary', label: 'Education summary' },
      { id: 'educationCourses', label: 'Courses' },
      { id: 'extracurricular', label: 'Extracurricular activities' },
    ],
  },
  {
    id: 'professional',
    title: 'Career Preferences',
    fields: [
      { id: 'experience', label: 'Experience (years)' },
      { id: 'currentTitle', label: 'Current Designation' },
      { id: 'currentCompany', label: 'Current Employer' },
      { id: 'currentSalary', label: 'Current Salary' },
      { id: 'currentSalaryCurrency', label: 'Current Salary Currency' },
      { id: 'currentBenefits', label: 'Current Benefits' },
      { id: 'expectedSalary', label: 'Expected Salary' },
      { id: 'expectedSalaryCurrency', label: 'Expected Salary Currency' },
      { id: 'expectedBenefits', label: 'Expected Benefits' },
      { id: 'noticePeriod', label: 'Notice Period' },
      { id: 'preferredLocation', label: 'Preferred Location' },
      { id: 'p1PreferredJobTitles', label: 'Preferred job titles' },
      { id: 'p1PreferredIndustries', label: 'Preferred industries' },
      { id: 'p1FunctionalAreas', label: 'Functional areas' },
      { id: 'p1JobTypes', label: 'Job types' },
      { id: 'p1WorkModes', label: 'Work modes' },
      { id: 'p1Relocation', label: 'Relocation' },
      { id: 'p1AvailabilityToStart', label: 'Availability to start' },
    ],
  },
  {
    id: 'work',
    title: 'Work Experience',
    fields: [
      { id: 'cvWorkExperienceEntries', label: 'Work experience entries' },
      { id: 'currentCompanyWebsite', label: 'Current Company Website' },
      { id: 'volunteers', label: 'Volunteers' },
      { id: 'workHistoryText', label: 'Work history (narrative)' },
    ],
  },
  {
    id: 'social',
    title: 'Social Network Information',
    fields: [
      { id: 'linkedIn', label: 'LinkedIn' },
      { id: 'twitter', label: 'Twitter' },
      { id: 'xing', label: 'Xing' },
      { id: 'skypeId', label: 'Skype ID' },
      { id: 'facebook', label: 'Facebook' },
      { id: 'stackOverflow', label: 'Stack Overflow' },
      { id: 'website', label: 'Website' },
      { id: 'cvPortfolioLinks', label: 'Portfolio / project links' },
    ],
  },
  {
    id: 'summary',
    title: 'Summary & Additional',
    fields: [
      { id: 'cvSummary', label: 'Summary' },
      { id: 'remarks', label: 'Remarks' },
      { id: 'skills', label: 'Skills' },
      { id: 'languageProficiency', label: 'Language & proficiency' },
      { id: 'honours', label: 'Honours & awards' },
      { id: 'certifications', label: 'Certifications' },
      { id: 'projects', label: 'Projects' },
      { id: 'hackathons', label: 'Hackathons' },
      { id: 'notes', label: 'Internal notes' },
    ],
  },
  {
    id: 'phase1Extra',
    title: 'Other',
    description: 'Shown when submitting a Phase 1 portal candidate.',
    fields: [
      { id: 'p1Resume', label: 'Resume / CV' },
      { id: 'p1Internships', label: 'Internships' },
      { id: 'p1Gap', label: 'Gap explanation' },
      { id: 'p1Academic', label: 'Academic achievements' },
      { id: 'p1Exams', label: 'Competitive exams' },
      { id: 'p1Accomplishments', label: 'Accomplishments' },
      { id: 'p1Visa', label: 'Visa & work authorization' },
      { id: 'p1Vaccination', label: 'Vaccination' },
    ],
  },
];

export const SUBMIT_TO_CLIENT_FIELD_LABELS: Record<SubmitToClientFieldId, string> =
  Object.fromEntries(
    SUBMIT_TO_CLIENT_FIELD_GROUPS.flatMap((group) => group.fields.map((field) => [field.id, field.label])),
  ) as Record<SubmitToClientFieldId, string>;

export const DEFAULT_SUBMIT_TO_CLIENT_TABLE_COLUMNS: SubmitToClientFieldId[] = [
  'fullName',
  'email',
  'phone',
  'currentTitle',
  'currentCompany',
];

/** Previous factory lists — treat as unset so tenants pick up Full Name + 5 other columns. */
const LEGACY_DEFAULT_SUBMIT_TO_CLIENT_TABLE_COLUMNS: readonly string[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'currentTitle',
  'currentCompany',
  'city',
  'state',
  'country',
  'preferredLocation',
  'skills',
  'cvEducationEntries',
  'experience',
  'candidateScore',
];

const PREVIOUS_FIVE_COLUMN_SUBMIT_TO_CLIENT_TABLE: readonly string[] = [
  'lastName',
  'email',
  'phone',
  'currentTitle',
  'currentCompany',
];

const PREVIOUS_SPLIT_NAME_SUBMIT_TO_CLIENT_TABLE: readonly string[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'currentTitle',
  'currentCompany',
];

const LEGACY_NAME_FIELD_IDS = new Set(['firstName', 'middleName', 'lastName']);

const SUBMIT_TO_CLIENT_FIELD_ID_SET = new Set<string>(SUBMIT_TO_CLIENT_FIELDS);

function normalizeSubmitToClientTableColumnId(raw: unknown): SubmitToClientFieldId | null {
  const id = String(raw || '').trim();
  if (!id) return null;
  if (LEGACY_NAME_FIELD_IDS.has(id)) return 'fullName';
  if (SUBMIT_TO_CLIENT_FIELD_ID_SET.has(id)) return id as SubmitToClientFieldId;
  return null;
}

function isLegacyUncustomizedTableColumns(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return true;
  const ids = raw.map((item) => String(item || '').trim()).filter(Boolean);
  if (ids.join(',') === LEGACY_DEFAULT_SUBMIT_TO_CLIENT_TABLE_COLUMNS.join(',')) return true;
  if (ids.join(',') === PREVIOUS_FIVE_COLUMN_SUBMIT_TO_CLIENT_TABLE.join(',')) return true;
  if (ids.join(',') === PREVIOUS_SPLIT_NAME_SUBMIT_TO_CLIENT_TABLE.join(',')) return true;
  if (ids.length <= DEFAULT_SUBMIT_TO_CLIENT_TABLE_COLUMNS.length) return false;
  const legacy = LEGACY_DEFAULT_SUBMIT_TO_CLIENT_TABLE_COLUMNS;
  const legacySet = new Set(legacy);
  if (ids.some((id) => !legacySet.has(id) && !LEGACY_NAME_FIELD_IDS.has(id) && id !== 'fullName')) {
    return false;
  }
  let index = 0;
  for (const id of ids) {
    while (index < legacy.length && legacy[index] !== id) index += 1;
    if (index >= legacy.length) return false;
    index += 1;
  }
  return true;
}

export function parseSubmitToClientTableColumns(
  raw: unknown,
  visibility?: Partial<SubmitToClientFieldVisibility> | null,
): SubmitToClientFieldId[] {
  const parsedVisibility = parseSubmitToClientFieldVisibility(visibility ?? DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY);
  const source = isLegacyUncustomizedTableColumns(raw)
    ? DEFAULT_SUBMIT_TO_CLIENT_TABLE_COLUMNS
    : Array.isArray(raw)
      ? raw
      : DEFAULT_SUBMIT_TO_CLIENT_TABLE_COLUMNS;
  const seen = new Set<SubmitToClientFieldId>();
  const next: SubmitToClientFieldId[] = [];
  for (const item of source) {
    const id = normalizeSubmitToClientTableColumnId(item);
    if (!id || seen.has(id)) continue;
    if (parsedVisibility[id] === false) continue;
    seen.add(id);
    next.push(id);
  }
  return next.length > 0 ? next : [...DEFAULT_SUBMIT_TO_CLIENT_TABLE_COLUMNS];
}

export function submitToClientTableColumnsEqual(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

function fieldsForGroup(groupId: string): SubmitToClientFieldId[] {
  return SUBMIT_TO_CLIENT_FIELD_GROUPS.find((group) => group.id === groupId)?.fields.map((field) => field.id) ?? [];
}

const GROUP_SECTION_FIELDS: Record<ClientPresentationSectionId, SubmitToClientFieldId[]> = {
  personal: fieldsForGroup('personal'),
  education: fieldsForGroup('education'),
  professional: fieldsForGroup('professional'),
  work: fieldsForGroup('work'),
  social: fieldsForGroup('social'),
  summary: fieldsForGroup('summary'),
};

/** Client-review labels → settings field ids (any visible id keeps the row). */
export const SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS: Record<string, SubmitToClientFieldId[]> = {
  name: ['fullName'],
  'first name': ['fullName'],
  'last name': ['fullName'],
  'middle name': ['fullName'],
  'full name': ['fullName'],
  'name of candidate': ['fullName'],
  'e-mail': ['email'],
  email: ['email'],
  'mobile no': ['phone'],
  mobile: ['phone'],
  'phone code': ['phoneCode'],
  age: ['age'],
  'candidate score': ['candidateScore'],
  'city & state': ['city', 'state'],
  city: ['city'],
  state: ['state'],
  country: ['country'],
  'current address': ['address'],
  zip: ['zip'],
  'candidate image': ['avatar'],
  nationality: ['nationality'],
  'current company website': ['currentCompanyWebsite'],
  gender: ['gender'],
  'employment status': ['employment'],
  'marital status': ['maritalStatus'],
  'birth date': ['birthDate'],
  'date of birth': ['birthDate'],
  'passport number': ['passportNumber'],
  'preferred location': ['preferredLocation'],
  'education entries': ['cvEducationEntries'],
  'education summary': ['educationSummary'],
  courses: ['educationCourses'],
  remarks: ['remarks'],
  'experience (years)': ['experience'],
  'current designation': ['currentTitle'],
  'current role': ['currentTitle'],
  'current employer': ['currentCompany'],
  'current salary': ['currentSalary'],
  'current salary currency': ['currentSalaryCurrency'],
  'current benefits': ['currentBenefits'],
  'expected salary': ['expectedSalary'],
  'preferred job titles': ['p1PreferredJobTitles'],
  'preferred industries': ['p1PreferredIndustries'],
  'functional areas': ['p1FunctionalAreas'],
  'job types': ['p1JobTypes'],
  'work modes': ['p1WorkModes'],
  'preferred locations': ['preferredLocation'],
  relocation: ['p1Relocation'],
  'availability to start': ['p1AvailabilityToStart'],
  'salary expectation': ['expectedSalary'],
  'expected salary currency': ['expectedSalaryCurrency'],
  'expected benefits': ['expectedBenefits'],
  'notice period': ['noticePeriod'],
  'work history (narrative)': ['workHistoryText'],
  'extracurricular activities': ['extracurricular'],
  volunteers: ['volunteers'],
  'work experience': ['cvWorkExperienceEntries'],
  'work experience entries': ['cvWorkExperienceEntries'],
  linkedin: ['linkedIn'],
  twitter: ['twitter'],
  xing: ['xing'],
  'skype id': ['skypeId'],
  facebook: ['facebook'],
  'stack overflow': ['stackOverflow'],
  website: ['website'],
  'portfolio url': ['cvPortfolioLinks'],
  'portfolio / project links': ['cvPortfolioLinks'],
  summary: ['cvSummary'],
  skills: ['skills'],
  'language & proficiency': ['languageProficiency'],
  'honours & awards': ['honours'],
  certifications: ['certifications'],
  'projects (extra)': ['projects'],
  projects: ['projects'],
  'hackathons (extra)': ['hackathons'],
  hackathons: ['hackathons'],
  'internal notes': ['notes'],
  'file name': ['p1Resume'],
  'ats readiness': ['p1Resume'],
  'resume / cv': ['p1Resume'],
  internships: ['p1Internships'],
  'gap explanation': ['p1Gap'],
  'academic achievements': ['p1Academic'],
  'competitive exams': ['p1Exams'],
  accomplishments: ['p1Accomplishments'],
  'visa & work authorization': ['p1Visa'],
  vaccination: ['p1Vaccination'],
  languages: ['languageProficiency'],
  'portfolio links': ['cvPortfolioLinks'],
};

const PHASE1_SECTION_FIELDS: Record<Phase1ClientSectionId, SubmitToClientFieldId[]> = {
  personal: GROUP_SECTION_FIELDS.personal,
  resume: ['p1Resume'],
  summary: ['cvSummary', 'remarks'],
  work: ['cvWorkExperienceEntries', 'currentCompanyWebsite', 'volunteers', 'workHistoryText'],
  internships: ['p1Internships'],
  gap: ['p1Gap'],
  education: ['cvEducationEntries', 'educationSummary', 'educationCourses', 'extracurricular'],
  academic: ['p1Academic'],
  exams: ['p1Exams'],
  skills: ['skills'],
  languages: ['languageProficiency'],
  projects: ['projects', 'hackathons'],
  portfolio: GROUP_SECTION_FIELDS.social,
  certifications: ['certifications'],
  accomplishments: ['p1Accomplishments'],
  careerPreferences: [
    'experience',
    'currentTitle',
    'currentCompany',
    'currentSalary',
    'currentSalaryCurrency',
    'currentBenefits',
    'expectedSalary',
    'expectedSalaryCurrency',
    'expectedBenefits',
    'noticePeriod',
    'preferredLocation',
    'p1PreferredJobTitles',
    'p1PreferredIndustries',
    'p1FunctionalAreas',
    'p1JobTypes',
    'p1WorkModes',
    'p1Relocation',
    'p1AvailabilityToStart',
  ],
  visa: ['p1Visa'],
  vaccination: ['p1Vaccination'],
};

function readSubmitToClientVisibilitySource(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const nested = (raw as { fieldVisibility?: unknown }).fieldVisibility;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return raw as Record<string, unknown>;
}

export function parseSubmitToClientFieldVisibility(raw: unknown): SubmitToClientFieldVisibility {
  const merged: SubmitToClientFieldVisibility = { ...DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY };
  const source = readSubmitToClientVisibilitySource(raw);
  if (!source) return merged;
  for (const key of SUBMIT_TO_CLIENT_FIELDS) {
    if (source[key] === false) merged[key] = false;
    else if (source[key] === true) merged[key] = true;
  }
  // Migrate legacy First / Middle / Last flags into Full Name.
  if (typeof source.fullName !== 'boolean') {
    const legacyFlags = ['firstName', 'middleName', 'lastName']
      .map((key) => source[key])
      .filter((value): value is boolean => typeof value === 'boolean');
    if (legacyFlags.length) {
      merged.fullName = legacyFlags.some((value) => value !== false);
    }
  }
  return merged;
}

/** Parsed map when the payload actually has visibility flags; otherwise null. */
export function coerceSubmitToClientFieldVisibility(
  raw: unknown,
): SubmitToClientFieldVisibility | null {
  const source = readSubmitToClientVisibilitySource(raw);
  if (!source) return null;
  const hasFlag =
    SUBMIT_TO_CLIENT_FIELDS.some((key) => typeof source[key] === 'boolean') ||
    ['firstName', 'middleName', 'lastName'].some((key) => typeof source[key] === 'boolean');
  if (!hasFlag) return null;
  return parseSubmitToClientFieldVisibility(raw);
}

export function isSubmitToClientFieldVisible(
  visibility: Partial<SubmitToClientFieldVisibility> | null | undefined,
  field: SubmitToClientFieldId,
): boolean {
  if (!visibility) return true;
  return visibility[field] !== false;
}

export function toggleSubmitToClientFieldVisibility(
  visibility: SubmitToClientFieldVisibility,
  field: SubmitToClientFieldId,
): SubmitToClientFieldVisibility {
  return {
    ...parseSubmitToClientFieldVisibility(visibility),
    [field]: !isSubmitToClientFieldVisible(visibility, field),
  };
}

export function submitToClientFieldVisibilityEqual(
  a: Partial<SubmitToClientFieldVisibility> | null | undefined,
  b: Partial<SubmitToClientFieldVisibility> | null | undefined,
): boolean {
  const left = parseSubmitToClientFieldVisibility(a);
  const right = parseSubmitToClientFieldVisibility(b);
  return SUBMIT_TO_CLIENT_FIELDS.every((key) => left[key] === right[key]);
}

function anyFieldVisible(
  visibility: SubmitToClientFieldVisibility,
  fields: SubmitToClientFieldId[],
): boolean {
  return fields.some((field) => visibility[field] !== false);
}

export function sectionVisibilityFromSubmitFields(
  visibility?: Partial<SubmitToClientFieldVisibility> | null,
): ClientSectionVisibility {
  const fields = parseSubmitToClientFieldVisibility(visibility);
  const next = { ...DEFAULT_CLIENT_SECTION_VISIBILITY };
  for (const id of CLIENT_PRESENTATION_SECTION_IDS) {
    next[id] = anyFieldVisible(fields, GROUP_SECTION_FIELDS[id]);
  }
  return next;
}

export function mergeSectionVisibilityWithSubmitFields(
  saved: Partial<ClientSectionVisibility> | null | undefined,
  fieldVisibility?: Partial<SubmitToClientFieldVisibility> | null,
): ClientSectionVisibility {
  const fromFields = sectionVisibilityFromSubmitFields(fieldVisibility);
  const fromSaved = saved
    ? {
        ...DEFAULT_CLIENT_SECTION_VISIBILITY,
        ...Object.fromEntries(
          CLIENT_PRESENTATION_SECTION_IDS.map((id) => [id, saved[id] !== false]),
        ),
      }
    : fromFields;
  const next = { ...DEFAULT_CLIENT_SECTION_VISIBILITY };
  for (const id of CLIENT_PRESENTATION_SECTION_IDS) {
    next[id] = fromSaved[id] !== false && fromFields[id] !== false;
  }
  return next;
}

export function phase1SectionVisibilityFromSubmitFields(
  visibility?: Partial<SubmitToClientFieldVisibility> | null,
): Phase1ClientSectionVisibility {
  const fields = parseSubmitToClientFieldVisibility(visibility);
  const next = { ...DEFAULT_PHASE1_CLIENT_SECTION_VISIBILITY };
  (Object.keys(PHASE1_SECTION_FIELDS) as Phase1ClientSectionId[]).forEach((id) => {
    next[id] = anyFieldVisible(fields, PHASE1_SECTION_FIELDS[id]);
  });
  return next;
}

export function mergePhase1SectionVisibilityWithSubmitFields(
  saved: Partial<Phase1ClientSectionVisibility> | null | undefined,
  fieldVisibility?: Partial<SubmitToClientFieldVisibility> | null,
): Phase1ClientSectionVisibility {
  const fromFields = phase1SectionVisibilityFromSubmitFields(fieldVisibility);
  const next = { ...DEFAULT_PHASE1_CLIENT_SECTION_VISIBILITY };
  (Object.keys(PHASE1_SECTION_FIELDS) as Phase1ClientSectionId[]).forEach((id) => {
    const savedVisible = saved ? saved[id] !== false : fromFields[id];
    next[id] = savedVisible && fromFields[id] !== false;
  });
  return next;
}

function normalizeReviewLabel(label: string): string {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const COMPOSITE_REVIEW_LABELS = new Set([
  'city & state',
  'salary expectation',
  'location (display)',
]);

function reviewFieldIdsForLabel(label: string): SubmitToClientFieldId[] | null {
  const key = normalizeReviewLabel(label);
  if (SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS[key]) {
    return SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS[key];
  }
  if (/^skill\s+\d+$/.test(key)) return ['skills'];
  if (/^language\s+\d+$/.test(key)) return ['languageProficiency'];
  return null;
}

export function isSubmitToClientCandidateNameVisible(
  visibility?: Partial<SubmitToClientFieldVisibility> | null,
): boolean {
  if (!visibility) return true;
  const parsed = parseSubmitToClientFieldVisibility(visibility);
  return parsed.fullName !== false;
}

export function isSubmitToClientReviewFieldVisible(
  label: string,
  visibility?: Partial<SubmitToClientFieldVisibility> | null,
  sectionId?: string,
): boolean {
  if (!visibility) return true;
  const key = normalizeReviewLabel(label);
  if (COMPOSITE_REVIEW_LABELS.has(key)) return false;
  const ids = reviewFieldIdsForLabel(label);
  const fallbackIds = sectionId ? REVIEW_SECTION_ENTRY_FIELDS[sectionId] : null;
  const resolved = ids || fallbackIds || null;
  // When Settings → Submit to Client defaults exist, only known allowlisted labels may show.
  // Unmapped leftovers must not leak permanently hidden data.
  if (!resolved) return false;
  const parsed = parseSubmitToClientFieldVisibility(visibility);
  return resolved.some((id) => parsed[id] !== false);
}

const REVIEW_SECTION_ENTRY_FIELDS: Record<string, SubmitToClientFieldId[]> = {
  personal: GROUP_SECTION_FIELDS.personal,
  education: ['cvEducationEntries'],
  professional: GROUP_SECTION_FIELDS.professional,
  work: ['cvWorkExperienceEntries'],
  social: GROUP_SECTION_FIELDS.social,
  summary: GROUP_SECTION_FIELDS.summary,
  resume: ['p1Resume'],
  internships: ['p1Internships'],
  gap: ['p1Gap'],
  academic: ['p1Academic'],
  exams: ['p1Exams'],
  skills: ['skills'],
  languages: ['languageProficiency'],
  projects: ['projects'],
  portfolio: ['cvPortfolioLinks'],
  certifications: ['certifications'],
  accomplishments: ['p1Accomplishments'],
  careerPreferences: PHASE1_SECTION_FIELDS.careerPreferences,
  visa: ['p1Visa'],
  vaccination: ['p1Vaccination'],
};

export function applySubmitToClientFieldVisibilityToReviewSections(
  sections: ClientReviewSection[],
  visibility?: Partial<SubmitToClientFieldVisibility> | null,
): ClientReviewSection[] {
  if (!visibility || !Array.isArray(sections)) return sections;
  const parsed = parseSubmitToClientFieldVisibility(visibility);
  return sections
    .map((section) => {
      const entryFields = REVIEW_SECTION_ENTRY_FIELDS[section.id];
      const entriesAllowed = !entryFields || entryFields.some((id) => parsed[id] !== false);
      const fields = (section.fields || []).filter((row) =>
        isSubmitToClientReviewFieldVisible(row.label, parsed, section.id),
      );
      const entries = entriesAllowed ? section.entries : undefined;
      return {
        ...section,
        fields,
        entries,
      };
    })
    .filter((section) => {
      const hasFields = Array.isArray(section.fields) && section.fields.length > 0;
      const hasEntries = Array.isArray(section.entries) && section.entries.length > 0;
      return hasFields || hasEntries;
    });
}

export function hiddenSubmitToClientFieldCount(
  visibility?: Partial<SubmitToClientFieldVisibility> | null,
): number {
  const parsed = parseSubmitToClientFieldVisibility(visibility);
  return SUBMIT_TO_CLIENT_FIELDS.filter((field) => parsed[field] === false).length;
}
