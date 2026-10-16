function escapeHtml(value: string): string {
  return String(value || '').replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch,
  );
}

/** Office Online must fetch the DOCX from the public internet — localhost will fail. */
export function isOfficeOnlineReachableDocUrl(url: string): boolean {
  try {
    const parsed = new URL(String(url || '').trim());
    const host = parsed.hostname.toLowerCase();
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (host.endsWith('.local') || host.endsWith('.localhost')) return false;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    // Prefer HTTPS for Office Online; still allow http only for non-local hosts.
    return true;
  } catch {
    return false;
  }
}

export type OfficeOnlineWatermarkOverlay = {
  enabled?: boolean;
  text?: string;
  /** Logo as data URL or absolute https URL (public client-review). */
  imageDataUrl?: string;
  imageUrl?: string;
  opacity?: number;
  color?: string;
};

/**
 * Full-page Microsoft Office Online embed — closest to Word layout on Linux
 * (LibreOffice reflows multi-column resumes). Optional CSS watermark overlay
 * (text and/or logo) painted above the Office iframe.
 *
 * On localhost / private hosts Office Online cannot fetch the DOCX, so we embed
 * the PDF fallback preview instead.
 */
export function buildOfficeOnlineResumeShellHtml(options: {
  docxPublicUrl: string;
  title: string;
  watermark?: OfficeOnlineWatermarkOverlay | null;
  fallbackPreviewUrl?: string;
}): string {
  const safeTitle = escapeHtml(options.title || 'Resume');
  const fallbackRaw = String(options.fallbackPreviewUrl || '').trim();
  const officeReachable = isOfficeOnlineReachableDocUrl(options.docxPublicUrl);
  const usePdfEmbed = !officeReachable && Boolean(fallbackRaw);
  const embedSrc = usePdfEmbed
    ? fallbackRaw
    : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
        options.docxPublicUrl,
      )}`;
  const wm = options.watermark && options.watermark.enabled !== false ? options.watermark : null;
  const wmTextRaw = String(wm?.text || '').trim();
  const wmLogoRaw = String(wm?.imageDataUrl || wm?.imageUrl || '').trim();
  // Fixed CSS overlay for both Office Online and local PDF embed (preview PDFs are not stamped).
  const hasWm = Boolean(wm && (wmTextRaw || wmLogoRaw));
  const wmText = escapeHtml(wmTextRaw);
  const wmLogo = escapeHtml(wmLogoRaw);
  const wmOpacity = Math.min(0.4, Math.max(0.08, Number(wm?.opacity) || 0.18));
  const wmColor = escapeHtml(String(wm?.color || '#94a3b8'));
  const fallback = !usePdfEmbed && fallbackRaw ? escapeHtml(fallbackRaw) : '';

  const wmInner = hasWm
    ? `<div class="wm-inner">
        ${wmLogo ? `<img class="wm-logo" src="${wmLogo}" alt="" />` : ''}
        ${wmText ? `<span class="wm-text">${wmText}</span>` : ''}
      </div>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #f1f5f9;
      }
      .frame-wrap {
        position: relative;
        width: 100%;
        height: 100%;
      }
      iframe {
        border: 0;
        width: 100%;
        height: 100%;
        background: #fff;
      }
      .wm {
        pointer-events: none;
        position: absolute;
        inset: 0;
        z-index: 20;
        overflow: hidden;
      }
      .wm-inner {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) rotate(-32deg);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        opacity: ${wmOpacity};
        user-select: none;
      }
      .wm-logo {
        max-width: min(60vw, 280px);
        max-height: 112px;
        object-fit: contain;
      }
      .wm-text {
        white-space: nowrap;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        font-size: clamp(2rem, 10vw, 5.5rem);
        font-weight: 800;
        letter-spacing: 0.08em;
        color: ${wmColor};
      }
      .fallback {
        position: absolute;
        right: 12px;
        bottom: 12px;
        z-index: 30;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        font-size: 12px;
      }
      .fallback a {
        color: #0f766e;
        background: rgba(255,255,255,0.92);
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 6px 10px;
        text-decoration: none;
        font-weight: 600;
      }
      .local-note {
        position: absolute;
        left: 12px;
        bottom: 12px;
        z-index: 30;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        font-size: 11px;
        color: #475569;
        background: rgba(255,255,255,0.92);
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 6px 10px;
      }
    </style>
  </head>
  <body>
    <div class="frame-wrap">
      <iframe
        title="${safeTitle}"
        src="${escapeHtml(embedSrc)}"
        allowfullscreen
      ></iframe>
      ${hasWm ? `<div class="wm" aria-hidden="true">${wmInner}</div>` : ''}
      ${
        usePdfEmbed
          ? `<div class="local-note">Local preview (PDF) — Office Online cannot open localhost files</div>`
          : ''
      }
      ${
        fallback
          ? `<div class="fallback"><a href="${fallback}">Open PDF preview</a></div>`
          : ''
      }
    </div>
  </body>
</html>`;
}
