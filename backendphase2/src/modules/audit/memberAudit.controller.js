import { memberAuditService } from './memberAudit.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';

function requireSuperAdmin(req, res) {
  if (!isSuperAdminUser(req)) {
    sendError(res, 403, 'Only Super Admin can access team activity logs');
    return false;
  }
  return true;
}

export const memberAuditController = {
  async getTeamOverview(req, res) {
    try {
      if (!requireSuperAdmin(req, res)) return;
      const data = await memberAuditService.getTeamOverview(req);
      sendResponse(res, 200, 'Team activity overview retrieved', data);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getMemberTimeline(req, res) {
    try {
      if (!requireSuperAdmin(req, res)) return;
      const data = await memberAuditService.getMemberTimeline(req, req.params.userId);
      if (!data) {
        return sendError(res, 404, 'Team member not found');
      }
      sendResponse(res, 200, 'Member activity timeline retrieved', data);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
