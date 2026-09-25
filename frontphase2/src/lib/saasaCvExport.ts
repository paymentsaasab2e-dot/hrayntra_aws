import html2canvas from 'html2canvas';
import type { SaasaCvAnnotation, SaasaCvCompanyLogo } from './saasaCvAnnotations';
import {
  pdfTextLayerHtmlHasEdits,
  resolveSaasaCvLogoPageY,
  saasaCvLogoDocPositions,
} from './saasaCvAnnotations';
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
  const strict = Array.from(
    host.querySelectorAll(':scope > .saasa-pdf-page > canvas.saasa-pdf-page-canvas'),
  );
  const loose =
    strict.length > 0
      ? strict
      : Array.from(host.querySelectorAll('.saasa-pdf-page canvas, canvas.saasa-pdf-page-canvas'));
  return loose.filter(
    (c): c is HTMLCanvasElement => c instanceof HTMLCanvasElement && c.width > 0 && c.height > 0,
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
  pageHeightsPx: number[],
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
  if (companyLogo?.url?.trim()) {
    const positions = saasaCvLogoDocPositions(companyLogo, pageHeightsPx, docHeightPx);
    const hit = positions.find((p) => p.pageIndex === pageIndex);
    if (hit) {
      logo = {
        ...companyLogo,
        y:
          companyLogo.applyTo === 'all'
            ? resolveSaasaCvLogoPageY(companyLogo, pageHeightsPx, docHeightPx)
            : toLocalY(hit.y),
      };
    } else if (pageIndex === 0 && positions.length === 0) {
      // Degenerate heights — still stamp on first page so logo is never dropped.
      logo = {
        ...companyLogo,
        y: resolveSaasaCvLogoPageY(companyLogo, pageHeightsPx, docHeightPx),
      };
    }
  }

  return { annotations: mapped, companyLogo: logo };
}

/**
 * Map saved in-place text edits onto an overlay.
 * Prefer page-% coords (data-saasa-x-pct…) captured from the live preview on Save.
 * Fall back to canvas-space left/top. Also can stamp from the visible preview host.
 */
function parseSaasaPageSizeMarker(
  pageHtml: string
): { canvasW: number; canvasH: number; scale: number } | null {
  const m = String(pageHtml || '').match(
    /<!--saasa-page:([\d.]+)x([\d.]+):([\d.]+)-->/
  );
  if (!m) return null;
  const canvasW = parseFloat(m[1]);
  const canvasH = parseFloat(m[2]);
  const scale = parseFloat(m[3]) || 1;
  if (!(canvasW > 0) || !(canvasH > 0)) return null;
  return { canvasW, canvasH, scale };
}

function pageHtmlHasTextEdits(pageHtml: string | null | undefined): boolean {
  return /saasa-pdf-inplace-line--edited|saasa-pdf-inplace-line--cleared|data-saasa-touched\s*=\s*['"]?1['"]?/.test(
    String(pageHtml || '')
  );
}

function resolveEditCanvasSpace(
  pageHtml: string,
  overlayW: number,
  overlayH: number,
  fallbackW: number
): { spaceW: number; spaceH: number } {
  const marker = parseSaasaPageSizeMarker(pageHtml);
  if (marker && marker.canvasW > 8 && marker.canvasH > 8) {
    return { spaceW: marker.canvasW, spaceH: marker.canvasH };
  }

  const aspect = overlayH / Math.max(1, overlayW);
  const wrap = document.createElement('div');
  wrap.innerHTML = pageHtml;
  let maxR = 0;
  wrap.querySelectorAll('[data-saasa-left]').forEach((node) => {
    if (!(node instanceof HTMLSpanElement)) return;
    const left = parseFloat(node.dataset.saasaLeft || '0') || 0;
    const width = parseFloat(node.dataset.saasaWidth || '0') || 0;
    maxR = Math.max(maxR, left + width);
  });

  const spaceW = Math.max(fallbackW, maxR > 80 ? maxR / 0.9 : fallbackW);
  const spaceH = Math.max(1, spaceW * aspect);
  return { spaceW, spaceH };
}

/** Burned edits sit slightly below PDF glyphs — nudge up so whiteout covers originals. */
const EDIT_STAMP_Y_NUDGE = 0.32;
const EDIT_STAMP_PAD_X = 3;
const EDIT_STAMP_PAD_TOP = 0.45;
const EDIT_STAMP_PAD_BOTTOM = 0.2;

