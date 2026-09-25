import type { ClientReviewField, ClientReviewSection } from './clientPresentationSections';
import {
  certificationRecordToSnapshotRow,
  normalizeCertificationRecord,
} from './candidateCertificationFields';
import {
  accomplishmentRecordToSnapshotRow,
  normalizeAccomplishmentRecord,
} from './candidateAccomplishmentFields';
import { extractVisaDisplayEntries } from './candidateVisaWorkAuthorizationFields';
import {
  hasVaccinationContent,
  normalizeVaccinationRecord,
  vaccinationRecordToSnapshotRow,
} from './candidateVaccinationFields';
import type { Phase1ProfileSnapshot } from './phase1ProfileSnapshot';

export type Phase1ClientSectionId =
  | 'personal'
  | 'resume'
  | 'summary'
  | 'work'
  | 'internships'
  | 'gap'
  | 'education'
  | 'academic'
  | 'exams'
  | 'skills'
  | 'languages'
  | 'projects'
  | 'portfolio'
  | 'certifications'
  | 'accomplishments'
  | 'careerPreferences'
  | 'visa'
  | 'vaccination';

/** Phase 1 sections the tenant create/edit form does not already collect. */
export const TENANT_FORM_MISSING_PHASE1_SECTIONS: Phase1ClientSectionId[] = [
  'internships',
  'work',
  'gap',
  'education',
  'academic',
  'exams',
  'skills',
  'projects',
  'certifications',
  'visa',
  'vaccination',
];

export const PHASE1_CLIENT_SECTION_IDS: Phase1ClientSectionId[] = [
  'personal',
  'resume',
  'summary',
  'work',
  'internships',
  'gap',
  'education',
  'academic',
  'exams',
  'skills',
  'languages',
  'projects',
  'portfolio',
  'certifications',
  'accomplishments',
  'careerPreferences',
  'visa',
  'vaccination',
];

export const PHASE1_CLIENT_SECTION_LABELS: Record<Phase1ClientSectionId, string> = {
  personal: 'Basic information',
  resume: 'Resume / CV',
  summary: 'Professional summary',
  work: 'Work experience',
  internships: 'Internships',
  gap: 'Gap explanation',
  education: 'Education',
  academic: 'Academic achievements',
  exams: 'Competitive exams',
  skills: 'Skills',
  languages: 'Languages',
  projects: 'Projects',
  portfolio: 'Portfolio links',
  certifications: 'Certifications',
  accomplishments: 'Accomplishments',
  careerPreferences: 'Career preferences',
  visa: 'Visa & work authorization',
  vaccination: 'Vaccination',
};

export type Phase1ClientSectionVisibility = Record<Phase1ClientSectionId, boolean>;

