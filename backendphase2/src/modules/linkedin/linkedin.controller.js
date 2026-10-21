import { sendResponse, sendError } from '../../utils/response.js';
import { isCmaLinkedInSub, linkedinService, toCmaLinkedInSub } from './linkedin.service.js';
import { env } from '../../config/env.js';
import { getActiveTenantDbName, runWithTenantContext } from '../../config/prisma.js';
import crypto from 'crypto';

function hasCmaLinkedInApp() {
  return Boolean(String(env.LINKEDIN_CMA_CLIENT_ID || '').trim() && String(env.LINKEDIN_CMA_CLIENT_SECRET || '').trim());
}

function frontendJobsUrl() {
  return env.FRONTEND_URL || 'http://localhost:3000';
}

function parseLinkedInOAuthState(state) {
  const decoded = decodeURIComponent(String(state || ''));
  const parts = decoded.split(':');
  return {
    userId: parts[1] || null,
    tenantDbName: parts[2] || '',
    purpose: parts[3] === 'cma' ? 'cma' : 'personal',
    linkedinSub: parts.slice(4).join(':') || '',
  };
}

function buildLinkedInOAuthState({ userId, tenantDbName = '', purpose = 'personal', linkedinSub = '' }) {
  const nonce = crypto.randomBytes(32).toString('hex');
  const base = `${nonce}:${userId}:${String(tenantDbName || '').trim()}`;
  if (purpose === 'cma') return `${base}:cma:${linkedinSub || ''}`;
  return base;
}

function buildLinkedInAuthorizeUrl({ clientId, redirectUri, scopes, state }) {
  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', Array.isArray(scopes) ? scopes.join(' ') : String(scopes || ''));
  authUrl.searchParams.set('state', state);
  return authUrl.toString();
}

async function exchangeLinkedInCode({ code, redirectUri, clientId, clientSecret }) {
  const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`LinkedIn token exchange failed: ${errorText}`);
  }
  return tokenResponse.json();
}

async function fetchLinkedInUserInfo(accessToken) {
  const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userInfoResponse.ok) return null;
  return userInfoResponse.json();
}

