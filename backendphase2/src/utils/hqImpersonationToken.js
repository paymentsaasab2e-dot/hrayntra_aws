import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const TOKEN_TYPE = 'hq_impersonation';
const DEFAULT_TTL_SEC = 5 * 60;

function secret() {
  return (
    process.env.HQ_IMPERSONATION_SECRET ||
    env.JWT_ACCESS_SECRET ||
    env.JWT_SECRET ||
    'hq-impersonation-dev'
  );
}

export function signHqImpersonationToken({
  tenantEmail,
  tenantDbName,
  hqActorEmail,
  tenantUserId,
  expiresInSec = DEFAULT_TTL_SEC,
}) {
  const email = String(tenantEmail || '').trim().toLowerCase();
  const dbName = String(tenantDbName || '').trim();
  const actor = String(hqActorEmail || '').trim().toLowerCase();
  if (!email || !dbName || !actor) {
    throw new Error('tenantEmail, tenantDbName, and hqActorEmail are required');
  }

  const ttlSec = Math.max(60, Number(expiresInSec) || DEFAULT_TTL_SEC);
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();

  const token = jwt.sign(
    {
      typ: TOKEN_TYPE,
      tenantEmail: email,
      tenantDbName: dbName,
      hqActorEmail: actor,
      tenantUserId: tenantUserId ? String(tenantUserId) : undefined,
    },
    secret(),
    { expiresIn: ttlSec },
  );

  return { token, expiresAt };
}

export function verifyHqImpersonationToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, secret());
    if (payload?.typ !== TOKEN_TYPE) return null;
    const tenantEmail = String(payload.tenantEmail || '').trim().toLowerCase();
    const tenantDbName = String(payload.tenantDbName || '').trim();
    const hqActorEmail = String(payload.hqActorEmail || '').trim().toLowerCase();
    if (!tenantEmail || !tenantDbName || !hqActorEmail) return null;
    return {
      tenantEmail,
      tenantDbName,
      hqActorEmail,
      tenantUserId: payload.tenantUserId ? String(payload.tenantUserId) : '',
    };
  } catch {
    return null;
  }
}
