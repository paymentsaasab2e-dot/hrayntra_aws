import { Resend } from 'resend';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { oauthTokenService } from '../modules/oauth/oauth-token.service.js';
import { isNotificationTriggerEnabled } from '../modules/setting/notification-trigger-settings.js';
import { renderNotificationTriggerEmail } from '../modules/setting/notification-trigger-template-settings.js';
import { interviewScheduledTemplate } from '../utils/emailTemplates.js';
import { buildPlacementInvoiceEmailHtml } from '../utils/invoiceEmailHtml.js';
import {
  joiningScheduledCandidateTemplate,
  joiningScheduledReportingContactTemplate,
} from '../emails/templates/placement.template.js';

const resend = new Resend(process.env.RESEND_API_KEY);
// Use the Resend configured from address; fallback to a generic placeholder.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || 'noreply@saasa.com';

function formatAssignedByClause(assignedByName) {
  const name = String(assignedByName || '').trim();
  return name ? ` by ${name}` : '';
}

function buildInterviewExtraDetails(payload, { includeCandidate = false } = {}) {
  const {
    candidateName,
    interviewType,
    roundLabel,
    durationLabel,
    modeLabel,
    platformLabel,
    location,
    phoneNumber,
    notes,
  } = payload;

  return [
    includeCandidate && candidateName ? `<p><strong>Candidate:</strong> ${candidateName}</p>` : '',
    interviewType ? `<p><strong>Interview Type:</strong> ${interviewType}</p>` : '',
    roundLabel ? `<p><strong>Round:</strong> ${roundLabel}</p>` : '',
    durationLabel ? `<p><strong>Duration:</strong> ${durationLabel}</p>` : '',
    modeLabel
      ? `<p><strong>Mode:</strong> ${modeLabel}${platformLabel ? ` (${platformLabel})` : ''}</p>`
      : '',
    location ? `<p><strong>Location:</strong> ${location}</p>` : '',
    phoneNumber ? `<p><strong>Phone Number:</strong> ${phoneNumber}</p>` : '',
    notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : '',
  ]
    .filter(Boolean)
    .join('');
}

function buildRichInterviewScheduledHtml(payload, { panelMember = false } = {}) {
  const {
    candidateName,
    recipientName,
    jobTitle,
    companyName,
    scheduledAt,
    timezone,
    meetingLink,
    interviewerNames,
  } = payload;

  const extraDetails = buildInterviewExtraDetails(payload, { includeCandidate: panelMember });

  return `
      ${interviewScheduledTemplate({
        candidateName: panelMember ? recipientName || 'Interviewer' : candidateName,
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
}

function warnIfInviteLinksPointToLocalhostInProduction() {
  if (env.NODE_ENV !== 'production') return;
  const base = env.FRONTEND_URL || '';
  if (!/localhost|127\.0\.0\.1/i.test(base)) return;
  console.error(
    '[email] Invite/login links use localhost. Set FRONTEND_URL=https://employers.hryantra.com (or APP_PUBLIC_URL / NEXT_PUBLIC_APP_URL) on the Phase 2 API server.'
  );
}

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

function buildGmailRawMessage({ fromEmail, toEmail, subject, html, attachments = [] }) {
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  if (!hasAttachments) {
    return [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
    ].join('\r\n');
  }

  const boundary = `mixed_${Date.now()}`;
  const parts = [
    `From: ${fromEmail}`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
  ];

  for (const attachment of attachments) {
    const filename = attachment.filename || 'attachment.pdf';
    const content = Buffer.isBuffer(attachment.content)
      ? attachment.content
      : Buffer.from(String(attachment.content || ''), attachment.encoding || 'base64');
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType || 'application/pdf'}; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${filename}"`,
      '',
      content.toString('base64'),
    );
  }

  parts.push(`--${boundary}--`);
  return parts.join('\r\n');
}

