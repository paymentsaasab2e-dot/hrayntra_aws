import type { CandidateEditFormState } from '../components/candidates/CandidateEditAtsSections';

export type ClientPresentationSectionId =
  | 'personal'
  | 'education'
  | 'professional'
  | 'social'
  | 'summary';

export const CLIENT_PRESENTATION_SECTION_IDS: ClientPresentationSectionId[] = [
  'personal',
  'education',
  'professional',
  'social',
  'summary',
];

export const CLIENT_PRESENTATION_SECTION_LABELS: Record<ClientPresentationSectionId, string> = {
  personal: 'Personal Information',
  education: 'Education',
  professional: 'Professional Information',
  social: 'Social Network Information',
  summary: 'Summary & Additional',
};

export type ClientReviewField = { label: string; value: string };
export type ClientReviewSection = {
  id: ClientPresentationSectionId;
  title: string;
  fields: ClientReviewField[];
};

export type ClientSectionVisibility = Record<ClientPresentationSectionId, boolean>;

export const DEFAULT_CLIENT_SECTION_VISIBILITY: ClientSectionVisibility = {
  personal: true,
  education: true,
  professional: true,
  social: true,
  summary: true,
};

function str(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function field(label: string, value: unknown): ClientReviewField | null {
  const v = str(value);
  if (!v) return null;
  return { label, value: v };
}

function fieldsFromPairs(pairs: Array<[string, unknown]>): ClientReviewField[] {
  return pairs.map(([label, value]) => field(label, value)).filter(Boolean) as ClientReviewField[];
}

function isSectionVisible(
  id: ClientPresentationSectionId,
  visibility?: Partial<ClientSectionVisibility> | null
): boolean {
  if (!visibility) return true;
  return visibility[id] !== false;
}

export function normalizeClientSectionVisibility(
  raw?: Partial<ClientSectionVisibility> | null
): ClientSectionVisibility {
  const next = { ...DEFAULT_CLIENT_SECTION_VISIBILITY };
  if (!raw || typeof raw !== 'object') return next;
  for (const id of CLIENT_PRESENTATION_SECTION_IDS) {
    if (typeof raw[id] === 'boolean') next[id] = raw[id];
  }
  return next;
}

export function buildClientReviewSections(
  form: CandidateEditFormState,
  visibility?: Partial<ClientSectionVisibility> | null
): ClientReviewSection[] {
  const visible = normalizeClientSectionVisibility(visibility);
  const sections: ClientReviewSection[] = [];

  if (isSectionVisible('personal', visible)) {
    const fields = fieldsFromPairs([
      ['First Name', form.firstName],
      ['Last Name', form.lastName],
      ['E-mail', form.email],
      ['Mobile No', form.phone],
      ['Age', form.age],
      ['Candidate Score', form.candidateScore],
      ['City', form.city],
      ['State', form.state],
      ['Country', form.country],
      ['Location (display)', form.location],
      ['Current Address', form.address],
      ['Zip', form.zip],
      ['Nationality', form.nationality],
      ['Current Company Website', form.currentCompanyWebsite],
      ['Marital Status', form.maritalStatus],
      ['Birth Date', form.birthDate],
      ['Passport Number', form.passportNumber],
      ['Preferred Location', form.preferredLocation],
    ]);
    if (fields.length) {
      sections.push({ id: 'personal', title: CLIENT_PRESENTATION_SECTION_LABELS.personal, fields });
    }
  }

  if (isSectionVisible('education', visible)) {
    const fields = fieldsFromPairs([
      ['Education entries', form.cvEducationEntries],
      ['Education summary', form.educationSummary || form.education],
      ['Courses', form.educationCourses],
    ]);
    if (fields.length) {
      sections.push({ id: 'education', title: CLIENT_PRESENTATION_SECTION_LABELS.education, fields });
    }
  }

  if (isSectionVisible('professional', visible)) {
    const fields = fieldsFromPairs([
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
      ['Resume URL', form.resumeUrl],
      ['Work experience', form.cvWorkExperienceEntries],
      ['Work history (narrative)', form.workHistoryText],
      ['Extracurricular activities', form.extracurricular],
      ['Volunteers', form.volunteers],
    ]);
    if (fields.length) {
      sections.push({
        id: 'professional',
        title: CLIENT_PRESENTATION_SECTION_LABELS.professional,
        fields,
      });
    }
  }

  if (isSectionVisible('social', visible)) {
    const fields = fieldsFromPairs([
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
    if (fields.length) {
      sections.push({ id: 'social', title: CLIENT_PRESENTATION_SECTION_LABELS.social, fields });
    }
  }

  if (isSectionVisible('summary', visible)) {
    const fields = fieldsFromPairs([
      ['Summary', form.cvSummary],
      ['Skills', form.skills],
      ['Language & proficiency', form.languageProficiency || form.languages],
      ['Honours & awards', form.honours],
      ['Certifications', form.certifications],
      ['Projects (extra)', form.projects],
      ['Hackathons (extra)', form.hackathons],
      ['Internal notes', form.notes],
    ]);
    if (fields.length) {
      sections.push({ id: 'summary', title: CLIENT_PRESENTATION_SECTION_LABELS.summary, fields });
    }
  }

  return sections;
}
