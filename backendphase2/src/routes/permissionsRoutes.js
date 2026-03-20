import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getAllPermissions } from '../controllers/rolesController.js';

const router = express.Router();

// Apply auth middleware
router.use(authMiddleware);

// Permissions route
router.get('/', getAllPermissions);

export default router;
