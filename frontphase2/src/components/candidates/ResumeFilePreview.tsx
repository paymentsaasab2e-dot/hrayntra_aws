'use client';

import React, { useEffect, useState } from 'react';
import { SaasaCvPdfViewer } from './SaasaCvPdfViewer';
import { buildResumeViewerUrl } from '../../lib/resumePreview';

type PreviewMode = 'loading' | 'image' | 'pdf';

interface ResumeFilePreviewProps {
  resumeUrl: string;
  candidateName?: string;
  layout?: 'inline' | 'modal';
}

export function ResumeFilePreview({
  resumeUrl,
  candidateName = 'Candidate',
  layout = 'inline',
}: ResumeFilePreviewProps) {
  const viewerUrl = buildResumeViewerUrl(resumeUrl);
  const [mode, setMode] = useState<PreviewMode>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMode('loading');
    setError(null);

    const detect = async () => {
      try {
        const response = await fetch(viewerUrl, { method: 'GET', cache: 'no-store' });
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(text || `Failed to load resume (${response.status})`);
        }
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (cancelled) return;
        if (contentType.startsWith('image/')) {
          setMode('image');
          return;
        }
        setMode('pdf');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load resume preview');
        setMode('pdf');
      }
    };

    void detect();
    return () => {
      cancelled = true;
    };
  }, [viewerUrl]);

  const isModal = layout === 'modal';
  const loadingShellClass = isModal
    ? 'flex min-h-[min(70vh,720px)] w-full items-center justify-center rounded-xl border border-slate-200 bg-white'
    : 'flex min-h-[min(40dvh,480px)] items-center justify-center rounded-xl border border-slate-200 bg-white';
  const imageShellClass = isModal
    ? 'flex min-h-[min(70vh,720px)] w-full items-center justify-center rounded-xl border border-slate-200 bg-white p-4 sm:p-6'
    : 'rounded-xl border border-slate-200 bg-white p-4 sm:p-6';
  const imageClass = isModal
    ? 'mx-auto block max-h-[min(78vh,900px)] w-full max-w-full rounded-lg object-contain'
    : 'mx-auto block max-h-[min(82dvh,960px)] w-full max-w-full rounded-lg object-contain';

  if (mode === 'loading') {
    return (
      <div className={loadingShellClass}>
        <p className="text-sm text-slate-600">Loading resume preview…</p>
      </div>
    );
  }

  if (mode === 'image') {
    return (
      <div className={imageShellClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={viewerUrl} alt={`${candidateName} resume`} className={imageClass} />
      </div>
    );
  }

  return (
    <div className={isModal ? 'w-full' : undefined}>
      {error ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
          {error}
        </div>
      ) : null}
      <SaasaCvPdfViewer pdfUrl={viewerUrl} />
    </div>
  );
}
