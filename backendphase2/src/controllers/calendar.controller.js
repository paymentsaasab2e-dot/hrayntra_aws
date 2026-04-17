import { prisma } from '../config/prisma.js';
import { sendError, sendResponse } from '../utils/response.js';

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseDateTime(dateValue, timeValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  if (!timeValue) return date;

  const match = String(timeValue).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return date;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  date.setHours(hours, minutes, 0, 0);
  return date;
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const calendarController = {
  async getUnifiedCalendar(req, res) {
    try {
      const now = new Date();
      const requestedStart = req.query.start ? new Date(req.query.start) : startOfMonth(now);
      const requestedEnd = req.query.end ? new Date(req.query.end) : endOfMonth(now);

      if (Number.isNaN(requestedStart.getTime()) || Number.isNaN(requestedEnd.getTime())) {
        return sendError(res, 400, 'Invalid calendar date range');
      }

      const rangeStart = startOfDay(requestedStart);
      const rangeEnd = endOfDay(requestedEnd);

      if (rangeStart > rangeEnd) {
        return sendError(res, 400, 'Calendar start date must be before end date');
      }

      const mineOnly = req.query.mineOnly !== 'false';
      const userId = req.user?.id;

      const ownedFilter = mineOnly && userId
        ? {
            OR: [
              { createdById: userId },
              { assignedToId: userId },
            ],
          }
        : {};

      const [jobs, tasks, interviews, meetings, followUps] = await Promise.all([
        prisma.job.findMany({
          where: {
            AND: [
              {
                OR: [
                  { createdAt: { gte: rangeStart, lte: rangeEnd } },
                  { postedDate: { gte: rangeStart, lte: rangeEnd } },
                ],
              },
              ownedFilter,
            ],
          },
          include: {
            client: { select: { id: true, companyName: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ createdAt: 'asc' }, { postedDate: 'asc' }],
        }),
        prisma.task.findMany({
          where: {
            AND: [
              { dueDate: { gte: rangeStart, lte: rangeEnd } },
              ownedFilter,
            ],
          },
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { dueDate: 'asc' },
        }),
        prisma.interview.findMany({
          where: {
            AND: [
              { scheduledAt: { gte: rangeStart, lte: rangeEnd } },
              mineOnly && userId
                ? {
                    OR: [
                      { createdById: userId },
                      { interviewerId: userId },
                      { panelIds: { has: userId } },
                    ],
                  }
                : {},
            ],
          },
          include: {
            candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
            client: { select: { id: true, companyName: true } },
            job: { select: { id: true, title: true } },
            interviewer: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { scheduledAt: 'asc' },
        }),
        prisma.scheduledMeeting.findMany({
          where: {
            AND: [
              { scheduledAt: { gte: rangeStart, lte: rangeEnd } },
              mineOnly && userId
                ? {
                    OR: [
                      { scheduledById: userId },
                      { client: { is: { assignedToId: userId } } },
                    ],
                  }
                : {},
            ],
          },
          include: {
            client: { select: { id: true, companyName: true, assignedToId: true } },
            scheduledBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { scheduledAt: 'asc' },
        }),
        prisma.client.findMany({
          where: {
            AND: [
              { nextFollowUpDue: { gte: rangeStart, lte: rangeEnd } },
              mineOnly && userId ? { assignedToId: userId } : {},
            ],
          },
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
          },
          orderBy: { nextFollowUpDue: 'asc' },
        }),
      ]);

      const events = [
        ...jobs.map((job) => {
          const eventDate = safeDate(job.createdAt) || safeDate(job.postedDate);
          return {
            id: `job-${job.id}`,
            type: 'JOB_CREATED',
            entityType: 'job',
            entityId: job.id,
            title: job.title,
            subtitle: job.client?.companyName || 'Job created',
            start: eventDate?.toISOString() || new Date().toISOString(),
            end: null,
            allDay: false,
            status: job.status,
            priority: job.priority || null,
            color: 'sky',
            route: `/job`,
            description: job.description || null,
            metadata: {
              category: 'Job Created',
              clientName: job.client?.companyName || null,
              createdByName: job.createdBy?.name || null,
              assignedToName: job.assignedTo?.name || null,
              location: job.location || null,
              workMode: job.workMode || null,
              openings: job.openings || null,
            },
          };
        }),
        ...tasks.map((task) => {
          const start = parseDateTime(task.dueDate, task.dueTime);
          return {
            id: `task-${task.id}`,
            type: 'TASK',
            entityType: 'task',
            entityId: task.id,
            title: task.title,
            subtitle: task.taskType || 'Task',
            start: (start || task.dueDate).toISOString(),
            end: null,
            allDay: !task.dueTime,
            status: task.status,
            priority: task.priority,
            color: 'amber',
            route: `/Task&Activites`,
            description: task.description || null,
            metadata: {
              category: 'Task',
              taskType: task.taskType || null,
              linkedEntityType: task.linkedEntityType || null,
              linkedEntityId: task.linkedEntityId || null,
              assignedToName: task.assignedTo?.name || null,
              createdByName: task.createdBy?.name || null,
              reminder: task.reminder || null,
              reminderChannel: task.reminderChannel || null,
              dueTime: task.dueTime || null,
            },
          };
        }),
        ...interviews.map((interview) => {
          const candidateName = [interview.candidate?.firstName, interview.candidate?.lastName].filter(Boolean).join(' ').trim();
          return {
            id: `interview-${interview.id}`,
            type: 'INTERVIEW',
            entityType: 'interview',
            entityId: interview.id,
            title: candidateName || interview.job?.title || 'Interview',
            subtitle: interview.job?.title || interview.round || 'Interview',
            start: interview.scheduledAt.toISOString(),
            end: new Date(interview.scheduledAt.getTime() + (interview.duration || 60) * 60000).toISOString(),
            allDay: false,
            status: interview.status,
            priority: null,
            color: 'violet',
            route: `/interviews`,
            description: interview.notes || null,
            metadata: {
              category: 'Interview',
              candidateName: candidateName || null,
              candidateEmail: interview.candidate?.email || null,
              clientName: interview.client?.companyName || null,
              jobTitle: interview.job?.title || null,
              interviewerName: interview.interviewer?.name || null,
              createdByName: interview.createdBy?.name || null,
              round: interview.round || null,
              duration: interview.duration || null,
              platform: interview.platform || null,
              meetingLink: interview.meetingLink || null,
              mode: interview.mode || null,
              location: interview.location || null,
              timezone: interview.timezone || null,
            },
          };
        }),
        ...meetings.map((meeting) => ({
          id: `meeting-${meeting.id}`,
          type: 'CLIENT_MEETING',
          entityType: 'meeting',
          entityId: meeting.id,
          title: `${meeting.meetingType} with ${meeting.client?.companyName || 'Client'}`,
          subtitle: meeting.client?.companyName || 'Client meeting',
          start: meeting.scheduledAt.toISOString(),
          end: null,
          allDay: false,
          status: meeting.status,
          priority: null,
          color: 'emerald',
          route: `/client`,
          description: meeting.notes || null,
          metadata: {
            category: 'Client Meeting',
            clientName: meeting.client?.companyName || null,
            meetingType: meeting.meetingType || null,
            scheduledByName: meeting.scheduledBy?.name || null,
            reminder: meeting.reminder || null,
          },
        })),
        ...followUps.map((client) => ({
          id: `followup-${client.id}`,
          type: 'CLIENT_FOLLOW_UP',
          entityType: 'client',
          entityId: client.id,
          title: `Follow up with ${client.companyName}`,
          subtitle: client.companyName,
          start: client.nextFollowUpDue.toISOString(),
          end: null,
          allDay: false,
          status: client.status,
          priority: client.priority || null,
          color: 'rose',
          route: `/client`,
          description: null,
          metadata: {
            category: 'Client Follow-up',
            clientName: client.companyName,
            healthStatus: client.healthStatus || null,
            sla: client.sla || null,
            priority: client.priority || null,
            assignedToName: client.assignedTo?.name || null,
            location: client.location || null,
          },
        })),
      ]
        .filter((event) => Boolean(event.start))
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      return sendResponse(res, 200, 'Unified calendar retrieved successfully', {
        range: {
          start: rangeStart.toISOString(),
          end: rangeEnd.toISOString(),
        },
        summary: {
          total: events.length,
          jobs: jobs.length,
          tasks: tasks.length,
          interviews: interviews.length,
          meetings: meetings.length,
          followUps: followUps.length,
        },
        events,
      });
    } catch (error) {
      return sendError(res, 500, 'Failed to retrieve unified calendar', error);
    }
  },
};
