import { sendError, sendResponse } from '../utils/response.js';
import { interviewService } from '../services/interview.service.js';

export const interviewController = {
  async list(req, res) {
    try {
      const result = await interviewService.list(req.query);
      sendResponse(res, 200, 'Interviews retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const result = await interviewService.getById(req.params.id);
      sendResponse(res, 200, 'Interview retrieved successfully', result);
    } catch (error) {
      sendError(res, error.message === 'Interview not found' ? 404 : 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const result = await interviewService.create(req.body, req.user);
      sendResponse(res, 201, 'Interview scheduled successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const result = await interviewService.update(req.params.id, req.body, req.user);
      sendResponse(res, 200, 'Interview updated successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async remove(req, res) {
    try {
      const result = await interviewService.softDelete(req.params.id, req.user);
      sendResponse(res, 200, 'Interview cancelled successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async reschedule(req, res) {
    try {
      const result = await interviewService.reschedule(req.params.id, req.body, req.user);
      sendResponse(res, 200, 'Interview rescheduled successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async cancel(req, res) {
    try {
      const result = await interviewService.cancel(req.params.id, req.body, req.user);
      sendResponse(res, 200, 'Interview cancelled successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async noShow(req, res) {
    try {
      const result = await interviewService.markNoShow(req.params.id, req.body, req.user);
      sendResponse(res, 200, 'Interview marked as no show', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async regenerateMeetingLink(req, res) {
    try {
      const result = await interviewService.regenerateMeetingLink(req.params.id, req.body.platform, req.user);
      sendResponse(res, 200, 'Meeting link regenerated successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getKpis(req, res) {
    try {
      const result = await interviewService.getKpis();
      sendResponse(res, 200, 'Interview KPIs retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getCalendar(req, res) {
    try {
      const result = await interviewService.getCalendar(req.query.month, req.query.year);
      sendResponse(res, 200, 'Interview calendar data retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
