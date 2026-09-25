import { prisma } from '../config/prisma.js';
import { parseDeviceFromUserAgent } from './deviceFingerprint.js';

export function formatAccessDevice(userAgent = '') {
  const raw = String(userAgent || '').trim();
  if (!raw) return '';
  const parsed = parseDeviceFromUserAgent(raw);
  const known =
    parsed.browser !== 'Unknown browser' || parsed.operatingSystem !== 'Unknown OS';
  if (!known) return raw.slice(0, 160);
  return `${parsed.browser} · ${parsed.operatingSystem}`;
}

/**
 * Best-effort audit row for auth/session events (login, logout).
 */
export async function logUserSessionActivity(userId, action, metadata = null) {
  if (!userId || !action) return;
  try {
    await prisma.userActivity.create({
      data: {
        userId: String(userId),
        action: String(action),
        module: 'Auth',
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      },
    });
  } catch (error) {
    console.warn('[userSessionAudit]', error?.message || error);
  }
}

/**
 * Records a password change in the current tenant database.
 * Stores IP and a short device label. Never stores the password.
 */
export async function recordPasswordChangeAudit({
  userId,
  loginId,
  email,
  ipAddress,
  device,
  source,
} = {}) {
  try {
    const rawDevice = String(device || '').trim();
    await prisma.sessionAuditLog.create({
      data: {
        userId: userId ? String(userId) : null,
        action: 'PASSWORD_CHANGED',
        deviceInfo: formatAccessDevice(rawDevice) || rawDevice || null,
        ipAddress: String(ipAddress || '').trim() || null,
        metadata: {
          loginId: String(loginId || '').trim() || null,
          email: String(email || '').trim().toLowerCase() || null,
          source: String(source || 'password_change').trim() || 'password_change',
          userAgent: rawDevice || null,
        },
      },
    });
  } catch (error) {
    console.warn('[userSessionAudit] password change', error?.message || error);
  }
}
