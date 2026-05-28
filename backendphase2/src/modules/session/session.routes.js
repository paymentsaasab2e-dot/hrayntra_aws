import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { sessionController } from './session.controller.js';

const router = express.Router();

router.post('/session/heartbeat', authMiddleware, sessionController.heartbeat);
router.get('/session/status', authMiddleware, sessionController.status);
router.post('/request-session-transfer', sessionController.requestTransfer);
router.post('/approve-session-transfer', authMiddleware, sessionController.approveTransfer);
router.post('/reject-session-transfer', authMiddleware, sessionController.rejectTransfer);
router.get('/session/transfer/:requestId', sessionController.transferStatus);
router.post('/complete-session-transfer', sessionController.completeTransfer);
router.get('/session/transfer/email/approve', sessionController.emailApproveTransfer);
router.get('/session/transfer/email/reject', sessionController.emailRejectTransfer);

export default router;
