import { prisma, getActiveTenantDbName, getDefaultPrismaClient, runWithTenantContext } from '../config/prisma.js';
import { generateMeetingLink } from './meetingService.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendMatchSubmissionEmail } from '../emails/email.service.js';
import {
  sendInterviewCancelled,
  sendInterviewRescheduled,
  sendInterviewScheduled,
} from './notificationService.js';
import { INTERVIEW_ACTIVITY_ACTIONS, logActivity } from '../utils/activityLogger.js';
import { canViewAllAssignments } from '../utils/permissionScope.js';

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
      cvSummary: true,
      education: true,
      languages: true,
      certifications: true,
      address: true,
      city: true,
      country: true,
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
        status: { in: ['COMPLETED', 'FEEDBACK_PENDING'] },
        OR: [{ status: 'FEEDBACK_PENDING' }, { feedbackEntries: { none: {} } }],
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

const getInterviewWithInclude = async (id) =>
  prisma.interview.findUnique({
    where: { id },
    include: interviewInclude,
  });

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

const getClientRecipients = async (clientId) => {
  const contacts = await prisma.contact.findMany({
    where: {
      companyId: clientId,
      contactType: 'CLIENT',
      email: { not: null },
    },
    select: { email: true },
    orderBy: { createdAt: 'asc' },
  });
  return Array.from(new Set(contacts.map((c) => String(c.email || '').trim()).filter(Boolean)));
};

const mapInterviewCandidateForEmail = (candidate) => ({
  name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Candidate',
  email: candidate.email || '',
  phone: candidate.phone || '',
  currentTitle: candidate.designation || '',
  currentCompany: candidate.currentCompany || '',
  experience: candidate.experience ?? '',
  location: candidate.location || '',
  skills: Array.isArray(candidate.skills) ? candidate.skills : [],
  noticePeriod: candidate.noticePeriod || '',
  resumeName: candidate.resume || '',
});

const createClientReviewToken = (interview) =>
  jwt.sign(
    {
      interviewId: interview.id,
      candidateId: interview.candidateId,
      clientId: interview.clientId,
      tenantDbName: getActiveTenantDbName() || undefined,
      type: 'INTERVIEW_CLIENT_REVIEW',
    },
    env.JWT_SECRET,
    { expiresIn: '14d' }
  );

const verifyClientReviewToken = (token) => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (!decoded || decoded.type !== 'INTERVIEW_CLIENT_REVIEW') return null;
    return decoded;
  } catch {
    return null;
  }
};

const findTenantForInterview = async (interviewId) => {
  const defaultPrisma = getDefaultPrismaClient();
  const tenantRows = await defaultPrisma.user.findMany({
    where: { tenantDbName: { not: null } },
    select: { tenantDbName: true },
  });
  const tenantNames = Array.from(
    new Set(
      tenantRows
        .map((row) => String(row.tenantDbName || '').trim())
        .filter(Boolean)
    )
  );

  for (const tenantDbName of tenantNames) {
    const found = await runWithTenantContext(tenantDbName, async () =>
      prisma.interview.findUnique({
        where: { id: interviewId },
        select: { id: true },
      })
    );
    if (found?.id) return tenantDbName;
  }

  return '';
};

const resolveReviewTenant = async (decoded) => {
  const tokenTenant = String(decoded?.tenantDbName || '').trim();
  if (tokenTenant) return tokenTenant;
  const activeTenant = getActiveTenantDbName();
  if (activeTenant) return activeTenant;
  if (!decoded?.interviewId) return '';
  return findTenantForInterview(decoded.interviewId);
};

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

const buildInterviewAssignmentScope = (req) => {
  if (canViewAllAssignments(req) || !req?.user?.id) return null;
  return {
    OR: [
      { interviewerId: req.user.id },
      { createdById: req.user.id },
      { panel: { some: { userId: req.user.id } } },
    ],
  };
};

