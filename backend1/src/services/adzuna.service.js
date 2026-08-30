/**
 * Compatibility re-exports. Canonical Adzuna job feed lives in ./adzuna/.
 * Search API app_id/app_key are NOT used by the XML feed.
 */
const {
  isFeedTokenValid,
  portalFrontendBase,
  wantsAdzunaPublish,
  envFlag,
  generateAdzunaFeed,
} = require('./adzuna/feed.service');

async function getAdzunaStatus(req, res) {
  return res.json({
    success: true,
    data: {
      feedPath: '/api/adzuna/jobs.xml',
      public: true,
      includeAllOpenJobs: envFlag('ADZUNA_FEED_INCLUDE_ALL'),
      searchApiConfigured: Boolean(
        String(process.env.ADZUNA_APP_ID || '').trim() && String(process.env.ADZUNA_APP_KEY || '').trim(),
      ),
    },
  });
}

module.exports = {
  wantsAdzunaPublish,
  isFeedTokenValid,
  portalFrontendBase,
  envFlag,
  generateAdzunaFeed,
  getAdzunaStatus,
};
