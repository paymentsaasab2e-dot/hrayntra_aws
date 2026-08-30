const CLOSED_STATUSES = new Set(['CLOSED', 'FILLED', 'DRAFT', 'ON_HOLD']);
const { resolveCountryName } = require('./countries');

function envFlag(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function wantsCareerjetPublish(job) {
  if (job?.publishToCareerjet === true) return true;
  const platforms = job?.distributionPlatforms;
  if (platforms && typeof platforms === 'object' && platforms.careerjet === true) return true;
  return false;
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

function isExpired(job, now = new Date()) {
  const date = parseMongoDate(job?.expectedClosureDate);
  if (!date) return false;
  return date.getTime() < now.getTime();
}

function evaluateEligibility(job, { includeAll = envFlag('CAREERJET_FEED_INCLUDE_ALL') } = {}) {
  if (!job) return { ok: false, reason: 'missing_job' };
  if (job.isDeleted === true) return { ok: false, reason: 'deleted' };
  if (job.isActive === false) return { ok: false, reason: 'inactive' };
  const status = String(job.status || '').trim().toUpperCase();
  if (status === 'DRAFT') return { ok: false, reason: 'draft' };
  if (status === 'ON_HOLD') return { ok: false, reason: 'on_hold' };
  if (status === 'CLOSED') return { ok: false, reason: 'closed' };
  if (status === 'FILLED') return { ok: false, reason: 'filled' };
  if (isExpired(job)) return { ok: false, reason: 'expired' };
  if (!includeAll && !wantsCareerjetPublish(job)) return { ok: false, reason: 'careerjet_not_enabled' };
  return { ok: true };
}

module.exports = {
  CLOSED_STATUSES,
  envFlag,
  wantsCareerjetPublish,
  parseMongoDate,
  isExpired,
  evaluateEligibility,
  resolveCountryName,
};
