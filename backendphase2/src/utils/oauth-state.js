import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const SECRET = () =>
  env.OAUTH_STATE_SECRET || env.JWT_ACCESS_SECRET || env.JWT_SECRET || 'dev-oauth-state-change-me';

/** @param {{ userId: string, service: string, extraScopes?: string[] }} payload */
export function createOAuthState(payload) {
  return jwt.sign(
    {
      userId: payload.userId,
      service: payload.service,
      extraScopes: payload.extraScopes || [],
    },
    SECRET(),
    { expiresIn: '10m' }
  );
}

export function verifyOAuthState(state) {
  if (!state || typeof state !== 'string') {
    throw new Error('Invalid OAuth state');
  }
  const decoded = jwt.verify(state, SECRET());
  if (!decoded.userId || !decoded.service) {
    throw new Error('Invalid OAuth state payload');
  }
  return {
    userId: String(decoded.userId),
    service: String(decoded.service),
    extraScopes: Array.isArray(decoded.extraScopes) ? decoded.extraScopes.map(String) : [],
  };
}
