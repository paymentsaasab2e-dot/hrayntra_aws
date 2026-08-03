import { MongoClient } from 'mongodb';
import { env } from '../../config/env.js';
import { PHASE2_AI_COIN_PACKS } from '../setting/aiCoinPacks.js';

const COLLECTION = 'hq_ai_coin_packs';
const GLOBAL_ID = 'global';

let cachedClient = null;
let packsCache = null;
let packsCacheAt = 0;
const CACHE_TTL_MS = 15_000;

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

function formatPriceLabel(priceUsd) {
  const n = Number(priceUsd);
  if (!Number.isFinite(n)) return '$0';
  if (Number.isInteger(n)) return `$${n}`;
  return `$${n.toFixed(2)}`;
}

/**
 * Normalize a pack from HQ input or stored doc.
 * @returns {null | { id, name, coins, priceUsd, priceLabel, description, popular, active, sortOrder }}
 */
export function normalizeCoinPack(raw, { index = 0, existingIds = new Set() } = {}) {
  if (!raw || typeof raw !== 'object') return null;

  const name = String(raw.name || '').trim();
  if (!name) return null;

  const coins = Math.max(0, Math.floor(Number(raw.coins) || 0));
  if (coins <= 0) return null;

  const priceUsd = Math.max(0, Number(raw.priceUsd ?? raw.price ?? 0) || 0);
  const priceLabel =
    String(raw.priceLabel || '').trim() || formatPriceLabel(priceUsd);

  let id = String(raw.id || '').trim();
  if (!id) {
    const base = `ai_pack_${slugify(name) || 'custom'}`;
    id = base;
    let n = 2;
    while (existingIds.has(id)) {
      id = `${base}_${n++}`;
    }
  }

  return {
    id,
    name,
    coins,
    priceUsd,
    priceLabel,
    description: String(raw.description || '').trim(),
    popular: Boolean(raw.popular),
    active: raw.active === false ? false : true,
    sortOrder: Number.isFinite(Number(raw.sortOrder))
      ? Number(raw.sortOrder)
      : index,
  };
}

function sortPacks(packs) {
  return [...packs].sort((a, b) => {
    const ao = Number(a.sortOrder) || 0;
    const bo = Number(b.sortOrder) || 0;
    if (ao !== bo) return ao - bo;
    return String(a.name).localeCompare(String(b.name));
  });
}

function defaultPacks() {
  return PHASE2_AI_COIN_PACKS.map((p, index) =>
    normalizeCoinPack({ ...p, active: true, sortOrder: index }, { index })
  ).filter(Boolean);
}

async function loadPacks({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && packsCache && now - packsCacheAt < CACHE_TTL_MS) {
    return packsCache;
  }
  try {
    const collection = await getCollection();
    const doc = await collection.findOne({ _id: GLOBAL_ID });
    const rawList = Array.isArray(doc?.packs) ? doc.packs : null;
    if (!rawList || rawList.length === 0) {
      packsCache = defaultPacks();
      packsCacheAt = now;
      return packsCache;
    }
    const existingIds = new Set();
    const normalized = [];
    rawList.forEach((row, index) => {
      const pack = normalizeCoinPack(row, { index, existingIds });
      if (!pack) return;
      existingIds.add(pack.id);
      normalized.push(pack);
    });
    packsCache = normalized.length ? sortPacks(normalized) : defaultPacks();
    packsCacheAt = now;
    return packsCache;
  } catch (err) {
    console.warn('[hq-ai-coin-packs] failed to load packs:', err?.message || err);
    return packsCache || defaultPacks();
  }
}

export const hqAiCoinPacksService = {
  async listPacks({ includeInactive = true } = {}) {
    const packs = await loadPacks();
    if (includeInactive) return packs.map((p) => ({ ...p }));
    return packs.filter((p) => p.active !== false).map((p) => ({ ...p }));
  },

  async getPack(packId) {
    const id = String(packId || '').trim();
    if (!id) return null;
    const packs = await loadPacks();
    return packs.find((p) => p.id === id && p.active !== false) || null;
  },

  /** Full replace used by HQ save. */
  async savePacks(input, reqUser) {
    const incoming = Array.isArray(input?.packs) ? input.packs : null;
    if (!incoming) throw new Error('Provide packs: [{ name, coins, priceUsd, ... }]');
    if (incoming.length === 0) {
      throw new Error('At least one coin pack is required');
    }

    const existingIds = new Set();
    const next = [];
    incoming.forEach((row, index) => {
      const pack = normalizeCoinPack(row, { index, existingIds });
      if (!pack) {
        throw new Error(
          `Invalid pack at index ${index}: name and coins (> 0) are required`
        );
      }
      if (existingIds.has(pack.id)) {
        throw new Error(`Duplicate pack id: ${pack.id}`);
      }
      existingIds.add(pack.id);
      next.push(pack);
    });

    // Ensure only one popular flag if multiple set
    let popularSeen = false;
    const cleaned = sortPacks(next).map((p, index) => {
      let popular = Boolean(p.popular);
      if (popular && popularSeen) popular = false;
      if (popular) popularSeen = true;
      return { ...p, popular, sortOrder: index };
    });
    if (!popularSeen && cleaned.length) cleaned[0].popular = true;

    const collection = await getCollection();
    await collection.updateOne(
      { _id: GLOBAL_ID },
      {
        $set: {
          packs: cleaned,
          updatedAt: new Date(),
          updatedBy: reqUser?.email || reqUser?.id || null,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    packsCache = cleaned;
    packsCacheAt = Date.now();
    return { packs: cleaned.map((p) => ({ ...p })) };
  },

  clearCache() {
    packsCache = null;
    packsCacheAt = 0;
  },
};
