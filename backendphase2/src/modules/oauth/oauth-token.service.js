import { prisma } from '../../config/prisma.js';
import { encryption } from '../../utils/encryption.js';
import { env } from '../../config/env.js';
import jwt from 'jsonwebtoken';

function enc(v) {
  if (v == null || v === '') return null;
  return encryption.encryptColonString(String(v));
}

function dec(v) {
  if (v == null || v === '') return '';
  return encryption.decryptColonString(String(v));
}

/** @param {string[]} grantedScopes */
function googleFlagsFromScopes(scopes) {
  const s = scopes.join(' ');
  return {
    gmailConnected: /gmail|\/auth\/gmail/i.test(s),
    googleCalConnected: /calendar|\/auth\/calendar/i.test(s),
  };
}

function microsoftFlagsFromScopes(scopes) {
  const s = scopes.join(' ').toLowerCase();
  return {
    outlookConnected: s.includes('mail.send') || s.includes('mail.read'),
    teamsConnected: s.includes('calendars.readwrite') || s.includes('onlinemeetings'),
  };
}

export const oauthTokenService = {
  async upsertGoogleTokens(userId, tokens, scopeList) {
    const access = tokens.access_token || '';
    const refresh = tokens.refresh_token || '';
    const scopes = Array.isArray(scopeList) ? scopeList : [];
    const flags = googleFlagsFromScopes(scopes);

    const existing = await prisma.userOAuthTokens.findUnique({ where: { userId } });
    const mergedFlags = {
      gmailConnected: !!(flags.gmailConnected || existing?.gmailConnected),
      googleCalConnected: !!(flags.googleCalConnected || existing?.googleCalConnected),
    };

    await prisma.userOAuthTokens.upsert({
      where: { userId },
      create: {
        userId,
        googleAccessToken: enc(access),
        googleRefreshToken: enc(refresh),
        googleScope: scopes,
        gmailConnected: mergedFlags.gmailConnected,
        googleCalConnected: mergedFlags.googleCalConnected,
      },
      update: {
        googleAccessToken: access ? enc(access) : undefined,
        googleRefreshToken: refresh ? enc(refresh) : undefined,
        googleScope: scopes.length ? scopes : undefined,
        gmailConnected: mergedFlags.gmailConnected,
        googleCalConnected: mergedFlags.googleCalConnected,
      },
    });
  },

  async upsertMicrosoftTokens(userId, tokens, scopeList) {
    const access = tokens.access_token || '';
    const refresh = tokens.refresh_token || '';
    const scopes = Array.isArray(scopeList) ? scopeList : [];
    const flags = microsoftFlagsFromScopes(scopes);

    const existing = await prisma.userOAuthTokens.findUnique({ where: { userId } });
    const mergedFlags = {
      outlookConnected: !!(flags.outlookConnected || existing?.outlookConnected),
      teamsConnected: !!(flags.teamsConnected || existing?.teamsConnected),
    };

    await prisma.userOAuthTokens.upsert({
      where: { userId },
      create: {
        userId,
        microsoftAccessToken: enc(access),
        microsoftRefreshToken: enc(refresh),
        microsoftScope: scopes,
        outlookConnected: mergedFlags.outlookConnected,
        teamsConnected: mergedFlags.teamsConnected,
      },
      update: {
        microsoftAccessToken: access ? enc(access) : undefined,
        microsoftRefreshToken: refresh ? enc(refresh) : undefined,
        microsoftScope: scopes.length ? scopes : undefined,
        outlookConnected: mergedFlags.outlookConnected,
        teamsConnected: mergedFlags.teamsConnected,
      },
    });
  },

  async setGoogleEmail(userId, email) {
    await prisma.userOAuthTokens.update({
      where: { userId },
      data: { googleEmail: email || null },
    });
  },

  async setMicrosoftEmail(userId, email) {
    await prisma.userOAuthTokens.update({
      where: { userId },
      data: { microsoftEmail: email || null },
    });
  },

  getDecryptedGoogle(row) {
    if (!row) return { accessToken: '', refreshToken: '' };
    return {
      accessToken: dec(row.googleAccessToken),
      refreshToken: dec(row.googleRefreshToken),
    };
  },

  getDecryptedMicrosoft(row) {
    if (!row) return { accessToken: '', refreshToken: '' };
    return {
      accessToken: dec(row.microsoftAccessToken),
      refreshToken: dec(row.microsoftRefreshToken),
    };
  },

  isJwtExpired(accessToken, skewSec = 120) {
    if (!accessToken) return true;
    try {
      const decoded = jwt.decode(accessToken);
      if (!decoded?.exp) return false;
      return decoded.exp * 1000 < Date.now() + skewSec * 1000;
    } catch {
      return true;
    }
  },

  async refreshGoogleAccessToken(userId) {
    const row = await prisma.userOAuthTokens.findUnique({ where: { userId } });
    if (!row) throw new Error('No Google tokens');
    const { refreshToken } = this.getDecryptedGoogle(row);
    if (!refreshToken) throw new Error('No Google refresh token');

    const body = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Google token refresh failed: ${t}`);
    }
    const data = await res.json();
    const access = data.access_token;
    await prisma.userOAuthTokens.update({
      where: { userId },
      data: { googleAccessToken: enc(access) },
    });
    return access;
  },

  async refreshMicrosoftAccessToken(userId) {
    const row = await prisma.userOAuthTokens.findUnique({ where: { userId } });
    if (!row) throw new Error('No Microsoft tokens');
    const { refreshToken } = this.getDecryptedMicrosoft(row);
    if (!refreshToken) throw new Error('No Microsoft refresh token');

    const tenant = env.MICROSOFT_TENANT_ID || 'common';
    const body = new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      scope: 'offline_access',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Microsoft token refresh failed: ${t}`);
    }
    const data = await res.json();
    const access = data.access_token;
    const newRefresh = data.refresh_token;
    await prisma.userOAuthTokens.update({
      where: { userId },
      data: {
        microsoftAccessToken: enc(access),
        ...(newRefresh ? { microsoftRefreshToken: enc(newRefresh) } : {}),
      },
    });
    return access;
  },

  async getValidGoogleAccessToken(userId) {
    const row = await prisma.userOAuthTokens.findUnique({ where: { userId } });
    if (!row) return null;
    const { accessToken, refreshToken } = this.getDecryptedGoogle(row);
    if (!accessToken && !refreshToken) return null;
    if (!this.isJwtExpired(accessToken) && accessToken) return accessToken;
    return this.refreshGoogleAccessToken(userId);
  },

  async getValidMicrosoftAccessToken(userId) {
    const row = await prisma.userOAuthTokens.findUnique({ where: { userId } });
    if (!row) return null;
    const { accessToken, refreshToken } = this.getDecryptedMicrosoft(row);
    if (!accessToken && !refreshToken) return null;
    if (!this.isJwtExpired(accessToken) && accessToken) return accessToken;
    return this.refreshMicrosoftAccessToken(userId);
  },
};
