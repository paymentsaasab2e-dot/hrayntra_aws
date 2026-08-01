const express = require('express');
const { requireSystemAdmin } = require('../middleware/system-admin.middleware');
const {
  getBundle,
  postBundle,
  hqSummary,
} = require('../controllers/office-gossips.controller');

const router = express.Router();

/**
 * Client sync — multi-device Office Gossips + Reference Check.
 * GET pulls shared catalog; POST merges local creates/updates.
 */
router.get('/bundle', getBundle);
router.post('/bundle', postBundle);

/** HQ analytics rollup (admin key in production). */
router.get('/hq/summary', requireSystemAdmin, hqSummary);

module.exports = router;
