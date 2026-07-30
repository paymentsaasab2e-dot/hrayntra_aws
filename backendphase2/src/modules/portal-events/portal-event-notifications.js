import { pushPortalNotification } from '../notification/notification.service.js';

export function formatEventWhenLabel(scheduledAt) {
  const date = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return 'the scheduled time';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Notify all registered candidates when an event is cancelled or deleted.
 * Best-effort — never throws to callers.
 */
export async function notifyPortalEventApplicants({
  event,
  registrations,
  action,
  organizerName,
}) {
  try {
    if (!event?.id || !Array.isArray(registrations) || registrations.length === 0) return;

    const title = event.title || 'Event';
    const whenLabel = formatEventWhenLabel(event.scheduledAt);
    const organizer = String(organizerName || event.createdByName || 'The organizer').trim();
    const isCancel = action === 'cancelled';

    const portalTitle = isCancel ? 'Event cancelled' : 'Event removed';
    const portalDescription = isCancel
      ? `${organizer} cancelled "${title}" scheduled for ${whenLabel}.`
      : `${organizer} removed "${title}" that you registered for (${whenLabel}).`;

    await Promise.allSettled(
      registrations.map((registration) => {
        const candidateId = String(registration?.userId || '').trim();
        if (!candidateId) return Promise.resolve(false);
        return pushPortalNotification(candidateId, {
          type: 'system',
          title: portalTitle,
          description: portalDescription,
          actionButton: 'View events',
          actionPath: '/lms/events',
          metadata: {
            eventId: event.id,
            eventTitle: title,
            scheduledAt:
              event.scheduledAt instanceof Date
                ? event.scheduledAt.toISOString()
                : event.scheduledAt,
            action,
            organizerName: organizer,
          },
        });
      }),
    );
  } catch (error) {
    console.warn(
      '[portal-event-notifications] notify applicants failed (non-fatal):',
      error?.message || error,
    );
  }
}
