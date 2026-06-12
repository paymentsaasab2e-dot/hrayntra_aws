import { sendResponse, sendError } from '../../utils/response.js';
import {
  getAlertManagementPayload,
  saveAlertManagementSettings,
} from './alert-settings.js';
import {
  sendTestAlertEmail,
  sendTestAlertPortal,
} from './alert-dispatch.service.js';

export const alertManagementController = {
  async get(req, res) {
    try {
      const payload = await getAlertManagementPayload(req.user?.id);
      sendResponse(res, 200, 'Alert management settings retrieved', payload);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const { channels, scope = 'ORG' } = req.body || {};
      if (!channels || typeof channels !== 'object') {
        return sendError(res, 400, 'channels object is required');
      }
      await saveAlertManagementSettings(req.user.id, channels, scope);
      const payload = await getAlertManagementPayload(req.user.id);
      sendResponse(res, 200, 'Alert management settings updated', payload);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async testEmail(req, res) {
    try {
      const alertId = String(req.body?.alertId || '').trim();
      if (!alertId) return sendError(res, 400, 'alertId is required');

      const user = req.user;
      const result = await sendTestAlertEmail({
        userId: user.id,
        userEmail: user.email,
        userName: user.name || user.firstName || null,
        alertId,
      });

      if (result?.skipped) {
        return sendError(res, 400, 'Email could not be sent — check communication settings');
      }
      if (!result?.success) {
        return sendError(res, 500, result?.error || 'Failed to send test email');
      }

      sendResponse(res, 200, 'Test email sent', { alertId, to: user.email });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async testPortal(req, res) {
    try {
      const alertId = String(req.body?.alertId || '').trim();
      if (!alertId) return sendError(res, 400, 'alertId is required');

      const created = await sendTestAlertPortal({
        userId: req.user.id,
        alertId,
      });

      sendResponse(res, 200, 'Test notification created', {
        alertId,
        notificationId: created.id,
      });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
