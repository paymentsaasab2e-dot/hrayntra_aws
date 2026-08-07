import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { sendError, sendResponse } from '../../utils/response.js';
import { hqTicketsService } from '../hq/hq-tickets.service.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';

const router = express.Router();

router.use(authMiddleware);

async function resolveOrganizationName(req) {
  const fromBody = String(req.body?.organizationName || '').trim();
  if (fromBody) return fromBody;

  const tenantDbName = String(req.user?.tenantDbName || req.headers['x-tenant-db-name'] || '').trim();
  if (!tenantDbName) return '';

  try {
    const tenants = await headquartersAuthService.listTenants();
    const match = tenants.find((t) => String(t.tenantDbName || '') === tenantDbName);
    return String(match?.organizationName || match?.name || '').trim();
  } catch {
    return '';
  }
}

router.post('/tickets', async (req, res) => {
  try {
    const organizationName = await resolveOrganizationName(req);
    const ticket = await hqTicketsService.createTicket(
      {
        subject: req.body?.subject,
        description: req.body?.description,
        priority: req.body?.priority,
        category: req.body?.category,
        organizationName,
        tenantDbName: req.user?.tenantDbName || req.headers['x-tenant-db-name'] || '',
      },
      {
        id: req.user?.id,
        name: req.user?.name,
        email: req.user?.email,
        tenantDbName: req.user?.tenantDbName,
      },
    );
    return sendResponse(res, 201, 'Support ticket created', { ticket });
  } catch (error) {
    return sendError(res, 400, error.message || 'Failed to create support ticket', error);
  }
});

router.get('/tickets', async (req, res) => {
  try {
    const result = await hqTicketsService.listTicketsForUser(req.user?.id);
    return sendResponse(res, 200, 'OK', result);
  } catch (error) {
    return sendError(res, 400, error.message || 'Failed to list support tickets', error);
  }
});

router.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await hqTicketsService.getTicket(req.params.id);
    if (ticket.raisedByUserId && ticket.raisedByUserId !== req.user?.id) {
      return sendError(res, 403, 'You can only view your own tickets');
    }
    return sendResponse(res, 200, 'OK', { ticket });
  } catch (error) {
    return sendError(res, 400, error.message || 'Failed to load support ticket', error);
  }
});

export default router;
