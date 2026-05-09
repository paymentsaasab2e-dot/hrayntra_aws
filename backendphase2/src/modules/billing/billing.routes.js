import express from 'express';
import { billingController } from './billing.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';
import { blockBillingForStandaloneOrg } from '../../middleware/standalone-billing.middleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(blockBillingForStandaloneOrg);

router.get('/summary', requireAnyPermission(['access_billing']), billingController.getSummary);
router.get('/export/:tab/:format', requireAnyPermission(['access_billing', 'export_data']), billingController.exportTab);
router.get('/settings', requireAnyPermission(['access_billing']), billingController.getSettings);
router.put('/settings', requireAnyPermission(['access_billing']), billingController.updateSettings);
// More-specific paths must come BEFORE the catch-all `/:id` so the activity
// and currency endpoints aren't swallowed by getById/update/delete handlers.
router.get('/invoice/:id/activity', requireAnyPermission(['access_billing']), billingController.getInvoiceActivity);
router.patch('/invoice/:id/currency', requireAnyPermission(['record_payment', 'create_invoice']), billingController.updateInvoiceCurrency);
router.get('/', requireAnyPermission(['access_billing']), billingController.getAll);
router.get('/:id', requireAnyPermission(['access_billing']), billingController.getById);
router.post('/', requireAnyPermission(['create_invoice']), billingController.create);
router.patch('/:id', requireAnyPermission(['record_payment', 'create_invoice']), billingController.update);
router.delete('/:id', requireAnyPermission(['record_payment']), billingController.delete);

export default router;
