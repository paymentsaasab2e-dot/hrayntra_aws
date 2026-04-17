import { reportService } from './report.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const reportController = {
  async getSummary(req, res) {
    try {
      const result = await reportService.getSummary(req.query || {}, req.user);
      return sendResponse(res, 200, 'Report summary retrieved successfully', result);
    } catch (error) {
      return sendError(res, 500, error.message, error);
    }
  },

  async getDataset(req, res) {
    try {
      const result = await reportService.getDataset(req.params.entity, req.query || {}, req.user);
      return sendResponse(res, 200, 'Report dataset retrieved successfully', result);
    } catch (error) {
      return sendError(res, 500, error.message, error);
    }
  },

  async exportSummaryTab(req, res) {
    try {
      const result = await reportService.exportSummaryTab(req.params.tab, req.params.format, req.query || {}, req.user);

      if (!result?.ok) {
        if (result?.error === 'No data available for this report') {
          return sendError(res, 404, result.error);
        }
        return sendError(res, 400, result?.error || 'Failed to export summary report');
      }

      return sendResponse(res, 200, `${result.title || 'Summary report'} generated successfully`, {
        tab: req.params.tab,
        format: result.format,
        title: result.title,
        summary: result.summary,
        rowCount: result.rowCount,
        columns: result.columns,
        fileName: result.fileName,
        fileUrl: result.fileUrl,
        downloadUrl: result.fileUrl,
        filters: req.query || {},
      });
    } catch (error) {
      return sendError(res, 500, error.message, error);
    }
  },

  async exportEntity(req, res) {
    try {
      const result = await reportService.exportEntity(req.params.entity, req.params.format, req.query, req.user);

      if (!result?.ok) {
        if (result?.error === 'No data available for this report') {
          return sendError(res, 404, result.error);
        }
        if (result?.error === 'File generation service is not configured yet') {
          return sendError(res, 501, result.error);
        }
        return sendError(res, 400, result?.error || 'Failed to export report');
      }

      return sendResponse(res, 200, `${result.title || 'Report'} generated successfully`, {
        entity: result.entity,
        format: result.format,
        title: result.title,
        summary: result.summary,
        rowCount: result.rowCount,
        columns: result.columns,
        fileName: result.fileName,
        fileUrl: result.fileUrl,
        downloadUrl: result.fileUrl,
        filters: req.query || {},
      });
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getAll(req, res) {
    try {
      const result = await reportService.getAll(req);
      sendResponse(res, 200, 'Reports retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const report = await reportService.getById(req.params.id);
      if (!report) {
        return sendError(res, 404, 'Report not found');
      }
      sendResponse(res, 200, 'Report retrieved successfully', report);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const report = await reportService.create({
        ...req.body,
        generatedById: req.user.id,
      });
      sendResponse(res, 201, 'Report created successfully', report);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const report = await reportService.update(req.params.id, req.body);
      sendResponse(res, 200, 'Report updated successfully', report);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await reportService.delete(req.params.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
