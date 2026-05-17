import { Router } from 'express';
import { getResumePreview } from '../controllers/resumePreview.controller.js';

const router = Router();

/** GET /api/v1/resume-preview?url=... — server-to-server from Next.js; no user JWT required */
router.get('/', getResumePreview);

export default router;
