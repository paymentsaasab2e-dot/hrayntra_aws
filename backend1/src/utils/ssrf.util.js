/**
 * SSRF guards for server-side URL fetches.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.com',
]);

function ipv4ToInt(ip) {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isPrivateOrLocalIpv4(ip) {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  // Use unsigned comparisons (>>> 0) to avoid JS signed 32-bit bitmask bugs
  if ((n >>> 24) === 10) return true; // 10.0.0.0/8
  if ((n >>> 24) === 127) return true; // 127.0.0.0/8
  if ((n >>> 24) === 0) return true; // 0.0.0.0/8
  if ((n >>> 20) === 0xac1) return true; // 172.16.0.0/12
  if ((n >>> 16) === 0xc0a8) return true; // 192.168.0.0/16
  if ((n >>> 16) === 0xa9fe) return true; // 169.254.0.0/16
  return false;
}

function isBlockedHostname(hostname) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host === '::1' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '169.254.169.254') return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateOrLocalIpv4(host)) return true;
  // IPv6 localhost / ULA / link-local (coarse)
  if (host.includes(':')) {
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if URL is safe to fetch (https only, non-private host).
 * Does not replace product allowlists (S3/Cloudinary) — use together.
 */
function assertSafeOutboundUrl(urlString, { allowHttp = false } = {}) {
  let u;
  try {
    u = new URL(String(urlString || '').trim());
  } catch {
    throw new Error('Invalid URL');
  }
  const proto = u.protocol.toLowerCase();
  if (proto !== 'https:' && !(allowHttp && proto === 'http:')) {
    throw new Error('Only HTTPS URLs are allowed');
  }
  if (isBlockedHostname(u.hostname)) {
    throw new Error('URL host is not allowed');
  }
  return u.toString();
}

module.exports = {
  isBlockedHostname,
  isPrivateOrLocalIpv4,
  assertSafeOutboundUrl,
};
