'use client';

import { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ResumeWordFileViewer } from '../../../../components/candidates/ResumeWordFileViewer';
import { isWordResume, normalizeResumeHref } from '../../../../lib/resumePreview';

/**
 * Public client-review resume page — same rendering as the candidate Resume tab
 * (`ResumeWordFileViewer`), not LibreOffice HTML/PDF conversion.
 */
export default function ClientReviewResumePage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = String(params?.token || '').trim();
  const matchId = String(searchParams.get('matchId') || '').trim();
  const source = String(searchParams.get('source') || '').trim();
  const format = String(searchParams.get('format') || '')
    .trim()
    .toLowerCase();

  const fileUrl = useMemo(() => {
    if (!token) return '';
    const qs = new URLSearchParams();
    if (matchId) qs.set('matchId', matchId);
    if (source) qs.set('source', source);
    if (format) qs.set('format', format);
    const query = qs.toString();
    return `/client-review/${encodeURIComponent(token)}/resume/file${query ? `?${query}` : ''}`;
  }, [token, matchId, source, format]);

  const href = normalizeResumeHref(fileUrl);
  const isWord = isWordResume(href) || format === 'docx' || format === 'doc';

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">Candidate resume</p>
          <p className="truncate text-xs text-slate-500">
            {isWord ? 'Word document preview' : 'Document preview'}
          </p>
        </div>
        {fileUrl ? (
          <a
            href={fileUrl}
            download
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Download
          </a>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {!fileUrl ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-slate-600">
            Invalid review link.
          </div>
        ) : isWord ? (
          <ResumeWordFileViewer
            resumeUrl={href}
            candidateName="Candidate"
            enabled
            preferBuiltIn={false}
            allowBuiltInFallback
            minHeight="100%"
            className="h-full min-h-0"
          />
        ) : (
          <iframe title="Candidate resume" src={href} className="h-full w-full border-0 bg-white" />
        )}
      </main>
    </div>
  );
}
