const { Resend } = require('resend');
const { generateOTPEmailHTML, generateOTPEmailText } = require('../templates/otpEmail.template');
const {
  generateJobRecommendationEmailHTML,
  generateJobRecommendationEmailText,
} = require('../templates/jobRecommendationEmail.template');
const { getEmailFromForTrigger } = require('../config/emailFromAddresses');

const resend = new Resend(process.env.RESEND_API_KEY);
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@hryantra.com';

function formatInterviewDateTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: process.env.INTERVIEW_TIMEZONE || 'Asia/Kolkata',
  }).format(date);
}

/**
 * Send OTP via email directly using inline HTML template
 * @param {string} otp - 6-digit OTP code
 * @param {string} recipientEmail - Recipient email entered by user
 * @param {string} whatsappNumber - WhatsApp number for reference
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>} Promise with email send result
 */
async function sendOTPEmail(otp, recipientEmail, whatsappNumber) {
  try {
    if (!recipientEmail) {
      return {
        success: false,
        error: 'Recipient email is required',
      };
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set in environment variables');
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    // Generate email HTML and text using template
    const emailHTML = generateOTPEmailHTML({
      otp: otp,
      whatsappNumber: whatsappNumber,
      expiresInMinutes: 5,
      supportEmail: SUPPORT_EMAIL,
      year: new Date().getFullYear(),
    });

    const emailText = generateOTPEmailText({
      otp: otp,
      whatsappNumber: whatsappNumber,
      expiresInMinutes: 5,
      supportEmail: SUPPORT_EMAIL,
      year: new Date().getFullYear(),
    });

    // Send email directly using Resend
    const { data, error } = await resend.emails.send({
      from: getEmailFromForTrigger('auth.otp_verification'),
      to: recipientEmail,
      subject: 'Your HRYANTRA Verification Code',
      html: emailHTML,
      text: emailText,
    });

    if (error) {
      console.error('Error sending OTP email:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }

    console.log('OTP email sent successfully to', recipientEmail, '| Message ID:', data?.id);
    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error('Exception sending OTP email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

async function sendJobRecommendationEmail({
  toEmail,
  candidateName,
  jobTitle,
  companyName,
  matchScore,
  jobUrl,
}) {
  try {
    const recipientEmail = String(toEmail || '').trim();
    if (!recipientEmail) {
      return { success: false, error: 'Recipient email is required' };
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('[email] RESEND_API_KEY missing — skipping job recommendation email');
      return { success: false, error: 'Email service not configured' };
    }

    const payload = {
      candidateName,
      jobTitle,
      companyName,
      matchScore,
      jobUrl,
      supportEmail: SUPPORT_EMAIL,
      year: new Date().getFullYear(),
    };

    const { data, error } = await resend.emails.send({
      from: getEmailFromForTrigger('job.recommendation'),
      to: recipientEmail,
      subject: `Recommended for you: ${jobTitle} (${matchScore}% CV fit)`,
      html: generateJobRecommendationEmailHTML(payload),
      text: generateJobRecommendationEmailText(payload),
    });

    if (error) {
      console.error('[email] job recommendation failed:', error);
      return { success: false, error: error.message || 'Failed to send email' };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[email] job recommendation exception:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

async function sendInterviewStatusEmail({
  toEmail,
  recipientName,
  counterpartName,
  requestId,
  interviewType,
  scheduledAt,
  slotLabel,
  roomUrl,
  reminder = false,
}) {
  try {
    const recipientEmail = String(toEmail || '').trim();
    if (!recipientEmail) {
      return { success: false, error: 'Recipient email is required' };
    }
    if (!process.env.RESEND_API_KEY) {
      console.warn('[email] RESEND_API_KEY missing — skipping interview email');
      return { success: false, error: 'Email service not configured' };
    }

    const whenText = formatInterviewDateTime(scheduledAt);
    const safeRecipient = String(recipientName || 'there').trim() || 'there';
    const safeCounterpart = String(counterpartName || 'Participant').trim() || 'Participant';
    const safeRequestId = String(requestId || '').trim() || 'N/A';
    const safeInterviewType = String(interviewType || 'Interview').trim();
    const safeSlot = String(slotLabel || '').trim();
    const safeRoomUrl = String(roomUrl || '').trim();

    const subject = reminder
      ? `Reminder: Interview in 1 hour (${safeRequestId})`
      : `Interview scheduled: ${safeRequestId}`;

    const intro = reminder
      ? `This is a reminder that your interview starts in about 1 hour.`
      : `Your interview has been scheduled successfully.`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h2 style="margin-bottom: 8px; color: #0284c7;">HRYANTRA Interview Update</h2>
        <p>Hi ${safeRecipient},</p>
        <p>${intro}</p>
        <div style="border:1px solid #dbeafe; background:#f0f9ff; border-radius:10px; padding:12px; margin:12px 0;">
          <p style="margin:0 0 6px;"><strong>Request ID:</strong> ${safeRequestId}</p>
          <p style="margin:0 0 6px;"><strong>Interview Type:</strong> ${safeInterviewType}</p>
          <p style="margin:0 0 6px;"><strong>With:</strong> ${safeCounterpart}</p>
          <p style="margin:0 0 6px;"><strong>Scheduled Time:</strong> ${whenText}</p>
          ${safeSlot ? `<p style="margin:0;"><strong>Slot:</strong> ${safeSlot}</p>` : ''}
        </div>
        ${
          safeRoomUrl
            ? `<p><a href="${safeRoomUrl}" style="display:inline-block; background:#0284c7; color:#fff; text-decoration:none; padding:10px 14px; border-radius:8px;">Open Interview Room</a></p>`
            : ''
        }
        <p>If you need any help, contact us at ${SUPPORT_EMAIL}.</p>
      </div>
    `;

    const text = [
      `Hi ${safeRecipient},`,
      '',
      intro,
      `Request ID: ${safeRequestId}`,
      `Interview Type: ${safeInterviewType}`,
      `With: ${safeCounterpart}`,
      `Scheduled Time: ${whenText}`,
      safeSlot ? `Slot: ${safeSlot}` : '',
      safeRoomUrl ? `Interview Room: ${safeRoomUrl}` : '',
      '',
      `Support: ${SUPPORT_EMAIL}`,
    ]
      .filter(Boolean)
      .join('\n');

    const { data, error } = await resend.emails.send({
      from: getEmailFromForTrigger(reminder ? 'interview.reminder' : 'interview.scheduled'),
      to: recipientEmail,
      subject,
      html,
      text,
    });

    if (error) {
      console.error('[email] interview status email failed:', error);
      return { success: false, error: error.message || 'Failed to send email' };
    }
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[email] interview status email exception:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

module.exports = {
  sendOTPEmail,
  sendJobRecommendationEmail,
  sendInterviewStatusEmail,
};
