'use client';

import React, { useMemo } from 'react';
import { SaasaCvPdfViewer } from './SaasaCvPdfViewer';
import {
  buildResumeViewerUrl,
  getResumeExtension,
  normalizeResumeHref,
} from '../../lib/resumePreview';

interface SaasaCvSavedPreviewProps {
  fileUrl: string;
  /** Bust browser cache after re-save */
  cacheKey?: string | null;
  candidateName?: string;
  enabled?: boolean;
  className?: string;
  minHeightClass?: string;
  /** Prefer native browser PDF embed (most reliable for saved SAASA files). */
  preferNativePdfEmbed?: boolean;
}

export function SaasaCvSavedPreview({
  fileUrl,
  cacheKey = null,
  candidateName = 'Candidate',
  enabled = true,
  className = '',
  minHeightClass = 'min-h-[420px]',
  preferNativePdfEmbed = true,
}: SaasaCvSavedPreviewProps) {
  const baseHref = normalizeResumeHref(fileUrl);
  const href = useMemo(() => {
    if (!baseHref) return '';
    if (!cacheKey) return baseHref;
    return `${baseHref}${baseHref.includes('?') ? '&' : '?'}saasa=${encodeURIComponent(cacheKey)}`;
  }, [baseHref, cacheKey]);

  const ext = getResumeExtension(href);
  const viewerUrl = href ? buildResumeViewerUrl(href) : '';
  const shellClass =
    `flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-100 ${minHeightClass} ${className}`.trim();

  if (!enabled || !href) return null;

  if (ext === 'pdf') {
    if (preferNativePdfEmbed && viewerUrl) {
      return (
        <div className={shellClass} aria-label={`${candidateName} SAASA CV`}>
          <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
            <iframe
              key={viewerUrl}
              src={viewerUrl}
              title={`${candidateName} SAASA CV`}
              className="mx-auto block h-[min(78dvh,900px)] w-full max-w-[52rem] rounded-lg border border-slate-200 bg-white shadow-sm"
            />
          </div>
        </div>
      );
    }

    return (
      <div className={shellClass}>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[52rem]">
            <SaasaCvPdfViewer pdfUrl={viewerUrl || href} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass} aria-label={`${candidateName} SAASA CV`}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-6">
        <div className="mx-auto w-full max-w-[52rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={href}
            alt={`${candidateName} SAASA CV`}
            className="mx-auto block w-full rounded-lg border border-slate-200 bg-white shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}
