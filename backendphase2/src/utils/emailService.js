import { Resend } from 'resend';
import { env } from '../config/env.js';
import { getEmailFromForTrigger } from '../config/emailFromAddresses.js';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send credential invite email to a new team member
 */
function tenantQuerySuffix(tenantDbName) {
  const t = tenantDbName && String(tenantDbName).trim();
  return t ? `&tenantDbName=${encodeURIComponent(t)}` : '';
}

export async function sendCredentialInvite({
  email,
  loginId,
  tempPassword,
  roleName,
  inviteToken,
  tenantDbName,
}) {
  const base = env.FRONTEND_URL;
  const tenantQ = tenantQuerySuffix(tenantDbName);
  const loginLink = `${base}/login?token=${inviteToken}${tenantQ}`;
  const resetPasswordLink = `${base}/reset-password${tenantQ ? `?${tenantQ.slice(1)}` : ''}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to HRYANTRA</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to HRYANTRA</h1>
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
      <a href="${loginLink}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">Login to HRYANTRA</a>
    </div>
    
    <p style="font-size: 13px; color: #374151; margin: 0 0 6px 0;">
      Direct Login URL: <a href="${loginLink}" style="color: #2563eb; text-decoration: none;">${loginLink}</a>
    </p>
    <p style="font-size: 13px; color: #374151; margin: 0 0 20px 0;">
      Reset Password URL: <a href="${resetPasswordLink}" style="color: #2563eb; text-decoration: none;">${resetPasswordLink}</a>
    </p>
    
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
      <strong>The HRYANTRA Team</strong>
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
      from: getEmailFromForTrigger('team.invite_email'),
      to: email,
      subject: `Welcome to HRYANTRA - Your Login Credentials`,
      html,
    });

    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Error sending credential invite email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Employer package purchase — login credentials for Phase 2 workspace.
 */
export async function sendEmployerPurchaseCredentialsEmail({
  email,
  loginId,
  tempPassword,
  tenantDbName,
  packageName,
  organizationName,
}) {
  const base = env.FRONTEND_URL;
  const tenantQ = tenantQuerySuffix(tenantDbName);
  const loginLink = `${base}/login?token=${encodeURIComponent(tempPassword)}${tenantQ}`;
  const planLabel = String(packageName || 'Starter').trim();
  const orgLabel = String(organizationName || '').trim();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your HRYANTRA workspace is ready</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #072654 0%, #2b7fff 100%); padding: 28px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 26px;">Your workspace is ready</h1>
    <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">${planLabel} package activated</p>
  </div>
  <div style="background: #fff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px;">Hello${orgLabel ? ` from <strong>${orgLabel}</strong>` : ''},</p>
    <p style="font-size: 16px;">Thank you for your purchase. Use the credentials below to sign in to your employer workspace:</p>
    <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; font-weight: 600;">Login ID</p>
      <p style="margin: 0 0 16px; font-family: monospace; font-size: 16px; background: #fff; padding: 10px; border-radius: 4px;">${loginId}</p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; font-weight: 600;">Temporary password</p>
      <p style="margin: 0; font-family: monospace; font-size: 16px; background: #fff; padding: 10px; border-radius: 4px;">${tempPassword}</p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${loginLink}" style="display: inline-block; background: #2b7fff; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700;">Log in to HRYANTRA</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">Login URL: <a href="${loginLink}" style="color: #2b7fff;">${loginLink}</a></p>
    <p style="font-size: 14px; color: #64748b; margin-top: 24px;">Keep this email safe. You may change your password after signing in.</p>
  </div>
</body>
</html>`;

  try {
    const result = await resend.emails.send({
      from: getEmailFromForTrigger('client.followup_email'),
      to: email,
      subject: `Your HRYANTRA ${planLabel} workspace login credentials`,
      html,
    });
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Error sending employer purchase credentials email:', error);
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
  tenantDbName,
}) {
  const tenantQ = tenantQuerySuffix(tenantDbName);
  const loginLink = `${env.FRONTEND_URL}/login?token=${inviteToken}${tenantQ}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - HRYANTRA</title>
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
      <a href="${loginLink}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">Login to HRYANTRA</a>
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
      <strong>The HRYANTRA Team</strong>
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
      from: getEmailFromForTrigger('auth.otp_verification'),
      to: email,
      subject: `Password Reset - HRYANTRA`,
      html,
    });

    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