function paintEditedLineOnOverlay(
  ctx: CanvasRenderingContext2D,
  options: {
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
    cleared?: boolean;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
  }
): void {
  const { w, h } = options;
  if (!(w >= 4 && h >= 4)) return;

  const y = options.y - h * EDIT_STAMP_Y_NUDGE;
  const x = options.x;
  const padTop = h * EDIT_STAMP_PAD_TOP;
  const padBottom = h * EDIT_STAMP_PAD_BOTTOM;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(
    Math.max(0, x - EDIT_STAMP_PAD_X),
    Math.max(0, y - padTop),
    w + EDIT_STAMP_PAD_X * 2,
    h + padTop + padBottom
  );

  if (options.cleared || !String(options.text || '').trim()) {
    ctx.restore();
    return;
  }

  const fontPx = Math.max(6, h * 0.82);
  ctx.fillStyle = '#111827';
  ctx.font = `${options.fontStyle || 'normal'} ${options.fontWeight || '400'} ${fontPx}px ${
    options.fontFamily || 'Arial, sans-serif'
  }`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(options.text, x + 2, y + h / 2, Math.max(4, w - 4));
  ctx.restore();
}

/** Stamp edits from the on-screen HRYantra preview (same boxes the user sees). */
function drawEditedTextFromVisiblePreview(
  ctx: CanvasRenderingContext2D,
  pageIndex: number,
  overlayW: number,
  overlayH: number
): boolean {
  if (typeof document === 'undefined') return false;
  const hosts = Array.from(document.querySelectorAll('[data-saasa-cv-preview-host="1"]'));
  const host =
    hosts.find(
      (el) => el instanceof HTMLElement && el.getBoundingClientRect().width > 40
    ) || hosts[0];
  if (!(host instanceof HTMLElement)) return false;

  const pages = Array.from(host.querySelectorAll(':scope > .saasa-pdf-page'));
  const pageWrap = pages[pageIndex];
  if (!(pageWrap instanceof HTMLElement)) return false;

  const layer = pageWrap.querySelector('.saasa-pdf-inplace-layer');
  if (!(layer instanceof HTMLElement)) return false;

  const spans = Array.from(
    layer.querySelectorAll(
      '.saasa-pdf-inplace-line--edited, .saasa-pdf-inplace-line--cleared, [data-saasa-touched="1"]'
    )
  ).filter((n): n is HTMLSpanElement => n instanceof HTMLSpanElement);
  if (!spans.length) return false;

  const ref = layer.getBoundingClientRect();
  if (ref.width < 32 || ref.height < 32) return false;

  let painted = false;
  spans.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const x = ((rect.left - ref.left) / ref.width) * overlayW;
    const y = ((rect.top - ref.top) / ref.height) * overlayH;
    const w = (rect.width / ref.width) * overlayW;
    const h = (rect.height / ref.height) * overlayH;
    if (!(w >= 4 && h >= 4)) return;

    const styles = window.getComputedStyle(node);
    const text = String(node.textContent || '');
    paintEditedLineOnOverlay(ctx, {
      x,
      y,
      w,
      h,
      text,
      cleared:
        !text.trim() || node.classList.contains('saasa-pdf-inplace-line--cleared'),
      fontFamily: styles.fontFamily || undefined,
      fontWeight: styles.fontWeight || undefined,
      fontStyle: styles.fontStyle || undefined,
    });
    painted = true;
  });

  return painted;
}

function drawEditedTextHtmlOntoOverlay(
  ctx: CanvasRenderingContext2D,
  pageHtml: string,
  overlayW: number,
  overlayH: number,
  fallbackWidthPx: number
): void {
  const html = String(pageHtml || '').trim();
  if (!html || overlayW < 1 || overlayH < 1) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const spans = Array.from(
    wrap.querySelectorAll(
      '.saasa-pdf-inplace-line--edited, .saasa-pdf-inplace-line--cleared, [data-saasa-touched="1"]'
    )
  ).filter((n): n is HTMLSpanElement => n instanceof HTMLSpanElement);
  if (!spans.length) return;

  const { spaceW, spaceH } = resolveEditCanvasSpace(
    html,
    overlayW,
    overlayH,
    Math.max(320, fallbackWidthPx)
  );

  spans.forEach((node) => {
    const xPct = parseFloat(node.dataset.saasaXPct || '');
    const yPct = parseFloat(node.dataset.saasaYPct || '');
    const wPct = parseFloat(node.dataset.saasaWPct || '');
    const hPct = parseFloat(node.dataset.saasaHPct || '');

    let x: number;
    let y: number;
    let w: number;
    let h: number;

    if (
      Number.isFinite(xPct) &&
      Number.isFinite(yPct) &&
      Number.isFinite(wPct) &&
      Number.isFinite(hPct) &&
      wPct > 0.05 &&
      hPct > 0.05
    ) {
      x = (xPct / 100) * overlayW;
      y = (yPct / 100) * overlayH;
      w = (wPct / 100) * overlayW;
      h = (hPct / 100) * overlayH;
    } else {
      const left = parseFloat(node.dataset.saasaLeft || '');
      const top = parseFloat(node.dataset.saasaTop || '');
      const width = parseFloat(node.dataset.saasaWidth || '');
      const height = parseFloat(node.dataset.saasaHeight || '');
      if (!Number.isFinite(left) || !Number.isFinite(top)) return;

      const boxW = Number.isFinite(width) && width > 0 ? width : Math.max(24, spaceW * 0.2);
      const boxH = Number.isFinite(height) && height > 0 ? height : 12;
      x = (left / spaceW) * overlayW;
      y = (top / spaceH) * overlayH;
      w = (boxW / spaceW) * overlayW;
      h = (boxH / spaceH) * overlayH;
    }

    if (!(w >= 4 && h >= 4)) return;

    const text = String(node.textContent || '');
    paintEditedLineOnOverlay(ctx, {
      x,
      y,
      w,
      h,
      text,
      cleared:
        node.classList.contains('saasa-pdf-inplace-line--cleared') || !text.trim(),
      fontFamily: node.dataset.saasaFontFamily || node.style.fontFamily || undefined,
      fontWeight: node.dataset.saasaFontWeight || undefined,
      fontStyle: node.dataset.saasaFontStyle || undefined,
    });
  });
}

