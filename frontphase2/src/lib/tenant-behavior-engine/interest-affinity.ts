/**
 * Multi-topic interest ratings (0–100) derived from CRM module usage + entity focus.
 * Ported from Phase 1 interest-affinity-store.ts, adapted for tenant CRM categories.
 */

import { categoryLabel } from './categories';
import { getTenantActivityState } from './store';
import type {
  TenantActivityCategory,
  TenantInterestProfile,
  TenantInterestTopic,
  TenantPersonalizedRec,
} from './types';

export const TENANT_INTEREST_STORAGE_KEY = 'saasa:tenant-interest-affinity-v1';
export const TENANT_INTEREST_SYNC_EVENT = 'saasa:tenant-interest-updated';

const SYNC_THROTTLE_MS = 60 * 60 * 1000;

const CRM_TOPIC_ALIASES: Record<string, { key: string; label: string; keywords: string[] }> = {
  lead_management: {
    key: 'lead_management',
    label: 'Lead management',
    keywords: ['lead', 'prospect', 'follow-up', 'conversion'],
  },
  candidate_sourcing: {
    key: 'candidate_sourcing',
    label: 'Candidate sourcing',
    keywords: ['candidate', 'sourcing', 'talent', 'resume', 'cv'],
  },
  job_posting: {
    key: 'job_posting',
    label: 'Job posting',
    keywords: ['job', 'posting', 'requisition', 'opening', 'vacancy'],
  },
  pipeline_ops: {
    key: 'pipeline_ops',
    label: 'Pipeline operations',
    keywords: ['pipeline', 'stage', 'funnel', 'workflow'],
  },
  interview_scheduling: {
    key: 'interview_scheduling',
    label: 'Interview scheduling',
    keywords: ['interview', 'schedule', 'calendar', 'feedback'],
  },
  client_relations: {
    key: 'client_relations',
    label: 'Client relations',
    keywords: ['client', 'account', 'agreement', 'contract'],
  },
  ai_automation: {
    key: 'ai_automation',
    label: 'AI & automation',
    keywords: ['ai', 'brain', 'automation', 'matching', 'bulk'],
  },
  analytics: {
    key: 'analytics',
    label: 'Analytics & reports',
    keywords: ['report', 'analytics', 'dashboard', 'metrics'],
  },
  team_management: {
    key: 'team_management',
    label: 'Team management',
    keywords: ['team', 'member', 'rbac', 'role', 'permission'],
  },
  billing_ops: {
    key: 'billing_ops',
    label: 'Billing & invoicing',
    keywords: ['billing', 'invoice', 'payment', 'subscription'],
  },
};

const CATEGORY_TO_TOPIC: Partial<Record<TenantActivityCategory, string>> = {
  leads: 'lead_management',
  candidates: 'candidate_sourcing',
  jobs: 'job_posting',
  pipeline: 'pipeline_ops',
  interviews: 'interview_scheduling',
  clients: 'client_relations',
  ai: 'ai_automation',
  reports: 'analytics',
  team: 'team_management',
  billing: 'billing_ops',
  matches: 'pipeline_ops',
  placements: 'candidate_sourcing',
  recruitment: 'job_posting',
  dashboard: 'analytics',
};

function normalizeKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

function loadAll(): Record<string, TenantInterestProfile> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(TENANT_INTEREST_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, TenantInterestProfile>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, TenantInterestProfile>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TENANT_INTEREST_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

function profileKey(tenantDbName: string, userId: string) {
  return `${tenantDbName}:${userId}`;
}

function emitInterestUpdated(tenantDbName: string, userId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(TENANT_INTEREST_SYNC_EVENT, { detail: { tenantDbName, userId } }),
    );
  } catch {
    /* ignore */
  }
}

export function getTenantInterestProfile(
  tenantDbName: string,
  userId: string,
): TenantInterestProfile {
  if (!tenantDbName || !userId) {
    return { userId: '', tenantDbName: '', topics: {}, updatedAt: new Date().toISOString() };
  }
  const map = loadAll();
  const key = profileKey(tenantDbName, userId);
  if (!map[key]) {
    map[key] = {
      userId,
      tenantDbName,
      topics: {},
      updatedAt: new Date().toISOString(),
    };
    saveAll(map);
  }
  return map[key];
}

