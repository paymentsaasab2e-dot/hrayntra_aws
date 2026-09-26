/**
 * Org-wide export watermark (Super Admin configures; all members inherit on exports).
 * Supports text and/or a logo image.
 */

export type ExportWatermarkSettings = {
  enabled: boolean;
  text: string;
  /** Uploaded logo / image URL used as visual watermark on PDF / Excel. */
  imageUrl: string;
  /** Optional preloaded logo (data URL) — used on public client-review exports. */
  imageDataUrl?: string;
  opacity: number;
  applyToPdf: boolean;
  applyToExcel: boolean;
  applyToCsv: boolean;
};

export const DEFAULT_EXPORT_WATERMARK: ExportWatermarkSettings = {
  enabled: false,
  text: '',
  imageUrl: '',
  opacity: 0.18,
  applyToPdf: true,
  applyToExcel: true,
  applyToCsv: true,
};

export const ORG_WATERMARK_CACHE_KEY = 'orgExportWatermark';
export const ORG_WATERMARK_CACHE_EVENT = 'ph2:org-export-watermark';
/** Session cache of decoded logo PNG data-URLs keyed by imageUrl (avoids blank Excel embeds). */
const ORG_WATERMARK_LOGO_DATA_KEY = 'orgExportWatermarkLogoData';

/** Cache is per tenant so one company's stamp is never reused for another. */
function watermarkTenantScope(): string {
  return readTenantDbName() || 'none';
}

function orgWatermarkStorageKey(): string {
  return `${ORG_WATERMARK_CACHE_KEY}:${watermarkTenantScope()}`;
}

function orgWatermarkLogoStorageKey(): string {
  return `${ORG_WATERMARK_LOGO_DATA_KEY}:${watermarkTenantScope()}`;
}

export function normalizeExportWatermark(raw: unknown): ExportWatermarkSettings {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const text = String(input.text || '').trim().slice(0, 120);
  const imageUrl = String(input.imageUrl || input.logoUrl || '').trim();
  const imageDataUrl = String(input.imageDataUrl || '').trim();
  const opacityRaw = Number(input.opacity);
  const opacity = Number.isFinite(opacityRaw)
    ? Math.min(0.5, Math.max(0.05, opacityRaw))
    : DEFAULT_EXPORT_WATERMARK.opacity;
  const hasContent = text.length > 0 || imageUrl.length > 0 || imageDataUrl.startsWith('data:image/');
  return {
    enabled: Boolean(input.enabled) && hasContent,
    text,
    imageUrl,
    imageDataUrl: imageDataUrl.startsWith('data:image/') ? imageDataUrl : '',
    opacity,
    applyToPdf: input.applyToPdf !== false,
    applyToExcel: input.applyToExcel !== false,
    applyToCsv: input.applyToCsv !== false,
  };
}

function readTenantDbName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem('tenantDbName') || '').trim();
  } catch {
    return '';
  }
}

export function cacheWatermarkLogoDataUrl(imageUrl: string, dataUrl: string): void {
  if (typeof window === 'undefined') return;
  const key = String(imageUrl || '').trim();
  const value = String(dataUrl || '').trim();
  if (!key || !value.startsWith('data:image/')) return;
  try {
    sessionStorage.setItem(
      orgWatermarkLogoStorageKey(),
      JSON.stringify({ imageUrl: key, dataUrl: value, at: Date.now() }),
    );
  } catch {
    /* quota — ignore */
  }
}

function readCachedWatermarkLogoDataUrl(imageUrl: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = sessionStorage.getItem(orgWatermarkLogoStorageKey());
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { imageUrl?: string; dataUrl?: string };
    if (String(parsed?.imageUrl || '').trim() !== String(imageUrl || '').trim()) return '';
    const dataUrl = String(parsed?.dataUrl || '').trim();
    return dataUrl.startsWith('data:image/') ? dataUrl : '';
  } catch {
    return '';
  }
}

export function readCachedOrgWatermark(): ExportWatermarkSettings {
  if (typeof window === 'undefined') return DEFAULT_EXPORT_WATERMARK;
  try {
    const raw = localStorage.getItem(orgWatermarkStorageKey());
    if (!raw) return DEFAULT_EXPORT_WATERMARK;
    return normalizeExportWatermark(JSON.parse(raw));
  } catch {
    return DEFAULT_EXPORT_WATERMARK;
  }
}

