import { matchService } from './match.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const matchController = {
  async getAll(req, res) {
    try {
      const result = await matchService.getAll(req);
      sendResponse(res, 200, 'Matches retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const match = await matchService.getById(req.params.id);
      if (!match) {
        return sendError(res, 404, 'Match not found');
      }
      sendResponse(res, 200, 'Match retrieved successfully', match);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const match = await matchService.create({
        ...req.body,
        createdById: req.user.id,
      });
      sendResponse(res, 201, 'Match created successfully', match);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const match = await matchService.update(req.params.id, req.body);
      sendResponse(res, 200, 'Match updated successfully', match);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await matchService.delete(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async save(req, res) {
    try {
      const match = await matchService.save(req.params.id, req.body, req.user.id);
      sendResponse(res, 200, 'Match save status updated successfully', match);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async submit(req, res) {
    try {
      const match = await matchService.submit(req.params.id, req.body, req.user.id);
      sendResponse(res, 200, 'Match submitted successfully', match);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async reject(req, res) {
    try {
      const match = await matchService.reject(req.params.id, req.body, req.user.id);
      sendResponse(res, 200, 'Match rejected successfully', match);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async bulkReject(req, res) {
    try {
      const result = await matchService.bulkReject(req.body, req.user.id);
      sendResponse(res, 200, 'Matches rejected successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async bulkAddToPipeline(req, res) {
    try {
      const result = await matchService.bulkAddToPipeline(req.body, req.user.id);
      sendResponse(res, 200, 'Candidates added to pipeline successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async bulkEmail(req, res) {
    try {
      const result = await matchService.bulkEmail(req.body, req.user.id);
      sendResponse(res, 200, 'Submission email sent successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
