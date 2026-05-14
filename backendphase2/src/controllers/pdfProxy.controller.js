import { getS3ObjectBodyBuffer, isOurS3PdfUrl, parseOurS3Url } from '../utils/s3.js';

const PDF_MAGIC = Buffer.from('%PDF', 'ascii');

function isAllowedCloudinaryPdfUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== 'res.cloudinary.com') return false;
    if (!/^\/[^/]+\/(raw|image)\/upload\//.test(u.pathname)) return false;
    if (!/\.pdf($|[?#])/i.test(u.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

function isAllowedPdfUrl(urlString) {
  return isOurS3PdfUrl(urlString) || isAllowedCloudinaryPdfUrl(urlString);
}

/**
 * Same-origin PDF proxy: S3 URLs (this bucket) or legacy public Cloudinary PDF URLs.
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

  if (!isAllowedPdfUrl(decoded)) {
    return res.status(403).send('Forbidden');
  }

  let buf;

  if (isOurS3PdfUrl(decoded)) {
    const parsed = parseOurS3Url(decoded);
    if (!parsed) {
      return res.status(400).send('Invalid S3 URL');
    }
    try {
      const upstream = await fetch(decoded, {
        redirect: 'follow',
        headers: { Accept: 'application/pdf,*/*' },
      });
      if (upstream.ok) {
        buf = Buffer.from(await upstream.arrayBuffer());
      } else {
        buf = await getS3ObjectBodyBuffer(parsed.key);
      }
    } catch {
      try {
        buf = await getS3ObjectBodyBuffer(parsed.key);
      } catch (e2) {
        return res.status(502).send(`S3 fetch failed: ${e2?.message || e2}`);
      }
    }
  } else {
    const upstream = await fetch(decoded, {
      redirect: 'follow',
      headers: { Accept: 'application/pdf,*/*' },
    });
    if (!upstream.ok) {
      return res.status(502).send(`Upstream error: ${upstream.status}`);
    }
    buf = Buffer.from(await upstream.arrayBuffer());
  }

  if (buf.length < 4 || !buf.subarray(0, 4).equals(PDF_MAGIC)) {
    return res.status(502).send('Not a valid PDF');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.status(200).send(buf);
}
