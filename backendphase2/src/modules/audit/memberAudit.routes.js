import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { memberAuditController } from './memberAudit.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/team-members', memberAuditController.getTeamOverview);
router.get('/team-members/:userId/timeline', memberAuditController.getMemberTimeline);

export default router;
