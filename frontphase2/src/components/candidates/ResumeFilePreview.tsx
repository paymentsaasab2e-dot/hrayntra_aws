'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SaasaCvPdfViewer } from './SaasaCvPdfViewer';
import {
  buildResumeDirectUrl,
  buildResumeViewerUrl,
  detectResumeBufferKind,
  detectResumeContentType,
  isImageResume,
  isRemoteResumeStorageUrl,
  isTextResume,
  normalizeResumeHref,
  resolveResumePreviewKind,
} from '../../lib/resumePreview';

type PreviewMode = 'loading' | 'image' | 'pdf' | 'text' | 'error';

interface ResumeFilePreviewProps {
  resumeUrl: string;
  candidateName?: string;
  layout?: 'inline' | 'modal';
}

function uniqueUrls(...urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = String(raw || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function ResumeFilePreview({
  resumeUrl,
  candidateName = 'Candidate',
  layout = 'inline',
}: ResumeFilePreviewProps) {
  const href = useMemo(() => normalizeResumeHref(resumeUrl), [resumeUrl]);
  const staticKind = useMemo(() => (href ? resolveResumePreviewKind(href) : 'none'), [href]);
  const directUrl = useMemo(() => (href ? buildResumeDirectUrl(href) : ''), [href]);
  const proxyUrl = useMemo(() => (href ? buildResumeViewerUrl(href) : ''), [href]);

  const [mode, setMode] = useState<PreviewMode>('loading');
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  const handlePdfError = useCallback(
    (message: string) => {
      if (/not a valid pdf/i.test(message) && directUrl) {
        setImageUrl(directUrl);
        setMode('image');
        setError(null);
      }
    },
    [directUrl],
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const finish = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };

    const setImageFromBuffer = (buffer: ArrayBuffer, contentType: string, sourceUrl: string) => {
      const blob = new Blob([buffer], { type: contentType || 'image/jpeg' });
      objectUrl = URL.createObjectURL(blob);
      setImageUrl(objectUrl);
      setPdfUrl('');
      setMode('image');
    };

    const probe = async () => {
      if (!href) {
        setError('No resume file URL');
        setMode('error');
        return;
      }

      setMode('loading');
      setError(null);
      setTextContent('');
      setImageUrl('');
      setPdfUrl('');

      if (staticKind === 'text' || isTextResume(href)) {
        const candidates = uniqueUrls(proxyUrl, directUrl);
        for (const url of candidates) {
          try {
            const response = await fetch(url, {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
              headers: { Accept: 'text/*,*/*' },
            });
            if (!response.ok) continue;
            const buffer = await response.arrayBuffer();
            if (cancelled) return;
            setTextContent(new TextDecoder().decode(buffer));
            setMode('text');
            return;
          } catch {
            /* try next */
          }
        }
      }

      if ((staticKind === 'image' || isImageResume(href)) && !isRemoteResumeStorageUrl(href)) {
        setImageUrl(directUrl);
        setMode('image');
        return;
      }

      const candidates = uniqueUrls(proxyUrl, directUrl);
      let lastError = 'Failed to load resume preview';

      for (const url of candidates) {
        try {
          const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            headers: { Accept: 'application/pdf,image/*,text/*,*/*' },
          });

          if (!response.ok) {
            const detail = (await response.text().catch(() => '')).slice(0, 180).trim();
            lastError = detail || `Failed to load resume (${response.status})`;
            continue;
          }

          const contentType = response.headers.get('content-type') || '';
          const buffer = await response.arrayBuffer();
          if (cancelled) return;

          const detected = detectResumeContentType(contentType, buffer);
          if (detected === 'image' || detectResumeBufferKind(buffer) === 'image') {
            setImageFromBuffer(buffer, contentType, url);
            return;
          }

          if (detected === 'text') {
            setTextContent(new TextDecoder().decode(buffer));
            setMode('text');
            return;
          }

          if (detectResumeBufferKind(buffer) === 'pdf') {
            setPdfUrl(url);
            setMode('pdf');
            return;
          }

          if (detected === 'pdf') {
            lastError = 'File is not a valid PDF';
            continue;
          }

          lastError = 'Unsupported resume file type';
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Failed to load resume preview';
        }
      }

      if (cancelled) return;

      if (directUrl) {
        setImageUrl(directUrl);
        setMode('image');
        return;
      }

      setError(lastError);
      setMode('error');
    };

    void probe();

    return () => {
      cancelled = true;
      finish();
    };
  }, [href, staticKind, directUrl, proxyUrl]);

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

  if (mode === 'error') {
    return (
      <div className={`${loadingShellClass} flex-col gap-3 p-6 text-center`}>
        <p className="text-sm text-red-600">{error || 'Failed to load resume preview'}</p>
        {directUrl ? (
          <a
            href={directUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Open file in new tab
          </a>
        ) : null}
      </div>
    );
  }

  if (mode === 'image' && imageUrl) {
    return (
      <div className={imageShellClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${candidateName} resume`}
          className={imageClass}
          onError={() => {
            setError('Failed to load resume preview');
            setMode('error');
          }}
        />
      </div>
    );
  }

  if (mode === 'text') {
    const textShellClass = isModal
      ? 'min-h-[min(70vh,720px)] w-full overflow-auto rounded-xl border border-slate-200 bg-white p-4 sm:p-6'
      : 'max-h-[min(82dvh,960px)] overflow-auto rounded-xl border border-slate-200 bg-white p-4 sm:p-6';
    return (
      <div className={textShellClass}>
        <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-slate-800">
          {textContent || 'Empty file'}
        </pre>
      </div>
    );
  }

  return (
    <div className={isModal ? 'w-full' : undefined}>
      <SaasaCvPdfViewer
        pdfUrl={pdfUrl || proxyUrl}
        fallbackOpenUrl={directUrl}
        onError={handlePdfError}
      />
    </div>
  );
}
