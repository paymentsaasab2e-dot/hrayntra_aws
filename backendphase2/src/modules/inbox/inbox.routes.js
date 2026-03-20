import express from 'express';
import { inboxController } from './inbox.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/threads', inboxController.getThreads);
router.get('/threads/:id', inboxController.getThreadById);
router.post('/threads', inboxController.createThread);
router.post('/threads/:threadId/messages', inboxController.addMessage);
router.patch('/threads/:threadId/read', inboxController.markAsRead);

export default router;
