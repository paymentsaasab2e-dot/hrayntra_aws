'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildOfficeOnlineEmbedUrl,
  buildResumeDocxBytesUrl,
  buildResumeDocxPublicFileUrl,
  canEmbedOfficeOnlineForResume,
} from '../../lib/resumePreview';

export interface ResumeWordFileViewerProps {
  resumeUrl: string;
  candidateName?: string;
  enabled?: boolean;
  className?: string;
  /** CSS min-height, e.g. `min(78dvh, 900px)` */
  minHeight?: string;
  onReady?: () => void;
  onError?: (message: string) => void;
}

function ResumeDocxBuiltInViewer({
  resumeUrl,
  enabled,
  minHeight,
  onReady,
  onError,
}: {
  resumeUrl: string;
  enabled: boolean;
  minHeight: string;
  onReady?: () => void;
  onError?: (message: string) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const loadSeqRef = useRef(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !resumeUrl) {
      setLoading(false);
      return;
    }

    const bodyEl = bodyRef.current;
    if (!bodyEl) return;

    const seq = ++loadSeqRef.current;
    let cancelled = false;

    setLoading(true);
    bodyEl.innerHTML = '';
    if (styleRef.current) styleRef.current.innerHTML = '';

    const loadDocx = async () => {
      try {
        const response = await fetch(buildResumeDocxBytesUrl(resumeUrl), { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load document (${response.status})`);
        }
        const blob = await response.blob();
        if (cancelled || loadSeqRef.current !== seq) return;
        if (!blob.size) {
          throw new Error('Document file is empty');
        }

        const { renderAsync } = await import('docx-preview');
        if (cancelled || loadSeqRef.current !== seq) return;

        await renderAsync(blob, bodyEl, styleRef.current ?? undefined, {
          className: 'docx-preview-resume',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          renderAltChunks: true,
        });

        if (cancelled || loadSeqRef.current !== seq) return;
        if (bodyEl.childElementCount > 0) {
          onReady?.();
        } else {
          onError?.('No preview content was rendered');
        }
      } catch (err: unknown) {
        if (!cancelled && loadSeqRef.current === seq) {
          onError?.(err instanceof Error ? err.message : 'Preview unavailable');
        }
      } finally {
        if (!cancelled && loadSeqRef.current === seq) {
          setLoading(false);
        }
      }
    };

    void loadDocx();

    return () => {
      cancelled = true;
    };
  }, [enabled, resumeUrl, onReady, onError]);

  return (
    <div className="relative h-full w-full" style={{ minHeight }}>
      <div ref={styleRef} className="sr-only" aria-hidden />
      <div className="h-full w-full overflow-y-auto overscroll-y-contain p-4 sm:p-6">
        <div ref={bodyRef} className="resume-docx-body mx-auto w-full max-w-[52rem]" />
      </div>
      {loading ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-white/90">
          <div className="text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <p className="text-sm text-slate-600">Loading document…</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Word Online (default) or built-in docx-preview — same as Resume tab. */
export function ResumeWordFileViewer({
  resumeUrl,
  candidateName = 'Candidate',
  enabled = true,
  className = '',
  minHeight = 'min(720px, calc(100vh - 14rem))',
  onReady,
  onError,
}: ResumeWordFileViewerProps) {
  const officeEmbedUrl = useMemo(() => {
    if (!canEmbedOfficeOnlineForResume(resumeUrl)) return '';
    const fileUrl = buildResumeDocxPublicFileUrl(resumeUrl);
    return buildOfficeOnlineEmbedUrl(fileUrl);
  }, [resumeUrl]);

  const useWordOnline = Boolean(enabled && officeEmbedUrl);
  const [officeFrameLoaded, setOfficeFrameLoaded] = useState(false);
  const [useBuiltInFallback, setUseBuiltInFallback] = useState(false);

  useEffect(() => {
    setOfficeFrameLoaded(false);
    setUseBuiltInFallback(false);
  }, [officeEmbedUrl, resumeUrl]);

  useEffect(() => {
    if (!enabled || !useWordOnline || useBuiltInFallback) return;
    const timer = window.setTimeout(() => {
      if (!officeFrameLoaded) {
        setUseBuiltInFallback(true);
      }
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [enabled, useWordOnline, useBuiltInFallback, officeFrameLoaded, officeEmbedUrl]);

  const rootClass = `resume-word-file-viewer relative h-full w-full ${className}`.trim();

  if (useWordOnline && !useBuiltInFallback) {
    return (
      <div className={rootClass} style={{ minHeight }} aria-label={`${candidateName} Word document`}>
        {!officeFrameLoaded ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-white/90">
            <div className="text-center">
              <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
              <p className="text-sm text-slate-600">Opening Word document…</p>
            </div>
          </div>
        ) : null}
        <iframe
          key={officeEmbedUrl}
          title={`${candidateName} Word document`}
          src={officeEmbedUrl}
          className="h-full w-full border-0 bg-white"
          style={{ minHeight }}
          onLoad={() => {
            setOfficeFrameLoaded(true);
            onReady?.();
          }}
          allow="fullscreen"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div className={rootClass} style={{ minHeight }}>
      <ResumeDocxBuiltInViewer
        resumeUrl={resumeUrl}
        enabled={enabled}
        minHeight={minHeight}
        onReady={onReady}
        onError={onError}
      />
    </div>
  );
}
