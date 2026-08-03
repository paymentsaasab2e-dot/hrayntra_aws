import { getSubscriptionPlan, setSubscriptionPlan } from './recruitmentMode.service.js';
import { getAiFeature, listAiFeaturesWithLockState } from './aiCoinCatalog.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { hqAiFeaturesService } from '../hq/hq-ai-features.service.js';
import { getCoinPackAsync, listCoinPacksAsync } from './aiCoinPacks.js';

function insufficientError(balance, required, featureId) {
  const err = new Error(
    `Insufficient AI coins. Need ${required}, have ${balance}. Purchase more coins to continue.`
  );
  err.status = 402;
  err.code = 'INSUFFICIENT_COINS';
  err.meta = {
    balance,
    required,
    feature: featureId,
    shortfall: Math.max(0, required - balance),
    purchaseAvailable: true,
  };
  return err;
}

export async function getTenantCoinBalance() {
  const plan = await getSubscriptionPlan();
  return {
    coins: Math.max(0, Number(plan?.coins) || 0),
    planName: plan?.name || null,
    plan,
  };
}

async function syncHqCoins(next, user) {
  const tenantDbName = user?.tenantDbName || user?.orgId || null;
  const email = user?.email || null;
  try {
    if (email) await headquartersAuthService.setCoinsForEmail(email, next);
  } catch {
    /* best-effort */
  }
  try {
    if (tenantDbName) await headquartersAuthService.setCoinsForTenantDb(tenantDbName, next);
  } catch {
    /* best-effort */
  }
}

/**
 * Set absolute coin balance on the tenant org plan (and optionally mirror to HQ registry).
 */
export async function setTenantCoinBalance(coins, { email, tenantDbName, reason } = {}) {
  const next = Math.max(0, Math.floor(Number(coins) || 0));
  const current = await getSubscriptionPlan();
  if (!current?.name) {
    throw new Error('Tenant has no subscription plan — assign a plan before setting coins');
  }
  const updated = await setSubscriptionPlan({
    ...current,
    coins: next,
  });

  await syncHqCoins(next, { email, tenantDbName });

  return {
    coins: next,
    previous: Math.max(0, Number(current.coins) || 0),
    planName: updated.name,
    reason: reason || null,
  };
}

/** Add coins to the tenant balance (demo purchase / HQ top-up). */
export async function addTenantCoins(amount, { user, reason, packId } = {}) {
  const add = Math.max(0, Math.floor(Number(amount) || 0));
  if (add <= 0) throw new Error('Amount must be greater than zero');

  let { coins, plan } = await getTenantCoinBalance();
  if (!plan?.name) {
    plan = { name: 'Custom', billingCycle: 'monthly', coins };
  }

  const next = coins + add;
  await setSubscriptionPlan({
    ...plan,
    coins: next,
  });
  await syncHqCoins(next, user);

  return {
    coins: next,
    previous: coins,
    added: add,
    packId: packId || null,
    reason: reason || 'purchase',
    planName: plan.name,
  };
}

export async function spendTenantCoins(featureId, { user, meta } = {}) {
  const feature = await hqAiFeaturesService.getFeature(featureId);
  if (!feature && !getAiFeature(featureId)) {
    throw new Error(`Unknown AI feature: ${featureId}`);
  }
  const resolved = feature || getAiFeature(featureId);
  const required = await hqAiFeaturesService.getCost(featureId);
  const { coins, plan } = await getTenantCoinBalance();

  if (required <= 0) {
    return { spent: 0, coins, featureId, feature: resolved };
  }

  if (coins < required) {
    throw insufficientError(coins, required, featureId);
  }

  if (!plan?.name) {
    throw new Error('Tenant has no subscription plan');
  }

  const next = coins - required;
  await setSubscriptionPlan({
    ...plan,
    coins: next,
  });
  await syncHqCoins(next, user);

  return {
    spent: required,
    coins: next,
    featureId,
    feature: resolved,
    meta: meta || null,
  };
}

/** Demo purchase — credits pack coins immediately (no real payment). */
export async function purchaseCoinPack(packId, { user } = {}) {
  const pack = await getCoinPackAsync(packId);
  if (!pack) throw new Error('Unknown coin pack');

  const result = await addTenantCoins(pack.coins, {
    user,
    packId: pack.id,
    reason: 'demo_purchase',
  });

  return {
    demo: true,
    message: `Demo purchase successful. ${pack.coins} AI coins credited.`,
    pack: { ...pack },
    ...result,
  };
}

export async function getCoinsOverview() {
  const { coins, planName } = await getTenantCoinBalance();
  let features = [];
  try {
    // Fresh HQ costs so Phase 2 badges match the latest Save coin costs.
    features = await hqAiFeaturesService.listFeatures({ bypassCache: true });
  } catch (err) {
    console.warn('[coins] failed to load HQ AI feature costs:', err?.message || err);
    features = listAiFeaturesWithLockState(coins);
  }
  const packs = await listCoinPacksAsync();
  return {
    coins,
    planName,
    features: listAiFeaturesWithLockState(coins, features),
    catalog: features,
    packs,
  };
}

export { listAiFeaturesWithLockState, getAiFeature, listCoinPacksAsync as listCoinPacks, getCoinPackAsync as getCoinPack };
