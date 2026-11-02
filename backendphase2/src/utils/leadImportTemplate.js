import { isMeaninglessImportColumn } from './importSpreadsheet.js';

/**
 * Official Leads import template headers (field ids + display labels).
 * Must stay aligned with frontphase2 LeadImportDrawer CRM_FIELDS / downloadSampleCsv.
 */
export const LEAD_IMPORT_TEMPLATE_FIELDS = [
  { id: 'companyName', label: 'Company Name' },
  { id: 'contactPerson', label: 'Name (contact person)' },
  { id: 'directorName', label: 'Director Name' },
  { id: 'directorSalutation', label: 'Salutation (Mr, Ms, Dr…)' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'type', label: 'Lead Type' },
  { id: 'source', label: 'Source' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Interest Level' },
  { id: 'industry', label: 'Sector / Industry' },
  { id: 'companySize', label: 'Team Name' },
  { id: 'website', label: 'Website / Company Link' },
  { id: 'linkedIn', label: 'LinkedIn' },
  { id: 'location', label: 'Location' },
  { id: 'city', label: 'City' },
  { id: 'country', label: 'Country' },
  { id: 'designation', label: 'Designation' },
  { id: 'interestedNeeds', label: 'Services Needed' },
  { id: 'campaignName', label: 'Campaign Name' },
  { id: 'nextFollowUpDue', label: 'Next Follow-up Date' },
  { id: 'expectedBusinessValue', label: 'Expected Business Value' },
  { id: 'notes', label: 'Notes' },
];

const IDENTITY_FIELD_IDS = new Set(['companyName', 'contactPerson', 'email', 'phone']);

const TEMPLATE_REJECT_MESSAGE =
  'Please use our Leads import template. This file does not match the system format. Download the template, fill your leads, then upload that file.';

export function normalizeLeadImportHeader(value = '') {
  return String(value)
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s*\*+\s*$/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALLOWED_HEADER_KEYS = new Set(
  LEAD_IMPORT_TEMPLATE_FIELDS.flatMap((field) => [
    normalizeLeadImportHeader(field.id),
    normalizeLeadImportHeader(field.label),
  ]),
);

function isWatermarkHeader(value = '') {
  return /^watermark\b/i.test(String(value ?? '').trim());
}

export function isLeadImportTemplateHeader(column) {
  const normalized = normalizeLeadImportHeader(column);
  if (!normalized) return false;
  return ALLOWED_HEADER_KEYS.has(normalized);
}

function resolveTemplateFieldId(column) {
  const normalized = normalizeLeadImportHeader(column);
  if (!normalized) return null;
  const match = LEAD_IMPORT_TEMPLATE_FIELDS.find(
    (field) =>
      normalizeLeadImportHeader(field.id) === normalized ||
      normalizeLeadImportHeader(field.label) === normalized,
  );
  return match?.id || null;
}

export function buildLeadImportTemplateMapping(columns = []) {
  const mapping = {};
  for (const column of columns) {
    const fieldId = resolveTemplateFieldId(column);
    if (fieldId && !mapping[fieldId]) {
      mapping[fieldId] = column;
    }
  }
  return mapping;
}

/**
 * Only accept spreadsheets that use our downloadable Leads template headers
 * (field ids or their official labels). Reject any other Excel/CSV layout.
 */
export function assertLeadImportUsesSystemTemplate(columns = []) {
  const usable = (Array.isArray(columns) ? columns : [])
    .map((column) => String(column ?? '').trim())
    .filter((column) => column && !isWatermarkHeader(column) && !isMeaninglessImportColumn(column));

  if (!usable.length) {
    const err = new Error(TEMPLATE_REJECT_MESSAGE);
    err.code = 'LEAD_IMPORT_TEMPLATE_REQUIRED';
    throw err;
  }

  const unknown = usable.filter((column) => !isLeadImportTemplateHeader(column));
  if (unknown.length) {
    const err = new Error(TEMPLATE_REJECT_MESSAGE);
    err.code = 'LEAD_IMPORT_TEMPLATE_REQUIRED';
    err.meta = { unknownColumns: unknown.slice(0, 12) };
    throw err;
  }

  const hasIdentity = usable.some((column) => {
    const fieldId = resolveTemplateFieldId(column);
    return fieldId && IDENTITY_FIELD_IDS.has(fieldId);
  });

  if (!hasIdentity) {
    const err = new Error(
      'Please use our Leads import template. Include at least one of: companyName, contactPerson, email, or phone.',
    );
    err.code = 'LEAD_IMPORT_TEMPLATE_REQUIRED';
    throw err;
  }

  return usable;
}
