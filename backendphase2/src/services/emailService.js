import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@saasa.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Send invite email with login credentials
 */
export async function sendInviteEmail(payload) {
  try {
    const { toEmail, toName, loginId, tempPassword, roleName, inviteToken } = payload;
    const loginLink = `${FRONTEND_URL}/login?token=${inviteToken}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SAASA portal login credentials</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #2563eb; margin: 0 0 20px 0; font-size: 24px;">Welcome to SAASA</h1>
    
    <p style="font-size: 16px; margin-bottom: 20px;">Hello ${toName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your account has been created with the role of <strong>${roleName}</strong>. 
      Please use the credentials below to log in:
    </p>
    
    <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; font-weight: 600;">Login ID:</p>
      <div style="font-family: 'Courier New', monospace; font-size: 16px; color: #111827; background: white; padding: 12px; border-radius: 4px; border: 1px solid #d1d5db; letter-spacing: 0.5px;">${loginId}</div>
      
      <p style="margin: 20px 0 10px 0; font-size: 14px; color: #6b7280; font-weight: 600;">Temporary Password:</p>
      <div style="font-family: 'Courier New', monospace; font-size: 16px; color: #111827; background: white; padding: 12px; border-radius: 4px; border: 1px solid #d1d5db; letter-spacing: 0.5px;">${tempPassword}</div>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginLink}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">Log in to portal</a>
    </div>
    
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>Note:</strong> This link expires in 48 hours. You will be asked to set a new password on first login.
      </p>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      If you have any questions, please contact your administrator.
    </p>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      Best regards,<br>
      <strong>The SAASA Team</strong>
    </p>
  </div>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: 'Your SAASA portal login credentials',
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending invite email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(payload) {
  try {
    const { toEmail, toName, loginId, newTempPassword } = payload;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SAASA password has been reset</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #2563eb; margin: 0 0 20px 0; font-size: 24px;">Password Reset</h1>
    
    <p style="font-size: 16px; margin-bottom: 20px;">Hello ${toName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your password has been reset. Please use the new temporary password below to log in:
    </p>
    
    <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; font-weight: 600;">Login ID:</p>
      <div style="font-family: 'Courier New', monospace; font-size: 16px; color: #111827; background: white; padding: 12px; border-radius: 4px; border: 1px solid #d1d5db; letter-spacing: 0.5px; margin-bottom: 20px;">${loginId}</div>
      
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; font-weight: 600;">New Temporary Password:</p>
      <div style="font-family: 'Courier New', monospace; font-size: 16px; color: #111827; background: white; padding: 12px; border-radius: 4px; border: 1px solid #d1d5db; letter-spacing: 0.5px;">${newTempPassword}</div>
    </div>
    
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>Note:</strong> Please change your password on your next login.
      </p>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      If you did not request this password reset, please contact your administrator immediately.
    </p>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      Best regards,<br>
      <strong>The SAASA Team</strong>
    </p>
  </div>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: 'Your SAASA password has been reset',
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}
