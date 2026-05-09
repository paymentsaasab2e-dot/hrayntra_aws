import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';

const ALLOWED_CATEGORIES = new Set([
  'CANDIDATE',
  'JOB',
  'INTERVIEW',
  'PLACEMENT',
  'CLIENT',
  'LEAD',
  'BILLING',
  'TASK',
  'SYSTEM',
]);

function normalizeCategory(category) {
  const c = String(category || '').trim().toUpperCase();
  return ALLOWED_CATEGORIES.has(c) ? c : 'SYSTEM';
}

/** True when `prisma generate` has been run after the Notification model was added. */
function notificationsModelReady() {
  return Boolean(
    prisma?.notification &&
      typeof prisma.notification.findMany === 'function' &&
      typeof prisma.notification.count === 'function'
  );
}

/**
 * Fire-and-forget bell notification creator. Errors are swallowed so a
 * notification failure never rolls back the parent action (e.g. an interview
 * booking succeeds even if the bell write hits a transient Mongo blip).
 *
 * @param {string} userId — recipient user id (CRM User._id)
 * @param {{
 *   category?: string,
 *   title: string,
 *   description?: string,
 *   actionLabel?: string|null,
 *   actionPath?: string|null,
 *   entityType?: string|null,
 *   entityId?: string|null,
 *   metadata?: Record<string, unknown>,
 * }} payload
 */
export async function createUserNotification(userId, payload) {
  try {
    if (!userId || !payload?.title) return null;
    if (!notificationsModelReady() || typeof prisma.notification.create !== 'function') {
      console.warn(
        '[notification] prisma.notification unavailable — run `prisma generate` and `prisma db push` in backendphase2.'
      );
      return null;
    }

    return await prisma.notification.create({
      data: {
        userId,
        category: normalizeCategory(payload.category),
        title: String(payload.title).slice(0, 200),
        description: payload.description
          ? String(payload.description).slice(0, 1500)
          : null,
        actionLabel: payload.actionLabel || null,
        actionPath: payload.actionPath || null,
        entityType: payload.entityType || null,
        entityId: payload.entityId || null,
        metadata: payload.metadata || {},
        isRead: false,
      },
    });
  } catch (error) {
    console.warn(
      '[notification] create failed (non-fatal):',
      error?.message || error
    );
    return null;
  }
}

/**
 * Broadcast helper: same payload to every active CRM user. Useful for events
 * like "Candidate applied for X" which any recruiter watching the pipeline
 * may care about. Failures per recipient are isolated.
 */
export async function broadcastToActiveUsers(payload, { excludeUserId } = {}) {
  try {
    if (!prisma?.user?.findMany) return [];
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    const results = await Promise.allSettled(
      users.map((u) => createUserNotification(u.id, payload))
    );
    return results;
  } catch (error) {
    console.warn(
      '[notification] broadcast failed (non-fatal):',
      error?.message || error
    );
    return [];
  }
}

/**
 * Push a candidate-facing bell notification into the job portal (backend1).
 * Used for events that originate in the CRM but should reach the candidate
 * — e.g. "Interview scheduled", "Application rejected", "Offer letter".
 *
 * Best-effort: failures are logged but never surfaced; the caller's primary
 * operation (interview create, reject, etc.) must not be rolled back.
 */
export async function pushPortalNotification(portalCandidateId, payload) {
  try {
    if (!portalCandidateId || !payload?.title) return false;

    const base = String(env.JOB_PORTAL_API_URL || 'http://localhost:5000')
      .trim()
      .replace(/\/+$/, '');
    const secret =
      env.PHASE2_PORTAL_SYNC_SECRET ||
      process.env.PHASE2_PORTAL_SYNC_SECRET ||
      'phase2-portal-sync-2026-shared-secret';

    const res = await fetch(`${base}/api/internal/portal-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-phase2-portal-sync-secret': secret,
      },
      body: JSON.stringify({
        candidateId: portalCandidateId,
        type: payload.type || 'system',
        title: payload.title,
        description: payload.description || '',
        actionButton: payload.actionButton || null,
        actionPath: payload.actionPath || null,
        metadata: payload.metadata || {},
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(
        '[notification] portal push HTTP error:',
        res.status,
        text.slice(0, 200)
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn(
      '[notification] portal push failed (non-fatal):',
      error?.message || error
    );
    return false;
  }
}

export const notificationService = {
  async list(userId, { take = 50, category, onlyUnread = false } = {}) {
    if (!userId) return { items: [], unreadCount: 0 };
    if (!notificationsModelReady()) {
      return { items: [], unreadCount: 0 };
    }

    const where = { userId };
    if (category && category !== 'ALL') where.category = normalizeCategory(category);
    if (onlyUnread) where.isRead = false;

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { items, unreadCount };
  },

  async unreadCount(userId) {
    if (!userId) return 0;
    if (!notificationsModelReady()) return 0;
    try {
      return await prisma.notification.count({ where: { userId, isRead: false } });
    } catch (e) {
      console.warn('[notification] unreadCount:', e?.message || e);
      return 0;
    }
  },

  async markRead(userId, notificationId) {
    if (!notificationsModelReady()) return { count: 0 };
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async markAllRead(userId) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async remove(userId, notificationId) {
    if (!notificationsModelReady()) return { count: 0 };
    return prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  },
};
