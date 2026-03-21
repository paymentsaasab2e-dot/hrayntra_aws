import express from 'express';
import { aiController } from './ai.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/job-description', aiController.generateJobDescription);
router.post('/assistant-chat', aiController.assistantChat);

export default router;
