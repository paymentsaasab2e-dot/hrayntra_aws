import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

const PDF_MAGIC = Buffer.from('%PDF', 'ascii');

/**
 * Parse res.cloudinary.com/{cloud}/(raw|image)/upload/(v{n}/)?{public_id}
 */
function parseCloudinaryDeliveryUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (u.hostname !== 'res.cloudinary.com') return null;

    const pathname = u.pathname;
    const withVersion = pathname.match(/^\/([^/]+)\/(raw|image)\/upload\/(v\d+)\/(.+)$/);
    if (withVersion) {
      const version = parseInt(withVersion[3].replace(/^v/, ''), 10);
      return {
        cloudName: withVersion[1],
        resourceType: withVersion[2],
        version: Number.isFinite(version) ? version : undefined,
        publicId: decodeURIComponent(withVersion[4]),
      };
    }

    const noVersion = pathname.match(/^\/([^/]+)\/(raw|image)\/upload\/(.+)$/);
    if (noVersion) {
      return {
        cloudName: noVersion[1],
        resourceType: noVersion[2],
        publicId: decodeURIComponent(noVersion[3]),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function isAllowedPdfUrl(urlString) {
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

/**
 * Same-origin PDF proxy for the frontend: signed Cloudinary URL + stream bytes.
 * Fixes 401 on unsigned delivery and iframe cross-origin PDF viewer issues.
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

  const parsed = parseCloudinaryDeliveryUrl(decoded);
  if (!parsed) {
    return res.status(400).send('Invalid Cloudinary URL');
  }
  if (!env.CLOUDINARY_CLOUD_NAME || parsed.cloudName !== env.CLOUDINARY_CLOUD_NAME) {
    return res.status(403).send('Forbidden');
  }

  if (!env.CLOUDINARY_API_SECRET || !env.CLOUDINARY_API_KEY) {
    return res.status(503).send('Cloudinary not configured on server');
  }

  const opts = {
    resource_type: parsed.resourceType,
    secure: true,
    sign_url: true,
  };
  if (parsed.version != null) {
    opts.version = parsed.version;
  }

  let signedUrl;
  try {
    signedUrl = cloudinary.url(parsed.publicId, opts);
  } catch (e) {
    return res.status(500).send(`Sign error: ${e.message}`);
  }

  const headers = { Accept: 'application/pdf,*/*' };

  let upstream = await fetch(signedUrl, { redirect: 'follow', headers });

  if (!upstream.ok) {
    upstream = await fetch(decoded, { redirect: 'follow', headers });
  }

  if (!upstream.ok) {
    return res.status(502).send(`Upstream error: ${upstream.status}`);
  }

  const buf = Buffer.from(await upstream.arrayBuffer());

  if (buf.length < 4 || !buf.subarray(0, 4).equals(PDF_MAGIC)) {
    return res.status(502).send('Not a valid PDF');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.status(200).send(buf);
}
