'use client';

import React, { useEffect, useState } from 'react';
import { fetchResumeProxiedBlob, isTextResume } from '../../lib/resumePreview';

interface SaasaCvRasterResumePreviewProps {
  resumeUrl: string;
  candidateName?: string;
  mode: 'image' | 'text';
  onReady?: () => void;
  onError?: (message: string) => void;
  className?: string;
}

export function SaasaCvRasterResumePreview({
  resumeUrl,
  candidateName = 'Candidate',
  mode,
  onReady,
  onError,
  className = 'relative z-0 w-full',
}: SaasaCvRasterResumePreviewProps) {
  const [imageSrc, setImageSrc] = useState('');
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const fail = (message: string) => {
      if (cancelled) return;
      setLoading(false);
      onError?.(message);
    };

    const ready = () => {
      if (cancelled) return;
      setLoading(false);
      onReady?.();
    };

    setLoading(true);
    setImageSrc('');
    setTextContent('');

    void (async () => {
      try {
        const blob = await fetchResumeProxiedBlob(resumeUrl);
        if (cancelled) return;

        if (mode === 'text' || isTextResume(resumeUrl)) {
          const text = await blob.text();
          if (cancelled) return;
          setTextContent(text);
          ready();
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
        ready();
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Failed to load CV preview');
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resumeUrl, mode, onReady, onError]);

  if (loading) {
    return (
      <div className={`${className} flex min-h-[320px] items-center justify-center text-sm text-slate-600`}>
        Loading CV preview…
      </div>
    );
  }

  if (mode === 'text' || isTextResume(resumeUrl)) {
    return (
      <div className={`${className} max-h-[min(78dvh,900px)] overflow-auto p-4 sm:p-6`}>
        <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-slate-800">
          {textContent || 'Empty file'}
        </pre>
      </div>
    );
  }

  if (!imageSrc) return null;

  return (
    <div className={`${className} p-2 sm:p-4`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt={`${candidateName} CV`}
        className="mx-auto block h-auto w-full max-w-full rounded-lg object-contain"
      />
    </div>
  );
}
