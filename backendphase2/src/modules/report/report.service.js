import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import {
  buildJobsModuleExport,
  buildClientsModuleExport,
  buildCandidatesModuleExport,
  buildInterviewsModuleExport,
  buildPlacementsModuleExport,
  limitDataset,
} from './reportModuleFormats.js';

const EXPORT_DIR = path.join(process.cwd(), 'uploads', 'reports');
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

function ensureExportDir() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

function fileSlug(value) {
  return String(value || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'report';
}

function toPublicUploadUrl(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  const uploadsIndex = normalized.lastIndexOf('/uploads/');
  return uploadsIndex >= 0 ? normalized.slice(uploadsIndex) : normalized;
}

function escapePdfText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function sanitizePdfValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return Number(value).toFixed(2);
  }
  return String(value);
}

function wrapTextToWidth(text, maxChars) {
  const value = sanitizePdfValue(text);
  const limit = Math.max(8, Number(maxChars || 32));
  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) return ['-'];
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current.length) {
      current = word;
      continue;
    }
    if ((current + ' ' + word).length <= limit) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length) lines.push(current);
  return lines.length ? lines : ['-'];
}

function makePdfText(text, x, y, fontSize = 8.5, font = 'F1') {
  return `0 0 0 rg BT /${font} ${fontSize} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`;
}

function drawPdfRect(x, y, width, height, stroke = '0.82 0.85 0.9 RG', fill = null) {
  const commands = [];
  if (fill) commands.push(`${fill} rg`);
  commands.push(stroke);
  commands.push(`${x} ${y} ${width} ${height} re ${fill ? 'B' : 'S'}`);
  return commands.join(' ');
}

function estimateColumnWidths(columns, rows, availableWidth) {
  const weights = columns.map((column) => {
    const samples = rows.slice(0, 12).map((row) => sanitizePdfValue(row?.[column]));
    const sampleLength = Math.max(column.length, ...samples.map((value) => String(value).length), 10);
    return Math.min(Math.max(sampleLength * 4.8, 56), 160);
  });
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  return weights.map((weight) => Math.max(46, Math.floor((weight / total) * availableWidth)));
}

function createTablePdfBuffer(title, columns, rows, summary) {
  const pageWidth = 842;
  const pageHeight = 595;
  const marginLeft = 24;
  const marginRight = 24;
  const marginTop = 24;
  const marginBottom = 22;
  const safeColumns = Array.isArray(columns) && columns.length ? columns.map((column) => String(column)) : ['Label', 'Value'];
  const safeRows = Array.isArray(rows) ? rows : [];
  const usableWidth = pageWidth - marginLeft - marginRight;
  const columnWidths = estimateColumnWidths(safeColumns, safeRows, usableWidth);

  const pageHeader = (contentLines) => {
    let y = pageHeight - marginTop;
    contentLines.push(makePdfText(title, marginLeft, y, 15, 'F2'));
    y -= 15;
    if (summary) {
      contentLines.push(makePdfText(summary, marginLeft, y, 9, 'F1'));
      y -= 14;
    } else {
      y -= 6;
    }
    return y;
  };

  const addHeaderRow = (contentLines, y) => {
    const headerHeight = 20;
    let x = marginLeft;
    safeColumns.forEach((column, index) => {
      const width = columnWidths[index] || 80;
      contentLines.push(drawPdfRect(x, y - headerHeight + 4, width, headerHeight, '0.76 0.8 0.86 RG', '0.95 0.97 1 rg'));
      const headerLines = wrapTextToWidth(column, Math.max(10, Math.floor((width - 8) / 5.0)));
      headerLines.slice(0, 2).forEach((line, lineIndex) => {
        contentLines.push(makePdfText(line, x + 4, y - 8 - (lineIndex * 8), 8.3, 'F2'));
      });
      x += width;
    });
    return y - headerHeight;
  };

  const pages = [];
  let currentPageLines = [];
  let y = pageHeader(currentPageLines);
  y = addHeaderRow(currentPageLines, y);

  const estimateRowHeight = (row) => {
    const cellLines = safeColumns.map((column, index) => {
      const width = columnWidths[index] || 80;
      return wrapTextToWidth(row?.[column], Math.max(10, Math.floor((width - 8) / 4.9)));
    });
    return Math.max(22, ...cellLines.map((lines) => 12 + ((lines.length - 1) * 7))) + 4;
  };

  const pushPage = () => {
    if (currentPageLines.length) pages.push(currentPageLines);
    currentPageLines = [];
    y = pageHeader(currentPageLines);
    y = addHeaderRow(currentPageLines, y);
  };

  if (!safeRows.length) {
    currentPageLines.push(makePdfText('No data available', marginLeft, y - 8, 10, 'F1'));
  } else {
    safeRows.forEach((row, rowIndex) => {
      const rowHeight = estimateRowHeight(row);
      if (y - rowHeight < marginBottom) {
        pushPage();
      }

      let x = marginLeft;
      safeColumns.forEach((column, index) => {
        const width = columnWidths[index] || 80;
        const cellLines = wrapTextToWidth(row?.[column], Math.max(10, Math.floor((width - 8) / 4.9)));
        currentPageLines.push(drawPdfRect(x, y - rowHeight + 4, width, rowHeight, '0.86 0.88 0.92 RG'));
        cellLines.slice(0, 4).forEach((line, lineIndex) => {
          currentPageLines.push(makePdfText(line, x + 4, y - 10 - (lineIndex * 7.2), 8.1, index === 0 ? 'F2' : 'F1'));
        });
        x += width;
      });
      y -= rowHeight;

      if (rowIndex < safeRows.length - 1) {
        y -= 1;
      }
    });
  }

  if (currentPageLines.length) pages.push(currentPageLines);
  if (!pages.length) pages.push([]);

  const objects = [];
  const pageObjectNumbers = [];

  pages.forEach((pageLines, pageIndex) => {
    const content = pageLines.join('\n');
    const pageObjNum = 5 + pageIndex * 2;
    const contentObjNum = 6 + pageIndex * 2;
    pageObjectNumbers.push(pageObjNum);
    objects.push(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj`);
    objects.push(`${contentObjNum} 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj`);
  });

  const kids = pageObjectNumbers.map((num) => `${num} 0 R`).join(' ');
  objects.unshift('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj');
  objects.unshift('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  objects.unshift(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageObjectNumbers.length} >>\nendobj`);
  objects.unshift('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function userHasFullDbAccess(user) {
  if (env.ASSISTANT_FULL_DB_ACCESS === 'true') return true;
  const role = String(user?.role || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER';
}

function isValidObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_REGEX.test(value.trim());
}

async function resolveUserId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (isValidObjectId(normalized)) return normalized;

  const lowered = normalized.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: normalized }, { email: lowered }, { name: normalized }],
    },
    select: { id: true },
  });
  return user?.id || null;
}

function dateRangeFilter(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;

  const now = new Date();
  if (normalized === 'last_7_days') {
    return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  }
  if (normalized === 'last_30_days') {
    return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }
  if (normalized === 'this_month') {
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
  return null;
}

function searchContains(value) {
  const normalized = String(value || '').trim();
  return normalized ? { contains: normalized, mode: 'insensitive' } : null;
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTextSearchConditions(fields, rawValue, arrayFields = []) {
  const normalized = normalizeSearchText(rawValue);
  if (!normalized) return [];

  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 6);

  const fullPhraseConditions = fields
    .map((field) => {
      const condition = searchContains(rawValue);
      return condition ? { [field]: condition } : null;
    })
    .filter(Boolean);

  const fullPhraseArrayConditions = arrayFields
    .map((field) => {
      const condition = searchContains(rawValue);
      return condition ? { [field]: { has: String(rawValue || '').trim() } } : null;
    })
    .filter(Boolean);

  const tokenConditions = tokens.flatMap((token) =>
    fields.map((field) => ({
      [field]: { contains: token, mode: 'insensitive' },
    }))
  );

  const tokenArrayConditions = tokens.flatMap((token) =>
    arrayFields.map((field) => ({
      [field]: { has: token },
    }))
  );

  return [...fullPhraseConditions, ...fullPhraseArrayConditions, ...tokenConditions, ...tokenArrayConditions];
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
}

function formatDateTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function formatArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : '';
}

function formatJson(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeEntity(entity) {
  const normalized = String(entity || '').trim().toLowerCase();
  if (['lead', 'leads'].includes(normalized)) return 'leads';
  if (['client', 'clients'].includes(normalized)) return 'clients';
  if (['candidate', 'candidates'].includes(normalized)) return 'candidates';
  if (['job', 'jobs'].includes(normalized)) return 'jobs';
  if (['pipeline'].includes(normalized)) return 'pipeline';
  if (['interview', 'interviews'].includes(normalized)) return 'interviews';
  if (['placement', 'placements'].includes(normalized)) return 'placements';
  if (['task', 'tasks'].includes(normalized)) return 'tasks';
  if (['activity', 'activities'].includes(normalized)) return 'activities';
  if (['team', 'team-performance', 'team_performance', 'team-members', 'team_members'].includes(normalized)) return 'team';
  if (['match', 'matches', 'ai-match', 'ai_match', 'ai-matches', 'ai_matches'].includes(normalized)) return 'ai_matches';
  if (['application', 'applications', 'ai-applied-matches', 'ai_applied_matches', 'applied-matches'].includes(normalized)) {
    return 'ai_applied_matches';
  }
  return normalized;
}

async function loadIfEnabled(enabled, loader) {
  if (!enabled) return [];
  return loader();
}

function normalizeFormat(format) {
  const normalized = String(format || '').trim().toLowerCase();
  if (normalized === 'xlsx') return 'excel';
  return normalized;
}

function combineWhere(...parts) {
  const filtered = parts.filter((part) => part && Object.keys(part).length > 0);
  if (filtered.length === 0) return {};
  if (filtered.length === 1) return filtered[0];
  return { AND: filtered };
}

function candidateScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ assignedToId: uid }, { createdById: uid }] };
}

function jobScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ assignedToId: uid }, { createdById: uid }] };
}

function clientScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { assignedToId: uid };
}

function leadScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { assignedToId: uid };
}

function interviewScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ createdById: uid }, { interviewerId: uid }, { panelIds: { has: uid } }] };
}

function placementScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return {
    OR: [
      { recruiterId: uid },
      { job: { OR: [{ createdById: uid }, { assignedToId: uid }] } },
      { candidate: { OR: [{ assignedToId: uid }, { createdById: uid }] } },
    ],
  };
}

function taskScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ assignedToId: uid }, { createdById: uid }] };
}

function activityScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { performedById: uid };
}

function optionalFilterValue(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function formatFilterLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toValueOptions(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: formatFilterLabel(value) }));
}

const REPORT_ENTITY_KEYS = [
  'leads',
  'clients',
  'jobs',
  'candidates',
  'placements',
  'interviews',
  'team',
  'tasks',
  'activities',
  'ai_matches',
  'ai_applied_matches',
];

const REPORT_ENTITY_LABELS = {
  leads: 'Leads',
  clients: 'Clients',
  jobs: 'Jobs',
  candidates: 'Candidates',
  placements: 'Placements',
  interviews: 'Interviews',
  team: 'Team Members',
  tasks: 'Tasks',
  activities: 'Activity',
  ai_matches: 'AI Matches',
  ai_applied_matches: 'AI Applied Matches',
};

function parseReportEntities(rawValue) {
  const normalized = String(rawValue || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!normalized.length) return new Set(REPORT_ENTITY_KEYS);
  const aliases = {
    lead: 'leads',
    client: 'clients',
    job: 'jobs',
    candidate: 'candidates',
    placement: 'placements',
    interview: 'interviews',
    'team-members': 'team',
    team_members: 'team',
    task: 'tasks',
    activity: 'activities',
    matches: 'ai_matches',
    'ai-matches': 'ai_matches',
    applications: 'ai_applied_matches',
    'ai-applied-matches': 'ai_applied_matches',
    'applied-matches': 'ai_applied_matches',
  };
  const selected = new Set();
  normalized.forEach((token) => {
    const key = aliases[token] || token;
    if (REPORT_ENTITY_KEYS.includes(key)) selected.add(key);
  });
  return selected.size ? selected : new Set(REPORT_ENTITY_KEYS);
}

function entityEnabled(filters, key) {
  if (!filters?.entities || filters.entities.size === 0) return true;
  return filters.entities.has(key);
}

