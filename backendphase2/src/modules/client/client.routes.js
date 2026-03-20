import express from 'express';
import { clientController } from './client.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', clientController.getAll);
router.get('/metrics', clientController.getMetrics);
router.get('/:id', clientController.getById);
router.get('/:clientId/activities', clientController.getActivities);
router.post('/', clientController.create);
router.patch('/:id', clientController.update);
router.delete('/:id', clientController.delete);

// Notes routes
router.get('/:clientId/notes', clientController.getNotes);
router.post('/:clientId/notes', clientController.createNote);
router.patch('/:clientId/notes/:noteId', clientController.updateNote);
router.delete('/:clientId/notes/:noteId', clientController.deleteNote);

// Files routes
router.get('/:clientId/files', clientController.getFiles);
router.post('/:clientId/files', clientController.createFile);
router.delete('/:clientId/files/:fileId', clientController.deleteFile);

export default router;
