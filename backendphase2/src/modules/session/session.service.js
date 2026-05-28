import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { signToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { hashToken } from '../../utils/tokenHash.js';
import { formatDeviceLabel } from '../../utils/deviceFingerprint.js';
import { setCache, deleteCache, getCache } from '../../cache/redis.js';
import {
  emitSessionTransferRequest,
  emitSessionRevoked,
  emitSessionTransferResolved,
} from '../../socket/sessionSocket.js';

const SESSION_STATUS_ACTIVE = 'ACTIVE';

function isEnabled() {
  return env.SINGLE_ACTIVE_SESSION_ENABLED !== false && env.SINGLE_ACTIVE_SESSION_ENABLED !== 'false';
}

function inactivityMs() {
  return Number(env.SESSION_INACTIVITY_MS || 5 * 60 * 1000);
}

function transferTtlMs() {
  return Number(env.SESSION_TRANSFER_TTL_MS || 5 * 60 * 1000);
}

function warningBeforeMs() {
  return Number(env.SESSION_INACTIVITY_WARNING_MS || 60 * 1000);
}

function redisSessionKey(userId) {
  return `active_session:${userId}`;
}

async function audit(userId, action, deviceMeta = {}, metadata = null) {
  try {
    await prisma.sessionAuditLog.create({
      data: {
        userId: userId || null,
        action,
        deviceInfo: deviceMeta.userAgent || formatDeviceLabel(deviceMeta),
        ipAddress: deviceMeta.ipAddress || null,
        metadata: metadata || undefined,
      },
    });
  } catch (err) {
    console.warn('[session] audit log failed', err?.message);
  }
}

function publicSessionView(session) {
  if (!session) return null;
  return {
    sessionId: session.sessionId,
    browserInfo: session.browserInfo,
    operatingSystem: session.operatingSystem,
    deviceType: session.deviceType,
    ipAddress: session.ipAddress,
    location: session.location,
    loginTime: session.loginTime,
    lastActivity: session.lastActivity,
    deviceLabel: formatDeviceLabel(session),
  };
}

function isSessionFresh(row) {
  if (!row) return false;
  const last = new Date(row.lastActivity).getTime();
  if (!Number.isFinite(last)) return false;
  return Date.now() - last <= inactivityMs();
}

/** A session blocks duplicate login only if it is in the inactivity window and still tied to the user's refresh token. */
async function evaluateSessionBlockingState(row) {
  if (!row || row.sessionStatus !== SESSION_STATUS_ACTIVE) return 'inactive';

  if (!isSessionFresh(row)) return 'inactivity_expired';

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { refreshToken: true },
  });

  if (!user?.refreshToken) return 'logged_out';

  if (row.refreshTokenHash) {
    const currentHash = hashToken(user.refreshToken);
    if (row.refreshTokenHash !== currentHash) return 'token_rotated';
  }

  return 'blocking';
}

async function expireSessionIfNotBlocking(row) {
  const state = await evaluateSessionBlockingState(row);
  if (state === 'blocking') return false;
  const reason =
    state === 'logged_out' || state === 'token_rotated'
      ? 'LOGOUT'
      : 'INACTIVITY_TIMEOUT';
  await expireSession(row, reason);
  return true;
}

/**
 * Remove ghost ACTIVE rows left after logout, token rotation, or inactivity timeout.
 */
export async function reconcileAbandonedSessions(userId, identity = {}) {
  const userIds = new Set();
  if (userId) userIds.add(userId);

  const email = String(identity.email || '').trim().toLowerCase();
  if (email) {
    const users = await prisma.user.findMany({
      where: { email },
      select: { id: true },
    });
    users.forEach((u) => userIds.add(u.id));
  }

  const loginId = String(identity.loginId || '').trim();
  if (loginId) {
    const credential = await prisma.userCredential.findUnique({
      where: { loginId },
      select: { userId: true },
    });
    if (credential?.userId) userIds.add(credential.userId);
  }

  for (const uid of userIds) {
    const rows = await prisma.activeSession.findMany({
      where: { userId: uid, sessionStatus: SESSION_STATUS_ACTIVE },
    });
    for (const row of rows) {
      await expireSessionIfNotBlocking(row);
    }
    await deleteCache(redisSessionKey(uid));
  }
}

