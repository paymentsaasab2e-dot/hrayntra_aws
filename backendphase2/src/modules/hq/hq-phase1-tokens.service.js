import { MongoClient } from 'mongodb';
import { env } from '../../config/env.js';

const COLLECTION = 'hq_phase1_token_config';
const GLOBAL_ID = 'global';

/** Defaults mirror backend1/src/constants/tokenCatalog.js */
export const PHASE1_DEFAULT_PACKS = [
  {
    id: 'starter',
    name: 'Starter',
    priceLabel: '$5',
    priceAmount: 5,
    currency: 'USD',
    tokens: 50,
    description: 'Entry coin pack for resume tools and light LMS unlocks.',
    popular: false,
    active: true,
  },
  {
    id: 'plus',
    name: 'Plus',
    priceLabel: '$10',
    priceAmount: 10,
    currency: 'USD',
    tokens: 120,
    description: 'Best value for interview prep + course unlocks.',
    popular: true,
    active: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$20',
    priceAmount: 20,
    currency: 'USD',
    tokens: 300,
    description: 'High-volume pack for certified courses and mock sessions.',
    popular: false,
    active: true,
  },
];

export const PHASE1_DEFAULT_SERVICES = [
  { id: 'lms.resume.ai-improve', name: 'AI CV Edit', description: 'Improve resume sections with AI', cost: 10, category: 'Resume' },
  { id: 'cveditor.ai-improve', name: 'AI CV Editor Improve', description: 'Rewrite selected text in the CV editor', cost: 10, category: 'Resume' },
  { id: 'lms.resume.ats-check', name: 'ATS Check', description: 'Scan resume for ATS compatibility', cost: 5, category: 'Resume' },
  { id: 'lms.resume.generate-summary', name: 'Generate Summary', description: 'AI-generated professional summary', cost: 8, category: 'Resume' },
  { id: 'lms.resume.tailor-summary', name: 'Tailor Summary for Job', description: 'Rewrite summary for a target role', cost: 10, category: 'Resume' },
  { id: 'lms.resume.analyze', name: 'Resume Analyze', description: 'Deep AI analysis of your resume draft', cost: 8, category: 'Resume' },
  { id: 'lms.quizzes.generate', name: 'Generate Quizzes', description: 'Create topic-based practice quizzes', cost: 15, category: 'Quizzes' },
  { id: 'lms.interview.generate-set', name: 'Generate Interview Set', description: 'AI interview question set for a role', cost: 20, category: 'Interview' },
  { id: 'lms.interview.ai-feedback', name: 'Interview AI Feedback', description: 'Score and feedback on your answers', cost: 15, category: 'Interview' },
  { id: 'lms.interview.mock-session-start', name: 'Mock Interview Session', description: 'Start a full AI mock interview', cost: 25, category: 'Interview' },
  { id: 'lms.interview.unlock-request', name: 'Unlock Be Interviewed', description: 'One-time unlock for interview request flow', cost: 15, category: 'Interview' },
  { id: 'lms.interview.unlock-interviewer', name: 'Unlock Become Interviewer', description: 'One-time unlock for interviewer application flow', cost: 20, category: 'Interview' },
  { id: 'lms.notes.ai-action', name: 'Notes AI Action', description: 'Summarize, expand, or rewrite notes', cost: 5, category: 'Notes' },
  { id: 'lms.career-path.recommend-goal', name: 'Career Goal Recommend', description: 'AI-recommended career goal', cost: 10, category: 'Career Path' },
  { id: 'lms.courses.unlock-premium', name: 'Premium Course Unlock', description: 'Typical cost to unlock a premium LMS course', cost: 25, category: 'Courses' },
  { id: 'lms.courses.unlock-certified', name: 'Certified Course Unlock', description: 'Typical cost to unlock a certified LMS course', cost: 50, category: 'Courses' },
];

