import { prisma, getActiveTenantDbName } from '../../config/prisma.js';

const PHASE2_MODULES = [
  'dashboard', 'leads', 'clients', 'jobs', 'candidates', 'pipeline', 'matches',
  'interviews', 'placements', 'contacts', 'reports', 'calendar', 'inbox', 'team',
  'billing', 'settings', 'ai', 'recruitment', 'events', 'other',
];

const FUNNEL_ORDER = ['leads', 'clients', 'jobs', 'candidates', 'pipeline', 'matches', 'interviews', 'placements'];

function categoryLabel(cat) {
  const labels = {
    jobs: 'Jobs',
    candidates: 'Candidates',
    leads: 'Leads',
    clients: 'Clients',
    contacts: 'Contacts',
    interviews: 'Interviews',
    placements: 'Placements',
    pipeline: 'Pipeline',
    matches: 'Matches',
    reports: 'Reports & analytics',
    calendar: 'Calendar & events',
    inbox: 'Inbox',
    team: 'Team',
    billing: 'Billing',
    settings: 'Settings',
    ai: 'AI workspace',
    events: 'Events',
    recruitment: 'Recruitment hub',
    dashboard: 'Dashboard',
    other: 'Other',
  };
  return labels[cat] || String(cat);
}

function normalizePayload(body, user) {
  const userId = String(body?.userId || user?.id || '').trim();
  if (!userId) {
    const err = new Error('userId is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const userName =
    String(body?.userName || '').trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.name ||
    user?.email ||
    undefined;

  const capturedAt = body?.capturedAt ? new Date(body.capturedAt) : new Date();
  if (Number.isNaN(capturedAt.getTime())) {
    const err = new Error('Invalid capturedAt');
    err.code = 'VALIDATION';
    throw err;
  }

  const payload = {
    userId,
    tenantDbName: String(body?.tenantDbName || getActiveTenantDbName() || '').trim() || undefined,
    userName,
    capturedAt: capturedAt.toISOString(),
    activityStateUpdatedAt: body?.activityStateUpdatedAt || undefined,
    rollupToday: body?.rollupToday ?? null,
    rollup7d: body?.rollup7d ?? null,
    triggers: Array.isArray(body?.triggers) ? body.triggers : [],
    sessionEngagement: body?.sessionEngagement ?? null,
    interestTopics: Array.isArray(body?.interestTopics) ? body.interestTopics : [],
    personalizedRecs: Array.isArray(body?.personalizedRecs) ? body.personalizedRecs : [],
    suggestions: Array.isArray(body?.suggestions) ? body.suggestions : [],
  };

  return { userId, userName, payload, capturedAt };
}

export async function upsertTenantBehaviorSnapshot({ body, user }) {
  const { userId, userName, payload, capturedAt } = normalizePayload(body, user);

  const requesterId = String(user?.id || '').trim();
  if (requesterId !== userId) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const row = await prisma.tenantBehaviorSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      userName: userName || null,
      payload,
      capturedAt,
    },
    update: {
      userName: userName || null,
      payload,
      capturedAt,
    },
  });

  return { snapshot: row, payload };
}

export async function getTenantBehaviorSnapshot(userId) {
  const id = String(userId || '').trim();
  if (!id) return null;
  const row = await prisma.tenantBehaviorSnapshot.findUnique({ where: { userId: id } });
  if (!row) return null;
  return {
    userId: row.userId,
    userName: row.userName,
    capturedAt: row.capturedAt.toISOString(),
    payload: row.payload,
  };
}

export async function listTenantBehaviorSnapshots({ limit = 100 } = {}) {
  const rows = await prisma.tenantBehaviorSnapshot.findMany({
    orderBy: { capturedAt: 'desc' },
    take: Math.min(Math.max(Number(limit) || 100, 1), 200),
  });
  return rows.map((row) => ({
    userId: row.userId,
    userName: row.userName,
    capturedAt: row.capturedAt.toISOString(),
    payload: row.payload,
  }));
}

