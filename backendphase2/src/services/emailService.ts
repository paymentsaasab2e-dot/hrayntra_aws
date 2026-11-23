import { Resend } from 'resend';
import { env } from '../config/env.js';
import { getEmailFromForTrigger } from '../config/emailFromAddresses.js';

let resendClient: Resend | null = null;
function getResend() {
  if (resendClient) return resendClient;
  const key = String(process.env.RESEND_API_KEY || '').trim();
  if (!key) {
    throw new Error('Email service not configured (RESEND_API_KEY)');
  }
  resendClient = new Resend(key);
  return resendClient;
}

interface InviteEmailPayload {
  toEmail: string;
  toName: string;
  loginId: string;
  tempPassword: string;
  roleName: string;
  inviteToken: string;
  senderUserId?: string | null;
  /** Mongo workspace DB name — required for multi-tenant login (x-tenant-db-name). */
  tenantDbName?: string;
}

interface PasswordResetEmailPayload {
  toEmail: string;
  toName: string;
  loginId: string;
  newTempPassword: string;
}

/**
 * Send invite email with login credentials
 */
export async function sendInviteEmail(
  payload: InviteEmailPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const { toEmail, toName, loginId, tempPassword, roleName, tenantDbName } = payload;
    const base = String(env.FRONTEND_URL || '').replace(/\/$/, '');
    const tenant = String(tenantDbName || '').trim();
    const loginLink = tenant
      ? `${base}/login?tenantDbName=${encodeURIComponent(tenant)}`
      : `${base}/login`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your HRYANTRA portal login credentials</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #2563eb; margin: 0 0 20px 0; font-size: 24px;">Welcome to HRYANTRA</h1>
    
    <p style="font-size: 16px; margin-bottom: 20px;">Hello ${toName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your account has been created with the role of <strong>${roleName}</strong>. 
      Use the company login link below, then enter your Login ID and temporary password:
    </p>
    ${tenant ? `<p style="font-size: 14px; color: #1e40af; margin: 0 0 16px 0; padding: 12px 14px; background: #eff6ff; border-radius: 6px; border: 1px solid #bfdbfe;">
      <strong>Open company login</strong> so HRyantra loads your workspace, then sign in with the credentials below.
    </p>` : ''}
    
    <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; font-weight: 600;">Login ID:</p>
      <div style="font-family: 'Courier New', monospace; font-size: 16px; color: #111827; background: white; padding: 12px; border-radius: 4px; border: 1px solid #d1d5db; letter-spacing: 0.5px;">${loginId}</div>
      
      <p style="margin: 20px 0 10px 0; font-size: 14px; color: #6b7280; font-weight: 600;">Temporary Password:</p>
      <div style="font-family: 'Courier New', monospace; font-size: 16px; color: #111827; background: white; padding: 12px; border-radius: 4px; border: 1px solid #d1d5db; letter-spacing: 0.5px;">${tempPassword}</div>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginLink}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">Open company login</a>
    </div>
    <p style="font-size: 13px; color: #374151; margin: 0 0 16px 0;">
      Company login URL: <a href="${loginLink}" style="color: #2563eb; word-break: break-all;">${loginLink}</a>
    </p>
    
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>Note:</strong> You will be asked to set a new password on first login.
      </p>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      If you have any questions, please contact your administrator.
    </p>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      Best regards,<br>
      <strong>The HRYANTRA Team</strong>
    </p>
  </div>
</body>
</html>
    `;

    const result = await getResend().emails.send({
      from: getEmailFromForTrigger('team.invite_email'),
      to: toEmail,
      subject: 'Your HRYANTRA portal login credentials',
      html,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error sending invite email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  payload: PasswordResetEmailPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const { toEmail, toName, loginId, newTempPassword } = payload;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your HRYANTRA password has been reset</title>
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
      <strong>The HRYANTRA Team</strong>
    </p>
  </div>
</body>
</html>
    `;

    const result = await getResend().emails.send({
      from: getEmailFromForTrigger('auth.otp_verification'),
      to: toEmail,
      subject: 'Your HRYANTRA password has been reset',
      html,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}
