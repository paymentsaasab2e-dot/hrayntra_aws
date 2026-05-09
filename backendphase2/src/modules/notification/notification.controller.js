import {
  notificationService,
  createUserNotification,
} from './notification.service.js';

function getCurrentUserId(req) {
  return (
    req?.user?.id ||
    req?.user?._id ||
    req?.user?.userId ||
    null
  );
}

export const notificationController = {
  async list(req, res) {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: 'Unauthorized' });
      }

      const { category, onlyUnread, take } = req.query;
      const data = await notificationService.list(userId, {
        category,
        onlyUnread: onlyUnread === 'true' || onlyUnread === '1',
        take: Number(take) || 50,
      });

      return res.json({
        success: true,
        data: {
          notifications: data.items.map((n) => ({
            ...n,
            timestamp: n.createdAt,
          })),
          unreadCount: data.unreadCount,
          totalCount: data.items.length,
        },
      });
    } catch (error) {
      console.error('[notification] list failed:', error);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to list notifications' });
    }
  },

  async unreadCount(req, res) {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: 'Unauthorized' });
      }
      const count = await notificationService.unreadCount(userId);
      return res.json({ success: true, count });
    } catch (error) {
      console.error('[notification] unreadCount failed:', error);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to load unread count' });
    }
  },

  async markRead(req, res) {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: 'Unauthorized' });
      }
      await notificationService.markRead(userId, req.params.id);
      return res.json({ success: true });
    } catch (error) {
      console.error('[notification] markRead failed:', error);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to mark as read' });
    }
  },

  async markAllRead(req, res) {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: 'Unauthorized' });
      }
      await notificationService.markAllRead(userId);
      return res.json({ success: true });
    } catch (error) {
      console.error('[notification] markAllRead failed:', error);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to mark all as read' });
    }
  },

  async remove(req, res) {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: 'Unauthorized' });
      }
      await notificationService.remove(userId, req.params.id);
      return res.json({ success: true });
    } catch (error) {
      console.error('[notification] remove failed:', error);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to delete notification' });
    }
  },

  /**
   * Allow internal callers (and the UI for explicit toast → bell mirroring)
   * to record a notification for the current user. Useful so frontend toasts
   * that are purely client-side (form save success, etc.) can also leave a
   * trace under the bell.
   */
  async createForCurrentUser(req, res) {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: 'Unauthorized' });
      }

      const created = await createUserNotification(userId, req.body || {});
      return res
        .status(201)
        .json({ success: true, data: created });
    } catch (error) {
      console.error('[notification] create failed:', error);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to create notification' });
    }
  },
};
