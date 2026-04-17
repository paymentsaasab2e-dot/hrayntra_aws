import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentsController.js';

const router: Router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Department routes
router.get('/', getAllDepartments);
router.get('/:id', getDepartmentById);
router.post('/', requirePermission('add_team_member'), createDepartment);
router.patch('/:id', requirePermission('edit_team_member'), updateDepartment);
router.delete('/:id', requirePermission('edit_team_member'), deleteDepartment);

export default router;