export function writeCachedOrgWatermark(settings: ExportWatermarkSettings): void {
  if (typeof window === 'undefined') return;
  try {
    // Never persist large data-URLs in localStorage (quota). Logo lives in session cache.
    const forStorage = normalizeExportWatermark(settings);
    const { imageDataUrl: _drop, ...rest } = forStorage;
    localStorage.setItem(orgWatermarkStorageKey(), JSON.stringify(rest));
    if (forStorage.imageDataUrl && forStorage.imageUrl) {
      cacheWatermarkLogoDataUrl(forStorage.imageUrl, forStorage.imageDataUrl);
    } else if (forStorage.imageDataUrl) {
      cacheWatermarkLogoDataUrl('embedded-logo', forStorage.imageDataUrl);
    }
    window.dispatchEvent(new CustomEvent(ORG_WATERMARK_CACHE_EVENT));
  } catch {
    /* ignore */
  }
}

export function watermarkHasContent(settings: ExportWatermarkSettings | null | undefined): boolean {
  const cfg = normalizeExportWatermark(settings);
  return Boolean(cfg.text || cfg.imageUrl || cfg.imageDataUrl);
}

export function watermarkTextForFormat(
  settings: ExportWatermarkSettings | null | undefined,
  format: 'pdf' | 'excel' | 'csv' | 'text',
): string {
  const cfg = normalizeExportWatermark(settings);
  if (!cfg.enabled) return '';
  if (format === 'pdf' && !cfg.applyToPdf) return '';
  if (format === 'excel' && !cfg.applyToExcel) return '';
  if ((format === 'csv' || format === 'text') && !cfg.applyToCsv) return '';
  if (cfg.text) return cfg.text;
  if ((cfg.imageUrl || cfg.imageDataUrl) && (format === 'csv' || format === 'text')) {
    return '[logo watermark]';
  }
  return '';
}

export function watermarkImageForFormat(
  settings: ExportWatermarkSettings | null | undefined,
  format: 'pdf' | 'excel',
): string {
  const cfg = normalizeExportWatermark(settings);
  if (!cfg.enabled) return '';
  if (format === 'pdf' && !cfg.applyToPdf) return '';
  if (format === 'excel' && !cfg.applyToExcel) return '';
  if (cfg.imageDataUrl?.startsWith('data:image/')) return cfg.imageDataUrl;
  const fromSession = cfg.imageUrl ? readCachedWatermarkLogoDataUrl(cfg.imageUrl) : '';
  if (fromSession) return fromSession;
  const embedded = readCachedWatermarkLogoDataUrl('embedded-logo');
  if (embedded) return embedded;
  return cfg.imageUrl || '';
}

/**
 * The saved logo URL often points at a host the settings page cannot open
 * (production API from localhost, or the reverse). Rebuild it on the API this page uses.
 */
function rewriteExportWatermarkDisplayUrl(imageUrl: string): string {
  if (typeof window === 'undefined') return imageUrl;
  try {
    const parsed = new URL(imageUrl, window.location.origin);
    if (!parsed.pathname.includes('/export-watermarks/')) return imageUrl;
    const filename = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    if (!filename) return imageUrl;
    const tenant =
      parsed.searchParams.get('tenantDbName') ||
      parsed.searchParams.get('tenant') ||
      readTenantDbName();
    const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
    const filePath = `public/uploads/export-watermarks/${encodeURIComponent(filename)}${qs}`;
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
      return `http://127.0.0.1:5001/api/v1/${filePath}`;
    }
    return `/api/proxy/${filePath}`;
  } catch {
    return imageUrl;
  }
}