/** Free onboarding / profile earn tasks — mirror backend1 tokenCatalog EARN_TASK_CATALOG */
export const PHASE1_DEFAULT_EARN_TASKS = [
  {
    id: 'welcome',
    name: 'First login bonus',
    description: 'Automatic when candidates open the dashboard after signup',
    tokens: 20,
    category: 'Onboarding',
    order: 1,
  },
  {
    id: 'earn.cv_upload',
    name: 'Upload your CV',
    description: 'Upload a resume once (also credited if CV was added during signup)',
    tokens: 20,
    category: 'Onboarding',
    order: 2,
  },
  {
    id: 'earn.profile.basicInformation',
    name: 'Complete basic details',
    description: 'Fill personal profile basics',
    tokens: 10,
    category: 'Profile',
    order: 3,
  },
  {
    id: 'earn.profile.summary',
    name: 'Add professional summary',
    description: 'Write your profile summary',
    tokens: 5,
    category: 'Profile',
    order: 4,
  },
  {
    id: 'earn.profile.education',
    name: 'Add education',
    description: 'Complete education section',
    tokens: 10,
    category: 'Profile',
    order: 5,
  },
  {
    id: 'earn.profile.skills',
    name: 'Add skills',
    description: 'Complete skills section',
    tokens: 10,
    category: 'Profile',
    order: 6,
  },
  {
    id: 'earn.profile.languages',
    name: 'Add languages',
    description: 'Complete languages section',
    tokens: 5,
    category: 'Profile',
    order: 7,
  },
  {
    id: 'earn.profile.projects',
    name: 'Add a project',
    description: 'Complete projects section',
    tokens: 5,
    category: 'Profile',
    order: 8,
  },
  {
    id: 'earn.profile.careerPreferences',
    name: 'Set career preferences',
    description: 'Complete career preferences',
    tokens: 5,
    category: 'Profile',
    order: 9,
  },
];

let cachedClient = null;
let configCache = null;
let configCacheAt = 0;
const CACHE_TTL_MS = 10_000;

async function getCollection() {
  if (!env.HEADQUARTERS_DATABASE_URL) {
    throw new Error('HEADQUARTERS_DATABASE_URL is not configured');
  }
  if (!cachedClient) {
    cachedClient = new MongoClient(env.HEADQUARTERS_DATABASE_URL);
    await cachedClient.connect();
  }
  return cachedClient.db().collection(COLLECTION);
}

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function formatPriceLabel(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0';
  if (Number.isInteger(n)) return `$${n}`;
  return `$${n.toFixed(2)}`;
}

export function normalizePhase1Pack(raw, { index = 0, existingIds = new Set() } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const tokens = Math.max(0, Math.floor(Number(raw.tokens ?? raw.coins) || 0));
  if (tokens <= 0) return null;
  const priceAmount = Math.max(0, Number(raw.priceAmount ?? raw.priceUsd ?? 0) || 0);
  // Prefer regenerating label from amount when client sends a stale label
  const explicitLabel = String(raw.priceLabel || '').trim();
  const priceLabel = explicitLabel || formatPriceLabel(priceAmount);
  let id = String(raw.id || '').trim();
  if (!id) {
    const base = slugify(name) || 'pack';
    id = base;
    let n = 2;
    while (existingIds.has(id)) id = `${base}_${n++}`;
  }
  return {
    id,
    name,
    tokens,
    priceAmount,
    priceLabel,
    currency: String(raw.currency || 'USD').trim() || 'USD',
    description: String(raw.description || '').trim(),
    popular: Boolean(raw.popular),
    active: raw.active === false ? false : true,
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : index,
  };
}

function defaultConfig() {
  return {
    packs: PHASE1_DEFAULT_PACKS.map((p, i) => normalizePhase1Pack(p, { index: i })),
    serviceCosts: Object.fromEntries(PHASE1_DEFAULT_SERVICES.map((s) => [s.id, s.cost])),
    earnRewards: Object.fromEntries(PHASE1_DEFAULT_EARN_TASKS.map((t) => [t.id, t.tokens])),
  };
}

async function loadConfig({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && configCache && now - configCacheAt < CACHE_TTL_MS) {
    return configCache;
  }
  try {
    const collection = await getCollection();
    const doc = await collection.findOne({ _id: GLOBAL_ID });
    if (!doc) {
      configCache = defaultConfig();
      configCacheAt = now;
      return configCache;
    }
    const existingIds = new Set();
    const packs = [];
    (Array.isArray(doc.packs) ? doc.packs : []).forEach((row, index) => {
      const pack = normalizePhase1Pack(row, { index, existingIds });
      if (!pack) return;
      existingIds.add(pack.id);
      packs.push(pack);
    });
    const serviceCosts = {};
    const rawCosts = doc.serviceCosts && typeof doc.serviceCosts === 'object' ? doc.serviceCosts : {};
    for (const svc of PHASE1_DEFAULT_SERVICES) {
      const v = rawCosts[svc.id];
      serviceCosts[svc.id] =
        v === undefined || v === null
          ? svc.cost
          : Math.max(0, Math.floor(Number(v) || 0));
    }
    // Allow HQ to keep unknown keys if they add custom spend ids later
    for (const [key, value] of Object.entries(rawCosts)) {
      if (serviceCosts[key] !== undefined) continue;
      serviceCosts[key] = Math.max(0, Math.floor(Number(value) || 0));
    }

    const earnRewards = {};
    const rawEarns = doc.earnRewards && typeof doc.earnRewards === 'object' ? doc.earnRewards : {};
    for (const task of PHASE1_DEFAULT_EARN_TASKS) {
      const v = rawEarns[task.id];
      earnRewards[task.id] =
        v === undefined || v === null
          ? task.tokens
          : Math.max(0, Math.floor(Number(v) || 0));
    }
    for (const [key, value] of Object.entries(rawEarns)) {
      if (earnRewards[key] !== undefined) continue;
      earnRewards[key] = Math.max(0, Math.floor(Number(value) || 0));
    }

    configCache = {
      packs: packs.length ? packs.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) : defaultConfig().packs,
      serviceCosts,
      earnRewards,
      updatedAt: doc.updatedAt || null,
    };
    configCacheAt = now;
    return configCache;
  } catch (err) {
    console.warn('[hq-phase1-tokens] load failed:', err?.message || err);
    return configCache || defaultConfig();
  }
}

