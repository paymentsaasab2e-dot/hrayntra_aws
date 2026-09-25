'use client';

import React, { useEffect, useState } from 'react';
import { buildResumeWordPdfUrl } from '../../lib/resumePreview';
import { ResumeWordFileViewer } from './ResumeWordFileViewer';

interface ResumeDocxPreviewProps {
  resumeUrl: string;
  candidateName?: string;
  enabled?: boolean;
  className?: string;
  minHeightClass?: string;
}

function isPdfBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

export function ResumeDocxPreview({
  resumeUrl,
  candidateName = 'Candidate',
  enabled = true,
  className = '',
  minHeightClass = 'min-h-[420px]',
}: ResumeDocxPreviewProps) {
  const [pdfSrc, setPdfSrc] = useState('');
  const shellClass =
    `resume-docx-viewer relative flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-white ${minHeightClass} ${className}`.trim();

  useEffect(() => {
    if (!enabled || !resumeUrl) return;
    let cancelled = false;
    let objectUrl = '';
    setPdfSrc('');

    const load = async () => {
      try {
        const response = await fetch(buildResumeWordPdfUrl(resumeUrl), { cache: 'no-store' });
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!response.ok || !isPdfBytes(bytes)) {
          throw new Error('Word preview did not return a PDF');
        }
        const blob = new Blob([new Uint8Array(bytes) as BlobPart], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPdfSrc(objectUrl);
      } catch {
        /* Keep the document preview that does not depend on Microsoft Word. */
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, resumeUrl]);

  if (!enabled) return null;

  return (
    <div className={shellClass} aria-label={`${candidateName} resume`}>
      {pdfSrc ? (
        <iframe
          title={`${candidateName} Word resume`}
          src={pdfSrc}
          className="min-h-[70vh] w-full flex-1 border-0 bg-white"
        />
      ) : (
        <ResumeWordFileViewer
          resumeUrl={resumeUrl}
          candidateName={candidateName}
          enabled
          preferBuiltIn
          minHeight="70vh"
          className="h-full min-h-[70vh]"
        />
      )}
    </div>
  );
}
