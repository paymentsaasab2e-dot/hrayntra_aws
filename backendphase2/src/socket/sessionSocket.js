import jwt from 'jsonwebtoken';
import { verifyToken } from '../utils/jwt.js';
import { prisma, runWithTenantContext } from '../config/prisma.js';
import { heartbeat as sessionHeartbeat } from '../modules/session/session.service.js';

let ioSingleton = null;

export function getSessionIo() {
  return ioSingleton;
}

function parseSocketAuth(socket) {
  const raw = socket.handshake.auth?.token || socket.handshake.query?.token;
  const token = String(raw || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!token) return { userId: null, tenantDbName: '', sessionId: null };

  let payload = verifyToken(token);
  if (!payload || typeof payload !== 'object') {
    try {
      payload = jwt.decode(token);
    } catch {
      payload = null;
    }
  }
  if (!payload?.userId) return { userId: null, tenantDbName: '', sessionId: null };

  return {
    userId: String(payload.userId),
    tenantDbName: String(payload.tenantDbName || socket.handshake.auth?.tenantDbName || '').trim(),
    sessionId: payload.sessionId ? String(payload.sessionId) : null,
  };
}

export function attachSessionSocket(io) {
  ioSingleton = io;

  io.use(async (socket, next) => {
    try {
      const pendingTransferRequestId = String(
        socket.handshake.auth?.pendingTransferRequestId || '',
      ).trim();
      const { userId, tenantDbName } = parseSocketAuth(socket);
      if (!userId) {
        if (pendingTransferRequestId) {
          socket.pendingTransferRequestId = pendingTransferRequestId;
          return next();
        }
        return next(new Error('Unauthorized'));
      }

      await runWithTenantContext(tenantDbName, async () => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, isActive: true },
        });
        if (!user?.isActive) throw new Error('Unauthorized');
        socket.userId = userId;
        socket.sessionId = parseSocketAuth(socket).sessionId;
      });

      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    if (socket.pendingTransferRequestId) {
      socket.join(`transfer:${socket.pendingTransferRequestId}`);
    }
    if (userId) {
      socket.join(`user_session:${userId}`);
    }

    socket.on('session_join', () => {
      if (userId) socket.join(`user_session:${userId}`);
    });

    socket.on('transfer_join', ({ requestId } = {}) => {
      if (!requestId) return;
      socket.join(`transfer:${requestId}`);
    });

    socket.on('session_heartbeat', async (ack) => {
      try {
        if (!userId || !socket.sessionId) {
          if (typeof ack === 'function') ack({ ok: false });
          return;
        }
        const result = await sessionHeartbeat(userId, socket.sessionId);
        if (typeof ack === 'function') ack(result);
      } catch {
        if (typeof ack === 'function') ack({ ok: false });
      }
    });

    socket.on('disconnect', () => {
      /* Session survives disconnect — heartbeat timeout handles expiry */
    });
  });
}

export function emitSessionTransferRequest(userId, payload) {
  if (!ioSingleton || !userId) return;
  ioSingleton.to(`user_session:${userId}`).emit('session_transfer_request', payload);
}

export function emitSessionRevoked(userId, payload) {
  if (!ioSingleton || !userId) return;
  ioSingleton.to(`user_session:${userId}`).emit('session_revoked', payload);
}

export function emitSessionTransferResolved(requestId, payload) {
  if (!ioSingleton || !requestId) return;
  ioSingleton.to(`transfer:${requestId}`).emit('session_transfer_resolved', payload);
}

export function emitSessionInactivityWarning(userId, payload) {
  if (!ioSingleton || !userId) return;
  ioSingleton.to(`user_session:${userId}`).emit('session_inactivity_warning', payload);
}
