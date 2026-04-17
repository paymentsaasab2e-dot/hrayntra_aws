import express from 'express';
import { matchController } from './match.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', matchController.getAll);
router.post('/bulk/reject', matchController.bulkReject);
router.post('/bulk/pipeline', matchController.bulkAddToPipeline);
router.post('/bulk/email', matchController.bulkEmail);
router.get('/:id', matchController.getById);
router.post('/:id/save', matchController.save);
router.post('/:id/submit', matchController.submit);
router.post('/:id/reject', matchController.reject);
router.post('/', matchController.create);
router.patch('/:id', matchController.update);
router.delete('/:id', matchController.delete);

export default router;
