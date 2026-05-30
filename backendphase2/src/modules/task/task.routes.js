import express from 'express';
import { taskController } from './task.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';
import { uploadSingleTaskFile, uploadMultipleTaskFiles } from '../../utils/upload.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/stats', requireAnyPermission(['tasks_read']), taskController.getStats);
router.get('/assignable-members', requireAnyPermission(['tasks_create', 'tasks_update']), taskController.getAssignableMembers);
router.get('/', requireAnyPermission(['tasks_read']), taskController.getAll);
router.get('/:id/activities', requireAnyPermission(['tasks_read']), taskController.getActivities);
router.get('/:id', requireAnyPermission(['tasks_read']), taskController.getById);
router.post('/', requireAnyPermission(['tasks_create']), taskController.create);
router.patch('/:id', requireAnyPermission(['tasks_update']), taskController.update);
router.post('/:id/notes', requireAnyPermission(['tasks_update']), taskController.addNote);
router.post('/:id/complete', requireAnyPermission(['tasks_update']), taskController.markCompleted);
router.delete('/:id', requireAnyPermission(['tasks_delete']), taskController.delete);

// File routes
router.get('/:taskId/files', requireAnyPermission(['tasks_read']), taskController.getFiles);
router.post('/:taskId/files', requireAnyPermission(['tasks_update']), uploadSingleTaskFile, taskController.uploadFile);
router.post('/:taskId/files/multiple', requireAnyPermission(['tasks_update']), uploadMultipleTaskFiles, taskController.uploadMultipleFiles);
router.delete('/:taskId/files/:fileId', requireAnyPermission(['tasks_update']), taskController.deleteFile);

// Attachment serving route (must be after file routes)
router.get('/:taskId/attachments/:filename/preview', requireAnyPermission(['tasks_read']), taskController.getAttachmentPreview);
router.get('/:taskId/attachments/:filename', requireAnyPermission(['tasks_read']), taskController.getAttachment);

export default router;
