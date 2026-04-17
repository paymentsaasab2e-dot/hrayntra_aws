import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleMiddleware } from '../../middleware/role.middleware.js';
import { userCommunicationController } from './user-communication.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', userCommunicationController.get);
router.get('/connections', userCommunicationController.getConnections);

router.put('/', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), userCommunicationController.put);
router.patch('/', userCommunicationController.patch);
router.post('/reset', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), userCommunicationController.reset);

router.patch('/job-board', userCommunicationController.patchJobBoard);
router.delete('/job-board', userCommunicationController.deleteJobBoard);

export default router;
