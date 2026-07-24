import type { NotificationTriggerEffectiveTemplate } from '@/lib/api';

/** Mirrors backend notification-trigger-default-templates.js */
function emailShell(title: string, inner: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
    ${inner}
    <p style="font-size: 14px; color: #6b7280; margin-top: 28px;">Best regards,<br><strong>The HRYANTRA Team</strong></p>
  </div>
</body>
</html>`;
}

type DefaultTemplate = {
  subject: string;
  variables: string[];
  bodyHtml: string;
};

export const NOTIFICATION_TRIGGER_SYSTEM_DEFAULTS: Record<string, DefaultTemplate> = {
  'auth.welcome_email': {
    subject: 'Welcome to HRYANTRA Recruitment',
    variables: ['recipientName', 'recipientEmail', 'loginUrl'],
    bodyHtml: emailShell(
      'Welcome',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Welcome to HRYANTRA Recruitment</h1>
<p>Hello {{recipientName}},</p>
<p>Your account has been created successfully.</p>
<p><strong>Email:</strong> {{recipientEmail}}</p>
<p><a href="{{loginUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Log in to your account</a></p>`,
    ),
  },
  'auth.otp_verification': {
    subject: 'OTP Verification',
    variables: ['recipientName', 'otp'],
    bodyHtml: emailShell(
      'OTP Verification',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">OTP Verification</h1>
<p>Hi {{recipientName}},</p>
<p>Your one-time password for verification is:</p>
<div style="background:#f8fafc;border:2px dashed #2563eb;border-radius:8px;padding:16px;text-align:center;margin:20px 0;">
  <span style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #2563eb;">{{otp}}</span>
</div>
<p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
    ),
  },
  'team.invite_email': {
    subject: 'Your HRYANTRA portal login credentials',
    variables: ['recipientName', 'loginId', 'tempPassword', 'roleName', 'loginLink', 'resetPasswordLink'],
    bodyHtml: emailShell(
      'Team invite',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Welcome to HRYANTRA</h1>
<p>Hello {{recipientName}},</p>
<p>Your account has been created with the role of <strong>{{roleName}}</strong>.</p>
<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 8px;"><strong>Login ID:</strong> {{loginId}}</p>
  <p style="margin:0;"><strong>Temporary password:</strong> {{tempPassword}}</p>
</div>
<p><a href="{{loginLink}}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Log in to portal</a></p>
<p style="font-size:14px;">Reset password: <a href="{{resetPasswordLink}}">{{resetPasswordLink}}</a></p>
<p style="font-size:13px;color:#92400e;background:#fef3c7;padding:12px;border-radius:4px;"><strong>Note:</strong> You will be asked to set a new password on first login.</p>`,
    ),
  },
  'lead.assignment_email': {
    subject: 'New Lead Assigned: {{leadCompanyName}}',
    variables: [
      'assigneeName',
      'leadCompanyName',
      'contactPerson',
      'leadEmail',
      'leadPhone',
      'leadStatus',
      'leadPriority',
      'assignedByName',
    ],
    bodyHtml: emailShell(
      'Lead assignment',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">New Lead Assigned</h1>
<p>Hello {{assigneeName}},</p>
<p>A new lead has been assigned to you{{assignedByName}}.</p>
<ul style="padding-left:18px;">
  <li><strong>Company:</strong> {{leadCompanyName}}</li>
  <li><strong>Contact:</strong> {{contactPerson}}</li>
  <li><strong>Email:</strong> {{leadEmail}}</li>
  <li><strong>Phone:</strong> {{leadPhone}}</li>
  <li><strong>Status:</strong> {{leadStatus}}</li>
  <li><strong>Priority:</strong> {{leadPriority}}</li>
</ul>
<p>Please log in to the portal and follow up with this lead.</p>`,
    ),
  },
  'lead.followup_email': {
    subject: 'Follow-up Scheduled: {{leadCompanyName}}',
    variables: ['recipientName', 'leadCompanyName', 'followUpDate', 'followUpType', 'notes'],
    bodyHtml: emailShell(
      'Lead follow-up',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Follow-up Reminder</h1>
<p>Hi {{recipientName}},</p>
<p>A follow-up has been scheduled for <strong>{{leadCompanyName}}</strong>.</p>
<p><strong>Date:</strong> {{followUpDate}}<br><strong>Type:</strong> {{followUpType}}</p>
<p>{{notes}}</p>`,
    ),
  },
  'client.assignment_email': {
    subject: 'New Client Assigned: {{clientCompanyName}}',
    variables: [
      'assigneeName',
      'clientCompanyName',
      'clientIndustry',
      'clientWebsite',
      'clientLocation',
      'clientStatus',
      'clientPriority',
      'assignedByName',
    ],
    bodyHtml: emailShell(
      'Client assignment',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">New Client Assigned</h1>
<p>Hello {{assigneeName}},</p>
<p>A client has been assigned to you{{assignedByName}}.</p>
<ul style="padding-left:18px;">
  <li><strong>Company:</strong> {{clientCompanyName}}</li>
  <li><strong>Industry:</strong> {{clientIndustry}}</li>
  <li><strong>Website:</strong> {{clientWebsite}}</li>
  <li><strong>Location:</strong> {{clientLocation}}</li>
  <li><strong>Status:</strong> {{clientStatus}}</li>
  <li><strong>Priority:</strong> {{clientPriority}}</li>
</ul>`,
    ),
  },
  'job.assignment_email': {
    subject: 'New Job Assigned: {{jobTitle}}',
    variables: ['assigneeName', 'jobTitle', 'companyName', 'jobLocation', 'jobStatus', 'assignedByName'],
    bodyHtml: emailShell(
      'Job assignment',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">New Job Assigned</h1>
<p>Hello {{assigneeName}},</p>
<p>A job requisition has been assigned to you{{assignedByName}}.</p>
<ul style="padding-left:18px;">
  <li><strong>Title:</strong> {{jobTitle}}</li>
  <li><strong>Company:</strong> {{companyName}}</li>
  <li><strong>Location:</strong> {{jobLocation}}</li>
  <li><strong>Status:</strong> {{jobStatus}}</li>
</ul>`,
    ),
  },
  'candidate.assignment_email': {
    subject: 'New Candidate Assignment ({{candidateCount}})',
    variables: ['assigneeName', 'candidateCount', 'candidateListHtml', 'assignedByName'],
    bodyHtml: emailShell(
      'Candidate assignment',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Candidate Assignment</h1>
<p>Hello {{assigneeName}},</p>
<p>{{candidateCount}} candidate(s) have been assigned to you{{assignedByName}}.</p>
<div>{{candidateListHtml}}</div>`,
    ),
  },
  'interview.candidate_scheduled': {
    subject: 'Interview Scheduled: {{jobTitle}}',
    variables: ['candidateName', 'jobTitle', 'scheduledAt', 'location', 'meetingLink', 'companyName'],
    bodyHtml: emailShell(
      'Interview scheduled',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Interview Scheduled</h1>
<p>Hi {{candidateName}},</p>
<p>Your interview for <strong>{{jobTitle}}</strong> at {{companyName}} has been scheduled.</p>
<p><strong>When:</strong> {{scheduledAt}}<br><strong>Location:</strong> {{location}}<br><strong>Meeting link:</strong> {{meetingLink}}</p>`,
    ),
  },
  'interview.panel_scheduled': {
    subject: 'Interview Panel: {{candidateName}} — {{jobTitle}}',
    variables: [
      'panelMemberName',
      'candidateName',
      'jobTitle',
      'scheduledAt',
      'location',
      'meetingLink',
      'companyName',
    ],
    bodyHtml: emailShell(
      'Panel interview',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Interview Scheduled</h1>
<p>Hello {{panelMemberName}},</p>
<p>You are scheduled to interview <strong>{{candidateName}}</strong> for <strong>{{jobTitle}}</strong> ({{companyName}}).</p>
<p><strong>When:</strong> {{scheduledAt}}<br><strong>Location:</strong> {{location}}<br><strong>Link:</strong> {{meetingLink}}</p>`,
    ),
  },
  'match.submission_email': {
    subject: 'Candidate Submission: {{jobTitle}}',
    variables: ['clientName', 'jobTitle', 'recruiterName', 'message', 'candidatesHtml', 'portalUrl'],
    bodyHtml: emailShell(
      'Match submission',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Candidate Submission</h1>
<p>Hello {{clientName}},</p>
<p>{{recruiterName}} has shared candidates for <strong>{{jobTitle}}</strong>.</p>
<p>{{message}}</p>
<div>{{candidatesHtml}}</div>
<p><a href="{{portalUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Review candidates</a></p>`,
    ),
  },
  'placement.confirmed_email': {
    subject: 'Placement Confirmed: {{jobTitle}}',
    variables: ['recipientName', 'candidateName', 'jobTitle', 'startDate', 'companyName'],
    bodyHtml: emailShell(
      'Placement confirmed',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Placement Confirmed</h1>
<p>Hi {{recipientName}},</p>
<p>Placement confirmed for <strong>{{candidateName}}</strong> — <strong>{{jobTitle}}</strong> at {{companyName}}.</p>
<p><strong>Start date:</strong> {{startDate}}</p>`,
    ),
  },
  'billing.invoice_email': {
    subject: 'Invoice: {{invoiceNumber}}',
    variables: ['recipientName', 'invoiceNumber', 'amount', 'dueDate', 'companyName', 'invoiceNote'],
    bodyHtml: emailShell(
      'Invoice',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Placement Invoice</h1>
<p>Hello {{recipientName}},</p>
<p>Please find invoice <strong>{{invoiceNumber}}</strong> for {{companyName}}.</p>
<p><strong>Amount:</strong> {{amount}}<br><strong>Due date:</strong> {{dueDate}}</p>
<p>{{invoiceNote}}</p>`,
    ),
  },
  'offer.released_email': {
    subject: 'Offer Released: {{jobTitle}}',
    variables: ['candidateName', 'jobTitle', 'companyName', 'offerDetails'],
    bodyHtml: emailShell(
      'Offer released',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Offer Released</h1>
<p>Hi {{candidateName}},</p>
<p>An offer has been released for <strong>{{jobTitle}}</strong> at {{companyName}}.</p>
<p>{{offerDetails}}</p>`,
    ),
  },
  'candidate.rejected_email': {
    subject: 'Application Update: {{jobTitle}}',
    variables: ['candidateName', 'jobTitle', 'companyName', 'feedbackMessage'],
    bodyHtml: emailShell(
      'Candidate rejected',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Application Update</h1>
<p>Hi {{candidateName}},</p>
<p>Thank you for your interest in <strong>{{jobTitle}}</strong> at {{companyName}}.</p>
<p>{{feedbackMessage}}</p>`,
    ),
  },
  'candidate.hired_email': {
    subject: 'Hiring Update: {{jobTitle}}',
    variables: ['candidateName', 'jobTitle', 'companyName', 'startDate'],
    bodyHtml: emailShell(
      'Candidate hired',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Congratulations</h1>
<p>Hi {{candidateName}},</p>
<p>You have been marked as hired for <strong>{{jobTitle}}</strong> at {{companyName}}.</p>
<p><strong>Start date:</strong> {{startDate}}</p>`,
    ),
  },
  'job.closed_email': {
    subject: 'Job Closed: {{jobTitle}}',
    variables: ['recipientName', 'jobTitle', 'companyName', 'closedReason'],
    bodyHtml: emailShell(
      'Job closed',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Job Closed</h1>
<p>Hello {{recipientName}},</p>
<p>The requisition <strong>{{jobTitle}}</strong> ({{companyName}}) has been closed.</p>
<p>{{closedReason}}</p>`,
    ),
  },
  'client.followup_email': {
    subject: 'Client Follow-up Reminder: {{clientCompanyName}}',
    variables: ['recipientName', 'clientCompanyName', 'followUpDate', 'notes'],
    bodyHtml: emailShell(
      'Client follow-up',
      `<h1 style="color: #2563eb; font-size: 22px; margin: 0 0 16px;">Client Follow-up Reminder</h1>
<p>Hi {{recipientName}},</p>
<p>Reminder to follow up with <strong>{{clientCompanyName}}</strong> on {{followUpDate}}.</p>
<p>{{notes}}</p>`,
    ),
  },
};

