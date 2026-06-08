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

export const RESUME_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const;

export function getResumeExtension(resumeUrl?: string | null): string {
  const cleanUrl = String(resumeUrl || '').split('?')[0].split('#')[0];
  const match = cleanUrl.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() || '';
}

export function isImageResume(resumeUrl?: string | null): boolean {
  const ext = getResumeExtension(resumeUrl);
  return RESUME_IMAGE_EXTENSIONS.includes(ext as (typeof RESUME_IMAGE_EXTENSIONS)[number]);
}

export function isTextResume(resumeUrl?: string | null): boolean {
  return getResumeExtension(resumeUrl) === 'txt';
}

/** Path clearly references Word (even when the key also contains ".pdf" as text). */
export function urlIndicatesWordResume(resumeUrl?: string | null): boolean {
  const path = String(resumeUrl || '').split('?')[0].split('#')[0].toLowerCase();
  if (/\.docx($|[?#/])/.test(path) || path.endsWith('.docx')) return true;
  if (/\.doc($|[?#/])/.test(path) && !/\.docx/.test(path)) return true;
  return false;
}

export function isWordResume(resumeUrl?: string | null): boolean {
  return urlIndicatesWordResume(resumeUrl);
}

export function canPreviewResumeAsHtml(resumeUrl?: string | null): boolean {
  return isWordResume(resumeUrl);
}

export function canPreviewResumeInline(resumeUrl?: string | null): boolean {
  if (!resumeUrl || isWordResume(resumeUrl)) return false;
  const ext = getResumeExtension(resumeUrl);
  if (ext === 'pdf' || ext === 'txt' || isImageResume(resumeUrl)) return true;
  return isExtensionlessResumeStoragePath(String(resumeUrl).trim());
}

/** True only when the resume should be rendered with PDF.js (not images / Word / plain text). */
export function isPdfResume(resumeUrl?: string | null): boolean {
  const trimmed = String(resumeUrl || '').trim();
  if (!trimmed || isWordResume(trimmed) || isImageResume(trimmed) || isTextResume(trimmed)) {
    return false;
  }
  const ext = getResumeExtension(trimmed);
  if (ext === 'pdf') return true;
  if (ext) return false;
  return isExtensionlessResumeStoragePath(trimmed);
}

/** Which inline renderer to use in the candidate drawer Resume tab. */
export function resolveResumePreviewKind(resumeUrl?: string | null): ResumePreviewMode {
  if (!String(resumeUrl || '').trim()) return 'none';
  if (canPreviewResumeAsHtml(resumeUrl)) return 'html';
  if (isImageResume(resumeUrl)) return 'image';
  if (isTextResume(resumeUrl)) return 'text';
  if (canPreviewResumeInline(resumeUrl)) return 'pdf';
  return 'none';
}

/** Same-origin PDF proxy for any remote resume URL (server validates the target). */
export function buildResumePdfProxyUrl(sourceUrl: string): string {
  const base = normalizeCloudinaryDocumentUrl(
    String(sourceUrl || '')
      .split('#')[0]
      .trim()
  );
  if (!base) return '';
  if (base.startsWith('/api/pdf-proxy')) return base;
  if (/^https?:\/\//i.test(base) && canPreviewResumeInline(base)) {
    return `/api/pdf-proxy?url=${encodeURIComponent(base)}`;
  }
  return cloudinaryPdfViewerHref(base, { allowExtensionlessResume: true });
}

export function buildResumeViewerUrl(resumeUrl: string): string {
  if (isImageResume(resumeUrl)) {
    return normalizeResumeHref(resumeUrl);
  }
  return buildResumePdfProxyUrl(resumeUrl);
}

export function buildResumeHtmlPreviewUrl(resumeUrl: string): string {
  const base = normalizeResumeHref(resumeUrl.split('#')[0] || resumeUrl);
  const params = new URLSearchParams({ url: base });
  const ext = getResumeExtension(base);
  if (ext === 'docx' || ext === 'doc') params.set('format', ext);
  return `/api/resume-preview?${params.toString()}`;
}

/** Same-origin proxy for raw DOCX bytes (client-side docx-preview). */
export function buildResumeDocxBytesUrl(resumeUrl: string): string {
  const base = normalizeResumeHref(resumeUrl.split('#')[0] || resumeUrl);
  const params = new URLSearchParams({ url: base });
  const ext = getResumeExtension(base);
  if (ext === 'docx' || ext === 'doc') params.set('format', ext);
  return `/api/resume-docx?${params.toString()}`;
}

/** App origin for absolute URLs (Office Online must fetch the file from the public web). */
export function getResumePreviewAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  const fromEnv = String(process.env.NEXT_PUBLIC_APP_URL || '').trim();
  return fromEnv.replace(/\/+$/, '');
}

/**
 * Public HTTPS URL to the .docx for Microsoft Office Online.
 * Production: same-origin /api/resume-docx proxy (works for private S3).
 * Local dev: direct https://…/file.docx when the bucket object is public.
 */
export function buildResumeDocxPublicFileUrl(resumeUrl: string, appOrigin?: string): string {
  const base = normalizeResumeHref(resumeUrl.split('#')[0] || resumeUrl);
  if (!base || !isWordResume(base)) return '';

  const origin = (appOrigin || getResumePreviewAppOrigin()).trim();
  if (origin && /^https:\/\//i.test(origin)) {
    return `${origin}${buildResumeDocxBytesUrl(base)}`;
  }
  if (/^https:\/\//i.test(base)) {
    return base;
  }
  return '';
}

/** Microsoft Word Online viewer — renders the actual .docx like Word in the browser. */
export function buildOfficeOnlineEmbedUrl(docxFileUrl: string): string {
  const fileUrl = String(docxFileUrl || '').trim();
  if (!fileUrl) return '';
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

export function canEmbedOfficeOnlineForResume(resumeUrl?: string | null): boolean {
  const href = normalizeResumeHref(String(resumeUrl || '').split('#')[0]);
  if (!href || !isWordResume(href)) return false;
  if (/^https:\/\//i.test(href)) return true;
  const origin = getResumePreviewAppOrigin();
  return Boolean(origin && /^https:\/\//i.test(origin));
}

export type ResumePreviewMode = 'pdf' | 'image' | 'html' | 'text' | 'none';

export type ResumeBufferKind = 'pdf' | 'image' | 'text' | 'unknown';

/** Detect resume file type from downloaded bytes (handles extensionless S3 keys). */
export function detectResumeBufferKind(buffer: ArrayBuffer): ResumeBufferKind {
  if (buffer.byteLength < 4) return 'unknown';
  const bytes = new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength));
  const magic4 = String.fromCharCode(...bytes.slice(0, 4));
  if (magic4 === '%PDF') return 'pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image';
  if (magic4 === '\x89PNG') return 'image';
  if (magic4 === 'GIF8') return 'image';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    const riff = String.fromCharCode(...bytes.slice(8, 12));
    if (riff === 'WEBP') return 'image';
  }
  return 'unknown';
}

export function detectResumeContentType(
  contentType: string,
  buffer?: ArrayBuffer,
): ResumeBufferKind {
  if (buffer && buffer.byteLength > 0) {
    const fromBytes = detectResumeBufferKind(buffer);
    if (fromBytes !== 'unknown') return fromBytes;
  }
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('pdf')) return 'pdf';
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('text/')) return 'text';
  return 'unknown';
}

/** Direct file URL for images (skip PDF proxy). */
export function buildResumeDirectUrl(resumeUrl: string): string {
  return normalizeResumeHref(resumeUrl);
}

export function getResumePreviewMode(resumeUrl?: string | null): ResumePreviewMode {
  return resolveResumePreviewKind(resumeUrl);
}
