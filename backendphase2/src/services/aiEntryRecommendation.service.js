import { ObjectId } from 'mongodb';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { chatCompletionWithFallback, hasLlmProvider } from './llmChatFallback.service.js';
import { createUserNotification } from '../modules/notification/notification.service.js';
import { isAlertEmailEnabled, isAlertPortalEnabled } from '../modules/setting/alert-settings.js';
import { sendAiRecommendationEmail } from './emailService.js';

export const AI_ENTRY_RECOMMENDATION_ALERT_ID = 'ai.entry_recommendation';

const COLLECTION = 'ai_recommendations';
const AI_TAG = 'AI Recommendation';
const DEDUP_MS = 30 * 60 * 1000;

const ENTITY_CATEGORY = {
  LEAD: 'LEAD',
  CLIENT: 'CLIENT',
  CANDIDATE: 'CANDIDATE',
  JOB: 'JOB',
  TASK: 'TASK',
  INTERVIEW: 'INTERVIEW',
  PLACEMENT: 'PLACEMENT',
};

const ENTITY_PATH = {
  LEAD: '/leads',
  CLIENT: '/client',
  CANDIDATE: '/candidate',
  JOB: '/job',
  TASK: '/Task&Activites',
  INTERVIEW: '/interviews',
  PLACEMENT: '/placement',
};

function entityActionPath(entityType, entityId) {
  const type = normalizeEntityType(entityType);
  const id = String(entityId || '').trim();
  const base = ENTITY_PATH[type] || '/';
  if (!id) return base;
  if (type === 'LEAD') return `${base}?leadId=${encodeURIComponent(id)}`;
  if (type === 'CLIENT') return `${base}?clientId=${encodeURIComponent(id)}`;
  if (type === 'CANDIDATE') return `${base}?candidateId=${encodeURIComponent(id)}`;
  if (type === 'JOB') return `${base}?jobId=${encodeURIComponent(id)}`;
  if (type === 'TASK') return `${base}?taskId=${encodeURIComponent(id)}`;
  if (type === 'PLACEMENT') return `${base}?placementId=${encodeURIComponent(id)}`;
  if (type === 'INTERVIEW') return `${base}?interviewId=${encodeURIComponent(id)}`;
  return base;
}

function normalizeEntityType(value) {
  const key = String(value || '').trim().toUpperCase();
  return ENTITY_CATEGORY[key] ? key : 'SYSTEM';
}

function sanitizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {};
  try {
    const raw = JSON.stringify(snapshot);
    if (raw.length > 12000) {
      return JSON.parse(raw.slice(0, 12000));
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
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
    async findRecent(entityType, entityId, since) {
      const result = await prisma.$runCommandRaw({
        find: COLLECTION,
        filter: {
          entityType,
          entityId,
          createdAt: { $gte: { $date: since.toISOString() } },
        },
        sort: { createdAt: -1 },
        limit: 1,
      });
      const doc = result?.cursor?.firstBatch?.[0];
      return doc || null;
    },
    async findByEntity(entityType, entityId, limit = 10) {
      const result = await prisma.$runCommandRaw({
        find: COLLECTION,
        filter: { entityType, entityId },
        sort: { createdAt: -1 },
        limit,
      });
      return (result?.cursor?.firstBatch || []).map(toRow);
    },
  };
}

function toRow(doc) {
  if (!doc) return null;
  return {
    id: doc._id?.$oid || String(doc._id || doc.id || ''),
    entityType: doc.entityType,
    entityId: doc.entityId,
    entityLabel: doc.entityLabel || '',
    summary: doc.summary || '',
    priority: doc.priority || 'MEDIUM',
    tags: Array.isArray(doc.tags) ? doc.tags : [AI_TAG],
    actions: Array.isArray(doc.actions) ? doc.actions : [],
    trigger: doc.trigger || 'create',
    userId: doc.userId || null,
    emailSent: Boolean(doc.emailSent),
    createdAt: doc.createdAt?.$date || doc.createdAt || null,
  };
}

async function resolveRecipientUser(recipientUserId) {
  const id = String(recipientUserId || '').trim();
  if (!id || !prisma?.user?.findUnique) return null;
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isActive: true },
  });
}

