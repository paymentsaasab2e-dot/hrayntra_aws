import { runWithTenantContext } from '../config/prisma.js';
import { verifyToken } from '../utils/jwt.js';
import jwt from 'jsonwebtoken';

function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

export function resolvePublicApplyTenant(req) {
  return String(
    req.query?.tenantDbName ||
      req.query?.tenant ||
      req.body?.tenantDbName ||
      req.headers['x-tenant-db-name'] ||
      ''
  ).trim();
}

/** Re-apply tenant after multer on public apply submit (ALS can be lost across multer async). */
export function publicApplyTenantMiddleware(req, res, next) {
  const tenantDbName = resolvePublicApplyTenant(req);
  if (!tenantDbName) return next();
  return runWithTenantContext(tenantDbName, () => next());
}

export function tenantContextMiddleware(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  const payload = token ? (verifyToken(token) || jwt.decode(token)) : null;
  const tokenTenantDbName = String(payload?.tenantDbName || '').trim();
  const headerTenantDbName = String(req.headers['x-tenant-db-name'] || '').trim();
  const queryTenantDbName = String(
    req.query?.tenantDbName || req.query?.tenant || ''
  ).trim();
  const tenantDbName = tokenTenantDbName || headerTenantDbName || queryTenantDbName;

  return runWithTenantContext(tenantDbName, () => next());
}
