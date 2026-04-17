import * as XLSX from 'xlsx';

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function firstNonEmpty(row, keys) {
  for (const key of keys) {
    const val = row[key];
    if (val === undefined || val === null) continue;
    const text = String(val).trim();
    if (text) return text;
  }
  return '';
}

function parseLinks(value) {
  if (!value) return [];
  return String(value)
    .split(/[|,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value) {
  const numeric = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

export const parseLeadCSV = async (fileInput) => {
  const workbook = Buffer.isBuffer(fileInput)
    ? XLSX.read(fileInput, { type: 'buffer', raw: false })
    : XLSX.readFile(String(fileInput), { raw: false });

  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) throw new Error('Unable to parse CSV/Excel file');

  const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

  return rawRows.map((rawRow) => {
    const row = {};
    Object.entries(rawRow || {}).forEach(([key, value]) => {
      row[normalizeHeader(key)] = value;
    });

    const companyName = firstNonEmpty(row, ['company name', 'company', 'organization', 'organisation']);
    const contactName = firstNonEmpty(row, ['contact name', 'contact person', 'director name', 'director', 'owner']);
    const email = firstNonEmpty(row, ['email', 'email address']).toLowerCase();

    return {
      companyName: companyName || null,
      companyLinks: parseLinks(firstNonEmpty(row, ['company links', 'website links', 'links', 'website'])),
      directorName: contactName || null,
      teamName: firstNonEmpty(row, ['team name', 'team']) || null,
      email: email || null,
      phone: firstNonEmpty(row, ['phone', 'phone number', 'mobile', 'contact number']) || null,
      location: firstNonEmpty(row, ['location', 'address']) || null,
      city: firstNonEmpty(row, ['city']) || null,
      country: firstNonEmpty(row, ['country']) || null,
      sector: firstNonEmpty(row, ['sector', 'industry']) || null,
      status: firstNonEmpty(row, ['status']) || 'New',
      priority: firstNonEmpty(row, ['priority', 'interest level', 'interestlevel']) || 'Medium',
      nextFollowUpAt: firstNonEmpty(row, ['next follow up at', 'next follow up', 'next followup', 'follow up date']) || null,
      assignedTo: firstNonEmpty(row, ['assigned to', 'assignedto', 'owner', 'assignee']) || null,
      servicesNeeded: firstNonEmpty(row, ['services needed', 'services', 'requirement', 'requirements', 'business need']) || null,
      expectedBusinessValue: parseNumber(firstNonEmpty(row, ['expected business value', 'business value', 'value', 'deal value'])),
      source: firstNonEmpty(row, ['source']) || 'Website',
      type: firstNonEmpty(row, ['type']) || (companyName ? 'Company' : 'Individual'),
      contactName: contactName || null,
    };
  });
};

export const parseCsvToLeads = parseLeadCSV;
