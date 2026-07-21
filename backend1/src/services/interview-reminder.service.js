const { prisma, retryQuery } = require('../lib/prisma');
const { sendInterviewStatusEmail } = require('./email.service');

const DEFAULT_INTERVAL_MS = Math.max(
  30 * 1000,
  Number(process.env.INTERVIEW_REMINDER_INTERVAL_MS || 60 * 1000) || 60 * 1000
);
const ONE_HOUR_MS = 60 * 60 * 1000;

let timer = null;
let inFlight = false;

function buildFrontendBaseUrl() {
  const raw = String(process.env.FRONTEND_URL || 'http://localhost:3000').trim();
  return raw.replace(/\/$/, '');
}

function formatForDescription(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'soon';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: process.env.INTERVIEW_TIMEZONE || 'Asia/Kolkata',
  }).format(date);
}

async function hasReminderAlreadySent(key) {
  const raw = await retryQuery(async () =>
    prisma.$runCommandRaw({
      find: 'interview_request_reminder_logs',
      filter: { key },
      limit: 1,
    })
  );
  return Boolean(raw?.cursor?.firstBatch?.[0]);
}

async function markReminderSent(key, request) {
  await retryQuery(async () =>
    prisma.$runCommandRaw({
      insert: 'interview_request_reminder_logs',
      documents: [
        {
          key,
          requestId: String(request.requestId || ''),
          requestDbId: String(request.id || ''),
          candidateId: String(request.candidateId || ''),
          interviewerId: String(request.interviewerId || ''),
          type: 'ONE_HOUR',
          sentAt: new Date(),
        },
      ],
    })
  );
}

async function sendReminderForRequest(request) {
  const requestDbId = String(request.id || '').trim();
  const requestId = String(request.requestId || '').trim();
  const candidateId = String(request.candidateId || '').trim();
  const interviewerId = String(request.interviewerId || '').trim();
  if (!requestDbId || !requestId || !candidateId || !interviewerId) return false;

  const reminderKey = `${requestDbId}:ONE_HOUR`;
  if (await hasReminderAlreadySent(reminderKey)) return false;

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

  const scheduledLabel = formatForDescription(request.scheduledAt);
  const slot = Array.isArray(request.preferredTime) ? String(request.preferredTime[0] || '').trim() : '';
  const baseUrl = buildFrontendBaseUrl();
  const candidateRoomUrl = `${baseUrl}/en/lms/interview-prep/candidate-room/${encodeURIComponent(requestDbId)}`;
  const interviewerRoomUrl = `${baseUrl}/en/lms/interview-prep/interviewer-room/${encodeURIComponent(requestDbId)}`;

  await Promise.all([
    candidateEmail
      ? sendInterviewStatusEmail({
          toEmail: candidateEmail,
          recipientName: candidateName,
          counterpartName: interviewerName,
          requestId,
          interviewType: request.interviewType,
          scheduledAt: request.scheduledAt,
          slotLabel: slot,
          roomUrl: candidateRoomUrl,
          reminder: true,
        })
      : Promise.resolve(null),
    interviewerEmail
      ? sendInterviewStatusEmail({
          toEmail: interviewerEmail,
          recipientName: interviewerName,
          counterpartName: candidateName,
          requestId,
          interviewType: request.interviewType,
          scheduledAt: request.scheduledAt,
          slotLabel: slot,
          roomUrl: interviewerRoomUrl,
          reminder: true,
        })
      : Promise.resolve(null),
    retryQuery(async () =>
      prisma.notification.create({
        data: {
          candidateId,
          type: 'interview',
          title: 'Interview starts in 1 hour',
          description: `${requestId} starts at ${scheduledLabel}.`,
          actionButton: 'Open room',
          actionPath: `/lms/interview-prep/candidate-room/${requestDbId}`,
          metadata: { requestId, status: 'SCHEDULED', reminder: 'ONE_HOUR' },
        },
      })
    ).catch(() => null),
    retryQuery(async () =>
      prisma.notification.create({
        data: {
          candidateId: interviewerId,
          type: 'interview',
          title: 'Interview starts in 1 hour',
          description: `${requestId} starts at ${scheduledLabel}.`,
          actionButton: 'Open room',
          actionPath: `/lms/interview-prep/interviewer-room/${requestDbId}`,
          metadata: { requestId, status: 'SCHEDULED', reminder: 'ONE_HOUR' },
        },
      })
    ).catch(() => null),
  ]);

  await markReminderSent(reminderKey, request);
  return true;
}

async function runInterviewReminderCycle() {
  if (inFlight) return { skipped: true };
  inFlight = true;
  try {
    const now = new Date();
    const upperBound = new Date(now.getTime() + ONE_HOUR_MS);

    const scheduledRequests = await retryQuery(async () =>
      prisma.interviewRequest.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { gte: now, lte: upperBound },
        },
        select: {
          id: true,
          requestId: true,
          candidateId: true,
          interviewerId: true,
          interviewType: true,
          preferredTime: true,
          scheduledAt: true,
        },
        orderBy: { scheduledAt: 'asc' },
        take: 200,
      })
    );

    let sent = 0;
    for (const request of scheduledRequests) {
      try {
        const didSend = await sendReminderForRequest(request);
        if (didSend) sent += 1;
      } catch (error) {
        console.warn('[interview-reminder] request reminder failed:', error?.message || error);
      }
    }

    if (sent > 0) {
      console.log(`[interview-reminder] sent one-hour reminders for ${sent} scheduled interviews`);
    }
    return { scanned: scheduledRequests.length, sent };
  } catch (error) {
    console.warn('[interview-reminder] cycle failed:', error?.message || error);
    return { error: String(error?.message || error) };
  } finally {
    inFlight = false;
  }
}

function startInterviewReminderScheduler() {
  if (String(process.env.INTERVIEW_REMINDER_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('[interview-reminder] disabled by INTERVIEW_REMINDER_ENABLED=false');
    return;
  }
  if (timer) return;

  timer = setInterval(() => {
    runInterviewReminderCycle().catch(() => {});
  }, DEFAULT_INTERVAL_MS);
  timer.unref?.();

  runInterviewReminderCycle().catch(() => {});
  console.log(`[interview-reminder] scheduler started (interval=${DEFAULT_INTERVAL_MS}ms)`);
}

function stopInterviewReminderScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = {
  runInterviewReminderCycle,
  startInterviewReminderScheduler,
  stopInterviewReminderScheduler,
};
