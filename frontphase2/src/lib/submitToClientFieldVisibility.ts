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
  'firstName',
  'middleName',
  'lastName',
  'email',
  'phoneCode',
  'phone',
  'age',
  'candidateScore',
  'city',
  'state',
  'country',
  'location',
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
  'p1CurrentRole',
  'p1PreferredJobTitles',
  'p1PreferredIndustries',
  'p1FunctionalAreas',
  'p1JobTypes',
  'p1WorkModes',
  'p1PreferredLocations',
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
  'portfolio',
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
      { id: 'firstName', label: 'First Name' },
      { id: 'middleName', label: 'Middle Name' },
      { id: 'lastName', label: 'Last Name' },
      { id: 'email', label: 'E-mail' },
      { id: 'phoneCode', label: 'Phone code' },
      { id: 'phone', label: 'Mobile No' },
      { id: 'age', label: 'Age' },
      { id: 'candidateScore', label: 'Candidate Score' },
      { id: 'city', label: 'City' },
      { id: 'state', label: 'State' },
      { id: 'country', label: 'Country' },
      { id: 'location', label: 'Location (display)' },
      { id: 'address', label: 'Current Address' },
      { id: 'zip', label: 'Zip' },
      { id: 'avatar', label: 'Candidate Image' },
      { id: 'nationality', label: 'Nationality' },
      { id: 'currentCompanyWebsite', label: 'Current Company Website' },
      { id: 'gender', label: 'Gender' },
      { id: 'employment', label: 'Employment status' },
      { id: 'maritalStatus', label: 'Marital Status' },
      { id: 'birthDate', label: 'Birth Date' },
      { id: 'passportNumber', label: 'Passport Number' },
      { id: 'preferredLocation', label: 'Preferred Location' },
    ],
  },
  {
    id: 'education',
    title: 'Education',
    fields: [
      { id: 'cvEducationEntries', label: 'Education entries' },
      { id: 'educationSummary', label: 'Education summary' },
      { id: 'educationCourses', label: 'Courses' },
    ],
  },
  {
    id: 'professional',
    title: 'Career Preferences',
    fields: [
      { id: 'remarks', label: 'Remarks' },
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
      { id: 'workHistoryText', label: 'Work history (narrative)' },
      { id: 'extracurricular', label: 'Extracurricular activities' },
      { id: 'volunteers', label: 'Volunteers' },
      { id: 'p1CurrentRole', label: 'Current role' },
      { id: 'p1PreferredJobTitles', label: 'Preferred job titles' },
      { id: 'p1PreferredIndustries', label: 'Preferred industries' },
      { id: 'p1FunctionalAreas', label: 'Functional areas' },
      { id: 'p1JobTypes', label: 'Job types' },
      { id: 'p1WorkModes', label: 'Work modes' },
      { id: 'p1PreferredLocations', label: 'Preferred locations' },
      { id: 'p1Relocation', label: 'Relocation' },
      { id: 'p1AvailabilityToStart', label: 'Availability to start' },
    ],
  },
  {
    id: 'work',
    title: 'Work Experience',
    fields: [{ id: 'cvWorkExperienceEntries', label: 'Work experience entries' }],
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
      { id: 'portfolio', label: 'Portfolio URL' },
      { id: 'cvPortfolioLinks', label: 'Portfolio / project links' },
    ],
  },
  {
    id: 'summary',
    title: 'Summary & Additional',
    fields: [
      { id: 'cvSummary', label: 'Summary' },
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
    title: 'Phase 1 extra sections',
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
  name: ['firstName', 'lastName'],
  'first name': ['firstName'],
  'last name': ['lastName'],
  'middle name': ['middleName'],
  'full name': ['firstName', 'middleName', 'lastName'],
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
  'location (display)': ['location'],
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
  'current employer': ['currentCompany'],
  'current salary': ['currentSalary'],
  'current salary currency': ['currentSalaryCurrency'],
  'current benefits': ['currentBenefits'],
  'expected salary': ['expectedSalary'],
  'current role': ['p1CurrentRole', 'currentTitle'],
  'preferred job titles': ['p1PreferredJobTitles'],
  'preferred industries': ['p1PreferredIndustries'],
  'functional areas': ['p1FunctionalAreas'],
  'job types': ['p1JobTypes'],
  'work modes': ['p1WorkModes'],
  'preferred locations': ['p1PreferredLocations'],
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
  'portfolio url': ['portfolio'],
  'portfolio / project links': ['cvPortfolioLinks'],
  summary: ['cvSummary'],
  skills: ['skills'],
  'language & proficiency': ['languageProficiency'],
  'honours & awards': ['honours'],
  certifications: ['certifications'],
  'projects (extra)': ['projects'],
  projects: ['projects'],
  'hackathons (extra)': ['hackathons'],
  'internal notes': ['notes'],
  'file name': ['p1Resume'],
  'ats readiness': ['p1Resume'],
};

const PHASE1_SECTION_FIELDS: Record<Phase1ClientSectionId, SubmitToClientFieldId[]> = {
  personal: GROUP_SECTION_FIELDS.personal,
  resume: ['p1Resume'],
  summary: ['cvSummary'],
  work: ['cvWorkExperienceEntries'],
  internships: ['p1Internships'],
  gap: ['p1Gap'],
  education: ['cvEducationEntries', 'educationSummary', 'educationCourses'],
  academic: ['p1Academic'],
  exams: ['p1Exams'],
  skills: ['skills'],
  languages: ['languageProficiency'],
  projects: ['projects'],
  portfolio: ['cvPortfolioLinks', 'portfolio'],
  certifications: ['certifications'],
  accomplishments: ['p1Accomplishments'],
  careerPreferences: [
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
    'p1CurrentRole',
    'p1PreferredJobTitles',
    'p1PreferredIndustries',
    'p1FunctionalAreas',
    'p1JobTypes',
    'p1WorkModes',
    'p1PreferredLocations',
    'p1Relocation',
    'p1AvailabilityToStart',
  ],
  visa: ['p1Visa'],
  vaccination: ['p1Vaccination'],
};

export function parseSubmitToClientFieldVisibility(raw: unknown): SubmitToClientFieldVisibility {
  const merged: SubmitToClientFieldVisibility = { ...DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY };
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? ((raw as { fieldVisibility?: unknown }).fieldVisibility &&
        typeof (raw as { fieldVisibility?: unknown }).fieldVisibility === 'object'
          ? ((raw as { fieldVisibility: Record<string, unknown> }).fieldVisibility)
          : (raw as Record<string, unknown>))
      : null;
  if (!source) return merged;
  for (const key of SUBMIT_TO_CLIENT_FIELDS) {
    if (source[key] === false) merged[key] = false;
    else if (source[key] === true) merged[key] = true;
  }
  return merged;
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

function reviewFieldIdsForLabel(label: string): SubmitToClientFieldId[] | null {
  const key = normalizeReviewLabel(label);
  if (SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS[key]) {
    return SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS[key];
  }
  if (/^skill\s+\d+$/.test(key)) return ['skills'];
  if (/^language\s+\d+$/.test(key)) return ['languageProficiency'];
  return null;
}

export function isSubmitToClientReviewFieldVisible(
  label: string,
  visibility?: Partial<SubmitToClientFieldVisibility> | null,
): boolean {
  const ids = reviewFieldIdsForLabel(label);
  if (!ids || !visibility) return true;
  const parsed = parseSubmitToClientFieldVisibility(visibility);
  return ids.some((id) => parsed[id] !== false);
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
  portfolio: ['cvPortfolioLinks', 'portfolio'],
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
        isSubmitToClientReviewFieldVisible(row.label, parsed),
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
