import { filesApiUpload, type BackendCandidate } from './api';
import { formatEducationDateLine } from './candidateEducation';
import { extractApiData } from './mapCandidateProfile';

export interface CVEditorExperience {
  id: number;
  role: string;
  company: string;
  period: string;
  desc: string;
}

export interface CVEditorEducation {
  id: number;
  degree: string;
  school: string;
  period: string;
}

export type CvEditorSectionId = 'summary' | 'experience' | 'education' | 'skills';

export interface CvEditorImagePlacement {
  x: number;
  y: number;
}

export interface CvEditorWatermark {
  text: string;
  opacity: number;
  color: string;
  active: boolean;
}

/** Which CV version is sent to the client on Submit to Client */
export type CvShareMode = 'edited' | 'original';

/** Resume tab viewer in candidate drawer */
export type ResumeCvViewMode = 'original' | 'updated' | 'edited';

export interface CvSubmissionStored {
  shareMode: CvShareMode;
  updatedAt?: string;
}

/** Persisted under candidate.extraData.cvEditorLayout */
export interface CvEditorLayoutStored {
  companyLogoUrl?: string | null;
  initialCompanyLogoUrl?: string | null;
  candidatePhotoPos?: CvEditorImagePlacement;
  companyLogoPos?: CvEditorImagePlacement;
  showCandidatePhotoSlot?: boolean;
  showCompanyLogoSlot?: boolean;
  sectionOrder?: CvEditorSectionId[];
  watermark?: CvEditorWatermark;
  updatedAt?: string;
}

export interface CVEditorData {
  name: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  summary: string;
  experiences: CVEditorExperience[];
  education: CVEditorEducation[];
  skills: string[];
  candidatePhotoUrl?: string | null;
  initialCandidatePhotoUrl?: string | null;
  companyLogoUrl?: string | null;
  initialCompanyLogoUrl?: string | null;
  candidatePhotoPos?: CvEditorImagePlacement;
  companyLogoPos?: CvEditorImagePlacement;
  showCandidatePhotoSlot?: boolean;
  showCompanyLogoSlot?: boolean;
  sectionOrder?: CvEditorSectionId[];
  watermark?: CvEditorWatermark;
}

const DEFAULT_SECTION_ORDER: CvEditorSectionId[] = ['summary', 'experience', 'education', 'skills'];
const DEFAULT_CANDIDATE_PHOTO_POS: CvEditorImagePlacement = { x: 430, y: 36 };
const DEFAULT_COMPANY_LOGO_POS: CvEditorImagePlacement = { x: 430, y: 118 };
const DEFAULT_WATERMARK: CvEditorWatermark = {
  text: 'CONFIDENTIAL',
  opacity: 8,
  color: '#000000',
  active: false,
};

function resolveCandidatePhotoUrl(candidate: BackendCandidate | null): string | null {
  const extended = candidate as (BackendCandidate & { profilePhotoUrl?: string | null }) | null;
  for (const value of [extended?.avatar, extended?.profilePhotoUrl]) {
    const s = typeof value === 'string' ? value.trim() : '';
    if (s && /^https?:\/\//i.test(s)) return s;
  }
  return null;
}

export function readCvSubmission(candidate: BackendCandidate | null): CvSubmissionStored | null {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return null;
  const submission = (extra as Record<string, unknown>).cvSubmission;
  if (!submission || typeof submission !== 'object' || Array.isArray(submission)) return null;
  const mode = (submission as CvSubmissionStored).shareMode;
  if (mode !== 'edited' && mode !== 'original') return null;
  return submission as CvSubmissionStored;
}

export function hasEditedCvAvailable(candidate: BackendCandidate | null): boolean {
  if (!candidate) return false;
  if (readCvEditorLayout(candidate)?.updatedAt) return true;
  if (String(candidate.cvSummary || '').trim()) return true;
  if ((candidate.cvWorkExperienceEntries || []).length > 0) return true;
  if ((candidate.cvEducationEntries || []).length > 0) return true;
  return false;
}

/** Branded/layout CV from editor (logo, watermark, section order). */
export function hasCustomCvEditorLayout(candidate: BackendCandidate | null): boolean {
  const layout = readCvEditorLayout(candidate);
  if (!layout?.updatedAt) return false;
  if ((layout.companyLogoUrl || '').trim()) return true;
  if (layout.watermark?.active) return true;
  const order = layout.sectionOrder;
  if (order?.length && JSON.stringify(order) !== JSON.stringify(DEFAULT_SECTION_ORDER)) {
    return true;
  }
  if (layout.showCandidatePhotoSlot === false || layout.showCompanyLogoSlot === false) {
    return true;
  }
  return false;
}

/** CV content saved via the CV editor (not merely parsed upload fields). */
export function hasUpdatedCvFromEditor(candidate: BackendCandidate | null): boolean {
  if (!candidate) return false;
  if (readCvEditorLayout(candidate)?.updatedAt) return true;
  const extra = candidate.extraData;
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    return (extra as Record<string, unknown>).cvEditorContentSaved === true;
  }
  return false;
}

