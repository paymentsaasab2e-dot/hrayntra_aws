import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { attachUserPermissions, requireAnyPermission } from '../middleware/permission.middleware.js';
import {
  createCrossDeptRequest,
  forwardCrossDeptRequest,
  getCrossDeptAssignOptions,
  listCrossDeptRequests,
  reviewCrossDeptRequest,
} from '../controllers/crossDepartmentRequestController.js';

const router = express.Router();

router.use(authMiddleware);
router.use(attachUserPermissions);

router.get('/assign-options', requireAnyPermission(['requests_read', 'tasks_create', 'tasks_read', 'clients_handoff']), getCrossDeptAssignOptions);
router.get('/', requireAnyPermission(['requests_read', 'view_all_requests']), listCrossDeptRequests);
router.post('/', requireAnyPermission(['requests_create', 'tasks_create', 'clients_update', 'clients_handoff']), createCrossDeptRequest);
router.patch('/:id/review', requireAnyPermission(['requests_update', 'tasks_update']), reviewCrossDeptRequest);
router.patch('/:id/forward', requireAnyPermission(['requests_update', 'tasks_update']), forwardCrossDeptRequest);

export default router;
