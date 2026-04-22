import { contactService } from './contact.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { prisma } from '../../config/prisma.js';
import * as XLSX from 'xlsx';

const CONTACT_IMPORT_FIELD_ALIASES = {
  firstName: ['firstname', 'first_name', 'first name', 'name', 'contact name', 'full name'],
  lastName: ['lastname', 'last_name', 'last name', 'surname', 'family name'],
  email: ['email', 'email address', 'contact email'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number'],
  companyId: ['company', 'company name', 'client', 'client name', 'organization', 'organisation'],
  designation: ['designation', 'job title', 'title', 'role'],
  department: ['department', 'dept'],
  location: ['location', 'city', 'office location'],
  linkedinUrl: ['linkedin', 'linkedin url', 'linked in', 'profile url'],
  contactType: ['contact type', 'type', 'kind', 'category'],
  status: ['status', 'state'],
  ownerId: ['owner', 'owner name', 'assigned to'],
  avatarUrl: ['avatar', 'avatar url', 'photo', 'image'],
  tags: ['tags', 'tag'],
  associatedJobIds: ['jobs', 'job ids', 'associated jobs', 'assigned jobs'],
  isPrimary: ['primary', 'is primary'],
  preferredChannel: ['preferred channel', 'channel', 'communication channel'],
  notes: ['notes', 'remark', 'remarks', 'comment', 'comments'],
};

const normalizeHeader = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const suggestContactImportMapping = (columns = []) => {
  const mapping = {};

  Object.entries(CONTACT_IMPORT_FIELD_ALIASES).forEach(([fieldId, aliases]) => {
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

const normalizeContactType = (value) => {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const allowed = new Set(['CANDIDATE', 'CLIENT', 'HIRING_MANAGER', 'INTERVIEWER', 'VENDOR', 'DECISION_MAKER', 'FINANCE']);
  return allowed.has(normalized) ? normalized : 'CLIENT';
};

const normalizeStatus = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
};

const splitList = (value) =>
  String(value || '')
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);

const asText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
};

const getMappedValue = (row, mapping, key) => {
  const column = mapping?.[key];
  if (!column) return '';
  return asText(row[column]);
};

const isObjectId = (value) => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value.trim());

async function resolveClientId(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;

  if (isObjectId(value)) {
    const existingClient = await prisma.client.findUnique({
      where: { id: value },
      select: { id: true },
    });
    return existingClient?.id || null;
  }

  const exactMatch = await prisma.client.findFirst({
    where: { companyName: { equals: value, mode: 'insensitive' } },
    select: { id: true },
  });
  if (exactMatch?.id) return exactMatch.id;

  const fallbackMatch = await prisma.client.findFirst({
    where: { companyName: { contains: value, mode: 'insensitive' } },
    select: { id: true },
  });
  return fallbackMatch?.id || null;
}

const parseWorkbook = (buffer, originalName = '') => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0] || originalName || 'Sheet1';
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  const columns = (rows[0] || [])
    .map((column) => String(column || '').trim())
    .filter(Boolean);

  const dataRows = rows
    .slice(1)
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''));

  const previewRows = dataRows.map((row) =>
    columns.reduce((acc, column, index) => {
      acc[column] = row[index] ?? '';
      return acc;
    }, {})
  );

  const columnStats = columns.reduce((acc, column, index) => {
    acc[column] = dataRows.reduce((count, row) => (String(row[index] ?? '').trim() ? count + 1 : count), 0);
    return acc;
  }, {});

  return {
    sheetName,
    columns,
    previewRows,
    totalRows: dataRows.length,
    suggestedMapping: suggestContactImportMapping(columns),
    columnStats,
  };
};

const buildContactPayload = (row, mapping) => {
  const firstName = getMappedValue(row, mapping, 'firstName');
  const lastName = getMappedValue(row, mapping, 'lastName');
  const companyValue = getMappedValue(row, mapping, 'companyId');
  const notesText = getMappedValue(row, mapping, 'notes') || null;

  return {
    firstName: firstName || 'Contact',
    lastName: lastName || '',
    email: getMappedValue(row, mapping, 'email') || null,
    phone: getMappedValue(row, mapping, 'phone') || null,
    companyId: companyValue || null,
    companyName: companyValue || null,
    designation: getMappedValue(row, mapping, 'designation') || null,
    department: getMappedValue(row, mapping, 'department') || null,
    location: getMappedValue(row, mapping, 'location') || null,
    linkedinUrl: getMappedValue(row, mapping, 'linkedinUrl') || null,
    contactType: normalizeContactType(getMappedValue(row, mapping, 'contactType')),
    status: normalizeStatus(getMappedValue(row, mapping, 'status')),
    ownerId: getMappedValue(row, mapping, 'ownerId') || null,
    avatarUrl: getMappedValue(row, mapping, 'avatarUrl') || null,
    tags: splitList(getMappedValue(row, mapping, 'tags')),
    associatedJobIds: splitList(getMappedValue(row, mapping, 'associatedJobIds')),
    isPrimary: /^(true|1|yes|y)$/i.test(getMappedValue(row, mapping, 'isPrimary')),
    preferredChannel: (() => {
      const raw = String(getMappedValue(row, mapping, 'preferredChannel') || '').trim();
      if (!raw) return null;
      if (/^email$/i.test(raw)) return 'Email';
      if (/^phone$/i.test(raw)) return 'Phone';
      if (/^whats?app$/i.test(raw)) return 'WhatsApp';
      return 'Email';
    })(),
    notesText,
  };
};

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

  async previewImport(req, res) {
    try {
      if (!req.file?.buffer) {
        return sendError(res, 400, 'Import file is required');
      }

      const preview = parseWorkbook(req.file.buffer, req.file.originalname);

      sendResponse(res, 200, 'Contact import preview generated successfully', {
        fileName: req.file.originalname,
        ...preview,
      });
    } catch (error) {
      sendError(res, 400, 'Failed to parse import file', error);
    }
  },

  async importContacts(req, res) {
    try {
      const { rows, mapping = {}, duplicateRule = 'skip' } = req.body || {};

      if (!Array.isArray(rows) || rows.length === 0) {
        return sendError(res, 400, 'Import rows are required');
      }

      const preparedRows = rows.map((row) => buildContactPayload(row, mapping));
      const uniqueRows = [];
      const seen = new Set();

      for (const row of preparedRows) {
        const dedupeKey = `${String(row.email || '').toLowerCase()}|${String(row.phone || '').toLowerCase()}`;
        if (duplicateRule === 'skip' && dedupeKey !== '|') {
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
        }
        uniqueRows.push(row);
      }

      if (uniqueRows.length === 0) {
        return sendResponse(res, 200, 'No contacts to import', {
          imported: 0,
          skipped: rows.length,
          updated: 0,
        });
      }

      let imported = 0;
      let skipped = 0;

      for (const row of uniqueRows) {
        try {
          const companyId = await resolveClientId(row.companyId || row.companyName);
          const result = await contactService.create(
            {
              ...row,
              companyId,
            },
            req.user?.id
          );
          if (result?.duplicate) {
            skipped += 1;
          } else {
            imported += 1;
          }
        } catch (error) {
          console.error('Contact import row failed:', error.message);
          skipped += 1;
        }
      }

      sendResponse(res, 200, 'Contacts imported successfully', {
        imported,
        skipped,
        updated: 0,
      });
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
