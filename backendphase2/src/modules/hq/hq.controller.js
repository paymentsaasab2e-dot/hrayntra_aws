import { hqService } from './hq.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const hqController = {
  async setupSuperAdmin(req, res) {
    try {
      const result = await hqService.setupSuperAdmin(req.body);
      sendResponse(res, 201, 'Super Admin setup successful', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  }
};