/** Resolve a stored /uploads or absolute watermark image URL for fetch/display. */
export function resolveWatermarkImageSrc(imageUrl: string): string {
  const trimmed = String(imageUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.includes('/export-watermarks/')) {
    return rewriteExportWatermarkDisplayUrl(trimmed);
  }

  const tenant = readTenantDbName();
  const withTenant = (url: string): string => {
    if (!tenant) return url;
    try {
      const absolute = /^https?:\/\//i.test(url)
        ? new URL(url)
        : new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      if (
        absolute.pathname.includes('/public/uploads/export-watermarks/') &&
        !absolute.searchParams.get('tenantDbName')
      ) {
        absolute.searchParams.set('tenantDbName', tenant);
      }
      if (/^https?:\/\//i.test(url)) return absolute.toString();
      return `${absolute.pathname}${absolute.search}`;
    } catch {
      return url;
    }
  };

  if (/^https?:\/\//i.test(trimmed)) return withTenant(trimmed);
  if (typeof window === 'undefined') return trimmed;

  const apiBase = String(process.env.NEXT_PUBLIC_API_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const origin = window.location.origin;
  const apiRoot = apiBase ? apiBase.replace(/\/api\/v1\/?$/, '') : origin;

  if (trimmed.startsWith('/api/v1/')) {
    return withTenant(`${apiRoot}${trimmed}`);
  }
  if (trimmed.startsWith('/uploads/')) {
    const sub = trimmed.replace(/^\/uploads\//, '');
    return withTenant(`${apiRoot}/api/v1/public/uploads/${sub}`);
  }
  if (trimmed.startsWith('/') && apiRoot) {
    return withTenant(`${apiRoot}${trimmed}`);
  }
  return withTenant(trimmed);
}

function buildWatermarkImageFetchCandidates(imageUrl: string): string[] {
  const primary = resolveWatermarkImageSrc(imageUrl);
  const candidates = [primary];
  const tenant = readTenantDbName();
  const trimmed = String(imageUrl || '').trim();

  // Also try same-origin proxy paths in case BACKEND_PUBLIC_URL pointed elsewhere.
  if (trimmed.includes('/public/uploads/export-watermarks/') || trimmed.includes('/export-watermarks/')) {
    try {
      const parsed = new URL(primary, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      const filename = parsed.pathname.split('/').filter(Boolean).pop() || '';
      if (filename && typeof window !== 'undefined') {
        const local = new URL(
          `/api/v1/public/uploads/export-watermarks/${encodeURIComponent(filename)}`,
          window.location.origin,
        );
        if (tenant) local.searchParams.set('tenantDbName', tenant);
        candidates.push(local.toString());
      }
      if (tenant && !parsed.searchParams.get('tenantDbName')) {
        parsed.searchParams.set('tenantDbName', tenant);
        candidates.push(parsed.toString());
      }
    } catch {
      /* ignore */
    }
  }

  return [...new Set(candidates.filter(Boolean))];
}

function sniffImageFormat(bytes: Uint8Array): 'png' | 'jpeg' | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  return null;
}

async function decodeBlobToPngDataUrl(
  blob: Blob,
): Promise<{ dataUrl: string; format: 'PNG'; width: number; height: number } | null> {
  if (typeof document === 'undefined') return null;
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const width = Math.max(1, img.naturalWidth || img.width || 1);
          const height = Math.max(1, img.naturalHeight || img.height || 1);
          // Cap huge logos so Excel stays light.
          const maxEdge = 1200;
          const scale = Math.min(1, maxEdge / Math.max(width, height));
          const w = Math.max(1, Math.round(width * scale));
          const h = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          // White underlay so transparent logos stay visible on Excel's white sheet.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/png');
          if (!dataUrl.startsWith('data:image/png')) {
            resolve(null);
            return;
          }
          resolve({ dataUrl, format: 'PNG', width: w, height: h });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Load any browser-decodable image and re-encode as PNG for Excel/PDF.
 * ExcelJS only supports png/jpeg — webp/svg/gif or HTML error bodies become a blank white box
 * unless we validate and convert first.
 */
async function fetchImageAsDataUrl(
  imageUrl: string,
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG'; width: number; height: number } | null> {
  const trimmed = String(imageUrl || '').trim();
  if (!trimmed) return null;

  // Prefer session-cached decoded logo from the Watermark settings upload/preview.
  const cachedDataUrl = readCachedWatermarkLogoDataUrl(trimmed);
  if (cachedDataUrl) {
    try {
      const res = await fetch(cachedDataUrl);
      const blob = await res.blob();
      const painted = await decodeBlobToPngDataUrl(blob);
      if (painted) return painted;
    } catch {
      /* fall through to network */
    }
  }

  if (trimmed.startsWith('data:image/')) {
    try {
      const res = await fetch(trimmed);
      const blob = await res.blob();
      return await decodeBlobToPngDataUrl(blob);
    } catch {
      return null;
    }
  }

  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
  const candidates = buildWatermarkImageFetchCandidates(trimmed);

  for (const src of candidates) {
    try {
      const response = await fetch(src, {
        cache: 'no-store',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) continue;

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        continue;
      }

      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength || buffer.byteLength < 32) continue;
      const bytes = new Uint8Array(buffer);
      const sniffed = sniffImageFormat(bytes);
      const blobType =
        sniffed === 'png'
          ? 'image/png'
          : sniffed === 'jpeg'
            ? 'image/jpeg'
            : contentType.startsWith('image/')
              ? contentType
              : 'application/octet-stream';

      if (!sniffed && contentType && !contentType.startsWith('image/')) {
        continue;
      }

      const blob = new Blob([buffer], { type: blobType });
      const painted = await decodeBlobToPngDataUrl(blob);
      if (painted) {
        cacheWatermarkLogoDataUrl(trimmed, painted.dataUrl);
        return painted;
      }

      if (sniffed) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('read failed'));
          reader.readAsDataURL(blob);
        });
        if (!dataUrl.startsWith('data:image/')) continue;
        cacheWatermarkLogoDataUrl(trimmed, dataUrl);
        return {
          dataUrl,
          format: sniffed === 'png' ? 'PNG' : 'JPEG',
          width: 180,
          height: 64,
        };
      }
    } catch {
      /* try next candidate */
    }
  }

  return null;
}