function findVisibleSaasaPreviewSurface(): {
  host: HTMLElement;
  surface: HTMLElement;
  paintCanvas: HTMLCanvasElement | null;
} | null {
  if (typeof document === 'undefined') return null;
  const hosts = Array.from(document.querySelectorAll('[data-saasa-cv-preview-host="1"]'));
  const host =
    hosts.find(
      (el) => el instanceof HTMLElement && el.getBoundingClientRect().width > 40
    ) || hosts[0];
  if (!(host instanceof HTMLElement)) return null;
  const surface = host.parentElement;
  if (!(surface instanceof HTMLElement)) return null;
  const paint = surface.querySelector('[data-saasa-cv-paint-canvas="1"]');
  return {
    host,
    surface,
    paintCanvas: paint instanceof HTMLCanvasElement ? paint : null,
  };
}

/** True if a canvas region has any visible paint (not fully transparent). */
function canvasRegionHasPaint(
  canvas: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number
): boolean {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || sw < 2 || sh < 2) return false;
    const w = Math.max(1, Math.floor(Math.min(sw, canvas.width - sx)));
    const h = Math.max(1, Math.floor(Math.min(sh, canvas.height - sy)));
    if (w < 2 || h < 2) return false;
    const step = Math.max(8, Math.floor(Math.min(w, h) / 20));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const { data } = ctx.getImageData(Math.floor(sx + x), Math.floor(sy + y), 1, 1);
        if (data[3] > 20) return true;
      }
    }
    return false;
  } catch {
    return true; // tainted / blocked — assume paint exists
  }
}

/**
 * Copy brush + highlight pixels from the on-screen preview for this page.
 * Matches preview coordinates exactly (avoids % remapping drift).
 */
function stampPaintFromVisiblePreview(
  ctx: CanvasRenderingContext2D,
  pageIndex: number,
  overlayW: number,
  overlayH: number
): boolean {
  const found = findVisibleSaasaPreviewSurface();
  if (!found?.paintCanvas) return false;
  const { host, surface, paintCanvas } = found;

  const pages = Array.from(host.querySelectorAll(':scope > .saasa-pdf-page'));
  const pageWrap = pages[pageIndex];
  if (!(pageWrap instanceof HTMLElement)) return false;

  const pageRect = pageWrap.getBoundingClientRect();
  const surfaceRect = surface.getBoundingClientRect();
  if (pageRect.width < 8 || pageRect.height < 8) return false;

  const cssW = Math.max(1, paintCanvas.clientWidth || surface.clientWidth || surfaceRect.width);
  const cssH = Math.max(1, paintCanvas.clientHeight || surface.clientHeight || surfaceRect.height);
  const scaleX = paintCanvas.width / cssW;
  const scaleY = paintCanvas.height / cssH;

  const srcX = Math.max(0, (pageRect.left - surfaceRect.left) * scaleX);
  const srcY = Math.max(0, (pageRect.top - surfaceRect.top) * scaleY);
  const srcW = Math.max(1, pageRect.width * scaleX);
  const srcH = Math.max(1, pageRect.height * scaleY);

  if (!canvasRegionHasPaint(paintCanvas, srcX, srcY, srcW, srcH)) return false;

  try {
    ctx.drawImage(paintCanvas, srcX, srcY, srcW, srcH, 0, 0, overlayW, overlayH);
    return true;
  } catch {
    return false;
  }
}

