import express from 'express';
import { activityController } from './activity.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

const activityRead = requireAnyPermission(['view_activity_log', 'reports_read', 'view_team_activity']);

router.use(authMiddleware);

router.get('/capabilities', activityRead, activityController.getCapabilities);
router.get('/viewable-members', activityRead, activityController.getViewableMembers);
router.get('/viewable-departments', activityRead, activityController.getViewableDepartments);
router.get('/', activityRead, activityController.getAll);
router.get('/:id', activityRead, activityController.getById);
router.post('/', requireAnyPermission(['manage_settings']), activityController.create);
router.delete('/:id', requireAnyPermission(['manage_settings']), activityController.delete);

export default router;
