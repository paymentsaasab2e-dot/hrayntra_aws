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
  CLIENT_PRESENTATION_KEY,
  readClientPresentation,
  type ClientPresentationStored,
} from './clientPresentationDraft';
import { mapCandidateProfile } from './mapCandidateProfile';
import {
  enrichBackendCandidateFromPhase1Snapshot,
  getPhase1ProfileSnapshot,
  resolvePhase1PersonalInfo,
  type Phase1ProfileSnapshot,
} from './phase1ProfileSnapshot';
import { prepareCareerPreferencesForSave } from './normalizeCareerPreferencesRecord';

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
          fieldOfStudy: e.field,
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
    clientReviewSections: buildPhase1ClientReviewSections(phase1Snapshot, phase1VisibleSections),
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
    return {
      ...cloneSnapshot(live),
      personalInfo: resolvePhase1PersonalInfo(live, profile),
      careerPreferences: mergedCareer,
    };
  }

  const nameParts = String(profile.name || '').trim().split(/\s+/).filter(Boolean);
  return {
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
      ? profile.cvWorkExperienceEntries.map((w) => ({
          jobTitle: w.title,
          company: w.company,
          workLocation: w.location,
          startDate: w.startDate,
          endDate: w.endDate,
          responsibilities: w.responsibilities,
        }))
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
  const snapshotForSave: Phase1ProfileSnapshot = {
    ...snapshot,
    careerPreferences: normalizedCareer,
  };

  const mergedExtra: Record<string, unknown> = {
    ...prev,
    phase1ProfileSnapshot: cloneSnapshot(snapshotForSave),
    phase1GapExplanations: snapshot.gapExplanations || [],
    phase1Internships: snapshot.internships || [],
    phase1Accomplishments: snapshot.accomplishments || [],
  };

  const preferredLocations = Array.isArray(normalizedCareer?.preferredLocations)
    ? (normalizedCareer.preferredLocations as string[])
    : [];

  const backendSeed = {
    id: profile.id,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    linkedIn: profile.linkedIn ?? null,
    currentTitle:
      ((normalizedCareer?.currentRole as string) || profile.currentTitle) ?? null,
    currentCompany: profile.currentCompany ?? null,
    location: ((normalizedCareer?.currentLocation as string) || profile.location) ?? null,
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
    extraData: mergedExtra,
  } as BackendCandidate;

  const enriched = enrichBackendCandidateFromPhase1Snapshot(backendSeed);
  const form = buildCandidateEditForm(mapCandidateProfile(enriched));
  const payload = buildUpdatePayloadFromEditForm(form, mergedExtra);

  return {
    ...payload,
    currentTitle: (normalizedCareer?.currentRole as string) || payload.currentTitle,
    designation: (normalizedCareer?.currentRole as string) || payload.designation,
    location: (normalizedCareer?.currentLocation as string) || payload.location,
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
    preferredLocation: preferredLocations[0] || payload.preferredLocation,
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
