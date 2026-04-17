import { env } from '../../config/env.js';
import { sendResponse } from '../../utils/response.js';
import { createOAuthState, verifyOAuthState } from '../../utils/oauth-state.js';
import { linkedinService } from '../linkedin/linkedin.service.js';
import { integrationService } from '../integration/integration.service.js';

/**
 * Settings-page LinkedIn OAuth (JWT state). Uses LINKEDIN_OAUTH_REDIRECT_URI on backend.
 */
export const linkedinOAuthSettingsController = {
  async connect(req, res) {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const state = createOAuthState({ userId: req.user.id, service: 'linkedin' });
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.LINKEDIN_CLIENT_ID,
      redirect_uri: env.LINKEDIN_OAUTH_REDIRECT_URI,
      scope: 'openid profile email w_member_social',
      state,
    });
    const url = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    return sendResponse(res, 200, 'OAuth URL ready', { url });
  },

  async callback(req, res) {
    const frontend = env.FRONTEND_URL || 'http://localhost:3001';
    const fail = () =>
      res.redirect(`${frontend}/setting?section=communication&error=linkedin_failed`);
    try {
      const { code, state } = req.query;
      if (!code) return fail();
      const parsedState = verifyOAuthState(state);
      const { userId, service } = parsedState;

      if (service === 'linkedin') {
        const result = await integrationService.handleCallback('linkedin', String(code), String(state || ''));
        return res.redirect(
          `${frontend}/setting?section=communication&integration_connected=${encodeURIComponent(result.provider)}&email=${encodeURIComponent(result.accountEmail || '')}`
        );
      }

      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: env.LINKEDIN_OAUTH_REDIRECT_URI,
          client_id: env.LINKEDIN_CLIENT_ID,
          client_secret: env.LINKEDIN_CLIENT_SECRET,
        }),
      });
      if (!tokenRes.ok) return fail();
      const tokenData = await tokenRes.json();
      const { access_token, expires_in } = tokenData;

      const userInfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!userInfoRes.ok) return fail();
      const userInfo = await userInfoRes.json();
      const { sub, name, email, picture } = userInfo;

      await linkedinService.saveToken(
        userId,
        sub,
        access_token,
        expires_in,
        name,
        picture,
        email || null
      );

      return res.redirect(
        `${frontend}/setting?section=communication&connected=linkedin&email=${encodeURIComponent(email || '')}`
      );
    } catch {
      return fail();
    }
  },

  async disconnect(req, res) {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    await linkedinService.deleteToken(req.user.id);
    return sendResponse(res, 200, 'LinkedIn disconnected', { success: true, service: 'linkedin' });
  },
};
