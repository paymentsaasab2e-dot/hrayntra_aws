import { userService } from './user.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const userController = {
  async getAll(req, res) {
    try {
      const result = await userService.getAll(req);
      sendResponse(res, 200, 'Users retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getMe(req, res) {
    try {
      const user = await userService.getById(req.user.id);
      if (!user) {
        return sendError(res, 404, 'User not found');
      }
      sendResponse(res, 200, 'User profile retrieved successfully', user);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getMyPermissions(req, res) {
    try {
      const payload = await userService.getEffectivePermissions(req.user.id);
      if (!payload) {
        return sendError(res, 404, 'User not found');
      }
      sendResponse(res, 200, 'User permissions retrieved successfully', payload);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const user = await userService.getById(req.params.id);
      if (!user) {
        return sendError(res, 404, 'User not found');
      }
      sendResponse(res, 200, 'User retrieved successfully', user);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const user = await userService.update(req.params.id, req.body);
      sendResponse(res, 200, 'User updated successfully', user);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateMe(req, res) {
    try {
      const user = await userService.update(req.user.id, req.body);
      sendResponse(res, 200, 'Profile updated successfully', user);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await userService.delete(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
