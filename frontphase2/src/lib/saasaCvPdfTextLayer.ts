import { buildResumeViewerUrl } from './resumePreview';
import {
  fetchSaasaCvPdfBytes,
  loadSaasaPdfJs,
  saasaPdfJsDocumentOptions,
} from './saasaCvPdfRender';

const TEXT_LAYER_CLASS = 'saasa-pdf-inplace-layer';
const TEXT_SPAN_CLASS = 'saasa-pdf-inplace-line';
const LINE_MASK_CLASS = 'saasa-pdf-line-mask';
const PAGE_SELECTOR = ':scope > .saasa-pdf-page';

const BULLET_CHAR_RE =
  /^[\u2022\u2023\u25E6\u2043\u2219\u00B7\u25AA\u25AB\u25CF\u25CB\u2024\uF0B7\uF076\uF0A7\uF0FC\s\-•·▪◦‣⁃oO]*$/;

type PdfJsUtil = {
  transform: (m1: number[], m2: number[]) => number[];
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
  hasEOL?: boolean;
};

type PdfTextStyle = {
  fontFamily?: string;
  ascent?: number;
  descent?: number;
};

type PdfViewport = {
  width: number;
  height: number;
  transform: number[];
};

type PdfPageLike = {
  getViewport: (opts: { scale: number }) => PdfViewport;
  getTextContent: () => Promise<{
    items: PdfTextItem[];
    styles: Record<string, PdfTextStyle>;
  }>;
};

type TextLineGroup = {
  top: number;
  left: number;
  right: number;
  fontSize: number;
  angle: number;
  text: string;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
};

type ResolvedPdfFont = {
  family: string;
  weight: string;
  style: string;
};

function resolvePdfFontWeight(fontName: string, styleFamily?: string): string {
  const hay = `${fontName} ${styleFamily || ''}`.toLowerCase();
  if (/\bblack\b/.test(hay)) return '900';
  if (/\b(extrabold|heavy|ultrabold)\b/.test(hay)) return '800';
  if (/\b(bold|semibold|demi)\b/.test(hay)) return '700';
  if (/\bmedium\b/.test(hay)) return '500';
  if (/\blight\b/.test(hay)) return '300';
  if (/\bthin\b/.test(hay)) return '100';
  return '400';
}

function resolvePdfFontStyle(fontName: string, styleFamily?: string): string {
  const hay = `${fontName} ${styleFamily || ''}`.toLowerCase();
  if (/\b(italic|oblique)\b/.test(hay)) return 'italic';
  return 'normal';
}

function isInternalPdfFontId(value: string): boolean {
  return /^g_[a-z0-9_]+$/i.test(value) || /^f\d+$/i.test(value) || value.length < 2;
}

/** Map PDF.js / PostScript font names to web fonts that match the rendered CV. */
function mapPdfFont(
  fontName?: string,
  style?: PdfTextStyle,
  pageFallbackFamily?: string | null
): ResolvedPdfFont {
  const name = String(fontName || '').trim();
  const styleFam = String(style?.fontFamily || '').trim();
  const combined = `${name} ${styleFam}`.toLowerCase();

  const weight = resolvePdfFontWeight(name, styleFam);
  const fontStyle = resolvePdfFontStyle(name, styleFam);

  if (styleFam && !isInternalPdfFontId(styleFam) && !/symbol|wingding|zapf|webding|dingbat/i.test(styleFam)) {
    const generic = styleFam.toLowerCase();
    if (generic === 'serif') {
      return { family: '"Times New Roman", Times, Georgia, serif', weight, style: fontStyle };
    }
    if (generic === 'sans-serif' || generic === 'sans') {
      return { family: 'Arial, Helvetica, "Segoe UI", sans-serif', weight, style: fontStyle };
    }
    if (generic === 'monospace' || generic === 'mono') {
      return { family: '"Courier New", Courier, monospace', weight, style: fontStyle };
    }
    if (!/^g_/.test(styleFam)) {
      const quoted = styleFam.includes(',') ? styleFam : `"${styleFam}"`;
      const fallback = /serif|times|georgia|garamond|cambria|palatino/i.test(combined)
        ? 'Georgia, serif'
        : 'Arial, Helvetica, sans-serif';
      return { family: `${quoted}, ${fallback}`, weight, style: fontStyle };
    }
  }

  if (/timesnewroman|times-new-roman|timesroman|times-roman|timesnewromanps|nimbusrom|liberationserif|notoserif|\btimes\b/i.test(combined)) {
    return { family: '"Times New Roman", Times, Georgia, serif', weight, style: fontStyle };
  }
  if (/cambria/i.test(combined)) {
    return { family: 'Cambria, Georgia, "Times New Roman", serif', weight, style: fontStyle };
  }
  if (/georgia/i.test(combined)) {
    return { family: 'Georgia, "Times New Roman", Times, serif', weight, style: fontStyle };
  }
  if (/garamond|baskerville|palatino|bookman|didot|bodoni/i.test(combined)) {
    return { family: 'Garamond, Palatino, "Times New Roman", Georgia, serif', weight, style: fontStyle };
  }
  if (/calibri/i.test(combined)) {
    return { family: 'Calibri, "Segoe UI", Arial, sans-serif', weight, style: fontStyle };
  }
  if (/arial|helvetica|helv|nimbussans|liberationsans|dejavusans|verdana|tahoma|segoe|roboto|opensans|open sans|ubuntu|franklin/i.test(combined)) {
    return { family: 'Arial, Helvetica, Calibri, "Segoe UI", sans-serif', weight, style: fontStyle };
  }
  if (/courier|consolas|mono/i.test(combined)) {
    return { family: '"Courier New", Courier, Consolas, monospace', weight, style: fontStyle };
  }

  if (/serif|roman/i.test(combined)) {
    return { family: '"Times New Roman", Times, Georgia, serif', weight, style: fontStyle };
  }

  if (pageFallbackFamily) {
    return { family: pageFallbackFamily, weight, style: fontStyle };
  }

  return { family: 'Arial, Helvetica, Calibri, "Segoe UI", sans-serif', weight, style: fontStyle };
}

