import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';
import { publicApplyTenantMiddleware } from '../../middleware/tenant-context.middleware.js';
import { publicApplyUpload } from '../../utils/upload.middleware.js';
import { interviewApplicationController } from './interviewApplication.controller.js';

const router = express.Router();

// Public Phase 1 routes (no auth)
router.get('/public/forms', interviewApplicationController.listPublishedFormsPublic);
router.get('/public/forms/:token', interviewApplicationController.getPublicFormPage);
router.post(
  '/public/forms/:token/submit',
  publicApplyUpload,
  publicApplyTenantMiddleware,
  interviewApplicationController.submitPublicForm
);

router.use(authMiddleware);

// Interview form CRUD (tenant)
router.get(
  '/forms',
  requireAnyPermission(['interviews_read', 'interviews_create']),
  interviewApplicationController.listForms
);
router.post(
  '/forms',
  requireAnyPermission(['interviews_create']),
  interviewApplicationController.createForm
);
router.get(
  '/forms/:id',
  requireAnyPermission(['interviews_read']),
  interviewApplicationController.getForm
);
router.patch(
  '/forms/:id',
  requireAnyPermission(['interviews_update']),
  interviewApplicationController.updateForm
);
router.post(
  '/forms/:id/publish',
  requireAnyPermission(['interviews_update']),
  interviewApplicationController.publishForm
);
router.post(
  '/forms/:id/unpublish',
  requireAnyPermission(['interviews_update']),
  interviewApplicationController.unpublishForm
);
router.post(
  '/forms/:id/archive',
  requireAnyPermission(['interviews_update']),
  interviewApplicationController.archiveForm
);
router.delete(
  '/forms/:id',
  requireAnyPermission(['interviews_delete']),
  interviewApplicationController.deleteForm
);

// Applications (tenant review)
router.get(
  '/applications',
  requireAnyPermission(['interviews_read']),
  interviewApplicationController.listApplications
);
router.get(
  '/applications/interviewer',
  requireAnyPermission(['interviews_read']),
  interviewApplicationController.listInterviewerApplications
);
router.get(
  '/applications/:id',
  requireAnyPermission(['interviews_read']),
  interviewApplicationController.getApplication
);
router.patch(
  '/applications/:id',
  requireAnyPermission(['interviews_update']),
  interviewApplicationController.updateApplication
);

export default router;
