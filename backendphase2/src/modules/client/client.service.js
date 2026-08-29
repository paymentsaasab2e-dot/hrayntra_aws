import { prisma, getActiveTenantDbName, getJobPortalPrismaClient } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import activityService from '../../services/activityService.js';
import {
  sendClientAssignmentEmail,
  sendClientFollowUpReminderEmail,
} from '../../services/emailService.js';
import { createAlertNotification } from '../setting/alert-dispatch.service.js';
import {
  notifyClientKycIncomplete,
  notifyClientStatusChanged,
  personName,
} from '../setting/alert-notify.helpers.js';
import { normalizeContactChannels } from '../../utils/contact-channels.js';
import { buildSuperAdminOwnerScope, mergeWhereWithScope } from '../../utils/superAdminScope.js';
import {
  applyAgreementTermsUpdateFields,
  buildAgreementTermsCreateFields,
} from '../../utils/agreementTermsFields.js';
import {
  applyPostServiceKycFormUpdateFields,
  buildPostServiceKycFormCreateFields,
} from '../../utils/postServiceKycFormFields.js';
import { assertCanAssignCrm } from '../../services/crmAssignmentScope.service.js';
import { applyMemberClientScope } from '../../services/clientMemberScope.service.js';
import {
  mergeOrgCompanyListScope,
  resolveWriteOrgUnitId,
} from '../../services/orgListScope.service.js';
import {
  buildInitialParticipantIds,
  stampVisibilityOnAssigneeChange,
} from '../../services/memberVisibility.service.js';
import {
  USER_BRIEF_SELECT,
  prepareListWithAuditMeta,
  buildAuditMeta,
  enrichListWithLastUpdater,
} from '../../utils/listAuditMeta.js';
import { escapePrismaRegex } from '../../utils/escapePrismaRegex.js';
import { ENTITY_TYPES } from '../../services/activityService.js';
import {
  queueAiEntryRecommendation,
  buildEntitySnapshot,
} from '../../services/aiEntryRecommendation.service.js';

/**
 * Recruiters / portal users: clients assigned to them, or they created/sourced (createdById).
 * Admins (canViewAllAssignments) and Super Admin “mine only” use other rules via mergeWhereWithScope.
 */

/** Keep shared portal `clients` row in sync when CRM client name/logo changes (job cards use this). */
export async function findLiveClientByCompanyName(companyName) {
  const name = String(companyName || '').trim();
  if (!name) return null;
  return prisma.client.findFirst({
    where: {
      isDeleted: { not: true },
      companyName: { equals: name, mode: 'insensitive' },
    },
  });
}

const mergedDuplicateTenants = new Set();

async function reassignClientOwnedRecords(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;
  const moves = [
    () => prisma.job.updateMany({ where: { clientId: fromId }, data: { clientId: toId } }),
    () => prisma.interview.updateMany({ where: { clientId: fromId }, data: { clientId: toId } }),
    () => prisma.placement.updateMany({ where: { clientId: fromId }, data: { clientId: toId } }),
    () => prisma.billingRecord.updateMany({ where: { clientId: fromId }, data: { clientId: toId } }),
    () => prisma.clientNote.updateMany({ where: { clientId: fromId }, data: { clientId: toId } }),
    () => prisma.clientFile.updateMany({ where: { clientId: fromId }, data: { clientId: toId } }),
    () => prisma.scheduledMeeting.updateMany({ where: { clientId: fromId }, data: { clientId: toId } }),
    () => prisma.activity.updateMany({ where: { clientId: fromId }, data: { clientId: toId } }),
    () => prisma.contact.updateMany({ where: { companyId: fromId }, data: { companyId: toId } }),
    () => prisma.lead.updateMany({ where: { convertedToClientId: fromId }, data: { convertedToClientId: toId } }),
  ];
  for (const move of moves) {
    try {
      await move();
    } catch (err) {
      console.warn('Client duplicate merge reassign skipped:', err?.message || err);
    }
  }
}

async function mergePortalDuplicateClientsByCompanyName() {
  try {
    const portalPrisma = getJobPortalPrismaClient();
    const rows = await portalPrisma.client.findMany({
      select: { id: true, companyName: true },
    });
    const groups = new Map();
    for (const row of rows) {
      const key = String(row.companyName || '').trim().toLowerCase();
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const keeper = group[0];
      for (const extra of group.slice(1)) {
        try {
          await portalPrisma.job.updateMany({
            where: { clientId: extra.id },
            data: { clientId: keeper.id },
          });
        } catch {
          /* portal job clientId may already match */
        }
        try {
          await portalPrisma.client.delete({ where: { id: extra.id } });
        } catch {
          /* keep going */
        }
      }
    }
  } catch (err) {
    console.warn('Portal client duplicate merge skipped:', err?.message || err);
  }
}

