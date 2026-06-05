import {
  clampOpacity,
  colorWithOpacity,
  SAASA_CV_ANNOTATION_COLORS,
  SAASA_CV_DEFAULT_OPACITY,
  type SaasaCvAnnotation,
  type SaasaCvCompanyLogo,
  type SaasaCvPoint,
} from './saasaCvAnnotations';

export interface PaintCanvasSize {
  width: number;
  height: number;
  dpr: number;
}

export interface DraftPaint {
  type: 'draw' | 'highlight' | 'eraser';
  points: SaasaCvPoint[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pctToPx(x: number, y: number, width: number, height: number): { x: number; y: number } {
  return { x: (x / 100) * width, y: (y / 100) * height };
}

export function pxToPct(x: number, y: number, width: number, height: number): SaasaCvPoint {
  return {
    x: Math.min(100, Math.max(0, (x / width) * 100)),
    y: Math.min(100, Math.max(0, (y / height) * 100)),
  };
}

export function clientToPct(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  width: number,
  height: number
): SaasaCvPoint {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  return pxToPct(x, y, width, height);
}

/**
 * Map pointer position to % of full document (includes scroll offset).
 * Use when the CV scrolls in an outer container, not inside an iframe.
 */
export function clientToDocPercent(
  clientX: number,
  clientY: number,
  docEl: HTMLElement,
  scrollEl: HTMLElement
): SaasaCvPoint {
  const rect = docEl.getBoundingClientRect();
  const x = clientX - rect.left + scrollEl.scrollLeft;
  const y = clientY - rect.top + scrollEl.scrollTop;
  const w = docEl.offsetWidth || rect.width || 1;
  const h = docEl.offsetHeight || rect.height || 1;
  return {
    x: Math.min(100, Math.max(0, (x / w) * 100)),
    y: Math.min(100, Math.max(0, (y / h) * 100)),
  };
}

/** Brush size in px (stored on annotation). Legacy values under 2 are old viewBox units. */
export function resolveBrushPx(strokeWidth: number | undefined, canvasWidth: number): number {
  if (strokeWidth == null || !Number.isFinite(strokeWidth)) return 8;
  if (strokeWidth >= 2 && strokeWidth <= 96) return strokeWidth;
  return Math.max(2, strokeWidth * canvasWidth * 0.01);
}

/** Size paint canvas to exact document pixels (MS Paint — one sheet with the CV). */
export function syncCanvasToDocumentSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): PaintCanvasSize | null {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  if (w < 2 || h < 2) return null;

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: w, height: h, dpr };
}

export function syncCanvasToContainer(
  canvas: HTMLCanvasElement,
  container: HTMLElement
): PaintCanvasSize | null {
  return syncCanvasToDocumentSize(
    canvas,
    container.offsetWidth || container.clientWidth,
    container.offsetHeight || container.clientHeight
  );
}

/** Pointer → document % on a fixed-size paint surface inside a scroll parent. */
export function clientToPaintSurfacePercent(
  clientX: number,
  clientY: number,
  surfaceEl: HTMLElement,
  scrollEl: HTMLElement,
  docWidth: number,
  docHeight: number
): SaasaCvPoint {
  const rect = surfaceEl.getBoundingClientRect();
  const w = Math.max(1, docWidth || surfaceEl.offsetWidth);
  const h = Math.max(1, docHeight || surfaceEl.offsetHeight);
  const x = clientX - rect.left + scrollEl.scrollLeft;
  const y = clientY - rect.top + scrollEl.scrollTop;
  return pxToPct(x, y, w, h);
}

function pointsToPx(
  points: SaasaCvPoint[],
  width: number,
  height: number
): { x: number; y: number }[] {
  return points.map((p) => pctToPx(p.x, p.y, width, height));
}

/** Smooth freehand stroke (quadratic curves — MS Paint–style). */
export function drawSmoothStroke(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  opacity: number,
  lineWidthPx: number
): void {
  if (points.length < 2) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidthPx;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  ctx.stroke();
  ctx.restore();
}

export function drawHighlightRect(
  ctx: CanvasRenderingContext2D,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  width: number,
  height: number,
  color: string,
  opacity: number
): void {
  const x = (xPct / 100) * width;
  const y = (yPct / 100) * height;
  const w = (wPct / 100) * width;
  const h = (hPct / 100) * height;
  if (w < 2 || h < 2) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: SaasaCvAnnotation,
  width: number,
  height: number
): void {
  const color = ann.color || SAASA_CV_ANNOTATION_COLORS[ann.type as keyof typeof SAASA_CV_ANNOTATION_COLORS] || '#FDE047';
  const opacity = ann.opacity ?? SAASA_CV_DEFAULT_OPACITY[ann.type as keyof typeof SAASA_CV_DEFAULT_OPACITY] ?? 0.55;

  if (ann.type === 'draw' && ann.points && ann.points.length > 1) {
    const px = pointsToPx(ann.points, width, height);
    const lineWidth = resolveBrushPx(ann.strokeWidth, width);
    drawSmoothStroke(ctx, px, color, opacity, lineWidth);
    return;
  }

  if (ann.type === 'highlight') {
    drawHighlightRect(
      ctx,
      ann.x,
      ann.y,
      ann.width ?? 0,
      ann.height ?? 0,
      width,
      height,
      color,
      opacity
    );
  }
}

