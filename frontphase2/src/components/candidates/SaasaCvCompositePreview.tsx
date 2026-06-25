'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { ResumeWordFileViewer } from './ResumeWordFileViewer';
import {
  buildResumeViewerUrl,
  canPreviewResumeAsHtml,
  isImageResume,
  isPdfResume,
  isTextResume,
  normalizeResumeHref,
} from '../../lib/resumePreview';
import { SaasaCvRasterResumePreview } from './SaasaCvRasterResumePreview';
import type { SaasaCvAnnotation, SaasaCvCompanyLogo } from '../../lib/saasaCvAnnotations';
import { clearSaasaCvPdfBytesCache, renderSaasaPdfPages, type SaasaCvPdfDocumentMeta } from '../../lib/saasaCvPdfRender';
import { attachInPlacePdfTextToHost } from '../../lib/saasaCvPdfTextLayer';
import { redrawPaintCanvas, syncCanvasToDocumentSize } from '../../lib/saasaCvPaintCanvas';

const CV_VIEWER_MIN_HEIGHT = 'min(78dvh, 900px)';
const CV_VIEWER_MAX_WIDTH = 'min(92%, 52rem)';

interface SaasaCvCompositePreviewProps {
  baseResumeUrl: string;
  annotations?: SaasaCvAnnotation[];
  companyLogo?: SaasaCvCompanyLogo | null;
  documentHtml?: string | null;
  pdfTextLayerHtml?: string[] | null;
  candidateName?: string;
  enabled?: boolean;
  className?: string;
  minHeightClass?: string;
}

