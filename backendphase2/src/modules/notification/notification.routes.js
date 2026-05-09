import express from 'express';
import { notificationController } from './notification.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
router.post('/', notificationController.createForCurrentUser);
router.put('/mark-all-read', notificationController.markAllRead);
router.put('/:id/read', notificationController.markRead);
router.delete('/:id', notificationController.remove);

export default router;
