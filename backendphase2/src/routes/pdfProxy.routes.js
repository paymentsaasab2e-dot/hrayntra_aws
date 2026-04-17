import { Router } from 'express';
import { getPdfProxy } from '../controllers/pdfProxy.controller.js';

const router = Router();

/** GET /api/v1/pdf-proxy?url=... — server-to-server from Next.js; no user JWT required */
router.get('/', getPdfProxy);

export default router;
