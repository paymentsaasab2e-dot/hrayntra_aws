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
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '[]' || trimmed === '{}' || trimmed === 'null') return false;
    return true;
  }
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

/** Readable text for client review. Arrays and JSON lists never render as `[...]`. */
export function formatReviewText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (Array.isArray(value)) {
    return value
      .map((item) => formatReviewText(item))
      .filter((item) => item && item !== '[object Object]')
      .join(', ');
  }
  if (typeof value === 'object') {
    return Object.values(value)
      .map((item) => formatReviewText(item))
      .filter(Boolean)
      .join(', ');
  }
  const text = String(value).trim();
  if (
    !text ||
    text === '[' ||
    text === ']' ||
    text === '[object Object]' ||
    text === '[]' ||
    text === '{}' ||
    text === 'null'
  ) {
    return '';
  }
  if (
    (text.startsWith('[') && text.endsWith(']')) ||
    (text.startsWith('{') && text.endsWith('}'))
  ) {
    try {
      return formatReviewText(JSON.parse(text));
    } catch {
      return text.replace(/^\[/, '').replace(/\]$/, '').trim();
    }
  }
  return text;
}

function formatPrefValue(value) {
  return formatReviewText(value);
}

/** Later records win per key when they actually contain a value. */
function mergeCareerPreferenceRecords(...sources) {
  const merged = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      if (!isNonEmptyValue(value)) continue;
      if (key === 'passportNumbersByLocation' && merged.passportNumbersByLocation) {
        merged.passportNumbersByLocation = {
          ...merged.passportNumbersByLocation,
          ...value,
        };
        continue;
      }
      merged[key] = value;
    }
  }
  return merged;
}

function snapshotFillScore(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return 0;
  let score = 0;
  const personal = snapshot.personalInfo;
  if (personal && typeof personal === 'object' && !Array.isArray(personal)) {
    score += Object.values(personal).filter((item) => isNonEmptyValue(item)).length;
  }
  const listKeys = [
    'workExperience',
    'education',
    'certifications',
    'internships',
    'gapExplanations',
    'academicAchievements',
    'competitiveExams',
    'projects',
    'accomplishments',
    'skills',
    'languages',
    'portfolioLinks',
  ];
  for (const key of listKeys) {
    if (Array.isArray(snapshot[key]) && snapshot[key].length) score += snapshot[key].length * 2;
  }
  if (isNonEmptyValue(snapshot.summaryText)) score += 2;
  if (snapshot.careerPreferences && typeof snapshot.careerPreferences === 'object') {
    score += Object.values(snapshot.careerPreferences).filter((item) => isNonEmptyValue(item)).length;
  }
  if (snapshot.visaWorkAuthorization && typeof snapshot.visaWorkAuthorization === 'object') score += 1;
  if (snapshot.vaccination && typeof snapshot.vaccination === 'object') score += 1;
  if (snapshot.resume && typeof snapshot.resume === 'object') score += 1;
  return score;
}

function mergePhase1Snapshots(primary, secondary) {
  const a = primary && typeof primary === 'object' && !Array.isArray(primary) ? primary : null;
  const b = secondary && typeof secondary === 'object' && !Array.isArray(secondary) ? secondary : null;
  if (!a) return b;
  if (!b) return a;
  const merged = { ...b, ...a };
  const personalA = a.personalInfo && typeof a.personalInfo === 'object' ? a.personalInfo : {};
  const personalB = b.personalInfo && typeof b.personalInfo === 'object' ? b.personalInfo : {};
  merged.personalInfo = { ...personalB, ...personalA };
  for (const key of Object.keys(personalB)) {
    if (!isNonEmptyValue(merged.personalInfo[key]) && isNonEmptyValue(personalB[key])) {
      merged.personalInfo[key] = personalB[key];
    }
  }
  const listKeys = [
    'workExperience',
    'education',
    'certifications',
    'internships',
    'gapExplanations',
    'academicAchievements',
    'competitiveExams',
    'projects',
    'accomplishments',
    'skills',
    'languages',
    'portfolioLinks',
  ];
  for (const key of listKeys) {
    const fromA = Array.isArray(a[key]) ? a[key] : [];
    const fromB = Array.isArray(b[key]) ? b[key] : [];
    merged[key] = fromA.length >= fromB.length ? fromA : fromB;
  }
  merged.summaryText = pickPreferred(a.summaryText, b.summaryText);
  merged.careerPreferences = mergeCareerPreferenceRecords(b.careerPreferences, a.careerPreferences);
  merged.visaWorkAuthorization = pickPreferred(a.visaWorkAuthorization, b.visaWorkAuthorization);
  merged.vaccination = pickPreferred(a.vaccination, b.vaccination);
  merged.resume = pickPreferred(a.resume, b.resume);
  return merged;
}

