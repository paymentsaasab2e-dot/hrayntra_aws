import express from 'express';
import { leadController } from './lead.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', leadController.getAll);
router.get('/:id', leadController.getById);
router.get('/:id/activities', leadController.getActivities);
router.post('/', leadController.create);
router.patch('/:id', leadController.update);
router.post('/:id/convert', leadController.convertToClient);
router.delete('/:id', leadController.delete);

// Notes routes
router.get('/:leadId/notes', leadController.getNotes);
router.post('/:leadId/notes', leadController.createNote);
router.patch('/:leadId/notes/:noteId', leadController.updateNote);
router.delete('/:leadId/notes/:noteId', leadController.deleteNote);

export default router;
