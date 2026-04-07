/**
 * OTP Email Template
 * This template is used to generate HTML for OTP verification emails
 */

/**
 * Generate OTP email HTML
 * @param {Object} data - Email data
 * @param {string} data.otp - 6-digit OTP code
 * @param {string} data.whatsappNumber - User's WhatsApp number
 * @param {number} data.expiresInMinutes - OTP expiration time in minutes
 * @param {string} data.supportEmail - Support email address
 * @param {number} data.year - Current year
 * @returns {string} HTML email content
 */
function generateOTPEmailHTML(data) {
  const {
    otp = '000000',
    whatsappNumber = '',
    expiresInMinutes = 5,
    supportEmail = 'support@saasab2e.com',
    year = new Date().getFullYear(),
  } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code - SAASA B2E</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #239CD2 0%, #1a7ba8 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">SAASA B2E</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px; background-color: #f8f9fa;">
              <h2 style="color: #239CD2; margin-top: 0; margin-bottom: 20px; font-size: 24px;">Verification Code</h2>
              
              <p style="font-size: 16px; color: #555555; line-height: 1.6; margin-bottom: 10px;">
                Hello,
              </p>
              
              <p style="font-size: 16px; color: #555555; line-height: 1.6; margin-bottom: 30px;">
                You have requested a verification code for WhatsApp number: <strong style="color: #333333;">${whatsappNumber}</strong>
              </p>
              
              <!-- OTP Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 30px; background-color: #ffffff; border: 2px dashed #239CD2; border-radius: 8px; margin: 30px 0;">
                    <p style="margin: 0 0 15px 0; font-size: 14px; color: #666666; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">
                      Your Verification Code
                    </p>
                    <p style="margin: 0; font-size: 36px; font-weight: bold; color: #239CD2; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${otp}
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 14px; color: #888888; line-height: 1.6; margin-top: 30px; margin-bottom: 10px;">
                This code will expire in <strong style="color: #333333;">${expiresInMinutes} minutes</strong>. Please do not share this code with anyone.
              </p>
              
              <p style="font-size: 14px; color: #888888; line-height: 1.6; margin-top: 20px; margin-bottom: 0;">
                If you didn't request this code, please ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #ffffff; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                © ${year} SAASA B2E. All rights reserved.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #999999; text-align: center;">
                Need help? Contact us at <a href="mailto:${supportEmail}" style="color: #239CD2; text-decoration: none;">${supportEmail}</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of OTP email
 * @param {Object} data - Email data
 * @returns {string} Plain text email content
 */
function generateOTPEmailText(data) {
  const {
    otp = '000000',
    whatsappNumber = '',
    expiresInMinutes = 5,
    supportEmail = 'support@saasab2e.com',
    year = new Date().getFullYear(),
  } = data;

  return `
SAASA B2E - Verification Code

Hello,

You have requested a verification code for WhatsApp number: ${whatsappNumber}

Your Verification Code: ${otp}

This code will expire in ${expiresInMinutes} minutes. Please do not share this code with anyone.

If you didn't request this code, please ignore this email.

© ${year} SAASA B2E. All rights reserved.
Need help? Contact us at ${supportEmail}
  `.trim();
}

// Export for use in Node.js/TypeScript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateOTPEmailHTML,
    generateOTPEmailText,
  };
}

// Export for ES6 modules
if (typeof exports !== 'undefined') {
  exports.generateOTPEmailHTML = generateOTPEmailHTML;
  exports.generateOTPEmailText = generateOTPEmailText;
}
