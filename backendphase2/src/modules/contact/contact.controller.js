import { contactService } from './contact.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const contactController = {
  async getAll(req, res) {
    try {
      const result = await contactService.getAll(req.query);
      sendResponse(res, 200, 'Contacts retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const contact = await contactService.getById(req.params.id);
      if (!contact) {
        return sendError(res, 404, 'Contact not found');
      }
      sendResponse(res, 200, 'Contact retrieved successfully', contact);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const result = await contactService.create(req.body, req.user?.id);
      
      // Check for duplicate
      if (result.duplicate) {
        return sendResponse(res, 409, 'Duplicate contact detected', {
          duplicate: true,
          existingContact: result.existingContact,
        });
      }

      sendResponse(res, 201, 'Contact created successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const contact = await contactService.update(req.params.id, req.body, req.user?.id);
      sendResponse(res, 200, 'Contact updated successfully', contact);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      // Check role - only admin can delete
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
        return sendError(res, 403, 'Only admins can delete contacts');
      }

      const result = await contactService.delete(req.params.id, req.user?.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getStats(req, res) {
    try {
      const stats = await contactService.getStats();
      sendResponse(res, 200, 'Contact statistics retrieved successfully', stats);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async bulkAction(req, res) {
    try {
      const { action, contactIds, payload } = req.body;

      if (!action || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return sendError(res, 400, 'Action and contactIds array are required');
      }

      // Check role for delete action
      if (action === 'delete' && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
        return sendError(res, 403, 'Only admins can delete contacts');
      }

      const result = await contactService.bulkAction(action, contactIds, payload, req.user?.id);
      sendResponse(res, 200, result.message || 'Bulk action completed', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async mergeContacts(req, res) {
    try {
      const { primaryId, duplicateId } = req.body;

      if (!primaryId || !duplicateId) {
        return sendError(res, 400, 'primaryId and duplicateId are required');
      }

      const result = await contactService.mergeContacts(primaryId, duplicateId, req.user?.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addNote(req, res) {
    try {
      const { note } = req.body;
      if (!note) {
        return sendError(res, 400, 'Note is required');
      }

      const contactNote = await contactService.addNote(
        req.params.id,
        note,
        req.user?.id
      );
      sendResponse(res, 201, 'Note added successfully', contactNote);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addActivity(req, res) {
    try {
      const { activityType, description } = req.body;
      if (!activityType || !description) {
        return sendError(res, 400, 'activityType and description are required');
      }

      const activity = await contactService.addActivity(
        req.params.id,
        activityType,
        description,
        req.user?.id
      );
      sendResponse(res, 201, 'Activity added successfully', activity);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async addCommunication(req, res) {
    try {
      const { type, subject, message, direction } = req.body;
      if (!type || !message || !direction) {
        return sendError(res, 400, 'type, message, and direction are required');
      }

      const communication = await contactService.addCommunication(
        req.params.id,
        { type, subject, message, direction },
        req.user?.id
      );
      sendResponse(res, 201, 'Communication added successfully', communication);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async detectDuplicates(req, res) {
    try {
      const { email, name } = req.query;
      if (!email && !name) {
        return sendError(res, 400, 'email or name is required');
      }

      const duplicates = await contactService.detectDuplicates(email, name);
      sendResponse(res, 200, 'Duplicate detection completed', { duplicates });
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