/** Prepend watermark line to plain text / HTML / CSV string content. */
export function prependTextWatermark(
  content: string,
  text: string,
  kind: 'text' | 'html' | 'csv' = 'text',
): string {
  const stamp = String(text || '').trim();
  if (!stamp) return content;
  if (kind === 'html') {
    const banner = `<div style="font:12px/1.4 system-ui,sans-serif;color:#64748b;border-bottom:1px dashed #cbd5e1;padding:8px 0 10px;margin-bottom:12px;">WATERMARK: ${stamp
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</div>`;
    return `${banner}${content}`;
  }
  if (kind === 'csv') {
    return `"WATERMARK: ${stamp.replace(/"/g, '""')}"\r\n${content}`;
  }
  return `WATERMARK: ${stamp}\n\n${content}`;
}

type JsPdfLike = {
  getNumberOfPages: () => number;
  setPage: (n: number) => void;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  saveGraphicsState?: () => void;
  restoreGraphicsState?: () => void;
  setGState?: (state: unknown) => void;
  GState?: new (opts: { opacity: number }) => unknown;
  setTextColor: (r: number, g: number, b: number) => void;
  setFontSize: (size: number) => void;
  text: (text: string, x: number, y: number, opts?: { angle?: number; align?: string }) => void;
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number,
    alias?: string,
    compression?: string,
    rotation?: number,
  ) => void;
};

/** Logo / text watermark size relative to page — matches settings preview (~38% width). */
function resolvePdfWatermarkImageSize(
  pageWidth: number,
  imageWidth: number,
  imageHeight: number,
): { imgW: number; imgH: number } {
  const w = Math.max(1, pageWidth);
  // ~38% of page width (settings preview uses max-w ~220 on a ~580 card ≈ 38%).
  // No tiny hard pixel caps — those made logos look microscopic on px-unit jsPDF pages.
  const imgW = Math.min(w * 0.42, w * 0.5);
  const imgH = (Math.max(1, imageHeight) / Math.max(1, imageWidth)) * imgW;
  return { imgW, imgH };
}

function resolvePdfWatermarkFontSize(pageWidth: number): number {
  return Math.max(22, Math.min(56, Math.floor(Math.max(1, pageWidth) / 7)));
}

