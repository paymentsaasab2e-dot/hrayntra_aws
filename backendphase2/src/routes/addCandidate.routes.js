import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { addCandidateController } from '../controllers/addCandidate.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
const tempDir = path.join(uploadsRoot, 'temp');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(tempDir);

const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir(tempDir);
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${sanitizedName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.ms-excel',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error('Unsupported file type'));
    return;
  }

  cb(null, true);
};

const resumeUpload = multer({
  storage: tempStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const candidateFileUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const csvUpload = multer({
  storage: tempStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get('/candidates/bulk-import/template', authMiddleware, addCandidateController.downloadTemplate);
router.use(authMiddleware);

router.post('/candidates/create', addCandidateController.createCandidate);
router.post('/candidates/parse-resume', resumeUpload.single('resume'), addCandidateController.parseResume);
router.post('/candidates/import-linkedin', addCandidateController.importLinkedIn);
router.get('/candidates/check-duplicate', addCandidateController.checkDuplicate);
router.post('/candidates/bulk-import', csvUpload.single('csvFile'), addCandidateController.bulkImport);
router.post('/candidates/:candidateId/files', candidateFileUpload.single('resume'), addCandidateController.uploadCandidateFile);
router.get('/tags', addCandidateController.getTags);

export default router;
