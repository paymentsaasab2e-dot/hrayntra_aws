import { MongoClient } from 'mongodb';
import { env } from '../../config/env.js';
import {
  FREE_MONTHLY_PUBLISH_LIMIT,
  PREMIUM_MONTHLY_PUBLISH_LIMIT,
  PREMIUM_MONTHLY_PRICE_PAISE,
  PREMIUM_YEARLY_PRICE_PAISE,
} from '../job-posting-plan/jobPostingPlan.constants.js';
import { getRazorpayConfig } from '../payment/razorpay.config.js';

const COLLECTION = 'hq_free_job_packs';
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

function paiseToUsd(paise) {
  const config = getRazorpayConfig();
  const rate = config.usdToInrRate || 83;
  return Math.round((Number(paise || 0) / 100 / rate) * 100) / 100;
}

/**
 * @returns {null | {
 *   id, name, description, monthlyLimit, durationDays,
 *   priceUsd, priceLabel, popular, active, sortOrder
 * }}
 */
export function normalizeFreeJobPack(raw, { index = 0, existingIds = new Set() } = {}) {
  if (!raw || typeof raw !== 'object') return null;

  const name = String(raw.name || '').trim();
  if (!name) return null;

  const monthlyLimit = Math.max(1, Math.floor(Number(raw.monthlyLimit ?? raw.jobs ?? 0) || 0));
  if (monthlyLimit <= 0) return null;

  const durationDays = Math.max(1, Math.floor(Number(raw.durationDays ?? raw.days ?? 30) || 30));
  const priceUsd = Math.max(0, Number(raw.priceUsd ?? raw.price ?? 0) || 0);
  if (!(priceUsd > 0)) return null;

  const priceLabel = String(raw.priceLabel || '').trim() || formatPriceLabel(priceUsd);

  let id = String(raw.id || '').trim();
  if (!id) {
    const base = `fj_pack_${slugify(name) || 'custom'}`;
    id = base;
    let n = 2;
    while (existingIds.has(id)) {
      id = `${base}_${n++}`;
    }
  }

  return {
    id,
    name,
    description: String(raw.description || '').trim(),
    monthlyLimit,
    durationDays,
    priceUsd,
    priceLabel,
    popular: Boolean(raw.popular),
    active: raw.active === false ? false : true,
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : index,
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
  const monthlyUsd = paiseToUsd(PREMIUM_MONTHLY_PRICE_PAISE) || 12;
  const yearlyUsd = paiseToUsd(PREMIUM_YEARLY_PRICE_PAISE) || 120;
  const seed = [
    {
      id: 'fj_pack_boost',
      name: 'Boost',
      description: `Publish up to ${Math.max(FREE_MONTHLY_PUBLISH_LIMIT + 15, 25)} jobs / month`,
      monthlyLimit: Math.max(FREE_MONTHLY_PUBLISH_LIMIT + 15, 25),
      durationDays: 30,
      priceUsd: Math.max(5, Math.round(monthlyUsd * 0.6)),
      popular: false,
    },
    {
      id: 'fj_pack_growth',
      name: 'Growth',
      description: `Publish up to ${PREMIUM_MONTHLY_PUBLISH_LIMIT} jobs / month`,
      monthlyLimit: PREMIUM_MONTHLY_PUBLISH_LIMIT,
      durationDays: 30,
      priceUsd: monthlyUsd,
      popular: true,
    },
    {
      id: 'fj_pack_scale',
      name: 'Scale',
      description: `Publish up to ${PREMIUM_MONTHLY_PUBLISH_LIMIT * 2} jobs / month for 90 days`,
      monthlyLimit: PREMIUM_MONTHLY_PUBLISH_LIMIT * 2,
      durationDays: 90,
      priceUsd: yearlyUsd > monthlyUsd ? Math.round(yearlyUsd / 3) : monthlyUsd * 2.5,
      popular: false,
    },
  ];
  return seed
    .map((p, index) => normalizeFreeJobPack({ ...p, active: true, sortOrder: index }, { index }))
    .filter(Boolean);
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
      const pack = normalizeFreeJobPack(row, { index, existingIds });
      if (!pack) return;
      existingIds.add(pack.id);
      normalized.push(pack);
    });
    packsCache = normalized.length ? sortPacks(normalized) : defaultPacks();
    packsCacheAt = now;
    return packsCache;
  } catch (err) {
    console.warn('[hq-free-job-packs] failed to load packs:', err?.message || err);
    return packsCache || defaultPacks();
  }
}

export const hqFreeJobPacksService = {
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

  async savePacks(input, reqUser) {
    const incoming = Array.isArray(input?.packs) ? input.packs : null;
    if (!incoming) throw new Error('Provide packs: [{ name, monthlyLimit, priceUsd, ... }]');
    if (incoming.length === 0) {
      throw new Error('At least one Free Jobs pack is required');
    }

    const existingIds = new Set();
    const next = [];
    incoming.forEach((row, index) => {
      const pack = normalizeFreeJobPack(row, { index, existingIds });
      if (!pack) {
        throw new Error(
          `Invalid pack at index ${index}: name, monthlyLimit (> 0), and priceUsd (> 0) are required`,
        );
      }
      if (existingIds.has(pack.id)) {
        throw new Error(`Duplicate pack id: ${pack.id}`);
      }
      existingIds.add(pack.id);
      next.push(pack);
    });

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
      { upsert: true },
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