/** Stamp every page of a jsPDF document with text and/or logo image. */
export async function applyOrgWatermarkToJsPdf(
  pdf: JsPdfLike,
  settingsOverride?: ExportWatermarkSettings | null,
): Promise<void> {
  const cfg = normalizeExportWatermark(settingsOverride ?? readCachedOrgWatermark());
  if (!cfg.enabled) return;
  if (!cfg.applyToPdf) return;
  const opacity = Math.min(0.5, Math.max(0.05, cfg.opacity));
  const pages = pdf.getNumberOfPages();
  let image: { dataUrl: string; format: 'PNG' | 'JPEG'; width: number; height: number } | null =
    null;
  const imageSrc = watermarkImageForFormat(cfg, 'pdf');
  if (imageSrc) {
    image = await fetchImageAsDataUrl(imageSrc);
  }

  for (let i = 1; i <= pages; i += 1) {
    pdf.setPage(i);
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    try {
      if (pdf.saveGraphicsState && pdf.GState && pdf.setGState) {
        pdf.saveGraphicsState();
        pdf.setGState(new pdf.GState({ opacity }));
      }
    } catch {
      /* older jspdf */
    }

    if (image) {
      const { imgW, imgH } = resolvePdfWatermarkImageSize(width, image.width, image.height);
      try {
        pdf.addImage(
          image.dataUrl,
          image.format,
          (width - imgW) / 2,
          (height - imgH) / 2,
          imgW,
          imgH,
          undefined,
          'FAST',
          35,
        );
      } catch {
        try {
          pdf.addImage(
            image.dataUrl,
            image.format,
            (width - imgW) / 2,
            (height - imgH) / 2,
            imgW,
            imgH,
          );
        } catch {
          /* ignore */
        }
      }
    }
    if (cfg.text && !image) {
      pdf.setTextColor(120, 120, 140);
      pdf.setFontSize(resolvePdfWatermarkFontSize(width));
      pdf.text(cfg.text, width / 2, height / 2, { angle: 35, align: 'center' });
    }
    try {
      pdf.restoreGraphicsState?.();
    } catch {
      /* ignore */
    }
  }
}

/** @deprecated Prefer applyOrgWatermarkToJsPdf — kept for call sites that only have text. */
export function stampJsPdfWatermark(
  pdf: JsPdfLike,
  text: string,
  opacity = 0.18,
): void {
  const stamp = String(text || '').trim();
  if (!stamp) return;
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    pdf.setPage(i);
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    try {
      if (pdf.saveGraphicsState && pdf.GState && pdf.setGState) {
        pdf.saveGraphicsState();
        pdf.setGState(new pdf.GState({ opacity: Math.min(0.5, Math.max(0.05, opacity)) }));
      }
    } catch {
      /* older jspdf */
    }
    pdf.setTextColor(120, 120, 140);
    pdf.setFontSize(Math.max(18, Math.min(42, Math.floor(width / 6))));
    pdf.text(stamp, width / 2, height / 2, { angle: 35, align: 'center' });
    try {
      pdf.restoreGraphicsState?.();
    } catch {
      /* ignore */
    }
  }
}

