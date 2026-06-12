import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { sendAlertTestEmail } from '../../services/emailService.js';
import { createUserNotification } from '../notification/notification.service.js';
import { renderNotificationTriggerEmail } from './notification-trigger-template-settings.js';
import {
  getAlertDefinition,
  isAlertEmailEnabled,
  isAlertPortalEnabled,
} from './alert-settings.js';

const DEDUP_HOURS = Number(process.env.ALERT_SCHEDULER_DEDUP_HOURS || 24);

function sampleVarsForTrigger(triggerId) {
  const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const samples = {
    'auth.welcome_email': {
      recipientName: 'Test User',
      recipientEmail: 'you@example.com',
      loginUrl: env.FRONTEND_URL || 'http://localhost:3001',
    },
    'auth.otp_verification': { recipientName: 'Test User', otp: '123456' },
    'team.invite_email': {
      recipientName: 'Test User',
      loginId: 'test@example.com',
      tempPassword: 'TempPass123!',
      roleName: 'Recruiter',
      loginLink: env.FRONTEND_URL || 'http://localhost:3001',
      resetPasswordLink: `${env.FRONTEND_URL || 'http://localhost:3001'}/reset-password`,
    },
    'lead.assignment_email': {
      assigneeName: 'Test User',
      leadCompanyName: 'Acme Corp (Test)',
      contactPerson: 'Jane Doe',
      leadEmail: 'jane@acme.com',
      leadPhone: '+1 555-0100',
      leadStatus: 'New',
      leadPriority: 'High',
      assignedByName: ' by Admin',
    },
    'lead.followup_email': {
      recipientName: 'Test User',
      leadCompanyName: 'Acme Corp (Test)',
      followUpDate: now,
      followUpType: 'Call',
      notes: 'This is a test follow-up reminder.',
    },
    'client.assignment_email': {
      assigneeName: 'Test User',
      clientCompanyName: 'Globex (Test)',
      clientIndustry: 'Technology',
      clientWebsite: 'https://globex.example.com',
      clientLocation: 'New York',
      clientStatus: 'Active',
      clientPriority: 'Medium',
      assignedByName: ' by Admin',
    },
    'job.assignment_email': {
      assigneeName: 'Test User',
      jobTitle: 'Senior Developer (Test)',
      companyName: 'Globex',
      jobLocation: 'Remote',
      jobStatus: 'Open',
      assignedByName: ' by Admin',
    },
    'candidate.assignment_email': {
      assigneeName: 'Test User',
      candidateCount: '1',
      candidateListHtml: '<p>John Smith — john@example.com</p>',
      assignedByName: ' by Admin',
    },
    'interview.panel_scheduled': {
      panelMemberName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      scheduledAt: now,
      location: 'Video call',
      meetingLink: 'https://meet.example.com/test',
      companyName: 'Globex',
    },
    'match.submission_email': {
      clientName: 'Client Contact',
      jobTitle: 'Senior Developer',
      recruiterName: 'Test Recruiter',
      message: 'Please review the attached candidates.',
      candidatesHtml: '<p>John Smith — 5 yrs experience</p>',
      portalUrl: env.FRONTEND_URL || 'http://localhost:3001',
    },
    'placement.confirmed_email': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      startDate: now,
      companyName: 'Globex',
    },
    'billing.invoice_email': {
      recipientName: 'Test User',
      invoiceNumber: 'INV-TEST-001',
      amount: '$5,000',
      dueDate: now,
      companyName: 'Globex',
    },
    'placement.joining_scheduled_candidate': {
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      joiningDate: now,
      companyName: 'Globex',
      reportingToName: 'HR Manager',
    },
    'job.closed_email': {
      recipientName: 'Test User',
      jobTitle: 'Senior Developer',
      companyName: 'Globex',
      closedReason: 'Position filled successfully.',
    },
    'client.followup_email': {
      recipientName: 'Test User',
      clientCompanyName: 'Globex (Test)',
      followUpDate: now,
      notes: 'Client follow-up was due yesterday — please reconnect.',
    },
    'candidate.hired_email': {
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      companyName: 'Globex',
      startDate: now,
    },
    'alert.lead_status_changed': {
      recipientName: 'Test User',
      leadCompanyName: 'Acme Corp',
      previousStatus: 'New',
      newStatus: 'Qualified',
      changedBy: ' by Sarah (Admin)',
    },
    'alert.lead_marked_lost': {
      recipientName: 'Test User',
      leadCompanyName: 'Acme Corp',
      lostReason: 'Budget freeze — revisiting next quarter.',
    },
    'alert.lead_converted_to_client': {
      recipientName: 'Test User',
      leadCompanyName: 'Acme Corp',
      clientCompanyName: 'Acme Corp Pvt Ltd',
      previousStatus: 'Qualified',
    },
    'alert.lead_followup_overdue': {
      recipientName: 'Test User',
      leadCompanyName: 'Acme Corp',
      followUpDate: 'Mar 1, 2026',
      notes: 'Follow-up is overdue — act today to protect conversion.',
    },
    'alert.client_status_changed': {
      recipientName: 'Test User',
      clientCompanyName: 'Globex',
      previousStatus: 'PROSPECT',
      newStatus: 'ACTIVE',
    },
    'alert.client_kyc_incomplete': {
      recipientName: 'Test User',
      clientCompanyName: 'Globex',
      missingItems: 'Trade license and bank proof documents are not uploaded.',
    },
    'alert.job_near_sla': {
      recipientName: 'Test User',
      jobTitle: 'Senior Developer',
      companyName: 'Globex',
      expectedClosureDate: now,
    },
    'alert.job_zero_applicants': {
      recipientName: 'Test User',
      jobTitle: 'Senior Developer',
      companyName: 'Globex',
    },
    'alert.candidate_stage_changed': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      previousStage: 'Screening',
      newStage: 'Interview',
    },
    'alert.interview_cancelled': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      scheduledAt: now,
      reason: 'Panel conflict — reschedule requested.',
    },
    'alert.interview_today_reminder': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      scheduledAt: now,
    },
    'alert.match_submitted_internal': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      clientName: 'Globex',
      message: 'Shortlist sent to client contact for review.',
    },
    'alert.match_client_review_completed': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      clientName: 'Globex',
      reviewTag: 'Approved for next round',
    },
    'alert.billing_draft_ready': {
      recipientName: 'Test User',
      invoiceNumber: 'INV-2026-0042',
      clientName: 'Globex',
      amount: '$12,500',
      dueDate: now,
    },
    'alert.billing_invoice_overdue': {
      recipientName: 'Test User',
      invoiceNumber: 'INV-2026-0038',
      clientName: 'Globex',
      amount: '$8,200',
      dueDate: 'Feb 15, 2026',
    },
    'alert.interview_rescheduled': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      previousScheduledAt: 'Jun 5, 2026, 10:00 AM',
      scheduledAt: now,
    },
    'alert.placement_created': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      companyName: 'Globex',
      placementDetails: 'Offer letter is attached and ready for the candidate.',
    },
    'alert.placement_offer_response': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      responseLabel: 'Accepted',
      responseMessage: 'accepted the offer',
    },
    'alert.candidate_rejected_internal': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      reason: 'Skills mismatch',
      rejectionNote: 'A rejection email was sent to the candidate.',
    },
    'alert.job_portal_application': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      applicationMessage: 'Review the new application in the candidate profile.',
    },
    'alert.job_candidate_reapplied': {
      recipientName: 'Test User',
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      applicationMessage: 'Review the updated application and pipeline stage.',
    },
    'candidate.rejected_email': {
      candidateName: 'John Smith',
      jobTitle: 'Senior Developer',
      companyName: 'Globex',
      feedbackMessage:
        '<strong>Reason:</strong> Skills mismatch<br>Thank you for your interest — we will keep your profile on file.',
    },
  };
  return samples[triggerId] || {};
}