/** Shift page-local paint marks up when remapping % onto original PDF media box. */
function nudgePaintAnnotationsUp(annotations: SaasaCvAnnotation[], dyPct = 2.75): SaasaCvAnnotation[] {
  return annotations.map((ann) => {
    if (ann.type === 'highlight') {
      return { ...ann, y: Math.max(0, ann.y - dyPct) };
    }
    if (ann.type === 'draw' && ann.points?.length) {
      return {
        ...ann,
        points: ann.points.map((p) => ({ ...p, y: Math.max(0, p.y - dyPct) })),
        y: Math.max(0, (ann.y || 0) - dyPct),
      };
    }
    if (ann.type === 'comment' || ann.type === 'important') {
      return { ...ann, y: Math.max(0, ann.y - dyPct) };
    }
    return ann;
  });
}

/** Draw the logo from the on-screen preview box for this page. */
async function stampLogoFromVisiblePreview(
  ctx: CanvasRenderingContext2D,
  pageIndex: number,
  overlayW: number,
  overlayH: number,
  fallbackLogo: SaasaCvCompanyLogo | null
): Promise<boolean> {
  const found = findVisibleSaasaPreviewSurface();
  if (!found) return false;
  const { host, surface } = found;

  const logos = Array.from(
    surface.querySelectorAll('[data-saasa-cv-logo-stamp="1"]')
  ).filter((el): el is HTMLElement => el instanceof HTMLElement);
  const target =
    logos.find((el) => el.dataset.pageIndex === String(pageIndex)) ||
    (logos.length === 1 ? logos[0] : null);
  if (!target) return false;

  const pages = Array.from(host.querySelectorAll(':scope > .saasa-pdf-page'));
  const pageWrap = pages[pageIndex];
  if (!(pageWrap instanceof HTMLElement)) return false;

  const pageRect = pageWrap.getBoundingClientRect();
  const logoRect = target.getBoundingClientRect();
  if (pageRect.width < 8 || pageRect.height < 8 || logoRect.width < 2) return false;

  const img = target.querySelector('img');
  const src =
    (img instanceof HTMLImageElement ? img.currentSrc || img.src : '') ||
    fallbackLogo?.url ||
    '';
  if (!src) return false;

  const x = ((logoRect.left - pageRect.left) / pageRect.width) * overlayW;
  const y = ((logoRect.top - pageRect.top) / pageRect.height) * overlayH;
  const w = (logoRect.width / pageRect.width) * overlayW;
  const h = (logoRect.height / pageRect.height) * overlayH;

  try {
    const { fetchSaasaCvLogoBytes } = await import('./saasaCvPaintCanvas');
    const fetched = await fetchSaasaCvLogoBytes(src);
    if (!fetched) return false;
    const blob = new Blob([new Uint8Array(fetched.bytes)], { type: fetched.mime });
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('logo'));
        el.src = objectUrl;
      });
      ctx.save();
      ctx.globalAlpha = Math.min(
        1,
        Math.max(0.05, parseFloat(String(target.style.opacity || '1')) || 1)
      );
      ctx.drawImage(image, x, y, Math.max(1, w), Math.max(1, h));
      ctx.restore();
      return true;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return false;
  }
}

async function renderPageOverlayPng(
  widthPx: number,
  heightPx: number,
  annotations: SaasaCvAnnotation[],
  companyLogo: SaasaCvCompanyLogo | null,
  pageTextHtml?: string | null,
  fallbackWidthPx?: number,
  pageIndex?: number
): Promise<{ png: Uint8Array; drewLogo: boolean } | null> {
  if (widthPx < 1 || heightPx < 1) return null;

  const hasPaint = annotations.some((a) => a.type === 'draw' || a.type === 'highlight');
  const hasPins = annotations.some((a) => a.type === 'comment' || a.type === 'important');
  const hasLogo = Boolean(companyLogo?.url?.trim());
  const hasText = pageHtmlHasTextEdits(pageTextHtml);
  if (!hasPaint && !hasPins && !hasLogo && !hasText) return null;

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Text under paint/logo (same stacking as preview).
  let drewText = false;
  if (hasText && typeof pageIndex === 'number') {
    drewText = drawEditedTextFromVisiblePreview(ctx, pageIndex, widthPx, heightPx);
  }
  if (!drewText && hasText && pageTextHtml) {
    drawEditedTextHtmlOntoOverlay(
      ctx,
      pageTextHtml,
      widthPx,
      heightPx,
      fallbackWidthPx || 800
    );
  }

  // Prefer live preview paint pixels (exact preview position). Fallback remaps % with a
  // small upward nudge — remapping alone was shifting marks down vs preview.
  const paintMarks = annotations.filter((a) => a.type === 'draw' || a.type === 'highlight');
  let drewPaint = false;
  if (paintMarks.length && typeof pageIndex === 'number') {
    drewPaint = stampPaintFromVisiblePreview(ctx, pageIndex, widthPx, heightPx);
  }
  if (!drewPaint && paintMarks.length) {
    redrawPaintCanvas(
      ctx,
      widthPx,
      heightPx,
      nudgePaintAnnotationsUp(paintMarks),
      null,
      {
        color: '#FDE047',
        opacity: 0.55,
        sizePx: 10,
      },
      { clear: false }
    );
  }

  // Logo: live preview box first (correct x/y), then stored % via proxied blob.
  let drewLogo = false;
  if (hasLogo && typeof pageIndex === 'number') {
    drewLogo = await stampLogoFromVisiblePreview(
      ctx,
      pageIndex,
      widthPx,
      heightPx,
      companyLogo
    );
  }
  if (!drewLogo && hasLogo && companyLogo) {
    // Nudge stored logo up to match preview (same drift as paint remap).
    drewLogo = await compositeCompanyLogoOnCanvas(canvas, {
      ...companyLogo,
      y: Math.max(0, companyLogo.y - 1.25),
    });
  }

  drawPinAnnotationsOnCanvas(ctx, nudgePaintAnnotationsUp(annotations), widthPx, heightPx);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
  if (!blob) return null;
  return { png: new Uint8Array(await blob.arrayBuffer()), drewLogo };
}

