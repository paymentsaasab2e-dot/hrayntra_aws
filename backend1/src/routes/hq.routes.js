const express = require('express');
const { requireSystemAdmin } = require('../middleware/system-admin.middleware');
const {
  getCandidateSessions,
  listRecentSessions,
  impersonateCandidate,
  lookupCandidate,
  repairIncompleteCandidate,
  provisionOrReuseCandidate,
} = require('../controllers/hq-sessions.controller');

const router = express.Router();

/**
 * Simple HQ session / alert-timing APIs (IP, location, duration, best send window).
 * Auth: x-internal-admin-key (same as other HQ admin routes).
 *
 * GET /api/hq/sessions
 * GET /api/hq/sessions/:candidateId
 * POST /api/hq/impersonate-candidate
 * POST /api/hq/repair-incomplete-candidate
 * POST /api/hq/provision-or-reuse-candidate
 */
router.get('/sessions', requireSystemAdmin, listRecentSessions);
router.get('/sessions/:candidateId', requireSystemAdmin, getCandidateSessions);
router.post('/impersonate-candidate', requireSystemAdmin, impersonateCandidate);
router.post('/candidate-lookup', requireSystemAdmin, lookupCandidate);
router.get('/candidate-lookup', requireSystemAdmin, lookupCandidate);
router.post('/repair-incomplete-candidate', requireSystemAdmin, repairIncompleteCandidate);
router.post('/provision-or-reuse-candidate', requireSystemAdmin, provisionOrReuseCandidate);

module.exports = router;
