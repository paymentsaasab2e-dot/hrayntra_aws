const { prisma } = require('../../lib/prisma');
const { fetchAllPortalJobs } = require('./fetchPortalJobs');
const { portalFrontendBase } = require('./publicPortalUrl');
const { lastFeedRun } = require('./diagnosticsStore');
const { buildFeedFromJobs: buildAdzunaFeed } = require('../adzuna/feed.service');
const { buildFeedFromJobs: buildCareerjetFeed } = require('../careerjet/feed.service');
const { evaluateEligibility: adzunaEligibility } = require('../adzuna/eligibility');
const { evaluateEligibility: careerjetEligibility } = require('../careerjet/eligibility');

function countByStatus(jobs) {
  const counts = {
    total: jobs.length,
    deleted: 0,
    inactive: 0,
    draft: 0,
    onHold: 0,
    closed: 0,
    filled: 0,
    rejected: 0,
    unpublished: 0,
    expired: 0,
    openPublished: 0,
  };
  for (const job of jobs) {
    const status = String(job?.status || '').trim().toUpperCase();
    if (job?.isDeleted === true) counts.deleted += 1;
    else if (job?.isActive === false || status === 'INACTIVE' || status === 'PAUSED') counts.inactive += 1;
    else if (status === 'DRAFT') counts.draft += 1;
    else if (status === 'ON_HOLD') counts.onHold += 1;
    else if (status === 'CLOSED') counts.closed += 1;
    else if (status === 'FILLED') counts.filled += 1;
    else if (status === 'REJECTED') counts.rejected += 1;
    else if (status === 'UNPUBLISHED') counts.unpublished += 1;
    else if (adzunaEligibility(job).reason === 'expired' || careerjetEligibility(job).reason === 'expired') {
      counts.expired += 1;
    } else if (adzunaEligibility(job).ok) counts.openPublished += 1;
  }
  return counts;
}

async function collectJobFeedDiagnostics() {
  const started = Date.now();
  const jobs = await fetchAllPortalJobs(prisma);
  const portalBase = portalFrontendBase();
  const adzuna = buildAdzunaFeed(jobs, { portalBase });
  const careerjet = buildCareerjetFeed(jobs, { portalBase });
  const durationMs = Date.now() - started;
  const database = countByStatus(jobs);

  return {
    generatedAt: new Date().toISOString(),
    durationMs,
    portalBase,
    feedUrls: {
      adzuna: 'https://api1.hryantra.com/api/adzuna/jobs.xml',
      careerjet: 'https://api1.hryantra.com/api/careerjet/jobs.xml',
    },
    database,
    adzuna: {
      scanned: jobs.length,
      included: adzuna.stats.exported,
      eligible: adzuna.stats.totalEligible,
      excluded: adzuna.stats.skipped,
      excludedByReason: adzuna.stats.skipReasons,
      lastSuccessfulGeneration: lastFeedRun('adzuna'),
    },
    careerjet: {
      scanned: jobs.length,
      included: careerjet.stats.exported,
      eligible: careerjet.stats.totalEligible,
      excluded: careerjet.stats.skipped,
      excludedByReason: careerjet.stats.skipReasons,
      lastSuccessfulGeneration: lastFeedRun('careerjet'),
    },
  };
}

module.exports = {
  collectJobFeedDiagnostics,
};
