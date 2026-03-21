const { Resend } = require('resend');
const { generateOTPEmailHTML, generateOTPEmailText } = require('../templates/otpEmail.template');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

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
      supportEmail: 'support@saasab2e.com',
      year: new Date().getFullYear(),
    });

    const emailText = generateOTPEmailText({
      otp: otp,
      whatsappNumber: whatsappNumber,
      expiresInMinutes: 5,
      supportEmail: 'support@saasab2e.com',
      year: new Date().getFullYear(),
    });

    // Send email directly using Resend
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: 'Your SAASA B2E Verification Code',
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

module.exports = {
  sendOTPEmail,
};
