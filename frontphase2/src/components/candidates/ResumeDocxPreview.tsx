'use client';

import React from 'react';
import { buildResumeWordPdfUrl } from '../../lib/resumePreview';

interface ResumeDocxPreviewProps {
  resumeUrl: string;
  candidateName?: string;
  enabled?: boolean;
  className?: string;
  minHeightClass?: string;
}

export function ResumeDocxPreview({
  resumeUrl,
  candidateName = 'Candidate',
  enabled = true,
  className = '',
  minHeightClass = 'min-h-[420px]',
}: ResumeDocxPreviewProps) {
  const shellClass =
    `resume-docx-viewer relative flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-100 ${minHeightClass} ${className}`.trim();

  if (!enabled) return null;

  return (
    <div className={shellClass} aria-label={`${candidateName} resume`}>
      <iframe
        title={`${candidateName} Word resume`}
        src={buildResumeWordPdfUrl(resumeUrl)}
        className="min-h-[70vh] w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