function mergeServices(serviceCosts) {
  return PHASE1_DEFAULT_SERVICES.map((s) => {
    const cost =
      serviceCosts[s.id] === undefined || serviceCosts[s.id] === null
        ? s.cost
        : Math.max(0, Math.floor(Number(serviceCosts[s.id]) || 0));
    return {
      ...s,
      cost,
      defaultCost: s.cost,
      isCustomCost: serviceCosts[s.id] !== undefined && Number(serviceCosts[s.id]) !== s.cost,
    };
  });
}

function mergeEarnTasks(earnRewards) {
  return PHASE1_DEFAULT_EARN_TASKS.map((t) => {
    const tokens =
      earnRewards[t.id] === undefined || earnRewards[t.id] === null
        ? t.tokens
        : Math.max(0, Math.floor(Number(earnRewards[t.id]) || 0));
    return {
      ...t,
      tokens,
      defaultTokens: t.tokens,
      isCustomTokens: earnRewards[t.id] !== undefined && Number(earnRewards[t.id]) !== t.tokens,
    };
  }).sort((a, b) => (a.order || 0) - (b.order || 0));
}

export const hqPhase1TokensService = {
  async getOverview({ includeInactive = true } = {}) {
    const config = await loadConfig({ bypassCache: true });
    const packs = includeInactive
      ? config.packs
      : config.packs.filter((p) => p.active !== false);
    return {
      packs: packs.map((p) => ({ ...p })),
      services: mergeServices(config.serviceCosts),
      serviceCosts: { ...config.serviceCosts },
      earns: mergeEarnTasks(config.earnRewards || {}),
      earnRewards: { ...(config.earnRewards || {}) },
      updatedAt: config.updatedAt || null,
    };
  },

  async listPacks({ includeInactive = true } = {}) {
    const overview = await this.getOverview({ includeInactive });
    return overview.packs;
  },

  async getPack(packId) {
    const id = String(packId || '').trim();
    const packs = await this.listPacks({ includeInactive: false });
    return packs.find((p) => p.id === id) || null;
  },

  async getServiceCost(serviceId) {
    const id = String(serviceId || '').trim();
    const config = await loadConfig({ bypassCache: true });
    if (config.serviceCosts[id] != null) return Math.max(0, Number(config.serviceCosts[id]) || 0);
    const fallback = PHASE1_DEFAULT_SERVICES.find((s) => s.id === id);
    return fallback ? fallback.cost : null;
  },

  async savePacks(input, reqUser) {
    const incoming = Array.isArray(input?.packs) ? input.packs : null;
    if (!incoming) throw new Error('Provide packs: [{ name, tokens, priceAmount, ... }]');
    if (incoming.length === 0) throw new Error('At least one coin pack is required');

    const existingIds = new Set();
    const next = [];
    incoming.forEach((row, index) => {
      const pack = normalizePhase1Pack(row, { index, existingIds });
      if (!pack) throw new Error(`Invalid pack at index ${index}: name and tokens (> 0) required`);
      if (existingIds.has(pack.id)) throw new Error(`Duplicate pack id: ${pack.id}`);
      existingIds.add(pack.id);
      next.push(pack);
    });

    let popularSeen = false;
    const cleaned = next
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((p, index) => {
        let popular = Boolean(p.popular);
        if (popular && popularSeen) popular = false;
        if (popular) popularSeen = true;
        return { ...p, popular, sortOrder: index };
      });
    if (!popularSeen && cleaned.length) cleaned[0].popular = true;

    const current = await loadConfig({ bypassCache: true });
    const collection = await getCollection();
    const updatedAt = new Date();
    await collection.updateOne(
      { _id: GLOBAL_ID },
      {
        $set: {
          packs: cleaned,
          serviceCosts: current.serviceCosts,
          earnRewards: current.earnRewards || defaultConfig().earnRewards,
          updatedAt,
          updatedBy: reqUser?.email || reqUser?.id || null,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    configCache = {
      packs: cleaned,
      serviceCosts: current.serviceCosts,
      earnRewards: current.earnRewards || defaultConfig().earnRewards,
      updatedAt,
    };
    configCacheAt = Date.now();
    return { packs: cleaned.map((p) => ({ ...p })), updatedAt: updatedAt.toISOString() };
  },

  async saveServiceCosts(input, reqUser) {
    const incoming = Array.isArray(input?.services)
      ? input.services
      : input?.costs && typeof input.costs === 'object'
        ? Object.entries(input.costs).map(([id, cost]) => ({ id, cost }))
        : null;
    if (!incoming) throw new Error('Provide services: [{ id, cost }] or costs: { serviceId: cost }');

    const current = await loadConfig({ bypassCache: true });
    const nextCosts = { ...current.serviceCosts };
    const changed = [];

    for (const row of incoming) {
      const id = String(row?.id || row?.serviceId || '').trim();
      if (!id) throw new Error('service id is required');
      const known = PHASE1_DEFAULT_SERVICES.find((s) => s.id === id);
      if (!known && nextCosts[id] === undefined) {
        throw new Error(`Unknown Phase 1 spend service: ${id}`);
      }
      if (row.cost === undefined || row.cost === null || row.cost === '') {
        throw new Error(`cost is required for ${id}`);
      }
      const cost = Math.max(0, Math.floor(Number(row.cost) || 0));
      const prev = nextCosts[id] ?? known?.cost ?? 0;
      nextCosts[id] = cost;
      if (prev !== cost) {
        changed.push({ id, name: known?.name || id, previous: prev, cost });
      }
    }

    const collection = await getCollection();
    const updatedAt = new Date();
    const earnRewards = current.earnRewards || defaultConfig().earnRewards;
    await collection.updateOne(
      { _id: GLOBAL_ID },
      {
        $set: {
          packs: current.packs,
          serviceCosts: nextCosts,
          earnRewards,
          updatedAt,
          updatedBy: reqUser?.email || reqUser?.id || null,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    configCache = { packs: current.packs, serviceCosts: nextCosts, earnRewards, updatedAt };
    configCacheAt = Date.now();

    return {
      services: mergeServices(nextCosts),
      serviceCosts: nextCosts,
      changed,
      updatedAt: updatedAt.toISOString(),
    };
  },

  async saveEarnRewards(input, reqUser) {
    const incoming = Array.isArray(input?.earns)
      ? input.earns
      : input?.rewards && typeof input.rewards === 'object'
        ? Object.entries(input.rewards).map(([id, tokens]) => ({ id, tokens }))
        : null;
    if (!incoming) throw new Error('Provide earns: [{ id, tokens }] or rewards: { earnId: tokens }');

    const current = await loadConfig({ bypassCache: true });
    const nextRewards = { ...(current.earnRewards || defaultConfig().earnRewards) };
    const changed = [];

    for (const row of incoming) {
      const id = String(row?.id || row?.earnKey || '').trim();
      if (!id) throw new Error('earn id is required');
      const known = PHASE1_DEFAULT_EARN_TASKS.find((t) => t.id === id);
      if (!known && nextRewards[id] === undefined) {
        throw new Error(`Unknown Phase 1 earn task: ${id}`);
      }
      if (row.tokens === undefined || row.tokens === null || row.tokens === '') {
        throw new Error(`tokens is required for ${id}`);
      }
      const tokens = Math.max(0, Math.floor(Number(row.tokens) || 0));
      const prev = nextRewards[id] ?? known?.tokens ?? 0;
      nextRewards[id] = tokens;
      if (prev !== tokens) {
        changed.push({ id, name: known?.name || id, previous: prev, tokens });
      }
    }

    const collection = await getCollection();
    const updatedAt = new Date();
    await collection.updateOne(
      { _id: GLOBAL_ID },
      {
        $set: {
          packs: current.packs,
          serviceCosts: current.serviceCosts,
          earnRewards: nextRewards,
          updatedAt,
          updatedBy: reqUser?.email || reqUser?.id || null,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    configCache = {
      packs: current.packs,
      serviceCosts: current.serviceCosts,
      earnRewards: nextRewards,
      updatedAt,
    };
    configCacheAt = Date.now();

    return {
      earns: mergeEarnTasks(nextRewards),
      earnRewards: nextRewards,
      changed,
      updatedAt: updatedAt.toISOString(),
    };
  },

  clearCache() {
    configCache = null;
    configCacheAt = 0;
  },
};
