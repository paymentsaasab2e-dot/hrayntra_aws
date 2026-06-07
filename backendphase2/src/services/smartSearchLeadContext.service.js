import { prisma, getActiveTenantDbName } from '../config/prisma.js';
import { canViewAllLeads } from '../utils/permissionScope.js';
import {
  resolveSmartSearchTakeLimit,
  smartSearchFindManyTake,
} from './smartSearchLimits.js';
import { normalizeEnumToken } from './smartSearchSchema.config.js';

function isValidObjectId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value.trim());
}

function clip(value, max = 120) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/** Same visibility scope as GET /leads for the current user. */
export function buildLeadsListScopeWhere(req) {
  const parts = [{ isDeleted: { not: true } }];
  if (!canViewAllLeads(req) && req?.user?.id) {
    parts.push({
      OR: [
        { assignedToId: req.user.id },
        { assignedToIds: { has: req.user.id } },
        { createdBy: req.user.id },
      ],
    });
  }
  return parts.length === 1 ? parts[0] : { AND: parts };
}

function uniqueNonEmpty(values, limit = 80) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function findClosestMatch(token, options = []) {
  const needle = String(token || '').trim().toLowerCase();
  if (!needle) return null;
  const exact = options.find((item) => String(item).toLowerCase() === needle);
  if (exact) return exact;
  const contains = options.find(
    (item) =>
      String(item).toLowerCase().includes(needle) || needle.includes(String(item).toLowerCase()),
  );
  return contains || null;
}

/** Compact row sent to OpenAI — every lead the user can access in this tenant DB. */
export function compactLeadRowForAi(lead, recruiterNameById = new Map()) {
  const assigneeIds = [
    lead.assignedToId,
    ...(Array.isArray(lead.assignedToIds) ? lead.assignedToIds : []),
  ].filter(Boolean);
  const assignees = assigneeIds
    .map((id) => recruiterNameById.get(id) || id)
    .filter(Boolean)
    .join(', ');

  return {
    id: lead.id,
    companyName: clip(lead.companyName, 80),
    directorName: clip(lead.directorName || lead.contactPerson, 60),
    email: clip(lead.email, 80),
    phone: clip(lead.phone, 40),
    status: clip(lead.status, 40),
    source: clip(lead.source, 30),
    priority: clip(lead.priority, 20),
    industry: clip(lead.industry || lead.sector, 50),
    teamName: clip(lead.teamName || lead.companySize, 50),
    city: clip(lead.city, 40),
    state: clip(lead.state, 40),
    country: clip(lead.country, 40),
    location: clip(lead.location, 60),
    website: clip(lead.website, 80),
    linkedIn: clip(lead.linkedIn, 80),
    servicesNeeded: clip(lead.interestedNeeds || lead.servicesNeeded, 100),
    expectedBusinessValue: clip(lead.notes || lead.expectedBusinessValue, 100),
    assignedTo: clip(assignees, 60),
  };
}

const LEAD_AI_SELECT = {
  id: true,
  companyName: true,
  contactPerson: true,
  directorName: true,
  email: true,
  phone: true,
  emails: true,
  phones: true,
  status: true,
  source: true,
  priority: true,
  industry: true,
  sector: true,
  companySize: true,
  teamName: true,
  city: true,
  state: true,
  country: true,
  location: true,
  website: true,
  linkedIn: true,
  interestedNeeds: true,
  servicesNeeded: true,
  notes: true,
  expectedBusinessValue: true,
  assignedToId: true,
  assignedToIds: true,
  designation: true,
  campaignName: true,
  referralName: true,
};

/**
 * Load the full accessible lead table for this tenant (for OpenAI smart search).
 * Sends every accessible lead row (optional SMART_SEARCH_MAX_LEADS_CONTEXT cap).
 */
