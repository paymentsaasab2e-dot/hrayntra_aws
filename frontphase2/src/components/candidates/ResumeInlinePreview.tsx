'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { ResumeDocxPreview } from './ResumeDocxPreview';
import { ResumeFilePreview } from './ResumeFilePreview';
import { normalizeResumeHref, resolveResumePreviewKind } from '../../lib/resumePreview';

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
  const previewKind = href ? resolveResumePreviewKind(href) : 'none';

  if (!href) return null;

  const shellClass =
    `flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-100 ${minHeightClass} ${className}`.trim();

  if (previewKind === 'pdf' || previewKind === 'image' || previewKind === 'text') {
    return (
      <div className={shellClass}>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[52rem]">
            <ResumeFilePreview resumeUrl={href} candidateName={candidateName} />
          </div>
        </div>
      </div>
    );
  }

  if (previewKind === 'html') {
    return (
      <ResumeDocxPreview
        resumeUrl={href}
        candidateName={candidateName}
        enabled={enabled}
        className={className}
        minHeightClass={minHeightClass}
      />
    );
  }

  return (
    <div className={shellClass}>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h4 className="text-base font-semibold text-slate-900">Resume file ready</h4>
          <p className="mt-2 text-sm text-slate-500">Open or download the file to view this CV.</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Open resume
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
    </div>
  );
}
