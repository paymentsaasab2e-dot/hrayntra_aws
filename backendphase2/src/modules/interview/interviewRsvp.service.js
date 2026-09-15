import {
  buildInterviewRsvpPublicUrls,
  shouldShowJoinInterviewCta,
} from './interviewRsvpLinks.js';
import { verifyInterviewRsvpToken } from '../../utils/interviewRsvpToken.js';
import { zonedWallClockToDate, resolveInterviewTimeZone } from '../../utils/zonedDateTime.js';
import { prisma, runWithTenantContext } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { createUserNotification } from '../notification/notification.service.js';
import { sendLifecycleAlertEmail } from '../../services/emailService.js';

export { buildInterviewRsvpPublicUrls, shouldShowJoinInterviewCta };

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadInterviewForRsvp(interviewId) {
  return prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      job: { select: { id: true, title: true } },
      createdBy: {
        select: { id: true, email: true, firstName: true, lastName: true, name: true },
      },
      interviewer: {
        select: { id: true, email: true, firstName: true, lastName: true, name: true },
      },
    },
  });
}

function displayName(user) {
  if (!user) return 'Recruiter';
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.name ||
    user.email ||
    'Recruiter'
  );
}

function candidateDisplayName(candidate) {
  if (!candidate) return 'Candidate';
  return (
    `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() ||
    candidate.email ||
    'Candidate'
  );
}

async function notifyRecruiterOfRsvp({ interview, action, message, proposedAtLabel }) {
  const recipients = [];
  const seen = new Set();
  for (const user of [interview.createdBy, interview.interviewer]) {
    const id = String(user?.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    recipients.push(user);
  }

  const candidateName = candidateDisplayName(interview.candidate);
  const jobTitle = interview.job?.title || 'Interview';
  const title =
    action === 'accept'
      ? `${candidateName} accepted the interview`
      : action === 'reject'
        ? `${candidateName} declined the interview`
        : `${candidateName} requested a reschedule`;

  const body =
    action === 'accept'
      ? `${candidateName} accepted the interview for ${jobTitle}.`
      : action === 'reject'
        ? `${candidateName} declined the interview for ${jobTitle}.${message ? ` Reason: ${message}` : ''}`
        : `${candidateName} requested to reschedule ${jobTitle}${
            proposedAtLabel ? ` to ${proposedAtLabel}` : ''
          }.${message ? ` Note: ${message}` : ''}`;

  const alertId =
    action === 'accept'
      ? 'interview.candidate_accepted'
      : action === 'reject'
        ? 'interview.candidate_rejected'
        : 'interview.candidate_reschedule_requested';

  for (const user of recipients) {
    try {
      await createUserNotification(user.id, {
        title,
        description: body,
        category: 'INTERVIEW',
        entityType: 'interview',
        entityId: interview.id,
        actionPath: `/interviews?interviewId=${interview.id}`,
        actionLabel: 'View interview',
        metadata: { alertId, rsvpAction: action },
      });
    } catch (err) {
      console.warn('[interview-rsvp] notification failed', err?.message || err);
    }

    if (!user.email) continue;
    try {
      await sendLifecycleAlertEmail({
        senderUserId: null,
        toEmail: user.email,
        subject: title,
        html: `
          <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
            <p>Hello ${escapeHtml(displayName(user))},</p>
            <p>${escapeHtml(body)}</p>
            <p><a href="${escapeHtml(
              `${String(env.FRONTEND_URL || '').replace(/\/$/, '')}/interviews?interviewId=${interview.id}`,
            )}">Open interview in HRYANTRA</a></p>
          </div>
        `,
        triggerId: alertId,
      });
    } catch (err) {
      console.warn('[interview-rsvp] email failed', err?.message || err);
    }
  }
}

function publicInterviewView(interview) {
  const showJoin = shouldShowJoinInterviewCta({
    meetingLink: interview.meetingLink,
    mode: interview.mode,
    type: interview.type,
  });
  const notes = String(interview.notes || '');
  const status = String(interview.status || '').toUpperCase();
  let candidateResponse = null;
  if (status === 'CONFIRMED' || /Candidate accepted on /i.test(notes)) {
    candidateResponse = 'accepted';
  } else if (status === 'CANCELLED' || /Candidate declined on /i.test(notes)) {
    candidateResponse = 'declined';
  } else if (/Candidate reschedule request on /i.test(notes)) {
    candidateResponse = 'reschedule_requested';
  }

  return {
    interviewId: interview.id,
    status: interview.status,
    candidateResponse,
    jobTitle: interview.job?.title || 'Interview',
    candidateName: candidateDisplayName(interview.candidate),
    scheduledAt: interview.scheduledAt,
    timezone: interview.timezone || 'Asia/Kolkata',
    mode: interview.mode,
    type: interview.type,
    location: interview.location || null,
    meetingLink: showJoin ? interview.meetingLink || null : null,
    showJoinCta: showJoin,
    duration: interview.duration,
  };
}

async function withRsvpInterview(token, handler) {
  const payload = verifyInterviewRsvpToken(token);
  if (!payload) {
    const err = new Error('Invalid or expired interview link');
    err.statusCode = 400;
    throw err;
  }
  const tenantDbName = String(payload.tenantDbName || '').trim();
  const run = async () => {
    const interview = await loadInterviewForRsvp(payload.interviewId);
    if (!interview) {
      const err = new Error('Interview not found');
      err.statusCode = 404;
      throw err;
    }
    return handler(interview, payload);
  };
  if (tenantDbName) return runWithTenantContext(tenantDbName, run);
  return run();
}

export async function getPublicInterviewRsvp(token) {
  return withRsvpInterview(token, async (interview) => publicInterviewView(interview));
}

export async function acceptPublicInterviewRsvp(token) {
  return withRsvpInterview(token, async (interview) => {
    if (interview.status === 'CANCELLED') {
      throw Object.assign(new Error('This interview was cancelled'), { statusCode: 400 });
    }
    // Already accepted — return confirmation without re-notifying or appending notes.
    if (interview.status === 'CONFIRMED' || /Candidate accepted on /i.test(String(interview.notes || ''))) {
      if (interview.status !== 'CONFIRMED') {
        const synced = await prisma.interview.update({
          where: { id: interview.id },
          data: { status: 'CONFIRMED' },
          include: {
            candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
            job: { select: { id: true, title: true } },
            createdBy: {
              select: { id: true, email: true, firstName: true, lastName: true, name: true },
            },
            interviewer: {
              select: { id: true, email: true, firstName: true, lastName: true, name: true },
            },
          },
        });
        return publicInterviewView(synced);
      }
      return publicInterviewView(interview);
    }
    const updated = await prisma.interview.update({
      where: { id: interview.id },
      data: {
        status: 'CONFIRMED',
        notes: [interview.notes, `Candidate accepted on ${new Date().toISOString()}`]
          .filter(Boolean)
          .join('\n'),
      },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
        job: { select: { id: true, title: true } },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true, name: true },
        },
        interviewer: {
          select: { id: true, email: true, firstName: true, lastName: true, name: true },
        },
      },
    });
    await notifyRecruiterOfRsvp({ interview: updated, action: 'accept' });
    return publicInterviewView(updated);
  });
}

export async function rejectPublicInterviewRsvp(token, { reason } = {}) {
  return withRsvpInterview(token, async (interview) => {
    if (
      interview.status === 'CANCELLED' ||
      /Candidate declined on /i.test(String(interview.notes || ''))
    ) {
      return publicInterviewView(interview);
    }
    const message = String(reason || '').trim();
    const updated = await prisma.interview.update({
      where: { id: interview.id },
      data: {
        status: 'CANCELLED',
        notes: [
          interview.notes,
          `Candidate declined on ${new Date().toISOString()}${message ? `: ${message}` : ''}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
        job: { select: { id: true, title: true } },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true, name: true },
        },
        interviewer: {
          select: { id: true, email: true, firstName: true, lastName: true, name: true },
        },
      },
    });
    await notifyRecruiterOfRsvp({ interview: updated, action: 'reject', message });
    return publicInterviewView(updated);
  });
}

