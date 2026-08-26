import { env } from '../../config/env.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { verifyOAuthState } from '../../utils/oauth-state.js';
import { peekOAuthPkce } from '../../utils/oauth-pkce-store.js';
import { integrationService } from './integration.service.js';

async function readReturnUrlFromState(provider, state) {
  if (!state) return '';

  if (provider === 'twitter') {
    const stored = await peekOAuthPkce(String(state));
    if (stored?.returnUrl) return String(stored.returnUrl);
  }

  try {
    return verifyOAuthState(String(state)).returnUrl || '';
  } catch {
    return '';
  }
}

function buildFrontendRedirect(params, returnUrl = '', provider = '') {
  const frontendBase = env.FRONTEND_URL || 'http://localhost:3001';
  const safeReturn =
    returnUrl && String(returnUrl).startsWith(frontendBase) ? String(returnUrl) : '';
  const defaultPath =
    String(provider || params.integration_connected || '').toLowerCase() === 'gmail'
      ? `${frontendBase}/inbox`
      : `${frontendBase}/setting`;
  const url = safeReturn ? new URL(safeReturn) : new URL(defaultPath);
  if (!safeReturn && !String(url.pathname || '').includes('/inbox')) {
    url.searchParams.set('section', 'communication');
  }
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  if (String(url.pathname || '').includes('/inbox') && params.integration_connected === 'gmail') {
    url.searchParams.set('gmail_connected', '1');
  }
  return url.toString();
}

export const integrationController = {
  async connect(req, res) {
    try {
      if (!req.user?.id) {
        return sendError(res, 401, 'Unauthorized');
      }
      const returnUrl = String(req.query.returnUrl || '').trim();
      const url = await integrationService.getAuthorizationUrl(req.user.id, req.params.provider, {
        returnUrl,
      });
      sendResponse(res, 200, 'OAuth URL ready', { url });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async callback(req, res) {
    const provider = req.params.provider;
    const returnUrl = await readReturnUrlFromState(provider, req.query?.state);

    try {
      if (!req.query?.code) {
        console.warn(`[integration] OAuth callback missing code for ${provider}`);
        return res.redirect(buildFrontendRedirect({ integration_error: provider }, returnUrl));
      }

      const result = await integrationService.handleCallback(
        provider,
        String(req.query.code),
        String(req.query.state || '')
      );

      console.log('[integration] OAuth connected', {
        provider: result.provider,
        userId: result.userId,
        accountEmail: result.accountEmail || '',
        accountName: result.accountName || '',
        returnUrl: returnUrl || '(settings default)',
      });

      return res.redirect(
        buildFrontendRedirect(
          {
            integration_connected: result.provider,
            email: result.accountEmail || '',
          },
          returnUrl,
          result.provider
        )
      );
    } catch (error) {
      console.error(`[integration] OAuth callback failed for ${provider}:`, error?.message || error);
      return res.redirect(buildFrontendRedirect({ integration_error: provider }, returnUrl, provider));
    }
  },

  async disconnect(req, res) {
    try {
      if (!req.user?.id) {
        return sendError(res, 401, 'Unauthorized');
      }
      const connectionId = String(req.body?.connectionId || req.query?.connectionId || '').trim() || null;
      const result = await integrationService.disconnect(req.user.id, req.params.provider, connectionId);
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

