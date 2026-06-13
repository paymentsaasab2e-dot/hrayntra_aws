import { prisma } from '../../config/prisma.js';
import { sendLeadFollowUpEmail } from '../../emails/email.service.js';
import { sendClientFollowUpReminderEmail } from '../../services/emailService.js';
import { dispatchScheduledAlert } from './alert-dispatch.service.js';
import {
  notifyInterviewTodayReminder,
  notifyJobNearSla,
  notifyJobZeroApplicants,
} from './alert-notify.helpers.js';

const FEEDBACK_OVERDUE_HOURS = Number(process.env.ALERT_FEEDBACK_OVERDUE_HOURS || 48);
const PLACEMENT_REMINDER_DAYS = Number(process.env.ALERT_PLACEMENT_REMINDER_DAYS || 30);

const TERMINAL_LEAD_STATUSES = ['Lost', 'Converted'];
const TERMINAL_PIPELINE_STAGES = new Set([
  'rejected',
  'hired',
  'joined',
  'placed',
  'withdrawn',
  'dropped',
]);

let schedulerRunning = false;

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function isDueToday(date) {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return d >= startOfDay() && d <= endOfDay();
}

function isOverdue(date) {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return d < startOfDay();
}

function formatDateLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { dateStyle: 'medium' });
}

