import express from 'express';
import { userController } from './user.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleMiddleware } from '../../middleware/role.middleware.js';

const router = express.Router();

router.get('/', authMiddleware, userController.getAll);
router.get('/:id', authMiddleware, userController.getById);
router.patch('/:id', authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN']), userController.update);
router.delete('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN']), userController.delete);

export default router;
