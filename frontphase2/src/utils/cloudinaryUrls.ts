/**
 * PDFs and other documents uploaded to Cloudinary as `image` use `/image/upload/`
 * and often fail in browser PDF viewers. Uploads should use `resource_type: "raw"`
 * (`/raw/upload/`). This normalizes legacy stored URLs for preview/download.
 */
export function normalizeCloudinaryDocumentUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return url ?? '';
  const trimmed = url.trim();
  if (!trimmed.includes('res.cloudinary.com')) return trimmed;
  if (!trimmed.includes('/image/upload/')) return trimmed;
  if (!/\.(pdf|doc|docx)(\?|#|$)/i.test(trimmed)) return trimmed;
  return trimmed.replace('/image/upload/', '/raw/upload/');
}

const CLOUDINARY_HOST = /^https:\/\/res\.cloudinary\.com\//i;

/**
 * Same-origin URL for viewing Cloudinary-hosted PDFs (iframe, new tab, or <a href>).
 * Direct Cloudinary URLs often show "Failed to load PDF document" in Chrome — proxy fixes that.
 */
export function cloudinaryPdfViewerHref(url: string): string {
  const base = (url.split('#')[0] || '').trim();
  if (!CLOUDINARY_HOST.test(base)) return url.trim();
  if (!/\.pdf($|[?#])/i.test(base)) return url.trim();
  return `/api/pdf-proxy?url=${encodeURIComponent(base)}`;
}

/** Same-origin proxy URL for iframe / in-app PDF viewer (never embed raw Cloudinary URL). */
export function getPdfViewerUrl(url: string): string {
  return cloudinaryPdfViewerHref(url);
}

/**
 * Build href for uploaded files: relative paths join API base; Cloudinary PDFs use /api proxy.
 */
export function buildFileHref(fileUrl: string | null | undefined, uploadsBase: string): string {
  if (!fileUrl) return '#';
  const href = /^https?:\/\//i.test(fileUrl) ? fileUrl : `${uploadsBase}${fileUrl}`;
  const normalized = normalizeCloudinaryDocumentUrl(href);
  return cloudinaryPdfViewerHref(normalized);
}

/** @deprecated use cloudinaryPdfViewerHref */
export const cloudinaryPdfIframeSrc = cloudinaryPdfViewerHref;
