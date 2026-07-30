import { sendError, sendResponse } from '../../utils/response.js';
import * as portalEventsService from './portal-events.service.js';

function handleError(res, error, fallback) {
  if (error?.code === 'VALIDATION') return sendError(res, 400, error.message);
  if (error?.code === 'NOT_FOUND') return sendError(res, 404, error.message);
  console.error(fallback, error);
  return sendError(res, 500, error?.message || fallback);
}

export const portalEventsController = {
  async createHqEvent(req, res) {
    try {
      const event = await portalEventsService.createPortalEvent({
        payload: req.body,
        creator: req.user,
        source: 'hq',
        tenantDbName: null,
      });
      return sendResponse(res, 201, 'Event created', { event });
    } catch (error) {
      return handleError(res, error, '[createHqEvent]');
    }
  },

  async listHqEvents(req, res) {
    try {
      const events = await portalEventsService.listPortalEventsForCreator({
        createdById: req.user.id,
        source: 'hq',
      });
      return sendResponse(res, 200, 'OK', { events });
    } catch (error) {
      return handleError(res, error, '[listHqEvents]');
    }
  },

  async listHqEventRegistrations(req, res) {
    try {
      const result = await portalEventsService.getPortalEventRegistrations({
        eventId: req.params.id,
        createdById: req.user.id,
        source: 'hq',
      });
      return sendResponse(res, 200, 'OK', result);
    } catch (error) {
      return handleError(res, error, '[listHqEventRegistrations]');
    }
  },

  async createTenantEvent(req, res) {
    try {
      const tenantDbName =
        req.headers['x-tenant-db-name'] ||
        req.user?.tenantDbName ||
        req.query?.tenantDbName ||
        null;
      const event = await portalEventsService.createPortalEvent({
        payload: req.body,
        creator: req.user,
        source: 'tenant',
        tenantDbName,
      });
      return sendResponse(res, 201, 'Event created', { event });
    } catch (error) {
      return handleError(res, error, '[createTenantEvent]');
    }
  },

  async listTenantEvents(req, res) {
    try {
      const tenantDbName =
        req.headers['x-tenant-db-name'] ||
        req.user?.tenantDbName ||
        req.query?.tenantDbName ||
        null;
      const events = await portalEventsService.listPortalEventsForCreator({
        createdById: req.user.id,
        source: 'tenant',
        tenantDbName,
      });
      return sendResponse(res, 200, 'OK', { events });
    } catch (error) {
      return handleError(res, error, '[listTenantEvents]');
    }
  },

  async listTenantEventRegistrations(req, res) {
    try {
      const tenantDbName =
        req.headers['x-tenant-db-name'] ||
        req.user?.tenantDbName ||
        req.query?.tenantDbName ||
        null;
      const result = await portalEventsService.getPortalEventRegistrations({
        eventId: req.params.id,
        createdById: req.user.id,
        source: 'tenant',
        tenantDbName,
      });
      return sendResponse(res, 200, 'OK', result);
    } catch (error) {
      return handleError(res, error, '[listTenantEventRegistrations]');
    }
  },
};