/** When PDF.js only exposes internal font ids (g_d0_f1), infer serif vs sans from the page. */
function detectDominantFontFamily(
  items: PdfTextItem[],
  styles: Record<string, PdfTextStyle>
): string | null {
  let serif = 0;
  let sans = 0;
  for (const item of items) {
    const st = item.fontName ? styles[item.fontName] : undefined;
    const fam = `${item.fontName || ''} ${st?.fontFamily || ''}`.toLowerCase();
    if (/symbol|wingding|zapf/i.test(fam)) continue;
    if (/serif|times|georgia|cambria|garamond|palatino|roman|bookman/.test(fam) && !/sans/.test(fam)) {
      serif += 1;
    }
    if (/sans|arial|helvetica|calibri|segoe|verdana|tahoma|franklin/.test(fam)) {
      sans += 1;
    }
  }
  if (serif > sans && serif > 0) {
    return '"Times New Roman", Times, Georgia, serif';
  }
  if (sans > 0) {
    return 'Arial, Helvetica, Calibri, "Segoe UI", sans-serif';
  }
  return null;
}

function getPdfUtil(pdfjs: { Util?: PdfJsUtil }): PdfJsUtil | null {
  return pdfjs.Util ?? null;
}

/** Tiny PDF glyph fragments that render as stray dots when overlaid. */
function isStrayPdfFragment(str: string, fontSize: number): boolean {
  const t = str.trim();
  if (!t) return true;
  if (fontSize < 3.5) return true;
  if (t.length === 1 && fontSize < 6 && !/[A-Za-z0-9]/.test(t)) return true;
  return false;
}

function syncLineMask(mask: HTMLDivElement, span: HTMLSpanElement): void {
  const scale = parseFloat(span.dataset.saasaScale || '1') || 1;
  const top = parseFloat(span.dataset.saasaTop || '0') * scale;
  const height = resolveSpanBoxHeightPx(span);
  // Cover the PDF glyphs under this line only — do not bleed into the next line.
  const padY = Math.min(2, Math.max(1, height * 0.08));
  mask.style.position = 'absolute';
  mask.style.left = '0';
  mask.style.top = `${Math.max(0, top - padY)}px`;
  mask.style.width = '100%';
  mask.style.height = `${height + padY * 2}px`;
  mask.style.background = '#ffffff';
  mask.style.zIndex = '1';
  mask.style.pointerEvents = 'none';
}

/** Available vertical slot for this line before the next overlay line (display px). */
function resolveSpanBoxHeightPx(el: HTMLSpanElement): number {
  const scale = parseFloat(el.dataset.saasaScale || '1') || 1;
  const rawH = Math.max(6, parseFloat(el.dataset.saasaHeight || '12') || 12) * scale;
  const top = parseFloat(el.dataset.saasaTop || '0') * scale;

  let nextTop = Number.POSITIVE_INFINITY;
  const parent = el.parentElement;
  if (parent) {
    parent.querySelectorAll(`.${TEXT_SPAN_CLASS}`).forEach((node) => {
      if (!(node instanceof HTMLSpanElement) || node === el) return;
      const otherTop = parseFloat(node.dataset.saasaTop || '0') * scale;
      if (otherTop > top + 0.5 && otherTop < nextTop) nextTop = otherTop;
    });
  }

  if (Number.isFinite(nextTop)) {
    const gap = nextTop - top;
    if (gap > 2) {
      // Leave a hairline between lines so saved/exported text never stacks on itself.
      return Math.max(6, Math.min(rawH, gap * 0.9));
    }
  }
  return rawH;
}

