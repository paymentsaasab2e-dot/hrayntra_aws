import { Router } from 'express';
import { MasterDataController } from './master-data.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';

const router = Router();

router.use(authMiddleware);

// Read-only for all authenticated tenant users (needed for employee forms, filters, dropdowns)
router.get('/', MasterDataController.getMasterData);

// Manage Master Data: HR, Admin, Superadmin, Platform Owner only
router.post('/departments', authorize(['ADMIN', 'HR', 'PLATFORM_OWNER']), MasterDataController.upsertDepartment);
router.delete('/departments/:id', authorize(['ADMIN', 'HR', 'PLATFORM_OWNER']), MasterDataController.deleteDepartment);

router.post('/designations', authorize(['ADMIN', 'HR', 'PLATFORM_OWNER']), MasterDataController.upsertDesignation);
router.delete('/designations/:id', authorize(['ADMIN', 'HR', 'PLATFORM_OWNER']), MasterDataController.deleteDesignation);

router.post('/grades', authorize(['ADMIN', 'HR', 'PLATFORM_OWNER']), MasterDataController.upsertGrade);
router.delete('/grades/:id', authorize(['ADMIN', 'HR', 'PLATFORM_OWNER']), MasterDataController.deleteGrade);

router.post('/cost-centres', authorize(['ADMIN', 'HR', 'PLATFORM_OWNER']), MasterDataController.upsertCostCentre);
router.delete('/cost-centres/:id', authorize(['ADMIN', 'HR', 'PLATFORM_OWNER']), MasterDataController.deleteCostCentre);

export default router;
