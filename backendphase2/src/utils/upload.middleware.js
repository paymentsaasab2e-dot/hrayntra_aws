import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const ensureUploadsDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure storage for task files
export const taskFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const taskId = req.params.taskId || 'temp';
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'tasks', taskId);
    ensureUploadsDir(uploadsDir);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp_originalname
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedName}`;
    cb(null, filename);
  },
});

// File filter - allow all file types for now
export const fileFilter = (req, file, cb) => {
  // You can add file type validation here if needed
  cb(null, true);
};

// Multer configuration for task file uploads
export const taskFileUpload = multer({
  storage: taskFileStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Middleware for single file upload
export const uploadSingleTaskFile = taskFileUpload.single('file');

// Middleware for multiple file uploads
export const uploadMultipleTaskFiles = taskFileUpload.array('files', 10); // Max 10 files

// Configure storage for job files
export const jobFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const jobId = req.params.jobId || 'temp';
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'jobs', jobId);
    ensureUploadsDir(uploadsDir);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp_originalname
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedName}`;
    cb(null, filename);
  },
});

// Multer configuration for job file uploads
export const jobFileUpload = multer({
  storage: jobFileStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Middleware for single job file upload
export const uploadSingleJobFile = jobFileUpload.single('file');

// ── Generic files module (entityType + entityId from form body) ──
// Use memory storage so controller can write to the right path (e.g. uploads/jobs/{entityId}/)
const memoryStorage = multer.memoryStorage();

export const genericFileUpload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export const uploadSingleGenericFile = genericFileUpload.single('file');