import { prisma, runWithTenantContext } from '../../config/prisma.js';
import {
  buildTenantLiveDashboard,
  listTenantBehaviorSnapshots,
} from '../tenant-behavior/tenant-behavior.service.js';

function countEventType(snapshots, type, rangeDays = 7) {
  const fromTs = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const snap of snapshots) {
    const payload = snap.payload || {};
    for (const rollup of [payload.rollup7d, payload.rollupToday].filter(Boolean)) {
      for (const ev of rollup.recentEvents || []) {
        if (ev.type === type && Date.parse(ev.at) >= fromTs) count += 1;
      }
    }
  }
  return count;
}

function mergeInsights(snapshots) {
  const map = new Map();
  for (const snap of snapshots) {
    const insights = snap.payload?.rollup7d?.insights || [];
    for (const insight of insights) {
      if (!insight?.id || insight.id === 'balanced') continue;
      const prev = map.get(insight.id);
      if (!prev) map.set(insight.id, { ...insight, count: 1 });
      else prev.count += 1;
    }
  }
  return [...map.values()]
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 12)
    .map(({ count, ...rest }) => ({
      ...rest,
      summary: count > 1 ? `${rest.summary} (seen across ${count} users)` : rest.summary,
    }));
}

async function sessionEngagementFallback() {
  try {
    const [activeSessions, recentSessions, activeUsers] = await Promise.all([
      prisma.activeSession.count({ where: { sessionStatus: 'ACTIVE' } }).catch(() => 0),
      prisma.activeSession.findMany({
        orderBy: { lastActivity: 'desc' },
        take: 50,
        select: { loginTime: true, lastActivity: true, sessionStatus: true },
      }).catch(() => []),
      prisma.user.count({ where: { isActive: true } }).catch(() => 0),
    ]);

    const lastActivityAt = recentSessions[0]?.lastActivity?.toISOString?.() || null;
    const firstLogin = recentSessions.reduce((min, s) => {
      const t = s.loginTime ? Date.parse(s.loginTime) : NaN;
      return Number.isFinite(t) && t < min ? t : min;
    }, Date.now());

    return {
      activeSessions,
      activeUsers,
      lastActivityAt,
      firstActivityAt: Number.isFinite(firstLogin) ? new Date(firstLogin).toISOString() : null,
      totalLogins7d: recentSessions.length,
    };
  } catch {
    return null;
  }
}

function anonymizeFeed(feed = []) {
  return feed.slice(0, 40).map((item) => ({
    at: item.at,
    type: item.type,
    category: item.category,
    path: item.path,
    meta: item.meta,
  }));
}

/**
 * HQ view: aggregated tenant behaviour — no individual team member breakdown.
 * @param {{ tenantDbName: string, tenantMeta?: object, range?: 'today'|'week'|'month'|'year' }} args
 */
