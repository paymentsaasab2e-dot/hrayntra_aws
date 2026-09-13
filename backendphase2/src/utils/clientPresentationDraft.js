/**
 * Client-only candidate copy for Submit to Client (stored under extraData.clientPresentation).
 * Does not replace the main CRM / overview record — only overlays at submit & review time.
 */

const CLIENT_PRESENTATION_KEY = 'clientPresentation';

function parseExtra(extraData) {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return {};
  return extraData;
}

function isNonEmptyValue(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

/** Prefer presentation/edit values only when they actually contain data. */
function pickPreferred(preferred, fallback) {
  return isNonEmptyValue(preferred) ? preferred : fallback;
}

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,|\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function mapPhase1EducationEntries(snapshot) {
  if (!Array.isArray(snapshot?.education)) return [];
  return snapshot.education
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const degree = String(entry.degreeProgram || entry.degree || '').trim();
      const institution = String(entry.institutionName || entry.institution || '').trim();
      if (!degree && !institution) return null;
      return {
        degree,
        institution,
        startYear: entry.startYear || '',
        endYear: entry.endYear || '',
        grade: entry.grade || '',
      };
    })
    .filter(Boolean);
}

function mapPhase1WorkEntries(snapshot) {
  if (!Array.isArray(snapshot?.workExperience)) return [];
  return snapshot.workExperience
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const title = String(entry.jobTitle || entry.title || '').trim();
      const company = String(entry.companyName || entry.company || '').trim();
      if (!title && !company) return null;
      const responsibilities = Array.isArray(entry.responsibilities)
        ? entry.responsibilities
        : entry.description
          ? [String(entry.description)]
          : [];
      return {
        title,
        company,
        startDate: entry.startDate || '',
        endDate: entry.endDate || '',
        location: entry.workLocation || entry.location || '',
        responsibilities,
      };
    })
    .filter(Boolean);
}

export function readClientPresentation(extraData) {
  const extra = parseExtra(extraData);
  const raw = extra[CLIENT_PRESENTATION_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const fields =
    raw.fields && typeof raw.fields === 'object' && !Array.isArray(raw.fields) ? raw.fields : null;
  const editForm =
    raw.editForm && typeof raw.editForm === 'object' && !Array.isArray(raw.editForm)
      ? raw.editForm
      : null;
  const phase1Snapshot =
    raw.phase1Snapshot && typeof raw.phase1Snapshot === 'object' && !Array.isArray(raw.phase1Snapshot)
      ? raw.phase1Snapshot
      : null;
  const clientReviewSections = Array.isArray(raw.clientReviewSections)
    ? raw.clientReviewSections
    : null;
  // Presentation may store editForm / phase1 without a top-level fields bag.
  if (!fields && !editForm && !phase1Snapshot && !clientReviewSections) return null;
  return {
    updatedAt: String(raw.updatedAt || ''),
    editForm,
    fields: fields || {},
    cvEditorLayout:
      raw.cvEditorLayout && typeof raw.cvEditorLayout === 'object' && !Array.isArray(raw.cvEditorLayout)
        ? raw.cvEditorLayout
        : null,
    visibleSections: raw.visibleSections,
    visibleFields: raw.visibleFields,
    clientReviewSections,
    phase1Snapshot,
    phase1VisibleSections: raw.phase1VisibleSections,
  };
}

/**
 * Overlay clientPresentation onto the CRM candidate without wiping filled profile
 * values with empty presentation arrays/strings.
 */
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
      visibleSections: saved.visibleSections,
      visibleFields: saved.visibleFields,
      clientReviewSections: saved.clientReviewSections,
      phase1Snapshot: saved.phase1Snapshot,
      phase1VisibleSections: saved.phase1VisibleSections,
    },
  };
  if (saved.cvEditorLayout) {
    mergedExtra.cvEditorLayout = saved.cvEditorLayout;
  }

  return {
    ...candidate,
    firstName: pickPreferred(f.firstName, candidate.firstName),
    lastName: pickPreferred(f.lastName, candidate.lastName),
    email: pickPreferred(f.email, candidate.email),
    phone: pickPreferred(f.phone, candidate.phone),
    linkedIn: pickPreferred(f.linkedIn, candidate.linkedIn),
    currentTitle: pickPreferred(f.currentTitle, candidate.currentTitle),
    currentCompany: pickPreferred(f.currentCompany, candidate.currentCompany),
    designation: pickPreferred(f.designation, candidate.designation),
    experience: pickPreferred(f.experience, candidate.experience),
    location: pickPreferred(f.location, candidate.location),
    address: pickPreferred(f.address, candidate.address),
    city: pickPreferred(f.city, candidate.city),
    country: pickPreferred(f.country, candidate.country),
    noticePeriod: pickPreferred(f.noticePeriod, candidate.noticePeriod),
    availability: pickPreferred(f.availability, candidate.availability),
    resume: pickPreferred(f.resume, candidate.resume),
    education: pickPreferred(f.education, candidate.education),
    portfolio: pickPreferred(f.portfolio, candidate.portfolio),
    website: pickPreferred(f.website, candidate.website),
    cvSummary: pickPreferred(f.cvSummary, candidate.cvSummary),
    notes: pickPreferred(f.notes, candidate.notes),
    skills: pickPreferred(asStringArray(f.skills), candidate.skills),
    languages: pickPreferred(asStringArray(f.languages), candidate.languages),
    certifications: pickPreferred(
      Array.isArray(f.certifications) ? f.certifications : asStringArray(f.certifications),
      candidate.certifications,
    ),
    cvEducationEntries: pickPreferred(f.cvEducationEntries, candidate.cvEducationEntries),
    cvWorkExperienceEntries: pickPreferred(
      f.cvWorkExperienceEntries,
      candidate.cvWorkExperienceEntries,
    ),
    cvPortfolioLinks: pickPreferred(f.cvPortfolioLinks, candidate.cvPortfolioLinks),
    preferredLocation: pickPreferred(f.preferredLocation, candidate.preferredLocation),
    expectedSalary: pickPreferred(f.expectedSalary, candidate.expectedSalary),
    currentSalary: pickPreferred(f.currentSalary, candidate.currentSalary),
    salary: pickPreferred(f.salary, candidate.salary),
    extraData: mergedExtra,
  };
}

