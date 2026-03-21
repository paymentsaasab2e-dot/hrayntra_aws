import { candidateService } from './candidate.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const candidateController = {
  async getAll(req, res) {
    try {
      const result = await candidateService.getAll(req);
      sendResponse(res, 200, 'Candidates retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const candidate = await candidateService.getById(req.params.id);
      if (!candidate) {
        return sendError(res, 404, 'Candidate not found');
      }
      sendResponse(res, 200, 'Candidate retrieved successfully', candidate);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const candidate = await candidateService.create(req.body, req.user?.id);
      sendResponse(res, 201, 'Candidate created successfully', candidate);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const candidate = await candidateService.update(req.params.id, req.body);
      sendResponse(res, 200, 'Candidate updated successfully', candidate);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await candidateService.delete(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async addNote(req, res) {
    try {
      const note = await candidateService.addNote(req.params.id, req.body, req.user.id);
      sendResponse(res, 201, 'Candidate note added successfully', note);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateNote(req, res) {
    try {
      const note = await candidateService.updateNote(req.params.id, req.params.noteId, req.body);
      sendResponse(res, 200, 'Candidate note updated successfully', note);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteNote(req, res) {
    try {
      const result = await candidateService.deleteNote(req.params.id, req.params.noteId);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async pinNote(req, res) {
    try {
      const note = await candidateService.pinNote(req.params.id, req.params.noteId, req.body?.isPinned);
      sendResponse(res, 200, 'Candidate note pin updated successfully', note);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addTag(req, res) {
    try {
      const tag = await candidateService.addTag(req.params.id, req.body, req.user.id);
      sendResponse(res, 201, 'Candidate tag added successfully', tag);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async removeTag(req, res) {
    try {
      const result = await candidateService.removeTag(req.params.id, req.params.tagId, req.user.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addToPipeline(req, res) {
    try {
      const candidate = await candidateService.addToPipeline(req.params.id, req.body, req.user.id);
      sendResponse(res, 200, 'Candidate added to pipeline successfully', candidate);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async reject(req, res) {
    try {
      const candidate = await candidateService.rejectCandidate(req.params.id, req.body, req.user.id);
      sendResponse(res, 200, 'Candidate rejected successfully', candidate);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async scheduleInterview(req, res) {
    try {
      const interview = await candidateService.scheduleInterview(req.params.id, req.body, req.user.id);
      sendResponse(res, 201, 'Candidate interview scheduled successfully', interview);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateInterview(req, res) {
    try {
      const interview = await candidateService.updateInterview(
        req.params.id,
        req.params.interviewId,
        req.body,
        req.user.id
      );
      sendResponse(res, 200, 'Candidate interview updated successfully', interview);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getStats(req, res) {
    try {
      const stats = await candidateService.getStats(req);
      sendResponse(res, 200, 'Candidate stats retrieved successfully', stats);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async bulkAction(req, res) {
    try {
      const { action, candidateIds, ...payload } = req.body;
      if (!action || !Array.isArray(candidateIds) || candidateIds.length === 0) {
        return sendError(res, 400, 'Action and candidateIds are required');
      }
      const result = await candidateService.bulkAction(action, candidateIds, payload, req.user.id);
      sendResponse(res, 200, 'Bulk action completed successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
