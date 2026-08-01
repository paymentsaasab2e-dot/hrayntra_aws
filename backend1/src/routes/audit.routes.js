const express = require('express');
const { requireSystemAdmin } = require('../middleware/system-admin.middleware');
const {
  createAuditEvent,
  listEvents,
  getEvent,
  hqRelease,
  hqFeed,
  listReleases,
} = require('../controllers/audit.controller');

const router = express.Router();

// All audit routes require system admin key (open in local if key unset)
router.use(requireSystemAdmin);

/** Write a custom audit event (HQ / admin tooling). */
router.post('/events', createAuditEvent);

/** List / filter audit events. */
router.get('/events', listEvents);
router.get('/events/:id', getEvent);

/**
 * HQ RELEASE — attach this to HQ / management systems.
 * GET  /api/audit/hq/release?sinceHours=24&limit=200
 * POST /api/audit/hq/release  { sinceHours, acknowledge, note, hqSystemId }
 */
router.get('/hq/release', hqRelease);
router.post('/hq/release', hqRelease);

/** HQ poll feed of recent admin actions + prior releases. */
router.get('/hq/feed', hqFeed);

/** Prior HQ release packages. */
router.get('/hq/releases', listReleases);

module.exports = router;