function samplePortalDescription(alertId) {
  const samples = {
    'lead.status_changed': 'Acme Corp: New → Qualified.',
    'lead.marked_lost': 'Acme Corp was marked Lost. Reason: Budget freeze.',
    'lead.converted_to_client': 'Acme Corp was converted to client "Acme Corp Pvt Ltd".',
    'client.status_changed': 'Globex: PROSPECT → ACTIVE.',
    'client.kyc_incomplete': 'Globex has KYC details but missing compliance documents.',
    'job.closed': 'Senior Developer is now CLOSED.',
    'job.near_sla': 'Senior Developer is at risk — target date Jun 15, 2026.',
    'job.zero_applicants': 'Senior Developer has no applicants yet — sourcing needed.',
    'candidate.stage_changed': 'John Smith moved to Interview (Senior Developer).',
    'interview.cancelled': 'John Smith — Senior Developer on Jun 8, 2026 was cancelled.',
    'interview.today_reminder': 'John Smith for Senior Developer — Jun 8, 2026, 2:00 PM.',
    'match.submitted_to_client': 'John Smith submitted for Senior Developer (Globex).',
    'match.client_review_completed': 'Globex reviewed John Smith for Senior Developer: Approved for next round.',
    'billing.draft_ready': 'Draft INV-2026-0042 ready for Globex ($12,500).',
    'billing.invoice_overdue': 'INV-2026-0038 for Globex is overdue ($8,200).',
    'interview.rescheduled': 'John Smith — Senior Developer moved to Jun 8, 2026, 2:00 PM.',
    'placement.created': 'John Smith placed at Globex for Senior Developer.',
    'placement.offer_response': 'John Smith accepted the offer for Senior Developer.',
    'candidate.rejected': 'John Smith was rejected (Skills mismatch).',
    'job.portal_application': 'John Smith applied to Senior Developer.',
    'job.candidate_reapplied':
      'John Smith applied to Senior Developer (previously rejected — moved back to Applied).',
  };
  return samples[alertId] || null;
}