/**
 * Keep original PDF pages intact; stamp transparent overlays
 * (text edits + marks + logo) per page.
 */
export async function buildSaasaCvPdfPreservingSource(options: {
  pdfUrl: string;
  annotations: SaasaCvAnnotation[];
  companyLogo: SaasaCvCompanyLogo | null;
  displayWidthPx: number;
  displayPageHeightsPx: number[];
  pdfTextLayerHtml?: string[] | null;
}): Promise<Blob | null> {
  const pageHeightsPx = options.displayPageHeightsPx.filter((h) => h > 0);
  if (!pageHeightsPx.length) return null;

  const docWidthPx = Math.max(320, Math.floor(options.displayWidthPx) || 800);
  const docHeightPx = pageHeightsPx.reduce((sum, h) => sum + h, 0);
  if (docHeightPx < 1) return null;

  const sourceBytes = await fetchSaasaCvPdfBytes(options.pdfUrl);
  if (sourceBytes.byteLength < 100) return null;
  // Paint-only blank exports are tiny; real resumes are much larger.
  if (sourceBytes.byteLength < 12_000) return null;

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const pages = pdfDoc.getPages();
  if (!pages.length) return null;

  let heights = pageHeightsPx;
  if (heights.length !== pages.length) {
    heights = pages.map((p) => {
      const { width: w, height: h } = p.getSize();
      return Math.max(1, docWidthPx * (h / Math.max(1, w)));
    });
  }

  const textPages = Array.isArray(options.pdfTextLayerHtml)
    ? options.pdfTextLayerHtml
    : [];

  const pageOffsetsPx = buildPageOffsetsPx(heights);
  const mappedDocHeight = heights.reduce((s, h) => s + h, 0) || docHeightPx;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width: widthPt, height: heightPt } = page.getSize();
    const { annotations, companyLogo } = translateAnnotationsForPage(
      options.annotations,
      options.companyLogo,
      i,
      pageOffsetsPx,
      heights,
      docWidthPx,
      mappedDocHeight
    );

    const overlayScale = 2;
    const overlayW = Math.max(1, Math.floor(widthPt * overlayScale));
    const overlayH = Math.max(1, Math.floor(heightPt * overlayScale));
    // Prefer saved editor canvas width so data-saasa-* coords map 1:1.
    const marker = parseSaasaPageSizeMarker(textPages[i] ?? '');
    const fallbackW = marker?.canvasW || docWidthPx;
    const overlayResult = await renderPageOverlayPng(
      overlayW,
      overlayH,
      annotations,
      companyLogo,
      textPages[i] ?? null,
      fallbackW,
      i
    );
    if (!overlayResult) continue;

    const image = await pdfDoc.embedPng(overlayResult.png);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: widthPt,
      height: heightPt,
    });

    // Only pdf-lib-embed logo when the overlay did not already draw it (avoid double / drift).
    if (companyLogo?.url?.trim() && !overlayResult.drewLogo) {
      try {
        const { fetchSaasaCvLogoBytes } = await import('./saasaCvPaintCanvas');
        const fetched = await fetchSaasaCvLogoBytes(companyLogo.url);
        if (fetched && fetched.bytes.byteLength > 32) {
          const isJpeg = /jpe?g/i.test(fetched.mime);
          const embedded = isJpeg
            ? await pdfDoc.embedJpg(fetched.bytes)
            : await pdfDoc.embedPng(fetched.bytes);
          const lw = (companyLogo.width / 100) * widthPt;
          const aspect = embedded.width > 0 ? embedded.height / embedded.width : 1;
          const lh =
            companyLogo.height != null
              ? (companyLogo.height / 100) * heightPt
              : Math.min(lw * aspect, heightPt * 0.25);
          const lx = (companyLogo.x / 100) * widthPt;
          const yPct = Math.max(0, companyLogo.y - 1.25);
          const ly = heightPt - (yPct / 100) * heightPt - lh;
          page.drawImage(embedded, {
            x: Math.max(0, lx),
            y: Math.max(0, ly),
            width: Math.max(4, lw),
            height: Math.max(4, lh),
            opacity: Math.min(1, Math.max(0.05, companyLogo.opacity ?? 1)),
          });
        }
      } catch {
        /* logo optional if bytes unavailable */
      }
    }
  }

  pdfDoc.setKeywords(['HryantraWm:clean']);
  const saved = await pdfDoc.save();
  if (saved.byteLength < Math.min(8000, sourceBytes.byteLength * 0.25)) {
    return null;
  }

  return new Blob([new Uint8Array(saved)], { type: 'application/pdf' });
}

