import { MongoClient } from 'mongodb';
import { env } from '../../config/env.js';
import {
  PHASE2_AI_FEATURE_CATALOG,
  getAiFeature as getCatalogFeature,
} from '../setting/aiCoinCatalog.js';

const COLLECTION = 'hq_ai_feature_costs';
const GLOBAL_ID = 'global';

let cachedClient = null;
let indexesEnsured = false;
let costsCache = null;
let costsCacheAt = 0;
const CACHE_TTL_MS = 15_000;

async function getCollection() {
  if (!env.HEADQUARTERS_DATABASE_URL) {
    throw new Error('HEADQUARTERS_DATABASE_URL is not configured');
  }
  if (!cachedClient) {
    cachedClient = new MongoClient(env.HEADQUARTERS_DATABASE_URL);
    await cachedClient.connect();
  }
  const db = cachedClient.db();
  const collection = db.collection(COLLECTION);
  if (!indexesEnsured) {
    indexesEnsured = true;
  }
  return collection;
}

function normalizeCostsMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw)) {
    const id = String(key || '').trim();
    if (!id || !getCatalogFeature(id)) continue;
    const n = Math.max(0, Math.floor(Number(value) || 0));
    out[id] = n;
  }
  return out;
}

async function loadOverrides({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && costsCache && now - costsCacheAt < CACHE_TTL_MS) {
    return costsCache;
  }
  try {
    const collection = await getCollection();
    const doc = await collection.findOne({ _id: GLOBAL_ID });
    costsCache = normalizeCostsMap(doc?.costs);
    costsCacheAt = now;
    return costsCache;
  } catch (err) {
    console.warn('[hq-ai-features] failed to load cost overrides:', err?.message || err);
    return costsCache || {};
  }
}

function mergeFeature(feature, overrides) {
  const override = overrides[feature.id];
  const coins =
    override === undefined || override === null
      ? Math.max(0, Number(feature.coins) || 0)
      : Math.max(0, Number(override) || 0);
  return {
    ...feature,
    coins,
    defaultCoins: Math.max(0, Number(feature.coins) || 0),
    isCustomCost: override !== undefined && override !== null,
  };
}

export const hqAiFeaturesService = {
  async listFeatures() {
    const overrides = await loadOverrides();
    return PHASE2_AI_FEATURE_CATALOG.map((f) => mergeFeature({ ...f }, overrides));
  },

  async getCost(featureId) {
    const id = String(featureId || '').trim();
    const catalog = getCatalogFeature(id);
    if (!catalog) return 0;
    const overrides = await loadOverrides();
    if (overrides[id] !== undefined && overrides[id] !== null) {
      return Math.max(0, Number(overrides[id]) || 0);
    }
    return Math.max(0, Number(catalog.coins) || 0);
  },

  async getFeature(featureId) {
    const id = String(featureId || '').trim();
    const catalog = getCatalogFeature(id);
    if (!catalog) return null;
    const overrides = await loadOverrides();
    return mergeFeature({ ...catalog }, overrides);
  },

  async updateCosts(input, reqUser) {
    const incoming = Array.isArray(input?.features)
      ? input.features
      : input?.costs && typeof input.costs === 'object'
        ? Object.entries(input.costs).map(([id, coins]) => ({ id, coins }))
        : null;

    if (!incoming) {
      throw new Error('Provide features: [{ id, coins }] or costs: { featureId: coins }');
    }

    const current = await loadOverrides({ bypassCache: true });
    const next = { ...current };

    for (const row of incoming) {
      const id = String(row?.id || row?.featureId || '').trim();
      if (!id || !getCatalogFeature(id)) {
        throw new Error(`Unknown AI feature: ${id || '(empty)'}`);
      }
      if (row.coins === undefined || row.coins === null || row.coins === '') {
        throw new Error(`coins is required for ${id}`);
      }
      next[id] = Math.max(0, Math.floor(Number(row.coins) || 0));
    }

    const collection = await getCollection();
    await collection.updateOne(
      { _id: GLOBAL_ID },
      {
        $set: {
          costs: next,
          updatedAt: new Date(),
          updatedBy: reqUser?.email || reqUser?.id || null,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    costsCache = next;
    costsCacheAt = Date.now();

    return {
      features: PHASE2_AI_FEATURE_CATALOG.map((f) => mergeFeature({ ...f }, next)),
      costs: next,
    };
  },

  /** Invalidate in-process cache (e.g. after HQ save from another worker). */
  clearCache() {
    costsCache = null;
    costsCacheAt = 0;
  },
};