/**
 * Full hydrate for public client-review / comparative: presentation fields + editForm +
 * phase1 snapshot, never replacing real profile data with empties.
 */
export function hydrateCandidateForClientReview(candidate) {
  if (!candidate) return candidate;
  let next = mergeCandidateWithClientPresentation(candidate);
  const saved = readClientPresentation(candidate.extraData);
  const editForm =
    saved?.editForm && typeof saved.editForm === 'object' && !Array.isArray(saved.editForm)
      ? saved.editForm
      : null;
  const phase1 =
    saved?.phase1Snapshot &&
    typeof saved.phase1Snapshot === 'object' &&
    !Array.isArray(saved.phase1Snapshot)
      ? saved.phase1Snapshot
      : null;

  if (editForm) {
    next = {
      ...next,
      firstName: pickPreferred(editForm.firstName, next.firstName),
      lastName: pickPreferred(editForm.lastName, next.lastName),
      email: pickPreferred(editForm.email, next.email),
      phone: pickPreferred(editForm.phone, next.phone),
      city: pickPreferred(editForm.city, next.city),
      country: pickPreferred(editForm.country, next.country),
      address: pickPreferred(editForm.address, next.address),
      location: pickPreferred(editForm.location, next.location),
      currentCompany: pickPreferred(editForm.currentCompany, next.currentCompany),
      currentTitle: pickPreferred(editForm.currentTitle || editForm.designation, next.currentTitle),
      designation: pickPreferred(
        editForm.currentTitle || editForm.designation,
        next.designation || next.currentTitle,
      ),
      experience: pickPreferred(editForm.experience, next.experience),
      education: pickPreferred(
        editForm.educationSummary || editForm.education,
        next.education,
      ),
      cvSummary: pickPreferred(editForm.cvSummary, next.cvSummary),
      skills: pickPreferred(asStringArray(editForm.skills), next.skills),
      languages: pickPreferred(
        asStringArray(editForm.languageProficiency || editForm.languages),
        next.languages,
      ),
      cvEducationEntries: pickPreferred(editForm.cvEducationEntries, next.cvEducationEntries),
      cvWorkExperienceEntries: pickPreferred(
        editForm.cvWorkExperienceEntries,
        next.cvWorkExperienceEntries,
      ),
      linkedIn: pickPreferred(editForm.linkedIn, next.linkedIn),
    };
  }

  if (phase1) {
    const pi = phase1.personalInfo && typeof phase1.personalInfo === 'object' ? phase1.personalInfo : {};
    next = {
      ...next,
      firstName: pickPreferred(pi.firstName, next.firstName),
      middleName: pickPreferred(pi.middleName, next.middleName),
      lastName: pickPreferred(pi.lastName, next.lastName),
      email: pickPreferred(pi.email, next.email),
      phone: pickPreferred(
        [pi.phoneCode, pi.phone].map((v) => String(v || '').trim()).filter(Boolean).join(' '),
        next.phone,
      ),
      phoneCode: pickPreferred(pi.phoneCode, next.phoneCode),
      city: pickPreferred(pi.city, next.city),
      country: pickPreferred(pi.country, next.country),
      address: pickPreferred(pi.address, next.address),
      nationality: pickPreferred(pi.nationality, next.nationality),
      gender: pickPreferred(pi.gender, next.gender),
      employment: pickPreferred(pi.employment, next.employment),
      birthDate: pickPreferred(pi.dob, next.birthDate || next.dob),
      passportNumber: pickPreferred(pi.passportNumber, next.passportNumber),
      cvSummary: pickPreferred(phase1.summaryText, next.cvSummary),
      cvEducationEntries: pickPreferred(mapPhase1EducationEntries(phase1), next.cvEducationEntries),
      cvWorkExperienceEntries: pickPreferred(mapPhase1WorkEntries(phase1), next.cvWorkExperienceEntries),
      linkedIn: pickPreferred(pi.linkedinUrl, next.linkedIn),
    };
  }

  return next;
}

