import crypto from 'crypto';

export function hashToken(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
