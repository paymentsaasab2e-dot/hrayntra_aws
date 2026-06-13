import express from 'express';
import { hqController } from './hq.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Setup initial Super Admin credentials directly
// Note: This is an unsecured setup route intended for bootstrap/initialization.
router.post('/setup', hqController.setupSuperAdmin);

router.post('/provision-tenant', authMiddleware, hqController.provisionTenant);
router.get('/tenants', authMiddleware, hqController.listTenants);
router.put('/tenants/plan', authMiddleware, hqController.assignPlan);
// Two delete shapes: body-driven (DELETE /tenants with { email }) and
// URL-driven (DELETE /tenants/:email). The latter is a fallback for HTTP
// clients that strip DELETE bodies.
router.delete('/tenants', authMiddleware, hqController.deleteTenant);
router.delete('/tenants/:email', authMiddleware, hqController.deleteTenant);

router.get('/leads', authMiddleware, hqController.listLeads);
router.post('/leads', authMiddleware, hqController.createLead);
router.put('/leads/:id', authMiddleware, hqController.updateLead);
router.post('/leads/:id/follow-ups', authMiddleware, hqController.addLeadFollowUp);
router.post('/leads/:id/remarks', authMiddleware, hqController.addLeadRemark);
router.post('/leads/:id/convert-to-company', authMiddleware, hqController.convertLeadToCompany);

router.get('/companies', authMiddleware, hqController.listCompanies);
router.post('/companies', authMiddleware, hqController.createCompany);
router.put('/companies/:id', authMiddleware, hqController.updateCompany);
router.post('/companies/:id/follow-ups', authMiddleware, hqController.addCompanyFollowUp);
router.post('/companies/:id/remarks', authMiddleware, hqController.addCompanyRemark);

export default router;
