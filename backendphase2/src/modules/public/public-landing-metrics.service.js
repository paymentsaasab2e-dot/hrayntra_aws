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

function startOfUtcDay(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addUtcDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function isoDate(d) {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

function pctDelta(curr, prev) {
  if (!Number.isFinite(curr)) return 0;
  if (!prev) return curr ? 100 : 0;
  return Number((((curr - prev) / prev) * 100).toFixed(1));
}

function classifySource(source) {
  const s = String(source || '').toLowerCase();
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('refer')) return 'referral';
  return 'portal';
}

function emptyDashboard() {
  return {
    openLeads: 0,
    leadsYesterday: 0,
    activeJobs: 0,
    jobsLast7: 0,
    jobsPrev7: 0,
    matchesToday: 0,
    matchesYesterday: 0,
    placements30d: 0,
    placementsPrior30d: 0,
    applicationByDay: new Map(),
    intakeByDay: new Map(),
    sources: { portal: 0, referral: 0, linkedin: 0 },
    shortlistByWeekday: Array.from({ length: 7 }, () => ({ total: 0, count: 0 })),
  };
}

function bumpDayMap(map, key, field, n = 1) {
  if (!key) return;
  const prev = map.get(key) || { portal: 0, referral: 0, linkedin: 0, total: 0 };
  prev[field] = (prev[field] || 0) + n;
  prev.total += n;
  map.set(key, prev);
}

async function tenantSafeCounts(tenantDbName) {
  return runWithTenantContext(tenantDbName, async () => {
    const soft = notSoftDeletedWhere();
    const now = new Date();
    const today = startOfUtcDay(now);
    const yesterday = addUtcDays(today, -1);
    const start7 = addUtcDays(today, -6);
    const start14 = addUtcDays(today, -13);
    const start10 = addUtcDays(today, -9);
    const start30 = addUtcDays(today, -29);
    const start60 = addUtcDays(today, -59);
    const startPrior30 = addUtcDays(today, -59);

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
      openLeads,
      leadsYesterday,
      jobsLast7,
      jobsPrev7,
      matchesToday,
      matchesYesterday,
      placements30d,
      placementsPrior30d,
      recentApps,
      recentCandidates,
      shortlistEvents,
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
      safeCount('openLeads', () =>
        prisma.lead.count({
          where: {
            AND: [
              soft,
              {
                OR: [{ convertedToClientId: null }, { convertedToClientId: { isSet: false } }],
              },
              { NOT: { status: { in: ['Converted', 'Lost', 'CLIENT', 'Won'] } } },
            ],
          },
        }),
      ),
      safeCount('leadsYesterday', () =>
        prisma.lead.count({
          where: { AND: [soft, { createdAt: { gte: yesterday, lt: today } }] },
        }),
      ),
      safeCount('jobsLast7', () =>
        prisma.job.count({
          where: { AND: [soft, { createdAt: { gte: start7 } }] },
        }),
      ),
      safeCount('jobsPrev7', () =>
        prisma.job.count({
          where: { AND: [soft, { createdAt: { gte: start14, lt: start7 } }] },
        }),
      ),
      safeCount('matchesToday', () => prisma.match.count({ where: { createdAt: { gte: today } } })),
      safeCount('matchesYesterday', () =>
        prisma.match.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
      ),
      safeCount('placements30d', () => prisma.placement.count({ where: { createdAt: { gte: start30 } } })),
      safeCount('placementsPrior30d', () =>
        prisma.placement.count({ where: { createdAt: { gte: startPrior30, lt: start30 } } }),
      ),
      safe('recentApps', () =>
        prisma.application.findMany({
          where: { appliedAt: { gte: start60 } },
          select: { appliedAt: true },
          take: 4000,
        }),
      []),
      safe('recentCandidates', () =>
        prisma.candidate.findMany({
          where: { AND: [soft, { createdAt: { gte: start10 } }] },
          select: { createdAt: true, source: true },
          take: 3000,
        }),
      []),
      safe('shortlistEvents', () =>
        prisma.applicationTimeline.findMany({
          where: { status: 'SHORTLISTED', occurredAt: { gte: start7 } },
          select: {
            occurredAt: true,
            application: { select: { appliedAt: true } },
          },
          take: 2000,
        }),
      []),
    ]);

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

    const applicationByDay = new Map();
    for (const row of Array.isArray(recentApps) ? recentApps : []) {
      const key = row?.appliedAt ? isoDate(row.appliedAt) : null;
      if (!key) continue;
      applicationByDay.set(key, (applicationByDay.get(key) || 0) + 1);
    }

    const intakeByDay = new Map();
    const sources = { portal: 0, referral: 0, linkedin: 0 };
    for (const row of Array.isArray(recentCandidates) ? recentCandidates : []) {
      const bucket = classifySource(row?.source);
      sources[bucket] += 1;
      const key = row?.createdAt ? isoDate(row.createdAt) : null;
      bumpDayMap(intakeByDay, key, bucket);
    }

    const shortlistByWeekday = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
    for (const row of Array.isArray(shortlistEvents) ? shortlistEvents : []) {
      const occurred = row?.occurredAt ? new Date(row.occurredAt) : null;
      const applied = row?.application?.appliedAt ? new Date(row.application.appliedAt) : null;
      if (!occurred || !applied) continue;
      const days = (occurred.getTime() - applied.getTime()) / 86400000;
      if (days < 0 || days > 60) continue;
      const weekday = occurred.getUTCDay();
      shortlistByWeekday[weekday].total += days;
      shortlistByWeekday[weekday].count += 1;
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
      dashboard: {
        openLeads,
        leadsYesterday,
        activeJobs: openJobs,
        jobsLast7,
        jobsPrev7,
        matchesToday,
        matchesYesterday,
        placements30d,
        placementsPrior30d,
        applicationByDay,
        intakeByDay,
        sources,
        shortlistByWeekday,
      },
    };
  });
}

