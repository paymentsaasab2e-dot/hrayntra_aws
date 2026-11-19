import { Router } from 'express';
import { AssetController } from './asset.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/', AssetController.getAll);
router.get('/allocations', AssetController.getAllocations);
router.get('/:id', AssetController.getById);

router.post('/', authorize(['ADMIN', 'HR']), AssetController.create);
router.put('/:id', authorize(['ADMIN', 'HR']), AssetController.update);
router.delete('/:id', authorize(['ADMIN', 'HR']), AssetController.delete);
router.post('/assign', authorize(['ADMIN', 'HR']), AssetController.assignAsset);
router.patch('/return/:id', authorize(['ADMIN', 'HR']), AssetController.returnAsset);

export default router;
