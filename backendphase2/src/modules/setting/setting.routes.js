import express from 'express';
import { settingController } from './setting.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', requireAnyPermission(['manage_settings']), settingController.getAll);
router.get('/:key', requireAnyPermission(['manage_settings']), settingController.getByKey);
router.post('/', requireAnyPermission(['manage_settings']), settingController.create);
router.patch('/:key', requireAnyPermission(['manage_settings']), settingController.update);
router.delete('/:key', requireAnyPermission(['manage_settings']), settingController.delete);

export default router;
