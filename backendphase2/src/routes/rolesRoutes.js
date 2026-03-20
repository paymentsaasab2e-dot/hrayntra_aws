import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getAllPermissions,
} from '../controllers/rolesController.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Role routes
router.get('/', getAllRoles);
router.get('/:id', getRoleById);
router.post('/', requirePermission('assign_roles'), createRole);
router.patch('/:id', requirePermission('assign_roles'), updateRole);
router.delete('/:id', requirePermission('assign_roles'), deleteRole);

// Permissions route (grouped with roles)
router.get('/all-permissions', getAllPermissions);

export default router;
