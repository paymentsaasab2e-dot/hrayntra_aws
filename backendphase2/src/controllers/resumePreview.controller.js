import { getS3ObjectBodyBuffer, parseOurS3Url } from '../utils/s3.js';

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

function wrapPreviewHtml(title, bodyHtml) {
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #ffffff; color: #111827; width: 100%; }
      body {
        font-family: "Times New Roman", Times, Georgia, serif;
        font-size: 11pt;
        line-height: 1.45;
        -webkit-font-smoothing: antialiased;
      }
      .doc-sheet {
        width: 100%;
        max-width: 100%;
        margin: 0;
        min-height: 100%;
        background: #ffffff;
        padding: 0.75in 0.65in;
        box-shadow: none;
      }
      .doc-sheet p { margin: 0 0 8pt; }
      .doc-sheet h1, .doc-sheet h2, .doc-sheet h3, .doc-sheet h4 {
        margin: 14pt 0 6pt;
        font-weight: 700;
        line-height: 1.25;
      }
      .doc-sheet h1 { font-size: 16pt; }
      .doc-sheet h2 { font-size: 14pt; }
      .doc-sheet h3 { font-size: 12pt; }
      .doc-sheet strong, .doc-sheet b { font-weight: 700; }
      .doc-sheet em, .doc-sheet i { font-style: italic; }
      .doc-sheet u { text-decoration: underline; }
      .doc-sheet a { color: #0563c1; text-decoration: underline; }
      .doc-sheet ul, .doc-sheet ol { margin: 0 0 8pt 24pt; padding: 0; }
      .doc-sheet li { margin: 0 0 4pt; }
      .doc-sheet img { max-width: 100%; height: auto; display: block; margin: 8pt 0; }
      .doc-sheet table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 10.5pt; }
      .doc-sheet td, .doc-sheet th { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
      .doc-sheet hr { border: none; border-top: 1px solid #cbd5e1; margin: 12pt 0; }
      .empty { color: #64748b; font-size: 11pt; }
    </style>
  </head>
  <body>
    <div class="doc-sheet">${bodyHtml}</div>
  </body>
</html>`;
}

async function convertDocxBufferToHtml(buffer) {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default || mammothModule;
  const convertImage =
    mammoth.images?.imgElement &&
    mammoth.images.imgElement((image) =>
      image.read('base64').then((imageBuffer) => ({
        src: `data:${image.contentType};base64,${imageBuffer}`,
      }))
    );
  const options = convertImage ? { convertImage } : {};
  const result = await mammoth.convertToHtml({ buffer }, options);
  return (result?.value || '').trim();
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

function isExtensionlessResumeStorageKey(key) {
  const lower = String(key || '').toLowerCase();
  return (
    lower.includes('apply-resumes') ||
    lower.includes('/resumes/') ||
    lower.includes('jobportal/apply-resumes')
  );
}

function isOurS3DocUrl(urlString, formatHint = '') {
  const parsed = parseOurS3Url(urlString);
  if (!parsed) return false;
  if (WORD_EXT.test(parsed.key)) return true;
  const hint = String(formatHint || '').toLowerCase();
  if (hint === 'docx' || hint === 'doc') return true;
  return isExtensionlessResumeStorageKey(parsed.key) && (hint === 'docx' || hint === 'doc');
}

function isAllowedDocUrl(urlString, formatHint = '') {
  return isOurS3DocUrl(urlString, formatHint) || isAllowedCloudinaryDocUrl(urlString, formatHint);
}

async function fetchDocumentBuffer(decoded) {
  const parsed = parseOurS3Url(decoded);
  if (parsed) {
    try {
      const upstream = await fetch(decoded, {
        redirect: 'follow',
        headers: { Accept: '*/*' },
      });
      if (upstream.ok) {
        return Buffer.from(await upstream.arrayBuffer());
      }
    } catch {
      // fall through to signed S3 fetch
    }
    return getS3ObjectBodyBuffer(parsed.key);
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
 * GET /api/v1/resume-preview/bytes?url=...&format=docx
 * Raw DOCX bytes for client-side docx-preview rendering.
 */
export async function getResumeDocxBytes(req, res) {
  const parsed = parseResumePreviewQuery(req);
  if (parsed.error) {
    return res.status(parsed.error.status).send(parsed.error.message);
  }

  const { decoded, ext } = parsed;

  if (ext === 'doc') {
    return res.status(400).send('Legacy .doc files cannot be previewed inline');
  }

  try {
    const buffer = await fetchDocumentBuffer(decoded);
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
 * GET /api/v1/resume-preview?url=...&format=docx
 * Inline HTML preview for DOCX resumes (S3 or legacy Cloudinary).
 */
export async function getResumePreview(req, res) {
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

  try {
    const buffer = await fetchDocumentBuffer(decoded);
    const body = await convertDocxBufferToHtml(buffer);
    const previewBody = body
      ? body
      : '<p class="empty">No content could be extracted from this document.</p>';
    const html = wrapPreviewHtml(inferTitleFromUrl(decoded), previewBody);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (error) {
    const message = error?.message || 'Preview generation failed';
    const html = wrapPreviewHtml(inferTitleFromUrl(decoded), `<p class="empty">${escapeHtml(message)}</p>`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  }
}
