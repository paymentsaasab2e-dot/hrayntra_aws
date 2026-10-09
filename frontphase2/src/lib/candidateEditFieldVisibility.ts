/**
 * Tenant-wide visibility for Edit Candidate / candidate overview fields.
 * Defaults keep a short core set; Settings can enable extra parameters org-wide.
 */

export const CANDIDATE_EDIT_FIELDS = [
  // Core defaults (always on unless an admin turns them off)
  'fullName',
  'phone',
  'email',
  'location',
  'currentCompany',
  'currentTitle',
  'experience',
  'currentSalary',
  'currentBenefits',
  'expectedSalary',
  'expectedBenefits',
  'noticePeriod',
  'educationSummary',
  'languageProficiency',
  'age',
  'gender',
  'maritalStatus',
  'nationality',
  'passportNumber',
  'remarks', // Reason for Current Job Change

  // Optional extras (off by default)
  'avatar',
  'candidateScore',
  'city',
  'state',
  'country',
  'address',
  'zip',
  'currentCompanyWebsite',
  'birthDate',
  'preferredLocation',
  'cvEducationEntries',
  'educationCourses',
  'workHistoryText',
  'extracurricular',
  'volunteers',
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
  'honours',
  'certifications',
  'projects',
  'hackathons',
  'notes',
  'currentSalaryCurrency',
  'expectedSalaryCurrency',
  'careerCurrentSalaryType',
  'careerCurrentCurrency',
  'careerPreferredRoles',
  'careerPreferredCurrency',
  'careerPreferredSalaryType',
  'careerPreferredLocations',
  'careerWorkModes',
  'careerPreferredIndustries',
  'careerFunctionalAreas',
  'careerJobTypes',
  'careerRelocation',
  'careerEarliestStart',
  'careerDescribeAvailability',
  'hiringSource',
  'hiringAvailability',
  'hiringSalaryCurrency',
  'employment',
  // Phase 1 overview / edit sections (off by default)
  'p1Internships',
  'p1Gap',
  'p1Academic',
  'p1Exams',
  'p1Accomplishments',
  'p1Visa',
  'p1Vaccination',
  'p1Resume',
] as const;

export type CandidateEditFieldId = (typeof CANDIDATE_EDIT_FIELDS)[number];

export type CandidateEditFieldVisibility = Record<CandidateEditFieldId, boolean>;

/** Fields shown by default on Edit Candidate / candidate tabs for every tenant. */
export const DEFAULT_ON_CANDIDATE_EDIT_FIELDS: readonly CandidateEditFieldId[] = [
  'fullName',
  'phone',
  'email',
  'location',
  'currentCompany',
  'currentTitle',
  'experience',
  'currentSalary',
  'currentBenefits',
  'expectedSalary',
  'expectedBenefits',
  'noticePeriod',
  'educationSummary',
  'languageProficiency',
  'age',
  'gender',
  'maritalStatus',
  'nationality',
  'passportNumber',
  'remarks',
] as const;

const DEFAULT_ON_SET = new Set<string>(DEFAULT_ON_CANDIDATE_EDIT_FIELDS);

export const DEFAULT_CANDIDATE_EDIT_FIELD_VISIBILITY: CandidateEditFieldVisibility =
  Object.fromEntries(
    CANDIDATE_EDIT_FIELDS.map((key) => [key, DEFAULT_ON_SET.has(key)]),
  ) as CandidateEditFieldVisibility;

export type CandidateEditFieldGroup = {
  id: string;
  title: string;
  description?: string;
  fields: Array<{ id: CandidateEditFieldId; label: string; defaultOn?: boolean }>;
};

