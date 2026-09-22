import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

function accessSecret() {
  return env.JWT_ACCESS_SECRET || env.JWT_SECRET;
}

function refreshSecret() {
  return env.JWT_REFRESH_SECRET || env.REFRESH_TOKEN_SECRET;
}

export const signToken = (
  payload,
  secret = accessSecret(),
  expiresIn = env.JWT_ACCESS_EXPIRES || env.JWT_EXPIRES_IN || '30m'
) => {
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is required');
  }
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify access JWT (signature + expiry). Never use jwt.decode for auth.
 * @returns {{ ok: true, payload: object } | { ok: false, code: string, message: string }}
 */
export const verifyAccessTokenDetailed = (token, secret = accessSecret()) => {
  if (!token || !secret) {
    return { ok: false, code: 'TOKEN_INVALID', message: 'Invalid token' };
  }
  try {
    const payload = jwt.verify(token, secret);
    if (!payload || typeof payload !== 'object' || !payload.userId) {
      return { ok: false, code: 'TOKEN_INVALID', message: 'Invalid token payload' };
    }
    return { ok: true, payload };
  } catch (error) {
    if (error?.name === 'TokenExpiredError') {
      return { ok: false, code: 'TOKEN_EXPIRED', message: 'Access token expired' };
    }
    return { ok: false, code: 'TOKEN_INVALID', message: 'Invalid token' };
  }
};

/** @deprecated Prefer verifyAccessTokenDetailed — returns payload or null */
export const verifyToken = (token, secret = accessSecret()) => {
  const result = verifyAccessTokenDetailed(token, secret);
  return result.ok ? result.payload : null;
};

export const signRefreshToken = (payload) => {
  const secret = refreshSecret();
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is required');
  }
  return jwt.sign(payload, secret, {
    expiresIn: env.JWT_REFRESH_EXPIRES || env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  });
};

export const verifyRefreshToken = (token) => {
  try {
    const secret = refreshSecret();
    if (!token || !secret) return null;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
};
