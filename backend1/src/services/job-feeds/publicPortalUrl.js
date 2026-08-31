/**
 * Candidate-facing job URLs for XML feeds.
 * Never emit localhost, loopback, or private-network hosts.
 */

const PRODUCTION_PORTAL_ORIGIN = 'https://www.hryantra.com';

const PRIVATE_HOST_RE =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i;

function stripTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function hostnameOf(origin) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isPrivateOrLocalHost(hostname) {
  const host = String(hostname || '').replace(/\.+$/, '');
  if (!host) return true;
  if (PRIVATE_HOST_RE.test(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  return false;
}

function isUsablePublicOrigin(raw, { requireHttps = true } = {}) {
  const origin = stripTrailingSlash(raw);
  if (!origin) return false;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) return false;
  if (parsed.protocol !== 'https:' && (requireHttps || parsed.protocol !== 'http:')) return false;
  if (isPrivateOrLocalHost(parsed.hostname)) return false;
  return true;
}

function firstPublicHttpsOrigin(values) {
  for (const raw of values) {
    const origin = stripTrailingSlash(raw);
    if (!origin) continue;
    if (isUsablePublicOrigin(origin, { requireHttps: true })) return origin;
  }
  return '';
}

/**
 * Production portal origin for <url> / apply links.
 * Env order: JOB_PORTAL_FRONTEND_URL, PHASE1_FRONTEND_URL, then HTTPS hosts in FRONTEND_URLS / FRONTEND_URL.
 * Localhost and private IPs are never used.
 */
function portalFrontendBase() {
  const listed = String(process.env.FRONTEND_URLS || '')
    .split(',')
    .map((value) => value.trim());
  const explicit = firstPublicHttpsOrigin([
    process.env.JOB_PORTAL_FRONTEND_URL,
    process.env.PHASE1_FRONTEND_URL,
    process.env.FRONTEND_URL,
  ]);
  if (explicit) return explicit;

  const fromList = listed
    .map((value) => stripTrailingSlash(value))
    .filter((origin) => isUsablePublicOrigin(origin, { requireHttps: true }));
  const branded = fromList.find((origin) => {
    const host = hostnameOf(origin);
    return host === 'hryantra.com' || host.endsWith('.hryantra.com');
  });
  return branded || PRODUCTION_PORTAL_ORIGIN;
}

function publicJobDetailUrl(jobId, { portalBase = portalFrontendBase(), utmSource } = {}) {
  const id = String(jobId || '').trim();
  if (!id) return '';
  const origin = stripTrailingSlash(portalBase) || portalFrontendBase();
  const params = new URLSearchParams({ job: id });
  if (utmSource) params.set('utm_source', String(utmSource));
  return `${origin}/explore-jobs?${params.toString()}`;
}

function assertPublicJobUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return { ok: false, reason: 'missing_url' };
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'non_https_url' };
  if (isPrivateOrLocalHost(parsed.hostname)) return { ok: false, reason: 'localhost_or_private_url' };
  if (!parsed.pathname.includes('/explore-jobs')) return { ok: false, reason: 'not_job_detail_url' };
  if (!parsed.searchParams.get('job')) return { ok: false, reason: 'missing_job_id_in_url' };
  return { ok: true };
}

function xmlContainsForbiddenHosts(xml) {
  const text = String(xml || '');
  const urlBlocks = [
    ...text.matchAll(/<(url|apply_url|company_url)>([\s\S]*?)<\/\1>/gi),
  ];
  const haystack = urlBlocks
    .map((match) =>
      String(match[2] || '')
        .replace(/<!\[CDATA\[/g, '')
        .replace(/]]>/g, ''),
    )
    .join('\n');
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\./i.test(
    haystack,
  );
}

module.exports = {
  PRODUCTION_PORTAL_ORIGIN,
  portalFrontendBase,
  publicJobDetailUrl,
  assertPublicJobUrl,
  isUsablePublicOrigin,
  isPrivateOrLocalHost,
  xmlContainsForbiddenHosts,
};
