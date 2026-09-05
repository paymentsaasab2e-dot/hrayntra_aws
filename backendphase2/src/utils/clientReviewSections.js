/**
 * Client-review sections built from saved clientPresentation.editForm.
 */

import { buildPhase1ClientReviewSections } from './phase1ClientReviewSections.js';

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
  const responsibilities = entry.responsibilities;
  if (Array.isArray(responsibilities) && responsibilities.length === 1) {
    const single = String(responsibilities[0] || '').trim();
    if (single && looksLikeWorkExperienceDisplayText(single)) {
      return parseWorkExperienceDisplayText(single)[0] || entry;
    }
    if (single.includes('\n') && !single.includes(';')) {
      return {
        ...entry,
        responsibilities: single
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      };
    }
  }
  const description = String(entry.description || '').trim();
  if (description && looksLikeWorkExperienceDisplayText(description)) {
    return parseWorkExperienceDisplayText(description)[0] || entry;
  }
  return entry;
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

function buildSectionsFromEditForm(editForm, visibility) {
  if (!editForm || typeof editForm !== 'object' || Array.isArray(editForm)) return [];
  const visible = normalizeVisibility(visibility);
  const sections = [];

  if (isVisible('personal', visible)) {
    pushVisibleSection(sections, 'personal', [
      ['Name', [editForm.firstName, editForm.lastName].filter(Boolean).join(' ')],
      ['First Name', editForm.firstName],
      ['Last Name', editForm.lastName],
      ['E-mail', editForm.email],
      ['Mobile No', editForm.phone],
      ['Age', editForm.age],
      ['Candidate Score', editForm.candidateScore],
      ['City & State', [editForm.city, editForm.state].filter(Boolean).join(', ')],
      ['City', editForm.city],
      ['State', editForm.state],
      ['Country', editForm.country],
      ['Location (display)', editForm.location],
      ['Current Address', editForm.address],
      ['Zip', editForm.zip],
      ['Candidate Image', editForm.avatar ? 'On file' : ''],
      ['Nationality', editForm.nationality],
      ['Current Company Website', editForm.currentCompanyWebsite],
      ['Marital Status', editForm.maritalStatus],
      ['Birth Date', editForm.birthDate],
      ['Passport Number', editForm.passportNumber],
      ['Preferred Location', editForm.preferredLocation],
    ]);
  }

  if (isVisible('education', visible)) {
    const eduEntries = parseWorkEntriesFromUnknown(editForm.cvEducationEntries);
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
              degreeProgram: entry.degree ?? entry.qualification,
              institutionName: entry.institution ?? entry.instituteName,
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
      ['Current Designation', editForm.currentTitle],
      ['Current Employer', editForm.currentCompany],
      ['Current Salary', editForm.currentSalary],
      ['Current Salary Currency', editForm.currentSalaryCurrency],
      ['Current Benefits', editForm.currentBenefits],
      ['Expected Salary', editForm.expectedSalary],
      ['Expected Salary Currency', editForm.expectedSalaryCurrency],
      ['Expected Benefits', editForm.expectedBenefits],
      ['Notice Period', editForm.noticePeriod],
      ['Work history (narrative)', editForm.workHistoryText],
      ['Extracurricular activities', editForm.extracurricular],
      ['Volunteers', editForm.volunteers],
    ]);
  }

  if (isVisible('work', visible)) {
    const workEntries = parseWorkEntriesFromUnknown(editForm.cvWorkExperienceEntries);
    pushVisibleSection(
      sections,
      'work',
      workEntries.length ? [] : [['Work experience', editForm.cvWorkExperienceEntries]],
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
      ['Portfolio URL', editForm.portfolio],
      ['Portfolio / project links', editForm.cvPortfolioLinks],
    ]);
  }

  if (isVisible('summary', visible)) {
    pushVisibleSection(sections, 'summary', [
      ['Summary', editForm.cvSummary],
      ['Skills', editForm.skills],
      ['Language & proficiency', editForm.languageProficiency || editForm.languages],
      ['Honours & awards', editForm.honours],
      ['Certifications', editForm.certifications],
      ['Projects (extra)', editForm.projects],
      ['Hackathons (extra)', editForm.hackathons],
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

const SUBMIT_SECTION_ENTRY_FIELDS = {
  personal: ['firstName', 'lastName', 'email', 'phone'],
  education: ['cvEducationEntries'],
  professional: ['currentTitle', 'currentCompany', 'expectedSalary', 'noticePeriod'],
  work: ['cvWorkExperienceEntries'],
  social: ['linkedIn', 'website', 'portfolio', 'cvPortfolioLinks'],
  summary: ['cvSummary', 'skills'],
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
  careerPreferences: ['p1CurrentRole', 'currentTitle', 'noticePeriod', 'expectedSalary'],
  visa: ['p1Visa'],
  vaccination: ['p1Vaccination'],
};

function parseSubmitFieldVisibility(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const nested =
    raw.fieldVisibility && typeof raw.fieldVisibility === 'object' ? raw.fieldVisibility : raw;
  return nested;
}

function isSubmitFieldVisible(visibility, fieldId) {
  if (!visibility) return true;
  return visibility[fieldId] !== false;
}

function isSubmitReviewLabelVisible(label, visibility) {
  if (!visibility) return true;
  const key = String(label || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let ids = SUBMIT_FIELD_LABEL_MAP[key];
  if (!ids && /^skill\s+\d+$/.test(key)) ids = ['skills'];
  if (!ids && /^language\s+\d+$/.test(key)) ids = ['languageProficiency'];
  if (!ids) return true;
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
          ? section.fields.filter((row) => isSubmitReviewLabelVisible(row?.label, visibility))
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

export function buildClientReviewSectionsFromPresentation(saved) {
  if (!saved) return [];
  const visibleFields = saved.visibleFields;
  if (saved.phase1Snapshot && typeof saved.phase1Snapshot === 'object') {
    return stripHiddenClientReviewFields(
      buildPhase1ClientReviewSections(saved.phase1Snapshot, saved.phase1VisibleSections),
      visibleFields,
    );
  }
  if (saved.editForm && typeof saved.editForm === 'object') {
    return stripHiddenClientReviewFields(
      buildSectionsFromEditForm(saved.editForm, saved.visibleSections),
      visibleFields,
    );
  }
  if (Array.isArray(saved.clientReviewSections) && saved.clientReviewSections.length > 0) {
    return stripHiddenClientReviewFields(saved.clientReviewSections, visibleFields);
  }
  return [];
}

export function buildClientReviewSectionsFromEditForm(editForm, visibleSections) {
  return buildSectionsFromEditForm(editForm, visibleSections);
}
