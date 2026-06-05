const path = require('path');
const { parseOurS3Url, uploadContentTypeForFile } = require('../lib/s3');
const { fetchS3DocumentBuffer } = require('../lib/s3DocumentFetch');

const ALLOWED_EXT = /\.(pdf|png|jpe?g|webp|docx?|txt)($|[?#])/i;

function isAllowedCloudinaryDocUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== 'res.cloudinary.com') return false;
    if (!/^\/[^/]+\/(raw|image)\/upload\//.test(u.pathname)) return false;
    return ALLOWED_EXT.test(u.pathname);
  } catch {
    return false;
  }
}

function isOurS3DocUrl(urlString) {
  const parsed = parseOurS3Url(urlString);
  if (!parsed) return false;
  return String(parsed.key || '').startsWith('uploads/');
}

function isAllowedDocUrl(urlString) {
  return isOurS3DocUrl(urlString) || isAllowedCloudinaryDocUrl(urlString);
}

function sanitizeFilename(name) {
  const cleaned = String(name || 'document')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 200);
  return cleaned || 'document';
}

function guessContentType(filename, buf) {
  const fromName = uploadContentTypeForFile(undefined, filename);
  if (fromName !== 'application/octet-stream') return fromName;
  if (buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'application/pdf';
  }
  return 'application/octet-stream';
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

/**
 * GET /api/document-download?url=...&filename=...
 * Streams profile documents as attachment (S3 or legacy Cloudinary).
 */
async function getDocumentDownload(req, res) {
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

  if (!isAllowedDocUrl(decoded)) {
    return res.status(403).send('Forbidden');
  }

  const filename = sanitizeFilename(req.query.filename);

  try {
    const buf = await fetchDocumentBuffer(decoded);
    const contentType = guessContentType(filename || path.basename(new URL(decoded).pathname), buf);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(buf);
  } catch (error) {
    return res.status(502).send(error?.message || 'Failed to download document');
  }
}

module.exports = {
  getDocumentDownload,
};