/** True if canvas has real CV pixels (not just white / transparent). */
function canvasHasDocumentContent(
  canvas: HTMLCanvasElement,
  options?: { maxYFraction?: number; minNonWhiteRatio?: number }
): boolean {
  try {
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
  } catch {
    // Tainted canvas / SecurityError — assume content exists so we don't fall back to blank exports.
    return true;
  }
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
  // Do not reject on content heuristics — false negatives produced blank downloads
  // that only kept scribbles. Always composite what PDF.js rendered.

  const docWidth = pageCanvases[0].width;
  const pageHeights = pageCanvases.map((c) => c.height);
  let totalHeight = 0;
  for (const h of pageHeights) totalHeight += h;
  if (totalHeight < 1 || docWidth < 1) return null;

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
    // Must NOT clear — that wiped the resume pixels and left only scribbles.
    redrawPaintCanvas(
      ctx,
      off.width,
      off.height,
      paintMarks,
      null,
      {
        color: '#FDE047',
        opacity: 0.55,
        sizePx: 10,
      },
      { clear: false }
    );
  }

  if (companyLogo?.url?.trim()) {
    if (companyLogo.applyTo === 'all') {
      const pageY = resolveSaasaCvLogoPageY(companyLogo, pageHeights, totalHeight);
      let offsetY = 0;
      for (let i = 0; i < pageHeights.length; i++) {
        const ph = pageHeights[i];
        const localYPct = pageY;
        const docYPct = ((offsetY + (localYPct / 100) * ph) / totalHeight) * 100;
        await compositeCompanyLogoOnCanvas(off, { ...companyLogo, y: docYPct });
        offsetY += ph;
      }
    } else {
      await compositeCompanyLogoOnCanvas(off, companyLogo);
    }
  }

  drawPinAnnotationsOnCanvas(ctx, annotations, off.width, off.height);

  return { canvas: off, pageHeights };
}

/** Turn composite canvas into a multi-page PDF (one PDF page per original CV page). */
export async function canvasToSaasaCvPdfBlob(
  fullCanvas: HTMLCanvasElement,
  pageHeights: number[]
): Promise<Blob> {
  const widths = fullCanvas.width;
  const heights = pageHeights.length > 0 ? pageHeights : [fullCanvas.height];

  // Prefer pdf-lib + JPEG embeds — more reliable than jsPDF px-unit pages
  // (which produced blank pages with only scribble overlays for some users).
  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    let yOffset = 0;

    for (let i = 0; i < heights.length; i++) {
      const ph = Math.max(1, Math.floor(heights[i]));
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = widths;
      pageCanvas.height = ph;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) continue;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, widths, ph);
      ctx.drawImage(fullCanvas, 0, yOffset, widths, ph, 0, 0, widths, ph);

      const jpegDataUrl = pageCanvas.toDataURL('image/jpeg', SAASA_CV_PDF_JPEG_QUALITY);
      const base64 = jpegDataUrl.split(',')[1] || '';
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const image = await pdfDoc.embedJpg(bytes);

      // PDF points: map CSS/canvas px → points at 72dpi (1px ≈ 0.75pt at 96dpi)
      const pageW = widths * 0.75;
      const pageH = ph * 0.75;
      const page = pdfDoc.addPage([pageW, pageH]);
      page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });
      yOffset += ph;
    }

    if (pdfDoc.getPageCount() > 0) {
      pdfDoc.setKeywords(['HryantraWm:clean']);
      const saved = await pdfDoc.save();
      const bytes = saved instanceof Uint8Array ? saved : new Uint8Array(saved as ArrayBuffer);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return new Blob([copy.buffer], { type: 'application/pdf' });
    }
  } catch {
    /* fall through to jsPDF */
  }

  const { jsPDF } = await import('jspdf');
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
        unit: 'pt',
        format: [widths * 0.75, ph * 0.75],
        compress: true,
      });
    } else {
      pdf.addPage([widths * 0.75, ph * 0.75], orientation);
    }

    pdf.addImage(imgData, 'JPEG', 0, 0, widths * 0.75, ph * 0.75, undefined, 'FAST');
    yOffset += ph;
  }

  if (!pdf) {
    throw new Error('Could not build HRYantra CV PDF');
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
  // Bake Edit-text changes (including cleared lines) into page canvases before snapshot.
  const { burnInPlaceTextOntoPageCanvases } = await import('./saasaCvPdfTextLayer');
  burnInPlaceTextOntoPageCanvases(host);

  const pageCanvases = collectPdfPageCanvases(host);
  if (!pageCanvases.length) return null;
  if (expectedPageCount != null && pageCanvases.length < expectedPageCount) return null;

  const built = await buildCompositeCanvas(pageCanvases, annotations, companyLogo);
  if (!built) return null;

  return canvasToSaasaCvPdfBlob(built.canvas, built.pageHeights);
}