export const DEFAULT_PHASE1_CLIENT_SECTION_VISIBILITY: Phase1ClientSectionVisibility = {
  personal: true,
  resume: true,
  summary: true,
  work: true,
  internships: true,
  gap: true,
  education: true,
  academic: true,
  exams: true,
  skills: true,
  languages: true,
  projects: true,
  portfolio: true,
  certifications: true,
  accomplishments: true,
  careerPreferences: true,
  visa: true,
  vaccination: true,
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

function field(label: string, value: unknown): ClientReviewField | null {
  const v = str(value);
  if (!v) return null;
  return { label, value: v };
}

function fieldsFromPairs(pairs: Array<[string, unknown]>): ClientReviewField[] {
  return pairs.map(([label, value]) => field(label, value)).filter(Boolean) as ClientReviewField[];
}

function isSectionVisible(
  id: Phase1ClientSectionId,
  visibility?: Partial<Phase1ClientSectionVisibility> | null,
): boolean {
  if (!visibility) return true;
  return visibility[id] !== false;
}

export function normalizePhase1ClientSectionVisibility(
  raw?: Partial<Phase1ClientSectionVisibility> | null,
): Phase1ClientSectionVisibility {
  const next = { ...DEFAULT_PHASE1_CLIENT_SECTION_VISIBILITY };
  if (!raw || typeof raw !== 'object') return next;
  for (const id of PHASE1_CLIENT_SECTION_IDS) {
    if (typeof raw[id] === 'boolean') next[id] = raw[id];
  }
  return next;
}

const EMPTY_SECTION_FIELD: ClientReviewField = {
  label: 'Entries',
  value: 'No entries provided',
};

function appendVisibleSection(
  sections: ClientReviewSection[],
  id: Phase1ClientSectionId,
  fields: ClientReviewField[],
  options?: { entries?: Array<Record<string, unknown>> },
) {
  const entries = options?.entries?.length ? options.entries : undefined;
  sections.push({
    id,
    title: PHASE1_CLIENT_SECTION_LABELS[id],
    fields: fields.length > 0 ? fields : entries ? [] : [EMPTY_SECTION_FIELD],
    entries,
  });
}

function normalizeWorkEntry(entry: Record<string, unknown>): Record<string, unknown> {
  return {
    ...entry,
    title: entry.jobTitle ?? entry.title,
    jobTitle: entry.jobTitle ?? entry.title,
    company: entry.company ?? entry.companyName,
    companyName: entry.companyName ?? entry.company,
    location: entry.workLocation ?? entry.location,
    workLocation: entry.workLocation ?? entry.location,
  };
}

function normalizeEducationEntry(entry: Record<string, unknown>): Record<string, unknown> {
  return {
    ...entry,
    degreeProgram: entry.degreeProgram ?? entry.degree,
    degree: entry.degree ?? entry.degreeProgram,
    institutionName: entry.institutionName ?? entry.institution,
    institution: entry.institution ?? entry.institutionName,
    fieldOfStudy: entry.fieldOfStudy ?? entry.field,
    field: entry.field ?? entry.fieldOfStudy,
  };
}

/** Flat client-review sections from a Phase 1 snapshot (public review link + saved copy). */
export function buildPhase1ClientReviewSections(
  snapshot: Phase1ProfileSnapshot,
  visibility?: Partial<Phase1ClientSectionVisibility> | null,
): ClientReviewSection[] {
  const visible = normalizePhase1ClientSectionVisibility(visibility);
  const sections: ClientReviewSection[] = [];
  const pi = snapshot.personalInfo || {};

  if (isSectionVisible('personal', visible)) {
    const phone = [pi.phoneCode, pi.phone].map((v) => str(v)).filter(Boolean).join(' ');
    const fullName = [pi.firstName, pi.middleName, pi.lastName]
      .map((part) => str(part))
      .filter(Boolean)
      .join(' ');
    appendVisibleSection(
      sections,
      'personal',
      fieldsFromPairs([
        ['Full Name', fullName],
        ['Email', pi.email],
        ['Phone code', pi.phoneCode],
        ['Mobile', phone],
        ['Date of birth', pi.dob],
        ['Gender', pi.gender],
        ['Nationality', pi.nationality],
        ['Current address', pi.address],
        ['City', pi.city],
        ['Country', pi.country],
        ['Employment status', pi.employment],
        ['Passport number', pi.passportNumber],
        ['Age', pi.age],
        ['State', pi.state],
        ['Zip', pi.zip],
        ['Marital status', pi.maritalStatus],
      ]),
    );
  }

  if (isSectionVisible('resume', visible)) {
    const resume = snapshot.resume || {};
    appendVisibleSection(
      sections,
      'resume',
      fieldsFromPairs([
        ['File name', resume.fileName],
        ['ATS readiness', resume.atsScore != null ? `${resume.atsScore}%` : ''],
      ]),
    );
  }

  if (isSectionVisible('summary', visible)) {
    appendVisibleSection(
      sections,
      'summary',
      fieldsFromPairs([
        ['Summary', snapshot.summaryText],
        ['Remarks', pi.remarks],
      ]),
    );
  }

  if (isSectionVisible('internships', visible)) {
    const entries = Array.isArray(snapshot.internships)
      ? snapshot.internships.map((row) => ({ ...row }))
      : [];
    appendVisibleSection(sections, 'internships', [], { entries });
  }

  if (isSectionVisible('education', visible)) {
    const rawEducation = Array.isArray(snapshot.education) ? snapshot.education : [];
    const entries = rawEducation.map((entry) =>
      normalizeEducationEntry(entry as Record<string, unknown>),
    );
    const courseLines = [
      pi.educationCourses,
      ...rawEducation.map((entry) => (entry as Record<string, unknown>).additionalCourses),
    ];
    const activityLines = [
      pi.extracurricular,
      ...rawEducation.map((entry) => (entry as Record<string, unknown>).description),
    ];
    appendVisibleSection(
      sections,
      'education',
      fieldsFromPairs([
        ['Courses', courseLines],
        ['Extracurricular activities', activityLines],
      ]),
      { entries },
    );
  }

  if (isSectionVisible('work', visible)) {
    const rawWork = Array.isArray(snapshot.workExperience) ? snapshot.workExperience : [];
    const entries = rawWork.map((entry) => normalizeWorkEntry(entry as Record<string, unknown>));
    const volunteerLines = rawWork
      .filter((entry) => /volunteer/i.test(String((entry as Record<string, unknown>).employmentType || '')))
      .map((entry) => {
        const row = entry as Record<string, unknown>;
        return [row.jobTitle || row.title, row.company || row.companyName].filter(Boolean).join(' — ');
      });
    appendVisibleSection(
      sections,
      'work',
      fieldsFromPairs([
        [
          'Current Company Website',
          [
            pi.currentCompanyWebsite,
            ...rawWork.map((entry) => (entry as Record<string, unknown>).companyWebsite),
          ],
        ],
        ['Volunteers', [pi.volunteers, ...volunteerLines]],
        ['Work history (narrative)', pi.workHistoryText],
      ]),
      { entries },
    );
  }

  if (isSectionVisible('certifications', visible)) {
    const entries = Array.isArray(snapshot.certifications)
      ? snapshot.certifications.map((cert) =>
          certificationRecordToSnapshotRow(
            normalizeCertificationRecord(cert as Record<string, unknown>),
          ),
        )
      : [];
    appendVisibleSection(sections, 'certifications', [], { entries });
  }

  if (isSectionVisible('gap', visible)) {
    const entries = Array.isArray(snapshot.gapExplanations)
      ? snapshot.gapExplanations.map((gap) => ({ ...gap }))
      : [];
    appendVisibleSection(sections, 'gap', [], { entries });
  }

  if (isSectionVisible('academic', visible)) {
    const entries = Array.isArray(snapshot.academicAchievements)
      ? snapshot.academicAchievements.map((row) => ({ ...row }))
      : [];
    appendVisibleSection(sections, 'academic', [], { entries });
  }

  if (isSectionVisible('exams', visible)) {
    const entries = Array.isArray(snapshot.competitiveExams)
      ? snapshot.competitiveExams.map((exam) => ({ ...exam }))
      : [];
    appendVisibleSection(sections, 'exams', [], { entries });
  }

  if (isSectionVisible('projects', visible)) {
    const entries = Array.isArray(snapshot.projects)
      ? snapshot.projects.map((project) => ({ ...project }))
      : [];
    appendVisibleSection(
      sections,
      'projects',
      fieldsFromPairs([['Hackathons', pi.hackathons]]),
      { entries },
    );
  }

  if (isSectionVisible('skills', visible)) {
    const skillLines = Array.isArray(snapshot.skills)
      ? snapshot.skills
          .map((s) =>
            [s.name, s.proficiency, s.category].filter(Boolean).join(' · '),
          )
          .filter(Boolean)
      : [];
    appendVisibleSection(
      sections,
      'skills',
      skillLines.length
        ? skillLines.map((line, i) => ({ label: `Skill ${i + 1}`, value: line }))
        : [],
    );
  }

  if (isSectionVisible('languages', visible)) {
    const langLines = Array.isArray(snapshot.languages)
      ? snapshot.languages
          .map((l) => [l.name, l.proficiency].filter(Boolean).join(' — '))
          .filter(Boolean)
      : [];
    appendVisibleSection(
      sections,
      'languages',
      langLines.length
        ? langLines.map((line, i) => ({ label: `Language ${i + 1}`, value: line }))
        : [],
    );
  }

  if (isSectionVisible('portfolio', visible)) {
    const entries = Array.isArray(snapshot.portfolioLinks)
      ? snapshot.portfolioLinks.map((link) => ({ ...link }))
      : [];
    appendVisibleSection(
      sections,
      'portfolio',
      fieldsFromPairs([
        ['LinkedIn', pi.linkedinUrl],
        ['Twitter', pi.twitter],
        ['Xing', pi.xing],
        ['Skype ID', pi.skypeId],
        ['Facebook', pi.facebook],
        ['Stack Overflow', pi.stackOverflow],
        ['Website', pi.website],
      ]),
      { entries },
    );
  }

  if (isSectionVisible('accomplishments', visible)) {
    const entries = Array.isArray(snapshot.accomplishments)
      ? snapshot.accomplishments.map((row) =>
          accomplishmentRecordToSnapshotRow(
            normalizeAccomplishmentRecord(row as Record<string, unknown>),
          ),
        )
      : [];
    appendVisibleSection(sections, 'accomplishments', [], { entries });
  }

  if (isSectionVisible('careerPreferences', visible)) {
    const prefs = snapshot.careerPreferences || {};
    appendVisibleSection(
      sections,
      'careerPreferences',
      fieldsFromPairs([
        ['Current role', prefs.currentRole],
        ['Preferred job titles', prefs.preferredJobTitles || prefs.preferredRoles],
        ['Preferred industries', prefs.preferredIndustries || prefs.preferredIndustry],
        ['Functional areas', prefs.functionalAreas || prefs.functionalArea],
        ['Job types', prefs.jobTypes],
        ['Work modes', prefs.workModes || prefs.preferredWorkMode || (prefs.passportNumbersByLocation as { __workModes?: unknown } | undefined)?.__workModes],
        ['Preferred locations', prefs.preferredLocations],
        ['Relocation', prefs.relocationPreference],
        ['Notice period', prefs.noticePeriod],
        ['Availability to start', prefs.availabilityToStart],
        ['Current Salary', prefs.currentSalary],
        ['Current Salary Currency', prefs.currentCurrency],
        ['Current Benefits', prefs.currentBenefits],
        ['Expected Salary', prefs.preferredSalary || prefs.salaryAmount],
        ['Expected Salary Currency', prefs.preferredCurrency || prefs.salaryCurrency],
        ['Expected Benefits', prefs.preferredBenefits],
      ]),
    );
  }

  if (isSectionVisible('visa', visible)) {
    const entries = extractVisaDisplayEntries(
      (snapshot.visaWorkAuthorization as Record<string, unknown>) || null,
    );
    appendVisibleSection(sections, 'visa', [], { entries });
  }

  if (isSectionVisible('vaccination', visible)) {
    const record = normalizeVaccinationRecord(
      (snapshot.vaccination as Record<string, unknown>) || null,
    );
    const entries = hasVaccinationContent(record)
      ? [vaccinationRecordToSnapshotRow(record)]
      : [];
    appendVisibleSection(sections, 'vaccination', [], { entries });
  }

  return sections;
}
