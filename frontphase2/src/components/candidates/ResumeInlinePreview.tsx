'use client';

import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import {
  buildResumeHtmlPreviewUrl,
  buildResumeViewerUrl,
  canPreviewResumeAsHtml,
  canPreviewResumeInline,
  getResumeExtension,
  normalizeResumeHref,
} from '../../lib/resumePreview';

interface ResumeInlinePreviewProps {
  resumeUrl: string | null | undefined;
  candidateName?: string;
  /** When false, skips DOCX fetch (e.g. hidden tab). Defaults to true. */
  enabled?: boolean;
  className?: string;
  minHeightClass?: string;
}

export function ResumeInlinePreview({
  resumeUrl,
  candidateName = 'Candidate',
  enabled = true,
  className = '',
  minHeightClass = 'min-h-[420px]',
}: ResumeInlinePreviewProps) {
  const href = resumeUrl ? normalizeResumeHref(resumeUrl) : '';
  const canPdf = Boolean(href && canPreviewResumeInline(href));
  const canHtml = Boolean(href && canPreviewResumeAsHtml(href));
  const extension = getResumeExtension(href);

  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [htmlError, setHtmlError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !href || !canHtml) {
      setHtmlPreview(null);
      setHtmlLoading(false);
      setHtmlError(null);
      return;
    }

    let cancelled = false;
    setHtmlLoading(true);
    setHtmlError(null);
    setHtmlPreview(null);

    const loadPreview = async () => {
      try {
        const response = await fetch(buildResumeHtmlPreviewUrl(href), { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load preview (${response.status})`);
        }
        const html = await response.text();
        if (!cancelled) setHtmlPreview(html);
      } catch (error: unknown) {
        if (!cancelled) {
          setHtmlError(error instanceof Error ? error.message : 'Preview unavailable');
          setHtmlPreview(null);
        }
      } finally {
        if (!cancelled) setHtmlLoading(false);
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [enabled, href, canHtml]);

  if (!href) return null;

  const frameClass = `w-full rounded-xl border border-slate-200 bg-white ${minHeightClass} ${className}`.trim();

  if (canPdf) {
    return (
      <iframe
        title={`${candidateName} resume`}
        src={buildResumeViewerUrl(href)}
        className={frameClass}
      />
    );
  }

  if (canHtml) {
    if (htmlLoading) {
      return (
        <div className={`flex items-center justify-center ${frameClass}`}>
          <div className="text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <p className="text-sm text-slate-600">Loading document preview...</p>
          </div>
        </div>
      );
    }

    if (htmlError) {
      return (
        <div className={`flex items-center justify-center ${frameClass}`}>
          <div className="w-full max-w-md p-6 text-center">
            <h4 className="text-base font-semibold text-slate-900">Preview unavailable</h4>
            <p className="mt-2 text-sm text-slate-500">{htmlError}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Open Resume
              </a>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download size={16} />
                Download
              </a>
            </div>
          </div>
        </div>
      );
    }

    if (htmlPreview) {
      return (
        <iframe
          title={`${candidateName} resume`}
          srcDoc={htmlPreview}
          sandbox="allow-same-origin"
          className={frameClass}
        />
      );
    }

    return (
      <div className={`flex items-center justify-center ${frameClass}`}>
        <p className="text-sm text-slate-500">No preview data available.</p>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${frameClass}`}>
      <div className="w-full max-w-xl p-6 text-center">
        <h4 className="text-base font-semibold text-slate-900">Resume file ready</h4>
        <p className="mt-2 text-sm text-slate-500">
          This resume is stored as a{' '}
          <span className="font-medium">{extension.toUpperCase() || 'document'}</span> file. Open or download it to
          view the CV.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Open Resume
          </a>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            download
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={16} />
            Download Resume
          </a>
        </div>
      </div>
    </div>
  );
}
