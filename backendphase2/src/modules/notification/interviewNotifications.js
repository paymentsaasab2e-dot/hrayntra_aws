import { getJobPortalPrismaClient } from '../../config/prisma.js';
import { createUserNotification, pushPortalNotification } from './notification.service.js';

export function formatInterviewWhenLabel(scheduledAt) {
  const date = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return 'the scheduled time';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

async function resolvePortalApplicationActionPath(portalCandidateId, jobId) {
  try {
    const portal = getJobPortalPrismaClient();
    if (!portal?.application?.findFirst) return '/applications';
    const app = await portal.application.findFirst({
      where: {
        candidateId: String(portalCandidateId),
        jobId: String(jobId),
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return app?.id ? `/applications/${app.id}` : '/applications';
  } catch {
    return '/applications';
  }
}

/**
 * CRM bell + job-portal candidate bell when an interview is scheduled or rescheduled.
 * Best-effort — never throws to callers.
 */
export async function notifyInterviewScheduleChange({
  event = 'scheduled',
  portalCandidateId,
  candidateName,
  jobTitle,
  jobId,
  interviewId,
  scheduledAt,
  mode = null,
  meetingLink = null,
  schedulerUserId = null,
  panelUserIds = [],
}) {
  try {
    const candId = String(portalCandidateId || '').trim();
    const jId = String(jobId || '').trim();
    if (!candId || !interviewId) return;

    const name = String(candidateName || '').trim() || 'Candidate';
    const role = String(jobTitle || '').trim() || 'a role';
    const whenLabel = formatInterviewWhenLabel(scheduledAt);
    const isReschedule = event === 'rescheduled';

    const crmTitle = isReschedule
      ? 'Interview rescheduled'
      : 'Interview scheduled successfully';
    const crmDescription = isReschedule
      ? `${name} — ${role} moved to ${whenLabel}.`
      : `${name} for ${role} on ${whenLabel}.`;

    const recipientUserIds = new Set();
    if (schedulerUserId) recipientUserIds.add(schedulerUserId);
    for (const uid of panelUserIds || []) {
      if (uid) recipientUserIds.add(uid);
    }

    await Promise.allSettled(
      Array.from(recipientUserIds).map((uid) =>
        createUserNotification(uid, {
          category: 'INTERVIEW',
          title: crmTitle,
          description: crmDescription,
          actionLabel: 'Open interview',
          actionPath: `/interviews?interviewId=${interviewId}`,
          entityType: 'INTERVIEW',
          entityId: interviewId,
          metadata: {
            candidateId: candId,
            jobId: jId || null,
            scheduledAt:
              scheduledAt instanceof Date
                ? scheduledAt.toISOString()
                : scheduledAt,
            mode,
            event,
          },
        })
      )
    );

    const portalTitle = isReschedule
      ? 'Interview rescheduled'
      : 'Interview scheduled successfully';
    const portalDescription = isReschedule
      ? `Your interview for ${role} has been moved to ${whenLabel}.`
      : `Your interview for ${role} is scheduled for ${whenLabel}.`;

    const actionPath = jId
      ? await resolvePortalApplicationActionPath(candId, jId)
      : '/applications';

    void pushPortalNotification(candId, {
      type: 'interview',
      title: portalTitle,
      description: portalDescription,
      actionButton: 'View application',
      actionPath,
      metadata: {
        interviewId,
        jobId: jId || null,
        scheduledAt:
          scheduledAt instanceof Date ? scheduledAt.toISOString() : scheduledAt,
        mode,
        meetingLink: meetingLink || null,
        event,
      },
    });
  } catch (error) {
    console.warn(
      '[interviewNotifications] notify failed (non-fatal):',
      error?.message || error
    );
  }
}
