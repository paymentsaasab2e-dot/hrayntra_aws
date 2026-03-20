import { resend, getEmailFrom } from '../config/email.js';
import { env } from '../config/env.js';
import { otpTemplate } from './templates/otp.template.js';
import { welcomeTemplate } from './templates/welcome.template.js';
import { interviewTemplate } from './templates/interview.template.js';
import { placementTemplate } from './templates/placement.template.js';
import { leadFollowUpTemplate } from './templates/lead-followup.template.js';
import { matchSubmissionTemplate } from './templates/match-submission.template.js';
import logger from '../utils/logger.js';

export const sendEmail = async (to, subject, html) => {
  try {
    if (!env.RESEND_API_KEY) {
      logger.warn('RESEND_API_KEY not configured, email not sent');
      return { success: false, error: 'Email service not configured' };
    }

    const result = await resend.emails.send({
      from: getEmailFrom(),
      to,
      subject,
      html,
    });

    logger.info(`Email sent to ${to}: ${subject}`);
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
};

export const sendOtpEmail = async (to, otp, name) => {
  return sendEmail(to, 'OTP Verification', otpTemplate(otp, name));
};

export const sendWelcomeEmail = async (to, name) => {
  return sendEmail(to, 'Welcome to SAASA Recruitment', welcomeTemplate(name, to));
};

export const sendInterviewEmail = async (to, candidateName, jobTitle, scheduledAt, location, meetingLink) => {
  return sendEmail(
    to,
    'Interview Scheduled',
    interviewTemplate(candidateName, jobTitle, scheduledAt, location, meetingLink)
  );
};

export const sendPlacementEmail = async (to, candidateName, jobTitle, startDate, companyName) => {
  return sendEmail(
    to,
    'Placement Confirmed',
    placementTemplate(candidateName, jobTitle, startDate, companyName)
  );
};

export const sendLeadFollowUpEmail = async (to, leadCompanyName, followUpDate, followUpType, notes) => {
  return sendEmail(
    to,
    'Follow-up Scheduled',
    leadFollowUpTemplate(leadCompanyName, followUpDate, followUpType, notes)
  );
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
}) => {
  return sendEmail(
    to,
    subject || `Candidate Submission: ${jobTitle}`,
    matchSubmissionTemplate({
      clientName,
      jobTitle,
      recruiterName,
      message,
      candidates,
      portalUrl,
    })
  );
};
