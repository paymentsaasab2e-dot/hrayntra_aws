/**
 * Client-review sections built from saved clientPresentation.editForm.
 */

import { buildPhase1ClientReviewSections } from './phase1ClientReviewSections.js';
import { formatReviewText } from './clientPresentationDraft.js';

const SECTION_LABELS = {
  personal: 'Personal Information',
  education: 'Education',
  work: 'Work Experience',
  professional: 'Career Preferences',
  social: 'Social Network Information',
  summary: 'Summary & Additional',
};

const SECTION_IDS = ['personal', 'education', 'work', 'professional', 'social', 'summary'];

const DEFAULT_VISIBILITY = {
  personal: true,
  education: true,
  work: true,
  professional: true,
  social: true,
  summary: true,
};

function str(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const title = item.title || item.jobTitle || item.degree || item.degreeProgram || item.name || '';
          const extra = item.company || item.companyName || item.institution || item.institutionName || '';
          const joined = [title, extra].map((part) => String(part || '').trim()).filter(Boolean).join(' @ ');
          if (joined) return joined;
        }
        return formatReviewText(item);
      })
      .filter(Boolean)
      .join(', ');
  }
  return formatReviewText(value);
}

function reviewField(label, value) {
  return { label, value: str(value) };
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

function pushVisibleSection(sections, id, pairs, options = {}) {
  const entries = options.entries?.length ? options.entries : undefined;
  sections.push({
    id,
    title: SECTION_LABELS[id],
    fields: entries
      ? pairs.map(([label, value]) => reviewField(label, value))
      : pairs.map(([label, value]) => reviewField(label, value)),
    entries,
  });
}

const WORK_DISPLAY_HEADLINE_RE = /^\[(\d+)\]\s*(.+?)\s*@\s*(.+?)(?:\s*\(([^)]+)\))?\s*$/;
const WORK_DATE_RANGE_RE = /^(.+?)\s*[–—-]\s*(Present|.+)$/i;

function parseWorkResponsibilityLines(bodyLines) {
  if (!bodyLines.length) return [];
  if (bodyLines.length === 1 && bodyLines[0].includes(';')) {
    return bodyLines[0]
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return bodyLines.map((line) => line.trim()).filter(Boolean);
}

function looksLikeWorkExperienceDisplayText(value) {
  return /^\[\d+\]\s*.+@\s*.+/m.test(String(value || '').trim());
}

function parseWorkExperienceDisplayText(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || !looksLikeWorkExperienceDisplayText(trimmed)) return [];

  return trimmed
    .split(/(?=^\[\d+\]\s)/m)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim());
      const headlineMatch = (lines[0] || '').match(WORK_DISPLAY_HEADLINE_RE);
      if (!headlineMatch) return null;

      const title = headlineMatch[2].trim();
      const company = headlineMatch[3].trim();
      const location = (headlineMatch[4] || '').trim();
      let startDate = '';
      let endDate = '';
      const responsibilities = [];

      let index = 1;
      while (index < lines.length && !lines[index]) index += 1;

      if (index < lines.length && WORK_DATE_RANGE_RE.test(lines[index])) {
        const dateMatch = lines[index].match(WORK_DATE_RANGE_RE);
        if (dateMatch) {
          startDate = dateMatch[1].trim();
          endDate = dateMatch[2].trim();
        }
        index += 1;
      }

      while (index < lines.length) {
        while (index < lines.length && !lines[index]) index += 1;
        if (index >= lines.length) break;
        if (/^\[\d+\]\s/.test(lines[index])) break;
        responsibilities.push(lines[index]);
        index += 1;
      }

      return { title, company, location, startDate, endDate, responsibilities };
    })
    .filter((entry) => entry && (str(entry.title) || str(entry.company)));
}

function parseWorkExperienceEditorValue(value) {
  return String(value || '')
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const headerLine = lines[0] || '';
      const bodyLines = lines.slice(1);
      const [title = '', company = '', location = '', startDate = '', endDate = ''] = headerLine
        .split('|')
        .map((part) => part.trim());
      const responsibilities = parseWorkResponsibilityLines(bodyLines);
      return { title, company, location, startDate, endDate, responsibilities };
    })
    .filter((entry) => str(entry.title) || str(entry.company));
}

function looksLikeWorkExperienceEditorText(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || looksLikeWorkExperienceDisplayText(trimmed)) return false;
  return trimmed
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .some((block) => {
      const firstLine = (block.split(/\r?\n/)[0] || '').trim();
      return firstLine.includes('|') && firstLine.split('|').length >= 2;
    });
}

function normalizeWorkEntryRecord(entry) {
  const aliased = {
    ...entry,
    title: entry.title || entry.jobTitle || entry.role || entry.position,
    company: entry.company || entry.companyName || entry.employer,
    location: entry.location || entry.workLocation,
    startDate: entry.startDate || entry.from,
    endDate:
      entry.endDate ||
      (entry.currentlyWorkHere === true || entry.isCurrentJob === true ? 'Present' : entry.to),
    responsibilities:
      entry.responsibilities ||
      entry.keyResponsibilities ||
      (entry.description ? [entry.description] : undefined),
  };
  const responsibilities = aliased.responsibilities;
  if (Array.isArray(responsibilities) && responsibilities.length === 1) {
    const single = String(responsibilities[0] || '').trim();
    if (single && looksLikeWorkExperienceDisplayText(single)) {
      return parseWorkExperienceDisplayText(single)[0] || aliased;
    }
    if (single.includes('\n') && !single.includes(';')) {
      return {
        ...aliased,
        responsibilities: single
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      };
    }
  }
  const description = String(aliased.description || '').trim();
  if (description && looksLikeWorkExperienceDisplayText(description)) {
    return parseWorkExperienceDisplayText(description)[0] || aliased;
  }
  return aliased;
}

