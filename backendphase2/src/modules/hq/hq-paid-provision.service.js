import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { runWithTenantContext } from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { authService } from '../auth/auth.service.js';
import { setSubscriptionPlan } from '../setting/recruitmentMode.service.js';
import { sendEmployerPurchaseCredentialsEmail } from '../../utils/emailService.js';
import { generateTempPassword } from '../../utils/credentialGenerator.js';
import { resolvePublicFrontendUrl } from '../../config/env.js';
import { hqPackagesService } from './hq-packages.service.js';
import { hqLeadsService } from './hq-leads.service.js';
import { hqDemosService } from './hq-demos.service.js';
import { todayPlanStartDate, toAssignablePlan, resolvePackageSlug } from './hq-packages.config.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeOrganizationType(value) {
  return String(value || '').trim().toLowerCase() === 'standalone' ? 'standalone' : 'agency';
}

function slugLoginPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 14);
}

function buildEmployerLoginId(email, fullName) {
  const local = slugLoginPart(email.split('@')[0]);
  const namePart = slugLoginPart(fullName.split(/\s+/)[0]);
  const base = local || namePart || 'employer';
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${base}_${suffix}`;
}

export function parseEmployerPurchaseMeta(outcome, requestKind) {
  if (String(requestKind || '').toLowerCase() !== 'purchase') return null;
  const match = String(outcome || '').match(/\[package:([^;\]]+);cycle:([^\]]+)\]/i);
  if (!match) return null;
  return {
    packageSlug: resolvePackageSlug(match[1], match[1]),
    billingCycle: String(match[2] || 'monthly').toLowerCase() === 'annual' ? 'annual' : 'monthly',
  };
}

async function resolvePaidPlan(packageSlug, billingCycle) {
  const packages = await hqPackagesService.listPackages();
  const key = resolvePackageSlug(packageSlug, packageSlug);
  const found =
    packages.find((p) => p.slug === key) ||
    packages.find((p) => String(p.name || '').toLowerCase() === key) ||
    packages.find((p) => String(p.displayName || '').toLowerCase().includes(key)) ||
    null;
  if (!found) throw new Error(`Package "${packageSlug}" is not configured`);
  return toAssignablePlan(found, billingCycle, todayPlanStartDate());
}

async function markDemoRequestProvisioned(requestId, patch) {
  if (!requestId || !ObjectId.isValid(requestId)) return;
  const collection = await hqDemosService.getRawCollection();
  await collection.updateOne(
    { _id: new ObjectId(requestId) },
    { $set: { ...patch, updatedAt: new Date() } },
  );
}

function buildLoginUrl(tenantDbName) {
  const base = resolvePublicFrontendUrl();
  const tenant = String(tenantDbName || '').trim();
  if (!tenant) return `${base}/login`;
  return `${base}/login?tenantDbName=${encodeURIComponent(tenant)}`;
}

async function trySendPurchaseCredentialsEmail({
  email,
  loginId,
  password,
  tenantDbName,
  packageName,
  organizationName,
}) {
  try {
    await sendEmployerPurchaseCredentialsEmail({
      email,
      loginId,
      tempPassword: password,
      tenantDbName,
      packageName,
      organizationName,
    });
    return { credentialEmailSent: true, credentialEmailError: null };
  } catch (emailErr) {
    console.warn('[hq-paid] credential email failed:', emailErr?.message || emailErr);
    return {
      credentialEmailSent: false,
      credentialEmailError: emailErr?.message || 'Failed to send credentials email',
    };
  }
}

async function resolveExistingWorkspace(email) {
  const normalizedEmail = normalizeEmail(email);
  const existingTenants = await headquartersAuthService.listTenants();
  let existing =
    existingTenants.find((t) => normalizeEmail(t.email) === normalizedEmail) || null;

  if (!existing) {
    existing = await headquartersAuthService.findWorkspaceUserByEmail(normalizedEmail);
  }

  if (existing && !existing.tenantDbName) {
    try {
      await headquartersAuthService.ensureTenantProvisioning(normalizedEmail);
      existing = await headquartersAuthService.findWorkspaceUserByEmail(normalizedEmail);
    } catch (err) {
      console.warn('[hq-paid] ensureTenantProvisioning failed:', err?.message || err);
    }
  }

  return existing;
}

async function applyPaidSubscriptionPlan(email, tenantDbName, subscriptionPlan) {
  try {
    await headquartersAuthService.setSubscriptionPlanForEmail(email, subscriptionPlan);
  } catch (err) {
    console.warn('[hq-paid] HQ subscription plan update failed:', err?.message || err);
  }

  if (tenantDbName && subscriptionPlan) {
    try {
      await runWithTenantContext(tenantDbName, () => setSubscriptionPlan(subscriptionPlan));
    } catch (err) {
      console.warn('[hq-paid] tenant subscription plan update failed:', err?.message || err);
    }
  }
}

async function resendCredentialsForExistingTenant({
  existing,
  email,
  organizationName,
  packageName,
}) {
  const password = generateTempPassword();
  const loginId = existing.loginId || email;
  const tenantDbName = existing.tenantDbName;

  await headquartersAuthService.updateWorkspacePasswordForEmail(email, password);
  const hqUser = { ...existing, password, loginId, tenantDbName };
  await authService.updateHeadquartersAdminCredentials(hqUser, password);

  const { credentialEmailSent, credentialEmailError } = await trySendPurchaseCredentialsEmail({
    email,
    loginId,
    password,
    tenantDbName,
    packageName,
    organizationName,
  });

  return {
    loginId,
    password,
    credentialEmailSent,
    credentialEmailError,
  };
}

export const hqPaidProvisionService = {
  async provisionEmployerPaidRequest(demo) {
    const requestId = String(demo?.requestId || '').trim();
    const name = String(demo?.fullName || '').trim();
    const email = normalizeEmail(demo?.email);
    const organizationName = String(demo?.organizationName || '').trim();
    const paymentReference = String(demo?.paymentReference || '').trim();
    const purchaseMeta =
      demo?.packageSlug && demo?.billingCycle
        ? {
            packageSlug: resolvePackageSlug(demo.packageSlug, demo.packageSlug),
            billingCycle: demo.billingCycle === 'annual' ? 'annual' : 'monthly',
          }
        : parseEmployerPurchaseMeta(demo?.outcome, demo?.requestKind || 'purchase');

    if (!name || !email || !organizationName) {
      throw new Error('Purchase request is missing name, email, or organization');
    }
    if (!paymentReference) {
      throw new Error('Payment reference is required');
    }
    if (!purchaseMeta?.packageSlug) {
      throw new Error('Selected package was not found on this request');
    }

    const subscriptionPlan = await resolvePaidPlan(purchaseMeta.packageSlug, purchaseMeta.billingCycle);

    const existing = await resolveExistingWorkspace(email);
    if (existing?.tenantDbName) {
      await applyPaidSubscriptionPlan(email, existing.tenantDbName, subscriptionPlan);
      const packageName = subscriptionPlan?.name || purchaseMeta.packageSlug;
      const resent = await resendCredentialsForExistingTenant({
        existing,
        email,
        organizationName,
        packageName,
      });
      const loginUrl = buildLoginUrl(existing.tenantDbName);

      await markDemoRequestProvisioned(requestId, {
        requestKind: 'purchase',
        trialProvisioned: true,
        trialTenantDbName: existing.tenantDbName,
        trialLoginId: resent.loginId,
        trialStartsAt: subscriptionPlan?.planStartDate || existing.subscriptionPlan?.planStartDate || null,
        trialEndsAt: subscriptionPlan?.planEndDate || existing.subscriptionPlan?.planEndDate || null,
        trialLoginUrl: loginUrl,
      });

      return {
        alreadyProvisioned: true,
        tenantDbName: existing.tenantDbName,
        loginId: resent.loginId,
        loginUrl,
        subscriptionPlan: existing.subscriptionPlan || subscriptionPlan,
        credentialEmailSent: resent.credentialEmailSent,
        credentialEmailError: resent.credentialEmailError,
        devPassword: process.env.NODE_ENV === 'development' ? resent.password : undefined,
      };
    }

    const paidPlan = {
      ...subscriptionPlan,
      lastPaymentReference: paymentReference,
      purchasedAt: new Date().toISOString(),
      employerDemoRequestId: requestId || null,
    };

    const loginId = buildEmployerLoginId(email, name);
    const password = generateTempPassword();
    const organizationType = normalizeOrganizationType(demo?.organizationType);

    let hqUser;
    try {
      hqUser = await headquartersAuthService.registerWorkspaceUserAndProvisionTenant({
        name,
        email,
        password,
        loginId,
        organizationType,
        organizationName,
        signupSource: 'landing_purchase',
        subscriptionPlan: paidPlan,
      });
    } catch (registerErr) {
      const registerMessage = String(registerErr?.message || registerErr || '');
      const existingAfterConflict = await resolveExistingWorkspace(email);
      if (
        existingAfterConflict?.tenantDbName &&
        (registerMessage.includes('already exists') || registerMessage.includes('already in use'))
      ) {
        await applyPaidSubscriptionPlan(email, existingAfterConflict.tenantDbName, subscriptionPlan);
        const resent = await resendCredentialsForExistingTenant({
          existing: existingAfterConflict,
          email,
          organizationName,
          packageName: paidPlan.name,
        });
        const loginUrl = buildLoginUrl(existingAfterConflict.tenantDbName);
        await markDemoRequestProvisioned(requestId, {
          requestKind: 'purchase',
          trialProvisioned: true,
          trialTenantDbName: existingAfterConflict.tenantDbName,
          trialLoginId: resent.loginId,
          trialStartsAt: paidPlan?.planStartDate || null,
          trialEndsAt: paidPlan?.planEndDate || null,
          trialLoginUrl: loginUrl,
        });
        return {
          alreadyProvisioned: true,
          tenantDbName: existingAfterConflict.tenantDbName,
          loginId: resent.loginId,
          loginUrl,
          subscriptionPlan: paidPlan,
          credentialEmailSent: resent.credentialEmailSent,
          credentialEmailError: resent.credentialEmailError,
          devPassword: process.env.NODE_ENV === 'development' ? resent.password : undefined,
        };
      }
      throw registerErr;
    }

    const localUser = await authService.provisionHeadquartersMappedTenant(hqUser);
    await authService.finalizeHeadquartersTenantWorkspace(hqUser, localUser);

    if (paidPlan) {
      try {
        await runWithTenantContext(hqUser.tenantDbName, () => setSubscriptionPlan(paidPlan));
      } catch (err) {
        console.warn('[hq-paid] failed to seed subscription plan:', err?.message || err);
      }
    }

    const loginUrl = buildLoginUrl(hqUser.tenantDbName);
    const { credentialEmailSent, credentialEmailError } = await trySendPurchaseCredentialsEmail({
      email,
      loginId,
      password,
      tenantDbName: hqUser.tenantDbName,
      packageName: paidPlan.name,
      organizationName,
    });

    try {
      await hqLeadsService.createLeadFromEmployerDemoRequest({
        ...demo,
        outcome: demo?.outcome || `Paid signup — ${paidPlan.name} (${purchaseMeta.billingCycle})`,
      });
    } catch (leadErr) {
      console.warn('[hq-paid] HQ lead sync failed:', leadErr?.message || leadErr);
    }

    await markDemoRequestProvisioned(requestId, {
      requestKind: 'purchase',
      trialProvisioned: true,
      trialTenantDbName: hqUser.tenantDbName,
      trialLoginId: loginId,
      trialStartsAt: paidPlan?.planStartDate || null,
      trialEndsAt: paidPlan?.planEndDate || null,
      trialLoginUrl: loginUrl,
    });

    return {
      alreadyProvisioned: false,
      tenantDbName: hqUser.tenantDbName,
      loginId,
      loginUrl,
      subscriptionPlan: paidPlan,
      credentialEmailSent,
      credentialEmailError,
      devPassword: process.env.NODE_ENV === 'development' ? password : undefined,
    };
  },
};
