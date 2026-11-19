import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../shared/middleware/auth';
import { PlatformController } from './platform.controller';

const router = Router();

function platformOnly(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).user?.role;
  if (role !== 'PLATFORM_OWNER') {
    return res.status(403).json({ message: 'Platform owner access required' });
  }
  next();
}

router.use(authMiddleware, platformOnly);

router.get('/packages', PlatformController.listPackages);
router.get('/stats', PlatformController.getStats);
router.get('/tenants', PlatformController.listTenants);
router.get('/tenants/:id', PlatformController.getTenant);
router.get('/tenants/:id/credentials', PlatformController.getTenantCredentials);
router.post('/tenants', PlatformController.createTenant);
router.patch('/tenants/:id', PlatformController.updateTenant);
router.patch('/tenants/:id/admin', PlatformController.updateTenantAdmin);
router.patch('/tenants/:id/package', PlatformController.updateTenantPackage);
router.delete('/tenants/:id', PlatformController.deleteTenant);

export default router;