export const interviewService = {
  interviewInclude,

  async list(query, req = null) {
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

    const assignmentScope = buildInterviewAssignmentScope(req);
    const scopedWhere = assignmentScope ? { AND: [where, assignmentScope] } : where;

    const skip = (page - 1) * limit;

    const [data, total, kpis] = await Promise.all([
      prisma.interview.findMany({
        where: scopedWhere,
        skip,
        take: limit,
        include: interviewInclude,
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.interview.count({ where: scopedWhere }),
      countKpis(scopedWhere),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      kpis,
    };
  },

  async getById(id, req = null) {
    const assignmentScope = buildInterviewAssignmentScope(req);
    const interview = await prisma.interview.findFirst({
      where: assignmentScope ? { AND: [{ id }, assignmentScope] } : { id },
      include: interviewInclude,
    });
    if (!interview) {
      throw new Error('Interview not found');
    }
    return interview;
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

      return { id: interview.id };
    });

    let result = await getInterviewWithInclude(created.id);
    if (!result) {
      throw new Error('Interview not found after creation');
    }
    let meetingLinkError = null;

    if (payload.mode === 'ONLINE') {
      const meetingResult = await attachMeetingLink(result, payload.meetingPlatform);
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
    const current = await getInterviewOrThrow(id);

    const nextCandidateId = payload.candidateId || current.candidate.id;
    const nextJobId = payload.jobId || current.job.id;

    const [candidate, job, explicitClient, panelUsers] = await Promise.all([
      payload.candidateId ? prisma.candidate.findUnique({ where: { id: nextCandidateId } }) : Promise.resolve(current.candidate),
      payload.jobId ? prisma.job.findUnique({ where: { id: nextJobId } }) : Promise.resolve(current.job),
      payload.clientId ? prisma.client.findUnique({ where: { id: payload.clientId } }) : Promise.resolve(null),
      payload.panelUserIds ? getPanelUsers(payload.panelUserIds) : Promise.resolve(current.panel.map((member) => member.user)),
    ]);

    const client = payload.clientId
      ? explicitClient
      : payload.jobId
        ? await prisma.client.findUnique({ where: { id: job.clientId } })
        : current.client;

    if (payload.candidateId && !candidate) throw new Error('Candidate not found');
    if (payload.jobId && !job) throw new Error('Job not found');
    if (payload.clientId && !client) throw new Error('Client not found');
    if (job.clientId !== client.id) throw new Error('Job does not belong to the provided client');
    if (payload.panelUserIds && panelUsers.length !== payload.panelUserIds.length) {
      throw new Error('One or more panel users were not found');
    }

    const nextClientId = client.id;

    const updateData = {};
    if (payload.candidateId !== undefined) updateData.candidateId = nextCandidateId;
    if (payload.jobId !== undefined) updateData.jobId = nextJobId;
    if (payload.clientId !== undefined || payload.jobId !== undefined) updateData.clientId = nextClientId;
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

      return { id };
    });

    const refreshed = await getInterviewWithInclude(updated.id);
    if (!refreshed) {
      throw new Error('Interview not found after update');
    }
    return refreshed;
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

  async submitToClient(interviewId, payload, user) {
    const interview = await getInterviewOrThrow(interviewId);
    const recipients = payload?.toEmail
      ? [String(payload.toEmail).trim()].filter(Boolean)
      : await getClientRecipients(interview.clientId);

    if (!recipients.length) {
      throw new Error('No client email found for this interview/client');
    }

    const token = createClientReviewToken(interview);
    const reviewUrl = `${env.FRONTEND_URL}/client-review/${encodeURIComponent(token)}`;

    const emailResult = await sendMatchSubmissionEmail({
      to: recipients,
      clientName: interview.client?.companyName || 'Client',
      jobTitle: interview.job?.title || 'Job',
      recruiterName: user?.name || user?.email || 'Recruitment Team',
      message: payload?.message || `Please review this candidate using the secure link: ${reviewUrl}`,
      candidates: [mapInterviewCandidateForEmail(interview.candidate)],
      portalUrl: reviewUrl,
      subject: `Interview Candidate Submission: ${interview.job?.title || 'Job'}`,
    });

    if (!emailResult?.success) {
      throw new Error(emailResult?.error || 'Failed to send client submission email');
    }

    return {
      success: true,
      recipients,
      reviewUrl,
    };
  },

  async getPublicClientReview(token) {
    const decoded = verifyClientReviewToken(token);
    if (!decoded?.interviewId) throw new Error('Invalid or expired review link');
    const tenantDbName = await resolveReviewTenant(decoded);
    const interview = await runWithTenantContext(tenantDbName, async () =>
      getInterviewOrThrow(decoded.interviewId)
    );
    return {
      interviewId: interview.id,
      candidate: {
        name: `${interview.candidate.firstName || ''} ${interview.candidate.lastName || ''}`.trim(),
        email: interview.candidate.email || '',
        phone: interview.candidate.phone || '',
        currentCompany: interview.candidate.currentCompany || '',
        designation: interview.candidate.designation || '',
        experience: interview.candidate.experience ?? null,
        skills: interview.candidate.skills || [],
        languages: interview.candidate.languages || [],
        education: interview.candidate.education || '',
        certifications: interview.candidate.certifications || [],
        cvSummary: interview.candidate.cvSummary || '',
        address: interview.candidate.address || '',
        city: interview.candidate.city || '',
        country: interview.candidate.country || '',
        linkedIn: interview.candidate.linkedIn || '',
        resume: interview.candidate.resume || '',
      },
      job: {
        title: interview.job.title || '',
      },
      client: {
        companyName: interview.client.companyName || '',
      },
      interviewFeedback: (interview.feedbackEntries || []).map((entry) => ({
        id: entry.id,
        interviewerName: entry.interviewer?.name || 'Interviewer',
        submittedAt: entry.createdAt,
        recommendation: entry.recommendation || '',
        comments: entry.comments || '',
        strengths: entry.strengths || '',
        weakness: entry.weakness || '',
        overallScore: entry.overallScore ?? null,
      })),
    };
  },

  async submitPublicClientTag(token, payload) {
    const decoded = verifyClientReviewToken(token);
    if (!decoded?.interviewId) throw new Error('Invalid or expired review link');

    const tag = String(payload?.tag || '').trim();
    if (!tag) throw new Error('Tag is required');
    const comments = String(payload?.comments || '').trim();

    const tenantDbName = await resolveReviewTenant(decoded);
    const updated = await runWithTenantContext(tenantDbName, async () => {
      const interview = await getInterviewOrThrow(decoded.interviewId);
      const noteAppend = `\n[Client Tag] ${tag}${comments ? ` - ${comments}` : ''}`;
      return prisma.interview.update({
        where: { id: interview.id },
        data: {
          notes: `${interview.notes || ''}${noteAppend}`.trim(),
        },
        include: interviewInclude,
      });
    });

    return {
      success: true,
      tag,
      interviewId: updated.id,
    };
  },

  async getKpis(req = null) {
    const assignmentScope = buildInterviewAssignmentScope(req);
    const base = await countKpis(assignmentScope || {});
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

  async getCalendar(month, year, req = null) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const assignmentScope = buildInterviewAssignmentScope(req);

    return prisma.interview.findMany({
      where: assignmentScope
        ? {
            AND: [
              {
                scheduledAt: {
                  gte: start,
                  lt: end,
                },
              },
              assignmentScope,
            ],
          }
        : {
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
