import { verifyAccessTokenDetailed } from '../utils/jwt.js';
import { sendError } from '../utils/response.js';
import { prisma, setTenantAuditUser, runWithTenantContext, getActiveTenantDbName } from '../config/prisma.js';
import { sessionService } from '../modules/session/session.service.js';
import { env } from '../config/env.js';
import { isValidTenantDbName } from '../utils/tenantDbName.util.js';
import { authMemoGet, authMemoSet } from '../utils/localAuthMemo.js';
import { buildPermissionCacheKey } from './permission.middleware.js';

/**
 * Phase 2 auth: access JWT must be signed and unexpired.
 * Expired / forged tokens are rejected (no jwt.decode bypass).
 * When single-session is on, sessionId must be active (except HQ impersonation).
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // Public client-review, RSVP, and job apply links must work without a JWT (also hit by
    // routers mounted at /api/v1 before route-specific handlers, e.g. addCandidate).
    const path = String(req.path || '');
    const url = String(req.originalUrl || '');
    if (
      path.startsWith('/public/review/') ||
      path.startsWith('/public/rsvp/') ||
      path.includes('/jobs/public/apply/') ||
      path.includes('/leads/public/form/') ||
      url.includes('/interviews/public/review/') ||
      url.includes('/interviews/public/rsvp/') ||
      url.includes('/jobs/public/apply/') ||
      url.includes('/leads/public/form/')
    ) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'No token provided', { code: 'NO_TOKEN' });
    }

    const token = authHeader.substring(7);
    const verified = verifyAccessTokenDetailed(token);
    if (!verified.ok) {
      return sendError(res, 401, verified.message, { code: verified.code });
    }

    const tokenPayload = verified.payload;
    const userId = tokenPayload.userId;

    const ensureTenantThenLookup = async () => {
      // Uploads that omit x-tenant-db-name still carry tenantDbName in the JWT.
      // Without ALS, prisma falls back to the default DB → "User not found or inactive".
      if (!getActiveTenantDbName()) {
        const fromToken = String(tokenPayload?.tenantDbName || '').trim();
        const fromHeader = String(req.headers['x-tenant-db-name'] || '').trim();
        const tenantDbName = fromToken || fromHeader;
        if (tenantDbName && isValidTenantDbName(tenantDbName)) {
          return runWithTenantContext(tenantDbName, lookupUser);
        }
      }
      return lookupUser();
    };

    const lookupUser = async () => {
      // Opt-in in-process memo (AUTH_LOCAL_CACHE_TTL_SEC). Only ACTIVE users are ever stored, and
      // it is dropped by the same events that clear the permission cache (role / team edits).
      const userMemoKey = `${buildPermissionCacheKey(userId)}|user`;
      let user = authMemoGet(userMemoKey);
      if (!user) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            systemRole: { select: { roleName: true } },
          },
        });
        if (user?.isActive) authMemoSet(userMemoKey, user);
      }

      if (!user || !user.isActive) {
        return sendError(res, 401, 'User not found or inactive', { code: 'USER_INACTIVE' });
      }

      const isHqImpersonation = Boolean(tokenPayload?.hqImpersonation);
      const sessionsOn =
        env.SINGLE_ACTIVE_SESSION_ENABLED !== false &&
        env.SINGLE_ACTIVE_SESSION_ENABLED !== 'false';

      // Enforce live session for normal CRM logins (not HQ impersonation).
      if (sessionsOn && !isHqImpersonation) {
        if (!tokenPayload?.sessionId) {
          return sendError(res, 401, 'Session required. Please log in again.', {
            code: 'SESSION_REQUIRED',
          });
        }
        // Only a PASSED check is memoized; logout / new login clears it via deleteCache(active_session:<id>).
        const sessionMemoKey = `active_session:${userId}|${tokenPayload.sessionId}`;
        if (!authMemoGet(sessionMemoKey)) {
          const sessionCheck = await sessionService.validateSessionFromToken(tokenPayload);
          if (!sessionCheck.ok) {
            return sendError(res, 401, sessionCheck.message, { code: sessionCheck.code });
          }
          authMemoSet(sessionMemoKey, true);
        }
      }

      req.user = {
        ...user,
        orgId: tokenPayload?.orgId || tokenPayload?.tenantDbName || null,
        tenantDbName: tokenPayload?.tenantDbName || null,
        sessionId: tokenPayload?.sessionId || null,
        hqTeamMemberId: tokenPayload?.hqTeamMemberId || null,
        hqPermissionIds: Array.isArray(tokenPayload?.hqPermissionIds)
          ? tokenPayload.hqPermissionIds.map(String)
          : null,
        isHqTeamMember: Boolean(tokenPayload?.hqTeamMemberId),
        hqImpersonation: isHqImpersonation,
        tenantImpersonation: Boolean(tokenPayload?.tenantImpersonation),
        impersonatedByUserId: tokenPayload?.impersonatedByUserId
          ? String(tokenPayload.impersonatedByUserId)
          : null,
      };
      setTenantAuditUser(user);
      return next();
    };

    return ensureTenantThenLookup();
  } catch (error) {
    sendError(res, 401, 'Authentication failed', error);
  }
};
