import { roleService } from './role.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const roleController = {
  async getAll(req, res) {
    try {
      const roles = await roleService.getAll(req.user);
      sendResponse(res, 200, 'Roles retrieved successfully', roles);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
