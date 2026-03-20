import { placementService } from './placement.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

function getStatusCode(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('not found')) return 404;
  if (
    message.includes('invalid') ||
    message.includes('required') ||
    message.includes('cannot delete') ||
    message.includes('must be')
  ) {
    return 400;
  }
  return 500;
}

export const placementController = {
  async getStats(req, res) {
    try {
      const result = await placementService.getStats();
      sendResponse(res, 200, 'Placement stats retrieved successfully', result);
    } catch (error) {
      sendError(res, getStatusCode(error), error.message, error);
    }
  },

  async getAll(req, res) {
    try {
      const result = await placementService.getAll(req);
      sendResponse(res, 200, 'Placements retrieved successfully', result);
    } catch (error) {
      sendError(res, getStatusCode(error), error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const placement = await placementService.getById(req.params.id);
      sendResponse(res, 200, 'Placement retrieved successfully', placement);
    } catch (error) {
      sendError(res, getStatusCode(error), error.message, error);
    }
  },

  async create(req, res) {
    try {
      const placement = await placementService.create(req.body, req.user.id, req.file);
      // Log placement created so it's visible in terminal (saved in DB)
      const saved = {
        id: placement.id,
        candidateId: placement.candidateId,
        jobId: placement.jobId,
        clientId: placement.clientId,
        recruiterId: placement.recruiterId,
        status: placement.status,
        offerDate: placement.offerDate,
        joiningDate: placement.joiningDate,
        salaryOffered: placement.salaryOffered,
        placementFee: placement.placementFee,
        employmentType: placement.employmentType,
        createdAt: placement.createdAt,
      };
      console.log('[Placement] Created successfully. Saved data (JSON):', JSON.stringify(saved, null, 2));
      sendResponse(res, 201, 'Placement created successfully', placement);
    } catch (error) {
      sendError(res, getStatusCode(error), error.message, error);
    }
  },

  async update(req, res) {
    try {
      const placement = await placementService.update(req.params.id, req.body, req.user.id);
      sendResponse(res, 200, 'Placement updated successfully', placement);
    } catch (error) {
      sendError(res, getStatusCode(error), error.message, error);
    }
  },

  async markJoined(req, res) {
    try {
      const placement = await placementService.markJoined(req.params.id, req.body, req.user.id, req.file);
      sendResponse(res, 200, 'Marked as joined', placement);
    } catch (error) {
      sendError(res, getStatusCode(error), error.message, error);
    }
  },

  async markFailed(req, res) {
    try {
      const placement = await placementService.markFailed(req.params.id, req.body, req.user.id);
      sendResponse(res, 200, 'Status updated successfully', placement);
    } catch (error) {
      sendError(res, getStatusCode(error), error.message, error);
    }
  },

  async requestReplacement(req, res) {
    try {
      const placement = await placementService.requestReplacement(req.params.id, req.body, req.user.id);
      sendResponse(res, 200, 'Replacement requested successfully', placement);
    } catch (error) {
      sendError(res, getStatusCode(error), error.message, error);
    }
  },

  async exportCsv(req, res) {
    try {
      const csv = await placementService.exportCsv(req);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="placements-export.csv"');
      res.status(200).send(csv);
    } catch (error) {
      sendError(res, getStatusCode(error), error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await placementService.delete(req.params.id, req.user.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, getStatusCode(error), error.message, error);
    }
  },
};
