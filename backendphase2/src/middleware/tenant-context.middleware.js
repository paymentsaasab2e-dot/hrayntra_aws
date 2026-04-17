import { runWithTenantContext } from '../config/prisma.js';
import { verifyToken } from '../utils/jwt.js';
import jwt from 'jsonwebtoken';

function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

export function tenantContextMiddleware(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  const payload = token ? (verifyToken(token) || jwt.decode(token)) : null;
  const tokenTenantDbName = String(payload?.tenantDbName || '').trim();
  const headerTenantDbName = String(req.headers['x-tenant-db-name'] || '').trim();
  const tenantDbName = tokenTenantDbName || headerTenantDbName;

  return runWithTenantContext(tenantDbName, () => next());
}
