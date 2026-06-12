import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';
import { alertManagementController } from './alert-management.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireAnyPermission(['manage_settings']));

router.get('/', alertManagementController.get);
router.patch('/', alertManagementController.update);
router.post('/test-email', alertManagementController.testEmail);
router.post('/test-portal', alertManagementController.testPortal);

export default router;