/**
 * Public client-review payload: tenant candidate DB is source of truth.
 * Fills gaps from profile editForm / phase1 only — never from curated presentation.fields.
 */
export function candidateFromTenantDbForClientReview(candidate) {
  if (!candidate) return candidate;
  const saved = readClientPresentation(candidate.extraData);
  const editForm =
    saved?.editForm && typeof saved.editForm === 'object' && !Array.isArray(saved.editForm)
      ? saved.editForm
      : null;
  const phase1 =
    saved?.phase1Snapshot &&
    typeof saved.phase1Snapshot === 'object' &&
    !Array.isArray(saved.phase1Snapshot)
      ? saved.phase1Snapshot
      : null;

  // Start from CRM / tenant candidate columns — not presentation.fields.
  let next = { ...candidate };

  if (editForm) {
    next = {
      ...next,
      firstName: pickPreferred(next.firstName, editForm.firstName),
      lastName: pickPreferred(next.lastName, editForm.lastName),
      email: pickPreferred(next.email, editForm.email),
      phone: pickPreferred(next.phone, editForm.phone),
      city: pickPreferred(next.city, editForm.city),
      country: pickPreferred(next.country, editForm.country),
      address: pickPreferred(next.address, editForm.address),
      location: pickPreferred(next.location, editForm.location),
      currentCompany: pickPreferred(next.currentCompany, editForm.currentCompany),
      currentTitle: pickPreferred(
        next.currentTitle || next.designation,
        editForm.currentTitle || editForm.designation,
      ),
      designation: pickPreferred(
        next.designation || next.currentTitle,
        editForm.currentTitle || editForm.designation,
      ),
      experience: pickPreferred(next.experience, editForm.experience),
      education: pickPreferred(
        next.education,
        editForm.educationSummary || editForm.education,
      ),
      cvSummary: pickPreferred(next.cvSummary, editForm.cvSummary),
      skills: pickPreferred(next.skills, asStringArray(editForm.skills)),
      languages: pickPreferred(
        next.languages,
        asStringArray(editForm.languageProficiency || editForm.languages),
      ),
      cvEducationEntries: pickPreferred(next.cvEducationEntries, editForm.cvEducationEntries),
      cvWorkExperienceEntries: pickPreferred(
        next.cvWorkExperienceEntries,
        editForm.cvWorkExperienceEntries,
      ),
      linkedIn: pickPreferred(next.linkedIn, editForm.linkedIn),
    };
  }

  if (phase1) {
    const pi = phase1.personalInfo && typeof phase1.personalInfo === 'object' ? phase1.personalInfo : {};
    next = {
      ...next,
      firstName: pickPreferred(next.firstName, pi.firstName),
      middleName: pickPreferred(next.middleName, pi.middleName),
      lastName: pickPreferred(next.lastName, pi.lastName),
      email: pickPreferred(next.email, pi.email),
      phone: pickPreferred(
        next.phone,
        [pi.phoneCode, pi.phone].map((v) => String(v || '').trim()).filter(Boolean).join(' '),
      ),
      phoneCode: pickPreferred(next.phoneCode, pi.phoneCode),
      city: pickPreferred(next.city, pi.city),
      country: pickPreferred(next.country, pi.country),
      address: pickPreferred(next.address, pi.address),
      nationality: pickPreferred(next.nationality, pi.nationality),
      gender: pickPreferred(next.gender, pi.gender),
      employment: pickPreferred(next.employment, pi.employment),
      birthDate: pickPreferred(next.birthDate || next.dob, pi.dob),
      passportNumber: pickPreferred(next.passportNumber, pi.passportNumber),
      cvSummary: pickPreferred(next.cvSummary, phase1.summaryText),
      cvEducationEntries: pickPreferred(next.cvEducationEntries, mapPhase1EducationEntries(phase1)),
      cvWorkExperienceEntries: pickPreferred(
        next.cvWorkExperienceEntries,
        mapPhase1WorkEntries(phase1),
      ),
      linkedIn: pickPreferred(next.linkedIn, pi.linkedinUrl),
    };
  }

  return next;
}

