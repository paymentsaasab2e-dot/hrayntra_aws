import {
  detectResumeContentType,
  fetchS3ResumeDocumentBuffer,
} from '../utils/s3PdfFetch.js';
import { isOurS3PdfUrl } from '../utils/s3.js';

function isAllowedCloudinaryPdfUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== 'res.cloudinary.com') return false;
    if (!/^\/[^/]+\/(raw|image)\/upload\//.test(u.pathname)) return false;
    if (!/\.(pdf|png|jpe?g|gif|webp|txt)($|[?#])/i.test(u.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

function isAllowedResumeProxyUrl(urlString) {
  return isOurS3PdfUrl(urlString) || isAllowedCloudinaryPdfUrl(urlString);
}

/**
 * Same-origin resume proxy: S3 URLs (this bucket) or legacy public Cloudinary document URLs.
 */
export async function getPdfProxy(req, res) {
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

  if (!isAllowedResumeProxyUrl(decoded)) {
    return res.status(403).send('Forbidden');
  }

  let buf;
  let objectKey = '';

  if (isOurS3PdfUrl(decoded)) {
    try {
      const result = await fetchS3ResumeDocumentBuffer(decoded);
      buf = result.buffer;
      objectKey = result.key || '';
    } catch (e2) {
      return res.status(502).send(`S3 fetch failed: ${e2?.message || e2}`);
    }
  } else {
    const upstream = await fetch(decoded, {
      redirect: 'follow',
      headers: { Accept: '*/*' },
    });
    if (!upstream.ok) {
      return res.status(502).send(`Upstream error: ${upstream.status}`);
    }
    buf = Buffer.from(await upstream.arrayBuffer());
  }

  const contentType = detectResumeContentType(buf, objectKey);
  const allowed =
    contentType === 'application/pdf' ||
    contentType === 'text/plain' ||
    String(contentType || '').startsWith('image/');

  if (!allowed) {
    return res.status(502).send('Unsupported resume file type');
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.status(200).send(buf);
}
