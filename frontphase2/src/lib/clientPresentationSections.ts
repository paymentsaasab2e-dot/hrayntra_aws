import type { CandidateEditFormState } from '../components/candidates/CandidateEditAtsSections';
import { parseWorkEntriesFromUnknown } from './candidateExperience';

export type ClientPresentationSectionId =
  | 'personal'
  | 'education'
  | 'work'
  | 'professional'
  | 'social'
  | 'summary';

export const CLIENT_PRESENTATION_SECTION_IDS: ClientPresentationSectionId[] = [
  'personal',
  'education',
  'work',
  'professional',
  'social',
  'summary',
];

export const CLIENT_PRESENTATION_SECTION_LABELS: Record<ClientPresentationSectionId, string> = {
  personal: 'Personal Information',
  education: 'Education',
  work: 'Work Experience',
  professional: 'Career Preferences',
  social: 'Social Network Information',
  summary: 'Summary & Additional',
};

export type ClientReviewField = { label: string; value: string };
export type ClientReviewSection = {
  id: string;
  title: string;
  fields: ClientReviewField[];
  /** Structured rows (work, education, etc.) — rendered as entry cards on the client review page */
  entries?: Array<Record<string, unknown>>;
};

export type ClientSectionVisibility = Record<ClientPresentationSectionId, boolean>;

export const DEFAULT_CLIENT_SECTION_VISIBILITY: ClientSectionVisibility = {
  personal: true,
  education: true,
  work: true,
  professional: true,
  social: true,
  summary: true,
};

function str(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (Array.isArray(value)) {
    return value
      .map((item) => str(item))
      .filter((item) => item && item !== '[object Object]')
      .join(', ');
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => str(item))
      .filter(Boolean)
      .join(', ');
  }
  const text = String(value).trim();
  if (!text || text === '[object Object]' || text === '[]' || text === '{}' || text === 'null') {
    return '';
  }
  if (
    (text.startsWith('[') && text.endsWith(']')) ||
    (text.startsWith('{') && text.endsWith('}'))
  ) {
    try {
      return str(JSON.parse(text) as unknown);
    } catch {
      return text.replace(/^\[/, '').replace(/\]$/, '').trim();
    }
  }
  return text;
}

function reviewField(label: string, value: unknown): ClientReviewField {
  return { label, value: str(value) };
}

function isSectionVisible(
  id: ClientPresentationSectionId,
  visibility?: Partial<ClientSectionVisibility> | null,
): boolean {
  if (!visibility) return true;
  return visibility[id] !== false;
}

export function normalizeClientSectionVisibility(
  raw?: Partial<ClientSectionVisibility> | null,
): ClientSectionVisibility {
  const next = { ...DEFAULT_CLIENT_SECTION_VISIBILITY };
  if (!raw || typeof raw !== 'object') return next;
  for (const id of CLIENT_PRESENTATION_SECTION_IDS) {
    if (typeof raw[id] === 'boolean') next[id] = raw[id];
  }
  return next;
}

function pushVisibleSection(
  sections: ClientReviewSection[],
  id: ClientPresentationSectionId,
  pairs: Array<[string, unknown]>,
  options?: { entries?: Array<Record<string, unknown>> },
) {
  const entries = options?.entries?.length ? options.entries : undefined;
  sections.push({
    id,
    title: CLIENT_PRESENTATION_SECTION_LABELS[id],
    fields: entries
      ? pairs.map(([label, value]) => reviewField(label, value))
      : pairs.map(([label, value]) => reviewField(label, value)),
    entries,
  });
}

