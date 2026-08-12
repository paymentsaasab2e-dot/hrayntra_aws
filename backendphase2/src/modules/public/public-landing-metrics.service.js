/**
 * Public, anonymized aggregate metrics for the employers marketing landing page.
 * Never returns PII, tenant IDs, record IDs, or private CRM fields.
 */
import { prisma, runWithTenantContext } from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';

function notSoftDeletedWhere() {
  return { OR: [{ isDeleted: false }, { isDeleted: null }, { isDeleted: { isSet: false } }] };
}

async function safe(label, fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[public-landing-metrics] ${label}:`, error?.message || error);
    return fallback;
  }
}

async function safeCount(label, fn) {
  return safe(label, fn, 0);
}

async function tenantSafeCounts(tenantDbName) {
  return runWithTenantContext(tenantDbName, async () => {
    const soft = notSoftDeletedWhere();
    const [
      openJobs,
      jobs,
      candidates,
      clients,
      leads,
      interviews,
      interviewsScheduled,
      placements,
      tasksOpen,
      matches,
      applications,
    ] = await Promise.all([
      safeCount('openJobs', () => prisma.job.count({ where: { AND: [soft, { status: 'OPEN' }] } })),
      safeCount('jobs', () => prisma.job.count({ where: soft })),
      safeCount('candidates', () => prisma.candidate.count({ where: soft })),
      safeCount('clients', () => prisma.client.count({ where: soft })),
      safeCount('leads', () => prisma.lead.count({ where: soft })),
      safeCount('interviews', () => prisma.interview.count()),
      safeCount('interviewsScheduled', () =>
        prisma.interview.count({
          where: { status: { in: ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'IN_PROGRESS'] } },
        }),
      ),
      safeCount('placements', () => prisma.placement.count()),
      safeCount('tasksOpen', () =>
        prisma.task.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL'] } } }),
      ),
      safeCount('matches', () => prisma.match.count().catch(() => 0)),
      safeCount('applications', () => prisma.application.count().catch(() => 0)),
    ]);

    // Lead stage buckets (status only — no lead identities)
    let leadStages = { NEW: 0, CONTACTED: 0, QUALIFIED: 0, MEETING: 0, PROPOSAL: 0, CONVERTED: 0, OTHER: 0 };
    try {
      const groups = await prisma.lead.groupBy({
        by: ['status'],
        where: soft,
        _count: { _all: true },
      });
      for (const row of groups || []) {
        const status = String(row.status || 'OTHER').toUpperCase();
        const n = row._count?._all || 0;
        if (status.includes('NEW') || status === 'OPEN') leadStages.NEW += n;
        else if (status.includes('CONTACT')) leadStages.CONTACTED += n;
        else if (status.includes('QUALIF')) leadStages.QUALIFIED += n;
        else if (status.includes('MEET') || status.includes('FOLLOW')) leadStages.MEETING += n;
        else if (status.includes('PROPOS') || status.includes('NEGOT')) leadStages.PROPOSAL += n;
        else if (status.includes('CONVERT') || status.includes('WON') || status.includes('CLIENT')) leadStages.CONVERTED += n;
        else leadStages.OTHER += n;
      }
    } catch {
      /* stage groupBy optional */
    }

    return {
      openJobs,
      jobs,
      candidates,
      clients,
      leads,
      interviews,
      interviewsScheduled,
      placements,
      tasksOpen,
      matches,
      applications,
      leadStages,
    };
  });
}

/**
 * @returns {Promise<{ mode: 'live', metrics: object, funnel: object, leadStages: object, tenantCount: number, capturedAt: string } | null>}
 */
export async function getPublicLandingMetrics() {
  if (String(process.env.LANDING_PUBLIC_METRICS || '').toLowerCase() !== 'true') {
    return null;
  }

  const tenants = await safe('listTenants', () => headquartersAuthService.listTenants(), []);
  const list = Array.isArray(tenants) ? tenants.slice(0, 40) : [];

  const snapshots = await Promise.all(
    list.map(async (t) => {
      const dbName = t.dbName || t.tenantDbName || t.name;
      if (!dbName) return null;
      try {
        return await tenantSafeCounts(dbName);
      } catch {
        return null;
      }
    }),
  );

  const totals = {
    activeJobs: 0,
    totalJobs: 0,
    totalCandidates: 0,
    totalClients: 0,
    activeLeads: 0,
    totalInterviews: 0,
    interviewsScheduled: 0,
    totalPlacements: 0,
    openTasks: 0,
    aiMatches: 0,
    applications: 0,
    activeRecruiters: list.length,
  };

  const leadStages = { NEW: 0, CONTACTED: 0, QUALIFIED: 0, MEETING: 0, PROPOSAL: 0, CLIENT: 0 };

  for (const row of snapshots) {
    if (!row) continue;
    totals.activeJobs += row.openJobs || 0;
    totals.totalJobs += row.jobs || 0;
    totals.totalCandidates += row.candidates || 0;
    totals.totalClients += row.clients || 0;
    totals.activeLeads += row.leads || 0;
    totals.totalInterviews += row.interviews || 0;
    totals.interviewsScheduled += row.interviewsScheduled || 0;
    totals.totalPlacements += row.placements || 0;
    totals.openTasks += row.tasksOpen || 0;
    totals.aiMatches += row.matches || 0;
    totals.applications += row.applications || 0;
    leadStages.NEW += row.leadStages?.NEW || 0;
    leadStages.CONTACTED += row.leadStages?.CONTACTED || 0;
    leadStages.QUALIFIED += row.leadStages?.QUALIFIED || 0;
    leadStages.MEETING += row.leadStages?.MEETING || 0;
    leadStages.PROPOSAL += row.leadStages?.PROPOSAL || 0;
    leadStages.CLIENT += row.leadStages?.CONVERTED || 0;
  }

  return {
    mode: 'live',
    tenantCount: list.length,
    capturedAt: new Date().toISOString(),
    metrics: totals,
    funnel: {
      leads: totals.activeLeads,
      clients: totals.totalClients,
      jobs: totals.activeJobs,
      candidates: totals.totalCandidates,
      interviews: totals.interviewsScheduled,
      placements: totals.totalPlacements,
    },
    leadStages,
  };
}
