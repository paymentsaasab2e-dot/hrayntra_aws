import html2canvas from 'html2canvas';
import type { SaasaCvAnnotation, SaasaCvCompanyLogo } from './saasaCvAnnotations';
import {
  fetchSaasaCvPdfBytes,
  loadSaasaPdfJs,
  saasaPdfJsDocumentOptions,
} from './saasaCvPdfRender';
import { compositeCompanyLogoOnCanvas, redrawPaintCanvas } from './saasaCvPaintCanvas';

const SAASA_CV_PDF_JPEG_QUALITY = 0.88;

function drawPinAnnotationsOnCanvas(
  ctx: CanvasRenderingContext2D,
  annotations: SaasaCvAnnotation[],
  width: number,
  height: number
): void {
  for (const ann of annotations) {
    if (ann.type !== 'comment' && ann.type !== 'important') continue;
    const x = (ann.x / 100) * width;
    const y = (ann.y / 100) * height;
    const text = (ann.text || '').trim();
    const isImportant = ann.type === 'important';
    const pad = 6;
    ctx.save();
    ctx.font = '12px system-ui, sans-serif';
    const textW = text ? ctx.measureText(text).width : 0;
    const boxW = Math.min(width * 0.4, Math.max(28, textW + pad * 2));
    const boxH = text ? 28 : 22;
    const left = x - boxW / 2;
    const top = y - boxH / 2;
    ctx.fillStyle = isImportant ? '#FEF2F2' : '#EFF6FF';
    ctx.strokeStyle = isImportant ? '#FECACA' : '#BFDBFE';
    ctx.lineWidth = 1;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(left, top, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(left, top, boxW, boxH);
    }
    if (text) {
      ctx.fillStyle = isImportant ? '#7F1D1D' : '#1E3A8A';
      ctx.fillText(text, left + pad, top + 16);
    }
    ctx.restore();
  }
}

export function collectPdfPageCanvases(host: HTMLElement): HTMLCanvasElement[] {
  return Array.from(host.querySelectorAll(':scope > div canvas')).filter(
    (c): c is HTMLCanvasElement => c instanceof HTMLCanvasElement && c.width > 0 && c.height > 0
  );
}

export function collectPdfPageHeightsPx(host: HTMLElement): number[] {
  return collectPdfPageCanvases(host).map((c) => c.height);
}

function buildPageOffsetsPx(pageHeightsPx: number[]): number[] {
  const offsets = [0];
  for (const h of pageHeightsPx) offsets.push(offsets[offsets.length - 1] + h);
  return offsets;
}

function yPctToDocPx(yPct: number, docHeightPx: number): number {
  return (yPct / 100) * docHeightPx;
}

function translateAnnotationsForPage(
  annotations: SaasaCvAnnotation[],
  companyLogo: SaasaCvCompanyLogo | null,
  pageIndex: number,
  pageOffsetsPx: number[],
  docWidthPx: number,
  docHeightPx: number
): { annotations: SaasaCvAnnotation[]; companyLogo: SaasaCvCompanyLogo | null } {
  const pageTop = pageOffsetsPx[pageIndex] ?? 0;
  const pageBottom = pageOffsetsPx[pageIndex + 1] ?? docHeightPx;
  const pageHeight = pageBottom - pageTop;
  if (pageHeight <= 0) return { annotations: [], companyLogo: null };

  const toLocalY = (yPct: number) => {
    const yPx = yPctToDocPx(yPct, docHeightPx) - pageTop;
    return (yPx / pageHeight) * 100;
  };

  const onPageY = (yPct: number) => {
    const yPx = yPctToDocPx(yPct, docHeightPx);
    return yPx >= pageTop && yPx < pageBottom;
  };

  const mapped: SaasaCvAnnotation[] = [];

  for (const ann of annotations) {
    if (ann.type === 'draw' && ann.points && ann.points.length > 1) {
      const points = ann.points
        .filter((p) => {
          const yPx = yPctToDocPx(p.y, docHeightPx);
          return yPx >= pageTop && yPx < pageBottom;
        })
        .map((p) => ({ x: p.x, y: toLocalY(p.y) }));
      if (points.length < 2) continue;
      mapped.push({ ...ann, points });
    } else if (ann.type === 'highlight') {
      if (!onPageY(ann.y)) continue;
      mapped.push({ ...ann, y: toLocalY(ann.y) });
    } else if (ann.type === 'comment' || ann.type === 'important') {
      if (!onPageY(ann.y)) continue;
      mapped.push({ ...ann, y: toLocalY(ann.y) });
    }
  }

  let logo: SaasaCvCompanyLogo | null = null;
  if (companyLogo?.url?.trim() && onPageY(companyLogo.y)) {
    logo = { ...companyLogo, y: toLocalY(companyLogo.y) };
  }

  return { annotations: mapped, companyLogo: logo };
}

