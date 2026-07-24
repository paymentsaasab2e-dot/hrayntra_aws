import { filesApiUpload, type BackendCandidate } from './api';
import { CLIENT_PRESENTATION_KEY, readClientPresentation } from './clientPresentationDraft';
import {
  buildSaasaCvAnnotationsExtra,
  readSaasaCvAnnotations,
  type SaasaCvAnnotationsStored,
} from './saasaCvAnnotations';
import { formatEducationDateLine } from './candidateEducation';
import { extractApiData } from './mapCandidateProfile';
import { normalizeCvTemplateId, type CvEditorTemplateId } from './cvEditorTemplates';

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

export interface CvEditorImageSize {
  width: number;
  height: number;
}

export interface CvEditorWatermark {
  text: string;
  opacity: number;
  color: string;
  active: boolean;
}

/** Which CV version is sent to the client on Submit to Client */
export type CvShareMode = 'edited' | 'original' | 'saasa';

/** Resume tab viewer in candidate drawer */
export type ResumeCvViewMode = 'original' | 'saasa' | 'ai' | 'updated' | 'edited';

export interface CvSubmissionStored {
  shareMode: CvShareMode;
  updatedAt?: string;
}

/** Persisted under candidate.extraData.cvEditorLayout */
export interface CvEditorLayoutStored {
  candidatePhotoUrl?: string | null;
  initialCandidatePhotoUrl?: string | null;
  companyLogoUrl?: string | null;
  initialCompanyLogoUrl?: string | null;
  candidatePhotoPos?: CvEditorImagePlacement;
  companyLogoPos?: CvEditorImagePlacement;
  candidatePhotoSize?: CvEditorImageSize;
  companyLogoSize?: CvEditorImageSize;
  showCandidatePhotoSlot?: boolean;
  showCompanyLogoSlot?: boolean;
  sectionOrder?: CvEditorSectionId[];
  watermark?: CvEditorWatermark;
  templateId?: CvEditorTemplateId;
  portalStudioTemplateId?: string;
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
  candidatePhotoSize?: CvEditorImageSize;
  companyLogoSize?: CvEditorImageSize;
  showCandidatePhotoSlot?: boolean;
  showCompanyLogoSlot?: boolean;
  sectionOrder?: CvEditorSectionId[];
  watermark?: CvEditorWatermark;
  templateId?: CvEditorTemplateId;
}

const DEFAULT_SECTION_ORDER: CvEditorSectionId[] = ['summary', 'experience', 'education', 'skills'];
const DEFAULT_CANDIDATE_PHOTO_POS: CvEditorImagePlacement = { x: 430, y: 36 };
const DEFAULT_COMPANY_LOGO_POS: CvEditorImagePlacement = { x: 332, y: 108 };
export const DEFAULT_CANDIDATE_PHOTO_SIZE: CvEditorImageSize = { width: 72, height: 72 };
export const DEFAULT_COMPANY_LOGO_SIZE: CvEditorImageSize = { width: 140, height: 64 };

export function normalizeCandidatePhotoSize(
  size?: Partial<CvEditorImageSize> | null
): CvEditorImageSize {
  const n = Math.round(
    Math.min(132, Math.max(48, Number(size?.width ?? size?.height ?? DEFAULT_CANDIDATE_PHOTO_SIZE.width)))
  );
  return { width: n, height: n };
}

export function normalizeCompanyLogoSize(
  size?: Partial<CvEditorImageSize> | null
): CvEditorImageSize {
  return {
    width: Math.round(
      Math.min(220, Math.max(72, Number(size?.width ?? DEFAULT_COMPANY_LOGO_SIZE.width)))
    ),
    height: Math.round(
      Math.min(120, Math.max(32, Number(size?.height ?? DEFAULT_COMPANY_LOGO_SIZE.height)))
    ),
  };
}
const DEFAULT_WATERMARK: CvEditorWatermark = {
  text: 'CONFIDENTIAL',
  opacity: 8,
  color: '#000000',
  active: false,
};