export function listTenantInterests(
  tenantDbName: string,
  userId: string,
  minScore = 1,
): TenantInterestTopic[] {
  const profile = getTenantInterestProfile(tenantDbName, userId);
  return Object.values(profile.topics)
    .filter((t) => t.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

export function bumpTenantInterest(
  tenantDbName: string,
  userId: string,
  topicRaw: string,
  delta: number,
  label?: string,
): TenantInterestTopic | null {
  if (!tenantDbName || !userId || !topicRaw.trim()) return null;
  const topicKey = normalizeKey(topicRaw);
  if (!topicKey || topicKey.length < 2) return null;

  const map = loadAll();
  const pKey = profileKey(tenantDbName, userId);
  const profile = map[pKey] || {
    userId,
    tenantDbName,
    topics: {},
    updatedAt: new Date().toISOString(),
  };

  const prev = profile.topics[topicKey];
  const nextScore = Math.max(0, Math.min(100, (prev?.score || 0) + delta));
  const topic: TenantInterestTopic = {
    key: topicKey,
    label: label?.trim() || prev?.label || topicRaw.trim(),
    score: Math.round(nextScore * 10) / 10,
    updatedAt: new Date().toISOString(),
  };
  profile.topics[topicKey] = topic;
  profile.updatedAt = topic.updatedAt;
  map[pKey] = profile;
  saveAll(map);
  emitInterestUpdated(tenantDbName, userId);
  return topic;
}

function ensureInterestAtLeast(
  tenantDbName: string,
  userId: string,
  topicRaw: string,
  minScore: number,
  label?: string,
): TenantInterestTopic | null {
  const topicKey = normalizeKey(topicRaw);
  const prev = getTenantInterestProfile(tenantDbName, userId).topics[topicKey]?.score || 0;
  if (prev >= minScore) return getTenantInterestProfile(tenantDbName, userId).topics[topicKey] || null;
  return bumpTenantInterest(tenantDbName, userId, topicRaw, minScore - prev, label);
}

function loadSyncMeta(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${TENANT_INTEREST_STORAGE_KEY}:sync`);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function saveSyncMeta(meta: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${TENANT_INTEREST_STORAGE_KEY}:sync`, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

/**
 * Sync interest scores from CRM behaviour state (module visits, entity focus, actions).
 * Throttled to ~1/hour.
 */
export function syncTenantInterestsFromBehaviour(
  tenantDbName: string,
  userId: string,
): TenantInterestProfile {
  const profile = getTenantInterestProfile(tenantDbName, userId);
  if (!tenantDbName || !userId) return profile;

  const meta = loadSyncMeta();
  const syncKey = profileKey(tenantDbName, userId);
  const last = meta[syncKey] || 0;
  if (Date.now() - last < SYNC_THROTTLE_MS && Object.keys(profile.topics).length > 0) {
    return profile;
  }

  try {
    const state = getTenantActivityState(tenantDbName, userId);

    for (const [cat, count] of Object.entries(state.totals.pageVisitsByCategory || {})) {
      const topicAlias = CATEGORY_TO_TOPIC[cat as TenantActivityCategory];
      if (!topicAlias || !count) continue;
      const alias = CRM_TOPIC_ALIASES[topicAlias];
      if (!alias) continue;
      const floor = Math.min(60, 10 + count * 3);
      ensureInterestAtLeast(tenantDbName, userId, alias.key, floor, alias.label);
    }

    for (const [cat, count] of Object.entries(state.totals.actionsByCategory || {})) {
      const topicAlias = CATEGORY_TO_TOPIC[cat as TenantActivityCategory];
      if (!topicAlias || !count) continue;
      const alias = CRM_TOPIC_ALIASES[topicAlias];
      if (!alias) continue;
      const floor = Math.min(75, 15 + count * 5);
      ensureInterestAtLeast(tenantDbName, userId, alias.key, floor, alias.label);
    }

    for (const entity of (state.entityFocus || []).slice(0, 8)) {
      const entityKey = `entity_${entity.entityType}`;
      const floor = Math.min(50, 8 + (entity.views + entity.clicks * 2 + entity.actions * 3) * 2);
      ensureInterestAtLeast(
        tenantDbName,
        userId,
        entityKey,
        floor,
        entity.label || entity.entityType,
      );
    }

    meta[syncKey] = Date.now();
    saveSyncMeta(meta);
  } catch {
    /* ignore */
  }

  return getTenantInterestProfile(tenantDbName, userId);
}

const REC_TEMPLATES: Record<string, { title: string; actionUrl: string; priority: number; text: (label: string, score: number) => string }> = {
  lead_management: {
    title: 'Follow up on open leads',
    actionUrl: '/leads',
    priority: 84,
    text: (label, score) => `Strong ${label} signal (${Math.round(score)}). Review and convert top leads today.`,
  },
  candidate_sourcing: {
    title: 'Source candidates for open jobs',
    actionUrl: '/candidates',
    priority: 82,
    text: (label, score) => `Your ${label} interest is ${Math.round(score)}. Add 2–3 candidates to active jobs.`,
  },
  job_posting: {
    title: 'Review open job requisitions',
    actionUrl: '/jobs',
    priority: 80,
    text: (label, score) => `High ${label} activity (${Math.round(score)}). Check job status and update descriptions.`,
  },
  pipeline_ops: {
    title: 'Move pipeline forward',
    actionUrl: '/pipeline',
    priority: 78,
    text: (label) => `You're focused on ${label} — update stages and assign next actions.`,
  },
  interview_scheduling: {
    title: 'Schedule pending interviews',
    actionUrl: '/interviews',
    priority: 76,
    text: (label, score) => `${label} interest at ${Math.round(score)}. Schedule or follow up on pending interviews.`,
  },
  client_relations: {
    title: 'Engage with clients',
    actionUrl: '/clients',
    priority: 74,
    text: (label) => `Active in ${label} — check client feedback and renew agreements.`,
  },
  ai_automation: {
    title: 'Try AI matching tools',
    actionUrl: '/brain',
    priority: 72,
    text: (label, score) => `AI adoption at ${Math.round(score)}. Run bulk CV match or AI job creation.`,
  },
  analytics: {
    title: 'Review team analytics',
    actionUrl: '/reports',
    priority: 68,
    text: (label) => `You check ${label} often — review team KPIs and conversion rates.`,
  },
  team_management: {
    title: 'Review team workload',
    actionUrl: '/team',
    priority: 66,
    text: (label) => `${label} focus detected — check assignments and RBAC settings.`,
  },
  billing_ops: {
    title: 'Review billing status',
    actionUrl: '/billing',
    priority: 64,
    text: (label) => `${label} activity — check invoices and subscription status.`,
  },
};

function recForTopic(topic: TenantInterestTopic): TenantPersonalizedRec {
  const tpl =
    REC_TEMPLATES[topic.key] ||
    (topic.key.startsWith('entity_')
      ? {
          title: `Follow up on ${topic.label}`,
          actionUrl: '/dashboard',
          priority: 65,
          text: (label: string, score: number) =>
            `Repeated focus on ${label} (${Math.round(score)}). Complete pending actions on this record.`,
        }
      : {
          title: `Stay on ${topic.label}`,
          actionUrl: '/dashboard',
          priority: Math.min(70, 40 + Math.round(topic.score / 4)),
          text: (label: string, score: number) =>
            `You're ${Math.round(score)} into ${label} — pick one actionable task in that module.`,
        });

  return {
    id: `rec_${topic.key}`,
    interestKey: topic.key,
    interestScore: topic.score,
    title: tpl.title,
    text: tpl.text(topic.label, topic.score),
    actionUrl: tpl.actionUrl,
    priority: tpl.priority + Math.min(10, Math.round(topic.score / 15)),
  };
}

export function buildTenantInterestSnapshot(
  tenantDbName: string,
  userId: string,
): { topics: TenantInterestTopic[]; personalizedRecs: TenantPersonalizedRec[] } {
  if (!tenantDbName || !userId) return { topics: [], personalizedRecs: [] };
  syncTenantInterestsFromBehaviour(tenantDbName, userId);
  const topics = listTenantInterests(tenantDbName, userId, 1).slice(0, 12);
  const personalizedRecs = topics
    .filter((t) => t.score >= 8)
    .slice(0, 5)
    .map(recForTopic)
    .sort((a, b) => b.priority - a.priority || b.interestScore - a.interestScore);
  return { topics, personalizedRecs };
}

/** Score how well a CRM module matches the user's interest profile. */
export function scoreCategoryAgainstInterests(
  tenantDbName: string,
  userId: string,
  category: TenantActivityCategory,
): number {
  const topics = listTenantInterests(tenantDbName, userId, 1);
  if (!topics.length) return 0;
  const topicAlias = CATEGORY_TO_TOPIC[category];
  if (!topicAlias) return 0;
  const match = topics.find((t) => t.key === topicAlias);
  return match ? match.score / 100 : 0;
}

export { categoryLabel };
