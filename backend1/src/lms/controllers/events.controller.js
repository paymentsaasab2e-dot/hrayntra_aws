const eventsService = require('../services/events.service');
const { sendSuccess, sendError, sendNotFound } = require('../lms.response.helper');

async function getEvents(req, res) {
  try {
    const filters = req.query;
    const events = await eventsService.fetchEvents(req.user.id, filters);
    return sendSuccess(res, events);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getEventDetail(req, res) {
  try {
    const event = await eventsService.fetchEventDetail(req.user.id, req.params.eventId);
    if (!event) return sendNotFound(res, 'Event not found');
    return sendSuccess(res, event);
  } catch (error) {
    return sendError(res, error);
  }
}

async function registerEvent(req, res) {
  try {
    const data = await eventsService.registerForEvent(req.user.id, req.body.eventId);
    return sendSuccess(res, data, 'Registered successfully');
  } catch (error) {
    return sendError(res, error);
  }
}

async function unregisterEvent(req, res) {
  try {
    const data = await eventsService.unregisterFromEvent(req.user.id, req.body.eventId);
    return sendSuccess(res, data, 'Unregistered successfully');
  } catch (error) {
    return sendError(res, error);
  }
}

async function addToPlan(req, res) {
  try {
    const data = await eventsService.addEventToPlan(req.user.id, req.params.eventId);
    return sendSuccess(res, data, 'Added to Career Path');
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { getEvents, getEventDetail, registerEvent, unregisterEvent, addToPlan };
