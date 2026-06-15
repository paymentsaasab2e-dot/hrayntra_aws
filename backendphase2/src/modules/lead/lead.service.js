import { prisma } from '../../config/prisma.js';
import { formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import { sendLeadFollowUpEmail } from '../../emails/email.service.js';
import activityService from '../../services/activityService.js';
import { sendLeadAssignmentEmail } from '../../services/emailService.js';
import { createAlertNotification } from '../setting/alert-dispatch.service.js';
import {
  notifyLeadConvertedToClient,
  notifyLeadMarkedLost,
  notifyLeadStatusChanged,
  personName,
} from '../setting/alert-notify.helpers.js';
import { canViewAllLeads } from '../../utils/permissionScope.js';
import { applyMemberLeadScope, buildLeadAccessWhere } from '../../services/leadMemberScope.service.js';
import { stampLeadAssigneeVisibility } from '../../services/memberVisibility.service.js';
import { normalizeContactChannels } from '../../utils/contact-channels.js';
import {
  filterMeaningfulImportColumns,
  slimImportRows,
} from '../../utils/importSpreadsheet.js';
import {
  applyAgreementTermsUpdateFields,
  buildAgreementTermsCreateFields,
} from '../../utils/agreementTermsFields.js';
import { prepareListWithAuditMeta, attachAuditMetaToEntity } from '../../utils/listAuditMeta.js';
import { ENTITY_TYPES } from '../../services/activityService.js';
import { appendEntityActivityVisibilityToWhere } from '../../services/activityVisibility.service.js';
import {
  mergeDirectorIntoOtherDetails,
  resolveDirectorNameFromLeadContext,
  resolveDirectorSalutationFromLeadContext,
} from '../../utils/directorOtherDetails.js';
import { assertCanAssignCrm } from '../../services/crmAssignmentScope.service.js';
import { escapePrismaRegex } from '../../utils/escapePrismaRegex.js';

function isValidObjectId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value.trim());
}

/** String fields searched by the Leads table search bar and smart-search prompt. */
const LEAD_DB_TEXT_SEARCH_FIELDS = [
  'companyName',
  'contactPerson',
  'directorName',
  'directorSalutation',
  'email',
  'phone',
  'interestedNeeds',
  'servicesNeeded',
  'notes',
  'expectedBusinessValue',
  'industry',
  'sector',
  'companySize',
  'teamName',
  'website',
  'linkedIn',
  'location',
  'city',
  'state',
  'country',
  'designation',
  'teamMemberDesignation',
  'teamMemberEmail',
  'teamMemberPhone',
  'campaignName',
  'campaignLink',
  'referralName',
  'sourceWebsiteUrl',
  'sourceLinkedInUrl',
  'sourceEmail',
  'status',
];

const LEAD_SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'with', 'from', 'in', 'on', 'at', 'to', 'for', 'of',
  'me', 'my', 'all', 'any', 'show', 'find', 'search', 'filter', 'get', 'list', 'lead', 'leads',
]);

/**
 * Build a Prisma where fragment for free-text lead search.
 * Each whitespace-separated term must match at least one field (AND across terms).
 */
function buildLeadDatabaseSearchFilter(search) {
  const trimmed = String(search || '').trim();
  if (!trimmed) return null;

  const terms = trimmed
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !LEAD_SEARCH_STOP_WORDS.has(term.toLowerCase()));

  const effectiveTerms = terms.length > 0 ? terms : [trimmed];

  const termClauses = effectiveTerms.map((term) => ({
    OR: LEAD_DB_TEXT_SEARCH_FIELDS.map((field) => ({
      [field]: { contains: escapePrismaRegex(term), mode: 'insensitive' },
    })),
  }));

  return termClauses.length === 1 ? termClauses[0] : { AND: termClauses };
}

function normalizeOtherDetails(value) {
  if (!Array.isArray(value)) return null;

  const normalized = value
    .map((item) => ({
      label: String(item?.label || '').trim(),
      value: String(item?.value || '').trim(),
    }))
    .filter((item) => item.label && item.value);

  return normalized.length ? normalized : null;
}

/** Strip NBSP (Excel) and trim — used for import + URL checks. */
function stripNbsp(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\u00a0/g, ' ');
}

const IMPORT_WEB_TLD_RE = /\.(com|net|org|io|co|cm|uk|eu|fr|de|au|ca|in|biz|info|app|dev)(\/|$|\?|#|:)/i;
const IMPORT_WEB_TLD_END_RE = /\.(com|net|org|io|co|cm|uk|eu|fr|de|au|ca|in|biz|info|app|dev)$/i;

/** True if the string looks like a real web address (not a plain company name). */
function isLikelyWebAddress(raw) {
  const s = stripNbsp(raw).trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (/^www\./i.test(s)) return true;
  if (IMPORT_WEB_TLD_RE.test(s) || IMPORT_WEB_TLD_END_RE.test(s)) return true;
  return false;
}

function normalizeImportColumnHeader(value = '') {
  return stripNbsp(value)
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

const EBV_IMPORT_HEADERS = new Set(['expected business value', 'expected value', 'business value']);
const CAMPAIGN_IMPORT_HEADERS = new Set(['campaign', 'campaign name']);

const LEAD_IMPORT_DUPLICATE_COMPARE_FIELDS = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'contactPerson', label: 'Contact Person' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'designation', label: 'Designation' },
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'industry', label: 'Industry' },
  { key: 'location', label: 'Location' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'notes', label: 'Notes' },
];

function normalizeImportPriority(value) {
  const n = stripNbsp(value).trim().toLowerCase();
  if (!n) return 'Low';
  if (n === 'cold' || n === 'low') return 'Low';
  if (n === 'warm' || n === 'medium' || n === 'med' || n === 'moderate') return 'Medium';
  if (n === 'hot' || n === 'high') return 'High';
  return 'Low';
}

function normalizeImportStatus(value) {
  const normalized = stripNbsp(value).trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'new' || normalized.includes('proposed')) return 'New';
  if (normalized === 'contacted' || normalized === 'in touch') return 'Contacted';
  if (normalized === 'qualified') return 'Qualified';
  if (normalized === 'converted') return 'Converted';
  if (normalized === 'lost') return 'Lost';
  return undefined;
}

function normalizeImportType(value) {
  const normalized = stripNbsp(value).trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'company') return 'Company';
  if (normalized === 'individual') return 'Individual';
  if (normalized === 'referral') return 'Referral';
  return undefined;
}

function normalizeImportSource(value) {
  const normalized = stripNbsp(value).trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'website') return 'Website';
  if (normalized === 'linkedin') return 'LinkedIn';
  if (normalized === 'email') return 'Email';
  if (normalized === 'referral') return 'Referral';
  if (normalized === 'campaign') return 'Campaign';
  return undefined;
}

