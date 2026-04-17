export const INTERVIEW_ACTIVITY_ACTIONS = {
  SCHEDULED: 'Interview Scheduled',
  RESCHEDULED: 'Interview Rescheduled',
  CANCELLED: 'Interview Cancelled',
  COMPLETED: 'Interview Completed',
  PANEL_MEMBER_ADDED: 'Panel Member Added',
  PANEL_MEMBER_REMOVED: 'Panel Member Removed',
  FEEDBACK_SUBMITTED: 'Feedback Submitted',
  NOTE_ADDED: 'Note Added',
  MEETING_LINK_REGENERATED: 'Meeting Link Regenerated',
  STATUS_UPDATED: 'Status Updated',
  NO_SHOW_MARKED: 'No Show Marked',
};

export async function logActivity(prismaClient, { interviewId, action, userId, metadata }) {
  return prismaClient.interviewActivityLog.create({
    data: {
      interviewId,
      action,
      userId,
      metadata: metadata || undefined,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
  });
}
