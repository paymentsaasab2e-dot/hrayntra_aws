import type { BackendCandidate, UpdateCandidatePayload } from './api';
import {
  buildCandidateEditForm,
  buildClientPresentationFieldsPatch,
  buildUpdatePayloadFromEditForm,
  type CandidateEditFormState,
} from '../components/candidates/CandidateEditAtsSections';
import type { CandidateProfileDrawerData } from '../components/drawers/CandidateProfileDrawer';
import {
  DEFAULT_CLIENT_SECTION_VISIBILITY,
  normalizeClientSectionVisibility,
} from './clientPresentationSections';
import {
  buildPhase1ClientReviewSections,
  DEFAULT_PHASE1_CLIENT_SECTION_VISIBILITY,
  normalizePhase1ClientSectionVisibility,
  type Phase1ClientSectionVisibility,
} from './phase1ClientPresentationSections';
import {
  applySubmitToClientFieldVisibilityToReviewSections,
  parseSubmitToClientFieldVisibility,
  type SubmitToClientFieldVisibility,
} from './submitToClientFieldVisibility';
import {
  CLIENT_PRESENTATION_KEY,
  readClientPresentation,
  type ClientPresentationStored,
} from './clientPresentationDraft';
import { mapCandidateProfile } from './mapCandidateProfile';
import { workExperienceRecordToSnapshotRow } from './candidateWorkExperienceFields';
import {
  normalizeVaccinationRecord,
  vaccinationRecordToSnapshotRow,
} from './candidateVaccinationFields';
import {
  enrichBackendCandidateFromPhase1Snapshot,
  getPhase1ProfileSnapshot,
  resolvePhase1PersonalInfo,
  type Phase1ProfileSnapshot,
} from './phase1ProfileSnapshot';
import {
  accomplishmentHasContent,
  accomplishmentRecordToSnapshotRow,
  normalizeAccomplishmentRecord,
} from './candidateAccomplishmentFields';
import { prepareCareerPreferencesForSave } from './normalizeCareerPreferencesRecord';
import {
  extractVisaDisplayEntries,
  normalizeVisaEntryRecord,
  visaDisplayEntriesToSnapshot,
  visaEntryHasContent,
} from './candidateVisaWorkAuthorizationFields';

function parseExtra(extraData: unknown): Record<string, unknown> {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return {};
  return extraData as Record<string, unknown>;
}

function cloneSnapshot(snap: Phase1ProfileSnapshot): Phase1ProfileSnapshot {
  return JSON.parse(JSON.stringify(snap)) as Phase1ProfileSnapshot;
}

/** Seed Submit to Client editor from saved client copy or live Phase 1 snapshot. */
export function resolveSubmitPhase1Snapshot(candidate: BackendCandidate): Phase1ProfileSnapshot {
  const enriched = enrichBackendCandidateFromPhase1Snapshot(candidate);
  const saved = readClientPresentation(enriched.extraData)?.phase1Snapshot;
  if (saved) return cloneSnapshot(saved);

  const live = getPhase1ProfileSnapshot(enriched.extraData);
  if (live) return cloneSnapshot(live);

  return {
    personalInfo: {
      firstName: enriched.firstName || undefined,
      lastName: enriched.lastName || undefined,
      email: enriched.email || undefined,
      phone: enriched.phone || undefined,
      linkedinUrl: enriched.linkedIn || undefined,
      city: enriched.city || undefined,
      country: enriched.country || undefined,
      address: enriched.address || undefined,
    },
    summaryText: enriched.cvSummary || undefined,
    workExperience: Array.isArray(enriched.cvWorkExperienceEntries)
      ? (enriched.cvWorkExperienceEntries as Array<Record<string, unknown>>)
      : [],
    education: Array.isArray(enriched.cvEducationEntries)
      ? enriched.cvEducationEntries.map((e) => ({
          degreeProgram: e.degree,
          institutionName: e.institution,
          fieldOfStudy: (e as { field?: string }).field,
          startYear: e.startYear,
          endYear: e.endYear,
        }))
      : [],
    certifications: Array.isArray(enriched.certifications)
      ? enriched.certifications.map((name) => ({ certificationName: name }))
      : [],
  };
}