function parseDateOnly(value, endOfDay = false) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay) parsed.setHours(23, 59, 59, 999);
  else parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function parseSummaryFilters(query = {}) {
  const startDateRaw = String(query.startDate || '').trim();
  const endDateRaw = String(query.endDate || '').trim();
  const hasCustomDates = Boolean(startDateRaw && endDateRaw);
  const rangeKey = hasCustomDates ? 'custom' : String(query.dateRange || 'last_30_days').trim().toLowerCase();
  const now = new Date();
  let start = null;
  let end = now;

  if (hasCustomDates) {
    start = parseDateOnly(startDateRaw, false);
    end = parseDateOnly(endDateRaw, true);
  } else if (rangeKey === 'last_7_days') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (rangeKey === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (rangeKey === 'this_quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), quarterStartMonth, 1);
  } else if (rangeKey === 'this_year') {
    start = new Date(now.getFullYear(), 0, 1);
  } else {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (Number.isNaN(start?.getTime?.())) {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  if (Number.isNaN(end?.getTime?.())) {
    end = now;
  }

  return {
    dateRange: rangeKey,
    startDate: startDateRaw || null,
    endDate: endDateRaw || null,
    start,
    end,
    entities: parseReportEntities(query.entities),
    clientId: isValidObjectId(query.clientId) ? String(query.clientId) : null,
    jobId: isValidObjectId(query.jobId) ? String(query.jobId) : null,
    recruiterId: isValidObjectId(query.recruiterId) ? String(query.recruiterId) : null,
    jobStatus: optionalFilterValue(query.jobStatus),
    jobType: optionalFilterValue(query.jobType),
    jobLocation: optionalFilterValue(query.jobLocation),
    jobDepartment: optionalFilterValue(query.jobDepartment),
    candidateStatus: optionalFilterValue(query.candidateStatus),
    candidateSource: optionalFilterValue(query.candidateSource),
    clientStatus: optionalFilterValue(query.clientStatus),
    clientIndustry: optionalFilterValue(query.clientIndustry),
    leadStatus: optionalFilterValue(query.leadStatus),
    leadSource: optionalFilterValue(query.leadSource),
    interviewStatus: optionalFilterValue(query.interviewStatus),
    placementStatus: optionalFilterValue(query.placementStatus),
  };
}

function exactMatchFilter(field, value) {
  if (!value) return {};
  return { [field]: value };
}

function caseInsensitiveMatchFilter(field, value) {
  if (!value) return {};
  return { [field]: { equals: value, mode: 'insensitive' } };
}

function buildJobMatchConditions(filters, { includeId = true } = {}) {
  const jobWhere = {};
  if (includeId && filters.jobId) jobWhere.id = filters.jobId;
  if (filters.jobStatus) jobWhere.status = filters.jobStatus;
  if (filters.jobType) jobWhere.type = filters.jobType;
  if (filters.jobLocation) jobWhere.location = { equals: filters.jobLocation, mode: 'insensitive' };
  if (filters.jobDepartment) jobWhere.department = { equals: filters.jobDepartment, mode: 'insensitive' };
  if (filters.clientId) jobWhere.clientId = filters.clientId;
  return jobWhere;
}

function relatedJobWhere(filters) {
  const jobWhere = buildJobMatchConditions(filters);
  if (Object.keys(jobWhere).length === 0) return {};
  return { job: jobWhere };
}

function pipelineEntryJobFilter(filters) {
  if (filters.jobId) return { jobId: filters.jobId };
  const jobWhere = buildJobMatchConditions(filters, { includeId: false });
  if (Object.keys(jobWhere).length === 0) return {};
  return { stage: { job: jobWhere } };
}

function placementJobFilter(filters) {
  const jobWhere = buildJobMatchConditions(filters, { includeId: false });
  if (Object.keys(jobWhere).length === 0) return {};
  return { placement: { job: jobWhere } };
}

function candidateJobScopeFilter(filters) {
  if (!filters.jobId && !filters.jobStatus && !filters.jobType && !filters.jobLocation && !filters.jobDepartment) {
    return {};
  }
  return {
    OR: [
      filters.jobId ? { assignedJobs: { has: filters.jobId } } : null,
      { pipelineEntries: { some: relatedJobWhere(filters) } },
      { matches: { some: relatedJobWhere(filters) } },
      { interviews: { some: relatedJobWhere(filters) } },
      { placements: { some: relatedJobWhere(filters) } },
    ].filter(Boolean),
  };
}

async function buildReportFilterOptions(user) {
  const jobsWhere = combineWhere(jobScope(user));
  const clientsWhere = combineWhere(clientScope(user));
  const candidatesWhere = combineWhere(candidateScope(user));
  const leadsWhere = combineWhere(leadScope(user));
  const interviewsWhere = combineWhere(interviewScope(user));
  const placementsWhere = combineWhere(placementScope(user), { deletedAt: null });

  const [
    jobMeta,
    candidateMeta,
    clientMeta,
    leadMeta,
    interviewMeta,
    placementMeta,
    clientOptions,
    jobOptions,
    recruiters,
    matchMeta,
    applicationMeta,
  ] = await Promise.all([
    prisma.job.findMany({
      where: jobsWhere,
      select: { status: true, type: true, location: true, department: true },
      take: 5000,
    }),
    prisma.candidate.findMany({
      where: candidatesWhere,
      select: { status: true, source: true },
      take: 5000,
    }),
    prisma.client.findMany({
      where: clientsWhere,
      select: { status: true, industry: true },
      take: 5000,
    }),
    prisma.lead.findMany({
      where: leadsWhere,
      select: { status: true, source: true },
      take: 5000,
    }),
    prisma.interview.findMany({
      where: interviewsWhere,
      select: { status: true },
      take: 5000,
    }),
    prisma.placement.findMany({
      where: placementsWhere,
      select: { status: true },
      take: 5000,
    }),
    prisma.client.findMany({
      where: clientsWhere,
      select: { id: true, companyName: true },
      orderBy: { companyName: 'asc' },
      take: 200,
    }),
    prisma.job.findMany({
      where: jobsWhere,
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
      take: 200,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.match.findMany({ select: { status: true }, take: 5000 }),
    prisma.application.findMany({ select: { status: true }, take: 5000 }),
  ]);

  return {
    dateRanges: [
      { value: 'last_7_days', label: 'Last 7 Days' },
      { value: 'last_30_days', label: 'Last 30 Days' },
      { value: 'this_month', label: 'This Month' },
      { value: 'this_quarter', label: 'This Quarter' },
      { value: 'this_year', label: 'This Year' },
      { value: 'custom', label: 'Custom (From / To)' },
    ],
    reportEntities: REPORT_ENTITY_KEYS.map((value) => ({
      value,
      label: REPORT_ENTITY_LABELS[value] || formatFilterLabel(value),
    })),
    clients: clientOptions.map((client) => ({ id: client.id, name: client.companyName })),
    jobs: jobOptions.map((job) => ({ id: job.id, name: job.title })),
    recruiters: recruiters.map((recruiter) => ({
      id: recruiter.id,
      name: recruiter.name || recruiter.email || 'Unknown',
    })),
    jobStatuses: toValueOptions(jobMeta.map((row) => row.status)),
    jobTypes: toValueOptions(jobMeta.map((row) => row.type)),
    jobLocations: toValueOptions(jobMeta.map((row) => row.location)),
    jobDepartments: toValueOptions(jobMeta.map((row) => row.department)),
    candidateStatuses: toValueOptions(candidateMeta.map((row) => row.status)),
    candidateSources: toValueOptions(candidateMeta.map((row) => row.source)),
    clientStatuses: toValueOptions(clientMeta.map((row) => row.status)),
    clientIndustries: toValueOptions(clientMeta.map((row) => row.industry)),
    leadStatuses: toValueOptions(leadMeta.map((row) => row.status)),
    leadSources: toValueOptions(leadMeta.map((row) => row.source)),
    interviewStatuses: toValueOptions(interviewMeta.map((row) => row.status)),
    placementStatuses: toValueOptions(placementMeta.map((row) => row.status)),
    matchStatuses: toValueOptions(matchMeta.map((row) => row.status)),
    applicationStatuses: toValueOptions(applicationMeta.map((row) => row.status)),
    customSources: REPORT_ENTITY_KEYS.map((value) => ({
      value,
      label: REPORT_ENTITY_LABELS[value] || formatFilterLabel(value),
    })).concat([{ value: 'pipeline', label: 'Pipeline' }]),
  };
}

function dateBetween(field, filters) {
  if (!filters?.start || !filters?.end) return {};
  return { [field]: { gte: filters.start, lte: filters.end } };
}

function buildTimeBuckets(start, end) {
  const buckets = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay));

  if (diffDays <= 45) {
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(cursor);
      bucketEnd.setHours(23, 59, 59, 999);
      buckets.push({
        key: bucketStart.toISOString().slice(0, 10),
        label: bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        start: bucketStart,
        end: bucketEnd,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return buckets;
  }

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    buckets.push({
      key: `${bucketStart.getFullYear()}-${String(bucketStart.getMonth() + 1).padStart(2, '0')}`,
      label: bucketStart.toLocaleDateString('en-US', { month: 'short' }),
      start: bucketStart,
      end: bucketEnd,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function buildSeriesRows(buckets, keys) {
  return buckets.map((bucket) => {
    const row = { label: bucket.label };
    keys.forEach((key) => {
      row[key] = 0;
    });
    return row;
  });
}

function incrementBucket(series, buckets, dateValue, key) {
  if (!dateValue) return;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return;
  const index = buckets.findIndex((bucket) => date >= bucket.start && date <= bucket.end);
  if (index >= 0) {
    series[index][key] = Number(series[index][key] || 0) + 1;
  }
}

function addBucketValue(series, buckets, dateValue, key, value) {
  if (!dateValue) return;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return;
  const index = buckets.findIndex((bucket) => date >= bucket.start && date <= bucket.end);
  if (index >= 0) {
    series[index][key] = Number(series[index][key] || 0) + Number(value || 0);
  }
}

function diffDaysFromNow(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  return `${diff} days`;
}

function classifyActivityRecord(activity) {
  const text = `${activity?.action || ''} ${activity?.description || ''} ${activity?.category || ''}`.toLowerCase();
  if (text.includes('call')) return 'calls';
  if (text.includes('mail') || text.includes('email')) return 'emails';
  if (text.includes('task')) return 'tasks';
  return null;
}

function countBy(items, keyGetter) {
  const map = new Map();
  for (const item of items) {
    const key = keyGetter(item);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

async function getReportsSummary(query = {}, user = null) {
  const filters = parseSummaryFilters(query);
  const filterOptions = await buildReportFilterOptions(user);

  const jobsWhere = combineWhere(
    jobScope(user),
    dateBetween('createdAt', filters),
    filters.clientId ? { clientId: filters.clientId } : {},
    filters.jobId ? { id: filters.jobId } : {},
    filters.recruiterId ? { OR: [{ assignedToId: filters.recruiterId }, { createdById: filters.recruiterId }] } : {},
    exactMatchFilter('status', filters.jobStatus),
    exactMatchFilter('type', filters.jobType),
    caseInsensitiveMatchFilter('location', filters.jobLocation),
    caseInsensitiveMatchFilter('department', filters.jobDepartment)
  );

  const clientsWhere = combineWhere(
    clientScope(user),
    dateBetween('createdAt', filters),
    filters.clientId ? { id: filters.clientId } : {},
    filters.recruiterId ? { assignedToId: filters.recruiterId } : {},
    exactMatchFilter('status', filters.clientStatus),
    caseInsensitiveMatchFilter('industry', filters.clientIndustry)
  );

  const candidatesWhere = combineWhere(
    candidateScope(user),
    dateBetween('createdAt', filters),
    filters.recruiterId ? { OR: [{ assignedToId: filters.recruiterId }, { createdById: filters.recruiterId }] } : {},
    exactMatchFilter('status', filters.candidateStatus),
    caseInsensitiveMatchFilter('source', filters.candidateSource),
    filters.jobId
      ? {
          OR: [
            { assignedJobs: { has: filters.jobId } },
            { pipelineEntries: { some: { jobId: filters.jobId } } },
            { matches: { some: { jobId: filters.jobId } } },
            { interviews: { some: { jobId: filters.jobId } } },
            { placements: { some: { jobId: filters.jobId } } },
          ],
        }
      : candidateJobScopeFilter(filters),
    filters.clientId
      ? {
          OR: [{ interviews: { some: { clientId: filters.clientId } } }, { placements: { some: { clientId: filters.clientId } } }],
        }
      : {}
  );

  const interviewsWhere = combineWhere(
    interviewScope(user),
    dateBetween('scheduledAt', filters),
    filters.clientId ? { clientId: filters.clientId } : {},
    filters.jobId ? { jobId: filters.jobId } : {},
    filters.recruiterId
      ? { OR: [{ interviewerId: filters.recruiterId }, { createdById: filters.recruiterId }, { panelIds: { has: filters.recruiterId } }] }
      : {},
    exactMatchFilter('status', filters.interviewStatus),
    relatedJobWhere(filters)
  );

  const placementsWhere = combineWhere(
    placementScope(user),
    { deletedAt: null },
    dateBetween('createdAt', filters),
    filters.clientId ? { clientId: filters.clientId } : {},
    filters.jobId ? { jobId: filters.jobId } : {},
    filters.recruiterId ? { recruiterId: filters.recruiterId } : {},
    exactMatchFilter('status', filters.placementStatus),
    relatedJobWhere(filters)
  );

  const tasksWhere = combineWhere(
    taskScope(user),
    dateBetween('createdAt', filters),
    filters.recruiterId ? { OR: [{ assignedToId: filters.recruiterId }, { createdById: filters.recruiterId }] } : {}
  );

  const activitiesWhere = combineWhere(
    activityScope(user),
    dateBetween('createdAt', filters),
    filters.clientId ? { OR: [{ clientId: filters.clientId }, { entityId: filters.clientId }, { relatedId: filters.clientId }] } : {},
    filters.jobId ? { OR: [{ entityId: filters.jobId }, { relatedId: filters.jobId }] } : {},
    filters.recruiterId ? { performedById: filters.recruiterId } : {}
  );

  const leadsWhere = combineWhere(
    leadScope(user),
    dateBetween('createdAt', filters),
    filters.recruiterId ? { assignedToId: filters.recruiterId } : {},
    filters.clientId ? { convertedToClientId: filters.clientId } : {},
    exactMatchFilter('status', filters.leadStatus),
    exactMatchFilter('source', filters.leadSource)
  );

  const matchesWhere = combineWhere(
    filters.jobId ? { jobId: filters.jobId } : {},
    filters.recruiterId ? { createdById: filters.recruiterId } : {},
    dateBetween('createdAt', filters),
    relatedJobWhere(filters)
  );

  const applicationsWhere = combineWhere(
    filters.jobId ? { jobId: filters.jobId } : {},
    dateBetween('appliedAt', filters),
    relatedJobWhere(filters)
  );

  const pipelineWhere = combineWhere(dateBetween('movedAt', filters), pipelineEntryJobFilter(filters));

  const includeJobs = entityEnabled(filters, 'jobs');
  const includeClients = entityEnabled(filters, 'clients');
  const includeCandidates = entityEnabled(filters, 'candidates');
  const includeInterviews = entityEnabled(filters, 'interviews');
  const includePlacements = entityEnabled(filters, 'placements');
  const includeTasks = entityEnabled(filters, 'tasks');
  const includeActivities = entityEnabled(filters, 'activities');
  const includeLeads = entityEnabled(filters, 'leads');
  const includeAiMatches = entityEnabled(filters, 'ai_matches');
  const includeAiApplied = entityEnabled(filters, 'ai_applied_matches');
  const includeTeam = entityEnabled(filters, 'team');
  const includePipeline = includeCandidates || includeJobs;
  const includeBilling = includePlacements;

  const billingWhere = combineWhere(
    dateBetween('createdAt', filters),
    filters.clientId ? { clientId: filters.clientId } : {},
    filters.jobId ? { placement: { jobId: filters.jobId } } : {},
    placementJobFilter(filters)
  );

  const [
    jobs,
    clients,
    candidates,
    interviews,
    placements,
    tasks,
    activities,
    leads,
    matches,
    applications,
    pipelineEntries,
    billingRecords,
    recruiters,
  ] = await Promise.all([
    loadIfEnabled(includeJobs, () =>
      prisma.job.findMany({
        where: jobsWhere,
        select: {
          id: true,
          title: true,
          status: true,
          location: true,
          openings: true,
          createdAt: true,
          postedDate: true,
          clientId: true,
          assignedToId: true,
          createdById: true,
          client: { select: { companyName: true } },
        },
        orderBy: { updatedAt: 'desc' },
      })
    ),
    loadIfEnabled(includeClients, () =>
      prisma.client.findMany({
      where: clientsWhere,
      select: { id: true, companyName: true, status: true, industry: true, location: true, assignedToId: true, createdAt: true },
      orderBy: { updatedAt: 'desc' },
      })
    ),
    loadIfEnabled(includeCandidates, () =>
      prisma.candidate.findMany({
      where: candidatesWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        source: true,
        skills: true,
        status: true,
        createdAt: true,
        assignedToId: true,
        createdById: true,
        assignedJobs: true,
      },
      orderBy: { updatedAt: 'desc' },
      })
    ),
    loadIfEnabled(includeInterviews, () =>
      prisma.interview.findMany({
      where: interviewsWhere,
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        interviewerId: true,
        createdById: true,
      },
      orderBy: { scheduledAt: 'desc' },
      })
    ),
    loadIfEnabled(includePlacements, () =>
      prisma.placement.findMany({
      where: placementsWhere,
      select: {
        id: true,
        status: true,
        createdAt: true,
        joiningDate: true,
        offerDate: true,
        revenue: true,
        placementFee: true,
        fee: true,
        recruiterId: true,
        jobId: true,
        clientId: true,
      },
      orderBy: { updatedAt: 'desc' },
      })
    ),
    loadIfEnabled(includeTasks, () =>
      prisma.task.findMany({
      where: tasksWhere,
      select: { id: true, status: true, dueDate: true, createdAt: true, assignedToId: true, createdById: true },
      })
    ),
    loadIfEnabled(includeActivities, () =>
      prisma.activity.findMany({
        where: activitiesWhere,
        select: { id: true, action: true, description: true, category: true, createdAt: true, performedById: true },
      })
    ),
    loadIfEnabled(includeLeads, () =>
      prisma.lead.findMany({
        where: leadsWhere,
        select: { id: true, status: true, source: true, createdAt: true, assignedToId: true, companyName: true },
        orderBy: { updatedAt: 'desc' },
      })
    ),
    loadIfEnabled(includeAiMatches, () =>
      prisma.match.findMany({
        where: matchesWhere,
        select: { id: true, jobId: true, createdById: true, createdAt: true, candidateId: true, status: true, score: true },
      })
    ),
    loadIfEnabled(includeAiApplied, () =>
      prisma.application.findMany({
        where: applicationsWhere,
        select: {
          id: true,
          jobId: true,
          candidateId: true,
          status: true,
          matchScore: true,
          appliedAt: true,
        },
        orderBy: { appliedAt: 'desc' },
      })
    ),
    loadIfEnabled(includePipeline, () =>
      prisma.pipelineEntry.findMany({
        where: pipelineWhere,
        select: { id: true, jobId: true, candidateId: true, movedAt: true, stage: { select: { name: true } } },
        orderBy: { movedAt: 'desc' },
      })
    ),
    loadIfEnabled(includeBilling, () =>
      prisma.billingRecord.findMany({
        where: billingWhere,
        select: { id: true, amount: true, status: true, createdAt: true, invoiceDate: true },
        orderBy: { createdAt: 'desc' },
      })
    ),
    loadIfEnabled(includeTeam, () =>
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      })
    ),
  ]);

  const recruiterMap = new Map(recruiters.map((userRow) => [userRow.id, userRow.name || userRow.email || 'Unknown']));
  const buckets = buildTimeBuckets(filters.start, filters.end);

  const recruitmentTrend = buildSeriesRows(buckets, ['openJobs', 'placements', 'candidates', 'interviews']);
  jobs.forEach((job) => incrementBucket(recruitmentTrend, buckets, job.createdAt || job.postedDate, 'openJobs'));
  placements.forEach((placement) => incrementBucket(recruitmentTrend, buckets, placement.createdAt, 'placements'));
  candidates.forEach((candidate) => incrementBucket(recruitmentTrend, buckets, candidate.createdAt, 'candidates'));
  interviews.forEach((interview) => incrementBucket(recruitmentTrend, buckets, interview.scheduledAt, 'interviews'));

  const latestPipelineByCandidateJob = new Map();
  pipelineEntries.forEach((entry) => {
    const key = `${entry.candidateId || ''}:${entry.jobId || ''}`;
    const previous = latestPipelineByCandidateJob.get(key);
    const currentDate = new Date(entry.movedAt || 0).getTime();
    const previousDate = previous ? new Date(previous.movedAt || 0).getTime() : -1;
    if (!previous || currentDate > previousDate) {
      latestPipelineByCandidateJob.set(key, entry);
    }
  });

  const funnelCounters = {
    Applied: 0,
    Shortlisted: 0,
    Submitted: 0,
    Interviewed: 0,
    Offered: 0,
    Joined: 0,
  };
  const stageCounts = new Map();

  [...latestPipelineByCandidateJob.values()].forEach((entry) => {
    const stageName = String(entry?.stage?.name || '').trim() || 'Unknown';
    const lower = stageName.toLowerCase();
    stageCounts.set(stageName, (stageCounts.get(stageName) || 0) + 1);
    if (lower.includes('appl') || lower.includes('new')) funnelCounters.Applied += 1;
    else if (lower.includes('short')) funnelCounters.Shortlisted += 1;
    else if (lower.includes('submit')) funnelCounters.Submitted += 1;
    else if (lower.includes('interview') || lower.includes('screen')) funnelCounters.Interviewed += 1;
    else if (lower.includes('offer')) funnelCounters.Offered += 1;
    else if (lower.includes('join') || lower.includes('hire') || lower.includes('placed')) funnelCounters.Joined += 1;
  });

  if ([...latestPipelineByCandidateJob.values()].length === 0) {
    candidates.forEach((candidate) => {
      const stage = String(candidate.status || 'NEW').toUpperCase();
      funnelCounters.Applied += 1;
      if (stage === 'ACTIVE') funnelCounters.Shortlisted += 1;
      if (stage === 'PLACED') funnelCounters.Joined += 1;
    });
  }

  const funnel = [
    { name: 'Applied', value: funnelCounters.Applied, fill: '#94a3b8' },
    { name: 'Shortlisted', value: funnelCounters.Shortlisted, fill: '#64748b' },
    { name: 'Submitted', value: funnelCounters.Submitted, fill: '#475569' },
    { name: 'Interviewed', value: funnelCounters.Interviewed, fill: '#334155' },
    { name: 'Offered', value: funnelCounters.Offered, fill: '#1e293b' },
    { name: 'Joined', value: funnelCounters.Joined, fill: '#0f172a' },
  ];

  const pipelineStageDistribution = [...stageCounts.entries()]
    .map(([name, value]) => ({ name, value, fill: '#2563eb' }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const candidateCountByJob = new Map();
  pipelineEntries.forEach((entry) => {
    if (!entry.jobId || !entry.candidateId) return;
    const key = `${entry.jobId}:${entry.candidateId}`;
    candidateCountByJob.set(key, true);
  });
  const matchCountByJob = countBy(matches, (match) => match.jobId);

  const jobsTable = jobs.slice(0, 8).map((job) => {
    const pipelineUniqueCandidates = [...candidateCountByJob.keys()].filter((key) => key.startsWith(`${job.id}:`)).length;
    const candidateVolume = Math.max(pipelineUniqueCandidates, matchCountByJob.get(job.id) || 0);
    return {
      id: job.id,
      title: job.title || 'Untitled Job',
      client: job.client?.companyName || 'Unassigned Client',
      status: job.status || 'UNKNOWN',
      count: candidateVolume,
      aging: diffDaysFromNow(job.postedDate || job.createdAt),
    };
  });

  const topClients = [...countBy(jobs.filter((job) => job.client?.companyName), (job) => job.client?.companyName).entries()]
    .map(([name, volume]) => ({ name, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);

  const candidateSources = [...countBy(candidates, (candidate) => candidate.source || 'Unknown').entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const skillCounts = new Map();
  candidates.forEach((candidate) => {
    (candidate.skills || []).forEach((skill) => {
      const normalized = String(skill || '').trim();
      if (!normalized) return;
      skillCounts.set(normalized, (skillCounts.get(normalized) || 0) + 1);
    });
  });
  const topSkills = [...skillCounts.entries()]
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const maxSkillCount = topSkills[0]?.count || 1;
  const candidateSkills = topSkills.map((entry) => ({
    ...entry,
    percentage: Math.round((entry.count / maxSkillCount) * 100),
  }));

  const interviewTrend = buildSeriesRows(buckets, ['scheduled', 'completed']);
  interviews.forEach((interview) => {
    incrementBucket(interviewTrend, buckets, interview.scheduledAt, 'scheduled');
    if (['COMPLETED', 'FEEDBACK_SUBMITTED'].includes(String(interview.status || '').toUpperCase())) {
      incrementBucket(interviewTrend, buckets, interview.scheduledAt, 'completed');
    }
  });

  const pendingFeedbackMap = new Map();
  interviews.forEach((interview) => {
    if (String(interview.status || '').toUpperCase() !== 'FEEDBACK_PENDING') return;
    const key = interview.interviewerId || interview.createdById;
    if (!key) return;
    pendingFeedbackMap.set(key, (pendingFeedbackMap.get(key) || 0) + 1);
  });
  const feedbackPending = [...pendingFeedbackMap.entries()]
    .map(([userId, pending]) => ({ userId, name: recruiterMap.get(userId) || 'Unknown', pending }))
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 8);

  const totalRevenue = placements.reduce((sum, placement) => sum + Number(placement.revenue || 0), 0);
  const totalPlacements = placements.filter((placement) => !['CANCELLED', 'FAILED', 'DROPPED', 'WITHDRAWN'].includes(String(placement.status || '').toUpperCase())).length;
  const avgBilling = billingRecords.length
    ? billingRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0) / billingRecords.length
    : 0;
  const placementRevenueTrend = buildSeriesRows(buckets, ['revenue']);
  placements.forEach((placement) => addBucketValue(placementRevenueTrend, buckets, placement.createdAt || placement.joiningDate, 'revenue', placement.revenue || 0));

  const jobsHandledByRecruiter = new Map();
  jobs.forEach((job) => {
    [job.assignedToId, job.createdById].filter(Boolean).forEach((uid) => {
      jobsHandledByRecruiter.set(uid, (jobsHandledByRecruiter.get(uid) || 0) + 1);
    });
  });
  const submissionsByRecruiter = countBy(matches, (match) => match.createdById);
  const interviewsByRecruiter = new Map();
  interviews.forEach((interview) => {
    [interview.interviewerId, interview.createdById].filter(Boolean).forEach((uid) => {
      interviewsByRecruiter.set(uid, (interviewsByRecruiter.get(uid) || 0) + 1);
    });
  });
  const placementsByRecruiter = countBy(placements, (placement) => placement.recruiterId);

  const leaderboard = recruiters
    .map((recruiter) => ({
      id: recruiter.id,
      name: recruiter.name || recruiter.email || 'Unknown',
      jobs: jobsHandledByRecruiter.get(recruiter.id) || 0,
      submissions: submissionsByRecruiter.get(recruiter.id) || 0,
      interviews: interviewsByRecruiter.get(recruiter.id) || 0,
      placements: placementsByRecruiter.get(recruiter.id) || 0,
    }))
    .sort((a, b) => b.placements - a.placements || b.submissions - a.submissions || b.jobs - a.jobs)
    .map((row, index) => ({ ...row, rank: index + 1 }))
    .slice(0, 12);

  const activityTrend = buildSeriesRows(buckets, ['calls', 'emails', 'tasks']);
  let callsMade = 0;
  let emailsSent = 0;
  activities.forEach((activity) => {
    const kind = classifyActivityRecord(activity);
    if (!kind) return;
    if (kind === 'calls') callsMade += 1;
    if (kind === 'emails') emailsSent += 1;
    incrementBucket(activityTrend, buckets, activity.createdAt, kind);
  });
  tasks.forEach((task) => {
    incrementBucket(activityTrend, buckets, task.createdAt, 'tasks');
  });
  const tasksCompleted = tasks.filter((task) => String(task.status || '').toUpperCase() === 'DONE').length;
  const overdueTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    return due < new Date() && !['DONE', 'CANCELLED'].includes(String(task.status || '').toUpperCase());
  }).length;

  const openJobsCount = jobs.filter((job) => ['OPEN', 'DRAFT', 'ON_HOLD'].includes(String(job.status || '').toUpperCase())).length;
  const activeCandidatesCount = candidates.filter((candidate) => ['ACTIVE', 'NEW'].includes(String(candidate.status || '').toUpperCase())).length;
  const interviewCount = interviews.length;
  const offersReleased = placements.filter((placement) => placement.offerDate).length;
  const conversionPct = activeCandidatesCount > 0 ? ((totalPlacements / activeCandidatesCount) * 100).toFixed(1) : '0.0';

  return {
    filters: {
      dateRange: filters.dateRange,
      startDate: filters.startDate,
      endDate: filters.endDate,
      entities: [...filters.entities].join(','),
      clientId: filters.clientId,
      jobId: filters.jobId,
      recruiterId: filters.recruiterId,
      jobStatus: filters.jobStatus,
      jobType: filters.jobType,
      jobLocation: filters.jobLocation,
      jobDepartment: filters.jobDepartment,
      candidateStatus: filters.candidateStatus,
      candidateSource: filters.candidateSource,
      clientStatus: filters.clientStatus,
      clientIndustry: filters.clientIndustry,
      leadStatus: filters.leadStatus,
      leadSource: filters.leadSource,
      interviewStatus: filters.interviewStatus,
      placementStatus: filters.placementStatus,
    },
    options: filterOptions,
    recruitmentPerformance: {
      kpis: {
        totalOpenJobs: openJobsCount,
        activeCandidates: activeCandidatesCount,
        interviews: interviewCount,
        offersReleased,
        placements: totalPlacements,
        conversionPct: Number(conversionPct),
      },
      trend: recruitmentTrend,
    },
    pipelineFunnel: {
      funnel,
      stageDistribution: pipelineStageDistribution,
    },
    jobsClients: {
      jobs: jobsTable,
      topClients,
    },
    candidates: {
      sources: candidateSources,
      skills: candidateSkills,
    },
    interviews: {
      trend: interviewTrend,
      feedbackPending,
    },
    placementsRevenue: {
      kpis: {
        totalPlacements,
        totalRevenue,
        avgBilling,
      },
      trend: placementRevenueTrend,
    },
    teamPerformance: {
      leaderboard,
    },
    activityProductivity: {
      kpis: {
        callsMade,
        emailsSent,
        tasksCompleted,
        overdueTasks,
      },
      trend: activityTrend,
    },
    entityCounts: {
      leads: leads.length,
      clients: clients.length,
      jobs: jobs.length,
      candidates: candidates.length,
      placements: placements.length,
      interviews: interviews.length,
      team: recruiters.length,
      tasks: tasks.length,
      activities: activities.length,
      aiMatches: matches.length,
      aiAppliedMatches: applications.length,
    },
  };
}

function tabToDatasetRows(tabKey, summary) {
  switch (String(tabKey || '').toLowerCase()) {
    case 'recruitment-performance':
      return {
        title: 'Recruitment Performance',
        columns: ['Label', 'Open Jobs', 'Placements', 'Candidates', 'Interviews'],
        rows: (summary.recruitmentPerformance?.trend || []).map((row) => ({
          Label: row.label,
          'Open Jobs': row.openJobs,
          Placements: row.placements,
          Candidates: row.candidates,
          Interviews: row.interviews,
        })),
      };
    case 'pipeline-funnel':
      return {
        title: 'Pipeline & Funnel',
        columns: ['Stage', 'Count'],
        rows: (summary.pipelineFunnel?.funnel || []).map((row) => ({
          Stage: row.name,
          Count: row.value,
        })),
      };
    case 'jobs-clients':
      return {
        title: 'Jobs & Clients',
        columns: ['Title', 'Client', 'Status', 'Candidates', 'Aging'],
        rows: (summary.jobsClients?.jobs || []).map((row) => ({
          Title: row.title,
          Client: row.client,
          Status: row.status,
          Candidates: row.count,
          Aging: row.aging,
        })),
      };
    case 'candidates':
      return {
        title: 'Candidates',
        columns: ['Source', 'Count'],
        rows: (summary.candidates?.sources || []).map((row) => ({
          Source: row.name,
          Count: row.value,
        })),
      };
    case 'interviews':
      return {
        title: 'Interviews',
        columns: ['Label', 'Scheduled', 'Completed'],
        rows: (summary.interviews?.trend || []).map((row) => ({
          Label: row.label,
          Scheduled: row.scheduled,
          Completed: row.completed,
        })),
      };
    case 'placements-revenue':
      return {
        title: 'Placements & Revenue',
        columns: ['Label', 'Revenue'],
        rows: (summary.placementsRevenue?.trend || []).map((row) => ({
          Label: row.label,
          Revenue: row.revenue,
        })),
      };
    case 'team-performance':
      return {
        title: 'Team Performance',
        columns: ['Rank', 'Recruiter', 'Jobs Handled', 'Submissions', 'Interviews', 'Placements'],
        rows: (summary.teamPerformance?.leaderboard || []).map((row) => ({
          Rank: row.rank,
          Recruiter: row.name,
          'Jobs Handled': row.jobs,
          Submissions: row.submissions,
          Interviews: row.interviews,
          Placements: row.placements,
        })),
      };
    case 'activity-productivity':
      return {
        title: 'Activity & Productivity',
        columns: ['Label', 'Calls', 'Emails', 'Tasks'],
        rows: (summary.activityProductivity?.trend || []).map((row) => ({
          Label: row.label,
          Calls: row.calls,
          Emails: row.emails,
          Tasks: row.tasks,
        })),
      };
    default:
      return {
        title: 'Report',
        columns: [],
        rows: [],
      };
  }
}

function buildFileFromDataset(dataset, entity, format) {
  const normalizedEntity = normalizeEntity(entity);
  const normalizedFormat = normalizeFormat(format);

  if (!Array.isArray(dataset.rows) || dataset.rows.length === 0) {
    return {
      ok: false,
      error: 'No data available for this report',
      entity: normalizedEntity,
      format: normalizedFormat,
    };
  }

  ensureExportDir();
  const fileBase = `${fileSlug(normalizedEntity)}-${normalizedFormat}-${Date.now()}`;

  if (normalizedFormat === 'excel') {
    const worksheet = XLSX.utils.json_to_sheet(dataset.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    const filePath = path.join(EXPORT_DIR, `${fileBase}.xlsx`);
    XLSX.writeFile(workbook, filePath);
    return {
      ok: true,
      entity: normalizedEntity,
      format: normalizedFormat,
      fileName: `${fileBase}.xlsx`,
      filePath,
      fileUrl: toPublicUploadUrl(filePath),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: dataset.title,
      summary: `Total records: ${dataset.rows.length}`,
      columns: dataset.columns,
      rowCount: dataset.rows.length,
    };
  }

  if (normalizedFormat === 'csv') {
    const headers = Object.keys(dataset.rows[0] || {});
    const csv = [
      headers.join(','),
      ...dataset.rows.map((row) =>
        headers.map((header) => `"${String(row?.[header] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    const filePath = path.join(EXPORT_DIR, `${fileBase}.csv`);
    fs.writeFileSync(filePath, csv, 'utf8');
    return {
      ok: true,
      entity: normalizedEntity,
      format: normalizedFormat,
      fileName: `${fileBase}.csv`,
      filePath,
      fileUrl: toPublicUploadUrl(filePath),
      contentType: 'text/csv',
      title: dataset.title,
      summary: `Total records: ${dataset.rows.length}`,
      columns: dataset.columns,
      rowCount: dataset.rows.length,
    };
  }

  if (normalizedFormat === 'pdf') {
    const buffer = createTablePdfBuffer(
      dataset.title,
      dataset.columns.length ? dataset.columns : Object.keys(dataset.rows[0] || {}),
      dataset.rows.slice(0, 100),
      `Summary: Total records ${dataset.rows.length}`
    );
    const filePath = path.join(EXPORT_DIR, `${fileBase}.pdf`);
    fs.writeFileSync(filePath, buffer);
    return {
      ok: true,
      entity: normalizedEntity,
      format: normalizedFormat,
      fileName: `${fileBase}.pdf`,
      filePath,
      fileUrl: toPublicUploadUrl(filePath),
      contentType: 'application/pdf',
      title: dataset.title,
      summary: `Total records: ${dataset.rows.length}`,
      columns: dataset.columns,
      rowCount: dataset.rows.length,
    };
  }

  return {
    ok: false,
    error: 'File generation service is not configured yet',
    entity: normalizedEntity,
    format: normalizedFormat,
  };
}

async function buildWhereForEntity(entity, query, user) {
  const filters = parseSummaryFilters(query);
  const assignedToId = await resolveUserId(query.assignedTo || query.assignedToId || query.owner || filters.recruiterId);
  const createdAt = dateBetween('createdAt', filters);
  const scheduledAt = dateBetween('scheduledAt', filters);
  const search = String(query.search || '').trim();
  const location = String(query.location || '').trim() || filters.jobLocation;
  const status = String(query.status || '').trim();

  switch (entity) {
    case 'leads': {
      const where = userHasFullDbAccess(user) ? {} : { assignedToId: user?.id || '__none__' };
      if (assignedToId) where.assignedToId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status || filters.leadStatus) where.status = status || filters.leadStatus;
      if (filters.leadSource) where.source = filters.leadSource;
      if (filters.clientId) where.convertedToClientId = filters.clientId;
      if (search || location) {
        where.OR = [
          ...buildTextSearchConditions(
            ['companyName', 'contactPerson', 'email', 'website', 'linkedIn', 'directorName'],
            search,
            ['companyLinks']
          ),
          ...buildTextSearchConditions(['location', 'city', 'country'], location),
        ].filter(Boolean);
      }
      return where;
    }
    case 'clients': {
      const where = userHasFullDbAccess(user) ? {} : { assignedToId: user?.id || '__none__' };
      if (assignedToId) where.assignedToId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status || filters.clientStatus) where.status = status || filters.clientStatus;
      if (filters.clientIndustry) where.industry = { equals: filters.clientIndustry, mode: 'insensitive' };
      if (filters.clientId) where.id = filters.clientId;
      if (search || location) {
        where.OR = [
          ...buildTextSearchConditions(['companyName', 'industry', 'website', 'linkedin', 'hiringLocations'], search),
          ...buildTextSearchConditions(['location'], location),
        ].filter(Boolean);
      }
      return where;
    }
    case 'candidates': {
      const where = userHasFullDbAccess(user)
        ? { isDeleted: { not: true }, NOT: { source: 'phase1' } }
        : {
            isDeleted: { not: true },
            NOT: { source: 'phase1' },
            OR: [{ assignedToId: user?.id || '__none__' }, { createdById: user?.id || '__none__' }],
          };
      if (assignedToId) where.assignedToId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status || filters.candidateStatus) where.status = status || filters.candidateStatus;
      if (filters.candidateSource) where.source = { equals: filters.candidateSource, mode: 'insensitive' };
      Object.assign(where, candidateJobScopeFilter(filters));
      if (search || location) {
        where.OR = [
          ...(Array.isArray(where.OR) ? where.OR : []),
          ...buildTextSearchConditions(['firstName', 'lastName', 'email', 'currentTitle', 'currentCompany'], search),
          ...buildTextSearchConditions(['location', 'city', 'country'], location),
        ].filter(Boolean);
      }
      return where;
    }
    case 'jobs': {
      const where = userHasFullDbAccess(user)
        ? {}
        : { OR: [{ assignedToId: user?.id || '__none__' }, { createdById: user?.id || '__none__' }] };
      if (assignedToId) where.assignedToId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status || filters.jobStatus) where.status = status || filters.jobStatus;
      if (filters.jobType) where.type = filters.jobType;
      if (filters.jobDepartment) where.department = { equals: filters.jobDepartment, mode: 'insensitive' };
      if (filters.clientId) where.clientId = filters.clientId;
      if (filters.jobId) where.id = filters.jobId;
      if (search || location) {
        where.OR = [
          ...(Array.isArray(where.OR) ? where.OR : []),
          ...buildTextSearchConditions(['title', 'department', 'overview', 'hiringManager'], search),
          ...buildTextSearchConditions(['location'], location),
        ].filter(Boolean);
      }
      return where;
    }
    case 'tasks': {
      const where = userHasFullDbAccess(user)
        ? {}
        : { OR: [{ assignedToId: user?.id || '__none__' }, { createdById: user?.id || '__none__' }] };
      if (assignedToId) where.assignedToId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          ...(Array.isArray(where.OR) ? where.OR : []),
          { title: searchContains(search) },
          { description: searchContains(search) },
        ];
      }
      return where;
    }
    case 'placements': {
      const where = userHasFullDbAccess(user)
        ? { deletedAt: null }
        : {
            deletedAt: null,
            OR: [
              { recruiterId: user?.id || '__none__' },
              { job: { OR: [{ createdById: user?.id || '__none__' }, { assignedToId: user?.id || '__none__' }] } },
            ],
          };
      if (assignedToId) where.recruiterId = assignedToId;
      if (createdAt) where.createdAt = createdAt;
      if (status || filters.placementStatus) where.status = (status || filters.placementStatus).toUpperCase();
      if (filters.clientId) where.clientId = filters.clientId;
      if (filters.jobId) where.jobId = filters.jobId;
      Object.assign(where, relatedJobWhere(filters));
      return where;
    }
    case 'interviews': {
      const where = userHasFullDbAccess(user)
        ? {}
        : { OR: [{ createdById: user?.id || '__none__' }, { interviewerId: user?.id || '__none__' }] };
      if (assignedToId) where.interviewerId = assignedToId;
      if (scheduledAt) where.scheduledAt = scheduledAt;
      if (status || filters.interviewStatus) where.status = (status || filters.interviewStatus).toUpperCase();
      if (filters.clientId) where.clientId = filters.clientId;
      if (filters.jobId) where.jobId = filters.jobId;
      Object.assign(where, relatedJobWhere(filters));
      if (search || location) {
        where.OR = [
          ...(Array.isArray(where.OR) ? where.OR : []),
          search ? { round: searchContains(search) } : null,
          search ? { notes: searchContains(search) } : null,
          location ? { location: searchContains(location) } : null,
        ].filter(Boolean);
      }
      return where;
    }
    case 'pipeline': {
      const where = {};
      if (createdAt) where.createdAt = createdAt;
      Object.assign(where, pipelineEntryJobFilter(filters));
      if (search) {
        where.OR = [
          { notes: searchContains(search) },
          { stage: { name: searchContains(search) } },
          { candidate: { firstName: searchContains(search) } },
          { candidate: { lastName: searchContains(search) } },
        ];
      }
      return where;
    }
    case 'team': {
      const where = { isActive: true };
      if (search || location) {
        where.OR = [
          search ? { name: searchContains(search) } : null,
          search ? { email: searchContains(search) } : null,
          search ? { department: searchContains(search) } : null,
          location ? { location: searchContains(location) } : null,
        ].filter(Boolean);
      }
      return where;
    }
    case 'activities': {
      const where = userHasFullDbAccess(user) ? {} : { performedById: user?.id || '__none__' };
      if (createdAt) where.createdAt = createdAt;
      if (filters.recruiterId) where.performedById = filters.recruiterId;
      if (filters.clientId) {
        where.OR = [
          { clientId: filters.clientId },
          { entityId: filters.clientId },
          { relatedId: filters.clientId },
        ];
      }
      if (filters.jobId) {
        where.OR = [...(where.OR || []), { entityId: filters.jobId }, { relatedId: filters.jobId }];
      }
      if (search) {
        where.OR = [
          ...(Array.isArray(where.OR) ? where.OR : []),
          { action: searchContains(search) },
          { description: searchContains(search) },
          { category: searchContains(search) },
        ];
      }
      return where;
    }
    case 'ai_matches': {
      const where = {};
      if (createdAt) where.createdAt = createdAt;
      if (filters.jobId) where.jobId = filters.jobId;
      if (filters.recruiterId) where.createdById = filters.recruiterId;
      Object.assign(where, relatedJobWhere(filters));
      return where;
    }
    case 'ai_applied_matches': {
      const where = {};
      if (createdAt) where.appliedAt = createdAt;
      if (filters.jobId) where.jobId = filters.jobId;
      Object.assign(where, relatedJobWhere(filters));
      if (status) where.status = status.toUpperCase();
      return where;
    }
    default:
      throw new Error(`Unsupported export entity: ${entity}`);
  }
}

async function buildJobPipelineCounts(jobIds) {
  const map = new Map();
  if (!Array.isArray(jobIds) || !jobIds.length) return map;

  const entries = await prisma.pipelineEntry.findMany({
    where: { jobId: { in: jobIds } },
    select: {
      jobId: true,
      candidateId: true,
      stage: { select: { name: true, systemRole: true } },
    },
  });

  const seenByJobBucket = new Map();

  for (const entry of entries) {
    if (!entry.jobId || !entry.candidateId) continue;
    const stageText = String(entry.stage?.systemRole || entry.stage?.name || '').toLowerCase();
    let bucket = 'applied';
    if (stageText.includes('interview')) bucket = 'interviewed';
    else if (stageText.includes('offer')) bucket = 'offered';
    else if (stageText.includes('join') || stageText.includes('hire') || stageText.includes('placed')) {
      bucket = 'joined';
    }

    const dedupeKey = `${entry.jobId}:${entry.candidateId}:${bucket}`;
    if (seenByJobBucket.has(dedupeKey)) continue;
    seenByJobBucket.set(dedupeKey, true);

    if (!map.has(entry.jobId)) {
      map.set(entry.jobId, { applied: 0, interviewed: 0, offered: 0, joined: 0 });
    }
    map.get(entry.jobId)[bucket] += 1;
  }

  return map;
}

async function buildModuleTabExportDataset(tabKey, query, user) {
  const key = String(tabKey || '').toLowerCase();
  switch (key) {
    case 'jobs-clients':
    case 'jobs-clients-jobs':
      return fetchReportDataset('jobs', query, user);
    case 'jobs-clients-clients':
      return fetchReportDataset('clients', query, user);
    case 'candidates':
      return fetchReportDataset('candidates', query, user);
    case 'interviews':
      return fetchReportDataset('interviews', query, user);
    case 'placements-revenue':
      return fetchReportDataset('placements', query, user);
    default: {
      const summary = await getReportsSummary(query, user);
      return tabToDatasetRows(key, summary);
    }
  }
}

export async function fetchTabDetail(tabKey, query = {}, user = null) {
  const key = String(tabKey || '').toLowerCase();
  if (key === 'jobs-clients') {
    const [jobs, clients] = await Promise.all([
      fetchReportDataset('jobs', query, user),
      fetchReportDataset('clients', query, user),
    ]);
    return {
      tab: key,
      jobs: { ...jobs, totalRows: jobs.rows?.length || 0, rows: (jobs.rows || []).slice(0, 50) },
      clients: {
        ...clients,
        totalRows: clients.rows?.length || 0,
        rows: (clients.rows || []).slice(0, 50),
      },
    };
  }
  if (key === 'candidates') {
    const candidates = await fetchReportDataset('candidates', query, user);
    return {
      tab: key,
      candidates: {
        ...candidates,
        totalRows: candidates.rows?.length || 0,
        rows: (candidates.rows || []).slice(0, 50),
      },
    };
  }
  if (key === 'interviews') {
    const interviews = await fetchReportDataset('interviews', query, user);
    return {
      tab: key,
      interviews: {
        ...interviews,
        totalRows: interviews.rows?.length || 0,
        rows: (interviews.rows || []).slice(0, 50),
      },
    };
  }
  if (key === 'placements-revenue') {
    const placements = await fetchReportDataset('placements', query, user);
    return {
      tab: key,
      placements: {
        ...placements,
        totalRows: placements.rows?.length || 0,
        rows: (placements.rows || []).slice(0, 50),
      },
    };
  }
  return { tab: key };
}

export async function fetchReportDataset(entity, query = {}, user = null) {
  const normalizedEntity = normalizeEntity(entity);
  const where = await buildWhereForEntity(normalizedEntity, query, user);

  switch (normalizedEntity) {
    case 'leads': {
      const rows = await prisma.lead.findMany({
        where,
        include: {
          assignedTo: { select: { name: true, email: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Leads Report',
        columns: ['Name', 'Email', 'Phone', 'Location', 'Status', 'Assigned To', 'Created Date'],
        rows: rows.map((lead) => ({
          Name: lead.contactPerson || lead.companyName || '',
          Email: lead.email || '',
          Phone: lead.phone || '',
          Location: lead.location || lead.city || '',
          Status: lead.status || '',
          'Assigned To': lead.assignedTo?.name || '',
          'Created Date': formatDate(lead.createdAt),
          'Updated Date': formatDate(lead.updatedAt),
          'Company Name': lead.companyName || '',
          'Contact Person': lead.contactPerson || '',
          'Director Name': lead.directorName || '',
          Source: lead.source || '',
          Priority: lead.priority || '',
          Type: lead.type || '',
          Industry: lead.industry || '',
          Sector: lead.sector || '',
          'Company Size': lead.companySize || '',
          'Team Name': lead.teamName || '',
          Website: lead.website || '',
          'Company Links': formatArray(lead.companyLinks),
          LinkedIn: lead.linkedIn || '',
          Designation: lead.designation || '',
          Country: lead.country || '',
          City: lead.city || '',
          'Interested Needs': lead.interestedNeeds || '',
          'Services Needed': lead.servicesNeeded || '',
          Notes: lead.notes || '',
          'Expected Business Value': lead.expectedBusinessValue || '',
          'Campaign Name': lead.campaignName || '',
          'Campaign Link': lead.campaignLink || '',
          'Referral Name': lead.referralName || '',
          'Source Website URL': lead.sourceWebsiteUrl || '',
          'Source LinkedIn URL': lead.sourceLinkedInUrl || '',
          'Source Email': lead.sourceEmail || '',
          'Other Details': formatJson(lead.otherDetails),
          'Last Follow Up': formatDate(lead.lastFollowUp),
          'Next Follow Up': formatDate(lead.nextFollowUp),
          'Lost Reason': lead.lostReason || '',
          'Converted To Client Id': lead.convertedToClientId || '',
          'Converted To Candidate Id': lead.convertedToCandidateId || '',
          'Converted At': formatDate(lead.convertedAt),
        })),
      };
    }
    case 'clients': {
      const rows = await prisma.client.findMany({
        where,
        include: {
          assignedTo: { select: { name: true, email: true } },
          contacts: {
            select: { firstName: true, lastName: true, email: true, phone: true, designation: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
      const dataset = buildClientsModuleExport(rows);
      return { entity: normalizedEntity, ...dataset };
    }
    case 'candidates': {
      const rows = await prisma.candidate.findMany({
        where,
        include: {
          assignedTo: { select: { name: true, email: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5000,
      });
      const dataset = buildCandidatesModuleExport(rows);
      return { entity: normalizedEntity, ...dataset };
    }
    case 'jobs': {
      const rows = await prisma.job.findMany({
        where,
        include: {
          client: { select: { companyName: true } },
          assignedTo: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5000,
      });
      const jobIds = rows.map((job) => job.id).filter(Boolean);
      const pipelineCountsByJob = await buildJobPipelineCounts(jobIds);
      const dataset = buildJobsModuleExport(rows, pipelineCountsByJob);
      return { entity: normalizedEntity, ...dataset };
    }
    case 'tasks': {
      const rows = await prisma.task.findMany({
        where,
        include: {
          assignedTo: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Tasks Report',
        columns: ['Title', 'Status', 'Priority', 'Assigned To', 'Due Date'],
        rows: rows.map((task) => ({
          Title: task.title || '',
          Status: task.status || '',
          Priority: task.priority || '',
          'Assigned To': task.assignedTo?.name || '',
          'Due Date': formatDate(task.dueDate),
          Type: task.taskType || '',
          Description: task.description || '',
          'Created By': task.createdBy?.name || '',
          'Due Time': task.dueTime || '',
          'Linked Entity Type': task.linkedEntityType || '',
          'Linked Entity Id': task.linkedEntityId || '',
          Reminder: task.reminder || '',
          'Reminder Channel': task.reminderChannel || '',
          Attachments: formatArray(task.attachments),
          'Notify Assignee': task.notifyAssignee ? 'Yes' : 'No',
          Notes: formatArray(task.notes),
          'Created Date': formatDate(task.createdAt),
          'Updated Date': formatDate(task.updatedAt),
        })),
      };
    }
    case 'placements': {
      const rows = await prisma.placement.findMany({
        where,
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true } },
          client: { select: { companyName: true } },
          job: { select: { title: true } },
          recruiter: { select: { name: true } },
          billing: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { paymentStatus: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5000,
      });
      const dataset = buildPlacementsModuleExport(rows);
      return { entity: normalizedEntity, ...dataset };
    }
    case 'interviews': {
      const rows = await prisma.interview.findMany({
        where,
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true } },
          job: { select: { title: true, client: { select: { companyName: true } } } },
          client: { select: { companyName: true } },
          interviewer: { select: { name: true } },
          createdBy: { select: { name: true } },
          panel: { include: { user: { select: { name: true } } } },
          feedbackEntries: { select: { id: true, status: true }, take: 1 },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 5000,
      });
      const enriched = rows.map((interview) => ({
        ...interview,
        panelMembers: (interview.panel || []).map((p) => p.user).filter(Boolean),
        feedbackStatus:
          interview.feedbackEntries?.length > 0
            ? interview.feedbackEntries[0]?.status || 'SUBMITTED'
            : String(interview.status || '').toUpperCase() === 'FEEDBACK_PENDING'
              ? 'PENDING'
              : '',
      }));
      const dataset = buildInterviewsModuleExport(enriched);
      return { entity: normalizedEntity, ...dataset };
    }
    case 'pipeline': {
      const rows = await prisma.pipelineEntry.findMany({
        where,
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true } },
          stage: {
            select: {
              name: true,
              job: {
                select: {
                  title: true,
                  location: true,
                  status: true,
                },
              },
            },
          },
          movedBy: { select: { name: true } },
        },
        orderBy: { movedAt: 'desc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Pipeline Report',
        columns: ['Candidate', 'Stage', 'Moved By', 'Moved At'],
        rows: rows.map((entry) => ({
          Candidate: `${entry.candidate?.firstName || ''} ${entry.candidate?.lastName || ''}`.trim(),
          Stage: entry.stage?.name || '',
          'Moved By': entry.movedBy?.name || '',
          'Moved At': formatDateTime(entry.movedAt),
          Email: entry.candidate?.email || '',
          Job: entry.stage?.job?.title || '',
          'Job Status': entry.stage?.job?.status || '',
          'Job Location': entry.stage?.job?.location || '',
          Notes: entry.notes || '',
          'Created Date': formatDate(entry.createdAt),
          'Updated Date': formatDate(entry.updatedAt),
        })),
      };
    }
    case 'team': {
      const rows = await prisma.user.findMany({
        where,
        include: {
          _count: {
            select: { assignedLeads: true, assignedClientsRel: true, assignedTasks: true, assignedJobsRel: true },
          },
        },
        orderBy: { name: 'asc' },
      });
      return {
        entity: normalizedEntity,
        title: 'Team Performance Report',
        columns: ['Name', 'Email', 'Role', 'Assigned Leads', 'Assigned Clients', 'Assigned Tasks', 'Assigned Jobs'],
        rows: rows.map((member) => ({
          Name: member.name || '',
          Email: member.email || '',
          Role: member.role || '',
          Department: member.department || '',
          Designation: member.designation || '',
          'Assigned Leads': member._count?.assignedLeads || 0,
          'Assigned Clients': member._count?.assignedClientsRel || 0,
          'Assigned Tasks': member._count?.assignedTasks || 0,
          'Assigned Jobs': member._count?.assignedJobsRel || 0,
        })),
      };
    }
    case 'activities': {
      const rows = await prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      return {
        entity: normalizedEntity,
        title: 'Activity Report',
        columns: ['Action', 'Category', 'Description', 'Created At'],
        rows: rows.map((row) => ({
          Action: row.action || '',
          Category: row.category || '',
          Description: row.description || '',
          'Created At': formatDateTime(row.createdAt),
        })),
      };
    }
    case 'ai_matches': {
      const rows = await prisma.match.findMany({
        where,
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true } },
          job: { select: { title: true, status: true } },
          createdBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      return {
        entity: normalizedEntity,
        title: 'AI Matches Report',
        columns: ['Candidate', 'Job', 'Score', 'Status', 'Created At'],
        rows: rows.map((row) => ({
          Candidate: `${row.candidate?.firstName || ''} ${row.candidate?.lastName || ''}`.trim(),
          Job: row.job?.title || '',
          Score: row.score ?? '',
          Status: row.status || '',
          'Created At': formatDateTime(row.createdAt),
          Email: row.candidate?.email || '',
          'Job Status': row.job?.status || '',
          'Created By': row.createdBy?.name || row.createdBy?.email || '',
        })),
      };
    }
    case 'ai_applied_matches': {
      const rows = await prisma.application.findMany({
        where,
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true } },
          job: { select: { title: true, status: true, client: { select: { companyName: true } } } },
        },
        orderBy: { appliedAt: 'desc' },
        take: 500,
      });
      return {
        entity: normalizedEntity,
        title: 'AI Applied Matches Report',
        columns: ['Candidate', 'Job', 'Client', 'Status', 'Match Score', 'Applied At'],
        rows: rows.map((row) => ({
          Candidate: `${row.candidate?.firstName || ''} ${row.candidate?.lastName || ''}`.trim(),
          Job: row.job?.title || '',
          Client: row.job?.client?.companyName || '',
          Status: row.status || '',
          'Match Score': row.matchScore ?? '',
          'Applied At': formatDateTime(row.appliedAt),
          Email: row.candidate?.email || '',
        })),
      };
    }
    default:
      throw new Error(`Unsupported export entity: ${normalizedEntity}`);
  }
}

export async function buildReportFile(entity, format, query = {}, user = null) {
  const normalizedEntity = normalizeEntity(entity);
  const dataset = await fetchReportDataset(normalizedEntity, query, user);
  return buildFileFromDataset(dataset, normalizedEntity, format);
}

export const reportService = {
  async getFilterOptions(user) {
    return buildReportFilterOptions(user);
  },

  async getSummary(query, user) {
    return getReportsSummary(query, user);
  },

  async getDataset(entity, query, user) {
    const dataset = await fetchReportDataset(entity, query, user);
    const selectedColumns = String(query?.columns || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!selectedColumns.length) return dataset;

    const columnSet = new Set(selectedColumns);
    return {
      ...dataset,
      columns: dataset.columns.filter((column) => columnSet.has(column)),
      rows: dataset.rows.map((row) =>
        Object.fromEntries(Object.entries(row).filter(([key]) => columnSet.has(key)))
      ),
    };
  },

  async getTabDetail(tab, query, user) {
    return fetchTabDetail(tab, query, user);
  },

  async exportSummaryTab(tab, format, query, user) {
    const dataset = await buildModuleTabExportDataset(tab, query, user);
    return buildFileFromDataset(dataset, `summary-${tab}`, format);
  },

  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { type, generatedById } = req.query;

    const where = {};
    if (type) where.type = type;
    if (generatedById) where.generatedById = generatedById;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        include: {
          generatedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.report.count({ where }),
    ]);

    return formatPaginationResponse(reports, page, limit, total);
  },

  async getById(id) {
    return prisma.report.findUnique({
      where: { id },
      include: {
        generatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async create(data) {
    return prisma.report.create({
      data: {
        name: data.name,
        type: data.type,
        filters: data.filters,
        generatedById: data.generatedById,
        result: data.result,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
    });
  },

  async update(id, data) {
    return prisma.report.update({
      where: { id },
      data: {
        name: data.name,
        filters: data.filters,
        result: data.result,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
    });
  },

  async delete(id) {
    await prisma.report.delete({ where: { id } });
    return { message: 'Report deleted successfully' };
  },

  async exportEntity(entity, format, query, user) {
    return buildReportFile(entity, format, query, user);
  },
};
