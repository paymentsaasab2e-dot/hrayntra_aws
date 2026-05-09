const { prisma } = require('../lib/prisma');

/**
 * Allowed values mirror the `NotificationUserType` enum in schema.prisma.
 * Anything outside this set is coerced to `system` so an unknown event
 * still appears in the bell instead of crashing the parent write path.
 */
const ALLOWED_TYPES = new Set([
  'job',
  'application',
  'interview',
  'course',
  'system',
  'saved_search',
]);

function normalizeType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (!t) return 'system';
  if (t === 'saved-search') return 'saved_search';
  return ALLOWED_TYPES.has(t) ? t : 'system';
}

/**
 * Creates a candidate-facing bell notification.
 *
 * Failures are intentionally swallowed and logged: the caller (apply, status
 * update, profile save, etc.) must not be rolled back just because the side
 * channel write failed. Callers can `await` it for ordering but should not
 * treat a rejection here as fatal.
 *
 * @param {string} candidateId
 * @param {{
 *   type?: string,
 *   title: string,
 *   description?: string,
 *   actionButton?: string|null,
 *   actionPath?: string|null,
 *   metadata?: object,
 * }} payload
 */
async function createCandidateNotification(candidateId, payload) {
  try {
    if (!candidateId || !payload?.title) return null;

    if (!prisma?.notification?.create) {
      console.warn(
        '[notification] prisma.notification unavailable — skipping (run `prisma generate`).'
      );
      return null;
    }

    return await prisma.notification.create({
      data: {
        candidateId,
        type: normalizeType(payload.type),
        title: String(payload.title).slice(0, 200),
        description: String(payload.description || '').slice(0, 1000),
        actionButton: payload.actionButton || null,
        actionPath: payload.actionPath || null,
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

module.exports = {
  createCandidateNotification,
  normalizeNotificationType: normalizeType,
};
