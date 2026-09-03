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
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value).trim();
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
    pushVisibleSection(sections, 'personal', [
      ['Name', [form.firstName, form.lastName].filter(Boolean).join(' ')],
      ['First Name', form.firstName],
      ['Last Name', form.lastName],
      ['E-mail', form.email],
      ['Mobile No', form.phone],
      ['Age', form.age],
      ['Candidate Score', form.candidateScore],
      ['City & State', [form.city, form.state].filter(Boolean).join(', ')],
      ['City', form.city],
      ['State', form.state],
      ['Country', form.country],
      ['Location (display)', form.location],
      ['Current Address', form.address],
      ['Zip', form.zip],
      ['Candidate Image', form.avatar ? 'On file' : ''],
      ['Nationality', form.nationality],
      ['Current Company Website', form.currentCompanyWebsite],
      ['Marital Status', form.maritalStatus],
      ['Birth Date', form.birthDate],
      ['Passport Number', form.passportNumber],
      ['Preferred Location', form.preferredLocation],
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
          ]
        : [
            ['Education entries', form.cvEducationEntries],
            ['Education summary', form.educationSummary || form.education],
            ['Courses', form.educationCourses],
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
      ['Remarks', form.remarks],
      ['Experience (years)', form.experience],
      ['Current Designation', form.currentTitle],
      ['Current Employer', form.currentCompany],
      ['Current Salary', form.currentSalary],
      ['Current Salary Currency', form.currentSalaryCurrency],
      ['Current Benefits', form.currentBenefits],
      ['Expected Salary', form.expectedSalary],
      ['Expected Salary Currency', form.expectedSalaryCurrency],
      ['Expected Benefits', form.expectedBenefits],
      ['Notice Period', form.noticePeriod],
      ['Work history (narrative)', form.workHistoryText],
      ['Extracurricular activities', form.extracurricular],
      ['Volunteers', form.volunteers],
    ]);
  }

  if (isSectionVisible('work', visible)) {
    const workEntries = parseWorkEntriesFromUnknown(form.cvWorkExperienceEntries);
    pushVisibleSection(
      sections,
      'work',
      workEntries.length ? [] : [['Work experience', form.cvWorkExperienceEntries]],
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
      ['Portfolio URL', form.portfolio],
      ['Portfolio / project links', form.cvPortfolioLinks],
    ]);
  }

  if (isSectionVisible('summary', visible)) {
    pushVisibleSection(sections, 'summary', [
      ['Summary', form.cvSummary],
      ['Skills', form.skills],
      ['Language & proficiency', form.languageProficiency || form.languages],
      ['Honours & awards', form.honours],
      ['Certifications', form.certifications],
      ['Projects (extra)', form.projects],
      ['Hackathons (extra)', form.hackathons],
      ['Internal notes', form.notes],
    ]);
  }

  return sections;
}
