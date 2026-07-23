import { leadPublicFormService } from './leadPublicForm.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { getActiveTenantDbName } from '../../config/prisma.js';
import { resolvePublicApplyTenant } from '../../middleware/tenant-context.middleware.js';

function resolveRequestTenant(req) {
  return String(
    req.user?.tenantDbName ||
      getActiveTenantDbName() ||
      resolvePublicApplyTenant(req) ||
      req.query?.tenantDbName ||
      req.query?.tenant ||
      req.body?.tenantDbName ||
      ''
  ).trim();
}

export const leadPublicFormController = {
  async getPublicForm(req, res) {
    try {
      const tenantDbName = resolveRequestTenant(req);
      if (!tenantDbName) {
        return sendError(
          res,
          400,
          'Tenant is required. Open the full lead form link that includes ?tenantDbName=…'
        );
      }
      const data = await leadPublicFormService.getPublicForm(req.params.token, tenantDbName);
      sendResponse(res, 200, 'Lead form', data);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },

  async submitPublicForm(req, res) {
    try {
      const tenantDbName = resolveRequestTenant(req);
      if (!tenantDbName) {
        return sendError(
          res,
          400,
          'Tenant is required. Open the full lead form link that includes ?tenantDbName=…'
        );
      }
      const data = await leadPublicFormService.submitPublicForm(
        req.params.token,
        req.body || {},
        tenantDbName
      );
      sendResponse(res, 201, 'Lead submitted', data);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },

  async listPublicSubmissions(req, res) {
    try {
      const tenantDbName = resolveRequestTenant(req);
      if (!tenantDbName) {
        return sendError(
          res,
          400,
          'Tenant is required. Open the full lead form link that includes ?tenantDbName=…'
        );
      }
      const data = await leadPublicFormService.listPublicSubmissions(
        req.params.token,
        tenantDbName
      );
      sendResponse(res, 200, 'Lead form submissions', data);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },

  async getPublicFormLink(req, res) {
    try {
      const frontendBase =
        String(req.query?.frontendBase || '').trim() ||
        process.env.FRONTEND_URL ||
        undefined;
      const tenantDbName = resolveRequestTenant(req);
      if (!tenantDbName) {
        return sendError(res, 400, 'Tenant context is required to create a lead form link');
      }
      const data = await leadPublicFormService.ensurePublicFormLink({
        frontendBase,
        tenantDbName,
      });
      sendResponse(res, 200, 'Lead form link', data);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },
};
