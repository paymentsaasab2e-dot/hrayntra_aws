import type { UpdateCandidatePayload } from './api';
import type { BackendCandidate } from './api';
import {
  buildCandidateEditForm,
  buildClientPresentationFieldsPatch,
  type CandidateEditFormState,
} from '../components/candidates/CandidateEditAtsSections';
import type { CandidateProfileDrawerData } from '../components/drawers/CandidateProfileDrawer';
import { mapCandidateProfile } from './mapCandidateProfile';
import {
  buildClientReviewSections,
  DEFAULT_CLIENT_SECTION_VISIBILITY,
  normalizeClientSectionVisibility,
  type ClientReviewSection,
  type ClientSectionVisibility,
} from './clientPresentationSections';
import type { Phase1ProfileSnapshot } from './phase1ProfileSnapshot';
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

export const CLIENT_PRESENTATION_KEY = 'clientPresentation';

export type ClientPresentationStored = {
  updatedAt: string;
  editForm: CandidateEditFormState;
  fields: Omit<
    UpdateCandidatePayload,
    'assignedToId' | 'assignedJobs' | 'stage' | 'status' | 'source'
  >;
  cvEditorLayout?: Record<string, unknown> | null;
  visibleSections?: ClientSectionVisibility;
  visibleFields?: Record<string, boolean>;
  clientReviewSections?: ClientReviewSection[];
  /** Full Phase 1 portal profile copy for client submit (editable sections). */
  phase1Snapshot?: Phase1ProfileSnapshot | null;
  phase1VisibleSections?: Phase1ClientSectionVisibility;
};

function parseExtra(extraData: unknown): Record<string, unknown> {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return {};
  return extraData as Record<string, unknown>;
}

