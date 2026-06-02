/**
 * Phase 1 client-review sections (mirrors frontphase2 phase1ClientPresentationSections.ts).
 */

const SECTION_LABELS = {
  personal: 'Person information',
  summary: 'Professional summary',
  education: 'Education',
  work: 'Work experience',
  certifications: 'Certifications',
  gap: 'Gap explanation',
  academic: 'Academic achievements',
  exams: 'Competitive exams',
  projects: 'Projects',
  visa: 'Visa & work authorization',
  vaccination: 'Vaccination',
};

const SECTION_IDS = [
  'personal',
  'summary',
  'education',
  'work',
  'certifications',
  'gap',
  'academic',
  'exams',
  'projects',
  'visa',
  'vaccination',
];

const DEFAULT_VISIBILITY = Object.fromEntries(SECTION_IDS.map((id) => [id, true]));
const EMPTY_SECTION_FIELD = { label: 'Entries', value: 'No entries provided' };

function str(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join(', ');
  return String(value).trim();
}

function field(label, value) {
  const v = str(value);
  if (!v) return null;
  return { label, value: v };
}

function fieldsFromPairs(pairs) {
  return pairs.map(([label, value]) => field(label, value)).filter(Boolean);
}

function normalizeVisibility(raw) {
  const next = { ...DEFAULT_VISIBILITY };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return next;
  for (const id of SECTION_IDS) {
    if (typeof raw[id] === 'boolean') next[id] = raw[id];
  }
  return next;
}

function isVisible(id, visibility) {
  return visibility[id] !== false;
}

function appendVisibleSection(sections, id, fields, options = {}) {
  const entries = options.entries?.length ? options.entries : undefined;
  sections.push({
    id,
    title: SECTION_LABELS[id],
    fields: entries ? [] : fields.length > 0 ? fields : [EMPTY_SECTION_FIELD],
    entries,
  });
}

function normalizeWorkEntry(entry) {
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

function normalizeEducationEntry(entry) {
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

export function buildPhase1ClientReviewSections(snapshot, visibility) {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const visible = normalizeVisibility(visibility);
  const sections = [];
  const pi = snapshot.personalInfo || {};

  if (isVisible('personal', visible)) {
    const fullName = [pi.firstName, pi.middleName, pi.lastName].filter(Boolean).join(' ').trim();
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

  if (isVisible('summary', visible)) {
    appendVisibleSection(sections, 'summary', fieldsFromPairs([['Summary', snapshot.summaryText]]));
  }

  if (isVisible('education', visible)) {
    const entries = Array.isArray(snapshot.education)
      ? snapshot.education.map((entry) => normalizeEducationEntry(entry))
      : [];
    appendVisibleSection(sections, 'education', [], { entries });
  }

  if (isVisible('work', visible)) {
    const entries = Array.isArray(snapshot.workExperience)
      ? snapshot.workExperience.map((entry) => normalizeWorkEntry(entry))
      : [];
    appendVisibleSection(sections, 'work', [], { entries });
  }

  if (isVisible('certifications', visible)) {
    const entries = Array.isArray(snapshot.certifications) ? snapshot.certifications.map((c) => ({ ...c })) : [];
    appendVisibleSection(sections, 'certifications', [], { entries });
  }

  if (isVisible('gap', visible)) {
    const entries = Array.isArray(snapshot.gapExplanations) ? snapshot.gapExplanations.map((g) => ({ ...g })) : [];
    appendVisibleSection(sections, 'gap', [], { entries });
  }

  if (isVisible('academic', visible)) {
    const entries = Array.isArray(snapshot.academicAchievements)
      ? snapshot.academicAchievements.map((row) => ({ ...row }))
      : [];
    appendVisibleSection(sections, 'academic', [], { entries });
  }

  if (isVisible('exams', visible)) {
    const entries = Array.isArray(snapshot.competitiveExams)
      ? snapshot.competitiveExams.map((exam) => ({ ...exam }))
      : [];
    appendVisibleSection(sections, 'exams', [], { entries });
  }

  if (isVisible('projects', visible)) {
    const entries = Array.isArray(snapshot.projects) ? snapshot.projects.map((p) => ({ ...p })) : [];
    appendVisibleSection(sections, 'projects', [], { entries });
  }

  if (isVisible('visa', visible)) {
    const v = snapshot.visaWorkAuthorization || {};
    appendVisibleSection(
      sections,
      'visa',
      fieldsFromPairs([
        ['Destination', v.selectedDestination],
        ['Visa / work permit required', v.visaWorkpermitRequired],
        ['Open for all destinations', v.openForAll],
        ['Additional remarks', v.additionalRemarks],
      ]),
    );
  }

  if (isVisible('vaccination', visible)) {
    const v = snapshot.vaccination || {};
    appendVisibleSection(
      sections,
      'vaccination',
      fieldsFromPairs([
        ['Status', v.vaccinationStatus],
        ['Vaccine type', v.vaccineType],
        ['Last vaccination date', v.lastVaccinationDate],
        ['Validity', [v.validityMonth, v.validityYear].filter(Boolean).join('/')],
      ]),
    );
  }

  return sections;
}
