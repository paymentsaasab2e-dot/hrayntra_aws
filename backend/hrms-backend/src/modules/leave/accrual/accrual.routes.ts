import { Router } from 'express';
import { AccrualController } from './accrual.controller';
import { authMiddleware, authorize } from '../../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

// Plans & Entitlements
router.get('/plans', AccrualController.listPlans);
router.post('/plans', authorize(['ADMIN', 'HR']), AccrualController.upsertPlan);
router.delete('/plans/:id', authorize(['ADMIN', 'HR']), AccrualController.deletePlan);

// Live Accrual Engine (Preview & Quicker "Run Accrual Now")
router.get('/preview', authorize(['ADMIN', 'HR']), AccrualController.previewAccrual);
router.post('/run-now', authorize(['ADMIN', 'HR']), AccrualController.runAccrualNow);

// Year-End Carry-Forward & Lapse Reconciliation
router.get('/year-end/preview', authorize(['ADMIN', 'HR']), AccrualController.previewYearEnd);
router.post('/year-end/execute', authorize(['ADMIN', 'HR']), AccrualController.executeYearEnd);

// Leave Encashment
router.post('/encashment', authorize(['ADMIN', 'HR', 'EMPLOYEE']), AccrualController.requestEncashment);

// Audit Transaction Ledger
router.get('/ledger', AccrualController.getLedger);

// Opening Balance Import
router.post('/opening-balances/import', authorize(['ADMIN', 'HR']), AccrualController.importOpeningBalances);

// Loss of Pay (LOP) Reversals
router.get('/lop-reversals', AccrualController.listLopReversals);
router.post('/lop-reversals/:id/mark-refunded', authorize(['ADMIN', 'HR']), AccrualController.markLopRefunded);

export default router;

