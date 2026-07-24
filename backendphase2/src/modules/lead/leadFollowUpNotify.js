/**
 * Lead meet / follow-up schedule notifications (invite + timed reminders).
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

function buildNotesBlock(schedule, { isReminder = false } = {}) {
  const lines = [];
  if (isReminder) {
    lines.push(`Reminder: meeting starts soon (${schedule.reminder || 'scheduled reminder'}).`);
  } else {
    lines.push('You have been invited to this scheduled meet.');
  }
  if (schedule.timezone) lines.push(`Timezone: ${schedule.timezone}`);
  if (schedule.meetLink) lines.push(`Meet link: ${schedule.meetLink}`);
  if (schedule.contact) lines.push(`Contact: ${schedule.contact}`);
  if (schedule.notes) lines.push(`Notes: ${schedule.notes}`);
  if (!isReminder && schedule.reminder) {
    lines.push(`Reminder email will be sent: ${schedule.reminder}.`);
  }
  return lines.join('\n');
}

/**
 * Send schedule invite emails to lead contact + meet attendees.
 * Returns updated schedule with inviteSentAt set.
 */
export async function sendLeadMeetScheduleInvites({
  lead,
  schedule,
}) {
  if (!schedule || String(schedule.type || '').toLowerCase() !== 'meet') {
    return schedule;
  }

  const scheduledLabel = formatFollowUpInTimezone(schedule.scheduledAt, schedule.timezone);
  const attendeeUsers =
    schedule.attendeeIds?.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: schedule.attendeeIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

  const recipients = uniqueEmails([
    lead?.email,
    ...(Array.isArray(lead?.emails) ? lead.emails : []),
    schedule.contact && String(schedule.contact).includes('@') ? schedule.contact : null,
    ...attendeeUsers.map((u) => u.email),
    lead?.assignedTo?.email,
  ]);

  if (!recipients.length) {
    console.warn('[lead-follow-up] Meet scheduled but no recipient emails found');
    return schedule;
  }

  const notes = buildNotesBlock(schedule, { isReminder: false });
  await Promise.allSettled(
    recipients.map((to) =>
      sendLeadFollowUpEmail(to, lead.companyName || 'Lead', scheduledLabel, 'Meet', notes),
    ),
  );

  return {
    ...schedule,
    inviteSentAt: new Date().toISOString(),
    inviteRecipientCount: recipients.length,
  };
}

/**
 * Send reminder emails when reminderAt has arrived (before meeting).
 */
export async function sendLeadMeetReminderEmails({ lead, schedule }) {
  if (!schedule || String(schedule.type || '').toLowerCase() !== 'meet') return schedule;
  if (!schedule.reminderAt || schedule.reminderSentAt) return schedule;

  const reminderAt = new Date(schedule.reminderAt);
  const meetingAt = new Date(schedule.scheduledAt);
  const now = Date.now();
  if (Number.isNaN(reminderAt.getTime()) || now < reminderAt.getTime()) return schedule;
  if (!Number.isNaN(meetingAt.getTime()) && now > meetingAt.getTime() + 5 * 60 * 1000) {
    return { ...schedule, reminderSentAt: schedule.reminderSentAt || new Date().toISOString() };
  }

  const scheduledLabel = formatFollowUpInTimezone(schedule.scheduledAt, schedule.timezone);
  const attendeeUsers =
    schedule.attendeeIds?.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: schedule.attendeeIds } },
          select: { email: true },
        })
      : [];

  const recipients = uniqueEmails([
    lead?.email,
    ...(Array.isArray(lead?.emails) ? lead.emails : []),
    schedule.contact && String(schedule.contact).includes('@') ? schedule.contact : null,
    ...attendeeUsers.map((u) => u.email),
    lead?.assignedTo?.email,
  ]);

  if (recipients.length) {
    const notes = buildNotesBlock(schedule, { isReminder: true });
    await Promise.allSettled(
      recipients.map((to) =>
        sendLeadFollowUpEmail(
          to,
          lead.companyName || 'Lead',
          scheduledLabel,
          'Meet reminder',
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
