import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { attachUserPermissions, requireAnyPermission } from '../middleware/permission.middleware.js';
import {
  listLeadConversionRequests,
  reviewLeadConversionRequest,
  submitLeadConversionRequest,
} from '../controllers/leadConversionRequestController.js';

const router = express.Router();

router.use(authMiddleware);
router.use(attachUserPermissions);

router.get('/', requireAnyPermission(['leads_read', 'leads_update', 'requests_read', 'view_all_leads']), listLeadConversionRequests);
router.patch('/:id/review', requireAnyPermission(['leads_update', 'requests_update', 'clients_create']), reviewLeadConversionRequest);

export default router;

export { submitLeadConversionRequest };