/**
 * Keep each line box shorter than the distance to the next PDF line so
 * edited overlays (white bg + black text) do not collide after save/export.
 */
function clampLineBoxesToNeighbors(lines: TextLineGroup[]): TextLineGroup[] {
  if (lines.length < 2) return lines;
  const sorted = [...lines].sort((a, b) => a.top - b.top || a.left - b.left);
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const gap = next.top - cur.top;
    if (gap > 2 && cur.fontSize > gap * 0.9) {
      cur.fontSize = Math.max(6, gap * 0.88);
    }
  }
  return sorted;
}

function updateLineMaskVisibility(span: HTMLSpanElement): void {
  const mask = span.previousElementSibling;
  if (!(mask instanceof HTMLDivElement) || !mask.classList.contains(LINE_MASK_CLASS)) return;
  syncLineMask(mask, span);
  const show = isInPlaceSpanEdited(span);
  mask.style.display = show ? 'block' : 'none';
}

function createLineMask(span: HTMLSpanElement): HTMLDivElement {
  const mask = document.createElement('div');
  mask.className = LINE_MASK_CLASS;
  mask.setAttribute('aria-hidden', 'true');
  mask.style.display = 'none';
  syncLineMask(mask, span);
  return mask;
}

function ensureLineMask(span: HTMLSpanElement): HTMLDivElement {
  const prev = span.previousElementSibling;
  if (prev instanceof HTMLDivElement && prev.classList.contains(LINE_MASK_CLASS)) {
    return prev;
  }
  const mask = createLineMask(span);
  span.parentElement?.insertBefore(mask, span);
  return mask;
}

/** PDF bullets often use Symbol/Wingdings — skip overlay so the PDF raster shows them correctly. */
function isSymbolOrBulletItem(str: string, fontName?: string, style?: PdfTextStyle): boolean {
  const trimmed = str.trim();
  if (!trimmed) return true;

  const fontHaystack = `${fontName || ''} ${style?.fontFamily || ''}`.toLowerCase();
  if (/symbol|wingding|zapf|webding|dingbat|monotype-symbols|itc zapf/i.test(fontHaystack)) {
    return true;
  }

  if (trimmed.length <= 3 && BULLET_CHAR_RE.test(trimmed)) {
    return true;
  }

  if (trimmed.length === 1) {
    const code = trimmed.charCodeAt(0);
    if (code >= 0xe000 && code <= 0xf8ff) return true;
    if (code === 0xfffd) return true;
  }

  return false;
}

function getCanvasDisplayScale(canvas: HTMLCanvasElement): number {
  const rect = canvas.getBoundingClientRect();
  if (!canvas.width || rect.width <= 0) return 1;
  const scale = rect.width / canvas.width;
  return Math.max(0.05, Math.min(scale, 10));
}

function estimateRunWidth(str: string, fontSize: number, itemWidth: number | undefined, scaleX: number): number {
  if (itemWidth && itemWidth > 0) {
    return Math.max(fontSize * 0.35, itemWidth * Math.abs(scaleX));
  }
  return Math.max(fontSize * 0.45, str.length * fontSize * 0.52);
}

function groupTextItemsIntoLines(
  items: PdfTextItem[],
  viewportTransform: number[],
  util: PdfJsUtil,
  styles: Record<string, PdfTextStyle>,
  pageFallbackFamily?: string | null
): TextLineGroup[] {
  const runs: TextLineGroup[] = [];

  for (const item of items) {
    const str = typeof item.str === 'string' ? item.str : '';
    const style = item.fontName ? styles[item.fontName] : undefined;
    if (!str || isSymbolOrBulletItem(str, item.fontName, style)) continue;

    const itemTransform = item.transform;
    if (!itemTransform || itemTransform.length < 6) continue;

    const tx = util.transform(viewportTransform, itemTransform);
    const fontSize = Math.max(6, Math.hypot(tx[2], tx[3]));
    if (isStrayPdfFragment(str, fontSize)) continue;

    const angle = Math.atan2(tx[1], tx[0]);
    const fontAscent = style?.ascent ? style.ascent * fontSize : fontSize * 0.85;
    const left = tx[4];
    const top = tx[5] - fontAscent;
    const scaleX = Math.hypot(tx[0], tx[1]) || 1;
    const width = estimateRunWidth(str, fontSize, item.width, scaleX);
    const font = mapPdfFont(item.fontName, style, pageFallbackFamily);

    runs.push({
      top,
      left,
      right: left + width,
      fontSize,
      angle,
      text: str,
      fontFamily: font.family,
      fontWeight: font.weight,
      fontStyle: font.style,
    });
  }

  runs.sort((a, b) => a.top - b.top || a.left - b.left);

  const lines: TextLineGroup[] = [];
  const yThreshold = Math.max(3, (runs[0]?.fontSize ?? 12) * 0.45);

  for (const run of runs) {
    const last = lines[lines.length - 1];
    const gap = run.left - (last?.right ?? 0);
    const sameLine =
      last &&
      Math.abs(last.top - run.top) <= yThreshold &&
      Math.abs(last.angle - run.angle) < 0.02 &&
      gap <= run.fontSize * 1.25;

    if (sameLine) {
      const needsSpace =
        last.text.length > 0 &&
        run.text.length > 0 &&
        !/\s$/.test(last.text) &&
        !/^\s/.test(run.text) &&
        gap > run.fontSize * 0.12;
      last.text += (needsSpace ? ' ' : '') + run.text;
      last.left = Math.min(last.left, run.left);
      last.right = Math.max(last.right, run.right);
      last.fontSize = Math.max(last.fontSize, run.fontSize);
    } else {
      lines.push({ ...run });
    }
  }

  return lines.filter((line) => line.text.trim().length > 0);
}

