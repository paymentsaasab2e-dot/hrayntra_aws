'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { isWordResume, normalizeResumeHref } from '../../../../lib/resumePreview';

/**
 * Public client-review resume page.
 * Word: PDF convert on localhost (Office Online cannot fetch local DOCX).
 * Watermark is stamped once per PDF page in `/resume/file` (stays on the page).
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

  // Build iframe src only after mount to avoid SSR/client hostname hydration mismatch.
  const [previewUrl, setPreviewUrl] = useState('');

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

  useEffect(() => {
    if (!fileUrl) {
      setPreviewUrl('');
      return;
    }
    if (!isWord) {
      setPreviewUrl(fileUrl);
      return;
    }
    const host = window.location.hostname.toLowerCase();
    const officeBlocked =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.localhost');
    try {
      const url = new URL(fileUrl, window.location.origin);
      // Always use stamped PDF preview so one watermark sits on each document page.
      if (officeBlocked) {
        url.searchParams.set('as', 'pdf');
      } else {
        // Public hosts: prefer Office Online for layout; PDF fallback still stamped.
        url.searchParams.set('view', 'office');
      }
      setPreviewUrl(`${url.pathname}${url.search}`);
    } catch {
      const sep = fileUrl.includes('?') ? '&' : '?';
      setPreviewUrl(`${fileUrl}${sep}${officeBlocked ? 'as=pdf' : 'view=office'}`);
    }
  }, [fileUrl, isWord]);

  const downloadUrl = useMemo(() => {
    if (!fileUrl) return '';
    try {
      const url = new URL(fileUrl, 'https://local.invalid');
      url.searchParams.delete('view');
      if (isWord) url.searchParams.set('as', 'pdf');
      url.searchParams.set('download', '1');
      return `${url.pathname}${url.search}`;
    } catch {
      const sep = fileUrl.includes('?') ? '&' : '?';
      return `${fileUrl}${sep}${isWord ? 'as=pdf&' : ''}download=1`;
    }
  }, [fileUrl, isWord]);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">Candidate resume</p>
          <p className="truncate text-xs text-slate-500">
            {isWord ? 'Word document preview' : 'Document preview'}
          </p>
        </div>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            download={isWord ? 'Resume.pdf' : undefined}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {isWord ? 'Download PDF' : 'Download'}
          </a>
        ) : null}
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        {!previewUrl ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-slate-600">
            {token ? 'Loading resume…' : 'Invalid review link.'}
          </div>
        ) : (
          <iframe
            title="Candidate resume"
            src={previewUrl}
            className="h-full w-full border-0 bg-white"
          />
        )}
      </main>
    </div>
  );
}
