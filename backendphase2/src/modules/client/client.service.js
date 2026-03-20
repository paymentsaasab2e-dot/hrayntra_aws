import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import activityService from '../../services/activityService.js';

export const clientService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, assignedToId, search } = req.query;

    const where = {};
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

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { jobs: true, contacts: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.count({ where }),
    ]);

    return formatPaginationResponse(clients, page, limit, total);
  },

  async getById(id) {
    const client = await prisma.client.findUnique({
      where: { id },
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

    // Log the fetched client data
    if (client) {
      console.log('\n=== FETCHED CLIENT DATA (getById) ===');
      console.log(JSON.stringify({
        id: client.id,
        companyName: client.companyName,
        industry: client.industry,
        companySize: client.companySize,
        website: client.website,
        linkedin: client.linkedin,
        location: client.location,
        hiringLocations: client.hiringLocations,
        timezone: client.timezone,
        priority: client.priority,
        sla: client.sla,
        clientSince: client.clientSince,
        nextFollowUpDue: client.nextFollowUpDue,
      }, null, 2));
    }

    return client;
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
      assignedToId: data.assignedToId,
      address: data.address,
      companySize: data.companySize,
      hiringLocations: hiringLocationsValue,
      linkedin: data.linkedin,
      timezone: data.timezone,
      priority: data.priority,
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
    });

    console.log(`✅ Client created successfully with ID: ${client.id}\n`);

    // Log client creation activity
    if (data.performedById) {
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

    return client;
  },

  async update(id, data) {
    // Get current client data to track changes
    const currentClient = await prisma.client.findUnique({
      where: { id },
      select: {
        companyName: true,
        industry: true,
        companySize: true,
        website: true,
        linkedin: true,
        location: true,
        timezone: true,
        status: true,
        assignedToId: true,
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

    // Log data being updated
    dbLogger.logUpdate('CLIENT', id, updateData);

    const updated = await prisma.client.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ Client updated successfully (ID: ${id})\n`);

    // Log field changes as activities
    if (data.performedById) {
      await activityService.logClientFieldChanges({
        entityId: id,
        performedById: data.performedById,
        oldData: currentClient,
        newData: updateData,
        clientId: id,
      });
    }

    return updated;
  },

  async delete(id, performedById) {
    // Get client data before deletion for activity log
    const client = await prisma.client.findUnique({
      where: { id },
      select: { companyName: true },
    });

    await prisma.client.delete({ where: { id } });

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

  async getMetrics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Active Clients
    const [activeClients, activeClientsLastMonth] = await Promise.all([
      prisma.client.count({ where: { status: 'ACTIVE' } }),
      prisma.client.count({
        where: {
          status: 'ACTIVE',
          createdAt: { lte: endOfLastMonth },
        },
      }),
    ]);

    // Open Jobs
    const [openJobs, openJobsLastMonth] = await Promise.all([
      prisma.job.count({ where: { status: 'OPEN' } }),
      prisma.job.count({
        where: {
          status: 'OPEN',
          createdAt: { lte: endOfLastMonth },
        },
      }),
    ]);

    // Candidates in Progress (ACTIVE status)
    const [candidatesInProgress, candidatesInProgressLastMonth] = await Promise.all([
      prisma.candidate.count({ where: { status: 'ACTIVE' } }),
      prisma.candidate.count({
        where: {
          status: 'ACTIVE',
          createdAt: { lte: endOfLastMonth },
        },
      }),
    ]);

    // Placements this month
    // Count only confirmed joins (status=JOINED) within the month.
    // Using joining date prevents counting offers created this month but not joined yet.
    const joinedInRangeWhere = (from, to) => ({
      status: 'JOINED',
      deletedAt: null,
      OR: [
        { actualJoiningDate: { gte: from, ...(to ? { lte: to } : {}) } },
        { joiningDate: { gte: from, ...(to ? { lte: to } : {}) } },
      ],
    });

    const [placementsThisMonth, placementsLastMonth] = await Promise.all([
      prisma.placement.count({
        where: joinedInRangeWhere(startOfMonth, null),
      }),
      prisma.placement.count({
        where: joinedInRangeWhere(startOfLastMonth, endOfLastMonth),
      }),
    ]);

    // Revenue this month
    // Sum only revenue from placements that actually joined in the month.
    const [revenueThisMonth, revenueLastMonth] = await Promise.all([
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
};