/**
 * Build review sections directly from the tenant candidate — not from a saved
 * clientPresentation overlay (which can be empty and hide real profile data).
 */
export function buildDirectClientReviewPresentation(candidate) {
  const saved = readClientPresentation(candidate?.extraData);
  const snapshot =
    candidate?.extraData?.cvSubmission?.snapshot &&
    typeof candidate.extraData.cvSubmission.snapshot === 'object'
      ? candidate.extraData.cvSubmission.snapshot
      : null;
  const visibleFields = saved?.visibleFields || snapshot?.visibleFields || null;
  const visibleSections = saved?.visibleSections || snapshot?.visibleSections || null;
  const phase1VisibleSections =
    saved?.phase1VisibleSections || snapshot?.phase1VisibleSections || null;

  const base = enrichClientPresentationForReview(
    null,
    candidateFromTenantDbForClientReview(candidate),
  );
  return {
    ...base,
    visibleFields,
    visibleSections,
    phase1VisibleSections,
    // Keep phase1 snapshot only for section builders that need structure — data still
    // comes from tenant candidate via editForm above.
    phase1Snapshot: saved?.phase1Snapshot || null,
  };
}

/**
 * Resolve Submit-to-Client field visibility for a public review payload.
 */
export function resolveClientReviewVisibleFields(candidate) {
  const saved = readClientPresentation(candidate?.extraData);
  if (saved?.visibleFields && typeof saved.visibleFields === 'object') {
    return saved.visibleFields;
  }
  const snapshot = candidate?.extraData?.cvSubmission?.snapshot;
  if (snapshot?.visibleFields && typeof snapshot.visibleFields === 'object') {
    return snapshot.visibleFields;
  }
  return null;
}

/**
 * Build a presentation-shaped editForm from tenant candidate data for section rendering.
 * When presentation is null, sections are built purely from the candidate record.
 */
