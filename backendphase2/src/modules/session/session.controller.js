import { sendResponse, sendError } from '../../utils/response.js';
import { buildDeviceMeta } from '../../utils/deviceFingerprint.js';
import { runWithTenantContext } from '../../config/prisma.js';
import { sessionService } from './session.service.js';
export const sessionController = {
  async heartbeat(req, res) {
    try {
      const sessionId = req.body?.sessionId || req.user?.sessionId;
      const result = await sessionService.heartbeat(req.user.id, sessionId);
      if (!result.ok) {
        return sendError(res, 401, 'Session expired', { code: result.code });
      }
      sendResponse(res, 200, 'Heartbeat recorded', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async status(req, res) {
    try {
      const active = await sessionService.findActiveSessionForUser(req.user.id);
      sendResponse(res, 200, 'Session status', {
        active: Boolean(active),
        session: sessionService.publicSessionView(active),
      });
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async requestTransfer(req, res) {
    try {
      const { email, loginId, password } = req.body;
      const loginIdentifier = loginId || email;
      const deviceMeta = buildDeviceMeta(req, req.body);
      const result = await sessionService.requestSessionTransfer({
        loginIdentifier,
        password,
        deviceMeta,
      });
      sendResponse(res, 200, 'Login request sent to active session', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async approveTransfer(req, res) {
    try {
      const { requestId } = req.body;
      const result = await sessionService.approveSessionTransfer(req.user.id, requestId);
      sendResponse(res, 200, 'Session transfer approved', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async rejectTransfer(req, res) {
    try {
      const { requestId } = req.body;
      const result = await sessionService.rejectSessionTransfer(req.user.id, requestId);
      sendResponse(res, 200, 'Session transfer rejected', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async transferStatus(req, res) {
    try {
      const { requestId } = req.params;
      const result = await sessionService.getTransferStatus(requestId);
      sendResponse(res, 200, 'Transfer status', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async completeTransfer(req, res) {
    try {
      const { requestId, email, loginId, password } = req.body;
      const loginIdentifier = loginId || email;
      const deviceMeta = buildDeviceMeta(req, req.body);
      const tenantDbName = String(req.headers['x-tenant-db-name'] || req.body.tenantDbName || '').trim();

      const tokens = await sessionService.completeTransferLogin({
        requestId,
        loginIdentifier,
        password,
        tokenPayload: {},
        refreshPayload: { tenantDbName: tenantDbName || undefined },
        deviceMeta,
      });

      sendResponse(res, 200, 'Login successful', {
        accessToken: tokens.accessToken,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionId: tokens.sessionId,
        tenantDbName: tenantDbName || undefined,
      });
    } catch (error) {
      sendError(res, 401, error.message, error);
    }
  },

  async emailApproveTransfer(req, res) {
    const token = String(req.query?.token || '').trim();
    const tenantDbName = String(req.query?.tenantDbName || '').trim();
    try {
      if (!token) throw new Error('Missing approval token');
      const runApprove = () => sessionService.approveSessionTransferFromEmailToken(token);
      if (tenantDbName) {
        await runWithTenantContext(tenantDbName, runApprove);
      } else {
        await runApprove();
      }
      return res.redirect(
        302,
        sessionService.buildSessionTransferEmailRedirect({
          status: 'approved',
          message: 'Approval Done. The new device may now complete sign-in.',
        }),
      );
    } catch (error) {
      const mapped = sessionService.redirectStatusForTransferError(error);
      return res.redirect(
        302,
        sessionService.buildSessionTransferEmailRedirect({
          status: mapped.status,
          message: mapped.message,
        }),
      );
    }
  },

  async emailRejectTransfer(req, res) {
    const token = String(req.query?.token || '').trim();
    const tenantDbName = String(req.query?.tenantDbName || '').trim();
    try {
      if (!token) throw new Error('Missing rejection token');
      const runReject = () => sessionService.rejectSessionTransferFromEmailToken(token);
      if (tenantDbName) {
        await runWithTenantContext(tenantDbName, runReject);
      } else {
        await runReject();
      }
      return res.redirect(
        302,
        sessionService.buildSessionTransferEmailRedirect({
          status: 'rejected',
          message: 'The duplicate login attempt was declined.',
        }),
      );
    } catch (error) {
      const mapped = sessionService.redirectStatusForTransferError(error);
      return res.redirect(
        302,
        sessionService.buildSessionTransferEmailRedirect({
          status: mapped.status,
          message: mapped.message,
        }),
      );
    }
  },
};
