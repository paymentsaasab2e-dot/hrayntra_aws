import { jobPublicApplyService, buildApplyUrlFromToken } from './jobPublicApply.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { getActiveTenantDbName, runWithTenantContext } from '../../config/prisma.js';
import { resolvePublicApplyTenant } from '../../middleware/tenant-context.middleware.js';

export const jobPublicApplyController = {
  async listTemplates(req, res) {
    try {
      const rows = await jobPublicApplyService.listTemplates(req);
      sendResponse(res, 200, 'Templates retrieved', rows);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async createTemplate(req, res) {
    try {
      const row = await jobPublicApplyService.createTemplate(req);
      sendResponse(res, 201, 'Template created', row);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateTemplate(req, res) {
    try {
      const row = await jobPublicApplyService.updateTemplate(req.params.id, req);
      sendResponse(res, 200, 'Template updated', row);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteTemplate(req, res) {
    try {
      await jobPublicApplyService.deleteTemplate(req.params.id);
      sendResponse(res, 200, 'Template deleted', { deleted: true });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getPublicApplyPage(req, res) {
    try {
      const tenantDbName = resolvePublicApplyTenant(req);
      const run = () => jobPublicApplyService.getPublicApplyPage(req.params.token);
      const data = tenantDbName
        ? await runWithTenantContext(tenantDbName, run)
        : await run();
      sendResponse(res, 200, 'Apply page data', data);
    } catch (error) {
      sendError(res, error.statusCode || 404, error.message, error);
    }
  },

  async submitPublicApply(req, res) {
    try {
      const tenantDbName = resolvePublicApplyTenant(req);
      const token = String(req.params.token || '').trim();
      const filesMap = {};
      for (const file of req.files || []) {
        filesMap[file.fieldname] = file;
      }
      const run = () =>
        jobPublicApplyService.submitPublicApplication(token, {
          answers: req.body?.answers,
          files: filesMap,
        });
      const result = tenantDbName
        ? await runWithTenantContext(tenantDbName, run)
        : await run();
      sendResponse(res, 201, result.message, result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async getApplyLink(req, res) {
    try {
      const token = await jobPublicApplyService.ensureApplyTokenForJob(req.params.jobId);
      if (!token) {
        return sendError(res, 400, 'Application form is not enabled for this job');
      }
      const job = await jobPublicApplyService.getJobTenantForApplyLink(req.params.jobId);
      const tenantDbName =
        job?.tenantDbName ||
        req.user?.tenantDbName ||
        getActiveTenantDbName() ||
        String(req.query?.tenantDbName || '').trim() ||
        null;
      const applyUrl = buildApplyUrlFromToken(
        token,
        req.query?.frontendBase || process.env.FRONTEND_URL,
        tenantDbName
      );
      sendResponse(res, 200, 'Apply link', { token, applyUrl });
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