/** Live CRM workload — all major Phase 2 entity counts. */
export async function getTenantCrmContext() {
  const now = new Date();
  const [
    openJobs,
    draftJobs,
    openCandidates,
    openLeads,
    openClients,
    openContacts,
    pendingInterviews,
    openPlacements,
    pendingTasks,
    pipelineEntries,
    openMatches,
    teamMembers,
  ] = await Promise.all([
    prisma.job.count({ where: { isDeleted: { not: true }, status: 'OPEN' } }).catch(() => 0),
    prisma.job.count({ where: { isDeleted: { not: true }, status: 'DRAFT' } }).catch(() => 0),
    prisma.candidate.count({ where: { isDeleted: { not: true } } }).catch(() => 0),
    prisma.lead.count({ where: { isDeleted: { not: true }, status: { notIn: ['CONVERTED', 'LOST', 'CLOSED'] } } }).catch(() => 0),
    prisma.client.count({ where: { isDeleted: { not: true } } }).catch(() => 0),
    prisma.contact.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
    prisma.interview.count({
      where: {
        scheduledAt: { gte: now },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'FEEDBACK_PENDING', 'RESCHEDULED'] },
      },
    }).catch(() => 0),
    prisma.placement.count({
      where: {
        status: { in: ['PENDING', 'ACTIVE', 'OFFER_SENT', 'OFFER_ACCEPTED', 'JOINING_SCHEDULED'] },
        deletedAt: null,
      },
    }).catch(() => 0),
    prisma.task.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL'] } } }).catch(() => 0),
    prisma.pipelineEntry.count().catch(() => 0),
    prisma.match.count().catch(() => 0),
    prisma.user.count({ where: { isActive: true } }).catch(() => 0),
  ]);

  return {
    openJobs,
    draftJobs,
    openCandidates,
    openLeads,
    openClients,
    openContacts,
    pendingInterviews,
    openPlacements,
    pendingTasks,
    pipelineEntries,
    openMatches,
    teamMembers,
    updatedAt: new Date().toISOString(),
  };
}

function mergeRollupMaps(target, source) {
  if (!source || typeof source !== 'object') return;
  for (const [k, v] of Object.entries(source)) {
    target[k] = (target[k] || 0) + Number(v || 0);
  }
}

function isOnline(iso, nowMs, windowMs = 3 * 60 * 1000) {
  if (!iso) return false;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) && nowMs - ts <= windowMs;
}

