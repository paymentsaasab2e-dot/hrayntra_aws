import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { placementController } from './placement.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authenticatedTenantAfterMulter } from '../../middleware/tenant-context.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'placements');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir(uploadsDir);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${sanitized}`);
  },
});

function isPdfUpload(file) {
  if (!file) return true;
  const mime = String(file.mimetype || '').toLowerCase();
  const name = String(file.originalname || '').toLowerCase();
  if (mime === 'application/pdf' || mime === 'application/x-pdf') return true;
  if (name.endsWith('.pdf')) return true;
  if (mime === 'application/octet-stream' && name.endsWith('.pdf')) return true;
  return false;
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isPdfUpload(file)) {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

router.use(authMiddleware);

router.get('/stats', requireAnyPermission(['placements_read']), placementController.getStats);
router.get('/export', requireAnyPermission(['placements_read']), placementController.exportCsv);
router.get('/', requireAnyPermission(['placements_read']), placementController.getAll);
router.post('/', requireAnyPermission(['placements_create']), upload.single('offerLetter'), placementController.create);
router.post(
  '/:id/invoice',
  requireAnyPermission(['create_invoice']),
  placementController.createInvoice
);
router.get('/:id', requireAnyPermission(['placements_read']), placementController.getById);
router.patch('/:id/status', requireAnyPermission(['placements_update']), placementController.updateStatus);
router.patch('/:id', requireAnyPermission(['placements_update']), placementController.update);
router.patch(
  '/:id/mark-joined',
  requireAnyPermission(['placements_update']),
  upload.single('joiningLetter'),
  authenticatedTenantAfterMulter,
  placementController.markJoined
);
router.patch('/:id/mark-failed', requireAnyPermission(['placements_update']), placementController.markFailed);
router.patch('/:id/request-replacement', requireAnyPermission(['placements_update']), placementController.requestReplacement);
router.patch('/:id/schedule-joining', requireAnyPermission(['placements_update']), placementController.scheduleJoining);
router.patch(
  '/:id/resend-offer',
  requireAnyPermission(['placements_update']),
  upload.single('offerLetter'),
  authenticatedTenantAfterMulter,
  placementController.resendOffer
);
router.patch('/:id/undo', requireAnyPermission(['placements_update']), placementController.undo);
router.delete('/:id', requireAnyPermission(['placements_delete']), placementController.delete);

export default router;
