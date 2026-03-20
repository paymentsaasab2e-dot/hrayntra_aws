import { sendError, sendResponse } from '../utils/response.js';
import { interviewService } from '../services/interview.service.js';

export const interviewNotesController = {
  async list(req, res) {
    try {
      const result = await interviewService.listNotes(req.params.id);
      sendResponse(res, 200, 'Interview notes retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const result = await interviewService.addNote(req.params.id, req.body.note, req.user);
      sendResponse(res, 201, 'Interview note added successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async remove(req, res) {
    try {
      const result = await interviewService.deleteNote(req.params.id, req.params.noteId);
      sendResponse(res, 200, 'Interview note deleted successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
