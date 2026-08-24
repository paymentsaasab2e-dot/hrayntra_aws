import bcrypt from 'bcryptjs';
import { prisma, runWithTenantContext } from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { authService } from '../auth/auth.service.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';
import { signHqImpersonationToken } from '../../utils/hqImpersonationToken.js';
import { env, normalizePublicUrl } from '../../config/env.js';
import { applyTenantSubscriptionPlan } from '../setting/planAccess.service.js';
import { setSubscriptionPlan, setHqEnabledModules, getHqEnabledModules } from '../setting/recruitmentMode.service.js';
import { resolvePackageSlug, todayPlanStartDate } from './hq-packages.config.js';
import { sendCredentialInvite } from '../../utils/emailService.js';
import { hqLeadsService } from './hq-leads.service.js';
import { hqCompaniesService } from './hq-companies.service.js';
import { hqTeamService } from './hq-team.service.js';
import { hqRolesService } from './hq-roles.service.js';
import { hqPortalService } from './hq-portal.service.js';
import { hqKycInterviewersService } from './hq-kyc-interviewers.service.js';
import { hqDemosService } from './hq-demos.service.js';
import { hqPackagesService } from './hq-packages.service.js';
import { hqAnalyticsService } from './hq-analytics.service.js';
import { hqCoursesService } from './hq-courses.service.js';
import { hqTicketsService } from './hq-tickets.service.js';
import { hqTrialService } from './hq-trial.service.js';
import { hqHelpTicketsService } from './hq-help-tickets.service.js';
import { hqBillingService } from './hq-billing.service.js';

async function resolvePlanInput(raw, billingCycle, planStartDate, planEndDate) {
  const plan = await hqPackagesService.resolvePlanInput(
    typeof raw === 'object' && raw && planEndDate && !raw.planEndDate
      ? { ...raw, planEndDate }
      : raw,
    billingCycle,
    planStartDate,
  );
  if (!plan) {
    if (raw) {
      const label = typeof raw === 'string' ? raw : raw?.name || raw?.id || 'plan';
      throw new Error(`Unknown subscription package: ${label}`);
    }
    return hqPackagesService.resolvePlanInput(
      planEndDate ? { name: 'Starter', planEndDate } : 'Starter',
      billingCycle || 'monthly',
      planStartDate,
    );
  }

  // Merge HQ form overrides (coins, custom limits, price, end date) onto the package plan.
  if (raw && typeof raw === 'object') {
    if (raw.coins !== undefined && raw.coins !== null && raw.coins !== '') {
      plan.coins = Math.max(0, Number(raw.coins) || 0);
    }
    if (raw.price !== undefined && raw.price !== null && String(raw.price).trim()) {
      plan.price = String(raw.price).trim();
    }
    if (raw.maxUsers !== undefined) {
      plan.maxUsers =
        raw.maxUsers === null || raw.maxUsers === ''
          ? null
          : Number.isFinite(Number(raw.maxUsers))
            ? Number(raw.maxUsers)
            : plan.maxUsers;
    }
    if (raw.maxJobs !== undefined) {
      plan.maxJobs =
        raw.maxJobs === null || raw.maxJobs === ''
          ? null
          : Number.isFinite(Number(raw.maxJobs))
            ? Number(raw.maxJobs)
            : plan.maxJobs;
    }
    if (raw.planEndDate) {
      plan.planEndDate = String(raw.planEndDate).trim().slice(0, 10);
    }
  }
  if (planEndDate) {
    plan.planEndDate = String(planEndDate).trim().slice(0, 10);
  }
  return plan;
}

function tenantMatchesPlan(tenant, pkg) {
  const plan = tenant.subscriptionPlan;
  if (!plan) return false;
  if (pkg.id && plan.id && plan.id === pkg.id) return true;
  return String(plan.name || '').toLowerCase() === String(pkg.name || '').toLowerCase();
}

function buildPlanCounts(tenants, packages) {
  const counts = packages.reduce((acc, pkg) => {
    acc[pkg.name] = tenants.filter((t) => tenantMatchesPlan(t, pkg)).length;
    return acc;
  }, {});
  counts.Unassigned = tenants.filter((t) => !t.subscriptionPlan?.name).length;
  return counts;
}

async function backfillUnassignedTenantPlans(tenants) {
  const enterprise = await hqPackagesService.resolvePlanInput('Enterprise');
  if (!enterprise) return tenants;

  let changed = false;
  const next = [];
  for (const tenant of tenants) {
    if (tenant.subscriptionPlan?.name) {
      next.push(tenant);
      continue;
    }

    const updated = await headquartersAuthService.setSubscriptionPlanForEmail(
      tenant.email,
      enterprise
    );
    if (updated?.tenantDbName) {
      try {
        await runWithTenantContext(updated.tenantDbName, () => setSubscriptionPlan(enterprise));
      } catch (err) {
        console.warn('[hq] failed to backfill tenant plan in workspace:', err?.message || err);
      }
    }
    changed = true;
    next.push({
      ...tenant,
      subscriptionPlan: updated?.subscriptionPlan || enterprise,
    });
  }

  return changed ? next : tenants;
}

