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
  internships: 'Internships',
  accomplishments: 'Accomplishments',
  resume: 'Resume / CV',
  skills: 'Skills',
  languages: 'Languages',
  portfolio: 'Portfolio links',
  careerPreferences: 'Career preferences',
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
  'internships',
  'accomplishments',
  'resume',
  'skills',
  'languages',
  'portfolio',
  'careerPreferences',
];

const DEFAULT_VISIBILITY = Object.fromEntries(SECTION_IDS.map((id) => [id, true]));
const EMPTY_SECTION_FIELD = { label: 'Entries', value: 'No entries provided' };

function str(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value
      .map((item) => str(item))
      .filter((item) => item && item !== '[object Object]')
      .join(', ');
  }
  if (typeof value === 'object') {
    return Object.values(value)
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
      return str(JSON.parse(text));
    } catch {
      return text.replace(/^\[/, '').replace(/\]$/, '').trim();
    }
  }
  return text;
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
    const phone = [pi.phoneCode, pi.phone].map((v) => str(v)).filter(Boolean).join(' ');
    appendVisibleSection(
      sections,
      'personal',
      fieldsFromPairs([
        ['First name', pi.firstName],
        ['Middle name', pi.middleName],
        ['Last name', pi.lastName],
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

  if (isVisible('internships', visible)) {
    const entries = Array.isArray(snapshot.internships) ? snapshot.internships.map((row) => ({ ...row })) : [];
    appendVisibleSection(sections, 'internships', [], { entries });
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

  if (isVisible('accomplishments', visible)) {
    const entries = Array.isArray(snapshot.accomplishments)
      ? snapshot.accomplishments.map((row) => ({ ...row }))
      : [];
    appendVisibleSection(sections, 'accomplishments', [], { entries });
  }

  if (isVisible('resume', visible)) {
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

  if (isVisible('skills', visible)) {
    const skillLines = Array.isArray(snapshot.skills)
      ? snapshot.skills
          .map((row) => [row?.name, row?.proficiency, row?.category].filter(Boolean).join(' · '))
          .filter(Boolean)
      : [];
    appendVisibleSection(
      sections,
      'skills',
      skillLines.length
        ? skillLines.map((line, index) => ({ label: `Skill ${index + 1}`, value: line }))
        : [],
    );
  }

  if (isVisible('languages', visible)) {
    const langLines = Array.isArray(snapshot.languages)
      ? snapshot.languages
          .map((row) => [row?.name, row?.proficiency].filter(Boolean).join(' — '))
          .filter(Boolean)
      : [];
    appendVisibleSection(
      sections,
      'languages',
      langLines.length
        ? langLines.map((line, index) => ({ label: `Language ${index + 1}`, value: line }))
        : [],
    );
  }

  if (isVisible('portfolio', visible)) {
    const entries = Array.isArray(snapshot.portfolioLinks)
      ? snapshot.portfolioLinks.map((link) => ({ ...link }))
      : [];
    appendVisibleSection(sections, 'portfolio', [], { entries });
  }

  if (isVisible('careerPreferences', visible)) {
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
        ['Work modes', prefs.workModes || prefs.preferredWorkMode || prefs.passportNumbersByLocation?.__workModes],
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
