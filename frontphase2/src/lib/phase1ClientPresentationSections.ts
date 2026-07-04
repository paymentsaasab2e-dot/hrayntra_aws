import type { ClientReviewField, ClientReviewSection } from './clientPresentationSections';
import { joinCandidateNameParts } from './mapCandidateProfile';
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
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join(', ');
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
    fields: entries ? [] : fields.length > 0 ? fields : [EMPTY_SECTION_FIELD],
    entries,
  });
}

function normalizeWorkEntry(entry: Record<string, unknown>): Record<string, unknown> {
  return {
    title: entry.jobTitle ?? entry.title,
    company: entry.company ?? entry.companyName,
    location: entry.workLocation ?? entry.location,
    startDate: entry.startDate,
    endDate: entry.endDate,
    responsibilities: entry.responsibilities,
    description: entry.description,
  };
}

function normalizeEducationEntry(entry: Record<string, unknown>): Record<string, unknown> {
  return {
    degreeProgram: entry.degreeProgram ?? entry.degree,
    institutionName: entry.institutionName ?? entry.institution,
    educationLevel: entry.educationLevel,
    fieldOfStudy: entry.fieldOfStudy ?? entry.field,
    startYear: entry.startYear,
    endYear: entry.endYear,
    grade: entry.grade,
    currentlyStudying: entry.currentlyStudying,
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
    const fullName = joinCandidateNameParts(pi.firstName, pi.middleName, pi.lastName);
    const phone = [pi.phoneCode, pi.phone].map((v) => str(v)).filter(Boolean).join(' ');
    appendVisibleSection(
      sections,
      'personal',
      fieldsFromPairs([
        ['First name', pi.firstName],
        ['Middle name', pi.middleName],
        ['Last name', pi.lastName],
        ['Full name', fullName],
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
        ['LinkedIn', pi.linkedinUrl],
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
        ['File URL', resume.fileUrl],
        ['ATS readiness', resume.atsScore != null ? `${resume.atsScore}%` : ''],
      ]),
    );
  }

  if (isSectionVisible('summary', visible)) {
    appendVisibleSection(sections, 'summary', fieldsFromPairs([['Summary', snapshot.summaryText]]));
  }

  if (isSectionVisible('internships', visible)) {
    const entries = Array.isArray(snapshot.internships)
      ? snapshot.internships.map((row) => ({ ...row }))
      : [];
    appendVisibleSection(sections, 'internships', [], { entries });
  }

  if (isSectionVisible('education', visible)) {
    const entries = Array.isArray(snapshot.education)
      ? snapshot.education.map((entry) => normalizeEducationEntry(entry as Record<string, unknown>))
      : [];
    appendVisibleSection(sections, 'education', [], { entries });
  }

  if (isSectionVisible('work', visible)) {
    const entries = Array.isArray(snapshot.workExperience)
      ? snapshot.workExperience.map((entry) => normalizeWorkEntry(entry as Record<string, unknown>))
      : [];
    appendVisibleSection(sections, 'work', [], { entries });
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
    appendVisibleSection(sections, 'projects', [], { entries });
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
    appendVisibleSection(sections, 'portfolio', [], { entries });
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
        ['Work modes', prefs.workModes || prefs.preferredWorkMode],
        ['Preferred locations', prefs.preferredLocations],
        ['Relocation', prefs.relocationPreference],
        ['Notice period', prefs.noticePeriod],
        ['Availability to start', prefs.availabilityToStart],
        ['Salary expectation', prefs.preferredSalary || prefs.salaryAmount],
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