function assertPlatformProvisioner(reqUser) {
  const hqPermissionIds = Array.isArray(reqUser?.hqPermissionIds)
    ? reqUser.hqPermissionIds.map(String)
    : [];
  if (reqUser?.hqTeamMemberId && hqPermissionIds.length > 0) {
    return;
  }

  if (!isSuperAdminUser({ user: reqUser })) {
    throw new Error('Only super administrators can provision tenants');
  }
  const allow = String(env.HRAYNTRA_PLATFORM_PROVISION_EMAILS || '').trim();
  if (!allow) return;
  const emails = allow.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const email = String(reqUser?.email || '').trim().toLowerCase();
  if (!emails.includes(email)) {
    throw new Error('This account is not authorized for HQ tenant provisioning');
  }
}

function normalizeTenantEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function findLandingDemoForTenant(tenant, demos) {
  const email = normalizeTenantEmail(tenant.email);
  const dbName = String(tenant.tenantDbName || '').trim();
  return (
    demos.find((d) => normalizeTenantEmail(d.email) === email) ||
    (dbName ? demos.find((d) => String(d.trialTenantDbName || '').trim() === dbName) : null) ||
    null
  );
}

function inferSignupSource(tenant, demo) {
  const stored = String(tenant.signupSource || '').trim();
  if (stored) return stored;

  const plan = tenant.subscriptionPlan || {};
  if (plan.purchasedAt || plan.employerDemoRequestId) return 'landing_purchase';
  if (plan.isTrial && demo?.requestKind === 'trial') return 'landing_trial';

  if (demo?.requestKind === 'purchase') return 'landing_purchase';
  if (demo?.requestKind === 'trial') return 'landing_trial';

  if (plan.lastPaymentReference && !plan.upgradedAt) return 'landing_purchase';
  return 'hq_manual';
}

function buildSubscriptionPlanFromDemo(demo) {
  const packageName = String(demo.packageName || demo.packageSlug || '').trim();
  const billingCycle = demo.billingCycle === 'annual' ? 'annual' : 'monthly';
  if (!packageName && !demo.trialStartsAt) return null;
  return {
    ...(packageName ? { name: packageName } : { name: 'Starter' }),
    billingCycle,
    ...(demo.trialStartsAt ? { planStartDate: demo.trialStartsAt } : {}),
    ...(demo.trialEndsAt ? { planEndDate: demo.trialEndsAt } : {}),
    ...(demo.requestKind === 'trial' ? { isTrial: true } : {}),
    ...(demo.requestKind === 'purchase' ? { employerDemoRequestId: demo.id } : {}),
  };
}

function mapTenantForHqResponse(tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    email: tenant.email,
    loginId: tenant.loginId,
    organizationType: tenant.organizationType,
    organizationName: tenant.organizationName || '',
    signupSource: tenant.signupSource || 'hq_manual',
    productLine: tenant.productLine || '',
    enabledModules: Array.isArray(tenant.enabledModules) ? tenant.enabledModules : [],
    modulesRestricted: Boolean(tenant.modulesRestricted),
    phase1CommonPoolEnabled: tenant.phase1CommonPoolEnabled !== false,
    subscriptionPlan: tenant.subscriptionPlan,
    tenantDbName: tenant.tenantDbName,
    tenantProvisioningMode: tenant.tenantProvisioningMode,
    status: tenant.status || 'ACTIVE',
    pausedAt: tenant.pausedAt || null,
    pausedBy: tenant.pausedBy || '',
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    isLandingSignupOnly: Boolean(tenant.isLandingSignupOnly),
    isDeleted: Boolean(tenant.isDeleted),
    deletedAt: tenant.deletedAt || null,
    deletedBy: tenant.deletedBy || '',
  };
}