function resolveCandidatePhotoUrl(candidate: BackendCandidate | null): string | null {
  const extended = candidate as (BackendCandidate & { profilePhotoUrl?: string | null }) | null;
  const layout = readCvEditorLayout(candidate);
  for (const value of [
    extended?.avatar,
    extended?.profilePhotoUrl,
    layout?.candidatePhotoUrl,
    layout?.initialCandidatePhotoUrl,
  ]) {
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
  if (mode !== 'edited' && mode !== 'original' && mode !== 'saasa') return null;
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
  const extra = candidate.extraData;
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    return (extra as Record<string, unknown>).cvEditorContentSaved === true;
  }
  return false;
}

/** Role-tailored CV submitted from the job portal LMS editor on apply. */
export function hasPortalAiCv(candidate: BackendCandidate | null): boolean {
  if (readPortalTailoredCvHtml(candidate)) return true;
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return false;
  const row = extra as Record<string, unknown>;
  if (row.portalAiCvSaved === true) return true;
  const portalMeta = row.portalTailoredCv;
  if (portalMeta && typeof portalMeta === 'object' && !Array.isArray(portalMeta)) {
    if ((portalMeta as Record<string, unknown>).hasStudioHtml === true) return true;
  }
  return false;
}

/** Recruiter saved CV via Phase 2 editor (distinct from portal AI apply). */
export function hasRecruiterCvEditorSave(candidate: BackendCandidate | null): boolean {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return false;
  if ((extra as Record<string, unknown>).recruiterCvEditorSaved === true) return true;
  if (hasUpdatedCvFromEditor(candidate) && !hasPortalAiCv(candidate)) return true;
  if (hasCustomCvEditorLayout(candidate) && !hasPortalAiCv(candidate)) return true;
  return false;
}

/** Single Resume-tab “Updated CV” (recruiter editor content and/or branded layout). */
export function hasResumeTabUpdatedCv(candidate: BackendCandidate | null): boolean {
  if (hasPortalAiCv(candidate) && !hasRecruiterCvEditorSave(candidate)) return false;
  return hasUpdatedCvFromEditor(candidate) || hasCustomCvEditorLayout(candidate);
}

/** Full studio preview HTML synced from Phase 1 tailor apply. */
export function readPortalTailoredCvHtml(candidate: BackendCandidate | null): string | null {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return null;
  const html = (extra as Record<string, unknown>).portalTailoredCvHtml;
  return typeof html === 'string' && html.trim().length > 80 ? html.trim() : null;
}

export function readPortalStudioTemplateId(candidate: BackendCandidate | null): string | null {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return null;
  const fromExtra = (extra as Record<string, unknown>).portalStudioTemplateId;
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  const layout = readCvEditorLayout(candidate);
  const fromLayout = layout?.portalStudioTemplateId;
  return typeof fromLayout === 'string' && fromLayout.trim() ? fromLayout.trim() : null;
}

/** Saved HRYantra CV export (PNG/PDF in Files) is available for the Resume tab. */
export function hasSaasaCvResumeTabMode(candidate: BackendCandidate | null): boolean {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return false;
  const stored = readSaasaCvAnnotations(extra as Record<string, unknown>);
  return Boolean(stored?.fileUrl?.trim() || stored?.fileId);
}

/** Recruiter CV editor keys that must survive HRYantra CV saves and partial drawer refreshes. */
export function pickRecruiterCvExtraFieldsFrontend(
  extraData: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return {};
  const picked: Record<string, unknown> = {};
  if (extraData.cvEditorContentSaved === true) picked.cvEditorContentSaved = true;
  if (extraData.cvEditorContentSavedAt) {
    picked.cvEditorContentSavedAt = extraData.cvEditorContentSavedAt;
  }
  if (extraData.cvEditorLayout != null) picked.cvEditorLayout = extraData.cvEditorLayout;
  if (extraData.cvSubmission != null) picked.cvSubmission = extraData.cvSubmission;
  if (extraData.portalTailoredCvHtml) picked.portalTailoredCvHtml = extraData.portalTailoredCvHtml;
  if (extraData.portalStudioTemplateId) picked.portalStudioTemplateId = extraData.portalStudioTemplateId;
  if (extraData.portalTailoredCv != null) picked.portalTailoredCv = extraData.portalTailoredCv;
  if (extraData.portalAiCvSaved === true) picked.portalAiCvSaved = true;
  if (extraData.recruiterCvEditorSaved === true) picked.recruiterCvEditorSaved = true;
  return picked;
}

