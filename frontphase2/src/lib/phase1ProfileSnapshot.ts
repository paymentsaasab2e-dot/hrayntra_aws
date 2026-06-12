import type { BackendCandidate } from './api';
import { readClientPresentation } from './clientPresentationDraft';
import { educationRecordToSnapshotRow } from './candidateEducationFields';
import { mergeCandidateWorkEntryLists } from './candidateExperience';
import { workExperienceRecordToSnapshotRow } from './candidateWorkExperienceFields';

export type Phase1ProfileSnapshot = {
  personalInfo?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    profilePhotoUrl?: string;
    phone?: string;
    phoneCode?: string;
    gender?: string;
    dob?: string;
    country?: string;
    city?: string;
    address?: string;
    nationality?: string;
    passportNumber?: string;
    employment?: string;
    linkedinUrl?: string;
  } | null;
  summaryText?: string;
  workExperience?: Array<Record<string, unknown>>;
  education?: Array<Record<string, unknown>>;
  skills?: Array<{ name?: string; proficiency?: string; category?: string }>;
  languages?: Array<{ name?: string; proficiency?: string }>;
  certifications?: Array<{
    id?: string;
    certificationName?: string;
    issuingOrganization?: string;
    issueDate?: string;
    expiryDate?: string;
    doesNotExpire?: boolean;
    credentialId?: string;
    credentialUrl?: string;
    certificateFile?: string;
    documents?: Array<Record<string, unknown>>;
    description?: string;
  }>;
  portfolioLinks?: Array<{ linkType?: string; type?: string; url?: string; title?: string }>;
  careerPreferences?: Record<string, unknown> | null;
  resume?: {
    fileName?: string;
    fileUrl?: string;
    atsScore?: number | null;
  } | null;
  gapExplanations?: Array<Record<string, unknown>>;
  internships?: Array<Record<string, unknown>>;
  accomplishments?: Array<Record<string, unknown>>;
  projects?: Array<Record<string, unknown>>;
  academicAchievements?: Array<Record<string, unknown>>;
  competitiveExams?: Array<Record<string, unknown>>;
  visaWorkAuthorization?: Record<string, unknown> | null;
  vaccination?: Record<string, unknown> | null;
};

export const PHASE1_CANDIDATE_TAG_LABEL = 'Phase 1';

export function isPhase1PortalCandidate(
  candidate?: {
    isPhase1Candidate?: boolean;
    source?: string | null;
    poolOrigin?: string | null;
    extraData?: Record<string, unknown> | null;
  } | null
): boolean {
  if (!candidate) return false;
  if (candidate.isPhase1Candidate) return true;
  const src = String(candidate.source || '').trim().toLowerCase();
  if (src === 'phase1') return true;
  const origin = String(candidate.poolOrigin || '').trim().toLowerCase();
  if (origin === 'phase1' || origin === 'phase1_common') return true;
  return Boolean(getPhase1ProfileSnapshot(candidate.extraData));
}

type ResumeSourceLike = {
  resume?: string | null;
  resumeUrl?: string | null;
  extraData?: Record<string, unknown> | null;
};

function isSaasaCvExportFile(
  file: { fileType?: string; fileUrl?: string | null; fileName?: string }
): boolean {
  const type = String(file.fileType || '').trim();
  if (/^SAASA_CV$/i.test(type)) return true;
  const name = String(file.fileName || file.fileUrl || '').trim();
  return /SAASA[\s_-]*CV/i.test(name);
}

