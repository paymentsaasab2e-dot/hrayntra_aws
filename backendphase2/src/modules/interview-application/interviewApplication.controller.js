import { interviewApplicationService } from './interviewApplication.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { getActiveTenantDbName, runWithTenantContext } from '../../config/prisma.js';
import { resolvePublicApplyTenant } from '../../middleware/tenant-context.middleware.js';

export const interviewApplicationController = {
  async listForms(req, res) {
    try {
      const rows = await interviewApplicationService.listForms();
      sendResponse(res, 200, 'Interview forms retrieved', rows);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },

  async getForm(req, res) {
    try {
      const row = await interviewApplicationService.getForm(req.params.id);
      sendResponse(res, 200, 'Interview form retrieved', row);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },

  async createForm(req, res) {
    try {
      const row = await interviewApplicationService.createForm(req);
      sendResponse(res, 201, 'Interview form created', row);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async updateForm(req, res) {
    try {
      const row = await interviewApplicationService.updateForm(req.params.id, req);
      sendResponse(res, 200, 'Interview form updated', row);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async publishForm(req, res) {
    try {
      const row = await interviewApplicationService.publishForm(req.params.id);
      sendResponse(res, 200, 'Interview form published', row);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async unpublishForm(req, res) {
    try {
      const row = await interviewApplicationService.unpublishForm(req.params.id);
      sendResponse(res, 200, 'Interview form unpublished', row);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async archiveForm(req, res) {
    try {
      const row = await interviewApplicationService.archiveForm(req.params.id);
      sendResponse(res, 200, 'Interview form archived', row);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async deleteForm(req, res) {
    try {
      await interviewApplicationService.deleteForm(req.params.id);
      sendResponse(res, 200, 'Interview form deleted', { deleted: true });
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async listPublishedFormsPublic(req, res) {
    try {
      const tenantDbName = resolvePublicApplyTenant(req);
      const applicant = {
        email: String(req.query?.applicantEmail || req.query?.email || '').trim(),
        phone: String(req.query?.applicantPhone || req.query?.phone || '').trim(),
        phones: String(req.query?.applicantPhones || '').trim(),
        phase1CandidateId: String(req.query?.phase1CandidateId || req.query?.candidateId || '').trim(),
        firstName: String(req.query?.applicantFirstName || '').trim(),
        lastName: String(req.query?.applicantLastName || '').trim(),
      };
      let rows;
      if (tenantDbName) {
        rows = await runWithTenantContext(tenantDbName, () =>
          interviewApplicationService.listPublishedFormsPublic(),
        );
        rows = await interviewApplicationService.enrichPublishedFormsForPublic(rows, applicant);
      } else {
        rows = await interviewApplicationService.listPublishedFormsPublicForApplicant(applicant);
      }
      sendResponse(res, 200, 'Published interview forms', rows);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },

  async getPublicFormPage(req, res) {
    try {
      const tenantDbName = resolvePublicApplyTenant(req);
      const data = tenantDbName
        ? await runWithTenantContext(tenantDbName, () =>
            interviewApplicationService.getPublicFormPage(req.params.token),
          )
        : await interviewApplicationService.getPublicFormPageAcrossTenants(req.params.token);
      sendResponse(res, 200, 'Interview form page', data);
    } catch (error) {
      sendError(res, error.statusCode || 404, error.message, error);
    }
  },

  async submitPublicForm(req, res) {
    try {
      let tenantDbName = resolvePublicApplyTenant(req);
      const token = String(req.params.token || '').trim();
      if (!tenantDbName) {
        const resolved = await interviewApplicationService.resolveTenantForPublishedToken(token);
        if (resolved == null) {
          return sendError(res, 404, 'Interview form not found');
        }
        tenantDbName = resolved;
      }
      const filesMap = {};
      for (const file of req.files || []) {
        filesMap[file.fieldname] = file;
      }
      const run = () =>
        interviewApplicationService.submitPublicForm(token, {
          answers: req.body?.answers,
          files: filesMap,
          phase1CandidateId: req.body?.phase1CandidateId || req.body?.candidateId,
        });
      const result = await runWithTenantContext(tenantDbName, run);
      sendResponse(res, 201, result.message, result);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },

  async listApplications(req, res) {
    try {
      const rows = await interviewApplicationService.listApplications(req.query);
      sendResponse(res, 200, 'Interview applications retrieved', rows);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },

  async listInterviewerApplications(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return sendError(res, 401, 'Unauthorized');
      const rows = await interviewApplicationService.listInterviewerApplications(userId, req.query);
      sendResponse(res, 200, 'Interviewer applications retrieved', rows);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message, error);
    }
  },

  async getApplication(req, res) {
    try {
      const row = await interviewApplicationService.getApplication(req.params.id);
      sendResponse(res, 200, 'Interview application retrieved', row);
    } catch (error) {
      sendError(res, error.statusCode || 404, error.message, error);
    }
  },

  async updateApplication(req, res) {
    try {
      const row = await interviewApplicationService.updateApplication(
        req.params.id,
        req.body || {},
        req.user?.id
      );
      sendResponse(res, 200, 'Interview application updated', row);
    } catch (error) {
      sendError(res, error.statusCode || 400, error.message, error);
    }
  },
};
