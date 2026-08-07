/**
 * Loads HQ-managed Phase 1 token packs / spend costs / free earn rewards via
 * backendphase2 internal API. Falls back to local tokenCatalog.js defaults
 * when Phase 2 is unreachable.
 */
const {
  PURCHASE_PACKS,
  SERVICE_CATALOG,
  SERVICE_COSTS,
  EARN_REWARDS,
  EARN_TASK_CATALOG,
  getServiceCost: getDefaultServiceCost,
  getPurchasePack: getDefaultPurchasePack,
  getEarnReward: getDefaultEarnReward,
  getBaseEarnKey,
} = require('../constants/tokenCatalog');
const {
  buildPhase2InternalUrl,
  resolvePhase2PortalSyncSecret,
} = require('../utils/phase2InternalApi.util');

const CACHE_TTL_MS = 2_000;
let cache = null;
let cacheAt = 0;

function defaultPacks() {
  return PURCHASE_PACKS.map((p) => ({ ...p, active: true }));
}

function defaultCosts() {
  return { ...SERVICE_COSTS };
}

function defaultEarnRewards() {
  return { ...EARN_REWARDS };
}

async function fetchHqCatalog() {
  const url = buildPhase2InternalUrl('phase1-token-catalog');
  const secret = resolvePhase2PortalSyncSecret();
  const headers = { Accept: 'application/json' };
  if (secret) headers['x-phase2-portal-sync-secret'] = secret;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || `Phase 2 catalog HTTP ${response.status}`);
  }
  return json.data || {};
}

async function loadConfig({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && cache && now - cacheAt < CACHE_TTL_MS) return cache;

  try {
    const data = await fetchHqCatalog();
    const packs = Array.isArray(data.packs) && data.packs.length
      ? data.packs
          .filter((p) => p && p.active !== false && Number(p.tokens) > 0)
          .map((p) => ({
            id: String(p.id),
            name: String(p.name || p.id),
            priceLabel: String(p.priceLabel || `$${p.priceAmount || 0}`),
            priceAmount: Math.max(0, Number(p.priceAmount) || 0),
            currency: String(p.currency || 'USD'),
            tokens: Math.max(0, Math.floor(Number(p.tokens) || 0)),
            popular: Boolean(p.popular),
            description: String(p.description || ''),
            active: p.active !== false,
          }))
      : defaultPacks();

    const serviceCosts = { ...defaultCosts() };
    if (data.serviceCosts && typeof data.serviceCosts === 'object') {
      for (const [key, value] of Object.entries(data.serviceCosts)) {
        serviceCosts[key] = Math.max(0, Math.floor(Number(value) || 0));
      }
    }

    const earnRewards = { ...defaultEarnRewards() };
    if (data.earnRewards && typeof data.earnRewards === 'object') {
      for (const [key, value] of Object.entries(data.earnRewards)) {
        earnRewards[key] = Math.max(0, Math.floor(Number(value) || 0));
      }
    } else if (Array.isArray(data.earns)) {
      for (const row of data.earns) {
        const id = String(row?.id || '').trim();
        if (!id) continue;
        earnRewards[id] = Math.max(0, Math.floor(Number(row.tokens) || 0));
      }
    }

    cache = { packs, serviceCosts, earnRewards };
    cacheAt = now;
    return cache;
  } catch (err) {
    console.warn('[hqPhase1TokenConfig] Phase 2 catalog unavailable, using defaults:', err?.message || err);
    return cache || { packs: defaultPacks(), serviceCosts: defaultCosts(), earnRewards: defaultEarnRewards() };
  }
}

async function listPurchasePacks() {
  // Always refresh so HQ pack edits show on Phase 1 quickly
  const config = await loadConfig({ bypassCache: true });
  return config.packs.map((p) => ({ ...p }));
}

async function getPurchasePackAsync(packageId) {
  const id = String(packageId || '').trim();
  const packs = await listPurchasePacks();
  return packs.find((p) => p.id === id) || getDefaultPurchasePack(id);
}

async function getServiceCostAsync(serviceId) {
  const id = String(serviceId || '').trim();
  const config = await loadConfig({ bypassCache: true });
  if (config.serviceCosts[id] != null) return config.serviceCosts[id];
  return getDefaultServiceCost(id);
}

async function getMergedServiceCatalog() {
  const config = await loadConfig();
  return SERVICE_CATALOG.map((s) => ({
    ...s,
    cost:
      config.serviceCosts[s.id] != null
        ? Math.max(0, Number(config.serviceCosts[s.id]) || 0)
        : s.cost,
  }));
}

async function getEarnRewardAsync(earnKey) {
  const base = getBaseEarnKey(earnKey);
  const config = await loadConfig({ bypassCache: true });
  if (config.earnRewards?.[earnKey] != null) {
    return Math.max(0, Math.floor(Number(config.earnRewards[earnKey]) || 0));
  }
  if (config.earnRewards?.[base] != null) {
    return Math.max(0, Math.floor(Number(config.earnRewards[base]) || 0));
  }
  return getDefaultEarnReward(earnKey);
}

/**
 * Cycle 1 = full HQ/base reward; cycle 2 = 40%; cycle 3+ = 20% (minimum 1).
 */
async function getRepeatEarnAmountAsync(earnKey, cycleIndex = 1) {
  const baseKey = getBaseEarnKey(earnKey);
  const base = await getEarnRewardAsync(baseKey);
  if (base == null || base <= 0) return null;
  const cycle = Math.max(1, Number(cycleIndex) || 1);
  if (cycle <= 1) return base;
  if (cycle === 2) return Math.max(1, Math.floor(base * 0.4));
  return Math.max(1, Math.floor(base * 0.2));
}

async function getMergedEarnTasks() {
  const config = await loadConfig({ bypassCache: true });
  return EARN_TASK_CATALOG.map((task) => {
    const tokens =
      config.earnRewards?.[task.id] != null
        ? Math.max(0, Math.floor(Number(config.earnRewards[task.id]) || 0))
        : task.tokens;
    return { ...task, tokens };
  }).sort((a, b) => (a.order || 0) - (b.order || 0));
}

async function getWelcomeAmountAsync() {
  const amount = await getEarnRewardAsync('welcome');
  return amount != null && amount > 0 ? amount : EARN_REWARDS.welcome;
}

module.exports = {
  listPurchasePacks,
  getPurchasePackAsync,
  getServiceCostAsync,
  getMergedServiceCatalog,
  getEarnRewardAsync,
  getRepeatEarnAmountAsync,
  getMergedEarnTasks,
  getWelcomeAmountAsync,
  loadConfig,
};
