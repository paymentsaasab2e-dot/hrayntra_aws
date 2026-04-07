import { leadService } from './lead.service.js';
import { leadNoteService } from './lead-note.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import * as XLSX from 'xlsx';

const LEAD_IMPORT_FIELD_ALIASES = {
  companyName: ['company', 'company name', 'lead company', 'client', 'organization', 'organisation'],
  contactPerson: ['contact person', 'contact', 'director name', 'primary contact', 'name'],
  email: ['email', 'email address', 'contact email'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number'],
  type: ['type', 'lead type'],
  source: ['source', 'lead source'],
  status: ['status', 'lead status'],
  priority: ['priority', 'interest level', 'lead priority'],
  interestedNeeds: ['services needed', 'service needed', 'interested needs', 'requirements', 'needs'],
  notes: ['notes', 'remarks', 'comments'],
  industry: ['industry', 'sector', 'business type'],
  companySize: ['team name', 'company size', 'team'],
  website: ['website', 'company website', 'site'],
  linkedIn: ['linkedin', 'linkedin url', 'linked in'],
  location: ['location', 'address', 'region'],
  designation: ['designation', 'title', 'job title'],
  city: ['city'],
  country: ['country'],
  campaignName: ['campaign', 'campaign name'],
};

const normalizeHeader = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const suggestLeadImportMapping = (columns = []) => {
  const mapping = {};

  Object.entries(LEAD_IMPORT_FIELD_ALIASES).forEach(([fieldId, aliases]) => {
    const exact = columns.find((column) => aliases.includes(normalizeHeader(column)));
    if (exact) {
      mapping[fieldId] = exact;
      return;
    }

    const partial = columns.find((column) =>
      aliases.some((alias) => normalizeHeader(column).includes(alias) || alias.includes(normalizeHeader(column)))
    );
    if (partial) {
      mapping[fieldId] = partial;
    }
  });

  return mapping;
};

export const leadController = {
  async getAll(req, res) {
    try {
      const result = await leadService.getAll(req);
      sendResponse(res, 200, 'Leads retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const lead = await leadService.getById(req.params.id);
      if (!lead) {
        return sendError(res, 404, 'Lead not found');
      }
      sendResponse(res, 200, 'Lead retrieved successfully', lead);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      // Log the received request body in JSON format
      console.log('\n📥 Lead Data Received (CREATE):');
      console.log(JSON.stringify(req.body, null, 2));
      console.log('─'.repeat(80) + '\n');

      const lead = await leadService.create({
        ...req.body,
        performedById: req.user.id,
      });
      sendResponse(res, 201, 'Lead created successfully', lead);
    } catch (error) {
      sendError(res, 400, error.message, error);
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

      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null });
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      const previewRows = rows.slice(0, 8);
      const suggestedMapping = suggestLeadImportMapping(columns);
      const columnStats = Object.fromEntries(
        columns.map((column) => [
          column,
          rows.reduce((count, row) => {
            const value = row?.[column];
            return String(value ?? '').trim() ? count + 1 : count;
          }, 0),
        ])
      );

      sendResponse(res, 200, 'Lead import preview generated successfully', {
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

  async importLeads(req, res) {
    try {
      const result = await leadService.importLeads({
        rows: req.body?.rows || [],
        mapping: req.body?.mapping || {},
        duplicateRule: req.body?.duplicateRule || 'skip',
        performedById: req.user?.id,
      });
      sendResponse(res, 200, 'Leads imported successfully', result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      // Log the received request body in JSON format
      console.log('\n📥 Lead Data Received (UPDATE):');
      console.log(JSON.stringify({ id: req.params.id, ...req.body }, null, 2));
      console.log('─'.repeat(80) + '\n');

      const lead = await leadService.update(req.params.id, {
        ...req.body,
        performedById: req.user.id,
      });
      sendResponse(res, 200, 'Lead updated successfully', lead);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async convertToClient(req, res) {
    try {
      // Log the received request body in JSON format
      console.log('\n=== CONVERT TO CLIENT REQUEST RECEIVED ===');
      console.log(JSON.stringify({
        leadId: req.params.id,
        requestBody: req.body,
        userId: req.user.id,
      }, null, 2));
      
      const client = await leadService.convertToClient(req.params.id, {
        ...req.body,
        performedById: req.user.id,
      });
      
      // Log the response
      console.log('\n=== CONVERT TO CLIENT RESPONSE ===');
      console.log(JSON.stringify({
        id: client.id,
        companyName: client.companyName,
        linkedin: client.linkedin,
        industry: client.industry,
        companySize: client.companySize,
        website: client.website,
        location: client.location,
        hiringLocations: client.hiringLocations,
      }, null, 2));
      
      sendResponse(res, 201, 'Lead converted to client successfully', client);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await leadService.delete(req.params.id, req.user.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getActivities(req, res) {
    try {
      const activities = await leadService.getActivities(req.params.id);
      sendResponse(res, 200, 'Activities retrieved successfully', activities);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  // Notes endpoints
  async getNotes(req, res) {
    try {
      const notes = await leadNoteService.getAll(req.params.leadId);
      sendResponse(res, 200, 'Notes retrieved successfully', notes);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async createNote(req, res) {
    try {
      const note = await leadNoteService.create(
        req.params.leadId,
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
      const note = await leadNoteService.update(req.params.noteId, req.body);
      sendResponse(res, 200, 'Note updated successfully', note);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteNote(req, res) {
    try {
      const result = await leadNoteService.delete(req.params.noteId);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
