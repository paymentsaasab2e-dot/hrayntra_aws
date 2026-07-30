/**
 * Client scheduled meeting invites + timed reminders (email only).
 */

import { prisma } from '../../config/prisma.js';
import { sendLeadFollowUpEmail } from '../../emails/email.service.js';
import {
  buildFollowUpEmailDetailsHtml,
  formatFollowUpInTimezone,
  reminderOffsetMs,
  resolveScheduleAttendees,
} from '../lead/leadFollowUpNotify.js';

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

export function normalizeClientMeetingSchedule(raw, scheduledAtIso) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || raw.meetingType || raw.followUpType || 'Meet').trim() || 'Meet';
  const scheduledAt = scheduledAtIso
    ? new Date(scheduledAtIso)
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

function buildNotesBlock(schedule, options = {}) {
  return buildFollowUpEmailDetailsHtml(schedule, options);
}

async function collectClientEmailRecipients(client, schedule) {
  const contactRows = await prisma.contact.findMany({
    where: { clientId: client.id, type: 'CLIENT' },
    select: { email: true },
  });

  const attendeeUsers =
    schedule.attendeeIds?.length > 0
      ? await resolveScheduleAttendees(schedule)
      : [];

  return uniqueEmails([
    ...(Array.isArray(client.emails) ? client.emails : []),
    client.teamMemberEmail,
    schedule.contact && String(schedule.contact).includes('@') ? schedule.contact : null,
    ...contactRows.map((row) => row.email),
    ...attendeeUsers.map((u) => u.email),
    client.assignedTo?.email,
  ]);
}

export async function sendClientMeetScheduleInvites({ client, schedule }) {
  if (!client || !schedule) return schedule;

  const scheduledLabel = formatFollowUpInTimezone(schedule.scheduledAt, schedule.timezone);
  const emails = await collectClientEmailRecipients(client, schedule);
  const attendeeUsers = await resolveScheduleAttendees(schedule);
  const notes = buildNotesBlock(schedule, {
    isReminder: false,
    scheduledLabel,
    attendees: attendeeUsers,
  });
  const followUpType = schedule.type || 'Meet';

  if (emails.length) {
    await Promise.allSettled(
      emails.map((to) =>
        sendLeadFollowUpEmail(to, client.companyName || 'Client', scheduledLabel, followUpType, notes),
      ),
    );
  } else {
    console.warn('[client-meeting] scheduled but no client email recipients found');
  }

  return {
    ...schedule,
    inviteSentAt: new Date().toISOString(),
    inviteRecipientCount: emails.length,
  };
}

export async function sendClientMeetReminderEmails({ client, meeting, schedule }) {
  if (!schedule || !schedule.reminderAt || schedule.reminderSentAt) return schedule;

  const reminderAt = new Date(schedule.reminderAt);
  const meetingAt = new Date(schedule.scheduledAt);
  const now = Date.now();
  if (Number.isNaN(reminderAt.getTime()) || now < reminderAt.getTime()) return schedule;
  if (!Number.isNaN(meetingAt.getTime()) && now > meetingAt.getTime() + 5 * 60 * 1000) {
    return { ...schedule, reminderSentAt: schedule.reminderSentAt || new Date().toISOString() };
  }

  const scheduledLabel = formatFollowUpInTimezone(schedule.scheduledAt, schedule.timezone);
  const emails = await collectClientEmailRecipients(client, schedule);
  const attendeeUsers = await resolveScheduleAttendees(schedule);
  const notes = buildNotesBlock(schedule, {
    isReminder: true,
    scheduledLabel,
    attendees: attendeeUsers,
  });
  const followUpType = `${schedule.type || meeting?.meetingType || 'Meet'} reminder`;

  if (emails.length) {
    await Promise.allSettled(
      emails.map((to) =>
        sendLeadFollowUpEmail(to, client.companyName || 'Client', scheduledLabel, followUpType, notes),
      ),
    );
  }

  return {
    ...schedule,
    reminderSentAt: new Date().toISOString(),
  };
}