async function trySendWithConnectedGmail({ senderUserId, toEmail, subject, html, attachments = [] }) {
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

  const rawMessage = buildGmailRawMessage({
    fromEmail: oauth.googleEmail,
    toEmail,
    subject,
    html,
    attachments,
  });

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

async function sendEmail({ senderUserId, toEmail, subject, html, attachments = [] }) {
  const normalizedAttachments = (Array.isArray(attachments) ? attachments : [])
    .map((item) => {
      const filename = String(item?.filename || 'attachment.pdf').trim();
      const content = item?.content;
      if (!content) return null;
      return {
        filename,
        content: Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'base64'),
        contentType: item?.contentType || 'application/pdf',
      };
    })
    .filter(Boolean);

  const resendAttachments = normalizedAttachments.map((item) => ({
    filename: item.filename,
    content: item.content,
  }));

  try {
    const gmailResult = await trySendWithConnectedGmail({
      senderUserId,
      toEmail,
      subject,
      html,
      attachments: normalizedAttachments,
    });
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
    attachments: resendAttachments.length ? resendAttachments : undefined,
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
    const triggerEnabled = await isNotificationTriggerEnabled('team.invite_email', {
      userId: payload?.senderUserId || null,
      aliases: ['team invite', 'invite email'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

    warnIfInviteLinksPointToLocalhostInProduction();
    const { toEmail, toName, loginId, tempPassword, roleName, inviteToken, senderUserId, tenantDbName } = payload;
    const tenantQ =
      tenantDbName && String(tenantDbName).trim()
        ? `&tenantDbName=${encodeURIComponent(String(tenantDbName).trim())}`
        : '';
    const base = env.FRONTEND_URL;
    const loginLink = `${base}/login?token=${inviteToken}${tenantQ}`;
    const resetPasswordLink = `${base}/reset-password`;

    const { subject, html } = await renderNotificationTriggerEmail(
      'team.invite_email',
      senderUserId || null,
      {
        recipientName: toName,
        loginId,
        tempPassword,
        roleName,
        loginLink,
        resetPasswordLink,
      },
    );

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
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
    const triggerEnabled = await isNotificationTriggerEnabled('auth.otp_verification', {
      userId: payload?.senderUserId || null,
      aliases: ['password reset', 'otp verification'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

    const { toEmail, toName, loginId, newTempPassword, senderUserId } = payload;

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

    await sendEmail({
      senderUserId,
      toEmail,
      subject: 'Your HRYANTRA password has been reset',
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
    const triggerEnabled = await isNotificationTriggerEnabled('lead.assignment_email', {
      userId: payload?.senderUserId || null,
      aliases: ['lead assignment'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

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

    const { subject, html } = await renderNotificationTriggerEmail(
      'lead.assignment_email',
      senderUserId || null,
      {
        assigneeName,
        leadCompanyName,
        contactPerson,
        leadEmail,
        leadPhone,
        leadStatus,
        leadPriority,
        assignedByName: formatAssignedByClause(assignedByName),
      },
    );

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
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
    const triggerEnabled = await isNotificationTriggerEnabled('client.assignment_email', {
      userId: payload?.senderUserId || null,
      aliases: ['client assignment'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

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

    const { subject, html } = await renderNotificationTriggerEmail(
      'client.assignment_email',
      senderUserId || null,
      {
        assigneeName,
        clientCompanyName,
        clientIndustry,
        clientWebsite,
        clientLocation,
        clientStatus,
        clientPriority,
        assignedByName: formatAssignedByClause(assignedByName),
      },
    );

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
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
    const triggerEnabled = await isNotificationTriggerEnabled('job.assignment_email', {
      userId: payload?.senderUserId || null,
      aliases: ['job assignment'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

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

    const { subject, html } = await renderNotificationTriggerEmail(
      'job.assignment_email',
      senderUserId || null,
      {
        assigneeName,
        jobTitle,
        companyName: clientCompanyName,
        jobLocation,
        jobStatus,
        assignedByName: formatAssignedByClause(assignedByName),
      },
    );

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
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
    const triggerEnabled = await isNotificationTriggerEnabled('candidate.assignment_email', {
      userId: payload?.senderUserId || null,
      aliases: ['candidate assignment'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

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

    const { subject, html } = await renderNotificationTriggerEmail(
      'candidate.assignment_email',
      senderUserId || null,
      {
        assigneeName,
        candidateCount: String(candidates.length || 0),
        candidateListHtml: candidateRows,
        assignedByName: formatAssignedByClause(assignedByName),
      },
    );

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
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
    const triggerEnabled = await isNotificationTriggerEnabled('interview.candidate_scheduled', {
      userId: payload?.senderUserId || null,
      aliases: ['candidate interview scheduled', 'interview scheduled'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

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

    const rendered = await renderNotificationTriggerEmail(
      'interview.candidate_scheduled',
      senderUserId || null,
      {
        candidateName,
        jobTitle,
        companyName: companyName || 'N/A',
        scheduledAt: scheduledAt
          ? `${scheduledAt}${timezone ? ` (${timezone})` : ''}`
          : 'TBD',
        location: location || 'N/A',
        meetingLink: meetingLink || 'N/A',
      },
    );

    const subject = rendered.effective?.customized
      ? rendered.subject
      : `Interview Scheduled: ${jobTitle} at ${companyName}`;
    const html = rendered.effective?.customized
      ? rendered.html
      : buildRichInterviewScheduledHtml(payload);

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
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
    const triggerEnabled = await isNotificationTriggerEnabled('interview.panel_scheduled', {
      userId: payload?.senderUserId || null,
      aliases: ['panel interview scheduled', 'interview panel scheduled'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

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

    const rendered = await renderNotificationTriggerEmail(
      'interview.panel_scheduled',
      senderUserId || null,
      {
        panelMemberName: recipientName || 'Interviewer',
        candidateName,
        jobTitle,
        companyName: companyName || 'N/A',
        scheduledAt: scheduledAt
          ? `${scheduledAt}${timezone ? ` (${timezone})` : ''}`
          : 'TBD',
        location: location || 'N/A',
        meetingLink: meetingLink || 'N/A',
      },
    );

    const subject = rendered.effective?.customized
      ? rendered.subject
      : `Interview Scheduled: ${candidateName} for ${jobTitle}`;
    const html = rendered.effective?.customized
      ? rendered.html
      : buildRichInterviewScheduledHtml(payload, { panelMember: true });

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending interview panel scheduled email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send placement invoice to the client billing contact.
 */
export async function sendPlacementInvoiceEmail(payload) {
  try {
    const triggerEnabled = await isNotificationTriggerEnabled('billing.invoice_email', {
      userId: payload?.senderUserId || null,
      aliases: ['placement invoice', 'invoice email'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

    const toEmail = String(payload?.toEmail || '').trim();
    if (!toEmail) {
      return { success: false, error: 'Client email is required' };
    }

    const invoiceNumber = String(payload?.invoiceNumber || 'Invoice').trim();
    const sellerName = String(payload?.seller?.name || 'Your agency').trim();
    const buyer = payload?.buyer || {};
    const currency = payload?.currency || 'INR';
    const total = payload?.total;
    const amountLabel =
      total != null && total !== ''
        ? `${currency} ${Number(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'N/A';
    const dueDateLabel = payload?.dueDate
      ? new Date(payload.dueDate).toLocaleDateString()
      : 'N/A';

    const rendered = await renderNotificationTriggerEmail(
      'billing.invoice_email',
      payload?.senderUserId || null,
      {
        recipientName: buyer.contactName || buyer.name || 'there',
        invoiceNumber,
        amount: amountLabel,
        dueDate: dueDateLabel,
        companyName: buyer.companyName || sellerName,
        invoiceNote: payload?.notes || 'Please find your placement invoice below.',
      },
    );

    const subject = rendered.effective?.customized
      ? rendered.subject
      : String(payload?.subject || '').trim() ||
        `Invoice ${invoiceNumber} from ${sellerName}`;

    const html = rendered.effective?.customized
      ? rendered.html
      : buildPlacementInvoiceEmailHtml({
          invoiceNumber,
          invoiceDate: payload?.invoiceDate,
          dueDate: payload?.dueDate,
          currency: payload?.currency,
          status: payload?.status || 'SENT',
          seller: payload?.seller || {},
          buyer,
          lineItems: payload?.lineItems || [],
          additionalCharges: payload?.additionalCharges || [],
          subtotal: payload?.subtotal,
          taxRate: payload?.taxRate,
          taxAmount: payload?.taxAmount,
          total: payload?.total,
          notes: payload?.notes,
          placementSummary: payload?.placementSummary,
          settings: payload?.settings || {},
        });

    const pdfBase64 = String(payload?.pdfBase64 || '').trim();
    const pdfFilename =
      String(payload?.pdfFilename || '').trim() ||
      `${invoiceNumber.replace(/[^\w-]+/g, '_') || 'invoice'}.pdf`;
    const attachments = pdfBase64
      ? [
          {
            filename: pdfFilename,
            content: pdfBase64,
            contentType: 'application/pdf',
          },
        ]
      : [];

    const htmlWithAttachmentNote = attachments.length
      ? html.replace(
          'Please find your placement invoice below.',
          'Please find your placement invoice below. A PDF copy is attached to this email.',
        )
      : html;

    await sendEmail({
      senderUserId: payload?.senderUserId,
      toEmail,
      subject,
      html: htmlWithAttachmentNote,
      attachments,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending placement invoice email:', error);
    return { success: false, error: error.message || 'Failed to send invoice email' };
  }
}

export async function sendJoiningScheduledCandidateEmail(payload) {
  try {
    const triggerEnabled = await isNotificationTriggerEnabled('placement.joining_scheduled_candidate', {
      userId: payload?.senderUserId || null,
      aliases: ['joining scheduled candidate', 'placement joining candidate'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

    const {
      toEmail,
      candidateName,
      jobTitle,
      companyName,
      joiningDateLabel,
      reportingToName,
      reportingToTitle,
      reportingToEmail,
      joiningNotes,
      recruiterName,
      recruiterEmail,
      senderUserId,
    } = payload;

    if (!toEmail) return { success: true, skipped: true, reason: 'no_email' };

    const html = joiningScheduledCandidateTemplate({
      candidateName,
      jobTitle,
      companyName,
      joiningDateLabel,
      reportingToName,
      reportingToTitle,
      reportingToEmail,
      joiningNotes,
      recruiterName,
      recruiterEmail,
    });

    await sendEmail({
      senderUserId,
      toEmail,
      subject: `Joining scheduled${jobTitle ? `: ${jobTitle}` : ''}${companyName ? ` at ${companyName}` : ''}`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending joining scheduled candidate email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendJoiningScheduledReportingContactEmail(payload) {
  try {
    const triggerEnabled = await isNotificationTriggerEnabled('placement.joining_scheduled_reporting', {
      userId: payload?.senderUserId || null,
      aliases: ['joining scheduled reporting', 'placement joining reporting contact'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

    const {
      toEmail,
      recipientName,
      candidateName,
      candidateEmail,
      candidatePhone,
      candidateLocation,
      currentTitle,
      currentCompany,
      jobTitle,
      companyName,
      joiningDateLabel,
      joiningNotes,
      recruiterName,
      recruiterEmail,
      senderUserId,
    } = payload;

    if (!toEmail) return { success: true, skipped: true, reason: 'no_email' };

    const html = joiningScheduledReportingContactTemplate({
      recipientName,
      candidateName,
      candidateEmail,
      candidatePhone,
      candidateLocation,
      currentTitle,
      currentCompany,
      jobTitle,
      companyName,
      joiningDateLabel,
      joiningNotes,
      recruiterName,
      recruiterEmail,
    });

    await sendEmail({
      senderUserId,
      toEmail,
      subject: `Joining scheduled — ${candidateName || 'Candidate'}${jobTitle ? ` (${jobTitle})` : ''}`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending joining scheduled reporting contact email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendOfferReleasedEmail(payload) {
  try {
    const triggerEnabled = await isNotificationTriggerEnabled('offer.released_email', {
      userId: payload?.senderUserId || null,
      aliases: ['offer released'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

    const { toEmail, candidateName, jobTitle, companyName, offerDate, senderUserId } = payload;
    const formattedOfferDate = offerDate ? new Date(offerDate).toLocaleDateString() : 'soon';
    const offerDetails = `<strong>Offer date:</strong> ${formattedOfferDate}. Our team will guide you through the next steps.`;

    const { subject, html } = await renderNotificationTriggerEmail(
      'offer.released_email',
      senderUserId || null,
      {
        candidateName: candidateName || 'Candidate',
        jobTitle: jobTitle || 'the role',
        companyName: companyName || '',
        offerDetails,
      },
    );

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending offer released email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendCandidateRejectedEmail(payload) {
  try {
    const triggerEnabled = await isNotificationTriggerEnabled('candidate.rejected_email', {
      userId: payload?.senderUserId || null,
      aliases: ['candidate rejected'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

    const { toEmail, candidateName, jobTitle, companyName, reason, feedback, senderUserId } = payload;
    const feedbackParts = [];
    if (reason) feedbackParts.push(`<strong>Reason:</strong> ${reason}`);
    if (feedback) feedbackParts.push(`<strong>Feedback:</strong> ${feedback}`);
    if (!feedbackParts.length) {
      feedbackParts.push('We will not be moving forward with this application. We appreciate your time and wish you the best.');
    }

    const { subject, html } = await renderNotificationTriggerEmail(
      'candidate.rejected_email',
      senderUserId || null,
      {
        candidateName: candidateName || 'Candidate',
        jobTitle: jobTitle || 'the role',
        companyName: companyName || '',
        feedbackMessage: feedbackParts.join('<br>'),
      },
    );

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending candidate rejected email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendCandidateHiredEmail(payload) {
  try {
    const triggerEnabled = await isNotificationTriggerEnabled('candidate.hired_email', {
      userId: payload?.senderUserId || null,
      aliases: ['candidate hired'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

    const { toEmail, candidateName, jobTitle, companyName, startDate, senderUserId } = payload;
    const startDateLabel = startDate ? new Date(startDate).toLocaleDateString() : 'To be confirmed';

    const { subject, html } = await renderNotificationTriggerEmail(
      'candidate.hired_email',
      senderUserId || null,
      {
        candidateName: candidateName || 'Candidate',
        jobTitle: jobTitle || 'the role',
        companyName: companyName || '',
        startDate: startDateLabel,
      },
    );

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending candidate hired email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendJobClosedEmail(payload) {
  try {
    const triggerEnabled = await isNotificationTriggerEnabled('job.closed_email', {
      userId: payload?.senderUserId || null,
      aliases: ['job closed'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

    const { toEmail, recipientName, jobTitle, companyName, status, senderUserId } = payload;
    const closedReason = `The requisition has been marked as <strong>${status || 'CLOSED'}</strong>. Please review pending pipeline actions if required.`;

    const { subject, html } = await renderNotificationTriggerEmail(
      'job.closed_email',
      senderUserId || null,
      {
        recipientName: recipientName || 'Team Member',
        jobTitle: jobTitle || 'Untitled Job',
        companyName: companyName || '',
        closedReason,
      },
    );

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending job closed email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendClientFollowUpReminderEmail(payload) {
  try {
    const triggerEnabled = await isNotificationTriggerEnabled('client.followup_email', {
      userId: payload?.senderUserId || null,
      aliases: ['client follow-up reminder', 'client followup reminder'],
    });
    if (!triggerEnabled) return { success: true, skipped: true };

    const { toEmail, recipientName, clientCompanyName, followUpDueDate, notes, senderUserId } = payload;
    const followUpDate = followUpDueDate ? new Date(followUpDueDate).toLocaleString() : 'scheduled';

    const { subject, html } = await renderNotificationTriggerEmail(
      'client.followup_email',
      senderUserId || null,
      {
        recipientName: recipientName || 'Team Member',
        clientCompanyName: clientCompanyName || 'your client',
        followUpDate,
        notes: notes || 'Please connect with the client and update the CRM.',
      },
    );

    await sendEmail({
      senderUserId,
      toEmail,
      subject,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending client follow-up reminder email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Notify the account owner (active session) that another device requested login — includes Allow/Reject links.
 */
export async function sendSessionTransferRequestEmail(payload) {
  try {
    const {
      toEmail,
      recipientName,
      challengerDeviceLabel,
      challengerMacAddress,
      approveUrl,
      rejectUrl,
      expiresMinutes = 5,
    } = payload;

    if (!toEmail) {
      return { success: false, error: 'Missing recipient email' };
    }

    const deviceLine = challengerDeviceLabel || 'Unknown device';
    const macLine =
      challengerMacAddress && !String(deviceLine).includes(challengerMacAddress)
        ? `<p style="margin:8px 0 0;font-size:14px;color:#4b5563;"><strong>Device ID:</strong> ${challengerMacAddress}</p>`
        : '';
    const isLocalLink = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(approveUrl);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Duplicate login request</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
  <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="color: #4f46e5; margin: 0 0 16px; font-size: 22px;">Duplicate login detected</h1>
    <p style="font-size: 16px; margin: 0 0 16px;">Hello ${recipientName || 'there'},</p>
    <p style="font-size: 15px; margin: 0 0 16px;">
      Someone is trying to sign in to your HRYANTRA account from another device or browser while you already have an active session.
    </p>
    <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #92400e;">New login attempt</p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #374151; white-space: pre-line;">${deviceLine}</p>
      ${macLine && !deviceLine.includes(challengerMacAddress || '') ? macLine : ''}
    </div>
    <p style="font-size: 15px; margin: 0 0 20px;">
      If this was you, you can <strong>allow</strong> the new login (your current session will be logged out).
      If this was not you, choose <strong>reject</strong> to keep your current session.
    </p>
    <p style="font-size: 13px; color: #6b7280; margin: 0 0 20px;">
      You can also approve or reject from the portal if you are already logged in. These links expire in about ${expiresMinutes} minutes.
    </p>
    ${
      isLocalLink
        ? `<p style="font-size: 13px; color: #b45309; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin: 0 0 16px;">
      <strong>Development note:</strong> Some email apps block clickable <em>localhost</em> links. Use the portal popup if you are logged in, or copy one of the full links below into Chrome on this computer.
    </p>`
        : ''
    }
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" bgcolor="#059669" style="border-radius: 8px;">
                <a href="${approveUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px; background-color: #059669;">Allow login</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 24px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" bgcolor="#ffffff" style="border-radius: 8px; border: 2px solid #fecaca;">
                <a href="${rejectUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #b91c1c !important; text-decoration: none; border-radius: 8px;">Reject</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="font-size: 13px; color: #374151; margin: 0 0 8px; font-weight: 600;">Or copy a link into your browser:</p>
    <p style="font-size: 12px; color: #4b5563; word-break: break-all; margin: 0 0 8px;">
      <strong>Allow:</strong><br>
      <a href="${approveUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${approveUrl}</a>
    </p>
    <p style="font-size: 12px; color: #4b5563; word-break: break-all; margin: 0;">
      <strong>Reject:</strong><br>
      <a href="${rejectUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${rejectUrl}</a>
    </p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 28px;">
      Best regards,<br><strong>The HRYANTRA Team</strong>
    </p>
  </div>
</body>
</html>
    `;

    await sendEmail({
      senderUserId: null,
      toEmail,
      subject: 'Duplicate login request — approve or reject',
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending session transfer request email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}