export const linkedinController = {
  async initiateAuth(req, res) {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Authentication required');
      }

      if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
        return sendError(
          res,
          503,
          'LinkedIn is not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in the backend environment.',
        );
      }

      const tenantDbName = String(getActiveTenantDbName() || '').trim();
      const tokens = await linkedinService.getTokensByUserId(req.user.id);
      const hasPersonal = tokens.some(
        (token) => !isCmaLinkedInSub(token.linkedinSub) && new Date(token.expiresAt) > new Date(),
      );
      const hasCma = tokens.some(
        (token) => isCmaLinkedInSub(token.linkedinSub) && new Date(token.expiresAt) > new Date(),
      );

      // Personal already connected and CMA app is configured → connect Company Page next.
      const startCma = hasCmaLinkedInApp() && hasPersonal && !hasCma;
      const purpose = startCma ? 'cma' : 'personal';
      const state = buildLinkedInOAuthState({
        userId: req.user.id,
        tenantDbName,
        purpose,
      });
      const authUrl = startCma
        ? buildLinkedInAuthorizeUrl({
            clientId: env.LINKEDIN_CMA_CLIENT_ID,
            redirectUri: env.LINKEDIN_CMA_REDIRECT_URI,
            scopes: env.LINKEDIN_CMA_OAUTH_SCOPES,
            state,
          })
        : buildLinkedInAuthorizeUrl({
            clientId: env.LINKEDIN_CLIENT_ID,
            redirectUri: env.LINKEDIN_REDIRECT_URI,
            scopes: env.LINKEDIN_OAUTH_SCOPES,
            state,
          });

      console.log('\n🔗 LinkedIn OAuth Initiated');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`👤 User ID: ${req.user.id}`);
      console.log(`📧 User Email: ${req.user.email || 'N/A'}`);
      console.log(`📦 App: ${purpose === 'cma' ? 'Community Management (Company Page)' : 'Share on LinkedIn (personal)'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      sendResponse(res, 200, 'LinkedIn auth URL generated', {
        authUrl,
        state,
        purpose,
      });
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async handleCallback(req, res) {
    try {
      const { code, state, error, error_description: errorDescription } = req.query;

      if (error) {
        const detail = String(errorDescription || error || 'LinkedIn authorization failed').replace(/\+/g, ' ');
        return res.redirect(
          `${frontendJobsUrl()}/job?linkedin=error&message=${encodeURIComponent(detail)}`,
        );
      }

      if (!code) {
        return res.redirect(`${frontendJobsUrl()}/job?linkedin=error&message=Authorization code missing`);
      }

      const parsed = parseLinkedInOAuthState(state);
      const finalUserId = parsed.userId;
      const callbackTenantDbName = parsed.tenantDbName;
      const purpose = parsed.purpose;

      if (!finalUserId) {
        return res.redirect(
          `${frontendJobsUrl()}/job?linkedin=error&message=Invalid state parameter. Please try connecting again.`,
        );
      }

      const isCma = purpose === 'cma';
      const tokenData = await exchangeLinkedInCode({
        code,
        redirectUri: isCma ? env.LINKEDIN_CMA_REDIRECT_URI : env.LINKEDIN_REDIRECT_URI,
        clientId: isCma ? env.LINKEDIN_CMA_CLIENT_ID : env.LINKEDIN_CLIENT_ID,
        clientSecret: isCma ? env.LINKEDIN_CMA_CLIENT_SECRET : env.LINKEDIN_CLIENT_SECRET,
      });
      const { access_token, expires_in } = tokenData;

      let userInfo = await fetchLinkedInUserInfo(access_token);
      if (!userInfo && isCma) {
        const loadExisting = async () => {
          const tokens = await linkedinService.getTokensByUserId(finalUserId);
          return tokens.find((token) => !isCmaLinkedInSub(token.linkedinSub)) || tokens[0] || null;
        };
        const existing = callbackTenantDbName
          ? await runWithTenantContext(callbackTenantDbName, loadExisting)
          : await loadExisting();
        userInfo = {
          sub: parsed.linkedinSub || existing?.linkedinSub || finalUserId,
          name: existing?.name || 'LinkedIn Company Page',
          email: existing?.email || null,
          picture: existing?.picture || null,
        };
      }
      if (!userInfo?.sub) {
        throw new Error('Failed to fetch LinkedIn user info');
      }

      const { sub, name, email, picture } = userInfo;
      const storeSub = isCma ? toCmaLinkedInSub(sub) : String(sub).replace(/^cma:/, '');

      const save = () =>
        linkedinService.saveToken(
          finalUserId,
          storeSub,
          access_token,
          expires_in,
          name,
          picture,
          email || null,
        );
      if (callbackTenantDbName) {
        await runWithTenantContext(callbackTenantDbName, save);
      } else {
        await save();
      }

      console.log('\n✅ LinkedIn Account Connected Successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`👤 User ID: ${finalUserId}`);
      console.log(`📦 App: ${isCma ? 'Community Management (Company Page)' : 'Share on LinkedIn (personal)'}`);
      console.log(`🔗 LinkedIn User: ${name || 'N/A'}`);
      console.log(`📧 Email: ${email || 'N/A'}`);
      console.log(`🆔 LinkedIn Sub: ${storeSub}`);
      console.log(`⏰ Token Expires: ${new Date(Date.now() + expires_in * 1000).toLocaleString()}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // After personal connect, continue into Company Page (CMA) OAuth when configured.
      if (!isCma && hasCmaLinkedInApp()) {
        const cmaState = buildLinkedInOAuthState({
          userId: finalUserId,
          tenantDbName: callbackTenantDbName,
          purpose: 'cma',
          linkedinSub: String(sub).replace(/^cma:/, ''),
        });
        return res.redirect(
          buildLinkedInAuthorizeUrl({
            clientId: env.LINKEDIN_CMA_CLIENT_ID,
            redirectUri: env.LINKEDIN_CMA_REDIRECT_URI,
            scopes: env.LINKEDIN_CMA_OAUTH_SCOPES,
            state: cmaState,
          }),
        );
      }

      res.redirect(`${frontendJobsUrl()}/job?linkedin=connected`);
    } catch (error) {
      console.error('\n❌ LinkedIn Connection Failed!');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error(`Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      res.redirect(`${frontendJobsUrl()}/job?linkedin=error&message=${encodeURIComponent(error.message)}`);
    }
  },

  async getStatus(req, res) {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Authentication required');
      }

      const status = await linkedinService.getStatus(req.user.id);
      sendResponse(res, 200, 'LinkedIn connection status', status);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async postJob(req, res) {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Authentication required');
      }

      const { jobTitle, company, description, applyUrl, location, imageUrl, linkedinImageUrl, postText } = req.body;

      if (!jobTitle || !company || !applyUrl) {
        return sendError(res, 400, 'Job title, company, and apply URL are required');
      }

      const result = await linkedinService.postJob(req.user.id, {
        jobTitle,
        company,
        description,
        applyUrl,
        location,
        postText,
        imageUrl: linkedinImageUrl || imageUrl || '',
        linkedinImageUrl: linkedinImageUrl || imageUrl || '',
      });

      // Log successful job post to terminal
      console.log('\n📢 Job Posted to LinkedIn Successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`👤 User ID: ${req.user.id}`);
      console.log(`💼 Job Title: ${jobTitle}`);
      console.log(`🏢 Company: ${company}`);
      console.log(`🔗 Post URL: ${result.linkedinPostUrl}`);
      console.log(`🆔 Post ID: ${result.postId || 'N/A'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      sendResponse(res, 200, 'Job posted to LinkedIn successfully', result);
    } catch (error) {
      if (error.message.includes('expired') || error.message.includes('not connected')) {
        return sendError(res, 401, error.message);
      }
      if (error.message.includes('rate limit')) {
        return sendError(res, 429, error.message);
      }
      sendError(res, 500, error.message, error);
    }
  },

  async listAccounts(req, res) {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Authentication required');
      }
      const accounts = await linkedinService.listAccounts(req.user.id);
      sendResponse(res, 200, 'LinkedIn accounts loaded', { accounts });
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async disconnect(req, res) {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Authentication required');
      }

      const tokenId = String(req.params.accountId || '').trim() || null;
      await linkedinService.deleteToken(req.user.id, tokenId);
      
      // Log disconnection to terminal
      console.log('\n🔌 LinkedIn Account Disconnected');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`👤 User ID: ${req.user.id}`);
      console.log(`📧 User Email: ${req.user.email || 'N/A'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      sendResponse(res, 200, 'LinkedIn disconnected successfully');
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
