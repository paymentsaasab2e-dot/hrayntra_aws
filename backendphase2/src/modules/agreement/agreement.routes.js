import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';
import { agreementController } from './agreement.controller.js';

const router = express.Router();

const agreementUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed =
      /application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i.test(
        file.mimetype || '',
      ) || /\.(pdf|doc|docx)$/i.test(file.originalname || '');
    if (allowed) return cb(null, true);
    return cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
  },
});

router.use(authMiddleware);

router.post(
  '/parse-document',
  requireAnyPermission(['leads_read', 'leads_create', 'leads_update', 'clients_read', 'clients_create', 'clients_update']),
  agreementUpload.single('file'),
  agreementController.parseDocument,
);

export default router;
