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

/**
 * GET /api/v1/resume-preview?url=...&format=docx
 * Inline HTML preview for DOCX resumes (S3 or legacy Cloudinary).
 */
export async function getResumePreview(req, res) {
  const raw = req.query.url;
  if (!raw || typeof raw !== 'string') {
    return res.status(400).send('Missing url');
  }

  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return res.status(400).send('Invalid url');
  }

  const formatHint = String(req.query.format || '').toLowerCase();
  if (!isAllowedDocUrl(decoded, formatHint)) {
    return res.status(403).send('Forbidden');
  }

  const ext =
    decoded.split('?')[0].split('#')[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ||
    formatHint ||
    '';

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
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.convertToHtml({ buffer });
    const body = (result?.value || '').trim();
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