/** Re-render PDF from bytes + marks + logo (+ optional text edits) → PDF. */
export async function buildSaasaCvPdfSnapshotBlob(options: {
  pdfUrl: string;
  width: number;
  annotations: SaasaCvAnnotation[];
  companyLogo: SaasaCvCompanyLogo | null;
  pdfTextLayerHtml?: string[] | null;
}): Promise<Blob | null> {
  const docWidth = Math.max(320, Math.floor(options.width) || 800);
  const { renderSaasaPdfPages, clearSaasaCvPdfBytesCache } = await import('./saasaCvPdfRender');
  const {
    attachInPlacePdfTextToHost,
    burnInPlaceTextOntoPageCanvases,
    enforcePdfPageLayout,
  } = await import('./saasaCvPdfTextLayer');

  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:' +
    docWidth +
    'px;opacity:0;pointer-events:none;z-index:-1;background:#fff;';
  document.body.appendChild(host);

  try {
    await renderSaasaPdfPages(host, options.pdfUrl);
    enforcePdfPageLayout(host);

    const pages = collectPdfPageCanvases(host);
    if (!pages.length || !pageCanvasesHaveResumeContent(pages)) return null;

    if (pdfTextLayerHtmlHasEdits(options.pdfTextLayerHtml)) {
      await attachInPlacePdfTextToHost(host, options.pdfUrl, {
        editing: true,
        readOnly: true,
        savedLayerHtml: options.pdfTextLayerHtml,
      });
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      enforcePdfPageLayout(host);
      burnInPlaceTextOntoPageCanvases(host);
    }

    const built = await buildCompositeCanvas(
      collectPdfPageCanvases(host),
      options.annotations,
      options.companyLogo
    );
    if (!built) return null;
    if (!canvasHasDocumentContent(built.canvas, { minNonWhiteRatio: 0.01 })) return null;

    return canvasToSaasaCvPdfBlob(built.canvas, built.pageHeights);
  } catch {
    return null;
  } finally {
    host.remove();
    clearSaasaCvPdfBytesCache();
  }
}

/**
 * Export HRYantra CV as PDF: full resume + annotations + logo.
 * Prefer PDF.js raster of what the user sees — pdf-lib "preserve" can yield
 * blank pages for some Cloudinary/proxy PDFs while still stamping scribbles.
 */
export async function exportSaasaCvDocumentPdf(options: {
  sourcePdfUrl: string;
  width: number;
  annotations: SaasaCvAnnotation[];
  companyLogo: SaasaCvCompanyLogo | null;
  pdfHost?: HTMLElement | null;
  expectedPageCount?: number;
  displayPageHeightsPx?: number[];
  pdfTextLayerHtml?: string[] | null;
}): Promise<Blob | null> {
  // 1) Live editor pages (most reliable — same pixels as the modal)
  if (options.pdfHost) {
    const fromHost = await buildSaasaCvSnapshotFromPdfHost(
      options.pdfHost,
      options.annotations,
      options.companyLogo,
      options.expectedPageCount
    );
    if (fromHost) return fromHost;
  }

  // 2) Re-render original with PDF.js + composite marks
  const fromRender = await buildSaasaCvPdfSnapshotBlob({
    pdfUrl: options.sourcePdfUrl,
    width: options.width,
    annotations: options.annotations,
    companyLogo: options.companyLogo,
    pdfTextLayerHtml: options.pdfTextLayerHtml,
  });
  if (fromRender) return fromRender;

  // 3) Last resort: stamp overlays onto source PDF bytes
  const pageHeightsPx =
    options.displayPageHeightsPx?.length
      ? options.displayPageHeightsPx
      : options.pdfHost
        ? collectPdfPageHeightsPx(options.pdfHost)
        : [];

  if (pageHeightsPx.length > 0) {
    return buildSaasaCvPdfPreservingSource({
      pdfUrl: options.sourcePdfUrl,
      annotations: options.annotations,
      companyLogo: options.companyLogo,
      displayWidthPx: options.width,
      displayPageHeightsPx: pageHeightsPx,
      pdfTextLayerHtml: options.pdfTextLayerHtml,
    });
  }

  return null;
}

