/** Drop duplicated record names/labels. Keep ids + numeric stats for storage and audit. */

function asObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function slimEntity(e) {
  const row = asObj(e);
  if (!row) return null;
  return {
    key: row.key,
    entityType: row.entityType,
    entityId: row.entityId || row.id,
    category: row.category,
    views: Number(row.views || 0),
    clicks: Number(row.clicks || 0),
    actions: Number(row.actions || 0),
    lastAt: row.lastAt,
  };
}

function slimEvent(e) {
  const row = asObj(e);
  if (!row) return null;
  return {
    at: row.at,
    type: row.type,
    category: row.category,
    entityType: row.entityType,
    entityId: row.entityId,
    actionType: row.actionType,
    path: row.path,
  };
}

function slimTrigger(t) {
  const row = asObj(t);
  if (!row) return null;
  return {
    id: row.id,
    flag: row.flag,
    audience: row.audience,
    priority: Number(row.priority || 0),
    title: row.title || '',
    reason: row.reason || '',
    evidence: Array.isArray(row.evidence) ? row.evidence.slice(0, 8).map(String) : [],
    recommendedAction: row.recommendedAction || '',
  };
}

function slimRollup(rollup) {
  const r = asObj(rollup);
  if (!r) return null;
  return {
    range: r.range,
    fromDate: r.fromDate,
    toDate: r.toDate,
    logins: Number(r.logins || 0),
    visits: Number(r.visits || 0),
    entityClicks: Number(r.entityClicks || 0),
    entityViews: Number(r.entityViews || 0),
    searches: Number(r.searches || 0),
    actions: Number(r.actions || 0),
    apiMutations: Number(r.apiMutations || 0),
    activeMs: Number(r.activeMs || 0),
    avgActiveMsPerDay: Number(r.avgActiveMsPerDay || 0),
    sessionCount: Number(r.sessionCount || 0),
    daysActive: Number(r.daysActive || 0),
    workflowScore: Number(r.workflowScore || 0),
    pageVisitsByCategory: r.pageVisitsByCategory || {},
    activeMsByCategory: r.activeMsByCategory || {},
    actionsByCategory: r.actionsByCategory || {},
    actionBreakdown: r.actionBreakdown || {},
    firstOpenBreakdown: r.firstOpenBreakdown || {},
    topFirstOpen: r.topFirstOpen,
    funnelProgress: r.funnelProgress || {},
    topModules: Array.isArray(r.topModules)
      ? r.topModules.map((m) => ({
          key: m?.key,
          count: Number(m?.count || 0),
          activeMs: Number(m?.activeMs || 0),
        }))
      : [],
    topEntities: Array.isArray(r.topEntities)
      ? r.topEntities.map(slimEntity).filter(Boolean)
      : [],
    recentEvents: Array.isArray(r.recentEvents)
      ? r.recentEvents.slice(0, 40).map(slimEvent).filter(Boolean)
      : [],
    insights: Array.isArray(r.insights)
      ? r.insights.slice(0, 12).map((i) => ({
          id: i?.id,
          label: i?.label,
          severity: i?.severity,
          summary: i?.summary,
        }))
      : [],
  };
}

export function slimTenantBehaviorPayload(payload) {
  const p = asObj(payload);
  if (!p) return payload;
  return {
    userId: p.userId,
    tenantDbName: p.tenantDbName,
    capturedAt: p.capturedAt,
    activityStateUpdatedAt: p.activityStateUpdatedAt,
    rollupToday: slimRollup(p.rollupToday),
    rollup7d: slimRollup(p.rollup7d),
    rollupMonth: slimRollup(p.rollupMonth),
    rollupYear: slimRollup(p.rollupYear),
    triggers: Array.isArray(p.triggers) ? p.triggers.map(slimTrigger).filter(Boolean) : [],
    sessionEngagement: p.sessionEngagement
      ? {
          sessionCount: Number(p.sessionEngagement.sessionCount || 0),
          activeCount: Number(p.sessionEngagement.activeCount || 0),
          totalDurationMs: Number(p.sessionEngagement.totalDurationMs || 0),
          avgDurationMs: Number(p.sessionEngagement.avgDurationMs || 0),
          medianDurationMs: Number(p.sessionEngagement.medianDurationMs || 0),
        }
      : null,
    interestTopics: Array.isArray(p.interestTopics)
      ? p.interestTopics.map((t) => ({
          key: t?.key,
          score: Number(t?.score || 0),
        }))
      : [],
    personalizedRecs: Array.isArray(p.personalizedRecs)
      ? p.personalizedRecs.map((r) => ({
          id: r?.id,
          interestKey: r?.interestKey,
          interestScore: Number(r?.interestScore || 0),
          actionUrl: r?.actionUrl,
          priority: Number(r?.priority || 0),
        }))
      : [],
    suggestions: Array.isArray(p.suggestions)
      ? p.suggestions.map((s) => ({
          triggerId: s?.triggerId,
          slotId: s?.slotId,
          kind: s?.kind,
          actionUrl: s?.actionUrl,
          priority: Number(s?.priority || 0),
        }))
      : [],
  };
}
