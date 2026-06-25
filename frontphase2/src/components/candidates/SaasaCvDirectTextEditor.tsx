'use client';

import React, { useEffect, useRef, useState } from 'react';
import { extractPdfResumeAsHtml } from '../../lib/saasaCvPdfTextExtract';

export interface SaasaCvDirectTextEditorProps {
  resumeUrl: string;
  enabled?: boolean;
  initialHtml?: string | null;
  onHtmlChange?: (html: string) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  className?: string;
  minHeight?: string;
}

function hasEditorContent(html: string): boolean {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0;
}

/** One contenteditable document — no PDF overlay layers. */
export function SaasaCvDirectTextEditor({
  resumeUrl,
  enabled = true,
  initialHtml = null,
  onHtmlChange,
  onReady,
  onError,
  className = '',
  minHeight = 'min(78dvh, 900px)',
}: SaasaCvDirectTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const loadSeqRef = useRef(0);
  const hydratedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!enabled || !resumeUrl) {
      setLoading(false);
      return;
    }
    if (hydratedRef.current) {
      setLoading(false);
      return;
    }

    const seq = ++loadSeqRef.current;
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const saved = initialHtml?.trim();
        const savedHasContent = Boolean(saved && hasEditorContent(saved));
        const nextHtml = savedHasContent ? saved! : await extractPdfResumeAsHtml(resumeUrl);
        if (cancelled || loadSeqRef.current !== seq) return;
        setHtml(nextHtml);
        hydratedRef.current = true;
        onReady?.();
      } catch (error: unknown) {
        if (!cancelled && loadSeqRef.current === seq) {
          onError?.(error instanceof Error ? error.message : 'Failed to load CV text');
        }
      } finally {
        if (!cancelled && loadSeqRef.current === seq) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, resumeUrl, initialHtml, onReady, onError]);

  useEffect(() => {
    if (!enabled) {
      hydratedRef.current = false;
      setHtml('');
    }
  }, [enabled]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || loading || !html) return;
    if (!hasEditorContent(el.innerHTML) && hasEditorContent(html)) {
      el.innerHTML = html;
    }
  }, [html, loading]);

  const handleInput = () => {
    onHtmlChange?.(editorRef.current?.innerHTML ?? '');
  };

  return (
    <div
      className={`saasa-direct-text-editor-wrap relative overflow-y-auto bg-white/95 p-6 sm:p-8 ${className}`}
      style={{ minHeight }}
    >
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 text-sm text-slate-600">
          Loading CV text…
        </div>
      ) : null}
      <div
        ref={editorRef}
        className="saasa-direct-text-editor relative z-20 mx-auto w-full max-w-[52rem] min-h-[200px] outline-none"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={handleInput}
        aria-label="Edit CV text"
      />
    </div>
  );
}
