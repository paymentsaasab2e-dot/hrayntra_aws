/**
 * Lead meet / follow-up schedule notifications (invite + timed reminders via email).
 */

import { sendLeadFollowUpEmail } from '../../emails/email.service.js';
import { prisma } from '../../config/prisma.js';

export const FOLLOW_UP_SCHEDULE_LABEL = '__followUpSchedule';

const REMINDER_OFFSET_MS = {
  '10 minutes before': 10 * 60 * 1000,
  '30 minutes before': 30 * 60 * 1000,
  '1 hour before': 60 * 60 * 1000,
  '1 day before': 24 * 60 * 60 * 1000,
};

export function reminderOffsetMs(reminder) {
  const key = String(reminder || '').trim();
  if (!key || key === 'No reminder') return null;
  return REMINDER_OFFSET_MS[key] ?? null;
}

export function formatFollowUpInTimezone(isoOrDate, timezone) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return String(isoOrDate || '');
  const tz = String(timezone || '').trim() || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(d);
  } catch {
    return d.toLocaleString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

export function normalizeFollowUpSchedule(raw, nextFollowUpIso) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || raw.followUpType || '').trim() || 'General';
  const scheduledAt = nextFollowUpIso
    ? new Date(nextFollowUpIso)
    : raw.scheduledAt
      ? new Date(raw.scheduledAt)
      : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return null;

  const reminder = String(raw.reminder || raw.followUpReminder || '').trim() || 'No reminder';
  const offset = reminderOffsetMs(reminder);
  const reminderAt =
    offset != null ? new Date(scheduledAt.getTime() - offset) : null;

  return {
    type,
    contact: String(raw.contact || raw.followUpContact || '').trim() || null,
    meetLink: String(raw.meetLink || raw.followUpMeetLink || '').trim() || null,
    reminder: reminder === 'No reminder' ? null : reminder,
    timezone: String(raw.timezone || raw.followUpTimezone || '').trim() || 'UTC',
    attendeeIds: Array.isArray(raw.attendeeIds || raw.followUpAttendeeIds)
      ? (raw.attendeeIds || raw.followUpAttendeeIds).map(String).filter(Boolean)
      : [],
    notes: String(raw.notes || raw.followUpNotes || '').trim() || null,
    postponed: Boolean(raw.postponed || raw.followUpPostponed),
    postponeReason:
      String(raw.postponeReason || raw.followUpPostponeReason || '').trim() || null,
    scheduledAt: scheduledAt.toISOString(),
    reminderAt: reminderAt && !Number.isNaN(reminderAt.getTime()) ? reminderAt.toISOString() : null,
    inviteSentAt: raw.inviteSentAt || null,
    reminderSentAt: raw.reminderSentAt || null,
  };
}

export function readFollowUpScheduleFromOtherDetails(otherDetails) {
  if (!otherDetails) return null;
  if (Array.isArray(otherDetails)) {
    const row = otherDetails.find((item) => item && item.label === FOLLOW_UP_SCHEDULE_LABEL);
    if (!row?.value) return null;
    try {
      return typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    } catch {
      return null;
    }
  }
  if (typeof otherDetails === 'object' && otherDetails.followUpSchedule) {
    return otherDetails.followUpSchedule;
  }
  return null;
}

export function mergeFollowUpScheduleIntoOtherDetails(existingOtherDetails, schedule) {
  const base = Array.isArray(existingOtherDetails)
    ? existingOtherDetails.filter((item) => item && item.label !== FOLLOW_UP_SCHEDULE_LABEL)
    : [];
  if (!schedule) return base;
  return [
    ...base,
    {
      label: FOLLOW_UP_SCHEDULE_LABEL,
      value: JSON.stringify(schedule),
    },
  ];
}

function uniqueEmails(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const email = String(raw || '').trim().toLowerCase();
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    out.push(String(raw).trim());
  }
  return out;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function formatAttendeeName(user) {
  return (
    user?.name ||
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    user?.email ||
    'Team member'
  );
}