async function enrichTenantsFromLandingSignups(tenants) {
  let demos = [];
  try {
    const demoResult = await hqDemosService.listDemoRequests();
    demos = demoResult?.demos || [];
  } catch (err) {
    console.warn('[hq] landing signup enrichment skipped:', err?.message || err);
    return tenants.map((tenant) => {
      const demo = findLandingDemoForTenant(tenant, demos);
      return {
        ...tenant,
        organizationName: tenant.organizationName || demo?.organizationName || '',
        signupSource: inferSignupSource(tenant, demo),
      };
    });
  }

  const byEmail = new Set(tenants.map((t) => normalizeTenantEmail(t.email)).filter(Boolean));
  const byDb = new Set(tenants.map((t) => String(t.tenantDbName || '').trim()).filter(Boolean));

  const enriched = tenants.map((tenant) => {
    const demo = findLandingDemoForTenant(tenant, demos);
    return {
      ...tenant,
      organizationName: tenant.organizationName || demo?.organizationName || '',
      signupSource: inferSignupSource(tenant, demo),
    };
  });

  const provisionedLanding = demos.filter(
    (demo) =>
      demo.trialProvisioned &&
      (demo.requestKind === 'purchase' || demo.requestKind === 'trial') &&
      (normalizeTenantEmail(demo.email) || String(demo.trialTenantDbName || '').trim()),
  );

  for (const demo of provisionedLanding) {
    const email = normalizeTenantEmail(demo.email);
    const dbName = String(demo.trialTenantDbName || '').trim();
    if ((email && byEmail.has(email)) || (dbName && byDb.has(dbName))) continue;

    enriched.push({
      id: `landing-${demo.id}`,
      name: demo.fullName || demo.organizationName || demo.email,
      email: demo.email,
      loginId: demo.trialLoginId || demo.email,
      organizationType:
        String(demo.organizationType || '').toLowerCase() === 'standalone' ? 'standalone' : 'agency',
      organizationName: demo.organizationName || '',
      signupSource: demo.requestKind === 'purchase' ? 'landing_purchase' : 'landing_trial',
      subscriptionPlan: buildSubscriptionPlanFromDemo(demo),
      tenantDbName: dbName,
      tenantProvisioningMode: 'DEDICATED',
      status: 'ACTIVE',
      pausedAt: null,
      pausedBy: '',
      createdAt: demo.createdAt || null,
      updatedAt: demo.emailVerifiedAt || demo.createdAt || null,
      isLandingSignupOnly: true,
    });

    if (email) byEmail.add(email);
    if (dbName) byDb.add(dbName);
  }

  return enriched.sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export const hqService = {
  async setupSuperAdmin(data) {
    const { name, email, userId, password } = data; // userId is used as loginId
    
    if (!name || !email || !userId || !password) {
      throw new Error('All fields (name, email, userId, password) are required');
    }

    // 1. Find or Create Super Admin system role to mirror enum role
    let superAdminRole = await prisma.systemRole.findUnique({
      where: { roleName: 'Super Admin' }
    });

    if (!superAdminRole) {
      console.log('⚠️ Super Admin system role not found by name "Super Admin", checking by "SUPER_ADMIN"');
      superAdminRole = await prisma.systemRole.findFirst({
        where: { roleName: { contains: 'Admin', mode: 'insensitive' } }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // 2. Upsert User
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: 'SUPER_ADMIN',
        roleId: superAdminRole?.id,
        isActive: true,
        passwordHash: hashedPassword, // Backward compatibility
      },
      create: {
        name,
        email,
        role: 'SUPER_ADMIN',
        roleId: superAdminRole?.id,
        isActive: true,
        passwordHash: hashedPassword,
      },
    });

    // 3. Upsert UserCredential
    await prisma.userCredential.upsert({
      where: { userId: user.id },
      update: {
        loginId: userId,
        hashedPassword,
        tempPasswordFlag: false,
        isLocked: false,
        failedAttempts: 0,
      },
      create: {
        userId: user.id,
        loginId: userId,
        hashedPassword,
        tempPasswordFlag: false,
        isLocked: false,
        failedAttempts: 0,
      },
    });

    return { 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        loginId: userId,
        role: 'SUPER_ADMIN'
      } 
    };
  },

  async provisionTenant(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const name = String(data?.name || '').trim();
    const email = String(data?.email || '').trim().toLowerCase();
    const loginId = String(data?.loginId || '').trim();
    const password = String(data?.password || '');
    const organizationType =
      String(data?.organizationType || 'agency').toLowerCase() === 'standalone' ? 'standalone' : 'agency';
    const productLine =
      String(data?.productLine || 'crm').toLowerCase() === 'recruitment' ? 'recruitment' : 'crm';
    const enabledModules = Array.isArray(data?.enabledModules)
      ? [...new Set(data.enabledModules.map((m) => String(m || '').trim()).filter(Boolean))]
      : [];
    const phase1CommonPoolEnabled = data?.phase1CommonPoolEnabled !== false;
    const subscriptionPlan = await resolvePlanInput(
      data?.plan ?? data?.subscriptionPlan ?? 'Starter',
      data?.billingCycle ?? data?.plan?.billingCycle ?? data?.subscriptionPlan?.billingCycle,
      data?.planStartDate ?? data?.plan?.planStartDate,
      data?.planEndDate ?? data?.plan?.planEndDate
    );
    if (!name || !email || !loginId || !password) {
      throw new Error('name, email, loginId, and password are required');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    if (enabledModules.length === 0) {
      throw new Error('Select at least one CRM or Recruitment tab');
    }
    const hqUser = await headquartersAuthService.registerWorkspaceUserAndProvisionTenant({
      name,
      organizationName: String(data?.organizationName || name || '').trim(),
      email,
      password,
      loginId,
      organizationType,
      subscriptionPlan,
      signupSource: data?.companyId ? 'hq_company' : 'hq_manual',
      productLine,
      enabledModules,
      phase1CommonPoolEnabled,
    });
    const localUser = await authService.provisionHeadquartersMappedTenant(hqUser);
    await authService.finalizeHeadquartersTenantWorkspace(hqUser, localUser);
    if (subscriptionPlan) {
      try {
        await runWithTenantContext(hqUser.tenantDbName, () => setSubscriptionPlan(subscriptionPlan));
      } catch (err) {
        console.warn('[hq] failed to seed subscription plan in tenant:', err?.message || err);
      }
    }
    if (enabledModules.length > 0 && hqUser.tenantDbName) {
      try {
        await runWithTenantContext(hqUser.tenantDbName, () =>
          setHqEnabledModules({
            productLine,
            enabledModules,
            modulesRestricted: true,
            phase1CommonPoolEnabled,
          }),
        );
      } catch (err) {
        console.warn('[hq] failed to seed enabled modules in tenant:', err?.message || err);
      }
    }

    let linkedCompanyId = null;
    const companyId = String(data?.companyId || '').trim();
    if (companyId) {
      try {
        const linked = await hqCompaniesService.linkTenant(
          companyId,
          {
            tenantDbName: hqUser.tenantDbName,
            tenantAdminEmail: email,
          },
          reqUser,
        );
        linkedCompanyId = linked?.company?.id || companyId;
      } catch (linkErr) {
        console.warn('[hq] failed to link company to tenant:', linkErr?.message || linkErr);
        throw new Error(
          `Tenant was created (${hqUser.tenantDbName}) but company link failed: ${linkErr?.message || linkErr}`,
        );
      }
    }

    // Email the new tenant admin with their credentials. Failures are
    // non-blocking — the tenant is provisioned regardless.
    let credentialEmailSent = false;
    let credentialEmailError = null;
    if (data?.sendCredentialsEmail !== false) {
      try {
        await sendCredentialInvite({
          email,
          loginId,
          tempPassword: password,
          roleName: organizationType === 'standalone' ? 'Workspace Admin' : 'Agency Admin',
          // Reuse tempPassword as the link token — auth/login flow accepts both
          // password and direct token; this matches existing team-invite behavior.
          inviteToken: password,
          tenantDbName: hqUser.tenantDbName,
        });
        credentialEmailSent = true;
      } catch (emailErr) {
        credentialEmailError = emailErr?.message || String(emailErr);
        console.warn('[hq] credential email failed:', credentialEmailError);
      }
    }

    return {
      tenantDbName: hqUser.tenantDbName,
      tenantDatabaseUrl: hqUser.tenantDatabaseUrl,
      tenantProvisioningMode: hqUser.tenantProvisioningMode,
      organizationType,
      productLine: hqUser.productLine || productLine,
      enabledModules: hqUser.enabledModules || enabledModules,
      phase1CommonPoolEnabled:
        hqUser.phase1CommonPoolEnabled !== false && phase1CommonPoolEnabled !== false,
      subscriptionPlan,
      user: { id: localUser.id, email: localUser.email, loginId },
      credentialEmailSent,
      credentialEmailError,
      companyId: linkedCompanyId,
    };
  },

  async listTenants(reqUser) {
    assertPlatformProvisioner(reqUser);
    let tenants = await headquartersAuthService.listTenants();
    tenants = await backfillUnassignedTenantPlans(tenants);
    tenants = await enrichTenantsFromLandingSignups(tenants);
    const packages = await hqPackagesService.listPackages();
    const landingPurchases = tenants.filter((t) => t.signupSource === 'landing_purchase').length;
    const landingTrials = tenants.filter((t) => t.signupSource === 'landing_trial').length;
    const stats = {
      total: tenants.length,
      agency: tenants.filter((t) => t.organizationType === 'agency').length,
      standalone: tenants.filter((t) => t.organizationType === 'standalone').length,
      landingPurchases,
      landingTrials,
      planCounts: buildPlanCounts(tenants, packages),
    };
    return {
      tenants: tenants.map(mapTenantForHqResponse),
      stats,
      planOptions: packages,
    };
  },

  async createTenantImpersonationAccess(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const email = normalizeTenantEmail(data?.email);
    if (!email) throw new Error('email is required');

    const hqActorEmail = normalizeTenantEmail(reqUser?.email);
    if (!hqActorEmail) throw new Error('HQ operator email is required');

    const tenant = await headquartersAuthService.findWorkspaceUserByEmail(email);
    if (!tenant) throw new Error('Tenant not found');
    if (tenant.isDeleted) throw new Error('Tenant is in recycle bin');
    if (tenant.isLandingSignupOnly) {
      throw new Error('Tenant database is not provisioned yet. Finish provisioning before opening the account.');
    }

    const tenantDbName = String(tenant.tenantDbName || '').trim();
    if (!tenantDbName) {
      throw new Error('Tenant database is not ready yet.');
    }

    const { token, expiresAt } = signHqImpersonationToken({
      tenantEmail: email,
      tenantDbName,
      hqActorEmail,
      tenantUserId: tenant.id,
    });

    const frontendBase =
      normalizePublicUrl(env.FRONTEND_URL || env.CLIENT_URL || process.env.NEXT_PUBLIC_APP_URL) ||
      'http://localhost:3001';
    const loginPath = '/login';
    const loginUrl = `${frontendBase.replace(/\/$/, '')}${loginPath}#hqImpersonation=${encodeURIComponent(token)}`;

    console.info('[hq-impersonation] access link created', {
      tenantEmail: email,
      tenantDbName,
      hqActorEmail,
      expiresAt,
    });

    return {
      token,
      loginUrl,
      expiresAt,
      loginId: tenant.loginId || email,
      tenantEmail: email,
      tenantDbName,
      tenantName: tenant.name || tenant.organizationName || email,
    };
  },

  async assignPlan(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const email = String(data?.email || '').trim().toLowerCase();
    if (!email) throw new Error('email is required');

    const tenants = await headquartersAuthService.listTenants();
    const existing = tenants.find((t) => String(t.email || '').toLowerCase() === email);
    const previousPlan = existing?.subscriptionPlan || null;
    const billingCycle = data?.billingCycle ?? data?.plan?.billingCycle;

    const previousSlug = resolvePackageSlug(previousPlan?.id, previousPlan?.name);
    const requestedStartDate = data?.planStartDate ?? data?.plan?.planStartDate;
    const planStartDate =
      requestedStartDate ??
      (previousPlan?.planStartDate && previousSlug ? previousPlan.planStartDate : todayPlanStartDate());

    let plan = await resolvePlanInput(data?.plan, billingCycle, planStartDate);
    if (!plan) throw new Error('plan is required');

    const newSlug = resolvePackageSlug(plan.id, plan.name);
    const tierChanged = Boolean(previousSlug && newSlug && previousSlug !== newSlug);
    if (tierChanged && !requestedStartDate) {
      plan = await resolvePlanInput(data?.plan, billingCycle, todayPlanStartDate());
    }

    const enrichedPlan = {
      ...plan,
      // Keep existing AI coin balance unless HQ explicitly sets coins on assign.
      coins:
        data?.coins !== undefined && data?.coins !== null
          ? Math.max(0, Number(data.coins) || 0)
          : data?.plan?.coins !== undefined && data?.plan?.coins !== null
            ? Math.max(0, Number(data.plan.coins) || 0)
            : previousPlan?.coins != null
              ? Math.max(0, Number(previousPlan.coins) || 0)
              : plan.coins != null
                ? Math.max(0, Number(plan.coins) || 0)
                : 0,
      ...(tierChanged && previousPlan?.name
        ? {
            upgradedFrom: String(previousPlan.name),
            upgradedAt: new Date().toISOString(),
            upgradedBy: 'hq',
          }
        : {}),
    };

    const updated = await headquartersAuthService.setSubscriptionPlanForEmail(email, enrichedPlan);
    if (!updated) throw new Error('Tenant not found');

    if (updated.tenantDbName) {
      await applyTenantSubscriptionPlan(updated.tenantDbName, enrichedPlan, { throwOnFailure: true });
    }

    return { email: updated.email, subscriptionPlan: updated.subscriptionPlan };
  },

  async updateTenantModules(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const email = String(data?.email || '').trim().toLowerCase();
    if (!email) throw new Error('email is required');

    const productLine =
      String(data?.productLine || '').toLowerCase() === 'recruitment'
        ? 'recruitment'
        : String(data?.productLine || '').toLowerCase() === 'crm'
          ? 'crm'
          : '';
    const enabledModules = Array.isArray(data?.enabledModules)
      ? [...new Set(data.enabledModules.map((m) => String(m || '').trim()).filter(Boolean))]
      : [];
    if (enabledModules.length === 0) {
      throw new Error('Select at least one Phase 2 tab to keep enabled');
    }

    const phase1CommonPoolEnabled =
      data?.phase1CommonPoolEnabled === undefined
        ? undefined
        : data.phase1CommonPoolEnabled !== false;

    const updated = await headquartersAuthService.setEnabledModulesForEmail(email, {
      productLine: productLine || undefined,
      enabledModules,
      ...(phase1CommonPoolEnabled !== undefined ? { phase1CommonPoolEnabled } : {}),
    });
    if (!updated) throw new Error('Tenant not found');

    const tenantDbName = String(updated.tenantDbName || '').trim();
    if (!tenantDbName) {
      throw new Error(
        'Tenant database is not provisioned yet. Finish provisioning before changing Phase 2 tabs.',
      );
    }

    try {
      await runWithTenantContext(tenantDbName, () =>
        setHqEnabledModules({
          productLine: updated.productLine || productLine || 'crm',
          enabledModules,
          modulesRestricted: true,
          phase1CommonPoolEnabled:
            phase1CommonPoolEnabled !== undefined
              ? phase1CommonPoolEnabled
              : updated.phase1CommonPoolEnabled !== false,
        }),
      );
    } catch (err) {
      console.warn('[hq] failed to sync modules into tenant DB:', err?.message || err);
      throw new Error(
        `Modules saved in HQ but tenant sync failed: ${err?.message || err}. Retry after tenant DB is reachable.`,
      );
    }

    // Verify tenant DB actually has the new tab list (fail closed so HQ does not show a false success).
    try {
      const verified = await runWithTenantContext(tenantDbName, () => getHqEnabledModules());
      const verifiedSet = new Set(
        (verified?.enabledModules || []).map((m) => String(m || '').trim()).filter(Boolean),
      );
      const missing = enabledModules.filter((m) => !verifiedSet.has(m));
      if (missing.length > 0) {
        throw new Error(
          `Tenant DB sync mismatch (missing: ${missing.slice(0, 5).join(', ')}). Retry.`,
        );
      }
    } catch (err) {
      if (String(err?.message || '').includes('Tenant DB sync mismatch')) throw err;
      console.warn('[hq] modules verify failed:', err?.message || err);
      throw new Error(
        `Modules saved but could not verify tenant sync: ${err?.message || err}`,
      );
    }

    return {
      email: updated.email,
      productLine: updated.productLine || productLine || '',
      enabledModules: updated.enabledModules || enabledModules,
      modulesRestricted: true,
      phase1CommonPoolEnabled: updated.phase1CommonPoolEnabled !== false,
      tenantDbName,
      syncedToTenant: true,
    };
  },

  async setTenantCoins(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const email = String(data?.email || '').trim().toLowerCase();
    if (!email) throw new Error('email is required');
    if (data?.coins === undefined || data?.coins === null || data?.coins === '') {
      throw new Error('coins is required');
    }
    const coins = Math.max(0, Math.floor(Number(data.coins) || 0));

    const tenants = await headquartersAuthService.listTenants();
    const existing = tenants.find((t) => String(t.email || '').toLowerCase() === email);
    if (!existing) throw new Error('Tenant not found');

    const plan = existing.subscriptionPlan || { name: 'Custom' };
    const enrichedPlan = {
      ...plan,
      name: plan.name || 'Custom',
      coins,
    };

    const updated = await headquartersAuthService.setSubscriptionPlanForEmail(email, enrichedPlan);
    if (!updated) throw new Error('Tenant not found');

    if (updated.tenantDbName) {
      await applyTenantSubscriptionPlan(updated.tenantDbName, enrichedPlan, { throwOnFailure: true });
    }

    return {
      email: updated.email,
      coins,
      subscriptionPlan: updated.subscriptionPlan,
    };
  },

  async listAiFeatures(reqUser) {
    assertPlatformProvisioner(reqUser);
    const { hqAiFeaturesService } = await import('./hq-ai-features.service.js');
    return { features: await hqAiFeaturesService.listFeatures({ bypassCache: true }) };
  },

  async updateAiFeatures(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const { hqAiFeaturesService } = await import('./hq-ai-features.service.js');
    return hqAiFeaturesService.updateCosts(data, reqUser);
  },

  async listAiCoinPacks(reqUser) {
    assertPlatformProvisioner(reqUser);
    const { hqAiCoinPacksService } = await import('./hq-ai-coin-packs.service.js');
    return { packs: await hqAiCoinPacksService.listPacks({ includeInactive: true }) };
  },

  async saveAiCoinPacks(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const { hqAiCoinPacksService } = await import('./hq-ai-coin-packs.service.js');
    return hqAiCoinPacksService.savePacks(data, reqUser);
  },

  async getPhase1TokenConfig(reqUser) {
    assertPlatformProvisioner(reqUser);
    const { hqPhase1TokensService } = await import('./hq-phase1-tokens.service.js');
    return hqPhase1TokensService.getOverview({ includeInactive: true });
  },

  async savePhase1TokenPacks(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const { hqPhase1TokensService } = await import('./hq-phase1-tokens.service.js');
    return hqPhase1TokensService.savePacks(data, reqUser);
  },

  async savePhase1TokenCosts(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const { hqPhase1TokensService } = await import('./hq-phase1-tokens.service.js');
    return hqPhase1TokensService.saveServiceCosts(data, reqUser);
  },

  async savePhase1TokenEarns(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const { hqPhase1TokensService } = await import('./hq-phase1-tokens.service.js');
    return hqPhase1TokensService.saveEarnRewards(data, reqUser);
  },

  async setTenantPause(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const email = String(data?.email || '').trim().toLowerCase();
    const paused = Boolean(data?.paused);
    if (!email) throw new Error('email is required');
    const updated = await headquartersAuthService.setTenantPauseForEmail(
      email,
      paused,
      reqUser?.email || reqUser?.id,
    );
    if (!updated) throw new Error('Tenant not found');
    return {
      email: updated.email,
      status: updated.status,
      pausedAt: updated.pausedAt,
      pausedBy: updated.pausedBy,
    };
  },

  async deleteTenant(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const email = String(data?.email || '').trim().toLowerCase();
    if (!email) throw new Error('email is required');

    const hqResult = await headquartersAuthService.softDeleteTenantByEmail(email, reqUser);
    const demoResult = await hqDemosService.softDeleteDemoByEmail(email, reqUser);

    if (!hqResult?.deleted && !demoResult?.deleted) {
      throw new Error('Tenant not found');
    }

    return {
      deleted: true,
      softDeleted: true,
      email,
      tenantDbName: hqResult?.tenantDbName || null,
      databaseDropped: false,
      movedToRecycleBin: true,
    };
  },

  async listRecycleBin(reqUser) {
    assertPlatformProvisioner(reqUser);
    const deletedTenants = await headquartersAuthService.listDeletedTenants();
    const deletedDemos = await hqDemosService.listDeletedDemoRequests();
    const byEmail = new Set(
      deletedTenants.map((t) => String(t.email || '').trim().toLowerCase()).filter(Boolean),
    );

    const items = deletedTenants.map((tenant) => ({
      ...mapTenantForHqResponse(tenant),
      source: 'tenant',
    }));

    for (const demo of deletedDemos) {
      const email = String(demo.email || '').trim().toLowerCase();
      if (!email || byEmail.has(email)) continue;
      items.push({
        id: `landing-${demo.id}`,
        name: demo.fullName || demo.organizationName || demo.email,
        email: demo.email,
        loginId: demo.trialLoginId || demo.email,
        organizationType: demo.organizationType,
        organizationName: demo.organizationName || '',
        signupSource: demo.requestKind === 'purchase' ? 'landing_purchase' : 'landing_trial',
        subscriptionPlan: buildSubscriptionPlanFromDemo(demo),
        tenantDbName: demo.trialTenantDbName || '',
        tenantProvisioningMode: 'DEDICATED',
        status: 'DELETED',
        pausedAt: null,
        pausedBy: '',
        createdAt: demo.createdAt || null,
        updatedAt: demo.deletedAt || demo.createdAt || null,
        isLandingSignupOnly: true,
        isDeleted: true,
        deletedAt: demo.deletedAt || null,
        deletedBy: demo.deletedBy || '',
        source: 'landing',
      });
    }

    items.sort((a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime());
    return { items, count: items.length };
  },

  async restoreTenant(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const email = String(data?.email || '').trim().toLowerCase();
    if (!email) throw new Error('email is required');
    const hqResult = await headquartersAuthService.restoreTenantByEmail(email);
    const demoResult = await hqDemosService.restoreDemoByEmail(email);
    if (!hqResult?.restored && !demoResult?.restored) {
      throw new Error('Recycle bin item not found');
    }
    return {
      restored: true,
      email,
      tenantDbName: hqResult?.tenantDbName || null,
    };
  },

  async purgeTenant(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const email = String(data?.email || '').trim().toLowerCase();
    if (!email) throw new Error('email is required');
    const dropDatabase = data?.dropDatabase !== false;
    let hqPurged = false;
    try {
      const result = await headquartersAuthService.deleteTenantByEmail(email, { dropDatabase });
      hqPurged = Boolean(result?.deleted);
    } catch {
      hqPurged = false;
    }
    const demoResult = await hqDemosService.purgeDemoByEmail(email);
    if (!hqPurged && !demoResult?.purged) {
      throw new Error('Recycle bin item not found');
    }
    return {
      purged: true,
      email,
      databaseDropped: Boolean(hqPurged && dropDatabase),
    };
  },

  async listLeads(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqLeadsService.listLeads();
  },

  async createLead(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqLeadsService.createLead(data, reqUser);
  },

  async updateLead(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqLeadsService.updateLead(id, data, reqUser);
  },

  async deleteLead(id, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqLeadsService.deleteLead(id);
  },

  async addLeadFollowUp(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqLeadsService.addFollowUp(id, data, reqUser);
  },

  async updateLeadFollowUp(id, followUpId, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqLeadsService.updateFollowUp(id, followUpId, data, reqUser);
  },

  async completeLeadFollowUp(id, followUpId, reqUser, extra) {
    assertPlatformProvisioner(reqUser);
    return hqLeadsService.completeFollowUp(id, followUpId, reqUser, extra);
  },

  async deleteLeadFollowUp(id, followUpId, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqLeadsService.deleteFollowUp(id, followUpId, reqUser);
  },

  async addLeadRemark(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqLeadsService.addRemark(id, data, reqUser);
  },

  async convertLeadToCompany(id, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqLeadsService.convertToCompany(id, reqUser);
  },

  async listDemoRequests(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqDemosService.listDemoRequests();
  },

  async deleteDemoRequest(id, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqDemosService.deleteDemoRequest(id);
  },

  async grantDemoTrial(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqTrialService.grantTrialFromDemoRequest(id, {
      trialDays: data?.trialDays,
      note: data?.note,
    });
  },

  async grantLeadTrial(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqTrialService.grantTrialFromLead(id, {
      email: data?.email,
      trialDays: data?.trialDays,
      note: data?.note,
      notifyEmails: data?.notifyEmails,
    }, reqUser);
  },

  async listSupportTickets(reqUser, filters = {}) {
    assertPlatformProvisioner(reqUser);
    return hqTicketsService.listTickets(filters);
  },

  async updateSupportTicket(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqTicketsService.updateTicket(id, data, reqUser);
  },

  async listSupportTicketMessages(id, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqTicketsService.listMessages(id, { hq: true });
  },

  async addSupportTicketMessage(id, body, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqTicketsService.addMessage(id, body, reqUser, { hq: true });
  },

  /** Phase 1 Help-page tickets (candidate portal /help → /api/hq-tickets). */
  async listHelpTickets(reqUser, filters = {}) {
    assertPlatformProvisioner(reqUser);
    return hqHelpTicketsService.listTickets(filters);
  },

  async updateHelpTicket(id, status, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqHelpTicketsService.updateTicketStatus(id, status);
  },

  async listHelpTicketMessages(id, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqHelpTicketsService.listMessages(id);
  },

  async addHelpTicketMessage(id, body, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqHelpTicketsService.addMessage(id, body, reqUser);
  },

  async listCompanies(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCompaniesService.listCompanies();
  },

  async createCompany(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCompaniesService.createCompany(data, reqUser);
  },

  async updateCompany(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCompaniesService.updateCompany(id, data, reqUser);
  },

  async uploadCompanyLogo(id, file, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCompaniesService.uploadCompanyLogo(id, file, reqUser);
  },

  async deleteCompany(id, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCompaniesService.deleteCompany(id);
  },

  async addCompanyFollowUp(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCompaniesService.addFollowUp(id, data, reqUser);
  },

  async updateCompanyFollowUp(id, followUpId, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCompaniesService.updateFollowUp(id, followUpId, data, reqUser);
  },

  async completeCompanyFollowUp(id, followUpId, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCompaniesService.completeFollowUp(id, followUpId, reqUser);
  },

  async deleteCompanyFollowUp(id, followUpId, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCompaniesService.deleteFollowUp(id, followUpId, reqUser);
  },

  async addCompanyRemark(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCompaniesService.addRemark(id, data, reqUser);
  },

  async listTeamMembers(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqTeamService.listMembers();
  },

  async getSessionAccess(reqUser) {
    const { getHqTeamMemberById } = await import('./hq-team-platform-auth.service.js');
    if (reqUser?.hqTeamMemberId) {
      const member = await getHqTeamMemberById(String(reqUser.hqTeamMemberId));
      if (!member || member.status !== 'active') {
        throw new Error('HQ team member account is inactive or missing');
      }
      return {
        isHqTeamMember: true,
        isPlatformOperator: false,
        hqTeamMemberId: member.id,
        email: member.email,
        loginId: member.loginId || '',
        hqPermissionIds: Array.isArray(member.permissionIds)
          ? member.permissionIds.map(String)
          : [],
      };
    }

    assertPlatformProvisioner(reqUser);
    return {
      isHqTeamMember: false,
      isPlatformOperator: true,
      hqPermissionIds: null,
      email: reqUser?.email || '',
      loginId: '',
    };
  },

  async createTeamMember(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqTeamService.createMember(data, reqUser);
  },

  async updateTeamMember(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqTeamService.updateMember(id, data, reqUser);
  },

  async deleteTeamMember(id, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqTeamService.deleteMember(id);
  },

  async listHqPermissions(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqRolesService.listPermissions();
  },

  async listHqRoles(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqRolesService.listRoles();
  },

  async createHqRole(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqRolesService.createRole(data, reqUser);
  },

  async updateHqRole(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqRolesService.updateRole(id, data, reqUser);
  },

  async deleteHqRole(id, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqRolesService.deleteRole(id);
  },

  async getPortalOverview(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqPortalService.getPortalOverview();
  },

  async listAllCandidates(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqPortalService.listAllCandidates();
  },

  async listKycInterviewers(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqKycInterviewersService.listInterviewers();
  },

  async verifyKycInterviewer(reqUser, candidateId) {
    assertPlatformProvisioner(reqUser);
    return hqKycInterviewersService.verifyInterviewer(candidateId, reqUser);
  },

  async rejectKycInterviewer(reqUser, candidateId, reviewNotes) {
    assertPlatformProvisioner(reqUser);
    return hqKycInterviewersService.rejectInterviewer(candidateId, reqUser, reviewNotes);
  },

  async getCandidateBehavior(reqUser, candidateId) {
    assertPlatformProvisioner(reqUser);
    const { getCandidateBehaviorAnalysis } = await import('./hq-candidate-behavior.service.js');
    return getCandidateBehaviorAnalysis(candidateId);
  },

  async getTenantBehavior(reqUser, tenantDbName, tenantMeta = {}, range = 'week') {
    assertPlatformProvisioner(reqUser);
    const { getHqTenantBehaviorAnalysis } = await import('./hq-tenant-behavior.service.js');
    return getHqTenantBehaviorAnalysis({ tenantDbName, tenantMeta, range });
  },

  async getTenantBehaviorEngine(reqUser, tenantDbName, { range = 'week', userId } = {}) {
    assertPlatformProvisioner(reqUser);
    const { getHqTenantBehaviorEngine } = await import('./hq-tenant-behavior.service.js');
    return getHqTenantBehaviorEngine({ tenantDbName, range, userId });
  },

  async getAnalytics(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqAnalyticsService.getAnalytics();
  },

  async deletePortalJob(jobId, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqPortalService.deletePortalJob({
      jobId,
      tenantDbName: data?.tenantDbName,
    });
  },

  async listPackages(reqUser) {
    assertPlatformProvisioner(reqUser);
    const packages = await hqPackagesService.listPackages();
    return {
      packages,
    };
  },

  async listPublicPackages() {
    const packages = await hqPackagesService.listPackages();
    return {
      packages,
    };
  },

  async createPackage(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const pkg = await hqPackagesService.createPackage(data);
    return { package: pkg };
  },

  async updatePackage(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    const pkg = await hqPackagesService.updatePackage(id, data);
    return { package: pkg };
  },

  async deletePackage(id, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqPackagesService.deletePackage(id);
  },

  async listCourses(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCoursesService.listCourses();
  },

  async listCourseEnrollments(id, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCoursesService.listCourseEnrollments(id);
  },

  async createCourse(data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCoursesService.createCourse(data);
  },

  async updateCourse(id, data, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCoursesService.updateCourse(id, data);
  },

  async deleteCourse(id, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCoursesService.deleteCourse(id);
  },

  async deleteCourses(ids, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCoursesService.deleteCourses(ids);
  },

  async uploadCourseThumbnail(file, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCoursesService.uploadThumbnail(file);
  },

  async uploadCourseVideo(file, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqCoursesService.uploadVideo(file);
  },

  async getBilling(reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqBillingService.getBilling();
  },

  async getCandidateBillingLedger(reqUser, candidateId) {
    assertPlatformProvisioner(reqUser);
    return hqBillingService.getCandidateLedger(candidateId);
  },

  async getEmployerBillingLedger(reqUser, tenantKey) {
    assertPlatformProvisioner(reqUser);
    return hqBillingService.getEmployerLedger(tenantKey);
  },
};
