import { jobLinkedInPostTemplateService } from './jobLinkedInPostTemplate.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const jobLinkedInPostTemplateController = {
  async list(req, res) {
    try {
      const rows = await jobLinkedInPostTemplateService.list(req);
      sendResponse(res, 200, 'LinkedIn post templates retrieved', rows);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const row = await jobLinkedInPostTemplateService.create(req);
      sendResponse(res, 201, 'LinkedIn post template created', row);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const row = await jobLinkedInPostTemplateService.update(req.params.id, req);
      sendResponse(res, 200, 'LinkedIn post template updated', row);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async remove(req, res) {
    try {
      await jobLinkedInPostTemplateService.remove(req.params.id);
      sendResponse(res, 200, 'LinkedIn post template deleted', { deleted: true });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