function formatMeetLinkHtml(rawLink) {
  const link = String(rawLink || '').trim();
  if (!link) return '';
  const href = /^https?:\/\//i.test(link) ? link : `https://${link}`;
  return `<a href="${escapeAttr(href)}" style="color:#2563eb;word-break:break-all">${escapeHtml(link)}</a>`;
}

export async function resolveScheduleAttendees(schedule) {
  if (!schedule?.attendeeIds?.length) return [];
  return prisma.user.findMany({
    where: { id: { in: schedule.attendeeIds } },
    select: { id: true, name: true, firstName: true, lastName: true, email: true },
  });
}

/**
 * Rich HTML block with meet link, timezone, attendees, contact, reminder, and notes.
 */
export function buildFollowUpEmailDetailsHtml(
  schedule,
  { isReminder = false, scheduledLabel, attendees = [] } = {},
) {
  if (!schedule) return '';

  const intro = isReminder
    ? `Reminder: your ${schedule.type || 'meeting'} is coming up${schedule.reminder ? ` (${schedule.reminder})` : ''}.`
    : `You have been invited to a scheduled ${schedule.type || 'follow-up'}.`;

  const rows = [];
  if (scheduledLabel) rows.push(['Date & time', escapeHtml(scheduledLabel)]);
  if (schedule.type) rows.push(['Type', escapeHtml(schedule.type)]);
  if (schedule.timezone) rows.push(['Timezone', escapeHtml(schedule.timezone)]);
  if (schedule.meetLink) rows.push(['Meet link', formatMeetLinkHtml(schedule.meetLink)]);
  if (schedule.contact) rows.push(['Contact', escapeHtml(schedule.contact)]);
  if (attendees.length) {
    const attendeeHtml = attendees
      .map((user) => {
        const name = escapeHtml(formatAttendeeName(user));
        const email = user?.email ? ` <span style="color:#6b7280">(${escapeHtml(user.email)})</span>` : '';
        return `${name}${email}`;
      })
      .join('<br>');
    rows.push(['Attendees', attendeeHtml]);
  }
  if (schedule.reminder) {
    rows.push([
      'Reminder',
      escapeHtml(isReminder ? schedule.reminder : `A reminder email will be sent ${schedule.reminder}`),
    ]);
  }
  if (schedule.notes) {
    rows.push(['Notes', escapeHtml(schedule.notes).replace(/\n/g, '<br>')]);
  }

  let html = `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(intro)}</p>`;
  if (rows.length) {
    html +=
      '<div style="background:#ffffff;padding:16px;border-radius:8px;border:1px solid #e5e7eb;margin:12px 0">';
    for (const [label, value] of rows) {
      html += `<p style="margin:0 0 10px;line-height:1.5"><strong>${label}:</strong> ${value}</p>`;
    }
    html += '</div>';
  }
  return html;
}

function buildNotesBlock(schedule, options = {}) {
  return buildFollowUpEmailDetailsHtml(schedule, options);
}

/**
 * Send schedule invite emails to lead contact + meet attendees.
 * Returns updated schedule with inviteSentAt set.
 */
export async function sendLeadMeetScheduleInvites({ lead, schedule }) {
  const scheduleType = String(schedule?.type || '').trim().toLowerCase();
  const isOnlineMeet = scheduleType === 'meet' || scheduleType === 'online meeting';
  if (!schedule || !isOnlineMeet) {
    return schedule;
  }

  const scheduledLabel = formatFollowUpInTimezone(schedule.scheduledAt, schedule.timezone);
  const attendeeUsers = await resolveScheduleAttendees(schedule);

  const recipients = uniqueEmails([
    lead?.email,
    lead?.teamMemberEmail,
    ...(Array.isArray(lead?.emails) ? lead.emails : []),
    schedule.contact && String(schedule.contact).includes('@') ? schedule.contact : null,
    ...attendeeUsers.map((u) => u.email),
    lead?.assignedTo?.email,
  ]);

  if (!recipients.length) {
    console.warn('[lead-follow-up] Online meeting scheduled but no recipient emails found');
    return schedule;
  }

  const notes = buildNotesBlock(schedule, {
    isReminder: false,
    scheduledLabel,
    attendees: attendeeUsers,
  });
  const inviteType = String(schedule.type || 'Online Meeting').trim() || 'Online Meeting';
  await Promise.allSettled(
    recipients.map((to) =>
      sendLeadFollowUpEmail(to, lead.companyName || 'Lead', scheduledLabel, inviteType, notes),
    ),
  );

  return {
    ...schedule,
    inviteSentAt: new Date().toISOString(),
    inviteRecipientCount: recipients.length,
  };
}