async function findActiveSessionRowForUserId(userId) {
  if (!userId) return null;

  const rows = await prisma.activeSession.findMany({
    where: { userId, sessionStatus: SESSION_STATUS_ACTIVE },
    orderBy: { lastActivity: 'desc' },
  });

  for (const row of rows) {
    const state = await evaluateSessionBlockingState(row);
    if (state === 'blocking') return row;
    await expireSessionIfNotBlocking(row);
  }

  await deleteCache(redisSessionKey(userId));
  return null;
}

/**
 * Find any active session for this account (by user id, email, or login id).
 * Needed when login paths differ (email vs loginId) or tenant context was missing on a prior attempt.
 */
export async function findActiveSessionForUser(userId, identity = {}) {
  const direct = await findActiveSessionRowForUserId(userId);
  if (direct) return direct;

  const email = String(identity.email || '').trim().toLowerCase();
  if (email) {
    const byEmailRows = await prisma.activeSession.findMany({
      where: {
        sessionStatus: SESSION_STATUS_ACTIVE,
        user: { email },
      },
      orderBy: { lastActivity: 'desc' },
    });
    for (const row of byEmailRows) {
      if ((await evaluateSessionBlockingState(row)) === 'blocking') return row;
      await expireSessionIfNotBlocking(row);
    }
  }

  const loginId = String(identity.loginId || '').trim();
  if (loginId) {
    const credential = await prisma.userCredential.findUnique({
      where: { loginId },
      select: { userId: true },
    });
    if (credential?.userId && credential.userId !== userId) {
      const byLogin = await findActiveSessionRowForUserId(credential.userId);
      if (byLogin) return byLogin;
    }
  }

  return null;
}

async function cacheActiveSession(userId, sessionId) {
  await setCache(redisSessionKey(userId), JSON.stringify({ sessionId }), Math.ceil(inactivityMs() / 1000) + 60);
}

export async function expireSession(sessionRow, reason = 'EXPIRED') {
  if (!sessionRow?.id) return;
  await prisma.activeSession.update({
    where: { id: sessionRow.id },
    data: { sessionStatus: reason === 'REVOKED' ? 'REVOKED' : 'EXPIRED' },
  });
  await deleteCache(redisSessionKey(sessionRow.userId));
  await audit(sessionRow.userId, reason, {}, { sessionId: sessionRow.sessionId });
  emitSessionRevoked(sessionRow.userId, { reason, sessionId: sessionRow.sessionId });
}

export async function revokeAllSessionsForUser(userId, reason = 'REVOKED') {
  const rows = await prisma.activeSession.findMany({
    where: { userId, sessionStatus: SESSION_STATUS_ACTIVE },
  });
  for (const row of rows) {
    await expireSession(row, reason);
  }
  await deleteCache(redisSessionKey(userId));
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
}

/**
 * After credentials validated: either duplicate-session payload or issued tokens.
 */
export async function gateLoginOrIssueTokens({
  userId,
  tokenPayload,
  refreshPayload,
  deviceMeta,
  identity = {},
}) {
  if (!isEnabled()) {
    const accessToken = signToken(tokenPayload);
    const refreshToken = signRefreshToken(refreshPayload);
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken, lastLogin: new Date() },
    });
    return { accessToken, refreshToken, sessionId: null };
  }

  const identityPayload = {
    email: identity.email || tokenPayload?.email,
    loginId: identity.loginId,
  };

  await reconcileAbandonedSessions(userId, identityPayload);

  const active = await findActiveSessionForUser(userId, identityPayload);
  if (active) {
    await audit(userId, 'DUPLICATE_LOGIN_ATTEMPT', deviceMeta, { activeSessionId: active.sessionId });
    return {
      duplicateSession: true,
      activeSession: publicSessionView(active),
    };
  }

  return createSessionAndTokens({ userId, tokenPayload, refreshPayload, deviceMeta });
}