async function callOpenAiForRecommendation({ entityType, entityLabel, snapshot, trigger }) {
  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.35,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert recruitment CRM advisor. Return strict JSON: {"summary":"2-3 sentences","priority":"HIGH|MEDIUM|LOW","tags":["AI Recommendation", "..."],"actions":[{"title":"short action","detail":"why and how","dueInDays":number}]}. Give practical next steps for sales/recruiting teams. Always include tag "AI Recommendation". Max 4 actions.',
        },
        {
          role: 'user',
          content: [
            `Entity type: ${entityType}`,
            `Label: ${entityLabel}`,
            `Event: ${trigger}`,
            `Data:\n${JSON.stringify(snapshot, null, 2)}`,
          ].join('\n'),
        },
      ],
    },
    'ai-entry-recommendation'
  );

  const raw = completion.choices?.[0]?.message?.content?.trim();
  const parsed = raw ? JSON.parse(raw) : null;
  if (!parsed?.summary) throw new Error('Empty AI recommendation');

  const tags = Array.from(
    new Set([AI_TAG, ...(Array.isArray(parsed.tags) ? parsed.tags.map(String) : [])].filter(Boolean))
  );
  const priority = ['HIGH', 'MEDIUM', 'LOW'].includes(String(parsed.priority || '').toUpperCase())
    ? String(parsed.priority).toUpperCase()
    : 'MEDIUM';
  const actions = (Array.isArray(parsed.actions) ? parsed.actions : [])
    .slice(0, 5)
    .map((a) => ({
      title: String(a?.title || '').trim(),
      detail: String(a?.detail || '').trim(),
      dueInDays: Number.isFinite(Number(a?.dueInDays)) ? Number(a.dueInDays) : null,
    }))
    .filter((a) => a.title);

  return { summary: String(parsed.summary).trim(), priority, tags, actions };
}

export async function listAiRecommendations(entityType, entityId) {
  const type = normalizeEntityType(entityType);
  const id = String(entityId || '').trim();
  if (!id) return [];
  const col = await getCollection();
  if (!col) return [];
  return col.findByEntity(type, id, 15);
}

export async function generateAiEntryRecommendation({
  entityType,
  entityId,
  entityLabel,
  snapshot,
  recipientUserId,
  actorUserId,
  trigger = 'create',
  skipDedup = false,
}) {
  if (!hasLlmProvider()) return null;

  const type = normalizeEntityType(entityType);
  const id = String(entityId || '').trim();
  const label = String(entityLabel || '').trim() || type;
  if (!id) return null;

  const col = await getCollection();
  if (!col) return null;

  const since = new Date(Date.now() - DEDUP_MS);
  if (!skipDedup) {
    const recent = await col.findRecent(type, id, since);
    if (recent) return toRow(recent);
  }

  const safeSnapshot = sanitizeSnapshot(snapshot);
  const ai = await callOpenAiForRecommendation({
    entityType: type,
    entityLabel: label,
    snapshot: safeSnapshot,
    trigger,
  });

  const recipient = await resolveRecipientUser(recipientUserId || actorUserId);
  const userId = recipient?.id || String(recipientUserId || actorUserId || '').trim() || null;

  const row = await col.insert({
    entityType: type,
    entityId: id,
    entityLabel: label,
    summary: ai.summary,
    priority: ai.priority,
    tags: ai.tags,
    actions: ai.actions,
    trigger: String(trigger || 'create'),
    userId,
    actorUserId: actorUserId || null,
    emailSent: false,
  });

  if (userId) {
    const path = entityActionPath(type, id);
    if (await isAlertPortalEnabled(AI_ENTRY_RECOMMENDATION_ALERT_ID, userId)) {
      await createUserNotification(userId, {
        category: type,
        title: `AI recommendation: ${label}`,
        description: ai.summary,
        actionLabel: 'View record',
        actionPath: path,
        entityType: type,
        entityId: id,
        metadata: { tags: ai.tags, priority: ai.priority, recommendationId: row.id },
      });
    }

    if (recipient?.email && recipient.isActive !== false) {
      const emailEnabled = await isAlertEmailEnabled(AI_ENTRY_RECOMMENDATION_ALERT_ID, userId);
      if (emailEnabled) {
        try {
          await sendAiRecommendationEmail({
            toEmail: recipient.email,
            recipientName: recipient.name || 'there',
            entityType: type,
            entityLabel: label,
            summary: ai.summary,
            actions: ai.actions,
            tags: ai.tags,
            priority: ai.priority,
            actionPath: `${env.FRONTEND_URL || 'http://localhost:3001'}${path}`,
          });
          row.emailSent = true;
        } catch (err) {
          console.warn('[ai-recommendation] email failed:', err?.message || err);
        }
      }
    }
  }

  return toRow(row);
}

