/**
 * Org-wide export watermark (Super Admin configures; all members inherit on exports).
 * Supports text and/or a logo image.
 */

export type ExportWatermarkSettings = {
  enabled: boolean;
  text: string;
  /** Uploaded logo / image URL used as visual watermark on PDF / Excel. */
  imageUrl: string;
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

export function normalizeExportWatermark(raw: unknown): ExportWatermarkSettings {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const text = String(input.text || '').trim().slice(0, 120);
  const imageUrl = String(input.imageUrl || input.logoUrl || '').trim();
  const opacityRaw = Number(input.opacity);
  const opacity = Number.isFinite(opacityRaw)
    ? Math.min(0.5, Math.max(0.05, opacityRaw))
    : DEFAULT_EXPORT_WATERMARK.opacity;
  const hasContent = text.length > 0 || imageUrl.length > 0;
  return {
    enabled: Boolean(input.enabled) && hasContent,
    text,
    imageUrl,
    opacity,
    applyToPdf: input.applyToPdf !== false,
    applyToExcel: input.applyToExcel !== false,
    applyToCsv: input.applyToCsv !== false,
  };
}

export function readCachedOrgWatermark(): ExportWatermarkSettings {
  if (typeof window === 'undefined') return DEFAULT_EXPORT_WATERMARK;
  try {
    const raw = localStorage.getItem(ORG_WATERMARK_CACHE_KEY);
    if (!raw) return DEFAULT_EXPORT_WATERMARK;
    return normalizeExportWatermark(JSON.parse(raw));
  } catch {
    return DEFAULT_EXPORT_WATERMARK;
  }
}

export function writeCachedOrgWatermark(settings: ExportWatermarkSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ORG_WATERMARK_CACHE_KEY, JSON.stringify(normalizeExportWatermark(settings)));
    window.dispatchEvent(new CustomEvent(ORG_WATERMARK_CACHE_EVENT));
  } catch {
    /* ignore */
  }
}

export function watermarkHasContent(settings: ExportWatermarkSettings | null | undefined): boolean {
  const cfg = normalizeExportWatermark(settings);
  return Boolean(cfg.text || cfg.imageUrl);
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
  // Real text stamp only — never return the image placeholder for Excel
  // (logo is embedded as an image). CSV/text keep a short marker when logo-only.
  if (cfg.text) return cfg.text;
  if (cfg.imageUrl && (format === 'csv' || format === 'text')) {
    return '[logo watermark]';
  }
  return '';
}

export function watermarkImageForFormat(
  settings: ExportWatermarkSettings | null | undefined,
  format: 'pdf' | 'excel',
): string {
  const cfg = normalizeExportWatermark(settings);
  if (!cfg.enabled || !cfg.imageUrl) return '';
  if (format === 'pdf' && !cfg.applyToPdf) return '';
  if (format === 'excel' && !cfg.applyToExcel) return '';
  return cfg.imageUrl;
}

