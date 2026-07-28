import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { brainController } from './brain.controller.js';

/**
 * HRYANTRA Enterprise Brain API
 * Mounted at /api/v1/brain
 *
 * Modular services: orchestration, memory, retrieval, schema, reports,
 * analytics, workflow, monitoring, permissions, tools.
 */
const router = express.Router();

router.use(authMiddleware);

router.post('/ask', brainController.ask);
router.get('/schema', brainController.schema);
router.get('/schema/:entityId', brainController.schema);
router.post('/retrieve', brainController.retrieve);
router.get('/analytics', brainController.analytics);
router.post('/reports', brainController.report);
router.get('/workflows', brainController.workflow);
router.post('/workflows', brainController.workflow);
router.get('/tools', brainController.tools);
router.get('/memory', brainController.memory);
router.get('/memory/:sessionKey', brainController.memory);
router.get('/health', brainController.health);
router.get('/audit', brainController.audit);

export default router;
