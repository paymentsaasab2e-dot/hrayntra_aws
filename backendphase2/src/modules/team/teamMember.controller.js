import { teamMemberService } from './teamMember.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { assertCanViewMemberActivity } from '../../services/activityVisibility.service.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';

export const teamMemberController = {
  async getAll(req, res) {
    try {
      const result = await teamMemberService.getAll(req);
      sendResponse(res, 200, 'Team members retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const member = await teamMemberService.getById(req.params.id, req.user);
      if (!member) {
        return sendError(res, 404, 'Team member not found');
      }
      sendResponse(res, 200, 'Team member retrieved successfully', member);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const member = await teamMemberService.create(req.body, req.user.id);
      sendResponse(
        res,
        201,
        member.credentialData
          ? 'Team member created and invite sent successfully'
          : 'Team member created successfully',
        member
      );
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const member = await teamMemberService.update(req.params.id, req.body);
      sendResponse(res, 200, 'Team member updated successfully', member);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await teamMemberService.delete(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async generateCredentials(req, res) {
    try {
      const { loginIdOption, customLoginId, sendInvite } = req.body;
      const result = await teamMemberService.generateCredentials(
        req.params.id,
        loginIdOption || 'auto',
        sendInvite !== false,
        req.user.id,
        customLoginId
      );
      sendResponse(res, 200, 'Credentials generated successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async resetPassword(req, res) {
    try {
      const result = await teamMemberService.resetPassword(req.params.id, req.user);
      sendResponse(res, 200, result.message, {
        tempPassword: result.tempPassword,
        loginId: result.loginId,
      });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async setPassword(req, res) {
    try {
      if (!isSuperAdminUser(req)) {
        return sendError(res, 403, 'Only Super Admins can set a member password directly.');
      }
      const member = await teamMemberService.getById(req.params.id, req.user);
      if (!member) {
        return sendError(res, 404, 'Team member not found');
      }
      const newPassword = req.body?.newPassword;
      const result = await teamMemberService.setPassword(req.params.id, newPassword, req.user);
      sendResponse(res, 200, result.message, {
        loginId: result.loginId,
      });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async resendInvite(req, res) {
    try {
      const result = await teamMemberService.resendInvite(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async lockAccount(req, res) {
    try {
      const result = await teamMemberService.lockAccount(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async unlockAccount(req, res) {
    try {
      const result = await teamMemberService.unlockAccount(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getLoginHistory(req, res) {
    try {
      const history = await teamMemberService.getLoginHistory(req.params.id);
      sendResponse(res, 200, 'Login history retrieved successfully', history);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getActivity(req, res) {
    try {
      await assertCanViewMemberActivity(req.user?.id, req.params.id);
      const activities = await teamMemberService.getActivity(req.params.id);
      sendResponse(res, 200, 'Activity retrieved successfully', activities);
    } catch (error) {
      const status = /permission/i.test(error.message) ? 403 : 500;
      sendError(res, status, error.message, error);
    }
  },

  async getTargets(req, res) {
    try {
      const targets = await teamMemberService.getTargets(req.params.id);
      sendResponse(res, 200, 'Targets retrieved successfully', targets);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async saveTargets(req, res) {
    try {
      const targets = await teamMemberService.saveTargets(req.params.id, req.body?.targets || []);
      sendResponse(res, 200, 'Targets saved successfully', targets);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