function normalizeWorkEntryRecords(entries) {
  if (!entries.length) return entries;
  if (entries.length === 1) {
    const only = entries[0];
    const blob = [
      str(only.title),
      str(only.description),
      Array.isArray(only.responsibilities)
        ? only.responsibilities.map((line) => str(line)).filter(Boolean).join('\n')
        : str(only.responsibilities),
    ]
      .filter(Boolean)
      .join('\n\n');
    if (looksLikeWorkExperienceDisplayText(blob)) {
      return parseWorkExperienceDisplayText(blob);
    }
  }
  return entries.map((entry) => normalizeWorkEntryRecord(entry));
}

function parseEducationEntriesFromUnknown(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === 'object')
      .map((entry) => ({
        degree: str(entry.degree || entry.degreeProgram || entry.qualification),
        institution: str(entry.institution || entry.institutionName || entry.instituteName),
        startYear: entry.startYear || entry.from || '',
        endYear: entry.endYear || entry.to || '',
        grade: entry.grade || '',
      }))
      .filter((entry) => entry.degree || entry.institution);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parseEducationEntriesFromUnknown(parsed);
      } catch {
        /* not JSON */
      }
    }
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|').map((part) => part.trim());
        return {
          degree: parts[0] || '',
          institution: parts[1] || '',
          startYear: parts[2] || '',
          endYear: parts[3] || '',
          grade: parts[4] || '',
        };
      })
      .filter((entry) => entry.degree || entry.institution);
  }
  return [];
}

function parseWorkEntriesFromUnknown(value) {
  if (Array.isArray(value)) {
    return normalizeWorkEntryRecords(value.filter((item) => item && typeof item === 'object'));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (looksLikeWorkExperienceDisplayText(trimmed)) {
      return parseWorkExperienceDisplayText(trimmed);
    }

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeWorkEntryRecords(parsed.filter((item) => item && typeof item === 'object'));
        }
      } catch {
        /* not JSON */
      }
    }

    if (looksLikeWorkExperienceEditorText(trimmed)) {
      return parseWorkExperienceEditorValue(trimmed);
    }
  }
  return [];
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = str(value);
    if (text) return value;
  }
  return '';
}

function joinUniqueDisplay(...values) {
  const parts = [];
  const seen = new Set();
  for (const value of values) {
    for (const part of str(value)
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)) {
      const key = part.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      parts.push(part);
    }
  }
  return parts.join(', ');
}

function buildSectionsFromEditForm(editForm, visibility) {
  if (!editForm || typeof editForm !== 'object' || Array.isArray(editForm)) return [];
  const visible = normalizeVisibility(visibility);
  const sections = [];

  if (isVisible('personal', visible)) {
    const fullName = [editForm.firstName, editForm.middleName, editForm.lastName]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');
    pushVisibleSection(sections, 'personal', [
      ['Full Name', fullName],
      ['E-mail', editForm.email],
      ['Phone code', editForm.phoneCode],
      ['Mobile No', editForm.phone],
      ['Age', editForm.age],
      ['Candidate Score', editForm.candidateScore],
      ['City', editForm.city],
      ['State', editForm.state],
      ['Country', editForm.country],
      ['Current Address', editForm.address],
      ['Zip', editForm.zip],
      ['Candidate Image', editForm.avatar ? 'On file' : ''],
      ['Nationality', editForm.nationality],
      ['Current Company Website', editForm.currentCompanyWebsite],
      ['Gender', editForm.gender],
      ['Employment status', editForm.employment],
      ['Marital Status', editForm.maritalStatus],
      ['Birth Date', editForm.birthDate],
      ['Passport Number', editForm.passportNumber],
      ['Preferred Location', joinUniqueDisplay(editForm.p1PreferredLocations, editForm.preferredLocation)],
    ]);
  }

  if (isVisible('education', visible)) {
    const eduEntries = parseEducationEntriesFromUnknown(editForm.cvEducationEntries);
    pushVisibleSection(
      sections,
      'education',
      eduEntries.length
        ? [
            ['Education summary', editForm.educationSummary || editForm.education],
            ['Courses', editForm.educationCourses],
          ]
        : [
            ['Education entries', editForm.cvEducationEntries],
            ['Education summary', editForm.educationSummary || editForm.education],
            ['Courses', editForm.educationCourses],
          ],
      eduEntries.length
        ? {
            entries: eduEntries.map((entry) => ({
              degreeProgram: entry.degree ?? entry.qualification ?? entry.degreeProgram,
              institutionName: entry.institution ?? entry.instituteName ?? entry.institutionName,
              startYear: entry.startYear,
              endYear: entry.endYear,
              grade: entry.grade,
            })),
          }
        : {},
    );
  }

  if (isVisible('professional', visible)) {
    pushVisibleSection(sections, 'professional', [
      ['Remarks', editForm.remarks],
      ['Experience (years)', editForm.experience],
      ['Current Designation', firstNonEmpty(editForm.currentTitle, editForm.p1CurrentRole)],
      ['Current Employer', editForm.currentCompany],
      ['Current Salary', editForm.currentSalary],
      ['Current Salary Currency', editForm.currentSalaryCurrency],
      ['Current Benefits', editForm.currentBenefits],
      ['Expected Salary', editForm.expectedSalary],
      ['Expected Salary Currency', editForm.expectedSalaryCurrency],
      ['Expected Benefits', editForm.expectedBenefits],
      ['Notice Period', editForm.noticePeriod],
      ['Preferred Location', joinUniqueDisplay(editForm.p1PreferredLocations, editForm.preferredLocation)],
      ['Current location', editForm.p1CurrentLocation],
      ['Current salary type', editForm.p1CurrentSalaryType],
      ['Preferred salary type', editForm.p1PreferredSalaryType],
      ['Work history (narrative)', editForm.workHistoryText],
      ['Extracurricular activities', editForm.extracurricular],
      ['Volunteers', editForm.volunteers],
      ['Preferred job titles', editForm.p1PreferredJobTitles],
      ['Preferred industries', editForm.p1PreferredIndustries],
      ['Functional areas', editForm.p1FunctionalAreas],
      ['Job types', editForm.p1JobTypes],
      ['Work modes', editForm.p1WorkModes],
      ['Relocation', editForm.p1Relocation],
      ['Availability to start', editForm.p1AvailabilityToStart],
    ]);
  }

  if (isVisible('work', visible)) {
    const workEntries = parseWorkEntriesFromUnknown(editForm.cvWorkExperienceEntries);
    pushVisibleSection(
      sections,
      'work',
      workEntries.length ? [] : [['Work experience entries', editForm.cvWorkExperienceEntries]],
      workEntries.length ? { entries: workEntries } : {},
    );
  }

  if (isVisible('social', visible)) {
    pushVisibleSection(sections, 'social', [
      ['LinkedIn', editForm.linkedIn],
      ['Twitter', editForm.twitter],
      ['Xing', editForm.xing],
      ['Skype ID', editForm.skypeId],
      ['Facebook', editForm.facebook],
      ['Stack Overflow', editForm.stackOverflow],
      ['Website', editForm.website],
      ['Portfolio / project links', joinUniqueDisplay(editForm.cvPortfolioLinks, editForm.portfolio)],
    ]);
  }

  if (isVisible('summary', visible)) {
    pushVisibleSection(sections, 'summary', [
      ['Summary', editForm.cvSummary],
      ['Skills', editForm.skills],
      ['Language & proficiency', editForm.languageProficiency || editForm.languages],
      ['Honours & awards', editForm.honours],
      ['Certifications', editForm.certifications],
      ['Projects', editForm.projects],
      ['Hackathons', editForm.hackathons],
      ['Internal notes', editForm.notes],
    ]);
  }

  return sections;
}

