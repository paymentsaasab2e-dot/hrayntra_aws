import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireAnyPermission } from '../middleware/permission.middleware.js';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getAllPermissions,
} from '../controllers/rolesController.js';

const router: Router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Role routes
router.get('/', getAllRoles);
router.get('/:id', getRoleById);
router.post('/', requireAnyPermission(['manage_roles', 'assign_roles']), createRole);
router.patch('/:id', requireAnyPermission(['manage_roles', 'assign_roles']), updateRole);
router.delete('/:id', requireAnyPermission(['manage_roles', 'assign_roles']), deleteRole);

// Permissions route (grouped with roles)
router.get('/all-permissions', getAllPermissions);

export default router;