export function resolveSubmitPhase1SectionVisibility(
  candidate: BackendCandidate,
): Phase1ClientSectionVisibility {
  const saved = readClientPresentation(candidate.extraData)?.phase1VisibleSections;
  return normalizePhase1ClientSectionVisibility(saved);
}

export function buildClientPresentationExtraDataForPhase1(
  phase1Snapshot: Phase1ProfileSnapshot,
  candidate: BackendCandidate,
  existingExtraData?: Record<string, unknown> | null,
  options?: {
    phase1VisibleSections?: Partial<Phase1ClientSectionVisibility> | null;
    visibleFields?: Partial<SubmitToClientFieldVisibility> | null;
    cvEditorLayout?: Record<string, unknown> | null;
  },
): Record<string, unknown> {
  const prev = parseExtra(existingExtraData);
  const prior = readClientPresentation(existingExtraData);
  const phase1VisibleSections = normalizePhase1ClientSectionVisibility(
    options?.phase1VisibleSections ??
      prior?.phase1VisibleSections ??
      DEFAULT_PHASE1_CLIENT_SECTION_VISIBILITY,
  );
  const visibleSections = normalizeClientSectionVisibility(
    prior?.visibleSections ?? DEFAULT_CLIENT_SECTION_VISIBILITY,
  );
  const visibleFields = parseSubmitToClientFieldVisibility(
    options?.visibleFields ?? prior?.visibleFields,
  );

  const mergedExtra = {
    ...prev,
    phase1ProfileSnapshot: phase1Snapshot,
  };
  const enriched = enrichBackendCandidateFromPhase1Snapshot({
    ...candidate,
    extraData: mergedExtra,
  });
  const editForm: CandidateEditFormState = buildCandidateEditForm(mapCandidateProfile(enriched));

  const stored: ClientPresentationStored = {
    updatedAt: new Date().toISOString(),
    editForm,
    fields: buildClientPresentationFieldsPatch(editForm),
    cvEditorLayout: options?.cvEditorLayout ?? prior?.cvEditorLayout ?? null,
    visibleSections,
    visibleFields,
    clientReviewSections: applySubmitToClientFieldVisibilityToReviewSections(
      buildPhase1ClientReviewSections(phase1Snapshot, phase1VisibleSections),
      visibleFields,
    ),
    phase1Snapshot: cloneSnapshot(phase1Snapshot),
    phase1VisibleSections,
  };

  return {
    ...prev,
    [CLIENT_PRESENTATION_KEY]: stored,
  };
}

/** Profile drawer Client tab — overlay saved Phase 1 client copy. */
export function mergeProfileWithPhase1ClientPresentation(
  profile: CandidateProfileDrawerData,
): CandidateProfileDrawerData | null {
  const saved = readClientPresentation(profile.extraData);
  if (!saved?.phase1Snapshot) return null;
  return {
    ...profile,
    extraData: {
      ...(profile.extraData || {}),
      phase1ProfileSnapshot: saved.phase1Snapshot,
      phase1ClientSectionVisibility: saved.phase1VisibleSections,
    },
  };
}

