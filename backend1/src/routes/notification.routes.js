const { Router } = require('express');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification,
  deleteNotification,
} = require('../controllers/notification.controller');

const router = Router();

// Get all notifications for a candidate
router.get('/:candidateId', getNotifications);

// Get unread notification count
router.get('/:candidateId/unread-count', getUnreadCount);

// Mark a notification as read
router.put('/:candidateId/:notificationId/read', markAsRead);

// Mark all notifications as read
router.put('/:candidateId/mark-all-read', markAllAsRead);

// Create a new notification (internal use)
router.post('/:candidateId', createNotification);

// Delete a notification
router.delete('/:candidateId/:notificationId', deleteNotification);

module.exports = router;
