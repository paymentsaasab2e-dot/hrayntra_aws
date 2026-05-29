import express from 'express';
import { activityController } from './activity.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', requireAnyPermission(['view_activity_log', 'reports_read']), activityController.getAll);
router.get('/:id', requireAnyPermission(['view_activity_log', 'reports_read']), activityController.getById);
router.post('/', requireAnyPermission(['manage_settings']), activityController.create);
router.delete('/:id', requireAnyPermission(['manage_settings']), activityController.delete);

export default router;