async function renderPageOverlayPng(
  widthPx: number,
  heightPx: number,
  annotations: SaasaCvAnnotation[],
  companyLogo: SaasaCvCompanyLogo | null
): Promise<Uint8Array | null> {
  if (widthPx < 1 || heightPx < 1) return null;

  const hasPaint = annotations.some((a) => a.type === 'draw' || a.type === 'highlight');
  const hasPins = annotations.some((a) => a.type === 'comment' || a.type === 'important');
  const hasLogo = Boolean(companyLogo?.url?.trim());
  if (!hasPaint && !hasPins && !hasLogo) return null;

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const paintMarks = annotations.filter((a) => a.type === 'draw' || a.type === 'highlight');
  if (paintMarks.length) {
    redrawPaintCanvas(ctx, widthPx, heightPx, paintMarks, null, {
      color: '#FDE047',
      opacity: 0.55,
      sizePx: 10,
    });
  }

  if (hasLogo && companyLogo) {
    await compositeCompanyLogoOnCanvas(canvas, companyLogo);
  }

  drawPinAnnotationsOnCanvas(ctx, annotations, widthPx, heightPx);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Keep original PDF pages intact; stamp transparent overlays (marks + logo) per page.
 */
export async function buildSaasaCvPdfPreservingSource(options: {
  pdfUrl: string;
  annotations: SaasaCvAnnotation[];
  companyLogo: SaasaCvCompanyLogo | null;
  displayWidthPx: number;
  displayPageHeightsPx: number[];
}): Promise<Blob | null> {
  const pageHeightsPx = options.displayPageHeightsPx.filter((h) => h > 0);
  if (!pageHeightsPx.length) return null;

  const docWidthPx = Math.max(320, Math.floor(options.displayWidthPx) || 800);
  const docHeightPx = pageHeightsPx.reduce((sum, h) => sum + h, 0);
  if (docHeightPx < 1) return null;

  const sourceBytes = await fetchSaasaCvPdfBytes(options.pdfUrl);
  if (sourceBytes.byteLength < 100) return null;

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const pages = pdfDoc.getPages();
  if (!pages.length) return null;

  let heights = pageHeightsPx;
  if (heights.length !== pages.length) {
    const each = docHeightPx / pages.length;
    heights = pages.map(() => each);
  }

  const pageOffsetsPx = buildPageOffsetsPx(heights);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width: widthPt, height: heightPt } = page.getSize();
    const { annotations, companyLogo } = translateAnnotationsForPage(
      options.annotations,
      options.companyLogo,
      i,
      pageOffsetsPx,
      docWidthPx,
      docHeightPx
    );

    const overlayScale = 2;
    const overlayW = Math.max(1, Math.floor(widthPt * overlayScale));
    const overlayH = Math.max(1, Math.floor(heightPt * overlayScale));
    const overlayPng = await renderPageOverlayPng(
      overlayW,
      overlayH,
      annotations,
      companyLogo
    );
    if (!overlayPng) continue;

    const image = await pdfDoc.embedPng(overlayPng);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: widthPt,
      height: heightPt,
    });
  }

  const saved = await pdfDoc.save();
  if (saved.byteLength < Math.min(8000, sourceBytes.byteLength * 0.25)) {
    return null;
  }

  return new Blob([saved], { type: 'application/pdf' });
}

/** True if canvas has real CV pixels (not just white / transparent). */
function canvasHasDocumentContent(
  canvas: HTMLCanvasElement,
  options?: { maxYFraction?: number; minNonWhiteRatio?: number }
): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width < 8 || canvas.height < 8) return false;

  const maxY = Math.floor(canvas.height * (options?.maxYFraction ?? 1));
  const minRatio = options?.minNonWhiteRatio ?? 0.02;
  const step = Math.max(12, Math.floor(Math.min(canvas.width, canvas.height) / 40));
  let nonWhite = 0;
  let sampled = 0;

  for (let y = 0; y < maxY; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const { data } = ctx.getImageData(x, y, 1, 1);
      const a = data[3];
      if (a < 16) continue;
      const lum = 0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2];
      if (lum < 235) nonWhite += 1;
      sampled += 1;
    }
  }

  return sampled > 0 && nonWhite / sampled >= minRatio;
}

