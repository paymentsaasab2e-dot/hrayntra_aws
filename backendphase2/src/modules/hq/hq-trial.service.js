import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { prisma, runWithTenantContext } from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { authService } from '../auth/auth.service.js';
import { setSubscriptionPlan } from '../setting/recruitmentMode.service.js';
import { sendCredentialInvite } from '../../utils/emailService.js';
import { generateTempPassword } from '../../utils/credentialGenerator.js';
import { resolvePublicFrontendUrl } from '../../config/env.js';
import { hqPackagesService } from './hq-packages.service.js';
import { hqLeadsService } from './hq-leads.service.js';
import { hqDemosService } from './hq-demos.service.js';
import {
  TRIAL_PACKAGE_DAYS,
  todayPlanStartDate,
  toTrialAssignablePlan,
} from './hq-packages.config.js';

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

function buildTrialLoginId(email, fullName) {
  const local = slugLoginPart(email.split('@')[0]);
  const namePart = slugLoginPart(fullName.split(/\s+/)[0]);
  const base = local || namePart || 'employer';
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${base}_${suffix}@trial`;
}

function resolveTryFreeLoginUrl() {
  const keys = ['MARKETING_SITE_URL', 'JOB_PORTAL_FRONTEND_URL', 'LANDING_SITE_URL', 'PUBLIC_MARKETING_URL'];
  for (const key of keys) {
    const v = process.env[key];
    if (v != null && String(v).trim()) {
      return `${String(v).trim().replace(/\/+$/, '')}/en/employers/try-free`;
    }
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://hryantra.com/en/employers/try-free';
  }
  return 'http://localhost:3000/en/employers/try-free';
}

function normalizeTrialDays(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return TRIAL_PACKAGE_DAYS;
  return Math.max(1, Math.min(365, Math.round(n)));
}

async function resolveStarterTrialPlan(trialDays) {
  const packages = await hqPackagesService.listPackages();
  const starter =
    packages.find((p) => p.slug === 'starter') ||
    packages.find((p) => String(p.name || '').toLowerCase() === 'starter') ||
    packages[0];
  if (!starter) throw new Error('Starter package is not configured');
  return toTrialAssignablePlan(starter, todayPlanStartDate(), trialDays);
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
    },
  );
}

async function loadDemoDoc(demoId) {
  if (!demoId || !ObjectId.isValid(demoId)) {
    const err = new Error('Invalid demo request id');
    err.statusCode = 400;
    throw err;
  }
  const collection = await hqDemosService.getRawCollection();
  const doc = await collection.findOne({ _id: new ObjectId(demoId) });
  if (!doc) {
    const err = new Error('Demo request not found');
    err.statusCode = 404;
    throw err;
  }
  return doc;
}

function demoPayloadFromDoc(doc) {
  return {
    requestId: String(doc._id),
    fullName: doc.fullName || '',
    email: doc.email || '',
    organizationName: doc.organizationName || '',
    organizationType: doc.organizationType || 'agency',
    countryCode: doc.countryCode || '',
    dialCode: doc.dialCode || '',
    phoneNumber: doc.phoneNumber || '',
    companySize: doc.companySize || '',
    outcome: doc.outcome || '',
  };
}

export const hqTrialService = {
  async provisionEmployerTrialRequest(demo, options = {}) {
    const requestId = String(demo?.requestId || '').trim();
    const name = String(demo?.fullName || '').trim();
    const email = normalizeEmail(demo?.email);
    const organizationName = String(demo?.organizationName || '').trim();
    const trialDays = normalizeTrialDays(options.trialDays ?? demo?.trialDays);
    const note = String(options.note || '').trim();
    const tryFreeUrl = resolveTryFreeLoginUrl();

    if (!name || !email || !organizationName) {
      throw new Error('Trial request is missing name, email, or organization');
    }

    const existingTenants = await headquartersAuthService.listTenants();
    const existing = existingTenants.find((t) => normalizeEmail(t.email) === email);
    if (existing?.tenantDbName) {
      // Re-grant / extend trial window for an existing tenant and re-email credentials
      const subscriptionPlan = await resolveStarterTrialPlan(trialDays);
      const loginId = existing.loginId || email;
      const password = generateTempPassword();
      let credentialEmailSent = false;
      let credentialEmailError = null;

      try {
        await headquartersAuthService.setSubscriptionPlanForEmail(email, {
          ...subscriptionPlan,
          employerDemoRequestId: requestId || existing.subscriptionPlan?.employerDemoRequestId || null,
        });
        await headquartersAuthService.updateWorkspacePasswordForEmail(email, password);
        await runWithTenantContext(existing.tenantDbName, async () => {
          await setSubscriptionPlan(subscriptionPlan);
          const hashedPassword = await bcrypt.hash(password, 12);
          let user = await prisma.user.findUnique({
            where: { email },
            include: { credential: true },
          });
          if (!user && loginId) {
            const cred = await prisma.userCredential.findUnique({
              where: { loginId },
              include: { user: true },
            });
            if (cred?.user) {
              user = { ...cred.user, credential: cred };
            }
          }
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: { passwordHash: hashedPassword, isActive: true },
            });
            if (user.credential) {
              await prisma.userCredential.update({
                where: { id: user.credential.id },
                data: {
                  hashedPassword,
                  tempPasswordFlag: false,
                  isLocked: false,
                  failedAttempts: 0,
                },
              });
            } else {
              await prisma.userCredential.create({
                data: {
                  userId: user.id,
                  loginId,
                  hashedPassword,
                  tempPasswordFlag: false,
                },
              });
            }
          }
        });
      } catch (err) {
        console.warn('[hq-trial] failed to refresh existing trial:', err?.message || err);
      }

      try {
        await sendCredentialInvite({
          email,
          loginId,
          tempPassword: password,
          roleName: `Try-free access (${trialDays} days)`,
          inviteToken: password,
          tenantDbName: existing.tenantDbName,
          loginBaseUrl: tryFreeUrl,
          trialDays,
          trialEndsAt: subscriptionPlan?.planEndDate || null,
        });
        credentialEmailSent = true;
      } catch (emailErr) {
        credentialEmailError = emailErr?.message || String(emailErr);
        console.warn('[hq-trial] credential email failed (re-grant):', credentialEmailError);
      }

      await markDemoRequestProvisioned(requestId, {
        requestKind: 'trial',
        trialProvisioned: true,
        trialTenantDbName: existing.tenantDbName,
        trialLoginId: loginId,
        trialDays,
        trialStartsAt: subscriptionPlan?.planStartDate || null,
        trialEndsAt: subscriptionPlan?.planEndDate || null,
        trialLoginUrl: tryFreeUrl,
        credentialsSentAt: new Date().toISOString(),
        ...(note ? { hqGrantNote: note } : {}),
      });

      return {
        alreadyProvisioned: true,
        tenantDbName: existing.tenantDbName,
        loginId,
        loginUrl: tryFreeUrl,
        trialEndsAt: subscriptionPlan?.planEndDate || null,
        trialStartsAt: subscriptionPlan?.planStartDate || null,
        trialDays,
        subscriptionPlan,
        credentialEmailSent,
        credentialEmailError,
        message: credentialEmailSent
          ? 'Existing tenant trial refreshed and credentials emailed.'
          : 'Existing tenant trial refreshed. Credential email could not be sent.',
        devPassword: process.env.NODE_ENV === 'development' ? password : undefined,
      };
    }

    const subscriptionPlan = await resolveStarterTrialPlan(trialDays);
    const loginId = buildTrialLoginId(email, name);
    const password = generateTempPassword();
    const organizationType = normalizeOrganizationType(demo?.organizationType);

    const hqUser = await headquartersAuthService.registerWorkspaceUserAndProvisionTenant({
      name,
      email,
      password,
      loginId,
      organizationType,
      organizationName,
      signupSource: 'hq_grant_trial',
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

    let credentialEmailSent = false;
    let credentialEmailError = null;

    try {
      await sendCredentialInvite({
        email,
        loginId,
        tempPassword: password,
        roleName: `Try-free access (${trialDays} days)`,
        inviteToken: password,
        tenantDbName: hqUser.tenantDbName,
        loginBaseUrl: tryFreeUrl,
        trialDays,
        trialEndsAt: subscriptionPlan?.planEndDate || null,
      });
      credentialEmailSent = true;
    } catch (emailErr) {
      credentialEmailError = emailErr?.message || String(emailErr);
      console.warn('[hq-trial] credential email failed:', credentialEmailError);
    }

    try {
      await hqLeadsService.createLeadFromEmployerDemoRequest({
        ...demo,
        outcome:
          note ||
          `${trialDays}-day try-free access — granted by HQ`,
      });
    } catch (leadErr) {
      console.warn('[hq-trial] HQ lead sync failed:', leadErr?.message || leadErr);
    }

    await markDemoRequestProvisioned(requestId, {
      requestKind: 'trial',
      trialProvisioned: true,
      trialTenantDbName: hqUser.tenantDbName,
      trialLoginId: loginId,
      trialDays,
      trialStartsAt: subscriptionPlan?.planStartDate || null,
      trialEndsAt: subscriptionPlan?.planEndDate || null,
      trialLoginUrl: tryFreeUrl,
      credentialsSentAt: new Date().toISOString(),
      ...(note ? { hqGrantNote: note } : {}),
    });

    return {
      alreadyProvisioned: false,
      tenantDbName: hqUser.tenantDbName,
      loginId,
      loginUrl: tryFreeUrl,
      trialEndsAt: subscriptionPlan?.planEndDate || null,
      trialStartsAt: subscriptionPlan?.planStartDate || null,
      trialDays,
      subscriptionPlan,
      credentialEmailSent,
      credentialEmailError,
      devPassword: process.env.NODE_ENV === 'development' ? password : undefined,
    };
  },

  async grantTrialFromDemoRequest(demoId, options = {}) {
    const doc = await loadDemoDoc(demoId);
    const status = String(doc.otpStatus || '').toUpperCase();
    if (status !== 'VERIFIED') {
      const err = new Error('Only verified demo requests can receive try-free access');
      err.statusCode = 400;
      throw err;
    }
    return this.provisionEmployerTrialRequest(demoPayloadFromDoc(doc), options);
  },
};
