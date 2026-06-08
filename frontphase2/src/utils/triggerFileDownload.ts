import { getAccessToken } from '../lib/api';
import {
  buildResumeDownloadProxyUrl,
  getResumeExtension,
  normalizeResumeHref,
} from '../lib/resumePreview';
import { normalizeCloudinaryDocumentUrl } from './cloudinaryUrls';

function sanitizeFilename(name: string): string {
  return String(name || 'download').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'download';
}

function inferFilenameFromUrl(url: string, fallback = 'download'): string {
  try {
    const pathname = url.startsWith('http') ? new URL(url).pathname : url;
    const last = pathname.split('/').filter(Boolean).pop() || fallback;
    return sanitizeFilename(decodeURIComponent(last));
  } catch {
    return sanitizeFilename(fallback);
  }
}

/** Unwrap viewer/proxy URLs and return the underlying file location for download. */
export function resolveRawDownloadUrl(
  fileUrl: string | null | undefined,
  uploadsBase?: string,
): string {
  const trimmed = String(fileUrl || '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('/api/pdf-proxy')) {
    try {
      const params = new URLSearchParams(trimmed.includes('?') ? trimmed.split('?')[1] : '');
      const inner = params.get('url');
      if (inner) return normalizeCloudinaryDocumentUrl(decodeURIComponent(inner));
    } catch {
      /* ignore */
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeCloudinaryDocumentUrl(trimmed);
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  if (uploadsBase) {
    return `${uploadsBase.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`;
  }

  return trimmed;
}

function resolveDownloadFilePath(sourceUrl: string, uploadsBase: string): string | null {
  if (sourceUrl.startsWith('/uploads/') || sourceUrl.startsWith('/api/v1/')) {
    return sourceUrl;
  }

  const base = uploadsBase.replace(/\/+$/, '');
  if (base && sourceUrl.startsWith(`${base}/`)) {
    const path = sourceUrl.slice(base.length);
    if (path.startsWith('/uploads/') || path.startsWith('/api/v1/')) return path;
  }

  try {
    const parsed = new URL(sourceUrl);
    const backend = new URL(base || window.location.origin);
    if (parsed.origin === backend.origin) {
      if (parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/api/v1/')) {
        return `${parsed.pathname}${parsed.search}`;
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

function cloudinaryAttachmentUrl(url: string): string {
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (url.includes('/fl_attachment/')) return url;
  return url.replace('/upload/', '/upload/fl_attachment/');
}

function inferExtensionFromContentType(contentType: string): string {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('pdf')) return 'pdf';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('plain')) return 'txt';
  if (ct.includes('wordprocessingml')) return 'docx';
  if (ct.includes('msword')) return 'doc';
  return '';
}

function withDownloadExtension(filename: string, extension: string): string {
  const safeName = sanitizeFilename(filename);
  if (!extension) return safeName;
  const base = safeName.replace(/\.[a-z0-9]+$/i, '');
  return `${base}.${extension}`;
}

async function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

/** Start a browser file download without opening a new tab. */
export async function triggerFileDownload(
  fileUrl: string | null | undefined,
  options?: {
    filename?: string;
    uploadsBase?: string;
  },
): Promise<void> {
  const uploadsBase = options?.uploadsBase || '';
  const sourceUrl = resolveRawDownloadUrl(fileUrl, uploadsBase);
  if (!sourceUrl) throw new Error('No file to download');

  const normalizedSource = normalizeResumeHref(sourceUrl);
  const requestedFilename = sanitizeFilename(options?.filename || inferFilenameFromUrl(sourceUrl));
  const token = typeof window !== 'undefined' ? getAccessToken() : null;
  const authHeaders: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;

  const proxyPath = resolveDownloadFilePath(sourceUrl, uploadsBase);
  if (proxyPath) {
    const params = new URLSearchParams({ path: proxyPath, filename: requestedFilename });
    const response = await fetch(`/api/download-file?${params.toString()}`, {
      headers: authHeaders,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }
    await downloadBlob(await response.blob(), requestedFilename);
    return;
  }

  const resumeProxyUrl = buildResumeDownloadProxyUrl(normalizedSource || sourceUrl);
  if (resumeProxyUrl) {
    const response = await fetch(resumeProxyUrl, {
      headers: authHeaders,
      cache: 'no-store',
      credentials: 'include',
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 180).trim();
      throw new Error(detail || `Download failed (${response.status})`);
    }

    const blob = await response.blob();
    const urlExt = getResumeExtension(normalizedSource || sourceUrl);
    const contentExt = inferExtensionFromContentType(response.headers.get('content-type') || blob.type);
    const downloadName = withDownloadExtension(requestedFilename, urlExt || contentExt);
    await downloadBlob(blob, downloadName);
    return;
  }

  const fetchTargets = [sourceUrl];
  if (sourceUrl.includes('res.cloudinary.com')) {
    fetchTargets.push(cloudinaryAttachmentUrl(sourceUrl));
  }

  let lastError: Error | null = null;
  for (const target of fetchTargets) {
    try {
      const response = await fetch(target, {
        headers: authHeaders,
        cache: 'no-store',
        credentials: 'include',
      });
      if (!response.ok) {
        lastError = new Error(`Download failed (${response.status})`);
        continue;
      }
      await downloadBlob(await response.blob(), requestedFilename);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Download failed');
    }
  }

  throw lastError || new Error('Download failed');
}
