import express from 'express';
import { candidateController } from './candidate.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/stats', requireAnyPermission(['candidates_read', 'view_all_candidates', 'view_assigned_candidates']), candidateController.getStats);
router.get('/', requireAnyPermission(['candidates_read', 'view_all_candidates', 'view_assigned_candidates']), candidateController.getAll);
router.post('/:id/notes', requireAnyPermission(['candidates_update', 'edit_candidate']), candidateController.addNote);
router.patch('/:id/notes/:noteId', requireAnyPermission(['candidates_update', 'edit_candidate']), candidateController.updateNote);
router.delete('/:id/notes/:noteId', requireAnyPermission(['candidates_delete', 'delete_candidate']), candidateController.deleteNote);
router.patch('/:id/notes/:noteId/pin', requireAnyPermission(['candidates_update', 'edit_candidate']), candidateController.pinNote);
router.post('/:id/tags', requireAnyPermission(['candidates_update', 'edit_candidate']), candidateController.addTag);
router.delete('/:id/tags/:tagId', requireAnyPermission(['candidates_update', 'edit_candidate']), candidateController.removeTag);
router.post('/:id/pipeline', requireAnyPermission(['move_pipeline', 'candidates_update']), candidateController.addToPipeline);
router.post('/:id/reject', requireAnyPermission(['candidates_update', 'edit_candidate']), candidateController.reject);
router.post('/:id/interviews/meeting-link', requireAnyPermission(['interviews_create', 'interviews_update', 'candidates_update']), candidateController.generateInterviewMeetingLink);
router.post('/:id/interviews', requireAnyPermission(['interviews_create', 'candidates_update']), candidateController.scheduleInterview);
router.patch('/:id/interviews/:interviewId', requireAnyPermission(['interviews_update', 'candidates_update']), candidateController.updateInterview);
router.post('/bulk-action', requireAnyPermission(['candidates_update', 'edit_candidate', 'delete_candidate', 'move_pipeline', 'submit_candidate']), candidateController.bulkAction);
router.get('/:id', requireAnyPermission(['candidates_read', 'view_all_candidates', 'view_assigned_candidates']), candidateController.getById);
router.post('/', requireAnyPermission(['candidates_create', 'add_candidate']), candidateController.create);
router.patch('/:id', requireAnyPermission(['candidates_update', 'edit_candidate']), candidateController.update);
router.delete('/:id', requireAnyPermission(['candidates_delete', 'delete_candidate']), candidateController.delete);

export default router;