export async function createSessionAndTokens({ userId, tokenPayload, refreshPayload, deviceMeta }) {
  const sessionId = crypto.randomUUID();
  const accessToken = signToken({ ...tokenPayload, sessionId });
  const refreshToken = signRefreshToken({ ...refreshPayload, sessionId });

  await revokeAllSessionsForUser(userId, 'REPLACED');

  await prisma.activeSession.create({
    data: {
      userId,
      sessionId,
      jwtTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      deviceId: deviceMeta.deviceId,
      browserInfo: deviceMeta.browserInfo,
      operatingSystem: deviceMeta.operatingSystem,
      deviceType: deviceMeta.deviceType,
      ipAddress: deviceMeta.ipAddress,
      location: deviceMeta.location,
      sessionStatus: SESSION_STATUS_ACTIVE,
      lastActivity: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken, lastLogin: new Date() },
  });

  await cacheActiveSession(userId, sessionId);
  await audit(userId, 'LOGIN_SUCCESS', deviceMeta, { sessionId });

  return { accessToken, refreshToken, sessionId };
}

export async function validateSessionFromToken(decoded) {
  if (!isEnabled()) return { ok: true };
  const sessionId = decoded?.sessionId;
  const userId = decoded?.userId;
  if (!sessionId || !userId) {
    return { ok: false, code: 'SESSION_INVALID', message: 'Session id missing from token' };
  }

  const row = await prisma.activeSession.findFirst({
    where: { userId, sessionId, sessionStatus: SESSION_STATUS_ACTIVE },
  });
  if (!row) {
    return { ok: false, code: 'SESSION_SUPERSEDED', message: 'Session is no longer active' };
  }
  if (Date.now() - new Date(row.lastActivity).getTime() > inactivityMs()) {
    await expireSession(row, 'INACTIVITY_TIMEOUT');
    return { ok: false, code: 'SESSION_EXPIRED', message: 'Session expired due to inactivity' };
  }
  return { ok: true, session: row };
}

export async function heartbeat(userId, sessionId) {
  const row = await prisma.activeSession.findFirst({
    where: { userId, sessionId, sessionStatus: SESSION_STATUS_ACTIVE },
  });
  if (!row) {
    return { ok: false, code: 'SESSION_EXPIRED' };
  }
  const now = new Date();
  await prisma.activeSession.update({
    where: { id: row.id },
    data: { lastActivity: now },
  });
  await cacheActiveSession(userId, sessionId);

  const inactiveMs = Date.now() - new Date(row.lastActivity).getTime();
  const warn = inactiveMs >= inactivityMs() - warningBeforeMs();

  return {
    ok: true,
    lastActivity: now.toISOString(),
    inactivityWarning: warn,
    expiresInMs: Math.max(0, inactivityMs() - inactiveMs),
  };
}

export async function logoutSession(userId, sessionId) {
  if (!isEnabled()) {
    await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
    return;
  }
  await revokeAllSessionsForUser(userId, 'LOGOUT');
  await audit(userId, 'LOGOUT', sessionId ? { sessionId } : {});
}

export async function refreshWithSession(refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded?.userId) throw new Error('Invalid refresh token');

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || user.refreshToken !== refreshToken) {
    throw new Error('Invalid refresh token');
  }

  if (isEnabled() && decoded.sessionId) {
    const check = await validateSessionFromToken(decoded);
    if (!check.ok) {
      const err = new Error(check.message);
      err.code = check.code;
      throw err;
    }
  }

  const tenantDbName = decoded.tenantDbName;
  const sessionId = decoded.sessionId || crypto.randomUUID();
  const accessToken = signToken({
    userId: user.id,
    email: user.email,
    tenantDbName: tenantDbName || undefined,
    sessionId: isEnabled() ? sessionId : undefined,
  });
  const newRefreshToken = signRefreshToken({
    userId: user.id,
    tenantDbName: tenantDbName || undefined,
    sessionId: isEnabled() ? sessionId : undefined,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: newRefreshToken },
  });

  if (isEnabled() && decoded.sessionId) {
    await prisma.activeSession.updateMany({
      where: { userId: user.id, sessionId: decoded.sessionId },
      data: {
        jwtTokenHash: hashToken(accessToken),
        refreshTokenHash: hashToken(newRefreshToken),
        lastActivity: new Date(),
      },
    });
  }

  return { accessToken, refreshToken: newRefreshToken, tenantDbName };
}

