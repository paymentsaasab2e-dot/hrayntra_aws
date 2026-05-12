/**
 * Generates docs/templates/leads_import_template.xlsx for CRM lead import.
 * Run from backendphase2: node scripts/build-leads-import-template.mjs
 */
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '..', 'docs', 'templates', 'leads_import_template.xlsx');

// Column keys must match LeadImportDrawer CRM_FIELDS + import payload (lead.service importLeads)
const headers = [
  'companyName',
  'directorSalutation',
  'contactPerson',
  'email',
  'phone',
  'type',
  'source',
  'status',
  'priority',
  'industry',
  'companySize',
  'website',
  'linkedIn',
  'location',
  'city',
  'country',
  'designation',
  'interestedNeeds',
  'campaignName',
  'nextFollowUpDue',
  'notes',
];

const exampleRows = [
  [
    'Acme Corporation',
    'Ms',
    'Jane Smith',
    'jane.smith@acme.com',
    '+1-555-0100',
    'Company',
    'LinkedIn',
    'New',
    'High',
    'Software',
    '51-200',
    'https://acme.com',
    'https://www.linkedin.com/company/acme',
    'Bengaluru, India',
    'Bengaluru',
    'India',
    'VP Talent',
    'RPO, executive search',
    'Q1 Outbound',
    '2026-12-15',
    'Met at conference; request intro call',
  ],
  [
    'Globex LLC',
    'Mr',
    'John Doe',
    'john@globex.example',
    '+91-9876543210',
    'Company',
    'Website',
    'Contacted',
    'Medium',
    'Finance',
    '201-500',
    'https://globex.example',
    '',
    'Mumbai',
    'Mumbai',
    'India',
    'Director',
    'Payroll outsourcing',
    '',
    '',
    'Warm inbound form submit',
  ],
];

const guideSheet = [
  ['Field', 'Description', 'Allowed / notes'],
  ['companyName', 'Legal or trading name of the company', 'Required for meaningful rows; used with contactPerson for duplicate match'],
  ['directorSalutation', 'Optional honorific', 'Mr | Mrs | Ms | Miss | Dr | Prof (empty allowed)'],
  ['contactPerson', 'Primary contact full name', ''],
  ['email', 'Work email', 'Lowercased on import; duplicate detection'],
  ['phone', 'Phone with country code', ''],
  ['type', 'Lead type', 'Company | Individual | Referral'],
  ['source', 'Where the lead came from', 'Website | LinkedIn | Email | Referral | Campaign'],
  ['status', 'Pipeline status', 'New | Contacted | Qualified | Converted | Lost'],
  ['priority', '', 'High | Medium | Low (aliases: hot/warm/cold accepted)'],
  ['industry', '', ''],
  ['companySize', 'Mapped to team size in UI', ''],
  ['website', 'Company URL', ''],
  ['linkedIn', 'Company or profile LinkedIn URL', ''],
  ['location', 'Free-text location', ''],
  ['city', '', ''],
  ['country', '', ''],
  ['designation', 'Contact job title', ''],
  ['interestedNeeds', 'Services / needs', 'Mapped to servicesNeeded'],
  ['campaignName', '', ''],
  ['nextFollowUpDue', 'Next follow-up', 'ISO date or parseable date string'],
  ['notes', 'Notes / expected business value', ''],
  ['', '', ''],
  ['Import', 'Use Leads → Import in frontphase2, or POST /api/v1/leads/import with rows + mapping.', ''],
];

const wb = XLSX.utils.book_new();

const data = [headers, ...exampleRows];
const ws = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, 'Leads');

const wsGuide = XLSX.utils.aoa_to_sheet(guideSheet);
XLSX.utils.book_append_sheet(wb, wsGuide, 'Field guide');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
XLSX.writeFile(wb, outPath);
console.log('Wrote', outPath);