/** Merge drawer + backend extraData without dropping Updated CV metadata. */
export function mergeResumeTabExtraData(
  drawerExtra: Record<string, unknown>,
  backendExtra: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...drawerExtra, ...backendExtra };
  const recruiter = pickRecruiterCvExtraFieldsFrontend({
    ...drawerExtra,
    ...backendExtra,
    cvEditorContentSaved:
      drawerExtra.cvEditorContentSaved === true || backendExtra.cvEditorContentSaved === true
        ? true
        : merged.cvEditorContentSaved,
    cvEditorContentSavedAt:
      backendExtra.cvEditorContentSavedAt ?? drawerExtra.cvEditorContentSavedAt,
    cvEditorLayout: backendExtra.cvEditorLayout ?? drawerExtra.cvEditorLayout,
    cvSubmission: backendExtra.cvSubmission ?? drawerExtra.cvSubmission,
  });
  return { ...merged, ...recruiter };
}

/** Save HRYantra CV annotations without clearing recruiter CV editor state. */
export function buildSaasaCvSaveExtra(
  existingExtraData: Record<string, unknown> | null | undefined,
  payload: SaasaCvAnnotationsStored,
  options?: { resumeCvViewMode?: ResumeCvViewMode | null }
): Record<string, unknown> {
  const existing =
    existingExtraData && typeof existingExtraData === 'object' && !Array.isArray(existingExtraData)
      ? existingExtraData
      : {};
  const recruiter = pickRecruiterCvExtraFieldsFrontend(existing);
  const next: Record<string, unknown> = {
    ...buildSaasaCvAnnotationsExtra(existing, payload),
    ...recruiter,
  };
  if (options?.resumeCvViewMode) {
    next.resumeCvViewMode = options.resumeCvViewMode;
  }
  return next;
}

