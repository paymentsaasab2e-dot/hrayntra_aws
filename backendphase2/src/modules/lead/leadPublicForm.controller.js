import { leadPublicFormService } from './leadPublicForm.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { getActiveTenantDbName } from '../../config/prisma.js';
import { resolvePublicApplyTenant } from '../../middleware/tenant-context.middleware.js';
import { verifyToken } from '../../utils/jwt.js';
import jwt from 'jsonwebtoken';

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

function readBearerUserId(req) {
  const header = String(req.headers?.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const verified = verifyToken(token);
  if (verified?.userId) return String(verified.userId);
  try {
    const decoded = jwt.decode(token);
    if (decoded && typeof decoded === 'object' && decoded.userId) {
      return String(decoded.userId);
    }
  } catch {
    /* ignore */
  }
  return null;
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
        tenantDbName,
        {
          userId: req.user?.id || readBearerUserId(req),
        }
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

  async getPublicFormAccess(req, res) {
    try {
      const tenantDbName = resolveRequestTenant(req);
      if (!tenantDbName) {
        return sendError(res, 400, 'Tenant context is required to view lead form access');
      }
      const data = await leadPublicFormService.getPublicFormAccess({ tenantDbName });
      sendResponse(res, 200, 'Lead form access', data);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },

  async invitePublicFormMember(req, res) {
    try {
      const frontendBase =
        String(req.body?.frontendBase || req.query?.frontendBase || '').trim() ||
        process.env.FRONTEND_URL ||
        undefined;
      const tenantDbName = resolveRequestTenant(req);
      if (!tenantDbName) {
        return sendError(res, 400, 'Tenant context is required to share a lead form link');
      }
      const data = await leadPublicFormService.inviteMemberToPublicForm({
        name: req.body?.name,
        designation: req.body?.designation,
        email: req.body?.email,
        password: req.body?.password,
        frontendBase,
        tenantDbName,
        createdById: req.user?.id || null,
      });
      sendResponse(res, 200, 'Lead form invitation sent', data);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },

  async updatePublicFormLead(req, res) {
    try {
      const tenantDbName = resolveRequestTenant(req);
      if (!tenantDbName) {
        return sendError(
          res,
          400,
          'Tenant is required. Open the full lead form link that includes ?tenantDbName=…'
        );
      }
      const userId = req.user?.id || readBearerUserId(req);
      if (!userId) {
        return sendError(res, 401, 'Sign in to edit a lead on this form');
      }
      const data = await leadPublicFormService.updatePublicFormLead(
        req.params.token,
        req.params.id,
        req.body || {},
        tenantDbName,
        { userId }
      );
      sendResponse(res, 200, 'Lead updated', data);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },

  async deletePublicFormLead(req, res) {
    try {
      const tenantDbName = resolveRequestTenant(req);
      if (!tenantDbName) {
        return sendError(
          res,
          400,
          'Tenant is required. Open the full lead form link that includes ?tenantDbName=…'
        );
      }
      const userId = req.user?.id || readBearerUserId(req);
      if (!userId) {
        return sendError(res, 401, 'Sign in to delete a lead on this form');
      }
      const data = await leadPublicFormService.deletePublicFormLead(
        req.params.token,
        req.params.id,
        tenantDbName,
        { userId }
      );
      sendResponse(res, 200, 'Lead deleted', data);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },
};
