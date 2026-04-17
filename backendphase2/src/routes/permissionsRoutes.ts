import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getAllPermissions } from '../controllers/rolesController.js';

const router: Router = express.Router();

// Apply auth middleware
router.use(authMiddleware);

// Permissions route
router.get('/', getAllPermissions);

export default router;
