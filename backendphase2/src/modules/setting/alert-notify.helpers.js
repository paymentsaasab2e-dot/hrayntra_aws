import { prisma } from '../../config/prisma.js';
import { sendLifecycleAlertEmail } from '../../services/emailService.js';
import { normalizePostServiceKycForm } from '../../utils/postServiceKycFormFields.js';
import { getAlertDefinition } from './alert-settings.js';
import { dispatchScheduledAlert } from './alert-dispatch.service.js';
import { renderNotificationTriggerEmail } from './notification-trigger-template-settings.js';

export function entityLabel(name, fallback = 'Record') {
  const value = String(name || '').trim();
  return value || fallback;
}

export function personName(user) {
  if (!user) return null;
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || null;
}

export function candidateDisplayName(candidate) {
  if (!candidate) return 'Candidate';
  return (
    `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() ||
    candidate.email ||
    'Candidate'
  );
}

export function isClientKycIncomplete(client) {
  const form = normalizePostServiceKycForm(client?.postServiceKycForm);
  if (!form) return false;
  const info = form.clientInformation || {};
  const hasText =
    Boolean(info.tradeName || info.legalRegistrationNumber || info.taxIdVatNumber || info.signatoryFullName);
  if (!hasText) return false;
  const files = form.attachmentsChecklist || {};
  const hasDocs =
    (files.shareholderPassportCopyFiles?.length || 0) > 0 ||
    (files.generalManagerIdCardFiles?.length || 0) > 0 ||
    (files.companyDocumentFiles?.length || 0) > 0 ||
    (files.bankAccountProofFiles?.length || 0) > 0;
  return !hasDocs;
}

/**
 * Dispatch portal + optional lifecycle email for one recipient.
 */
export async function notifyUserAlert({
  alertId,
  userId,
  portalPayload,
  emailTo = null,
  emailVars = {},
  senderUserId = null,
  dedupHours,
}) {
  if (!userId || !alertId || !portalPayload?.title) return null;

  const alert = getAlertDefinition(alertId);
  const emailFn =
    emailTo && alert?.emailTriggerId
      ? async () => {
          const rendered = await renderNotificationTriggerEmail(
            alert.emailTriggerId,
            senderUserId || userId,
            emailVars
          );
          return sendLifecycleAlertEmail({
            senderUserId: senderUserId || userId,
            toEmail: emailTo,
            subject: rendered.subject,
            html: rendered.html,
            triggerId: alert.emailTriggerId,
          });
        }
      : null;

  return dispatchScheduledAlert({
    alertId,
    userId,
    payload: portalPayload,
    emailFn,
    dedupHours,
  });
}

export async function notifyUsersAlert({
  alertId,
  userIds = [],
  portalPayload,
  emailByUserId = {},
  senderUserId = null,
  dedupHours,
}) {
  const unique = [...new Set(userIds.filter(Boolean))];
  await Promise.allSettled(
    unique.map((uid) =>
      notifyUserAlert({
        alertId,
        userId: uid,
        portalPayload,
        emailTo: emailByUserId[uid] || null,
        emailVars: portalPayload?.metadata?.emailVars || {},
        senderUserId,
        dedupHours,
      })
    )
  );
}

async function loadUserContact(userId) {
  if (!userId) return { email: null, name: 'Team Member' };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, firstName: true, lastName: true },
  });
  return {
    email: user?.email || null,
    name: personName(user) || 'Team Member',
  };
}

// ── Leads ──

export async function notifyLeadStatusChanged({
  lead,
  previousStatus,
  newStatus,
  performedById,
  performedByName,
}) {
  const ownerId = lead?.assignedToId;
  if (!ownerId || !newStatus || previousStatus === newStatus) return;
  const label = entityLabel(lead.companyName || lead.contactPerson, 'Lead');
  const normalized = String(newStatus).trim();
  if (normalized === 'Lost') return notifyLeadMarkedLost({ lead, lostReason: lead.lostReason, performedById, performedByName });
  if (normalized === 'Converted') return;

  const { email, name: recipientName } = await loadUserContact(ownerId);
  await notifyUserAlert({
    alertId: 'lead.status_changed',
    userId: ownerId,
    senderUserId: performedById,
    emailTo: email,
    emailVars: {
      recipientName,
      leadCompanyName: label,
      previousStatus: previousStatus || '—',
      newStatus: normalized,
      changedBy: performedByName ? ` by ${performedByName}` : '',
    },
    portalPayload: {
      category: 'LEAD',
      title: 'Lead status changed',
      description: `${label}: ${previousStatus || '—'} → ${normalized}.`,
      actionLabel: 'Open lead',
      actionPath: `/leads?leadId=${lead.id}`,
      entityType: 'LEAD',
      entityId: lead.id,
      metadata: { previousStatus, newStatus, emailVars: { recipientName: 'Team Member', leadCompanyName: label, previousStatus, newStatus, changedBy: '' } },
    },
    dedupHours: 1,
  });
}

export async function notifyLeadMarkedLost({ lead, lostReason, performedById, performedByName }) {
  const ownerId = lead?.assignedToId;
  if (!ownerId) return;
  const label = entityLabel(lead.companyName || lead.contactPerson, 'Lead');
  const { email, name: recipientName } = await loadUserContact(ownerId);
  await notifyUserAlert({
    alertId: 'lead.marked_lost',
    userId: ownerId,
    senderUserId: performedById,
    emailTo: email,
    emailVars: {
      recipientName,
      leadCompanyName: label,
      lostReason: lostReason || 'No reason provided',
    },
    portalPayload: {
      category: 'LEAD',
      title: 'Lead marked as lost',
      description: `${label} was marked Lost.${lostReason ? ` Reason: ${lostReason}` : ''}`,
      actionLabel: 'Open lead',
      actionPath: `/leads?leadId=${lead.id}`,
      entityType: 'LEAD',
      entityId: lead.id,
    },
    dedupHours: 1,
  });
}

export async function notifyLeadConvertedToClient({ lead, client, performedById, performedByName }) {
  const ownerId = lead?.assignedToId || client?.assignedToId;
  if (!ownerId) return;
  const leadLabel = entityLabel(lead?.companyName || lead?.contactPerson, 'Lead');
  const clientLabel = entityLabel(client?.companyName, 'Client');
  const { email, name: recipientName } = await loadUserContact(ownerId);
  await notifyUserAlert({
    alertId: 'lead.converted_to_client',
    userId: ownerId,
    senderUserId: performedById,
    emailTo: email,
    emailVars: {
      recipientName,
      leadCompanyName: leadLabel,
      clientCompanyName: clientLabel,
      previousStatus: lead?.status || 'New',
    },
    portalPayload: {
      category: 'LEAD',
      title: 'Lead converted to client',
      description: `${leadLabel} was converted to client "${clientLabel}".`,
      actionLabel: 'Open client',
      actionPath: `/client?clientId=${client.id}`,
      entityType: 'CLIENT',
      entityId: client.id,
      metadata: { leadId: lead?.id },
    },
    dedupHours: 1,
  });
}

// ── Clients ──

export async function notifyClientStatusChanged({
  client,
  previousStatus,
  newStatus,
  performedById,
  performedByName,
}) {
  const ownerId = client?.assignedToId;
  if (!ownerId || !newStatus || previousStatus === newStatus) return;
  const label = entityLabel(client.companyName, 'Client');
  const { email, name: recipientName } = await loadUserContact(ownerId);
  await notifyUserAlert({
    alertId: 'client.status_changed',
    userId: ownerId,
    senderUserId: performedById,
    emailTo: email,
    emailVars: {
      recipientName,
      clientCompanyName: label,
      previousStatus: previousStatus || '—',
      newStatus: String(newStatus),
    },
    portalPayload: {
      category: 'CLIENT',
      title: 'Client status changed',
      description: `${label}: ${previousStatus || '—'} → ${newStatus}.`,
      actionLabel: 'Open client',
      actionPath: `/client?clientId=${client.id}`,
      entityType: 'CLIENT',
      entityId: client.id,
    },
    dedupHours: 1,
  });
}

export async function notifyClientKycIncomplete({ client, performedById }) {
  if (!isClientKycIncomplete(client)) return;
  const ownerId = client?.assignedToId;
  if (!ownerId) return;
  const label = entityLabel(client.companyName, 'Client');
  const { email, name: recipientName } = await loadUserContact(ownerId);
  await notifyUserAlert({
    alertId: 'client.kyc_incomplete',
    userId: ownerId,
    senderUserId: performedById,
    emailTo: email,
    emailVars: {
      recipientName,
      clientCompanyName: label,
      missingItems: 'KYC text fields are filled but required documents are not uploaded.',
    },
    portalPayload: {
      category: 'CLIENT',
      title: 'KYC incomplete',
      description: `${label} has KYC details but missing compliance documents.`,
      actionLabel: 'Open client',
      actionPath: `/client?clientId=${client.id}`,
      entityType: 'CLIENT',
      entityId: client.id,
    },
    dedupHours: 24,
  });
}

// ── Jobs ──

export async function notifyJobClosed({ job, previousStatus, performedById, performedByName }) {
  const ownerId = job?.assignedToId;
  if (!ownerId) return;
  const contact = await loadUserContact(ownerId);
  const email = job?.assignedTo?.email || contact.email;
  const recipientName = job?.assignedTo?.name || contact.name;
  await notifyUserAlert({
    alertId: 'job.closed',
    userId: ownerId,
    senderUserId: performedById,
    emailTo: email,
    emailVars: {
      recipientName,
      jobTitle: job?.title || 'Job',
      companyName: job?.client?.companyName || '',
      closedReason: `Status changed from ${previousStatus || 'OPEN'} to ${job?.status || 'CLOSED'}.`,
    },
    portalPayload: {
      category: 'JOB',
      title: 'Job closed / filled',
      description: `${job?.title || 'Job'} is now ${job?.status || 'closed'}.`,
      actionLabel: 'Open job',
      actionPath: `/job?jobId=${job.id}`,
      entityType: 'JOB',
      entityId: job.id,
    },
    dedupHours: 1,
  });
}

export async function notifyJobNearSla({ job }) {
  const ownerId = job?.assignedToId;
  if (!ownerId) return;
  const { email, name: recipientName } = await loadUserContact(ownerId);
  const closure = job?.expectedClosureDate
    ? new Date(job.expectedClosureDate).toLocaleDateString('en-US', { dateStyle: 'medium' })
    : 'soon';
  await notifyUserAlert({
    alertId: 'job.near_sla',
    userId: ownerId,
    emailTo: email,
    emailVars: {
      recipientName,
      jobTitle: job?.title || 'Job',
      companyName: job?.client?.companyName || '',
      expectedClosureDate: closure,
    },
    portalPayload: {
      category: 'JOB',
      title: 'Job near SLA / deadline',
      description: `${job?.title || 'Job'} is at risk — target date ${closure}.`,
      actionLabel: 'Open job',
      actionPath: `/job?jobId=${job.id}`,
      entityType: 'JOB',
      entityId: job.id,
    },
  });
}

export async function notifyJobZeroApplicants({ job, applicantCount = 0 }) {
  const ownerId = job?.assignedToId || job?.createdById;
  if (!ownerId || applicantCount > 0) return;
  const { email, name: recipientName } = await loadUserContact(ownerId);
  await notifyUserAlert({
    alertId: 'job.zero_applicants',
    userId: ownerId,
    emailTo: email,
    emailVars: {
      recipientName,
      jobTitle: job?.title || 'Job',
      companyName: job?.client?.companyName || '',
    },
    portalPayload: {
      category: 'JOB',
      title: 'Zero applicants on open job',
      description: `${job?.title || 'Job'} has no applicants yet — sourcing needed.`,
      actionLabel: 'Open job',
      actionPath: `/job?jobId=${job.id}`,
      entityType: 'JOB',
      entityId: job.id,
    },
  });
}

// ── Candidates ──

export async function notifyCandidateStageChanged({
  candidate,
  job,
  previousStage,
  newStage,
  performedById,
}) {
  const ownerId = candidate?.assignedToId || performedById;
  if (!ownerId || !newStage || previousStage === newStage) return;
  const name = candidateDisplayName(candidate);
  const { email, name: recipientName } = await loadUserContact(ownerId);
  await notifyUserAlert({
    alertId: 'candidate.stage_changed',
    userId: ownerId,
    senderUserId: performedById,
    emailTo: email,
    emailVars: {
      recipientName,
      candidateName: name,
      jobTitle: job?.title || 'Role',
      previousStage: previousStage || '—',
      newStage: String(newStage),
    },
    portalPayload: {
      category: 'CANDIDATE',
      title: 'Pipeline stage changed',
      description: `${name} moved to ${newStage}${job?.title ? ` (${job.title})` : ''}.`,
      actionLabel: 'View candidate',
      actionPath: `/candidate?candidateId=${candidate.id}`,
      entityType: 'CANDIDATE',
      entityId: candidate.id,
      metadata: { jobId: job?.id || null },
    },
    dedupHours: 1,
  });
}

export async function notifyCandidateHired({ candidate, job, client, placementId, recruiterId }) {
  const ownerId = recruiterId || candidate?.assignedToId;
  if (!ownerId) return;
  const name = candidateDisplayName(candidate);
  const { email, name: recipientName } = await loadUserContact(ownerId);
  await notifyUserAlert({
    alertId: 'candidate.hired',
    userId: ownerId,
    emailTo: email,
    emailVars: {
      recipientName,
      candidateName: name,
      jobTitle: job?.title || 'Role',
      companyName: client?.companyName || '',
      startDate: new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }),
    },
    portalPayload: {
      category: 'CANDIDATE',
      title: 'Candidate hired / placed',
      description: `${name} placed at ${client?.companyName || 'client'} for ${job?.title || 'role'}.`,
      actionLabel: 'View placement',
      actionPath: placementId ? `/placement?placementId=${placementId}` : `/candidate?candidateId=${candidate.id}`,
      entityType: 'PLACEMENT',
      entityId: placementId || candidate.id,
    },
    dedupHours: 1,
  });
}

// ── Interviews ──

export async function notifyInterviewCancelled({
  interview,
  candidate,
  job,
  recipientUserIds = [],
  reason,
  performedById,
}) {
  const name = candidateDisplayName(candidate);
  const jobTitle = job?.title || 'the role';
  const when = interview?.scheduledAt
    ? new Date(interview.scheduledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : 'the scheduled time';
  const ids = [...new Set(recipientUserIds.filter(Boolean))];
  await Promise.allSettled(
    ids.map(async (uid) => {
      const { email, name: recipientName } = await loadUserContact(uid);
      return notifyUserAlert({
        alertId: 'interview.cancelled',
        userId: uid,
        senderUserId: performedById,
        emailTo: email,
        emailVars: {
          recipientName,
          candidateName: name,
          jobTitle,
          scheduledAt: when,
          reason: reason || 'Interview cancelled',
        },
        portalPayload: {
          category: 'INTERVIEW',
          title: 'Interview cancelled',
          description: `${name} — ${jobTitle} on ${when} was cancelled.`,
          actionLabel: 'Open interviews',
          actionPath: `/interviews?interviewId=${interview.id}`,
          entityType: 'INTERVIEW',
          entityId: interview.id,
        },
        dedupHours: 1,
      });
    })
  );
}

export async function notifyInterviewTodayReminder({ interview, candidate, job, userId }) {
  if (!userId) return;
  const name = candidateDisplayName(candidate);
  const jobTitle = job?.title || 'the role';
  const when = interview?.scheduledAt
    ? new Date(interview.scheduledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : 'today';
  const { email, name: recipientName } = await loadUserContact(userId);
  await notifyUserAlert({
    alertId: 'interview.today_reminder',
    userId,
    emailTo: email,
    emailVars: {
      recipientName,
      candidateName: name,
      jobTitle,
      scheduledAt: when,
    },
    portalPayload: {
      category: 'INTERVIEW',
      title: 'Interview today',
      description: `${name} for ${jobTitle} — ${when}.`,
      actionLabel: 'Open interview',
      actionPath: `/interviews?interviewId=${interview.id}`,
      entityType: 'INTERVIEW',
      entityId: interview.id,
    },
  });
}

// ── Matches ──

export async function notifyMatchSubmittedToClient({ match, userId, candidateName, jobTitle, clientName }) {
  if (!userId) return;
  const { email, name: recipientName } = await loadUserContact(userId);
  await notifyUserAlert({
    alertId: 'match.submitted_to_client',
    userId,
    emailTo: email,
    emailVars: {
      recipientName,
      candidateName: candidateName || 'Candidate',
      jobTitle: jobTitle || 'Role',
      clientName: clientName || 'Client',
      message: `${candidateName || 'Candidate'} was submitted to ${clientName || 'the client'} for review.`,
    },
    portalPayload: {
      category: 'CLIENT',
      title: 'Candidates submitted to client',
      description: `${candidateName || 'Candidate'} submitted for ${jobTitle || 'role'} (${clientName || 'client'}).`,
      actionLabel: 'View matches',
      actionPath: `/candidate?candidateId=${match.candidateId}`,
      entityType: 'CANDIDATE',
      entityId: match.candidateId,
      metadata: { matchId: match.id, jobId: match.jobId },
    },
    dedupHours: 1,
  });
}

export async function notifyMatchClientReviewCompleted({
  recruiterUserId,
  candidateName,
  jobTitle,
  clientName,
  tag,
  candidateId,
  jobId,
}) {
  if (!recruiterUserId) return;
  const { email, name: recipientName } = await loadUserContact(recruiterUserId);
  await notifyUserAlert({
    alertId: 'match.client_review_completed',
    userId: recruiterUserId,
    emailTo: email,
    emailVars: {
      recipientName,
      candidateName: candidateName || 'Candidate',
      jobTitle: jobTitle || 'Role',
      clientName: clientName || 'Client',
      reviewTag: tag || 'Review submitted',
    },
    portalPayload: {
      category: 'CLIENT',
      title: 'Client review completed',
      description: `${clientName || 'Client'} reviewed ${candidateName || 'candidate'} for ${jobTitle || 'role'}: ${tag || 'submitted'}.`,
      actionLabel: 'View candidate',
      actionPath: `/candidate?candidateId=${candidateId}`,
      entityType: 'CANDIDATE',
      entityId: candidateId,
      metadata: { jobId, tag },
    },
    dedupHours: 1,
  });
}

// ── Billing ──

export async function notifyInvoiceSent({ record, senderUserId, toEmail }) {
  const recruiterId = record?.placement?.recruiterId || senderUserId;
  if (!recruiterId) return;
  const clientName = record?.client?.companyName || record?.placement?.client?.companyName || 'Client';
  const invoiceNumber = record?.invoiceNumber || record?.id;
  const amount = record?.amount != null ? String(record.amount) : '—';
  const { email, name: recipientName } = await loadUserContact(recruiterId);
  await notifyUserAlert({
    alertId: 'billing.invoice_sent',
    userId: recruiterId,
    senderUserId,
    emailTo: email,
    emailVars: {
      recipientName,
      invoiceNumber,
      amount,
      dueDate: record?.dueDate
        ? new Date(record.dueDate).toLocaleDateString('en-US', { dateStyle: 'medium' })
        : '—',
      companyName: clientName,
    },
    portalPayload: {
      category: 'BILLING',
      title: 'Invoice sent to client',
      description: `${invoiceNumber} sent to ${clientName} (${amount}).`,
      actionLabel: 'Open billing',
      actionPath: `/billing?invoiceId=${record.id}`,
      entityType: 'BILLING',
      entityId: record.id,
      metadata: { clientEmail: toEmail },
    },
    dedupHours: 1,
  });
}

export async function notifyDraftInvoiceReady({ record, userId }) {
  if (!userId) return;
  const clientName = record?.client?.companyName || 'Client';
  const invoiceNumber = record?.invoiceNumber || 'Draft';
  const amount = record?.amount != null ? String(record.amount) : '—';
  const { email, name: recipientName } = await loadUserContact(userId);
  await notifyUserAlert({
    alertId: 'billing.draft_ready',
    userId,
    emailTo: email,
    emailVars: {
      recipientName,
      invoiceNumber,
      clientName,
      amount,
      dueDate: record?.dueDate
        ? new Date(record.dueDate).toLocaleDateString('en-US', { dateStyle: 'medium' })
        : '—',
    },
    portalPayload: {
      category: 'BILLING',
      title: 'Draft invoice ready',
      description: `${invoiceNumber} for ${clientName} is ready to review (${amount}).`,
      actionLabel: 'Open billing',
      actionPath: `/billing?invoiceId=${record.id}`,
      entityType: 'BILLING',
      entityId: record.id,
    },
    dedupHours: 1,
  });
}

function formatWhenLabel(value, fallback = '—') {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

// ── Interviews (reschedule) ──

export async function notifyInterviewRescheduled({
  interviewId,
  candidateName,
  jobTitle,
  scheduledAt,
  previousScheduledAt = null,
  recipientUserIds = [],
  performedById,
}) {
  const name = entityLabel(candidateName, 'Candidate');
  const role = entityLabel(jobTitle, 'Role');
  const when = formatWhenLabel(scheduledAt, 'the new time');
  const prevWhen = formatWhenLabel(previousScheduledAt, 'the previous time');
  const ids = [...new Set(recipientUserIds.filter(Boolean))];
  await Promise.allSettled(
    ids.map(async (uid) => {
      const { email, name: recipientName } = await loadUserContact(uid);
      return notifyUserAlert({
        alertId: 'interview.rescheduled',
        userId: uid,
        senderUserId: performedById,
        emailTo: email,
        emailVars: {
          recipientName,
          candidateName: name,
          jobTitle: role,
          previousScheduledAt: prevWhen,
          scheduledAt: when,
        },
        portalPayload: {
          category: 'INTERVIEW',
          title: 'Interview rescheduled',
          description: `${name} — ${role} moved to ${when}.`,
          actionLabel: 'Open interview',
          actionPath: `/interviews?interviewId=${interviewId}`,
          entityType: 'INTERVIEW',
          entityId: interviewId,
        },
        dedupHours: 1,
      });
    })
  );
}

// ── Placements ──

export async function notifyPlacementCreated({
  placementId,
  candidateName,
  clientName,
  jobTitle,
  userIds = [],
  hasOfferLetter = false,
  senderUserId = null,
}) {
  const name = entityLabel(candidateName, 'Candidate');
  const company = entityLabel(clientName, 'Client');
  const role = entityLabel(jobTitle, 'Role');
  const details = hasOfferLetter
    ? 'Offer letter is attached and ready for the candidate.'
    : 'Placement record created — coordinate offer and onboarding.';
  const ids = [...new Set(userIds.filter(Boolean))];
  await Promise.allSettled(
    ids.map(async (uid) => {
      const { email, name: recipientName } = await loadUserContact(uid);
      return notifyUserAlert({
        alertId: 'placement.created',
        userId: uid,
        senderUserId,
        emailTo: email,
        emailVars: {
          recipientName,
          candidateName: name,
          jobTitle: role,
          companyName: company,
          placementDetails: details,
        },
        portalPayload: {
          category: 'PLACEMENT',
          title: 'Placement created',
          description: `${name} placed at ${company} for ${role}.`,
          actionLabel: 'View placement',
          actionPath: `/placement?placementId=${placementId}`,
          entityType: 'PLACEMENT',
          entityId: placementId,
        },
        dedupHours: 1,
      });
    })
  );
}

export async function notifyPlacementOfferResponse({
  placementId,
  candidateName,
  jobTitle,
  isAccept,
  userIds = [],
}) {
  const name = entityLabel(candidateName, 'Candidate');
  const role = entityLabel(jobTitle, 'Role');
  const responseLabel = isAccept ? 'Accepted' : 'Declined';
  const responseMessage = isAccept ? 'accepted the offer' : 'declined the offer';
  const ids = [...new Set(userIds.filter(Boolean))];
  await Promise.allSettled(
    ids.map(async (uid) => {
      const { email, name: recipientName } = await loadUserContact(uid);
      return notifyUserAlert({
        alertId: 'placement.offer_response',
        userId: uid,
        emailTo: email,
        emailVars: {
          recipientName,
          candidateName: name,
          jobTitle: role,
          responseLabel,
          responseMessage,
        },
        portalPayload: {
          category: 'PLACEMENT',
          title: isAccept ? 'Offer accepted' : 'Offer declined',
          description: `${name} ${responseMessage} for ${role}.`,
          actionLabel: 'View placement',
          actionPath: `/placement?placementId=${placementId}`,
          entityType: 'PLACEMENT',
          entityId: placementId,
        },
        dedupHours: 1,
      });
    })
  );
}

// ── Candidate rejection (team) ──

export async function notifyCandidateRejectedInternal({
  userId,
  candidateId,
  candidateName,
  reason,
  jobTitle = null,
  performedById,
  candidateEmailSent = false,
}) {
  if (!userId) return;
  const name = entityLabel(candidateName, 'Candidate');
  const role = entityLabel(jobTitle, 'the role');
  const { email, name: recipientName } = await loadUserContact(userId);
  await notifyUserAlert({
    alertId: 'candidate.rejected',
    userId,
    senderUserId: performedById,
    emailTo: email,
    emailVars: {
      recipientName,
      candidateName: name,
      jobTitle: role,
      reason: reason || 'Not specified',
      rejectionNote: candidateEmailSent
        ? 'A rejection email was sent to the candidate.'
        : 'No rejection email was sent to the candidate.',
    },
    portalPayload: {
      category: 'CANDIDATE',
      title: 'Candidate rejected',
      description: `${name} was rejected (${reason || 'Not specified'}).`,
      actionLabel: 'View candidate',
      actionPath: `/candidate?candidateId=${candidateId}`,
      entityType: 'CANDIDATE',
      entityId: candidateId,
    },
    dedupHours: 1,
  });
}

// ── Portal applications ──

export async function notifyJobPortalApplication({
  userIds = [],
  candidateName,
  jobTitle,
  candidateId,
  jobId,
  isReapply = false,
}) {
  const name = entityLabel(candidateName, 'Candidate');
  const role = entityLabel(jobTitle, 'Job');
  const alertId = isReapply ? 'job.candidate_reapplied' : 'job.portal_application';
  const applicationMessage = isReapply
    ? 'Review the updated application and pipeline stage.'
    : 'Review the new application in the candidate profile.';
  const ids = [...new Set(userIds.filter(Boolean))];
  await Promise.allSettled(
    ids.map(async (uid) => {
      const { email, name: recipientName } = await loadUserContact(uid);
      return notifyUserAlert({
        alertId,
        userId: uid,
        emailTo: email,
        emailVars: {
          recipientName,
          candidateName: name,
          jobTitle: role,
          applicationMessage,
        },
        portalPayload: {
          category: isReapply ? 'JOB' : 'CANDIDATE',
          title: isReapply ? 'Candidate re-applied' : 'Candidate applied for job',
          description: `${name} applied to ${role}${
            isReapply ? ' (previously rejected — moved back to Applied)' : ''
          }.`,
          actionLabel: 'View candidate',
          actionPath: `/candidate?candidateId=${candidateId}`,
          entityType: 'CANDIDATE',
          entityId: candidateId,
          metadata: {
            kind: isReapply ? 'portal-reapply-after-reject' : 'portal-apply',
            jobId,
            jobTitle: role,
          },
        },
        dedupHours: 1,
      });
    })
  );
}
