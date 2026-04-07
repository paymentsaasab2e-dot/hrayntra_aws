import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { encryption } from '../../utils/encryption.js';
import { createOAuthState, verifyOAuthState } from '../../utils/oauth-state.js';

const PROVIDERS = {
  gmail: {
    label: 'Gmail',
    family: 'google',
    scopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  },
  'google-calendar': {
    label: 'Google Calendar',
    family: 'google',
    scopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  },
  'google-meet': {
    label: 'Google Meet',
    family: 'google',
    scopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  },
  outlook: {
    label: 'Outlook',
    family: 'microsoft',
    scopes: ['openid', 'email', 'profile', 'offline_access', 'User.Read', 'Mail.Send', 'Mail.Read'],
  },
  'microsoft-teams': {
    label: 'Microsoft Teams',
    family: 'microsoft',
    scopes: [
      'openid',
      'email',
      'profile',
      'offline_access',
      'User.Read',
      'Calendars.ReadWrite',
      'OnlineMeetings.ReadWrite',
    ],
  },
  linkedin: {
    label: 'LinkedIn',
    family: 'linkedin',
    scopes: ['openid', 'profile', 'email', 'w_member_social'],
  },
  zoom: {
    label: 'Zoom',
    family: 'zoom',
    scopes: ['meeting:write', 'meeting:read', 'user:read'],
  },
  twitter: {
    label: 'Twitter/X',
    family: 'twitter',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  },
  facebook: {
    label: 'Facebook',
    family: 'facebook',
    scopes: ['email', 'pages_manage_posts', 'pages_read_engagement', 'public_profile'],
  },
};

const STATUS_PROVIDERS = Object.keys(PROVIDERS);

function enc(value) {
  if (!value) return null;
  return encryption.encryptColonString(String(value));
}

function dec(value) {
  if (!value) return '';
  return encryption.decryptColonString(String(value));
}

function getCallbackUrl(provider) {
  const config = ensureProvider(provider);

  if (config.family === 'google') {
    return env.GOOGLE_REDIRECT_URI || `${env.BACKEND_PUBLIC_URL}/api/v1/oauth/google/callback`;
  }

  if (config.family === 'microsoft') {
    return env.MICROSOFT_REDIRECT_URI || `${env.BACKEND_PUBLIC_URL}/api/v1/oauth/microsoft/callback`;
  }

  if (config.family === 'linkedin') {
    return env.LINKEDIN_OAUTH_REDIRECT_URI || `${env.BACKEND_PUBLIC_URL}/api/v1/oauth/linkedin/callback`;
  }

  return `${env.BACKEND_PUBLIC_URL}/api/v1/auth/${provider}/callback`;
}

function ensureProvider(provider) {
  if (!PROVIDERS[provider]) {
    throw new Error(`Unsupported integration provider: ${provider}`);
  }
  return PROVIDERS[provider];
}

function sha256base64Url(value) {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

async function upsertIntegrationConnection(userId, provider, payload = {}) {
  return prisma.integrationConnection.upsert({
    where: { userId_provider: { userId, provider } },
    create: {
      userId,
      provider,
      accessToken: payload.accessToken ? enc(payload.accessToken) : null,
      refreshToken: payload.refreshToken ? enc(payload.refreshToken) : null,
      expiryDate: payload.expiryDate || null,
      scope: payload.scope || [],
      accountEmail: payload.accountEmail || null,
      accountName: payload.accountName || null,
      accountId: payload.accountId || null,
      metadata: payload.metadata || null,
      connectedAt: new Date(),
    },
    update: {
      accessToken: payload.accessToken ? enc(payload.accessToken) : undefined,
      refreshToken: payload.refreshToken ? enc(payload.refreshToken) : undefined,
      expiryDate: payload.expiryDate !== undefined ? payload.expiryDate : undefined,
      scope: payload.scope || undefined,
      accountEmail: payload.accountEmail !== undefined ? payload.accountEmail || null : undefined,
      accountName: payload.accountName !== undefined ? payload.accountName || null : undefined,
      accountId: payload.accountId !== undefined ? payload.accountId || null : undefined,
      metadata: payload.metadata !== undefined ? payload.metadata : undefined,
      connectedAt: new Date(),
    },
  });
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  return response.json();
}

async function fetchMicrosoftProfile(accessToken) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  return response.json();
}

async function fetchLinkedInProfile(accessToken) {
  const response = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  return response.json();
}

async function fetchZoomProfile(accessToken) {
  const response = await fetch('https://api.zoom.us/v2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  return response.json();
}

async function fetchTwitterProfile(accessToken) {
  const response = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  const payload = await response.json();
  return payload?.data || {};
}

async function fetchFacebookProfile(accessToken) {
  const url = new URL('https://graph.facebook.com/me');
  url.searchParams.set('fields', 'id,name,email');
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url);
  if (!response.ok) return {};
  return response.json();
}

