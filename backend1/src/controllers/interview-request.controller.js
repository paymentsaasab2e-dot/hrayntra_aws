const { prisma, retryQuery } = require('../lib/prisma');
const { matchInterviewRequestById } = require('../services/interviewMatching.service');
const { sendInterviewStatusEmail } = require('../services/email.service');
const {
  clampInterviewPrice,
  holdInterviewPayment,
  releaseInterviewerEarnings,
} = require('../services/interviewTokenBooking.service');
const tokenService = require('../services/token.service');
const { getLiveBundle, getLiveBundleByRequestId, findRequestForLiveRoom } = require('../services/interviewLive.service');
const { mergePreferredSlot, encodeSlotProposal, decodeSlotProposal, assertFutureBookingDate } = require('../utils/interviewSlot.util');

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
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }
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
  const fromInterviewer = decodeSlotProposal(row?.interviewerFeedback);
  const fromCandidate = decodeSlotProposal(row?.candidateFeedback);
  const proposedSlot = fromInterviewer.slot || fromCandidate.slot || null;
  const proposedDate = fromInterviewer.date || fromCandidate.date || null;
  return {
    ...row,
    statusLabel: normalizeStatusLabel(row.status),
    proposedSlot,
    proposedDate,
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

  const single24 = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (single24) {
    const hour = Number(single24[1]);
    const minute = Number(single24[2]);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23 && Number.isFinite(minute)) {
      return { hour, minute };
    }
  }

  const singleAmPm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw);
  if (singleAmPm) {
    let hour = Number(singleAmPm[1]);
    const minute = Number(singleAmPm[2]);
    const period = String(singleAmPm[3]).toUpperCase();
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
    const requestedInterviewerId = String(req.body?.interviewerId || '').trim();

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
    const preferredDateCheck = assertFutureBookingDate(preferredDate);
    if (preferredDateCheck.error) {
      return res.status(400).json({ success: false, message: preferredDateCheck.error });
    }
    if (!preferredTime.length) return res.status(400).json({ success: false, message: 'Select at least one preferred time slot' });
    if (!ALLOWED_DURATIONS.has(duration)) {
      return res.status(400).json({ success: false, message: 'Duration must be one of 30, 45, 60, 90, or 120 minutes' });
    }
    if (notes.length > 1000) {
      return res.status(400).json({ success: false, message: 'Additional notes must be 1000 characters or less' });
    }

    if (requestedInterviewerId && requestedInterviewerId === candidateId) {
      return res.status(400).json({ success: false, message: 'You cannot request an interview with yourself' });
    }

    let lockedPrice = null;
    if (requestedInterviewerId) {
      const [interviewerProfile, interviewerApplication] = await Promise.all([
        retryQuery(async () =>
          prisma.interviewerProfile.findUnique({ where: { candidateId: requestedInterviewerId } })
        ),
        retryQuery(async () =>
          prisma.interviewerApplication.findFirst({
            where: {
              candidateId: requestedInterviewerId,
              status: { in: ['SUBMITTED', 'APPROVED'] },
            },
            orderBy: { createdAt: 'desc' },
          })
        ),
      ]);
      if (!interviewerProfile && !interviewerApplication) {
        return res.status(400).json({ success: false, message: 'Selected interviewer is not available' });
      }
      lockedPrice = clampInterviewPrice(
        interviewerProfile?.interviewPrice ?? interviewerApplication?.interviewPrice,
        50
      );
    }

    const requestId = generateRequestId();
    const created = await retryQuery(async () =>
      prisma.interviewRequest.create({
        data: {
          requestId,
          candidateId,
          interviewerId: requestedInterviewerId || null,
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
          interviewPrice: lockedPrice,
          status: requestedInterviewerId ? 'WAITING_FOR_ACCEPTANCE' : 'FINDING_INTERVIEWER',
        },
      })
    );

    const matched = requestedInterviewerId ? created : await matchInterviewRequestById(created.id);

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

    if (requestedInterviewerId) {
      await retryQuery(async () =>
        prisma.notification.create({
          data: {
            candidateId: requestedInterviewerId,
            type: 'interview',
            title: 'New interview request',
            description: `Request ${requestId} is waiting for your acceptance. Agreed price: ${lockedPrice} tokens.`,
            actionButton: 'Open inbox',
            actionPath: '/lms/interview-prep/become-interviewer',
            metadata: { requestId, status: 'WAITING_FOR_ACCEPTANCE', interviewPrice: lockedPrice },
          },
        })
      ).catch(() => {});
    }

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
            select: { candidateId: true, fullName: true, email: true, phoneNumber: true, profilePhotoUrl: true },
          })
        )
      : [];

    const interviewerCards = interviewerIds.length
      ? await retryQuery(async () =>
          prisma.interviewerProfile.findMany({
            where: { candidateId: { in: interviewerIds } },
          })
        )
      : [];

    const interviewerProfileById = new Map(
      interviewerProfiles.map((row) => [String(row.candidateId), row])
    );
    const interviewerCardById = new Map(
      interviewerCards.map((row) => [String(row.candidateId), row])
    );

    return res.json({
      success: true,
      data: requests.map((row) => {
        const normalized = normalizeRequestRow(row);
        const interviewerId = String(row.interviewerId || '').trim();
        const basic = interviewerId ? interviewerProfileById.get(interviewerId) || null : null;
        const card = interviewerId ? interviewerCardById.get(interviewerId) || null : null;
        return {
          ...normalized,
          interviewPrice: clampInterviewPrice(row.interviewPrice ?? card?.interviewPrice, 50),
          paymentHeldAt: row.paymentHeldAt || null,
          payoutReleasedAt: row.payoutReleasedAt || null,
          interviewerProfile: interviewerId
            ? {
                candidateId: interviewerId,
                fullName: card?.fullName || basic?.fullName || null,
                email: basic?.email || null,
                phoneNumber: basic?.phoneNumber || null,
                profilePhotoUrl: basic?.profilePhotoUrl || card?.profilePhotoUrl || null,
                currentRole: card?.currentRole || null,
                yearsOfExperience: card?.yearsOfExperience || null,
                expertiseAreas: card?.expertiseAreas || [],
                interviewTypes: card?.interviewTypes || [],
                languages: card?.languages || [],
                weeklyAvailability: card?.weeklyAvailability || null,
                aboutYourself: card?.aboutYourself || null,
                feedbackStyle: card?.feedbackStyle || null,
                ratingAverage: Number(card?.ratingAverage || 0),
                interviewPrice: clampInterviewPrice(row.interviewPrice ?? card?.interviewPrice, 50),
              }
            : null,
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
    const preferredDateInput = toDateOrNull(req.body?.preferredDate || req.body?.proposedDate);
    if (!candidateId || !requestId) {
      return res.status(400).json({ success: false, message: 'Candidate and request ID are required' });
    }
    if (decision !== 'CONFIRM' && decision !== 'REQUEST_NEW_SLOT' && decision !== 'PROPOSE_SLOT') {
      return res.status(400).json({ success: false, message: 'Decision must be CONFIRM, PROPOSE_SLOT, or REQUEST_NEW_SLOT' });
    }

    const request = await retryQuery(async () =>
      prisma.interviewRequest.findUnique({
        where: { id: requestId },
      })
    );
    if (!request || String(request.candidateId) !== candidateId) {
      return res.status(404).json({ success: false, message: 'Interview request not found' });
    }
    if (!['ACCEPTED', 'SCHEDULED', 'WAITING_FOR_ACCEPTANCE'].includes(String(request.status))) {
      return res.status(400).json({ success: false, message: 'This request is not ready for scheduling actions' });
    }

    if (decision === 'PROPOSE_SLOT' || (decision === 'REQUEST_NEW_SLOT' && slot && parseSlotStart(slot))) {
      if (!parseSlotStart(slot)) {
        return res.status(400).json({ success: false, message: 'Please pick a valid time' });
      }
      const dateToUse = preferredDateInput || request.preferredDate;
      if (!dateToUse) {
        return res.status(400).json({ success: false, message: 'Please pick a valid date' });
      }
      const dateCheck = assertFutureBookingDate(dateToUse);
      if (dateCheck.error) {
        return res.status(400).json({ success: false, message: dateCheck.error });
      }
      const safeDate = dateCheck.date;
      const alreadyPaid = Boolean(request.paymentHeldAt);
      const updated = await retryQuery(async () =>
        prisma.interviewRequest.update({
          where: { id: request.id },
          data: {
            status: 'WAITING_FOR_ACCEPTANCE',
            preferredDate: safeDate,
            preferredTime: mergePreferredSlot(request.preferredTime, slot),
            scheduledAt: alreadyPaid ? request.scheduledAt : buildScheduledAtFromDateAndSlot(safeDate, slot),
            interviewerFeedback: null,
            candidateFeedback: encodeSlotProposal(slot, safeDate, note || 'Candidate proposed a new slot'),
          },
        })
      );
      if (request.interviewerId) {
        await retryQuery(async () =>
          prisma.notification.create({
            data: {
              candidateId: request.interviewerId,
              type: 'interview',
              title: 'Candidate proposed a new slot',
              description: `Request ${request.requestId}: ${String(dateToUse).slice(0, 10)} ${slot}. Please accept or propose another time.`,
              actionButton: 'Review slot',
              actionPath: '/lms/interview-prep/become-interviewer',
              metadata: { requestId: request.requestId, status: 'WAITING_FOR_ACCEPTANCE', slot },
            },
          })
        ).catch(() => {});
      }
      return res.json({ success: true, data: normalizeRequestRow(updated) });
    }

    if (decision === 'CONFIRM' && String(request.status) === 'SCHEDULED' && request.paymentHeldAt) {
      return res.json({
        success: true,
        data: {
          ...normalizeRequestRow(request),
          interviewPrice: clampInterviewPrice(request.interviewPrice, 50),
        },
      });
    }

    if (decision === 'CONFIRM') {
      if (!['ACCEPTED', 'WAITING_FOR_ACCEPTANCE'].includes(String(request.status))) {
        return res.status(400).json({ success: false, message: 'Slot can be confirmed only when a new time is waiting for your confirmation' });
      }
      const proposal = decodeSlotProposal(request.interviewerFeedback);
      const candidateProposal = decodeSlotProposal(request.candidateFeedback);
      const preferredTimes = Array.isArray(request.preferredTime) ? request.preferredTime : [];
      const latestPreferred = [...preferredTimes].reverse().find((item) => parseSlotStart(item)) || '';
      const slotCandidates = [
        proposal.slot,
        slot,
        candidateProposal.slot,
        latestPreferred,
        preferredTimes[0],
      ]
        .map((item) => String(item || '').trim())
        .filter(Boolean);
      const finalSlot = slotCandidates.find((item) => Boolean(parseSlotStart(item))) || '';
      if (!finalSlot) {
        return res.status(400).json({ success: false, message: 'Please choose a valid slot to finalize' });
      }
      const dateToUse =
        toDateOrNull(proposal.date) ||
        preferredDateInput ||
        toDateOrNull(candidateProposal.date) ||
        request.preferredDate;

      const agreedPrice = clampInterviewPrice(request.interviewPrice, 50);
      let tokenBalance = null;

      if (!request.paymentHeldAt) {
        try {
          const hold = await holdInterviewPayment({
            candidateId,
            requestDbId: request.id,
            amount: agreedPrice,
          });
          tokenBalance = hold.tokenBalance;
        } catch (error) {
          if (error.code === 'INSUFFICIENT_TOKENS' || error.status === 402) {
            const balance = Number(error.balance ?? 0);
            return res.status(402).json({
              success: false,
              code: 'INSUFFICIENT_TOKENS',
              message: `Need ${agreedPrice} tokens to confirm (you have ${balance}).`,
              interviewPrice: agreedPrice,
              balance,
              required: agreedPrice,
              shortfall: Math.max(0, agreedPrice - balance),
            });
          }
          throw error;
        }
      } else {
        try {
          const bal = await tokenService.getBalance(candidateId);
          tokenBalance = bal.tokenBalance;
        } catch {
          tokenBalance = null;
        }
      }

      const updated = await retryQuery(async () =>
        prisma.interviewRequest.update({
          where: { id: request.id },
          data: {
            status: 'SCHEDULED',
            interviewPrice: agreedPrice,
            paymentHeldAt: request.paymentHeldAt || new Date(),
            preferredTime: [finalSlot],
            preferredDate: dateToUse || request.preferredDate,
            scheduledAt:
              buildScheduledAtFromDateAndSlot(dateToUse || request.preferredDate, finalSlot) ||
              request.scheduledAt ||
              new Date(request.preferredDate),
            interviewerFeedback: encodeSlotProposal(finalSlot, dateToUse || request.preferredDate, ''),
            candidateFeedback: String(request.candidateFeedback || '').startsWith('SLOT_PROPOSAL::')
              ? note || null
              : note || request.candidateFeedback,
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

      return res.json({
        success: true,
        data: {
          ...normalizeRequestRow(updated),
          interviewPrice: agreedPrice,
          tokenBalance,
        },
      });
    }

    if (!['ACCEPTED', 'SCHEDULED'].includes(String(request.status))) {
      return res.status(400).json({ success: false, message: 'You can request a new slot after a proposal or while scheduled' });
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

async function getInterviewLiveByRoom(req, res) {
  try {
    const actorId = String(req.user?.candidateId || '').trim();
    const roomId = String(req.params?.roomId || '').trim();
    if (!actorId || !roomId) {
      return res.status(400).json({ success: false, message: 'Candidate and room ID are required' });
    }

    const request = await findRequestForLiveRoom(roomId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Live room not found' });
    }
    const isCandidate = String(request.candidateId) === actorId;
    const isInterviewer = String(request.interviewerId || '') === actorId;
    if (!isCandidate && !isInterviewer) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this live room' });
    }

    const bundle = await getLiveBundle(roomId);
    return res.json({
      success: true,
      data: {
        ...bundle,
        request: {
          id: request.id,
          requestId: request.requestId,
          status: request.status,
          candidateId: request.candidateId,
          interviewerId: request.interviewerId || null,
        },
      },
    });
  } catch (error) {
    console.error('getInterviewLiveByRoom error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load live room history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function getInterviewLiveByRequest(req, res) {
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
      return res.status(403).json({ success: false, message: 'Not authorized to view this live history' });
    }

    const bundle = await getLiveBundleByRequestId(request.id);
    return res.json({ success: true, data: bundle });
  } catch (error) {
    console.error('getInterviewLiveByRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load live interview notes',
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

async function completeLiveInterview(req, res) {
  try {
    const actorId = String(req.user?.candidateId || '').trim();
    const requestId = String(req.params?.requestId || '').trim();
    if (!actorId || !requestId) {
      return res.status(400).json({ success: false, message: 'Candidate and request ID are required' });
    }

    const request = await retryQuery(async () =>
      prisma.interviewRequest.findFirst({
        where: {
          OR: [{ id: requestId }, { requestId }, { requestId: requestId.toUpperCase() }],
        },
      })
    );
    if (!request) {
      return res.status(404).json({ success: false, message: 'Interview request not found' });
    }

    const isCandidate = String(request.candidateId) === actorId;
    const isInterviewer = String(request.interviewerId || '') === actorId;
    if (!isCandidate && !isInterviewer) {
      return res.status(403).json({ success: false, message: 'Not authorized to complete this interview' });
    }

    const status = String(request.status || '');
    if (!['ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'This interview can be completed only after it is accepted or scheduled',
      });
    }

    let payoutTokens = 0;
    const updateData = {
      status: 'COMPLETED',
      completedAt: request.completedAt || new Date(),
    };

    if (request.paymentHeldAt && !request.payoutReleasedAt && request.interviewerId) {
      const payout = await releaseInterviewerEarnings({
        interviewerId: request.interviewerId,
        requestDbId: request.id,
        amount: request.interviewPrice,
      });
      updateData.payoutReleasedAt = request.payoutReleasedAt || new Date();
      payoutTokens = payout.granted || payout.fee || 0;
    }

    const updated = await retryQuery(async () =>
      prisma.interviewRequest.update({
        where: { id: request.id },
        data: updateData,
      })
    );

    const notifyId = isCandidate ? request.interviewerId : request.candidateId;
    if (notifyId) {
      await retryQuery(async () =>
        prisma.notification.create({
          data: {
            candidateId: notifyId,
            type: 'interview',
            title: 'Interview completed',
            description: `Request ${request.requestId} was marked completed from the live meeting.`,
            actionButton: 'View completed',
            actionPath: isCandidate
              ? '/lms/interview-prep/become-interviewer'
              : '/lms/interview-prep/request-interview',
            metadata: { requestId: request.requestId, status: 'COMPLETED' },
          },
        })
      ).catch(() => {});
    }

    return res.json({
      success: true,
      data: {
        ...normalizeRequestRow(updated),
        payoutTokens,
      },
    });
  } catch (error) {
    console.error('completeLiveInterview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete interview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function submitInterviewReview(req, res) {
  try {
    const actorId = String(req.user?.candidateId || '').trim();
    const requestId = String(req.params?.requestId || '').trim();
    const feedback = String(req.body?.feedback || req.body?.review || '').trim();
    const rating = Number(req.body?.rating);
    if (!actorId || !requestId) {
      return res.status(400).json({ success: false, message: 'Candidate and request ID are required' });
    }
    if (feedback.length < 10) {
      return res.status(400).json({ success: false, message: 'Review must be at least 10 characters' });
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const request = await retryQuery(async () =>
      prisma.interviewRequest.findUnique({ where: { id: requestId } })
    );
    if (!request) {
      return res.status(404).json({ success: false, message: 'Interview request not found' });
    }

    const isCandidate = String(request.candidateId) === actorId;
    const isInterviewer = String(request.interviewerId || '') === actorId;
    if (!isCandidate && !isInterviewer) {
      return res.status(403).json({ success: false, message: 'Not authorized to review this interview' });
    }

    const status = String(request.status || '');
    if (!['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Reviews can be submitted only after the interview is scheduled',
      });
    }

    const scheduledAt = request.scheduledAt ? new Date(request.scheduledAt).getTime() : Number.NaN;
    const durationMin = Math.max(15, Number(request.duration || 45));
    const meetingEndsAt = Number.isFinite(scheduledAt) ? scheduledAt + durationMin * 60 * 1000 : 0;
    if (status !== 'COMPLETED' && meetingEndsAt && Date.now() < meetingEndsAt) {
      return res.status(400).json({
        success: false,
        message: 'Complete and review become available after the scheduled meeting time ends',
      });
    }

    const safeRating = Math.max(1, Math.min(5, Math.round(rating)));
    const data = {
      status: 'COMPLETED',
      completedAt: request.completedAt || new Date(),
    };

    if (isCandidate) {
      data.candidateFeedback = feedback.slice(0, 4000);
      data.candidateRating = safeRating;
    } else {
      data.interviewerFeedback = feedback.slice(0, 4000);
      data.interviewerRating = safeRating;
    }

    let payoutTokens = 0;
    if (isInterviewer && request.paymentHeldAt && !request.payoutReleasedAt) {
      const payout = await releaseInterviewerEarnings({
        interviewerId: actorId,
        requestDbId: request.id,
        amount: request.interviewPrice,
      });
      data.payoutReleasedAt = request.payoutReleasedAt || new Date();
      payoutTokens = payout.granted || payout.fee || 0;
    }

    const updated = await retryQuery(async () =>
      prisma.interviewRequest.update({
        where: { id: request.id },
        data,
      })
    );

    const notifyId = isCandidate ? request.interviewerId : request.candidateId;
    if (notifyId) {
      await retryQuery(async () =>
        prisma.notification.create({
          data: {
            candidateId: notifyId,
            type: 'interview',
            title: isCandidate ? 'Candidate submitted interview review' : 'Interviewer submitted interview review',
            description: `Request ${request.requestId} is marked completed. Open Completed to see feedback.`,
            actionButton: 'View completed',
            actionPath: isCandidate
              ? '/lms/interview-prep/become-interviewer'
              : '/lms/interview-prep/request-interview',
            metadata: { requestId: request.requestId, status: 'COMPLETED' },
          },
        })
      ).catch(() => {});
    }

    return res.json({
      success: true,
      data: {
        ...normalizeRequestRow(updated),
        payoutTokens,
      },
    });
  } catch (error) {
    console.error('submitInterviewReview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit interview review',
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
  getInterviewLiveByRoom,
  getInterviewLiveByRequest,
  getInterviewRequestChat,
  postInterviewRequestChat,
  completeLiveInterview,
  submitInterviewReview,
};