/** Source PDF page must show resume body (not only later paint / logo). */
function pageCanvasesHaveResumeContent(pageCanvases: HTMLCanvasElement[]): boolean {
  if (!pageCanvases.length) return false;
  return pageCanvases.some((canvas) =>
    canvasHasDocumentContent(canvas, { maxYFraction: 0.85, minNonWhiteRatio: 0.012 })
  );
}

async function buildCompositeCanvas(
  pageCanvases: HTMLCanvasElement[],
  annotations: SaasaCvAnnotation[],
  companyLogo: SaasaCvCompanyLogo | null
): Promise<{ canvas: HTMLCanvasElement; pageHeights: number[] } | null> {
  if (!pageCanvases.length) return null;
  if (!pageCanvasesHaveResumeContent(pageCanvases)) return null;

  const docWidth = pageCanvases[0].width;
  const pageHeights = pageCanvases.map((c) => c.height);
  let totalHeight = 0;
  for (const h of pageHeights) totalHeight += h;
  if (totalHeight < 1) return null;

  const off = document.createElement('canvas');
  off.width = docWidth;
  off.height = totalHeight;
  const ctx = off.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, off.width, off.height);

  let y = 0;
  for (const pageCanvas of pageCanvases) {
    ctx.drawImage(pageCanvas, 0, y);
    y += pageCanvas.height;
  }

  const paintMarks = annotations.filter((a) => a.type === 'draw' || a.type === 'highlight');
  if (paintMarks.length) {
    redrawPaintCanvas(ctx, off.width, off.height, paintMarks, null, {
      color: '#FDE047',
      opacity: 0.55,
      sizePx: 10,
    });
  }

  if (companyLogo?.url?.trim()) {
    await compositeCompanyLogoOnCanvas(off, companyLogo);
  }

  drawPinAnnotationsOnCanvas(ctx, annotations, off.width, off.height);

  return { canvas: off, pageHeights };
}

/** Turn composite canvas into a multi-page PDF (one PDF page per original CV page). */
export async function canvasToSaasaCvPdfBlob(
  fullCanvas: HTMLCanvasElement,
  pageHeights: number[]
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const widths = fullCanvas.width;
  const heights = pageHeights.length > 0 ? pageHeights : [fullCanvas.height];

  let pdf: InstanceType<typeof jsPDF> | null = null;
  let yOffset = 0;

  for (let i = 0; i < heights.length; i++) {
    const ph = Math.floor(heights[i]);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = widths;
    pageCanvas.height = ph;
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) continue;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widths, ph);
    ctx.drawImage(fullCanvas, 0, yOffset, widths, ph, 0, 0, widths, ph);

    const imgData = pageCanvas.toDataURL('image/jpeg', SAASA_CV_PDF_JPEG_QUALITY);
    const orientation = widths > ph ? 'landscape' : 'portrait';

    if (!pdf) {
      pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [widths, ph],
        compress: true,
      });
    } else {
      pdf.addPage([widths, ph], orientation);
    }

    pdf.addImage(imgData, 'JPEG', 0, 0, widths, ph, undefined, 'FAST');
    yOffset += ph;
  }

  if (!pdf) {
    pdf = new jsPDF({
      orientation: fullCanvas.width > fullCanvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [fullCanvas.width, fullCanvas.height],
      compress: true,
    });
    pdf.addImage(
      fullCanvas.toDataURL('image/jpeg', SAASA_CV_PDF_JPEG_QUALITY),
      'JPEG',
      0,
      0,
      fullCanvas.width,
      fullCanvas.height,
      undefined,
      'FAST'
    );
  }

  return pdf.output('blob');
}

