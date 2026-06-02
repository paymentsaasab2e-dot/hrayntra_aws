/**
 * Client-only candidate copy for Submit to Client (stored under extraData.clientPresentation).
 * Does not replace the main CRM / overview record — only overlays at submit & review time.
 */

const CLIENT_PRESENTATION_KEY = 'clientPresentation';

function parseExtra(extraData) {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return {};
  return extraData;
}

export function readClientPresentation(extraData) {
  const extra = parseExtra(extraData);
  const raw = extra[CLIENT_PRESENTATION_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const fields = raw.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null;
  return {
    updatedAt: String(raw.updatedAt || ''),
    editForm: raw.editForm,
    fields,
    cvEditorLayout:
      raw.cvEditorLayout && typeof raw.cvEditorLayout === 'object' && !Array.isArray(raw.cvEditorLayout)
        ? raw.cvEditorLayout
        : null,
    visibleSections: raw.visibleSections,
    clientReviewSections: raw.clientReviewSections,
    phase1Snapshot: raw.phase1Snapshot,
    phase1VisibleSections: raw.phase1VisibleSections,
  };
}

export function mergeCandidateWithClientPresentation(candidate) {
  if (!candidate) return candidate;
  const saved = readClientPresentation(candidate.extraData);
  if (!saved) return candidate;

  const f = saved.fields;
  const baseExtra = parseExtra(candidate.extraData);
  const fieldExtra = parseExtra(f.extraData);
  const mergedExtra = {
    ...baseExtra,
    ...fieldExtra,
    [CLIENT_PRESENTATION_KEY]: {
      updatedAt: saved.updatedAt,
      editForm: saved.editForm,
      fields: saved.fields,
      cvEditorLayout: saved.cvEditorLayout,
    },
  };
  if (saved.cvEditorLayout) {
    mergedExtra.cvEditorLayout = saved.cvEditorLayout;
  }

  return {
    ...candidate,
    firstName: f.firstName ?? candidate.firstName,
    lastName: f.lastName ?? candidate.lastName,
    email: f.email ?? candidate.email,
    phone: f.phone ?? candidate.phone,
    linkedIn: f.linkedIn ?? candidate.linkedIn,
    currentTitle: f.currentTitle ?? candidate.currentTitle,
    currentCompany: f.currentCompany ?? candidate.currentCompany,
    designation: f.designation ?? candidate.designation,
    experience: f.experience ?? candidate.experience,
    location: f.location ?? candidate.location,
    address: f.address ?? candidate.address,
    city: f.city ?? candidate.city,
    country: f.country ?? candidate.country,
    noticePeriod: f.noticePeriod ?? candidate.noticePeriod,
    availability: f.availability ?? candidate.availability,
    resume: f.resume ?? candidate.resume,
    education: f.education ?? candidate.education,
    portfolio: f.portfolio ?? candidate.portfolio,
    website: f.website ?? candidate.website,
    cvSummary: f.cvSummary ?? candidate.cvSummary,
    notes: f.notes ?? candidate.notes,
    skills: Array.isArray(f.skills) ? f.skills : candidate.skills,
    languages: Array.isArray(f.languages) ? f.languages : candidate.languages,
    certifications: Array.isArray(f.certifications) ? f.certifications : candidate.certifications,
    cvEducationEntries: Array.isArray(f.cvEducationEntries)
      ? f.cvEducationEntries
      : candidate.cvEducationEntries,
    cvWorkExperienceEntries: Array.isArray(f.cvWorkExperienceEntries)
      ? f.cvWorkExperienceEntries
      : candidate.cvWorkExperienceEntries,
    cvPortfolioLinks: Array.isArray(f.cvPortfolioLinks) ? f.cvPortfolioLinks : candidate.cvPortfolioLinks,
    preferredLocation: f.preferredLocation ?? candidate.preferredLocation,
    expectedSalary: f.expectedSalary ?? candidate.expectedSalary,
    currentSalary: f.currentSalary ?? candidate.currentSalary,
    salary: f.salary ?? candidate.salary,
    extraData: mergedExtra,
  };
}
