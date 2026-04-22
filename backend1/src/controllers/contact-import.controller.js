const XLSX = require('xlsx');
const { prisma } = require('../lib/prisma');

const CONTACT_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'companyId',
  'designation',
  'department',
  'location',
  'linkedinUrl',
  'contactType',
  'status',
  'ownerId',
  'avatarUrl',
  'tags',
  'associatedJobIds',
  'isPrimary',
  'preferredChannel',
  'notes',
];

const HEADER_ALIASES = {
  firstName: ['firstname', 'first_name', 'first name', 'name', 'full name', 'contact name'],
  lastName: ['lastname', 'last_name', 'last name', 'surname', 'family name'],
  email: ['email', 'e-mail', 'mail'],
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

const CONTACT_TYPE_VALUES = new Set([
  'CANDIDATE',
  'CLIENT',
  'HIRING_MANAGER',
  'INTERVIEWER',
  'VENDOR',
  'DECISION_MAKER',
  'FINANCE',
]);

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCsvLikeValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

function buildSuggestedMapping(headers) {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeHeader(header) }));
  const mapping = {};

  for (const field of CONTACT_FIELDS) {
    const aliases = HEADER_ALIASES[field] || [field];
    const match = normalizedHeaders.find(({ normalized }) =>
      aliases.some((alias) => normalized === normalizeHeader(alias) || normalized.includes(normalizeHeader(alias)))
    );
    if (match) {
      mapping[field] = match.header;
    }
  }

  return mapping;
}

function parseWorkbook(fileBuffer, originalName = '') {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0] || originalName || 'Sheet1';
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  const headers = (rows[0] || [])
    .map((header) => String(header || '').trim())
    .filter(Boolean);

  const dataRows = rows
    .slice(1)
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''));

  const previewRows = dataRows.map((row) => {
    return headers.reduce((acc, header, idx) => {
      acc[header] = row[idx] ?? '';
      return acc;
    }, {});
  });

  const columnStats = headers.reduce((acc, header, idx) => {
    acc[header] = dataRows.reduce((count, row) => {
      const value = row[idx];
      return String(value ?? '').trim() ? count + 1 : count;
    }, 0);
    return acc;
  }, {});

  return {
    sheetName,
    columns: headers,
    previewRows,
    totalRows: dataRows.length,
    suggestedMapping: buildSuggestedMapping(headers),
    columnStats,
  };
}

function normalizeContactType(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return CONTACT_TYPE_VALUES.has(normalized) ? normalized : 'CLIENT';
}

function normalizeStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
}

function splitList(value) {
  return String(value || '')
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getMappedValue(row, mapping, key) {
  const column = mapping?.[key];
  if (!column) return '';
  return toCsvLikeValue(row[column]);
}

async function resolveCompanyId(companyValue) {
  const companyName = String(companyValue || '').trim();
  if (!companyName) return null;

  try {
    const client = await prisma.client.findFirst({
      where: {
        companyName,
      },
      select: { id: true },
    });
    return client?.id || null;
  } catch (error) {
    console.warn('Failed to resolve companyId for contact import:', error.message);
    return null;
  }
}

function buildContactDocument(row, mapping) {
  const firstName = getMappedValue(row, mapping, 'firstName');
  const lastName = getMappedValue(row, mapping, 'lastName');
  const nameValue = getMappedValue(row, mapping, 'firstName') || getMappedValue(row, mapping, 'companyId');
  const email = getMappedValue(row, mapping, 'email');
  const phone = getMappedValue(row, mapping, 'phone');
  const companyValue = getMappedValue(row, mapping, 'companyId');
  const notesText = getMappedValue(row, mapping, 'notes') || null;

  return {
    firstName: firstName || (nameValue ? String(nameValue).split(/\s+/)[0] : 'Contact'),
    lastName: lastName || (nameValue ? String(nameValue).split(/\s+/).slice(1).join(' ') : ''),
    email: email || null,
    phone: phone || null,
    linkedinUrl: getMappedValue(row, mapping, 'linkedinUrl') || null,
    designation: getMappedValue(row, mapping, 'designation') || null,
    department: getMappedValue(row, mapping, 'department') || null,
    location: getMappedValue(row, mapping, 'location') || null,
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
    notes: notesText
      ? [
          {
            note: notesText,
            authorId: 'system',
            createdAt: new Date().toISOString(),
          },
        ]
      : [],
    companyName: companyValue || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function previewContactImport(req, res) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Import file is required' });
    }

    const preview = parseWorkbook(file.buffer, file.originalname);

    return res.json({
      success: true,
      message: 'Preview generated successfully',
      data: preview,
    });
  } catch (error) {
    console.error('Contact import preview failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to preview contacts import file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function importContacts(req, res) {
  try {
    const { rows, mapping = {}, duplicateRule = 'skip' } = req.body || {};

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Import rows are required',
      });
    }

    const mappedDocuments = [];
    for (const row of rows) {
      const doc = buildContactDocument(row, mapping);
      if (doc.companyName) {
        doc.companyId = await resolveCompanyId(doc.companyName);
      } else {
        doc.companyId = null;
      }
      delete doc.companyName;
      mappedDocuments.push(doc);
    }

    const seen = new Set();
    const uniqueDocuments = [];
    for (const doc of mappedDocuments) {
      const dedupeKey = `${String(doc.email || '').toLowerCase()}|${String(doc.phone || '').toLowerCase()}`;
      if (duplicateRule === 'skip' && dedupeKey !== '|') {
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
      }
      uniqueDocuments.push(doc);
    }

    if (uniqueDocuments.length === 0) {
      return res.json({
        success: true,
        message: 'No contacts to import',
        data: { imported: 0, skipped: rows.length, updated: 0 },
      });
    }

    const insertResult = await prisma.$runCommandRaw({
      insert: 'contacts',
      documents: uniqueDocuments,
    });

    return res.json({
      success: true,
      message: 'Contacts imported successfully',
      data: {
        imported: uniqueDocuments.length,
        skipped: rows.length - uniqueDocuments.length,
        updated: 0,
        result: insertResult,
      },
    });
  } catch (error) {
    console.error('Contact import failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import contacts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  previewContactImport,
  importContacts,
};
