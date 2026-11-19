import { Router } from 'express';
import { ComplianceController } from './compliance.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

// End-user actions
router.get('/documents', ComplianceController.listDocuments);
router.get('/pending', ComplianceController.getPendingAcceptances);
router.post('/accept', ComplianceController.acceptDocument);
router.post('/accept-all', ComplianceController.acceptAllPending);

// Admin & HR management & audit
router.post('/seed-standards', authorize(['ADMIN', 'HR']), ComplianceController.seedStandards);
router.post('/documents/:id/publish-version', authorize(['ADMIN', 'HR']), ComplianceController.publishNewVersion);
router.get('/audit-trail', authorize(['ADMIN', 'HR']), ComplianceController.getAcceptanceAuditTrail);
router.get('/overview', authorize(['ADMIN', 'HR']), ComplianceController.getComplianceOverview);

export default router;