export function SaasaCvCompositePreview({
  baseResumeUrl,
  annotations = [],
  companyLogo = null,
  documentHtml = null,
  pdfTextLayerHtml = null,
  candidateName = 'Candidate',
  enabled = true,
  className = '',
  minHeightClass = 'min-h-[420px]',
}: SaasaCvCompositePreviewProps) {
  const href = useMemo(() => normalizeResumeHref(baseResumeUrl), [baseResumeUrl]);
  const canPdf = Boolean(href && isPdfResume(href));
  const canImage = Boolean(href && isImageResume(href));
  const canWord = Boolean(href && canPreviewResumeAsHtml(href));
  const canText = Boolean(href && isTextResume(href));

  const [pdfDocMeta, setPdfDocMeta] = useState<SaasaCvPdfDocumentMeta | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfRenderFailed, setPdfRenderFailed] = useState(false);
  const [wordPreviewReady, setWordPreviewReady] = useState(false);
  const [imagePreviewReady, setImagePreviewReady] = useState(false);
  const [textPreviewReady, setTextPreviewReady] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pdfHostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfLoadGenRef = useRef(0);

  const showImagePreview = canImage || pdfRenderFailed;
  const showPdfPreview = canPdf && !pdfRenderFailed;
  const paintSurfaceReady =
    Boolean(pdfDocMeta?.totalHeight) || wordPreviewReady || imagePreviewReady || textPreviewReady;
  const docHeightPx = pdfDocMeta?.totalHeight ?? 0;

  const pinAnnotations = annotations.filter((a) => a.type === 'comment' || a.type === 'important');
  const paintAnnotations = annotations.filter((a) => a.type === 'draw' || a.type === 'highlight');

  const shellClass =
    `flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-100 ${minHeightClass} ${className}`.trim();

  useEffect(() => {
    setPdfRenderFailed(false);
  }, [enabled, href]);

  useEffect(() => {
    if (!enabled || !canPdf || !href || pdfRenderFailed) {
      setPdfDocMeta(null);
      setPdfLoading(false);
      return;
    }

    const gen = ++pdfLoadGenRef.current;
    let cancelled = false;
    setPdfLoading(true);
    setPdfDocMeta(null);

    const loadPdf = () => {
      const host = pdfHostRef.current;
      if (!host) return false;

      void renderSaasaPdfPages(host, buildResumeViewerUrl(href))
        .then((meta) => {
          if (cancelled || gen !== pdfLoadGenRef.current) return;
          setPdfDocMeta(meta);
        })
        .catch(() => {
          if (cancelled || gen !== pdfLoadGenRef.current) return;
          setPdfDocMeta(null);
          setPdfRenderFailed(true);
        })
        .finally(() => {
          if (cancelled || gen !== pdfLoadGenRef.current) return;
          setPdfLoading(false);
        });
      return true;
    };

    if (!loadPdf()) {
      const id = window.requestAnimationFrame(() => {
        if (!cancelled && gen === pdfLoadGenRef.current) loadPdf();
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(id);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [enabled, canPdf, href, pdfRenderFailed]);

  useEffect(() => {
    if (!enabled || !showPdfPreview || !paintSurfaceReady || !href) return;
    const host = pdfHostRef.current;
    if (!host?.querySelector('canvas')) return;
    if (!pdfTextLayerHtml?.some((h) => h.trim())) return;

    let cancelled = false;
    void attachInPlacePdfTextToHost(host, buildResumeViewerUrl(href), {
      editing: true,
      readOnly: true,
      savedLayerHtml: pdfTextLayerHtml,
    }).catch(() => {
      if (!cancelled) {
        /* preview still shows PDF without text overlay */
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, showPdfPreview, paintSurfaceReady, href, pdfTextLayerHtml]);

  useEffect(() => {
    if (!enabled) return;
    setWordPreviewReady(false);
    setImagePreviewReady(false);
  }, [enabled, href]);

  useEffect(() => {
    if (!enabled || !paintSurfaceReady) return;

    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;

    let w = surface.offsetWidth || surface.clientWidth;
    let h = surface.offsetHeight || surface.clientHeight;
    if (showPdfPreview && pdfDocMeta?.totalHeight) {
      w = pdfDocMeta.width;
      h = pdfDocMeta.totalHeight;
    }

    const synced = syncCanvasToDocumentSize(canvas, w, h);
    if (!synced) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    redrawPaintCanvas(ctx, synced.width, synced.height, paintAnnotations, null, {
      color: '#FDE047',
      opacity: 0.55,
      sizePx: 10,
    });
  }, [enabled, paintSurfaceReady, paintAnnotations, pdfDocMeta, showPdfPreview]);

  useEffect(() => {
    if (!enabled || !surfaceRef.current || !paintSurfaceReady) return;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        const surface = surfaceRef.current;
        if (!canvas || !surface) return;
        let w = surface.offsetWidth;
        let h = surface.offsetHeight;
        if (showPdfPreview && pdfDocMeta?.totalHeight) {
          w = pdfDocMeta.width;
          h = pdfDocMeta.totalHeight;
        }
        const synced = syncCanvasToDocumentSize(canvas, w, h);
        if (!synced) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        redrawPaintCanvas(ctx, synced.width, synced.height, paintAnnotations, null, {
          color: '#FDE047',
          opacity: 0.55,
          sizePx: 10,
        });
      });
    });
    ro.observe(surfaceRef.current);
    return () => {
      window.cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [enabled, paintSurfaceReady, pdfDocMeta, showPdfPreview, paintAnnotations]);

  useEffect(() => {
    if (!enabled) {
      clearSaasaCvPdfBytesCache();
    }
  }, [enabled]);

  if (!enabled || !href) return null;

  return (
    <div className={shellClass} aria-label={`${candidateName} SAASA CV`}>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-3 sm:p-5"
      >
        <div
          ref={surfaceRef}
          className="relative mx-auto w-full select-none rounded-xl border border-slate-200 bg-white"
          style={
            showPdfPreview && paintSurfaceReady
              ? {
                  width: '100%',
                  maxWidth: CV_VIEWER_MAX_WIDTH,
                  height: docHeightPx,
                  minHeight: docHeightPx,
                }
              : { minHeight: CV_VIEWER_MIN_HEIGHT, maxWidth: CV_VIEWER_MAX_WIDTH }
          }
        >
          {showPdfPreview && pdfLoading && !paintSurfaceReady ? (
            <div
              className="flex items-center justify-center text-sm text-slate-600"
              style={{ minHeight: CV_VIEWER_MIN_HEIGHT }}
            >
              Loading SAASA CV…
            </div>
          ) : null}

          {showPdfPreview ? (
            <div ref={pdfHostRef} className="relative z-0 w-full" aria-hidden={!paintSurfaceReady} />
          ) : canWord ? (
            <ResumeWordFileViewer
              resumeUrl={href}
              candidateName={candidateName}
              enabled={enabled}
              preferBuiltIn={Boolean(documentHtml?.trim())}
              initialDocumentHtml={documentHtml}
              minHeight={CV_VIEWER_MIN_HEIGHT}
              className="relative z-0"
              onReady={() => setWordPreviewReady(true)}
            />
          ) : showImagePreview ? (
            <SaasaCvRasterResumePreview
              resumeUrl={href}
              candidateName={candidateName}
              mode="image"
              onReady={() => setImagePreviewReady(true)}
              onError={() => setImagePreviewReady(false)}
            />
          ) : canText ? (
            <SaasaCvRasterResumePreview
              resumeUrl={href}
              candidateName={candidateName}
              mode="text"
              initialTextContent={documentHtml}
              onReady={() => setTextPreviewReady(true)}
              onError={() => setTextPreviewReady(false)}
            />
          ) : (
            <div
              className="flex items-center justify-center p-8 text-sm text-slate-500"
              style={{ minHeight: CV_VIEWER_MIN_HEIGHT }}
            >
              Cannot preview this file type.
            </div>
          )}

          {companyLogo?.url ? (
            <div
              className="pointer-events-none absolute z-[18] select-none"
              style={{
                left: `${companyLogo.x}%`,
                top: `${companyLogo.y}%`,
                width: `${companyLogo.width}%`,
                maxWidth: '40%',
                opacity: companyLogo.opacity ?? 1,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={companyLogo.url}
                alt="Company logo"
                className="h-auto w-full object-contain"
                draggable={false}
              />
            </div>
          ) : null}

          {paintSurfaceReady ? (
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute left-0 top-0 z-10"
              aria-hidden
            />
          ) : null}

          {paintSurfaceReady
            ? pinAnnotations.map((ann) => (
                <div
                  key={ann.id}
                  className="pointer-events-none absolute z-[25] max-w-[min(240px,40vw)]"
                  style={{
                    left: `${ann.x}%`,
                    top: `${ann.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {ann.type === 'important' ? (
                    <div className="flex items-start gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 shadow-md">
                      <Star size={14} className="shrink-0 fill-red-600 text-red-600" />
                      {ann.text ? (
                        <span className="text-xs font-medium text-red-900">{ann.text}</span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 shadow-md">
                      <MessageSquare size={14} className="inline text-blue-600" />
                      {ann.text ? <p className="mt-0.5 text-xs text-blue-900">{ann.text}</p> : null}
                    </div>
                  )}
                </div>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