export function buildClientReviewSections(
  form: CandidateEditFormState,
  visibility?: Partial<ClientSectionVisibility> | null,
): ClientReviewSection[] {
  const visible = normalizeClientSectionVisibility(visibility);
  const sections: ClientReviewSection[] = [];

  if (isSectionVisible('personal', visible)) {
    const fullName = [form.firstName, form.middleName, form.lastName]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');
    pushVisibleSection(sections, 'personal', [
      ['Full Name', fullName],
      ['E-mail', form.email],
      ['Phone code', form.phoneCode],
      ['Mobile No', form.phone],
      ['Age', form.age],
      ['Candidate Score', form.candidateScore],
      ['City', form.city],
      ['State', form.state],
      ['Country', form.country],
      ['Current Address', form.address],
      ['Zip', form.zip],
      ['Candidate Image', form.avatar ? 'On file' : ''],
      ['Nationality', form.nationality],
      ['Gender', form.gender],
      ['Employment status', form.employment],
      ['Marital Status', form.maritalStatus],
      ['Birth Date', form.birthDate],
      ['Passport Number', form.passportNumber],
    ]);
  }

  if (isSectionVisible('education', visible)) {
    const eduEntries = parseWorkEntriesFromUnknown(form.cvEducationEntries);
    pushVisibleSection(
      sections,
      'education',
      eduEntries.length
        ? [
            ['Education summary', form.educationSummary || form.education],
            ['Courses', form.educationCourses],
            ['Extracurricular activities', form.extracurricular],
          ]
        : [
            ['Education entries', form.cvEducationEntries],
            ['Education summary', form.educationSummary || form.education],
            ['Courses', form.educationCourses],
            ['Extracurricular activities', form.extracurricular],
          ],
      eduEntries.length
        ? {
            entries: eduEntries.map((entry) => ({
              degreeProgram: entry.degree ?? entry.qualification,
              institutionName: entry.institution ?? entry.instituteName,
              startYear: entry.startYear,
              endYear: entry.endYear,
              grade: entry.grade,
            })),
          }
        : undefined,
    );
  }

  if (isSectionVisible('professional', visible)) {
    pushVisibleSection(sections, 'professional', [
      ['Experience (years)', form.experience],
      ['Current Designation', form.currentTitle || form.p1CurrentRole],
      ['Current Employer', form.currentCompany],
      ['Current Salary', form.currentSalary],
      ['Current Salary Currency', form.currentSalaryCurrency],
      ['Current Benefits', form.currentBenefits],
      ['Expected Salary', form.expectedSalary],
      ['Expected Salary Currency', form.expectedSalaryCurrency],
      ['Expected Benefits', form.expectedBenefits],
      ['Notice Period', form.noticePeriod],
      ['Preferred Location', form.p1PreferredLocations || form.preferredLocation],
      ['Preferred job titles', form.p1PreferredJobTitles],
      ['Preferred industries', form.p1PreferredIndustries],
      ['Functional areas', form.p1FunctionalAreas],
      ['Job types', form.p1JobTypes],
      ['Work modes', form.p1WorkModes],
      ['Relocation', form.p1Relocation],
      ['Availability to start', form.p1AvailabilityToStart],
    ]);
  }

  if (isSectionVisible('work', visible)) {
    const workEntries = parseWorkEntriesFromUnknown(form.cvWorkExperienceEntries);
    pushVisibleSection(
      sections,
      'work',
      [
        ['Current Company Website', form.currentCompanyWebsite],
        ['Volunteers', form.volunteers],
        ['Work history (narrative)', form.workHistoryText],
        ...(workEntries.length ? [] : [['Work experience entries', form.cvWorkExperienceEntries] as [string, unknown]]),
      ],
      workEntries.length ? { entries: workEntries } : undefined,
    );
  }

  if (isSectionVisible('social', visible)) {
    pushVisibleSection(sections, 'social', [
      ['LinkedIn', form.linkedIn],
      ['Twitter', form.twitter],
      ['Xing', form.xing],
      ['Skype ID', form.skypeId],
      ['Facebook', form.facebook],
      ['Stack Overflow', form.stackOverflow],
      ['Website', form.website],
      ['Portfolio / project links', form.cvPortfolioLinks || form.portfolio],
    ]);
  }

  if (isSectionVisible('summary', visible)) {
    pushVisibleSection(sections, 'summary', [
      ['Summary', form.cvSummary],
      ['Remarks', form.remarks],
      ['Skills', form.skills],
      ['Language & proficiency', form.languageProficiency || form.languages],
      ['Honours & awards', form.honours],
      ['Certifications', form.certifications],
      ['Projects', form.projects],
      ['Hackathons', form.hackathons],
      ['Internal notes', form.notes],
    ]);
  }

  return sections;
}
