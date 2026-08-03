import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';
import { sendResponse, sendError } from '../../utils/response.js';
import {
  getRecruitmentMode,
  setRecruitmentMode,
  getDefaultPipelineTemplate,
  setDefaultPipelineTemplate,
  getSubscriptionPlan,
  setSubscriptionPlan,
  applyOrgPipelineTemplateToEmptyJobs,
  resetJobPipelineToOrgTemplate,
  getDefaultCurrency,
  setDefaultCurrency,
  getCompanyServices,
  getOrgCustomCompanyServices,
  setCompanyServices,
  appendCompanyService,
  getOrgCustomLeadStatusOptions,
  getLeadStatusOptions,
  appendLeadStatusOption,
  removeLeadStatusOption,
  DEFAULT_LEAD_STATUS_OPTIONS,
  getOrgCustomClientLeadStatusOptions,
  getClientLeadStatusOptions,
  appendClientLeadStatusOption,
  removeClientLeadStatusOption,
  DEFAULT_CLIENT_LEAD_STATUS_OPTIONS,
  getOrgCustomClientPriorityOptions,
  getClientPriorityOptions,
  appendClientPriorityOption,
  removeClientPriorityOption,
  DEFAULT_CLIENT_PRIORITY_OPTIONS,
  getOrgCustomAgreementLevelOptions,
  getAgreementLevelOptions,
  appendAgreementLevelOption,
  removeAgreementLevelOption,
  DEFAULT_AGREEMENT_LEVEL_OPTIONS,
  DEFAULT_COMPANY_SERVICES,
  RECOMMENDED_COMPANY_SERVICES,
  SUBSCRIPTION_PLAN_OPTIONS,
  SUPPORTED_CURRENCIES,
  DEFAULT_ORG_CURRENCY,
  DEFAULT_CLIENT_PAGE_FIELD_VISIBILITY,
  getClientPageFieldVisibility,
  setClientPageFieldVisibility,
} from './recruitmentMode.service.js';
import { getOrCreateWorkspaceClient } from './workspace-client.service.js';
import {
  getEffectiveSubscriptionPlan,
  getPlanUsageSnapshot,
} from './planAccess.service.js';
import { hqPackagesService } from '../hq/hq-packages.service.js';
import {
  listUpgradeOptions,
  upgradeSubscriptionPlan,
} from './subscriptionUpgrade.service.js';
import {
  createSubscriptionUpgradeOrder,
  getRazorpayPublicConfig,
  verifySubscriptionUpgradePayment,
} from './subscriptionPayment.service.js';
import { suggestCompanyServicesOptions } from './companyServicesSuggest.service.js';
import { suggestIndustryOptions } from './industrySuggest.service.js';
import { suggestLanguageOptions, suggestProficiencyOptions } from './languageSuggest.service.js';
import { hasLlmProvider } from '../../services/llmChatFallback.service.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { getActiveTenantDbName } from '../../config/prisma.js';

const router = express.Router();

router.use(authMiddleware);

