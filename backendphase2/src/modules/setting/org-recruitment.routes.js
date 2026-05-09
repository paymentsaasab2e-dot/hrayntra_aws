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
  SUBSCRIPTION_PLAN_OPTIONS,
  SUPPORTED_CURRENCIES,
  DEFAULT_ORG_CURRENCY,
} from './recruitmentMode.service.js';

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

export default router;
