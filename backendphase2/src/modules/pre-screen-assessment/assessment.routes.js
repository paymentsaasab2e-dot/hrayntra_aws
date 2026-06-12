import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { publicApplyTenantMiddleware } from '../../middleware/tenant-context.middleware.js';
import { preScreenAssessmentController } from './assessment.controller.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

// Public candidate routes (tenant via query/header/body)
router.get(
  '/public/jobs/:jobId',
  publicApplyTenantMiddleware,
  preScreenAssessmentController.getPortalJobAssessments
);
router.post(
  '/public/sessions/start',
  publicApplyTenantMiddleware,
  preScreenAssessmentController.startPublicSession
);
router.get(
  '/public/sessions/:token',
  publicApplyTenantMiddleware,
  preScreenAssessmentController.getPublicSession
);
router.post(
  '/public/sessions/:token/proctoring',
  publicApplyTenantMiddleware,
  preScreenAssessmentController.postProctoring
);
router.post(
  '/public/sessions/:token/submit',
  publicApplyTenantMiddleware,
  preScreenAssessmentController.submitPublicSession
);

router.use(authMiddleware);

router.get(
  '/library',
  requireAnyPermission(['jobs_read', 'view_jobs', 'jobs_create', 'create_job']),
  preScreenAssessmentController.listLibrary
);
router.post(
  '/library',
  requireAnyPermission(['jobs_create', 'create_job', 'jobs_update', 'edit_job']),
  preScreenAssessmentController.create
);
router.post(
  '/library/generate',
  requireAnyPermission(['jobs_create', 'create_job', 'jobs_update', 'edit_job']),
  preScreenAssessmentController.generateWithAi
);
router.get(
  '/library/:id',
  requireAnyPermission(['jobs_read', 'view_jobs']),
  preScreenAssessmentController.getById
);
router.patch(
  '/library/:id',
  requireAnyPermission(['jobs_update', 'edit_job', 'jobs_create', 'create_job']),
  preScreenAssessmentController.update
);
router.delete(
  '/library/:id',
  requireAnyPermission(['jobs_delete', 'delete_job', 'jobs_update', 'edit_job']),
  preScreenAssessmentController.delete
);

router.get(
  '/jobs/:jobId',
  requireAnyPermission(['jobs_read', 'view_jobs']),
  preScreenAssessmentController.getJobLinks
);
router.put(
  '/jobs/:jobId',
  requireAnyPermission(['jobs_update', 'edit_job', 'jobs_create', 'create_job']),
  preScreenAssessmentController.replaceJobLinks
);

router.get(
  '/applications/:applicationId/results',
  requireAnyPermission(['jobs_read', 'view_jobs', 'candidates_read']),
  preScreenAssessmentController.getApplicationResults
);
router.patch(
  '/sessions/:sessionId/grade',
  requireAnyPermission(['jobs_update', 'edit_job', 'jobs_read', 'view_jobs', 'candidates_read']),
  preScreenAssessmentController.gradeSession
);

export default router;