/** Prefer newest Files-tab resume over stale snapshot URLs (never the SAASA CV export). */
export function pickLatestResumeFileUrl(
  files: Array<{ fileType?: string; fileUrl?: string | null; fileName?: string; uploadDate?: string }>
): string {
  const resumeFiles = files.filter((f) => {
    if (isSaasaCvExportFile(f)) return false;
    const url = String(f.fileUrl || '').trim();
    if (!url) return false;
    if (/^resume$/i.test(String(f.fileType || '').trim())) return true;
    return (
      /\.pdf($|[?#])/i.test(url) ||
      /\.docx?($|[?#])/i.test(url) ||
      /\/resumes\/|\/cv-files\//i.test(url)
    );
  });
  resumeFiles.sort((a, b) => {
    const ta = Date.parse(String(a.uploadDate || '')) || 0;
    const tb = Date.parse(String(b.uploadDate || '')) || 0;
    return tb - ta;
  });
  return String(resumeFiles[0]?.fileUrl || '').trim();
}

/** Best resume URL from API row + Phase 1 snapshot (used by drawer resume tab). */
export function resolveCandidateResumeUrlFromSources(
  candidate?: ResumeSourceLike | null,
  options?: { filesResumeUrl?: string | null }
): string {
  const fromFiles = String(options?.filesResumeUrl || '').trim();
  if (fromFiles) return fromFiles;

  if (!candidate) return '';
  const snap = getPhase1ProfileSnapshot(
    candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? candidate.extraData
      : null
  );
  const candidates = [
    candidate.resumeUrl,
    candidate.resume,
    snap?.resume?.fileUrl,
  ];
  for (const value of candidates) {
    const trimmed = String(value || '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

export function getPhase1ProfileSnapshot(
  extraData?: Record<string, unknown> | null
): Phase1ProfileSnapshot | null {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return null;
  const snap = extraData.phase1ProfileSnapshot;
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return null;
  return snap as Phase1ProfileSnapshot;
}

function mapEmploymentStatusLabel(status?: string | null): string {
  const raw = String(status || '').trim();
  if (!raw) return '';
  const key = raw.toUpperCase();
  const map: Record<string, string> = {
    EMPLOYED: 'Employed',
    UNEMPLOYED: 'Unemployed',
    FREELANCING: 'Freelancing',
    STUDENT: 'Student',
    OTHER: 'Other',
  };
  return map[key] || raw;
}

type PortfolioLinkLike = {
  linkType?: string;
  type?: string;
  url?: string;
  title?: string;
};

type PersonalInfoSource = {
  cvAddress?: string | null;
  cvCity?: string | null;
  cvCountry?: string | null;
  cvPortfolioLinks?: PortfolioLinkLike[] | null;
  email?: string | null;
  phone?: string | null;
  linkedIn?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  gender?: string | null;
  extraData?: Record<string, unknown> | null;
};

/** LinkedIn URL from snapshot / CV portfolio links when personalInfo.linkedinUrl is empty. */
export function resolveLinkedInFromPortfolioSources(
  snapshot?: Phase1ProfileSnapshot | null,
  links?: PortfolioLinkLike[] | null,
): string {
  const lists = [
    ...(Array.isArray(snapshot?.portfolioLinks) ? snapshot.portfolioLinks : []),
    ...(Array.isArray(links) ? links : []),
  ];
  for (const link of lists) {
    const url = String(link?.url || '').trim();
    if (!url) continue;
    const host = url.replace(/^https?:\/\//i, '').toLowerCase();
    if (host === 'gmail.com' || host === 'b.com') continue;
    const type = String(link?.linkType || link?.type || link?.title || '').toLowerCase();
    if (type.includes('linkedin') || /linkedin\.com/i.test(url)) return url;
  }
  return '';
}

/** When nationality is missing on first load, default it from country. */
export function resolveNationalityFromCountry(
  nationality: string | null | undefined,
  country: string | null | undefined,
): string | undefined {
  const nat = String(nationality || '').trim();
  if (nat) return nat;
  const cty = String(country || '').trim();
  return cty || undefined;
}

/** Merge snapshot personalInfo with candidate fallbacks for drawer view/edit. */
export function resolvePhase1PersonalInfo(
  snapshot: Phase1ProfileSnapshot | null | undefined,
  candidate: PersonalInfoSource,
): NonNullable<Phase1ProfileSnapshot['personalInfo']> {
  const pi = { ...(snapshot?.personalInfo || {}) };
  const extra =
    candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? candidate.extraData
      : {};

  if (!String(pi.employment || '').trim()) {
    pi.employment =
      mapEmploymentStatusLabel(
        (extra.employmentStatus as string | undefined) ||
          (extra.employment as string | undefined),
      ) || pi.employment;
  }
  if (!String(pi.nationality || '').trim()) {
    pi.nationality = String((extra.nationality as string | undefined) || '').trim() || pi.nationality;
  }
  if (!String(pi.passportNumber || '').trim()) {
    pi.passportNumber =
      String((extra.passportNumber as string | undefined) || '').trim() || pi.passportNumber;
  }
  if (!String(pi.address || '').trim()) {
    pi.address =
      String(candidate.cvAddress || candidate.address || '').trim() || pi.address;
  }
  if (!String(pi.city || '').trim()) {
    pi.city = String(candidate.cvCity || candidate.city || '').trim() || pi.city;
  }
  if (!String(pi.country || '').trim()) {
    pi.country = String(candidate.cvCountry || candidate.country || '').trim() || pi.country;
  }
  if (!String(pi.email || '').trim()) {
    pi.email = String(candidate.email || '').trim() || pi.email;
  }
  if (!String(pi.phone || '').trim()) {
    pi.phone = String(candidate.phone || '').trim() || pi.phone;
  }
  if (!String(pi.linkedinUrl || '').trim()) {
    pi.linkedinUrl =
      resolveLinkedInFromPortfolioSources(snapshot, candidate.cvPortfolioLinks) ||
      String(candidate.linkedIn || '').trim() ||
      pi.linkedinUrl;
  }
  if (!String(pi.gender || '').trim() && candidate.gender) {
    pi.gender = String(candidate.gender).trim();
  }

  const nationalityFromCountry = resolveNationalityFromCountry(
    pi.nationality,
    pi.country || candidate.cvCountry || candidate.country,
  );
  if (nationalityFromCountry) pi.nationality = nationalityFromCountry;

  return pi;
}

function patchSnapshotPersonalInfo(
  snapshot: Phase1ProfileSnapshot,
  candidate: PersonalInfoSource,
): Phase1ProfileSnapshot {
  return {
    ...snapshot,
    personalInfo: resolvePhase1PersonalInfo(snapshot, candidate),
  };
}

function mapWorkEntries(work: Phase1ProfileSnapshot['workExperience']) {
  if (!Array.isArray(work) || !work.length) return null;
  return work.map((w) => workExperienceRecordToSnapshotRow(w as Record<string, unknown>));
}

function mapEducationEntries(edu: Phase1ProfileSnapshot['education']) {
  if (!Array.isArray(edu) || !edu.length) return null;
  return edu.map((e) => educationRecordToSnapshotRow(e as Record<string, unknown>));
}

/** Fill sparse API rows with Phase 1 dashboard snapshot stored in candidatecommon. */
export function enrichBackendCandidateFromPhase1Snapshot(c: BackendCandidate): BackendCandidate {
  const snap = getPhase1ProfileSnapshot(
    c.extraData && typeof c.extraData === 'object' && !Array.isArray(c.extraData)
      ? (c.extraData as Record<string, unknown>)
      : null
  );
  if (!snap) return c;

  const pi = snap.personalInfo || {};
  const patchedSnap = patchSnapshotPersonalInfo(snap, c);
  const mergedPi = patchedSnap.personalInfo || pi;
  const work = mapWorkEntries(snap.workExperience);
  const edu = mapEducationEntries(snap.education);
  const skillRows = Array.isArray(snap.skills) ? snap.skills : [];
  const langRows = Array.isArray(snap.languages) ? snap.languages : [];
  const skillNames = skillRows.map((s) => String(s?.name || '').trim()).filter(Boolean);
  const languageNames = langRows.map((l) => String(l?.name || '').trim()).filter(Boolean);
  const certNames = Array.isArray(snap.certifications)
    ? snap.certifications.map((cert) => String(cert.certificationName || '').trim()).filter(Boolean)
    : [];

  const resumeUrl = snap.resume?.fileUrl || c.resume || c.resumeUrl || null;
  const latestWork = Array.isArray(snap.workExperience) ? snap.workExperience[0] : null;

  const snapNarrative = (snap as Phase1ProfileSnapshot & { cvWorkHistoryNarrative?: string })
    .cvWorkHistoryNarrative;
  const sourceExtra =
    c.extraData && typeof c.extraData === 'object' && !Array.isArray(c.extraData)
      ? (c.extraData as Record<string, unknown>)
      : {};
  const presentation = readClientPresentation(sourceExtra);
  const presentationLayout = presentation?.cvEditorLayout;
  const cvEditorPreserve: Record<string, unknown> = {};
  if (sourceExtra.cvEditorLayout && typeof sourceExtra.cvEditorLayout === 'object') {
    cvEditorPreserve.cvEditorLayout = sourceExtra.cvEditorLayout;
  } else if (sourceExtra.cvEditorLayout !== null && presentationLayout) {
    cvEditorPreserve.cvEditorLayout = presentationLayout;
  }
  if (sourceExtra.cvEditorContentSaved === true) {
    cvEditorPreserve.cvEditorContentSaved = true;
  }
  if (sourceExtra.cvEditorContentSavedAt) {
    cvEditorPreserve.cvEditorContentSavedAt = sourceExtra.cvEditorContentSavedAt;
  }
  if (sourceExtra.resumeCvViewMode) {
    cvEditorPreserve.resumeCvViewMode = sourceExtra.resumeCvViewMode;
  }
  if (sourceExtra.portalAiCvSaved === true) {
    cvEditorPreserve.portalAiCvSaved = true;
  }
  if (sourceExtra.portalAiCvSavedAt) {
    cvEditorPreserve.portalAiCvSavedAt = sourceExtra.portalAiCvSavedAt;
  }
  if (sourceExtra.portalTailoredCvHtml) {
    cvEditorPreserve.portalTailoredCvHtml = sourceExtra.portalTailoredCvHtml;
  }
  if (sourceExtra.portalStudioTemplateId) {
    cvEditorPreserve.portalStudioTemplateId = sourceExtra.portalStudioTemplateId;
  }
  if (sourceExtra.portalTailoredCv != null) {
    cvEditorPreserve.portalTailoredCv = sourceExtra.portalTailoredCv;
  }
  if (sourceExtra.recruiterCvEditorSaved === true) {
    cvEditorPreserve.recruiterCvEditorSaved = true;
  }
  if (sourceExtra.cvSubmission) cvEditorPreserve.cvSubmission = sourceExtra.cvSubmission;

  const mergedExtra: Record<string, unknown> = {
    ...sourceExtra,
    phase1ProfileSnapshot: {
      ...patchedSnap,
      personalInfo: {
        ...(patchedSnap.personalInfo || {}),
        employment:
          mergedPi.employment ||
          mapEmploymentStatusLabel(String((c.extraData as Record<string, unknown>)?.employmentStatus || '')) ||
          undefined,
        passportNumber:
          mergedPi.passportNumber ||
          String((c.extraData as Record<string, unknown>)?.passportNumber || '').trim() ||
          undefined,
        nationality:
          mergedPi.nationality ||
          String((c.extraData as Record<string, unknown>)?.nationality || '').trim() ||
          resolveNationalityFromCountry(
            undefined,
            mergedPi.country || c.country || c.cvCountry,
          ) ||
          undefined,
      },
    },
    phase1GapExplanations: snap.gapExplanations || [],
    phase1Internships: snap.internships || [],
    phase1Accomplishments: snap.accomplishments || [],
    ...(typeof snapNarrative === 'string' && snapNarrative.trim()
      ? { workHistory: snapNarrative.trim() }
      : {}),
    ...cvEditorPreserve,
  };

  const editorCvSaved = sourceExtra.cvEditorContentSaved === true;

  return {
    ...c,
    firstName: editorCvSaved ? (c.firstName ?? null) : c.firstName || mergedPi.firstName || c.firstName,
    lastName: editorCvSaved ? (c.lastName ?? null) : c.lastName || mergedPi.lastName || c.lastName,
    email: editorCvSaved ? (c.email ?? null) : c.email || mergedPi.email || c.email,
    phone: editorCvSaved ? (c.phone ?? null) : c.phone || mergedPi.phone || c.phone,
    linkedIn: editorCvSaved
      ? (c.linkedIn ?? null)
      : c.linkedIn ||
        mergedPi.linkedinUrl ||
        resolveLinkedInFromPortfolioSources(snap, c.cvPortfolioLinks) ||
        c.linkedIn,
    city: editorCvSaved ? (c.city ?? null) : c.city || mergedPi.city || c.city,
    country: editorCvSaved ? (c.country ?? null) : c.country || mergedPi.country || c.country,
    location: editorCvSaved
      ? (c.location ?? null)
      : c.location || [mergedPi.city, mergedPi.country].filter(Boolean).join(', ') || c.location || null,
    avatar: editorCvSaved
      ? (c.avatar ?? null)
      : c.avatar || mergedPi.profilePhotoUrl || null,
    currentTitle: editorCvSaved
      ? (c.currentTitle ?? null)
      : c.currentTitle ||
        (latestWork?.jobTitle as string) ||
        (latestWork?.title as string) ||
        c.currentTitle,
    currentCompany: editorCvSaved
      ? (c.currentCompany ?? null)
      : c.currentCompany ||
        (latestWork?.company as string) ||
        (latestWork?.companyName as string) ||
        c.currentCompany,
    cvSummary:
      sourceExtra.cvEditorContentSaved === true
        ? (c.cvSummary ?? null)
        : c.cvSummary || snap.summaryText || c.cvSummary,
    resume: resumeUrl,
    resumeUrl,
    skills: editorCvSaved
      ? Array.isArray(c.skills)
        ? c.skills
        : []
      : skillNames.length
        ? skillNames
        : c.skills,
    languages: languageNames.length ? languageNames : c.languages,
    recruiterLanguages: languageNames.length ? languageNames : (c as BackendCandidate & { recruiterLanguages?: string[] }).recruiterLanguages,
    noticePeriod:
      c.noticePeriod || (snap.careerPreferences?.noticePeriod as string) || null,
    availability:
      c.availability || (snap.careerPreferences?.availabilityToStart as string) || null,
    address: c.address || mergedPi.address || snap.personalInfo?.city || c.address,
    careerPreferences:
      c.careerPreferences || snap.careerPreferences
        ? ({
            ...((snap.careerPreferences as BackendCandidate['careerPreferences']) || {}),
            ...(c.careerPreferences || {}),
          } as BackendCandidate['careerPreferences'])
        : c.careerPreferences,
    certifications: certNames.length ? certNames : c.certifications,
    cvWorkExperienceEntries: (() => {
      const fromCv = Array.isArray(c.cvWorkExperienceEntries) ? c.cvWorkExperienceEntries : [];
      if (sourceExtra.cvEditorContentSaved === true) {
        return fromCv;
      }
      const fromSnap = Array.isArray(work) ? work : [];
      if (fromSnap.length && fromCv.length) {
        return mergeCandidateWorkEntryLists(fromSnap, fromCv);
      }
      if (fromSnap.length) return fromSnap;
      if (fromCv.length) return fromCv;
      return c.cvWorkExperienceEntries;
    })(),
    cvEducationEntries: (() => {
      const fromCv = Array.isArray(c.cvEducationEntries) ? c.cvEducationEntries : [];
      if (sourceExtra.cvEditorContentSaved === true) {
        return fromCv;
      }
      if (fromCv.length) return fromCv;
      if (Array.isArray(edu) && edu.length) return edu;
      return c.cvEducationEntries;
    })(),
    cvPortfolioLinks: (() => {
      const fromSnapshot = Array.isArray(snap.portfolioLinks) ? snap.portfolioLinks : [];
      if (isPhase1PortalCandidate(c) && fromSnapshot.length) {
        return fromSnapshot;
      }
      if (Array.isArray(c.cvPortfolioLinks) && c.cvPortfolioLinks.length) {
        return c.cvPortfolioLinks;
      }
      return fromSnapshot.length ? fromSnapshot : c.cvPortfolioLinks;
    })(),
    extraData: mergedExtra,
    ...(typeof snap.resume?.atsScore === 'number'
      ? { resumeAtsScore: snap.resume.atsScore }
      : {}),
  } as BackendCandidate & { resumeAtsScore?: number };
}
