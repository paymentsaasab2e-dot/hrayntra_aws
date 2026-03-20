import { prisma } from '../config/prisma.js';
import { generateMeetingLink } from './meetingService.js';
import {
  sendInterviewCancelled,
  sendInterviewRescheduled,
  sendInterviewScheduled,
} from './notificationService.js';
import { INTERVIEW_ACTIVITY_ACTIONS, logActivity } from '../utils/activityLogger.js';

const interviewInclude = {
  candidate: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      stage: true,
      status: true,
      phone: true,
      location: true,
      currentCompany: true,
      designation: true,
      resume: true,
      skills: true,
      experience: true,
      noticePeriod: true,
      linkedIn: true,
      avatar: true,
    },
  },
  job: {
    select: {
      id: true,
      title: true,
      department: true,
      location: true,
      clientId: true,
    },
  },
  client: {
    select: {
      id: true,
      companyName: true,
      website: true,
      location: true,
      industry: true,
    },
  },
  interviewer: {
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      department: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
    },
  },
  panel: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
          department: true,
          phone: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  feedbackEntries: {
    include: {
      interviewer: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
          department: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  interviewNotes: {
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  activityLogs: {
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
    orderBy: {
      timestamp: 'desc',
    },
  },
};

const buildInterviewDateTime = (dateValue, timeValue) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid interview date');
  }

  if (timeValue) {
    const match = String(timeValue).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let hours = Number(match[1]) % 12;
      const minutes = Number(match[2]);
      const meridiem = match[3].toUpperCase();
      if (meridiem === 'PM') hours += 12;
      date.setUTCHours(hours, minutes, 0, 0);
    }
  }

  return date;
};

const normalizeMode = (value) => {
  if (!value) return null;
  return String(value).toUpperCase();
};

const countKpis = async (baseWhere = {}) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [todayCount, upcomingCount, pendingFeedbackCount, completedCount] = await Promise.all([
    prisma.interview.count({
      where: {
        ...baseWhere,
        scheduledAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.interview.count({
      where: {
        ...baseWhere,
        scheduledAt: { gte: new Date(), lte: weekEnd },
        status: { in: ['SCHEDULED', 'RESCHEDULED', 'CONFIRMED', 'FEEDBACK_PENDING'] },
      },
    }),
    prisma.interview.count({
      where: {
        ...baseWhere,
        OR: [{ status: 'FEEDBACK_PENDING' }, { feedbackEntries: { none: {} } }],
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    }),
    prisma.interview.count({
      where: {
        ...baseWhere,
        status: { in: ['COMPLETED', 'FEEDBACK_SUBMITTED'] },
      },
    }),
  ]);

  return {
    todayCount,
    upcomingCount,
    pendingFeedbackCount,
    completedCount,
  };
};

const getInterviewOrThrow = async (id) => {
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: interviewInclude,
  });

  if (!interview) {
    throw new Error('Interview not found');
  }

  return interview;
};

const getPanelUsers = async (panelUserIds) =>
  prisma.user.findMany({
    where: { id: { in: panelUserIds } },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      department: true,
      phone: true,
    },
  });

const attachMeetingLink = async (interview, platformOverride) => {
  const platform = platformOverride || interview.platform;
  if (interview.mode !== 'ONLINE' || !platform) {
    return { interview, meetingLinkError: null };
  }

  const panelEmails = interview.panel.map((member) => member.user.email).filter(Boolean);
  const candidateName = `${interview.candidate.firstName} ${interview.candidate.lastName}`.trim();

  const meetingResult = await generateMeetingLink(platform, {
    id: interview.id,
    date: interview.scheduledAt,
    duration: interview.duration,
    timezone: interview.timezone || 'UTC',
    candidateName,
    jobTitle: interview.job.title,
    panelEmails,
    notes: interview.notes,
  });

  if (!meetingResult.meetingLink) {
    return { interview, meetingLinkError: meetingResult.error || 'Meeting link generation failed' };
  }

  const updated = await prisma.interview.update({
    where: { id: interview.id },
    data: {
      meetingLink: meetingResult.meetingLink,
      platform,
    },
    include: interviewInclude,
  });

  return { interview: updated, meetingLinkError: null };
};

