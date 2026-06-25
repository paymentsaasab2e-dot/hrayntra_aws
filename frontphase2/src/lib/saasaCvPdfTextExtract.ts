import { buildResumeViewerUrl } from './resumePreview';
import {
  fetchSaasaCvPdfBytes,
  loadSaasaPdfJs,
  saasaPdfJsDocumentOptions,
} from './saasaCvPdfRender';

type PdfJsUtil = {
  transform: (m1: number[], m2: number[]) => number[];
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  hasEOL?: boolean;
};

type PdfViewport = {
  width: number;
  height: number;
  transform: number[];
};

type PdfPageLike = {
  getViewport: (opts: { scale: number }) => PdfViewport;
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isSectionHeading(line: string): boolean {
  const text = line.trim();
  if (!text || text.length > 72) return false;
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  return text === text.toUpperCase() && /[A-Z]/.test(text);
}

function groupPdfLines(
  items: PdfTextItem[],
  viewportTransform: number[],
  util: PdfJsUtil
): string[] {
  const runs: { top: number; left: number; text: string }[] = [];

  for (const item of items) {
    const str = typeof item.str === 'string' ? item.str : '';
    if (!str.trim()) continue;
    const itemTransform = item.transform;
    if (!itemTransform || itemTransform.length < 6) continue;
    const transform = util.transform(viewportTransform, itemTransform);
    const fontSize = Math.max(6, Math.hypot(transform[2], transform[3]));
    runs.push({
      top: transform[5] - fontSize,
      left: transform[4],
      text: str,
    });
  }

  runs.sort((a, b) => a.top - b.top || a.left - b.left);

  const lines: string[] = [];
  let current = '';
  let lastTop = -1;
  const threshold = 8;

  for (const run of runs) {
    if (lastTop >= 0 && Math.abs(run.top - lastTop) > threshold) {
      if (current.trim()) lines.push(current.trim());
      current = run.text;
    } else {
      const needsSpace =
        current.length > 0 && !/\s$/.test(current) && !/^\s/.test(run.text) && run.left > 0;
      current += (needsSpace ? ' ' : '') + run.text;
    }
    lastTop = run.top;
  }
  if (current.trim()) lines.push(current.trim());

  return lines;
}

function linesToHtml(lines: string[]): string {
  if (!lines.length) {
    return `<div class="saasa-cv-text-doc"><p class="saasa-cv-text-body">Click here and type your CV text. The original PDF is shown behind this page while you edit.</p></div>`;
  }

  const parts: string[] = [];
  let index = 0;

  for (const line of lines) {
    const safe = escapeHtml(line);
    if (index === 0) {
      parts.push(`<p class="saasa-cv-text-name"><strong>${safe}</strong></p>`);
    } else if (index === 1 && line.includes('@')) {
      parts.push(`<p class="saasa-cv-text-contact">${safe}</p>`);
    } else if (isSectionHeading(line)) {
      parts.push(`<p class="saasa-cv-text-heading"><strong>${safe}</strong></p>`);
    } else {
      parts.push(`<p class="saasa-cv-text-body">${safe}</p>`);
    }
    index += 1;
  }

  return `<div class="saasa-cv-text-doc">${parts.join('')}</div>`;
}

/** Extract PDF text as one editable HTML document (no overlay layers). */
export async function extractPdfResumeAsHtml(pdfUrl: string): Promise<string> {
  const pdfjs = await loadSaasaPdfJs();
  const util = (pdfjs as { Util?: PdfJsUtil }).Util;
  if (!util) throw new Error('PDF text extraction unavailable');

  const data = await fetchSaasaCvPdfBytes(buildResumeViewerUrl(pdfUrl));
  const pdf = await pdfjs.getDocument(saasaPdfJsDocumentOptions(data)).promise;

  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = (await pdf.getPage(pageNum)) as unknown as PdfPageLike;
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const pageLines = groupPdfLines(textContent.items, viewport.transform, util);
    allLines.push(...pageLines);
    if (pageNum < pdf.numPages && pageLines.length) {
      allLines.push('');
    }
  }

  return linesToHtml(allLines.filter((l, i, arr) => !(l === '' && arr[i + 1] === '')));
}
