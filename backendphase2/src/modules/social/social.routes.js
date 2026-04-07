import express from 'express';
import { socialController } from './social.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/publish', socialController.publishJobPost);
router.get('/status', socialController.getStatus);

export default router;