/**
 * Build a downloadable HRYantra CV from the original resume + saved scribbles /
 * text edits / logo.
 *
 * Prefer PDF.js composite (same coordinate space as preview) so marks/logo are not
 * shifted vs the original PDF media-box when using preserve+stamp.
 */
export async function exportSaasaCvFromStoredData(options: {
  resumeUrl: string;
  annotations?: SaasaCvAnnotation[];
  companyLogo?: SaasaCvCompanyLogo | null;
  pdfTextLayerHtml?: string[] | null;
  width?: number;
}): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const resumeUrl = String(options.resumeUrl || '').trim();
  if (!resumeUrl) return null;

  const annotations = Array.isArray(options.annotations) ? options.annotations : [];
  const companyLogo = options.companyLogo ?? null;
  const pdfTextLayerHtml = options.pdfTextLayerHtml ?? null;
  const width = Math.max(320, Math.floor(options.width || 800));
  const { buildResumeViewerUrl } = await import('./resumePreview');
  const viewerUrl = buildResumeViewerUrl(resumeUrl);

  // 1) Live HRYantra preview host — exact same pages the user is looking at.
  const found = findVisibleSaasaPreviewSurface();
  if (found?.host) {
    const livePages = collectPdfPageCanvases(found.host);
    if (livePages.length && pageCanvasesHaveResumeContent(livePages)) {
      const backups = livePages.map((src) => {
        const copy = document.createElement('canvas');
        copy.width = src.width;
        copy.height = src.height;
        copy.getContext('2d')?.drawImage(src, 0, 0);
        return copy;
      });
      try {
        if (pdfTextLayerHtmlHasEdits(pdfTextLayerHtml)) {
          const {
            applyInPlacePdfTextHtmlToHost,
            burnInPlaceTextOntoPageCanvases,
            enforcePdfPageLayout,
          } = await import('./saasaCvPdfTextLayer');
          applyInPlacePdfTextHtmlToHost(found.host, pdfTextLayerHtml, true);
          enforcePdfPageLayout(found.host);
          burnInPlaceTextOntoPageCanvases(found.host);
        }
        const fromHost = await buildSaasaCvSnapshotFromPdfHost(
          found.host,
          annotations,
          companyLogo
        );
        if (fromHost && fromHost.size > 12_000) return fromHost;
      } finally {
        const live = collectPdfPageCanvases(found.host);
        backups.forEach((b, i) => {
          const target = live[i];
          if (!target) return;
          const ctx = target.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, target.width, target.height);
          ctx.drawImage(b, 0, 0);
        });
      }
    }
  }

  // 2) Offscreen PDF.js render at the same width family as the editor.
  try {
    const raster = await buildSaasaCvPdfSnapshotBlob({
      pdfUrl: viewerUrl,
      width,
      annotations,
      companyLogo,
      pdfTextLayerHtml,
    });
    if (raster && raster.size > 12_000) return raster;
  } catch {
    /* fall through */
  }

  // 3) Last resort: stamp overlays onto original PDF bytes (may drift vs preview).
  try {
    const sourceBytes = await fetchSaasaCvPdfBytes(viewerUrl);
    if (sourceBytes.byteLength >= 12_000) {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.load(sourceBytes);
      const pdfPages = pdfDoc.getPages();
      if (pdfPages.length > 0) {
        const heights = pdfPages.map((p) => {
          const { width: w, height: h } = p.getSize();
          return Math.max(1, width * (h / Math.max(1, w)));
        });
        const preserved = await buildSaasaCvPdfPreservingSource({
          pdfUrl: viewerUrl,
          annotations,
          companyLogo,
          displayWidthPx: width,
          displayPageHeightsPx: heights,
          pdfTextLayerHtml,
        });
        if (preserved && preserved.size > 12_000) return preserved;
      }
    }
  } catch {
    /* fall through */
  }

  return null;
}

/** Word / HTML / fallback surface → PDF (split into pages when heights are known). */
export async function captureSaasaCvSurfacePdf(
  element: HTMLElement,
  pageHeightsPx?: number[]
): Promise<Blob | null> {
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
      height: element.scrollHeight || element.offsetHeight,
      windowHeight: element.scrollHeight || element.offsetHeight,
    });

    const heights =
      pageHeightsPx && pageHeightsPx.length > 1
        ? pageHeightsPx.map((h) => Math.max(1, Math.round(h * scale)))
        : [canvas.height];

    // If measured page heights don't cover the capture, keep a single tall page rather than truncating.
    const sum = heights.reduce((s, h) => s + h, 0);
    if (heights.length > 1 && Math.abs(sum - canvas.height) > Math.max(24, canvas.height * 0.08)) {
      return canvasToSaasaCvPdfBlob(canvas, [canvas.height]);
    }

    return canvasToSaasaCvPdfBlob(canvas, heights);
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
