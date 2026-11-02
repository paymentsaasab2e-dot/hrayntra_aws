import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';
import { jobPostingPlanController } from './jobPostingPlan.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  requireAnyPermission([
    'jobs_read',
    'view_jobs',
    'jobs_create',
    'create_job',
    'manage_settings',
  ]),
  jobPostingPlanController.getStatus,
);

router.post(
  '/payment-order',
  requireAnyPermission(['jobs_create', 'create_job', 'manage_settings', 'publish_job']),
  jobPostingPlanController.createPaymentOrder,
);

router.post(
  '/activate',
  requireAnyPermission(['jobs_create', 'create_job', 'manage_settings', 'publish_job']),
  jobPostingPlanController.activate,
);

export default router;
