import express from 'express';
import { aiController } from './ai.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/job-description', aiController.generateJobDescription);
router.post('/lead-details', aiController.generateLeadDetails);
router.post('/assistant-chat', aiController.assistantChat);
router.get('/assistant-history/:pageKey', aiController.getAssistantHistory);
router.put('/assistant-history/:pageKey', aiController.saveAssistantHistory);
router.delete('/assistant-history/:pageKey', aiController.deleteAssistantHistory);

export default router;
