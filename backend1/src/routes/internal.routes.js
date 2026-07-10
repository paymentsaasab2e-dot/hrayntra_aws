const { Router } = require('express');
const { createCandidateNotification } = require('../services/notification.service');
const { notifyHighFitCandidatesForJob } = require('../services/job-match-alert.service');

const router = Router();

// Mirror of the secret used by backendphase2 for portal-sync.
// Keeping the dev fallback in lock-step lets a fresh local clone work without
// any extra .env wiring (production must set PHASE2_PORTAL_SYNC_SECRET).
const DEV_FALLBACK_SECRET = 'phase2-portal-sync-2026-shared-secret';

function maskSecret(value) {
  const s = String(value || '');
  if (!s) return '<empty>';
  if (s.length <= 8) return `${s[0]}***`;
  return `${s.slice(0, 4)}***${s.slice(-2)} (len=${s.length})`;
}

function sharedSecretMiddleware(req, res, next) {
  const envSecret = String(process.env.PHASE2_PORTAL_SYNC_SECRET || '').trim();
  const got = String(req.headers['x-phase2-portal-sync-secret'] || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  const accepted = new Set();
  if (envSecret) accepted.add(envSecret);
  if (!isProd) accepted.add(DEV_FALLBACK_SECRET);

  if (isProd && !envSecret) {
    return res
      .status(503)
      .json({ success: false, message: 'Portal notifications not configured' });
  }
  if (!isProd && !envSecret && !got) return next();
  if (got && accepted.has(got)) return next();

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

module.exports = router;
