const CLOSED_STATUSES = new Set([
  'CLOSED',
  'FILLED',
  'DRAFT',
  'ON_HOLD',
  'REJECTED',
  'UNPUBLISHED',
  'INACTIVE',
  'PAUSED',
]);
const ADZUNA_COUNTRIES = new Set([
  'AU', 'AT', 'BE', 'BR', 'CA', 'CH', 'FR', 'DE', 'ES', 'IN', 'IT', 'MX', 'NL', 'NZ', 'PL', 'SG', 'ZA', 'UK', 'US',
]);

const COUNTRY_NAMES = {
  INDIA: 'IN',
  'UNITED STATES': 'US',
  USA: 'US',
  AMERICA: 'US',
  'UNITED KINGDOM': 'UK',
  'GREAT BRITAIN': 'GB',
  UK: 'UK',
  GB: 'UK',
  AUSTRALIA: 'AU',
  CANADA: 'CA',
  SINGAPORE: 'SG',
  GERMANY: 'DE',
  FRANCE: 'FR',
  SPAIN: 'ES',
  ITALY: 'IT',
  NETHERLANDS: 'NL',
  'NEW ZEALAND': 'NZ',
  'SOUTH AFRICA': 'ZA',
  BRAZIL: 'BR',
  MEXICO: 'MX',
  POLAND: 'PL',
  AUSTRIA: 'AT',
  BELGIUM: 'BE',
  SWITZERLAND: 'CH',
};

function envFlag(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function wantsAdzunaPublish(job) {
  if (job?.publishToAdzuna === true) return true;
  const platforms = job?.distributionPlatforms;
  if (platforms && typeof platforms === 'object' && platforms.adzuna === true) return true;
  return false;
}

function mapCountryCode(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  const upper = v.toUpperCase();
  if (upper === 'GB') return 'UK';
  if (ADZUNA_COUNTRIES.has(upper)) return upper;
  if (COUNTRY_NAMES[upper]) return COUNTRY_NAMES[upper] === 'GB' ? 'UK' : COUNTRY_NAMES[upper];
  return null;
}

function inferCountryFromLocation(location) {
  const haystack = String(location || '').toUpperCase();
  if (!haystack.trim()) return null;
  for (const [name, code] of Object.entries(COUNTRY_NAMES)) {
    if (haystack.includes(name)) return code === 'GB' ? 'UK' : code;
  }
  for (const code of ADZUNA_COUNTRIES) {
    if (new RegExp(`\\b${code}\\b`).test(haystack)) return code;
  }
  return null;
}

function resolveCountry(job) {
  return mapCountryCode(job?.country) || inferCountryFromLocation(job?.location) || inferCountryFromLocation(job?.city);
}

function parseMongoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object') {
    if (value.$date != null) return parseMongoDate(value.$date);
    if (value.$numberLong != null) {
      const n = Number(value.$numberLong);
      return Number.isFinite(n) ? parseMongoDate(n) : null;
    }
  }
  return null;
}

function toIsoDateString(value) {
  const date = parseMongoDate(value);
  return date ? date.toISOString() : null;
}

function isExpired(job, now = new Date()) {
  const date = parseMongoDate(job?.expectedClosureDate);
  if (!date) return false;
  return date.getTime() < now.getTime();
}

function isOpenPublished(job) {
  if (job?.isDeleted === true) return false;
  if (job?.isActive === false) return false;
  const status = String(job?.status || '').trim().toUpperCase();
  if (status && CLOSED_STATUSES.has(status)) return false;
  if (isExpired(job)) return false;
  return true;
}

/**
 * Eligibility for the Adzuna XML feed.
 * Returns { ok: true } or { ok: false, reason }.
 */
function evaluateEligibility(job, { includeAll = envFlag('ADZUNA_FEED_INCLUDE_ALL') } = {}) {
  if (!job) return { ok: false, reason: 'missing_job' };
  if (job.isDeleted === true) return { ok: false, reason: 'deleted' };
  if (job.isActive === false) return { ok: false, reason: 'inactive' };
  const status = String(job.status || '').trim().toUpperCase();
  if (status === 'DRAFT') return { ok: false, reason: 'draft' };
  if (status === 'ON_HOLD') return { ok: false, reason: 'on_hold' };
  if (status === 'CLOSED') return { ok: false, reason: 'closed' };
  if (status === 'FILLED') return { ok: false, reason: 'filled' };
  if (status === 'REJECTED') return { ok: false, reason: 'rejected' };
  if (status === 'UNPUBLISHED') return { ok: false, reason: 'unpublished' };
  if (status === 'INACTIVE' || status === 'PAUSED') return { ok: false, reason: 'inactive' };
  if (isExpired(job)) return { ok: false, reason: 'expired' };
  // Create Job still has an Adzuna checkbox, but both public feeds include every
  // portal-visible job unless ADZUNA_FEED_REQUIRE_OPT_IN=true.
  const requireOptIn = envFlag('ADZUNA_FEED_REQUIRE_OPT_IN') && !includeAll;
  if (requireOptIn && !wantsAdzunaPublish(job)) return { ok: false, reason: 'adzuna_not_enabled' };
  if (!isOpenPublished(job)) return { ok: false, reason: 'not_published' };
  return { ok: true };
}

module.exports = {
  CLOSED_STATUSES,
  ADZUNA_COUNTRIES,
  envFlag,
  wantsAdzunaPublish,
  mapCountryCode,
  inferCountryFromLocation,
  resolveCountry,
  evaluateEligibility,
  isExpired,
  parseMongoDate,
  toIsoDateString,
};
