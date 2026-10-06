import { buildResumePdfProxyUrl, detectResumeBufferKind } from './resumePreview';

/** PDF.js served by this app so the CV popup does not wait on an outside network. */
const PDFJS_SCRIPT = '/pdfjs/pdf.min.js';
const PDFJS_WORKER = '/pdfjs/pdf.worker.min.js';

export function saasaPdfJsDocumentOptions(
  data: ArrayBuffer | Uint8Array
): { data: ArrayBuffer | Uint8Array } {
  return { data };
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
      | {
          data: ArrayBuffer | Uint8Array;
        }
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
    existing.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return Promise.resolve(existing);
  }
  if (pdfJsLoadPromise) return pdfJsLoadPromise;

  pdfJsLoadPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pdfJsLoadPromise = null;
      reject(new Error('PDF.js load timeout'));
    }, 45000);

    const script = document.createElement('script');
    script.src = PDFJS_SCRIPT;
    script.async = true;
    script.onload = () => {
      const lib = getPdfJsLib();
      window.clearTimeout(timeout);
      if (!lib?.getDocument) {
        pdfJsLoadPromise = null;
        reject(new Error('PDF.js failed to initialize'));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
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

/** Clear cached PDF bytes when the HRYantra CV modal closes. */
export function clearSaasaCvPdfBytesCache(): void {
  pdfBytesCache.clear();
}

/** Render all PDF pages into host — same scroll box as the paint canvas (MS Paint style). */
export async function renderSaasaPdfPages(
  host: HTMLElement,
  pdfUrl: string,
  options?: {
    signal?: AbortSignal;
    /** Return false when a newer load superseded this one (prevents double pages). */
    isCurrent?: () => boolean;
    /** Already-fetched PDF bytes. Skips the URL fetch (used after a Word file is rewritten). */
    pdfBytes?: ArrayBuffer | Uint8Array;
    /** Keep the current page visible until the new pages are ready. */
    preserveUntilReady?: boolean;
  }
): Promise<SaasaCvPdfDocumentMeta> {
  const isCurrent = () => {
    if (options?.signal?.aborted) return false;
    if (options?.isCurrent && !options.isCurrent()) return false;
    return true;
  };
  const preserve = options?.preserveUntilReady === true;
  const fragment = document.createDocumentFragment();
  const mount: HTMLElement | DocumentFragment = preserve ? fragment : host;

  if (!preserve) host.innerHTML = '';
  const pdfjs = await loadSaasaPdfJs();
  if (!isCurrent()) {
    throw new DOMException('PDF render superseded', 'AbortError');
  }
  const provided = options?.pdfBytes;
  const data = provided
    ? provided instanceof Uint8Array
      ? provided.slice().buffer
      : provided.slice(0)
    : await fetchSaasaCvPdfBytes(pdfUrl);
  if (!isCurrent()) {
    throw new DOMException('PDF render superseded', 'AbortError');
  }
  const pdf = await pdfjs.getDocument(saasaPdfJsDocumentOptions(data)).promise;
  if (!isCurrent()) {
    throw new DOMException('PDF render superseded', 'AbortError');
  }

  const parentW =
    host.clientWidth ||
    host.offsetWidth ||
    host.parentElement?.clientWidth ||
    host.parentElement?.offsetWidth;
  const width = Math.max(320, Math.floor(parentW ?? 0) || 800);
  let totalHeight = 0;
  const pageHeightsPx: number[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (!isCurrent()) {
      if (!preserve) host.innerHTML = '';
      throw new DOMException('PDF render superseded', 'AbortError');
    }

    const page = await pdf.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const scale = width / base.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const ph = Math.floor(viewport.height);
    const pw = Math.floor(viewport.width);

    const pageWrap = document.createElement('div');
    pageWrap.className = 'saasa-pdf-page bg-white';
    pageWrap.dataset.pageNumber = String(pageNum);
    if (pageNum < pdf.numPages) pageWrap.classList.add('border-b', 'border-slate-200');
    pageWrap.style.position = 'relative';
    pageWrap.style.width = '100%';
    pageWrap.style.maxWidth = `${pw}px`;
    pageWrap.style.aspectRatio = `${pw} / ${ph}`;
    pageWrap.style.height = 'auto';
    pageWrap.style.margin = '0 auto';
    pageWrap.style.overflow = 'hidden';
    pageWrap.style.isolation = 'isolate';
    pageWrap.style.flexShrink = '0';

    canvas.width = pw;
    canvas.height = ph;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.className = 'saasa-pdf-page-canvas';

    await page.render({ canvasContext: ctx, viewport }).promise;
    if (!isCurrent()) {
      if (!preserve) host.innerHTML = '';
      throw new DOMException('PDF render superseded', 'AbortError');
    }

    pageWrap.appendChild(canvas);
    mount.appendChild(pageWrap);

    pageHeightsPx.push(ph);
    totalHeight += ph;
  }

  if (totalHeight < 1) throw new Error('PDF has no renderable pages');
  if (!isCurrent()) {
    throw new DOMException('PDF render superseded', 'AbortError');
  }
  if (preserve) host.replaceChildren(fragment);

  host.style.width = '100%';
  host.style.minHeight = `${totalHeight}px`;

  return { width, totalHeight, pageCount: pdf.numPages, pageHeightsPx };
}

/** Measure laid-out page heights after CSS/text-layer sync (keeps scroll + export in sync). */
export function measureSaasaPdfPageHeightsPx(host: HTMLElement | null): number[] {
  if (!host) return [];
  return Array.from(host.querySelectorAll(':scope > .saasa-pdf-page')).map((node) => {
    const el = node as HTMLElement;
    const canvas = el.querySelector('canvas');
    const fromLayout = Math.round(el.getBoundingClientRect().height || el.offsetHeight || 0);
    if (fromLayout > 1) return fromLayout;
    if (canvas instanceof HTMLCanvasElement && canvas.height > 0) return canvas.height;
    return 1;
  });
}
