import { env, getMicrosoftOAuthConfig } from '../../config/env.js';
import { getActiveTenantDbName } from '../../config/prisma.js';
import { sendResponse } from '../../utils/response.js';
import { createOAuthState, verifyOAuthState } from '../../utils/oauth-state.js';
import { oauthTokenService } from './oauth-token.service.js';
import { integrationService } from '../integration/integration.service.js';

const OUTLOOK_SCOPES =
  'openid email profile offline_access User.Read Mail.Send Mail.Read Mail.ReadWrite';
const TEAMS_SCOPES =
  'openid email profile offline_access User.Read Calendars.ReadWrite OnlineMeetings.ReadWrite';

function buildScope(mode) {
  if (mode === 'outlook') return OUTLOOK_SCOPES;
  if (mode === 'teams') return TEAMS_SCOPES;
  return `${OUTLOOK_SCOPES} ${TEAMS_SCOPES}`;
}

export const microsoftOAuthController = {
  async connect(req, res) {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    try {
      const ms = getMicrosoftOAuthConfig();
      const mode =
        req.query.scope === 'outlook' || req.query.scope === 'teams' ? req.query.scope : 'both';
      const state = createOAuthState({
        userId: req.user.id,
        service: 'microsoft',
        tenantDbName: getActiveTenantDbName(),
        extraScopes: [mode],
      });
      const params = new URLSearchParams({
        client_id: ms.clientId,
        response_type: 'code',
        redirect_uri: ms.redirectUri,
        response_mode: 'query',
        scope: buildScope(mode),
        prompt: 'select_account',
        state,
      });
      const url = `https://login.microsoftonline.com/${ms.tenant}/oauth2/v2.0/authorize?${params.toString()}`;
      return sendResponse(res, 200, 'OAuth URL ready', { url });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async callback(req, res) {
    const frontend = env.FRONTEND_URL || 'http://localhost:3001';
    const fail = () => res.redirect(`${frontend}/setting?section=communication&error=microsoft_failed`);
    try {
      const { code, state } = req.query;
      if (!code) return fail();
      const parsedState = verifyOAuthState(state);
      const { userId, extraScopes, service } = parsedState;

      if (service === 'outlook' || service === 'microsoft-teams') {
        const result = await integrationService.handleCallback(service, String(code), String(state || ''));
        if (service === 'outlook') {
          const inbox = new URL(`${frontend}/inbox`);
          inbox.searchParams.set('outlook_connected', '1');
          if (result.accountEmail) inbox.searchParams.set('email', result.accountEmail);
          return res.redirect(inbox.toString());
        }
        return res.redirect(
          `${frontend}/setting?section=communication&integration_connected=${encodeURIComponent(result.provider)}&email=${encodeURIComponent(result.accountEmail || '')}`
        );
      }

      const mode = extraScopes[0] || 'both';
      const ms = getMicrosoftOAuthConfig();

      const body = new URLSearchParams({
        client_id: ms.clientId,
        client_secret: ms.clientSecret,
        code,
        redirect_uri: ms.redirectUri,
        grant_type: 'authorization_code',
      });
      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${ms.tenant}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        }
      );
      if (!tokenRes.ok) return fail();
      const tokens = await tokenRes.json();
      const scopeStr = tokens.scope || buildScope(mode);
      const scopeList = scopeStr.split(/\s+/).filter(Boolean);

      await oauthTokenService.upsertMicrosoftTokens(userId, tokens, scopeList);

      const me = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = me.ok ? await me.json() : {};
      const email = profile.mail || profile.userPrincipalName || '';
      await oauthTokenService.setMicrosoftEmail(userId, email);

      return res.redirect(
        `${frontend}/setting?section=communication&integration_connected=microsoft&email=${encodeURIComponent(email)}`
      );
    } catch {
      return fail();
    }
  },

  async disconnect(req, res) {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const service = req.body?.service || 'both';
    const { prisma } = await import('../../config/prisma.js');
    const row = await prisma.userOAuthTokens.findUnique({ where: { userId: req.user.id } });
    if (!row) return res.json({ success: true, service });

    if (service === 'both') {
      await prisma.userOAuthTokens.update({
        where: { userId: req.user.id },
        data: {
          microsoftAccessToken: null,
          microsoftRefreshToken: null,
          microsoftEmail: null,
          microsoftScope: [],
          outlookConnected: false,
          teamsConnected: false,
        },
      });
    } else if (service === 'outlook') {
      await prisma.userOAuthTokens.update({
        where: { userId: req.user.id },
        data: {
          outlookConnected: false,
          ...(!row.teamsConnected
            ? {
                microsoftAccessToken: null,
                microsoftRefreshToken: null,
                microsoftEmail: null,
                microsoftScope: [],
              }
            : {}),
        },
      });
    } else if (service === 'teams') {
      await prisma.userOAuthTokens.update({
        where: { userId: req.user.id },
        data: {
          teamsConnected: false,
          ...(!row.outlookConnected
            ? {
                microsoftAccessToken: null,
                microsoftRefreshToken: null,
                microsoftEmail: null,
                microsoftScope: [],
              }
            : {}),
        },
      });
    }

    const updated = await prisma.userOAuthTokens.findUnique({
      where: { userId: req.user.id },
    });
    if (updated && !updated.outlookConnected && !updated.teamsConnected) {
      await prisma.userOAuthTokens.update({
        where: { userId: req.user.id },
        data: {
          microsoftAccessToken: null,
          microsoftRefreshToken: null,
          microsoftEmail: null,
          microsoftScope: [],
        },
      });
    }

    return sendResponse(res, 200, 'Disconnected', { success: true, service });
  },
};
