function escapeHtml(value: string): string {
  return String(value || '').replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch
  );
}

export function inferResumeTitleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').filter(Boolean).pop() || 'Resume';
    return decodeURIComponent(last);
  } catch {
    return 'Resume';
  }
}

/** Standalone HTML page: fetches DOCX bytes and renders with docx-preview (preserves Word layout). */
export function buildDocxPreviewShellHtml(options: {
  docxBytesUrl: string;
  title: string;
}): string {
  const safeTitle = escapeHtml(options.title);
  const bytesUrlJson = JSON.stringify(options.docxBytesUrl);

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
        color: #0f172a;
      }
      body {
        display: flex;
        flex-direction: column;
      }
      .preview-header {
        flex-shrink: 0;
        padding: 12px 16px;
        border-bottom: 1px solid #e2e8f0;
        background: #ffffff;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.35;
        word-break: break-word;
      }
      .preview-scroll {
        flex: 1;
        min-height: 0;
        overflow: auto;
        -webkit-overflow-scrolling: touch;
        padding: 12px;
      }
      .preview-body {
        margin: 0 auto;
        width: 100%;
        max-width: 52rem;
      }
      #preview-style {
        position: absolute;
        width: 0;
        height: 0;
        overflow: hidden;
        pointer-events: none;
      }
      .docx-preview-resume-wrapper {
        margin: 0 auto !important;
        background: #ffffff;
        box-shadow: 0 1px 3px rgb(15 23 42 / 0.12);
      }
      .docx-preview-resume-wrapper > section.docx-preview-resume {
        margin-bottom: 8px !important;
      }
      .preview-loading {
        position: fixed;
        inset: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f1f5f9;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        font-size: 14px;
        color: #64748b;
      }
      .preview-loading[hidden] {
        display: none !important;
      }
      .preview-error {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 40vh;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        font-size: 14px;
        color: #b45309;
        text-align: center;
        padding: 24px;
      }
      .preview-error[hidden] {
        display: none !important;
      }
    </style>
  </head>
  <body>
    <div class="preview-header">${safeTitle}</div>
    <div id="preview-loading" class="preview-loading">Loading document…</div>
    <div class="preview-scroll">
      <div id="preview-error" class="preview-error" hidden></div>
      <div id="preview-style" aria-hidden="true"></div>
      <div id="preview-body" class="preview-body"></div>
    </div>
    <script src="https://unpkg.com/jszip@3.10.1/dist/jszip.min.js"></script>
    <script src="https://unpkg.com/docx-preview@0.3.7/dist/docx-preview.min.js"></script>
    <script>
      (function () {
        var bytesUrl = ${bytesUrlJson};
        var loadingEl = document.getElementById('preview-loading');
        var errorEl = document.getElementById('preview-error');
        var bodyEl = document.getElementById('preview-body');
        var styleEl = document.getElementById('preview-style');

        function hideLoading() {
          if (loadingEl) {
            loadingEl.hidden = true;
            if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
          }
        }

        function showError(message) {
          hideLoading();
          if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent = message || 'Preview unavailable';
          }
        }

        fetch(bytesUrl, { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) {
              throw new Error('Failed to load document (' + response.status + ')');
            }
            return response.blob();
          })
          .then(function (blob) {
            if (!blob || !blob.size) {
              throw new Error('Document file is empty');
            }
            if (!window.docx || typeof window.docx.renderAsync !== 'function') {
              throw new Error('Preview library failed to load');
            }
            return window.docx.renderAsync(blob, bodyEl, styleEl, {
              className: 'docx-preview-resume',
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              ignoreLastRenderedPageBreak: true,
              experimental: true,
              useBase64URL: true,
              renderHeaders: true,
              renderFooters: true,
              renderFootnotes: true,
              renderEndnotes: true,
              renderAltChunks: true,
            });
          })
          .then(function () {
            hideLoading();
            if (!bodyEl || bodyEl.childElementCount === 0) {
              showError('No preview content was rendered');
            }
          })
          .catch(function (err) {
            showError(err && err.message ? err.message : 'Preview unavailable');
          });
      })();
    </script>
  </body>
</html>`;
}
