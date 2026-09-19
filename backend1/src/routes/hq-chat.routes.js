const express = require('express');
const { requireSystemAdmin } = require('../middleware/system-admin.middleware');
const { protect } = require('../middleware/auth.middleware');
const {
  hqSendMessage,
  hqGetThread,
  hqListInbox,
  clientPending,
  clientIngestReply,
  markUserRead,
  markHqRead,
} = require('../controllers/hq-chat.controller');

const router = express.Router();

/**
 * HQ / admin (requires x-internal-admin-key in production)
 */
router.get('/inbox', requireSystemAdmin, hqListInbox);
router.get('/users/:userId', requireSystemAdmin, hqGetThread);
router.post('/users/:userId/messages', requireSystemAdmin, hqSendMessage);
router.post('/users/:userId/read', requireSystemAdmin, markHqRead);

/**
 * App client sync — candidate JWT required; userId must match session candidate.
 */
function requireOwnUserId(req, res, next) {
  const sessionId = String(req.user?.candidateId || req.user?.id || '').trim();
  const target = String(req.params?.userId || '').trim();
  if (!sessionId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (target && target !== sessionId) {
    return res.status(403).json({ success: false, message: 'Forbidden: user mismatch' });
  }
  return next();
}

router.get('/users/:userId/pending', protect, requireOwnUserId, clientPending);
router.post('/users/:userId/replies', protect, requireOwnUserId, clientIngestReply);
router.post('/users/:userId/mark-read', protect, requireOwnUserId, markUserRead);

module.exports = router;