export function listAvailableResumeCvModes(
  candidate: BackendCandidate | null,
  resumeUrl?: string | null
): ResumeCvViewMode[] {
  const modes: ResumeCvViewMode[] = [];
  if (String(resumeUrl || candidate?.resume || candidate?.resumeUrl || '').trim()) {
    modes.push('original');
  }
  if (hasUpdatedCvFromEditor(candidate)) {
    modes.push('updated');
  }
  if (hasCustomCvEditorLayout(candidate)) {
    modes.push('edited');
  }
  return modes;
}

export function resolveDefaultResumeCvViewMode(
  candidate: BackendCandidate | null,
  resumeUrl?: string | null
): ResumeCvViewMode | null {
  const modes = listAvailableResumeCvModes(candidate, resumeUrl);
  if (modes.length === 0) return null;
  const extra = candidate?.extraData;
  const stored =
    extra && typeof extra === 'object' && !Array.isArray(extra)
      ? (extra as Record<string, unknown>).resumeCvViewMode
      : null;
  if (stored === 'original' || stored === 'updated' || stored === 'edited') {
    if (modes.includes(stored)) return stored;
  }
  if (modes.includes('edited')) return 'edited';
  if (modes.includes('updated')) return 'updated';
  return modes[0];
}

export function buildResumeCvViewExtra(
  existingExtraData: Record<string, unknown> | null | undefined,
  mode: ResumeCvViewMode
): Record<string, unknown> {
  const existing =
    existingExtraData && typeof existingExtraData === 'object' && !Array.isArray(existingExtraData)
      ? existingExtraData
      : {};
  return {
    ...existing,
    resumeCvViewMode: mode,
  };
}

export function resolveDefaultCvShareMode(
  candidate: BackendCandidate | null,
  hasOriginalResume: boolean
): CvShareMode | null {
  const stored = readCvSubmission(candidate);
  const hasEdited = hasEditedCvAvailable(candidate);
  if (stored?.shareMode === 'edited' && hasEdited) return 'edited';
  if (stored?.shareMode === 'original' && hasOriginalResume) return 'original';
  if (hasEdited) return 'edited';
  if (hasOriginalResume) return 'original';
  return null;
}

export function buildCvSubmissionExtra(
  existingExtraData: Record<string, unknown> | null | undefined,
  submission: CvSubmissionStored
): Record<string, unknown> {
  const existing =
    existingExtraData && typeof existingExtraData === 'object' && !Array.isArray(existingExtraData)
      ? existingExtraData
      : {};
  return {
    ...existing,
    cvSubmission: {
      ...submission,
      updatedAt: submission.updatedAt || new Date().toISOString(),
    },
  };
}

export function readCvEditorLayout(candidate: BackendCandidate | null): CvEditorLayoutStored | null {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return null;
  const layout = (extra as Record<string, unknown>).cvEditorLayout;
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return null;
  return layout as CvEditorLayoutStored;
}

export function dataUrlToFile(dataUrl: string, filename = 'profile-photo.png'): File | null {
  try {
    const [header, base64] = dataUrl.split(',');
    if (!base64) return null;
    const mime = header.match(/data:([^;]+)/)?.[1] || 'image/png';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('png') ? 'png' : 'png';
    return new File([bytes], filename.replace(/\.\w+$/, `.${ext}`), { type: mime });
  } catch {
    return null;
  }
}

async function uploadCandidateImage(
  dataUrl: string,
  candidateId: string,
  filename: string
): Promise<string> {
  const file = dataUrlToFile(dataUrl, filename);
  if (!file) throw new Error('Invalid image upload');
  const raw = await filesApiUpload('candidate', candidateId, file, 'Other');
  const uploaded = extractApiData<{ fileUrl?: string | null }>(raw);
  const url = (uploaded?.fileUrl || '').trim();
  if (!url) throw new Error('Image upload failed');
  return url;
}