export function redrawPaintCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  annotations: SaasaCvAnnotation[],
  draft: DraftPaint | null,
  brush: { color: string; opacity: number; sizePx: number }
): void {
  ctx.clearRect(0, 0, width, height);

  for (const ann of annotations) {
    if (ann.type === 'draw' || ann.type === 'highlight') {
      drawAnnotation(ctx, ann, width, height);
    }
  }

  if (!draft) return;

  if (draft.type === 'draw' && draft.points.length > 1) {
    const px = pointsToPx(draft.points, width, height);
    drawSmoothStroke(ctx, px, brush.color, brush.opacity, brush.sizePx);
  } else if (draft.type === 'highlight' && draft.width > 0.3 && draft.height > 0.3) {
    drawHighlightRect(
      ctx,
      draft.x,
      draft.y,
      draft.width,
      draft.height,
      width,
      height,
      brush.color,
      brush.opacity
    );
  }
}

function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const lx = x1 + t * dx;
  const ly = y1 + t * dy;
  return Math.hypot(px - lx, py - ly);
}

function strokeHitByEraser(
  ann: SaasaCvAnnotation,
  eraserPx: { x: number; y: number }[],
  radius: number,
  width: number,
  height: number
): boolean {
  if (ann.type !== 'draw' || !ann.points?.length) return false;
  const pts = pointsToPx(ann.points, width, height);
  for (const e of eraserPx) {
    for (let i = 0; i < pts.length - 1; i++) {
      if (distPointToSegment(e.x, e.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= radius) {
        return true;
      }
    }
    for (const p of pts) {
      if (Math.hypot(e.x - p.x, e.y - p.y) <= radius) return true;
    }
  }
  return false;
}

function highlightHitByEraser(
  ann: SaasaCvAnnotation,
  eraserPx: { x: number; y: number }[],
  radius: number,
  width: number,
  height: number
): boolean {
  if (ann.type !== 'highlight') return false;
  const x = (ann.x / 100) * width;
  const y = (ann.y / 100) * height;
  const w = ((ann.width ?? 0) / 100) * width;
  const h = ((ann.height ?? 0) / 100) * height;
  for (const e of eraserPx) {
    if (e.x >= x - radius && e.x <= x + w + radius && e.y >= y - radius && e.y <= y + h + radius) {
      return true;
    }
  }
  return false;
}

/** Export paint layer as PNG (white background) for Files upload. */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load company logo'));
    img.src = src;
  });
}

/** Draw company logo onto the export canvas (paint layer) before PNG upload. */
export async function compositeCompanyLogoOnCanvas(
  canvas: HTMLCanvasElement,
  logo: SaasaCvCompanyLogo
): Promise<void> {
  const url = (logo.url || '').trim();
  if (!url) return;

  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width < 1 || canvas.height < 1) return;

  try {
    const img = await loadImageElement(url);
    const w = canvas.width;
    const h = canvas.height;
    const lw = (logo.width / 100) * w;
    const aspect =
      img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
    const lh =
      logo.height != null ? (logo.height / 100) * h : Math.min(lw * aspect, h * 0.25);
    const lx = (logo.x / 100) * w;
    const ly = (logo.y / 100) * h;
    ctx.save();
    ctx.globalAlpha = clampOpacity(logo.opacity, 1);
    ctx.drawImage(img, lx, ly, lw, lh);
    ctx.restore();
  } catch {
    /* skip logo if image cannot load (CORS, etc.) */
  }
}

export function exportPaintCanvasPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const w = canvas.width;
  const h = canvas.height;
  if (w < 1 || h < 1) return Promise.resolve(null);

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  if (!ctx) return Promise.resolve(null);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(canvas, 0, 0);

  return new Promise((resolve) => {
    off.toBlob((blob) => resolve(blob), 'image/png', 0.92);
  });
}

export function findAnnotationsHitByEraser(
  annotations: SaasaCvAnnotation[],
  eraserPointsPct: SaasaCvPoint[],
  eraserRadiusPx: number,
  width: number,
  height: number
): string[] {
  const eraserPx = pointsToPx(eraserPointsPct, width, height);
  const ids: string[] = [];
  for (const ann of annotations) {
    if (ann.type === 'comment' || ann.type === 'important') continue;
    const hit =
      ann.type === 'draw'
        ? strokeHitByEraser(ann, eraserPx, eraserRadiusPx, width, height)
        : highlightHitByEraser(ann, eraserPx, eraserRadiusPx, width, height);
    if (hit) ids.push(ann.id);
  }
  return ids;
}
