import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { sendResponse } from '../../utils/response.js';
import { createOAuthState, verifyOAuthState } from '../../utils/oauth-state.js';
import { oauthTokenService } from './oauth-token.service.js';
import { integrationService } from '../integration/integration.service.js';

const GMAIL_SCOPES =
  'openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly';
const CAL_SCOPES = 'openid email profile https://www.googleapis.com/auth/calendar';

function buildScope(mode) {
  if (mode === 'gmail') return GMAIL_SCOPES;
  if (mode === 'calendar') return CAL_SCOPES;
  return `${GMAIL_SCOPES} ${CAL_SCOPES}`;
}

export const googleOAuthController = {
  async connect(req, res) {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const mode = req.query.scope === 'gmail' || req.query.scope === 'calendar' ? req.query.scope : 'both';
    const state = createOAuthState({
      userId: req.user.id,
      service: 'google',
      extraScopes: [mode],
    });
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: buildScope(mode),
      state,
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    // SPA cannot send Bearer on top-level navigation; return URL for client fetch + redirect.
    return sendResponse(res, 200, 'OAuth URL ready', { url });
  },

  async callback(req, res) {
    const frontend = env.FRONTEND_URL || 'http://localhost:3001';
    const fail = (code) => res.redirect(`${frontend}/setting?section=communication&error=${code}`);
    try {
      const { code, state } = req.query;
      if (!code) return fail('google_failed');
      const parsedState = verifyOAuthState(state);
      const { userId, extraScopes, service } = parsedState;

      if (service === 'gmail' || service === 'google-calendar' || service === 'google-meet') {
        const result = await integrationService.handleCallback(service, String(code), String(state || ''));
        return res.redirect(
          `${frontend}/setting?section=communication&integration_connected=${encodeURIComponent(result.provider)}&email=${encodeURIComponent(result.accountEmail || '')}`
        );
      }

      const mode = extraScopes[0] || 'both';

      const body = new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      });
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!tokenRes.ok) return fail('google_failed');
      const tokens = await tokenRes.json();
      const scopeStr = tokens.scope || buildScope(mode);
      const scopeList = scopeStr.split(/\s+/).filter(Boolean);

      await oauthTokenService.upsertGoogleTokens(userId, tokens, scopeList);

      const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = ui.ok ? await ui.json() : {};
      const email = profile.email || '';
      await oauthTokenService.setGoogleEmail(userId, email);

      return res.redirect(
        `${frontend}/setting?section=communication&connected=google&email=${encodeURIComponent(email)}`
      );
    } catch {
      return fail('google_failed');
    }
  },

  async disconnect(req, res) {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const service = req.body?.service || 'both';
    const row = await prisma.userOAuthTokens.findUnique({ where: { userId: req.user.id } });
    if (!row) {
      return res.json({ success: true, service });
    }

    if (service === 'both') {
      await prisma.userOAuthTokens.update({
        where: { userId: req.user.id },
        data: {
          googleAccessToken: null,
          googleRefreshToken: null,
          googleEmail: null,
          googleScope: [],
          gmailConnected: false,
          googleCalConnected: false,
        },
      });
    } else if (service === 'gmail') {
      const keepCal = row.googleCalConnected;
      await prisma.userOAuthTokens.update({
        where: { userId: req.user.id },
        data: {
          gmailConnected: false,
          ...(!keepCal
            ? {
                googleAccessToken: null,
                googleRefreshToken: null,
                googleEmail: null,
                googleScope: [],
              }
            : {}),
        },
      });
    } else if (service === 'calendar') {
      const keepMail = row.gmailConnected;
      await prisma.userOAuthTokens.update({
        where: { userId: req.user.id },
        data: {
          googleCalConnected: false,
          ...(!keepMail
            ? {
                googleAccessToken: null,
                googleRefreshToken: null,
                googleEmail: null,
                googleScope: [],
              }
            : {}),
        },
      });
    }

    const updated = await prisma.userOAuthTokens.findUnique({
      where: { userId: req.user.id },
    });
    if (updated && !updated.gmailConnected && !updated.googleCalConnected) {
      await prisma.userOAuthTokens.update({
        where: { userId: req.user.id },
        data: {
          googleAccessToken: null,
          googleRefreshToken: null,
          googleEmail: null,
          googleScope: [],
        },
      });
    }

    return sendResponse(res, 200, 'Disconnected', { success: true, service });
  },
};