async function resolveImageUrlForSave(
  current: string | null | undefined,
  initial: string | null | undefined,
  candidateId: string,
  filename: string
): Promise<string | null | undefined> {
  const cur = (current || '').trim() || null;
  const init = (initial || '').trim() || null;
  if (!cur && init) return null;
  if (cur?.startsWith('data:')) return uploadCandidateImage(cur, candidateId, filename);
  if (cur?.startsWith('http')) return cur;
  if (!cur) return null;
  return undefined;
}

/** Avatar patch for apiUpdateCandidate after CV editor save. */
export async function buildCvEditorAvatarPatch(
  data: CVEditorData,
  candidateId: string
): Promise<{ avatar?: string | null }> {
  const resolved = await resolveImageUrlForSave(
    data.candidatePhotoUrl,
    data.initialCandidatePhotoUrl,
    candidateId,
    'candidate-photo.png'
  );
  if (resolved === undefined) return {};
  return { avatar: resolved };
}

export function buildCvEditorLayoutStored(data: CVEditorData): CvEditorLayoutStored {
  const companyLogoUrl =
    data.showCompanyLogoSlot === false
      ? null
      : (data.companyLogoUrl || '').trim() || null;
  return {
    companyLogoUrl,
    initialCompanyLogoUrl: companyLogoUrl,
    candidatePhotoPos: data.candidatePhotoPos ?? DEFAULT_CANDIDATE_PHOTO_POS,
    companyLogoPos: data.companyLogoPos ?? DEFAULT_COMPANY_LOGO_POS,
    showCandidatePhotoSlot: data.showCandidatePhotoSlot !== false,
    showCompanyLogoSlot: data.showCompanyLogoSlot !== false,
    sectionOrder: data.sectionOrder?.length ? data.sectionOrder : DEFAULT_SECTION_ORDER,
    watermark: data.watermark ?? DEFAULT_WATERMARK,
    updatedAt: new Date().toISOString(),
  };
}

/** Merge cv editor layout + uploads into candidate patch (extraData + avatar). */
export async function buildCvEditorPersistPatch(
  data: CVEditorData,
  candidateId: string,
  existingExtraData?: Record<string, unknown> | null
): Promise<{ extraData: Record<string, unknown>; avatar?: string | null }> {
  const avatarPatch = await buildCvEditorAvatarPatch(data, candidateId);

  let companyLogoUrl: string | null | undefined;
  if (data.showCompanyLogoSlot === false) {
    companyLogoUrl = null;
  } else {
    companyLogoUrl = await resolveImageUrlForSave(
      data.companyLogoUrl,
      data.initialCompanyLogoUrl,
      candidateId,
      'company-logo.png'
    );
    if (companyLogoUrl === undefined) {
      companyLogoUrl = (data.companyLogoUrl || '').trim() || null;
    }
  }

  const layout = buildCvEditorLayoutStored({
    ...data,
    companyLogoUrl: companyLogoUrl ?? null,
    initialCompanyLogoUrl: companyLogoUrl ?? null,
    candidatePhotoUrl:
      avatarPatch.avatar !== undefined
        ? avatarPatch.avatar
        : (data.candidatePhotoUrl || '').trim() || null,
    initialCandidatePhotoUrl:
      avatarPatch.avatar !== undefined
        ? avatarPatch.avatar
        : data.initialCandidatePhotoUrl ?? data.candidatePhotoUrl ?? null,
  });

  const existing =
    existingExtraData && typeof existingExtraData === 'object' && !Array.isArray(existingExtraData)
      ? existingExtraData
      : {};

  return {
    ...avatarPatch,
    extraData: {
      ...existing,
      cvEditorLayout: layout,
      cvEditorContentSaved: true,
      cvEditorContentSavedAt: new Date().toISOString(),
    },
  };
}

let _cvEditorId = 1;
const nextCvEditorId = () => ++_cvEditorId;

function formatPeriod(start?: string | null, end?: string | null): string {
  const parts = [start, end].map((v) => String(v || '').trim()).filter(Boolean);
  return parts.join(' – ');
}

function formatYearPeriod(startYear?: string | null, endYear?: string | null): string {
  return formatPeriod(startYear, endYear);
}