async function persistLegacyConnections(userId, provider, tokens, profile, grantedScopes) {
  if (provider === 'gmail' || provider === 'google-calendar' || provider === 'google-meet') {
    const scopes = grantedScopes || PROVIDERS[provider].scopes;
    const { oauthTokenService } = await import('../oauth/oauth-token.service.js');
    await oauthTokenService.upsertGoogleTokens(userId, tokens, scopes);
    await oauthTokenService.setGoogleEmail(userId, profile?.email || '');
  }

  if (provider === 'outlook' || provider === 'microsoft-teams') {
    const scopes = grantedScopes || PROVIDERS[provider].scopes;
    const { oauthTokenService } = await import('../oauth/oauth-token.service.js');
    await oauthTokenService.upsertMicrosoftTokens(userId, tokens, scopes);
    await oauthTokenService.setMicrosoftEmail(userId, profile?.mail || profile?.userPrincipalName || '');
  }

  if (provider === 'linkedin') {
    const { linkedinService } = await import('../linkedin/linkedin.service.js');
    await linkedinService.saveToken(
      userId,
      profile?.sub || profile?.id || '',
      tokens.access_token,
      Number(tokens.expires_in || 0),
      profile?.name || null,
      profile?.picture || null,
      profile?.email || null
    );
  }
}