/** Seed overview edit form from live Phase 1 snapshot or drawer profile fields. */
export function initPhase1EditSnapshotFromProfile(
  profile: CandidateProfileDrawerData,
): Phase1ProfileSnapshot {
  const live = getPhase1ProfileSnapshot(profile.extraData);
  if (live) {
    const mergedCareer = prepareCareerPreferencesForSave(
      {
        ...((live.careerPreferences as Record<string, unknown> | null) || {}),
        ...((profile.careerPreferences as Record<string, unknown> | null) || {}),
      },
      profile,
    );
    const accomplishmentRows =
      Array.isArray(live.accomplishments) && live.accomplishments.length
        ? live.accomplishments
        : Array.isArray(profile.extraData?.phase1Accomplishments)
          ? (profile.extraData.phase1Accomplishments as Array<Record<string, unknown>>)
          : [];

    return {
      ...cloneSnapshot(live),
      personalInfo: resolvePhase1PersonalInfo(live, profile),
      summaryText:
        String(live.summaryText || '').trim() ||
        profile.cvSummary ||
        profile.summary ||
        undefined,
      careerPreferences: mergedCareer,
      accomplishments: accomplishmentRows.map((row) =>
        accomplishmentRecordToSnapshotRow(normalizeAccomplishmentRecord(row)),
      ),
    };
  }

  const nameParts = String(profile.name || '').trim().split(/\s+/).filter(Boolean);
  const drafted: Phase1ProfileSnapshot = {
    personalInfo: {
      firstName: profile.firstName || nameParts[0] || undefined,
      lastName: profile.lastName || nameParts.slice(1).join(' ') || undefined,
      email: profile.email || undefined,
      phone: profile.phone || undefined,
      linkedinUrl: profile.linkedIn || undefined,
      city: profile.cvCity || undefined,
      country: profile.cvCountry || undefined,
      address: profile.cvAddress || undefined,
    },
    summaryText: profile.cvSummary || profile.summary || undefined,
    workExperience: Array.isArray(profile.cvWorkExperienceEntries)
      ? profile.cvWorkExperienceEntries.map((w) =>
          workExperienceRecordToSnapshotRow(w as Record<string, unknown>),
        )
      : [],
    education: Array.isArray(profile.cvEducationEntries)
      ? profile.cvEducationEntries.map((e) => ({
          degreeProgram: e.degree,
          institutionName: e.institution,
          startYear: e.startYear,
          endYear: e.endYear,
        }))
      : [],
    certifications: Array.isArray(profile.cvCertifications)
      ? profile.cvCertifications.map((name) => ({ certificationName: name }))
      : [],
    gapExplanations: Array.isArray(profile.extraData?.phase1GapExplanations)
      ? (profile.extraData.phase1GapExplanations as Array<Record<string, unknown>>)
      : [],
    internships: Array.isArray(profile.extraData?.phase1Internships)
      ? (profile.extraData.phase1Internships as Array<Record<string, unknown>>)
      : [],
    accomplishments: Array.isArray(profile.extraData?.phase1Accomplishments)
      ? (profile.extraData.phase1Accomplishments as Array<Record<string, unknown>>)
      : [],
    projects: Array.isArray(profile.extraData?.phase1Projects)
      ? (profile.extraData.phase1Projects as Array<Record<string, unknown>>)
      : [],
    academicAchievements: Array.isArray(profile.extraData?.phase1AcademicAchievements)
      ? (profile.extraData.phase1AcademicAchievements as Array<Record<string, unknown>>)
      : [],
    competitiveExams: Array.isArray(profile.extraData?.phase1CompetitiveExams)
      ? (profile.extraData.phase1CompetitiveExams as Array<Record<string, unknown>>)
      : [],
    visaWorkAuthorization:
      profile.extraData?.phase1VisaWorkAuthorization &&
      typeof profile.extraData.phase1VisaWorkAuthorization === 'object'
        ? (profile.extraData.phase1VisaWorkAuthorization as Record<string, unknown>)
        : null,
    vaccination:
      profile.extraData?.phase1Vaccination &&
      typeof profile.extraData.phase1Vaccination === 'object'
        ? (profile.extraData.phase1Vaccination as Record<string, unknown>)
        : null,
    skills: (profile.cvSkills || []).map((name) => ({
      name: String(name),
      proficiency: '',
      category: 'Hard Skills',
    })),
    languages: (profile.cvLanguages || []).map((raw) => {
      const text = String(raw).trim();
      const dash = text.match(/^(.+?)\s*[-–]\s*(.+)$/);
      return dash
        ? { name: dash[1].trim(), proficiency: dash[2].trim() }
        : { name: text, proficiency: '' };
    }),
    portfolioLinks: profile.cvPortfolioLinks?.length
      ? profile.cvPortfolioLinks.map((link) => ({
          type: link.type || link.label || 'Portfolio',
          url: link.url || '',
        }))
      : [],
    careerPreferences: prepareCareerPreferencesForSave(
      (profile.careerPreferences as Record<string, unknown> | null) || null,
      profile,
    ),
    resume: (() => {
      const fileUrl = profile.resumeUrl || profile.files?.[0]?.url || '';
      return {
        fileName: profile.files?.[0]?.name || (fileUrl ? 'Resume' : ''),
        fileUrl: fileUrl || undefined,
        atsScore:
          profile.aiScore?.source === 'resume_ats' ? profile.aiScore.overall : undefined,
      };
    })(),
  };
  return {
    ...drafted,
    personalInfo: resolvePhase1PersonalInfo(drafted, profile),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textOrPrevious(next: unknown, previous: unknown): unknown {
  if (next === undefined || next === null) return previous ?? null;
  const text = String(next).trim();
  return text || null;
}

function listOrPrevious(next: unknown, previous: unknown): unknown {
  if (next === undefined || next === null) return previous;
  const text = String(next).trim();
  if (!text) return [];
  return text
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Copy tenant-form fields stored on the Phase 1 profile into extraData.pipeline. */
export function mergeTenantOnlyFieldsIntoExtra(
  extra: Record<string, unknown>,
  personal?: Phase1ProfileSnapshot['personalInfo'] | null,
): Record<string, unknown> {
  const pi = personal || {};
  const pipeline = asRecord(extra.pipeline);
  const personalPipe = asRecord(pipeline.personal);
  const social = asRecord(pipeline.social);
  const professional = asRecord(pipeline.professional);
  const summary = asRecord(pipeline.summary);
  const education = asRecord(pipeline.education);
  const courses = listOrPrevious(pi.educationCourses, education.courses ?? professional.courses);

  return {
    ...extra,
    remarks: textOrPrevious(pi.remarks, extra.remarks),
    notes: textOrPrevious(pi.notes, extra.notes),
    hackathons: listOrPrevious(pi.hackathons, extra.hackathons),
    employmentStatus: textOrPrevious(pi.employment, extra.employmentStatus),
    pipeline: {
      ...pipeline,
      personal: {
        ...personalPipe,
        age: textOrPrevious(pi.age, personalPipe.age),
        candidateScore: textOrPrevious(pi.candidateScore, personalPipe.candidateScore),
        state: textOrPrevious(pi.state, personalPipe.state),
        zip: textOrPrevious(pi.zip, personalPipe.zip),
        maritalStatus: textOrPrevious(pi.maritalStatus, personalPipe.maritalStatus),
        currentCompanyWebsite: textOrPrevious(
          pi.currentCompanyWebsite,
          personalPipe.currentCompanyWebsite,
        ),
        phoneCode: textOrPrevious(pi.phoneCode, personalPipe.phoneCode),
        locationDisplay: textOrPrevious(pi.location, personalPipe.locationDisplay),
        preferredLocation: textOrPrevious(pi.preferredLocation, personalPipe.preferredLocation),
      },
      social: {
        ...social,
        twitter: textOrPrevious(pi.twitter, social.twitter),
        xing: textOrPrevious(pi.xing, social.xing),
        skypeId: textOrPrevious(pi.skypeId, social.skypeId),
        facebook: textOrPrevious(pi.facebook, social.facebook),
        stackOverflow: textOrPrevious(pi.stackOverflow, social.stackOverflow),
        website: textOrPrevious(pi.website, social.website),
      },
      professional: {
        ...professional,
        remarks: textOrPrevious(pi.remarks, professional.remarks),
        extracurricularActivities: listOrPrevious(
          pi.extracurricular,
          professional.extracurricularActivities,
        ),
        volunteers: listOrPrevious(pi.volunteers, professional.volunteers),
        courses,
      },
      summary: {
        ...summary,
        workHistory: textOrPrevious(pi.workHistoryText, summary.workHistory),
      },
      education: {
        ...education,
        courses,
      },
    },
  };
}

/** Keep Phase 1-only sections when a tenant-added candidate is saved from the ATS form. */
export function mergePhase1SectionsIntoExtra(
  extra: Record<string, unknown>,
  snapshot: Phase1ProfileSnapshot | null | undefined,
): Record<string, unknown> {
  if (!snapshot) return extra;
  const prevSnap = asRecord(extra.phase1ProfileSnapshot);
  const nextSnap: Phase1ProfileSnapshot = {
    ...(prevSnap as Phase1ProfileSnapshot),
    workExperience: snapshot.workExperience || (prevSnap.workExperience as Phase1ProfileSnapshot['workExperience']),
    education: snapshot.education || (prevSnap.education as Phase1ProfileSnapshot['education']),
    internships: snapshot.internships || [],
    gapExplanations: snapshot.gapExplanations || [],
    academicAchievements: snapshot.academicAchievements || [],
    competitiveExams: snapshot.competitiveExams || [],
    skills: snapshot.skills || (prevSnap.skills as Phase1ProfileSnapshot['skills']),
    projects: snapshot.projects || [],
    certifications: snapshot.certifications || (prevSnap.certifications as Phase1ProfileSnapshot['certifications']),
    visaWorkAuthorization: snapshot.visaWorkAuthorization || null,
    vaccination: snapshot.vaccination || null,
    _phase1SnapshotSavedAt: new Date().toISOString(),
  };
  return {
    ...extra,
    phase1ProfileSnapshot: nextSnap,
    phase1Internships: nextSnap.internships || [],
    phase1GapExplanations: nextSnap.gapExplanations || [],
    phase1AcademicAchievements: nextSnap.academicAchievements || [],
    phase1CompetitiveExams: nextSnap.competitiveExams || [],
    phase1Projects: nextSnap.projects || [],
  };
}

/** Persist Phase 1 overview edits to CRM candidate + phase1ProfileSnapshot. */
export function buildUpdatePayloadFromPhase1EditSnapshot(
  profile: CandidateProfileDrawerData,
  snapshot: Phase1ProfileSnapshot,
): UpdateCandidatePayload {
  const prev = parseExtra(profile.extraData);
  const normalizedCareer = prepareCareerPreferencesForSave(snapshot.careerPreferences, {
    currentTitle: profile.currentTitle,
    designation: profile.designation,
  });
  const visaSource =
    snapshot.visaWorkAuthorization && typeof snapshot.visaWorkAuthorization === 'object'
      ? (snapshot.visaWorkAuthorization as Record<string, unknown>)
      : null;
  const visaEditorEntries = Array.isArray(visaSource?.editorEntries)
    ? visaSource.editorEntries
    : visaSource
      ? extractVisaDisplayEntries(visaSource)
      : [];
  const visaForSave = visaSource
    ? visaDisplayEntriesToSnapshot(
        visaEditorEntries
          .map((row) => normalizeVisaEntryRecord(row as Record<string, unknown>))
          .filter((row) => visaEntryHasContent(row)),
        visaSource,
      )
    : null;

  const savedAccomplishments = (Array.isArray(snapshot.accomplishments) ? snapshot.accomplishments : [])
    .filter((row) => accomplishmentHasContent(row as Record<string, unknown>))
    .map((row) =>
      accomplishmentRecordToSnapshotRow(
        normalizeAccomplishmentRecord(row as Record<string, unknown>),
      ),
    );

  const snapshotForSave: Phase1ProfileSnapshot = {
    ...snapshot,
    careerPreferences: normalizedCareer,
    visaWorkAuthorization: visaForSave,
    accomplishments: savedAccomplishments,
    vaccination: snapshot.vaccination
      ? vaccinationRecordToSnapshotRow(
          normalizeVaccinationRecord(snapshot.vaccination as Record<string, unknown>),
        )
      : null,
  };

  const mergedExtra: Record<string, unknown> = mergeTenantOnlyFieldsIntoExtra(
    {
    ...prev,
    phase1ProfileSnapshot: {
      ...cloneSnapshot(snapshotForSave),
      _phase1SnapshotSavedAt: new Date().toISOString(),
    },
    phase1GapExplanations: snapshot.gapExplanations || [],
    phase1Internships: snapshot.internships || [],
    phase1Accomplishments: savedAccomplishments,
  },
    snapshot.personalInfo,
  );

  const preferredLocations = Array.isArray(normalizedCareer?.preferredLocations)
    ? (normalizedCareer.preferredLocations as string[])
    : [];

  const pi = snapshot.personalInfo || {};
  const editedFirstName = String(pi.firstName || '').trim();
  const editedMiddleName = String(pi.middleName || '').trim();
  const editedLastName = String(pi.lastName || '').trim();
  const editedEmail = String(pi.email || '').trim();
  const editedPhone = String(pi.phone || '').trim();
  const editedLinkedIn = String(pi.linkedinUrl || '').trim();

  const backendSeed = {
    id: profile.id,
    firstName: editedFirstName || profile.firstName || null,
    middleName: editedMiddleName || profile.middleName || null,
    lastName: editedLastName || profile.lastName || null,
    email: editedEmail || profile.email || null,
    phone: editedPhone || profile.phone || null,
    linkedIn: editedLinkedIn || profile.linkedIn || null,
    currentTitle:
      ((normalizedCareer?.currentRole as string) || profile.currentTitle) ?? null,
    currentCompany: profile.currentCompany ?? null,
    location:
      ((normalizedCareer?.currentLocation as string) ||
        [pi.city, pi.country].filter(Boolean).join(', ') ||
        profile.location) ?? null,
    stage: profile.stage ?? null,
    status: profile.status ?? null,
    source: profile.source ?? null,
    resume: profile.resumeUrl ?? null,
    noticePeriod: ((normalizedCareer?.noticePeriod as string) || profile.noticePeriod) ?? null,
    availability:
      ((normalizedCareer?.availabilityToStart as string) || profile.availability) ?? null,
    expectedSalary:
      normalizedCareer?.preferredSalary != null
        ? Number(normalizedCareer.preferredSalary)
        : profile.expectedSalaryValue ?? null,
    currentSalary:
      normalizedCareer?.currentSalary != null
        ? Number(normalizedCareer.currentSalary)
        : profile.currentSalaryValue ?? null,
    preferredLocation: preferredLocations[0] || profile.cvPreferredLocation || profile.location || null,
    city: String(pi.city || '').trim() || profile.cvCity || null,
    country: String(pi.country || '').trim() || profile.cvCountry || null,
    gender: String(pi.gender || '').trim() || profile.gender || null,
    extraData: mergedExtra,
  } as BackendCandidate;

  const enriched = enrichBackendCandidateFromPhase1Snapshot(backendSeed);
  const form = buildCandidateEditForm(mapCandidateProfile(enriched));
  const payload = buildUpdatePayloadFromEditForm(form, mergedExtra);
  const savedAt = new Date().toISOString();
  const previousExtra =
    payload.extraData && typeof payload.extraData === 'object' && !Array.isArray(payload.extraData)
      ? payload.extraData
      : {};
  const savedSnapshot = {
    ...snapshotForSave,
    _phase1SnapshotSavedAt: savedAt,
  };

  return {
    ...payload,
    extraData: {
      ...previousExtra,
      careerPreferences: normalizedCareer,
      phase1ProfileSnapshot: savedSnapshot,
      phase1Accomplishments: savedAccomplishments,
      phase1GapExplanations: snapshot.gapExplanations || [],
      phase1Internships: snapshot.internships || [],
    },
    firstName: editedFirstName || payload.firstName,
    lastName: editedLastName || payload.lastName,
    email: editedEmail || payload.email,
    phone: editedPhone || payload.phone,
    linkedIn: editedLinkedIn || payload.linkedIn,
    gender: String(pi.gender || '').trim() || payload.gender,
    middleName: editedMiddleName || payload.middleName,
    dateOfBirth:
      String(pi.dob || pi.dateOfBirth || '').trim() || payload.dateOfBirth || null,
    currentTitle: (normalizedCareer?.currentRole as string) || payload.currentTitle,
    designation: (normalizedCareer?.currentRole as string) || payload.designation,
    noticePeriod: (normalizedCareer?.noticePeriod as string) || payload.noticePeriod,
    availability: (normalizedCareer?.availabilityToStart as string) || payload.availability,
    expectedSalary:
      normalizedCareer?.preferredSalary != null
        ? Number(normalizedCareer.preferredSalary)
        : payload.expectedSalary,
    currentSalary:
      normalizedCareer?.currentSalary != null
        ? Number(normalizedCareer.currentSalary)
        : payload.currentSalary,
    preferredLocation:
      String(pi.preferredLocation || '').trim() ||
      preferredLocations[0] ||
      payload.preferredLocation,
    location:
      (normalizedCareer?.currentLocation as string) ||
      String(pi.location || '').trim() ||
      payload.location,
    website: String(pi.website || '').trim() || payload.website,
    notes: String(pi.notes || pi.remarks || '').trim() || payload.notes,
    salary: {
      currency:
        (normalizedCareer?.preferredCurrency as string) ||
        (normalizedCareer?.salaryCurrency as string) ||
        payload.salary?.currency ||
        'INR',
      min:
        normalizedCareer?.currentSalary != null
          ? Number(normalizedCareer.currentSalary)
          : payload.salary?.min ?? null,
      max:
        normalizedCareer?.preferredSalary != null
          ? Number(normalizedCareer.preferredSalary)
          : payload.salary?.max ?? null,
    },
  };
}
