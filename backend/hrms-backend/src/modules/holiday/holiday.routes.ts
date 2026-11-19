import { Router } from 'express';
import { HolidayController } from './holiday.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/', HolidayController.getAll);
router.get('/copy-preview', authorize(['ADMIN', 'HR']), HolidayController.previewCopy);
router.post('/copy-execute', authorize(['ADMIN', 'HR']), HolidayController.executeCopy);
router.post('/', authorize(['ADMIN', 'HR']), HolidayController.create);
router.post('/bulk', authorize(['ADMIN', 'HR']), HolidayController.bulkCreate);
router.patch('/:id', authorize(['ADMIN', 'HR']), HolidayController.update);
router.delete('/:id', authorize(['ADMIN', 'HR']), HolidayController.delete);

export default router;
