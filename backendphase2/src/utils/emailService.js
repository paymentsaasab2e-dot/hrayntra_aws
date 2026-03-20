import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Send credential invite email to a new team member
 */
export async function sendCredentialInvite({
  email,
  loginId,
  tempPassword,
  roleName,
  inviteToken,
}) {
  const loginLink = `${FRONTEND_URL}/login?token=${inviteToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SAASA</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to SAASA</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your account has been created with the role of <strong>${roleName}</strong>. 
      Please use the credentials below to log in:
    </p>
    
    <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;"><strong>Login ID:</strong></p>
      <p style="margin: 0 0 20px 0; font-size: 16px; font-family: monospace; color: #111827; background: white; padding: 10px; border-radius: 4px;">${loginId}</p>
      
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;"><strong>Temporary Password:</strong></p>
      <p style="margin: 0; font-size: 16px; font-family: monospace; color: #111827; background: white; padding: 10px; border-radius: 4px;">${tempPassword}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginLink}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">Login to SAASA</a>
    </div>
    
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>⚠️ Important:</strong> You will be required to set a new password on your first login. 
        Please keep this temporary password secure until you change it.
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
  
  <div style="text-align: center; margin-top: 20px; padding: 20px; color: #6b7280; font-size: 12px;">
    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
  </div>
</body>
</html>
  `;

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'SAASA <noreply@saasa.com>',
      to: email,
      subject: `Welcome to SAASA - Your Login Credentials`,
      html,
    });

    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Error sending credential invite email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({
  email,
  tempPassword,
  inviteToken,
}) {
  const loginLink = `${FRONTEND_URL}/login?token=${inviteToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - SAASA</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your password has been reset. Please use the new temporary password below to log in:
    </p>
    
    <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;"><strong>New Temporary Password:</strong></p>
      <p style="margin: 0; font-size: 16px; font-family: monospace; color: #111827; background: white; padding: 10px; border-radius: 4px;">${tempPassword}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginLink}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">Login to SAASA</a>
    </div>
    
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>⚠️ Important:</strong> You will be required to set a new password on your next login. 
        Please keep this temporary password secure until you change it.
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
  
  <div style="text-align: center; margin-top: 20px; padding: 20px; color: #6b7280; font-size: 12px;">
    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
  </div>
</body>
</html>
  `;

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'SAASA <noreply@saasa.com>',
      to: email,
      subject: `Password Reset - SAASA`,
      html,
    });

    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
