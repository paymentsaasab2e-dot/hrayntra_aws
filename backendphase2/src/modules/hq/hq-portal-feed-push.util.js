/** Statuses that must never appear on the public Adzuna / Careerjet XML feeds. */
export const FEED_EXCLUDED_STATUSES = new Set([
  'DRAFT',
  'ON_HOLD',
  'CLOSED',
  'FILLED',
  'REJECTED',
  'UNPUBLISHED',
  'INACTIVE',
  'PAUSED',
]);

export const PUBLIC_ADZUNA_FEED_URL = 'https://api1.hryantra.com/api/adzuna/jobs.xml';
export const PUBLIC_CAREERJET_FEED_URL = 'https://api1.hryantra.com/api/careerjet/jobs.xml';

export function mergeFeedDistributionPlatforms(existing) {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  return { ...base, adzuna: true, careerjet: true };
}

export function alreadyOptedIntoExternalFeeds(job) {
  if (job?.publishToAdzuna !== true || job?.publishToCareerjet !== true) return false;
  const platforms = job?.distributionPlatforms;
  if (!platforms || typeof platforms !== 'object' || Array.isArray(platforms)) return false;
  return platforms.adzuna === true && platforms.careerjet === true;
}

export function feedSkipReason(job) {
  if (!job) return 'missing_job';
  if (job.isDeleted === true) return 'deleted';
  if (job.isActive === false) return 'inactive';
  const status = String(job.status || '').trim().toUpperCase();
  if (status === 'DRAFT') return 'draft';
  if (status === 'ON_HOLD') return 'on_hold';
  if (status === 'CLOSED') return 'closed';
  if (status === 'FILLED') return 'filled';
  if (status === 'REJECTED') return 'rejected';
  if (status === 'UNPUBLISHED') return 'unpublished';
  if (status === 'INACTIVE' || status === 'PAUSED') return 'inactive';
  if (job.expectedClosureDate) {
    const date = new Date(job.expectedClosureDate);
    if (!Number.isNaN(date.getTime()) && date.getTime() < Date.now()) return 'expired';
  }
  const visibility = String(job.visibility || '').trim().toLowerCase();
  if (visibility === 'internal' || visibility === 'private') return 'not_public';
  return null;
}
