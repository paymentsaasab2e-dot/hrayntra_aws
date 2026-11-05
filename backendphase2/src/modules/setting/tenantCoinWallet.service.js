import { getSubscriptionPlan, setSubscriptionPlan } from './recruitmentMode.service.js';
import { getAiFeature, listAiFeaturesWithLockState } from './aiCoinCatalog.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { hqAiFeaturesService } from '../hq/hq-ai-features.service.js';
import { getCoinPackAsync, listCoinPacksAsync } from './aiCoinPacks.js';
import { appendTenantBillingTransaction } from '../hq/hq-billing-ledger.service.js';
import { getActiveTenantDbName } from '../../config/prisma.js';
import { getRazorpayConfig } from '../payment/razorpay.config.js';
import { buildUpiPayUri } from '../payment/upi.utils.js';
import {
  createRazorpayOrder,
  getRazorpayPublicConfig,
  verifyRazorpayPaymentSignature,
  assertRazorpayPaymentCaptured,
} from '../payment/razorpay.service.js';

function packAmountPaise(pack) {
  const config = getRazorpayConfig();
  const usd =
    Number.parseFloat(String(pack?.priceUsd ?? pack?.price ?? '').replace(/,/g, '')) || null;
  if (usd == null || !Number.isFinite(usd) || usd <= 0) {
    throw new Error('Coin pack price is not configured');
  }
  return Math.max(100, Math.round(usd * config.usdToInrRate * 100));
}

function tenantKeyFromUser(user) {
  return {
    tenantDbName: String(user?.tenantDbName || user?.orgId || '').trim(),
    tenantEmail: String(user?.email || '').trim().toLowerCase(),
    actorEmail: String(user?.email || '').trim().toLowerCase(),
  };
}

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

  try {
    const keys = tenantKeyFromUser(user);
    await appendTenantBillingTransaction({
      ...keys,
      type: 'COIN_SPEND',
      amount: required,
      balanceAfter: next,
      unit: 'coins',
      featureId,
      description: `Spent ${required} AI coins on ${resolved?.label || resolved?.name || featureId}`,
      reference: `spend_${featureId}_${Date.now()}`,
    });
  } catch {
    /* ledger is best-effort */
  }

  return {
    spent: required,
    coins: next,
    featureId,
    feature: resolved,
    meta: meta || null,
  };
}

export async function createCoinPackPaymentOrder({ packId, userEmail } = {}) {
  const pack = await getCoinPackAsync(packId);
  if (!pack) throw new Error('Unknown coin pack');

  const amountPaise = packAmountPaise(pack);
  const amountInr = (amountPaise / 100).toFixed(2);
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  const description = `AI coin pack: ${pack.name} (${pack.coins} coins)`;
  const publicConfig = getRazorpayPublicConfig();

  if (!publicConfig.enabled) {
    const orderId = `order_clone_coins_${Date.now()}`;
    return {
      mode: 'clone',
      orderId,
      amount: amountPaise,
      amountPaise,
      amountInr,
      currency: publicConfig.currency,
      merchantName: publicConfig.merchantName,
      merchantUpi: publicConfig.merchantUpi,
      packId: pack.id,
      packName: pack.name,
      coins: pack.coins,
      description,
      upiPayLink: buildUpiPayUri({
        merchantUpi: publicConfig.merchantUpi,
        merchantName: publicConfig.merchantName,
        amountInr: Number(amountInr),
        transactionNote: description,
        transactionRef: orderId,
      }),
    };
  }

  const order = await createRazorpayOrder({
    amountPaise,
    receipt: `coins_${Date.now()}`.slice(0, 40),
    notes: {
      type: 'ai_coin_pack',
      packId: pack.id,
      coins: String(pack.coins),
      tenantDbName,
      payerEmail: String(userEmail || '').trim(),
    },
  });

  return {
    mode: 'live',
    orderId: order.id,
    amount: order.amount,
    amountPaise: order.amount,
    amountInr,
    currency: order.currency,
    keyId: publicConfig.keyId,
    merchantName: publicConfig.merchantName,
    merchantUpi: publicConfig.merchantUpi,
    packId: pack.id,
    packName: pack.name,
    coins: pack.coins,
    description,
  };
}

/**
 * Credit pack after Razorpay capture (live) or clone confirmation.
 * Live requires order/payment/signature; clone allows paymentReference only when Razorpay is off.
 */
export async function purchaseCoinPack(
  packId,
  {
    user,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    paymentReference,
  } = {},
) {
  const pack = await getCoinPackAsync(packId);
  if (!pack) throw new Error('Unknown coin pack');

  const publicConfig = getRazorpayPublicConfig();
  let reference = String(paymentReference || '').trim();

  if (publicConfig.enabled) {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new Error('Complete Razorpay payment is required to buy AI coins');
    }
    verifyRazorpayPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
    const expectedAmountPaise = packAmountPaise(pack);
    const tenantDbName = String(getActiveTenantDbName() || '').trim();
    await assertRazorpayPaymentCaptured({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      expectedAmountPaise,
      expectedNotes: {
        type: 'ai_coin_pack',
        packId: pack.id,
        ...(tenantDbName ? { tenantDbName } : {}),
      },
    });
    reference = String(razorpayPaymentId);
  } else if (!reference && !(razorpayOrderId && razorpayPaymentId)) {
    // Legacy demo path only when gateway is not configured.
    reference = `demo_${pack.id}_${Date.now()}`;
  } else {
    reference = reference || String(razorpayPaymentId || razorpayOrderId);
  }

  const result = await addTenantCoins(pack.coins, {
    user,
    packId: pack.id,
    reason: publicConfig.enabled ? 'razorpay_purchase' : 'demo_purchase',
  });

  try {
    const keys = tenantKeyFromUser(user);
    const moneyUsd = Number(pack.priceUsd ?? pack.price ?? 0) || null;
    await appendTenantBillingTransaction({
      ...keys,
      type: 'COIN_PURCHASE',
      amount: pack.coins,
      balanceAfter: result.coins,
      unit: 'coins',
      packId: pack.id,
      productName: pack.name,
      moneyAmount: moneyUsd,
      moneyCurrency: moneyUsd != null ? 'USD' : null,
      description: `Purchased ${pack.name} (${pack.coins} AI coins${
        moneyUsd != null ? ` · $${moneyUsd}` : ''
      })`,
      reference,
    });
  } catch {
    /* ledger is best-effort */
  }

  return {
    demo: !publicConfig.enabled,
    message: publicConfig.enabled
      ? `Payment successful. ${pack.coins} AI coins credited.`
      : `Demo purchase successful. ${pack.coins} AI coins credited.`,
    pack: { ...pack },
    paymentReference: reference,
    ...result,
  };
}

export async function getCoinsOverview() {
  const { coins, planName } = await getTenantCoinBalance();
  let features = [];
  try {
    // Use cached HQ costs (TTL inside hqAiFeaturesService) — bypass was making every shell poll slow.
    features = await hqAiFeaturesService.listFeatures({ bypassCache: false });
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