/** Merge hook-loaded backend row with drawer row so Resume tab tabs work after CV save. */
export function mergeResumeTabCandidateSource(
  backend: BackendCandidate | null | undefined,
  drawer?: {
    id: string;
    resumeUrl?: string | null;
    summary?: string | null;
    cvSummary?: string | null;
    extraData?: Record<string, unknown> | null;
    cvWorkExperienceEntries?: BackendCandidate['cvWorkExperienceEntries'];
    cvEducationEntries?: BackendCandidate['cvEducationEntries'];
    firstName?: string | null;
    lastName?: string | null;
    currentTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedIn?: string | null;
    location?: string | null;
    skills?: string[];
  } | null
): BackendCandidate | null {
  if (backend?.id) {
    const drawerExtra =
      drawer?.extraData && typeof drawer.extraData === 'object' && !Array.isArray(drawer.extraData)
        ? drawer.extraData
        : {};
    const backendExtra =
      backend.extraData && typeof backend.extraData === 'object' && !Array.isArray(backend.extraData)
        ? backend.extraData
        : {};
    const editorCvSaved = backendExtra.cvEditorContentSaved === true;
    const editorScalar = <T,>(backendValue: T | null | undefined, drawerValue?: T | null) =>
      editorCvSaved ? (backendValue ?? null) : (backendValue ?? drawerValue ?? null);
    return {
      ...backend,
      firstName: editorScalar(backend.firstName, drawer?.firstName),
      lastName: editorScalar(backend.lastName, drawer?.lastName),
      email: editorScalar(backend.email, drawer?.email),
      phone: editorScalar(backend.phone, drawer?.phone),
      linkedIn: editorScalar(backend.linkedIn, drawer?.linkedIn),
      currentTitle: editorScalar(backend.currentTitle, drawer?.currentTitle),
      location: editorScalar(backend.location, drawer?.location),
      avatar: backend.avatar ?? null,
      cvSummary: editorCvSaved
        ? (backend.cvSummary ?? null)
        : backend.cvSummary || drawer?.cvSummary || drawer?.summary || backend.cvSummary,
      cvWorkExperienceEntries: editorCvSaved
        ? Array.isArray(backend.cvWorkExperienceEntries)
          ? backend.cvWorkExperienceEntries
          : []
        : (backend.cvWorkExperienceEntries?.length
            ? backend.cvWorkExperienceEntries
            : drawer?.cvWorkExperienceEntries) || backend.cvWorkExperienceEntries,
      cvEducationEntries: editorCvSaved
        ? Array.isArray(backend.cvEducationEntries)
          ? backend.cvEducationEntries
          : []
        : (backend.cvEducationEntries?.length
            ? backend.cvEducationEntries
            : drawer?.cvEducationEntries) || backend.cvEducationEntries,
      skills: editorCvSaved
        ? Array.isArray(backend.skills)
          ? backend.skills
          : []
        : backend.skills,
      extraData: mergeResumeTabExtraData(drawerExtra, backendExtra),
    };
  }
  if (!drawer?.id) return null;
  return {
    id: drawer.id,
    firstName: drawer.firstName ?? undefined,
    lastName: drawer.lastName ?? undefined,
    email: drawer.email ?? undefined,
    phone: drawer.phone ?? undefined,
    linkedIn: drawer.linkedIn ?? undefined,
    currentTitle: drawer.currentTitle ?? undefined,
    location: drawer.location ?? undefined,
    skills: drawer.skills,
    cvSummary: drawer.cvSummary ?? drawer.summary ?? undefined,
    cvWorkExperienceEntries: drawer.cvWorkExperienceEntries,
    cvEducationEntries: drawer.cvEducationEntries,
    resume: drawer.resumeUrl ?? undefined,
    resumeUrl: drawer.resumeUrl ?? undefined,
    extraData: drawer.extraData ?? undefined,
  } as BackendCandidate;
}