function splitPeriod(period: string): { start: string; end: string } {
  const parts = String(period || '')
    .split(/\s*[–—-]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return { start: parts[0], end: parts.slice(1).join(' – ') };
  if (parts.length === 1) return { start: parts[0], end: '' };
  return { start: '', end: '' };
}

export function candidateToCvEditorData(
  candidate: BackendCandidate | null,
  formOverrides?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    linkedIn?: string;
    currentTitle?: string;
    location?: string;
    cvSummary?: string;
    skills?: string;
  }
): CVEditorData {
  const firstName = formOverrides?.firstName ?? candidate?.firstName ?? '';
  const lastName = formOverrides?.lastName ?? candidate?.lastName ?? '';
  const skillsFromForm = formOverrides?.skills
    ? formOverrides.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const experiences = (candidate?.cvWorkExperienceEntries || []).map((entry) => ({
    id: nextCvEditorId(),
    role: entry.title || '',
    company: entry.company || '',
    period: formatPeriod(entry.startDate, entry.endDate),
    desc: (entry.responsibilities || []).join('\n'),
  }));

  const education = (candidate?.cvEducationEntries || []).map((entry) => {
    const ext = entry as {
      educationLevel?: string;
      startMonth?: string;
      endMonth?: string;
      currentlyStudying?: boolean;
      period?: string;
    };
    const period =
      (ext.period && String(ext.period).trim()) ||
      formatEducationDateLine(
        ext.educationLevel || '',
        entry.degree || '',
        entry.startYear || '',
        ext.startMonth || '',
        entry.endYear || '',
        ext.endMonth || '',
        Boolean(ext.currentlyStudying),
      ) ||
      formatYearPeriod(entry.startYear, entry.endYear);
    return {
      id: nextCvEditorId(),
      degree: entry.degree || '',
      school: entry.institution || '',
      period,
    };
  });

  const layout = readCvEditorLayout(candidate);
  const candidatePhotoUrl = resolveCandidatePhotoUrl(candidate);
  const companyLogoUrl =
    (layout?.companyLogoUrl && String(layout.companyLogoUrl).trim()) || null;

  return {
    name: `${firstName} ${lastName}`.trim() || 'Candidate',
    jobTitle: formOverrides?.currentTitle ?? candidate?.currentTitle ?? '',
    email: formOverrides?.email ?? candidate?.email ?? '',
    phone: formOverrides?.phone ?? candidate?.phone ?? '',
    location: formOverrides?.location ?? candidate?.location ?? '',
    linkedin: formOverrides?.linkedIn ?? candidate?.linkedIn ?? '',
    summary: formOverrides?.cvSummary ?? candidate?.cvSummary ?? '',
    experiences: experiences.length > 0 ? experiences : [],
    education: education.length > 0 ? education : [],
    skills: skillsFromForm ?? candidate?.skills ?? [],
    candidatePhotoUrl,
    initialCandidatePhotoUrl: candidatePhotoUrl,
    companyLogoUrl,
    initialCompanyLogoUrl: layout?.initialCompanyLogoUrl ?? companyLogoUrl,
    candidatePhotoPos: layout?.candidatePhotoPos ?? DEFAULT_CANDIDATE_PHOTO_POS,
    companyLogoPos: layout?.companyLogoPos ?? DEFAULT_COMPANY_LOGO_POS,
    showCandidatePhotoSlot: layout?.showCandidatePhotoSlot !== false,
    showCompanyLogoSlot: layout?.showCompanyLogoSlot !== false,
    sectionOrder: layout?.sectionOrder?.length ? layout.sectionOrder : DEFAULT_SECTION_ORDER,
    watermark: layout?.watermark ?? DEFAULT_WATERMARK,
  };
}

export function cvEditorDataToCandidatePatch(data: CVEditorData) {
  const nameParts = data.name.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ');

  return {
    firstName,
    lastName,
    email: data.email.trim(),
    phone: data.phone.trim() || undefined,
    linkedIn: data.linkedin.trim() || undefined,
    currentTitle: data.jobTitle.trim() || undefined,
    location: data.location.trim() || undefined,
    cvSummary: data.summary.trim() || undefined,
    skills: data.skills.map((s) => s.trim()).filter(Boolean),
    cvWorkExperienceEntries: data.experiences.map((exp) => {
      const { start, end } = splitPeriod(exp.period);
      return {
        title: exp.role.trim() || undefined,
        company: exp.company.trim() || undefined,
        startDate: start || undefined,
        endDate: end || undefined,
        responsibilities: exp.desc
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      };
    }),
    cvEducationEntries: data.education.map((edu) => {
      const { start, end } = splitPeriod(edu.period);
      return {
        degree: edu.degree.trim() || undefined,
        institution: edu.school.trim() || undefined,
        startYear: start || undefined,
        endYear: end || undefined,
      };
    }),
  };
}
