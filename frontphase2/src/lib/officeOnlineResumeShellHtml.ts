function escapeHtml(value: string): string {
  return String(value || '').replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch,
  );
}

export type OfficeOnlineWatermarkOverlay = {
  enabled?: boolean;
  text?: string;
  opacity?: number;
  color?: string;
};

/**
 * Full-page Microsoft Office Online embed — closest to Word layout on Linux
 * (LibreOffice reflows multi-column resumes). Optional CSS watermark overlay.
 */
export function buildOfficeOnlineResumeShellHtml(options: {
  docxPublicUrl: string;
  title: string;
  watermark?: OfficeOnlineWatermarkOverlay | null;
  fallbackPreviewUrl?: string;
}): string {
  const safeTitle = escapeHtml(options.title || 'Resume');
  const embedSrc = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
    options.docxPublicUrl,
  )}`;
  const wm = options.watermark && options.watermark.enabled !== false ? options.watermark : null;
  const wmText = escapeHtml(String(wm?.text || 'HRYANTRA').trim() || 'HRYANTRA');
  const wmOpacity = Math.min(0.35, Math.max(0.06, Number(wm?.opacity) || 0.14));
  const wmColor = escapeHtml(String(wm?.color || '#94a3b8'));
  const fallback = options.fallbackPreviewUrl
    ? escapeHtml(options.fallbackPreviewUrl)
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
        z-index: 2;
        overflow: hidden;
      }
      .wm span {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) rotate(-32deg);
        white-space: nowrap;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        font-size: clamp(48px, 12vw, 96px);
        font-weight: 800;
        letter-spacing: 0.08em;
        color: ${wmColor};
        opacity: ${wmOpacity};
        user-select: none;
      }
      .fallback {
        position: absolute;
        right: 12px;
        bottom: 12px;
        z-index: 3;
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
    </style>
  </head>
  <body>
    <div class="frame-wrap">
      <iframe
        title="${safeTitle}"
        src="${escapeHtml(embedSrc)}"
        allowfullscreen
      ></iframe>
      ${
        wm
          ? `<div class="wm" aria-hidden="true"><span>${wmText}</span></div>`
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
