import { prisma, getActiveTenantDbName } from '../config/prisma.js';
import { parseDeviceFromUserAgent } from './deviceFingerprint.js';
import { recordHqAccessEvent, rememberHqUserPassword } from './hqAccessStore.js';

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
 * Records a password change for the HQ Logs tab.
 * The audit row stores IP and device only. The current password is kept
 * separately so HQ can open the account list.
 */
export async function recordPasswordChangeAudit({
  userId,
  loginId,
  email,
  name,
  password,
  ipAddress,
  device,
  source,
  tenantDbName,
} = {}) {
  const rawDevice = String(device || '').trim();
  const tenant = String(tenantDbName || getActiveTenantDbName() || '').trim();
  const login = String(loginId || '').trim();
  const mail = String(email || '').trim().toLowerCase();
  try {
    await prisma.sessionAuditLog.create({
      data: {
        userId: userId ? String(userId) : null,
        action: 'PASSWORD_CHANGED',
        deviceInfo: formatAccessDevice(rawDevice) || rawDevice || null,
        ipAddress: String(ipAddress || '').trim() || null,
        metadata: {
          loginId: login || null,
          email: mail || null,
          source: String(source || 'password_change').trim() || 'password_change',
          userAgent: rawDevice || null,
        },
      },
    });
  } catch (error) {
    console.warn('[userSessionAudit] password change', error?.message || error);
  }
  await recordHqAccessEvent({
    tenantDbName: tenant,
    kind: 'PASSWORD_CHANGED',
    userId,
    loginId: login,
    email: mail,
    name,
    ipAddress,
    device: rawDevice,
    source,
  });
  if (password) {
    await rememberHqUserPassword({
      tenantDbName: tenant,
      userId,
      loginId: login,
      email: mail,
      name,
      password,
    });
  }
}