export async function requestPublicInterviewReschedule(token, { proposedAt, timezone, message } = {}) {
  return withRsvpInterview(token, async (interview) => {
    const proposedRaw = String(proposedAt || '').trim();
    if (!proposedRaw) {
      throw Object.assign(new Error('Please pick a proposed date and time'), { statusCode: 400 });
    }
    const tz = resolveInterviewTimeZone(timezone || interview.timezone);
    let proposedDate;
    try {
      // Accept ISO or local datetime-local value (YYYY-MM-DDTHH:mm)
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(proposedRaw) && !proposedRaw.endsWith('Z')) {
        const [datePart, timePart] = proposedRaw.split('T');
        const [y, m, d] = datePart.split('-').map(Number);
        const [hh, mm] = timePart.split(':').map(Number);
        proposedDate = zonedWallClockToDate(y, m, d, hh, mm, tz);
      } else {
        proposedDate = new Date(proposedRaw);
      }
    } catch {
      proposedDate = new Date(proposedRaw);
    }
    if (Number.isNaN(proposedDate?.getTime?.())) {
      throw Object.assign(new Error('Invalid proposed date and time'), { statusCode: 400 });
    }

    const proposedAtLabel = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: tz,
    }).format(proposedDate);

    const note = String(message || '').trim();
    const updated = await prisma.interview.update({
      where: { id: interview.id },
      data: {
        notes: [
          interview.notes,
          `Candidate reschedule request on ${new Date().toISOString()}: prefers ${proposedAtLabel} (${tz})${
            note ? ` — ${note}` : ''
          }`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
        job: { select: { id: true, title: true } },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true, name: true },
        },
        interviewer: {
          select: { id: true, email: true, firstName: true, lastName: true, name: true },
        },
      },
    });

    await notifyRecruiterOfRsvp({
      interview: updated,
      action: 'reschedule',
      message: note,
      proposedAtLabel: `${proposedAtLabel} (${tz})`,
    });

    return {
      ...publicInterviewView(updated),
      proposedAt: proposedDate.toISOString(),
      proposedAtLabel: `${proposedAtLabel} (${tz})`,
    };
  });
}