async function validateCredentials(loginIdentifier, password) {
  // Internal lightweight credential check only — avoid recursion via gate.
  const isLoginId = loginIdentifier.includes('@saasa') || !loginIdentifier.includes('@');
  if (isLoginId) {
    const credential = await prisma.userCredential.findUnique({
      where: { loginId: loginIdentifier },
      include: { user: true },
    });
    if (!credential?.user) throw new Error('Invalid credentials');
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.default.compare(password, credential.hashedPassword);
    if (!valid) throw new Error('Invalid credentials');
    return credential.user;
  }
  const user = await prisma.user.findUnique({
    where: { email: loginIdentifier },
    include: { credential: true },
  });
  if (!user) throw new Error('Invalid credentials');
  const bcrypt = await import('bcryptjs');
  const hash = user.credential?.hashedPassword || user.passwordHash;
  if (!hash) throw new Error('Invalid credentials');
  const valid = await bcrypt.default.compare(password, hash);
  if (!valid) throw new Error('Invalid credentials');
  return user;
}

export async function requestSessionTransfer({ loginIdentifier, password, deviceMeta }) {
  const user = await validateCredentials(loginIdentifier, password);
  const active = await findActiveSessionForUser(user.id);
  if (!active) {
    throw new Error('No active session to transfer');
  }

  const requestId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + transferTtlMs());

  await prisma.sessionTransferRequest.updateMany({
    where: { userId: user.id, status: 'PENDING' },
    data: { status: 'CANCELLED', resolvedAt: new Date() },
  });

  await prisma.sessionTransferRequest.create({
    data: {
      userId: user.id,
      requestId,
      status: 'PENDING',
      challengerDevice: deviceMeta,
      challengerIp: deviceMeta.ipAddress,
      expiresAt,
    },
  });

  await audit(user.id, 'SESSION_TRANSFER_REQUESTED', deviceMeta, { requestId });

  emitSessionTransferRequest(user.id, {
    requestId,
    challenger: publicSessionView({
      browserInfo: deviceMeta.browserInfo,
      operatingSystem: deviceMeta.operatingSystem,
      deviceType: deviceMeta.deviceType,
      ipAddress: deviceMeta.ipAddress,
      location: deviceMeta.location,
      loginTime: new Date(),
      lastActivity: new Date(),
    }),
    expiresAt: expiresAt.toISOString(),
  });

  return { requestId, status: 'PENDING', expiresAt };
}

export async function getTransferStatus(requestId) {
  const row = await prisma.sessionTransferRequest.findUnique({ where: { requestId } });
  if (!row) return { status: 'NOT_FOUND' };
  if (row.status === 'PENDING' && new Date() > row.expiresAt) {
    await prisma.sessionTransferRequest.update({
      where: { id: row.id },
      data: { status: 'EXPIRED', resolvedAt: new Date() },
    });
    return { status: 'EXPIRED' };
  }
  return { status: row.status, userId: row.userId };
}