/**
 * Send reminder emails when reminderAt has arrived (before any scheduled follow-up).
 */
export async function sendLeadFollowUpReminderEmails({ lead, schedule }) {
  if (!schedule || !schedule.reminderAt || schedule.reminderSentAt) return schedule;

  const reminderAt = new Date(schedule.reminderAt);
  const meetingAt = new Date(schedule.scheduledAt);
  const now = Date.now();
  if (Number.isNaN(reminderAt.getTime()) || now < reminderAt.getTime()) return schedule;
  if (!Number.isNaN(meetingAt.getTime()) && now > meetingAt.getTime() + 5 * 60 * 1000) {
    return { ...schedule, reminderSentAt: schedule.reminderSentAt || new Date().toISOString() };
  }

  const scheduledLabel = formatFollowUpInTimezone(schedule.scheduledAt, schedule.timezone);
  const attendeeUsers = await resolveScheduleAttendees(schedule);
  const followUpType = String(schedule.type || 'Follow-up').trim() || 'Follow-up';

  const recipients = uniqueEmails([
    lead?.email,
    lead?.teamMemberEmail,
    ...(Array.isArray(lead?.emails) ? lead.emails : []),
    schedule.contact && String(schedule.contact).includes('@') ? schedule.contact : null,
    ...attendeeUsers.map((u) => u.email),
    lead?.assignedTo?.email,
  ]);

  if (recipients.length) {
    const notes = buildFollowUpEmailDetailsHtml(schedule, {
      isReminder: true,
      scheduledLabel,
      attendees: attendeeUsers,
    });
    await Promise.allSettled(
      recipients.map((to) =>
        sendLeadFollowUpEmail(
          to,
          lead.companyName || 'Lead',
          scheduledLabel,
          `${followUpType} reminder`,
          notes,
        ),
      ),
    );
  }

  return {
    ...schedule,
    reminderSentAt: new Date().toISOString(),
  };
}

/** @deprecated Use sendLeadFollowUpReminderEmails */
export async function sendLeadMeetReminderEmails({ lead, schedule }) {
  return sendLeadFollowUpReminderEmails({ lead, schedule });
}

/**
 * Notify lead contact for non-meet follow-ups via email.
 */
export async function sendLeadFollowUpContactNotifications({
  lead,
  schedule,
  whenLabel,
  followUpNotes,
}) {
  if (!schedule) return;

  const type = String(schedule.type || 'Follow-up').trim();
  const attendeeUsers = await resolveScheduleAttendees(schedule);

  const emails = uniqueEmails([
    lead?.email,
    lead?.teamMemberEmail,
    ...(Array.isArray(lead?.emails) ? lead.emails : []),
    schedule.contact && String(schedule.contact).includes('@') ? schedule.contact : null,
  ]);

  const notes = buildFollowUpEmailDetailsHtml(
    {
      ...schedule,
      notes: schedule.notes || followUpNotes || null,
    },
    {
      isReminder: false,
      scheduledLabel: whenLabel,
      attendees: attendeeUsers,
    },
  );

  if (!emails.length) {
    console.warn('[lead-follow-up] Follow-up scheduled but no recipient emails found');
    return;
  }

  await Promise.allSettled(
    emails.map((to) =>
      sendLeadFollowUpEmail(to, lead.companyName || 'Lead', whenLabel, type, notes),
    ),
  );
}
