import express from 'express';
import { departmentController } from './department.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', departmentController.getAll);
router.post('/', requirePermission('add_team_member'), departmentController.create);

export default router;