function parseImportDateValue(value) {
  if (value === undefined || value === null) return undefined;
  const s = stripNbsp(String(value)).trim();
  if (!s) return undefined;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function equalsNormalizedText(left, right) {
  return stripNbsp(left).trim().toLowerCase() === stripNbsp(right).trim().toLowerCase();
}

function normalizeCompanyMatchKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(private|limited|ltd|inc|llc|corp|corporation|solutions|technologies|technology|services|group|company|co)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function makeLeadConversionError(message, code, meta = {}) {
  const err = new Error(message);
  err.statusCode = 409;
  err.code = code;
  err.meta = meta;
  return err;
}

async function findDuplicateClientByCompanyName(companyName, { excludeClientId } = {}) {
  const raw = String(companyName || '').trim();
  if (!raw) return null;

  const baseWhere = {
    isDeleted: { not: true },
    ...(excludeClientId ? { id: { not: excludeClientId } } : {}),
  };

  const exact = await prisma.client.findFirst({
    where: {
      ...baseWhere,
      companyName: { equals: escapePrismaRegex(raw), mode: 'insensitive' },
    },
    select: { id: true, companyName: true },
  });
  if (exact) return exact;

  const compact = normalizeCompanyMatchKey(raw);
  if (!compact || compact.length < 3) return null;

  const firstWord = raw.split(/\s+/).find((part) => part.length >= 2);
  if (!firstWord) return null;

  const candidates = await prisma.client.findMany({
    where: {
      ...baseWhere,
      companyName: { contains: escapePrismaRegex(firstWord), mode: 'insensitive' },
    },
    select: { id: true, companyName: true },
    take: 50,
  });

  return candidates.find((client) => normalizeCompanyMatchKey(client.companyName) === compact) || null;
}

function buildLeadImportDuplicateChecks({ email, companyName, contactPerson, phone }) {
  const duplicateChecks = [];

  if (email) {
    duplicateChecks.push({ email: { equals: escapePrismaRegex(email), mode: 'insensitive' } });
  }

  if (phone) {
    duplicateChecks.push({ phone: { equals: escapePrismaRegex(phone), mode: 'insensitive' } });
  }

  if (companyName && contactPerson) {
    duplicateChecks.push({
      companyName: { equals: escapePrismaRegex(companyName), mode: 'insensitive' },
      contactPerson: { equals: escapePrismaRegex(contactPerson), mode: 'insensitive' },
    });
  } else if (companyName) {
    duplicateChecks.push({
      companyName: { equals: escapePrismaRegex(companyName), mode: 'insensitive' },
    });
  }

  return duplicateChecks;
}

function buildLeadImportComparisonSnapshot(source = {}) {
  const snapshot = {};
  for (const field of LEAD_IMPORT_DUPLICATE_COMPARE_FIELDS) {
    const raw = source?.[field.key];
    snapshot[field.key] = raw == null ? null : String(raw);
  }
  return snapshot;
}

function buildImportedDynamicOtherDetails(row = {}, mapping = {}) {
  const mappedColumns = new Set(
    Object.values(mapping || {})
      .map((column) => (typeof column === 'string' ? column.trim() : ''))
      .filter(Boolean)
  );

  return Object.entries(row || {})
    .map(([label, rawValue]) => ({
      label: stripNbsp(label).trim(),
      value: rawValue == null ? '' : stripNbsp(String(rawValue)).trim(),
    }))
    .filter((item) => item.label && item.value && !mappedColumns.has(item.label));
}

function mergeLeadImportOtherDetails(existingDetails, importedDetails) {
  const merged = new Map();

  for (const item of existingDetails || []) {
    const label = stripNbsp(item?.label || '').trim();
    const value = stripNbsp(item?.value || '').trim();
    if (!label || !value) continue;
    merged.set(label.toLowerCase(), { label, value });
  }

  for (const item of importedDetails || []) {
    const label = stripNbsp(item?.label || '').trim();
    const value = stripNbsp(item?.value || '').trim();
    if (!label || !value) continue;
    merged.set(label.toLowerCase(), { label, value });
  }

  return Array.from(merged.values());
}

function buildLeadImportUpdatePayload(payload) {
  const updatePayload = { performedById: payload?.performedById };
  for (const [key, value] of Object.entries(payload || {})) {
    if (key === 'performedByRole') continue;
    if (value == null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    updatePayload[key] = value;
  }
  return updatePayload;
}

function prefixDuplicateCopyCompanyName(companyName, fallback = '') {
  const base = stripNbsp(companyName || fallback).trim();
  if (!base) return 'Copy';
  if (/^copy\b/i.test(base)) return base;
  return `Copy ${base}`;
}

function buildLeadImportPayload(row = {}, mapping = {}, { performedById } = {}) {
  const cleanMapped = (crmFieldKey) => {
    const column = mapping[crmFieldKey];
    if (!column || typeof column !== 'string') return null;
    const raw = row[column];
    if (raw === undefined || raw === null) return null;
    const s = stripNbsp(String(raw)).trim();
    return s === '' ? null : s;
  };

  const mappedHeaderNorm = (crmFieldKey) => {
    const column = mapping[crmFieldKey];
    if (!column || typeof column !== 'string') return null;
    return normalizeImportColumnHeader(column);
  };

  const valueIfHeaderIn = (crmFieldKey, allowedHeaders) => {
    const h = mappedHeaderNorm(crmFieldKey);
    if (!h || !allowedHeaders.has(h)) return null;
    return cleanMapped(crmFieldKey);
  };

  const companyName = cleanMapped('companyName');
  const directorName = cleanMapped('directorName');
  const contactPerson = cleanMapped('contactPerson') || directorName || null;
  const emailRaw = cleanMapped('email');
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  const phone = cleanMapped('phone');

  const websiteRaw = cleanMapped('website');
  const website = websiteRaw && isLikelyWebAddress(websiteRaw) ? websiteRaw : null;

  const linkedInRaw = cleanMapped('linkedIn');
  const linkedIn =
    linkedInRaw && (isLikelyWebAddress(linkedInRaw) || linkedInRaw.toLowerCase().includes('linkedin.com'))
      ? linkedInRaw
      : null;

  const companyLinks = [website, linkedIn].filter(Boolean);
  const sectorVal = cleanMapped('industry');
  const servicesVal = cleanMapped('interestedNeeds');
  const expectedBusinessValue = valueIfHeaderIn('expectedBusinessValue', EBV_IMPORT_HEADERS);
  const campaignName = valueIfHeaderIn('campaignName', CAMPAIGN_IMPORT_HEADERS);
  const countryRaw = cleanMapped('country');
  const country = countryRaw || 'Cameroon';
  const importedDynamicOtherDetails = buildImportedDynamicOtherDetails(row, mapping);

  return {
    companyName,
    contactPerson,
    directorName: directorName || null,
    directorSalutation: cleanMapped('directorSalutation'),
    email,
    phone,
    type: normalizeImportType(cleanMapped('type')) || 'Company',
    source: normalizeImportSource(cleanMapped('source')) ?? null,
    status: normalizeImportStatus(cleanMapped('status')) || 'New',
    priority: normalizeImportPriority(cleanMapped('priority') || ''),
    interestedNeeds: servicesVal,
    servicesNeeded: servicesVal,
    notes: cleanMapped('notes'),
    expectedBusinessValue,
    industry: sectorVal,
    sector: sectorVal,
    companySize: cleanMapped('companySize'),
    teamName: cleanMapped('companySize'),
    website,
    linkedIn,
    companyLinks,
    location: cleanMapped('location'),
    designation: cleanMapped('designation'),
    city: cleanMapped('city'),
    country,
    state: cleanMapped('state'),
    latitude: (() => {
      const n = Number(cleanMapped('latitude'));
      return Number.isFinite(n) ? n : null;
    })(),
    longitude: (() => {
      const n = Number(cleanMapped('longitude'));
      return Number.isFinite(n) ? n : null;
    })(),
    campaignName,
    nextFollowUp: parseImportDateValue(cleanMapped('nextFollowUpDue')) || null,
    sourceWebsiteUrl: null,
    sourceLinkedInUrl: null,
    sourceEmail: null,
    referralName: null,
    otherDetails: importedDynamicOtherDetails,
    performedById,
  };
}

function summarizeLeadDuplicateMatch(existing, payload) {
  const matchedBy = [];
  if (payload?.email && existing?.email && equalsNormalizedText(payload.email, existing.email)) {
    matchedBy.push('Email');
  }
  if (
    payload?.companyName &&
    payload?.contactPerson &&
    existing?.companyName &&
    existing?.contactPerson &&
    equalsNormalizedText(payload.companyName, existing.companyName) &&
    equalsNormalizedText(payload.contactPerson, existing.contactPerson)
  ) {
    matchedBy.push('Company + Contact');
  }
  return matchedBy.length > 0 ? matchedBy : ['Duplicate lead'];
}

async function findExistingLeadImportDuplicate(payload) {
  const duplicateChecks = buildLeadImportDuplicateChecks(payload || {});
  if (!duplicateChecks.length) return null;

  const existing = await prisma.lead.findFirst({
    where: {
      isDeleted: { not: true },
      OR: duplicateChecks,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      companyName: true,
      contactPerson: true,
      email: true,
      phone: true,
      designation: true,
      source: true,
      status: true,
      priority: true,
      industry: true,
      location: true,
      city: true,
      country: true,
      notes: true,
      otherDetails: true,
      createdAt: true,
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!existing) return null;

  return {
    existing,
    matchedBy: summarizeLeadDuplicateMatch(existing, payload),
  };
}

async function resolveAssignedToId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;

  if (isValidObjectId(normalized)) {
    const userById = await prisma.user.findUnique({
      where: { id: normalized },
      select: { id: true },
    });
    return userById?.id || null;
  }

  const lowered = normalized.toLowerCase();
  const userByIdentity = await prisma.user.findFirst({
    where: {
      OR: [
        { email: lowered },
        { name: normalized },
      ],
    },
    select: { id: true },
  });

  return userByIdentity?.id || null;
}

/**
 * Resolve a list of ids/emails/names to **deduped** ObjectIds, preserving
 * input order. Used by multi-assignee fields (`assignedToIds`).
 */
async function resolveAssignedToIds(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const id = await resolveAssignedToId(value);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Hydrate lead.assignedToUsers from `assignedToIds` (single query per page). */
async function attachAssignees(leads) {
  const isArray = Array.isArray(leads);
  const list = isArray ? leads : [leads];
  const allIds = new Set();
  for (const lead of list) {
    if (!lead) continue;
    const ids = Array.isArray(lead.assignedToIds) ? lead.assignedToIds : [];
    for (const id of ids) if (id) allIds.add(id);
    if (lead.assignedToId) allIds.add(lead.assignedToId);
  }
  if (allIds.size === 0) {
    for (const lead of list) if (lead) lead.assignedToUsers = lead.assignedToUsers || [];
    return isArray ? list : list[0];
  }
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(allIds) } },
    select: { id: true, name: true, email: true, avatar: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const lead of list) {
    if (!lead) continue;
    const ids = Array.isArray(lead.assignedToIds) && lead.assignedToIds.length
      ? lead.assignedToIds
      : (lead.assignedToId ? [lead.assignedToId] : []);
    lead.assignedToUsers = ids.map((id) => byId.get(id)).filter(Boolean);
  }
  return isArray ? list : list[0];
}

export const leadService = {
  async getAll(req) {
    // Default page size higher than generic API (10): assignees and super admins must see assigned leads
    // without missing rows due to createdAt ordering + small first page.
    const page = Math.max(Number.parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 500);
    const skip = (page - 1) * limit;
    const { status, source, assignedToId, search, type, priority, ids } = req.query;

    const baseFilters = {};
    if (status) baseFilters.status = status;
    if (source) {
      const normalizedSource = normalizeImportSource(source);
      if (normalizedSource) baseFilters.source = normalizedSource;
    }
    if (type) baseFilters.type = type;
    if (priority) baseFilters.priority = priority;
    if (assignedToId) {
      baseFilters.OR = [
        { assignedToId },
        { assignedToIds: { has: assignedToId } },
      ];
    }

    const andParts = [{ ...baseFilters }];

    if (ids) {
      const idList = String(ids)
        .split(',')
        .map((value) => value.trim())
        .filter((value) => isValidObjectId(value));
      if (idList.length) {
        andParts.push({ id: { in: idList } });
      }
    }

    // Recycle Bin: hide soft-deleted rows from the normal Leads page (always opt-in via /trash).
    // `not: true` matches false, null, and missing-field documents (legacy rows from before
    // the soft-delete column existed) without tripping Prisma's "Argument isDeleted is missing".
    andParts.push({ isDeleted: { not: true } });
    const searchFilter = buildLeadDatabaseSearchFilter(search);
    if (searchFilter) {
      andParts.push(searchFilter);
    }
    if (!canViewAllLeads(req) && req.user?.id) {
      andParts.push(await applyMemberLeadScope({}, req));
    }

    const filteredParts = andParts.filter((part) => part && Object.keys(part).length > 0);
    const where =
      filteredParts.length === 0
        ? {}
        : filteredParts.length === 1
          ? filteredParts[0]
          : { AND: filteredParts };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          client: {
            select: { id: true, companyName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    await attachAssignees(leads);
    const withAudit = await prepareListWithAuditMeta(leads, ENTITY_TYPES.LEAD, {
      resolveLeadCreators: true,
    });
    return formatPaginationResponse(withAudit, page, limit, total);
  },

  async getById(id, req = null) {
    const where = await buildLeadAccessWhere(id, req);

    const lead = await prisma.lead.findFirst({
      where,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        client: true,
        noteList: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!lead) return null;
    await attachAssignees(lead);
    return attachAuditMetaToEntity(lead, ENTITY_TYPES.LEAD, { resolveLeadCreators: true });
  },

  async create(data) {
    const normalizeNullableString = (value) => {
      if (value === undefined || value === null) return null;
      const normalized = stripNbsp(value).trim();
      return normalized || null;
    };
    const normalizeRequiredLeadField = (value) => normalizeNullableString(value) || '';

    const rawCompanyLinkSources = Array.isArray(data.companyLinks)
      ? data.companyLinks.map((item) => stripNbsp(String(item)).trim()).filter(Boolean)
      : String(data.website || '')
          .split('\n')
          .map((item) => stripNbsp(item).trim())
          .filter(Boolean);

    const normalizedCompanyLinks = rawCompanyLinkSources.filter(isLikelyWebAddress);

    const normalizedContactPerson = normalizeNullableString(data.contactPerson) || normalizeNullableString(data.directorName);
    const normalizedDirectorSalutation = normalizeNullableString(data.directorSalutation);
    const normalizedIndustry = normalizeNullableString(data.industry) || normalizeNullableString(data.sector);
    const normalizedCompanySize = normalizeNullableString(data.companySize) || normalizeNullableString(data.teamName);
    const normalizedInterestedNeeds = normalizeNullableString(data.interestedNeeds) || normalizeNullableString(data.servicesNeeded);
    const normalizedNotes = normalizeNullableString(data.notes);
    const normalizedExpectedBusinessValue = normalizeNullableString(data.expectedBusinessValue);
    const resolvedAssignedToId = await resolveAssignedToId(data.assignedToId || data.assignedToName);
    const resolvedAssignedToIds = Array.isArray(data.assignedToIds)
      ? await resolveAssignedToIds(data.assignedToIds)
      : [];
    const normalizedOtherDetails = normalizeOtherDetails(data.otherDetails);

    // Map frontend fields to backend model
    const websiteInput = normalizeNullableString(data.website);
    const websiteClean = websiteInput && isLikelyWebAddress(websiteInput) ? websiteInput : null;
    const linkedInInput = normalizeNullableString(data.linkedIn);
    const linkedInClean =
      linkedInInput && (isLikelyWebAddress(linkedInInput) || linkedInInput.toLowerCase().includes('linkedin.com'))
        ? linkedInInput
        : null;

    const contactChannels = normalizeContactChannels(data);

    const leadData = {
      companyName: normalizeRequiredLeadField(data.companyName),
      contactPerson: normalizedContactPerson || null,
      directorName: normalizeNullableString(data.directorName) || null,
      directorSalutation: normalizedDirectorSalutation || null,
      email: normalizeRequiredLeadField(contactChannels.email),
      phone: contactChannels.phone,
      emails: contactChannels.emails,
      phones: contactChannels.phones,
      type: data.type || 'Company',
      source: ['Website', 'LinkedIn', 'Email', 'Referral', 'Campaign'].includes(data.source)
        ? data.source
        : null,
      status: data.status || 'New',
      priority: data.priority || 'Medium',
      interestedNeeds: normalizedInterestedNeeds || null,
      servicesNeeded: data.servicesNeeded || normalizedInterestedNeeds || null,
      notes: normalizedNotes || null,
      expectedBusinessValue: normalizedExpectedBusinessValue || null,
      // Extended company fields
      industry: normalizedIndustry || null,
      sector: data.sector || normalizedIndustry || null,
      companySize: normalizedCompanySize || null,
      teamName: data.teamName || normalizedCompanySize || null,
      website: websiteClean || (normalizedCompanyLinks.length ? normalizedCompanyLinks[0] : null),
      companyLinks: normalizedCompanyLinks,
      linkedIn: linkedInClean,
      location: normalizeNullableString(data.location),
      // Extended contact fields
      designation: normalizeNullableString(data.designation),
      teamMemberDesignation: normalizeNullableString(data.teamMemberDesignation),
      teamMemberEmail: normalizeNullableString(data.teamMemberEmail),
      teamMemberPhone: normalizeNullableString(data.teamMemberPhone),
      country: normalizeNullableString(data.country),
      city: normalizeNullableString(data.city),
      // Smart-location autofill metadata (Nominatim) — all optional.
      state: normalizeNullableString(data.state),
      latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
      longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
      // Lead management fields
      campaignName: normalizeNullableString(data.campaignName),
      campaignLink: normalizeNullableString(data.campaignLink),
      referralName: normalizeNullableString(data.referralName),
      sourceWebsiteUrl: normalizeNullableString(data.sourceWebsiteUrl),
      sourceLinkedInUrl: normalizeNullableString(data.sourceLinkedInUrl),
      sourceEmail: normalizeNullableString(data.sourceEmail),
      otherDetails: normalizedOtherDetails,
      lastFollowUp: data.lastFollowUp ? new Date(data.lastFollowUp) : null,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      // Agreements & Terms — single primary document attached during onboarding.
      agreementsFileName: normalizeNullableString(data.agreementsFileName),
      agreementsFileUrl: normalizeNullableString(data.agreementsFileUrl),
      agreementsUploadedAt: data.agreementsUploadedAt
        ? new Date(data.agreementsUploadedAt)
        : (normalizeNullableString(data.agreementsFileUrl) ? new Date() : null),
      ...buildAgreementTermsCreateFields(data),
      // Relations
      assignedToId:
        resolvedAssignedToId ||
        resolvedAssignedToIds[0] ||
        (data.performedByRole === 'SUPER_ADMIN' && data.performedById ? data.performedById : null),
      assignedToIds: (() => {
        if (resolvedAssignedToIds.length > 0) {
          const out = [...resolvedAssignedToIds];
          if (resolvedAssignedToId && !out.includes(resolvedAssignedToId)) out.unshift(resolvedAssignedToId);
          return out;
        }
        if (resolvedAssignedToId) return [resolvedAssignedToId];
        if (data.performedByRole === 'SUPER_ADMIN' && data.performedById) return [String(data.performedById)];
        return [];
      })(),
      createdBy: data.performedById ? String(data.performedById) : null,
    };

    // Log the received data in JSON format
    dbLogger.logCreate('Lead', leadData);

    if (data.performedById && leadData.assignedToIds?.length) {
      for (const assigneeId of leadData.assignedToIds) {
        if (assigneeId) await assertCanAssignCrm(data.performedById, assigneeId);
      }
    }

    const lead = await prisma.lead.create({
      data: leadData,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    await attachAssignees(lead);

    // Log the created lead
    dbLogger.logCreate('Lead', lead);

    // Create activity log
    if (data.performedById) {
      try {
        await activityService.logLeadActivity({
          entityId: lead.id,
          performedById: data.performedById,
          action: 'Lead Created',
          description: `New lead "${lead.companyName}" was created`,
          metadata: {
            companyName: lead.companyName,
            contactPerson: lead.contactPerson,
            status: lead.status,
            source: lead.source,
          },
        });
      } catch (err) {
        console.error('Failed to create activity log:', err);
        // Don't throw - activity logging is non-critical
      }
    }

    return lead;
  },

  async update(id, data, req = null) {
    // Get the current lead to track changes
    const currentLead = await prisma.lead.findFirst({
      where: buildLeadAccessWhere(id, req),
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    if (!currentLead) {
      throw new Error('Lead not found');
    }

    // Map frontend fields to backend model
    const updateData = {};
    const normalizedCompanyLinks = Array.isArray(data.companyLinks)
      ? data.companyLinks
          .map((item) => stripNbsp(String(item)).trim())
          .filter(Boolean)
          .filter(isLikelyWebAddress)
      : undefined;
    const normalizedOtherDetails = data.otherDetails !== undefined ? normalizeOtherDetails(data.otherDetails) : undefined;
    const resolvedAssignedToId =
      data.assignedToId !== undefined || data.assignedToName !== undefined
        ? await resolveAssignedToId(data.assignedToId || data.assignedToName)
        : undefined;
    const resolvedAssignedToIdsUpdate = Array.isArray(data.assignedToIds)
      ? await resolveAssignedToIds(data.assignedToIds)
      : undefined;
    
    if (data.companyName !== undefined) updateData.companyName = data.companyName || '';
    if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson || '';
    if (data.directorName !== undefined) updateData.directorName = data.directorName || null;
    if (data.directorSalutation !== undefined) {
      const s = data.directorSalutation == null ? '' : String(data.directorSalutation).trim();
      updateData.directorSalutation = s || null;
    }
    if (data.contactPerson === undefined && data.directorName !== undefined) updateData.contactPerson = data.directorName || '';
    if (data.email !== undefined || data.emails !== undefined || data.phones !== undefined) {
      const contactChannels = normalizeContactChannels({
        email: data.email !== undefined ? data.email : currentLead.email,
        phone: data.phone !== undefined ? data.phone : currentLead.phone,
        emails: data.emails !== undefined ? data.emails : currentLead.emails,
        phones: data.phones !== undefined ? data.phones : currentLead.phones,
      });
      updateData.email = contactChannels.email || '';
      updateData.phone = contactChannels.phone;
      updateData.emails = contactChannels.emails;
      updateData.phones = contactChannels.phones;
    }
    if (data.type !== undefined) updateData.type = data.type;
    if (data.source !== undefined) {
      const s = data.source;
      updateData.source =
        s == null || s === ''
          ? null
          : ['Website', 'LinkedIn', 'Email', 'Referral', 'Campaign'].includes(s)
            ? s
            : null;
    }
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.interestedNeeds !== undefined) updateData.interestedNeeds = data.interestedNeeds || null;
    if (data.servicesNeeded !== undefined) updateData.servicesNeeded = data.servicesNeeded || null;
    if (data.interestedNeeds === undefined && data.servicesNeeded !== undefined) updateData.interestedNeeds = data.servicesNeeded || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.expectedBusinessValue !== undefined) updateData.expectedBusinessValue = data.expectedBusinessValue || null;
    // Extended company fields
    if (data.industry !== undefined) updateData.industry = data.industry || null;
    if (data.sector !== undefined) updateData.sector = data.sector || null;
    if (data.industry === undefined && data.sector !== undefined) updateData.industry = data.sector || null;
    if (data.companySize !== undefined) updateData.companySize = data.companySize || null;
    if (data.teamName !== undefined) updateData.teamName = data.teamName || null;
    if (data.companySize === undefined && data.teamName !== undefined) updateData.companySize = data.teamName || null;
    if (data.website !== undefined) updateData.website = data.website || null;
    if (normalizedCompanyLinks !== undefined) {
      updateData.companyLinks = normalizedCompanyLinks;
      if (data.website === undefined) {
        updateData.website = normalizedCompanyLinks.length ? normalizedCompanyLinks[0] : null;
      }
    }
    if (data.linkedIn !== undefined) updateData.linkedIn = data.linkedIn || null;
    if (data.location !== undefined) updateData.location = data.location || null;
    // Extended contact fields
    if (data.designation !== undefined) updateData.designation = data.designation || null;
    if (data.teamMemberDesignation !== undefined) {
      updateData.teamMemberDesignation = data.teamMemberDesignation || null;
    }
    if (data.teamMemberEmail !== undefined) updateData.teamMemberEmail = data.teamMemberEmail || null;
    if (data.teamMemberPhone !== undefined) updateData.teamMemberPhone = data.teamMemberPhone || null;
    if (data.country !== undefined) updateData.country = data.country || null;
    if (data.city !== undefined) updateData.city = data.city || null;
    if (data.state !== undefined) updateData.state = data.state || null;
    if (data.latitude !== undefined) {
      const n = Number(data.latitude);
      updateData.latitude = Number.isFinite(n) ? n : null;
    }
    if (data.longitude !== undefined) {
      const n = Number(data.longitude);
      updateData.longitude = Number.isFinite(n) ? n : null;
    }
    // Lead management fields
    if (data.campaignName !== undefined) updateData.campaignName = data.campaignName || null;
    if (data.campaignLink !== undefined) updateData.campaignLink = data.campaignLink || null;
    if (data.referralName !== undefined) updateData.referralName = data.referralName || null;
    if (data.sourceWebsiteUrl !== undefined) updateData.sourceWebsiteUrl = data.sourceWebsiteUrl || null;
    if (data.sourceLinkedInUrl !== undefined) updateData.sourceLinkedInUrl = data.sourceLinkedInUrl || null;
    if (data.sourceEmail !== undefined) updateData.sourceEmail = data.sourceEmail || null;
    if (data.otherDetails !== undefined) updateData.otherDetails = normalizedOtherDetails;
    if (data.lastFollowUp !== undefined) updateData.lastFollowUp = data.lastFollowUp ? new Date(data.lastFollowUp) : null;
    if (data.nextFollowUp !== undefined) updateData.nextFollowUp = data.nextFollowUp ? new Date(data.nextFollowUp) : null;
    if (data.lostReason !== undefined) updateData.lostReason = data.lostReason || null;
    // Agreements & Terms — only touch when the field was sent.
    if (data.agreementsFileName !== undefined) {
      updateData.agreementsFileName = data.agreementsFileName || null;
    }
    if (data.agreementsFileUrl !== undefined) {
      updateData.agreementsFileUrl = data.agreementsFileUrl || null;
      if (data.agreementsUploadedAt === undefined) {
        updateData.agreementsUploadedAt = data.agreementsFileUrl ? new Date() : null;
      }
    }
    if (data.agreementsUploadedAt !== undefined) {
      updateData.agreementsUploadedAt = data.agreementsUploadedAt
        ? new Date(data.agreementsUploadedAt)
        : null;
    }
    applyAgreementTermsUpdateFields(data, updateData);
    // Relations
    if (resolvedAssignedToIdsUpdate !== undefined) {
      // Multi-assignee: array drives both list + primary owner.
      const next = [...resolvedAssignedToIdsUpdate];
      const explicitPrimary = resolvedAssignedToId !== undefined ? resolvedAssignedToId : undefined;
      if (explicitPrimary && !next.includes(explicitPrimary)) next.unshift(explicitPrimary);
      updateData.assignedToIds = next;
      updateData.assignedToId = explicitPrimary ?? next[0] ?? null;
      stampLeadAssigneeVisibility({
        updateData,
        previous: currentLead,
        performerId: data.performedById || req?.user?.id,
        nextPrimaryId: updateData.assignedToId,
        nextIds: updateData.assignedToIds,
      });
    } else if (data.assignedToId !== undefined || data.assignedToName !== undefined) {
      // Single-assignee legacy path — mirror into the list so reads stay in sync.
      updateData.assignedToId = resolvedAssignedToId ?? null;
      stampLeadAssigneeVisibility({
        updateData,
        previous: currentLead,
        performerId: data.performedById || req?.user?.id,
        nextPrimaryId: updateData.assignedToId,
      });
    }
    if (data.convertedToClientId !== undefined) updateData.convertedToClientId = data.convertedToClientId || null;
    if (data.convertedToCandidateId !== undefined) updateData.convertedToCandidateId = data.convertedToCandidateId || null;
    if (data.convertedAt !== undefined) updateData.convertedAt = data.convertedAt ? new Date(data.convertedAt) : null;

    // Status → Converted without a linked client: create Client + link (same as POST /leads/:id/convert).
    if (data.status === 'Converted' && !currentLead.convertedToClientId) {
      const performedById = data.performedById || req?.user?.id || null;
      await this.convertToClient(id, {
        performedById,
        assignedToId: data.assignedToId !== undefined ? data.assignedToId : currentLead.assignedToId,
        companyName: data.companyName !== undefined ? data.companyName : currentLead.companyName || undefined,
        industry: data.industry !== undefined ? data.industry : currentLead.industry,
        website: data.website !== undefined ? data.website : currentLead.website,
        companySize:
          (data.teamName !== undefined ? data.teamName : null) ||
          (data.companySize !== undefined ? data.companySize : null) ||
          currentLead.teamName ||
          currentLead.companySize,
        linkedin: data.linkedIn !== undefined ? data.linkedIn : currentLead.linkedIn,
        location: data.location !== undefined ? data.location : currentLead.location,
        address:
          (data.location !== undefined ? data.location : null) ||
          currentLead.location ||
          (currentLead.city && currentLead.country ? `${currentLead.city}, ${currentLead.country}` : currentLead.city || currentLead.country) ||
          undefined,
        hiringLocations:
          currentLead.city && currentLead.country
            ? `${currentLead.city}, ${currentLead.country}`
            : currentLead.city || currentLead.country || undefined,
        priority: currentLead.priority
          ? `${String(currentLead.priority).charAt(0)}${String(currentLead.priority).slice(1).toLowerCase()}`
          : data.priority !== undefined
            ? `${String(data.priority).charAt(0)}${String(data.priority).slice(1).toLowerCase()}`
            : undefined,
        servicesNeeded:
          (data.servicesNeeded !== undefined ? data.servicesNeeded : null) ||
          (data.interestedNeeds !== undefined ? data.interestedNeeds : null) ||
          currentLead.servicesNeeded ||
          currentLead.interestedNeeds,
        expectedBusinessValue:
          (data.expectedBusinessValue !== undefined ? data.expectedBusinessValue : null) ||
          currentLead.expectedBusinessValue ||
          currentLead.notes,
        directorName:
          data.directorName !== undefined ? data.directorName : currentLead.directorName,
        contactPerson:
          data.contactPerson !== undefined ? data.contactPerson : currentLead.contactPerson,
        directorSalutation:
          data.directorSalutation !== undefined ? data.directorSalutation : currentLead.directorSalutation,
        email: data.email !== undefined ? data.email : currentLead.email,
        phone: data.phone !== undefined ? data.phone : currentLead.phone,
        emails: data.emails !== undefined ? data.emails : currentLead.emails,
        phones: data.phones !== undefined ? data.phones : currentLead.phones,
        otherDetails: data.otherDetails !== undefined ? data.otherDetails : currentLead.otherDetails,
        teamMemberDesignation:
          data.teamMemberDesignation !== undefined
            ? data.teamMemberDesignation
            : currentLead.teamMemberDesignation,
        teamMemberEmail:
          data.teamMemberEmail !== undefined ? data.teamMemberEmail : currentLead.teamMemberEmail,
        teamMemberPhone:
          data.teamMemberPhone !== undefined ? data.teamMemberPhone : currentLead.teamMemberPhone,
      });
      delete updateData.status;
      delete updateData.convertedToClientId;
      delete updateData.convertedAt;
    }

    if (Object.keys(updateData).length === 0) {
      const refreshed = await prisma.lead.findFirst({
        where: buildLeadAccessWhere(id, req),
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });
      if (!refreshed) {
        throw new Error('Lead not found');
      }
      await attachAssignees(refreshed);
      return refreshed;
    }

    // Log the update data in JSON format
    dbLogger.logUpdate('Lead', id, updateData);

    if (data.performedById) {
      const nextAssignees = updateData.assignedToIds?.length
        ? updateData.assignedToIds
        : updateData.assignedToId
          ? [updateData.assignedToId]
          : [];
      for (const assigneeId of nextAssignees) {
        if (assigneeId) await assertCanAssignCrm(data.performedById, assigneeId);
      }
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    await attachAssignees(updated);

    // Log the updated lead
    dbLogger.logUpdate('Lead', id, updated);

    if (
      data.assignedToId !== undefined &&
      data.assignedToId &&
      data.assignedToId !== currentLead.assignedToId &&
      updated.assignedTo?.email
    ) {
      try {
        const assignedBy = data.performedById
          ? await prisma.user.findUnique({
              where: { id: data.performedById },
              select: { name: true },
            })
          : null;

        await sendLeadAssignmentEmail({
          toEmail: updated.assignedTo.email,
          assigneeName: updated.assignedTo.name,
          leadCompanyName: updated.companyName,
          contactPerson: updated.contactPerson,
          leadEmail: updated.email,
          leadPhone: updated.phone,
          leadStatus: updated.status,
          leadPriority: updated.priority,
          assignedByName: assignedBy?.name || null,
          senderUserId: data.performedById,
        });

        await createAlertNotification(data.assignedToId, 'lead.assigned', {
          category: 'LEAD',
          title: 'Lead assigned to you',
          description: `${updated.companyName || 'A lead'} was assigned to you${
            assignedBy?.name ? ` by ${assignedBy.name}` : ''
          }.`,
          actionLabel: 'Open lead',
          actionPath: `/leads?leadId=${id}`,
          entityType: 'LEAD',
          entityId: id,
        });
      } catch (emailError) {
        console.error('Failed to send lead assignment email:', emailError);
      }
    }

    if (data.status && data.status !== currentLead.status && updated.assignedToId) {
      try {
        const performer = data.performedById
          ? await prisma.user.findUnique({
              where: { id: data.performedById },
              select: { name: true, firstName: true, lastName: true, email: true },
            })
          : null;
        const performerName = personName(performer);
        if (data.status === 'Lost') {
          await notifyLeadMarkedLost({
            lead: updated,
            lostReason: data.lostReason || updated.lostReason,
            performedById: data.performedById,
            performedByName: performerName,
          });
        } else if (data.status !== 'Converted') {
          await notifyLeadStatusChanged({
            lead: updated,
            previousStatus: currentLead.status,
            newStatus: data.status,
            performedById: data.performedById,
            performedByName: performerName,
          });
        }
      } catch (alertErr) {
        console.warn('[lead.update] lifecycle alert failed:', alertErr?.message || alertErr);
      }
    }

    // Create activity log for significant changes
    if (data.performedById) {
      try {
        const changes = [];
        if (data.status && data.status !== currentLead.status) {
          changes.push(`Status changed from "${currentLead.status}" to "${data.status}"`);
        }
        if (data.assignedToId && data.assignedToId !== currentLead.assignedToId) {
          const newAssignee = await prisma.user.findUnique({
            where: { id: data.assignedToId },
            select: { name: true },
          });
          changes.push(`Assigned to ${newAssignee?.name || 'new user'}`);
        }
        if (data.priority && data.priority !== currentLead.priority) {
          changes.push(`Priority changed to "${data.priority}"`);
        }
        if (data.nextFollowUp) {
          const followUpDate = new Date(data.nextFollowUp);
          const formattedDate = followUpDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          // Extract follow-up details from statusRemark if available
          let followUpDescription = `Follow-up scheduled for ${formattedDate}`;
          let followUpType = 'Follow-up';
          let followUpNotes = '';

          if (data.statusRemark && data.statusRemark.includes('Follow-up scheduled:')) {
            // statusRemark example:
            // Follow-up scheduled: Call on 2026-03-15 at 14:30. Some notes...
            const remark = data.statusRemark.replace('Follow-up scheduled: ', '');
            followUpDescription = remark;

            // Try to parse type and notes from remark (best-effort)
            const onIndex = remark.indexOf(' on ');
            if (onIndex > 0) {
              followUpType = remark.substring(0, onIndex);
            }
            const notesIndex = remark.indexOf('. ');
            if (notesIndex > 0 && notesIndex + 2 < remark.length) {
              followUpNotes = remark.substring(notesIndex + 2);
            }
          }

          changes.push(followUpDescription);

          // Send follow-up email to the lead contact (best-effort, non-blocking)
          try {
            if (currentLead.email) {
              await sendLeadFollowUpEmail(
                currentLead.email,
                currentLead.companyName,
                data.nextFollowUp,
                followUpType,
                followUpNotes || data.statusRemark || null
              );
            }
          } catch (emailError) {
            console.error('Failed to send follow-up email:', emailError);
          }
        }
        if (data.lostReason) {
          changes.push(`Marked as Lost: ${data.lostReason}`);
        }
        if (data.statusRemark) {
          changes.push(`Remark: ${data.statusRemark}`);
        }

        const baseMetadata = {
          changes: Object.keys(updateData),
          previousStatus: currentLead.status,
          newStatus: data.status || currentLead.status,
          statusRemark: data.statusRemark || null,
        };

        if (changes.length > 0) {
          await activityService.logLeadActivity({
            entityId: id,
            performedById: data.performedById,
            action: 'Lead Updated',
            description: changes.join(', '),
            metadata: baseMetadata,
          });
        } else {
          // General update
          await activityService.logLeadActivity({
            entityId: id,
            performedById: data.performedById,
            action: 'Lead Updated',
            description: data.statusRemark
              ? `Lead "${updated.companyName}" was updated. Remark: ${data.statusRemark}`
              : `Lead "${updated.companyName}" was updated`,
            metadata: baseMetadata,
          });
        }
      } catch (err) {
        console.error('Failed to create activity log:', err);
        // Don't throw - activity logging is non-critical
      }
    }

    return updated;
  },

  /** Best image URL from lead uploads (newest first) — reused as client logo after conversion so jobs show the same art. */
  inferLogoUrlFromLeadFiles(files) {
    if (!Array.isArray(files) || !files.length) return null;
    const imgExt = /\.(png|jpe?g|gif|webp|svg)$/i;
    const sorted = [...files].sort(
      (a, b) => new Date(b.uploadDate || b.createdAt || 0) - new Date(a.uploadDate || a.createdAt || 0)
    );
    for (const f of sorted) {
      const url = String(f.fileUrl || '').trim();
      const name = String(f.fileName || '');
      if (!/^https?:\/\//i.test(url)) continue;
      if (
        imgExt.test(name) ||
        /\/image\/upload|res\.cloudinary\.com[^/]*\/image\//i.test(url) ||
        /\.s3[.-][^/]*amazonaws\.com\/.+\.(png|jpe?g|gif|webp)($|[?#])/i.test(url)
      ) {
        return url;
      }
    }
    return null;
  },

  async convertToClient(id, clientData) {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: { uploadDate: 'desc' },
          select: { fileName: true, fileUrl: true, uploadDate: true, createdAt: true },
        },
      },
    });
    if (!lead) {
      throw new Error('Lead not found');
    }

    if (lead.convertedToClientId) {
      const linkedClient = await prisma.client.findFirst({
        where: { id: lead.convertedToClientId, isDeleted: { not: true } },
        select: { id: true, companyName: true },
      });
      if (linkedClient) {
        throw makeLeadConversionError(
          `This lead was already converted to client "${linkedClient.companyName}".`,
          'LEAD_ALREADY_CONVERTED',
          { clientId: linkedClient.id, clientName: linkedClient.companyName },
        );
      }
    }

    const targetCompanyName = String(
      clientData.companyName || lead.companyName || lead.contactPerson || '',
    ).trim();

    const duplicateClient = await findDuplicateClientByCompanyName(targetCompanyName);
    if (duplicateClient) {
      throw makeLeadConversionError(
        `A client named "${duplicateClient.companyName}" already exists. This lead cannot be converted again.`,
        'CLIENT_ALREADY_EXISTS',
        { clientId: duplicateClient.id, clientName: duplicateClient.companyName },
      );
    }

    // Log the lead data to see what we're working with
    console.log('\n=== LEAD DATA BEING CONVERTED ===');
    console.log(JSON.stringify({
      id: lead.id,
      companyName: lead.companyName,
      industry: lead.industry,
      companySize: lead.companySize,
      teamName: lead.teamName,
      website: lead.website,
      linkedIn: lead.linkedIn,
      location: lead.location,
      city: lead.city,
      country: lead.country,
      designation: lead.designation,
      contactPerson: lead.contactPerson,
      email: lead.email,
      phone: lead.phone,
      priority: lead.priority,
      servicesNeeded: lead.servicesNeeded,
      interestedNeeds: lead.interestedNeeds,
      expectedBusinessValue: lead.expectedBusinessValue,
      notes: lead.notes,
      nextFollowUp: lead.nextFollowUp,
    }, null, 2));

    // Owner for RBAC client lists: lead assignee, else explicit payload, else the user who converts
    // (unassigned leads would otherwise create clients with no assignee — Sales would not see them.)
    const resolvedAssignedToId =
      clientData.assignedToId ||
      lead.assignedToId ||
      clientData.performedById ||
      null;

    // Map all lead fields to client
    const leadInferredLogo =
      typeof clientData.logo === 'string' && clientData.logo.trim()
        ? clientData.logo.trim()
        : this.inferLogoUrlFromLeadFiles(lead.files || []);

    const contactChannels = normalizeContactChannels({
      email: clientData.email || lead.email,
      phone: clientData.phone || lead.phone,
      emails: clientData.emails || lead.emails,
      phones: clientData.phones || lead.phones,
    });

    const agreementSource = { ...lead, ...clientData };
    const locationParts = [
      clientData.city || lead.city,
      clientData.state || lead.state,
      clientData.country || lead.country,
    ].filter(Boolean);

    const directorName = resolveDirectorNameFromLeadContext(clientData, lead);
    const directorSalutation = resolveDirectorSalutationFromLeadContext(clientData, lead);
    const mergedOtherDetails = mergeDirectorIntoOtherDetails(
      Array.isArray(clientData.otherDetails)
        ? clientData.otherDetails
        : Array.isArray(lead.otherDetails)
          ? lead.otherDetails
          : [],
      {
        directorSalutation,
        directorName,
      },
    );

    const clientCreateData = {
      companyName: String(clientData.companyName || lead.companyName || lead.contactPerson || 'Client').trim() || 'Client',
      industry: clientData.industry || lead.industry,
      website: clientData.website || lead.website,
      logo: leadInferredLogo || null,
      status: 'ACTIVE',
      leadStatus: 'Active',
      assignedToId: resolvedAssignedToId,
      createdById: clientData.performedById || null,
      location:
        clientData.location ||
        lead.location ||
        locationParts.join(', ') ||
        lead.city ||
        lead.country ||
        null,
      address:
        clientData.address ||
        lead.location ||
        (lead.city && lead.country ? `${lead.city}, ${lead.country}` : lead.city || lead.country || null),
      companySize: clientData.companySize || lead.teamName || lead.companySize || null,
      teamMemberDesignation:
        clientData.teamMemberDesignation || lead.teamMemberDesignation || null,
      teamMemberEmail: clientData.teamMemberEmail || lead.teamMemberEmail || null,
      teamMemberPhone: clientData.teamMemberPhone || lead.teamMemberPhone || null,
      linkedin: clientData.linkedin || lead.linkedIn || null,
      hiringLocations:
        clientData.hiringLocations ||
        (locationParts.length ? locationParts.join(', ') : lead.city || lead.country || null),
      timezone: clientData.timezone || null,
      clientSince: new Date(),
      priority:
        clientData.priority ||
        (lead.priority ? lead.priority.charAt(0) + lead.priority.slice(1).toLowerCase() : null),
      servicesNeeded: clientData.servicesNeeded || lead.servicesNeeded || lead.interestedNeeds || null,
      expectedBusinessValue:
        clientData.expectedBusinessValue || lead.expectedBusinessValue || lead.notes || null,
      sla: clientData.sla || null,
      nextFollowUpDue: clientData.nextFollowUpDue
        ? new Date(clientData.nextFollowUpDue)
        : lead.nextFollowUp || null,
      city: clientData.city || lead.city || null,
      state: clientData.state || lead.state || null,
      country: clientData.country || lead.country || null,
      latitude: Number.isFinite(Number(clientData.latitude ?? lead.latitude))
        ? Number(clientData.latitude ?? lead.latitude)
        : undefined,
      longitude: Number.isFinite(Number(clientData.longitude ?? lead.longitude))
        ? Number(clientData.longitude ?? lead.longitude)
        : undefined,
      directorSalutation: directorSalutation || null,
      emails: contactChannels.emails,
      phones: contactChannels.phones,
      otherDetails: mergedOtherDetails,
      agreementsFileName: clientData.agreementsFileName || lead.agreementsFileName || null,
      agreementsFileUrl: clientData.agreementsFileUrl || lead.agreementsFileUrl || null,
      agreementsUploadedAt: clientData.agreementsUploadedAt
        ? new Date(clientData.agreementsUploadedAt)
        : lead.agreementsUploadedAt || null,
      ...buildAgreementTermsCreateFields(agreementSource),
    };

    // Log the client data being created
    console.log('\n=== CLIENT DATA BEING CREATED ===');
    console.log(JSON.stringify(clientCreateData, null, 2));

    const client = await prisma.client.create({
      data: clientCreateData,
    });

    // Log the created client
    console.log('\n=== CREATED CLIENT ===');
    console.log(JSON.stringify({
      id: client.id,
      companyName: client.companyName,
      industry: client.industry,
      companySize: client.companySize,
      servicesNeeded: client.servicesNeeded,
      expectedBusinessValue: client.expectedBusinessValue,
      website: client.website,
      linkedin: client.linkedin,
      location: client.location,
      hiringLocations: client.hiringLocations,
      timezone: client.timezone,
      priority: client.priority,
      sla: client.sla,
    }, null, 2));

    await prisma.lead.update({
      where: { id },
      data: {
        status: 'Converted',
        convertedToClientId: client.id,
        convertedAt: new Date(),
      },
    });

    // Create a primary director Contact so the client drawer can show the director name.
    const contactPersonName = directorName;
    const contactEmail = String(clientData.email || lead.email || '').trim().toLowerCase();
    const contactPhone = clientData.phone || lead.phone || null;

    if (contactPersonName) {
      try {
        const nameParts = contactPersonName.split(/\s+/).filter(Boolean);
        const firstName = nameParts[0] || contactPersonName;
        const lastName = nameParts.slice(1).join(' ') || '';
        const resolvedEmail =
          contactEmail || `client-${client.id}-director@placeholder.local`;

        await prisma.contact.create({
          data: {
            salutation: directorSalutation || null,
            firstName,
            lastName,
            email: resolvedEmail,
            phone: contactPhone,
            companyId: client.id,
            designation: 'Director',
            location:
              locationParts.length
                ? locationParts.join(', ')
                : lead.city || lead.country || lead.location || null,
            linkedinUrl: lead.linkedIn || null,
            contactType: 'CLIENT',
            status: 'ACTIVE',
            ownerId: resolvedAssignedToId || null,
            isPrimary: true,
          },
        });
      } catch (error) {
        // If contact already exists (email unique constraint), log but don't fail
        console.error('Failed to create contact from lead:', error.message);
      }
    }

    dbLogger.logUpdate('Lead', id, { status: 'Converted', convertedToClientId: client.id });

    // Create activity log
    if (clientData.performedById) {
      try {
        await activityService.logLeadActivity({
          entityId: id,
          performedById: clientData.performedById,
          action: 'Lead Converted to Client',
          description: `Lead "${lead.companyName}" was converted to client "${client.companyName}"`,
          metadata: {
            clientId: client.id,
            clientName: client.companyName,
          },
        });
      } catch (err) {
        console.error('Failed to create activity log:', err);
      }
    }

    try {
      const performer = clientData.performedById
        ? await prisma.user.findUnique({
            where: { id: clientData.performedById },
            select: { name: true, firstName: true, lastName: true, email: true },
          })
        : null;
      await notifyLeadConvertedToClient({
        lead,
        client,
        performedById: clientData.performedById,
        performedByName: personName(performer),
      });
    } catch (alertErr) {
      console.warn('[lead.convertToClient] alert failed:', alertErr?.message || alertErr);
    }

    return client;
  },

  async delete(id, performedById, req = null) {
    // Soft delete — flips isDeleted=true and stamps deletedAt/deletedBy so the row
    // shows up on the Recycle Bin page and can be restored.
    const lead = await prisma.lead.findFirst({
      where: buildLeadAccessWhere(id, req),
    });
    if (!lead) {
      throw new Error('Lead not found');
    }

    await prisma.lead.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: performedById || null,
      },
    });

    // Create activity log
    if (performedById) {
      try {
        await activityService.logLeadActivity({
          entityId: id,
          performedById,
          action: 'Lead Deleted',
          description: `Lead "${lead.companyName}" was moved to Recycle Bin`,
          metadata: {
            companyName: lead.companyName,
            contactPerson: lead.contactPerson,
            softDelete: true,
          },
        });
      } catch (err) {
        console.error('Failed to create activity log:', err);
      }
    }

    return { message: 'Lead moved to Recycle Bin' };
  },

  /**
   * Recycle Bin — list soft-deleted leads (newest first).
   * Scope mirrors getAll: assignees see only their own deleted records, admins see all.
   */
  async listTrash(req) {
    const page = Math.max(Number.parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 500);
    const skip = (page - 1) * limit;

    const andParts = [{ isDeleted: true }];
    if (!canViewAllLeads(req) && req.user?.id) {
      const scope = await applyMemberLeadScope({}, req);
      andParts.push({
        OR: [...(scope.OR || []), { deletedBy: req.user.id }],
      });
    }
    const where = { AND: andParts };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);
    await attachAssignees(leads);
    const withAudit = await prepareListWithAuditMeta(leads, ENTITY_TYPES.LEAD, {
      resolveLeadCreators: true,
    });
    return formatPaginationResponse(withAudit, page, limit, total);
  },

  /** Recycle Bin — restore a soft-deleted lead. */
  async restore(id, performedById, req = null) {
    const lead = await prisma.lead.findFirst({
      where: { id, isDeleted: true },
    });
    if (!lead) {
      throw new Error('Deleted lead not found');
    }
    await prisma.lead.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null, deletedBy: null },
    });
    if (performedById) {
      try {
        await activityService.logLeadActivity({
          entityId: id,
          performedById,
          action: 'Lead Restored',
          description: `Lead "${lead.companyName}" was restored from the Recycle Bin`,
          metadata: { companyName: lead.companyName },
        });
      } catch (err) {
        console.error('Failed to create activity log:', err);
      }
    }
    return { message: 'Lead restored' };
  },

  /** Recycle Bin — permanently delete a soft-deleted lead. */
  /**
   * Bulk permanent-delete (Recycle Bin → Delete forever). Sequential so each lead's
   * transactional cleanup is isolated.
   */
  async bulkPurge(ids, performedById, req = null) {
    const unique = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)));
    if (!unique.length) {
      return { success: 0, failed: 0, failures: [] };
    }
    let success = 0;
    const failures = [];
    for (const leadId of unique) {
      try {
        await this.purge(leadId, performedById, req);
        success += 1;
      } catch (err) {
        failures.push({ id: leadId, message: err?.message || 'Failed to purge lead' });
      }
    }
    return { success, failed: failures.length, failures };
  },

  async purge(id, performedById, req = null) {
    const lead = await prisma.lead.findFirst({
      where: { id, isDeleted: true },
    });
    if (!lead) {
      throw new Error('Deleted lead not found');
    }
    await prisma.lead.delete({ where: { id } });
    if (performedById) {
      try {
        await activityService.logLeadActivity({
          entityId: id,
          performedById,
          action: 'Lead Purged',
          description: `Lead "${lead.companyName}" was permanently deleted`,
          metadata: { companyName: lead.companyName },
        });
      } catch (err) {
        console.error('Failed to create activity log:', err);
      }
    }
    return { message: 'Lead permanently deleted' };
  },

  async checkCreateDuplicate({ email, phone, companyName, contactPerson } = {}) {
    const payload = {
      email: email ? String(email).trim().toLowerCase() : null,
      phone: phone ? String(phone).trim() : null,
      companyName: companyName ? String(companyName).trim() : null,
      contactPerson: contactPerson ? String(contactPerson).trim() : null,
    };

    const duplicate = await findExistingLeadImportDuplicate(payload);
    if (!duplicate?.existing) {
      return { duplicate: false };
    }

    return {
      duplicate: true,
      leadId: duplicate.existing.id,
      matchedBy: duplicate.matchedBy,
      existing: {
        id: duplicate.existing.id,
        companyName: duplicate.existing.companyName,
        contactPerson: duplicate.existing.contactPerson,
        email: duplicate.existing.email,
        phone: duplicate.existing.phone,
        ownerName: duplicate.existing.assignedTo?.name || null,
        createdAt: duplicate.existing.createdAt,
      },
    };
  },

  async checkImportDuplicates({ rows = [], mapping = {} }) {
    const rawColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const mappedColumns = Object.values(mapping).filter((c) => typeof c === 'string' && c.trim());
    const meaningfulColumns = [
      ...new Set([
        ...filterMeaningfulImportColumns(rawColumns, rows),
        ...mappedColumns,
      ]),
    ];
    const importRows = slimImportRows(rows, meaningfulColumns);
    const duplicates = [];

    for (let index = 0; index < importRows.length; index += 1) {
      const row = importRows[index] || {};
      const payload = buildLeadImportPayload(row, mapping, {});
      const duplicate = await findExistingLeadImportDuplicate(payload);
      if (!duplicate?.existing) continue;

      duplicates.push({
        rowIndex: index + 1,
        matchedBy: duplicate.matchedBy,
        imported: buildLeadImportComparisonSnapshot(payload),
        existing: {
          id: duplicate.existing.id,
          ...buildLeadImportComparisonSnapshot(duplicate.existing),
        },
      });
    }

    return {
      totalRows: importRows.length,
      duplicateCount: duplicates.length,
      duplicates,
      compareFields: LEAD_IMPORT_DUPLICATE_COMPARE_FIELDS,
    };
  },

  async importLeads({ rows = [], mapping = {}, duplicateRule = 'skip', performedById, performedByRole }) {
    const rawColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const mappedColumns = Object.values(mapping).filter((c) => typeof c === 'string' && c.trim());
    const meaningfulColumns = [
      ...new Set([
        ...filterMeaningfulImportColumns(rawColumns, rows),
        ...mappedColumns,
      ]),
    ];
    const importRows = slimImportRows(rows, meaningfulColumns);

    const results = {
      total: importRows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (let index = 0; index < importRows.length; index += 1) {
      const row = importRows[index] || {};
      const payload = buildLeadImportPayload(row, mapping, { performedById });

      try {
        const duplicate = await findExistingLeadImportDuplicate(payload);
        const existing = duplicate?.existing || null;

        if (existing && duplicateRule === 'skip') {
          results.skipped += 1;
          continue;
        }

        if (existing && duplicateRule === 'update') {
          await this.update(
            existing.id,
            buildLeadImportUpdatePayload({
              ...payload,
              otherDetails: mergeLeadImportOtherDetails(existing.otherDetails, payload.otherDetails),
            })
          );
          results.updated += 1;
          continue;
        }

        const createPayload =
          existing && duplicateRule === 'create'
            ? {
                ...payload,
                companyName: prefixDuplicateCopyCompanyName(
                  payload.companyName,
                  existing.companyName || existing.contactPerson || 'Lead'
                ),
              }
            : payload;

        await this.create({ ...createPayload, performedByRole });
        results.created += 1;
      } catch (error) {
        results.failed += 1;
        results.errors.push(`Row ${index + 1}: ${error.message}`);
      }
    }

    return results;
  },

  async getActivities(leadId, viewerUserId = null) {
    let where = {
      entityType: 'LEAD',
      entityId: leadId,
    };

    if (viewerUserId) {
      where = await appendEntityActivityVisibilityToWhere(where, viewerUserId);
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        performedBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return activities;
  },
};
