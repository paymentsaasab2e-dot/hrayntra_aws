import express from 'express';
import { aiController } from './ai.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCoins } from '../../middleware/requireCoins.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/job-from-prompt', requireCoins('ai.job_from_prompt'), aiController.generateJobFromPrompt);
router.post(
  '/job-title-suggestions',
  requireCoins('ai.job_title_suggestions'),
  aiController.generateJobTitleSuggestions
);
router.post('/job-description', requireCoins('ai.job_description'), aiController.generateJobDescription);
router.post('/lead-details', requireCoins('ai.lead_details'), aiController.generateLeadDetails);
router.post('/lead-chat', requireCoins('ai.lead_chat'), aiController.generateLeadChat);
router.post('/client-details', requireCoins('ai.client_details'), aiController.generateClientDetails);
router.post('/client-chat', requireCoins('ai.client_chat'), aiController.generateClientChat);
router.post('/candidate-details', requireCoins('ai.candidate_details'), aiController.generateCandidateDetails);
router.post('/candidate-chat', requireCoins('ai.candidate_chat'), aiController.generateCandidateChat);
router.get('/location/search', aiController.searchLocations);
router.post('/location/resolve', requireCoins('ai.location_resolve'), aiController.resolveLocation);
router.get('/location/reverse', aiController.reverseGeocodeLocation);
router.post('/smart-search/parse', requireCoins('ai.smart_search'), aiController.parseSmartSearch);
router.post('/assistant-chat', requireCoins('ai.assistant_chat'), aiController.assistantChat);
router.post('/undo', aiController.executeUndo);
router.get('/assistant-history/:pageKey', aiController.getAssistantHistory);
router.put('/assistant-history/:pageKey', aiController.saveAssistantHistory);
router.delete('/assistant-history/:pageKey', aiController.deleteAssistantHistory);
router.get('/entry-recommendations', aiController.listEntryRecommendations);
router.post(
  '/entry-recommendations/regenerate',
  requireCoins('ai.entry_recommendations'),
  aiController.regenerateEntryRecommendation
);
router.get('/workspace-brief', aiController.getWorkspaceBrief);
router.post(
  '/workspace-brief/generate',
  requireCoins('ai.workspace_brief'),
  aiController.generateWorkspaceBrief
);
router.get('/workspace-brief/alerts', aiController.getWorkspaceBriefEntityAlerts);
router.get('/workspace-brief/entity-alerts', aiController.getWorkspaceBriefEntityAlertsBatch);

export default router;
