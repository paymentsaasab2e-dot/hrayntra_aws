const express = require('express');
const { requireSystemAdmin } = require('../middleware/system-admin.middleware');
const { protect } = require('../middleware/auth.middleware');
const {
  getBundle,
  postBundle,
  hqSummary,
} = require('../controllers/office-gossips.controller');

const router = express.Router();

/** Client sync — requires candidate JWT */
router.get('/bundle', protect, getBundle);
router.post('/bundle', protect, postBundle);

/** HQ analytics rollup */
router.get('/hq/summary', requireSystemAdmin, hqSummary);

module.exports = router;