function isInPlaceSpanEdited(el: HTMLSpanElement): boolean {
  return (
    el.classList.contains('saasa-pdf-inplace-line--edited') ||
    el.classList.contains('saasa-pdf-inplace-line--cleared') ||
    el.classList.contains('saasa-pdf-inplace-line--focused') ||
    el.getAttribute('data-saasa-touched') === '1'
  );
}

/** Unedited lines stay invisible so the PDF canvas shows through (no double text). */
function applyInPlaceSpanVisibility(el: HTMLSpanElement): void {
  if (isInPlaceSpanEdited(el)) {
    if (el.classList.contains('saasa-pdf-inplace-line--cleared') && !el.textContent?.trim()) {
      el.style.background = '#ffffff';
      el.style.color = 'transparent';
    } else {
      el.style.background = '#ffffff';
      el.style.color = '#111827';
    }
  } else {
    el.style.background = 'transparent';
    el.style.color = 'transparent';
  }
}

function maintainSpanBox(el: HTMLSpanElement): void {
  const width = el.dataset.saasaWidth;
  const left = el.dataset.saasaLeft;
  const top = el.dataset.saasaTop;
  const scale = parseFloat(el.dataset.saasaScale || '1') || 1;
  const boxH = resolveSpanBoxHeightPx(el);
  // Glyph size must stay inside the box — fontSize === box height + line-height 1.1
  // was colliding with the next resume line after save.
  const fontPx = Math.max(5, boxH * 0.82);

  if (left != null) el.style.left = `${parseFloat(left) * scale}px`;
  if (top != null) el.style.top = `${parseFloat(top) * scale}px`;
  if (width != null) {
    const w = parseFloat(width) * scale;
    el.style.width = `${w}px`;
    el.style.minWidth = `${w}px`;
  }

  el.style.height = `${boxH}px`;
  el.style.minHeight = `${boxH}px`;
  el.style.fontSize = `${fontPx}px`;
  el.style.lineHeight = '1';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.overflow = 'hidden';
  el.style.whiteSpace = 'pre';

  if (el.dataset.saasaFontFamily) el.style.fontFamily = el.dataset.saasaFontFamily;
  if (el.dataset.saasaFontWeight) el.style.fontWeight = el.dataset.saasaFontWeight;
  if (el.dataset.saasaFontStyle) el.style.fontStyle = el.dataset.saasaFontStyle;

  if (!el.textContent?.length) {
    el.classList.add('saasa-pdf-inplace-line--cleared');
    el.style.minHeight = `${boxH}px`;
  } else {
    el.classList.remove('saasa-pdf-inplace-line--cleared');
  }

  applyInPlaceSpanVisibility(el);
  updateLineMaskVisibility(el);
}

function wireSpanEditHandlers(el: HTMLSpanElement, readOnly: boolean): void {
  // Always restore correct visibility first (clears bad saved inline colors
  // that used to paint every line black and cause ghosting).
  applyInPlaceSpanVisibility(el);

  if (readOnly) {
    el.contentEditable = 'false';
    el.style.cursor = 'default';
    return;
  }

  if (el.dataset.saasaWired === '1') return;
  el.dataset.saasaWired = '1';

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });

  el.addEventListener('beforeinput', (e) => {
    const inputType = (e as InputEvent).inputType;
    if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
      e.preventDefault();
    }
  });

  el.addEventListener('input', () => {
    el.setAttribute('data-saasa-touched', '1');
    el.classList.add('saasa-pdf-inplace-line--edited');
    maintainSpanBox(el);
  });

  el.addEventListener('focus', () => {
    ensureLineMask(el);
    if (!el.dataset.saasaOriginal) {
      el.dataset.saasaOriginal = String(el.textContent || '');
    }
    el.classList.add('saasa-pdf-inplace-line--focused');
    maintainSpanBox(el);
  });

  el.addEventListener('blur', () => {
    el.classList.remove('saasa-pdf-inplace-line--focused');
    const original = el.dataset.saasaOriginal;
    if (original != null && String(el.textContent || '') !== original) {
      el.setAttribute('data-saasa-touched', '1');
      el.classList.add('saasa-pdf-inplace-line--edited');
    }
    maintainSpanBox(el);
  });
}

