import { billingService } from './billing.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const billingController = {
  async getSummary(req, res) {
    try {
      const result = await billingService.getSummary(req.query || {}, req.user);
      sendResponse(res, 200, 'Billing summary retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async exportTab(req, res) {
    try {
      const result = await billingService.exportTab(req.params.tab, req.params.format, req.query || {}, req.user);
      sendResponse(res, 200, 'Billing export generated successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getSettings(req, res) {
    try {
      const result = await billingService.getSettings(req.user);
      sendResponse(res, 200, 'Billing settings retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getNextInvoiceNumber(req, res) {
    try {
      const result = await billingService.getNextInvoiceNumber(req.user?.id);
      sendResponse(res, 200, 'Next invoice number retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async updateSettings(req, res) {
    try {
      const result = await billingService.updateSettings(req.body || {}, req.user);
      sendResponse(res, 200, 'Billing settings updated successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

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

  async updateDraftInvoice(req, res) {
    try {
      const record = await billingService.updateDraftInvoice(req.params.id, req.body || {});
      sendResponse(res, 200, 'Draft invoice updated successfully', record);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async sendInvoiceToClient(req, res) {
    try {
      const result = await billingService.sendInvoiceToClient(
        req.params.id,
        req.body || {},
        req.user?.id,
      );
      sendResponse(res, 200, 'Invoice sent to client successfully', result);
    } catch (error) {
      const message = String(error?.message || '');
      const status = message.includes('not found') ? 404 : message.includes('email') ? 400 : 500;
      sendError(res, status, message, error);
    }
  },

  async sendInvoiceReminder(req, res) {
    try {
      const result = await billingService.sendInvoiceReminder(
        req.params.id,
        req.body || {},
        req.user?.id,
      );
      sendResponse(
        res,
        200,
        result.reminder?.mode === 'schedule'
          ? 'Payment reminder scheduled successfully'
          : 'Payment reminder sent to client successfully',
        result,
      );
    } catch (error) {
      const message = String(error?.message || '');
      const status = message.includes('not found') ? 404 : 400;
      sendError(res, status, message, error);
    }
  },

  async listInvoiceReminders(req, res) {
    try {
      const result = await billingService.listInvoiceReminders(req.params.id);
      sendResponse(res, 200, 'Payment reminders retrieved successfully', result);
    } catch (error) {
      sendError(res, 404, error.message, error);
    }
  },

  async cancelInvoiceReminder(req, res) {
    try {
      const result = await billingService.cancelInvoiceReminder(
        req.params.id,
        req.params.reminderId,
      );
      sendResponse(res, 200, 'Payment reminder cancelled', result);
    } catch (error) {
      const message = String(error?.message || '');
      sendError(res, message.includes('not found') ? 404 : 400, message, error);
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

  async getInvoiceActivity(req, res) {
    try {
      const result = await billingService.getInvoiceActivity(req.params.id);
      sendResponse(res, 200, 'Invoice activity retrieved successfully', result);
    } catch (error) {
      sendError(res, 404, error.message, error);
    }
  },

  async updateInvoiceCurrency(req, res) {
    try {
      const code = req.body?.currency || req.body?.code;
      const result = await billingService.updateInvoiceCurrency(req.params.id, code);
      sendResponse(res, 200, 'Invoice currency updated', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