export const CANDIDATE_EDIT_FIELD_GROUPS: CandidateEditFieldGroup[] = [
  {
    id: 'core',
    title: 'Default candidate fields',
    description: 'Shown for every candidate unless you turn them off.',
    fields: [
      { id: 'fullName', label: 'Name', defaultOn: true },
      { id: 'phone', label: 'Phone number', defaultOn: true },
      { id: 'email', label: 'E-mail', defaultOn: true },
      { id: 'location', label: 'Current Location', defaultOn: true },
      { id: 'currentCompany', label: 'Current Organization', defaultOn: true },
      { id: 'currentTitle', label: 'Designation', defaultOn: true },
      { id: 'experience', label: 'Total Years of experience', defaultOn: true },
      { id: 'currentSalary', label: 'Current Salary', defaultOn: true },
      { id: 'currentBenefits', label: 'Current Benefits', defaultOn: true },
      { id: 'expectedSalary', label: 'Expected Salary', defaultOn: true },
      { id: 'expectedBenefits', label: 'Expected Benefits', defaultOn: true },
      { id: 'noticePeriod', label: 'Notice Period', defaultOn: true },
      { id: 'educationSummary', label: 'Qualification', defaultOn: true },
      { id: 'languageProficiency', label: 'Language known', defaultOn: true },
      { id: 'age', label: 'Age', defaultOn: true },
      { id: 'gender', label: 'Gender', defaultOn: true },
      { id: 'maritalStatus', label: 'Marital Status', defaultOn: true },
      { id: 'nationality', label: 'Nationality', defaultOn: true },
      { id: 'passportNumber', label: 'Passport number', defaultOn: true },
      { id: 'remarks', label: 'Reason for Current Job Change', defaultOn: true },
    ],
  },
  {
    id: 'personalExtra',
    title: 'Extra personal fields',
    description: 'Enable to show on Edit Candidate and Overview tabs.',
    fields: [
      { id: 'avatar', label: 'Candidate photo' },
      { id: 'candidateScore', label: 'Candidate Score' },
      { id: 'city', label: 'City' },
      { id: 'state', label: 'State' },
      { id: 'country', label: 'Country' },
      { id: 'address', label: 'Current Address' },
      { id: 'zip', label: 'Zip' },
      { id: 'currentCompanyWebsite', label: 'Current Company Website' },
      { id: 'birthDate', label: 'Birth Date' },
      { id: 'preferredLocation', label: 'Preferred Location' },
    ],
  },
  {
    id: 'educationExtra',
    title: 'Extra education fields',
    fields: [
      { id: 'cvEducationEntries', label: 'Education entries' },
      { id: 'educationCourses', label: 'Courses' },
    ],
  },
  {
    id: 'careerExtra',
    title: 'Extra career / package fields',
    fields: [
      { id: 'currentSalaryCurrency', label: 'Current Salary Currency' },
      { id: 'expectedSalaryCurrency', label: 'Expected Salary Currency' },
      { id: 'careerCurrentSalaryType', label: 'Current salary type' },
      { id: 'careerCurrentCurrency', label: 'Current currency picker' },
      { id: 'careerPreferredRoles', label: 'Preferred roles' },
      { id: 'careerPreferredCurrency', label: 'Preferred currency' },
      { id: 'careerPreferredSalaryType', label: 'Preferred salary type' },
      { id: 'careerPreferredLocations', label: 'Preferred locations' },
      { id: 'careerWorkModes', label: 'Preferred work modes' },
      { id: 'careerPreferredIndustries', label: 'Preferred industries' },
      { id: 'careerFunctionalAreas', label: 'Functional areas' },
      { id: 'careerJobTypes', label: 'Job types' },
      { id: 'careerRelocation', label: 'Relocation preference' },
      { id: 'careerEarliestStart', label: 'Earliest start date' },
      { id: 'careerDescribeAvailability', label: 'Describe availability' },
      { id: 'workHistoryText', label: 'Work history (narrative)' },
      { id: 'extracurricular', label: 'Extracurricular activities' },
      { id: 'volunteers', label: 'Volunteers' },
    ],
  },
  {
    id: 'workExtra',
    title: 'Work experience entries',
    fields: [{ id: 'cvWorkExperienceEntries', label: 'Work experience entries' }],
  },
  {
    id: 'socialExtra',
    title: 'Social & links',
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
    id: 'summaryExtra',
    title: 'Summary & additional',
    fields: [
      { id: 'cvSummary', label: 'Summary' },
      { id: 'skills', label: 'Skills' },
      { id: 'honours', label: 'Honours & awards' },
      { id: 'certifications', label: 'Certifications' },
      { id: 'projects', label: 'Projects' },
      { id: 'hackathons', label: 'Hackathons' },
      { id: 'notes', label: 'Internal notes' },
    ],
  },
  {
    id: 'hiringExtra',
    title: 'Extra hiring fields',
    description:
      'Stage, status, assigned job, and recruiter stay available for pipeline work. These are optional extras.',
    fields: [
      { id: 'hiringSource', label: 'Source' },
      { id: 'hiringAvailability', label: 'Availability' },
      { id: 'hiringSalaryCurrency', label: 'Salary currency (default)' },
      { id: 'employment', label: 'Employment status' },
    ],
  },
  {
    id: 'phase1Extra',
    title: 'Phase 1 profile sections',
    description:
      'Applies to Phase 1 candidates on Overview and Edit. Off by default — enable only what your team needs.',
    fields: [
      { id: 'p1Resume', label: 'Resume / CV section' },
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

/** Which Edit Candidate field toggles control each Phase 1 overview/edit section. */
export const PHASE1_SECTION_FIELD_MAP: Record<string, readonly CandidateEditFieldId[]> = {
  personal: [
    'fullName',
    'phone',
    'email',
    'location',
    'age',
    'gender',
    'maritalStatus',
    'nationality',
    'passportNumber',
    'address',
    'city',
    'country',
    'birthDate',
    'linkedIn',
    'employment',
    'avatar',
  ],
  resume: ['p1Resume'],
  summary: ['cvSummary'],
  work: ['cvWorkExperienceEntries'],
  internships: ['p1Internships'],
  gap: ['p1Gap'],
  education: ['educationSummary', 'cvEducationEntries'],
  academic: ['p1Academic'],
  exams: ['p1Exams'],
  skills: ['skills'],
  languages: ['languageProficiency'],
  projects: ['projects'],
  portfolio: ['portfolio', 'cvPortfolioLinks'],
  certifications: ['certifications'],
  accomplishments: ['p1Accomplishments'],
  careerPreferences: [
    'currentTitle',
    'currentCompany',
    'currentSalary',
    'currentBenefits',
    'expectedSalary',
    'expectedBenefits',
    'noticePeriod',
    'location',
    'experience',
    'remarks',
    'currentSalaryCurrency',
    'expectedSalaryCurrency',
    'careerCurrentSalaryType',
    'careerCurrentCurrency',
    'careerPreferredRoles',
    'careerPreferredCurrency',
    'careerPreferredSalaryType',
    'careerPreferredLocations',
    'careerWorkModes',
    'careerPreferredIndustries',
    'careerFunctionalAreas',
    'careerJobTypes',
    'careerRelocation',
    'careerEarliestStart',
    'careerDescribeAvailability',
  ],
  visa: ['p1Visa'],
  vaccination: ['p1Vaccination'],
};

export function isPhase1CandidateSectionVisible(
  sectionId: string,
  visibility?: Partial<CandidateEditFieldVisibility> | null,
): boolean {
  const fields = PHASE1_SECTION_FIELD_MAP[String(sectionId || '').trim()];
  if (!fields || fields.length === 0) return false;
  return fields.some((fieldId) => isCandidateEditFieldVisible(visibility, fieldId));
}

/** Map Phase 1 basic-info row labels to field visibility ids. */
export function phase1PersonalRowFieldId(label: string): CandidateEditFieldId | null {
  const key = String(label || '')
    .trim()
    .toLowerCase();
  if (key === 'full name' || key === 'name') return 'fullName';
  if (key === 'email' || key === 'e-mail') return 'email';
  if (key === 'phone' || key === 'mobile no' || key === 'phone number') return 'phone';
  if (key === 'gender') return 'gender';
  if (key === 'date of birth' || key === 'birth date' || key === 'dob') return 'birthDate';
  if (key === 'city') return 'city';
  if (key === 'country') return 'country';
  if (key === 'nationality') return 'nationality';
  if (key === 'current address' || key === 'address') return 'address';
  if (key === 'city & country' || key === 'current location' || key === 'location') return 'location';
  if (key === 'passport number') return 'passportNumber';
  if (key === 'linkedin') return 'linkedIn';
  if (key === 'employment status' || key === 'employment') return 'employment';
  if (key === 'age') return 'age';
  if (key === 'marital status') return 'maritalStatus';
  return null;
}

const STORAGE_KEY = 'orgCandidateEditFieldVisibility';

export function normalizeCandidateEditFieldVisibility(raw: unknown): CandidateEditFieldVisibility {
  const base = { ...DEFAULT_CANDIDATE_EDIT_FIELD_VISIBILITY };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  for (const key of CANDIDATE_EDIT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(o, key)) {
      base[key] = o[key] === true;
    }
  }
  return base;
}

export function isCandidateEditFieldVisible(
  visibility: Partial<CandidateEditFieldVisibility> | null | undefined,
  fieldId: CandidateEditFieldId | string,
): boolean {
  const key = String(fieldId || '').trim() as CandidateEditFieldId;
  if (!key || !(key in DEFAULT_CANDIDATE_EDIT_FIELD_VISIBILITY)) {
    // Unknown ids: do not hide (avoids breaking future fields).
    return true;
  }
  if (!visibility) {
    return DEFAULT_CANDIDATE_EDIT_FIELD_VISIBILITY[key];
  }
  if (Object.prototype.hasOwnProperty.call(visibility, key)) {
    return visibility[key] === true;
  }
  return DEFAULT_CANDIDATE_EDIT_FIELD_VISIBILITY[key];
}

export function getCachedCandidateEditFieldVisibility(): CandidateEditFieldVisibility {
  if (typeof window === 'undefined') return { ...DEFAULT_CANDIDATE_EDIT_FIELD_VISIBILITY };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CANDIDATE_EDIT_FIELD_VISIBILITY };
    return normalizeCandidateEditFieldVisibility(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CANDIDATE_EDIT_FIELD_VISIBILITY };
  }
}

export function cacheCandidateEditFieldVisibility(visibility: CandidateEditFieldVisibility): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeCandidateEditFieldVisibility(visibility)));
}
