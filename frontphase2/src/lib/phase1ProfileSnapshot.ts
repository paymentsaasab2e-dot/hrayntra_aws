import type { BackendCandidate } from './api';

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
  }>;
  portfolioLinks?: Array<{ type?: string; url?: string }>;
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

type PersonalInfoSource = {
  cvAddress?: string | null;
  cvCity?: string | null;
  cvCountry?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedIn?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  gender?: string | null;
  extraData?: Record<string, unknown> | null;
};

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
    pi.linkedinUrl = String(candidate.linkedIn || '').trim() || pi.linkedinUrl;
  }
  if (!String(pi.gender || '').trim() && candidate.gender) {
    pi.gender = String(candidate.gender).trim();
  }

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
  return work.map((w) => {
    const responsibilities = w.responsibilities;
    return {
      title: (w.jobTitle as string) || (w.title as string) || null,
      jobTitle: (w.jobTitle as string) || (w.title as string) || null,
      company: (w.company as string) || (w.companyName as string) || null,
      companyName: (w.company as string) || (w.companyName as string) || null,
      location: (w.workLocation as string) || (w.location as string) || null,
      startDate: (w.startDate as string) || null,
      endDate: (w.endDate as string) || null,
      responsibilities: Array.isArray(responsibilities)
        ? responsibilities
        : responsibilities
          ? [String(responsibilities)]
          : w.description
            ? [String(w.description)]
            : [],
    };
  });
}

function mapEducationEntries(edu: Phase1ProfileSnapshot['education']) {
  if (!Array.isArray(edu) || !edu.length) return null;
  return edu.map((e) => ({
    degree: (e.degreeProgram as string) || (e.degree as string) || null,
    institution: (e.institutionName as string) || (e.institution as string) || null,
    field: (e.fieldOfStudy as string) || (e.field as string) || null,
    startYear: (e.startYear as string) || null,
    endYear: (e.endYear as string) || null,
  }));
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
  const mergedExtra: Record<string, unknown> = {
    ...(c.extraData && typeof c.extraData === 'object' && !Array.isArray(c.extraData)
      ? (c.extraData as Record<string, unknown>)
      : {}),
    phase1ProfileSnapshot: patchedSnap,
    phase1GapExplanations: snap.gapExplanations || [],
    phase1Internships: snap.internships || [],
    phase1Accomplishments: snap.accomplishments || [],
    ...(typeof snapNarrative === 'string' && snapNarrative.trim()
      ? { workHistory: snapNarrative.trim() }
      : {}),
  };

  return {
    ...c,
    firstName: c.firstName || mergedPi.firstName || c.firstName,
    lastName: c.lastName || mergedPi.lastName || c.lastName,
    email: c.email || mergedPi.email || c.email,
    phone: c.phone || mergedPi.phone || c.phone,
    linkedIn: c.linkedIn || mergedPi.linkedinUrl || c.linkedIn,
    city: c.city || mergedPi.city || c.city,
    country: c.country || mergedPi.country || c.country,
    location:
      c.location || [mergedPi.city, mergedPi.country].filter(Boolean).join(', ') || c.location || null,
    avatar: c.avatar || mergedPi.profilePhotoUrl || null,
    currentTitle:
      c.currentTitle ||
      (latestWork?.jobTitle as string) ||
      (latestWork?.title as string) ||
      c.currentTitle,
    currentCompany:
      c.currentCompany ||
      (latestWork?.company as string) ||
      (latestWork?.companyName as string) ||
      c.currentCompany,
    cvSummary: c.cvSummary || snap.summaryText || c.cvSummary,
    resume: resumeUrl,
    resumeUrl,
    skills: skillNames.length ? skillNames : c.skills,
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
    cvWorkExperienceEntries:
      (Array.isArray(c.cvWorkExperienceEntries) && c.cvWorkExperienceEntries.length
        ? c.cvWorkExperienceEntries
        : work) || c.cvWorkExperienceEntries,
    cvEducationEntries:
      (Array.isArray(c.cvEducationEntries) && c.cvEducationEntries.length
        ? c.cvEducationEntries
        : edu) || c.cvEducationEntries,
    cvPortfolioLinks:
      (Array.isArray(c.cvPortfolioLinks) && c.cvPortfolioLinks.length
        ? c.cvPortfolioLinks
        : Array.isArray(snap.portfolioLinks) && snap.portfolioLinks.length
          ? snap.portfolioLinks
          : null) || c.cvPortfolioLinks,
    extraData: mergedExtra,
    ...(typeof snap.resume?.atsScore === 'number'
      ? { resumeAtsScore: snap.resume.atsScore }
      : {}),
  } as BackendCandidate & { resumeAtsScore?: number };
}
