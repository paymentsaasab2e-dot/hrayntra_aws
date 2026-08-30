import express from 'express';
import { inboxController } from './inbox.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/threads', inboxController.getThreads);
router.get('/threads/:id', inboxController.getThreadById);
router.get('/mailboxes/status', inboxController.getMailboxStatus);
router.get('/gmail/messages', inboxController.getGmailMessages);
router.get('/gmail/messages/:messageId', inboxController.getGmailMessage);
router.post('/gmail/messages/:messageId/archive', inboxController.archiveGmailMessage);
router.post('/gmail/messages/:messageId/trash', inboxController.trashGmailMessage);
router.patch('/gmail/messages/:messageId/flags', inboxController.updateGmailMessageFlags);
router.post('/gmail/messages/:messageId/calendar-event', inboxController.createCalendarEventFromMessage);
router.get('/outlook/messages', inboxController.getOutlookMessages);
router.get('/outlook/messages/:messageId', inboxController.getOutlookMessage);
router.post('/outlook/messages/:messageId/archive', inboxController.archiveOutlookMessage);
router.post('/outlook/messages/:messageId/trash', inboxController.trashOutlookMessage);
router.patch('/outlook/messages/:messageId/flags', inboxController.updateOutlookMessageFlags);
router.post(
  '/outlook/messages/:messageId/calendar-event',
  inboxController.createCalendarEventFromOutlookMessage
);
router.post('/threads', inboxController.createThread);
router.post('/threads/:threadId/messages', inboxController.addMessage);
router.patch('/threads/:threadId/read', inboxController.markAsRead);

export default router;