export async function getHqTenantBehaviorAnalysis({ tenantDbName, tenantMeta = {}, range = 'week' }) {
  const dbName = String(tenantDbName || '').trim();
  if (!dbName) {
    const err = new Error('tenantDbName is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const normalizedRange = ['today', 'week', 'month', 'year'].includes(range) ? range : 'week';
  const windowDays = normalizedRange === 'today' ? 1 : normalizedRange === 'month' ? 30 : normalizedRange === 'year' ? 365 : 7;

  return runWithTenantContext(dbName, async () => {
    const snapshots = await listTenantBehaviorSnapshots({ limit: 200 });
    const hasBehavior = snapshots.length > 0;
    const live = hasBehavior ? await buildTenantLiveDashboard(normalizedRange) : null;
    const sessionFallback = !hasBehavior ? await sessionEngagementFallback() : null;

    let totalLogins = 0;
    let totalSessions = 0;
    let lastActivityAt = null;
    let firstActivityAt = null;

    for (const snap of snapshots) {
      const payload = snap.payload || {};
      const rollup =
        normalizedRange === 'today'
          ? payload.rollupToday
          : normalizedRange === 'month'
            ? payload.rollupMonth || payload.rollup7d
            : normalizedRange === 'year'
              ? payload.rollupYear || payload.rollupMonth || payload.rollup7d
              : payload.rollup7d;
      totalLogins += Number(rollup?.logins || 0);
      totalSessions += Number(rollup?.sessionCount || 0);
      const candidates = [payload.activityStateUpdatedAt, snap.capturedAt, payload.capturedAt].filter(Boolean);
      for (const iso of candidates) {
        const ts = Date.parse(iso);
        if (!Number.isFinite(ts)) continue;
        if (!lastActivityAt || ts > Date.parse(lastActivityAt)) lastActivityAt = iso;
        if (!firstActivityAt || ts < Date.parse(firstActivityAt)) firstActivityAt = iso;
      }
    }

    const totalLogouts = countEventType(snapshots, 'session_end', windowDays);

    if (sessionFallback && !lastActivityAt) {
      lastActivityAt = sessionFallback.lastActivityAt;
      firstActivityAt = sessionFallback.firstActivityAt;
    }

    const trackedUsers = snapshots.length;
    const activeUsers = live?.periodMetrics?.activeUsers ?? live?.activeUsers7d ?? 0;
    const onlineNow = live?.onlineCount ?? sessionFallback?.activeSessions ?? 0;
    const period = live?.periodMetrics || {
      range: normalizedRange,
      windowDays,
      visits: 0,
      actions: 0,
      apiMutations: 0,
      entityViews: 0,
      searches: 0,
      activeMs: 0,
      logins: 0,
      sessions: 0,
      activeUsers: 0,
      avgWorkflow: 0,
    };

    return {
      tenantDbName: dbName,
      tenantName: tenantMeta.name || dbName,
      tenantEmail: tenantMeta.email || '',
      organizationType: tenantMeta.organizationType || '',
      planName: tenantMeta.subscriptionPlan?.name || 'Unassigned',
      capturedAt: new Date().toISOString(),
      dataSource: hasBehavior ? 'behavior_engine' : sessionFallback ? 'sessions_fallback' : 'none',
      range: normalizedRange,

      engagement: {
        trackedUsers,
        teamMembersTotal: live?.crmContext?.teamMembers ?? sessionFallback?.activeUsers ?? 0,
        activeUsers7d: activeUsers,
        onlineNow,
        totalLogins7d: totalLogins || (normalizedRange === 'week' ? sessionFallback?.totalLogins7d || 0 : 0),
        totalLogouts7d: totalLogouts,
        totalSessions7d: totalSessions,
        totalActiveMs7d: period.activeMs || live?.totalActiveMs7d || 0,
        totalActiveMsToday: live?.todayMetrics?.activeMs ?? 0,
        totalVisits7d: period.visits || live?.totalVisits7d || 0,
        totalActions7d: period.actions || live?.totalActions7d || 0,
        totalApiMutations7d: period.apiMutations || live?.totalApiMutations7d || 0,
        totalEntityViews7d: period.entityViews || live?.totalEntityViews7d || 0,
        totalSearches7d: period.searches || live?.totalSearches7d || 0,
        avgTimePerUser7d:
          activeUsers > 0 ? Math.round((period.activeMs || live?.totalActiveMs7d || 0) / activeUsers) : 0,
        lastActivityAt,
        firstActivityAt,
      },

      periodMetrics: period,
      tenantHealthScore: live?.tenantHealthScore ?? 0,
      weekMetrics: live?.weekMetrics ?? {
        visits: 0,
        actions: 0,
        apiMutations: 0,
        entityViews: 0,
        searches: 0,
        activeMs: 0,
        avgWorkflow: 0,
      },
      todayMetrics: live?.todayMetrics ?? { visits: 0, actions: 0, activeMs: 0 },
      crmContext: live?.crmContext ?? null,
      moduleMatrix: live?.moduleMatrix ?? [],
      funnelSteps: live?.funnelSteps ?? [],
      actionBreakdown: live?.actionBreakdown ?? {},
      topTriggers: live?.topTriggers ?? [],
      intelligenceSummary: (live?.intelligenceSummary ?? []).map((line) =>
        line.replace(/team member(s)?/gi, 'tenant users').replace(/this user/gi, 'this tenant'),
      ),
      insights: mergeInsights(snapshots),
      liveFeed: anonymizeFeed(live?.liveFeed),
    };
  });
}