function buildLineSpan(line: TextLineGroup, displayScale: number, readOnly: boolean): HTMLSpanElement {
  const padX = 2;
  const lineWidth = Math.max(line.right - line.left + padX * 2, line.fontSize * 0.75);
  const boxH = Math.max(6, line.fontSize);
  const fontPx = Math.max(5, boxH * 0.82);

  const el = document.createElement('span');
  el.className = TEXT_SPAN_CLASS;
  el.textContent = line.text;
  el.setAttribute('role', 'textbox');
  el.contentEditable = readOnly ? 'false' : 'true';
  el.spellcheck = false;
  el.dataset.saasaLeft = String(line.left);
  el.dataset.saasaTop = String(line.top);
  el.dataset.saasaWidth = String(lineWidth);
  el.dataset.saasaHeight = String(boxH);
  el.dataset.saasaScale = String(displayScale);
  el.dataset.saasaFontFamily = line.fontFamily;
  el.dataset.saasaFontWeight = line.fontWeight;
  el.dataset.saasaFontStyle = line.fontStyle;
  el.dataset.saasaOriginal = line.text;
  el.style.position = 'absolute';
  el.style.left = `${Math.max(0, line.left - padX) * displayScale}px`;
  el.style.top = `${line.top * displayScale}px`;
  el.style.width = `${lineWidth * displayScale}px`;
  el.style.minWidth = `${lineWidth * displayScale}px`;
  el.style.height = `${boxH * displayScale}px`;
  el.style.minHeight = `${boxH * displayScale}px`;
  el.style.fontSize = `${fontPx * displayScale}px`;
  el.style.fontFamily = line.fontFamily;
  el.style.fontWeight = line.fontWeight;
  el.style.fontStyle = line.fontStyle;
  el.style.lineHeight = '1';
  el.style.letterSpacing = 'normal';
  el.style.whiteSpace = 'pre';
  el.style.overflow = 'hidden';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.margin = '0';
  el.style.padding = `0 ${padX}px`;
  el.style.border = 'none';
  el.style.outline = 'none';
  el.style.background = 'transparent';
  el.style.color = 'transparent';
  el.style.caretColor = '#111827';
  el.style.transformOrigin = '0% 0%';
  el.style.cursor = readOnly ? 'default' : 'text';
  el.style.zIndex = '2';
  el.style.boxSizing = 'border-box';

  if (Math.abs(line.angle) > 0.001) {
    el.style.transform = `rotate(${line.angle}rad)`;
  }

  wireSpanEditHandlers(el, readOnly);
  return el;
}

function populateLayer(
  layer: HTMLDivElement,
  items: PdfTextItem[],
  styles: Record<string, PdfTextStyle>,
  viewportTransform: number[],
  util: PdfJsUtil,
  displayScale: number,
  readOnly: boolean
): void {
  layer.innerHTML = '';
  const pageFallbackFamily = detectDominantFontFamily(items, styles);
  const lines = clampLineBoxesToNeighbors(
    groupTextItemsIntoLines(
      items,
      viewportTransform,
      util,
      styles,
      pageFallbackFamily
    )
  );
  for (const line of lines) {
    const span = buildLineSpan(line, displayScale, readOnly);
    const mask = createLineMask(span);
    layer.appendChild(mask);
    layer.appendChild(span);
  }
}

function shouldRemoveSavedSpan(node: HTMLSpanElement): boolean {
  return isSymbolOrBulletItem(node.textContent || '', undefined, {
    fontFamily: node.style.fontFamily,
  });
}

