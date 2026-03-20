import { teamService } from './team.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const teamController = {
  async getAll(req, res) {
    try {
      const result = await teamService.getAll(req);
      sendResponse(res, 200, 'Teams retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const team = await teamService.getById(req.params.id);
      if (!team) {
        return sendError(res, 404, 'Team not found');
      }
      sendResponse(res, 200, 'Team retrieved successfully', team);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const team = await teamService.create(req.body);
      sendResponse(res, 201, 'Team created successfully', team);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const team = await teamService.update(req.params.id, req.body);
      sendResponse(res, 200, 'Team updated successfully', team);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addMember(req, res) {
    try {
      const member = await teamService.addMember(
        req.params.id,
        req.body.userId,
        req.body.role
      );
      sendResponse(res, 201, 'Member added successfully', member);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async removeMember(req, res) {
    try {
      const result = await teamService.removeMember(req.params.id, req.params.userId);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await teamService.delete(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
