import express from 'express';
import { taskController } from './task.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { uploadSingleTaskFile, uploadMultipleTaskFiles } from '../../utils/upload.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/stats', taskController.getStats);
router.get('/', taskController.getAll);
router.get('/:id', taskController.getById);
router.post('/', taskController.create);
router.patch('/:id', taskController.update);
router.post('/:id/notes', taskController.addNote);
router.post('/:id/complete', taskController.markCompleted);
router.delete('/:id', taskController.delete);

// File routes
router.get('/:taskId/files', taskController.getFiles);
router.post('/:taskId/files', uploadSingleTaskFile, taskController.uploadFile);
router.post('/:taskId/files/multiple', uploadMultipleTaskFiles, taskController.uploadMultipleFiles);
router.delete('/:taskId/files/:fileId', taskController.deleteFile);

// Attachment serving route (must be after file routes)
router.get('/:taskId/attachments/:filename', taskController.getAttachment);

export default router;
