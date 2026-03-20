import { activityService } from './activity.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const activityController = {
  async getAll(req, res) {
    try {
      const result = await activityService.getAll(req);
      sendResponse(res, 200, 'Activities retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const activity = await activityService.getById(req.params.id);
      if (!activity) {
        return sendError(res, 404, 'Activity not found');
      }
      sendResponse(res, 200, 'Activity retrieved successfully', activity);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const activity = await activityService.create({
        ...req.body,
        performedById: req.user.id,
      });
      sendResponse(res, 201, 'Activity created successfully', activity);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await activityService.delete(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
