import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAllowedCloudinaryPdfUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== 'res.cloudinary.com') return false;
    if (!/^\/[^/]+\/(raw|image)\/upload\//.test(u.pathname)) return false;
    if (!/\.pdf($|[?#])/i.test(u.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

function parseCloudinaryRawUploadUrl(url: string) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/([^/]+)\/(raw|image)\/upload\/(?:v(\d+)\/)?(.+)$/);
    if (!m) return null;
    return {
      cloudName: m[1],
      resourceType: m[2],
      version: m[3] ? Number(m[3]) : undefined,
      publicId: decodeURIComponent(m[4]),
    };
  } catch {
    return null;
  }
}

function buildCloudinaryDownloadApiUrl(decodedUrl: string): string | null {
  const parsed = parseCloudinaryRawUploadUrl(decodedUrl);
  if (!parsed) return null;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  if (parsed.cloudName !== cloudName) return null;

  // private_download expects public_id without extension + format
  const m = parsed.publicId.match(/^(.*)\.([a-z0-9]+)$/i);
  const publicId = m ? m[1] : parsed.publicId;
  const format = m ? m[2].toLowerCase() : 'pdf';
  const timestamp = Math.floor(Date.now() / 1000);

  const toSign = `format=${format}&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');

  const qs = new URLSearchParams({
    public_id: publicId,
    format,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });

  return `https://api.cloudinary.com/v1_1/${cloudName}/raw/download?${qs.toString()}`;
}

function normalizeSourceToSign(source: string) {
  // Match Cloudinary URL signing normalization behavior
  return encodeURIComponent(decodeURIComponent(source))
    .replace(/%3A/gi, ':')
    .replace(/%2F/g, '/');
}

function buildSignedDeliveryUrl(decodedUrl: string): string | null {
  const parsed = parseCloudinaryRawUploadUrl(decodedUrl);
  if (!parsed) return null;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiSecret) return null;
  if (parsed.cloudName !== cloudName) return null;

  const toSign = normalizeSourceToSign(parsed.publicId);
  const hash = crypto.createHash('sha1').update(toSign + apiSecret).digest('base64');
  const truncated = hash.slice(0, 8).replace(/\//g, '_').replace(/\+/g, '-');
  const signature = `s--${truncated}--`;
  const versionPart = parsed.version ? `v${parsed.version}` : null;

  const parts = [
    `https://res.cloudinary.com/${cloudName}`,
    parsed.resourceType,
    'upload',
    signature,
    versionPart,
    parsed.publicId,
  ].filter(Boolean) as string[];

  return parts.join('/').replace(/ /g, '%20');
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) {
    return new NextResponse('Missing url', { status: 400 });
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }

  if (!isAllowedCloudinaryPdfUrl(decoded)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const signed = buildSignedDeliveryUrl(decoded);
  let upstream = await fetch(signed || decoded, {
    redirect: 'follow',
    headers: { Accept: 'application/pdf,*/*' },
  });

  if (!upstream.ok && signed) {
    upstream = await fetch(decoded, {
      redirect: 'follow',
      headers: { Accept: 'application/pdf,*/*' },
    });
  }

  // If delivery URL is ACL-protected, use authenticated Cloudinary download API.
  if (!upstream.ok && upstream.status === 401) {
    const downloadApiUrl = buildCloudinaryDownloadApiUrl(decoded);
    if (downloadApiUrl) {
      upstream = await fetch(downloadApiUrl, {
        redirect: 'follow',
        headers: { Accept: 'application/pdf,*/*' },
      });
    }
  }

  if (!upstream.ok) {
    const cldError = upstream.headers.get('x-cld-error');
    const message =
      cldError && upstream.status === 401
        ? `Cloudinary denied access (${cldError}). Re-upload this file after enabling anonymous/public access.`
        : `Failed to fetch PDF (upstream ${upstream.status})`;
    return new NextResponse(message, { status: upstream.status === 401 ? 401 : 500 });
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('pdf')) {
    return new NextResponse('Not a valid PDF', { status: 400 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
    },
  });
}
