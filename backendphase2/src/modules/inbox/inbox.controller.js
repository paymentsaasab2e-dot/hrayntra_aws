import { inboxService } from './inbox.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const inboxController = {
  async getThreads(req, res) {
    try {
      const result = await inboxService.getThreads(req);
      sendResponse(res, 200, 'Threads retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getThreadById(req, res) {
    try {
      const thread = await inboxService.getThreadById(req.params.id);
      if (!thread) {
        return sendError(res, 404, 'Thread not found');
      }
      sendResponse(res, 200, 'Thread retrieved successfully', thread);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async createThread(req, res) {
    try {
      const thread = await inboxService.createThread({
        ...req.body,
        senderId: req.user.id,
      });
      sendResponse(res, 201, 'Thread created successfully', thread);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addMessage(req, res) {
    try {
      const message = await inboxService.addMessage(req.params.threadId, {
        ...req.body,
        senderId: req.user.id,
      });
      sendResponse(res, 201, 'Message sent successfully', message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async markAsRead(req, res) {
    try {
      const result = await inboxService.markAsRead(req.params.threadId, req.user.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
