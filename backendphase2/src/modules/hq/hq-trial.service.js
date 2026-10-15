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
import { isReservedPlatformTenantDbName } from '../auth/headquarters-auth.service.js';

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

/** Phase 2 employer login base (not the marketing try-free page). */
function resolveTryFreeLoginBaseUrl() {
  const base = String(resolvePublicFrontendUrl() || '').trim().replace(/\/+$/, '');
  if (base) return `${base}/login`;
  if (process.env.NODE_ENV === 'production') {
    return 'https://employers.hryantra.com/login';
  }
  return 'http://localhost:3001/login';
}

/** Phase 2 login with tenantDbName so /login can route to the correct workspace. */
function resolveTryFreeLoginUrl(tenantDbName) {
  const base = resolveTryFreeLoginBaseUrl();
  const tenant = String(tenantDbName || '').trim();
  if (!tenant) return base;
  try {
    const u = new URL(base);
    u.searchParams.set('tenantDbName', tenant);
    return u.toString();
  } catch {
    return `${base}?tenantDbName=${encodeURIComponent(tenant)}`;
  }
}

function normalizeTrialDays(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return TRIAL_PACKAGE_DAYS;
  return Math.max(1, Math.min(365, Math.round(n)));
}

async function sendTrialCopies({ emails, loginId, password, trialDays, trialEndsAt, tenantDbName, tryFreeUrl }) {
  const results = [];
  for (const extra of emails || []) {
    try {
      await sendCredentialInvite({
        email: extra,
        loginId,
        tempPassword: password,
        roleName: `Try-free access (${trialDays} days)`,
        inviteToken: password,
        tenantDbName,
        loginBaseUrl: tryFreeUrl,
        trialDays,
        trialEndsAt,
      });
      results.push({ email: extra, sent: true });
    } catch (err) {
      results.push({ email: extra, sent: false, error: err?.message || String(err) });
      console.warn('[hq-trial] extra credential email failed:', extra, err?.message || err);
    }
  }
  return results;
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
    const trialDays = normalizeTrialDays(options.trialDays ?? demo?.trialDays ?? 5);
    const note = String(options.note || '').trim();
    const skipLeadSync = Boolean(options.skipLeadSync);
    const signupSource = String(options.signupSource || demo?.signupSource || 'landing_trial')
      .trim() || 'landing_trial';
    const notifyEmails = Array.isArray(options.notifyEmails)
      ? [...new Set(options.notifyEmails.map((item) => normalizeEmail(item)).filter((item) => item && item !== email))]
      : [];

    if (!name || !email || !organizationName) {
      throw new Error('Trial request is missing name, email, or organization');
    }

    const existingTenants = await headquartersAuthService.listTenants();
    let existing = existingTenants.find((t) => normalizeEmail(t.email) === email);
    if (existing?.tenantDbName) {
      // Repair bad COLLECTION_LIMIT_REUSE that parked trials inside HQ adm01 / platform DBs.
      if (isReservedPlatformTenantDbName(existing.tenantDbName)) {
        try {
          existing = await headquartersAuthService.rehomeWorkspaceUserOffPlatformTenant(email);
        } catch (rehomeErr) {
          console.warn('[hq-trial] failed to rehome trial off platform tenant:', rehomeErr?.message || rehomeErr);
          throw new Error(
            `Your try-free account was incorrectly linked to the platform workspace (${existing.tenantDbName}). ` +
              `Please contact HRyantra support to reset your trial tenant.`,
          );
        }
      }

      const tenantDbName = existing.tenantDbName;
      const tryFreeUrl = resolveTryFreeLoginUrl(tenantDbName);
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
        // Ensure local SUPER_ADMIN + credentials exist in the (possibly new) tenant DB.
        const mapped = await authService.provisionHeadquartersMappedTenant({
          ...existing,
          password,
          tenantDbName,
        });
        await authService.finalizeHeadquartersTenantWorkspace(
          { ...existing, password, tenantDbName },
          mapped,
        );
        await runWithTenantContext(tenantDbName, async () => {
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
          tenantDbName,
          loginBaseUrl: tryFreeUrl,
          trialDays,
          trialEndsAt: subscriptionPlan?.planEndDate || null,
        });
        credentialEmailSent = true;
      } catch (emailErr) {
        credentialEmailError = emailErr?.message || String(emailErr);
        console.warn('[hq-trial] credential email failed (re-grant):', credentialEmailError);
      }

      const extraEmailResults = await sendTrialCopies({
        emails: notifyEmails,
        loginId,
        password,
        trialDays,
        trialEndsAt: subscriptionPlan?.planEndDate || null,
        tenantDbName,
        tryFreeUrl,
      });

      await markDemoRequestProvisioned(requestId, {
        requestKind: 'trial',
        trialProvisioned: true,
        trialTenantDbName: tenantDbName,
        trialLoginId: loginId,
        trialDays,
        trialStartsAt: subscriptionPlan?.planStartDate || null,
        trialEndsAt: subscriptionPlan?.planEndDate || null,
        trialLoginUrl: tryFreeUrl,
        credentialsSentAt: new Date().toISOString(),
        ...(note ? { hqGrantNote: note } : {}),
      });

      if (!skipLeadSync) {
        try {
          await hqLeadsService.createLeadFromEmployerDemoRequest({
            ...demo,
            requestKind: 'trial',
            outcome:
              note ||
              (signupSource === 'hq_grant_trial'
                ? `${trialDays}-day try-free access — refreshed by HQ`
                : `${trialDays}-day try-free access — refreshed from landing`),
            trialProvisioned: true,
            trialLoginId: loginId,
            trialTenantDbName: tenantDbName,
            trialDays,
            trialStartsAt: subscriptionPlan?.planStartDate || null,
            trialEndsAt: subscriptionPlan?.planEndDate || null,
            trialLoginUrl: tryFreeUrl,
            trialEmail: email,
          });
        } catch (leadErr) {
          console.warn('[hq-trial] HQ lead sync failed (re-grant):', leadErr?.message || leadErr);
        }
      }

      return {
        alreadyProvisioned: true,
        tenantDbName,
        loginId,
        loginUrl: tryFreeUrl,
        trialEndsAt: subscriptionPlan?.planEndDate || null,
        trialStartsAt: subscriptionPlan?.planStartDate || null,
        trialDays,
        subscriptionPlan,
        credentialEmailSent,
        credentialEmailError,
        extraEmailResults,
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
      signupSource,
      subscriptionPlan: {
        ...subscriptionPlan,
        employerDemoRequestId: requestId || null,
      },
    });

    const localUser = await authService.provisionHeadquartersMappedTenant(hqUser);
    await authService.finalizeHeadquartersTenantWorkspace(hqUser, localUser);
    const tryFreeUrl = resolveTryFreeLoginUrl(hqUser.tenantDbName);

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

    const extraEmailResults = await sendTrialCopies({
      emails: notifyEmails,
      loginId,
      password,
      trialDays,
      trialEndsAt: subscriptionPlan?.planEndDate || null,
      tenantDbName: hqUser.tenantDbName,
      tryFreeUrl,
    });

    if (!skipLeadSync) {
      try {
        await hqLeadsService.createLeadFromEmployerDemoRequest({
          ...demo,
          requestKind: 'trial',
          outcome:
            note ||
            (signupSource === 'hq_grant_trial'
              ? `${trialDays}-day try-free access — granted by HQ`
              : `${trialDays}-day try-free access — auto from landing`),
          trialProvisioned: true,
          trialLoginId: loginId,
          trialTenantDbName: hqUser.tenantDbName,
          trialDays,
          trialStartsAt: subscriptionPlan?.planStartDate || null,
          trialEndsAt: subscriptionPlan?.planEndDate || null,
          trialLoginUrl: tryFreeUrl,
          trialEmail: email,
        });
      } catch (leadErr) {
        console.warn('[hq-trial] HQ lead sync failed:', leadErr?.message || leadErr);
      }
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
      extraEmailResults,
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
    return this.provisionEmployerTrialRequest(demoPayloadFromDoc(doc), {
      ...options,
      signupSource: options.signupSource || 'hq_grant_trial',
    });
  },

  async grantTrialFromLead(leadId, options = {}, reqUser) {
    const leadDoc = await hqLeadsService.getLeadDocument(leadId);
    const lead = hqLeadsService.toLeadRow(leadDoc);
    const selectedEmail = normalizeEmail(options.email || lead.email || (Array.isArray(lead.emails) ? lead.emails[0] : ''));
    const extraFromLead = [
      lead.email,
      ...(Array.isArray(lead.emails) ? lead.emails : []),
    ]
      .map((item) => normalizeEmail(item))
      .filter((item) => item && item !== selectedEmail);
    const notifyEmails = [
      ...extraFromLead.filter((item) => (options.notifyEmails || []).map((e) => normalizeEmail(e)).includes(item)),
      ...(Array.isArray(options.notifyEmails) ? options.notifyEmails : []),
    ];

    if (!selectedEmail) {
      const err = new Error('Select an email to send the trial account');
      err.statusCode = 400;
      throw err;
    }

    const payload = {
      requestId: lead.employerDemoRequestId || '',
      fullName: lead.contactPerson || lead.name || selectedEmail.split('@')[0],
      email: selectedEmail,
      organizationName: lead.company || 'Trial company',
      organizationType: 'agency',
      countryCode: '',
      dialCode: '',
      phoneNumber: lead.phone || '',
      companySize: '',
      outcome: options.note || '',
    };

    const result = await this.provisionEmployerTrialRequest(payload, {
      trialDays: options.trialDays,
      note: options.note,
      skipLeadSync: true,
      notifyEmails,
      signupSource: 'hq_grant_trial',
    });

    const updated = await hqLeadsService.markTrialGranted(leadId, {
      trialDays: result.trialDays,
      trialStartsAt: result.trialStartsAt,
      trialEndsAt: result.trialEndsAt,
      trialLoginId: result.loginId,
      trialLoginUrl: result.loginUrl,
      trialTenantDbName: result.tenantDbName,
      trialEmail: selectedEmail,
      note: options.note,
    }, reqUser);

    return {
      ...result,
      lead: updated?.lead || lead,
    };
  },

  /**
   * End try-free access immediately: set plan end date to yesterday so login
   * returns TRIAL_EXPIRED, and stamp the HQ lead as expired.
   */
  async endTrialFromLead(leadId, options = {}, reqUser) {
    const leadDoc = await hqLeadsService.getLeadDocument(leadId);
    const lead = hqLeadsService.toLeadRow(leadDoc);
    const email = normalizeEmail(
      options.email || lead.trialEmail || lead.email || (Array.isArray(lead.emails) ? lead.emails[0] : ''),
    );
    const tenantDbName = String(lead.trialTenantDbName || options.tenantDbName || '').trim();

    if (!lead.trialProvisioned && !lead.trialLoginId && String(lead.stage || '').toLowerCase() !== 'trial') {
      const err = new Error('This lead does not have an active try-free account');
      err.statusCode = 400;
      throw err;
    }

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const endedOn = yesterday.toISOString().slice(0, 10);

    let hqUser = email ? await headquartersAuthService.findWorkspaceUserByEmail(email) : null;
    if (!hqUser && tenantDbName) {
      const tenants = await headquartersAuthService.listTenants();
      hqUser =
        tenants.find((t) => String(t.tenantDbName || '') === tenantDbName) ||
        tenants.find((t) => normalizeEmail(t.email) === email) ||
        null;
    }

    const existingPlan = hqUser?.subscriptionPlan || {};
    const endedPlan = {
      ...existingPlan,
      name: existingPlan.name || 'Trial',
      isTrial: true,
      planEndDate: endedOn,
      planStartDate: existingPlan.planStartDate || endedOn,
      trialDays: existingPlan.trialDays || lead.trialDays || TRIAL_PACKAGE_DAYS,
      employerDemoRequestId:
        lead.employerDemoRequestId || existingPlan.employerDemoRequestId || null,
    };

    const hqEmail = normalizeEmail(hqUser?.email || email);
    if (hqEmail) {
      try {
        await headquartersAuthService.setSubscriptionPlanForEmail(hqEmail, endedPlan);
      } catch (err) {
        console.warn('[hq-trial] failed to expire HQ subscription plan:', err?.message || err);
      }
    }

    // Always expire the tenant workspace plan (login reads this first).
    const dbName = String(hqUser?.tenantDbName || tenantDbName || '').trim();
    if (dbName && !isReservedPlatformTenantDbName(dbName)) {
      try {
        await runWithTenantContext(dbName, () => setSubscriptionPlan(endedPlan));
      } catch (err) {
        console.warn('[hq-trial] failed to expire tenant subscription plan:', err?.message || err);
      }
    }

    if (lead.employerDemoRequestId) {
      try {
        await markDemoRequestProvisioned(lead.employerDemoRequestId, {
          trialEndsAt: endedOn,
          trialEndedByHq: true,
          trialEndedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[hq-trial] failed to update demo request end date:', err?.message || err);
      }
    }

    const updated = await hqLeadsService.markTrialEnded(
      leadId,
      {
        trialEndsAt: endedOn,
        note: options.note || `Trial ended by HQ (${endedOn})`,
      },
      reqUser,
    );

    return {
      ended: true,
      trialEndsAt: endedOn,
      email: hqUser?.email || email || null,
      tenantDbName: hqUser?.tenantDbName || tenantDbName || null,
      lead: updated?.lead || lead,
      message: 'Try-free access ended. The employer can no longer sign in with this trial.',
    };
  },
};
