import jwt from 'jsonwebtoken';
import { verifyToken } from '../utils/jwt.js';
import { prisma, runWithTenantContext } from '../config/prisma.js';
import { clearBulkCopyOrdinalSession } from '../services/bulkCvDuplicate.service.js';
import { completeBulkCvDuplicateDecision } from './bulkCvDuplicateWait.registry.js';

let ioSingleton = null;

export function getBulkCvIo() {
  return ioSingleton;
}

/**
 * Same tenant resolution as `tenant-context.middleware.js`, so Prisma inside
 * Socket.IO runs against the workspace DB (not the default client).
 */
function parseSocketHandshakeAuth(socket) {
  const raw = socket.handshake.auth?.token || socket.handshake.query?.token;
  const token = String(raw || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!token) return { userId: null, tenantDbName: '' };

  let payload = verifyToken(token);
  if (!payload || typeof payload !== 'object') {
    try {
      payload = jwt.decode(token);
    } catch {
      payload = null;
    }
  }
  if (!payload || typeof payload !== 'object') {
    return { userId: null, tenantDbName: '' };
  }

  const userId = payload.userId ? String(payload.userId) : null;
  const tokenTenantDbName = String(payload.tenantDbName || '').trim();
  const authTenantDbName = String(socket.handshake.auth?.tenantDbName || '').trim();
  const headerTenantDbName = String(
    socket.handshake.headers['x-tenant-db-name'] ||
      socket.handshake.headers['X-Tenant-Db-Name'] ||
      ''
  ).trim();
  const tenantDbName = tokenTenantDbName || authTenantDbName || headerTenantDbName;

  return { userId, tenantDbName };
}

/**
 * @param {import('socket.io').Server} io
 */
export function attachBulkCvSocket(io) {
  ioSingleton = io;

  io.use(async (socket, next) => {
    try {
      const { userId, tenantDbName } = parseSocketHandshakeAuth(socket);
      if (!userId) return next(new Error('Unauthorized'));

      await runWithTenantContext(tenantDbName, async () => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, isActive: true },
        });
        if (!user?.isActive) throw new Error('Unauthorized');
        socket.userId = userId;
      });

      return next();
    } catch (e) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('bulk_cv_join', ({ sessionId } = {}) => {
      if (!sessionId || typeof sessionId !== 'string') return;
      clearBulkCopyOrdinalSession(socket.userId, sessionId);
      const room = `bulk_cv:${socket.userId}:${sessionId}`;
      socket.join(room);
      socket.data.bulkCvSessionId = sessionId;
      console.log('[bulk-cv] socket joined room', room);
    });

    socket.on('duplicate_decision', (payload = {}) => {
      const { sessionId, fileIndex, decision } = payload;
      if (!sessionId || fileIndex === undefined || fileIndex === null) return;
      completeBulkCvDuplicateDecision(socket.userId, sessionId, fileIndex, decision);
    });
  });
}

export function emitBulkCvDuplicateFound(userId, sessionId, payload) {
  const io = ioSingleton;
  if (!io) {
    console.error('[bulk-cv] emit duplicate_found: Socket.IO not initialized');
    return;
  }
  const room = `bulk_cv:${userId}:${sessionId}`;
  io.to(room).emit('duplicate_found', payload);
}
