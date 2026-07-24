'use client';

import React, { useMemo } from 'react';
import { ResumeFilePreview } from './ResumeFilePreview';
import {
  buildResumeViewerUrl,
  getResumeExtension,
  normalizeResumeHref,
  resolveResumePreviewKind,
} from '../../lib/resumePreview';

interface SaasaCvSavedPreviewProps {
  fileUrl: string;
  /** Bust browser cache after re-save */
  cacheKey?: string | null;
  candidateName?: string;
  enabled?: boolean;
  className?: string;
  minHeightClass?: string;
  /** Prefer native browser PDF embed (most reliable for saved HRYantra CV files). */
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
  const previewKind = resolveResumePreviewKind(href);
  const viewerUrl = href ? buildResumeViewerUrl(href) : '';
  const shellClass =
    `flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-100 ${minHeightClass} ${className}`.trim();

  if (!enabled || !href) return null;

  const useNativePdfEmbed =
    preferNativePdfEmbed &&
    ext === 'pdf' &&
    previewKind === 'pdf' &&
    Boolean(viewerUrl);

  if (useNativePdfEmbed) {
    return (
      <div className={shellClass} aria-label={`${candidateName} HRYantra CV`}>
        <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
          <iframe
            key={viewerUrl}
            src={viewerUrl}
            title={`${candidateName} HRYantra CV`}
            className="mx-auto block h-[min(78dvh,900px)] w-full max-w-[52rem] rounded-lg border border-slate-200 bg-white shadow-sm"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass} aria-label={`${candidateName} HRYantra CV`}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-6">
        <div className="mx-auto w-full max-w-[52rem]">
          <ResumeFilePreview resumeUrl={href} candidateName={candidateName} />
        </div>
      </div>
    </div>
  );
}
