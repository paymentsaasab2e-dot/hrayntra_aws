import crypto from 'crypto';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';
import { createIpRateLimiter } from './publicRateLimit.middleware.js';

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Protect POST /hq/setup — never leave Super Admin bootstrap open on the public internet.
 *
 * Rules:
 * - Production: disabled unless HQ_SETUP_ENABLED=true AND HQ_SETUP_SECRET is set (≥16 chars).
 * - Non-production: still requires HQ_SETUP_SECRET (fail closed; no anonymous bootstrap).
 * - Caller must send header `x-hq-setup-secret: <HQ_SETUP_SECRET>`.
 */
export function requireHqSetupAccess(req, res, next) {
  const isProduction = String(env.NODE_ENV || process.env.NODE_ENV || '').toLowerCase() === 'production';
  const secret = String(env.HQ_SETUP_SECRET || '').trim();
  const enabledFlag =
    String(env.HQ_SETUP_ENABLED || '').toLowerCase() === 'true' ||
    String(env.HQ_SETUP_ENABLED || '') === '1';

  if (isProduction && !enabledFlag) {
    return sendError(res, 403, 'HQ setup is disabled in production.', {
      code: 'HQ_SETUP_DISABLED',
    });
  }

  if (!secret || secret.length < 16) {
    return sendError(res, 403, 'HQ setup is not configured. Set HQ_SETUP_SECRET to enable bootstrap.', {
      code: 'HQ_SETUP_NOT_CONFIGURED',
    });
  }

  const provided = String(
    req.headers['x-hq-setup-secret'] || req.body?.setupSecret || ''
  ).trim();

  if (!provided || !timingSafeEqualString(provided, secret)) {
    return sendError(res, 401, 'Invalid or missing HQ setup secret.', {
      code: 'HQ_SETUP_UNAUTHORIZED',
    });
  }

  return next();
}

/** Strict rate limit for bootstrap attempts. */
export const hqSetupRateLimit = createIpRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many HQ setup attempts. Please wait and try again.',
});
