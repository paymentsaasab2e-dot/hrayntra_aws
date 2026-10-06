'use client';

import React, { useEffect, useRef, useState } from 'react';
import { fetchSaasaCvPdfBytes, loadSaasaPdfJs, saasaPdfJsDocumentOptions } from '../../lib/saasaCvPdfRender';

export interface SaasaCvPdfDocumentMeta {
  width: number;
  totalHeight: number;
  pageCount: number;
}

interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: string | { url: string; withCredentials?: boolean }) => {
    promise: Promise<PdfDocument>;
  };
}

interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
}

interface PdfPage {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (ctx: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
}

interface SaasaCvPdfViewerProps {
  pdfUrl: string;
  /** Shown in error state — usually the direct file URL, not the PDF proxy. */
  fallbackOpenUrl?: string;
  onReady?: (meta: SaasaCvPdfDocumentMeta) => void;
  onError?: (message: string) => void;
}

export function SaasaCvPdfViewer({
  pdfUrl,
  fallbackOpenUrl,
  onReady,
  onError,
}: SaasaCvPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      setLoading(true);
      setError(null);
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = '';

      try {
        const pdfjs = await loadSaasaPdfJs();
        const bytes = await fetchSaasaCvPdfBytes(pdfUrl);
        const pdf = await pdfjs.getDocument(
          saasaPdfJsDocumentOptions(bytes) as unknown as Parameters<PdfJsLib['getDocument']>[0],
        ).promise;
        if (cancelled) return;

        const width = Math.max(320, container.clientWidth || 800);
        let totalHeight = 0;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          if (cancelled) return;

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
          if (cancelled) return;

          const pageWrap = document.createElement('div');
          pageWrap.className = 'bg-white';
          if (pageNum < pdf.numPages) {
            pageWrap.className += ' border-b border-slate-200';
          }
          pageWrap.appendChild(canvas);
          container.appendChild(pageWrap);

          totalHeight += viewport.height;
        }

        if (totalHeight < 1) throw new Error('PDF has no renderable pages');

        onReady?.({
          width,
          totalHeight,
          pageCount: pdf.numPages,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to load PDF';
        if (!cancelled) {
          setError(message);
          onError?.(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void render();
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [pdfUrl, onReady, onError]);

  return (
    <div className="relative w-full rounded-xl border border-slate-200 bg-white">
      {loading ? (
        <div className="flex min-h-[min(82dvh,960px)] items-center justify-center">
          <p className="text-sm text-slate-600">Loading CV pages…</p>
        </div>
      ) : null}
      {error ? (
        <div className="flex min-h-[min(40dvh,480px)] flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <a
            href={fallbackOpenUrl || pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Open file in new tab
          </a>
        </div>
      ) : null}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