function wireSavedSpanNodes(layer: HTMLDivElement, canvas: HTMLCanvasElement, readOnly: boolean): void {
  const displayScale = getCanvasDisplayScale(canvas);
  layer.querySelectorAll(`.${TEXT_SPAN_CLASS}, span`).forEach((node) => {
    if (!(node instanceof HTMLSpanElement)) return;
    if (node.classList.contains(TEXT_LAYER_CLASS)) return;
    if (shouldRemoveSavedSpan(node)) {
      const prev = node.previousElementSibling;
      if (prev instanceof HTMLDivElement && prev.classList.contains(LINE_MASK_CLASS)) {
        prev.remove();
      }
      node.remove();
      return;
    }
    if (!node.classList.contains(TEXT_SPAN_CLASS)) {
      node.classList.add(TEXT_SPAN_CLASS);
    }
    if (!node.dataset.saasaScale) {
      node.dataset.saasaScale = String(displayScale);
    }
    if (!node.dataset.saasaFontFamily && node.style.fontFamily) {
      node.dataset.saasaFontFamily = node.style.fontFamily;
    }
    if (!node.dataset.saasaFontWeight && node.style.fontWeight) {
      node.dataset.saasaFontWeight = node.style.fontWeight;
    }
    if (!node.dataset.saasaFontStyle && node.style.fontStyle) {
      node.dataset.saasaFontStyle = node.style.fontStyle;
    }
    node.contentEditable = readOnly ? 'false' : 'true';
    node.spellcheck = false;
    if (!node.dataset.saasaOriginal) {
      node.dataset.saasaOriginal = String(node.textContent || '');
    }
    node.style.whiteSpace = 'pre';
    node.style.overflow = 'hidden';
    node.style.position = 'absolute';
    node.style.boxSizing = 'border-box';
    node.style.display = 'flex';
    node.style.alignItems = 'center';
    node.style.lineHeight = '1';
    wireSpanEditHandlers(node, readOnly);
    ensureLineMask(node);
    maintainSpanBox(node);
    updateLineMaskVisibility(node);
  });
  layer.querySelectorAll(`.${LINE_MASK_CLASS}`).forEach((mask) => {
    const next = mask.nextElementSibling;
    if (!(next instanceof HTMLSpanElement) || !next.classList.contains(TEXT_SPAN_CLASS)) {
      mask.remove();
    }
  });
}

function styleLayer(layer: HTMLDivElement, editing: boolean): void {
  layer.style.display = editing ? 'block' : 'none';
  layer.style.pointerEvents = editing ? 'auto' : 'none';
  layer.classList.toggle('saasa-pdf-inplace-layer--active', editing);
}

function syncLayerToCanvas(layer: HTMLDivElement, canvas: HTMLCanvasElement): number {
  const displayScale = getCanvasDisplayScale(canvas);
  const displayW = Math.max(1, canvas.clientWidth || Math.round(canvas.width * displayScale));
  const displayH = Math.max(1, canvas.clientHeight || Math.round(canvas.height * displayScale));
  layer.style.width = `${displayW}px`;
  layer.style.height = `${displayH}px`;
  layer.style.transform = 'none';
  return displayScale;
}

/** Keep each PDF page at the correct rendered aspect (prevents collapse / single-page clipping). */
export function enforcePdfPageLayout(host: HTMLElement | null): void {
  if (!host) return;
  host.querySelectorAll(PAGE_SELECTOR).forEach((pageWrap) => {
    const canvas = pageWrap.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 1 || canvas.height < 1) return;

    const wrap = pageWrap as HTMLElement;
    const pw = canvas.width;
    const ph = canvas.height;
    wrap.style.position = 'relative';
    wrap.style.width = '100%';
    wrap.style.maxWidth = `${pw}px`;
    wrap.style.aspectRatio = `${pw} / ${ph}`;
    wrap.style.height = 'auto';
    wrap.style.minHeight = '0';
    wrap.style.margin = '0 auto';
    wrap.style.overflow = 'hidden';
    wrap.style.flexShrink = '0';

    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    const layer = wrap.querySelector(`.${TEXT_LAYER_CLASS}`);
    if (layer instanceof HTMLDivElement) {
      const scale = syncLayerToCanvas(layer, canvas);
      layer.querySelectorAll(`.${TEXT_SPAN_CLASS}`).forEach((node) => {
        if (!(node instanceof HTMLSpanElement)) return;
        if (shouldRemoveSavedSpan(node)) {
          const prev = node.previousElementSibling;
          if (prev instanceof HTMLDivElement && prev.classList.contains(LINE_MASK_CLASS)) {
            prev.remove();
          }
          node.remove();
          return;
        }
        node.dataset.saasaScale = String(scale);
        maintainSpanBox(node);
        updateLineMaskVisibility(node);
      });
    }
  });
}

