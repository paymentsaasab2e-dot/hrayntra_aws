import { dashboardService } from './dashboard.service.js';
import { getCrmOverview } from './crmOverview.service.js';
import { getRecruitmentOverview } from './recruitmentOverview.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const dashboardController = {
  async getCatalog(req, res) {
    try {
      const catalog = dashboardService.listCatalog(req);
      sendResponse(res, 200, 'OK', catalog);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getOverview(req, res) {
    try {
      const overview = await dashboardService.getOverview(req);
      sendResponse(res, 200, 'OK', overview);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getCrmOverview(req, res) {
    try {
      const overview = await getCrmOverview(req);
      sendResponse(res, 200, 'OK', overview);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getRecruitmentOverview(req, res) {
    try {
      const overview = await getRecruitmentOverview(req);
      sendResponse(res, 200, 'OK', overview);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getDataset(req, res) {
    try {
      const result = await dashboardService.fetchDataset(req.params.datasetId, req);
      sendResponse(res, 200, 'OK', result);
    } catch (error) {
      const status = error.message?.includes('permission') ? 403 : 400;
      sendError(res, status, error.message, error);
    }
  },

  async analyze(req, res) {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      const analysis = dashboardService.analyzeRows(rows);
      sendResponse(res, 200, 'OK', analysis);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getLayout(req, res) {
    try {
      const layout = await dashboardService.getLayout(req.user.id, req);
      sendResponse(res, 200, 'OK', layout);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async saveLayout(req, res) {
    try {
      const layout = await dashboardService.saveLayout(req.user.id, req.body, req);
      sendResponse(res, 200, 'Layout saved', layout);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
