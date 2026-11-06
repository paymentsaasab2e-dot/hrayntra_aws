import { getRazorpayConfig } from '../payment/razorpay.config.js';
import {
  createRazorpayPaymentLink,
  getRazorpayPublicConfig,
} from '../payment/razorpay.service.js';
import { hqPackagesService } from './hq-packages.service.js';
import { hqCompaniesService } from './hq-companies.service.js';

function parseUsd(value) {
  const num = Number.parseFloat(String(value || '').replace(/,/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function packageChargeUsd(pkg, billingCycle) {
  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
  if (cycle === 'annual') {
    const monthly = parseUsd(pkg?.yearlyPrice) ?? parseUsd(pkg?.price);
    if (monthly == null) return null;
    return monthly * 12;
  }
  return parseUsd(pkg?.price) ?? parseUsd(pkg?.yearlyPrice);
}

async function resolveChargeFromDraft(draft) {
  const billingCycle =
    String(draft?.billingCycle || draft?.plan?.billingCycle || 'monthly').toLowerCase() === 'annual'
      ? 'annual'
      : 'monthly';
  const planName = String(draft?.planName || draft?.plan?.name || 'Starter').trim() || 'Starter';
  const customUsd = parseUsd(draft?.customPrice || draft?.plan?.price);

  let pkg = null;
  try {
    const packages = await hqPackagesService.listPackages();
    pkg =
      packages.find(
        (p) =>
          String(p.name || '').toLowerCase() === planName.toLowerCase() ||
          String(p.slug || '').toLowerCase() === planName.toLowerCase() ||
          String(p.id || '') === planName,
      ) || null;
  } catch (err) {
    console.warn('[hq-company-payment] package lookup failed:', err?.message || err);
  }

  const amountUsd = customUsd ?? (pkg ? packageChargeUsd(pkg, billingCycle) : null);
  if (amountUsd == null) {
    throw new Error(
      `Could not resolve price for package “${planName}” (${billingCycle}). Set package price in HQ Subscription plans or a custom price on Create user.`,
    );
  }

  const config = getRazorpayConfig();
  const amountPaise = Math.max(100, Math.round(amountUsd * config.usdToInrRate * 100));
  return {
    packageId: pkg?.id || null,
    packageName: pkg?.displayName || pkg?.name || planName,
    billingCycle,
    amountUsd,
    amountPaise,
    amountInr: (amountPaise / 100).toFixed(2),
    currency: config.currency || 'INR',
  };
}

/**
 * Create (or refresh) a Razorpay payment link for the pending Create-user package.
 */
export async function createCompanyProvisionPaymentLink(companyId, reqUser) {
  const company = await hqCompaniesService.getCompanyById(companyId);
  if (!company) throw new Error('Company not found');
  if (company.tenantDbName) {
    throw new Error('Tenant already provisioned — payment link is not needed');
  }
  if (company.provisionStatus !== 'pending_approval') {
    throw new Error('Submit Create user first (pending approval), then generate the payment link');
  }
  if (company.provisionPayment?.status === 'paid') {
    return { company, payment: company.provisionPayment, alreadyPaid: true };
  }

  const raw = await hqCompaniesService.getCompanyDocById(companyId);
  const draft = raw?.provisionDraft;
  if (!draft || typeof draft !== 'object') {
    throw new Error('Create-user draft is missing');
  }

  const charge = await resolveChargeFromDraft(draft);
  const publicConfig = getRazorpayPublicConfig();
  const customerEmail = String(draft.email || company.email || '').trim().toLowerCase();
  const customerName = String(draft.name || company.contact || company.name || '').trim();
  const description = `HRyantra ${charge.packageName} (${charge.billingCycle}) — ${company.name || 'Company'}`;

  let payment;
  if (!publicConfig.enabled) {
    const orderId = `plink_clone_${Date.now()}`;
    payment = {
      status: 'link_sent',
      ...charge,
      paymentLinkId: orderId,
      paymentLinkUrl: `https://razorpay.local/clone/${orderId}`,
      paymentReference: null,
      mode: 'clone',
      linkSentAt: new Date().toISOString(),
      paidAt: null,
      paidByEmail: null,
      note: 'Razorpay keys not set — use Mark as paid after collecting payment.',
    };
  } else {
    const link = await createRazorpayPaymentLink({
      amountPaise: charge.amountPaise,
      description,
      customer: {
        name: customerName,
        email: customerEmail,
      },
      notes: {
        purpose: 'hq_company_provision',
        companyId: String(companyId),
        packageName: charge.packageName,
        billingCycle: charge.billingCycle,
        createdBy: String(reqUser?.email || reqUser?.id || ''),
      },
    });
    payment = {
      status: 'link_sent',
      ...charge,
      paymentLinkId: String(link.id || ''),
      paymentLinkUrl: String(link.short_url || link.url || ''),
      paymentReference: null,
      mode: 'live',
      linkSentAt: new Date().toISOString(),
      paidAt: null,
      paidByEmail: null,
    };
  }

  const result = await hqCompaniesService.setProvisionPayment(companyId, payment, reqUser);
  return { company: result.company, payment: result.company?.provisionPayment, alreadyPaid: false };
}

export async function markCompanyProvisionPaid(companyId, data, reqUser) {
  const company = await hqCompaniesService.getCompanyById(companyId);
  if (!company) throw new Error('Company not found');
  if (company.tenantDbName) throw new Error('Tenant already provisioned');
  if (company.provisionStatus !== 'pending_approval') {
    throw new Error('No pending Create-user request for this company');
  }

  const prev = company.provisionPayment || {};
  const paymentReference =
    String(data?.paymentReference || data?.razorpayPaymentId || '').trim() ||
    prev.paymentReference ||
    `manual_paid_${Date.now()}`;

  let charge = { ...prev };
  if (!prev.amountPaise) {
    const raw = await hqCompaniesService.getCompanyDocById(companyId);
    const draft = raw?.provisionDraft;
    if (!draft) throw new Error('Create-user draft is missing');
    charge = { ...prev, ...(await resolveChargeFromDraft(draft)) };
  }

  const payment = {
    ...charge,
    status: 'paid',
    paymentReference,
    paidAt: new Date().toISOString(),
    paidByEmail: String(reqUser?.email || data?.paidByEmail || '').trim() || null,
    mode: prev.mode || 'clone',
    paymentLinkId: prev.paymentLinkId || null,
    paymentLinkUrl: prev.paymentLinkUrl || null,
    linkSentAt: prev.linkSentAt || new Date().toISOString(),
  };

  const result = await hqCompaniesService.setProvisionPayment(companyId, payment, reqUser);
  return { company: result.company, payment: result.company?.provisionPayment };
}

/** Called from Razorpay webhook when payment_link notes include companyId. */
export async function markCompanyProvisionPaidFromWebhook({ companyId, paymentId, paymentLinkId }) {
  const id = String(companyId || '').trim();
  if (!id) return { ok: false, reason: 'invalid_company' };
  try {
    const company = await hqCompaniesService.getCompanyById(id);
    if (!company) return { ok: false, reason: 'not_found' };
    if (company.provisionStatus !== 'pending_approval') {
      return { ok: false, reason: 'not_pending' };
    }
    if (company.provisionPayment?.status === 'paid') {
      return { ok: true, alreadyPaid: true };
    }
    await markCompanyProvisionPaid(
      id,
      { paymentReference: paymentId || paymentLinkId, razorpayPaymentId: paymentId },
      { email: 'razorpay_webhook' },
    );
    return { ok: true };
  } catch (err) {
    console.warn('[hq-company-payment] webhook mark paid failed:', err?.message || err);
    return { ok: false, reason: err?.message || 'error' };
  }
}
