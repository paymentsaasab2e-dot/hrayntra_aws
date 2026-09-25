'use client';

import React from 'react';
import { canEmbedOfficeOnlineForResume } from '../../lib/resumePreview';
import { ResumeWordFileViewer } from './ResumeWordFileViewer';

interface ResumeDocxPreviewProps {
  resumeUrl: string;
  candidateName?: string;
  enabled?: boolean;
  className?: string;
  minHeightClass?: string;
}

/**
 * Original CV for a Word file. Production opens the file in Microsoft’s viewer
 * so columns and the header stay as they are in the document. The built-in
 * preview stretches that same page, so it is only used when Office cannot
 * fetch the file.
 */
export function ResumeDocxPreview({
  resumeUrl,
  candidateName = 'Candidate',
  enabled = true,
  className = '',
  minHeightClass = 'min-h-[420px]',
}: ResumeDocxPreviewProps) {
  const shellClass =
    `resume-docx-viewer relative flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-white ${minHeightClass} ${className}`.trim();
  const useOfficeViewer = canEmbedOfficeOnlineForResume(resumeUrl);

  if (!enabled) return null;

  return (
    <div className={shellClass} aria-label={`${candidateName} resume`}>
      <ResumeWordFileViewer
        resumeUrl={resumeUrl}
        candidateName={candidateName}
        enabled
        preferBuiltIn={!useOfficeViewer}
        allowBuiltInFallback={!useOfficeViewer}
        minHeight="70vh"
        className="h-full min-h-[70vh]"
      />
    </div>
  );
}