/** Resolve a stored /uploads or absolute watermark image URL for fetch/display. */
export function resolveWatermarkImageSrc(imageUrl: string): string {
  const trimmed = String(imageUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (typeof window === 'undefined') return trimmed;

  const apiBase = String(process.env.NEXT_PUBLIC_API_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const origin = window.location.origin;

  // Prefer absolute API origin so we never hit the Next.js HTML fallback.
  if (trimmed.startsWith('/api/v1/')) {
    if (apiBase) {
      const root = apiBase.replace(/\/api\/v1\/?$/, '');
      return `${root}${trimmed}`;
    }
    return `${origin}${trimmed}`;
  }
  if (trimmed.startsWith('/uploads/')) {
    const sub = trimmed.replace(/^\/uploads\//, '');
    if (apiBase) return `${apiBase.replace(/\/api\/v1\/?$/, '')}/api/v1/public/uploads/${sub}`;
    return `${origin}/api/v1/public/uploads/${sub}`;
  }
  if (trimmed.startsWith('/') && apiBase) {
    const root = apiBase.replace(/\/api\/v1\/?$/, '');
    return `${root}${trimmed}`;
  }
  return trimmed;
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
  const src = resolveWatermarkImageSrc(imageUrl);
  if (!src) return null;
  try {
    const token =
      typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
    const response = await fetch(src, {
      cache: 'no-store',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return null;

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength < 32) return null;
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

    // Reject non-image payloads that somehow returned 200 (e.g. SPA HTML).
    if (!sniffed && contentType && !contentType.startsWith('image/')) {
      return null;
    }

    const blob = new Blob([buffer], { type: blobType });
    const painted = await decodeBlobToPngDataUrl(blob);
    if (painted) return painted;

    // Last resort for already-valid PNG/JPEG if canvas decode was blocked.
    if (sniffed) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(blob);
      });
      if (!dataUrl.startsWith('data:image/')) return null;
      return {
        dataUrl,
        format: sniffed === 'png' ? 'PNG' : 'JPEG',
        width: 180,
        height: 64,
      };
    }
    return null;
  } catch {
    return null;
  }
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

/** Stamp every page of a jsPDF document with text and/or logo image. */
export async function applyOrgWatermarkToJsPdf(pdf: JsPdfLike): Promise<void> {
  const cfg = readCachedOrgWatermark();
  if (!cfg.enabled) return;
  if (!cfg.applyToPdf) return;
  const opacity = Math.min(0.5, Math.max(0.05, cfg.opacity));
  const pages = pdf.getNumberOfPages();
  let image: { dataUrl: string; format: 'PNG' | 'JPEG' } | null = null;
  if (cfg.imageUrl) {
    image = await fetchImageAsDataUrl(cfg.imageUrl);
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
      const imgW = Math.min(width * 0.45, 90);
      const imgH = imgW * 0.55;
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
          /* ignore image stamp failure */
        }
      }
    }

    if (cfg.text) {
      pdf.setTextColor(120, 120, 140);
      pdf.setFontSize(Math.max(18, Math.min(42, Math.floor(width / 6))));
      pdf.text(cfg.text, width / 2, height / 2 + (image ? 28 : 0), { angle: 35, align: 'center' });
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
): Promise<Blob> {
  const cfg = readCachedOrgWatermark();
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
      const { PDFDocument, rgb, degrees } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.load(await blob.arrayBuffer(), {
        ignoreEncryption: true,
      });
      const pages = pdfDoc.getPages();
      const opacity = Math.min(0.5, Math.max(0.05, cfg.opacity));

      let embeddedImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
      if (cfg.imageUrl) {
        const image = await fetchImageAsDataUrl(cfg.imageUrl);
        if (image) {
          const base64 = image.dataUrl.split(',')[1] || '';
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          embeddedImage =
            image.format === 'PNG'
              ? await pdfDoc.embedPng(bytes)
              : await pdfDoc.embedJpg(bytes);
        }
      }

      for (const page of pages) {
        const { width, height } = page.getSize();
        if (embeddedImage) {
          const imgW = Math.min(width * 0.4, 220);
          const imgH = (embeddedImage.height / embeddedImage.width) * imgW;
          page.drawImage(embeddedImage, {
            x: (width - imgW) / 2,
            y: (height - imgH) / 2,
            width: imgW,
            height: imgH,
            opacity,
            rotate: degrees(35),
          });
        }
        if (cfg.text) {
          const size = Math.max(18, Math.min(48, Math.floor(width / 8)));
          page.drawText(cfg.text, {
            x: width * 0.18,
            y: height * 0.42 - (embeddedImage ? 40 : 0),
            size,
            rotate: degrees(35),
            opacity,
            color: rgb(0.45, 0.47, 0.55),
          });
        }
      }
      const out = await pdfDoc.save();
      return new Blob([out], { type: 'application/pdf' });
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

/** Prepend watermark note / embed logo image on exceljs workbook. */
export async function stampExcelJsWorkbook(
  workbook: {
    worksheets: Array<{
      insertRow: (index: number, values: unknown[]) => {
        font?: unknown;
        alignment?: unknown;
        height?: number;
      };
      addImage?: (imageId: number, range: unknown) => void;
      getRow?: (index: number) => { height?: number };
    }>;
    addImage?: (opts: {
      base64?: string;
      buffer?: ArrayBuffer | Uint8Array;
      extension: 'png' | 'jpeg';
    }) => number;
  },
  text?: string,
): Promise<void> {
  const cfg = readCachedOrgWatermark();
  if (!cfg.enabled || !cfg.applyToExcel) return;
  if (!workbook?.worksheets?.length) return;

  const rawStamp = String(text || cfg.text || '').trim();
  const textStamp =
    rawStamp && rawStamp !== '[logo watermark]' ? rawStamp : String(cfg.text || '').trim();
  const imageUrl = watermarkImageForFormat(cfg, 'excel');

  // Decode/convert first — never insert a blank spacer or broken white image box.
  let image: Awaited<ReturnType<typeof fetchImageAsDataUrl>> = null;
  if (imageUrl && workbook.addImage) {
    image = await fetchImageAsDataUrl(imageUrl);
  }

  const hasImage = Boolean(image?.dataUrl);

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
    const base64 = image.dataUrl.split(',')[1] || '';
    if (!base64) return;
    // Prefer raw bytes — more reliable than base64 strings in exceljs browser builds.
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const imageId = workbook.addImage({
      buffer: bytes,
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
  } catch {
    /* image optional on excel */
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

  await stampExcelJsWorkbook(workbook, readCachedOrgWatermark().text);

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
