import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { getEmailFromForTrigger } from '../config/emailFromAddresses.js';
import {
  feedbackReminderTemplate,
  interviewCancelledTemplate,
  interviewRescheduledTemplate,
  interviewScheduledTemplate,
} from '../utils/emailTemplates.js';
import {
  buildInterviewRsvpPublicUrls,
  shouldShowJoinInterviewCta,
} from '../modules/interview/interviewRsvpLinks.js';
import { getActiveTenantDbName } from '../config/prisma.js';
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
    from: getEmailFromForTrigger('interview.legacy_smtp'),
    to,
    subject,
    html,
  });

  return { success: true, result };
};

export const sendInterviewScheduled = async (candidate, interview, panelMembers) => {
  const jobTitle = interview.job?.title || 'Interview';
  const subject = `Interview Scheduled: ${jobTitle}`;
  const showJoinCta = shouldShowJoinInterviewCta({
    meetingLink: interview.meetingLink,
    mode: interview.mode,
    type: interview.type,
  });
  let rsvpLinks = null;
  try {
    if (interview?.id) {
      rsvpLinks = buildInterviewRsvpPublicUrls(interview.id, getActiveTenantDbName());
    }
  } catch (err) {
    console.warn('[email] interview RSVP links failed', err?.message || err);
  }
  const html = interviewScheduledTemplate({
    candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    jobTitle,
    // Candidates must not receive CRM client / company details.
    companyName: '',
    date: interview.scheduledAt,
    timezone: interview.timezone,
    meetingLink: interview.meetingLink,
    panelNames: panelMembers.map((member) => member.user.name),
    showJoinCta,
    rsvpLinks,
    location: interview.location,
    modeLabel: interview.mode,
  });

  // Candidate email without client details.
  const candidateMail = candidate.email
    ? sendMail({ to: candidate.email, subject, html })
    : Promise.resolve();

  // Panel may still see client context.
  const panelCompany = interview.client?.companyName || '';
  const panelSubject = panelCompany
    ? `Interview Scheduled: ${jobTitle} at ${panelCompany}`
    : subject;
  const panelHtml = interviewScheduledTemplate({
    candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    jobTitle,
    companyName: panelCompany,
    date: interview.scheduledAt,
    timezone: interview.timezone,
    meetingLink: interview.meetingLink,
    panelNames: panelMembers.map((member) => member.user.name),
    showJoinCta,
    rsvpLinks: null,
    location: interview.location,
    modeLabel: interview.mode,
  });
  const panelMails = panelMembers
    .map((member) => member.user?.email)
    .filter(Boolean)
    .map((email) => sendMail({ to: email, subject: panelSubject, html: panelHtml }));

  return Promise.all([candidateMail, ...panelMails]);
};

export const sendInterviewRescheduled = async (
  candidate,
  interview,
  oldSchedule,
  panelMembers = [],
  options = { notifyCandidate: true, notifyInterviewer: true }
) => {
  const jobTitle = interview.job?.title || 'Interview';
  const panelCompany = interview.client?.companyName || '';

  const tasks = [];
  let rsvpLinks = null;
  if (options.includeRsvp !== false && interview?.id) {
    try {
      rsvpLinks = buildInterviewRsvpPublicUrls(interview.id, getActiveTenantDbName());
    } catch {
      rsvpLinks = null;
    }
  }
  if (options.notifyCandidate && candidate.email) {
    tasks.push(
      sendMail({
        to: candidate.email,
        subject: `Interview Rescheduled: ${jobTitle}`,
        html: interviewRescheduledTemplate({
          candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
          jobTitle,
          companyName: '',
          oldDate: oldSchedule,
          newDate: interview.scheduledAt,
          timezone: interview.timezone,
          reason: interview.notes,
          meetingLink: interview.meetingLink,
          showJoinCta: shouldShowJoinInterviewCta({
            meetingLink: interview.meetingLink,
            mode: interview.mode,
            type: interview.type,
          }),
          rsvpLinks,
        }),
      }),
    );
  }

  if (options.notifyInterviewer) {
    const panelSubject = panelCompany
      ? `Interview Rescheduled: ${jobTitle} at ${panelCompany}`
      : `Interview Rescheduled: ${jobTitle}`;
    const panelHtml = interviewRescheduledTemplate({
      candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
      jobTitle,
      companyName: panelCompany,
      oldDate: oldSchedule,
      newDate: interview.scheduledAt,
      timezone: interview.timezone,
      reason: interview.notes,
      meetingLink: interview.meetingLink,
    });
    for (const member of panelMembers) {
      if (!member.user?.email) continue;
      tasks.push(sendMail({ to: member.user.email, subject: panelSubject, html: panelHtml }));
    }
  }

  return Promise.all(tasks);
};

export const sendInterviewProposalRejected = async (candidate, interview, { proposedAt, reason } = {}) => {
  if (!candidate?.email) return null;
  const jobTitle = interview.job?.title || 'Interview';
  let rsvpLinks = null;
  try {
    rsvpLinks = buildInterviewRsvpPublicUrls(interview.id, getActiveTenantDbName());
  } catch {
    rsvpLinks = null;
  }
  const html = interviewScheduledTemplate({
    candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    jobTitle,
    companyName: '',
    date: interview.scheduledAt,
    timezone: interview.timezone,
    meetingLink: interview.meetingLink,
    panelNames: (interview.panel || []).map((member) => member.user?.name).filter(Boolean),
    showJoinCta: shouldShowJoinInterviewCta({
      meetingLink: interview.meetingLink,
      mode: interview.mode,
      type: interview.type,
    }),
    rsvpLinks,
    location: interview.location,
    modeLabel: interview.mode,
  });
  return sendMail({
    to: candidate.email,
    subject: `Interview time update: ${jobTitle}`,
    html: html.replace(
      'your interview has been scheduled',
      `the recruiter could not accept the proposed time${
        reason ? ` (${String(reason).replace(/</g, '')})` : ''
      }. The original interview time still stands`,
    ),
  });
};

export const sendInterviewCancelled = async (candidate, interview) => {
  const jobTitle = interview.job?.title || 'Interview';
  const subject = `Interview Cancelled: ${jobTitle}`;
  const html = interviewCancelledTemplate({
    candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    jobTitle,
    companyName: '',
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
