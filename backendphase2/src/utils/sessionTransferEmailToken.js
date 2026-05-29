import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const TOKEN_TYPE = 'session_transfer_email';

function secret() {
  return (
    process.env.SESSION_TRANSFER_EMAIL_SECRET ||
    env.JWT_ACCESS_SECRET ||
    env.JWT_SECRET ||
    'session-transfer-email-dev'
  );
}

/**
 * Signed link token for approve/reject actions from email (no login required).
 */
export function signSessionTransferEmailToken({ requestId, userId, action, expiresAt, tenantDbName }) {
  const expMs = new Date(expiresAt).getTime();
  const ttlSec = Math.max(60, Math.floor((expMs - Date.now()) / 1000));
  return jwt.sign(
    {
      requestId,
      userId,
      action,
      tenantDbName: String(tenantDbName || '').trim() || undefined,
      typ: TOKEN_TYPE,
    },
    secret(),
    { expiresIn: ttlSec },
  );
}

export function verifySessionTransferEmailToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, secret());
    if (payload?.typ !== TOKEN_TYPE) return null;
    if (!payload.requestId || !payload.userId || !payload.action) return null;
    if (payload.action !== 'approve' && payload.action !== 'reject') return null;
    return payload;
  } catch {
    return null;
  }
}