/** Any authenticated tenant user — for shell / billing visibility / plan badge (defaults to agency). */
router.get('/recruitment-summary', async (req, res) => {
  try {
    const recruitmentMode = await getRecruitmentMode();
    const subscriptionPlan = await getEffectiveSubscriptionPlan();
    const planUsage = await getPlanUsageSnapshot();
    const defaultCurrency = await getDefaultCurrency();
    const clientPageFieldVisibility = await getClientPageFieldVisibility();
    const tenantDbName = String(getActiveTenantDbName() || '').trim();
    let tenantPaused = false;
    let tenantPausedAt = null;
    if (tenantDbName) {
      try {
        const hqTenant = await headquartersAuthService.findTenantByDbName(tenantDbName);
        tenantPaused = headquartersAuthService.isTenantPaused(hqTenant);
        tenantPausedAt = hqTenant?.pausedAt || null;
      } catch (err) {
        console.warn('[recruitment-summary] tenant pause lookup failed:', err?.message || err);
      }
    }
    sendResponse(res, 200, 'OK', {
      recruitmentMode,
      billingEnabled: recruitmentMode !== 'standalone',
      subscriptionPlan,
      planUsage,
      subscriptionPlanOptions: SUBSCRIPTION_PLAN_OPTIONS,
      defaultCurrency,
      supportedCurrencies: SUPPORTED_CURRENCIES,
      clientPageFieldVisibility,
      tenantPaused,
      tenantPausedAt,
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load org summary', error);
  }
});

router.get('/coins', async (req, res) => {
  try {
    const { getCoinsOverview } = await import('./tenantCoinWallet.service.js');
    const overview = await getCoinsOverview();
    sendResponse(res, 200, 'OK', overview);
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to get coins', error);
  }
});

router.get('/coins/packs', async (req, res) => {
  try {
    const { listCoinPacks } = await import('./tenantCoinWallet.service.js');
    const packs = await listCoinPacks();
    sendResponse(res, 200, 'OK', { packs, demo: true });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to list coin packs', error);
  }
});

router.post('/coins/purchase', async (req, res) => {
  try {
    const packId = String(req.body?.packId || '').trim();
    if (!packId) return sendError(res, 400, 'packId is required');
    const { purchaseCoinPack } = await import('./tenantCoinWallet.service.js');
    const result = await purchaseCoinPack(packId, { user: req.user });
    res.setHeader('X-Coin-Balance', String(result.coins));
    res.setHeader('X-Coins-Spent', '0');
    sendResponse(res, 200, result.message || 'Coins purchased', {
      ...result,
      coinBalance: result.coins,
      coinsSpent: 0,
    });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to purchase coins', error);
  }
});

/** Standalone tenants: internal workspace company (no Clients module). */
router.get('/workspace-client', async (req, res) => {
  try {
    const recruitmentMode = await getRecruitmentMode();
    if (recruitmentMode !== 'standalone') {
      return sendResponse(res, 200, 'OK', { recruitmentMode, workspaceClient: null });
    }

    const workspaceClient = await getOrCreateWorkspaceClient(req.user);
    if (!workspaceClient) {
      return sendError(res, 404, 'Workspace client is not available for this tenant');
    }

    sendResponse(res, 200, 'OK', {
      recruitmentMode,
      workspaceClient: {
        id: workspaceClient.id,
        companyName: workspaceClient.companyName,
        website: workspaceClient.website,
        industry: workspaceClient.industry,
        status: workspaceClient.status,
      },
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load workspace client', error);
  }
});

router.get('/default-currency', async (req, res) => {
  try {
    const code = await getDefaultCurrency();
    sendResponse(res, 200, 'OK', {
      code,
      supportedCurrencies: SUPPORTED_CURRENCIES,
      fallback: DEFAULT_ORG_CURRENCY,
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load default currency', error);
  }
});

router.put('/default-currency', requireAnyPermission(['manage_settings']), async (req, res) => {
  try {
    const code = req.body?.code ?? req.body?.currency ?? req.body?.defaultCurrency ?? req.body;
    const saved = await setDefaultCurrency(code);
    sendResponse(res, 200, 'Default currency saved', { code: saved });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to save default currency', error);
  }
});

router.get('/recruitment-mode', requireAnyPermission(['manage_settings']), async (req, res) => {
  try {
    const recruitmentMode = await getRecruitmentMode();
    sendResponse(res, 200, 'OK', { recruitmentMode });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load recruitment mode', error);
  }
});

router.put('/recruitment-mode', requireAnyPermission(['manage_settings']), async (req, res) => {
  try {
    const { recruitmentMode } = req.body || {};
    const saved = await setRecruitmentMode(recruitmentMode);
    sendResponse(res, 200, 'Recruitment mode saved', { recruitmentMode: saved });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to save recruitment mode', error);
  }
});

/** Any authenticated tenant user — org-wide client field visibility for list/drawer UI. */
router.get('/client-page-fields/visibility', async (req, res) => {
  try {
    const clientPageFieldVisibility = await getClientPageFieldVisibility();
    sendResponse(res, 200, 'OK', { clientPageFieldVisibility });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load client page fields', error);
  }
});

router.get('/client-page-fields', requireAnyPermission(['manage_settings']), async (req, res) => {
  try {
    const clientPageFieldVisibility = await getClientPageFieldVisibility();
    sendResponse(res, 200, 'OK', {
      clientPageFieldVisibility,
      defaults: DEFAULT_CLIENT_PAGE_FIELD_VISIBILITY,
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load client page field visibility', error);
  }
});

router.put('/client-page-fields', requireAnyPermission(['manage_settings']), async (req, res) => {
  try {
    const fields = req.body?.clientPageFieldVisibility ?? req.body ?? {};
    const clientPageFieldVisibility = await setClientPageFieldVisibility(fields);
    sendResponse(res, 200, 'Client page field visibility saved', { clientPageFieldVisibility });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to save client page field visibility', error);
  }
});

router.get('/pipeline-template', requireAnyPermission(['manage_settings']), async (req, res) => {
  try {
    const stages = await getDefaultPipelineTemplate();
    sendResponse(res, 200, 'OK', { stages });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load template', error);
  }
});

router.put('/pipeline-template', requireAnyPermission(['manage_settings']), async (req, res) => {
  try {
    const { stages } = req.body || {};
    const saved = await setDefaultPipelineTemplate(stages);
    sendResponse(res, 200, 'Pipeline template saved', { stages: saved });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to save pipeline template', error);
  }
});

/**
 * Apply org pipeline template to jobs with no stages, reseed legacy four-stage
 * (Apply/Interview/Reject/Placed) jobs in standalone mode, and strip duplicate Apply rows.
 */
router.post(
  '/pipeline-template/apply-to-empty-jobs',
  requireAnyPermission(['manage_settings']),
  async (req, res) => {
    try {
      const result = await applyOrgPipelineTemplateToEmptyJobs();
      sendResponse(res, 200, 'Template applied', result);
    } catch (error) {
      sendError(res, 400, error.message || 'Failed to apply template', error);
    }
  }
);

router.post(
  '/pipeline-template/apply-to-job/:jobId',
  requireAnyPermission(['manage_settings']),
  async (req, res) => {
    try {
      const stages = await resetJobPipelineToOrgTemplate(req.params.jobId);
      sendResponse(res, 200, 'Job pipeline reset to org template', { stages });
    } catch (error) {
      sendError(res, 400, error.message || 'Failed to reset job pipeline', error);
    }
  }
);

router.get('/subscription-plan', async (req, res) => {
  try {
    const plan = await getEffectiveSubscriptionPlan();
    const planUsage = await getPlanUsageSnapshot();
    let options = SUBSCRIPTION_PLAN_OPTIONS;
    try {
      const packages = await hqPackagesService.listPackages();
      if (Array.isArray(packages) && packages.length > 0) {
        options = packages;
      }
    } catch (err) {
      console.warn('[subscription-plan] failed to load HQ packages:', err?.message || err);
    }
    let upgradeOptions = { currentPlan: plan, upgradePackages: [], canUpgrade: false };
    try {
      upgradeOptions = await listUpgradeOptions();
    } catch (err) {
      console.warn('[subscription-plan] failed to load upgrade options:', err?.message || err);
    }
    sendResponse(res, 200, 'OK', {
      plan,
      planUsage,
      options,
      upgradeOptions,
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load subscription plan', error);
  }
});

router.get('/subscription-plan/razorpay-config', async (req, res) => {
  try {
    sendResponse(res, 200, 'OK', getRazorpayPublicConfig());
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load Razorpay config', error);
  }
});

router.post('/subscription-plan/payment-order', requireAnyPermission(['manage_settings']), async (req, res) => {
  try {
    const { packageId, billingCycle } = req.body || {};
    const order = await createSubscriptionUpgradeOrder({
      packageId,
      billingCycle,
      userEmail: req.user?.email,
    });
    sendResponse(res, 200, 'Payment order created', order);
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to create payment order', error);
  }
});

router.post('/subscription-plan/upgrade', requireAnyPermission(['manage_settings']), async (req, res) => {
  try {
    const {
      packageId,
      billingCycle,
      paymentReference,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body || {};

    let verifiedPaymentReference = String(paymentReference || '').trim();
    if (razorpayOrderId && razorpayPaymentId && razorpaySignature) {
      const verified = await verifySubscriptionUpgradePayment({
        packageId,
        billingCycle,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });
      verifiedPaymentReference = verified.paymentReference;
    } else if (!verifiedPaymentReference) {
      throw new Error('Complete Razorpay payment is required to upgrade');
    }

    const result = await upgradeSubscriptionPlan({
      packageId,
      billingCycle,
      paymentReference: verifiedPaymentReference,
      upgradedBy: req.user?.email || req.user?.id,
    });
    const planUsage = await getPlanUsageSnapshot();
    sendResponse(res, 200, 'Subscription upgraded successfully', {
      plan: result.plan,
      planUsage,
    });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to upgrade subscription plan', error);
  }
});

router.put('/subscription-plan', requireAnyPermission(['manage_settings']), async (req, res) => {
  try {
    const { plan } = req.body || {};
    const saved = await setSubscriptionPlan(plan ?? req.body);
    sendResponse(res, 200, 'Subscription plan saved', { plan: saved });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to save subscription plan', error);
  }
});

router.get('/company-services', async (req, res) => {
  try {
    const custom = await getOrgCustomCompanyServices();
    sendResponse(res, 200, 'OK', {
      services: custom,
      recommended: RECOMMENDED_COMPANY_SERVICES,
      defaults: DEFAULT_COMPANY_SERVICES,
      aiEnabled: hasLlmProvider(),
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load company services', error);
  }
});

/** Typeahead: history + catalog match + AI (uses server OPENAI_API_KEY / MISTRAL_API_KEY). */
router.get('/industries/suggest', async (req, res) => {
  try {
    const query = String(req.query?.q ?? req.query?.query ?? '').trim();
    const companyName = String(req.query?.companyName ?? req.query?.company ?? '').trim();
    const limit = Math.min(Math.max(parseInt(String(req.query?.limit || '8'), 10) || 8, 1), 12);
    const selectedRaw = req.query?.selected ?? req.query?.exclude ?? '';
    const selected = String(selectedRaw)
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const result = await suggestIndustryOptions({
      query,
      selected,
      limit,
      companyName,
    });
    sendResponse(res, 200, 'OK', result);
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to suggest industries', error);
  }
});

router.get('/languages/suggest', async (req, res) => {
  try {
    const query = String(req.query?.q ?? req.query?.query ?? '').trim();
    const jobTitle = String(req.query?.jobTitle ?? req.query?.title ?? '').trim();
    const limit = Math.min(Math.max(parseInt(String(req.query?.limit || '8'), 10) || 8, 1), 12);
    const selectedRaw = req.query?.selected ?? req.query?.exclude ?? '';
    const selected = String(selectedRaw)
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const result = await suggestLanguageOptions({ query, selected, limit, jobTitle });
    sendResponse(res, 200, 'OK', result);
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to suggest languages', error);
  }
});

router.get('/proficiencies/suggest', async (req, res) => {
  try {
    const query = String(req.query?.q ?? req.query?.query ?? '').trim();
    const language = String(req.query?.language ?? req.query?.lang ?? '').trim();
    const limit = Math.min(Math.max(parseInt(String(req.query?.limit || '8'), 10) || 8, 1), 12);
    const selectedRaw = req.query?.selected ?? req.query?.exclude ?? '';
    const selected = String(selectedRaw)
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const result = await suggestProficiencyOptions({ query, selected, limit, language });
    sendResponse(res, 200, 'OK', result);
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to suggest proficiencies', error);
  }
});

router.get('/company-services/suggest', async (req, res) => {
  try {
    const query = String(req.query?.q ?? req.query?.query ?? '').trim();
    const industry = String(req.query?.industry ?? '').trim();
    const limit = Math.min(Math.max(parseInt(String(req.query?.limit || '8'), 10) || 8, 1), 15);
    const selectedRaw = req.query?.selected ?? req.query?.exclude ?? '';
    const selected = String(selectedRaw)
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const result = await suggestCompanyServicesOptions({
      query,
      selected,
      limit,
      industry,
    });
    sendResponse(res, 200, 'OK', result);
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to suggest company services', error);
  }
});

router.put('/company-services', requireAnyPermission(['manage_settings']), async (req, res) => {
  try {
    const raw = req.body?.services ?? req.body;
    const services = Array.isArray(raw) ? raw : [];
    const saved = await setCompanyServices(services);
    sendResponse(res, 200, 'Company services saved', { services: saved });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to save company services', error);
  }
});

router.post('/company-services/append', async (req, res) => {
  try {
    const service = req.body?.service ?? req.body?.name ?? req.body;
    const services = await appendCompanyService(service);
    sendResponse(res, 200, 'Service added', { services });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to add company service', error);
  }
});

router.get('/lead-statuses', async (req, res) => {
  try {
    const custom = await getOrgCustomLeadStatusOptions();
    const statuses = await getLeadStatusOptions();
    sendResponse(res, 200, 'OK', {
      statuses,
      custom,
      defaults: DEFAULT_LEAD_STATUS_OPTIONS,
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load lead statuses', error);
  }
});

router.post('/lead-statuses/append', async (req, res) => {
  try {
    const status = req.body?.status ?? req.body?.name ?? req.body;
    const statuses = await appendLeadStatusOption(status);
    sendResponse(res, 200, 'Lead status added', {
      statuses,
      defaults: DEFAULT_LEAD_STATUS_OPTIONS,
    });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to add lead status', error);
  }
});

router.post('/lead-statuses/remove', async (req, res) => {
  try {
    const status = req.body?.status ?? req.body?.name ?? req.body;
    const statuses = await removeLeadStatusOption(status);
    sendResponse(res, 200, 'Lead status removed', {
      statuses,
      defaults: DEFAULT_LEAD_STATUS_OPTIONS,
    });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to remove lead status', error);
  }
});

router.get('/client-lead-statuses', async (req, res) => {
  try {
    const custom = await getOrgCustomClientLeadStatusOptions();
    const statuses = await getClientLeadStatusOptions();
    sendResponse(res, 200, 'OK', {
      statuses,
      custom,
      defaults: DEFAULT_CLIENT_LEAD_STATUS_OPTIONS,
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load client statuses', error);
  }
});

router.post('/client-lead-statuses/append', async (req, res) => {
  try {
    const status = req.body?.status ?? req.body?.name ?? req.body;
    const statuses = await appendClientLeadStatusOption(status);
    sendResponse(res, 200, 'Client status added', {
      statuses,
      defaults: DEFAULT_CLIENT_LEAD_STATUS_OPTIONS,
    });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to add client status', error);
  }
});

router.post('/client-lead-statuses/remove', async (req, res) => {
  try {
    const status = req.body?.status ?? req.body?.name ?? req.body;
    const statuses = await removeClientLeadStatusOption(status);
    sendResponse(res, 200, 'Client status removed', {
      statuses,
      defaults: DEFAULT_CLIENT_LEAD_STATUS_OPTIONS,
    });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to remove client status', error);
  }
});

router.get('/client-priorities', async (req, res) => {
  try {
    const custom = await getOrgCustomClientPriorityOptions();
    const priorities = await getClientPriorityOptions();
    sendResponse(res, 200, 'OK', {
      statuses: priorities,
      custom,
      defaults: DEFAULT_CLIENT_PRIORITY_OPTIONS,
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load client interest levels', error);
  }
});

router.post('/client-priorities/append', async (req, res) => {
  try {
    const priority = req.body?.priority ?? req.body?.status ?? req.body?.name ?? req.body;
    const priorities = await appendClientPriorityOption(priority);
    sendResponse(res, 200, 'Interest level added', {
      statuses: priorities,
      defaults: DEFAULT_CLIENT_PRIORITY_OPTIONS,
    });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to add interest level', error);
  }
});

router.post('/client-priorities/remove', async (req, res) => {
  try {
    const priority = req.body?.priority ?? req.body?.status ?? req.body?.name ?? req.body;
    const priorities = await removeClientPriorityOption(priority);
    sendResponse(res, 200, 'Interest level removed', {
      statuses: priorities,
      defaults: DEFAULT_CLIENT_PRIORITY_OPTIONS,
    });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to remove interest level', error);
  }
});

router.get('/agreement-levels', async (req, res) => {
  try {
    const custom = await getOrgCustomAgreementLevelOptions();
    const levels = await getAgreementLevelOptions();
    sendResponse(res, 200, 'OK', {
      statuses: levels,
      custom,
      defaults: DEFAULT_AGREEMENT_LEVEL_OPTIONS,
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load agreement levels', error);
  }
});

router.post('/agreement-levels/append', async (req, res) => {
  try {
    const level = req.body?.level ?? req.body?.status ?? req.body?.name ?? req.body;
    const levels = await appendAgreementLevelOption(level);
    sendResponse(res, 200, 'Agreement level added', {
      statuses: levels,
      defaults: DEFAULT_AGREEMENT_LEVEL_OPTIONS,
    });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to add agreement level', error);
  }
});

router.post('/agreement-levels/remove', async (req, res) => {
  try {
    const level = req.body?.level ?? req.body?.status ?? req.body?.name ?? req.body;
    const levels = await removeAgreementLevelOption(level);
    sendResponse(res, 200, 'Agreement level removed', {
      statuses: levels,
      defaults: DEFAULT_AGREEMENT_LEVEL_OPTIONS,
    });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to remove agreement level', error);
  }
});

export default router;
