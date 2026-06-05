import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { NOTIFICATION_TRIGGER_DEFAULT_TEMPLATES } from './notification-trigger-default-templates.js';
import {
  getOrgNotificationTriggerTemplates,
  getWorkspaceEffectiveTriggerTemplates,
  upsertOrgNotificationTriggerTemplates,
} from './notification-trigger-template-settings.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireAnyPermission(['manage_settings']));

router.get('/effective', async (req, res) => {
  try {
    const requested = String(req.query.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const ids =
      requested.length > 0 ? requested : Object.keys(NOTIFICATION_TRIGGER_DEFAULT_TEMPLATES);
    const effective = await getWorkspaceEffectiveTriggerTemplates(ids);
    sendResponse(res, 200, 'Notification trigger templates loaded', { effective });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load templates', error);
  }
});

router.get('/', async (_req, res) => {
  try {
    const templates = await getOrgNotificationTriggerTemplates();
    sendResponse(res, 200, 'Notification trigger template overrides loaded', { templates });
  } catch (error) {
    sendError(res, 500, error.message || 'Failed to load template overrides', error);
  }
});

router.patch('/', async (req, res) => {
  try {
    const incoming = req.body?.templates;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return sendError(res, 400, 'templates object is required');
    }
    const current = await getOrgNotificationTriggerTemplates();
    const merged = { ...current, ...incoming };
    await upsertOrgNotificationTriggerTemplates(merged);
    const effective = await getWorkspaceEffectiveTriggerTemplates(Object.keys(merged));
    sendResponse(res, 200, 'Notification trigger templates saved', { templates: merged, effective });
  } catch (error) {
    sendError(res, 400, error.message || 'Failed to save templates', error);
  }
});

export default router;