/** Place editable text on each PDF page at PDF.js text-layer positions. */
export async function attachInPlacePdfTextToHost(
  host: HTMLElement,
  pdfUrl: string,
  options?: {
    editing?: boolean;
    readOnly?: boolean;
    savedLayerHtml?: string[] | null;
  }
): Promise<void> {
  const pageWraps = Array.from(host.querySelectorAll(PAGE_SELECTOR));
  if (!pageWraps.length) return;

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  host.querySelectorAll(`.${TEXT_LAYER_CLASS}`).forEach((el) => el.remove());

  const editing = Boolean(options?.editing);
  const readOnly = Boolean(options?.readOnly);
  const saved = options?.savedLayerHtml ?? null;

  const pdfjs = await loadSaasaPdfJs();
  const util = getPdfUtil(pdfjs as { Util?: PdfJsUtil });
  if (!util) return;

  const data = await fetchSaasaCvPdfBytes(buildResumeViewerUrl(pdfUrl));
  const pdf = await pdfjs.getDocument(saasaPdfJsDocumentOptions(data)).promise;

  for (let pageIndex = 0; pageIndex < pageWraps.length; pageIndex++) {
    const pageWrap = pageWraps[pageIndex] as HTMLElement;
    const canvas = pageWrap.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) continue;

    const layer = document.createElement('div');
    layer.className = TEXT_LAYER_CLASS;
    layer.style.position = 'absolute';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.overflow = 'hidden';
    layer.style.zIndex = '5';
    layer.style.background = 'transparent';
    layer.style.lineHeight = '1';

    const displayScale = syncLayerToCanvas(layer, canvas);

    const savedHtml = saved?.[pageIndex]?.trim();
    if (savedHtml) {
      layer.innerHTML = savedHtml;
      wireSavedSpanNodes(layer, canvas, readOnly);
    } else if (pageIndex < pdf.numPages) {
      const page = (await pdf.getPage(pageIndex + 1)) as unknown as PdfPageLike;
      const base = page.getViewport({ scale: 1 });
      const scale = canvas.width / base.width;
      const viewport = page.getViewport({ scale });
      const textContent = await page.getTextContent();
      populateLayer(
        layer,
        textContent.items,
        textContent.styles ?? {},
        viewport.transform,
        util,
        displayScale,
        readOnly
      );
    }

    styleLayer(layer, editing || readOnly);
    pageWrap.appendChild(layer);
    enforcePdfPageLayout(host);
  }
}

export function resyncInPlacePdfTextLayers(host: HTMLElement | null): void {
  enforcePdfPageLayout(host);
}

export function setInPlacePdfTextEditing(host: HTMLElement | null, editing: boolean): void {
  if (!host) return;
  host.querySelectorAll(`.${TEXT_LAYER_CLASS}`).forEach((layer) => {
    if (layer instanceof HTMLDivElement) {
      styleLayer(layer, editing);
    }
  });
}

/** Strip accidental visible styles from unedited lines before persist. */
/** Embed page canvas size so download can map text edits without re-rendering PDF.js. */
function pageSizeMarkerForLayer(layer: Element): string {
  const page = layer.closest(PAGE_SELECTOR);
  const canvas = page?.querySelector('canvas');
  if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 1 || canvas.height < 1) {
    return '';
  }
  const scale = getCanvasDisplayScale(canvas);
  return `<!--saasa-page:${canvas.width}x${canvas.height}:${scale}-->`;
}

function sanitizeInPlaceLayerHtmlForPersist(layer: Element): string {
  const clone = layer.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`.${TEXT_SPAN_CLASS}, span`).forEach((node) => {
    if (!(node instanceof HTMLSpanElement)) return;
    if (!node.classList.contains(TEXT_SPAN_CLASS)) node.classList.add(TEXT_SPAN_CLASS);
    node.classList.remove('saasa-pdf-inplace-line--focused');
    delete node.dataset.saasaWired;
    if (!isInPlaceSpanEdited(node)) {
      node.style.color = 'transparent';
      node.style.background = 'transparent';
      node.classList.remove('saasa-pdf-inplace-line--edited');
      node.classList.remove('saasa-pdf-inplace-line--cleared');
      node.removeAttribute('data-saasa-touched');
    } else {
      // Persist only touch markers + cleaned visibility
      if (node.classList.contains('saasa-pdf-inplace-line--cleared') && !node.textContent?.trim()) {
        node.style.background = '#ffffff';
        node.style.color = 'transparent';
      } else {
        node.style.background = '#ffffff';
        node.style.color = '#111827';
      }
    }
  });
  clone.querySelectorAll(`.${LINE_MASK_CLASS}`).forEach((mask) => {
    const next = mask.nextElementSibling;
    if (!(next instanceof HTMLSpanElement) || !isInPlaceSpanEdited(next)) {
      mask.remove();
    } else if (mask instanceof HTMLElement) {
      mask.style.display = 'block';
    }
  });
  const marker = pageSizeMarkerForLayer(layer);
  return `${marker}${clone.innerHTML.trim()}`;
}

