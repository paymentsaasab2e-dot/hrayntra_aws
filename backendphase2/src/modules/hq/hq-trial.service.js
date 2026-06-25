import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { runWithTenantContext } from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { authService } from '../auth/auth.service.js';
import { setSubscriptionPlan } from '../setting/recruitmentMode.service.js';
import { sendCredentialInvite } from '../../utils/emailService.js';
import { generateTempPassword } from '../../utils/credentialGenerator.js';
import { resolvePublicFrontendUrl } from '../../config/env.js';
import { hqPackagesService } from './hq-packages.service.js';
import { hqLeadsService } from './hq-leads.service.js';
import { hqDemosService } from './hq-demos.service.js';
import { todayPlanStartDate, toTrialAssignablePlan } from './hq-packages.config.js';

const EMPLOYER_DEMO_COLLECTION = 'employer_demo_requests';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function slugLoginPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 14);
}

function buildTrialLoginId(email, fullName) {
  const local = slugLoginPart(email.split('@')[0]);
  const namePart = slugLoginPart(fullName.split(/\s+/)[0]);
  const base = local || namePart || 'employer';
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${base}_${suffix}@trial`;
}

async function resolveStarterTrialPlan() {
  const packages = await hqPackagesService.listPackages();
  const starter =
    packages.find((p) => p.slug === 'starter') ||
    packages.find((p) => String(p.name || '').toLowerCase() === 'starter') ||
    packages[0];
  if (!starter) throw new Error('Starter package is not configured');
  return toTrialAssignablePlan(starter, todayPlanStartDate());
}

async function markDemoRequestProvisioned(requestId, patch) {
  if (!requestId || !ObjectId.isValid(requestId)) return;
  const collection = await hqDemosService.getRawCollection();
  await collection.updateOne(
    { _id: new ObjectId(requestId) },
    {
      $set: {
        ...patch,
        updatedAt: new Date(),
      },
    }
  );
}

export const hqTrialService = {
  async provisionEmployerTrialRequest(demo) {
    const requestId = String(demo?.requestId || '').trim();
    const name = String(demo?.fullName || '').trim();
    const email = normalizeEmail(demo?.email);
    const organizationName = String(demo?.organizationName || '').trim();

    if (!name || !email || !organizationName) {
      throw new Error('Trial request is missing name, email, or organization');
    }

    const existingTenants = await headquartersAuthService.listTenants();
    const existing = existingTenants.find((t) => normalizeEmail(t.email) === email);
    if (existing?.tenantDbName) {
      const loginUrl = `${resolvePublicFrontendUrl()}/login`;
      await markDemoRequestProvisioned(requestId, {
        requestKind: 'trial',
        trialProvisioned: true,
        trialTenantDbName: existing.tenantDbName,
        trialLoginId: existing.loginId || email,
        trialStartsAt: existing.subscriptionPlan?.planStartDate || null,
        trialEndsAt: existing.subscriptionPlan?.planEndDate || null,
        trialLoginUrl: loginUrl,
      });
      return {
        alreadyProvisioned: true,
        tenantDbName: existing.tenantDbName,
        loginId: existing.loginId || email,
        loginUrl,
        trialEndsAt: existing.subscriptionPlan?.planEndDate || null,
        trialStartsAt: existing.subscriptionPlan?.planStartDate || null,
        subscriptionPlan: existing.subscriptionPlan,
        credentialEmailSent: false,
      };
    }

    const subscriptionPlan = await resolveStarterTrialPlan();
    const loginId = buildTrialLoginId(email, name);
    const password = generateTempPassword();
    const organizationType = 'standalone';

    const hqUser = await headquartersAuthService.registerWorkspaceUserAndProvisionTenant({
      name,
      email,
      password,
      loginId,
      organizationType,
      subscriptionPlan: {
        ...subscriptionPlan,
        employerDemoRequestId: requestId || null,
      },
    });

    const localUser = await authService.provisionHeadquartersMappedTenant(hqUser);
    await authService.finalizeHeadquartersTenantWorkspace(hqUser, localUser);

    if (subscriptionPlan) {
      try {
        await runWithTenantContext(hqUser.tenantDbName, () => setSubscriptionPlan(subscriptionPlan));
      } catch (err) {
        console.warn('[hq-trial] failed to seed subscription plan:', err?.message || err);
      }
    }

    const loginUrl = `${resolvePublicFrontendUrl()}/login`;
    let credentialEmailSent = false;
    let credentialEmailError = null;

    try {
      await sendCredentialInvite({
        email,
        loginId,
        tempPassword: password,
        roleName: 'Trial Workspace Admin',
        inviteToken: password,
        tenantDbName: hqUser.tenantDbName,
      });
      credentialEmailSent = true;
    } catch (emailErr) {
      credentialEmailError = emailErr?.message || String(emailErr);
      console.warn('[hq-trial] credential email failed:', credentialEmailError);
    }

    try {
      await hqLeadsService.createLeadFromEmployerDemoRequest({
        ...demo,
        outcome: demo?.outcome || `5-day free trial — auto-provisioned`,
      });
    } catch (leadErr) {
      console.warn('[hq-trial] HQ lead sync failed:', leadErr?.message || leadErr);
    }

    await markDemoRequestProvisioned(requestId, {
      requestKind: 'trial',
      trialProvisioned: true,
      trialTenantDbName: hqUser.tenantDbName,
      trialLoginId: loginId,
      trialStartsAt: subscriptionPlan?.planStartDate || null,
      trialEndsAt: subscriptionPlan?.planEndDate || null,
      trialLoginUrl: loginUrl,
    });

    return {
      alreadyProvisioned: false,
      tenantDbName: hqUser.tenantDbName,
      loginId,
      loginUrl,
      trialEndsAt: subscriptionPlan?.planEndDate || null,
      trialStartsAt: subscriptionPlan?.planStartDate || null,
      subscriptionPlan,
      credentialEmailSent,
      credentialEmailError,
      devPassword: process.env.NODE_ENV === 'development' ? password : undefined,
    };
  },
};
