'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fixRenderedDocxLayout, prepareDocxBlobForPreview } from '../../lib/docxPreviewLayout';
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
  /** Always use docx-preview (required for HRYantra CV text editing). */
  preferBuiltIn?: boolean;
  /** Allow inline text edits on the rendered Word HTML. */
  editable?: boolean;
  /** Restored edited HTML from a previous HRYantra CV save. */
  initialDocumentHtml?: string | null;
  onDocumentHtmlChange?: (html: string) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}

const DOCX_EDITABLE_SELECTOR =
  '.docx-preview-resume p, .docx-preview-resume span, .docx-preview-resume li, .docx-preview-resume td, .docx-preview-resume th, .docx-preview-resume h1, .docx-preview-resume h2, .docx-preview-resume h3, .docx-preview-resume a';

function applyDocxInlineEditMode(bodyEl: HTMLElement, editable: boolean): void {
  bodyEl.contentEditable = 'false';
  bodyEl.classList.toggle('saasa-docx-editable', editable);

  const nodes = bodyEl.querySelectorAll(DOCX_EDITABLE_SELECTOR);
  if (nodes.length) {
    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      node.contentEditable = editable ? 'true' : 'false';
      node.spellcheck = false;
      node.classList.toggle('saasa-docx-text-node', editable);
    });
    return;
  }

  if (editable) {
    bodyEl.contentEditable = 'true';
  }
}

function ResumeDocxBuiltInViewer({
  resumeUrl,
  enabled,
  minHeight,
  editable = false,
  initialDocumentHtml = null,
  onDocumentHtmlChange,
  onReady,
  onError,
}: {
  resumeUrl: string;
  enabled: boolean;
  minHeight: string;
  editable?: boolean;
  initialDocumentHtml?: string | null;
  onDocumentHtmlChange?: (html: string) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const loadSeqRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    setError('');
    bodyEl.innerHTML = '';
    if (styleRef.current) styleRef.current.innerHTML = '';

    const loadDocx = async () => {
      try {
        const savedHtml = initialDocumentHtml?.trim();
        if (savedHtml) {
          bodyEl.innerHTML = savedHtml;
          if (cancelled || loadSeqRef.current !== seq) return;
          await fixRenderedDocxLayout(bodyEl, null);
          applyDocxInlineEditMode(bodyEl, editable);
          onReady?.();
          return;
        }

        const response = await fetch(buildResumeDocxBytesUrl(resumeUrl), { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load document (${response.status})`);
        }
        const blob = await response.blob();
        if (cancelled || loadSeqRef.current !== seq) return;
        if (!blob.size) {
          throw new Error('Document file is empty');
        }

        const prepared = await prepareDocxBlobForPreview(blob);
        if (cancelled || loadSeqRef.current !== seq) return;

        const { renderAsync } = await import('docx-preview');
        if (cancelled || loadSeqRef.current !== seq) return;

        await renderAsync(prepared.blob, bodyEl, styleRef.current ?? undefined, {
          className: 'docx-preview-resume',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
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
          await fixRenderedDocxLayout(bodyEl, prepared.layout);
          applyDocxInlineEditMode(bodyEl, editable);
          onReady?.();
        } else {
          const message = 'No preview content was rendered';
          setError(message);
          onError?.(message);
        }
      } catch (err: unknown) {
        if (!cancelled && loadSeqRef.current === seq) {
          const message = err instanceof Error ? err.message : 'Preview unavailable';
          setError(message);
          onError?.(message);
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
  }, [enabled, resumeUrl, initialDocumentHtml, editable, onReady, onError]);

  useEffect(() => {
    const bodyEl = bodyRef.current;
    if (!bodyEl || loading) return;
    applyDocxInlineEditMode(bodyEl, editable);
  }, [editable, loading]);

  const handleInput = () => {
    const html = bodyRef.current?.innerHTML ?? '';
    onDocumentHtmlChange?.(html);
  };

  return (
    <div className="relative h-full w-full" style={{ minHeight }}>
      <div ref={styleRef} className="sr-only" aria-hidden />
      <div className="h-full w-full overflow-x-hidden overflow-y-auto overscroll-y-contain px-2 py-4 sm:px-3">
        <div
          ref={bodyRef}
          className="resume-docx-body mx-auto w-full max-w-none"
          onInput={editable ? handleInput : undefined}
          suppressContentEditableWarning
        />
      </div>
      {loading ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-white/90">
          <div className="text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <p className="text-sm text-slate-600">Loading document…</p>
          </div>
        </div>
      ) : null}
      {!loading && error ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-white p-6 text-center">
          <p className="max-w-md text-sm text-slate-600">{error}</p>
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
  preferBuiltIn = false,
  editable = false,
  initialDocumentHtml = null,
  onDocumentHtmlChange,
  onReady,
  onError,
}: ResumeWordFileViewerProps) {
  const officeEmbedUrl = useMemo(() => {
    if (preferBuiltIn || editable) return '';
    if (!canEmbedOfficeOnlineForResume(resumeUrl)) return '';
    const fileUrl = buildResumeDocxPublicFileUrl(resumeUrl);
    return buildOfficeOnlineEmbedUrl(fileUrl);
  }, [resumeUrl, preferBuiltIn, editable]);

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
        editable={editable}
        initialDocumentHtml={initialDocumentHtml}
        onDocumentHtmlChange={onDocumentHtmlChange}
        onReady={onReady}
        onError={onError}
      />
    </div>
  );
}
