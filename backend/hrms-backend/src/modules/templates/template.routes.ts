import { Router } from 'express';
import { TemplateController } from './template.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/', TemplateController.getAll);
router.post('/seed-standards', authorize(['ADMIN', 'HR']), TemplateController.seedStandards);
router.get('/:id', TemplateController.getById);

// Admin & HR template authoring & application
router.post('/', authorize(['ADMIN', 'HR']), TemplateController.create);
router.put('/:id', authorize(['ADMIN', 'HR']), TemplateController.update);
router.delete('/:id', authorize(['ADMIN', 'HR']), TemplateController.delete);
router.post('/:id/duplicate', authorize(['ADMIN', 'HR']), TemplateController.duplicate);
router.post('/:id/apply', authorize(['ADMIN', 'HR']), TemplateController.apply);

export default router;

