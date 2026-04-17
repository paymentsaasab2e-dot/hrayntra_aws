import { sendError, sendResponse } from '../utils/response.js';
import { interviewService } from '../services/interview.service.js';

export const interviewPanelController = {
  async add(req, res) {
    try {
      const result = await interviewService.addPanelMember(req.params.id, req.body, req.user);
      sendResponse(res, 201, 'Panel member added successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async remove(req, res) {
    try {
      const result = await interviewService.removePanelMember(req.params.id, req.params.panelId, req.user);
      sendResponse(res, 200, 'Panel member removed successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
