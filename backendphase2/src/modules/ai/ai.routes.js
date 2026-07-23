import express from 'express';
import { aiController } from './ai.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/job-from-prompt', aiController.generateJobFromPrompt);
router.post('/job-title-suggestions', aiController.generateJobTitleSuggestions);
router.post('/job-description', aiController.generateJobDescription);
router.post('/lead-details', aiController.generateLeadDetails);
router.post('/lead-chat', aiController.generateLeadChat);
router.post('/client-details', aiController.generateClientDetails);
router.post('/client-chat', aiController.generateClientChat);
router.get('/location/search', aiController.searchLocations);
router.post('/location/resolve', aiController.resolveLocation);
router.post('/smart-search/parse', aiController.parseSmartSearch);
router.post('/assistant-chat', aiController.assistantChat);
router.post('/undo', aiController.executeUndo);
router.get('/assistant-history/:pageKey', aiController.getAssistantHistory);
router.put('/assistant-history/:pageKey', aiController.saveAssistantHistory);
router.delete('/assistant-history/:pageKey', aiController.deleteAssistantHistory);
router.get('/entry-recommendations', aiController.listEntryRecommendations);
router.post('/entry-recommendations/regenerate', aiController.regenerateEntryRecommendation);
router.get('/workspace-brief', aiController.getWorkspaceBrief);
router.post('/workspace-brief/generate', aiController.generateWorkspaceBrief);
router.get('/workspace-brief/alerts', aiController.getWorkspaceBriefEntityAlerts);
router.get('/workspace-brief/entity-alerts', aiController.getWorkspaceBriefEntityAlertsBatch);

export default router;
