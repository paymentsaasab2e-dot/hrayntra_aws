import crypto from 'crypto';

export type ParsedCloudinaryDelivery = {
  cloudName: string;
  resourceType: 'raw' | 'image';
  publicId: string;
  version?: number;
};

/** Matches Cloudinary `finalize_source` string used in URL signatures */
function normalizeSourceToSign(source: string): string {
  return encodeURIComponent(decodeURIComponent(source))
    .replace(/%3A/gi, ':')
    .replace(/%2F/g, '/');
}

/**
 * Parse https://res.cloudinary.com/{cloud}/(raw|image)/upload/(v{n}/)?{public_id}
 */
export function parseCloudinaryDeliveryUrl(url: string): ParsedCloudinaryDelivery | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'res.cloudinary.com') return null;

    const pathname = u.pathname;
    const withVersion = pathname.match(/^\/([^/]+)\/(raw|image)\/upload\/(v\d+)\/(.+)$/);
    if (withVersion) {
      const version = parseInt(withVersion[3].replace(/^v/, ''), 10);
      return {
        cloudName: withVersion[1],
        resourceType: withVersion[2] as 'raw' | 'image',
        version: Number.isFinite(version) ? version : undefined,
        publicId: decodeURIComponent(withVersion[4]),
      };
    }

    const noVersion = pathname.match(/^\/([^/]+)\/(raw|image)\/upload\/(.+)$/);
    if (noVersion) {
      return {
        cloudName: noVersion[1],
        resourceType: noVersion[2] as 'raw' | 'image',
        publicId: decodeURIComponent(noVersion[3]),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Signed delivery URL (same algorithm as cloudinary.url(..., { sign_url: true })).
 * @see cloudinary/lib/utils/index.js url() — transformation empty → to_sign = public_id only
 */
export function buildSignedCloudinaryDeliveryUrl(storedUrl: string, apiSecret: string): string | null {
  const parsed = parseCloudinaryDeliveryUrl(storedUrl);
  if (!parsed) return null;

  const { cloudName, resourceType, publicId, version } = parsed;

  const transformation = '';
  const sourceToSign = normalizeSourceToSign(publicId);
  const toSign = [transformation, sourceToSign].filter((p) => p != null && p !== '').join('/');
  if (!toSign) return null;

  const hash = crypto.createHash('sha1').update(toSign + apiSecret).digest('base64');
  const truncated = hash.slice(0, 8).replace(/\//g, '_').replace(/\+/g, '-');
  const signature = `s--${truncated}--`;

  const versionPart = version != null ? `v${version}` : null;

  const parts = [
    `https://res.cloudinary.com/${cloudName}`,
    resourceType,
    'upload',
    signature,
    versionPart,
    publicId,
  ].filter((p) => p != null && p !== '') as string[];

  return parts.join('/').replace(/ /g, '%20');
}
