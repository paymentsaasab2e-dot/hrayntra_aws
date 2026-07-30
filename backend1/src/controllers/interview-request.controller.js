const { prisma, retryQuery } = require('../lib/prisma');
const { matchInterviewRequestById } = require('../services/interviewMatching.service');
const { sendInterviewStatusEmail } = require('../services/email.service');

const DEFAULT_DURATION_MINUTES = 45;
const ALLOWED_DURATIONS = new Set([30, 45, 60, 90, 120]);
const ALLOWED_DIFFICULTIES = new Set(['Beginner', 'Intermediate', 'Advanced']);
const ALLOWED_REQUEST_STATUSES = new Set([
  'PENDING_MATCHING',
  'MATCHING',
  'MATCHED',
  'FINDING_INTERVIEWER',
  'WAITING_FOR_ACCEPTANCE',
  'ACCEPTED',
  'REJECTED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
]);

function generateRequestId() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `IR-${y}${m}${d}-${rand}`;
}

function normalizeStatusLabel(status) {
  return String(status || '')
    .toLowerCase()
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function toDateOrNull(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeTextArray(value, limit = 50) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeStatusFilter(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toUpperCase();
  return ALLOWED_REQUEST_STATUSES.has(normalized) ? normalized : '';
}

function normalizeRequestRow(row) {
  const proposalPrefix = 'SLOT_PROPOSAL::';
  const proposedRaw = String(row?.interviewerFeedback || '').startsWith(proposalPrefix)
    ? String(row.interviewerFeedback).slice(proposalPrefix.length).trim()
    : '';
  const proposedSlot = proposedRaw ? proposedRaw.split('||')[0].trim() : null;
  return {
    ...row,
    statusLabel: normalizeStatusLabel(row.status),
    proposedSlot: proposedSlot || null,
  };
}

function normalizeChatMessageRow(row) {
  return {
    id: String(row?.id || ''),
    interviewRequestId: String(row?.interviewRequestId || ''),
    senderCandidateId: String(row?.senderCandidateId || ''),
    senderRole: String(row?.senderRole || ''),
    message: String(row?.message || ''),
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
}

function parseSlotStart(slotValue) {
  const raw = String(slotValue || '').trim();
  if (!raw) return null;

  const dashFormat = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(raw);
  if (dashFormat) {
    const hour = Number(dashFormat[1]);
    const minute = Number(dashFormat[2]);
    if (Number.isFinite(hour) && Number.isFinite(minute)) return { hour, minute };
  }

  const amPmFormat = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)$/i.exec(raw);
  if (amPmFormat) {
    let hour = Number(amPmFormat[1]);
    const minute = Number(amPmFormat[2]);
    const period = String(amPmFormat[3]).toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    if (Number.isFinite(hour) && Number.isFinite(minute)) return { hour, minute };
  }

  return null;
}

function buildScheduledAtFromDateAndSlot(dateValue, slotValue) {
  const date = toDateOrNull(dateValue);
  const slot = parseSlotStart(slotValue);
  if (!date || !slot) return null;
  const scheduled = new Date(date);
  scheduled.setHours(slot.hour, slot.minute, 0, 0);
  return scheduled;
}

function buildFrontendBaseUrl() {
  const raw = String(process.env.FRONTEND_URL || 'http://localhost:3000').trim();
  return raw.replace(/\/$/, '');
}

async function sendScheduledEmailsToParticipants(request, finalSlot) {
  try {
    const candidateId = String(request?.candidateId || '').trim();
    const interviewerId = String(request?.interviewerId || '').trim();
    if (!candidateId || !interviewerId) return;

    const [profiles, candidates] = await Promise.all([
      retryQuery(async () =>
        prisma.candidateProfile.findMany({
          where: { candidateId: { in: [candidateId, interviewerId] } },
          select: { candidateId: true, fullName: true, email: true },
        })
      ),
      retryQuery(async () =>
        prisma.candidate.findMany({
          where: { id: { in: [candidateId, interviewerId] } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      ),
    ]);

    const profileById = new Map(profiles.map((row) => [String(row.candidateId), row]));
    const candidateById = new Map(candidates.map((row) => [String(row.id), row]));

    const candidateProfile = profileById.get(candidateId);
    const interviewerProfile = profileById.get(interviewerId);
    const candidateRow = candidateById.get(candidateId);
    const interviewerRow = candidateById.get(interviewerId);

    const candidateName =
      String(candidateProfile?.fullName || '').trim() ||
      [candidateRow?.firstName, candidateRow?.lastName].filter(Boolean).join(' ').trim() ||
      'Candidate';
    const interviewerName =
      String(interviewerProfile?.fullName || '').trim() ||
      [interviewerRow?.firstName, interviewerRow?.lastName].filter(Boolean).join(' ').trim() ||
      'Interviewer';
    const candidateEmail = String(candidateProfile?.email || candidateRow?.email || '').trim();
    const interviewerEmail = String(interviewerProfile?.email || interviewerRow?.email || '').trim();

    const requestDbId = String(request.id || '').trim();
    const baseUrl = buildFrontendBaseUrl();
    const candidateRoomUrl = `${baseUrl}/en/lms/interview-prep/candidate-room/${encodeURIComponent(requestDbId)}`;
    const interviewerRoomUrl = `${baseUrl}/en/lms/interview-prep/interviewer-room/${encodeURIComponent(requestDbId)}`;

    await Promise.all([
      candidateEmail
        ? sendInterviewStatusEmail({
            toEmail: candidateEmail,
            recipientName: candidateName,
            counterpartName: interviewerName,
            requestId: request.requestId,
            interviewType: request.interviewType,
            scheduledAt: request.scheduledAt,
            slotLabel: finalSlot,
            roomUrl: candidateRoomUrl,
            reminder: false,
          })
        : Promise.resolve(null),
      interviewerEmail
        ? sendInterviewStatusEmail({
            toEmail: interviewerEmail,
            recipientName: interviewerName,
            counterpartName: candidateName,
            requestId: request.requestId,
            interviewType: request.interviewType,
            scheduledAt: request.scheduledAt,
            slotLabel: finalSlot,
            roomUrl: interviewerRoomUrl,
            reminder: false,
          })
        : Promise.resolve(null),
    ]);
  } catch (error) {
    console.warn('[interview] failed to send scheduled emails:', error?.message || error);
  }
}

async function createInterviewRequest(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || req.body?.candidateId || '').trim();
    if (!candidateId) {
      return res.status(401).json({
        success: false,
        message: 'Candidate authentication required',
      });
    }

    const targetRole = String(req.body?.targetRole || '').trim();
    const companyDomain = String(req.body?.companyDomain || '').trim();
    const category = String(req.body?.category || '').trim();
    const techStack = normalizeTextArray(req.body?.techStack);
    const difficulty = String(req.body?.difficulty || '').trim();
    const experience = String(req.body?.experience || '').trim();
    const language = String(req.body?.language || '').trim();
    const interviewType = String(req.body?.interviewType || '').trim();
    const weakAreas = String(req.body?.weakAreas || '').trim();
    const preferredDate = toDateOrNull(req.body?.preferredDate);
    const preferredTime = normalizeTextArray(req.body?.preferredTime, 16);
    const rawDuration = Number(req.body?.duration);
    const duration = Number.isFinite(rawDuration) ? Math.round(rawDuration) : DEFAULT_DURATION_MINUTES;
    const notes = String(req.body?.notes || '').trim();

    if (!targetRole) return res.status(400).json({ success: false, message: 'Target role is required' });
    if (!companyDomain) return res.status(400).json({ success: false, message: 'Company or domain is required' });
    if (!category) return res.status(400).json({ success: false, message: 'Category is required' });
    if (!techStack.length) return res.status(400).json({ success: false, message: 'Select at least one technology' });
    if (!ALLOWED_DIFFICULTIES.has(difficulty)) {
      return res.status(400).json({ success: false, message: 'Difficulty must be Beginner, Intermediate, or Advanced' });
    }
    if (!experience) return res.status(400).json({ success: false, message: 'Experience is required' });
    if (!language) return res.status(400).json({ success: false, message: 'Preferred language is required' });
    if (!interviewType) return res.status(400).json({ success: false, message: 'Interview type is required' });
    if (!weakAreas) return res.status(400).json({ success: false, message: 'Weak areas are required' });
    if (!preferredDate) return res.status(400).json({ success: false, message: 'Preferred date is invalid' });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (preferredDate < startOfToday) {
      return res.status(400).json({ success: false, message: 'Preferred date must be in the future' });
    }
    if (!preferredTime.length) return res.status(400).json({ success: false, message: 'Select at least one preferred time slot' });
    if (!ALLOWED_DURATIONS.has(duration)) {
      return res.status(400).json({ success: false, message: 'Duration must be one of 30, 45, 60, 90, or 120 minutes' });
    }
    if (notes.length > 1000) {
      return res.status(400).json({ success: false, message: 'Additional notes must be 1000 characters or less' });
    }

    const requestId = generateRequestId();
    const created = await retryQuery(async () =>
      prisma.interviewRequest.create({
        data: {
          requestId,
          candidateId,
          targetRole,
          companyDomain,
          category,
          techStack,
          difficulty,
          experience,
          language,
          interviewType,
          weakAreas,
          preferredDate,
          preferredTime,
          duration,
          notes: notes || null,
          status: 'FINDING_INTERVIEWER',
        },
      })
    );

    const matched = await matchInterviewRequestById(created.id);

    await retryQuery(async () =>
      prisma.notification.create({
        data: {
          candidateId,
          type: 'interview',
          title: 'Interview request submitted',
          description: `Request ${requestId} is ${normalizeStatusLabel(matched?.status || created.status)}.`,
          actionButton: 'View Request',
          actionPath: '/lms/interview-prep/request-interview',
          metadata: {
            requestId,
            status: matched?.status || created.status,
          },
        },
      })
    ).catch(() => {});

    const finalRow = matched || created;
    return res.status(201).json({
      success: true,
      message: 'Interview request submitted successfully',
      data: {
        id: finalRow.id,
        requestId: finalRow.requestId,
        status: finalRow.status,
        statusLabel: normalizeStatusLabel(finalRow.status),
        createdAt: finalRow.createdAt,
      },
    });
  } catch (error) {
    console.error('createInterviewRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create interview request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function getMyInterviewRequests(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Candidate authentication required' });
    }

    const statusFilterRaw = normalizeStatusFilter(req.query?.status);
    const where = { candidateId };
    if (statusFilterRaw) where.status = statusFilterRaw;

    const requests = await retryQuery(async () =>
      prisma.interviewRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })
    );

    const interviewerIds = [...new Set(
      requests
        .map((row) => String(row.interviewerId || '').trim())
        .filter(Boolean)
    )];

    const interviewerProfiles = interviewerIds.length
      ? await retryQuery(async () =>
          prisma.candidateProfile.findMany({
            where: { candidateId: { in: interviewerIds } },
            select: { candidateId: true, fullName: true, email: true, phoneNumber: true },
          })
        )
      : [];

    const interviewerProfileById = new Map(
      interviewerProfiles.map((row) => [String(row.candidateId), row])
    );

    return res.json({
      success: true,
      data: requests.map((row) => {
        const normalized = normalizeRequestRow(row);
        const interviewerId = String(row.interviewerId || '').trim();
        return {
          ...normalized,
          interviewerProfile: interviewerId ? interviewerProfileById.get(interviewerId) || null : null,
        };
      }),
    });
  } catch (error) {
    console.error('getMyInterviewRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch interview requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function getMyInterviewRequestSummary(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Candidate authentication required' });
    }

    const rows = await retryQuery(async () =>
      prisma.interviewRequest.findMany({
        where: { candidateId },
        select: { status: true },
      })
    );

    const summary = {
      pendingRequests: 0,
      scheduledInterviews: 0,
      completedInterviews: 0,
      cancelledInterviews: 0,
      total: rows.length,
    };

    for (const row of rows) {
      const status = String(row.status || '').toUpperCase();
      if (
        status === 'PENDING_MATCHING' ||
        status === 'MATCHING' ||
        status === 'MATCHED' ||
        status === 'ACCEPTED' ||
        status === 'FINDING_INTERVIEWER' ||
        status === 'WAITING_FOR_ACCEPTANCE'
      ) {
        summary.pendingRequests += 1;
      } else if (status === 'SCHEDULED' || status === 'IN_PROGRESS') {
        summary.scheduledInterviews += 1;
      } else if (status === 'COMPLETED') {
        summary.completedInterviews += 1;
      } else if (status === 'CANCELLED' || status === 'REJECTED' || status === 'EXPIRED') {
        summary.cancelledInterviews += 1;
      }
    }

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('getMyInterviewRequestSummary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch interview request summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function rematchInterviewRequest(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    const requestId = String(req.params?.requestId || '').trim();
    if (!candidateId || !requestId) {
      return res.status(400).json({ success: false, message: 'Candidate and request ID are required' });
    }

    const request = await retryQuery(async () =>
      prisma.interviewRequest.findUnique({
        where: { id: requestId },
        select: { id: true, candidateId: true, status: true },
      })
    );
    if (!request || String(request.candidateId) !== candidateId) {
      return res.status(404).json({ success: false, message: 'Interview request not found' });
    }

    const matched = await matchInterviewRequestById(requestId);
    if (!matched) {
      return res.status(404).json({ success: false, message: 'Interview request not found' });
    }

    return res.json({
      success: true,
      data: normalizeRequestRow(matched),
    });
  } catch (error) {
    console.error('rematchInterviewRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to rematch interview request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function candidateScheduleDecision(req, res) {
  try {
    const candidateId = String(req.user?.candidateId || '').trim();
    const requestId = String(req.params?.requestId || '').trim();
    const decision = String(req.body?.decision || '').trim().toUpperCase();
    const note = String(req.body?.note || '').trim();
    const slot = String(req.body?.slot || '').trim();
    if (!candidateId || !requestId) {
      return res.status(400).json({ success: false, message: 'Candidate and request ID are required' });
    }
    if (decision !== 'CONFIRM' && decision !== 'REQUEST_NEW_SLOT') {
      return res.status(400).json({ success: false, message: 'Decision must be CONFIRM or REQUEST_NEW_SLOT' });
    }

    const request = await retryQuery(async () =>
      prisma.interviewRequest.findUnique({
        where: { id: requestId },
      })
    );
    if (!request || String(request.candidateId) !== candidateId) {
      return res.status(404).json({ success: false, message: 'Interview request not found' });
    }
    if (String(request.status) !== 'ACCEPTED' && String(request.status) !== 'SCHEDULED') {
      return res.status(400).json({ success: false, message: 'This request is not ready for scheduling actions' });
    }

    if (decision === 'CONFIRM') {
      if (String(request.status) !== 'ACCEPTED') {
        return res.status(400).json({ success: false, message: 'Slot can be confirmed only when awaiting your confirmation' });
      }
      const proposalPrefix = 'SLOT_PROPOSAL::';
      const proposalRaw = String(request.interviewerFeedback || '').startsWith(proposalPrefix)
        ? String(request.interviewerFeedback).slice(proposalPrefix.length).trim()
        : '';
      const proposedSlotFromInterviewer = proposalRaw ? proposalRaw.split('||')[0].trim() : '';
      const finalSlot =
        slot && Array.isArray(request.preferredTime) && request.preferredTime.includes(slot)
          ? slot
          : proposedSlotFromInterviewer || request.preferredTime?.[0] || '';
      if (!finalSlot) {
        return res.status(400).json({ success: false, message: 'Please choose a valid slot to finalize' });
      }

      const updated = await retryQuery(async () =>
        prisma.interviewRequest.update({
          where: { id: request.id },
          data: {
            status: 'SCHEDULED',
            preferredTime: [finalSlot],
            scheduledAt:
              buildScheduledAtFromDateAndSlot(request.preferredDate, finalSlot) ||
              request.scheduledAt ||
              new Date(request.preferredDate),
            candidateFeedback: note || request.candidateFeedback || null,
          },
        })
      );

      if (request.interviewerId) {
        await retryQuery(async () =>
          prisma.notification.create({
            data: {
              candidateId: request.interviewerId,
              type: 'interview',
              title: 'Candidate accepted final slot',
              description: `Request ${request.requestId} has been confirmed for slot ${finalSlot}.`,
              actionButton: 'View interviews',
              actionPath: '/lms/interview-prep/become-interviewer',
              metadata: { requestId: request.requestId, status: 'SCHEDULED', slot: finalSlot },
            },
          })
        ).catch(() => {});
      }

      await sendScheduledEmailsToParticipants(updated, finalSlot);

      return res.json({ success: true, data: normalizeRequestRow(updated) });
    }

    if (String(request.status) !== 'ACCEPTED') {
      return res.status(400).json({ success: false, message: 'You can request a new slot only after interviewer proposal' });
    }

    const updated = await retryQuery(async () =>
      prisma.interviewRequest.update({
        where: { id: request.id },
        data: {
          status: 'WAITING_FOR_ACCEPTANCE',
          scheduledAt: null,
          interviewerFeedback: null,
          candidateFeedback: note || 'Candidate requested a new slot',
        },
      })
    );

    if (request.interviewerId) {
      await retryQuery(async () =>
        prisma.notification.create({
          data: {
            candidateId: request.interviewerId,
            type: 'interview',
            title: 'Candidate requested a new slot',
            description: `Request ${request.requestId}: please propose another timing.`,
            actionButton: 'Update timing',
            actionPath: '/lms/interview-prep/become-interviewer',
            metadata: { requestId: request.requestId, status: 'WAITING_FOR_ACCEPTANCE' },
          },
        })
      ).catch(() => {});
    }

    return res.json({ success: true, data: normalizeRequestRow(updated) });
  } catch (error) {
    console.error('candidateScheduleDecision error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update schedule decision',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function getInterviewRequestChat(req, res) {
  try {
    const actorId = String(req.user?.candidateId || '').trim();
    const requestId = String(req.params?.requestId || '').trim();
    if (!actorId || !requestId) {
      return res.status(400).json({ success: false, message: 'Candidate and request ID are required' });
    }

    const request = await retryQuery(async () =>
      prisma.interviewRequest.findUnique({
        where: { id: requestId },
      })
    );
    if (!request) {
      return res.status(404).json({ success: false, message: 'Interview request not found' });
    }

    const isCandidate = String(request.candidateId) === actorId;
    const isInterviewer = String(request.interviewerId || '') === actorId;
    if (!isCandidate && !isInterviewer) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this chat' });
    }

    const raw = await retryQuery(async () =>
      prisma.$runCommandRaw({
        find: 'interview_request_chats',
        filter: { interviewRequestId: requestId },
        sort: { createdAt: 1 },
        limit: 200,
      })
    );
    const rows = Array.isArray(raw?.cursor?.firstBatch) ? raw.cursor.firstBatch : [];

    return res.json({
      success: true,
      data: rows.map(normalizeChatMessageRow),
    });
  } catch (error) {
    console.error('getInterviewRequestChat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load interview chat',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function postInterviewRequestChat(req, res) {
  try {
    const actorId = String(req.user?.candidateId || '').trim();
    const requestId = String(req.params?.requestId || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!actorId || !requestId) {
      return res.status(400).json({ success: false, message: 'Candidate and request ID are required' });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    if (message.length > 1500) {
      return res.status(400).json({ success: false, message: 'Message must be 1500 characters or less' });
    }

    const request = await retryQuery(async () =>
      prisma.interviewRequest.findUnique({
        where: { id: requestId },
      })
    );
    if (!request) {
      return res.status(404).json({ success: false, message: 'Interview request not found' });
    }

    const isCandidate = String(request.candidateId) === actorId;
    const isInterviewer = String(request.interviewerId || '') === actorId;
    if (!isCandidate && !isInterviewer) {
      return res.status(403).json({ success: false, message: 'Not authorized to post in this chat' });
    }

    // When the same account is both parties (local testing), honor explicit asRole from the room UI.
    const requestedRole = String(req.body?.asRole || req.body?.senderRole || '')
      .trim()
      .toLowerCase();
    let senderRole = 'candidate';
    if (isCandidate && isInterviewer) {
      senderRole = requestedRole === 'interviewer' ? 'interviewer' : 'candidate';
    } else if (isInterviewer) {
      senderRole = 'interviewer';
    } else {
      senderRole = 'candidate';
    }

    const row = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      interviewRequestId: requestId,
      senderCandidateId: actorId,
      senderRole,
      message,
      createdAt: new Date(),
    };

    await retryQuery(async () =>
      prisma.$runCommandRaw({
        insert: 'interview_request_chats',
        documents: [row],
      })
    );

    const notifyTargetId = isCandidate ? String(request.interviewerId || '') : String(request.candidateId || '');
    if (notifyTargetId) {
      await retryQuery(async () =>
        prisma.notification.create({
          data: {
            candidateId: notifyTargetId,
            type: 'interview',
            title: 'New interview chat message',
            description: `New message on ${request.requestId}.`,
            actionButton: 'Open chat',
            actionPath: isCandidate
              ? `/lms/interview-prep/interviewer-room/${requestId}`
              : `/lms/interview-prep/candidate-room/${requestId}`,
            metadata: { requestId: request.requestId, chat: true },
          },
        })
      ).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      data: normalizeChatMessageRow(row),
    });
  } catch (error) {
    console.error('postInterviewRequestChat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to post interview chat message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  createInterviewRequest,
  getMyInterviewRequests,
  getMyInterviewRequestSummary,
  rematchInterviewRequest,
  candidateScheduleDecision,
  getInterviewRequestChat,
  postInterviewRequestChat,
};
