import { reportService } from './report.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const reportController = {
  async getAll(req, res) {
    try {
      const result = await reportService.getAll(req);
      sendResponse(res, 200, 'Reports retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const report = await reportService.getById(req.params.id);
      if (!report) {
        return sendError(res, 404, 'Report not found');
      }
      sendResponse(res, 200, 'Report retrieved successfully', report);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const report = await reportService.create({
        ...req.body,
        generatedById: req.user.id,
      });
      sendResponse(res, 201, 'Report created successfully', report);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const report = await reportService.update(req.params.id, req.body);
      sendResponse(res, 200, 'Report updated successfully', report);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await reportService.delete(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