function computeTenantHealthScore({ activeRatio, actionRatio, avgWorkflow, triggerPressure }) {
  let score = 50;
  score += Math.min(25, activeRatio * 25);
  score += Math.min(20, actionRatio * 40);
  score += Math.min(15, (avgWorkflow / 100) * 15);
  score -= Math.min(30, triggerPressure * 5);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildIntelligenceSummary({ crmContext, weekMetrics, onlineCount, topTriggers, funnelProgress }) {
  const lines = [];
  if (onlineCount > 0) {
    lines.push(`${onlineCount} team member${onlineCount === 1 ? '' : 's'} active in CRM right now.`);
  }
  if (crmContext?.openLeads > 0 && (funnelProgress?.clients || 0) < 2) {
    lines.push(`${crmContext.openLeads} open leads — client conversion module activity is low.`);
  }
  if (crmContext?.openJobs > 0 && (funnelProgress?.candidates || 0) < 3) {
    lines.push(`${crmContext.openJobs} open jobs but limited candidate pipeline activity this week.`);
  }
  if (weekMetrics?.actions > 0) {
    lines.push(`${weekMetrics.actions} CRM actions recorded across the team in the last 7 days.`);
  }
  if (topTriggers?.length) {
    lines.push(`Top signal: ${topTriggers[0].title}.`);
  }
  if (!lines.length) {
    lines.push('Engine is live — use the CRM to build tenant behaviour intelligence.');
  }
  return lines;
}

function aggregateSnapshots(snapshots) {
  const moduleMap = new Map();
  const triggerMap = new Map();
  const actionBreakdown = {};
  const funnelProgress = {};
  const liveFeed = [];
  let totalVisits7d = 0;
  let totalActiveMs7d = 0;
  let totalActions7d = 0;
  let totalApiMutations7d = 0;
  let totalEntityViews7d = 0;
  let totalSearches7d = 0;
  let totalVisitsToday = 0;
  let totalActionsToday = 0;
  let totalActiveMsToday = 0;
  let activeUsers7d = 0;
  let workflowSum = 0;
  let workflowCount = 0;
  let triggerCountSum = 0;
  const nowMs = Date.now();

  const users = snapshots.map((snap) => {
    const payload = snap.payload || {};
    const rollup7d = payload.rollup7d || {};
    const rollupToday = payload.rollupToday || {};
    const visits7d = Number(rollup7d.visits || 0);
    const activeMs7d = Number(rollup7d.activeMs || 0);
    const actions7d = Number(rollup7d.actions || 0);
    const apiMutations7d = Number(rollup7d.apiMutations || 0);
    const entityViews7d = Number(rollup7d.entityViews || 0);
    const searches7d = Number(rollup7d.searches || 0);
    const visitsToday = Number(rollupToday.visits || 0);
    const actionsToday = Number(rollupToday.actions || 0);
    const activeMsToday = Number(rollupToday.activeMs || 0);
    const workflowScore = Number(rollup7d.workflowScore || 0);
    const triggers = Array.isArray(payload.triggers) ? payload.triggers : [];
    const topTrigger = triggers[0];
    const lastActive = payload.activityStateUpdatedAt || snap.capturedAt;
    const online = isOnline(lastActive, nowMs);

    if (visits7d > 0 || activeMs7d > 0) activeUsers7d += 1;
    totalVisits7d += visits7d;
    totalActiveMs7d += activeMs7d;
    totalActions7d += actions7d;
    totalApiMutations7d += apiMutations7d;
    totalEntityViews7d += entityViews7d;
    totalSearches7d += searches7d;
    totalVisitsToday += visitsToday;
    totalActionsToday += actionsToday;
    totalActiveMsToday += activeMsToday;
    triggerCountSum += triggers.length;

    if (workflowScore > 0) {
      workflowSum += workflowScore;
      workflowCount += 1;
    }

    mergeRollupMaps(actionBreakdown, rollup7d.actionBreakdown || {});
    mergeRollupMaps(funnelProgress, rollup7d.funnelProgress || rollup7d.pageVisitsByCategory || {});

    for (const cat of PHASE2_MODULES) {
      const visits = Number(rollup7d.pageVisitsByCategory?.[cat] || 0);
      const activeMs = Number(rollup7d.activeMsByCategory?.[cat] || 0);
      const actions = Number(rollup7d.actionsByCategory?.[cat] || 0);
      const entityViews = Number(rollup7d.topEntities?.filter?.((e) => e.category === cat)?.length || 0);
      if (!visits && !activeMs && !actions) continue;
      const prev = moduleMap.get(cat) || { visits: 0, activeMs: 0, actions: 0, entityViews: 0 };
      prev.visits += visits;
      prev.activeMs += activeMs;
      prev.actions += actions;
      prev.entityViews += entityViews;
      moduleMap.set(cat, prev);
    }

    for (const trigger of triggers) {
      if (!trigger?.id) continue;
      const prev = triggerMap.get(trigger.id);
      if (!prev || (trigger.priority || 0) > (prev.priority || 0)) {
        triggerMap.set(trigger.id, trigger);
      }
    }

    for (const ev of [...(rollupToday.recentEvents || []), ...(rollup7d.recentEvents || [])].slice(0, 15)) {
      liveFeed.push({
        ...ev,
        userId: snap.userId,
        userName: snap.userName || payload.userName,
      });
    }

    return {
      userId: snap.userId,
      userName: snap.userName || payload.userName,
      capturedAt: snap.capturedAt,
      lastActive,
      online,
      visits7d,
      activeMs7d,
      actions7d,
      apiMutations7d,
      entityViews7d,
      workflowScore,
      visitsToday,
      actionsToday,
      triggerCount: triggers.length,
      topTrigger,
      currentPath: rollup7d.recentEvents?.[0]?.path,
      currentModule: rollup7d.recentEvents?.[0]?.category,
    };
  });

  liveFeed.sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0));

  const moduleMatrix = [...moduleMap.entries()]
    .map(([category, stats]) => ({
      category,
      label: categoryLabel(category),
      visits: stats.visits,
      activeMs: stats.activeMs,
      actions: stats.actions,
      entityViews: stats.entityViews,
      conversionRate: stats.visits > 0 ? Math.round((stats.actions / stats.visits) * 100) : 0,
    }))
    .sort((a, b) => b.visits * 10 + b.actions * 5 - (a.visits * 10 + a.actions * 5));

  const funnelSteps = FUNNEL_ORDER.map((cat) => ({
    category: cat,
    label: categoryLabel(cat),
    visits: Number(funnelProgress[cat] || 0),
  }));

  const topTriggers = [...triggerMap.values()].sort((a, b) => (b.priority || 0) - (a.priority || 0)).slice(0, 15);
  const onlineUsers = users.filter((u) => u.online);
  const avgWorkflow = workflowCount > 0 ? Math.round(workflowSum / workflowCount) : 0;
  const activeRatio = snapshots.length > 0 ? activeUsers7d / snapshots.length : 0;
  const actionRatio = totalVisits7d > 0 ? totalActions7d / totalVisits7d : 0;
  const triggerPressure = snapshots.length > 0 ? triggerCountSum / snapshots.length : 0;

  const weekMetrics = {
    visits: totalVisits7d,
    actions: totalActions7d,
    apiMutations: totalApiMutations7d,
    entityViews: totalEntityViews7d,
    searches: totalSearches7d,
    activeMs: totalActiveMs7d,
    avgWorkflow,
  };

  const todayMetrics = {
    visits: totalVisitsToday,
    actions: totalActionsToday,
    activeMs: totalActiveMsToday,
  };

  return {
    userCount: snapshots.length,
    activeUsers7d,
    onlineCount: onlineUsers.length,
    totalVisits7d,
    totalActiveMs7d,
    totalActions7d,
    totalApiMutations7d,
    totalEntityViews7d,
    totalSearches7d,
    weekMetrics,
    todayMetrics,
    tenantHealthScore: computeTenantHealthScore({ activeRatio, actionRatio, avgWorkflow, triggerPressure }),
    topTriggers,
    users: users.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || b.visits7d - a.visits7d),
    moduleBreakdown: moduleMatrix.map(({ category, label, visits, activeMs }) => ({
      category,
      label,
      visits,
      activeMs,
    })),
    moduleMatrix,
    funnelSteps,
    actionBreakdown,
    liveFeed: liveFeed.slice(0, 60),
    onlineUsers,
  };
}

