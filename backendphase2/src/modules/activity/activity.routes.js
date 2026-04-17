import express from 'express';
import { activityController } from './activity.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', activityController.getAll);
router.get('/:id', activityController.getById);
router.post('/', activityController.create);
router.delete('/:id', activityController.delete);

export default router;