/** Non-blocking hook for create/update flows. */
export function queueAiEntryRecommendation(payload) {
  if (!hasLlmProvider()) return;
  setImmediate(() => {
    generateAiEntryRecommendation(payload).catch((err) => {
      console.warn('[ai-recommendation] generate failed:', err?.message || err);
    });
  });
}

export function buildEntitySnapshot(entityType, entity) {
  if (!entity || typeof entity !== 'object') return {};
  const e = entity;
  switch (normalizeEntityType(entityType)) {
    case 'LEAD':
      return {
        companyName: e.companyName,
        contactPerson: e.contactPerson,
        email: e.email,
        phone: e.phone,
        status: e.status,
        priority: e.priority,
        source: e.source,
        industry: e.industry,
        location: e.location,
        nextFollowUp: e.nextFollowUp,
        expectedBusinessValue: e.expectedBusinessValue,
        interestedNeeds: e.interestedNeeds,
        servicesNeeded: e.servicesNeeded,
      };
    case 'CLIENT':
      return {
        companyName: e.companyName,
        industry: e.industry,
        status: e.status,
        priority: e.priority,
        location: e.location,
        servicesNeeded: e.servicesNeeded,
        expectedBusinessValue: e.expectedBusinessValue,
        nextFollowUpDue: e.nextFollowUpDue,
        healthStatus: e.healthStatus,
        agreementLevel: e.agreementLevel,
        agreementTotalPayment: e.agreementTotalPayment,
      };
    case 'CANDIDATE':
      return {
        name: [e.firstName, e.lastName].filter(Boolean).join(' '),
        email: e.email,
        status: e.status,
        stage: e.stage,
        currentTitle: e.currentTitle,
        currentCompany: e.currentCompany,
        location: e.location,
        skills: (e.skills || []).slice(0, 12),
        experience: e.experience,
        source: e.source,
      };
    case 'JOB':
      return {
        title: e.title,
        status: e.status,
        location: e.location,
        department: e.department,
        openings: e.openings,
        type: e.type,
        skills: (e.skills || []).slice(0, 12),
        experienceRequired: e.experienceRequired,
        hot: e.hot,
        slaRisk: e.slaRisk,
      };
    case 'TASK':
      return {
        title: e.title,
        description: e.description,
        status: e.status,
        priority: e.priority,
        dueDate: e.dueDate,
        dueTime: e.dueTime,
        taskType: e.taskType,
        linkedEntityType: e.linkedEntityType,
        linkedEntityId: e.linkedEntityId,
        assignee: e.assignedTo?.name || e.assignedToId,
      };
    case 'PLACEMENT':
      return {
        status: e.status,
        offerDate: e.offerDate,
        joiningDate: e.joiningDate || e.startDate,
        salaryOffered: e.salaryOffered ?? e.salary,
        placementFee: e.placementFee ?? e.fee,
        commissionPercentage: e.commissionPercentage,
        employmentType: e.employmentType,
        candidate: e.candidate
          ? [e.candidate.firstName, e.candidate.lastName].filter(Boolean).join(' ')
          : null,
        jobTitle: e.job?.title,
        clientName: e.client?.companyName,
        recruiter: e.recruiter?.name,
      };
    case 'INTERVIEW':
      return {
        status: e.status,
        scheduledAt: e.scheduledAt,
        duration: e.duration,
        type: e.type,
        round: e.round,
        mode: e.mode,
        platform: e.platform,
        location: e.location,
        candidate: e.candidate
          ? [e.candidate.firstName, e.candidate.lastName].filter(Boolean).join(' ')
          : null,
        jobTitle: e.job?.title,
        clientName: e.client?.companyName,
        interviewer: e.interviewer?.name,
        panelCount: Array.isArray(e.panel) ? e.panel.length : Array.isArray(e.panelIds) ? e.panelIds.length : 0,
      };
    default:
      return sanitizeSnapshot(e);
  }
}