export async function buildTenantBehaviorAggregate() {
  const snapshots = await listTenantBehaviorSnapshots({ limit: 200 });
  return aggregateSnapshots(snapshots);
}

/** Full live tenant intelligence — CRM context + behaviour + feed. */
export async function buildTenantLiveDashboard() {
  const [snapshots, crmContext] = await Promise.all([
    listTenantBehaviorSnapshots({ limit: 200 }),
    getTenantCrmContext(),
  ]);
  const aggregated = aggregateSnapshots(snapshots);
  const intelligenceSummary = buildIntelligenceSummary({
    crmContext,
    weekMetrics: aggregated.weekMetrics,
    onlineCount: aggregated.onlineCount,
    topTriggers: aggregated.topTriggers,
    funnelProgress: aggregated.funnelSteps.reduce((acc, s) => {
      acc[s.category] = s.visits;
      return acc;
    }, {}),
  });

  return {
    serverTime: new Date().toISOString(),
    tenantDbName: getActiveTenantDbName() || null,
    crmContext,
    intelligenceSummary,
    ...aggregated,
  };
}

/**
 * Single API response — all tenant behaviour data for every user.
 * Mirrors Phase 1 GET /api/hq-behavior aggregated view.
 */
export async function buildAllTenantBehaviorData() {
  const [snapshots, crmContext, liveDashboard] = await Promise.all([
    listTenantBehaviorSnapshots({ limit: 200 }),
    getTenantCrmContext(),
    buildTenantLiveDashboard(),
  ]);

  const users = snapshots.map((snap) => ({
    userId: snap.userId,
    userName: snap.userName || snap.payload?.userName,
    capturedAt: snap.capturedAt,
    payload: snap.payload || {},
  }));

  return {
    serverTime: new Date().toISOString(),
    tenantDbName: getActiveTenantDbName() || null,
    userCount: users.length,
    crmContext,
    intelligenceSummary: liveDashboard.intelligenceSummary || [],
    tenantHealthScore: liveDashboard.tenantHealthScore || 0,
    users,
    liveDashboard,
  };
}
