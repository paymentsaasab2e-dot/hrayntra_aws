const { Resend } = require('resend');
const { generateOTPEmailHTML, generateOTPEmailText } = require('../templates/otpEmail.template');
const {
  generateJobRecommendationEmailHTML,
  generateJobRecommendationEmailText,
} = require('../templates/jobRecommendationEmail.template');
const { getEmailFromForTrigger } = require('../config/emailFromAddresses');

const resend = new Resend(process.env.RESEND_API_KEY);
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@hryantra.com';

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

module.exports = {
  sendOTPEmail,
  sendJobRecommendationEmail,
};
