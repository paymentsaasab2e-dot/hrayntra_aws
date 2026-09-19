const { Router } = require('express');
const { createCandidateNotification } = require('../services/notification.service');
const { notifyHighFitCandidatesForJob } = require('../services/job-match-alert.service');
const { requireSystemAdmin } = require('../middleware/system-admin.middleware');
const { collectJobFeedDiagnostics } = require('../services/job-feeds/diagnostics.service');

const router = Router();

function maskSecret(value) {
  const s = String(value || '');
  if (!s) return '<empty>';
  if (s.length <= 8) return `${s[0]}***`;
  return `${s.slice(0, 4)}***${s.slice(-2)} (len=${s.length})`;
}

function sharedSecretMiddleware(req, res, next) {
  const envSecret = String(process.env.PHASE2_PORTAL_SYNC_SECRET || '').trim();
  const got = String(req.headers['x-phase2-portal-sync-secret'] || '').trim();

  if (!envSecret) {
    return res
      .status(503)
      .json({ success: false, message: 'Portal notifications not configured' });
  }
  if (got && got === envSecret) return next();

  console.warn('[internal] 401 secret mismatch on portal notification', {
    env: maskSecret(envSecret),
    got: maskSecret(got),
  });
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}

/**
 * POST /api/internal/portal-notification
 * Body: { candidateId, type, title, description, actionButton, actionPath, metadata }
 *
 * Used by backendphase2 (CRM) to push candidate-facing events back into the
 * job-portal bell — e.g. "Interview scheduled", "Application rejected",
 * "Offer letter received". Auth uses the same shared secret that protects
 * the apply webhook so we don't introduce a second key to manage.
 */
router.post('/portal-notification', sharedSecretMiddleware, async (req, res) => {
  try {
    const {
      candidateId,
      type,
      title,
      description,
      actionButton,
      actionPath,
      metadata,
    } = req.body || {};

    if (!candidateId || !title) {
      return res.status(400).json({
        success: false,
        message: 'candidateId and title are required',
      });
    }

    const created = await createCandidateNotification(candidateId, {
      type,
      title,
      description,
      actionButton,
      actionPath,
      metadata,
    });

    return res.json({
      success: true,
      data: created ? { id: created.id } : null,
    });
  } catch (error) {
    console.error('[internal] portal-notification failed:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to record notification' });
  }
});

/**
 * POST /api/internal/job-match-alerts
 * Body: { jobId }
 *
 * After a job is mirrored to the portal DB, score candidates and notify those
 * with CV fit above the configured threshold (default 80%).
 */
router.post('/job-match-alerts', sharedSecretMiddleware, async (req, res) => {
  try {
    const jobId = String(req.body?.jobId || '').trim();
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'jobId is required' });
    }

    const result = await notifyHighFitCandidatesForJob(jobId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[internal] job-match-alerts failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to process job match alerts' });
  }
});

/**
 * GET /api/internal/job-feeds/diagnostics
 * Admin-only. Not the public XML feed.
 */
router.get('/job-feeds/diagnostics', requireSystemAdmin, async (req, res) => {
  try {
    const data = await collectJobFeedDiagnostics();
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[internal] job-feed diagnostics failed:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Failed to collect job feed diagnostics' });
  }
});

module.exports = router;
