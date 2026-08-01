const {
  getSnapshot,
  mergeClientPush,
  getHqSummary,
} = require('../services/office-gossips.service');

function getBundle(_req, res) {
  try {
    const bundle = getSnapshot();
    return res.json({
      ok: true,
      data: {
        communities: bundle.communities,
        companyPages: bundle.companyPages,
        posts: bundle.posts,
        comments: bundle.comments,
        identities: bundle.identities,
        referenceChecks: bundle.referenceChecks,
        social: bundle.social,
        updatedAt: bundle.updatedAt,
        version: bundle.version,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Failed to load' });
  }
}

function postBundle(req, res) {
  try {
    const body = req.body || {};
    const merged = mergeClientPush({
      communities: body.communities,
      companyPages: body.companyPages,
      posts: body.posts,
      comments: body.comments,
      identities: body.identities,
      identity: body.identity,
      referenceChecks: body.referenceChecks,
      social: body.social,
    });
    return res.json({
      ok: true,
      data: {
        communities: merged.communities,
        companyPages: merged.companyPages,
        posts: merged.posts,
        comments: merged.comments,
        identities: merged.identities,
        referenceChecks: merged.referenceChecks,
        social: merged.social,
        updatedAt: merged.updatedAt,
        version: merged.version,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Failed to sync' });
  }
}

function hqSummary(_req, res) {
  try {
    return res.json({ ok: true, data: getHqSummary() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Failed' });
  }
}

module.exports = {
  getBundle,
  postBundle,
  hqSummary,
};
