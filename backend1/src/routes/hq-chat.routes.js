const express = require('express');
const { requireSystemAdmin } = require('../middleware/system-admin.middleware');
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
 * Send & inspect HRYantra verified chats per user.
 */
router.get('/inbox', requireSystemAdmin, hqListInbox);
router.get('/users/:userId', requireSystemAdmin, hqGetThread);
router.post('/users/:userId/messages', requireSystemAdmin, hqSendMessage);
router.post('/users/:userId/read', requireSystemAdmin, markHqRead);

/**
 * App client sync (open in non-prod; still keyed in prod via same admin header
 * OR pass candidate self — for simplicity use admin key optional + userId path).
 * Client uses these to pull HQ pushes and push user replies for HQ visibility.
 */
router.get('/users/:userId/pending', clientPending);
router.post('/users/:userId/replies', clientIngestReply);
router.post('/users/:userId/mark-read', markUserRead);

module.exports = router;
