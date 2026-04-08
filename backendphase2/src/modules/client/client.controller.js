import { clientService } from './client.service.js';
import { clientNoteService } from './client-note.service.js';
import { clientFileService } from './client-file.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import * as XLSX from 'xlsx';

const CLIENT_IMPORT_FIELD_ALIASES = {
  name: ['company', 'company name', 'client name', 'organization', 'organisation', 'account name'],
  industry: ['industry', 'sector', 'business type'],
  location: ['location', 'address', 'region', 'office location'],
  city: ['city'],
  country: ['country'],
  contactPerson: ['contact person', 'contact', 'director name', 'primary contact', 'name'],
  email: ['email', 'email address', 'contact email'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number'],
  companySize: ['team name', 'company size', 'team'],
  servicesNeeded: ['services needed', 'service needed', 'services', 'requirements'],
  leadStatus: ['status', 'lead status'],
  priority: ['interest level', 'priority', 'lead priority'],
  expectedBusinessValue: ['expected business value', 'business value', 'expected value', 'budget'],
  nextFollowUpDue: ['next follow-up date', 'next follow up date', 'follow-up date', 'follow up date'],
  notes: ['notes', 'remarks', 'comments'],
};

const normalizeHeader = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const suggestClientImportMapping = (columns = []) => {
  const mapping = {};

  Object.entries(CLIENT_IMPORT_FIELD_ALIASES).forEach(([fieldId, aliases]) => {
    const exact = columns.find((column) => aliases.includes(normalizeHeader(column)));
    if (exact) {
      mapping[fieldId] = exact;
      return;
    }

    const partial = columns.find((column) => aliases.some((alias) => normalizeHeader(column).includes(alias)));
    if (partial) {
      mapping[fieldId] = partial;
    }
  });

  return mapping;
};

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
      const client = await clientService.getById(req.params.id, req);
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
        performedByRole: req.user?.role,
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
      const metrics = await clientService.getMetrics(req);
      sendResponse(res, 200, 'Metrics retrieved successfully', metrics);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async previewImport(req, res) {
    try {
      if (!req.file?.buffer) {
        return sendError(res, 400, 'Import file is required');
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];

      if (!firstSheet) {
        return sendError(res, 400, 'Unable to read the uploaded file');
      }

      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      const previewRows = rows.slice(0, 8);
      const suggestedMapping = suggestClientImportMapping(columns);
      const columnStats = Object.fromEntries(
        columns.map((column) => [
          column,
          rows.reduce((count, row) => {
            const value = row?.[column];
            return String(value ?? '').trim() ? count + 1 : count;
          }, 0),
        ])
      );

      sendResponse(res, 200, 'Client import preview generated successfully', {
        fileName: req.file.originalname,
        sheetName: firstSheetName,
        columns,
        previewRows,
        totalRows: rows.length,
        columnStats,
        suggestedMapping,
      });
    } catch (error) {
      sendError(res, 400, 'Failed to parse import file', error);
    }
  },

  async importClients(req, res) {
    try {
      const result = await clientService.importClients({
        rows: req.body?.rows || [],
        mapping: req.body?.mapping || {},
        duplicateRule: req.body?.duplicateRule || 'skip',
        performedById: req.user?.id,
        performedByRole: req.user?.role,
      });
      sendResponse(res, 200, 'Clients imported successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
