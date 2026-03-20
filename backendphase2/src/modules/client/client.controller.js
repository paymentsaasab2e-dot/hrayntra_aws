import { clientService } from './client.service.js';
import { clientNoteService } from './client-note.service.js';
import { clientFileService } from './client-file.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const clientController = {
  async getAll(req, res) {
    try {
      const result = await clientService.getAll(req);
      sendResponse(res, 200, 'Clients retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const client = await clientService.getById(req.params.id);
      if (!client) {
        return sendError(res, 404, 'Client not found');
      }
      sendResponse(res, 200, 'Client retrieved successfully', client);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const client = await clientService.create({
        ...req.body,
        performedById: req.user?.id,
      });
      sendResponse(res, 201, 'Client created successfully', client);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const client = await clientService.update(req.params.id, {
        ...req.body,
        performedById: req.user?.id,
      });
      sendResponse(res, 200, 'Client updated successfully', client);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await clientService.delete(req.params.id, req.user?.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getActivities(req, res) {
    try {
      const { clientId } = req.params;
      const activities = await clientService.getActivities(clientId);
      sendResponse(res, 200, 'Activities retrieved successfully', activities);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  // Notes endpoints
  async getNotes(req, res) {
    try {
      const notes = await clientNoteService.getAll(req.params.clientId);
      sendResponse(res, 200, 'Notes retrieved successfully', notes);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async createNote(req, res) {
    try {
      const note = await clientNoteService.create(
        req.params.clientId,
        req.body,
        req.user.id
      );
      sendResponse(res, 201, 'Note created successfully', note);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateNote(req, res) {
    try {
      const note = await clientNoteService.update(req.params.noteId, req.body);
      sendResponse(res, 200, 'Note updated successfully', note);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteNote(req, res) {
    try {
      const result = await clientNoteService.delete(req.params.noteId);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  // Files endpoints
  async getFiles(req, res) {
    try {
      const files = await clientFileService.getAll(req.params.clientId);
      sendResponse(res, 200, 'Files retrieved successfully', files);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async createFile(req, res) {
    try {
      const file = await clientFileService.create(
        req.params.clientId,
        req.body,
        req.user.id
      );
      sendResponse(res, 201, 'File uploaded successfully', file);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteFile(req, res) {
    try {
      const result = await clientFileService.delete(req.params.fileId);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getMetrics(req, res) {
    try {
      const metrics = await clientService.getMetrics();
      sendResponse(res, 200, 'Metrics retrieved successfully', metrics);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
