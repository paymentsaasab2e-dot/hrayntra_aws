const { parseOurS3Url } = require('../lib/s3');
const { fetchS3DocumentBuffer } = require('../lib/s3DocumentFetch');

const WORD_EXT = /\.(docx|doc)($|[?#]|$)/i;

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch
  );
}

function inferTitleFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').filter(Boolean).pop() || 'Resume';
    return decodeURIComponent(last);
  } catch {
    return 'Resume';
  }
}

function htmlVisibleTextLength(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .length;
}

function plainTextToPreviewHtml(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  const escaped = escapeHtml(trimmed);
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Graphic CVs embed large background images that hide readable text in convertToHtml. */
function shouldUsePlainTextDocxPreview(htmlBody, rawText) {
  const raw = String(rawText || '').trim();
  if (!raw) return false;
  const html = String(htmlBody || '');
  if (html.includes('data:image')) return true;
  if (html.length > 100_000) return true;
  if (htmlVisibleTextLength(html) < 80) return true;
  return false;
}

function buildDocxPreviewShellHtml({ docxBytesUrl, title }) {
  const safeTitle = escapeHtml(title);
  const bytesUrlJson = JSON.stringify(docxBytesUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #f1f5f9; color: #0f172a; }
      body { display: flex; flex-direction: column; }
      .preview-header {
        flex-shrink: 0; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #ffffff;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        font-size: 13px; font-weight: 600; line-height: 1.35; word-break: break-word;
      }
      .preview-scroll { flex: 1; min-height: 0; overflow: auto; -webkit-overflow-scrolling: touch; padding: 12px; }
      .preview-body { margin: 0 auto; width: 100%; max-width: 52rem; }
      #preview-style { position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none; }
      .docx-preview-resume-wrapper { margin: 0 auto !important; background: #ffffff; box-shadow: 0 1px 3px rgb(15 23 42 / 0.12); }
      .docx-preview-resume-wrapper > section.docx-preview-resume { margin-bottom: 8px !important; }
      .preview-loading {
        position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
        background: #f1f5f9; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        font-size: 14px; color: #64748b;
      }
      .preview-loading[hidden] { display: none !important; }
      .preview-error {
        display: flex; align-items: center; justify-content: center; min-height: 40vh;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        font-size: 14px; color: #b45309; text-align: center; padding: 24px;
      }
      .preview-error[hidden] { display: none !important; }
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
          if (errorEl) { errorEl.hidden = false; errorEl.textContent = message || 'Preview unavailable'; }
        }
        fetch(bytesUrl, { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) throw new Error('Failed to load document (' + response.status + ')');
            return response.blob();
          })
          .then(function (blob) {
            if (!blob || !blob.size) throw new Error('Document file is empty');
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
            if (!bodyEl || bodyEl.childElementCount === 0) showError('No preview content was rendered');
          })
          .catch(function (err) {
            showError(err && err.message ? err.message : 'Preview unavailable');
          });
      })();
    </script>
  </body>
</html>`;
}

function wrapPreviewHtml(title, bodyHtml) {
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
      .page { max-width: 920px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); overflow: hidden; }
      .header { padding: 18px 22px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
      .header h1 { margin: 0; font-size: 16px; line-height: 1.4; word-break: break-word; }
      .content { padding: 24px 22px; font-size: 14px; line-height: 1.7; }
      .content p { margin: 0 0 12px; }
      .content h1, .content h2, .content h3 { margin: 18px 0 10px; line-height: 1.35; }
      .content ul, .content ol { margin: 0 0 12px 20px; padding: 0; }
      .content table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
      .content td, .content th { border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; }
      .empty { color: #64748b; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header"><h1>${safeTitle}</h1></div>
      <div class="content">${bodyHtml}</div>
    </div>
  </body>
</html>`;
}

function isAllowedCloudinaryDocUrl(urlString, formatHint = '') {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== 'res.cloudinary.com') return false;
    if (!/^\/[^/]+\/(raw|image)\/upload\//.test(u.pathname)) return false;
    if (WORD_EXT.test(u.pathname)) return true;
    const hint = String(formatHint || '').toLowerCase();
    return hint === 'docx' || hint === 'doc';
  } catch {
    return false;
  }
}

function isOurS3DocUrl(urlString, formatHint = '') {
  const parsed = parseOurS3Url(urlString);
  if (!parsed) return false;
  if (WORD_EXT.test(parsed.key)) return true;
  const hint = String(formatHint || '').toLowerCase();
  return hint === 'docx' || hint === 'doc';
}

function isAllowedDocUrl(urlString, formatHint = '') {
  return isOurS3DocUrl(urlString, formatHint) || isAllowedCloudinaryDocUrl(urlString, formatHint);
}

async function fetchDocumentBuffer(decoded) {
  const parsed = parseOurS3Url(decoded);
  if (parsed) {
    return fetchS3DocumentBuffer(decoded);
  }

  const upstream = await fetch(decoded, {
    redirect: 'follow',
    headers: { Accept: '*/*' },
  });
  if (!upstream.ok) {
    throw new Error(`Failed to fetch document (upstream ${upstream.status})`);
  }
  return Buffer.from(await upstream.arrayBuffer());
}

function parseResumePreviewQuery(req) {
  const raw = req.query.url;
  if (!raw || typeof raw !== 'string') {
    return { error: { status: 400, message: 'Missing url' } };
  }

  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { error: { status: 400, message: 'Invalid url' } };
  }

  const formatHint = String(req.query.format || '').toLowerCase();
  if (!isAllowedDocUrl(decoded, formatHint)) {
    return { error: { status: 403, message: 'Forbidden' } };
  }

  const ext =
    decoded.split('?')[0].split('#')[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ||
    formatHint ||
    '';

  return { decoded, formatHint, ext };
}

/**
 * GET /api/resume-preview/bytes?url=...&format=docx
 * Raw DOCX bytes for client-side docx-preview rendering.
 */
async function getResumeDocxBytes(req, res) {
  const parsed = parseResumePreviewQuery(req);
  if (parsed.error) {
    return res.status(parsed.error.status).send(parsed.error.message);
  }

  const { ext } = parsed;

  if (ext === 'doc') {
    return res.status(400).send('Legacy .doc files cannot be previewed inline');
  }

  try {
    const buffer = await fetchDocumentBuffer(parsed.decoded);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', 'inline; filename="resume.docx"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(buffer);
  } catch (error) {
    const message = error?.message || 'Failed to fetch document';
    return res.status(502).send(message);
  }
}

/**
 * GET /api/resume-preview?url=...&format=docx
 * Client-side docx-preview shell (preserves Word layout; avoids Mammoth plain-text HTML).
 */
async function getResumePreview(req, res) {
  const parsed = parseResumePreviewQuery(req);
  if (parsed.error) {
    return res.status(parsed.error.status).send(parsed.error.message);
  }

  const { decoded, ext } = parsed;

  if (ext === 'doc') {
    const html = wrapPreviewHtml(
      inferTitleFromUrl(decoded),
      '<p class="empty">Legacy .doc files cannot be previewed inline. Please download or open the file.</p>'
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  }

  const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const docxBytesUrl = `/api/resume-preview/bytes${search}`;
  const html = buildDocxPreviewShellHtml({
    docxBytesUrl,
    title: inferTitleFromUrl(decoded),
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
}

module.exports = { getResumePreview, getResumeDocxBytes };