export async function approveSessionTransfer(userId, requestId) {
  const transfer = await prisma.sessionTransferRequest.findUnique({ where: { requestId } });
  if (!transfer || transfer.userId !== userId) throw new Error('Transfer request not found');
  if (transfer.status !== 'PENDING') throw new Error('Transfer request is not pending');
  if (new Date() > transfer.expiresAt) {
    await prisma.sessionTransferRequest.update({
      where: { id: transfer.id },
      data: { status: 'EXPIRED', resolvedAt: new Date() },
    });
    throw new Error('Transfer request expired');
  }

  const active = await findActiveSessionForUser(userId);
  if (active) await expireSession(active, 'TRANSFER_APPROVED');

  await prisma.sessionTransferRequest.update({
    where: { id: transfer.id },
    data: { status: 'APPROVED', resolvedAt: new Date() },
  });

  await audit(userId, 'SESSION_TRANSFER_APPROVED', {}, { requestId });
  emitSessionTransferResolved(requestId, { status: 'APPROVED' });
  emitSessionRevoked(userId, { reason: 'TRANSFER_APPROVED', requestId });

  return { approved: true };
}

export async function rejectSessionTransfer(userId, requestId) {
  const transfer = await prisma.sessionTransferRequest.findUnique({ where: { requestId } });
  if (!transfer || transfer.userId !== userId) throw new Error('Transfer request not found');
  if (transfer.status !== 'PENDING') throw new Error('Transfer request is not pending');

  await prisma.sessionTransferRequest.update({
    where: { id: transfer.id },
    data: { status: 'REJECTED', resolvedAt: new Date() },
  });

  await audit(userId, 'SESSION_TRANSFER_REJECTED', {}, { requestId });
  emitSessionTransferResolved(requestId, {
    status: 'REJECTED',
    message: 'Login request rejected by active session.',
  });

  return { rejected: true };
}

/**
 * After transfer approved, challenger completes login with stored requestId.
 */
export async function completeTransferLogin({ requestId, loginIdentifier, password, tokenPayload, refreshPayload, deviceMeta }) {
  const transfer = await prisma.sessionTransferRequest.findUnique({ where: { requestId } });
  if (!transfer || transfer.status !== 'APPROVED') {
    throw new Error('Transfer not approved');
  }
  const user = await validateCredentials(loginIdentifier, password);
  if (user.id !== transfer.userId) throw new Error('Invalid credentials');

  const userWithRole = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      systemRole: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  });

  const permissions = userWithRole?.systemRole
    ? userWithRole.systemRole.rolePermissions.map((rp) => rp.permission.permissionName)
    : [];

  const tokens = await createSessionAndTokens({
    userId: user.id,
    tokenPayload: {
      userId: user.id,
      email: user.email,
      roleId: userWithRole?.systemRole?.id,
      roleName: userWithRole?.systemRole?.roleName,
      permissions,
      ...(tokenPayload || {}),
    },
    refreshPayload: { userId: user.id, ...(refreshPayload || {}) },
    deviceMeta,
  });

  return tokens;
}

export async function runInactivityCleanup() {
  if (!isEnabled()) return { expired: 0 };
  const cutoff = new Date(Date.now() - inactivityMs());
  const stale = await prisma.activeSession.findMany({
    where: { sessionStatus: SESSION_STATUS_ACTIVE, lastActivity: { lt: cutoff } },
    take: 200,
  });
  for (const row of stale) {
    await expireSession(row, 'INACTIVITY_TIMEOUT');
  }
  return { expired: stale.length };
}

export async function expireStaleTransfers() {
  const now = new Date();
  const pending = await prisma.sessionTransferRequest.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    take: 100,
  });
  for (const row of pending) {
    await prisma.sessionTransferRequest.update({
      where: { id: row.id },
      data: { status: 'EXPIRED', resolvedAt: now },
    });
    emitSessionTransferResolved(row.requestId, { status: 'EXPIRED' });
  }
  return { expired: pending.length };
}

export const sessionService = {
  gateLoginOrIssueTokens,
  findActiveSessionForUser,
  validateSessionFromToken,
  heartbeat,
  logoutSession,
  refreshWithSession,
  requestSessionTransfer,
  getTransferStatus,
  approveSessionTransfer,
  rejectSessionTransfer,
  completeTransferLogin,
  runInactivityCleanup,
  expireStaleTransfers,
  publicSessionView,
  inactivityMs,
  warningBeforeMs,
};
