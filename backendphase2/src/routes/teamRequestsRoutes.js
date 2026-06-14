import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { attachUserPermissions, requireAnyPermission, requirePermission } from '../middleware/permission.middleware.js';
import {
  listTeamRequests,
  getTeamRequest,
  createTeamRequest,
  updateTeamRequestStatus,
  forwardTeamRequestToTask,
  linkTeamRequestToJob,
  deleteTeamRequest,
} from '../controllers/teamRequestsController.js';

const router = express.Router();

router.use(authMiddleware);
router.use(attachUserPermissions);

router.get('/', requireAnyPermission(['requests_read', 'view_all_requests']), listTeamRequests);
router.get('/:id', requireAnyPermission(['requests_read', 'view_all_requests']), getTeamRequest);
router.post('/', requirePermission('requests_create'), createTeamRequest);
router.patch('/:id/status', requirePermission('requests_update'), updateTeamRequestStatus);
router.patch('/:id/create-task', requirePermission('requests_update'), forwardTeamRequestToTask);
router.patch('/:id/link-job', requireAnyPermission(['jobs_create', 'create_job']), linkTeamRequestToJob);
router.delete('/:id', requireAnyPermission(['requests_delete', 'requests_read', 'view_all_requests']), deleteTeamRequest);

export default router;
