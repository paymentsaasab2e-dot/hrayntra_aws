import { sendError, sendResponse } from '../../utils/response.js';
import { resolvePublicApplyTenant } from '../../middleware/tenant-context.middleware.js';
import { runWithTenantContext } from '../../config/prisma.js';
import { preScreenAssessmentService } from './assessment.service.js';
import {
  generateCodingAssessmentWithAi,
  generateMcqAssessmentWithAi,
  generatePreScreenAssessmentsWithAi,
} from './assessmentAiGenerate.service.js';

export const preScreenAssessmentController = {
  async listLibrary(req, res) {
    try {
      const items = await preScreenAssessmentService.listLibrary({ type: req.query?.type });
      sendResponse(res, 200, 'Assessments retrieved', items);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const item = await preScreenAssessmentService.getById(req.params.id);
      if (!item) return sendError(res, 404, 'Assessment not found');
      sendResponse(res, 200, 'Assessment retrieved', item);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const item = await preScreenAssessmentService.create(req.body, req.user?.id);
      sendResponse(res, 201, 'Assessment created', item);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async generateWithAi(req, res) {
    try {
      const { type, jobTitle, skills, jobDescription } = req.body || {};
      if (String(type || '').toUpperCase() === 'MCQ') {
        const mcq = await generateMcqAssessmentWithAi({
          jobTitle,
          skills,
          jobDescription,
        });
        return sendResponse(res, 200, 'MCQ assessment generated', mcq);
      }
      if (String(type || '').toUpperCase() === 'CODING') {
        const coding = await generateCodingAssessmentWithAi({
          jobTitle,
          skills,
          jobDescription,
        });
        return sendResponse(res, 200, 'Coding assessment generated', coding);
      }
      const generated = await generatePreScreenAssessmentsWithAi({
        jobTitle,
        skills,
        jobDescription,
      });
      sendResponse(res, 200, 'Assessments generated', generated);
    } catch (error) {
      const status = String(error?.message || '').includes('not configured') ? 503 : 400;
      sendError(res, status, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const item = await preScreenAssessmentService.update(req.params.id, req.body);
      sendResponse(res, 200, 'Assessment updated', item);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      await preScreenAssessmentService.softDelete(req.params.id);
      sendResponse(res, 200, 'Assessment deleted');
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getJobLinks(req, res) {
    try {
      const links = await preScreenAssessmentService.getJobLinks(req.params.jobId);
      sendResponse(res, 200, 'Job assessments retrieved', links);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async replaceJobLinks(req, res) {
    try {
      const links = await preScreenAssessmentService.replaceJobLinks(
        req.params.jobId,
        req.body?.links || req.body?.preScreenAssessments || []
      );
      try {
        const { refreshJobPortalMirror } = await import('../job/job.service.js');
        await refreshJobPortalMirror(req.params.jobId);
      } catch (syncErr) {
        console.warn('[pre-screen] portal mirror after link update failed:', syncErr?.message || syncErr);
      }
      sendResponse(res, 200, 'Job assessments updated', links);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getPortalJobAssessments(req, res) {
    try {
      const tenantDbName = resolvePublicApplyTenant(req);
      const run = async () => {
        const items = await preScreenAssessmentService.getPortalJobAssessments(req.params.jobId);
        sendResponse(res, 200, 'Job assessments', items);
      };
      if (tenantDbName) return runWithTenantContext(tenantDbName, run);
      return run();
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async startPublicSession(req, res) {
    try {
      const tenantDbName = resolvePublicApplyTenant(req);
      const { jobId, candidateId, applicationId, jobAssessmentId } = req.body || {};
      if (!jobId || !candidateId || !jobAssessmentId) {
        return sendError(res, 400, 'jobId, candidateId, and jobAssessmentId are required');
      }
      const run = async () => {
        const session = await preScreenAssessmentService.startSession({
          jobId,
          candidateId,
          applicationId,
          jobAssessmentId,
          tenantDbName,
        });
        sendResponse(res, 201, 'Session started', session);
      };
      if (tenantDbName) return runWithTenantContext(tenantDbName, run);
      return run();
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getPublicSession(req, res) {
    try {
      const tenantDbName = resolvePublicApplyTenant(req);
      const run = async () => {
        const session = await preScreenAssessmentService.getSessionForCandidate(
          req.params.token,
          { tenantDbName }
        );
        sendResponse(res, 200, 'Session', session);
      };
      if (tenantDbName) return runWithTenantContext(tenantDbName, run);
      return run();
    } catch (error) {
      sendError(res, 404, error.message, error);
    }
  },

  async postProctoring(req, res) {
    try {
      const tenantDbName = resolvePublicApplyTenant(req);
      const run = async () => {
        const result = await preScreenAssessmentService.logProctoringEvent(req.params.token, req.body);
        sendResponse(res, 200, 'Logged', result);
      };
      if (tenantDbName) return runWithTenantContext(tenantDbName, run);
      return run();
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async submitPublicSession(req, res) {
    try {
      const tenantDbName = resolvePublicApplyTenant(req);
      const run = async () => {
        const result = await preScreenAssessmentService.submitSession(
          req.params.token,
          req.body?.answers || {}
        );
        sendResponse(res, 200, 'Submitted', result);
      };
      if (tenantDbName) return runWithTenantContext(tenantDbName, run);
      return run();
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getApplicationResults(req, res) {
    try {
      const results = await preScreenAssessmentService.getApplicationAssessmentResults(
        req.params.applicationId
      );
      sendResponse(res, 200, 'Assessment results', results);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getCandidateResults(req, res) {
    try {
      const jobId = String(req.query?.jobId || '').trim() || undefined;
      const results = await preScreenAssessmentService.getCandidateAssessmentResults(
        req.params.candidateId,
        { jobId }
      );
      sendResponse(res, 200, 'Candidate assessment results', results);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async gradeSession(req, res) {
    try {
      const result = await preScreenAssessmentService.gradeSession(req.params.sessionId, {
        scorePercent: req.body?.scorePercent,
        reviewNote: req.body?.reviewNote,
        reviewedById: req.user?.id,
      });
      sendResponse(res, 200, 'Assessment graded', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
