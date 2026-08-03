import bcrypt from 'bcryptjs';
import { prisma, runWithTenantContext } from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { authService } from '../auth/auth.service.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';
import { env } from '../../config/env.js';
import { applyTenantSubscriptionPlan } from '../setting/planAccess.service.js';
import { setSubscriptionPlan, setHqEnabledModules } from '../setting/recruitmentMode.service.js';
import { resolvePackageSlug, todayPlanStartDate } from './hq-packages.config.js';
import { sendCredentialInvite } from '../../utils/emailService.js';
import { hqLeadsService } from './hq-leads.service.js';
import { hqCompaniesService } from './hq-companies.service.js';
import { hqTeamService } from './hq-team.service.js';
import { hqRolesService } from './hq-roles.service.js';
import { hqPortalService } from './hq-portal.service.js';
import { hqDemosService } from './hq-demos.service.js';
import { hqPackagesService } from './hq-packages.service.js';
import { hqAnalyticsService } from './hq-analytics.service.js';
import { hqCoursesService } from './hq-courses.service.js';

async function resolvePlanInput(raw, billingCycle, planStartDate) {
  const plan = await hqPackagesService.resolvePlanInput(raw, billingCycle, planStartDate);
  if (!plan) {
    if (raw) {
      const label = typeof raw === 'string' ? raw : raw?.name || raw?.id || 'plan';
      throw new Error(`Unknown subscription package: ${label}`);
    }
    return hqPackagesService.resolvePlanInput('Starter', billingCycle || 'monthly', planStartDate);
  }

  // Merge HQ form overrides (coins, custom limits, price) onto the package plan.
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
    subscriptionPlan: tenant.subscriptionPlan,
    tenantDbName: tenant.tenantDbName,
    tenantProvisioningMode: tenant.tenantProvisioningMode,
    status: tenant.status || 'ACTIVE',
    pausedAt: tenant.pausedAt || null,
    pausedBy: tenant.pausedBy || '',
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    isLandingSignupOnly: Boolean(tenant.isLandingSignupOnly),
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
    const subscriptionPlan = await resolvePlanInput(
      data?.plan ?? data?.subscriptionPlan ?? 'Starter',
      data?.billingCycle ?? data?.plan?.billingCycle ?? data?.subscriptionPlan?.billingCycle,
      data?.planStartDate ?? data?.plan?.planStartDate
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
      email,
      password,
      loginId,
      organizationType,
      subscriptionPlan,
      signupSource: data?.companyId ? 'hq_company' : 'hq_manual',
      productLine,
      enabledModules,
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

    const updated = await headquartersAuthService.setEnabledModulesForEmail(email, {
      productLine: productLine || undefined,
      enabledModules,
    });
    if (!updated) throw new Error('Tenant not found');

    if (updated.tenantDbName) {
      try {
        await runWithTenantContext(updated.tenantDbName, () =>
          setHqEnabledModules({
            productLine: updated.productLine || productLine || 'crm',
            enabledModules,
            modulesRestricted: true,
          }),
        );
      } catch (err) {
        console.warn('[hq] failed to sync modules into tenant DB:', err?.message || err);
        throw new Error(
          `Modules saved in HQ but tenant sync failed: ${err?.message || err}. Retry after tenant DB is reachable.`,
        );
      }
    }

    return {
      email: updated.email,
      productLine: updated.productLine || productLine || '',
      enabledModules: updated.enabledModules || enabledModules,
      modulesRestricted: true,
      tenantDbName: updated.tenantDbName || '',
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
    // Operator can opt out of dropping the tenant database (e.g. retain data
    // for forensic reasons); default is full cleanup.
    const dropDatabase = data?.dropDatabase !== false;
    const result = await headquartersAuthService.deleteTenantByEmail(email, { dropDatabase });
    if (!result?.deleted) throw new Error('Tenant not found');
    return result;
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

  async completeLeadFollowUp(id, followUpId, reqUser) {
    assertPlatformProvisioner(reqUser);
    return hqLeadsService.completeFollowUp(id, followUpId, reqUser);
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

  async getCandidateBehavior(reqUser, candidateId) {
    assertPlatformProvisioner(reqUser);
    const { getCandidateBehaviorAnalysis } = await import('./hq-candidate-behavior.service.js');
    return getCandidateBehaviorAnalysis(candidateId);
  },

  async getTenantBehavior(reqUser, tenantDbName, tenantMeta = {}) {
    assertPlatformProvisioner(reqUser);
    const { getHqTenantBehaviorAnalysis } = await import('./hq-tenant-behavior.service.js');
    return getHqTenantBehaviorAnalysis({ tenantDbName, tenantMeta });
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
};