/** Live Phase 1 profile wins over a sparse snapshot saved at submit time. */
export function resolveLivePhase1Snapshot(candidate) {
  const extra = parseExtra(candidate?.extraData);
  const live = extra.phase1ProfileSnapshot;
  const profileSnap =
    candidate?.profileSnapshot && typeof candidate.profileSnapshot === 'object'
      ? candidate.profileSnapshot
      : null;
  const saved = readClientPresentation(extra)?.phase1Snapshot;
  const ranked = [live, profileSnap, saved]
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .sort((left, right) => snapshotFillScore(right) - snapshotFillScore(left));
  if (!ranked.length) return null;
  return ranked.slice(1).reduce((acc, item) => mergePhase1Snapshots(acc, item), ranked[0]);
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
  let next = applyTenantStoredProfile(mergeCandidateWithClientPresentation(candidate));
  const saved = readClientPresentation(candidate.extraData);
  const editForm =
    saved?.editForm && typeof saved.editForm === 'object' && !Array.isArray(saved.editForm)
      ? saved.editForm
      : null;
  const phase1 = resolveLivePhase1Snapshot(candidate);

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
  const phase1 = resolveLivePhase1Snapshot(candidate);

  // Start from CRM / tenant candidate columns + extraData.pipeline — not presentation.fields.
  let next = applyTenantStoredProfile({ ...candidate });

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
  const phase1Snapshot = resolveLivePhase1Snapshot(candidate);

  const base = enrichClientPresentationForReview(
    null,
    candidateFromTenantDbForClientReview(candidate),
  );
  return {
    ...base,
    visibleFields,
    visibleSections,
    phase1VisibleSections,
    phase1Snapshot,
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

function readPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function pipelineSection(extra, key) {
  const pipeline = readPlainObject(extra?.pipeline);
  return {
    ...readPlainObject(extra?.[key]),
    ...readPlainObject(pipeline[key]),
  };
}

function formatListValue(value) {
  return formatReviewText(value);
}

function preferReviewText(...values) {
  for (const value of values) {
    const text = formatReviewText(value);
    if (text) return text;
  }
  return '';
}

function extraProfileBag(candidate) {
  const extra = parseExtra(candidate?.extraData);
  const phase1 = resolveLivePhase1Snapshot(candidate);
  const personal = phase1?.personalInfo && typeof phase1.personalInfo === 'object' ? phase1.personalInfo : {};
  const prefs = mergeCareerPreferenceRecords(
    candidate?.careerPreferences,
    extra.careerPreferences,
    phase1?.careerPreferences,
  );
  return {
    extra,
    personal,
    personalPipe: pipelineSection(extra, 'personal'),
    educationPipe: pipelineSection(extra, 'education'),
    professionalPipe: pipelineSection(extra, 'professional'),
    socialPipe: pipelineSection(extra, 'social'),
    summaryPipe: pipelineSection(extra, 'summary'),
    workPipe: pipelineSection(extra, 'work'),
    prefs,
    phase1,
    salary: readPlainObject(candidate?.salary),
  };
}

/** Flatten Phase 2 ATS extraData.pipeline / salary JSON onto tenant candidate columns. */
function applyTenantStoredProfile(candidate) {
  if (!candidate) return candidate;
  const extra = parseExtra(candidate.extraData);
  const personalPipe = pipelineSection(extra, 'personal');
  const educationPipe = pipelineSection(extra, 'education');
  const socialPipe = pipelineSection(extra, 'social');
  const workPipe = pipelineSection(extra, 'work');
  const salary = readPlainObject(candidate.salary);
  const splitFromName = String(extra.fullName || extra.name || personalPipe.fullName || personalPipe.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    ...candidate,
    firstName: pickPreferred(
      candidate.firstName,
      personalPipe.firstName || extra.firstName || splitFromName[0],
    ),
    lastName: pickPreferred(
      candidate.lastName,
      personalPipe.lastName || extra.lastName || splitFromName.slice(1).join(' '),
    ),
    email: pickPreferred(candidate.email, personalPipe.email || extra.email),
    skills: pickPreferred(candidate.skills, candidate.recruiterSkills),
    languages: pickPreferred(candidate.languages, candidate.recruiterLanguages),
    certifications: pickPreferred(candidate.certifications, candidate.certificationsList),
    education: pickPreferred(
      candidate.education,
      candidate.recruiterEducation || educationPipe.summaryText,
    ),
    notes: pickPreferred(candidate.notes, candidate.recruiterNotes),
    address: pickPreferred(candidate.address || candidate.addressLine, personalPipe.currentAddress),
    city: pickPreferred(candidate.city, personalPipe.city),
    country: pickPreferred(candidate.country, personalPipe.country),
    linkedIn: pickPreferred(candidate.linkedIn, socialPipe.linkedIn || extra.linkedIn),
    website: pickPreferred(candidate.website, socialPipe.website || extra.website),
    portfolio: pickPreferred(candidate.portfolio, extra.portfolio || socialPipe.website),
    cvEducationEntries: pickPreferred(candidate.cvEducationEntries, educationPipe.entries),
    cvWorkExperienceEntries: pickPreferred(
      candidate.cvWorkExperienceEntries,
      workPipe.entries || workPipe.workExperienceEntries || extra.workExperienceEntries,
    ),
    expectedSalary: pickPreferred(
      candidate.expectedSalary,
      extra.expectedSalary || salary.expected || salary.max || salary.amount,
    ),
    currentSalary: pickPreferred(
      candidate.currentSalary,
      extra.currentSalary || salary.current || salary.min,
    ),
    careerPreferences: pickPreferred(candidate.careerPreferences, extra.careerPreferences),
  };
}

function buildEditFormFromCandidate(hydrated) {
  const {
    extra,
    personal,
    personalPipe,
    educationPipe,
    professionalPipe,
    socialPipe,
    summaryPipe,
    workPipe,
    prefs,
    phase1,
    salary,
  } = extraProfileBag(hydrated);
  const languages = pickPreferred(
    hydrated.languages,
    Array.isArray(phase1?.languages)
      ? phase1.languages.map((row) => row?.name || row).filter(Boolean)
      : [],
  );
  const skills = pickPreferred(
    hydrated.skills,
    Array.isArray(phase1?.skills) ? phase1.skills.map((row) => row?.name || row).filter(Boolean) : [],
  );
  const languageProficiency = pickPreferred(
    formatListValue(summaryPipe.languageProficiency || extra.languageProficiency),
    Array.isArray(languages) ? languages.join(', ') : languages,
  );
  return {
    firstName: pickPreferred(hydrated.firstName, personal.firstName || personalPipe.firstName),
    middleName: pickPreferred(hydrated.middleName, personal.middleName || personalPipe.middleName),
    lastName: pickPreferred(hydrated.lastName, personal.lastName || personalPipe.lastName),
    email: pickPreferred(hydrated.email, personal.email || personalPipe.email),
    phone: pickPreferred(
      hydrated.phone,
      [personal.phoneCode, personal.phone].map((v) => String(v || '').trim()).filter(Boolean).join(' '),
    ),
    phoneCode: pickPreferred(hydrated.phoneCode, personal.phoneCode),
    city: pickPreferred(hydrated.city, personal.city || personalPipe.city),
    state: pickPreferred(hydrated.state, personalPipe.state || extra.state),
    country: pickPreferred(hydrated.country, personal.country || personalPipe.country),
    location: hydrated.location,
    address: pickPreferred(
      hydrated.address || hydrated.addressLine,
      personalPipe.currentAddress || personal.address,
    ),
    zip: pickPreferred(hydrated.zip, personalPipe.zip || extra.zip || extra.zipCode),
    nationality: pickPreferred(
      hydrated.nationality,
      personalPipe.nationality || extra.nationality || personal.nationality,
    ),
    gender: pickPreferred(hydrated.gender, personalPipe.gender || extra.gender || personal.gender),
    employment: pickPreferred(
      hydrated.employment,
      extra.employment || extra.employmentStatus || personal.employment,
    ),
    maritalStatus: pickPreferred(
      hydrated.maritalStatus,
      personalPipe.maritalStatus || extra.maritalStatus,
    ),
    birthDate: pickPreferred(
      hydrated.birthDate || hydrated.dob,
      personalPipe.birthDate || extra.dateOfBirth || extra.dob || personal.dob,
    ),
    passportNumber: pickPreferred(
      hydrated.passportNumber,
      personalPipe.passportNumber || extra.passportNumber || personal.passportNumber,
    ),
    preferredLocation: pickPreferred(
      hydrated.preferredLocation,
      formatPrefValue(prefs.preferredLocations),
    ),
    currentCompanyWebsite: pickPreferred(
      hydrated.currentCompanyWebsite,
      personalPipe.currentCompanyWebsite,
    ),
    currentCompany: hydrated.currentCompany,
    currentTitle: hydrated.designation || hydrated.currentTitle || formatPrefValue(prefs.currentRole),
    experience: hydrated.experience,
    education: pickPreferred(hydrated.education, educationPipe.summaryText),
    educationSummary: pickPreferred(
      educationPipe.summaryText,
      hydrated.education || summaryPipe.educationSummary,
    ),
    educationCourses: formatListValue(educationPipe.courses || extra.courses),
    cvSummary: pickPreferred(hydrated.cvSummary, phase1?.summaryText || summaryPipe.educationSummary),
    skills: formatListValue(skills),
    languages: formatListValue(languages),
    languageProficiency,
    cvEducationEntries: pickPreferred(hydrated.cvEducationEntries, educationPipe.entries),
    cvWorkExperienceEntries: pickPreferred(
      hydrated.cvWorkExperienceEntries,
      workPipe.entries || workPipe.workExperienceEntries || extra.workExperienceEntries,
    ),
    cvPortfolioLinks: pickPreferred(hydrated.cvPortfolioLinks, phase1?.portfolioLinks),
    linkedIn: pickPreferred(
      hydrated.linkedIn,
      socialPipe.linkedIn || extra.linkedIn || personal.linkedinUrl,
    ),
    twitter: pickPreferred(hydrated.twitter, socialPipe.twitter || extra.twitter),
    xing: pickPreferred(socialPipe.xing, extra.xing),
    skypeId: pickPreferred(socialPipe.skypeId, extra.skypeId),
    facebook: pickPreferred(socialPipe.facebook, extra.facebook),
    stackOverflow: pickPreferred(socialPipe.stackOverflow, extra.stackOverflow),
    website: pickPreferred(hydrated.website, socialPipe.website || extra.website),
    portfolio: pickPreferred(hydrated.portfolio, extra.portfolio || socialPipe.website),
    remarks: pickPreferred(hydrated.remarks, professionalPipe.remarks || extra.remarks),
    currentSalary: pickPreferred(
      hydrated.currentSalary,
      prefs.currentSalary || extra.currentSalary || salary.current || salary.min,
    ),
    currentSalaryCurrency: preferReviewText(
      prefs.currentCurrency,
      professionalPipe.currentSalaryCurrency,
      extra.currentSalaryCurrency,
      salary.currency,
    ),
    currentBenefits: preferReviewText(
      prefs.currentBenefits,
      professionalPipe.currentBenefits,
      extra.currentBenefits,
    ),
    expectedSalary: pickPreferred(
      hydrated.expectedSalary,
      prefs.preferredSalary ||
        prefs.salaryAmount ||
        extra.expectedSalary ||
        salary.expected ||
        salary.max ||
        salary.amount,
    ),
    expectedSalaryCurrency: preferReviewText(
      prefs.preferredCurrency,
      prefs.salaryCurrency,
      professionalPipe.expectedSalaryCurrency,
      extra.expectedSalaryCurrency,
      salary.currency,
    ),
    expectedBenefits: preferReviewText(
      prefs.preferredBenefits,
      professionalPipe.expectedBenefits,
      extra.expectedBenefits,
    ),
    noticePeriod: pickPreferred(hydrated.noticePeriod, prefs.noticePeriod),
    workHistoryText: pickPreferred(
      summaryPipe.workHistory,
      extra.workHistoryText || extra.workHistory,
    ),
    extracurricular: formatListValue(
      professionalPipe.extracurricularActivities || extra.extracurricularActivities || extra.extracurricular,
    ),
    volunteers: formatListValue(professionalPipe.volunteers || extra.volunteers),
    p1CurrentRole: formatPrefValue(prefs.currentRole) || hydrated.currentTitle || hydrated.designation,
    p1PreferredJobTitles: formatPrefValue(prefs.preferredJobTitles || prefs.preferredRoles),
    p1PreferredIndustries: formatPrefValue(prefs.preferredIndustries || prefs.preferredIndustry),
    p1FunctionalAreas: formatPrefValue(prefs.functionalAreas || prefs.functionalArea),
    p1JobTypes: formatPrefValue(prefs.jobTypes),
    p1WorkModes: formatPrefValue(
      prefs.workModes ||
        prefs.preferredWorkMode ||
        prefs.passportNumbersByLocation?.__workModes,
    ),
    p1PreferredLocations: formatPrefValue(prefs.preferredLocations),
    p1Relocation: formatPrefValue(prefs.relocationPreference),
    p1AvailabilityToStart: formatPrefValue(prefs.availabilityToStart || hydrated.availability),
    certifications: formatListValue(hydrated.certifications),
    honours: formatListValue(summaryPipe.honoursAndAwards || extra.honoursAndAwards || extra.honours),
    projects: formatListValue(extra.projects),
    hackathons: formatListValue(extra.hackathons),
    notes: pickPreferred(hydrated.notes, hydrated.recruiterNotes),
    avatar: hydrated.avatar,
    candidateScore: pickPreferred(
      hydrated.candidateScore ?? hydrated.score,
      personalPipe.candidateScore,
    ),
    age: pickPreferred(hydrated.age, personalPipe.age),
  };
}

/**
 * Build a presentation-shaped editForm from tenant candidate data for section rendering.
 * When presentation is null, sections are built purely from the candidate record.
 */
export function enrichClientPresentationForReview(presentation, candidate) {
  const hydrated = candidateFromTenantDbForClientReview(candidate);
  const fromCandidate = buildEditFormFromCandidate(hydrated);
  if (!presentation) {
    return {
      editForm: fromCandidate,
      fields: {},
      visibleSections: null,
      visibleFields: null,
    };
  }

  const editForm =
    presentation.editForm && typeof presentation.editForm === 'object'
      ? { ...presentation.editForm }
      : {};

  for (const [key, value] of Object.entries(fromCandidate)) {
    editForm[key] = pickPreferred(value, editForm[key]);
  }

  return {
    ...presentation,
    editForm,
  };
}

const TENANT_PERSIST_STRING_KEYS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'linkedIn',
  'resume',
  'resumeUrl',
  'currentTitle',
  'currentCompany',
  'location',
  'address',
  'addressLine',
  'city',
  'country',
  'availability',
  'noticePeriod',
  'avatar',
  'designation',
  'education',
  'portfolio',
  'website',
  'notes',
  'cvSummary',
  'preferredLocation',
];

const TENANT_PERSIST_INT_KEYS = ['experience', 'expectedSalary', 'currentSalary'];
const TENANT_PERSIST_ARRAY_KEYS = ['skills', 'languages', 'certifications'];
const TENANT_PERSIST_JSON_KEYS = [
  'cvEducationEntries',
  'cvWorkExperienceEntries',
  'cvPortfolioLinks',
];

function toPersistInt(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const numeric = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? Math.round(numeric) : undefined;
}

function cloneJsonValue(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function synthesizePipelineForPersist(hydrated) {
  const {
    extra,
    personal,
    personalPipe,
    educationPipe,
    professionalPipe,
    socialPipe,
    summaryPipe,
    workPipe,
  } = extraProfileBag(hydrated);
  return {
    personal: {
      ...personalPipe,
      firstName: pickPreferred(personalPipe.firstName, hydrated.firstName || personal.firstName),
      lastName: pickPreferred(personalPipe.lastName, hydrated.lastName || personal.lastName),
      email: pickPreferred(personalPipe.email, hydrated.email || personal.email),
      age: pickPreferred(personalPipe.age, hydrated.age),
      state: pickPreferred(personalPipe.state, extra.state || hydrated.state),
      currentAddress: pickPreferred(
        personalPipe.currentAddress,
        hydrated.address || personal.address,
      ),
      zip: pickPreferred(personalPipe.zip, extra.zip || hydrated.zip),
      nationality: pickPreferred(
        personalPipe.nationality,
        extra.nationality || personal.nationality,
      ),
      currentCompanyWebsite: pickPreferred(
        personalPipe.currentCompanyWebsite,
        extra.currentCompanyWebsite,
      ),
      maritalStatus: pickPreferred(personalPipe.maritalStatus, extra.maritalStatus),
      birthDate: pickPreferred(
        personalPipe.birthDate,
        extra.dateOfBirth || extra.dob || personal.dob || hydrated.birthDate,
      ),
      passportNumber: pickPreferred(
        personalPipe.passportNumber,
        extra.passportNumber || personal.passportNumber,
      ),
      gender: pickPreferred(personalPipe.gender, extra.gender || personal.gender),
    },
    education: {
      ...educationPipe,
      entries: pickPreferred(educationPipe.entries, hydrated.cvEducationEntries) || [],
      courses: pickPreferred(educationPipe.courses, extra.courses) || [],
      summaryText: pickPreferred(educationPipe.summaryText, hydrated.education),
    },
    professional: { ...professionalPipe },
    social: {
      ...socialPipe,
      linkedIn: pickPreferred(socialPipe.linkedIn, hydrated.linkedIn),
      twitter: pickPreferred(socialPipe.twitter, extra.twitter),
      website: pickPreferred(socialPipe.website, hydrated.website),
    },
    summary: {
      ...summaryPipe,
      workHistory: pickPreferred(
        summaryPipe.workHistory,
        extra.workHistoryText || extra.workHistory,
      ),
      educationSummary: pickPreferred(summaryPipe.educationSummary, hydrated.education),
      honoursAndAwards: pickPreferred(
        summaryPipe.honoursAndAwards,
        extra.honoursAndAwards || extra.honours,
      ),
      languageProficiency: pickPreferred(
        summaryPipe.languageProficiency,
        extra.languageProficiency,
      ),
    },
    work: {
      ...workPipe,
      entries: pickPreferred(
        workPipe.entries || workPipe.workExperienceEntries,
        hydrated.cvWorkExperienceEntries,
      ) || [],
    },
  };
}

/**
 * Fill empty Phase 2 tenant columns / extraData from a hydrated review profile
 * (portal / candidatecommon / Phase 1 snapshot) without overwriting recruiter edits.
 */
export function buildTenantClientReviewPersistPatch(original, hydrated) {
  if (!original?.id || !hydrated) return null;
  const patch = {};

  for (const key of TENANT_PERSIST_STRING_KEYS) {
    if (!isNonEmptyValue(original[key]) && isNonEmptyValue(hydrated[key])) {
      patch[key] = String(hydrated[key]).trim();
    }
  }

  for (const key of TENANT_PERSIST_INT_KEYS) {
    if (!isNonEmptyValue(original[key])) {
      const next = toPersistInt(hydrated[key]);
      if (next !== undefined) patch[key] = next;
    }
  }

  for (const key of TENANT_PERSIST_ARRAY_KEYS) {
    if (!isNonEmptyValue(original[key]) && isNonEmptyValue(hydrated[key])) {
      patch[key] = Array.isArray(hydrated[key])
        ? hydrated[key]
        : asStringArray(hydrated[key]);
    }
  }

  for (const key of TENANT_PERSIST_JSON_KEYS) {
    if (!isNonEmptyValue(original[key]) && isNonEmptyValue(hydrated[key])) {
      patch[key] = cloneJsonValue(hydrated[key]);
    }
  }

  const origExtra = parseExtra(original.extraData);
  const hydExtra = parseExtra(hydrated.extraData);
  const nextExtra = { ...origExtra };
  let extraChanged = false;

  const liveSnap = resolveLivePhase1Snapshot(hydrated) || hydExtra.phase1ProfileSnapshot;
  if (!isNonEmptyValue(origExtra.phase1ProfileSnapshot) && isNonEmptyValue(liveSnap)) {
    nextExtra.phase1ProfileSnapshot = cloneJsonValue(liveSnap);
    extraChanged = true;
  }

  if (
    !isNonEmptyValue(origExtra.careerPreferences) &&
    isNonEmptyValue(hydrated.careerPreferences)
  ) {
    nextExtra.careerPreferences = cloneJsonValue(hydrated.careerPreferences);
    extraChanged = true;
  }

  if (!isNonEmptyValue(origExtra.pipeline)) {
    const pipeline = isNonEmptyValue(hydExtra.pipeline)
      ? hydExtra.pipeline
      : synthesizePipelineForPersist(hydrated);
    if (isNonEmptyValue(pipeline)) {
      nextExtra.pipeline = cloneJsonValue(pipeline);
      extraChanged = true;
    }
  } else {
    const hydratedPipeline = isNonEmptyValue(hydExtra.pipeline)
      ? hydExtra.pipeline
      : synthesizePipelineForPersist(hydrated);
    const tenantPipe = readPlainObject(origExtra.pipeline);
    const hydPipe = readPlainObject(hydratedPipeline);
    const mergedPipe = { ...hydPipe, ...tenantPipe };
    let pipeChanged = false;
    for (const key of Object.keys(hydPipe)) {
      const tenantSection = tenantPipe[key];
      const hydSection = hydPipe[key];
      if (
        hydSection &&
        typeof hydSection === 'object' &&
        !Array.isArray(hydSection) &&
        tenantSection &&
        typeof tenantSection === 'object' &&
        !Array.isArray(tenantSection)
      ) {
        const section = { ...hydSection, ...tenantSection };
        for (const field of Object.keys(hydSection)) {
          if (!isNonEmptyValue(section[field]) && isNonEmptyValue(hydSection[field])) {
            section[field] = hydSection[field];
            pipeChanged = true;
          }
        }
        mergedPipe[key] = section;
      } else if (!isNonEmptyValue(tenantSection) && isNonEmptyValue(hydSection)) {
        mergedPipe[key] = hydSection;
        pipeChanged = true;
      }
    }
    if (pipeChanged) {
      nextExtra.pipeline = cloneJsonValue(mergedPipe);
      extraChanged = true;
    }
  }

  if (extraChanged) {
    patch.extraData = nextExtra;
  }

  return Object.keys(patch).length ? patch : null;
}