function isInternalResumeStorageUrl(value) {
  return /hryantra-bucket\.s3|amazonaws\.com\/uploads\/|\/uploads\/(phase\d+|tenants)\//i.test(
    String(value || ''),
  );
}

function shouldHideClientReviewField(label, value) {
  const key = String(label || '').trim().toLowerCase();
  if (key === 'resume url' || key === 'file url') return true;
  if (key.includes('url') && isInternalResumeStorageUrl(value)) return true;
  return false;
}

const SUBMIT_FIELD_LABEL_MAP = {
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

const SUBMIT_SECTION_ENTRY_FIELDS = {
  personal: ['fullName', 'email', 'phone'],
  education: ['cvEducationEntries'],
  professional: ['currentTitle', 'currentCompany', 'expectedSalary', 'noticePeriod'],
  work: ['cvWorkExperienceEntries'],
  social: ['linkedIn', 'website', 'cvPortfolioLinks'],
  summary: ['cvSummary', 'skills'],
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
  careerPreferences: ['currentTitle', 'noticePeriod', 'expectedSalary'],
  visa: ['p1Visa'],
  vaccination: ['p1Vaccination'],
};

const COMPOSITE_REVIEW_LABELS = new Set([
  'city & state',
  'salary expectation',
  'location (display)',
]);

const REVIEW_LABEL_CANONICAL = {
  'first name': 'Full Name',
  'middle name': 'Full Name',
  'last name': 'Full Name',
  'full name': 'Full Name',
  name: 'Full Name',
  'name of candidate': 'Full Name',
  email: 'E-mail',
  'e-mail': 'E-mail',
  mobile: 'Mobile No',
  'mobile no': 'Mobile No',
  'date of birth': 'Birth Date',
  'projects (extra)': 'Projects',
  'hackathons (extra)': 'Hackathons',
  'work experience': 'Work experience entries',
  'salary expectation': 'Expected Salary',
  'current role': 'Current Designation',
  'preferred locations': 'Preferred Location',
  'portfolio url': 'Portfolio / project links',
  languages: 'Language & proficiency',
};

const REVIEW_LABEL_DEDUP_ALIASES = {
  'projects (extra)': 'projects',
  'hackathons (extra)': 'hackathons',
  'work experience': 'work experience entries',
  email: 'e-mail',
  mobile: 'mobile no',
  'date of birth': 'birth date',
  'first name': 'full name',
  'middle name': 'full name',
  'last name': 'full name',
  name: 'full name',
  'name of candidate': 'full name',
  'current role': 'current designation',
  'preferred locations': 'preferred location',
  'portfolio url': 'portfolio / project links',
  'salary expectation': 'expected salary',
};

const SECTION_SORT_ORDER = [
  'personal',
  'education',
  'professional',
  'work',
  'social',
  'summary',
  'resume',
  'internships',
  'gap',
  'academic',
  'exams',
  'accomplishments',
  'visa',
  'vaccination',
  'certifications',
  'projects',
];

const FOLD_DUPLICATE_SECTIONS = {
  skills: { targetId: 'summary', targetLabel: 'Skills' },
  languages: { targetId: 'summary', targetLabel: 'Language & proficiency' },
  portfolio: { targetId: 'social', targetLabel: 'Portfolio / project links' },
};

function normalizeReviewLabelKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function canonicalReviewLabel(label) {
  const key = normalizeReviewLabelKey(label);
  return REVIEW_LABEL_CANONICAL[key] || String(label || '').trim();
}

function reviewFieldDedupeKey(label) {
  const key = normalizeReviewLabelKey(label);
  return REVIEW_LABEL_DEDUP_ALIASES[key] || key;
}

function cloneReviewSection(section) {
  return {
    ...section,
    fields: Array.isArray(section?.fields) ? section.fields.map((row) => ({ ...row })) : [],
    entries: Array.isArray(section?.entries) ? section.entries.map((entry) => ({ ...entry })) : undefined,
  };
}

function formatReviewEntriesAsText(entries) {
  if (!Array.isArray(entries) || !entries.length) return '';
  return entries
    .map((entry) => str(entry))
    .filter(Boolean)
    .join('\n');
}

function upsertReviewField(section, label, value) {
  const nextValue = str(value);
  if (!section || !nextValue) return;
  const key = reviewFieldDedupeKey(label);
  const existing = (section.fields || []).find((row) => reviewFieldDedupeKey(row.label) === key);
  if (existing) {
    if (!str(existing.value)) existing.value = nextValue;
    return;
  }
  section.fields.push({ label: canonicalReviewLabel(label), value: nextValue });
}

function dedupeReviewFields(fields) {
  const seen = new Set();
  const next = [];
  for (const row of fields || []) {
    const key = reviewFieldDedupeKey(row?.label);
    if (!key || COMPOSITE_REVIEW_LABELS.has(key) || seen.has(key)) continue;
    seen.add(key);
    next.push({
      label: canonicalReviewLabel(row.label),
      value: row.value,
    });
  }
  return next;
}

function dedupeReviewEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) return entries;
  const seen = new Set();
  return entries.filter((entry) => {
    let signature = '';
    try {
      signature = JSON.stringify(entry);
    } catch {
      signature = str(entry);
    }
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function foldDuplicateClientReviewSections(sections) {
  if (!Array.isArray(sections) || !sections.length) return [];
  const byId = new Map();
  for (const section of sections) {
    if (!section?.id) continue;
    byId.set(section.id, cloneReviewSection(section));
  }

  const personal = byId.get('personal');
  const social = byId.get('social');
  if (personal) {
    const linkedIn = (personal.fields || []).find(
      (row) => normalizeReviewLabelKey(row.label) === 'linkedin',
    );
    if (linkedIn?.value && social) upsertReviewField(social, 'LinkedIn', linkedIn.value);
    personal.fields = (personal.fields || []).filter((row) => {
      const key = normalizeReviewLabelKey(row.label);
      return key !== 'linkedin' && !COMPOSITE_REVIEW_LABELS.has(key);
    });
  }

  const prefs = byId.get('careerPreferences');
  const professional = byId.get('professional');
  if (prefs && professional) {
    for (const row of prefs.fields || []) {
      const key = normalizeReviewLabelKey(row.label);
      if (key === 'salary expectation') {
        upsertReviewField(professional, 'Expected Salary', row.value);
        continue;
      }
      if (key === 'current role') {
        upsertReviewField(professional, 'Current Designation', row.value);
        continue;
      }
      if (key === 'preferred locations') {
        if (personal) upsertReviewField(personal, 'Preferred Location', row.value);
        continue;
      }
      if (key === 'notice period') {
        upsertReviewField(professional, 'Notice Period', row.value);
        continue;
      }
      upsertReviewField(professional, canonicalReviewLabel(row.label), row.value);
    }
    byId.delete('careerPreferences');
  } else if (prefs && !professional) {
    prefs.id = 'professional';
    prefs.title = SECTION_LABELS.professional;
    byId.set('professional', prefs);
    byId.delete('careerPreferences');
  }

  for (const [fromId, spec] of Object.entries(FOLD_DUPLICATE_SECTIONS)) {
    const from = byId.get(fromId);
    if (!from) continue;
    const target = byId.get(spec.targetId);
    const fromText =
      (from.fields || [])
        .map((row) => str(row.value))
        .filter(Boolean)
        .join(', ') || formatReviewEntriesAsText(from.entries);
    if (target) upsertReviewField(target, spec.targetLabel, fromText);
    byId.delete(fromId);
  }

  for (const section of byId.values()) {
    section.fields = dedupeReviewFields(section.fields);
    if (section.entries?.length) {
      section.entries = dedupeReviewEntries(section.entries);
    }
  }

  const leftoverIds = [...byId.keys()].filter((id) => !SECTION_SORT_ORDER.includes(id));
  return [...SECTION_SORT_ORDER, ...leftoverIds]
    .filter((id, index, list) => byId.has(id) && list.indexOf(id) === index)
    .map((id) => byId.get(id));
}

function parseSubmitFieldVisibility(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const nested =
    raw.fieldVisibility && typeof raw.fieldVisibility === 'object' ? raw.fieldVisibility : raw;
  return nested;
}

function isSubmitFieldVisible(visibility, fieldId) {
  if (!visibility) return true;
  if (fieldId === 'fullName') {
    if (typeof visibility.fullName === 'boolean') return visibility.fullName !== false;
    return (
      visibility.firstName !== false ||
      visibility.middleName !== false ||
      visibility.lastName !== false
    );
  }
  return visibility[fieldId] !== false;
}

function isSubmitReviewLabelVisible(label, visibility, sectionId) {
  if (!visibility) return true;
  const key = String(label || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (COMPOSITE_REVIEW_LABELS.has(key)) return false;
  let ids = SUBMIT_FIELD_LABEL_MAP[key];
  if (!ids && /^skill\s+\d+$/.test(key)) ids = ['skills'];
  if (!ids && /^language\s+\d+$/.test(key)) ids = ['languageProficiency'];
  if (!ids && sectionId && SUBMIT_SECTION_ENTRY_FIELDS[sectionId]) {
    ids = SUBMIT_SECTION_ENTRY_FIELDS[sectionId];
  }
  // Unknown labels must not leak when the tenant configured Submit-to-Client visibility.
  if (!ids) return false;
  return ids.some((id) => isSubmitFieldVisible(visibility, id));
}

function applySubmitFieldVisibility(sections, visibility) {
  if (!visibility || !Array.isArray(sections)) return Array.isArray(sections) ? sections : [];
  return sections
    .map((section) => {
      const entryFields = SUBMIT_SECTION_ENTRY_FIELDS[section.id];
      const entriesAllowed =
        !entryFields || entryFields.some((id) => isSubmitFieldVisible(visibility, id));
      return {
        ...section,
        fields: Array.isArray(section?.fields)
          ? section.fields.filter((row) =>
              isSubmitReviewLabelVisible(row?.label, visibility, section.id),
            )
          : [],
        entries: entriesAllowed ? section.entries : undefined,
      };
    })
    .filter((section) => {
      const hasFields = Array.isArray(section.fields) && section.fields.length > 0;
      const hasEntries = Array.isArray(section.entries) && section.entries.length > 0;
      return hasFields || hasEntries;
    });
}

function stripHiddenClientReviewFields(sections, visibleFields) {
  if (!Array.isArray(sections)) return [];
  const cleaned = sections.map((section) => ({
    ...section,
    fields: Array.isArray(section?.fields)
      ? section.fields.filter((row) => !shouldHideClientReviewField(row?.label, row?.value))
      : [],
  }));
  return applySubmitFieldVisibility(cleaned, parseSubmitFieldVisibility(visibleFields));
}

/** Whether a Submit-to-Client field id is visible (missing map = all visible). */
export function isClientReviewFieldVisible(visibleFields, fieldId) {
  const visibility = parseSubmitFieldVisibility(visibleFields);
  if (!visibility) return true;
  return isSubmitFieldVisible(visibility, fieldId);
}

/** Whether a comparative/table label is allowed by tenant visibility. */
export function isClientReviewLabelVisible(visibleFields, label) {
  const visibility = parseSubmitFieldVisibility(visibleFields);
  if (!visibility) return true;
  return isSubmitReviewLabelVisible(label, visibility);
}

/**
 * Strip tenant-hidden fields from the public candidate payload so table /
 * comparative cannot leak hidden skills, education, etc.
 */
export function applyVisibleFieldsToClientCandidate(candidate, visibleFields) {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const visibility = parseSubmitFieldVisibility(visibleFields);
  if (!visibility) return candidate;

  const next = { ...candidate };
  const hide = (fieldId) => visibility[fieldId] === false;

  if (hide('email')) next.email = '';
  if (hide('phone')) next.phone = '';
  if (hide('city')) next.city = '';
  if (hide('state')) next.state = '';
  if (hide('country')) next.country = '';
  if (hide('preferredLocation')) next.preferredLocation = '';
  if (hide('address')) next.address = '';
  if (hide('currentCompany')) next.currentCompany = '';
  if (hide('currentTitle')) next.designation = '';
  if (hide('experience')) next.experience = null;
  if (hide('educationSummary') && hide('cvEducationEntries')) {
    next.education = '';
    next.cvEducationEntries = [];
  } else {
    if (hide('educationSummary')) next.education = '';
    if (hide('cvEducationEntries')) next.cvEducationEntries = [];
  }
  if (hide('cvWorkExperienceEntries')) next.cvWorkExperienceEntries = [];
  if (hide('skills')) next.skills = [];
  if (hide('languageProficiency')) next.languages = [];
  if (hide('cvSummary')) next.cvSummary = '';
  if (hide('certifications')) next.certifications = [];
  if (hide('linkedIn')) next.linkedIn = '';
  if (hide('birthDate')) next.birthDate = '';
  if (hide('age')) next.age = '';
  if (hide('zip')) next.zip = '';
  if (hide('nationality')) next.nationality = '';
  if (hide('gender')) next.gender = '';
  if (hide('employment')) next.employment = '';
  if (hide('maritalStatus')) next.maritalStatus = '';
  if (hide('phoneCode')) next.phoneCode = '';
  if (hide('middleName')) next.middleName = '';
  if (hide('noticePeriod')) next.noticePeriod = '';
  if (hide('currentSalary')) next.currentSalary = '';
  if (hide('expectedSalary')) next.expectedSalary = '';
  if (hide('website')) next.website = '';
  if (hide('fullName')) {
    next.name = '';
    next.firstName = '';
    next.middleName = '';
    next.lastName = '';
  }

  return next;
}

export function buildClientReviewSectionsFromPresentation(saved) {
  if (!saved) return [];
  const visibleFields = saved.visibleFields;

  const fromPhase1 =
    saved.phase1Snapshot && typeof saved.phase1Snapshot === 'object'
      ? stripHiddenClientReviewFields(
          buildPhase1ClientReviewSections(saved.phase1Snapshot, saved.phase1VisibleSections),
          visibleFields,
        )
      : [];
  const fromEditForm =
    saved.editForm && typeof saved.editForm === 'object'
      ? stripHiddenClientReviewFields(
          buildSectionsFromEditForm(saved.editForm, saved.visibleSections),
          visibleFields,
        )
      : [];
  const fromStoredSections =
    Array.isArray(saved.clientReviewSections) && saved.clientReviewSections.length > 0
      ? stripHiddenClientReviewFields(saved.clientReviewSections, visibleFields)
      : [];

  const scoreSection = (section) => {
    if (!section) return 0;
    let score = 0;
    for (const field of section.fields || []) {
      const value = String(field?.value || '').trim();
      if (!value || value === 'No entries provided') continue;
      score += 1;
    }
    if (Array.isArray(section.entries) && section.entries.length) {
      score += section.entries.length * 2;
      for (const entry of section.entries) {
        if (!entry || typeof entry !== 'object') continue;
        for (const value of Object.values(entry)) {
          if (Array.isArray(value)) {
            if (value.some((item) => String(item || '').trim())) score += 1;
          } else if (value && typeof value === 'object') {
            if (Object.keys(value).length) score += 1;
          } else if (String(value ?? '').trim()) {
            score += 1;
          }
        }
      }
    }
    return score;
  };

  /** Prefer the richest copy of each section id across editForm / phase1 / stored. */
  const byId = new Map();
  const order = [];
  const ingest = (sections) => {
    if (!Array.isArray(sections)) return;
    for (const section of sections) {
      if (!section?.id) continue;
      const prev = byId.get(section.id);
      if (!prev) {
        byId.set(section.id, section);
        order.push(section.id);
        continue;
      }
      const prevScore = scoreSection(prev);
      const nextScore = scoreSection(section);
      if (nextScore > prevScore) {
        byId.set(section.id, section);
      } else if (nextScore === prevScore) {
        // Prefer more structured entries / more field rows when tied.
        const prevEntries = Array.isArray(prev.entries) ? prev.entries.length : 0;
        const nextEntries = Array.isArray(section.entries) ? section.entries.length : 0;
        const prevFields = Array.isArray(prev.fields) ? prev.fields.length : 0;
        const nextFields = Array.isArray(section.fields) ? section.fields.length : 0;
        if (nextEntries > prevEntries || (nextEntries === prevEntries && nextFields > prevFields)) {
          byId.set(section.id, section);
        }
      }
    }
  };

  // Edit-form first so core Career / Social / Summary (skills) stay present even when
  // Phase 1 extras also exist; Phase 1 then fills missing section ids (certs, visa, …).
  ingest(fromEditForm);
  ingest(fromPhase1);
  for (const section of fromStoredSections) {
    if (!section?.id || byId.has(section.id)) continue;
    byId.set(section.id, section);
    order.push(section.id);
  }

  const merged = order.map((id) => byId.get(id)).filter(Boolean);
  return foldDuplicateClientReviewSections(merged).map((section) => ({
    ...section,
    fields: (section.fields || []).map((row) => ({
      ...row,
      value: str(row.value),
    })),
  }));
}

export function buildClientReviewSectionsFromEditForm(editForm, visibleSections) {
  return buildSectionsFromEditForm(editForm, visibleSections);
}

const DEFAULT_CLIENT_REVIEW_TABLE_COLUMNS = [
  'fullName',
  'email',
  'phone',
  'currentTitle',
  'currentCompany',
];

const PREVIOUS_FIVE_COLUMN_CLIENT_REVIEW_TABLE = [
  'lastName',
  'email',
  'phone',
  'currentTitle',
  'currentCompany',
];

const PREVIOUS_SPLIT_NAME_CLIENT_REVIEW_TABLE = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'currentTitle',
  'currentCompany',
];

const LEGACY_DEFAULT_CLIENT_REVIEW_TABLE_COLUMNS = [
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

const LEGACY_NAME_FIELD_IDS = new Set(['firstName', 'middleName', 'lastName']);

const CLIENT_REVIEW_TABLE_FIELD_IDS = new Set([
  ...LEGACY_DEFAULT_CLIENT_REVIEW_TABLE_COLUMNS,
  ...DEFAULT_CLIENT_REVIEW_TABLE_COLUMNS,
  'fullName',
  'middleName',
  'phoneCode',
  'age',
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
  'educationSummary',
  'educationCourses',
  'remarks',
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
]);

function isLegacyUncustomizedClientReviewTableColumns(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return true;
  const ids = raw.map((item) => String(item || '').trim()).filter(Boolean);
  if (ids.join(',') === LEGACY_DEFAULT_CLIENT_REVIEW_TABLE_COLUMNS.join(',')) return true;
  if (ids.join(',') === PREVIOUS_FIVE_COLUMN_CLIENT_REVIEW_TABLE.join(',')) return true;
  if (ids.join(',') === PREVIOUS_SPLIT_NAME_CLIENT_REVIEW_TABLE.join(',')) return true;
  if (ids.length <= DEFAULT_CLIENT_REVIEW_TABLE_COLUMNS.length) return false;
  const legacy = LEGACY_DEFAULT_CLIENT_REVIEW_TABLE_COLUMNS;
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

function normalizeClientReviewTableColumnId(raw) {
  const id = String(raw || '').trim();
  if (!id) return null;
  if (LEGACY_NAME_FIELD_IDS.has(id)) return 'fullName';
  if (CLIENT_REVIEW_TABLE_FIELD_IDS.has(id)) return id;
  return null;
}

export function parseClientReviewTableColumns(raw, visibleFields) {
  const source = isLegacyUncustomizedClientReviewTableColumns(raw)
    ? DEFAULT_CLIENT_REVIEW_TABLE_COLUMNS
    : Array.isArray(raw)
      ? raw
      : DEFAULT_CLIENT_REVIEW_TABLE_COLUMNS;
  const seen = new Set();
  const next = [];
  for (const item of source) {
    const id = normalizeClientReviewTableColumnId(item);
    if (!id || seen.has(id)) continue;
    if (visibleFields && visibleFields[id] === false) continue;
    if (
      id === 'fullName' &&
      visibleFields &&
      typeof visibleFields.fullName !== 'boolean' &&
      visibleFields.firstName === false &&
      visibleFields.middleName === false &&
      visibleFields.lastName === false
    ) {
      continue;
    }
    seen.add(id);
    next.push(id);
  }
  return next.length > 0 ? next : [...DEFAULT_CLIENT_REVIEW_TABLE_COLUMNS];
}

function isBlankClientReviewValue(value) {
  const raw = String(value ?? '').trim();
  return (
    !raw ||
    raw === 'No entries provided' ||
    raw === '—' ||
    raw === '-' ||
    raw === '[' ||
    raw === ']' ||
    raw === '[]' ||
    raw === '{}' ||
    raw === '[object Object]' ||
    raw === 'null'
  );
}

function parseBirthDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const date = new Date(`${dmy[3]}-${month}-${day}T00:00:00`);
    if (!Number.isNaN(date.getTime()) && date.getDate() === Number(dmy[1])) return date;
    const alt = new Date(`${dmy[3]}-${day}-${month}T00:00:00`);
    return Number.isNaN(alt.getTime()) ? null : alt;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function ageFromBirthDate(value) {
  const birth = parseBirthDate(value);
  if (!birth) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  if (!Number.isFinite(age) || age < 0 || age > 120) return '';
  return String(age);
}

function storedAge(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const num = Number(raw);
  if (Number.isFinite(num) && num > 0 && num <= 120) return String(Math.round(num));
  return raw;
}

function joinClientReviewList(value) {
  if (!Array.isArray(value)) return String(value || '').trim();
  return value
    .map((item) => {
      if (item && typeof item === 'object') {
        const lang = item.language || item.name || '';
        const prof = item.proficiency || item.level || '';
        const joined = [lang, prof]
          .map((part) => String(part || '').trim())
          .filter(Boolean)
          .join(' | ');
        if (joined) return joined;
        return Object.values(item)
          .map((part) => (typeof part === 'object' ? '' : String(part || '').trim()))
          .filter(Boolean)
          .join(' | ');
      }
      return String(item || '').trim();
    })
    .filter(Boolean)
    .join(', ');
}

function fallbackValuesFromCandidate(candidate, matchScore) {
  const parts = String(candidate?.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const score = Number.isFinite(Number(matchScore)) ? String(Math.round(Number(matchScore))) : '';
  const experience = Number.isFinite(Number(candidate?.experience))
    ? String(candidate.experience)
    : String(candidate?.experience || '').trim();
  const birthDate = String(
    candidate?.birthDate || candidate?.dob || candidate?.dateOfBirth || '',
  ).trim();
  const age = storedAge(candidate?.age) || ageFromBirthDate(birthDate);
  const money = (value) => formatReviewText(value);
  const prefs =
    candidate?.careerPreferences &&
    typeof candidate.careerPreferences === 'object' &&
    !Array.isArray(candidate.careerPreferences)
      ? candidate.careerPreferences
      : {};
  return {
    'first name': parts[0] || String(candidate?.firstName || '').trim(),
    'middle name': String(candidate?.middleName || '').trim(),
    'last name': parts.length > 1 ? parts[parts.length - 1] : String(candidate?.lastName || '').trim(),
    'e-mail': String(candidate?.email || '').trim(),
    email: String(candidate?.email || '').trim(),
    'phone code': String(candidate?.phoneCode || '').trim(),
    'mobile no': String(candidate?.phone || '').trim(),
    age,
    'birth date': birthDate,
    'date of birth': birthDate,
    city: String(candidate?.city || '').trim(),
    state: String(candidate?.state || '').trim(),
    country: String(candidate?.country || '').trim(),
    'current address': String(candidate?.address || '').trim(),
    zip: String(candidate?.zip || candidate?.zipCode || '').trim(),
    nationality: String(candidate?.nationality || '').trim(),
    gender: String(candidate?.gender || '').trim(),
    'employment status': String(candidate?.employment || '').trim(),
    'marital status': String(candidate?.maritalStatus || '').trim(),
    'passport number': String(candidate?.passportNumber || '').trim(),
    'preferred location': String(candidate?.preferredLocation || '').trim(),
    'current company website': String(candidate?.currentCompanyWebsite || '').trim(),
    'current designation': String(candidate?.designation || candidate?.currentTitle || '').trim(),
    'current employer': String(candidate?.currentCompany || '').trim(),
    'experience (years)': experience,
    'candidate score': score,
    'current salary': money(candidate?.currentSalary ?? prefs.currentSalary),
    'current salary currency': formatReviewText(
      candidate?.currentSalaryCurrency || prefs.currentCurrency,
    ),
    'current benefits': formatReviewText(candidate?.currentBenefits || prefs.currentBenefits),
    'expected salary': money(
      candidate?.expectedSalary ?? prefs.preferredSalary ?? prefs.salaryAmount,
    ),
    'expected salary currency': formatReviewText(
      candidate?.expectedSalaryCurrency || prefs.preferredCurrency || prefs.salaryCurrency,
    ),
    'expected benefits': formatReviewText(candidate?.expectedBenefits || prefs.preferredBenefits),
    'notice period': formatReviewText(candidate?.noticePeriod || prefs.noticePeriod),
    'preferred job titles': formatReviewText(prefs.preferredJobTitles || prefs.preferredRoles),
    'preferred industries': formatReviewText(prefs.preferredIndustries || prefs.preferredIndustry),
    'functional areas': formatReviewText(prefs.functionalAreas || prefs.functionalArea),
    'job types': formatReviewText(prefs.jobTypes),
    'work modes': formatReviewText(
      prefs.workModes || prefs.preferredWorkMode || prefs.passportNumbersByLocation?.__workModes,
    ),
    relocation: formatReviewText(prefs.relocationPreference),
    'availability to start': formatReviewText(
      prefs.availabilityToStart || candidate?.availability,
    ),
    remarks: String(candidate?.remarks || '').trim(),
    skills: joinClientReviewList(candidate?.skills),
    'language & proficiency': joinClientReviewList(
      candidate?.languageProficiency || candidate?.languages,
    ),
    languages: joinClientReviewList(candidate?.languages),
    summary: String(candidate?.cvSummary || '').trim(),
    'education summary': String(candidate?.education || candidate?.educationSummary || '').trim(),
    courses: joinClientReviewList(candidate?.educationCourses),
    linkedin: String(candidate?.linkedIn || '').trim(),
    twitter: String(candidate?.twitter || '').trim(),
    facebook: String(candidate?.facebook || '').trim(),
    website: String(candidate?.website || '').trim(),
    'skype id': String(candidate?.skypeId || '').trim(),
    'stack overflow': String(candidate?.stackOverflow || '').trim(),
    xing: String(candidate?.xing || '').trim(),
    'portfolio / project links': joinClientReviewList(candidate?.cvPortfolioLinks || candidate?.portfolio),
    certifications: joinClientReviewList(candidate?.certifications),
    'honours & awards': joinClientReviewList(candidate?.honours),
    'internal notes': String(candidate?.notes || '').trim(),
  };
}

/** Fill empty drawer fields from the same candidate + match payload the table uses. */
export function hydrateClientReviewSections(sections, { candidate, matchScore } = {}) {
  const fallbacks = fallbackValuesFromCandidate(candidate || {}, matchScore);
  return (Array.isArray(sections) ? sections : []).map((section) => {
    const fields = Array.isArray(section?.fields)
      ? section.fields.map((row) => {
          if (!isBlankClientReviewValue(row?.value)) return row;
          const key = String(row?.label || '')
            .trim()
            .toLowerCase();
          const next = fallbacks[key];
          if (!next) return row;
          return { ...row, value: next };
        })
      : [];

    let entries = section?.entries;
    if (
      section?.id === 'education' &&
      !(Array.isArray(entries) && entries.length) &&
      Array.isArray(candidate?.cvEducationEntries) &&
      candidate.cvEducationEntries.length
    ) {
      entries = candidate.cvEducationEntries.map((entry) => ({
        degreeProgram: entry?.degree || entry?.degreeProgram || '',
        institutionName: entry?.institution || entry?.institutionName || '',
        startYear: entry?.startYear || '',
        endYear: entry?.endYear || '',
      }));
    }
    if (
      section?.id === 'work' &&
      !(Array.isArray(entries) && entries.length) &&
      Array.isArray(candidate?.cvWorkExperienceEntries) &&
      candidate.cvWorkExperienceEntries.length
    ) {
      entries = candidate.cvWorkExperienceEntries;
    }

    return { ...section, fields, entries };
  });
}

function isOpenableClientResumeHref(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return /^https?:\/\//i.test(raw) || /\/client-review\/[^/]+\/resume\b/i.test(raw);
}

/** Put the recruiter-selected CV URL on the Resume / CV section for client review. */
export function attachSharedResumeToClientReviewSections(sections, resumeUrl) {
  const url = String(resumeUrl || '').trim();
  const list = Array.isArray(sections) ? sections : [];
  if (!isOpenableClientResumeHref(url)) return list;
  return list.map((section) => {
    if (section?.id !== 'resume') return section;
    const fields = Array.isArray(section.fields) ? [...section.fields] : [];
    const isResumeLabel = (row) => {
      const key = String(row?.label || '').trim().toLowerCase();
      return key === 'resume / cv' || key === 'resume' || key === 'resume url' || key === 'cv';
    };
    const idx = fields.findIndex(isResumeLabel);
    if (idx >= 0) {
      fields[idx] = { ...fields[idx], value: url };
      return { ...section, fields };
    }
    const hrefIdx = fields.findIndex((row) => isOpenableClientResumeHref(row?.value));
    if (hrefIdx >= 0) fields[hrefIdx] = { ...fields[hrefIdx], value: url };
    else fields.unshift({ label: 'Resume / CV', value: url });
    return { ...section, fields };
  });
}