/** Stamp a downloaded Blob when possible (PDF via pdf-lib; text/html/csv prepend). */
export async function stampDownloadBlob(
  blob: Blob,
  filename?: string,
  settingsOverride?: ExportWatermarkSettings | null,
): Promise<Blob> {
  const cfg = normalizeExportWatermark(settingsOverride ?? readCachedOrgWatermark());
  if (!cfg.enabled || !watermarkHasContent(cfg)) return blob;

  const name = String(filename || '').toLowerCase();
  const type = String(blob.type || '').toLowerCase();
  const isPdf = type.includes('pdf') || name.endsWith('.pdf');
  const isText =
    type.includes('text/plain') ||
    name.endsWith('.txt') ||
    type.includes('csv') ||
    name.endsWith('.csv') ||
    type.includes('html') ||
    name.endsWith('.html') ||
    name.endsWith('.htm');

  if (isPdf) {
    if (!cfg.applyToPdf) return blob;
    try {
      const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
      const raw = await blob.arrayBuffer();
      const marker = new TextDecoder().decode(raw);
      if (marker.includes('HryantraWm:stamped')) return blob;
      if (marker.includes('pdf-lib') && !marker.includes('HryantraWm:clean')) return blob;
      const pdfDoc = await PDFDocument.load(raw, {
        ignoreEncryption: true,
      });
      pdfDoc.setKeywords(['HryantraWm:stamped']);
      const pages = pdfDoc.getPages();
      if (!pages.length) return blob;
      const opacity = Math.min(0.5, Math.max(0.05, cfg.opacity));

      let embeddedImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
      const imageSrc = watermarkImageForFormat(cfg, 'pdf');
      if (imageSrc) {
        try {
          const image = await fetchImageAsDataUrl(imageSrc);
          if (image) {
            const base64 = image.dataUrl.split(',')[1] || '';
            const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            embeddedImage =
              image.format === 'PNG'
                ? await pdfDoc.embedPng(bytes)
                : await pdfDoc.embedJpg(bytes);
          }
        } catch {
          embeddedImage = null;
        }
      }

      let font: Awaited<ReturnType<typeof pdfDoc.embedFont>> | null = null;
      if (cfg.text) {
        try {
          font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        } catch {
          font = null;
        }
      }

      for (const page of pages) {
        const { width, height } = page.getSize();
        if (embeddedImage) {
          try {
            const { imgW, imgH } = resolvePdfWatermarkImageSize(
              width,
              embeddedImage.width,
              embeddedImage.height,
            );
            page.drawImage(embeddedImage, {
              x: (width - imgW) / 2,
              y: (height - imgH) / 2,
              width: imgW,
              height: imgH,
              opacity,
              rotate: degrees(35),
            });
          } catch {
            /* keep going — text may still stamp */
          }
        }
        if (cfg.text && font && !embeddedImage) {
          try {
            const size = resolvePdfWatermarkFontSize(width);
            page.drawText(cfg.text, {
              x: width * 0.18,
              y: height * 0.42 - (embeddedImage ? 40 : 0),
              size,
              font,
              rotate: degrees(35),
              opacity,
              color: rgb(0.45, 0.47, 0.55),
            });
          } catch {
            /* ignore text stamp failure */
          }
        }
      }
      const out = await pdfDoc.save();
      // Copy into a fresh ArrayBuffer so BlobPart typing accepts it in DOM lib builds.
      const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return new Blob([copy.buffer], { type: 'application/pdf' });
    } catch {
      return blob;
    }
  }

  if (isText) {
    const stamp = watermarkTextForFormat(
      cfg,
      type.includes('csv') || name.endsWith('.csv') ? 'csv' : 'text',
    );
    if (!stamp) return blob;
    try {
      const raw = await blob.text();
      const kind =
        type.includes('html') || name.endsWith('.html') || name.endsWith('.htm')
          ? 'html'
          : type.includes('csv') || name.endsWith('.csv')
            ? 'csv'
            : 'text';
      const next = prependTextWatermark(raw, stamp, kind);
      return new Blob([next], { type: blob.type || 'text/plain;charset=utf-8' });
    } catch {
      return blob;
    }
  }

  return blob;
}

