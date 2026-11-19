import { Router } from 'express';
import { DocumentController } from './document.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/', DocumentController.getAll);
router.get('/:id', DocumentController.getById);
router.post('/', DocumentController.create);
router.put('/:id', DocumentController.update);
router.patch('/:id/archive', DocumentController.archive);
router.delete('/:id', authorize(['ADMIN', 'HR']), DocumentController.delete);

export default router;
