import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { twilioTestController } from './twilio-test.controller.js';

const router = express.Router();
router.use(authMiddleware);
router.post('/test', twilioTestController.test);

export default router;
