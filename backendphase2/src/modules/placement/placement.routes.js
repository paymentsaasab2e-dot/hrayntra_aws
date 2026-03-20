import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { placementController } from './placement.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

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

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

router.use(authMiddleware);

router.get('/stats', placementController.getStats);
router.get('/export', placementController.exportCsv);
router.get('/', placementController.getAll);
router.post('/', upload.single('offerLetter'), placementController.create);
router.get('/:id', placementController.getById);
router.patch('/:id', placementController.update);
router.patch('/:id/mark-joined', upload.single('joiningLetter'), placementController.markJoined);
router.patch('/:id/mark-failed', placementController.markFailed);
router.patch('/:id/request-replacement', placementController.requestReplacement);
router.delete('/:id', placementController.delete);

export default router;
