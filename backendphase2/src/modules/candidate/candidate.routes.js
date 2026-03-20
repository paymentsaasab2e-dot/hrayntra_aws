import express from 'express';
import { candidateController } from './candidate.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/stats', candidateController.getStats);
router.get('/', candidateController.getAll);
router.post('/:id/notes', candidateController.addNote);
router.patch('/:id/notes/:noteId', candidateController.updateNote);
router.delete('/:id/notes/:noteId', candidateController.deleteNote);
router.patch('/:id/notes/:noteId/pin', candidateController.pinNote);
router.post('/:id/tags', candidateController.addTag);
router.delete('/:id/tags/:tagId', candidateController.removeTag);
router.post('/:id/pipeline', candidateController.addToPipeline);
router.post('/:id/reject', candidateController.reject);
router.post('/:id/interviews', candidateController.scheduleInterview);
router.patch('/:id/interviews/:interviewId', candidateController.updateInterview);
router.post('/bulk-action', candidateController.bulkAction);
router.get('/:id', candidateController.getById);
router.post('/', candidateController.create);
router.patch('/:id', candidateController.update);
router.delete('/:id', candidateController.delete);

export default router;
