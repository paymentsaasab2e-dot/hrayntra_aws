import express from 'express';
import { pipelineController } from './pipeline.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/job/:jobId', requireAnyPermission(['pipeline_read', 'move_pipeline']), pipelineController.getStagesByJob);
router.post('/job/:jobId/move', requireAnyPermission(['pipeline_manage', 'move_pipeline']), pipelineController.moveCandidate);
router.post('/job/:jobId/stages', requireAnyPermission(['pipeline_manage']), pipelineController.createStage);
router.patch('/stages/:stageId', requireAnyPermission(['pipeline_manage']), pipelineController.updateStage);
router.delete('/stages/:stageId', requireAnyPermission(['pipeline_manage']), pipelineController.deleteStage);

export default router;