/** Collapse same-name live clients created by repeated job posts. */
export async function mergeDuplicateClientsByCompanyName() {
  const tenant = String(getActiveTenantDbName() || 'default').trim();
  if (mergedDuplicateTenants.has(tenant)) return { merged: 0 };

  const rows = await prisma.client.findMany({
    where: { isDeleted: { not: true } },
    select: {
      id: true,
      companyName: true,
      createdAt: true,
      _count: { select: { jobs: true } },
    },
  });

  const groups = new Map();
  for (const row of rows) {
    const key = String(row.companyName || '').trim().toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let merged = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => {
      const byJobs = (b._count?.jobs || 0) - (a._count?.jobs || 0);
      if (byJobs) return byJobs;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const keeper = group[0];
    for (const extra of group.slice(1)) {
      await reassignClientOwnedRecords(extra.id, keeper.id);
      await prisma.client.update({
        where: { id: extra.id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      merged += 1;
    }
  }

  await mergePortalDuplicateClientsByCompanyName();
  mergedDuplicateTenants.add(tenant);
  if (merged > 0) {
    console.log(`Merged ${merged} duplicate client row(s) for tenant ${tenant}.`);
  }
  return { merged };
}

async function mirrorClientRowToJobPortalDb(client) {
  const tenantDbName = getActiveTenantDbName();
  if (!tenantDbName || !client?.id || !client.companyName) return;
  try {
    const portalPrisma = getJobPortalPrismaClient();
    const payload = {
      companyName: client.companyName,
      industry: client.industry ?? null,
      logo: client.logo ?? null,
      location: client.location ?? null,
      status: 'ACTIVE',
    };
    const byId = await portalPrisma.client.findUnique({
      where: { id: client.id },
      select: { id: true },
    }).catch(() => null);
    if (byId?.id) {
      await portalPrisma.client.update({
        where: { id: byId.id },
        data: payload,
      });
      return;
    }
    const byName = await portalPrisma.client.findFirst({
      where: { companyName: { equals: String(client.companyName).trim(), mode: 'insensitive' } },
      select: { id: true },
    }).catch(() => null);
    if (byName?.id) {
      await portalPrisma.client.update({
        where: { id: byName.id },
        data: payload,
      });
      return;
    }
    await portalPrisma.client.create({
      data: {
        id: client.id,
        ...payload,
      },
    });
  } catch (err) {
    console.error('mirrorClientRowToJobPortalDb failed:', err?.message || err);
  }
}

function applySystemWorkspaceExclusion(where = {}, includeSystem = false) {
  if (includeSystem) return where;

  const excludeWorkspaceWhere = {
    NOT: {
      OR: [
        { industry: 'Workspace' },
        { website: { startsWith: 'tenant://' } },
      ],
    },
  };

  if (!where || Object.keys(where).length === 0) {
    return excludeWorkspaceWhere;
  }

  return { AND: [where, excludeWorkspaceWhere] };
}

const CLIENT_IMPORT_DUPLICATE_COMPARE_FIELDS = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'industry', label: 'Industry' },
  { key: 'location', label: 'Location' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'contactPerson', label: 'Contact Person' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'companySize', label: 'Team Name' },
  { key: 'servicesNeeded', label: 'Services Needed' },
  { key: 'leadStatus', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'expectedBusinessValue', label: 'Expected Business Value' },
  { key: 'notes', label: 'Notes' },
];

function normalizeClientImportValue(value) {
  return String(value ?? '').trim();
}

function normalizeClientImportPriority(value) {
  const normalized = normalizeClientImportValue(value).toLowerCase();
  if (!normalized) return undefined;
  if (['hot', 'high', 'warm'].includes(normalized)) return 'High';
  if (['medium', 'med', 'moderate'].includes(normalized)) return 'Medium';
  if (['low', 'cold'].includes(normalized)) return 'Low';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function parseClientImportDateValue(value) {
  const raw = normalizeClientImportValue(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function prefixDuplicateCopyClientName(companyName, fallback = '') {
  const base = normalizeClientImportValue(companyName || fallback);
  if (!base) return 'Copy';
  if (/^copy\b/i.test(base)) return base;
  return `Copy ${base}`;
}

function buildClientImportComparisonSnapshot(source = {}) {
  const snapshot = {};
  for (const field of CLIENT_IMPORT_DUPLICATE_COMPARE_FIELDS) {
    const raw = source?.[field.key];
    snapshot[field.key] = raw == null ? null : String(raw);
  }
  return snapshot;
}

function stripImportCell(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\u00a0/g, ' ').trim();
}

function normalizeClientOtherDetails(value) {
  if (!Array.isArray(value)) return null;

  const normalized = value
    .map((item) => ({
      label: stripImportCell(item?.label),
      value: stripImportCell(item?.value),
    }))
    .filter((item) => item.label && item.value);

  return normalized.length ? normalized : null;
}

function buildImportedDynamicClientOtherDetails(row = {}, mapping = {}) {
  const mappedColumns = new Set(
    Object.values(mapping || {})
      .map((column) => (typeof column === 'string' ? column.trim() : ''))
      .filter(Boolean)
  );

  return Object.entries(row || {})
    .map(([label, rawValue]) => ({
      label: stripImportCell(label),
      value: rawValue == null ? '' : stripImportCell(rawValue),
    }))
    .filter((item) => item.label && item.value && !mappedColumns.has(item.label));
}

function mergeClientImportOtherDetails(existingDetails, importedDetails) {
  const merged = new Map();

  for (const item of existingDetails || []) {
    const label = stripImportCell(item?.label);
    const value = stripImportCell(item?.value);
    if (!label || !value) continue;
    merged.set(label.toLowerCase(), { label, value });
  }

  for (const item of importedDetails || []) {
    const label = stripImportCell(item?.label);
    const value = stripImportCell(item?.value);
    if (!label || !value) continue;
    merged.set(label.toLowerCase(), { label, value });
  }

  return Array.from(merged.values());
}

function buildClientImportPayload(row = {}, mapping = {}) {
  const getValue = (key) => {
    const column = mapping[key];
    if (!column) return '';
    return normalizeClientImportValue(row[column]);
  };

  const extractLinksFromRow = () =>
    Object.values(row)
      .flatMap((value) => String(value ?? '').match(/https?:\/\/[^\s,|]+/gi) || [])
      .map((value) => value.trim())
      .filter(Boolean);

  const companyName = getValue('name');
  const contactPerson = getValue('contactPerson');
  const email = getValue('email').toLowerCase();
  const phone = getValue('phone');
  const teamName = getValue('companySize');
  const city = getValue('city');
  const country = getValue('country');
  const location = getValue('location');
  const servicesNeeded = getValue('servicesNeeded');
  const expectedBusinessValue = getValue('expectedBusinessValue');
  const notes = getValue('notes');
  const priority = normalizeClientImportPriority(getValue('priority'));
  const leadStatus = getValue('leadStatus');
  const nextFollowUpDue = parseClientImportDateValue(getValue('nextFollowUpDue'));
  const hiringLocations = [city, country].filter(Boolean).join(', ');
  const detectedLinks = extractLinksFromRow();
  const websiteValue = getValue('website');
  const linkedinValue = detectedLinks.find((link) => link.toLowerCase().includes('linkedin.com')) || '';
  const genericWebsiteValue =
    websiteValue ||
    detectedLinks.find((link) => !link.toLowerCase().includes('linkedin.com')) ||
    '';
  const importedDynamicOtherDetails = buildImportedDynamicClientOtherDetails(row, mapping);

  return {
    companyName,
    industry: getValue('industry') || undefined,
    location: location || undefined,
    website: genericWebsiteValue || undefined,
    linkedin: linkedinValue || undefined,
    assignedToId: getValue('assignedToId') || undefined,
    companySize: teamName || undefined,
    hiringLocations: hiringLocations || undefined,
    priority,
    servicesNeeded: servicesNeeded || undefined,
    expectedBusinessValue: expectedBusinessValue || undefined,
    leadStatus: leadStatus || undefined,
    nextFollowUpDue: nextFollowUpDue || undefined,
    address: notes || undefined,
    status: 'PROSPECT',
    contactPerson,
    email,
    phone,
    city,
    country,
    notes,
    otherDetails: importedDynamicOtherDetails,
  };
}

async function findExistingClientImportDuplicate(companyName) {
  const normalizedCompanyName = normalizeClientImportValue(companyName);
  if (!normalizedCompanyName) return null;
  return prisma.client.findFirst({
    where: {
      companyName: {
        equals: escapePrismaRegex(normalizedCompanyName),
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      companyName: true,
      industry: true,
      location: true,
      city: true,
      country: true,
      contacts: {
        take: 1,
        orderBy: { createdAt: 'asc' },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          department: true,
        },
      },
      companySize: true,
      servicesNeeded: true,
      leadStatus: true,
      priority: true,
      expectedBusinessValue: true,
      address: true,
      hiringLocations: true,
    },
  });
}

export const clientService = {
  async getAll(req) {
    await mergeDuplicateClientsByCompanyName().catch((err) => {
      console.warn('Client duplicate merge skipped:', err?.message || err);
    });
    const { page, limit, skip } = getPaginationParams(req);
    const { status, assignedToId, search, ids } = req.query;
    const includeContacts = req.query.includeContacts === 'true';
    const includeLeadFields = req.query.includeLeadFields === 'true';
    const includeSystemClients = req.query.includeSystem === 'true';

    let where = {};
    if (status && String(status).toLowerCase() !== 'all') where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) {
      const escaped = escapePrismaRegex(search);
      where.OR = [
        { companyName: { contains: escaped, mode: 'insensitive' } },
        { industry: { contains: escaped, mode: 'insensitive' } },
        { website: { contains: escaped, mode: 'insensitive' } },
        { linkedin: { contains: escaped, mode: 'insensitive' } },
        { location: { contains: escaped, mode: 'insensitive' } },
        { city: { contains: escaped, mode: 'insensitive' } },
        { state: { contains: escaped, mode: 'insensitive' } },
        { country: { contains: escaped, mode: 'insensitive' } },
        { leadStatus: { contains: escaped, mode: 'insensitive' } },
        { servicesNeeded: { contains: escaped, mode: 'insensitive' } },
        { expectedBusinessValue: { contains: escaped, mode: 'insensitive' } },
        { hiringLocations: { contains: escaped, mode: 'insensitive' } },
        { teamMemberDesignation: { contains: escaped, mode: 'insensitive' } },
        { teamMemberEmail: { contains: escaped, mode: 'insensitive' } },
        { teamMemberPhone: { contains: escaped, mode: 'insensitive' } },
        { directorSalutation: { contains: escaped, mode: 'insensitive' } },
        { agreementLevel: { contains: escaped, mode: 'insensitive' } },
        { agreementTimePeriod: { contains: escaped, mode: 'insensitive' } },
        { agreementsFileName: { contains: escaped, mode: 'insensitive' } },
        { emails: { hasSome: [search] } },
        { phones: { hasSome: [search] } },
      ];
    }
    if (req.query.hot !== undefined) where.hot = req.query.hot === 'true';
    if (req.query.tags) where.tags = { hasSome: Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags] };
    // Recycle Bin: hide soft-deleted rows from the normal Clients page.
    // `not: true` matches false, null, and missing-field documents (legacy rows from before
    // the soft-delete column existed) without tripping Prisma's "Argument isDeleted is missing".
    where = { AND: [where, { isDeleted: { not: true } }] };
    where = applySystemWorkspaceExclusion(where, includeSystemClients);

    const superAdminScope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
    let scopedWhere = mergeWhereWithScope(where, superAdminScope);
    scopedWhere = await applyMemberClientScope(scopedWhere, req);
    scopedWhere = await mergeOrgCompanyListScope(scopedWhere, req, {
      assignedToIdField: 'assignedToId',
      createdByField: 'createdById',
    });

    if (ids) {
      const idList = String(ids)
        .split(',')
        .map((value) => value.trim())
        .filter((value) => /^[a-fA-F0-9]{24}$/.test(value));
      if (idList.length) {
        scopedWhere = { AND: [scopedWhere, { id: { in: idList } }] };
      }
    }

    const include = {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      createdBy: {
        select: USER_BRIEF_SELECT,
      },
      _count: {
        select: { jobs: true, contacts: true, placements: true },
      },
    };

    if (includeContacts) {
      include.contacts = {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          designation: true,
          email: true,
          phone: true,
          department: true,
          lastContacted: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      };
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where: scopedWhere,
        skip,
        take: limit,
        include,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.client.count({ where: scopedWhere }),
    ]);

    const clientIds = includeLeadFields ? clients.map((client) => client.id).filter(Boolean) : [];
    const convertedLeads = includeLeadFields && clientIds.length
      ? await prisma.lead.findMany({
          where: { convertedToClientId: { in: clientIds } },
          select: {
            convertedToClientId: true,
            status: true,
            teamName: true,
            companyLinks: true,
            city: true,
            country: true,
            servicesNeeded: true,
            interestedNeeds: true,
            expectedBusinessValue: true,
            notes: true,
            nextFollowUp: true,
            priority: true,
          },
        })
      : [];

    const leadByClientId = new Map(
      convertedLeads
        .filter((lead) => Boolean(lead.convertedToClientId))
        .map((lead) => [lead.convertedToClientId, lead])
    );

    const mergedClients = includeLeadFields
      ? clients.map((client) => {
          const convertedLead = leadByClientId.get(client.id);
          return {
            ...client,
            companySize: client.companySize || convertedLead?.teamName || null,
            website:
              client.website ||
              (convertedLead?.companyLinks?.length ? convertedLead.companyLinks.join('\n') : null),
            hiringLocations:
              client.hiringLocations ||
              (convertedLead?.city && convertedLead?.country
                ? `${convertedLead.city}, ${convertedLead.country}`
                : convertedLead?.city || convertedLead?.country || null),
            priority: client.priority || convertedLead?.priority || null,
            nextFollowUpDue: client.nextFollowUpDue || convertedLead?.nextFollowUp || null,
            servicesNeeded:
              client.servicesNeeded || convertedLead?.servicesNeeded || convertedLead?.interestedNeeds || null,
            expectedBusinessValue:
              client.expectedBusinessValue || convertedLead?.expectedBusinessValue || convertedLead?.notes || null,
            leadStatus: client.leadStatus || convertedLead?.status || null,
          };
        })
      : clients;

    const withAudit = await prepareListWithAuditMeta(mergedClients, ENTITY_TYPES.CLIENT);
    return formatPaginationResponse(withAudit, page, limit, total);
  },

  async getById(id, req = null) {
    const scope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
    let scopedWhere = mergeWhereWithScope({ id }, scope);
    scopedWhere = await applyMemberClientScope(scopedWhere, req);

    const client = await prisma.client.findFirst({
      where: scopedWhere,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        createdBy: {
          select: USER_BRIEF_SELECT,
        },
        contacts: {
          orderBy: { createdAt: 'desc' },
        },
        jobs: {
          include: {
            _count: {
              select: { matches: true, interviews: true, placements: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        placements: {
          include: {
            candidate: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            job: {
              select: { id: true, title: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        notes: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        files: {
          include: {
            uploadedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        billingRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!client) {
      return client;
    }

    const convertedLead = await prisma.lead.findFirst({
      where: { convertedToClientId: id },
      select: {
        status: true,
        teamName: true,
        companyLinks: true,
        city: true,
        country: true,
        servicesNeeded: true,
        interestedNeeds: true,
        expectedBusinessValue: true,
        notes: true,
        nextFollowUp: true,
        priority: true,
      },
    });

    const mergedClient = {
      ...client,
      companySize: client.companySize || convertedLead?.teamName || null,
      website:
        client.website ||
        (convertedLead?.companyLinks?.length ? convertedLead.companyLinks.join('\n') : null),
      hiringLocations:
        client.hiringLocations ||
        (convertedLead?.city && convertedLead?.country
          ? `${convertedLead.city}, ${convertedLead.country}`
          : convertedLead?.city || convertedLead?.country || null),
      priority: client.priority || convertedLead?.priority || null,
      nextFollowUpDue: client.nextFollowUpDue || convertedLead?.nextFollowUp || null,
      servicesNeeded: client.servicesNeeded || convertedLead?.servicesNeeded || convertedLead?.interestedNeeds || null,
      expectedBusinessValue:
        client.expectedBusinessValue || convertedLead?.expectedBusinessValue || convertedLead?.notes || null,
      leadStatus: convertedLead?.status || null,
    };

    // Log the fetched client data
    if (mergedClient) {
      console.log('\n=== FETCHED CLIENT DATA (getById) ===');
      console.log(JSON.stringify({
        id: mergedClient.id,
        companyName: mergedClient.companyName,
        industry: mergedClient.industry,
        companySize: mergedClient.companySize,
        servicesNeeded: mergedClient.servicesNeeded,
        expectedBusinessValue: mergedClient.expectedBusinessValue,
        leadStatus: mergedClient.leadStatus,
        website: mergedClient.website,
        linkedin: mergedClient.linkedin,
        location: mergedClient.location,
        hiringLocations: mergedClient.hiringLocations,
        timezone: mergedClient.timezone,
        priority: mergedClient.priority,
        sla: mergedClient.sla,
        clientSince: mergedClient.clientSince,
        nextFollowUpDue: mergedClient.nextFollowUpDue,
        leadStatus: mergedClient.leadStatus,
      }, null, 2));
    }

    const [withUpdater] = await enrichListWithLastUpdater([mergedClient], ENTITY_TYPES.CLIENT);
    return {
      ...withUpdater,
      auditMeta: buildAuditMeta(withUpdater),
    };
  },

  async notifyAssignment(client, performedById) {
    if (!client?.assignedTo?.email) return;

    try {
      const assignedBy = performedById
        ? await prisma.user.findUnique({
            where: { id: performedById },
            select: { name: true },
          })
        : null;

      await sendClientAssignmentEmail({
        toEmail: client.assignedTo.email,
        assigneeName: client.assignedTo.name,
        clientCompanyName: client.companyName,
        clientIndustry: client.industry,
        clientWebsite: client.website,
        clientLocation: client.location,
        clientStatus: client.status,
        clientPriority: client.priority,
        assignedByName: assignedBy?.name || null,
        senderUserId: performedById,
      });

      if (client.assignedToId) {
        await createAlertNotification(client.assignedToId, 'client.assigned', {
          category: 'CLIENT',
          title: 'Client assigned to you',
          description: `${client.companyName || 'A client'} was assigned to you${
            assignedBy?.name ? ` by ${assignedBy.name}` : ''
          }.`,
          actionLabel: 'Open client',
          actionPath: `/client?clientId=${client.id}`,
          entityType: 'CLIENT',
          entityId: client.id,
        });
      }
    } catch (emailError) {
      console.error('Failed to send client assignment email:', emailError);
    }
  },

  async notifyFollowUpReminder(client, performedById) {
    if (!client?.assignedTo?.email || !client?.nextFollowUpDue) return;
    try {
      await sendClientFollowUpReminderEmail({
        toEmail: client.assignedTo.email,
        recipientName: client.assignedTo.name,
        clientCompanyName: client.companyName,
        followUpDueDate: client.nextFollowUpDue,
        senderUserId: performedById,
      });
    } catch (emailError) {
      console.error('Failed to send client follow-up reminder email:', emailError);
    }
  },

  async create(data, req = null) {
    const companyName = String(data.companyName || '').trim();
    if (companyName && data.forceNew !== true) {
      const existing = await findLiveClientByCompanyName(companyName);
      if (existing) {
        console.log(
          `Reusing existing client ${existing.id} for "${companyName}" instead of creating a duplicate.`,
        );
        return prisma.client.findUnique({
          where: { id: existing.id },
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true },
            },
          },
        });
      }
    }

    // Handle hiringLocations - convert array to string or set to null
    let hiringLocationsValue = null;
    if (data.hiringLocations) {
      if (Array.isArray(data.hiringLocations)) {
        hiringLocationsValue = data.hiringLocations.length > 0 ? data.hiringLocations.join(', ') : null;
      } else if (typeof data.hiringLocations === 'string' && data.hiringLocations.trim()) {
        hiringLocationsValue = data.hiringLocations;
      }
    }

    const contactChannels = normalizeContactChannels(data);

    const clientData = {
      companyName: data.companyName,
      industry: data.industry,
      website: data.website,
      logo: data.logo,
      location: data.location,
      status: data.status || 'ACTIVE',
      assignedToId: data.assignedToId || data.performedById || undefined,
      createdById: data.createdById || data.performedById || undefined,
      participantIds: buildInitialParticipantIds(
        data.createdById || data.performedById,
        data.assignedToId || data.performedById,
      ),
      address: data.address,
      companySize: data.companySize,
      hiringLocations: hiringLocationsValue,
      linkedin: data.linkedin,
      timezone: data.timezone,
      priority: data.priority,
      servicesNeeded: data.servicesNeeded,
      expectedBusinessValue: data.expectedBusinessValue,
      leadStatus: data.leadStatus,
      sla: data.sla,
      // Smart-location autofill metadata (shared with Lead).
      city: data.city ?? undefined,
      state: data.state ?? undefined,
      country: data.country ?? undefined,
      latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : undefined,
      longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : undefined,
      directorSalutation: data.directorSalutation ?? undefined,
      teamMemberDesignation: data.teamMemberDesignation ?? undefined,
      teamMemberEmail: data.teamMemberEmail ?? undefined,
      teamMemberPhone: data.teamMemberPhone ?? undefined,
      emails: contactChannels.emails,
      phones: contactChannels.phones,
      // Lead-style next follow-up timestamp (Add Client form uses datetime-local now).
      nextFollowUpDue: data.nextFollowUpDue ? new Date(data.nextFollowUpDue) : undefined,
      // Agreements & Terms — single primary document attached during onboarding.
      agreementsFileName: data.agreementsFileName ?? undefined,
      agreementsFileUrl: data.agreementsFileUrl ?? undefined,
      agreementsUploadedAt: data.agreementsUploadedAt
        ? new Date(data.agreementsUploadedAt)
        : (data.agreementsFileUrl ? new Date() : undefined),
      ...buildAgreementTermsCreateFields(data),
      ...buildPostServiceKycFormCreateFields(data),
      otherDetails: normalizeClientOtherDetails(data.otherDetails),
      // Only include fields that exist in the Prisma schema
      // Removed: annualRevenue, taxId, paymentTerms, contractStartDate, contractEndDate,
      // billingEmail, billingPhone, billingAddress, notes, tags, hot (not in schema)
    };

    // Remove undefined values to avoid Prisma errors
    Object.keys(clientData).forEach(key => {
      if (clientData[key] === undefined) {
        delete clientData[key];
      }
    });

    const writeOrgUnitId = req ? await resolveWriteOrgUnitId(req).catch(() => null) : null;
    if (writeOrgUnitId) clientData.orgUnitId = writeOrgUnitId;

    // Log data being stored
    dbLogger.logCreate('CLIENT', clientData);

    if (data.performedById && clientData.assignedToId) {
      await assertCanAssignCrm(data.performedById, clientData.assignedToId, { req });
    }

    const client = await prisma.client.create({
      data: clientData,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    console.log(`✅ Client created successfully with ID: ${client.id}\n`);

    // Log client creation activity
    if (!data.skipSideEffects && data.performedById) {
      await activityService.logClientCreated({
        entityId: client.id,
        performedById: data.performedById,
        entityName: client.companyName,
        metadata: {
          industry: client.industry,
          status: client.status,
        },
        clientId: client.id,
      });
    }

    if (!data.skipSideEffects && client.assignedToId) {
      await this.notifyAssignment(client, data.performedById);
    }

    await mirrorClientRowToJobPortalDb(client);

    queueAiEntryRecommendation({
      entityType: 'CLIENT',
      entityId: client.id,
      entityLabel: client.companyName || 'Client',
      snapshot: buildEntitySnapshot('CLIENT', client),
      recipientUserId: client.assignedToId || data.performedById,
      actorUserId: data.performedById,
      trigger: 'create',
    });

    return client;
  },

  async update(id, data, req = null) {
    const scope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
    let accessWhere = mergeWhereWithScope({ id }, scope);
    accessWhere = await applyMemberClientScope(accessWhere, req);
    const allowed = await prisma.client.findFirst({
      where: accessWhere,
      select: { id: true },
    });
    if (!allowed) {
      throw new Error('Client not found');
    }

    // Get current client data to track changes
    const currentClient = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        industry: true,
        companySize: true,
        servicesNeeded: true,
        expectedBusinessValue: true,
        leadStatus: true,
        website: true,
        linkedin: true,
        location: true,
        timezone: true,
        status: true,
        assignedToId: true,
        createdById: true,
        participantIds: true,
        priority: true,
        sla: true,
        clientSince: true,
        nextFollowUpDue: true,
      },
    });

    if (!currentClient) {
      throw new Error('Client not found');
    }

    // Handle hiringLocations - convert array to string or set to null/undefined
    let hiringLocationsValue = undefined;
    if (data.hiringLocations !== undefined) {
      if (Array.isArray(data.hiringLocations)) {
        hiringLocationsValue = data.hiringLocations.length > 0 ? data.hiringLocations.join(', ') : null;
      } else if (typeof data.hiringLocations === 'string') {
        hiringLocationsValue = data.hiringLocations.trim() || null;
      } else if (data.hiringLocations === null) {
        hiringLocationsValue = null;
      }
    }

    const updateData = {
      companyName: data.companyName,
      industry: data.industry,
      website: data.website,
      logo: data.logo,
      location: data.location,
      status: data.status,
      assignedToId: data.assignedToId,
      address: data.address,
      companySize: data.companySize,
      hiringLocations: hiringLocationsValue,
      linkedin: data.linkedin,
      timezone: data.timezone,
      priority: data.priority,
      servicesNeeded: data.servicesNeeded,
      expectedBusinessValue: data.expectedBusinessValue,
      leadStatus: data.leadStatus,
      sla: data.sla,
      // Only include fields that exist in the Prisma schema
      // Removed: annualRevenue, taxId, paymentTerms, contractStartDate, contractEndDate,
      // billingEmail, billingPhone, billingAddress, notes, tags, hot (not in schema)
    };

    // Smart-location autofill metadata (shared with Lead) — only patch when caller sent the field.
    if (data.city !== undefined) updateData.city = data.city || null;
    if (data.state !== undefined) updateData.state = data.state || null;
    if (data.country !== undefined) updateData.country = data.country || null;
    if (data.latitude !== undefined) {
      const n = Number(data.latitude);
      updateData.latitude = Number.isFinite(n) ? n : null;
    }
    if (data.longitude !== undefined) {
      const n = Number(data.longitude);
      updateData.longitude = Number.isFinite(n) ? n : null;
    }
    if (data.directorSalutation !== undefined) {
      updateData.directorSalutation = data.directorSalutation || null;
    }
    if (data.teamMemberDesignation !== undefined) {
      updateData.teamMemberDesignation = data.teamMemberDesignation || null;
    }
    if (data.teamMemberEmail !== undefined) {
      updateData.teamMemberEmail = data.teamMemberEmail || null;
    }
    if (data.teamMemberPhone !== undefined) {
      updateData.teamMemberPhone = data.teamMemberPhone || null;
    }
    if (
      data.email !== undefined ||
      data.phone !== undefined ||
      data.emails !== undefined ||
      data.phones !== undefined
    ) {
      const existing = await prisma.client.findUnique({
        where: { id },
        select: { emails: true, phones: true },
      });
      const contactChannels = normalizeContactChannels({
        email: data.email,
        phone: data.phone,
        emails: data.emails !== undefined ? data.emails : existing?.emails,
        phones: data.phones !== undefined ? data.phones : existing?.phones,
      });
      updateData.emails = contactChannels.emails;
      updateData.phones = contactChannels.phones;
    }
    if (data.nextFollowUpDue !== undefined) {
      updateData.nextFollowUpDue = data.nextFollowUpDue ? new Date(data.nextFollowUpDue) : null;
    }

    // Agreements & Terms (single primary document) — only patch when the caller sent the field.
    if (data.agreementsFileName !== undefined) {
      updateData.agreementsFileName = data.agreementsFileName || null;
    }
    if (data.agreementsFileUrl !== undefined) {
      updateData.agreementsFileUrl = data.agreementsFileUrl || null;
      // Stamp uploadedAt automatically when a URL is set/cleared and caller didn't send one.
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
    applyPostServiceKycFormUpdateFields(data, updateData);
    if (data.otherDetails !== undefined) {
      updateData.otherDetails = normalizeClientOtherDetails(data.otherDetails);
    }

    // Remove undefined values to avoid Prisma errors
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    stampVisibilityOnAssigneeChange({
      updateData,
      previous: currentClient,
      performerId: data.performedById,
    });

    // Log data being updated
    dbLogger.logUpdate('CLIENT', id, updateData);

    if (data.performedById && data.assignedToId !== undefined && data.assignedToId) {
      const currentAssignee = String(currentClient?.assignedToId || '').trim();
      const nextAssignee = String(data.assignedToId || '').trim();
      if (nextAssignee && nextAssignee !== currentAssignee) {
        await assertCanAssignCrm(data.performedById, data.assignedToId, { req });
      }
    }

    const updated = await prisma.client.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    console.log(`✅ Client updated successfully (ID: ${id})\n`);

    // Log field changes as activities
    if (!data.skipSideEffects && data.performedById) {
      await activityService.logClientFieldChanges({
        entityId: id,
        performedById: data.performedById,
        oldData: currentClient,
        newData: updateData,
        clientId: id,
      });
    }

    if (
      !data.skipSideEffects &&
      data.assignedToId !== undefined &&
      data.assignedToId &&
      data.assignedToId !== currentClient.assignedToId
    ) {
      await this.notifyAssignment(updated, data.performedById);
    }

    const prevFollowUp = currentClient.nextFollowUpDue
      ? new Date(currentClient.nextFollowUpDue).getTime()
      : null;
    const nextFollowUp = updated.nextFollowUpDue
      ? new Date(updated.nextFollowUpDue).getTime()
      : null;
    if (!data.skipSideEffects && nextFollowUp && nextFollowUp !== prevFollowUp) {
      await this.notifyFollowUpReminder(updated, data.performedById);
    }

    await mirrorClientRowToJobPortalDb(updated);

    if (!data.skipSideEffects) {
      try {
        const performer = data.performedById
          ? await prisma.user.findUnique({
              where: { id: data.performedById },
              select: { name: true, firstName: true, lastName: true, email: true },
            })
          : null;
        const performerName = personName(performer);
        if (data.status !== undefined && data.status !== currentClient.status) {
          await notifyClientStatusChanged({
            client: updated,
            previousStatus: currentClient.status,
            newStatus: updated.status,
            performedById: data.performedById,
            performedByName: performerName,
          });
        }
        if (data.postServiceKycForm !== undefined) {
          await notifyClientKycIncomplete({
            client: updated,
            performedById: data.performedById,
          });
        }
      } catch (alertErr) {
        console.warn('[client.update] lifecycle alert failed:', alertErr?.message || alertErr);
      }
    }

    queueAiEntryRecommendation({
      entityType: 'CLIENT',
      entityId: updated.id,
      entityLabel: updated.companyName || 'Client',
      snapshot: buildEntitySnapshot('CLIENT', updated),
      recipientUserId: updated.assignedToId || data.performedById || req?.user?.id,
      actorUserId: data.performedById || req?.user?.id,
      trigger: 'update',
    });

    return updated;
  },

  async delete(id, performedById, req = null) {
    // Soft delete — keeps related rows (jobs, contacts, placements, activities) intact so a
    // restore from the Recycle Bin brings the full client back without surprises.
    const scope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
    let accessWhere = mergeWhereWithScope({ id }, scope);
    accessWhere = await applyMemberClientScope(accessWhere, req);
    const allowed = await prisma.client.findFirst({
      where: accessWhere,
      select: { id: true },
    });
    if (!allowed) {
      throw new Error('Client not found');
    }

    const client = await prisma.client.findUnique({
      where: { id },
      select: { companyName: true },
    });

    await prisma.client.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: performedById || null,
      },
    });

    if (performedById && client) {
      try {
        await activityService.logClientDeleted({
          entityId: id,
          performedById,
          entityName: client.companyName,
          clientId: id,
        });
      } catch (err) {
        console.error('Failed to log client delete activity:', err);
      }
    }

    return { message: 'Client moved to Recycle Bin' };
  },

  /**
   * Recycle Bin — list soft-deleted clients (newest first).
   * Scope mirrors getAll so non-admins only see their own deleted records.
   */
  async listTrash(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const superAdminScope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
    let where = { isDeleted: true };
    where = mergeWhereWithScope(where, superAdminScope);
    where = await applyMemberClientScope(where, req);

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: USER_BRIEF_SELECT },
        },
      }),
      prisma.client.count({ where }),
    ]);

    const withAudit = await prepareListWithAuditMeta(clients, ENTITY_TYPES.CLIENT);
    return formatPaginationResponse(withAudit, page, limit, total);
  },

  /** Recycle Bin — restore a soft-deleted client. */
  async restore(id, performedById /*, req = null */) {
    const client = await prisma.client.findFirst({
      where: { id, isDeleted: true },
      select: { id: true, companyName: true },
    });
    if (!client) {
      throw new Error('Deleted client not found');
    }
    await prisma.client.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null, deletedBy: null },
    });
    if (performedById) {
      try {
        await activityService.logClientDeleted({
          entityId: id,
          performedById,
          entityName: client.companyName,
          clientId: id,
          action: 'Client Restored',
          description: `Client "${client.companyName}" was restored from the Recycle Bin`,
        });
      } catch (err) {
        console.error('Failed to log client restore activity:', err);
      }
    }
    return { message: 'Client restored' };
  },

  /**
   * Recycle Bin — permanently delete a soft-deleted client. Mirrors the original hard-delete
   * cascade (clear Lead.convertedToClientId / Activity.clientId references first).
   */
  /**
   * Bulk permanent-delete (Recycle Bin → Delete forever). Delegates to `purge` per
   * id so the transactional cleanup of related rows stays identical. Sequential to
   * avoid stacking Prisma transactions in the same tenant DB.
   */
  async bulkPurge(ids, performedById, req = null) {
    const unique = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)));
    if (!unique.length) {
      return { success: 0, failed: 0, failures: [] };
    }
    let success = 0;
    const failures = [];
    for (const clientId of unique) {
      try {
        await this.purge(clientId, performedById, req);
        success += 1;
      } catch (err) {
        failures.push({ id: clientId, message: err?.message || 'Failed to purge client' });
      }
    }
    return { success, failed: failures.length, failures };
  },

  async purge(id /*, performedById, req = null */) {
    const client = await prisma.client.findFirst({
      where: { id, isDeleted: true },
      select: { id: true },
    });
    if (!client) {
      throw new Error('Deleted client not found');
    }
    await prisma.$transaction(async (tx) => {
      await tx.lead.updateMany({
        where: { convertedToClientId: id },
        data: { convertedToClientId: null },
      });
      await tx.activity.updateMany({
        where: { clientId: id },
        data: { clientId: null },
      });
      await tx.client.delete({ where: { id } });
    });
    return { message: 'Client permanently deleted' };
  },

  async getActivities(clientId, viewerUserId = null) {
    return activityService.getClientActivities({ clientId, limit: 100, viewerUserId });
  },

  async getMetrics(req = {}) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Active Clients
    const superAdminClientScope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
    const superAdminJobScope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
    const superAdminCandidateScope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);

    // Placements this month
    // Count only confirmed joins (status=JOINED) within the month.
    // Using joining date prevents counting offers created this month but not joined yet.
    const superAdminPlacementScope = buildSuperAdminOwnerScope(req, ['recruiterId']);
    const joinedInRangeWhere = (from, to) =>
      mergeWhereWithScope({
        status: 'JOINED',
        deletedAt: null,
        OR: [
          { actualJoiningDate: { gte: from, ...(to ? { lte: to } : {}) } },
          { joiningDate: { gte: from, ...(to ? { lte: to } : {}) } },
        ],
      }, superAdminPlacementScope);

    const includeSystemClients = req?.query?.includeSystem === 'true';
    const clientBaseWhere = applySystemWorkspaceExclusion({}, includeSystemClients);

    const [
      activeClients,
      activeClientsLastMonth,
      openJobs,
      openJobsLastMonth,
      candidatesInProgress,
      candidatesInProgressLastMonth,
      placementsThisMonth,
      placementsLastMonth,
      revenueThisMonth,
      revenueLastMonth,
    ] = await Promise.all([
      prisma.client.count({
        where: mergeWhereWithScope({ ...clientBaseWhere, status: 'ACTIVE' }, superAdminClientScope),
      }),
      prisma.client.count({
        where: mergeWhereWithScope(
          {
            ...clientBaseWhere,
            status: 'ACTIVE',
            createdAt: { lte: endOfLastMonth },
          },
          superAdminClientScope
        ),
      }),
      prisma.job.count({ where: mergeWhereWithScope({ status: 'OPEN' }, superAdminJobScope) }),
      prisma.job.count({
        where: mergeWhereWithScope(
          {
            status: 'OPEN',
            createdAt: { lte: endOfLastMonth },
          },
          superAdminJobScope
        ),
      }),
      prisma.candidate.count({ where: mergeWhereWithScope({ status: 'ACTIVE' }, superAdminCandidateScope) }),
      prisma.candidate.count({
        where: mergeWhereWithScope(
          {
            status: 'ACTIVE',
            createdAt: { lte: endOfLastMonth },
          },
          superAdminCandidateScope
        ),
      }),
      prisma.placement.count({
        where: joinedInRangeWhere(startOfMonth, null),
      }),
      prisma.placement.count({
        where: joinedInRangeWhere(startOfLastMonth, endOfLastMonth),
      }),
      prisma.placement.aggregate({
        where: joinedInRangeWhere(startOfMonth, null),
        _sum: { fee: true },
      }),
      prisma.placement.aggregate({
        where: joinedInRangeWhere(startOfLastMonth, endOfLastMonth),
        _sum: { fee: true },
      }),
    ]);

    // Calculate percentage changes
    const calculateTrend = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const activeClientsTrend = calculateTrend(activeClients, activeClientsLastMonth);
    const openJobsTrend = calculateTrend(openJobs, openJobsLastMonth);
    const candidatesTrend = calculateTrend(candidatesInProgress, candidatesInProgressLastMonth);
    const placementsTrend = calculateTrend(placementsThisMonth, placementsLastMonth);
    
    const revenueCurrent = revenueThisMonth._sum.fee || 0;
    const revenuePrevious = revenueLastMonth._sum.fee || 0;
    const revenueTrend = calculateTrend(revenueCurrent, revenuePrevious);

    // Format revenue
    const formatRevenue = (amount) => {
      if (amount >= 1000000) {
        return `$${(amount / 1000000).toFixed(1)}M`;
      } else if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(1)}k`;
      }
      return `$${amount.toFixed(0)}`;
    };

    return {
      activeClients: {
        value: activeClients,
        trend: activeClientsTrend,
        trendUp: activeClientsTrend >= 0,
      },
      openJobs: {
        value: openJobs,
        trend: openJobsTrend,
        trendUp: openJobsTrend >= 0,
      },
      candidatesInProgress: {
        value: candidatesInProgress,
        trend: candidatesTrend,
        trendUp: candidatesTrend >= 0,
      },
      placementsThisMonth: {
        value: placementsThisMonth,
        trend: placementsTrend,
        trendUp: placementsTrend >= 0,
      },
      revenueGenerated: {
        value: revenueCurrent,
        formatted: formatRevenue(revenueCurrent),
        trend: revenueTrend,
        trendUp: revenueTrend >= 0,
      },
    };
  },

  async importClients({ rows = [], mapping = {}, duplicateRule = 'skip', performedById, performedByRole }, req = null) {
    const results = {
      total: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const nameColumn = mapping.name;
    const normalizedImportNames = nameColumn
      ? Array.from(
          new Set(
            rows
              .map((row) => String(row?.[nameColumn] ?? '').trim())
              .filter(Boolean)
              .map((name) => name.toLowerCase())
          )
        )
      : [];

    const preloadedClients = normalizedImportNames.length
      ? await prisma.client.findMany({
          where: {
            companyName: {
              in: rows
                .map((row) => String(row?.[nameColumn] ?? '').trim())
                .filter(Boolean),
            },
          },
          select: { id: true, companyName: true },
        })
      : [];

    const existingClientByName = new Map(
      preloadedClients.map((client) => [String(client.companyName || '').trim().toLowerCase(), client])
    );

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const payload = buildClientImportPayload(row, mapping);
      const companyName = payload.companyName;
      if (!companyName) {
        results.failed += 1;
        results.errors.push(`Row ${index + 1}: Company name missing`);
        continue;
      }

      const upsertPrimaryContact = async (companyId) => {
        const contactPerson = payload.contactPerson || '';
        const email = payload.email || '';
        const phone = payload.phone || '';
        const teamName = payload.companySize || '';
        const location = payload.location || '';
        if (!contactPerson && !email && !phone) return;

        const firstName = contactPerson.split(' ')[0] || 'Unknown';
        const lastName = contactPerson.split(' ').slice(1).join(' ') || '';

        if (email) {
          const normalizedEmail = email.toLowerCase().trim();
          const existingByEmail = await prisma.contact.findUnique({
            where: { email: normalizedEmail },
          });
          const sharedContactFields = {
            firstName,
            lastName,
            phone: phone || null,
            designation: 'Director',
            department: teamName || null,
            location: location || null,
            companyId,
            ownerId: payload.assignedToId || null,
          };

          if (existingByEmail) {
            if (String(existingByEmail.companyId || '') === String(companyId)) {
              await prisma.contact.update({
                where: { id: existingByEmail.id },
                data: sharedContactFields,
              });
              return;
            }

            // Email already belongs to another client — keep the real email on the Client row only.
            const placeholderEmail = `client-${companyId}-director@placeholder.local`;
            const existingPlaceholder = await prisma.contact.findUnique({
              where: { email: placeholderEmail },
            });
            if (existingPlaceholder) {
              await prisma.contact.update({
                where: { id: existingPlaceholder.id },
                data: sharedContactFields,
              });
              return;
            }

            await prisma.contact.create({
              data: {
                ...sharedContactFields,
                email: placeholderEmail,
                tags: [],
                associatedJobIds: [],
              },
            });
            return;
          }

          await prisma.contact.create({
            data: {
              ...sharedContactFields,
              email: normalizedEmail,
              tags: [],
              associatedJobIds: [],
            },
          });
          return;
        }

        await prisma.contact.create({
          data: {
            firstName,
            lastName,
            email: `client-${companyId}-director@placeholder.local`,
            phone: phone || null,
            designation: 'Director',
            department: teamName || null,
            location: location || null,
            companyId,
            ownerId: payload.assignedToId || null,
            tags: [],
            associatedJobIds: [],
          },
        });
      };

      try {
        const normalizedCompanyName = companyName.toLowerCase();
        let existing = existingClientByName.get(normalizedCompanyName) || null;

        if (!existing) {
          existing = await findExistingClientImportDuplicate(companyName);

          if (existing) {
            existingClientByName.set(normalizedCompanyName, existing);
          }
        }

        if (existing && duplicateRule === 'skip') {
          results.skipped += 1;
          continue;
        }

        if (existing && duplicateRule === 'update') {
          const existingWithDetails = await prisma.client.findUnique({
            where: { id: existing.id },
            select: { otherDetails: true },
          });
          await this.update(
            existing.id,
            {
              ...payload,
              otherDetails: mergeClientImportOtherDetails(
                existingWithDetails?.otherDetails,
                payload.otherDetails
              ),
              performedById,
              skipSideEffects: true,
            },
            req,
          );
          await upsertPrimaryContact(existing.id);
          results.updated += 1;
          continue;
        }

        const createPayload =
          existing && duplicateRule === 'create'
            ? {
                ...payload,
                companyName: prefixDuplicateCopyClientName(
                  payload.companyName,
                  existing.companyName || payload.companyName || 'Client'
                ),
              }
            : payload;

        const createdClient = await this.create(
          {
            ...createPayload,
            performedById,
            performedByRole,
            skipSideEffects: true,
          },
          req,
        );
        existingClientByName.set(normalizedCompanyName, {
          id: createdClient.id,
          companyName: createdClient.companyName,
        });
        await upsertPrimaryContact(createdClient.id);
        results.created += 1;
      } catch (error) {
        results.failed += 1;
        results.errors.push(`Row ${index + 1}: ${error.message}`);
      }
    }

    return results;
  },

  async checkImportDuplicates({ rows = [], mapping = {} }) {
    const duplicates = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const payload = buildClientImportPayload(row, mapping);
      if (!payload.companyName) continue;

      const existing = await findExistingClientImportDuplicate(payload.companyName);
      if (!existing) continue;

      const primaryContact = Array.isArray(existing.contacts) && existing.contacts.length > 0
        ? existing.contacts[0]
        : null;
      const existingSnapshot = {
        id: existing.id,
        companyName: existing.companyName ?? null,
        industry: existing.industry ?? null,
        location: existing.location ?? null,
        city: existing.city ?? null,
        country: existing.country ?? null,
        contactPerson: [primaryContact?.firstName, primaryContact?.lastName].filter(Boolean).join(' ') || null,
        email: primaryContact?.email ?? null,
        phone: primaryContact?.phone ?? null,
        companySize: existing.companySize ?? null,
        servicesNeeded: existing.servicesNeeded ?? null,
        leadStatus: existing.leadStatus ?? null,
        priority: existing.priority ?? null,
        expectedBusinessValue: existing.expectedBusinessValue ?? null,
        notes: existing.address ?? null,
      };

      duplicates.push({
        rowIndex: index + 1,
        matchedBy: ['Company Name'],
        imported: buildClientImportComparisonSnapshot(payload),
        existing: {
          id: existing.id,
          ...buildClientImportComparisonSnapshot(existingSnapshot),
        },
      });
    }

    return {
      totalRows: rows.length,
      duplicateCount: duplicates.length,
      duplicates,
      compareFields: CLIENT_IMPORT_DUPLICATE_COMPARE_FIELDS,
    };
  },
};
