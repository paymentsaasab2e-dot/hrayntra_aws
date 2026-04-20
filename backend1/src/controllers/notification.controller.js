const { prisma, retryQuery } = require('../lib/prisma');

/**
 * Get all notifications for a candidate
 * GET /api/notifications/:candidateId
 */
async function getNotifications(req, res) {
  try {
    const { candidateId } = req.params;
    const { type } = req.query;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    const where = { candidateId };
    if (type) {
      where.type = type;
    }

    const notifications = await retryQuery(async () => {
      return await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    const unreadCount = await retryQuery(async () => {
      return await prisma.notification.count({
        where: {
          candidateId,
          isRead: false,
        },
      });
    });

    // Transform notifications to match frontend interface (timestamp instead of createdAt)
    const transformedNotifications = notifications.map(n => ({
      ...n,
      timestamp: n.createdAt,
    }));

    res.json({
      success: true,
      data: {
        notifications: transformedNotifications,
        unreadCount,
        totalCount: notifications.length,
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Mark a notification as read
 * PUT /api/notifications/:candidateId/:notificationId/read
 */
async function markAsRead(req, res) {
  try {
    const { candidateId, notificationId } = req.params;

    if (!candidateId || !notificationId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID and Notification ID are required',
      });
    }

    const notification = await retryQuery(async () => {
      return await prisma.notification.update({
        where: {
          id: notificationId,
          candidateId,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    });

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Mark all notifications as read
 * PUT /api/notifications/:candidateId/mark-all-read
 */
async function markAllAsRead(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    await retryQuery(async () => {
      return await prisma.notification.updateMany({
        where: {
          candidateId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get unread notification count
 * GET /api/notifications/:candidateId/unread-count
 */
async function getUnreadCount(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    const count = await retryQuery(async () => {
      return await prisma.notification.count({
        where: {
          candidateId,
          isRead: false,
        },
      });
    });

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Create a new notification
 * POST /api/notifications/:candidateId
 * (Internal use only - for other services to create notifications)
 */
async function createNotification(req, res) {
  try {
    const { candidateId } = req.params;
    const {
      type,
      title,
      description,
      actionButton,
      actionPath,
      metadata,
    } = req.body;

    if (!candidateId || !type || !title) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID, type, and title are required',
      });
    }

    const notification = await retryQuery(async () => {
      return await prisma.notification.create({
        data: {
          candidateId,
          type,
          title,
          description: description || '',
          actionButton: actionButton || null,
          actionPath: actionPath || null,
          metadata: metadata || {},
          isRead: false,
        },
      });
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Delete a notification
 * DELETE /api/notifications/:candidateId/:notificationId
 */
async function deleteNotification(req, res) {
  try {
    const { candidateId, notificationId } = req.params;

    if (!candidateId || !notificationId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID and Notification ID are required',
      });
    }

    await retryQuery(async () => {
      return await prisma.notification.delete({
        where: {
          id: notificationId,
          candidateId,
        },
      });
    });

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification,
  deleteNotification,
};
