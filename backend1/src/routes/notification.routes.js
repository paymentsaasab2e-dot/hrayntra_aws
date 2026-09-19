const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const { requireOwnCandidate } = require('../middleware/requireOwnCandidate.middleware');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification,
  deleteNotification,
} = require('../controllers/notification.controller');

const router = Router();
router.use(protect);

// Get all notifications for a candidate
router.get('/:candidateId', requireOwnCandidate, getNotifications);

// Get unread notification count
router.get('/:candidateId/unread-count', requireOwnCandidate, getUnreadCount);

// Mark a notification as read
router.put('/:candidateId/:notificationId/read', requireOwnCandidate, markAsRead);

// Mark all notifications as read
router.put('/:candidateId/mark-all-read', requireOwnCandidate, markAllAsRead);

// Create a new notification (internal use)
router.post('/:candidateId', requireOwnCandidate, createNotification);

// Delete a notification
router.delete('/:candidateId/:notificationId', requireOwnCandidate, deleteNotification);

module.exports = router;