/** Warm session logo cache so the next export can embed without a race. */
export async function preloadOrgWatermarkLogo(
  settings?: ExportWatermarkSettings | null,
): Promise<void> {
  const cfg = normalizeExportWatermark(settings ?? readCachedOrgWatermark());
  if (!cfg.enabled) return;
  const src = watermarkImageForFormat(cfg, 'pdf') || cfg.imageUrl;
  if (!src) return;
  await fetchImageAsDataUrl(src);
}
export async function stampExcelJsWorkbook(
  workbook: {
    worksheets: Array<{
      insertRow: (index: number, values: unknown[]) => {
        font?: unknown;
        alignment?: unknown;
        height?: number;
        getCell?: (col: number) => { value?: unknown; font?: unknown };
      };
      addImage?: (imageId: number, range: unknown) => void;
      getRow?: (index: number) => { height?: number };
      mergeCells?: (range: string) => void;
    }>;
    addImage?: (opts: {
      base64?: string;
      buffer?: ArrayBuffer | Uint8Array;
      extension: 'png' | 'jpeg';
    }) => number;
  },
  text?: string,
  settingsOverride?: ExportWatermarkSettings | null,
): Promise<void> {
  const cfg = normalizeExportWatermark(settingsOverride ?? readCachedOrgWatermark());
  if (!cfg.enabled || !cfg.applyToExcel) return;
  if (!workbook?.worksheets?.length) return;

  const rawStamp = String(text || cfg.text || '').trim();
  const preferredText =
    rawStamp && rawStamp !== '[logo watermark]' ? rawStamp : String(cfg.text || '').trim();
  const imageUrl = watermarkImageForFormat(cfg, 'excel');

  let image: Awaited<ReturnType<typeof fetchImageAsDataUrl>> = null;
  if (imageUrl && workbook.addImage) {
    image = await fetchImageAsDataUrl(imageUrl);
  }
  const hasImage = Boolean(image?.dataUrl);

  const textStamp = hasImage
    ? ''
    : preferredText
      ? preferredText
      : imageUrl
        ? 'Organization watermark'
        : cfg.enabled
          ? 'Confidential'
          : '';

  for (const sheet of workbook.worksheets) {
    if (textStamp) {
      const row = sheet.insertRow(1, [`WATERMARK: ${textStamp}`]);
      row.font = { italic: true, color: { argb: 'FF64748B' }, size: 11 };
      row.alignment = { vertical: 'middle' };
      row.height = hasImage ? 78 : 22;
    } else if (hasImage) {
      const spacer = sheet.insertRow(1, ['']);
      spacer.height = 78;
    }
  }

  if (!image || !workbook.addImage) return;
  try {
    const base64 = image.dataUrl.includes(',')
      ? image.dataUrl.split(',')[1] || ''
      : image.dataUrl;
    if (!base64) return;
    const imageId = workbook.addImage({
      base64,
      extension: 'png',
    });
    const maxW = 220;
    const maxH = 70;
    const ratio = image.width / Math.max(1, image.height);
    let width = maxW;
    let height = width / ratio;
    if (height > maxH) {
      height = maxH;
      width = height * ratio;
    }
    for (const sheet of workbook.worksheets) {
      sheet.addImage?.(imageId, {
        tl: { col: 0.15, row: 0.15 },
        ext: { width: Math.round(width), height: Math.round(height) },
        editAs: 'oneCell',
      });
    }
  } catch (err) {
    console.warn('[stampExcelJsWorkbook] image embed failed', err);
  }
}

/**
 * Build an .xlsx workbook from tabular columns/rows and embed the org logo watermark.
 * Used when list "CSV" export has a logo configured (CSV cannot carry images).
 */
export async function downloadRowsAsWatermarkedXlsx<T>(
  filename: string,
  columns: Array<{ id: string; accessor: (row: T) => unknown }>,
  rows: T[],
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const { fetchAndCacheOrgWatermark } = await import('./useOrgExportWatermark');
    await fetchAndCacheOrgWatermark();
  } catch {
    /* cache optional */
  }

  const ExcelJSMod = await import('exceljs');
  const ExcelJS = (ExcelJSMod as { default?: unknown }).default ?? ExcelJSMod;
  const workbook = new (ExcelJS as {
    Workbook: new () => {
      addWorksheet: (name: string) => {
        addRow: (values: unknown[]) => void;
        getRow: (n: number) => { font?: unknown };
      };
      worksheets: Array<{
        insertRow: (index: number, values: unknown[]) => {
          font?: unknown;
          alignment?: unknown;
          height?: number;
        };
        addImage?: (imageId: number, range: unknown) => void;
      }>;
      addImage: (opts: {
        base64?: string;
        buffer?: ArrayBuffer | Uint8Array;
        extension: 'png' | 'jpeg';
      }) => number;
      xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
    };
  }).Workbook();

  const sheet = workbook.addWorksheet('Export');
  const headers = columns.map((column) => column.id);
  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  for (const row of rows) {
    sheet.addRow(
      columns.map((column) => {
        const value = column.accessor(row);
        if (value === null || value === undefined) return '';
        if (value instanceof Date) {
          return Number.isNaN(value.getTime()) ? '' : value.toISOString();
        }
        if (Array.isArray(value)) {
          return value.filter((entry) => entry != null && entry !== '').map(String).join('; ');
        }
        if (typeof value === 'object') {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        }
        return value;
      }),
    );
  }

  const cfg = readCachedOrgWatermark();
  await stampExcelJsWorkbook(workbook, cfg.text || undefined);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeName = String(filename || 'export.csv')
    .replace(/\.csv$/i, '.xlsx')
    .replace(/\.xlsx$/i, '.xlsx');
  const finalName = /\.xlsx$/i.test(safeName) ? safeName : `${safeName}.xlsx`;
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = finalName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }
}
