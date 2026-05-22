import { cloudinaryPdfViewerHref, normalizeCloudinaryDocumentUrl } from '../utils/cloudinaryUrls';

export function isResumeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(String(value || '').trim());
}

/** Paths from job apply link / CRM uploads often omit extensions in the object key. */
function isExtensionlessResumeStoragePath(url: string): boolean {
  const lower = String(url || '').toLowerCase();
  return (
    lower.includes('apply-resumes') ||
    lower.includes('/resumes/') ||
    lower.includes('jobportal/apply-resumes') ||
    /\/candidates\/[^/]+\/resumes\//i.test(lower)
  );
}

export function normalizeResumeHref(resumeUrl: string): string {
  const trimmed = String(resumeUrl || '').trim();
  if (!trimmed) return '';
  if (isResumeHttpUrl(trimmed)) {
    return normalizeCloudinaryDocumentUrl(trimmed);
  }
  return trimmed;
}

export function getResumeExtension(resumeUrl?: string | null): string {
  const cleanUrl = String(resumeUrl || '').split('?')[0].split('#')[0];
  const match = cleanUrl.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() || '';
}

export function isWordResume(resumeUrl?: string | null): boolean {
  const ext = getResumeExtension(resumeUrl);
  return ext === 'docx' || ext === 'doc';
}

export function canPreviewResumeInline(resumeUrl?: string | null): boolean {
  const ext = getResumeExtension(resumeUrl);
  if (ext === 'pdf') return true;
  const href = String(resumeUrl || '').trim();
  if (!href || isWordResume(href)) return false;
  return isExtensionlessResumeStoragePath(href);
}

export function canPreviewResumeAsHtml(resumeUrl?: string | null): boolean {
  return isWordResume(resumeUrl);
}

export function buildResumeViewerUrl(resumeUrl: string): string {
  const base = normalizeCloudinaryDocumentUrl(resumeUrl.split('#')[0] || resumeUrl);
  return cloudinaryPdfViewerHref(base, { allowExtensionlessResume: true });
}

export function buildResumeHtmlPreviewUrl(resumeUrl: string): string {
  const base = normalizeResumeHref(resumeUrl.split('#')[0] || resumeUrl);
  const params = new URLSearchParams({ url: base });
  const ext = getResumeExtension(base);
  if (ext === 'docx' || ext === 'doc') params.set('format', ext);
  return `/api/resume-preview?${params.toString()}`;
}

export type ResumePreviewMode = 'pdf' | 'html' | 'none';

export function getResumePreviewMode(resumeUrl?: string | null): ResumePreviewMode {
  if (canPreviewResumeInline(resumeUrl)) return 'pdf';
  if (canPreviewResumeAsHtml(resumeUrl)) return 'html';
  return 'none';
}
