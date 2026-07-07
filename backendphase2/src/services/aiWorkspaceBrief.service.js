import { ObjectId } from 'mongodb';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { chatCompletionWithFallback, hasLlmProvider } from './llmChatFallback.service.js';
import { createUserNotification } from '../modules/notification/notification.service.js';
import { sendAiWorkspaceBriefEmail } from './emailService.js';
import { isSuperAdminUser } from '../utils/superAdminScope.js';
import {
  isAlertEmailEnabled,
  isAlertPortalEnabled,
} from '../modules/setting/alert-settings.js';
import {
  AI_SCHEDULED_BRIEF_ALERT_ID,
  AI_WORKSPACE_BRIEF_ALERT_ID,
  resolveAiSettingsAlertId,
} from '../modules/setting/ai-workspace-alert-map.js';

const COLLECTION = 'ai_workspace_briefs';
const DEDUP_MS = 6 * 60 * 60 * 1000;
const AI_TAG = 'AI Workspace Brief';

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function isOverdue(date) {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return d < startOfDay();
}

function isDueToday(date) {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const start = startOfDay();
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

function formatDateLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB');
}

function getCandidateFollowUpDate(candidate) {
  const extra = candidate?.extraData;
  if (!extra || typeof extra !== 'object') return null;
  const raw = extra.nextFollowUp || extra.nextFollowUpAt || extra.followUpDate;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const TERMINAL_PIPELINE_STAGES = new Set([
  'rejected',
  'hired',
  'joined',
  'placed',
  'withdrawn',
  'dropped',
]);

function personName(person) {
  if (!person) return '';
  return String(person.name || '').trim() || [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
}

async function getCollection() {
  if (typeof prisma?.$runCommandRaw !== 'function') return null;
  return {
    async insert(doc) {
      const _id = new ObjectId();
      await prisma.$runCommandRaw({
        insert: COLLECTION,
        documents: [{ _id: { $oid: _id.toString() }, ...doc, createdAt: new Date(), updatedAt: new Date() }],
      });
      return { id: _id.toString(), ...doc };
    },
    async findLatestForUser(userId) {
      const result = await prisma.$runCommandRaw({
        find: COLLECTION,
        filter: { userId },
        sort: { createdAt: -1 },
        limit: 1,
      });
      return result?.cursor?.firstBatch?.[0] || null;
    },
    async findRecentForUser(userId, since) {
      const result = await prisma.$runCommandRaw({
        find: COLLECTION,
        filter: {
          userId,
          createdAt: { $gte: { $date: since.toISOString() } },
        },
        sort: { createdAt: -1 },
        limit: 1,
      });
      return result?.cursor?.firstBatch?.[0] || null;
    },
  };
}

function toRow(doc) {
  if (!doc) return null;
  return {
    id: doc._id?.$oid || String(doc._id || doc.id || ''),
    userId: doc.userId || null,
    scope: doc.scope || 'personal',
    headline: doc.headline || '',
    summary: doc.summary || '',
    priority: doc.priority || 'MEDIUM',
    alerts: Array.isArray(doc.alerts) ? doc.alerts.map(enrichAlertWithEntity) : [],
    recommendations: Array.isArray(doc.recommendations) ? doc.recommendations : [],
    signalCounts: doc.signalCounts || {},
    trigger: doc.trigger || 'manual',
    emailSent: Boolean(doc.emailSent),
    createdAt: doc.createdAt?.$date || doc.createdAt || null,
  };
}

function parseEntityFromActionPath(actionPath) {
  const raw = String(actionPath || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw, 'http://local');
    const params = url.searchParams;
    if (params.get('clientId')) {
      return { entityType: 'CLIENT', entityId: params.get('clientId') };
    }
    if (params.get('leadId')) {
      return { entityType: 'LEAD', entityId: params.get('leadId') };
    }
    if (params.get('taskId')) {
      return { entityType: 'TASK', entityId: params.get('taskId') };
    }
    if (params.get('jobId')) {
      return { entityType: 'JOB', entityId: params.get('jobId') };
    }
    if (params.get('candidateId')) {
      return { entityType: 'CANDIDATE', entityId: params.get('candidateId') };
    }
    if (params.get('placementId')) {
      return { entityType: 'PLACEMENT', entityId: params.get('placementId') };
    }
    if (params.get('userId')) {
      return { entityType: 'USER', entityId: params.get('userId') };
    }
    if (params.get('departmentId')) {
      return { entityType: 'DEPARTMENT', entityId: params.get('departmentId') };
    }
  } catch {
    return null;
  }
  return null;
}

function attachSettingsAlertId(alert) {
  if (!alert || typeof alert !== 'object') return alert;
  return { ...alert, settingsAlertId: resolveAiSettingsAlertId(alert) };
}

async function filterAlertsForPortal(userId, alerts) {
  const list = Array.isArray(alerts) ? alerts : [];
  const filtered = [];
  for (const raw of list) {
    const alert = attachSettingsAlertId(enrichAlertWithEntity(raw));
    if (await isAlertPortalEnabled(alert.settingsAlertId, userId)) {
      filtered.push(alert);
    }
  }
  return filtered;
}

async function filterAlertsForEmail(userId, alerts) {
  const list = Array.isArray(alerts) ? alerts : [];
  const filtered = [];
  for (const raw of list) {
    const alert = attachSettingsAlertId(enrichAlertWithEntity(raw));
    if (await isAlertEmailEnabled(alert.settingsAlertId, userId)) {
      filtered.push(alert);
    }
  }
  return filtered;
}

async function buildBriefAlertsForUser(userId, mergedAlerts) {
  const included = [];
  for (const raw of mergedAlerts || []) {
    const alert = attachSettingsAlertId(enrichAlertWithEntity(raw));
    const [portal, email] = await Promise.all([
      isAlertPortalEnabled(alert.settingsAlertId, userId),
      isAlertEmailEnabled(alert.settingsAlertId, userId),
    ]);
    if (portal || email) included.push(alert);
  }
  return included;
}

function enrichAlertWithEntity(alert) {
  if (!alert || typeof alert !== 'object') return alert;
  if (alert.entityType && alert.entityId) return alert;
  const parsed = parseEntityFromActionPath(alert.actionPath);
  if (!parsed) return alert;
  return { ...alert, ...parsed };
}

function normalizeAlertKey(alert) {
  if (alert?.entityType && alert?.entityId) {
    return `${String(alert.entityType).toUpperCase()}:${alert.entityId}:${alert.alertCode || alert.title}`;
  }
  return `generic:${alert?.title || ''}`;
}

function buildEntityAlertsFromSignals(signals) {
  const alerts = [];

  for (const client of signals?.overdueClients || []) {
    if (!client?.id) continue;
    alerts.push({
      alertCode: 'client.followup_overdue',
      entityType: 'CLIENT',
      entityId: client.id,
      entityLabel: client.companyName || 'Client',
      title: 'Overdue Client Follow-Up',
      detail: `Follow-up for ${client.companyName || 'this client'} was due ${client.followUp || 'earlier'}.`,
      priority: 'HIGH',
      area: 'Clients',
      actionPath: `/client?clientId=${client.id}`,
    });
  }

  for (const lead of signals?.overdueLeads || []) {
    if (!lead?.id) continue;
    alerts.push({
      alertCode: 'lead.followup_overdue',
      entityType: 'LEAD',
      entityId: lead.id,
      entityLabel: lead.label || 'Lead',
      title: 'Overdue Lead Follow-Up',
      detail: `Follow-up for ${lead.label || 'this lead'} was due ${lead.followUp || 'earlier'}.`,
      priority: 'HIGH',
      area: 'Leads',
      actionPath: `/leads?leadId=${lead.id}`,
    });
  }

  for (const task of signals?.overdueTasks || []) {
    if (!task?.id) continue;
    alerts.push({
      alertCode: 'task.overdue',
      entityType: 'TASK',
      entityId: task.id,
      entityLabel: task.title || 'Task',
      title: 'Overdue Task',
      detail: `"${task.title || 'Task'}" was due ${task.dueDate || 'earlier'}.`,
      priority: String(task.priority || '').toUpperCase() === 'HIGH' ? 'HIGH' : 'MEDIUM',
      area: 'Tasks',
      actionPath: `/Task&Activites?taskId=${task.id}`,
    });
  }

  for (const job of signals?.jobsNeedingApplicants || []) {
    if (!job?.id) continue;
    alerts.push({
      alertCode: 'job.low_applicants',
      entityType: 'JOB',
      entityId: job.id,
      entityLabel: job.title || 'Job',
      title: 'Job Needs Applicants',
      detail: `"${job.title || 'Job'}" has only ${job.applicants ?? 0} applicant(s).`,
      priority: job.closureOverdue ? 'HIGH' : 'MEDIUM',
      area: 'Jobs',
      actionPath: `/job?jobId=${job.id}`,
    });
  }

  for (const candidate of signals?.overduePipelineFollowUps || []) {
    if (!candidate?.id) continue;
    alerts.push({
      alertCode: 'candidate.pipeline_followup_overdue',
      entityType: 'CANDIDATE',
      entityId: candidate.id,
      entityLabel: candidate.candidate || 'Candidate',
      title: 'Overdue Pipeline Follow-Up',
      detail: `${candidate.candidate || 'Candidate'} (${candidate.stage || 'pipeline'}) follow-up was due ${candidate.followUp || 'earlier'}.`,
      priority: 'HIGH',
      area: 'Candidates',
      actionPath: `/candidate?candidateId=${candidate.id}`,
    });
  }

  for (const interview of signals?.interviewsToday || []) {
    if (!interview?.id) continue;
    const interviewPath = interview.candidateId
      ? `/interviews?interviewId=${interview.id}`
      : `/interviews?interviewId=${interview.id}`;
    alerts.push({
      alertCode: 'interview.today',
      entityType: 'INTERVIEW',
      entityId: interview.id,
      entityLabel: interview.candidate || 'Interview',
      title: 'Interview Today',
      detail: `${interview.candidate || 'Candidate'}${interview.jobTitle ? ` — ${interview.jobTitle}` : ''} at ${interview.time || 'today'}.`,
      priority: 'MEDIUM',
      area: 'Interviews',
      actionPath: interviewPath,
    });
  }

  for (const placement of signals?.overduePlacements || []) {
    if (!placement?.id) continue;
    alerts.push({
      alertCode: 'placement.joining_overdue',
      entityType: 'PLACEMENT',
      entityId: placement.id,
      entityLabel: placement.label || 'Placement',
      title: 'Overdue Joining Date',
      detail: `Joining for ${placement.label || 'this placement'} was scheduled for ${placement.joiningDate || 'earlier'}.`,
      priority: 'HIGH',
      area: 'Placements',
      actionPath: `/placement?placementId=${placement.id}`,
    });
  }

  for (const request of signals?.pendingTeamRequests || []) {
    if (!request?.sendToId) continue;
    alerts.push({
      alertCode: 'team.request_pending',
      entityType: 'USER',
      entityId: request.sendToId,
      entityLabel: request.to || 'Team member',
      title: 'Pending Team Request',
      detail: `${request.from || 'Someone'} requested: ${request.subject || 'action needed'}.`,
      priority: String(request.priority || '').toUpperCase() === 'HIGH' ? 'HIGH' : 'MEDIUM',
      area: 'Team',
      actionPath: `/team?tab=members&userId=${request.sendToId}`,
    });
  }

  return alerts.map(attachSettingsAlertId);
}

function mergeBriefAlerts(signalAlerts, aiAlerts) {
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const merged = [];
  const seen = new Set();

  for (const raw of [...(signalAlerts || []), ...(aiAlerts || []).map(enrichAlertWithEntity)]) {
    const alert = enrichAlertWithEntity(raw);
    if (!alert?.title) continue;
    const key = normalizeAlertKey(alert);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(attachSettingsAlertId(alert));
  }

  return merged
    .sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1))
    .slice(0, 12);
}

