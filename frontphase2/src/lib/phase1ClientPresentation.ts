import type { BackendCandidate } from './api';
import {
  buildCandidateEditForm,
  buildClientPresentationFieldsPatch,
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
  type Phase1ProfileSnapshot,
} from './phase1ProfileSnapshot';

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
