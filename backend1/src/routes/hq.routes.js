const express = require('express');
const { requireSystemAdmin } = require('../middleware/system-admin.middleware');
const {
  getCandidateSessions,
  listRecentSessions,
} = require('../controllers/hq-sessions.controller');

const router = express.Router();

/**
 * Simple HQ session / alert-timing APIs (IP, location, duration, best send window).
 * Auth: x-internal-admin-key (same as other HQ admin routes).
 *
 * GET /api/hq/sessions
 * GET /api/hq/sessions/:candidateId
 */
router.get('/sessions', requireSystemAdmin, listRecentSessions);
router.get('/sessions/:candidateId', requireSystemAdmin, getCandidateSessions);

module.exports = router;