export const integrationService = {
  getSupportedProviders() {
    return STATUS_PROVIDERS.map((provider) => ({
      provider,
      label: PROVIDERS[provider].label,
    }));
  },

  async getAuthorizationUrl(userId, provider) {
    const config = ensureProvider(provider);
    const callbackUrl = getCallbackUrl(provider);

    if (config.family === 'google') {
      const state = createOAuthState({ userId, service: provider });
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: callbackUrl,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        scope: config.scopes.join(' '),
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    if (config.family === 'microsoft') {
      const state = createOAuthState({ userId, service: provider });
      const params = new URLSearchParams({
        client_id: env.MICROSOFT_CLIENT_ID,
        response_type: 'code',
        redirect_uri: callbackUrl,
        response_mode: 'query',
        scope: config.scopes.join(' '),
        state,
      });
      const tenant = env.MICROSOFT_TENANT_ID || 'common';
      return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
    }

    if (config.family === 'linkedin') {
      const state = createOAuthState({ userId, service: provider });
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: env.LINKEDIN_CLIENT_ID,
        redirect_uri: callbackUrl,
        scope: config.scopes.join(' '),
        state,
      });
      return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    }

    if (config.family === 'zoom') {
      const state = createOAuthState({ userId, service: provider });
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: env.ZOOM_CLIENT_ID,
        redirect_uri: callbackUrl,
        state,
      });
      return `https://zoom.us/oauth/authorize?${params.toString()}`;
    }

    if (config.family === 'twitter') {
      const state = createOAuthState({
        userId,
        service: provider,
        extraScopes: [crypto.randomBytes(32).toString('base64url')],
      });
      const { extraScopes } = verifyOAuthState(state);
      const codeVerifier = extraScopes[0];
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: env.TWITTER_CLIENT_ID,
        redirect_uri: callbackUrl,
        scope: config.scopes.join(' '),
        state,
        code_challenge: sha256base64Url(codeVerifier),
        code_challenge_method: 'S256',
      });
      return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
    }

    if (config.family === 'facebook') {
      const state = createOAuthState({ userId, service: provider });
      const params = new URLSearchParams({
        client_id: env.FACEBOOK_CLIENT_ID,
        redirect_uri: callbackUrl,
        scope: config.scopes.join(','),
        response_type: 'code',
        state,
      });
      return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
    }

    throw new Error('Provider configuration is incomplete');
  },

  async handleCallback(provider, code, state) {
    const config = ensureProvider(provider);
    const callbackUrl = getCallbackUrl(provider);
    const parsedState = verifyOAuthState(state);
    const userId = parsedState.userId;
    let tokens = null;
    let profile = {};
    let scope = config.scopes;

    if (config.family === 'google') {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      });
      if (!response.ok) throw new Error('Google OAuth failed');
      tokens = await response.json();
      scope = String(tokens.scope || config.scopes.join(' ')).split(/\s+/).filter(Boolean);
      profile = await fetchGoogleProfile(tokens.access_token);
    }

    if (config.family === 'microsoft') {
      const tenant = env.MICROSOFT_TENANT_ID || 'common';
      const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.MICROSOFT_CLIENT_ID,
          client_secret: env.MICROSOFT_CLIENT_SECRET,
          code,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      });
      if (!response.ok) throw new Error('Microsoft OAuth failed');
      tokens = await response.json();
      scope = String(tokens.scope || config.scopes.join(' ')).split(/\s+/).filter(Boolean);
      profile = await fetchMicrosoftProfile(tokens.access_token);
    }

    if (config.family === 'linkedin') {
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: callbackUrl,
          client_id: env.LINKEDIN_CLIENT_ID,
          client_secret: env.LINKEDIN_CLIENT_SECRET,
        }),
      });
      if (!response.ok) throw new Error('LinkedIn OAuth failed');
      tokens = await response.json();
      profile = await fetchLinkedInProfile(tokens.access_token);
    }

    if (config.family === 'zoom') {
      const response = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: callbackUrl,
        }),
      });
      if (!response.ok) throw new Error('Zoom OAuth failed');
      tokens = await response.json();
      profile = await fetchZoomProfile(tokens.access_token);
    }

    if (config.family === 'twitter') {
      const codeVerifier = parsedState.extraScopes?.[0] || '';
      const response = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.TWITTER_CLIENT_ID}:${env.TWITTER_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: env.TWITTER_CLIENT_ID,
          redirect_uri: callbackUrl,
          code_verifier: codeVerifier,
        }),
      });
      if (!response.ok) throw new Error('Twitter OAuth failed');
      tokens = await response.json();
      scope = String(tokens.scope || config.scopes.join(' ')).split(/\s+/).filter(Boolean);
      profile = await fetchTwitterProfile(tokens.access_token);
    }

    if (config.family === 'facebook') {
      const url = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
      url.searchParams.set('client_id', env.FACEBOOK_CLIENT_ID);
      url.searchParams.set('client_secret', env.FACEBOOK_CLIENT_SECRET);
      url.searchParams.set('redirect_uri', callbackUrl);
      url.searchParams.set('code', code);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Facebook OAuth failed');
      tokens = await response.json();
      profile = await fetchFacebookProfile(tokens.access_token);
    }

    const expiryDate =
      tokens?.expires_in != null
        ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
        : null;

    await upsertIntegrationConnection(userId, provider, {
      accessToken: tokens?.access_token || null,
      refreshToken: tokens?.refresh_token || null,
      expiryDate,
      scope,
      accountEmail: profile?.email || profile?.mail || profile?.userPrincipalName || null,
      accountName: profile?.name || profile?.display_name || profile?.displayName || null,
      accountId: profile?.id || profile?.sub || profile?.userPrincipalName || null,
      metadata: profile || null,
    });

    await persistLegacyConnections(userId, provider, tokens, profile, scope);

    return {
      provider,
      userId,
      accountEmail: profile?.email || profile?.mail || profile?.userPrincipalName || '',
      accountName: profile?.name || profile?.display_name || profile?.displayName || '',
    };
  },

  async disconnect(userId, provider) {
    ensureProvider(provider);
    await prisma.integrationConnection.deleteMany({
      where: { userId, provider },
    });

    if (provider === 'gmail' || provider === 'google-calendar' || provider === 'google-meet') {
      const { googleOAuthController } = await import('../oauth/google-oauth.controller.js');
      const service =
        provider === 'gmail' ? 'gmail' : provider === 'google-calendar' || provider === 'google-meet' ? 'calendar' : 'both';
      await prisma.userOAuthTokens.updateMany({
        where: { userId },
        data: service === 'gmail'
          ? { gmailConnected: false }
          : { googleCalConnected: false },
      });
    }

    if (provider === 'outlook' || provider === 'microsoft-teams') {
      await prisma.userOAuthTokens.updateMany({
        where: { userId },
        data: provider === 'outlook' ? { outlookConnected: false } : { teamsConnected: false },
      });
    }

    if (provider === 'linkedin') {
      await prisma.linkedInToken.deleteMany({ where: { userId } });
    }

    return { provider, connected: false };
  },

  async getStatuses(userId) {
    const rows = await prisma.integrationConnection.findMany({
      where: { userId, provider: { in: STATUS_PROVIDERS } },
    });

    const map = Object.fromEntries(
      rows.map((row) => [
        row.provider,
        {
          connected: true,
          provider: row.provider,
          label: PROVIDERS[row.provider]?.label || row.provider,
          accountEmail: row.accountEmail || undefined,
          accountName: row.accountName || undefined,
          scope: Array.isArray(row.scope) ? row.scope : [],
          expiresAt: row.expiryDate?.toISOString() || null,
        },
      ])
    );

    for (const provider of STATUS_PROVIDERS) {
      if (!map[provider]) {
        map[provider] = {
          connected: false,
          provider,
          label: PROVIDERS[provider].label,
          accountEmail: undefined,
          accountName: undefined,
          scope: [],
          expiresAt: null,
        };
      }
    }

    return map;
  },
};
