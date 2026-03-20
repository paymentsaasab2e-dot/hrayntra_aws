import express from 'express';
import { socialController } from './social.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/linkedin/post', socialController.postToLinkedIn);
router.post('/twitter/post', socialController.postToTwitter);
router.post('/facebook/post', socialController.postToFacebook);

export default router;