export function collectInPlacePdfTextHtml(host: HTMLElement | null): string[] {
  if (!host) return [];
  const layers = Array.from(host.querySelectorAll(`${PAGE_SELECTOR} .${TEXT_LAYER_CLASS}`));
  if (!layers.length) return [];

  // Mark lines whose text diverged from the original even if input events were missed.
  layers.forEach((layer) => {
    layer.querySelectorAll(`.${TEXT_SPAN_CLASS}`).forEach((node) => {
      if (!(node instanceof HTMLSpanElement)) return;
      const original = node.dataset.saasaOriginal;
      if (original != null && String(node.textContent || '') !== original) {
        node.setAttribute('data-saasa-touched', '1');
        node.classList.add('saasa-pdf-inplace-line--edited');
      }
    });
  });

  const hasTouched = layers.some((layer) =>
    layer.querySelector(
      `[data-saasa-touched='1'], .saasa-pdf-inplace-line--edited, .saasa-pdf-inplace-line--cleared`,
    ),
  );
  if (!hasTouched) return [];
  return layers.map((el) => sanitizeInPlaceLayerHtmlForPersist(el));
}

export function collectInPlacePdfTextHtmlRaw(host: HTMLElement | null): string[] | null {
  if (!host) return null;
  const layers = Array.from(host.querySelectorAll(`${PAGE_SELECTOR} .${TEXT_LAYER_CLASS}`));
  if (!layers.length) return null;
  return layers.map((el) => sanitizeInPlaceLayerHtmlForPersist(el));
}

export function applyInPlacePdfTextHtmlToHost(
  host: HTMLElement,
  pages: string[] | null,
  readOnly = false
): void {
  if (!pages) return;
  const pageWraps = Array.from(host.querySelectorAll(PAGE_SELECTOR));
  pageWraps.forEach((pageWrap, pageIndex) => {
    const canvas = pageWrap.querySelector('canvas');
    const layer = pageWrap.querySelector(`.${TEXT_LAYER_CLASS}`);
    if (!(layer instanceof HTMLDivElement) || !(canvas instanceof HTMLCanvasElement)) return;
    layer.innerHTML = pages[pageIndex] ?? '';
    wireSavedSpanNodes(layer, canvas, readOnly);
  });
  enforcePdfPageLayout(host);
}

/**
 * Paint edited/cleared in-place text onto each page canvas so exports/downloads
 * include the same text the user sees in preview (without overlapping).
 */
export function burnInPlaceTextOntoPageCanvases(host: HTMLElement | null): void {
  if (!host) return;
  host.querySelectorAll(PAGE_SELECTOR).forEach((pageWrap) => {
    const canvas = pageWrap.querySelector('canvas.saasa-pdf-page-canvas, canvas');
    const layer = pageWrap.querySelector(`.${TEXT_LAYER_CLASS}`);
    if (!(canvas instanceof HTMLCanvasElement) || !(layer instanceof HTMLDivElement)) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const displayW = Math.max(1, canvas.clientWidth || layer.clientWidth || canvas.width);
    const displayH = Math.max(1, canvas.clientHeight || layer.clientHeight || canvas.height);
    const scaleX = canvas.width / displayW;
    const scaleY = canvas.height / displayH;
    const layerRect = layer.getBoundingClientRect();

    layer.querySelectorAll(`.${TEXT_SPAN_CLASS}`).forEach((node) => {
      if (!(node instanceof HTMLSpanElement)) return;
      const edited = isInPlaceSpanEdited(node);
      if (!edited) return;

      const rect = node.getBoundingClientRect();
      const left = (rect.left - layerRect.left) * scaleX;
      const top = (rect.top - layerRect.top) * scaleY;
      const w = Math.max(1, rect.width * scaleX);
      const h = Math.max(1, rect.height * scaleY);

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.max(0, left - 2), Math.max(0, top - 2), w + 4, h + 4);

      const text = String(node.textContent || '');
      if (!text.trim() || node.classList.contains('saasa-pdf-inplace-line--cleared')) {
        ctx.restore();
        return;
      }

      const styles = window.getComputedStyle(node);
      const fontSize = Math.max(5, (parseFloat(styles.fontSize) || 12) * scaleY);
      ctx.fillStyle = '#111827';
      ctx.font = `${styles.fontStyle || 'normal'} ${styles.fontWeight || '400'} ${fontSize}px ${
        styles.fontFamily || 'Arial, sans-serif'
      }`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(text, left + 2 * scaleX, top + h / 2, Math.max(4, w - 4 * scaleX));
      ctx.restore();
    });
  });
}

export const attachPdfTextLayersToHost = attachInPlacePdfTextToHost;
export const setPdfTextEditMode = setInPlacePdfTextEditing;
export const collectPdfTextLayerHtml = collectInPlacePdfTextHtml;