function getSampleVarsForAlert(alertId, userName) {
  const alert = getAlertDefinition(alertId);
  const merged = alert?.emailTriggerId ? { ...sampleVarsForTrigger(alert.emailTriggerId) } : {};
  const name = userName || 'Test User';
  if (merged.recipientName === undefined) merged.recipientName = name;
  if (merged.assigneeName === undefined) merged.assigneeName = name;
  if (merged.panelMemberName === undefined) merged.panelMemberName = name;
  return merged;
}

/**
 * Skip duplicate scheduled alerts for the same user + alert + entity within a window.
 */
export async function wasAlertDispatchedRecently(userId, alertId, entityId, hours = DEDUP_HOURS) {
  if (!userId || !alertId || !entityId) return false;
  if (!prisma?.notification?.findMany) return false;
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recent = await prisma.notification.findMany({
      where: {
        userId: String(userId),
        entityId: String(entityId),
        createdAt: { gte: since },
      },
      select: { metadata: true },
      take: 30,
      orderBy: { createdAt: 'desc' },
    });
    return recent.some((row) => row?.metadata?.alertId === alertId);
  } catch {
    return false;
  }
}

/**
 * Portal bell notification gated by alert settings.
 */
export async function createAlertNotification(userId, alertId, payload) {
  if (!userId || !payload?.title) return null;
  if (!(await isAlertPortalEnabled(alertId, userId))) return null;
  const enriched = {
    ...payload,
    metadata: {
      ...(payload.metadata || {}),
      alertId,
    },
  };
  return createUserNotification(userId, enriched);
}

/**
 * Scheduled alert: portal + optional email, with deduplication.
 */