export function readClientPresentation(
  extraData: unknown
): ClientPresentationStored | null {
  const extra = parseExtra(extraData);
  const raw = extra[CLIENT_PRESENTATION_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const editForm = row.editForm as CandidateEditFormState | undefined;
  const fields = row.fields as ClientPresentationStored['fields'] | undefined;
  if (!editForm || !fields) return null;
  const visibleSections = normalizeClientSectionVisibility(
    row.visibleSections as Partial<ClientSectionVisibility> | undefined
  );
  const visibleFields = parseSubmitToClientFieldVisibility(row.visibleFields);
  const phase1Snapshot =
    row.phase1Snapshot && typeof row.phase1Snapshot === 'object' && !Array.isArray(row.phase1Snapshot)
      ? (row.phase1Snapshot as Phase1ProfileSnapshot)
      : null;
  const phase1VisibleSections = normalizePhase1ClientSectionVisibility(
    row.phase1VisibleSections as Partial<Phase1ClientSectionVisibility> | undefined,
  );
  const clientReviewSections: ClientReviewSection[] = applySubmitToClientFieldVisibilityToReviewSections(
    phase1Snapshot
      ? buildPhase1ClientReviewSections(phase1Snapshot, phase1VisibleSections)
      : Array.isArray(row.clientReviewSections)
        ? (row.clientReviewSections as ClientReviewSection[])
        : buildClientReviewSections(editForm, visibleSections),
    visibleFields,
  );
  return {
    updatedAt: String(row.updatedAt || ''),
    editForm,
    fields,
    cvEditorLayout:
      row.cvEditorLayout && typeof row.cvEditorLayout === 'object' && !Array.isArray(row.cvEditorLayout)
        ? (row.cvEditorLayout as Record<string, unknown>)
        : null,
    visibleSections,
    visibleFields,
    clientReviewSections,
    phase1Snapshot,
    phase1VisibleSections: phase1Snapshot ? phase1VisibleSections : undefined,
  };
}

export function buildClientPresentationExtraData(
  editForm: CandidateEditFormState,
  existingExtraData?: Record<string, unknown> | null,
  options?: {
    cvEditorLayout?: Record<string, unknown> | null;
    visibleSections?: Partial<ClientSectionVisibility> | null;
    visibleFields?: Partial<SubmitToClientFieldVisibility> | null;
  }
): Record<string, unknown> {
  const prev = parseExtra(existingExtraData);
  const prior = readClientPresentation(existingExtraData);
  const visibleSections = normalizeClientSectionVisibility(
    options?.visibleSections ?? prior?.visibleSections ?? DEFAULT_CLIENT_SECTION_VISIBILITY
  );
  const visibleFields = parseSubmitToClientFieldVisibility(
    options?.visibleFields ?? prior?.visibleFields,
  );
  const clientReviewSections = applySubmitToClientFieldVisibilityToReviewSections(
    buildClientReviewSections(editForm, visibleSections),
    visibleFields,
  );
  const stored: ClientPresentationStored = {
    updatedAt: new Date().toISOString(),
    editForm,
    fields: buildClientPresentationFieldsPatch(editForm),
    cvEditorLayout: options?.cvEditorLayout ?? prior?.cvEditorLayout ?? null,
    visibleSections,
    visibleFields,
    clientReviewSections,
  };
  return {
    ...prev,
    [CLIENT_PRESENTATION_KEY]: stored,
  };
}

/** Live preview for Submit to Client — same sections as the profile Client tab. */
export function buildSubmitPreviewProfile(
  editForm: CandidateEditFormState,
  baseProfile: CandidateProfileDrawerData,
  visibleSections?: Partial<ClientSectionVisibility> | null,
): CandidateProfileDrawerData {
  const extraData = buildClientPresentationExtraData(editForm, baseProfile.extraData ?? null, {
    visibleSections,
  });
  return (
    mergeProfileWithClientPresentation({
      ...baseProfile,
      extraData,
    }) ?? baseProfile
  );
}

/** Submit drawer: use saved client copy, or seed once from the live profile. */
export function resolveSubmitToClientEditForm(
  candidate: BackendCandidate,
  seed?: CandidateEditFormState | null
): CandidateEditFormState {
  const saved = readClientPresentation(candidate.extraData);
  if (saved?.editForm) return saved.editForm;
  const fromProfile = buildCandidateEditForm(mapCandidateProfile(candidate));
  if (!seed) return fromProfile;
  return {
    ...fromProfile,
    firstName: fromProfile.firstName || seed.firstName,
    lastName: fromProfile.lastName || seed.lastName,
    email: fromProfile.email || seed.email,
  };
}

function parseCsvSkills(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return undefined;
}

/** Profile drawer Client tab — overlay client-only fields onto the overview profile. */
export function mergeProfileWithClientPresentation(
  profile: CandidateProfileDrawerData
): CandidateProfileDrawerData | null {
  const saved = readClientPresentation(profile.extraData);
  if (!saved) return null;

  const f = saved.fields;
  const presentationExtra =
    f.extraData && typeof f.extraData === 'object' && !Array.isArray(f.extraData)
      ? (f.extraData as Record<string, unknown>)
      : {};
  const mergedExtra: Record<string, unknown> = {
    ...parseExtra(profile.extraData),
    ...presentationExtra,
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

  const first = (f.firstName as string | undefined) ?? profile.firstName;
  const last = (f.lastName as string | undefined) ?? profile.lastName;
  const name = `${first ?? ''} ${last ?? ''}`.trim() || profile.name;

  return {
    ...profile,
    name,
    firstName: first ?? profile.firstName,
    lastName: last ?? profile.lastName,
    email: (f.email as string | undefined) ?? profile.email,
    phone: (f.phone as string | undefined) ?? profile.phone,
    linkedIn: (f.linkedIn as string | undefined) ?? profile.linkedIn,
    currentTitle: (f.currentTitle as string | undefined) ?? profile.currentTitle,
    currentCompany: (f.currentCompany as string | undefined) ?? profile.currentCompany,
    designation: (f.designation as string | undefined) ?? profile.designation,
    experience:
      typeof f.experience === 'number' && Number.isFinite(f.experience)
        ? f.experience
        : profile.experience,
    location: (f.location as string | undefined) ?? profile.location,
    noticePeriod: (f.noticePeriod as string | undefined) ?? profile.noticePeriod,
    availability: (f.availability as string | undefined) ?? profile.availability,
    resumeUrl: (f.resume as string | undefined) ?? profile.resumeUrl,
    cvSummary: (f.cvSummary as string | undefined) ?? profile.cvSummary,
    cvAddress: (f.address as string | undefined) ?? profile.cvAddress,
    cvCity: (f.city as string | undefined) ?? profile.cvCity,
    cvCountry: (f.country as string | undefined) ?? profile.cvCountry,
    cvPreferredLocation: (f.preferredLocation as string | undefined) ?? profile.cvPreferredLocation,
    cvEducation: (f.education as string | undefined) ?? profile.cvEducation,
    cvSkills: parseCsvSkills(f.skills) ?? profile.cvSkills,
    cvLanguages: Array.isArray(f.languages) ? f.languages.map(String) : profile.cvLanguages,
    cvCertifications: Array.isArray(f.certifications)
      ? f.certifications.map(String)
      : profile.cvCertifications,
    cvEducationEntries: Array.isArray(f.cvEducationEntries)
      ? (f.cvEducationEntries as CandidateProfileDrawerData['cvEducationEntries'])
      : profile.cvEducationEntries,
    cvWorkExperienceEntries: Array.isArray(f.cvWorkExperienceEntries)
      ? (f.cvWorkExperienceEntries as CandidateProfileDrawerData['cvWorkExperienceEntries'])
      : profile.cvWorkExperienceEntries,
    cvPortfolioLinks: Array.isArray(f.cvPortfolioLinks)
      ? (f.cvPortfolioLinks as CandidateProfileDrawerData['cvPortfolioLinks'])
      : profile.cvPortfolioLinks,
    cvPortfolio: (f.portfolio as string | undefined) ?? profile.cvPortfolio,
    cvWebsite: (f.website as string | undefined) ?? profile.cvWebsite,
    cvNotes: (f.notes as string | undefined) ?? profile.cvNotes,
    expectedSalaryValue:
      typeof f.expectedSalary === 'number' && Number.isFinite(f.expectedSalary)
        ? f.expectedSalary
        : profile.expectedSalaryValue,
    currentSalaryValue:
      typeof f.currentSalary === 'number' && Number.isFinite(f.currentSalary)
        ? f.currentSalary
        : profile.currentSalaryValue,
    salaryCurrency:
      f.salary && typeof f.salary === 'object' && !Array.isArray(f.salary)
        ? String((f.salary as { currency?: string }).currency || profile.salaryCurrency || 'INR')
        : profile.salaryCurrency,
    extraData: mergedExtra,
  };
}

/** Merge client presentation onto a backend row (submit snapshot / public review). */
export function mergeBackendCandidateWithClientPresentation(
  candidate: BackendCandidate
): BackendCandidate {
  const saved = readClientPresentation(candidate.extraData);
  if (!saved) return candidate;

  const f = saved.fields;
  const baseExtra = parseExtra(candidate.extraData);
  const fieldExtra = parseExtra(f.extraData);
  const mergedExtra: Record<string, unknown> = {
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
    },
  };
  if (saved.cvEditorLayout) {
    mergedExtra.cvEditorLayout = saved.cvEditorLayout;
  }

  return {
    ...candidate,
    firstName: (f.firstName as string | undefined) ?? candidate.firstName,
    lastName: (f.lastName as string | undefined) ?? candidate.lastName,
    email: (f.email as string | undefined) ?? candidate.email,
    phone: (f.phone as string | undefined) ?? candidate.phone,
    linkedIn: (f.linkedIn as string | undefined) ?? candidate.linkedIn,
    currentTitle: (f.currentTitle as string | undefined) ?? candidate.currentTitle,
    currentCompany: (f.currentCompany as string | undefined) ?? candidate.currentCompany,
    designation: (f.designation as string | undefined) ?? candidate.designation,
    experience:
      typeof f.experience === 'number' && Number.isFinite(f.experience)
        ? f.experience
        : candidate.experience,
    location: (f.location as string | undefined) ?? candidate.location,
    address: (f.address as string | undefined) ?? candidate.address,
    city: (f.city as string | undefined) ?? candidate.city,
    country: (f.country as string | undefined) ?? candidate.country,
    noticePeriod: (f.noticePeriod as string | undefined) ?? candidate.noticePeriod,
    availability: (f.availability as string | undefined) ?? candidate.availability,
    resume: (f.resume as string | undefined) ?? candidate.resume,
    education: (f.education as string | undefined) ?? candidate.education,
    portfolio: (f.portfolio as string | undefined) ?? candidate.portfolio,
    website: (f.website as string | undefined) ?? candidate.website,
    cvSummary: (f.cvSummary as string | undefined) ?? candidate.cvSummary,
    notes: (f.notes as string | undefined) ?? candidate.notes,
    skills: Array.isArray(f.skills) ? f.skills.map(String) : candidate.skills,
    languages: Array.isArray(f.languages) ? f.languages.map(String) : candidate.languages,
    certifications: Array.isArray(f.certifications)
      ? f.certifications.map(String)
      : candidate.certifications,
    cvEducationEntries: Array.isArray(f.cvEducationEntries)
      ? f.cvEducationEntries
      : candidate.cvEducationEntries,
    cvWorkExperienceEntries: Array.isArray(f.cvWorkExperienceEntries)
      ? f.cvWorkExperienceEntries
      : candidate.cvWorkExperienceEntries,
    cvPortfolioLinks: Array.isArray(f.cvPortfolioLinks)
      ? f.cvPortfolioLinks
      : candidate.cvPortfolioLinks,
    preferredLocation: (f.preferredLocation as string | undefined) ?? candidate.preferredLocation,
    expectedSalary:
      typeof f.expectedSalary === 'number' && Number.isFinite(f.expectedSalary)
        ? f.expectedSalary
        : candidate.expectedSalary,
    currentSalary:
      typeof f.currentSalary === 'number' && Number.isFinite(f.currentSalary)
        ? f.currentSalary
        : candidate.currentSalary,
    salary:
      f.salary && typeof f.salary === 'object' && !Array.isArray(f.salary)
        ? (f.salary as BackendCandidate['salary'])
        : candidate.salary,
    extraData: mergedExtra,
  };
}
