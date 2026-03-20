import { sendError, sendResponse } from '../utils/response.js';
import { interviewFeedbackService } from '../services/interviewFeedback.service.js';

export const interviewFeedbackController = {
  async create(req, res) {
    try {
      const result = await interviewFeedbackService.create(req.params.id, req.body, req.user);
      sendResponse(res, 201, 'Interview feedback submitted successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async list(req, res) {
    try {
      const result = await interviewFeedbackService.list(req.params.id);
      sendResponse(res, 200, 'Interview feedback retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async generateAiSummary(req, res) {
    try {
      const result = await interviewFeedbackService.generateAiSummary(req.params.id, req.body.feedbackId);
      sendResponse(res, 200, 'AI feedback summary generated successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
