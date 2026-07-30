/**
 * Loads HQ-managed Phase 1 token packs / spend costs via backendphase2 internal API.
 * Falls back to local tokenCatalog.js defaults when Phase 2 is unreachable.
 */
const {
  PURCHASE_PACKS,
  SERVICE_CATALOG,
  SERVICE_COSTS,
  getServiceCost: getDefaultServiceCost,
  getPurchasePack: getDefaultPurchasePack,
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

    cache = { packs, serviceCosts };
    cacheAt = now;
    return cache;
  } catch (err) {
    console.warn('[hqPhase1TokenConfig] Phase 2 catalog unavailable, using defaults:', err?.message || err);
    return cache || { packs: defaultPacks(), serviceCosts: defaultCosts() };
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

module.exports = {
  listPurchasePacks,
  getPurchasePackAsync,
  getServiceCostAsync,
  getMergedServiceCatalog,
  loadConfig,
};
