import express from 'express';
import { pipelineController } from './pipeline.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/job/:jobId', pipelineController.getStagesByJob);
router.post('/job/:jobId/move', pipelineController.moveCandidate);
router.post('/job/:jobId/stages', pipelineController.createStage);
router.patch('/stages/:stageId', pipelineController.updateStage);
router.delete('/stages/:stageId', pipelineController.deleteStage);

export default router;
