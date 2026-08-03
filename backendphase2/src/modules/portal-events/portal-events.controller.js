import { sendError, sendResponse } from '../../utils/response.js';
import * as portalEventsService from './portal-events.service.js';

function handleError(res, error, fallback) {
  if (error?.code === 'VALIDATION') return sendError(res, 400, error.message);
  if (error?.code === 'NOT_FOUND') return sendError(res, 404, error.message);
  console.error(fallback, error);
  return sendError(res, 500, error?.message || fallback);
}

function resolveTenantDbName(req) {
  return (
    req.headers['x-tenant-db-name'] ||
    req.user?.tenantDbName ||
    req.query?.tenantDbName ||
    null
  );
}

function organizerNameFromUser(user) {
  return (
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.email ||
    'Organizer'
  );
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

  async updateHqEvent(req, res) {
    try {
      const event = await portalEventsService.updatePortalEvent({
        eventId: req.params.id,
        payload: req.body,
        createdById: req.user.id,
        source: 'hq',
      });
      return sendResponse(res, 200, 'Event updated', { event });
    } catch (error) {
      return handleError(res, error, '[updateHqEvent]');
    }
  },

  async cancelHqEvent(req, res) {
    try {
      const event = await portalEventsService.cancelPortalEvent({
        eventId: req.params.id,
        createdById: req.user.id,
        source: 'hq',
        organizerName: organizerNameFromUser(req.user),
      });
      return sendResponse(res, 200, 'Event cancelled', { event });
    } catch (error) {
      return handleError(res, error, '[cancelHqEvent]');
    }
  },

  async deleteHqEvent(req, res) {
    try {
      const result = await portalEventsService.deletePortalEvent({
        eventId: req.params.id,
        createdById: req.user.id,
        source: 'hq',
        organizerName: organizerNameFromUser(req.user),
      });
      return sendResponse(res, 200, 'Event deleted', result);
    } catch (error) {
      return handleError(res, error, '[deleteHqEvent]');
    }
  },

  async uploadTenantEventMedia(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
      const files = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
      if (!files.length) return sendError(res, 400, 'No files uploaded');
      const media = await portalEventsService.uploadPortalEventMediaFiles({
        files,
        tenantDbName,
      });
      return sendResponse(res, 201, 'Media uploaded', { media });
    } catch (error) {
      return handleError(res, error, '[uploadTenantEventMedia]');
    }
  },

  async uploadHqEventMedia(req, res) {
    try {
      const files = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
      if (!files.length) return sendError(res, 400, 'No files uploaded');
      const media = await portalEventsService.uploadPortalEventMediaFiles({ files });
      return sendResponse(res, 201, 'Media uploaded', { media });
    } catch (error) {
      return handleError(res, error, '[uploadHqEventMedia]');
    }
  },

  async createTenantEvent(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
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
      const tenantDbName = resolveTenantDbName(req);
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
      const tenantDbName = resolveTenantDbName(req);
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

  async updateTenantEvent(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
      const event = await portalEventsService.updatePortalEvent({
        eventId: req.params.id,
        payload: req.body,
        createdById: req.user.id,
        source: 'tenant',
        tenantDbName,
      });
      return sendResponse(res, 200, 'Event updated', { event });
    } catch (error) {
      return handleError(res, error, '[updateTenantEvent]');
    }
  },

  async cancelTenantEvent(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
      const event = await portalEventsService.cancelPortalEvent({
        eventId: req.params.id,
        createdById: req.user.id,
        source: 'tenant',
        tenantDbName,
        organizerName: organizerNameFromUser(req.user),
      });
      return sendResponse(res, 200, 'Event cancelled', { event });
    } catch (error) {
      return handleError(res, error, '[cancelTenantEvent]');
    }
  },

  async deleteTenantEvent(req, res) {
    try {
      const tenantDbName = resolveTenantDbName(req);
      const result = await portalEventsService.deletePortalEvent({
        eventId: req.params.id,
        createdById: req.user.id,
        source: 'tenant',
        tenantDbName,
        organizerName: organizerNameFromUser(req.user),
      });
      return sendResponse(res, 200, 'Event deleted', result);
    } catch (error) {
      return handleError(res, error, '[deleteTenantEvent]');
    }
  },
};
