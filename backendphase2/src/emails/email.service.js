import { resend, getEmailFrom } from '../config/email.js';
import { getEmailFromForTrigger } from '../config/emailFromAddresses.js';
import { env, rewriteClientReviewEmailHtml } from '../config/env.js';
import { interviewTemplate } from './templates/interview.template.js';
import { placementTemplate } from './templates/placement.template.js';
import { isNotificationTriggerEnabled } from '../modules/setting/notification-trigger-settings.js';
import { renderNotificationTriggerEmail } from '../modules/setting/notification-trigger-template-settings.js';
import logger from '../utils/logger.js';
import { isDeliverableEmail, sanitizeEmailSubject } from '../utils/emailDeliverability.js';

export const sendEmail = async (to, subject, html, triggerId) => {
  try {
    const recipients = (Array.isArray(to) ? to : [to])
      .map((item) => String(item || '').trim())
      .filter((item) => isDeliverableEmail(item));
    if (!recipients.length) {
      logger.warn(`Email not sent: no valid recipient (${to})`);
      return { success: false, error: 'Invalid recipient email' };
    }
    if (!env.RESEND_API_KEY) {
      logger.warn('RESEND_API_KEY not configured, email not sent');
      return { success: false, error: 'Email service not configured' };
    }

    const from = triggerId ? getEmailFromForTrigger(triggerId) : getEmailFrom();
    const safeSubject = sanitizeEmailSubject(subject);
    const result = await resend.emails.send({
      from,
      to: recipients,
      subject: safeSubject,
      html,
    });
    const deliveryId = result?.data?.id || result?.id;
    const resendError = result?.error;
    const errorMessage =
      resendError?.message ||
      (typeof resendError === 'string' ? resendError : '');
    if (!deliveryId && (errorMessage || resendError)) {
      const message = errorMessage || 'Resend rejected the email';
      logger.error(`Email not delivered to ${recipients.join(', ')}: ${safeSubject} — ${message}`);
      return { success: false, error: message, data: result };
    }

    logger.info(`Email sent to ${recipients.join(', ')}: ${safeSubject}${deliveryId ? ` (id ${deliveryId})` : ''}`);
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
};

export const sendOtpEmail = async (to, otp, name) => {
  const triggerEnabled = await isNotificationTriggerEnabled('auth.otp_verification', {
    aliases: ['otp verification'],
  });
  if (!triggerEnabled) return { success: true, skipped: true };
  const { subject, html } = await renderNotificationTriggerEmail('auth.otp_verification', null, {
    recipientName: name,
    otp,
  });
  return sendEmail(to, subject, html, 'auth.otp_verification');
};

export const sendWelcomeEmail = async (to, name) => {
  const triggerEnabled = await isNotificationTriggerEnabled('auth.welcome_email', {
    aliases: ['welcome email'],
  });
  if (!triggerEnabled) return { success: true, skipped: true };

  const loginUrl = `${env.FRONTEND_URL || ''}/login`;
  const { subject, html } = await renderNotificationTriggerEmail('auth.welcome_email', null, {
    recipientName: name,
    recipientEmail: to,
    loginUrl,
  });

  return sendEmail(to, subject, html, 'auth.welcome_email');
};

export const sendInterviewEmail = async (to, candidateName, jobTitle, scheduledAt, location, meetingLink, companyName = '') => {
  const triggerEnabled = await isNotificationTriggerEnabled('interview.candidate_scheduled', {
    aliases: ['interview scheduled'],
  });
  if (!triggerEnabled) return { success: true, skipped: true };

  const rendered = await renderNotificationTriggerEmail('interview.candidate_scheduled', null, {
    candidateName,
    jobTitle,
    companyName: companyName || 'N/A',
    scheduledAt: scheduledAt || 'TBD',
    location: location || 'N/A',
    meetingLink: meetingLink || 'N/A',
  });

  if (rendered.effective?.customized) {
    return sendEmail(to, rendered.subject, rendered.html, 'interview.candidate_scheduled');
  }

  return sendEmail(
    to,
    'Interview Scheduled',
    interviewTemplate(candidateName, jobTitle, scheduledAt, location, meetingLink),
    'interview.candidate_scheduled',
  );
};

export const sendPlacementEmail = async (to, candidateName, jobTitle, startDate, companyName) => {
  const triggerEnabled = await isNotificationTriggerEnabled('placement.confirmed_email', {
    aliases: ['placement confirmed', 'placement confirmation'],
  });
  if (!triggerEnabled) return { success: true, skipped: true };

  const rendered = await renderNotificationTriggerEmail('placement.confirmed_email', null, {
    recipientName: candidateName,
    candidateName,
    jobTitle,
    startDate: startDate || 'To be confirmed',
    companyName: companyName || '',
  });

  if (rendered.effective?.customized) {
    return sendEmail(to, rendered.subject, rendered.html, 'placement.confirmed_email');
  }

  return sendEmail(
    to,
    'Placement Confirmed',
    placementTemplate(candidateName, jobTitle, startDate, companyName),
    'placement.confirmed_email',
  );
};

export const sendLeadFollowUpEmail = async (to, leadCompanyName, followUpDate, followUpType, notes) => {
  const triggerEnabled = await isNotificationTriggerEnabled('lead.followup_email', {
    aliases: ['lead follow up', 'lead followup'],
  });
  if (!triggerEnabled) return { success: true, skipped: true };

  const local = String(to || '').split('@')[0] || 'there';
  const recipientName = local ? local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : 'There';

  const { subject, html } = await renderNotificationTriggerEmail('lead.followup_email', null, {
    recipientName,
    leadCompanyName,
    followUpDate,
    followUpType,
    notes,
  });

  return sendEmail(to, subject, html, 'lead.followup_email');
};

export const sendMatchSubmissionEmail = async ({
  to,
  clientName,
  jobTitle,
  recruiterName,
  message,
  candidates,
  portalUrl,
  subject,
  forceSend = false,
}) => {
  const triggerEnabled = await isNotificationTriggerEnabled('match.submission_email', {
    aliases: ['match submission', 'submission email'],
  });
  if (!forceSend && !triggerEnabled) return { success: true, skipped: true };

  const candidatesHtml = (Array.isArray(candidates) ? candidates : [])
    .map(
      (candidate) => `
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 12px;">
          <div style="font-size: 16px; font-weight: 700; color: #111827;">${candidate.name || 'Candidate'}</div>
          <div style="margin-top: 6px; font-size: 14px; color: #4b5563;">
            ${candidate.currentTitle || 'Candidate'}${candidate.currentCompany ? ` • ${candidate.currentCompany}` : ''}
          </div>
          <div style="margin-top: 10px; font-size: 14px; color: #374151;">
            <div><strong>Experience:</strong> ${candidate.experience || 0} years</div>
            <div><strong>Location:</strong> ${candidate.location || 'Not shared'}</div>
            <div><strong>Skills:</strong> ${(candidate.skills || []).slice(0, 6).join(', ') || 'Not shared'}</div>
            <div><strong>Email:</strong> ${candidate.email || 'Not shared'}</div>
            <div><strong>Phone:</strong> ${candidate.phone || 'Not shared'}</div>
          </div>
        </div>
      `,
    )
    .join('');

  const { subject: templateSubject, html, effective } = await renderNotificationTriggerEmail(
    'match.submission_email',
    null,
    {
      clientName,
      jobTitle,
      recruiterName,
      message,
      candidatesHtml,
      portalUrl,
    }
  );

  const finalSubject = effective?.customized ? templateSubject : subject || templateSubject;
  const finalHtml = rewriteClientReviewEmailHtml(html, env.FRONTEND_URL);
  logger.info(
    `[match.submission_email] to=${Array.isArray(to) ? to.join(',') : to} portalUrl=${portalUrl} frontend=${env.FRONTEND_URL}`,
  );

  return sendEmail(to, finalSubject, finalHtml, 'match.submission_email');
};

/**
 * Send a custom HTML email using the Resend service.
 * This is useful for sending templated emails that are not covered by the
 * existing helper functions (e.g., login credential emails).
 *
 * @param {string} to          Recipient email address.
 * @param {string} subject     Email subject line.
 * @param {string} html        Fully‑formed HTML string for the email body.
 * @returns {Promise<{success:boolean, data?:any, error?:string}>}
 */
export const sendCustomHtmlEmail = async (to, subject, html) => {
  // Re‑use the generic sendEmail implementation which already handles the
  // RESEND_API_KEY check and logging.
  return sendEmail(to, subject, html);
};
