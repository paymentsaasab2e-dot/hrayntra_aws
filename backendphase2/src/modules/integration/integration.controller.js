import { env } from '../../config/env.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { integrationService } from './integration.service.js';

function buildFrontendRedirect(params) {
  const url = new URL(`${env.FRONTEND_URL || 'http://localhost:3001'}/setting`);
  url.searchParams.set('section', 'communication');
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

export const integrationController = {
  async connect(req, res) {
    try {
      if (!req.user?.id) {
        return sendError(res, 401, 'Unauthorized');
      }
      const url = await integrationService.getAuthorizationUrl(req.user.id, req.params.provider);
      sendResponse(res, 200, 'OAuth URL ready', { url });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async callback(req, res) {
    try {
      if (!req.query?.code) {
        return res.redirect(buildFrontendRedirect({ integration_error: req.params.provider }));
      }
      const result = await integrationService.handleCallback(
        req.params.provider,
        String(req.query.code),
        String(req.query.state || '')
      );
      return res.redirect(
        buildFrontendRedirect({
          integration_connected: result.provider,
          email: result.accountEmail || '',
        })
      );
    } catch (error) {
      return res.redirect(buildFrontendRedirect({ integration_error: req.params.provider }));
    }
  },

  async disconnect(req, res) {
    try {
      if (!req.user?.id) {
        return sendError(res, 401, 'Unauthorized');
      }
      const result = await integrationService.disconnect(req.user.id, req.params.provider);
      sendResponse(res, 200, 'Integration disconnected', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async status(req, res) {
    try {
      if (!req.user?.id) {
        return sendError(res, 401, 'Unauthorized');
      }
      const statuses = await integrationService.getStatuses(req.user.id);
      sendResponse(res, 200, 'Integration statuses loaded', statuses);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};

