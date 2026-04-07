import { Resend } from 'resend';
import { prisma } from '../config/prisma.js';
import { oauthTokenService } from '../modules/oauth/oauth-token.service.js';
import { interviewScheduledTemplate } from '../utils/emailTemplates.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@saasa.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function logEmailSent({ provider, fromEmail, toEmail, subject, html }) {
  console.log('\n=== EMAIL SENT ===');
  console.log(`Provider: ${provider || 'unknown'}`);
  console.log(`From: ${fromEmail || 'unknown'}`);
  console.log(`To: ${toEmail}`);
  console.log(`Subject: ${subject}`);
  console.log('Body:');
  console.log(html);
  console.log('==================\n');
}

function toBase64Url(value = '') {
  return Buffer.from(String(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function trySendWithConnectedGmail({ senderUserId, toEmail, subject, html }) {
  if (!senderUserId) return { success: false, skipped: true };

  const oauth = await prisma.userOAuthTokens.findUnique({ where: { userId: senderUserId } });
  if (!oauth?.gmailConnected || !oauth?.googleEmail) {
    return { success: false, skipped: true };
  }

  const scopes = Array.isArray(oauth.googleScope) ? oauth.googleScope.map(String) : [];
  const canSend = scopes.some(
    (scope) => scope === 'https://www.googleapis.com/auth/gmail.send' || scope === 'https://mail.google.com/'
  );
  if (!canSend) {
    return { success: false, skipped: true };
  }

  const accessToken = await oauthTokenService.getValidGoogleAccessToken(senderUserId);
  if (!accessToken) {
    return { success: false, skipped: true };
  }

  const rawMessage = [
    `From: ${oauth.googleEmail}`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ].join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: toBase64Url(rawMessage),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Connected Gmail send failed: ${message}`);
  }

  const data = await response.json();
  return {
    success: true,
    provider: 'gmail',
    messageId: data?.id || null,
    fromEmail: oauth.googleEmail,
  };
}

async function sendEmail({ senderUserId, toEmail, subject, html }) {
  try {
    const gmailResult = await trySendWithConnectedGmail({ senderUserId, toEmail, subject, html });
    if (gmailResult.success) {
      logEmailSent({
        provider: gmailResult.provider,
        fromEmail: gmailResult.fromEmail,
        toEmail,
        subject,
        html,
      });
      return gmailResult;
    }
  } catch (error) {
    console.error('Connected Gmail send failed, falling back to Resend:', error);
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject,
    html,
  });

  logEmailSent({
    provider: 'resend',
    fromEmail: FROM_EMAIL,
    toEmail,
    subject,
    html,
  });

  return {
    success: true,
    provider: 'resend',
    fromEmail: FROM_EMAIL,
  };
}

/**
 * Send invite email with login credentials
 */
export async function sendInviteEmail(payload) {
  try {
    const { toEmail, toName, loginId, tempPassword, roleName, inviteToken, senderUserId } = payload;
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

    await sendEmail({
      senderUserId,
      toEmail,
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
    const { toEmail, toName, loginId, newTempPassword, senderUserId } = payload;

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

    await sendEmail({
      senderUserId,
      toEmail,
      subject: 'Your SAASA password has been reset',
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send lead assignment notification email
 */
export async function sendLeadAssignmentEmail(payload) {
  try {
    const {
      toEmail,
      assigneeName,
      leadCompanyName,
      contactPerson,
      leadEmail,
      leadPhone,
      leadStatus,
      leadPriority,
      assignedByName,
      senderUserId,
    } = payload;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead Assigned</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #2563eb; margin: 0 0 20px 0; font-size: 24px;">New Lead Assigned</h1>

    <p style="font-size: 16px; margin-bottom: 20px;">Hello ${assigneeName || 'Team Member'},</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      A lead has been assigned to you${assignedByName ? ` by <strong>${assignedByName}</strong>` : ''}.
    </p>

    <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0;"><strong>Company:</strong> ${leadCompanyName || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Contact Person:</strong> ${contactPerson || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Email:</strong> ${leadEmail || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Phone:</strong> ${leadPhone || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Status:</strong> ${leadStatus || 'N/A'}</p>
      <p style="margin: 0;"><strong>Priority:</strong> ${leadPriority || 'N/A'}</p>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Please log in to the portal and follow up with this lead.
    </p>

    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      Best regards,<br>
      <strong>The SAASA Team</strong>
    </p>
  </div>
</body>
</html>
    `;

    await sendEmail({
      senderUserId,
      toEmail,
      subject: `New Lead Assigned: ${leadCompanyName || 'Lead'}`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending lead assignment email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send client assignment notification email
 */
export async function sendClientAssignmentEmail(payload) {
  try {
    const {
      toEmail,
      assigneeName,
      clientCompanyName,
      clientIndustry,
      clientWebsite,
      clientLocation,
      clientStatus,
      clientPriority,
      assignedByName,
      senderUserId,
    } = payload;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Client Assigned</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #2563eb; margin: 0 0 20px 0; font-size: 24px;">New Client Assigned</h1>

    <p style="font-size: 16px; margin-bottom: 20px;">Hello ${assigneeName || 'Team Member'},</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      A client has been assigned to you${assignedByName ? ` by <strong>${assignedByName}</strong>` : ''}.
    </p>

    <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0;"><strong>Company:</strong> ${clientCompanyName || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Industry:</strong> ${clientIndustry || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Website:</strong> ${clientWebsite || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Location:</strong> ${clientLocation || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Status:</strong> ${clientStatus || 'N/A'}</p>
      <p style="margin: 0;"><strong>Priority:</strong> ${clientPriority || 'N/A'}</p>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Please log in to the portal and continue follow-up for this client.
    </p>

    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      Best regards,<br>
      <strong>The SAASA Team</strong>
    </p>
  </div>
</body>
</html>
    `;

    await sendEmail({
      senderUserId,
      toEmail,
      subject: `New Client Assigned: ${clientCompanyName || 'Client'}`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending client assignment email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendJobAssignmentEmail(payload) {
  try {
    const {
      toEmail,
      assigneeName,
      jobTitle,
      clientCompanyName,
      jobLocation,
      jobType,
      jobStatus,
      openings,
      assignedByName,
      senderUserId,
    } = payload;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Job Assigned</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #2563eb; margin: 0 0 20px 0; font-size: 24px;">New Job Assigned</h1>

    <p style="font-size: 16px; margin-bottom: 20px;">Hello ${assigneeName || 'Team Member'},</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      A job has been assigned to you${assignedByName ? ` by <strong>${assignedByName}</strong>` : ''}.
    </p>

    <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0;"><strong>Job Title:</strong> ${jobTitle || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Client:</strong> ${clientCompanyName || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Location:</strong> ${jobLocation || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Type:</strong> ${jobType || 'N/A'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Status:</strong> ${jobStatus || 'N/A'}</p>
      <p style="margin: 0;"><strong>Openings:</strong> ${openings ?? 'N/A'}</p>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Please log in to the portal and start working on this job.
    </p>

    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      Best regards,<br>
      <strong>The SAASA Team</strong>
    </p>
  </div>
</body>
</html>
    `;

    await sendEmail({
      senderUserId,
      toEmail,
      subject: `New Job Assigned: ${jobTitle || 'Job'}`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending job assignment email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendCandidateAssignmentEmail(payload) {
  try {
    const {
      toEmail,
      assigneeName,
      assignedByName,
      senderUserId,
      candidates = [],
    } = payload;

    const candidateRows = candidates
      .map((candidate) => {
        const skills = Array.isArray(candidate.skills) ? candidate.skills.filter(Boolean).join(', ') : '';
        const assignedJobs = Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs.filter(Boolean).join(', ') : '';

        return `
          <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:10px; padding:16px; margin:0 0 14px 0;">
            <p style="margin:0 0 8px 0;"><strong>Name:</strong> ${candidate.name || 'N/A'}</p>
            <p style="margin:0 0 8px 0;"><strong>Email:</strong> ${candidate.email || 'N/A'}</p>
            <p style="margin:0 0 8px 0;"><strong>Phone:</strong> ${candidate.phone || 'N/A'}</p>
            <p style="margin:0 0 8px 0;"><strong>Current Title:</strong> ${candidate.currentTitle || 'N/A'}</p>
            <p style="margin:0 0 8px 0;"><strong>Current Company:</strong> ${candidate.currentCompany || 'N/A'}</p>
            <p style="margin:0 0 8px 0;"><strong>Experience:</strong> ${candidate.experience ?? 'N/A'}</p>
            <p style="margin:0 0 8px 0;"><strong>Location:</strong> ${candidate.location || 'N/A'}</p>
            <p style="margin:0 0 8px 0;"><strong>Stage:</strong> ${candidate.stage || 'N/A'}</p>
            <p style="margin:0 0 8px 0;"><strong>Skills:</strong> ${skills || 'N/A'}</p>
            <p style="margin:0;"><strong>Assigned Jobs:</strong> ${assignedJobs || 'N/A'}</p>
          </div>
        `;
      })
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Candidate Assignment</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 720px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #2563eb; margin: 0 0 20px 0; font-size: 24px;">New Candidate Assignment</h1>

    <p style="font-size: 16px; margin-bottom: 20px;">Hello ${assigneeName || 'Recruiter'},</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      ${candidates.length} candidate${candidates.length === 1 ? '' : 's'} ${candidates.length === 1 ? 'has' : 'have'} been assigned to you${assignedByName ? ` by <strong>${assignedByName}</strong>` : ''}.
    </p>

    <div style="margin: 24px 0;">
      ${candidateRows || '<p>No candidate details available.</p>'}
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Please log in to the portal to review the assigned candidates and take the next steps.
    </p>

    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      Best regards,<br>
      <strong>The SAASA Team</strong>
    </p>
  </div>
</body>
</html>
    `;

    await sendEmail({
      senderUserId,
      toEmail,
      subject: `New Candidate Assignment (${candidates.length})`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending candidate assignment email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendCandidateInterviewScheduledEmail(payload) {
  try {
    const {
      toEmail,
      candidateName,
      jobTitle,
      companyName,
      scheduledAt,
      timezone,
      interviewType,
      roundLabel,
      durationLabel,
      modeLabel,
      platformLabel,
      meetingLink,
      location,
      phoneNumber,
      interviewerNames,
      notes,
      senderUserId,
    } = payload;

    const extraDetails = [
      interviewType ? `<p><strong>Interview Type:</strong> ${interviewType}</p>` : '',
      roundLabel ? `<p><strong>Round:</strong> ${roundLabel}</p>` : '',
      durationLabel ? `<p><strong>Duration:</strong> ${durationLabel}</p>` : '',
      modeLabel ? `<p><strong>Mode:</strong> ${modeLabel}${platformLabel ? ` (${platformLabel})` : ''}</p>` : '',
      location ? `<p><strong>Location:</strong> ${location}</p>` : '',
      phoneNumber ? `<p><strong>Phone Number:</strong> ${phoneNumber}</p>` : '',
      notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : '',
    ].filter(Boolean).join('');

    const html = `
      ${interviewScheduledTemplate({
        candidateName,
        jobTitle,
        companyName,
        date: scheduledAt,
        timezone,
        meetingLink,
        panelNames: interviewerNames || [],
      })}
      <div style="max-width:640px; margin:16px auto 0; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; padding:24px; font-family: Arial, sans-serif; color:#111827;">
        <h2 style="margin-top:0; font-size:18px;">Interview Details</h2>
        ${extraDetails}
      </div>
    `;

    await sendEmail({
      senderUserId,
      toEmail,
      subject: `Interview Scheduled: ${jobTitle} at ${companyName}`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending candidate interview scheduled email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendInterviewPanelScheduledEmail(payload) {
  try {
    const {
      toEmail,
      recipientName,
      candidateName,
      jobTitle,
      companyName,
      scheduledAt,
      timezone,
      interviewType,
      roundLabel,
      durationLabel,
      modeLabel,
      platformLabel,
      meetingLink,
      location,
      phoneNumber,
      interviewerNames,
      notes,
      senderUserId,
    } = payload;

    const extraDetails = [
      `<p><strong>Candidate:</strong> ${candidateName}</p>`,
      interviewType ? `<p><strong>Interview Type:</strong> ${interviewType}</p>` : '',
      roundLabel ? `<p><strong>Round:</strong> ${roundLabel}</p>` : '',
      durationLabel ? `<p><strong>Duration:</strong> ${durationLabel}</p>` : '',
      modeLabel ? `<p><strong>Mode:</strong> ${modeLabel}${platformLabel ? ` (${platformLabel})` : ''}</p>` : '',
      location ? `<p><strong>Location:</strong> ${location}</p>` : '',
      phoneNumber ? `<p><strong>Phone Number:</strong> ${phoneNumber}</p>` : '',
      notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : '',
    ].filter(Boolean).join('');

    const html = `
      ${interviewScheduledTemplate({
        candidateName: recipientName || 'Interviewer',
        jobTitle,
        companyName,
        date: scheduledAt,
        timezone,
        meetingLink,
        panelNames: interviewerNames || [],
      })}
      <div style="max-width:640px; margin:16px auto 0; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; padding:24px; font-family: Arial, sans-serif; color:#111827;">
        <h2 style="margin-top:0; font-size:18px;">Interview Details</h2>
        ${extraDetails}
      </div>
    `;

    await sendEmail({
      senderUserId,
      toEmail,
      subject: `Interview Scheduled: ${candidateName} for ${jobTitle}`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending interview panel scheduled email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}
