/**
 * Client-review sections built from saved clientPresentation.editForm.
 */

const SECTION_LABELS = {
  personal: 'Personal Information',
  education: 'Education',
  professional: 'Professional Information',
  social: 'Social Network Information',
  summary: 'Summary & Additional',
};

const SECTION_IDS = ['personal', 'education', 'professional', 'social', 'summary'];

const DEFAULT_VISIBILITY = {
  personal: true,
  education: true,
  professional: true,
  social: true,
  summary: true,
};

function str(value) {
  if (value === undefined || value === null) return '';
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

function buildSectionsFromEditForm(editForm, visibility) {
  if (!editForm || typeof editForm !== 'object' || Array.isArray(editForm)) return [];
  const visible = normalizeVisibility(visibility);
  const sections = [];

  if (isVisible('personal', visible)) {
    const fields = fieldsFromPairs([
      ['First Name', editForm.firstName],
      ['Last Name', editForm.lastName],
      ['E-mail', editForm.email],
      ['Mobile No', editForm.phone],
      ['Age', editForm.age],
      ['Candidate Score', editForm.candidateScore],
      ['City', editForm.city],
      ['State', editForm.state],
      ['Country', editForm.country],
      ['Location (display)', editForm.location],
      ['Current Address', editForm.address],
      ['Zip', editForm.zip],
      ['Nationality', editForm.nationality],
      ['Current Company Website', editForm.currentCompanyWebsite],
      ['Marital Status', editForm.maritalStatus],
      ['Birth Date', editForm.birthDate],
      ['Passport Number', editForm.passportNumber],
      ['Preferred Location', editForm.preferredLocation],
    ]);
    if (fields.length) sections.push({ id: 'personal', title: SECTION_LABELS.personal, fields });
  }

  if (isVisible('education', visible)) {
    const fields = fieldsFromPairs([
      ['Education entries', editForm.cvEducationEntries],
      ['Education summary', editForm.educationSummary || editForm.education],
      ['Courses', editForm.educationCourses],
    ]);
    if (fields.length) sections.push({ id: 'education', title: SECTION_LABELS.education, fields });
  }

  if (isVisible('professional', visible)) {
    const fields = fieldsFromPairs([
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
      ['Resume URL', editForm.resumeUrl],
      ['Work experience', editForm.cvWorkExperienceEntries],
      ['Work history (narrative)', editForm.workHistoryText],
      ['Extracurricular activities', editForm.extracurricular],
      ['Volunteers', editForm.volunteers],
    ]);
    if (fields.length) {
      sections.push({ id: 'professional', title: SECTION_LABELS.professional, fields });
    }
  }

  if (isVisible('social', visible)) {
    const fields = fieldsFromPairs([
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
    if (fields.length) sections.push({ id: 'social', title: SECTION_LABELS.social, fields });
  }

  if (isVisible('summary', visible)) {
    const fields = fieldsFromPairs([
      ['Summary', editForm.cvSummary],
      ['Skills', editForm.skills],
      ['Language & proficiency', editForm.languageProficiency || editForm.languages],
      ['Honours & awards', editForm.honours],
      ['Certifications', editForm.certifications],
      ['Projects (extra)', editForm.projects],
      ['Hackathons (extra)', editForm.hackathons],
      ['Internal notes', editForm.notes],
    ]);
    if (fields.length) sections.push({ id: 'summary', title: SECTION_LABELS.summary, fields });
  }

  return sections;
}

export function buildClientReviewSectionsFromPresentation(saved) {
  if (!saved) return [];
  if (Array.isArray(saved.clientReviewSections) && saved.clientReviewSections.length > 0) {
    return saved.clientReviewSections;
  }
  return buildSectionsFromEditForm(saved.editForm, saved.visibleSections);
}

export function buildClientReviewSectionsFromEditForm(editForm, visibleSections) {
  return buildSectionsFromEditForm(editForm, visibleSections);
}
