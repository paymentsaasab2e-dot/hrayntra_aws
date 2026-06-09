import { buildResumePdfProxyUrl, detectResumeBufferKind } from './resumePreview';

/** PDF.js 3.11 — exposes window.pdfjsLib (required for SAASA paint surface). */
const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

/** Required for many resumes — without these, PDF.js renders blank white pages. */
export const PDFJS_CMAP_URL = `${PDFJS_CDN}/cmaps/`;
export const PDFJS_STANDARD_FONT_URL = `${PDFJS_CDN}/standard_fonts/`;

export function saasaPdfJsDocumentOptions(
  data: ArrayBuffer | Uint8Array
): { data: ArrayBuffer | Uint8Array; cMapUrl: string; cMapPacked: boolean; standardFontDataUrl: string } {
  return {
    data,
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
  };
}

export interface SaasaCvPdfDocumentMeta {
  width: number;
  totalHeight: number;
  pageCount: number;
  /** Per-page rendered heights in px (matches annotation % coordinates). */
  pageHeightsPx: number[];
}

interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (
    src:
      | string
      | { url: string; withCredentials?: boolean }
      | { data: ArrayBuffer | Uint8Array }
  ) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<PdfPage>;
    }>;
  };
}

interface PdfPage {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (ctx: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
}

function getPdfJsLib(): PdfJsLib | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { pdfjsLib?: PdfJsLib }).pdfjsLib ?? null;
}

let pdfJsLoadPromise: Promise<PdfJsLib> | null = null;

export function loadSaasaPdfJs(): Promise<PdfJsLib> {
  const existing = getPdfJsLib();
  if (existing?.getDocument) {
    existing.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
    return Promise.resolve(existing);
  }
  if (pdfJsLoadPromise) return pdfJsLoadPromise;

  pdfJsLoadPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pdfJsLoadPromise = null;
      reject(new Error('PDF.js load timeout'));
    }, 45000);

    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.async = true;
    script.onload = () => {
      const lib = getPdfJsLib();
      window.clearTimeout(timeout);
      if (!lib?.getDocument) {
        pdfJsLoadPromise = null;
        reject(new Error('PDF.js failed to initialize'));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve(lib);
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      pdfJsLoadPromise = null;
      reject(new Error('Failed to load PDF.js'));
    };
    document.head.appendChild(script);
  });

  return pdfJsLoadPromise;
}

const pdfBytesCache = new Map<string, Promise<ArrayBuffer>>();

function pdfBytesCacheKey(resolvedUrl: string): string {
  return resolvedUrl;
}

/** PDF.js transfers the buffer to its worker — each load needs its own copy. */
function clonePdfBytes(buffer: ArrayBuffer): ArrayBuffer {
  return buffer.slice(0);
}

/** Same-origin fetch as iframe preview — then pass bytes to PDF.js (avoids worker URL fetch errors). */
export async function fetchSaasaCvPdfBytes(pdfUrl: string): Promise<ArrayBuffer> {
  if (typeof window === 'undefined') {
    throw new Error('PDF load requires browser');
  }

  const proxied =
    pdfUrl.startsWith('/api/pdf-proxy') || pdfUrl.startsWith('/api/proxy/')
      ? pdfUrl
      : /^https?:\/\//i.test(pdfUrl)
        ? buildResumePdfProxyUrl(pdfUrl)
        : pdfUrl;

  const url =
    proxied.startsWith('http://') || proxied.startsWith('https://')
      ? proxied
      : `${window.location.origin}${proxied.startsWith('/') ? proxied : `/${proxied}`}`;

  const cacheKey = pdfBytesCacheKey(url);
  const cached = pdfBytesCache.get(cacheKey);
  if (cached) {
    const master = await cached;
    return clonePdfBytes(master);
  }

  const loadPromise = (async (): Promise<ArrayBuffer> => {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/pdf,*/*' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/failed to fetch/i.test(msg)) {
        throw new Error(
          'Could not reach the PDF proxy. Restart frontend (port 3001) and backend (port 5001), then try again.'
        );
      }
      throw err;
    }

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 240).trim();
      throw new Error(detail || `Failed to load CV (${res.status})`);
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength < 4) throw new Error('Empty PDF response');

    const bufferKind = detectResumeBufferKind(buf);
    if (bufferKind === 'image') {
      throw new Error('Response is not a valid PDF');
    }

    const magic = String.fromCharCode(...new Uint8Array(buf, 0, 4));
    if (magic !== '%PDF') throw new Error('Response is not a valid PDF');

    return buf;
  })();

  pdfBytesCache.set(cacheKey, loadPromise);
  try {
    const master = await loadPromise;
    return clonePdfBytes(master);
  } catch (e) {
    pdfBytesCache.delete(cacheKey);
    throw e;
  }
}

/** Clear cached PDF bytes when the SAASA CV modal closes. */
export function clearSaasaCvPdfBytesCache(): void {
  pdfBytesCache.clear();
}

/** Render all PDF pages into host — same scroll box as the paint canvas (MS Paint style). */
export async function renderSaasaPdfPages(
  host: HTMLElement,
  pdfUrl: string
): Promise<SaasaCvPdfDocumentMeta> {
  host.innerHTML = '';
  const pdfjs = await loadSaasaPdfJs();
  const data = await fetchSaasaCvPdfBytes(pdfUrl);
  const pdf = await pdfjs.getDocument(saasaPdfJsDocumentOptions(data)).promise;

  const parentW =
    host.parentElement?.clientWidth ||
    host.parentElement?.offsetWidth ||
    host.offsetWidth ||
    host.clientWidth;
  const width = Math.max(320, Math.floor(parentW) || 800);
  let totalHeight = 0;
  const pageHeightsPx: number[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const scale = width / base.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.className = 'block w-full max-w-full';

    await page.render({ canvasContext: ctx, viewport }).promise;

    const pageWrap = document.createElement('div');
    pageWrap.className = 'bg-white';
    if (pageNum < pdf.numPages) pageWrap.className += ' border-b border-slate-200';
    pageWrap.appendChild(canvas);
    host.appendChild(pageWrap);

    const ph = Math.floor(viewport.height);
    pageHeightsPx.push(ph);
    totalHeight += ph;
  }

  if (totalHeight < 1) throw new Error('PDF has no renderable pages');

  return { width, totalHeight, pageCount: pdf.numPages, pageHeightsPx };
}
