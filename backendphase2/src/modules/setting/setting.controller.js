import { settingService } from './setting.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const settingController = {
  async getAll(req, res) {
    try {
      const settings = await settingService.getAll(req);
      sendResponse(res, 200, 'Settings retrieved successfully', settings);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getByKey(req, res) {
    try {
      const setting = await settingService.getByKey(
        req.query.userId,
        req.params.key,
        req.query.scope
      );
      if (!setting) {
        return sendError(res, 404, 'Setting not found');
      }
      sendResponse(res, 200, 'Setting retrieved successfully', setting);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const setting = await settingService.create({
        ...req.body,
        userId: req.body.userId || req.user.id,
      });
      sendResponse(res, 201, 'Setting created successfully', setting);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const setting = await settingService.update(
        req.body.userId || req.user.id,
        req.params.key,
        req.body.scope,
        req.body.value
      );
      sendResponse(res, 200, 'Setting updated successfully', setting);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await settingService.delete(
        req.query.userId || req.user.id,
        req.params.key,
        req.query.scope
      );
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