function sanitizeSignals(signals) {
  try {
    const raw = JSON.stringify(signals);
    if (raw.length <= 14000) return JSON.parse(raw);
    return JSON.parse(raw.slice(0, 14000));
  } catch {
    return {};
  }
}

async function resolveUser(userId) {
  const id = String(userId || '').trim();
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      systemRole: { select: { roleName: true } },
    },
  });
}

export async function collectWorkspaceSignals(userId, { tenantWide = false } = {}) {
  const uid = String(userId || '').trim();
  const ownerFilter = tenantWide ? {} : { assignedToId: uid };

  const [
    overdueTasks,
    dueTodayTasks,
    overdueLeads,
    dueTodayLeads,
    overdueClients,
    interviewsToday,
    openJobsLowApplicants,
    pendingRequests,
    recentActivityCount,
    overduePipelineFollowUps,
    overduePlacements,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { ...ownerFilter, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { lt: startOfDay() } },
      select: { id: true, title: true, dueDate: true, priority: true, status: true },
      orderBy: { dueDate: 'asc' },
      take: 12,
    }),
    prisma.task.findMany({
      where: {
        ...ownerFilter,
        status: { notIn: ['DONE', 'CANCELLED'] },
        dueDate: { gte: startOfDay(), lte: new Date(startOfDay().getTime() + 86400000 - 1) },
      },
      select: { id: true, title: true, dueDate: true, priority: true },
      take: 12,
    }),
    prisma.lead.findMany({
      where: {
        ...ownerFilter,
        isDeleted: { not: true },
        convertedToClientId: null,
        status: { notIn: ['Lost', 'Converted'] },
        nextFollowUp: { lt: startOfDay() },
      },
      select: { id: true, companyName: true, contactPerson: true, nextFollowUp: true, status: true },
      orderBy: { nextFollowUp: 'asc' },
      take: 12,
    }),
    prisma.lead.findMany({
      where: {
        ...ownerFilter,
        isDeleted: { not: true },
        convertedToClientId: null,
        status: { notIn: ['Lost', 'Converted'] },
        nextFollowUp: { gte: startOfDay(), lte: new Date(startOfDay().getTime() + 86400000 - 1) },
      },
      select: { id: true, companyName: true, contactPerson: true, nextFollowUp: true },
      take: 12,
    }),
    prisma.client.findMany({
      where: { ...ownerFilter, isDeleted: { not: true }, nextFollowUpDue: { lt: startOfDay() } },
      select: { id: true, companyName: true, nextFollowUpDue: true, status: true },
      orderBy: { nextFollowUpDue: 'asc' },
      take: 10,
    }),
    prisma.interview.findMany({
      where: {
        scheduledAt: { gte: startOfDay(), lte: new Date(startOfDay().getTime() + 86400000 - 1) },
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
        ...(tenantWide ? {} : { OR: [{ interviewerId: uid }, { createdById: uid }, { panelIds: { has: uid } }] }),
      },
      select: {
        id: true,
        candidateId: true,
        scheduledAt: true,
        status: true,
        candidate: { select: { firstName: true, lastName: true } },
        job: { select: { title: true } },
      },
      take: 10,
    }),
    prisma.job.findMany({
      where: { ...ownerFilter, isDeleted: { not: true }, status: 'OPEN' },
      select: {
        id: true,
        title: true,
        status: true,
        expectedClosureDate: true,
        _count: { select: { matches: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    }),
    prisma.teamMemberRequest.findMany({
      where: tenantWide
        ? { status: 'pending' }
        : { status: 'pending', OR: [{ sendToId: uid }, { requestedById: uid }] },
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        sendToId: true,
        sendToName: true,
        requestedByName: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.activity.count({
      where: tenantWide
        ? { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }
        : { performedById: uid, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    }),
    prisma.candidate.findMany({
      where: {
        isDeleted: { not: true },
        ...(tenantWide ? {} : { assignedToId: uid }),
        stage: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        stage: true,
        extraData: true,
      },
      take: 80,
    }),
    prisma.placement.findMany({
      where: {
        deletedAt: null,
        status: 'JOINING_SCHEDULED',
        joiningDate: { lt: startOfDay() },
        ...(tenantWide ? {} : { recruiterId: uid }),
      },
      select: {
        id: true,
        joiningDate: true,
        candidate: { select: { firstName: true, lastName: true } },
        job: { select: { title: true } },
      },
      orderBy: { joiningDate: 'asc' },
      take: 10,
    }),
  ]);

  const jobsNeedingApplicants = openJobsLowApplicants
    .filter((job) => (job._count?.matches || 0) < 3)
    .map((job) => ({
      id: job.id,
      title: job.title,
      applicants: job._count?.matches || 0,
      expectedClosureDate: job.expectedClosureDate ? formatDateLabel(job.expectedClosureDate) : null,
      closureOverdue: isOverdue(job.expectedClosureDate),
    }));

  const pipelineFollowUpsOverdue = overduePipelineFollowUps
    .filter((candidate) => {
      const stage = String(candidate.stage || '').trim().toLowerCase();
      if (!stage || TERMINAL_PIPELINE_STAGES.has(stage)) return false;
      const followUp = getCandidateFollowUpDate(candidate);
      return followUp && isOverdue(followUp);
    })
    .slice(0, 10)
    .map((candidate) => ({
      id: candidate.id,
      candidate:
        `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email || 'Candidate',
      stage: candidate.stage,
      followUp: formatDateLabel(getCandidateFollowUpDate(candidate)),
    }));

  return {
    generatedAt: new Date().toISOString(),
    scope: tenantWide ? 'tenant' : 'personal',
    counts: {
      overdueTasks: overdueTasks.length,
      dueTodayTasks: dueTodayTasks.length,
      overdueLeads: overdueLeads.length,
      dueTodayLeads: dueTodayLeads.length,
      overdueClients: overdueClients.length,
      interviewsToday: interviewsToday.length,
      jobsLowApplicants: jobsNeedingApplicants.length,
      pendingTeamRequests: pendingRequests.length,
      overduePipelineFollowUps: pipelineFollowUpsOverdue.length,
      overduePlacements: overduePlacements.length,
      activityLast7Days: recentActivityCount,
    },
    overdueTasks: overdueTasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: formatDateLabel(t.dueDate),
      priority: t.priority,
    })),
    dueTodayTasks: dueTodayTasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: formatDateLabel(t.dueDate),
    })),
    overdueLeads: overdueLeads.map((l) => ({
      id: l.id,
      label: l.companyName || l.contactPerson || 'Lead',
      followUp: formatDateLabel(l.nextFollowUp),
      status: l.status,
    })),
    dueTodayLeads: dueTodayLeads.map((l) => ({
      id: l.id,
      label: l.companyName || l.contactPerson || 'Lead',
      followUp: formatDateLabel(l.nextFollowUp),
    })),
    overdueClients: overdueClients.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      followUp: formatDateLabel(c.nextFollowUpDue),
    })),
    interviewsToday: interviewsToday.map((i) => ({
      id: i.id,
      candidateId: i.candidateId || null,
      time: formatDateLabel(i.scheduledAt),
      candidate: personName(i.candidate),
      jobTitle: i.job?.title || '',
    })),
    jobsNeedingApplicants,
    pendingTeamRequests: pendingRequests.map((r) => ({
      id: r.id,
      subject: r.subject,
      priority: r.priority,
      sendToId: r.sendToId || null,
      to: r.sendToName,
      from: r.requestedByName,
    })),
    overduePlacements: overduePlacements.map((p) => ({
      id: p.id,
      label:
        `${p.candidate?.firstName || ''} ${p.candidate?.lastName || ''}`.trim() ||
        p.job?.title ||
        'Placement',
      joiningDate: formatDateLabel(p.joiningDate),
    })),
    overduePipelineFollowUps: pipelineFollowUpsOverdue,
  };
}

async function callOpenAiForWorkspaceBrief({ userName, signals, trigger }) {
  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are the HRYANTRA recruitment CRM AI brain. Analyze workspace signals and return strict JSON:
{
  "headline": "one short urgent line for the user",
  "summary": "2-4 sentences explaining what needs attention and why",
  "priority": "HIGH|MEDIUM|LOW",
  "alerts": [{"title":"short","detail":"plain English","priority":"HIGH|MEDIUM|LOW","area":"Tasks|Leads|Jobs|Candidates|Team|Billing|Interviews","actionPath":"/path"}],
  "recommendations": [{"title":"short","detail":"actionable advice","dueInDays":number|null}]
}
Rules:
- Use only facts from the provided signals; do not invent records.
- Prioritize overdue items, then due today, then bottlenecks.
- Max 6 alerts and 4 recommendations.
- actionPath examples: /Task&Activites?taskId=ID, /leads?leadId=ID, /client?clientId=ID, /job?jobId=ID, /candidate?candidateId=ID, /activity-feed
- Write for a busy recruiter or manager — clear and direct.`,
        },
        {
          role: 'user',
          content: [
            `User: ${userName || 'Team member'}`,
            `Trigger: ${trigger}`,
            `Scope: ${signals.scope}`,
            `Signals:\n${JSON.stringify(signals, null, 2)}`,
          ].join('\n'),
        },
      ],
    },
    'ai-workspace-brief'
  );

  const raw = completion.choices?.[0]?.message?.content?.trim();
  const parsed = raw ? JSON.parse(raw) : null;
  if (!parsed?.headline || !parsed?.summary) throw new Error('Empty AI workspace brief');

  const priority = ['HIGH', 'MEDIUM', 'LOW'].includes(String(parsed.priority || '').toUpperCase())
    ? String(parsed.priority).toUpperCase()
    : 'MEDIUM';

  const alerts = (Array.isArray(parsed.alerts) ? parsed.alerts : [])
    .slice(0, 6)
    .map((a) => ({
      title: String(a?.title || '').trim(),
      detail: String(a?.detail || '').trim(),
      priority: ['HIGH', 'MEDIUM', 'LOW'].includes(String(a?.priority || '').toUpperCase())
        ? String(a.priority).toUpperCase()
        : 'MEDIUM',
      area: String(a?.area || 'General').trim(),
      actionPath: String(a?.actionPath || '/dashboard').trim(),
    }))
    .filter((a) => a.title);

  const recommendations = (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
    .slice(0, 4)
    .map((r) => ({
      title: String(r?.title || '').trim(),
      detail: String(r?.detail || '').trim(),
      dueInDays: Number.isFinite(Number(r?.dueInDays)) ? Number(r.dueInDays) : null,
    }))
    .filter((r) => r.title);

  return {
    headline: String(parsed.headline).trim(),
    summary: String(parsed.summary).trim(),
    priority,
    alerts,
    recommendations,
  };
}

export async function getLatestWorkspaceBrief(userId) {
  const col = await getCollection();
  if (!col) return null;
  const doc = await col.findLatestForUser(String(userId || '').trim());
  const row = toRow(doc);
  if (!row) return null;
  row.alerts = await filterAlertsForPortal(userId, row.alerts);
  return row;
}

export async function getWorkspaceBriefAlertsForEntity(userId, entityType, entityId) {
  const col = await getCollection();
  if (!col) return [];
  const doc = await col.findLatestForUser(String(userId || '').trim());
  const brief = toRow(doc);
  if (!brief?.alerts?.length) return [];
  const type = String(entityType || '').trim().toUpperCase();
  const id = String(entityId || '').trim();
  if (!type || !id) return [];
  const matches = brief.alerts
    .map(enrichAlertWithEntity)
    .filter(
      (alert) =>
        String(alert?.entityType || '').toUpperCase() === type && String(alert?.entityId || '') === id,
    );
  return filterAlertsForPortal(userId, matches);
}

export async function getWorkspaceBriefAlertsByEntityIds(userId, entityType, entityIds) {
  const ids = [...new Set((entityIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const map = Object.fromEntries(ids.map((id) => [id, []]));
  if (!ids.length) return map;

  const col = await getCollection();
  if (!col) return map;
  const doc = await col.findLatestForUser(String(userId || '').trim());
  const brief = toRow(doc);
  if (!brief?.alerts?.length) return map;

  const type = String(entityType || '').trim().toUpperCase();
  const portalAlerts = await filterAlertsForPortal(userId, brief.alerts);
  for (const alert of portalAlerts) {
    if (String(alert?.entityType || '').toUpperCase() !== type) continue;
    const eid = String(alert?.entityId || '');
    if (map[eid]) map[eid].push(alert);
  }
  return map;
}

export async function generateWorkspaceBrief({
  userId,
  trigger = 'manual',
  skipDedup = false,
  sendEmail = true,
  sendNotification = true,
  reqUser = null,
}) {
  if (!hasLlmProvider()) return null;

  const uid = String(userId || '').trim();
  if (!uid) return null;

  const col = await getCollection();
  if (!col) return null;

  if (!skipDedup) {
    const recent = await col.findRecentForUser(uid, new Date(Date.now() - DEDUP_MS));
    if (recent) {
      const row = toRow(recent);
      if (row) {
        row.alerts = await filterAlertsForPortal(uid, row.alerts);
      }
      return row;
    }
  }

  const user = await resolveUser(uid);
  if (!user || user.isActive === false) return null;

  const tenantWide = isSuperAdminUser({ user: reqUser || user });
  const signals = sanitizeSignals(await collectWorkspaceSignals(uid, { tenantWide }));
  const ai = await callOpenAiForWorkspaceBrief({
    userName: personName(user) || user.email,
    signals,
    trigger,
  });

  const signalAlerts = buildEntityAlertsFromSignals(signals);
  const mergedAlerts = mergeBriefAlerts(signalAlerts, ai.alerts);
  const alertsForBrief = await buildBriefAlertsForUser(uid, mergedAlerts);

  const row = await col.insert({
    userId: uid,
    scope: signals.scope || 'personal',
    headline: ai.headline,
    summary: ai.summary,
    priority: ai.priority,
    alerts: alertsForBrief,
    recommendations: ai.recommendations,
    signalCounts: signals.counts || {},
    trigger: String(trigger || 'manual'),
    emailSent: false,
  });

  const dashboardPath = `${env.FRONTEND_URL || 'http://localhost:3001'}/dashboard`;
  const briefSettingsId =
    String(trigger || '') === 'scheduled' ? AI_SCHEDULED_BRIEF_ALERT_ID : AI_WORKSPACE_BRIEF_ALERT_ID;

  if (sendNotification) {
    const briefPortalEnabled = await isAlertPortalEnabled(briefSettingsId, uid);
    if (briefPortalEnabled) {
      await createUserNotification(uid, {
        category: 'SYSTEM',
        title: ai.headline,
        description: ai.summary,
        actionLabel: 'View AI brief',
        actionPath: '/dashboard',
        entityType: 'SYSTEM',
        metadata: { tags: [AI_TAG], priority: ai.priority, briefId: row.id },
      });
    }

    const portalAlerts = await filterAlertsForPortal(uid, alertsForBrief);
    for (const alert of portalAlerts.filter((a) => a.priority === 'HIGH').slice(0, 3)) {
      const enriched = enrichAlertWithEntity(alert);
      await createUserNotification(uid, {
        category: 'SYSTEM',
        title: enriched.title,
        description: enriched.detail,
        actionLabel: 'Open',
        actionPath: enriched.actionPath,
        entityType: enriched.entityType || 'SYSTEM',
        entityId: enriched.entityId || null,
        metadata: {
          tags: [AI_TAG, enriched.area],
          priority: enriched.priority,
          briefId: row.id,
          alertCode: enriched.alertCode || null,
          settingsAlertId: enriched.settingsAlertId || null,
        },
      });
    }
  }

  if (sendEmail && user.email) {
    const briefEmailEnabled = await isAlertEmailEnabled(briefSettingsId, uid);
    const emailAlerts = await filterAlertsForEmail(uid, alertsForBrief);
    if (briefEmailEnabled || emailAlerts.length > 0) {
      try {
        await sendAiWorkspaceBriefEmail({
          toEmail: user.email,
          recipientName: personName(user) || 'there',
          headline: ai.headline,
          summary: ai.summary,
          alerts: emailAlerts,
          recommendations: ai.recommendations,
          priority: ai.priority,
          dashboardPath,
        });
        row.emailSent = true;
      } catch (err) {
        console.warn('[ai-workspace-brief] email failed:', err?.message || err);
      }
    }
  }

  return toRow(row);
}

export function queueWorkspaceBrief(payload) {
  if (!hasLlmProvider()) return;
  setImmediate(() => {
    generateWorkspaceBrief(payload).catch((err) => {
      console.warn('[ai-workspace-brief] generate failed:', err?.message || err);
    });
  });
}

/** Daily scheduled briefs for active users (one per user per ~20h). */
export async function processScheduledWorkspaceBriefs() {
  if (process.env.AI_WORKSPACE_BRIEF_ENABLED === 'false') return;
  if (!hasLlmProvider()) return;

  const since = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: { isActive: true, email: { not: null } },
    select: { id: true },
    take: 50,
  });

  const col = await getCollection();
  if (!col) return;

  for (const user of users) {
    try {
      const recent = await col.findRecentForUser(user.id, since);
      if (recent) continue;
      await generateWorkspaceBrief({
        userId: user.id,
        trigger: 'scheduled',
        skipDedup: true,
        sendEmail: process.env.AI_WORKSPACE_BRIEF_EMAIL !== 'false',
        sendNotification: true,
      });
    } catch (err) {
      console.warn(`[ai-workspace-brief] scheduled failed for ${user.id}:`, err?.message || err);
    }
  }
}

export function isAiWorkspaceBriefConfigured() {
  return hasLlmProvider();
}
