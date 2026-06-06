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
  DEFAULT_COMPANY_SERVICES,
  RECOMMENDED_COMPANY_SERVICES,
  SUBSCRIPTION_PLAN_OPTIONS,
  SUPPORTED_CURRENCIES,
  DEFAULT_ORG_CURRENCY,
} from './recruitmentMode.service.js';
import { suggestCompanyServicesOptions } from './companyServicesSuggest.service.js';
import { suggestIndustryOptions } from './industrySuggest.service.js';
import { hasLlmProvider } from '../../services/llmChatFallback.service.js';

const router = express.Router();

router.use(authMiddleware);

/** Any authenticated tenant user — for shell / billing visibility / plan badge (defaults to agency). */
router.get('/recruitment-summary', async (req, res) => {
  try {
    const recruitmentMode = await getRecruitmentMode();
    const subscriptionPlan = await getSubscriptionPlan();
    const defaultCurrency = await getDefaultCurrency();
    sendResponse(res, 200, 'OK', {
      recruitmentMode,
      billingEnabled: recruitmentMode !== 'standalone',
      subscriptionPlan,
      subscriptionPlanOptions: SUBSCRIPTION_PLAN_OPTIONS,
      defaultCurrency,
      supportedCurrencies: SUPPORTED_CURRENCIES,
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load org summary', error);
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
    const plan = await getSubscriptionPlan();
    sendResponse(res, 200, 'OK', {
      plan,
      options: SUBSCRIPTION_PLAN_OPTIONS,
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load subscription plan', error);
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

export default router;
