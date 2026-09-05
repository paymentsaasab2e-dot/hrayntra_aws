import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';
import { requireCoins } from '../../middleware/requireCoins.middleware.js';
import { kycController } from './kyc.controller.js';

const router = express.Router();

const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed =
      /application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/vnd\.ms-excel|image\/(jpeg|jpg|png|webp)/i.test(
        file.mimetype || '',
      ) ||
      /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|webp)$/i.test(file.originalname || '');
    if (allowed) return cb(null, true);
    return cb(
      new Error('Only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, and WEBP files are allowed'),
    );
  },
});

router.use(authMiddleware);

router.post(
  '/parse-document',
  requireAnyPermission(['leads_read', 'leads_create', 'leads_update', 'clients_read', 'clients_create', 'clients_update', 'recruitment_clients_read', 'recruitment_clients_create', 'recruitment_clients_update']),
  kycUpload.single('file'),
  requireCoins('ai.kyc_parse'),
  kycController.parseDocument,
);

export default router;
