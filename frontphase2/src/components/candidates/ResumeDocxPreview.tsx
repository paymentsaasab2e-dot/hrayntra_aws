'use client';

import React from 'react';
import { ResumeWordFileViewer } from './ResumeWordFileViewer';

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

  return (
    <div className={shellClass} aria-label={`${candidateName} resume`}>
      <ResumeWordFileViewer
        resumeUrl={resumeUrl}
        candidateName={candidateName}
        enabled={enabled}
        className="min-h-0 flex-1 bg-slate-200"
        minHeight="min(720px, calc(100vh - 14rem))"
      />
    </div>
  );
}
