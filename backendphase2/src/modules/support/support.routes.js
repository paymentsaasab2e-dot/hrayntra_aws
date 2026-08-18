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

router.patch('/tickets/:id', async (req, res) => {
  try {
    const ticket = await hqTicketsService.getTicket(req.params.id);
    if (ticket.raisedByUserId && ticket.raisedByUserId !== req.user?.id) {
      return sendError(res, 403, 'You can only update your own tickets');
    }
    const nextStatus = String(req.body?.status || '').trim().toLowerCase();
    if (nextStatus && nextStatus !== 'closed') {
      return sendError(res, 400, 'You can only mark your ticket as completed');
    }
    const updated = await hqTicketsService.updateTicket(
      req.params.id,
      { status: 'closed' },
      req.user,
    );
    return sendResponse(res, 200, 'Ticket updated', { ticket: updated });
  } catch (error) {
    return sendError(res, 400, error.message || 'Failed to update support ticket', error);
  }
});

router.get('/tickets/:id/messages', async (req, res) => {
  try {
    const result = await hqTicketsService.listMessages(req.params.id, {
      userId: req.user?.id,
      hq: false,
    });
    return sendResponse(res, 200, 'OK', result);
  } catch (error) {
    return sendError(res, 400, error.message || 'Failed to load ticket messages', error);
  }
});

router.post('/tickets/:id/messages', async (req, res) => {
  try {
    const message = await hqTicketsService.addMessage(
      req.params.id,
      req.body?.body,
      req.user,
      { hq: false },
    );
    return sendResponse(res, 201, 'Message sent', { message });
  } catch (error) {
    return sendError(res, 400, error.message || 'Failed to send message', error);
  }
});

export default router;
