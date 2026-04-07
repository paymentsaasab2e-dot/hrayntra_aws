import { pipelineService } from './pipeline.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const pipelineController = {
  async getStagesByJob(req, res) {
    try {
      const stages = await pipelineService.getStagesByJob(req.params.jobId);
      sendResponse(res, 200, 'Pipeline stages retrieved successfully', stages);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async moveCandidate(req, res) {
    try {
      const { candidateId, stageId, notes } = req.body;
      const entry = await pipelineService.moveCandidate(
        candidateId,
        req.params.jobId,
        stageId,
        req.user.id,
        notes
      );
      sendResponse(res, 200, 'Candidate moved successfully', entry);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async createStage(req, res) {
    try {
      const stage = await pipelineService.createStage(req.params.jobId, req.body);
      sendResponse(res, 201, 'Stage created successfully', stage);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateStage(req, res) {
    try {
      const stage = await pipelineService.updateStage(req.params.stageId, req.body);
      sendResponse(res, 200, 'Stage updated successfully', stage);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteStage(req, res) {
    try {
      const result = await pipelineService.deleteStage(req.params.stageId);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
