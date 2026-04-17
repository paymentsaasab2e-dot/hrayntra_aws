import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import {
  feedbackReminderTemplate,
  interviewCancelledTemplate,
  interviewRescheduledTemplate,
  interviewScheduledTemplate,
} from '../utils/emailTemplates.js';
import logger from '../utils/logger.js';

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
};

const sendMail = async ({ to, subject, html }) => {
  const mailer = getTransporter();
  if (!mailer) {
    logger.warn(`SMTP not configured. Skipping email "${subject}" to ${to}`);
    return { success: false, skipped: true, reason: 'SMTP not configured' };
  }

  const result = await mailer.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  });

  return { success: true, result };
};

export const sendInterviewScheduled = async (candidate, interview, panelMembers) => {
  const subject = `Interview Scheduled: ${interview.job.title} at ${interview.client.companyName}`;
  const html = interviewScheduledTemplate({
    candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    jobTitle: interview.job.title,
    companyName: interview.client.companyName,
    date: interview.scheduledAt,
    timezone: interview.timezone,
    meetingLink: interview.meetingLink,
    panelNames: panelMembers.map((member) => member.user.name),
  });

  const recipients = [candidate.email, ...panelMembers.map((member) => member.user.email).filter(Boolean)];
  return Promise.all(recipients.map((email) => sendMail({ to: email, subject, html })));
};

export const sendInterviewRescheduled = async (
  candidate,
  interview,
  oldSchedule,
  panelMembers = [],
  options = { notifyCandidate: true, notifyInterviewer: true }
) => {
  const subject = `Interview Rescheduled: ${interview.job.title} at ${interview.client.companyName}`;
  const html = interviewRescheduledTemplate({
    candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    jobTitle: interview.job.title,
    companyName: interview.client.companyName,
    oldDate: oldSchedule,
    newDate: interview.scheduledAt,
    timezone: interview.timezone,
    reason: interview.notes,
    meetingLink: interview.meetingLink,
  });

  const recipients = [
    ...(options.notifyCandidate ? [candidate.email] : []),
    ...(options.notifyInterviewer ? panelMembers.map((member) => member.user.email).filter(Boolean) : []),
  ];

  return Promise.all(recipients.map((email) => sendMail({ to: email, subject, html })));
};

export const sendInterviewCancelled = async (candidate, interview) => {
  const subject = `Interview Cancelled: ${interview.job.title} at ${interview.client.companyName}`;
  const html = interviewCancelledTemplate({
    candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    jobTitle: interview.job.title,
    companyName: interview.client.companyName,
    reason: interview.notes,
  });

  return sendMail({ to: candidate.email, subject, html });
};

export const sendFeedbackReminder = async (interviewer, interview, candidate) => {
  const subject = `Reminder: Submit Feedback for ${candidate.firstName} ${candidate.lastName}`.trim();
  const feedbackUrl = `${env.FRONTEND_URL}/interviews?interviewId=${interview.id}&tab=feedback`;
  const html = feedbackReminderTemplate({
    interviewerName: interviewer.name,
    candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    date: interview.scheduledAt,
    timezone: interview.timezone,
    feedbackUrl,
  });

  return sendMail({ to: interviewer.email, subject, html });
};
