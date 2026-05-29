import { prisma } from '../config/prisma.js';

/**
 * Best-effort audit row for auth/session events (login, logout).
 */
export async function logUserSessionActivity(userId, action, metadata = null) {
  if (!userId || !action) return;
  try {
    await prisma.userActivity.create({
      data: {
        userId: String(userId),
        action: String(action),
        module: 'Auth',
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      },
    });
  } catch (error) {
    console.warn('[userSessionAudit]', error?.message || error);
  }
}
