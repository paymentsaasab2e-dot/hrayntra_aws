import express from 'express';
import { billingController } from './billing.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', billingController.getAll);
router.get('/:id', billingController.getById);
router.post('/', billingController.create);
router.patch('/:id', billingController.update);
router.delete('/:id', billingController.delete);

export default router;
