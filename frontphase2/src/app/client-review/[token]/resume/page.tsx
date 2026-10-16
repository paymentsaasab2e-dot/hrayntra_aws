'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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

function isOfficeOnlineBlockedHost(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost')
  );
}

/** One fixed mark over the viewer — stays put while CV pages scroll. */
function FloatingResumeWatermark({
  text,
  logo,
  opacity,
}: {
  text: string;
  logo: string;
  opacity: number;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 -rotate-[32deg] flex-col items-center gap-3"
        style={{ opacity }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="max-h-28 max-w-[min(60vw,280px)] object-contain"
          />
        ) : null}
        {text ? (
          <span className="whitespace-nowrap text-[clamp(2rem,8vw,4.5rem)] font-extrabold tracking-[0.08em] text-slate-400">
            {text}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Public client-review resume page.
 * Preview: clean PDF/DOCX + fixed floating watermark (does not scroll with pages).
 * Download: watermark stamped into the PDF file.
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
  // Build iframe src only after mount to avoid SSR/client hostname hydration mismatch.
  const [previewUrl, setPreviewUrl] = useState('');

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
          success?: boolean;
          data?: { exportWatermark?: unknown };
          exportWatermark?: unknown;
        };
        const raw =
          payload?.data?.exportWatermark ??
          payload?.exportWatermark ??
          (payload?.data as { data?: { exportWatermark?: unknown } } | undefined)?.data
            ?.exportWatermark;
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

  useEffect(() => {
    if (!fileUrl) {
      setPreviewUrl('');
      return;
    }
    if (!isWord) {
      // Bust any previously cached stamped PDF from older builds.
      const sep = fileUrl.includes('?') ? '&' : '?';
      setPreviewUrl(`${fileUrl}${sep}preview=1`);
      return;
    }
    const officeBlocked = isOfficeOnlineBlockedHost(window.location.hostname);
    try {
      const url = new URL(fileUrl, window.location.origin);
      url.searchParams.set('preview', '1');
      if (officeBlocked) {
        url.searchParams.set('as', 'pdf');
      } else {
        url.searchParams.set('view', 'office');
      }
      setPreviewUrl(`${url.pathname}${url.search}`);
    } catch {
      const sep = fileUrl.includes('?') ? '&' : '?';
      setPreviewUrl(
        `${fileUrl}${sep}preview=1&${officeBlocked ? 'as=pdf' : 'view=office'}`,
      );
    }
  }, [fileUrl, isWord]);

  /** Watermarked PDF download (DOCX is converted + stamped server-side). */
  const downloadUrl = useMemo(() => {
    if (!fileUrl) return '';
    try {
      const url = new URL(fileUrl, 'https://local.invalid');
      url.searchParams.delete('view');
      url.searchParams.delete('preview');
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
  const showClientOverlay =
    Boolean(watermark?.enabled) && (Boolean(wmText) || Boolean(wmLogo));
  const wmOpacity = Math.min(0.35, Math.max(0.1, Number(watermark?.opacity) || 0.18));

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

        {/* Fixed floating watermark over the iframe — stays while CV pages scroll. */}
        {showClientOverlay ? (
          <FloatingResumeWatermark text={wmText} logo={wmLogo} opacity={wmOpacity} />
        ) : null}
      </main>
    </div>
  );
}