export function enrichClientPresentationForReview(presentation, candidate) {
  const hydrated = candidateFromTenantDbForClientReview(candidate);
  if (!presentation) {
    return {
      editForm: {
        firstName: hydrated.firstName,
        middleName: hydrated.middleName,
        lastName: hydrated.lastName,
        email: hydrated.email,
        phone: hydrated.phone,
        phoneCode: hydrated.phoneCode,
        city: hydrated.city,
        state: hydrated.state,
        country: hydrated.country,
        location: hydrated.location,
        address: hydrated.address,
        zip: hydrated.zip,
        nationality: hydrated.nationality,
        gender: hydrated.gender,
        employment: hydrated.employment,
        maritalStatus: hydrated.maritalStatus,
        birthDate: hydrated.birthDate || hydrated.dob,
        passportNumber: hydrated.passportNumber,
        preferredLocation: hydrated.preferredLocation,
        currentCompanyWebsite: hydrated.currentCompanyWebsite,
        currentCompany: hydrated.currentCompany,
        currentTitle: hydrated.designation || hydrated.currentTitle,
        experience: hydrated.experience,
        education: hydrated.education,
        educationSummary: hydrated.education,
        cvSummary: hydrated.cvSummary,
        skills: hydrated.skills,
        languages: hydrated.languages,
        languageProficiency: Array.isArray(hydrated.languages)
          ? hydrated.languages.join(', ')
          : hydrated.languages,
        cvEducationEntries: hydrated.cvEducationEntries,
        cvWorkExperienceEntries: hydrated.cvWorkExperienceEntries,
        linkedIn: hydrated.linkedIn,
        twitter: hydrated.twitter,
        website: hydrated.website,
        portfolio: hydrated.portfolio,
        remarks: hydrated.remarks,
        currentSalary: hydrated.currentSalary,
        expectedSalary: hydrated.expectedSalary,
        noticePeriod: hydrated.noticePeriod,
        certifications: hydrated.certifications,
        avatar: hydrated.avatar,
        candidateScore: hydrated.candidateScore ?? hydrated.score,
        age: hydrated.age,
      },
      fields: {},
      visibleSections: null,
      visibleFields: null,
    };
  }

  const editForm =
    presentation.editForm && typeof presentation.editForm === 'object'
      ? { ...presentation.editForm }
      : {};

  // Tenant DB / hydrated candidate wins; fill only empty presentation editForm slots.
  editForm.firstName = pickPreferred(hydrated.firstName, editForm.firstName);
  editForm.lastName = pickPreferred(hydrated.lastName, editForm.lastName);
  editForm.email = pickPreferred(hydrated.email, editForm.email);
  editForm.phone = pickPreferred(hydrated.phone, editForm.phone);
  editForm.city = pickPreferred(hydrated.city, editForm.city);
  editForm.country = pickPreferred(hydrated.country, editForm.country);
  editForm.location = pickPreferred(hydrated.location, editForm.location);
  editForm.address = pickPreferred(hydrated.address, editForm.address);
  editForm.currentCompany = pickPreferred(hydrated.currentCompany, editForm.currentCompany);
  editForm.currentTitle = pickPreferred(
    hydrated.designation || hydrated.currentTitle,
    editForm.currentTitle,
  );
  editForm.experience = pickPreferred(hydrated.experience, editForm.experience);
  editForm.education = pickPreferred(hydrated.education, editForm.education);
  editForm.educationSummary = pickPreferred(
    hydrated.education,
    editForm.educationSummary || editForm.education,
  );
  editForm.cvSummary = pickPreferred(hydrated.cvSummary, editForm.cvSummary);
  editForm.skills = pickPreferred(hydrated.skills, asStringArray(editForm.skills));
  editForm.languages = pickPreferred(hydrated.languages, asStringArray(editForm.languages));
  editForm.languageProficiency = pickPreferred(
    Array.isArray(hydrated.languages) ? hydrated.languages.join(', ') : hydrated.languages,
    editForm.languageProficiency,
  );
  editForm.cvEducationEntries = pickPreferred(
    hydrated.cvEducationEntries,
    editForm.cvEducationEntries,
  );
  editForm.cvWorkExperienceEntries = pickPreferred(
    hydrated.cvWorkExperienceEntries,
    editForm.cvWorkExperienceEntries,
  );
  editForm.linkedIn = pickPreferred(hydrated.linkedIn, editForm.linkedIn);

  return {
    ...presentation,
    editForm,
  };
}
