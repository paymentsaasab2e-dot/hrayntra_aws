'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ResumeWordFileViewer } from '../../../../components/candidates/ResumeWordFileViewer';
import { normalizeExportWatermark, type ExportWatermarkSettings } from '../../../../lib/exportWatermark';
import { isWordResume, normalizeResumeHref } from '../../../../lib/resumePreview';

const LOCAL_API_BASE = 'http://127.0.0.1:5001/api/v1';
const PROD_PROXY_BASE = '/api/proxy';

function resolvePublicReviewApiBase() {
  if (typeof window === 'undefined') return PROD_PROXY_BASE;
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  return isLocal ? LOCAL_API_BASE : PROD_PROXY_BASE;
}

/**
 * Public client-review resume page — same rendering as the candidate Resume tab
 * (`ResumeWordFileViewer`), with the tenant export watermark on screen and download.
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

  const apiBase = useMemo(() => resolvePublicReviewApiBase(), []);
  const [watermark, setWatermark] = useState<ExportWatermarkSettings | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `${apiBase}/interviews/public/review/${encodeURIComponent(token)}`,
          { cache: 'no-store' },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          data?: { exportWatermark?: unknown };
          exportWatermark?: unknown;
        };
        const raw = payload?.data?.exportWatermark ?? payload?.exportWatermark;
        if (cancelled || !raw) return;
        const normalized = normalizeExportWatermark(raw);
        setWatermark(normalized.enabled ? normalized : null);
      } catch {
        /* watermark optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, token]);

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

  /** Watermarked PDF for download (DOCX is converted + stamped server-side). */
  const downloadUrl = useMemo(() => {
    if (!fileUrl) return '';
    try {
      const url = new URL(fileUrl, 'https://local.invalid');
      if (isWord) url.searchParams.set('as', 'pdf');
      url.searchParams.set('download', '1');
      return `${url.pathname}${url.search}`;
    } catch {
      const sep = fileUrl.includes('?') ? '&' : '?';
      return `${fileUrl}${sep}${isWord ? 'as=pdf&' : ''}download=1`;
    }
  }, [fileUrl, isWord]);

  const wmLogo = String(watermark?.imageDataUrl || watermark?.imageUrl || '').trim();
  const wmText = String(watermark?.text || '').trim();
  // Word preview is raw DOCX (no server stamp) — overlay on screen.
  // PDF files are already stamped by /resume/file, so skip the CSS overlay there.
  const showWatermark =
    isWord && Boolean(watermark?.enabled) && (Boolean(wmText) || Boolean(wmLogo));
  const wmOpacity = Math.min(0.4, Math.max(0.08, Number(watermark?.opacity) || 0.18));

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
            Download
          </a>
        ) : null}
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
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

        {showWatermark ? (
          <div
            className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
            aria-hidden="true"
          >
            <div
              className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 -rotate-[32deg] flex-col items-center gap-3"
              style={{ opacity: wmOpacity }}
            >
              {wmLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={wmLogo}
                  alt=""
                  className="max-h-28 max-w-[min(60vw,280px)] object-contain"
                />
              ) : null}
              {wmText ? (
                <span className="whitespace-nowrap text-[clamp(2rem,10vw,5.5rem)] font-extrabold tracking-[0.08em] text-slate-400">
                  {wmText}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