function fillDateSeries(start, days, getter) {
  const rows = [];
  for (let i = 0; i < days; i += 1) {
    const d = addUtcDays(start, i);
    const key = isoDate(d);
    rows.push(getter(key, d));
  }
  return rows;
}

function weekdayLabel(index) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index] || 'Sun';
}

function buildDashboard(merged, today) {
  const start60 = addUtcDays(today, -59);
  const start10 = addUtcDays(today, -9);
  const applicationVolume = fillDateSeries(start60, 60, (key) => ({
    date: key,
    conversations: merged.applicationByDay.get(key) || 0,
  }));
  const candidateIntake = fillDateSeries(start10, 10, (key) => {
    const row = merged.intakeByDay.get(key) || { portal: 0, referral: 0, linkedin: 0 };
    return {
      day: new Date(`${key}T00:00:00.000Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      date: key,
      portal: row.portal || 0,
      referral: row.referral || 0,
      linkedin: row.linkedin || 0,
    };
  });

  const sourceTotal = merged.sources.portal + merged.sources.referral + merged.sources.linkedin;
  const share = (n) => (sourceTotal ? Math.round((n / sourceTotal) * 100) : 0);
  const hireSources = [
    { channel: 'portal', share: share(merged.sources.portal) },
    { channel: 'referral', share: share(merged.sources.referral) },
    { channel: 'linkedin', share: share(merged.sources.linkedin) },
  ];
  if (sourceTotal && hireSources.reduce((s, r) => s + r.share, 0) !== 100) {
    hireSources[0].share = Math.max(0, 100 - hireSources[1].share - hireSources[2].share);
  }

  const timeToShortlist = [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const bucket = merged.shortlistByWeekday[weekday] || { total: 0, count: 0 };
    const minutes = bucket.count ? Number((bucket.total / bucket.count).toFixed(1)) : 0;
    return { day: weekdayLabel(weekday), minutes };
  });

  return {
    kpis: {
      openLeads: { value: merged.openLeads, delta: pctDelta(merged.openLeads, merged.openLeads - merged.leadsYesterday), footnote: 'vs yesterday' },
      activeJobs: { value: merged.activeJobs, delta: pctDelta(merged.jobsLast7, merged.jobsPrev7), footnote: 'vs last week' },
      aiMatchesToday: { value: merged.matchesToday, delta: pctDelta(merged.matchesToday, merged.matchesYesterday), footnote: 'vs yesterday' },
      placements30d: { value: merged.placements30d, delta: pctDelta(merged.placements30d, merged.placementsPrior30d), footnote: 'vs prior 30d' },
    },
    applicationVolume,
    hireSources,
    hireSourcesDelta: 0,
    candidateIntake,
    timeToShortlist,
  };
}

/**
 * @returns {Promise<{ mode: 'live', metrics: object, funnel: object, leadStages: object, dashboard: object, tenantCount: number, capturedAt: string } | null>}
 */
export async function getPublicLandingMetrics() {
  if (String(process.env.LANDING_PUBLIC_METRICS || 'true').toLowerCase() === 'false') {
    return null;
  }

  const tenants = await safe('listTenants', () => headquartersAuthService.listTenants(), []);
  const list = Array.isArray(tenants) ? tenants.slice(0, 40) : [];
  if (!list.length) return null;

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
  const merged = emptyDashboard();

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

    const dash = row.dashboard;
    if (!dash) continue;
    merged.openLeads += dash.openLeads || 0;
    merged.leadsYesterday += dash.leadsYesterday || 0;
    merged.activeJobs += dash.activeJobs || 0;
    merged.jobsLast7 += dash.jobsLast7 || 0;
    merged.jobsPrev7 += dash.jobsPrev7 || 0;
    merged.matchesToday += dash.matchesToday || 0;
    merged.matchesYesterday += dash.matchesYesterday || 0;
    merged.placements30d += dash.placements30d || 0;
    merged.placementsPrior30d += dash.placementsPrior30d || 0;
    merged.sources.portal += dash.sources?.portal || 0;
    merged.sources.referral += dash.sources?.referral || 0;
    merged.sources.linkedin += dash.sources?.linkedin || 0;
    for (const [key, n] of dash.applicationByDay || []) {
      merged.applicationByDay.set(key, (merged.applicationByDay.get(key) || 0) + n);
    }
    for (const [key, val] of dash.intakeByDay || []) {
      const prev = merged.intakeByDay.get(key) || { portal: 0, referral: 0, linkedin: 0, total: 0 };
      prev.portal += val.portal || 0;
      prev.referral += val.referral || 0;
      prev.linkedin += val.linkedin || 0;
      prev.total += val.total || (val.portal || 0) + (val.referral || 0) + (val.linkedin || 0);
      merged.intakeByDay.set(key, prev);
    }
    for (let i = 0; i < 7; i += 1) {
      merged.shortlistByWeekday[i].total += dash.shortlistByWeekday?.[i]?.total || 0;
      merged.shortlistByWeekday[i].count += dash.shortlistByWeekday?.[i]?.count || 0;
    }
  }

  const today = startOfUtcDay(new Date());

  return {
    mode: 'live',
    available: true,
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
    dashboard: buildDashboard(merged, today),
  };
}
