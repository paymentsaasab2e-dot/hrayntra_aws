/**
 * Resolve backendphase2 internal API base URL for portal sync / employer provisioning.
 * In production, never call localhost — default to api2.hryantra.com when env is missing.
 */

const DEV_FALLBACK_SECRET = 'phase2-portal-sync-2026-shared-secret';
const PRODUCTION_PHASE2_API_ORIGIN = 'https://api2.hryantra.com';

function stripTrailingSlashes(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isLoopbackHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

function normalizePhase2ApiOrigin(raw) {
  let base = stripTrailingSlashes(raw);
  if (!base) return '';
  // Accept full API roots like https://api2.hryantra.com/api/v1
  base = base.replace(/\/api\/v1$/i, '');
  return stripTrailingSlashes(base);
}

function resolvePhase2InternalApiOrigin() {
  const candidates = [
    process.env.PHASE2_INTERNAL_API_URL,
    process.env.PHASE2_API_URL,
    process.env.PHASE2_BASE_URL,
  ]
    .map(normalizePhase2ApiOrigin)
    .filter(Boolean);

  const isProd = process.env.NODE_ENV === 'production';

  for (const candidate of candidates) {
    if (isProd && isLoopbackHost(candidate)) {
      continue;
    }
    return candidate;
  }

  if (isProd) {
    return PRODUCTION_PHASE2_API_ORIGIN;
  }

  return candidates[0] || 'http://localhost:5001';
}

/**
 * Rewrite CRM offer-letter URLs stored during local dev (`localhost:5001`)
 * to the public phase2 origin so the job portal can open them in production.
 */
function resolvePhase2UploadUrl(rawUrl, relativeUrl) {
  const origin = resolvePhase2InternalApiOrigin();
  const relative = String(relativeUrl || '').trim();
  if (relative.startsWith('/uploads/')) {
    return `${origin}${relative}`;
  }

  const raw = String(rawUrl || '').trim();
  if (!raw) return '';

  if (isLoopbackHost(raw) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(raw)) {
    try {
      const normalized = raw.match(/^https?:\/\//i) ? raw : `http://${raw.replace(/^\/+/, '')}`;
      const path = new URL(normalized).pathname;
      if (path.startsWith('/uploads/')) {
        return `${origin}${path}`;
      }
    } catch {
      /* fall through */
    }
    return raw.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, origin);
  }

  if (raw.startsWith('/uploads/')) {
    return `${origin}${raw}`;
  }

  return raw;
}

function resolvePhase2PortalSyncSecret() {
  const configured = String(process.env.PHASE2_PORTAL_SYNC_SECRET || '').trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    return '';
  }
  return DEV_FALLBACK_SECRET;
}

function buildPhase2InternalUrl(path) {
  const origin = resolvePhase2InternalApiOrigin();
  const segment = String(path || '').replace(/^\/+/, '');
  return `${origin}/api/v1/internal/${segment}`;
}

async function postPhase2Internal(path, body) {
  const url = buildPhase2InternalUrl(path);
  const secret = resolvePhase2PortalSyncSecret();

  if (!secret && process.env.NODE_ENV === 'production') {
    return {
      ok: false,
      status: 503,
      data: { message: 'PHASE2_PORTAL_SYNC_SECRET is not configured on backend1' },
      url,
    };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (secret) {
    headers['x-phase2-portal-sync-secret'] = secret;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data, url };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { message: error?.message || String(error) },
      url,
      networkError: true,
    };
  }
}

module.exports = {
  DEV_FALLBACK_SECRET,
  PRODUCTION_PHASE2_API_ORIGIN,
  resolvePhase2InternalApiOrigin,
  resolvePhase2UploadUrl,
  resolvePhase2PortalSyncSecret,
  buildPhase2InternalUrl,
  postPhase2Internal,
};