export function getSystemDefaultTemplate(
  triggerId: string,
): NotificationTriggerEffectiveTemplate | null {
  const def = NOTIFICATION_TRIGGER_SYSTEM_DEFAULTS[String(triggerId || '').trim()];
  if (!def) return null;
  return {
    subject: def.subject,
    bodyHtml: def.bodyHtml,
    variables: def.variables,
    customized: false,
  };
}

export function mergeNotificationTriggerEffective(
  triggerIds: string[],
  options: {
    storedTemplates?: Record<string, { subject?: string; bodyHtml?: string; customized?: boolean }>;
    apiEffective?: Record<string, NotificationTriggerEffectiveTemplate>;
  } = {},
): Record<string, NotificationTriggerEffectiveTemplate> {
  const { storedTemplates = {}, apiEffective = {} } = options;
  const out: Record<string, NotificationTriggerEffectiveTemplate> = {};

  for (const rawId of triggerIds) {
    const id = String(rawId || '').trim();
    if (!id) continue;

    const system = getSystemDefaultTemplate(id);
    const stored = storedTemplates[id];
    const api = apiEffective[id];
    const customized = Boolean(stored?.customized || api?.customized);

    let subject = system?.subject || 'Notification from HRYANTRA';
    let bodyHtml =
      system?.bodyHtml ||
      '<p>Hello,</p><p>This is a notification from your HRYANTRA workspace.</p>';
    const variables = system?.variables || api?.variables || [];

    if (customized) {
      if (stored?.subject?.trim()) subject = stored.subject.trim();
      else if (api?.subject?.trim()) subject = api.subject.trim();
      if (stored?.bodyHtml?.trim()) bodyHtml = stored.bodyHtml.trim();
      else if (api?.bodyHtml?.trim()) bodyHtml = api.bodyHtml.trim();
    } else if (api?.subject?.trim() && api?.bodyHtml?.trim()) {
      subject = api.subject;
      bodyHtml = api.bodyHtml;
    }

    out[id] = { subject, bodyHtml, variables, customized };
  }

  return out;
}

export function buildBaselineEffective(
  triggerIds: string[],
): Record<string, NotificationTriggerEffectiveTemplate> {
  return mergeNotificationTriggerEffective(triggerIds, {});
}
