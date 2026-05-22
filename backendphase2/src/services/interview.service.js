import { prisma, getActiveTenantDbName, getDefaultPrismaClient, runWithTenantContext } from '../config/prisma.js';
import { getCandidateOrThrow } from '../modules/candidate/candidate.service.js';
import {
  PIPELINE_STAGES,
  syncApplicationOfferLetter,
  updateCandidateStage,
} from '../modules/stage/candidateStage.service.js';
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
import {
  createUserNotification,
  pushPortalNotification,
} from '../modules/notification/notification.service.js';
import {
  buildCvEditorPreviewFromCandidate,
  buildCvEditorPreviewFromSnapshot,
  buildCvSubmissionSnapshot,
  mapSnapshotToClientCandidateFields,
} from '../utils/cvSubmissionSnapshot.js';

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
      cvEducationEntries: true,
      cvWorkExperienceEntries: true,
      extraData: true,
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

export const SUBMISSION_TYPES = [
  'INITIAL_REVIEW',
  'INTERIM_REVIEW',
  'OFFER_CONFIRMATION',
  'GENERAL',
];

// Best-effort guess so the recruiter doesn't have to pick the purpose every
// single time. The drawer also infers a default, but we re-run the logic here
// so older clients (or any caller that doesn't pass `submissionType`) still
// land on a sensible value.
const inferSubmissionType = (interview) => {
  const feedbacks = (interview.feedbackEntries || []).filter(
    (entry) => entry?.recommendation && String(entry.recommendation).trim()
  );
  if (interview.status === 'COMPLETED' && feedbacks.length) {
    const last = feedbacks[feedbacks.length - 1];
    if (last?.recommendation === 'PASS' || last?.recommendation === 'Pass') {
      return 'OFFER_CONFIRMATION';
    }
    return 'INTERIM_REVIEW';
  }
  if (interview.status === 'SCHEDULED' && !feedbacks.length) return 'INITIAL_REVIEW';
  return '';
};

export const normalizeSubmissionType = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  return SUBMISSION_TYPES.includes(upper) ? upper : '';
};

// Token works for either an interview submission or a match submission. We
// keep the JWT `type` constant so the existing public route handles both —
// the resolver branches on whichever ID is present in the payload.
const normalizeCvShareMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  return mode === 'edited' || mode === 'original' ? mode : null;
};

const readCandidateCvShareMode = (candidate) => {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return null;
  return normalizeCvShareMode(extra.cvSubmission?.shareMode);
};

const readCandidateCvSubmissionSnapshot = (candidate) => {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return null;
  const snapshot = extra.cvSubmission?.snapshot;
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : null;
};

async function persistCvSubmissionForCandidate(candidateId, cvShareMode, jobTitle = '') {
  const fresh = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!fresh) return;
  const existingExtra =
    fresh.extraData && typeof fresh.extraData === 'object' && !Array.isArray(fresh.extraData)
      ? fresh.extraData
      : {};
  const snapshot = buildCvSubmissionSnapshot(fresh, jobTitle);
  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      extraData: {
        ...existingExtra,
        cvSubmission: {
          shareMode: cvShareMode,
          updatedAt: new Date().toISOString(),
          snapshot,
        },
      },
    },
  });
}