export async function loadLeadsTenantSearchContext(req) {
  const where = buildLeadsListScopeWhere(req);
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const maxTake = resolveSmartSearchTakeLimit();

  const totalLeads = await prisma.lead.count({ where });

  const rawLeads = await prisma.lead.findMany({
    where,
    ...smartSearchFindManyTake(),
    orderBy: { createdAt: 'desc' },
    select: LEAD_AI_SELECT,
  });

  const recruiterIds = new Set();
  for (const lead of rawLeads) {
    if (lead.assignedToId) recruiterIds.add(lead.assignedToId);
    for (const id of lead.assignedToIds || []) {
      if (id) recruiterIds.add(id);
    }
  }

  const recruiters = recruiterIds.size
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(recruiterIds) } },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      })
    : [];

  const recruiterNameById = new Map(recruiters.map((user) => [user.id, user.name]));

  const allLeads = rawLeads.map((lead) => compactLeadRowForAi(lead, recruiterNameById));
  const allLeadIds = new Set(allLeads.map((lead) => lead.id));

  return {
    tenantDbName: tenantDbName || 'default',
    totalLeads,
    leadsLoadedForAi: allLeads.length,
    truncated: maxTake ? totalLeads > allLeads.length : false,
    maxLeadsContext: maxTake ?? null,
    statuses: uniqueNonEmpty(rawLeads.map((lead) => lead.status)),
    sources: uniqueNonEmpty(rawLeads.map((lead) => lead.source)),
    priorities: uniqueNonEmpty(rawLeads.map((lead) => lead.priority)),
    industries: uniqueNonEmpty(rawLeads.map((lead) => lead.industry || lead.sector)),
    cities: uniqueNonEmpty(rawLeads.map((lead) => lead.city)),
    states: uniqueNonEmpty(rawLeads.map((lead) => lead.state)),
    countries: uniqueNonEmpty(rawLeads.map((lead) => lead.country)),
    companies: uniqueNonEmpty(rawLeads.map((lead) => lead.companyName), 200),
    recruiters,
    allLeads,
    allLeadIds,
  };
}

/** Keep only IDs that exist in the tenant snapshot OpenAI was given. */
export function sanitizeMatchingLeadIds(ids = [], tenantDb = {}) {
  const allowed = tenantDb.allLeadIds || new Set();
  const list = Array.isArray(ids) ? ids : [];
  const out = [];
  const seen = new Set();
  for (const id of list) {
    const normalized = String(id || '').trim();
    if (!isValidObjectId(normalized)) continue;
    if (!allowed.has(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/** Align AI filters with real values present in this tenant's lead table. */
export function normalizeLeadsAiFiltersAgainstTenant(filters = {}, keywords = [], tenantDb = {}) {
  const nextFilters = { ...filters };
  const nextKeywords = Array.isArray(keywords) ? [...keywords] : [];

  if (nextFilters.status) {
    const matched = findClosestMatch(nextFilters.status, tenantDb.statuses || []);
    nextFilters.status = matched || nextFilters.status;
  }

  if (nextFilters.source) {
    const matched = findClosestMatch(nextFilters.source, tenantDb.sources || []);
    nextFilters.source = normalizeEnumToken(matched || nextFilters.source, 'LeadSource');
  }

  if (nextFilters.priority) {
    const matched = findClosestMatch(nextFilters.priority, tenantDb.priorities || []);
    nextFilters.priority = normalizeEnumToken(matched || nextFilters.priority, 'Priority');
  }

  if (nextFilters.recruiterId) {
    if (!isValidObjectId(nextFilters.recruiterId)) {
      const token = String(nextFilters.recruiterId).trim().toLowerCase();
      const recruiter = (tenantDb.recruiters || []).find((item) => {
        const name = String(item.name || '').toLowerCase();
        const email = String(item.email || '').toLowerCase();
        return name.includes(token) || token.includes(name) || email === token;
      });
      nextFilters.recruiterId = recruiter?.id || '';
    }
  }

  if (nextFilters.searchText) {
    const companyHint = findClosestMatch(nextFilters.searchText, tenantDb.companies || []);
    if (
      companyHint &&
      !nextFilters.searchText.toLowerCase().includes(companyHint.toLowerCase())
    ) {
      nextFilters.searchText = companyHint;
    }
  }

  for (let i = 0; i < nextKeywords.length; i += 1) {
    const chip = nextKeywords[i];
    if (chip?.kind === 'recruiter' && chip.value && !isValidObjectId(chip.value)) {
      const token = String(chip.value).toLowerCase();
      const recruiter = (tenantDb.recruiters || []).find((item) =>
        String(item.name || '').toLowerCase().includes(token),
      );
      if (recruiter) {
        nextKeywords[i] = {
          ...chip,
          value: recruiter.id,
          label: recruiter.name,
        };
        if (!nextFilters.recruiterId) nextFilters.recruiterId = recruiter.id;
      }
    }
    if (chip?.kind === 'status' && chip.value) {
      const matched = findClosestMatch(chip.value, tenantDb.statuses || []);
      if (matched) nextKeywords[i] = { ...chip, value: matched, label: matched };
    }
    if (chip?.kind === 'source' && chip.value) {
      const matched = findClosestMatch(chip.value, tenantDb.sources || []);
      if (matched) nextKeywords[i] = { ...chip, value: matched, label: matched };
    }
    if (chip?.kind === 'priority' && chip.value) {
      const matched = findClosestMatch(chip.value, tenantDb.priorities || []);
      if (matched) {
        nextKeywords[i] = { ...chip, value: matched, label: `${matched} interest` };
        if (!nextFilters.priority) nextFilters.priority = matched;
      }
    }
  }

  return { filters: nextFilters, keywords: nextKeywords };
}