export async function dispatchScheduledAlert({
  alertId,
  userId,
  payload,
  emailFn = null,
  dedupHours = DEDUP_HOURS,
}) {
  if (!userId || !alertId || !payload?.title) return { skipped: true };

  const entityId = payload.entityId || null;
  if (entityId && (await wasAlertDispatchedRecently(userId, alertId, entityId, dedupHours))) {
    return { skipped: true, reason: 'dedup' };
  }

  const portal = await createAlertNotification(userId, alertId, {
    ...payload,
    metadata: { ...(payload.metadata || {}), scheduled: true },
  });

  let email = null;
  if (emailFn && (await isAlertEmailEnabled(alertId, userId))) {
    try {
      email = await emailFn();
    } catch (error) {
      console.warn(`[alert-dispatch] email failed for ${alertId}:`, error?.message || error);
    }
  }

  return { portal, email };
}

/**
 * Send a test email for an alert to the requesting user.
 */
export async function sendTestAlertEmail({ userId, userEmail, userName, alertId }) {
  const alert = getAlertDefinition(alertId);
  if (!alert) throw new Error('Unknown alert');

  if (!userEmail) throw new Error('Your account has no email address');

  let subject;
  let html;

  if (alert.emailTriggerId) {
    const vars = getSampleVarsForAlert(alertId, userName);
    const rendered = await renderNotificationTriggerEmail(
      alert.emailTriggerId,
      userId,
      vars
    );
    subject = `[TEST] ${rendered.subject}`;
    const previewBanner = `<div style="border:2px dashed #2563eb;border-radius:8px;padding:12px;margin-bottom:16px;background:#eff6ff;font-family:Arial,sans-serif;font-size:13px;color:#1e40af;"><strong>Preview:</strong> This sample uses the same template and fields as a real ${alert.label} alert.</div>`;
    html = `${previewBanner}${rendered.html}`;

    if (alertId === 'candidate.rejected') {
      const candidateVars = sampleVarsForTrigger('candidate.rejected_email');
      const candidateRendered = await renderNotificationTriggerEmail(
        'candidate.rejected_email',
        userId,
        candidateVars
      );
      html += `<hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;" />
<div style="border:2px dashed #7c3aed;border-radius:8px;padding:12px;margin-bottom:16px;background:#f5f3ff;font-family:Arial,sans-serif;font-size:13px;color:#5b21b6;"><strong>Candidate email preview:</strong> Sent to the candidate when &quot;Send rejection email&quot; is checked (same toggle).</div>${candidateRendered.html}`;
    }
  } else {
    subject = `[TEST] ${alert.label}`;
    html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:24px;">
      <h2 style="color:#2563eb;">Test: ${alert.label}</h2>
      <p>Hello ${userName || 'there'},</p>
      <p>This is a test email for the <strong>${alert.label}</strong> alert in Alerts Management.</p>
      <p style="color:#6b7280;font-size:14px;">${alert.description || ''}</p>
      <p>When this alert fires in production, the assigned user receives it based on your toggle settings.</p>
    </body></html>`;
  }

  return sendAlertTestEmail({
    senderUserId: userId,
    toEmail: userEmail,
    subject,
    html,
    triggerId: alert.emailTriggerId || null,
  });
}

/**
 * Create a test portal notification for the requesting user.
 */
export async function sendTestAlertPortal({ userId, alertId }) {
  const alert = getAlertDefinition(alertId);
  if (!alert) throw new Error('Unknown alert');

  const preview = samplePortalDescription(alertId);
  const created = await createUserNotification(userId, {
    category: alert.category || 'SYSTEM',
    title: `[TEST] ${alert.label}`,
    description: preview
      ? `[Preview] ${preview}`
      : `Test notification for "${alert.label}". ${alert.description || ''}`,
    actionLabel: 'Dismiss',
    actionPath: '/setting?section=alerts-management',
    metadata: { test: true, alertId, preview: Boolean(preview) },
  });

  if (!created) throw new Error('Failed to create test notification');
  return created;
}

export async function isAlertEmailChannelEnabled(alertId, userId) {
  return isAlertEmailEnabled(alertId, userId);
}