export const createClientReviewToken = ({
  interviewId = null,
  matchId = null,
  candidateId = null,
  jobId = null,
  clientId = null,
  submissionType = 'GENERAL',
  cvShareMode = null,
} = {}) =>
  jwt.sign(
    {
      interviewId,
      matchId,
      candidateId,
      jobId,
      clientId,
      tenantDbName: getActiveTenantDbName() || undefined,
      submissionType: submissionType || 'GENERAL',
      cvShareMode: normalizeCvShareMode(cvShareMode) || undefined,
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

// Walk the list of known tenant DBs and return the first one that owns the
// given record. Used as a fallback when the JWT didn't capture a tenant
// (older tokens, or service-to-service calls that minted tokens outside a
// tenant context). The lookup is keyed off whichever id is present —
// interviewId for the interview path, matchId for the match path.
const findTenantForRecord = async ({ interviewId = null, matchId = null }) => {
  if (!interviewId && !matchId) return '';
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
    const found = await runWithTenantContext(tenantDbName, async () => {
      if (interviewId) {
        return prisma.interview.findUnique({
          where: { id: interviewId },
          select: { id: true },
        });
      }
      return prisma.match.findUnique({
        where: { id: matchId },
        select: { id: true },
      });
    });
    if (found?.id) return tenantDbName;
  }

  return '';
};

const resolveReviewTenant = async (decoded) => {
  const tokenTenant = String(decoded?.tenantDbName || '').trim();
  if (tokenTenant) return tokenTenant;
  const activeTenant = getActiveTenantDbName();
  if (activeTenant) return activeTenant;
  if (!decoded?.interviewId && !decoded?.matchId) return '';
  return findTenantForRecord({
    interviewId: decoded.interviewId || null,
    matchId: decoded.matchId || null,
  });
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

    // Defensive: legacy tenants can have orphan Interview rows whose jobId/clientId/candidateId
    // point to deleted records. Prisma errors with "Inconsistent query result: Field job is
    // required to return data, got null instead" when including required relations for orphans.
    // We pre-fetch matching IDs and validate the FK targets so the include never sees an orphan.
    const allMatchingIds = await prisma.interview.findMany({
      where: scopedWhere,
      select: { id: true, jobId: true, clientId: true, candidateId: true },
    });

    const requestedJobIds = [...new Set(allMatchingIds.map((row) => row.jobId).filter(Boolean))];
    const requestedClientIds = [...new Set(allMatchingIds.map((row) => row.clientId).filter(Boolean))];
    const requestedCandidateIds = [...new Set(allMatchingIds.map((row) => row.candidateId).filter(Boolean))];

    const [existingJobs, existingClients, existingCandidates] = await Promise.all([
      requestedJobIds.length
        ? prisma.job.findMany({ where: { id: { in: requestedJobIds } }, select: { id: true } })
        : Promise.resolve([]),
      requestedClientIds.length
        ? prisma.client.findMany({ where: { id: { in: requestedClientIds } }, select: { id: true } })
        : Promise.resolve([]),
      requestedCandidateIds.length
        ? prisma.candidate.findMany({ where: { id: { in: requestedCandidateIds } }, select: { id: true } })
        : Promise.resolve([]),
    ]);

    const validJobIds = new Set(existingJobs.map((row) => row.id));
    const validClientIds = new Set(existingClients.map((row) => row.id));
    const validCandidateIds = new Set(existingCandidates.map((row) => row.id));

    const validInterviewIds = allMatchingIds
      .filter(
        (row) =>
          (!row.jobId || validJobIds.has(row.jobId)) &&
          (!row.clientId || validClientIds.has(row.clientId)) &&
          (!row.candidateId || validCandidateIds.has(row.candidateId))
      )
      .map((row) => row.id);

    const finalWhere = { id: { in: validInterviewIds } };

    const [data, total, kpis] = await Promise.all([
      validInterviewIds.length
        ? prisma.interview.findMany({
            where: finalWhere,
            skip,
            take: limit,
            include: interviewInclude,
            orderBy: { scheduledAt: 'asc' },
          })
        : Promise.resolve([]),
      Promise.resolve(validInterviewIds.length),
      countKpis(finalWhere),
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
    // The candidate picker on the CRM merges portal + tenant rows. If the chosen candidate
    // only exists on the portal side, `getCandidateOrThrow` will materialize it into the
    // tenant on demand (same path used by candidate routes) instead of failing with 400.
    const [candidate, job, client, panelUsers] = await Promise.all([
      getCandidateOrThrow(payload.candidateId).catch(() => null),
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

    // Move the candidate to the Interviewing stage on the CRM tenant AND mirror the change
    // to the job-portal application (status → INTERVIEW) and portal candidate row. Without
    // this the candidate keeps showing "Applied" on /candidate and `/applications` even
    // though an interview has been scheduled. updateCandidateStage handles both DBs.
    try {
      const interviewerNames = Array.isArray(result.panel)
        ? result.panel
            .map((member) => {
              const u = member?.user || {};
              return [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
            })
            .filter(Boolean)
        : [];
      await updateCandidateStage({
        candidateId: candidate.id,
        jobId: job.id,
        stage: PIPELINE_STAGES.INTERVIEW,
        performedById: user.id,
        skipStageActivity: true,
        metadata: {
          scheduledAt: scheduledAt.toISOString(),
          type: payload.type,
          mode: payload.mode,
          locationLine: payload.mode === 'OFFLINE' ? payload.location || null : null,
          meetingLink: result.meetingLink || null,
          interviewerNames,
          recruiterName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
        },
      });
      const refreshedAfterStage = await getInterviewWithInclude(result.id);
      if (refreshedAfterStage) {
        result = refreshedAfterStage;
      }
    } catch (stageError) {
      // Stage sync should never block the interview creation. Log and continue so the
      // recruiter still gets the success response and the meeting/email flow runs.
      console.warn(
        '[interview.create] candidate stage sync failed:',
        stageError?.message || stageError,
      );
    }

    if (payload.sendEmailNotification) {
      await sendInterviewScheduled(result.candidate, result, result.panel);
    }

    // Bell notifications for the recruiter who scheduled it + each panel member,
    // and a candidate-facing push into the job portal so the candidate's bell
    // also lights up. All best-effort.
    try {
      const candidateName =
        `${result.candidate?.firstName || ''} ${result.candidate?.lastName || ''}`
          .trim() ||
        result.candidate?.email ||
        'Candidate';
      const jobTitle = result.job?.title || 'a role';
      const whenLabel = scheduledAt.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const recipientUserIds = new Set();
      if (user?.id) recipientUserIds.add(user.id);
      (result.panel || []).forEach((member) => {
        const uid = member?.userId || member?.user?.id;
        if (uid) recipientUserIds.add(uid);
      });

      await Promise.allSettled(
        Array.from(recipientUserIds).map((uid) =>
          createUserNotification(uid, {
            category: 'INTERVIEW',
            title: 'Interview scheduled',
            description: `${candidateName} for ${jobTitle} on ${whenLabel}.`,
            actionLabel: 'Open interview',
            actionPath: `/interviews?interviewId=${result.id}`,
            entityType: 'INTERVIEW',
            entityId: result.id,
            metadata: {
              candidateId: result.candidate?.id || candidate.id,
              jobId: result.job?.id || job.id,
              scheduledAt: scheduledAt.toISOString(),
              mode: payload.mode,
              round: payload.round,
            },
          })
        )
      );

      void pushPortalNotification(candidate.id, {
        type: 'interview',
        title: 'Interview scheduled',
        description: `Your interview for ${jobTitle} is on ${whenLabel}.`,
        actionButton: 'View application',
        actionPath: '/applications',
        metadata: {
          interviewId: result.id,
          jobId: result.job?.id || job.id,
          scheduledAt: scheduledAt.toISOString(),
          mode: payload.mode,
          meetingLink: result.meetingLink || null,
        },
      });
    } catch (notifyErr) {
      console.warn(
        '[interview.create] notification failed (non-fatal):',
        notifyErr?.message || notifyErr
      );
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

    // Same portal→tenant fallback as create() — needed when the recruiter swaps the candidate
    // on an existing interview to one that came from the job portal merged list.
    const [candidate, job, explicitClient, panelUsers] = await Promise.all([
      payload.candidateId
        ? getCandidateOrThrow(nextCandidateId).catch(() => null)
        : Promise.resolve(current.candidate),
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

    try {
      await updateCandidateStage({
        candidateId: updated.candidateId,
        jobId: updated.jobId,
        stage: PIPELINE_STAGES.INTERVIEW,
        performedById: user.id,
        skipStageActivity: true,
        metadata: {
          source: 'interview-rescheduled',
          scheduledAt: nextDate.toISOString(),
        },
      });
    } catch (stageErr) {
      console.warn('[interview.reschedule] stage sync failed:', stageErr?.message || stageErr);
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

    // Force the recruiter to pick a purpose if we can't reasonably infer one.
    // Without this we'd silently default to GENERAL and the public review page
    // would never know to ask for an offer letter.
    const requested = normalizeSubmissionType(payload?.submissionType);
    const inferred = requested ? '' : inferSubmissionType(interview);
    const submissionType = requested || inferred;
    if (!submissionType) {
      throw new Error(
        'Submission purpose is required. Pick one of: INITIAL_REVIEW, INTERIM_REVIEW, OFFER_CONFIRMATION.'
      );
    }

    const cvShareMode =
      normalizeCvShareMode(payload?.cvShareMode) ||
      readCandidateCvShareMode(interview.candidate) ||
      'edited';

    if (cvShareMode) {
      await persistCvSubmissionForCandidate(
        interview.candidateId,
        cvShareMode,
        interview.job?.title || '',
      );
    }

    const token = createClientReviewToken({
      interviewId: interview.id,
      candidateId: interview.candidateId,
      jobId: interview.jobId,
      clientId: interview.clientId,
      submissionType,
      cvShareMode,
    });
    const reviewUrl = `${env.FRONTEND_URL}/client-review/${encodeURIComponent(token)}`;

    const purposeLabel =
      submissionType === 'OFFER_CONFIRMATION'
        ? 'Final clarification — please attach the signed offer letter.'
        : submissionType === 'INTERIM_REVIEW'
          ? 'Mid-cycle review — please confirm next steps.'
          : submissionType === 'INITIAL_REVIEW'
            ? 'Initial review — please confirm the candidate is a fit before scheduling.'
            : 'Please review this candidate.';

    const emailResult = await sendMatchSubmissionEmail({
      to: recipients,
      clientName: interview.client?.companyName || 'Client',
      jobTitle: interview.job?.title || 'Job',
      recruiterName: user?.name || user?.email || 'Recruitment Team',
      message:
        payload?.message ||
        `${purposeLabel} Open the secure review link to respond: ${reviewUrl}`,
      candidates: [mapInterviewCandidateForEmail(interview.candidate)],
      portalUrl: reviewUrl,
      subject: `Interview Candidate Submission: ${interview.job?.title || 'Job'}`,
    });

    if (!emailResult?.success) {
      throw new Error(emailResult?.error || 'Failed to send client submission email');
    }

    // Note the submission on the interview so the activity log + notes section
    // shows what each "Submit to Client" was for. We don't update candidate
    // stage here; that happens once the client actually responds via the
    // public review page.
    try {
      await prisma.interview.update({
        where: { id: interview.id },
        data: {
          notes: `${interview.notes || ''}\n[Submitted to client] ${submissionType.replace(
            /_/g,
            ' '
          )} → ${recipients.join(', ')}`.trim(),
        },
      });
      await logActivity(prisma, {
        interviewId: interview.id,
        action: INTERVIEW_ACTIVITY_ACTIONS.NOTE_ADDED || 'NOTE_ADDED',
        userId: user?.id,
        metadata: {
          channel: 'submit-to-client',
          submissionType,
          recipients,
        },
      });
    } catch (logError) {
      console.warn(
        '[interview.submitToClient] failed to log submission note:',
        logError?.message || logError
      );
    }

    return {
      success: true,
      recipients,
      reviewUrl,
      submissionType,
    };
  },

  async getPublicClientReview(token) {
    const decoded = verifyClientReviewToken(token);
    if (!decoded?.interviewId && !decoded?.matchId) {
      throw new Error('Invalid or expired review link');
    }
    const tenantDbName = await resolveReviewTenant(decoded);
    const submissionType = normalizeSubmissionType(decoded?.submissionType) || 'GENERAL';
    const cvShareMode = normalizeCvShareMode(decoded?.cvShareMode) || 'edited';

    // The two entry points (interview / match) share a response shape so the
    // public review page doesn't need to know which one it came from.
    const { interview, offerLetterFile } = await runWithTenantContext(
      tenantDbName,
      async () => {
        let iv = null;
        if (decoded.interviewId) {
          iv = await getInterviewOrThrow(decoded.interviewId);
        } else {
          // Match-only path: build a synthetic "interview" that the rest of
          // this method can serialize without changing the wire format. We
          // attach any interviews that already exist for the same candidate
          // + job so the client still sees prior feedback on the link.
          const match = await prisma.match.findUnique({
            where: { id: decoded.matchId },
            include: {
              candidate: { select: interviewInclude.candidate.select },
              // Match has no `client` relation — client hangs off `Job`.
              job: {
                select: {
                  ...interviewInclude.job.select,
                  client: { select: interviewInclude.client.select },
                },
              },
            },
          });
          if (!match) throw new Error('Match not found');
          const jobIdForFeedback = match.jobId || match.job?.id || null;
          const priorFeedback = jobIdForFeedback
            ? await prisma.interviewFeedback.findMany({
                where: {
                  interview: {
                    candidateId: match.candidateId,
                    jobId: jobIdForFeedback,
                  },
                },
                include: {
                  interviewer: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
              })
            : [];
          const jobRow = match.job;
          const clientRow = jobRow?.client || {
            id: '',
            companyName: '',
            website: '',
            location: '',
            industry: '',
          };
          iv = {
            id: match.id,
            candidateId: match.candidateId,
            candidate: match.candidate,
            job: jobRow
              ? {
                  id: jobRow.id,
                  title: jobRow.title,
                  department: jobRow.department,
                  location: jobRow.location,
                  clientId: jobRow.clientId,
                }
              : { id: '', title: '', department: null, location: null, clientId: null },
            client: clientRow,
            feedbackEntries: priorFeedback,
            notes: '',
          };
        }

        const offerFile = await prisma.candidateFile.findFirst({
          where: { candidateId: iv.candidateId, fileType: 'Offer' },
          orderBy: { uploadDate: 'desc' },
        });
        return { interview: iv, offerLetterFile: offerFile };
      }
    );
    const c = interview.candidate;
    const submissionSnapshot = readCandidateCvSubmissionSnapshot(c);
    const jobTitle = interview.job?.title || '';

    const baseCandidate = {
      name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      email: c.email || '',
      phone: c.phone || '',
      currentCompany: c.currentCompany || '',
      designation: c.designation || c.currentTitle || '',
      experience: c.experience ?? null,
      skills: c.skills || [],
      languages: c.languages || [],
      education: c.education || '',
      certifications: c.certifications || [],
      cvSummary: c.cvSummary || '',
      cvEducationEntries: Array.isArray(c.cvEducationEntries) ? c.cvEducationEntries : [],
      cvWorkExperienceEntries: Array.isArray(c.cvWorkExperienceEntries) ? c.cvWorkExperienceEntries : [],
      address: c.address || '',
      city: c.city || '',
      country: c.country || '',
      linkedIn: c.linkedIn || '',
      resume: c.resume || c.resumeUrl || '',
    };

    const editedFromSnapshot = mapSnapshotToClientCandidateFields(submissionSnapshot);
    const candidateForClient =
      cvShareMode === 'original'
        ? {
            ...baseCandidate,
            cvSummary: '',
            cvEducationEntries: [],
            cvWorkExperienceEntries: [],
            skills: [],
            languages: [],
            education: '',
            certifications: [],
          }
        : editedFromSnapshot
          ? { ...baseCandidate, ...editedFromSnapshot, resume: '' }
          : { ...baseCandidate, resume: '' };

    const cvEditorPreview =
      cvShareMode === 'edited'
        ? submissionSnapshot
          ? buildCvEditorPreviewFromSnapshot(submissionSnapshot, jobTitle)
          : buildCvEditorPreviewFromCandidate(c, jobTitle)
        : null;

    const sharedResumeUrl = String(
      submissionSnapshot?.resume || c.resume || c.resumeUrl || '',
    ).trim();

    return {
      interviewId: interview.id,
      submissionType,
      cvShareMode,
      offerLetterUrl: offerLetterFile?.fileUrl || null,
      candidate: candidateForClient,
      cvEditorPreview,
      sharedResumeUrl: sharedResumeUrl.startsWith('http') ? sharedResumeUrl : null,
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

  async submitPublicClientTag(token, payload, file = null) {
    const decoded = verifyClientReviewToken(token);
    if (!decoded?.interviewId && !decoded?.matchId) {
      throw new Error('Invalid or expired review link');
    }

    const tag = String(payload?.tag || '').trim();
    const comments = String(payload?.comments || '').trim();
    const submissionType = normalizeSubmissionType(decoded?.submissionType) || 'GENERAL';

    // For OFFER_CONFIRMATION the only meaningful action from the client is the
    // signed offer letter, so we let them submit just the file (no tag). For
    // every other purpose we still require a tag — the recruiter explicitly
    // asked for a decision.
    if (!tag && !file) {
      throw new Error(
        submissionType === 'OFFER_CONFIRMATION'
          ? 'Please attach the offer letter or pick a decision'
          : 'Tag is required'
      );
    }

    const tenantDbName = await resolveReviewTenant(decoded);
    const result = await runWithTenantContext(tenantDbName, async () => {
      // Resolve whichever entity owns this token. The match path has no
      // interview row to update, so we keep the activity trail on the match
      // record + candidate file instead.
      let interview = null;
      let match = null;
      let candidateId;
      let jobId;
      let uploaderId = null;
      if (decoded.interviewId) {
        interview = await getInterviewOrThrow(decoded.interviewId);
        candidateId = interview.candidateId;
        jobId = interview.jobId;
        uploaderId = interview.createdById || interview.interviewerId || null;
      } else {
        match = await prisma.match.findUnique({
          where: { id: decoded.matchId },
          select: { id: true, candidateId: true, jobId: true, createdById: true },
        });
        if (!match) throw new Error('Match not found');
        candidateId = match.candidateId;
        jobId = match.jobId;
        uploaderId = match.createdById || null;
      }

      let offerLetterUrl = null;
      let placementOfferAttached = false;
      if (file) {
        const fileUrl = `/uploads/interview-client-review/${file.filename}`;
        // Tag the candidate file based on what stage of the funnel produced
        // it. Offer-confirmation uploads go in as 'Offer' so the Placements
        // tab can pick them up; everything else lands as a generic 'Other'
        // attachment that still appears on the candidate Documents tab.
        const candidateFileType =
          submissionType === 'OFFER_CONFIRMATION' ? 'Offer' : 'Other';

        // CandidateFile.uploadedById is required by the schema. The public
        // endpoint has no auth context, so we fall back through a few
        // reasonable owners before giving up. We never want a missing user
        // FK to swallow the upload silently — the activity log + placement
        // attach still need to run, but the file itself is the most useful
        // artefact, so we try hard to persist it.
        let candidateFileUploaderId = uploaderId;
        if (!candidateFileUploaderId) {
          try {
            const candidate = await prisma.candidate.findUnique({
              where: { id: candidateId },
              select: { assignedToId: true, createdById: true },
            });
            candidateFileUploaderId =
              candidate?.assignedToId || candidate?.createdById || null;
          } catch (lookupError) {
            console.warn(
              '[interview.submitPublicClientTag] candidate uploader lookup failed:',
              lookupError?.message || lookupError
            );
          }
        }
        if (candidateFileUploaderId) {
          try {
            await prisma.candidateFile.create({
              data: {
                candidateId,
                fileName: file.originalname || file.filename,
                fileType: candidateFileType,
                fileUrl,
                uploadedById: candidateFileUploaderId,
              },
            });
          } catch (candidateFileError) {
            console.warn(
              '[interview.submitPublicClientTag] candidate file persist failed:',
              candidateFileError?.message || candidateFileError
            );
          }
        }
        offerLetterUrl = fileUrl;

        // Only OFFER_CONFIRMATION uploads should attach to a placement —
        // earlier-stage submissions are review attachments, not the signed
        // offer. We still keep the candidate-file row so recruiters can see
        // the document on the candidate Documents tab regardless.
        if (submissionType === 'OFFER_CONFIRMATION') {
          try {
            const placement = await prisma.placement.findFirst({
              where: {
                candidateId,
                jobId,
                deletedAt: null,
              },
              orderBy: { createdAt: 'desc' },
              select: { id: true },
            });
            if (placement?.id) {
              // No native unique on (placementId, documentType); emulate
              // "replace" so the most recent client upload wins and the
              // Placements list reads exactly one OFFER_LETTER row.
              await prisma.placementDocument.deleteMany({
                where: { placementId: placement.id, documentType: 'OFFER_LETTER' },
              });
              await prisma.placementDocument.create({
                data: {
                  placementId: placement.id,
                  documentType: 'OFFER_LETTER',
                  fileUrl,
                  fileName: file.originalname || file.filename,
                  uploadedBy: candidateFileUploaderId || undefined,
                },
              });
              placementOfferAttached = true;
            }
          } catch (placementError) {
            console.warn(
              '[interview.submitPublicClientTag] placement document attach failed:',
              placementError?.message || placementError
            );
          }
        }
      }

      const noteParts = [];
      if (tag) noteParts.push(`[Client Tag] ${tag}${comments ? ` - ${comments}` : ''}`);
      if (file) {
        const uploadLabel =
          submissionType === 'OFFER_CONFIRMATION' ? 'Offer letter received' : 'Document received';
        noteParts.push(`[Client Upload] ${uploadLabel}: ${file.originalname || file.filename}`);
      }
      const noteAppend = noteParts.length ? `\n${noteParts.join('\n')}` : '';

      let updatedRecordId = null;
      if (interview) {
        const updated = await prisma.interview.update({
          where: { id: interview.id },
          data: {
            notes: `${interview.notes || ''}${noteAppend}`.trim(),
          },
          include: interviewInclude,
        });
        updatedRecordId = updated.id;
      } else if (match) {
        // Match-only flow: log the client's response as a candidate activity
        // so it surfaces in the matches view + candidate timeline.
        try {
          await prisma.activity.create({
            data: {
              action: file
                ? submissionType === 'OFFER_CONFIRMATION'
                  ? 'Client uploaded offer letter'
                  : 'Client uploaded review document'
                : 'Client review submitted',
              description: noteParts.join(' | ') || `Tag: ${tag}`,
              performedById: uploaderId || undefined,
              entityType: 'CANDIDATE',
              entityId: candidateId,
              category: 'Candidates',
              relatedType: 'job',
              relatedId: jobId,
              metadata: {
                kind: 'match-client-review',
                matchId: match.id,
                submissionType,
                tag,
                comments: comments || null,
                offerLetterUrl,
              },
            },
          });
        } catch (activityError) {
          console.warn(
            '[interview.submitPublicClientTag] match activity log failed:',
            activityError?.message || activityError
          );
        }
        updatedRecordId = match.id;
      }

      // For final-offer submissions we also push the candidate to the OFFER
      // pipeline bucket so the CRM + portal stay in sync without a second
      // manual click. We swallow errors so a flaky portal call never blocks
      // the client-side response.
      if (submissionType === 'OFFER_CONFIRMATION' && file) {
        try {
          await updateCandidateStage({
            candidateId,
            jobId,
            stage: PIPELINE_STAGES.OFFER,
            performedById: uploaderId,
            skipStageActivity: true,
            metadata: {
              source: 'client-review',
              tag: tag || null,
              offerLetterUrl,
              matchId: match?.id || null,
              interviewId: interview?.id || null,
            },
          });
        } catch (stageError) {
          console.warn(
            '[interview.submitPublicClientTag] candidate stage sync failed:',
            stageError?.message || stageError
          );
        }
        // Mirror the offer letter onto the candidate's portal Application so
        // they get a "View / Download offer letter" button on the
        // job-portal `/applications/[id]` page right after the client
        // submits the signed PDF — even before the recruiter creates the
        // Placement record on the CRM side.
        try {
          await syncApplicationOfferLetter(candidateId, jobId, {
            fileUrl: offerLetterUrl,
            fileName: file.originalname || file.filename,
          });
        } catch (offerSyncError) {
          console.warn(
            '[interview.submitPublicClientTag] portal offer letter sync failed:',
            offerSyncError?.message || offerSyncError
          );
        }
      }

      return { updatedRecordId, offerLetterUrl, placementOfferAttached };
    });

    return {
      success: true,
      tag,
      interviewId: result.updatedRecordId,
      offerLetterUrl: result.offerLetterUrl,
      placementOfferAttached: result.placementOfferAttached,
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
