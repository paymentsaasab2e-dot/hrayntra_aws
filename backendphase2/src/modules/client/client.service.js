import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import activityService from '../../services/activityService.js';
import { sendClientAssignmentEmail } from '../../services/emailService.js';
import { buildSuperAdminOwnerScope, mergeWhereWithScope } from '../../utils/superAdminScope.js';
import { canViewAllClients } from '../../utils/permissionScope.js';

/**
 * Recruiters / portal users: clients assigned to them, or they created/sourced (createdById).
 * Admins (canViewAllAssignments) and Super Admin “mine only” use other rules via mergeWhereWithScope.
 */
function applyMemberClientScope(scopedWhere, req) {
  if (canViewAllClients(req) || !req?.user?.id) {
    return scopedWhere;
  }
  return mergeWhereWithScope(scopedWhere, {
    OR: [{ assignedToId: req.user.id }, { createdById: req.user.id }],
  });
}

function applySystemWorkspaceExclusion(where = {}, includeSystem = false) {
  if (includeSystem) return where;

  const excludeWorkspaceWhere = {
    OR: [
      { industry: { not: 'Workspace' } },
      { companyName: { not: { endsWith: ' Workspace' } } },
    ],
  };

  if (!where || Object.keys(where).length === 0) {
    return excludeWorkspaceWhere;
  }

  return { AND: [where, excludeWorkspaceWhere] };
}

