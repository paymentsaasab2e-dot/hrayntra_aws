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

  async delete(req, res) {
    try {
      const result = await userService.delete(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