export function withExportTimeout<T>(promise: Promise<T>, ms = 25000, label = 'Export'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out. Try again.`)), ms);
    }),
  ]);
}

/** Fast path: composite rendered PDF.js pages + visible paint layer + logo → PDF upload. */
export async function buildSaasaCvSnapshotFromPdfHost(
  host: HTMLElement,
  annotations: SaasaCvAnnotation[],
  companyLogo: SaasaCvCompanyLogo | null,
  expectedPageCount?: number
): Promise<Blob | null> {
  const pageCanvases = collectPdfPageCanvases(host);
  if (!pageCanvases.length) return null;
  if (expectedPageCount != null && pageCanvases.length < expectedPageCount) return null;

  const built = await buildCompositeCanvas(pageCanvases, annotations, companyLogo);
  if (!built) return null;

  return canvasToSaasaCvPdfBlob(built.canvas, built.pageHeights);
}

/** Re-render PDF from bytes + marks + logo → PDF upload. */
export async function buildSaasaCvPdfSnapshotBlob(options: {
  pdfUrl: string;
  width: number;
  annotations: SaasaCvAnnotation[];
  companyLogo: SaasaCvCompanyLogo | null;
}): Promise<Blob | null> {
  const docWidth = Math.max(320, Math.floor(options.width) || 800);
  const pdfjs = await loadSaasaPdfJs();
  const data = await fetchSaasaCvPdfBytes(options.pdfUrl);
  const pdf = await pdfjs.getDocument(saasaPdfJsDocumentOptions(data)).promise;

  const pageCanvases: HTMLCanvasElement[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const scale = docWidth / base.width;
    const viewport = page.getViewport({ scale });

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.floor(viewport.width);
    pageCanvas.height = Math.floor(viewport.height);
    const pctx = pageCanvas.getContext('2d');
    if (!pctx) continue;
    await page.render({ canvasContext: pctx, viewport }).promise;
    pageCanvases.push(pageCanvas);
  }

  const built = await buildCompositeCanvas(pageCanvases, options.annotations, options.companyLogo);
  if (!built) return null;

  return canvasToSaasaCvPdfBlob(built.canvas, built.pageHeights);
}

/**
 * Export SAASA CV as PDF: full resume + annotations + logo.
 * Prefer on-screen PDF.js pages (what you see in the modal), then re-fetch render.
 */
export async function exportSaasaCvDocumentPdf(options: {
  sourcePdfUrl: string;
  width: number;
  annotations: SaasaCvAnnotation[];
  companyLogo: SaasaCvCompanyLogo | null;
  pdfHost?: HTMLElement | null;
  expectedPageCount?: number;
  displayPageHeightsPx?: number[];
}): Promise<Blob | null> {
  const pageHeightsPx =
    options.displayPageHeightsPx?.length
      ? options.displayPageHeightsPx
      : options.pdfHost
        ? collectPdfPageHeightsPx(options.pdfHost)
        : [];

  if (pageHeightsPx.length > 0) {
    const preserved = await buildSaasaCvPdfPreservingSource({
      pdfUrl: options.sourcePdfUrl,
      annotations: options.annotations,
      companyLogo: options.companyLogo,
      displayWidthPx: options.width,
      displayPageHeightsPx: pageHeightsPx,
    });
    if (preserved) return preserved;
  }

  if (options.pdfHost) {
    const fromHost = await buildSaasaCvSnapshotFromPdfHost(
      options.pdfHost,
      options.annotations,
      options.companyLogo,
      options.expectedPageCount
    );
    if (fromHost) return fromHost;
  }

  return buildSaasaCvPdfSnapshotBlob({
    pdfUrl: options.sourcePdfUrl,
    width: options.width,
    annotations: options.annotations,
    companyLogo: options.companyLogo,
  });
}

/** Word / HTML surface → single-page PDF. */
export async function captureSaasaCvSurfacePdf(element: HTMLElement): Promise<Blob | null> {
  if (!element || element.offsetWidth < 2 || element.offsetHeight < 2) {
    return null;
  }

  try {
    const scale = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    return canvasToSaasaCvPdfBlob(canvas, [canvas.height]);
  } catch {
    return null;
  }
}

/** Alias for Word/HTML surface capture (exports PDF). */
export async function captureSaasaCvSurfacePng(element: HTMLElement): Promise<Blob | null> {
  return captureSaasaCvSurfacePdf(element);
}

/** Paint-only layer → single-page PDF (last-resort fallback). */
export async function exportPaintLayerPdf(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const w = canvas.width;
  const h = canvas.height;
  if (w < 1 || h < 1) return null;

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(canvas, 0, 0);

  return canvasToSaasaCvPdfBlob(off, [h]);
}
