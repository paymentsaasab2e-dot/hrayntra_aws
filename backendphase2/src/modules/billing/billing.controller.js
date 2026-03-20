import { billingService } from './billing.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const billingController = {
  async getAll(req, res) {
    try {
      const result = await billingService.getAll(req);
      sendResponse(res, 200, 'Billing records retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const record = await billingService.getById(req.params.id);
      if (!record) {
        return sendError(res, 404, 'Billing record not found');
      }
      sendResponse(res, 200, 'Billing record retrieved successfully', record);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const record = await billingService.create(req.body);
      sendResponse(res, 201, 'Billing record created successfully', record);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const record = await billingService.update(req.params.id, req.body);
      sendResponse(res, 200, 'Billing record updated successfully', record);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await billingService.delete(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
