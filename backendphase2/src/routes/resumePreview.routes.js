import { Router } from 'express';
import {
  getResumeDocxBytes,
  getResumePreview,
} from '../controllers/resumePreview.controller.js';

const router = Router();

/** GET /api/v1/resume-preview/bytes?url=... — raw DOCX for docx-preview in the browser */
router.get('/bytes', getResumeDocxBytes);

/** GET /api/v1/resume-preview?url=... — server-to-server from Next.js; no user JWT required */
router.get('/', getResumePreview);

export default router;
