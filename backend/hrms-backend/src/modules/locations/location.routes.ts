import { Router } from 'express';
import { LocationController } from './location.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/', LocationController.getAll);
router.get('/:id', LocationController.getById);

router.post('/', authorize(['ADMIN', 'HR']), LocationController.create);
router.put('/:id', authorize(['ADMIN', 'HR']), LocationController.update);
router.delete('/:id', authorize(['ADMIN', 'HR']), LocationController.delete);

export default router;
