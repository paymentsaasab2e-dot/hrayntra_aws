import jwt from 'jsonwebtoken';
import { authService } from './auth.service.js';
import { sessionService } from '../session/session.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { buildDeviceMeta, resolveClientIp } from '../../utils/deviceFingerprint.js';
import { runWithTenantContext } from '../../config/prisma.js';
import { verifyToken } from '../../utils/jwt.js';

export const authController = {
  async register(req, res) {
    try {
      const result = await authService.register(req.body);
      sendResponse(res, 201, 'User registered successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async login(req, res) {
    try {
      const { email, loginId, password, forceSessionTakeover } = req.body;
      const loginIdentifier = loginId || email;
      const deviceMeta = {
        ...buildDeviceMeta(req, req.body),
        forceSessionTakeover: Boolean(forceSessionTakeover),
      };
      const ipAddress = resolveClientIp(req, req.body) || deviceMeta.ipAddress || req.ip || 'Unknown';
      const userAgent = req.get('user-agent') || deviceMeta.userAgent || 'Unknown';
      const result = await authService.login(loginIdentifier, password, ipAddress, userAgent, deviceMeta);
      if (result?.duplicateSession) {
        return sendResponse(res, 200, 'Duplicate session detected', result);
      }
      sendResponse(res, 200, 'Login successful', result);
    } catch (error) {
      if (error.statusCode === 423) {
        return sendError(res, 423, error.message, error);
      }
      if (error.statusCode === 403 || error.code === 'TRIAL_EXPIRED') {
        return sendError(res, 403, error.message || 'Trial has ended', error);
      }
      const message =
        error?.message === 'Invalid credentials'
          ? 'Invalid email or password'
          : error.message;
      sendError(res, 401, message, error);
    }
  },

  async consumeImpersonationToken(req, res) {
    try {
      const token = String(req.body?.token || '').trim();
      if (!token) {
        return sendError(res, 400, 'token is required');
      }
      const deviceMeta = buildDeviceMeta(req, req.body);
      const result = await authService.consumeImpersonationToken(token, deviceMeta);
      sendResponse(res, 200, 'Tenant access granted', result);
    } catch (error) {
      sendError(res, 401, error.message || 'Invalid access link', error);
    }
  },

  async logout(req, res) {
    try {
      const sessionId = req.body?.sessionId || req.user?.sessionId || null;
      await authService.logout(req.user.id, sessionId);
      sendResponse(res, 200, 'Logout successful');
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async logoutBeacon(req, res) {
    try {
      const token = String(req.query?.token || '').replace(/^Bearer\s+/i, '').trim();
      const sessionId = String(req.query?.sessionId || '').trim();
      const tenantDbName = String(req.query?.tenantDbName || '').trim();
      const finalize =
        req.query?.finalize === '1' ||
        req.query?.finalize === 'true' ||
        req.query?.finalize === 'yes';
      if (!token || !sessionId) return res.status(204).end();

      let payload = verifyToken(token);
      if (!payload || typeof payload !== 'object') {
        payload = jwt.decode(token);
      }
      if (!payload?.userId) return res.status(204).end();

      await runWithTenantContext(tenantDbName || payload?.tenantDbName || '', async () => {
        if (finalize) {
          await sessionService.finalizeBrowserLogout(String(payload.userId), sessionId);
        } else {
          await sessionService.markSessionCloseIntent(String(payload.userId), sessionId);
        }
      });

      return res.status(204).end();
    } catch {
      return res.status(204).end();
    }
  },

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      sendResponse(res, 200, 'Token refreshed', result);
    } catch (error) {
      sendError(res, 401, error.message, error);
    }
  },

  async forgotPassword(req, res) {
    try {
      const identifier = req.body.loginId || req.body.email;
      const result = await authService.forgotPassword(identifier);
      sendResponse(res, 200, result.message, {
        email: result.email || undefined,
      });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async verifyOtp(req, res) {
    try {
      const identifier = req.body.loginId || req.body.email;
      const { otp } = req.body;
      const result = await authService.verifyOtp(identifier, otp);
      sendResponse(res, 200, 'OTP verified', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async resetPassword(req, res) {
    try {
      const identifier = req.body.loginId || req.body.email;
      const { otp, newPassword } = req.body;
      const result = await authService.resetPassword(identifier, otp, newPassword);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async changePassword(req, res) {
    try {
      const { userId, newPassword } = req.body;
      
      // Validate input
      if (!userId || !newPassword) {
        return sendError(res, 400, 'UserId and newPassword are required');
      }

      // Validate password strength
      if (newPassword.length < 8) {
        return sendError(res, 400, 'Password must be at least 8 characters');
      }

      // Verify the userId matches the authenticated user (security check)
      if (req.user && req.user.id !== userId) {
        return sendError(res, 403, 'You can only change your own password');
      }

      const result = await authService.changePassword(userId, newPassword);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
