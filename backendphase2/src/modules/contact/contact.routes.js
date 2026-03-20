import express from 'express';
import { contactController } from './contact.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// Stats endpoint (before /:id route)
router.get('/stats', contactController.getStats);

// Duplicate detection (before /:id route)
router.get('/duplicates', contactController.detectDuplicates);

// CRUD routes
router.get('/', contactController.getAll);
router.post('/', contactController.create);
router.get('/:id', contactController.getById);
router.patch('/:id', contactController.update);
router.delete('/:id', contactController.delete);

// Bulk actions
router.post('/bulk', contactController.bulkAction);
router.post('/merge', contactController.mergeContacts);

// Related resources
router.post('/:id/notes', contactController.addNote);
router.post('/:id/activities', contactController.addActivity);
router.post('/:id/communications', contactController.addCommunication);

export default router;
