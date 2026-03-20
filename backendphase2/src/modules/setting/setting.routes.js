import express from 'express';
import { settingController } from './setting.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', settingController.getAll);
router.get('/:key', settingController.getByKey);
router.post('/', settingController.create);
router.patch('/:key', settingController.update);
router.delete('/:key', settingController.delete);

export default router;