export const interviewService = {
  interviewInclude,

  async list(query) {
    const {
      page = 1,
      limit = 10,
      status,
      round,
      mode,
      interviewerId,
      candidateId,
      jobId,
      companyId,
      clientId,
      dateFrom,
      dateTo,
      search,
    } = query;

    const where = {};
    const resolvedClientId = companyId || clientId;

    if (status) where.status = status;
    if (round) where.round = round;
    if (mode) where.mode = normalizeMode(mode);
    if (candidateId) where.candidateId = candidateId;
    if (jobId) where.jobId = jobId;
    if (resolvedClientId) where.clientId = resolvedClientId;
    if (interviewerId) {
      where.OR = [{ interviewerId }, { panel: { some: { userId: interviewerId } } }];
    }
    if (dateFrom || dateTo) {
      where.scheduledAt = {};
      if (dateFrom) where.scheduledAt.gte = new Date(dateFrom);
      if (dateTo) where.scheduledAt.lte = new Date(dateTo);
    }
    if (search) {
      where.candidate = {
        is: {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
          ],
        },
      };
    }

    const skip = (page - 1) * limit;

    const [data, total, kpis] = await Promise.all([
      prisma.interview.findMany({
        where,
        skip,
        take: limit,
        include: interviewInclude,
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.interview.count({ where }),
      countKpis(where),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      kpis,
    };
  },

  async getById(id) {
    return getInterviewOrThrow(id);
  },

  async create(payload, user) {
    const clientId = payload.clientId || payload.companyId;
    const [candidate, job, client, panelUsers] = await Promise.all([
      prisma.candidate.findUnique({ where: { id: payload.candidateId } }),
      prisma.job.findUnique({ where: { id: payload.jobId } }),
      prisma.client.findUnique({ where: { id: clientId } }),
      getPanelUsers(payload.panelUserIds),
    ]);

    if (!candidate) throw new Error('Candidate not found');
    if (!job) throw new Error('Job not found');
    if (!client) throw new Error('Client not found');
    if (job.clientId !== client.id) throw new Error('Job does not belong to the provided client');
    if (panelUsers.length !== payload.panelUserIds.length) throw new Error('One or more panel users were not found');

    const scheduledAt = buildInterviewDateTime(payload.date);
    const leadInterviewerId = payload.panelUserIds[0] || null;

    const created = await prisma.$transaction(async (tx) => {
      const interview = await tx.interview.create({
        data: {
          candidateId: candidate.id,
          jobId: job.id,
          clientId: client.id,
          interviewerId: leadInterviewerId,
          createdById: user.id,
          scheduledAt,
          duration: payload.duration,
          round: payload.round,
          type: payload.type,
          mode: normalizeMode(payload.mode),
          platform: payload.meetingPlatform || null,
          timezone: payload.timezone,
          location: payload.mode === 'OFFLINE' ? payload.location || null : null,
          notes: payload.notes || null,
          status: 'SCHEDULED',
          panelIds: payload.panelUserIds,
        },
      });

      if (payload.panelUserIds.length) {
        await tx.interviewPanel.createMany({
          data: payload.panelUserIds.map((userId) => ({
            interviewId: interview.id,
            userId,
            role: payload.panelRoles?.[userId] || 'TECHNICAL',
          })),
        });
      }

      await logActivity(tx, {
        interviewId: interview.id,
        action: INTERVIEW_ACTIVITY_ACTIONS.SCHEDULED,
        userId: user.id,
        metadata: {
          round: payload.round,
          mode: payload.mode,
          date: scheduledAt.toISOString(),
        },
      });

      return tx.interview.findUnique({
        where: { id: interview.id },
        include: interviewInclude,
      });
    });

    let result = created;
    let meetingLinkError = null;

    if (payload.mode === 'ONLINE') {
      const meetingResult = await attachMeetingLink(created, payload.meetingPlatform);
      result = meetingResult.interview;
      meetingLinkError = meetingResult.meetingLinkError;
    }

    if (payload.sendEmailNotification) {
      await sendInterviewScheduled(result.candidate, result, result.panel);
    }

    return {
      ...result,
      meetingLinkError,
    };
  },

  async update(id, payload, user) {
    await getInterviewOrThrow(id);

    const updateData = {};
    if (payload.round !== undefined) updateData.round = payload.round;
    if (payload.type !== undefined) updateData.type = payload.type;
    if (payload.mode !== undefined) updateData.mode = normalizeMode(payload.mode);
    if (payload.date !== undefined) updateData.scheduledAt = buildInterviewDateTime(payload.date);
    if (payload.duration !== undefined) updateData.duration = payload.duration;
    if (payload.timezone !== undefined) updateData.timezone = payload.timezone;
    if (payload.meetingPlatform !== undefined) updateData.platform = payload.meetingPlatform;
    if (payload.location !== undefined) updateData.location = payload.location;
    if (payload.notes !== undefined) updateData.notes = payload.notes;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.panelUserIds !== undefined) {
      updateData.panelIds = payload.panelUserIds;
      updateData.interviewerId = payload.panelUserIds[0] || null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.interview.update({
        where: { id },
        data: updateData,
      });

      if (payload.panelUserIds) {
        await tx.interviewPanel.deleteMany({ where: { interviewId: id } });
        if (payload.panelUserIds.length) {
          await tx.interviewPanel.createMany({
            data: payload.panelUserIds.map((userId) => ({
              interviewId: id,
              userId,
              role: payload.panelRoles?.[userId] || 'TECHNICAL',
            })),
          });
        }
      }

      await logActivity(tx, {
        interviewId: id,
        action: INTERVIEW_ACTIVITY_ACTIONS.STATUS_UPDATED,
        userId: user.id,
        metadata: payload,
      });

      return tx.interview.findUnique({ where: { id }, include: interviewInclude });
    });

    return updated;
  },

  async softDelete(id, user) {
    const interview = await prisma.interview.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: interviewInclude,
    });

    await logActivity(prisma, {
      interviewId: id,
      action: INTERVIEW_ACTIVITY_ACTIONS.CANCELLED,
      userId: user.id,
      metadata: { softDeleted: true },
    });

    return interview;
  },

  async reschedule(id, payload, user) {
    const current = await getInterviewOrThrow(id);
    const nextDate = buildInterviewDateTime(payload.newDate, payload.newTime);

    let updated = await prisma.interview.update({
      where: { id },
      data: {
        scheduledAt: nextDate,
        status: 'RESCHEDULED',
        notes: payload.reason || current.notes,
      },
      include: interviewInclude,
    });

    let meetingLinkError = null;
    if (updated.mode === 'ONLINE' && updated.platform) {
      const meetingResult = await attachMeetingLink(updated, updated.platform);
      updated = meetingResult.interview;
      meetingLinkError = meetingResult.meetingLinkError;
    }

    await logActivity(prisma, {
      interviewId: id,
      action: INTERVIEW_ACTIVITY_ACTIONS.RESCHEDULED,
      userId: user.id,
      metadata: {
        oldDate: current.scheduledAt,
        newDate: nextDate,
        reason: payload.reason,
        meetingLinkError,
      },
    });

    if (payload.notifyCandidate || payload.notifyInterviewer) {
      await sendInterviewRescheduled(
        updated.candidate,
        updated,
        current.scheduledAt,
        updated.panel,
        {
          notifyCandidate: payload.notifyCandidate,
          notifyInterviewer: payload.notifyInterviewer,
        }
      );
    }

    return {
      ...updated,
      meetingLinkError,
    };
  },

  async cancel(id, payload, user) {
    const updated = await prisma.interview.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: payload.notes || payload.reason,
      },
      include: interviewInclude,
    });

    await logActivity(prisma, {
      interviewId: id,
      action: INTERVIEW_ACTIVITY_ACTIONS.CANCELLED,
      userId: user.id,
      metadata: {
        reason: payload.reason,
        notes: payload.notes,
      },
    });

    if (payload.notifyCandidate) {
      await sendInterviewCancelled(updated.candidate, updated);
    }

    return updated;
  },

  async markNoShow(id, payload, user) {
    const updated = await prisma.interview.update({
      where: { id },
      data: {
        status: 'NO_SHOW',
        notes: payload.notes || payload.reason,
      },
      include: interviewInclude,
    });

    await logActivity(prisma, {
      interviewId: id,
      action: INTERVIEW_ACTIVITY_ACTIONS.NO_SHOW_MARKED,
      userId: user.id,
      metadata: payload,
    });

    return updated;
  },

  async addPanelMember(id, payload, user) {
    await getInterviewOrThrow(id);
    const panelMember = await prisma.interviewPanel.create({
      data: {
        interviewId: id,
        userId: payload.userId,
        role: payload.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: true,
            phone: true,
          },
        },
        interview: true,
      },
    });

    const interview = await prisma.interview.findUnique({ where: { id } });
    const nextPanelIds = [...new Set([...(interview?.panelIds || []), payload.userId])];
    await prisma.interview.update({
      where: { id },
      data: {
        panelIds: nextPanelIds,
        interviewerId: interview?.interviewerId || payload.userId,
      },
    });

    await logActivity(prisma, {
      interviewId: id,
      action: INTERVIEW_ACTIVITY_ACTIONS.PANEL_MEMBER_ADDED,
      userId: user.id,
      metadata: {
        panelUserId: payload.userId,
        role: payload.role,
      },
    });

    return panelMember;
  },

  async removePanelMember(interviewId, panelId, user) {
    const existing = await prisma.interviewPanel.findUnique({
      where: { id: panelId },
    });

    if (!existing || existing.interviewId !== interviewId) {
      throw new Error('Panel member not found');
    }

    await prisma.interviewPanel.delete({
      where: { id: panelId },
    });

    const remaining = await prisma.interviewPanel.findMany({
      where: { interviewId },
      select: { userId: true },
    });

    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        panelIds: remaining.map((item) => item.userId),
        interviewerId: remaining[0]?.userId || null,
      },
    });

    await logActivity(prisma, {
      interviewId,
      action: INTERVIEW_ACTIVITY_ACTIONS.PANEL_MEMBER_REMOVED,
      userId: user.id,
      metadata: { panelUserId: existing.userId },
    });

    return { success: true };
  },

  async listNotes(interviewId) {
    return prisma.interviewNote.findMany({
      where: { interviewId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async addNote(interviewId, note, user) {
    const created = await prisma.interviewNote.create({
      data: {
        interviewId,
        authorId: user.id,
        note,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    await logActivity(prisma, {
      interviewId,
      action: INTERVIEW_ACTIVITY_ACTIONS.NOTE_ADDED,
      userId: user.id,
      metadata: { note },
    });

    return created;
  },

  async deleteNote(interviewId, noteId) {
    const note = await prisma.interviewNote.findUnique({ where: { id: noteId } });
    if (!note || note.interviewId !== interviewId) throw new Error('Interview note not found');

    await prisma.interviewNote.delete({ where: { id: noteId } });
    return { success: true };
  },

  async regenerateMeetingLink(interviewId, platform, user) {
    const interview = await getInterviewOrThrow(interviewId);
    const result = await attachMeetingLink(interview, platform);

    await logActivity(prisma, {
      interviewId,
      action: INTERVIEW_ACTIVITY_ACTIONS.MEETING_LINK_REGENERATED,
      userId: user.id,
      metadata: {
        platform,
        error: result.meetingLinkError,
      },
    });

    return {
      meetingLink: result.interview.meetingLink,
      error: result.meetingLinkError,
    };
  },

  async getKpis() {
    const base = await countKpis();
    const [offerCount, feedbackRows] = await Promise.all([
      prisma.placement.count({
        where: {
          status: { in: ['OFFER_ACCEPTED', 'JOINING_SCHEDULED', 'JOINED'] },
        },
      }),
      prisma.interviewFeedback.findMany({
        include: {
          interview: {
            select: {
              scheduledAt: true,
            },
          },
        },
      }),
    ]);

    const avgFeedbackTime =
      feedbackRows.length > 0
        ? Number(
            (
              feedbackRows.reduce((sum, row) => {
                const diffMs = new Date(row.createdAt).getTime() - new Date(row.interview.scheduledAt).getTime();
                return sum + diffMs / (1000 * 60 * 60);
              }, 0) / feedbackRows.length
            ).toFixed(2)
          )
        : 0;

    return {
      ...base,
      conversionRate: base.completedCount ? Number(((offerCount / base.completedCount) * 100).toFixed(2)) : 0,
      avgFeedbackTime,
    };
  },

  async getCalendar(month, year) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    return prisma.interview.findMany({
      where: {
        scheduledAt: {
          gte: start,
          lt: end,
        },
      },
      include: interviewInclude,
      orderBy: {
        scheduledAt: 'asc',
      },
    });
  },
};
