const lastRun = {
  adzuna: null,
  careerjet: null,
};

function recordFeedRun(platform, payload) {
  lastRun[platform] = {
    ...payload,
    at: new Date().toISOString(),
  };
}

function lastFeedRun(platform) {
  return lastRun[platform];
}

module.exports = {
  recordFeedRun,
  lastFeedRun,
};
