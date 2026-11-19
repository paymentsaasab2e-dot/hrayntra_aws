const crypto = require('crypto');

const SIGNED_UPLOAD_DIRS = new Set(['placements', 'interview-client-review']);
const SIGNED_UPLOAD_TTL_SEC = 7 * 24 * 60 * 60;

function signUploadSubPath(subPath) {
  const secret = String(process.env.PHASE2_PORTAL_SYNC_SECRET || '').trim();
  const clean = String(subPath || '').replace(/^\/+/, '').split('?')[0];
  if (!secret || !clean) return null;
  const exp = Math.floor(Date.now() / 1000) + SIGNED_UPLOAD_TTL_SEC;
  const sig = crypto.createHmac('sha256', secret).update(`upload:${clean}:${exp}`).digest('hex');
  return { exp, sig };
}

/**
 * Resolve backendphase2 internal API base URL for portal sync / employer provisioning.
 * In production, never call localhost — default to api2.hryantra.com when env is missing.
 *
 * Env values may accidentally be comma-joined (e.g. Docker internal + public):
 *   PHASE2_INTERNAL_API_URL=https://backendphase2:5001,https://test-api2.hryantra.com
 * Those must be split and scored — never passed whole into `new URL` / `fetch`.
 */

const PRODUCTION_PHASE2_API_ORIGIN = 'https://api2.hryantra.com';
const TESTING_PHASE2_API_ORIGIN = 'https://test-api2.hryantra.com';
const { getPhase2PortalSyncSecretOrEmpty } = require('../config/secrets');

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

function isValidAbsoluteHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Docker/k8s service hostnames have no public DNS (e.g. backendphase2). */
function isDockerInternalHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host || host.includes(':')) return true;
    if (isLoopbackHost(url)) return true;
    // Single-label host → compose service name
    if (!host.includes('.')) return true;
    if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.svc')) return true;
    return false;
  } catch {
    return true;
  }
}

function normalizePhase2ApiOrigin(raw) {
  let base = stripTrailingSlashes(raw);
  if (!base) return '';
  // Accept full API roots like https://api2.hryantra.com/api/v1
  base = base.replace(/\/api\/v1$/i, '');
  return stripTrailingSlashes(base);
}

/**
 * Split accidental multi-value env strings into individual origin candidates.
 * Supports comma / semicolon / whitespace separators.
 */
function expandOriginCandidates(raw) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((part) => normalizePhase2ApiOrigin(part))
    .filter(Boolean)
    .filter(isValidAbsoluteHttpUrl);
}

function isTestingRuntime() {
  const markers = [
    process.env.APP_ENV,
    process.env.DEPLOY_ENV,
    process.env.HRAYNTRA_ENV,
    process.env.NODE_ENV,
    process.env.PHASE2_INTERNAL_API_URL,
    process.env.PHASE2_API_URL,
    process.env.PHASE2_BASE_URL,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return (
    markers.includes('test-api2') ||
    markers.includes('testing') ||
    markers.includes('staging') ||
    process.env.APP_ENV === 'test' ||
    process.env.DEPLOY_ENV === 'test'
  );
}

function scoreOriginCandidate(url, { isProd }) {
  if (!isValidAbsoluteHttpUrl(url)) return -1000;
  if (isProd && isLoopbackHost(url)) return -1000;

  let score = 0;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'test-api2.hryantra.com') score += 50;
    else if (host === 'api2.hryantra.com') score += 40;
    else if (host.endsWith('.hryantra.com')) score += 30;
    else if (!isDockerInternalHost(url)) score += 20;
    else score += 5; // docker-internal still usable when both services share a network
    if (url.startsWith('https://') && !isDockerInternalHost(url)) score += 5;
  } catch {
    return -1000;
  }
  return score;
}

function pickBestOrigin(candidates, { isProd }) {
  const ranked = [...candidates]
    .map((url) => ({ url, score: scoreOriginCandidate(url, { isProd }) }))
    .filter((row) => row.score > -1000)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.url || '';
}

function resolvePhase2InternalApiOrigin() {
  const candidates = [
    process.env.PHASE2_INTERNAL_API_URL,
    process.env.PHASE2_API_URL,
    process.env.PHASE2_BASE_URL,
  ].flatMap(expandOriginCandidates);

  const isProd = process.env.NODE_ENV === 'production';
  const best = pickBestOrigin(candidates, { isProd });
  if (best) return best;

  if (isProd) {
    return isTestingRuntime() ? TESTING_PHASE2_API_ORIGIN : PRODUCTION_PHASE2_API_ORIGIN;
  }

  return candidates[0] || 'http://127.0.0.1:5001';
}

/**
 * Rewrite CRM offer-letter URLs stored during local dev (`localhost:5001`)
 * to the public phase2 uploads API so the job portal can open them in production.
 */
function toPublicUploadsApiUrl(origin, input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.includes('/api/v1/public/uploads/')) return raw;

  let relative = '';
  if (raw.startsWith('/uploads/')) {
    relative = raw;
  } else if (/^https?:\/\//i.test(raw)) {
    try {
      relative = new URL(raw).pathname || '';
    } catch {
      return raw;
    }
  } else {
    return raw;
  }

  if (
    !relative.startsWith('/uploads/placements/') &&
    !relative.startsWith('/uploads/interview-client-review/')
  ) {
    if (relative.startsWith('/uploads/')) {
      return `${String(origin || '').replace(/\/+$/, '')}${relative}`;
    }
    return raw;
  }

  const subPath = relative.replace(/^\/uploads\//, '').split('?')[0];
  const [subdir] = subPath.split('/');
  const url = `${String(origin || '').replace(/\/+$/, '')}/api/v1/public/uploads/${subPath}`;
  if (!SIGNED_UPLOAD_DIRS.has(subdir)) return url;
  const signed = signUploadSubPath(subPath);
  if (!signed) return '';
  return `${url}?exp=${signed.exp}&sig=${signed.sig}`;
}

function resolvePhase2UploadUrl(rawUrl, relativeUrl) {
  const origin = resolvePhase2InternalApiOrigin();
  const relative = String(relativeUrl || '').trim();
  if (relative.startsWith('/uploads/')) {
    return toPublicUploadsApiUrl(origin, relative);
  }

  const raw = String(rawUrl || '').trim();
  if (!raw) return '';

  if (isLoopbackHost(raw) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(raw)) {
    return toPublicUploadsApiUrl(origin, raw);
  }

  if (raw.startsWith('/uploads/')) {
    return toPublicUploadsApiUrl(origin, raw);
  }

  return toPublicUploadsApiUrl(origin, raw) || raw;
}

function resolvePhase2PortalSyncSecret() {
  return getPhase2PortalSyncSecretOrEmpty();
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

  if (!isValidAbsoluteHttpUrl(url)) {
    return {
      ok: false,
      status: 0,
      data: {
        message: `Invalid Phase 2 API URL after resolving PHASE2_INTERNAL_API_URL (got: ${url}). Use a single origin such as https://test-api2.hryantra.com`,
      },
      url,
      networkError: true,
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
  PRODUCTION_PHASE2_API_ORIGIN,
  TESTING_PHASE2_API_ORIGIN,
  resolvePhase2InternalApiOrigin,
  resolvePhase2UploadUrl,
  resolvePhase2PortalSyncSecret,
  buildPhase2InternalUrl,
  postPhase2Internal,
  toPublicUploadsApiUrl,
  isLoopbackHost,
  normalizePhase2ApiOrigin,
  expandOriginCandidates,
  pickBestOrigin,
};
