import { getActiveTenantDbName } from '../../config/prisma.js';
import { getRazorpayConfig } from '../payment/razorpay.config.js';
import { buildUpiPayUri } from '../payment/upi.utils.js';
import {
  createRazorpayOrder,
  getRazorpayPublicConfig,
  verifyRazorpayPaymentSignature,
  assertRazorpayPaymentCaptured,
} from '../payment/razorpay.service.js';
import { getSubscriptionPlan } from './recruitmentMode.service.js';
import { listUpgradeOptions } from './subscriptionUpgrade.service.js';

function parseUsdAmount(value) {
  const num = Number.parseFloat(String(value || '').replace(/,/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function packageChargeUsd(pkg, billingCycle) {
  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
  if (cycle === 'annual') {
    const monthly = parseUsdAmount(pkg?.yearlyPrice) ?? parseUsdAmount(pkg?.price);
    if (monthly == null) return null;
    return monthly * 12;
  }
  return parseUsdAmount(pkg?.price) ?? parseUsdAmount(pkg?.yearlyPrice);
}

export function resolveUpgradeAmountPaise(pkg, billingCycle) {
  const config = getRazorpayConfig();
  const usdAmount = packageChargeUsd(pkg, billingCycle);
  if (usdAmount == null) throw new Error('Could not resolve package price for payment');

  const inrAmount = usdAmount * config.usdToInrRate;
  return Math.max(100, Math.round(inrAmount * 100));
}

export async function createSubscriptionUpgradeOrder({
  packageId,
  billingCycle = 'monthly',
  userEmail,
}) {
  const pkgId = String(packageId || '').trim();
  if (!pkgId) throw new Error('packageId is required');

  const { upgradePackages } = await listUpgradeOptions();
  const targetPkg = upgradePackages.find((p) => p.id === pkgId);
  if (!targetPkg) {
    throw new Error('Selected package is not available for upgrade');
  }

  const currentPlan = await getSubscriptionPlan();
  const amountPaise = resolveUpgradeAmountPaise(targetPkg, billingCycle);
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';

  const publicConfig = getRazorpayPublicConfig();
  const presentationName = targetPkg.displayName || targetPkg.name;
  const description = `Upgrade to ${presentationName} (${cycle})`;
  const amountInr = (amountPaise / 100).toFixed(2);

  if (!publicConfig.enabled) {
    const orderId = `order_clone_${Date.now()}`;
    const upiPayLink = buildUpiPayUri({
      merchantUpi: publicConfig.merchantUpi,
      merchantName: publicConfig.merchantName,
      amountInr: Number(amountInr),
      transactionNote: description,
      transactionRef: orderId,
    });

    return {
      mode: 'clone',
      orderId,
      amount: amountPaise,
      amountPaise,
      amountInr,
      currency: publicConfig.currency,
      merchantName: publicConfig.merchantName,
      merchantUpi: publicConfig.merchantUpi,
      packageName: presentationName,
      billingCycle: cycle,
      packageId: pkgId,
      description,
      upiPayLink,
    };
  }

  const order = await createRazorpayOrder({
    amountPaise,
    receipt: `upg_${Date.now()}`,
    notes: {
      packageId: pkgId,
      billingCycle: cycle,
      tenantDbName,
      upgradedFrom: currentPlan?.name || '',
      payerEmail: String(userEmail || '').trim(),
    },
  });

  const publicConfigLive = getRazorpayPublicConfig();

  return {
    mode: 'live',
    orderId: order.id,
    amount: order.amount,
    amountPaise: order.amount,
    amountInr,
    currency: order.currency,
    keyId: publicConfigLive.keyId,
    merchantName: publicConfigLive.merchantName,
    merchantUpi: publicConfigLive.merchantUpi,
    packageName: presentationName,
    billingCycle: cycle,
    packageId: pkgId,
    description,
  };
}

export async function verifySubscriptionUpgradePayment({
  packageId,
  billingCycle,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  verifyRazorpayPaymentSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  const pkgId = String(packageId || '').trim();
  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
  const { upgradePackages } = await listUpgradeOptions();
  const targetPkg = upgradePackages.find((p) => p.id === pkgId);
  if (!targetPkg) throw new Error('Selected package is not available for upgrade');

  const expectedAmountPaise = resolveUpgradeAmountPaise(targetPkg, cycle);
  const tenantDbName = String(getActiveTenantDbName() || '').trim();

  await assertRazorpayPaymentCaptured({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    expectedAmountPaise,
    expectedNotes: {
      packageId: pkgId,
      billingCycle: cycle,
      ...(tenantDbName ? { tenantDbName } : {}),
    },
  });

  return {
    paymentReference: String(razorpayPaymentId),
    packageId: pkgId,
    billingCycle: cycle,
  };
}

export { getRazorpayPublicConfig };