export function listAvailableResumeCvModes(
  candidate: BackendCandidate | null,
  resumeUrl?: string | null
): ResumeCvViewMode[] {
  const modes: ResumeCvViewMode[] = [];
  if (String(resumeUrl || candidate?.resume || candidate?.resumeUrl || '').trim()) {
    modes.push('original');
  }
  if (hasSaasaCvResumeTabMode(candidate)) {
    modes.push('saasa');
  }
  if (hasPortalAiCv(candidate)) {
    modes.push('ai');
  }
  if (hasResumeTabUpdatedCv(candidate)) {
    modes.push('updated');
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
  if (stored === 'edited' && modes.includes('updated')) {
    return 'updated';
  }
  if (
    stored === 'original' ||
    stored === 'saasa' ||
    stored === 'ai' ||
    stored === 'updated' ||
    stored === 'edited'
  ) {
    if (modes.includes(stored)) return stored;
  }
  if (modes.includes('ai')) return 'ai';
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

/** Remove branded/layout Edited CV metadata while keeping Updated CV content fields. */
export function buildEditedCvRemovalExtra(
  existingExtraData: Record<string, unknown> | null | undefined,
  options?: {
    hasOriginalResume?: boolean;
    hasUpdatedCv?: boolean;
  }
): Record<string, unknown> {
  const existing =
    existingExtraData && typeof existingExtraData === 'object' && !Array.isArray(existingExtraData)
      ? existingExtraData
      : {};
  const next: Record<string, unknown> = { ...existing };

  next.cvEditorLayout = null;

  const presentationRaw = existing[CLIENT_PRESENTATION_KEY];
  if (presentationRaw && typeof presentationRaw === 'object' && !Array.isArray(presentationRaw)) {
    next[CLIENT_PRESENTATION_KEY] = {
      ...(presentationRaw as Record<string, unknown>),
      cvEditorLayout: null,
    };
  }

  const submission = existing.cvSubmission;
  const hasUpdated = options?.hasUpdatedCv ?? existing.cvEditorContentSaved === true;
  const hasOriginal = options?.hasOriginalResume ?? false;

  if (
    submission &&
    typeof submission === 'object' &&
    !Array.isArray(submission) &&
    (submission as CvSubmissionStored).shareMode === 'edited'
  ) {
    const shareMode: CvShareMode | null = hasUpdated ? 'updated' : hasOriginal ? 'original' : null;
    if (shareMode) {
      next.cvSubmission = {
        shareMode,
        updatedAt: new Date().toISOString(),
      };
    } else {
      delete next.cvSubmission;
    }
  }

  if (hasUpdated) {
    next.resumeCvViewMode = 'updated';
  } else if (hasOriginal) {
    next.resumeCvViewMode = 'original';
  } else {
    delete next.resumeCvViewMode;
  }

  return next;
}

/** Remove editor-saved CV (content + layout) from the Updated CV tab. */
export function buildUpdatedCvRemovalExtra(
  existingExtraData: Record<string, unknown> | null | undefined,
  options?: {
    hasOriginalResume?: boolean;
  }
): Record<string, unknown> {
  const existing =
    existingExtraData && typeof existingExtraData === 'object' && !Array.isArray(existingExtraData)
      ? existingExtraData
      : {};
  const next: Record<string, unknown> = { ...existing };

  next.cvEditorContentSaved = false;
  next.cvEditorContentSavedAt = null;
  next.cvEditorLayout = null;

  const presentationRaw = existing[CLIENT_PRESENTATION_KEY];
  if (presentationRaw && typeof presentationRaw === 'object' && !Array.isArray(presentationRaw)) {
    next[CLIENT_PRESENTATION_KEY] = {
      ...(presentationRaw as Record<string, unknown>),
      cvEditorLayout: null,
    };
  }

  const submission = existing.cvSubmission;
  const hasOriginal = options?.hasOriginalResume ?? false;

  if (
    submission &&
    typeof submission === 'object' &&
    !Array.isArray(submission) &&
    ((submission as CvSubmissionStored).shareMode === 'updated' ||
      (submission as CvSubmissionStored).shareMode === 'edited')
  ) {
    const shareMode: CvShareMode | null = hasOriginal ? 'original' : null;
    if (shareMode) {
      next.cvSubmission = {
        shareMode,
        updatedAt: new Date().toISOString(),
      };
    } else {
      delete next.cvSubmission;
    }
  }

  const portalAiRemains = Boolean(
    next.portalTailoredCvHtml ||
      next.portalAiCvSaved === true ||
      (next.portalTailoredCv &&
        typeof next.portalTailoredCv === 'object' &&
        !Array.isArray(next.portalTailoredCv) &&
        (next.portalTailoredCv as Record<string, unknown>).hasStudioHtml === true)
  );
  if (portalAiRemains) {
    next.resumeCvViewMode = 'ai';
  } else if (hasOriginal) {
    next.resumeCvViewMode = 'original';
  } else {
    delete next.resumeCvViewMode;
  }

  next.recruiterCvEditorSaved = false;

  return next;
}

export function resolveDefaultCvShareMode(
  candidate: BackendCandidate | null,
  hasOriginalResume: boolean,
  hasSaasaCv = false
): CvShareMode | null {
  const stored = readCvSubmission(candidate);
  const hasEdited = hasEditedCvAvailable(candidate);
  if (stored?.shareMode === 'saasa' && hasSaasaCv) return 'saasa';
  if (stored?.shareMode === 'edited' && hasEdited) return 'edited';
  if (stored?.shareMode === 'original' && hasOriginalResume) return 'original';
  if (hasEdited) return 'edited';
  if (hasSaasaCv) return 'saasa';
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

function readCvEditorLayoutFromExtra(extra: Record<string, unknown> | null | undefined): CvEditorLayoutStored | null {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return null;
  if (extra.cvEditorLayout === null) return null;
  const topLevel = extra.cvEditorLayout;
  if (topLevel && typeof topLevel === 'object' && !Array.isArray(topLevel)) {
    return topLevel as CvEditorLayoutStored;
  }
  const fromPresentation = readClientPresentation(extra)?.cvEditorLayout;
  if (fromPresentation && typeof fromPresentation === 'object' && !Array.isArray(fromPresentation)) {
    return fromPresentation as CvEditorLayoutStored;
  }
  return null;
}

export function readCvEditorLayout(candidate: BackendCandidate | null): CvEditorLayoutStored | null {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return null;
  return readCvEditorLayoutFromExtra(extra as Record<string, unknown>);
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
  const candidatePhotoUrl =
    data.showCandidatePhotoSlot === false
      ? null
      : (data.candidatePhotoUrl || '').trim() || null;
  const companyLogoUrl =
    data.showCompanyLogoSlot === false
      ? null
      : (data.companyLogoUrl || '').trim() || null;
  return {
    candidatePhotoUrl,
    initialCandidatePhotoUrl:
      (data.initialCandidatePhotoUrl || '').trim() || candidatePhotoUrl,
    companyLogoUrl,
    initialCompanyLogoUrl: companyLogoUrl,
    candidatePhotoPos: data.candidatePhotoPos ?? DEFAULT_CANDIDATE_PHOTO_POS,
    companyLogoPos: data.companyLogoPos ?? DEFAULT_COMPANY_LOGO_POS,
    candidatePhotoSize: normalizeCandidatePhotoSize(data.candidatePhotoSize),
    companyLogoSize: normalizeCompanyLogoSize(data.companyLogoSize),
    showCandidatePhotoSlot: data.showCandidatePhotoSlot !== false,
    showCompanyLogoSlot: data.showCompanyLogoSlot !== false,
    sectionOrder: data.sectionOrder?.length ? data.sectionOrder : DEFAULT_SECTION_ORDER,
    watermark: data.watermark ?? DEFAULT_WATERMARK,
    templateId: normalizeCvTemplateId(data.templateId),
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
      recruiterCvEditorSaved: true,
    },
  };
}

/** Apply a fresh CV editor save onto a candidate row (authoritative Updated CV). */
export function overlayEditorSaveOnCandidate(
  candidate: BackendCandidate,
  contentPatch: ReturnType<typeof cvEditorDataToCandidatePatch>,
  persist: { extraData: Record<string, unknown>; avatar?: string | null }
): BackendCandidate {
  const baseExtra =
    candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? (candidate.extraData as Record<string, unknown>)
      : {};
  return {
    ...candidate,
    ...contentPatch,
    ...(persist.avatar !== undefined ? { avatar: persist.avatar } : {}),
    extraData: buildResumeCvViewExtra({ ...baseExtra, ...persist.extraData }, 'updated'),
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
    candidatePhotoSize: normalizeCandidatePhotoSize(layout?.candidatePhotoSize),
    companyLogoSize: normalizeCompanyLogoSize(layout?.companyLogoSize),
    showCandidatePhotoSlot: layout?.showCandidatePhotoSlot !== false,
    showCompanyLogoSlot: layout?.showCompanyLogoSlot !== false,
    sectionOrder: layout?.sectionOrder?.length ? layout.sectionOrder : DEFAULT_SECTION_ORDER,
    watermark: layout?.watermark ?? DEFAULT_WATERMARK,
    templateId: normalizeCvTemplateId(layout?.templateId),
  };
}

export function cvEditorDataToCandidatePatch(data: CVEditorData) {
  const nameParts = data.name.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ');

  return {
    firstName: firstName || null,
    lastName: lastName || null,
    email: data.email.trim() || null,
    phone: data.phone.trim() || null,
    linkedIn: data.linkedin.trim() || null,
    currentTitle: data.jobTitle.trim() || null,
    location: data.location.trim() || null,
    cvSummary: data.summary.trim() || null,
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
