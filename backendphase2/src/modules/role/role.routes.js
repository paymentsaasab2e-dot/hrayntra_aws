import express from 'express';
import { roleController } from './role.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', roleController.getAll);

export default router;