export const clientService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, assignedToId, search } = req.query;
    const includeContacts = req.query.includeContacts === 'true';
    const includeLeadFields = req.query.includeLeadFields === 'true';
    const includeSystemClients = req.query.includeSystem === 'true';

    let where = {};
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
        { website: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (req.query.hot !== undefined) where.hot = req.query.hot === 'true';
    if (req.query.tags) where.tags = { hasSome: Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags] };
    where = applySystemWorkspaceExclusion(where, includeSystemClients);

    const superAdminScope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
    let scopedWhere = mergeWhereWithScope(where, superAdminScope);
    scopedWhere = applyMemberClientScope(scopedWhere, req);
    const include = {
      assignedTo: {
        select: { id: true, name: true, email: true },
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
        orderBy: { createdAt: 'desc' },
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

    return formatPaginationResponse(mergedClients, page, limit, total);
  },

  async getById(id, req = null) {
    const scope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
    let scopedWhere = mergeWhereWithScope({ id }, scope);
    scopedWhere = applyMemberClientScope(scopedWhere, req);

    const client = await prisma.client.findFirst({
      where: scopedWhere,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true },
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

    return mergedClient;
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
    } catch (emailError) {
      console.error('Failed to send client assignment email:', emailError);
    }
  },

  async create(data) {
    // Handle hiringLocations - convert array to string or set to null
    let hiringLocationsValue = null;
    if (data.hiringLocations) {
      if (Array.isArray(data.hiringLocations)) {
        hiringLocationsValue = data.hiringLocations.length > 0 ? data.hiringLocations.join(', ') : null;
      } else if (typeof data.hiringLocations === 'string' && data.hiringLocations.trim()) {
        hiringLocationsValue = data.hiringLocations;
      }
    }

    const clientData = {
      companyName: data.companyName,
      industry: data.industry,
      website: data.website,
      logo: data.logo,
      location: data.location,
      status: data.status || 'PROSPECT',
      assignedToId: data.assignedToId || data.performedById || undefined,
      createdById: data.createdById || data.performedById || undefined,
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

    // Remove undefined values to avoid Prisma errors
    Object.keys(clientData).forEach(key => {
      if (clientData[key] === undefined) {
        delete clientData[key];
      }
    });

    // Log data being stored
    dbLogger.logCreate('CLIENT', clientData);

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

    return client;
  },

  async update(id, data, req = null) {
    const scope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
    let accessWhere = mergeWhereWithScope({ id }, scope);
    accessWhere = applyMemberClientScope(accessWhere, req);
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

    // Remove undefined values to avoid Prisma errors
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // First reassignment on legacy rows: record creator so assigner keeps list visibility after handoff
    if (
      data.performedById &&
      !currentClient.createdById &&
      data.assignedToId !== undefined &&
      data.assignedToId !== currentClient.assignedToId
    ) {
      updateData.createdById = data.performedById;
    }

    // Log data being updated
    dbLogger.logUpdate('CLIENT', id, updateData);

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

    return updated;
  },

  async delete(id, performedById, req = null) {
    const scope = buildSuperAdminOwnerScope(req, ['assignedToId', 'createdById']);
    let accessWhere = mergeWhereWithScope({ id }, scope);
    accessWhere = applyMemberClientScope(accessWhere, req);
    const allowed = await prisma.client.findFirst({
      where: accessWhere,
      select: { id: true },
    });
    if (!allowed) {
      throw new Error('Client not found');
    }

    // Get client data before deletion for activity log
    const client = await prisma.client.findUnique({
      where: { id },
      select: { companyName: true },
    });

    // Lead.convertedToClientId and Activity.clientId have no onDelete in schema — clear them or delete fails (P2003).
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

    // Log deletion activity
    if (performedById && client) {
      await activityService.logClientDeleted({
        entityId: id,
        performedById,
        entityName: client.companyName,
        clientId: id,
      });
    }

    return { message: 'Client deleted successfully' };
  },

  async getActivities(clientId) {
    return activityService.getClientActivities({ clientId, limit: 100 });
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

  async importClients({ rows = [], mapping = {}, duplicateRule = 'skip', performedById, performedByRole }) {
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

      const getValue = (key) => {
        const column = mapping[key];
        if (!column) return '';
        return String(row[column] ?? '').trim();
      };

      const extractLinksFromRow = () =>
        Object.values(row)
          .flatMap((value) => String(value ?? '').match(/https?:\/\/[^\s,|]+/gi) || [])
          .map((value) => value.trim())
          .filter(Boolean);

      const normalizePriority = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized) return undefined;
        if (['hot', 'high', 'warm'].includes(normalized)) return 'High';
        if (['medium', 'med', 'moderate'].includes(normalized)) return 'Medium';
        if (['low', 'cold'].includes(normalized)) return 'Low';
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
      };

      const parseDateValue = (value) => {
        if (!value) return undefined;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
      };

      const companyName = getValue('name');
      if (!companyName) {
        results.failed += 1;
        results.errors.push(`Row ${index + 1}: Company name missing`);
        continue;
      }

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
      const priority = normalizePriority(getValue('priority'));
      const leadStatus = getValue('leadStatus');
      const nextFollowUpDue = parseDateValue(getValue('nextFollowUpDue'));
      const hiringLocations = [city, country].filter(Boolean).join(', ');
      const detectedLinks = extractLinksFromRow();
      const websiteValue = getValue('website');
      const linkedinValue = detectedLinks.find((link) => link.toLowerCase().includes('linkedin.com')) || '';
      const genericWebsiteValue =
        websiteValue ||
        detectedLinks.find((link) => !link.toLowerCase().includes('linkedin.com')) ||
        '';

      const payload = {
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
      };

      const upsertPrimaryContact = async (companyId) => {
        if (!contactPerson && !email && !phone) return;

        const firstName = contactPerson.split(' ')[0] || 'Unknown';
        const lastName = contactPerson.split(' ').slice(1).join(' ') || '';

        if (email) {
          await prisma.contact.upsert({
            where: { email },
            update: {
              firstName,
              lastName,
              phone: phone || null,
              designation: 'Director',
              department: teamName || null,
              location: location || null,
              companyId,
              ownerId: payload.assignedToId || null,
            },
            create: {
              firstName,
              lastName,
              email,
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
          return;
        }

        await prisma.contact.create({
          data: {
            firstName,
            lastName,
            email: null,
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
          existing = await prisma.client.findFirst({
            where: {
              companyName: {
                equals: companyName,
                mode: 'insensitive',
              },
            },
            select: { id: true, companyName: true },
          });

          if (existing) {
            existingClientByName.set(normalizedCompanyName, existing);
          }
        }

        if (existing && duplicateRule === 'skip') {
          results.skipped += 1;
          continue;
        }

        if (existing && duplicateRule === 'update') {
          await this.update(existing.id, { ...payload, performedById, skipSideEffects: true });
          await upsertPrimaryContact(existing.id);
          results.updated += 1;
          continue;
        }

        const createdClient = await this.create({
          ...payload,
          performedById,
          performedByRole,
          skipSideEffects: true,
        });
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
};
