import express from 'express';
import { jobController } from './job.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { uploadSingleJobFile } from '../../utils/upload.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', jobController.getAll);
router.get('/metrics', jobController.getMetrics);
router.get('/:id', jobController.getById);
router.post('/', jobController.create);
router.patch('/:id', jobController.update);
router.delete('/:id', jobController.delete);

// Notes routes
router.get('/:jobId/notes', jobController.getNotes);
router.post('/:jobId/notes', jobController.createNote);
router.patch('/:jobId/notes/:noteId', jobController.updateNote);
router.delete('/:jobId/notes/:noteId', jobController.deleteNote);

// Files routes
router.get('/:jobId/files', jobController.getFiles);
router.post('/:jobId/files', uploadSingleJobFile, jobController.createFile);
router.delete('/:jobId/files/:fileId', jobController.deleteFile);

export default router;
