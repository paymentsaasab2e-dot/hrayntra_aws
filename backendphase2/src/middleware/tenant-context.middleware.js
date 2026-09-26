import jwt from 'jsonwebtoken';
import { runWithTenantContext } from '../config/prisma.js';
import { verifyToken } from '../utils/jwt.js';
import { isValidTenantDbName } from '../utils/tenantDbName.util.js';

function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

/** Prefer verified JWT; fall back to decode so tenant ALS matches authMiddleware user lookup. */
function resolveTokenPayload(token) {
  if (!token) return null;
  const verified = verifyToken(token);
  if (verified && typeof verified === 'object') return verified;
  try {
    const decoded = jwt.decode(token);
    return decoded && typeof decoded === 'object' ? decoded : null;
  } catch {
    return null;
  }
}

export function resolvePublicApplyTenant(req) {
  const tenant = String(
    req.query?.tenantDbName ||
      req.query?.tenant ||
      req.body?.tenantDbName ||
      req.headers['x-tenant-db-name'] ||
      ''
  ).trim();
  return isValidTenantDbName(tenant) ? tenant : '';
}

export function publicApplyTenantMiddleware(req, res, next) {
  const tenantDbName = resolvePublicApplyTenant(req);
  if (!tenantDbName) return next();
  return runWithTenantContext(tenantDbName, () => next());
}

export function authenticatedTenantAfterMulter(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  const payload = resolveTokenPayload(token);
  const tokenTenant = String(payload?.tenantDbName || '').trim();
  const headerTenant = String(req.headers['x-tenant-db-name'] || '').trim();
  if (tokenTenant && headerTenant && tokenTenant !== headerTenant) {
    return res.status(403).json({
      success: false,
      message: 'Tenant header does not match authenticated tenant',
      code: 'TENANT_MISMATCH',
    });
  }
  const tenantDbName = tokenTenant || headerTenant;
  if (tenantDbName && !isValidTenantDbName(tenantDbName)) {
    return res.status(400).json({ success: false, message: 'Invalid tenant' });
  }
  return runWithTenantContext(tenantDbName, () => next());
}

function isLoginRequest(req) {
  if (req.method !== 'POST') return false;
  const path = String(req.originalUrl || req.path || '').split('?')[0];
  return path === '/api/v1/auth/login' || path.endsWith('/auth/login');
}

export function tenantContextMiddleware(req, res, next) {
  // Sign-in always looks the account up in the database. The workspace name
  // saved in the browser is for later requests, not for choosing the login database.
  if (isLoginRequest(req)) {
    return runWithTenantContext('', () => next());
  }

  const token = extractBearerToken(req.headers.authorization);
  const payload = resolveTokenPayload(token);

  const tokenTenantDbName = String(payload?.tenantDbName || '').trim();
  const headerTenantDbName = String(req.headers['x-tenant-db-name'] || '').trim();
  const queryTenantDbName = String(
    req.query?.tenantDbName || req.query?.tenant || ''
  ).trim();
  const bodyTenantDbName = String(req.body?.tenantDbName || '').trim();

  if (tokenTenantDbName) {
    const spoof =
      (headerTenantDbName && headerTenantDbName !== tokenTenantDbName) ||
      (queryTenantDbName && queryTenantDbName !== tokenTenantDbName) ||
      (bodyTenantDbName && bodyTenantDbName !== tokenTenantDbName);
    if (spoof) {
      return res.status(403).json({
        success: false,
        message: 'Tenant override rejected for authenticated request',
        code: 'TENANT_MISMATCH',
      });
    }
    if (!isValidTenantDbName(tokenTenantDbName)) {
      return res.status(400).json({ success: false, message: 'Invalid tenant' });
    }
    return runWithTenantContext(tokenTenantDbName, () => next());
  }

  const tenantDbName = headerTenantDbName || queryTenantDbName || bodyTenantDbName;
  if (tenantDbName && !isValidTenantDbName(tenantDbName)) {
    return res.status(400).json({ success: false, message: 'Invalid tenant' });
  }
  return runWithTenantContext(tenantDbName || '', () => next());
}

export { isValidTenantDbName };
