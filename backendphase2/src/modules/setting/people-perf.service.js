import { prisma } from '../../config/prisma.js';
import { spendTenantCoins } from './tenantCoinWallet.service.js';
import { hqAiFeaturesService } from '../hq/hq-ai-features.service.js';
import { getAiFeature } from './aiCoinCatalog.js';

const ORG_SCOPE = 'ORG';
const KEY = 'peoplePerfEntitlements';
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export const PEOPLE_PERF_PRODUCTS = {
  crm: {
    product: 'crm',
    featureId: 'intel.people_perf_crm',
    label: 'CRM people intel',
  },
  recruitment: {
    product: 'recruitment',
    featureId: 'intel.people_perf_recruitment',
    label: 'Recruitment people intel',
  },
};

function emptySlot() {
  return { active: false, expiresAt: null, purchasedAt: null, coinsSpent: 0, featureId: null };
}

function normalizeStore(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    crm: { ...emptySlot(), ...(src.crm || {}) },
    recruitment: { ...emptySlot(), ...(src.recruitment || {}) },
  };
}

function isActive(slot) {
  if (!slot?.expiresAt) return false;
  const ts = Date.parse(slot.expiresAt);
  return Number.isFinite(ts) && ts > Date.now();
}

async function loadStore() {
  const row = await prisma.setting.findFirst({
    where: { key: KEY, scope: ORG_SCOPE },
    orderBy: { updatedAt: 'desc' },
  });
  return normalizeStore(row?.value);
}

async function saveStore(store) {
  const existing = await prisma.setting.findFirst({
    where: { key: KEY, scope: ORG_SCOPE },
    orderBy: { updatedAt: 'desc' },
  });
  if (existing) {
    await prisma.setting.update({ where: { id: existing.id }, data: { value: store } });
    return;
  }
  await prisma.setting.create({ data: { key: KEY, scope: ORG_SCOPE, value: store } });
}

async function featureCost(featureId) {
  try {
    return await hqAiFeaturesService.getCost(featureId);
  } catch {
    return Number(getAiFeature(featureId)?.coins || 0);
  }
}

function publicSlot(slot, product, coinsCost) {
  const active = isActive(slot);
  return {
    product,
    featureId: PEOPLE_PERF_PRODUCTS[product].featureId,
    label: PEOPLE_PERF_PRODUCTS[product].label,
    active,
    expiresAt: active ? slot.expiresAt : null,
    purchasedAt: slot.purchasedAt || null,
    coinsCost,
    daysLeft: active ? Math.max(0, Math.ceil((Date.parse(slot.expiresAt) - Date.now()) / 86400000)) : 0,
    hqNote: 'HQ can change coin cost via AI feature catalog. Payment gateway can replace coin spend later.',
  };
}

export async function getPeoplePerfStatus() {
  const store = await loadStore();
  const [crmCost, recCost] = await Promise.all([
    featureCost(PEOPLE_PERF_PRODUCTS.crm.featureId),
    featureCost(PEOPLE_PERF_PRODUCTS.recruitment.featureId),
  ]);
  return {
    crm: publicSlot(store.crm, 'crm', crmCost),
    recruitment: publicSlot(store.recruitment, 'recruitment', recCost),
  };
}

export async function unlockPeoplePerf(product, { user } = {}) {
  const key = product === 'recruitment' ? 'recruitment' : product === 'crm' ? 'crm' : null;
  if (!key) {
    const err = new Error('product must be crm or recruitment');
    err.code = 'VALIDATION';
    throw err;
  }

  const store = await loadStore();
  if (isActive(store[key])) {
    const status = await getPeoplePerfStatus();
    return { alreadyActive: true, spent: 0, ...status, unlocked: status[key] };
  }

  const featureId = PEOPLE_PERF_PRODUCTS[key].featureId;
  const spend = await spendTenantCoins(featureId, {
    user,
    meta: { product: key, period: 'month' },
  });

  const now = new Date();
  store[key] = {
    active: true,
    featureId,
    purchasedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + MONTH_MS).toISOString(),
    coinsSpent: spend.spent,
  };
  await saveStore(store);

  const status = await getPeoplePerfStatus();
  return {
    alreadyActive: false,
    spent: spend.spent,
    coins: spend.coins,
    ...status,
    unlocked: status[key],
  };
}