function getCandidateFollowUpDate(candidate) {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object') return null;
  const raw = extra.nextFollowUp || extra.nextFollowUpAt || extra.followUpDate;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function processLeadFollowUps() {
  const leads = await prisma.lead.findMany({
    where: {
      isDeleted: { not: true },
      assignedToId: { not: null },
      nextFollowUp: { not: null },
      status: { notIn: TERMINAL_LEAD_STATUSES },
      convertedToClientId: null,
    },
    select: {
      id: true,
      companyName: true,
      contactPerson: true,
      nextFollowUp: true,
      assignedToId: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    take: 500,
  });

  for (const lead of leads) {
    const userId = lead.assignedToId;
    if (!userId) continue;
    const label = lead.companyName || lead.contactPerson || 'Lead';
    const followUp = lead.nextFollowUp;

    if (isDueToday(followUp)) {
      await dispatchScheduledAlert({
        alertId: 'lead.followup_due_today',
        userId,
        payload: {
          category: 'LEAD',
          title: 'Lead follow-up due today',
          description: `Follow up with ${label} today.`,
          actionLabel: 'Open lead',
          actionPath: `/leads?leadId=${lead.id}`,
          entityType: 'LEAD',
          entityId: lead.id,
        },
        emailFn: async () => {
          if (!lead.assignedTo?.email) return null;
          return sendLeadFollowUpEmail(
            lead.assignedTo.email,
            label,
            formatDateLabel(followUp),
            'Reminder',
            'Follow-up due today — please connect with this lead.'
          );
        },
      });
    } else if (isOverdue(followUp)) {
      await dispatchScheduledAlert({
        alertId: 'lead.followup_overdue',
        userId,
        payload: {
          category: 'LEAD',
          title: 'Lead follow-up overdue',
          description: `Follow-up for ${label} was due ${formatDateLabel(followUp)}.`,
          actionLabel: 'Open lead',
          actionPath: `/leads?leadId=${lead.id}`,
          entityType: 'LEAD',
          entityId: lead.id,
        },
        emailFn: async () => {
          if (!lead.assignedTo?.email) return null;
          return sendLeadFollowUpEmail(
            lead.assignedTo.email,
            label,
            formatDateLabel(followUp),
            'Overdue reminder',
            'This follow-up is overdue — please act today.'
          );
        },
      });
    }
  }
}

async function processClientFollowUps() {
  const clients = await prisma.client.findMany({
    where: {
      isDeleted: { not: true },
      assignedToId: { not: null },
      nextFollowUpDue: { not: null },
    },
    select: {
      id: true,
      companyName: true,
      nextFollowUpDue: true,
      assignedToId: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    take: 500,
  });

  for (const client of clients) {
    const userId = client.assignedToId;
    if (!userId) continue;
    const label = client.companyName || 'Client';
    const followUp = client.nextFollowUpDue;

    if (isDueToday(followUp)) {
      await dispatchScheduledAlert({
        alertId: 'client.followup_due',
        userId,
        payload: {
          category: 'CLIENT',
          title: 'Client follow-up due today',
          description: `Follow up with ${label} today.`,
          actionLabel: 'Open client',
          actionPath: `/client?clientId=${client.id}`,
          entityType: 'CLIENT',
          entityId: client.id,
        },
        emailFn: async () => {
          if (!client.assignedTo?.email) return null;
          return sendClientFollowUpReminderEmail({
            toEmail: client.assignedTo.email,
            recipientName: client.assignedTo.name,
            clientCompanyName: label,
            followUpDueDate: followUp,
            notes: 'Follow-up due today.',
            senderUserId: null,
          });
        },
      });
    } else if (isOverdue(followUp)) {
      await dispatchScheduledAlert({
        alertId: 'client.followup_overdue',
        userId,
        payload: {
          category: 'CLIENT',
          title: 'Client follow-up overdue',
          description: `Follow-up for ${label} was due ${formatDateLabel(followUp)}.`,
          actionLabel: 'Open client',
          actionPath: `/client?clientId=${client.id}`,
          entityType: 'CLIENT',
          entityId: client.id,
        },
        emailFn: async () => {
          if (!client.assignedTo?.email) return null;
          return sendClientFollowUpReminderEmail({
            toEmail: client.assignedTo.email,
            recipientName: client.assignedTo.name,
            clientCompanyName: label,
            followUpDueDate: followUp,
            notes: 'This client follow-up is overdue.',
            senderUserId: null,
          });
        },
      });
    }
  }
}

async function processPipelineFollowUps() {
  const candidates = await prisma.candidate.findMany({
    where: {
      isDeleted: { not: true },
      assignedToId: { not: null },
      stage: { not: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      stage: true,
      assignedToId: true,
      extraData: true,
    },
    take: 500,
  });

  for (const candidate of candidates) {
    const stage = String(candidate.stage || '').trim().toLowerCase();
    if (!stage || TERMINAL_PIPELINE_STAGES.has(stage)) continue;

    const followUp = getCandidateFollowUpDate(candidate);
    if (!followUp) continue;
    if (!isDueToday(followUp) && !isOverdue(followUp)) continue;

    const userId = candidate.assignedToId;
    const name =
      `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() ||
      candidate.email ||
      'Candidate';
    const isToday = isDueToday(followUp);

    await dispatchScheduledAlert({
      alertId: 'pipeline.followup_overdue',
      userId,
      payload: {
        category: 'CANDIDATE',
        title: isToday ? 'Pipeline follow-up due today' : 'Pipeline follow-up overdue',
        description: `${name} — follow-up ${isToday ? 'due today' : `overdue since ${formatDateLabel(followUp)}`}.`,
        actionLabel: 'Open pipeline',
        actionPath: `/pipeline?candidateId=${candidate.id}`,
        entityType: 'CANDIDATE',
        entityId: candidate.id,
        metadata: { stage: candidate.stage, followUpKind: isToday ? 'due_today' : 'overdue' },
      },
    });
  }
}

async function processTaskReminders() {
  // dueDate is required on Task — do not use `{ not: null }` (invalid for required DateTime).
  const tasks = await prisma.task.findMany({
    where: {
      status: { notIn: ['DONE', 'CANCELLED'] },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      assignedToId: true,
    },
    take: 500,
  });

  for (const task of tasks) {
    if (!task.assignedToId || !task.dueDate) continue;

    if (isDueToday(task.dueDate)) {
      await dispatchScheduledAlert({
        alertId: 'task.due_today',
        userId: task.assignedToId,
        payload: {
          category: 'TASK',
          title: 'Task due today',
          description: `"${task.title}" is due today.`,
          actionLabel: 'Open task',
          actionPath: `/Task&Activites?taskId=${encodeURIComponent(task.id)}`,
          entityType: 'TASK',
          entityId: task.id,
        },
      });
    } else if (isOverdue(task.dueDate)) {
      await dispatchScheduledAlert({
        alertId: 'task.overdue',
        userId: task.assignedToId,
        payload: {
          category: 'TASK',
          title: 'Task overdue',
          description: `"${task.title}" was due ${formatDateLabel(task.dueDate)}.`,
          actionLabel: 'Open task',
          actionPath: `/Task&Activites?taskId=${encodeURIComponent(task.id)}`,
          entityType: 'TASK',
          entityId: task.id,
        },
      });
    }
  }
}

async function processInvoiceOverdue() {
  const now = new Date();
  const overdueRecords = await prisma.billingRecord.findMany({
    where: {
      dueDate: { lt: startOfDay() },
      status: { in: ['SENT', 'OVERDUE'] },
      paidAt: null,
    },
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      dueDate: true,
      status: true,
      clientId: true,
      placementId: true,
      client: {
        select: {
          id: true,
          companyName: true,
          assignedToId: true,
        },
      },
      placement: {
        select: {
          id: true,
          recruiterId: true,
        },
      },
    },
    take: 200,
  });

  for (const record of overdueRecords) {
    if (record.status === 'SENT') {
      try {
        await prisma.billingRecord.update({
          where: { id: record.id },
          data: { status: 'OVERDUE' },
        });
      } catch {
        // non-fatal
      }
    }

    const recipientIds = new Set(
      [record.client?.assignedToId, record.placement?.recruiterId].filter(Boolean)
    );
    if (!recipientIds.size) continue;

    const invoiceLabel = record.invoiceNumber || record.id;
    const clientLabel = record.client?.companyName || 'Client';

    for (const userId of recipientIds) {
      await dispatchScheduledAlert({
        alertId: 'billing.invoice_overdue',
        userId,
        payload: {
          category: 'BILLING',
          title: 'Invoice overdue',
          description: `${invoiceLabel} for ${clientLabel} was due ${formatDateLabel(record.dueDate)}.`,
          actionLabel: 'Open billing',
          actionPath: `/billing?invoiceId=${record.id}`,
          entityType: 'BILLING',
          entityId: record.id,
        },
        emailFn: async () => {
          const email = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
          });
          if (!email?.email) return null;
          const { renderNotificationTriggerEmail } = await import(
            './notification-trigger-template-settings.js'
          );
          const { sendLifecycleAlertEmail } = await import('../../services/emailService.js');
          const rendered = await renderNotificationTriggerEmail('alert.billing_invoice_overdue', userId, {
            recipientName: email.name || 'Team Member',
            invoiceNumber: invoiceLabel,
            clientName: clientLabel,
            amount: String(record.amount ?? '—'),
            dueDate: formatDateLabel(record.dueDate),
          });
          return sendLifecycleAlertEmail({
            senderUserId: userId,
            toEmail: email.email,
            subject: rendered.subject,
            html: rendered.html,
            triggerId: 'alert.billing_invoice_overdue',
          });
        },
      });

      if (userId === record.client?.assignedToId) {
        await dispatchScheduledAlert({
          alertId: 'client.invoice_overdue',
          userId,
          payload: {
            category: 'CLIENT',
            title: 'Client has overdue invoice',
            description: `${clientLabel} — ${invoiceLabel} is overdue.`,
            actionLabel: 'Open client',
            actionPath: `/client?clientId=${record.clientId}`,
            entityType: 'CLIENT',
            entityId: record.clientId,
            metadata: { billingRecordId: record.id },
          },
        });
      }
    }
  }

  void now;
}

async function processInterviewFeedbackOverdue() {
  const cutoff = new Date(Date.now() - FEEDBACK_OVERDUE_HOURS * 60 * 60 * 1000);

  // Load scalar fields only — some legacy rows reference deleted candidates/jobs and
  // Prisma throws if a required relation resolves to null.
  const interviews = await prisma.interview.findMany({
    where: {
      scheduledAt: { lt: cutoff },
      status: { notIn: ['CANCELLED', 'NO_SHOW', 'FEEDBACK_SUBMITTED'] },
      OR: [
        { status: 'FEEDBACK_PENDING' },
        {
          status: { in: ['COMPLETED', 'SCHEDULED', 'CONFIRMED', 'RESCHEDULED'] },
          feedbackEntries: { none: {} },
        },
      ],
    },
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      interviewerId: true,
      createdById: true,
      panelIds: true,
      candidateId: true,
      jobId: true,
    },
    take: 200,
  });

  const candidateIds = [...new Set(interviews.map((i) => i.candidateId).filter(Boolean))];
  const jobIds = [...new Set(interviews.map((i) => i.jobId).filter(Boolean))];
  const [candidates, jobs] = await Promise.all([
    candidateIds.length
      ? prisma.candidate.findMany({
          where: { id: { in: candidateIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [],
    jobIds.length
      ? prisma.job.findMany({
          where: { id: { in: jobIds } },
          select: { id: true, title: true },
        })
      : [],
  ]);
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  for (const interview of interviews) {
    const cand = candidateById.get(interview.candidateId);
    const job = jobById.get(interview.jobId);
    const candidateName =
      `${cand?.firstName || ''} ${cand?.lastName || ''}`.trim() || 'Candidate';
    const jobTitle = job?.title || 'the role';

    const recipientIds = new Set(
      [interview.interviewerId, interview.createdById, ...(interview.panelIds || [])].filter(Boolean)
    );

    for (const userId of recipientIds) {
      await dispatchScheduledAlert({
        alertId: 'interview.feedback_overdue',
        userId,
        payload: {
          category: 'INTERVIEW',
          title: 'Interview feedback overdue',
          description: `Feedback pending for ${candidateName} (${jobTitle}) — interview was ${formatDateLabel(interview.scheduledAt)}.`,
          actionLabel: 'Open interview',
          actionPath: `/interviews?interviewId=${interview.id}`,
          entityType: 'INTERVIEW',
          entityId: interview.id,
        },
      });
    }
  }
}

async function processPlacementReminders() {
  const since = new Date(Date.now() - PLACEMENT_REMINDER_DAYS * 24 * 60 * 60 * 1000);

  const placements = await prisma.placement.findMany({
    where: {
      deletedAt: null,
      status: { in: ['FAILED', 'NO_SHOW', 'REPLACEMENT_REQUIRED'] },
      updatedAt: { gte: since },
    },
    select: {
      id: true,
      status: true,
      failureReason: true,
      recruiterId: true,
      candidate: { select: { firstName: true, lastName: true } },
      job: { select: { title: true } },
      client: { select: { companyName: true } },
    },
    take: 200,
  });

  for (const placement of placements) {
    if (!placement.recruiterId) continue;

    const candidateName =
      `${placement.candidate?.firstName || ''} ${placement.candidate?.lastName || ''}`.trim() ||
      'Candidate';
    const jobTitle = placement.job?.title || 'the role';
    const clientName = placement.client?.companyName || 'the client';

    if (placement.status === 'REPLACEMENT_REQUIRED') {
      await dispatchScheduledAlert({
        alertId: 'placement.replacement_required',
        userId: placement.recruiterId,
        payload: {
          category: 'PLACEMENT',
          title: 'Replacement required',
          description: `Replacement needed for ${candidateName} at ${clientName} (${jobTitle}).`,
          actionLabel: 'View placement',
          actionPath: `/placement?placementId=${placement.id}`,
          entityType: 'PLACEMENT',
          entityId: placement.id,
        },
        dedupHours: 24,
      });
    } else {
      await dispatchScheduledAlert({
        alertId: 'placement.failed',
        userId: placement.recruiterId,
        payload: {
          category: 'PLACEMENT',
          title: 'Placement failed / no-show',
          description: `${candidateName} — ${placement.status.replace(/_/g, ' ').toLowerCase()} for ${jobTitle}.${placement.failureReason ? ` Reason: ${placement.failureReason}` : ''}`,
          actionLabel: 'View placement',
          actionPath: `/placement?placementId=${placement.id}`,
          entityType: 'PLACEMENT',
          entityId: placement.id,
        },
        dedupHours: 24,
      });
    }
  }
}

async function processJobSlaAndApplicants() {
  const nearSlaJobs = await prisma.job.findMany({
    where: {
      isDeleted: { not: true },
      status: 'OPEN',
      OR: [{ slaRisk: true }, { expectedClosureDate: { lte: endOfDay() } }],
    },
    select: {
      id: true,
      title: true,
      assignedToId: true,
      createdById: true,
      expectedClosureDate: true,
      slaRisk: true,
      client: { select: { companyName: true } },
    },
    take: 100,
  });
  for (const job of nearSlaJobs) {
    await notifyJobNearSla({ job });
  }

  const openJobs = await prisma.job.findMany({
    where: { isDeleted: { not: true }, status: 'OPEN' },
    select: {
      id: true,
      title: true,
      assignedToId: true,
      createdById: true,
      client: { select: { companyName: true } },
      _count: { select: { matches: true } },
    },
    take: 100,
  });
  for (const job of openJobs) {
    await notifyJobZeroApplicants({ job, applicantCount: job._count?.matches || 0 });
  }
}

async function processInterviewTodayReminders() {
  const interviews = await prisma.interview.findMany({
    where: {
      scheduledAt: { gte: startOfDay(), lte: endOfDay() },
      status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
    },
    select: {
      id: true,
      scheduledAt: true,
      interviewerId: true,
      createdById: true,
      panelIds: true,
      candidateId: true,
      jobId: true,
    },
    take: 100,
  });
  if (!interviews.length) return;

  const candidateIds = [...new Set(interviews.map((i) => i.candidateId).filter(Boolean))];
  const jobIds = [...new Set(interviews.map((i) => i.jobId).filter(Boolean))];
  const [candidates, jobs] = await Promise.all([
    prisma.candidate.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.job.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, title: true },
    }),
  ]);
  const candMap = new Map(candidates.map((c) => [c.id, c]));
  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  for (const interview of interviews) {
    const recipients = new Set([
      interview.interviewerId,
      interview.createdById,
      ...(interview.panelIds || []),
    ]);
    for (const uid of recipients) {
      await notifyInterviewTodayReminder({
        interview,
        candidate: candMap.get(interview.candidateId),
        job: jobMap.get(interview.jobId),
        userId: uid,
      });
    }
  }
}

/**
 * Run all time-based alert checks. Safe to call on an interval.
 */
export async function runAlertScheduler() {
  if (process.env.ALERT_SCHEDULER_ENABLED === 'false') return;
  if (schedulerRunning) return;
  schedulerRunning = true;

  const started = Date.now();
  try {
    await Promise.allSettled([
      processLeadFollowUps(),
      processClientFollowUps(),
      processPipelineFollowUps(),
      processTaskReminders(),
      processInvoiceOverdue(),
      processInterviewFeedbackOverdue(),
      processPlacementReminders(),
      processJobSlaAndApplicants(),
      processInterviewTodayReminders(),
    ]);
    console.log(`[alert-scheduler] completed in ${Date.now() - started}ms`);
  } catch (error) {
    console.warn('[alert-scheduler] run failed:', error?.message || error);
  } finally {
    schedulerRunning = false;
  }
}

export function startAlertScheduler() {
  if (process.env.ALERT_SCHEDULER_ENABLED === 'false') {
    console.log('[alert-scheduler] disabled (ALERT_SCHEDULER_ENABLED=false)');
    return;
  }

  const intervalMs = Number(process.env.ALERT_SCHEDULER_INTERVAL_MS || 60 * 60 * 1000);
  const initialDelayMs = Number(process.env.ALERT_SCHEDULER_INITIAL_DELAY_MS || 2 * 60 * 1000);

  setTimeout(() => {
    void runAlertScheduler();
  }, initialDelayMs);

  setInterval(() => {
    void runAlertScheduler();
  }, intervalMs);

  console.log(
    `[alert-scheduler] started (every ${Math.round(intervalMs / 60000)} min, first run in ${Math.round(initialDelayMs / 1000)}s)`
  );
}
