import { categoryLabel, localDateKey } from './categories';
import { WORKFLOW_FUNNEL } from './path-entities';
import { getTopEntityFocus } from './store';
import type {
  TenantActionBreakdown,
  TenantActivityRollup,
  TenantActivityState,
  TenantBehaviourInsight,
  TenantBehaviourTrigger,
  TenantDayBucket,
  TenantActivityCategory,
} from './types';

function sumDays(days: TenantDayBucket[]) {
  const pageVisitsByCategory: Partial<Record<TenantActivityCategory, number>> = {};
  const activeMsByCategory: Partial<Record<TenantActivityCategory, number>> = {};
  const actionsByCategory: Partial<Record<TenantActivityCategory, number>> = {};
  const firstOpenBreakdown: Partial<Record<TenantActivityCategory, number>> = {};
  const actionBreakdown: TenantActionBreakdown = {};
  let logins = 0;
  let visits = 0;
  let entityClicks = 0;
  let entityViews = 0;
  let searches = 0;
  let actions = 0;
  let apiMutations = 0;
  let activeMs = 0;
  const sessionIdSet = new Set<string>();

  for (const day of days) {
    logins += day.logins;
    visits += day.visits;
    entityClicks += day.entityClicks || 0;
    entityViews += day.entityViews || 0;
    searches += day.searches || 0;
    actions += day.actions;
    apiMutations += day.apiMutations || 0;
    activeMs += day.activeMs;
    for (const [k, v] of Object.entries(day.pageVisitsByCategory || {})) {
      bump(pageVisitsByCategory, k as TenantActivityCategory, v || 0);
    }
    for (const [k, v] of Object.entries(day.activeMsByCategory || {})) {
      bump(activeMsByCategory, k as TenantActivityCategory, v || 0);
    }
    for (const [k, v] of Object.entries(day.actionsByCategory || {})) {
      bump(actionsByCategory, k as TenantActivityCategory, v || 0);
    }
    if (day.firstOpenCategory) {
      firstOpenBreakdown[day.firstOpenCategory] = (firstOpenBreakdown[day.firstOpenCategory] || 0) + 1;
    }
    for (const id of day.sessionIds || []) sessionIdSet.add(id);
  }

  return {
    logins,
    visits,
    entityClicks,
    entityViews,
    searches,
    actions,
    apiMutations,
    activeMs,
    sessionCount: sessionIdSet.size,
    pageVisitsByCategory,
    activeMsByCategory,
    actionsByCategory,
    firstOpenBreakdown,
    actionBreakdown,
  };
}

function bump(map: Partial<Record<TenantActivityCategory, number>>, key: TenantActivityCategory, n: number) {
  map[key] = (map[key] || 0) + n;
}

function topCategory(map: Partial<Record<TenantActivityCategory, number>>) {
  let best: TenantActivityCategory | undefined;
  let bestN = 0;
  for (const [k, v] of Object.entries(map)) {
    if ((v || 0) > bestN) {
      bestN = v || 0;
      best = k as TenantActivityCategory;
    }
  }
  return best;
}

function topModules(
  visits: Partial<Record<TenantActivityCategory, number>>,
  time: Partial<Record<TenantActivityCategory, number>>,
) {
  const keys = new Set([...Object.keys(visits), ...Object.keys(time)]);
  return [...keys]
    .map((key) => ({
      key,
      label: categoryLabel(key),
      count: visits[key as TenantActivityCategory] || 0,
      activeMs: time[key as TenantActivityCategory] || 0,
    }))
    .sort((a, b) => b.count * 10 + b.activeMs / 1000 - (a.count * 10 + a.activeMs / 1000))
    .slice(0, 10);
}

function computeFunnelProgress(pageVisits: Partial<Record<TenantActivityCategory, number>>) {
  const out: Partial<Record<TenantActivityCategory, number>> = {};
  for (const cat of WORKFLOW_FUNNEL) {
    out[cat] = pageVisits[cat] || 0;
  }
  return out;
}

function computeWorkflowScore(state: TenantActivityState, fromTs: number) {
  const journeys = (state.recentJourneys || []).filter((j) =>
    j.steps.some((s) => Date.parse(s.at) >= fromTs),
  );
  if (!journeys.length) return 0;
  const avgForward =
    journeys.reduce((sum, j) => sum + j.forwardSteps, 0) / Math.max(journeys.length, 1);
  const completed = journeys.filter((j) => j.completedFunnel).length;
  return Math.min(100, Math.round(avgForward * 15 + completed * 25));
}

export function buildTenantBehaviourInsights(
  rollup: Pick<
    TenantActivityRollup,
    | 'visits'
    | 'entityClicks'
    | 'entityViews'
    | 'searches'
    | 'actions'
    | 'apiMutations'
    | 'pageVisitsByCategory'
    | 'activeMsByCategory'
    | 'actionsByCategory'
    | 'logins'
    | 'activeMs'
    | 'workflowScore'
  >,
  crmSnapshot?: import('./types').TenantCrmSnapshot | null,
): TenantBehaviourInsight[] {
  const insights: TenantBehaviourInsight[] = [];
  const jobsVisits = rollup.pageVisitsByCategory.jobs || 0;
  const candidatesVisits = rollup.pageVisitsByCategory.candidates || 0;
  const leadsVisits = rollup.pageVisitsByCategory.leads || 0;
  const clientsVisits = rollup.pageVisitsByCategory.clients || 0;
  const interviewsVisits = rollup.pageVisitsByCategory.interviews || 0;
  const pipelineVisits = rollup.pageVisitsByCategory.pipeline || 0;
  const placementsVisits = rollup.pageVisitsByCategory.placements || 0;
  const reportsVisits = rollup.pageVisitsByCategory.reports || 0;
  const aiVisits = rollup.pageVisitsByCategory.ai || 0;
  const jobsActions = rollup.actionsByCategory?.jobs || 0;
  const candidateActions = rollup.actionsByCategory?.candidates || 0;
  const leadsMin = Math.round((rollup.activeMsByCategory.leads || 0) / 60000);

  if (jobsVisits >= 8 && candidatesVisits <= 2 && rollup.actions <= 2) {
    insights.push({
      id: 'jobs_no_candidate_flow',
      label: 'Jobs focus without candidate pipeline',
      severity: 'action',
      summary: 'Recruiter spends time in jobs but rarely moves to candidates or pipeline actions.',
      evidence: [`${jobsVisits} job visits`, `${candidatesVisits} candidate visits`, `${rollup.actions} actions`],
    });
  }

  if (leadsVisits >= 6 && clientsVisits <= 1 && leadsMin >= 5) {
    insights.push({
      id: 'lead_browse_no_convert',
      label: 'Lead research without client conversion',
      severity: 'watch',
      summary: 'Heavy lead module usage with little client conversion activity.',
      evidence: [`${leadsVisits} lead visits · ${leadsMin}m`, `${clientsVisits} client visits`],
    });
  }

  if (rollup.entityViews >= 10 && rollup.actions <= 2) {
    insights.push({
      id: 'detail_browse_no_action',
      label: 'Deep browsing without CRM updates',
      severity: 'action',
      summary: 'Opens many records but rarely creates, updates, or moves pipeline.',
      evidence: [`${rollup.entityViews} record views`, `${rollup.actions} actions`, `${rollup.apiMutations} API mutations`],
    });
  }

  if (interviewsVisits >= 5 && rollup.actions <= 2) {
    insights.push({
      id: 'interview_review_only',
      label: 'Interview browsing without scheduling actions',
      severity: 'watch',
      summary: 'Reviews interviews but rarely completes scheduling or update actions.',
      evidence: [`${interviewsVisits} interview visits`, `${rollup.actions} actions`],
    });
  }

  if (pipelineVisits >= 4 && candidateActions === 0 && jobsActions === 0) {
    insights.push({
      id: 'pipeline_passive',
      label: 'Pipeline watching without sourcing',
      severity: 'watch',
      summary: 'Monitors pipeline but does not create jobs or add candidates.',
      evidence: [`${pipelineVisits} pipeline visits`, `0 candidate/job actions`],
    });
  }

  if (reportsVisits >= 5 && jobsVisits + candidatesVisits <= 3) {
    insights.push({
      id: 'reports_only_mode',
      label: 'Reports-heavy, low operational CRM use',
      severity: 'info',
      summary: 'Mostly analytics/reports — may be management oversight rather than daily recruiting.',
      evidence: [`${reportsVisits} report visits`, `${jobsVisits + candidatesVisits} ops module visits`],
    });
  }

  if (rollup.searches >= 8 && rollup.actions <= 2) {
    insights.push({
      id: 'search_heavy_low_output',
      label: 'Search-heavy, low output',
      severity: 'watch',
      summary: 'Frequent filtering/searching across modules with few follow-up actions.',
      evidence: [`${rollup.searches} searches/filters`, `${rollup.actions} actions`],
    });
  }

  if (aiVisits >= 4) {
    insights.push({
      id: 'ai_adoption',
      label: 'Strong AI workspace adoption',
      severity: 'info',
      summary: 'Actively uses AI/brain tools — good candidate for advanced automation.',
      evidence: [`${aiVisits} AI workspace visits`],
    });
  }

  if (rollup.workflowScore >= 60) {
    insights.push({
      id: 'strong_workflow_progression',
      label: 'Strong end-to-end workflow progression',
      severity: 'info',
      summary: 'Moves forward across recruitment funnel modules within sessions.',
      evidence: [`Workflow score ${rollup.workflowScore}/100`],
    });
  }

  if (rollup.logins >= 5 && rollup.activeMs < 5 * 60 * 1000) {
    insights.push({
      id: 'short_sessions',
      label: 'Frequent short CRM sessions',
      severity: 'watch',
      summary: 'Logs in often but stays briefly — shallow engagement or fragmented workflow.',
      evidence: [`${rollup.logins} sessions`, `~${Math.round(rollup.activeMs / 60000)} min active`],
    });
  }

  const overdueFu = Number(crmSnapshot?.overdueFollowUps || 0);
  const overdueMtg = Number(crmSnapshot?.overdueMeetings || 0);
  const incompleteLeads = Number(crmSnapshot?.incompleteLeads || 0);
  const incompleteClients = Number(crmSnapshot?.incompleteClients || 0);

  if (overdueFu + overdueMtg > 0) {
    insights.push({
      id: 'crm_overdue_meetings',
      label: 'Overdue follow-ups / meetings',
      severity: 'action',
      summary: 'Drawer intelligence found overdue meetings that need completion.',
      evidence: [
        `${overdueFu} overdue follow-up${overdueFu === 1 ? '' : 's'}`,
        `${overdueMtg} overdue meeting${overdueMtg === 1 ? '' : 's'}`,
      ],
    });
  }

  if (incompleteLeads + incompleteClients > 0) {
    insights.push({
      id: 'crm_incomplete_records',
      label: 'Incomplete lead/client records',
      severity: 'watch',
      summary: 'Mandatory drawer fields are missing on active CRM records.',
      evidence: [
        `${incompleteLeads} incomplete lead${incompleteLeads === 1 ? '' : 's'}`,
        `${incompleteClients} incomplete client${incompleteClients === 1 ? '' : 's'}`,
      ],
    });
  }

  if (!insights.length) {
    insights.push({
      id: 'balanced',
      label: 'Balanced CRM activity',
      severity: 'info',
      summary: 'No strong imbalance detected — engine is collecting full lifecycle signals.',
      evidence: [`${rollup.visits} visits`, `${rollup.actions} actions`, `${Math.round(rollup.activeMs / 60000)} min active`],
    });
  }

  return insights;
}

export function buildTenantBehaviourTriggers(input: {
  insights: TenantBehaviourInsight[];
  rollup: Pick<
    TenantActivityRollup,
    | 'pageVisitsByCategory'
    | 'activeMsByCategory'
    | 'actionsByCategory'
    | 'actions'
    | 'entityClicks'
    | 'entityViews'
    | 'apiMutations'
    | 'workflowScore'
  >;
  topModules: TenantActivityRollup['topModules'];
  topEntities: TenantActivityRollup['topEntities'];
}): TenantBehaviourTrigger[] {
  const { insights, rollup, topModules, topEntities } = input;
  const out: TenantBehaviourTrigger[] = [];
  const top = topModules[0];
  const jobsVisits = rollup.pageVisitsByCategory.jobs || 0;
  const leadsVisits = rollup.pageVisitsByCategory.leads || 0;
  const candidatesVisits = rollup.pageVisitsByCategory.candidates || 0;
  const clientsVisits = rollup.pageVisitsByCategory.clients || 0;
  const interviewsVisits = rollup.pageVisitsByCategory.interviews || 0;
  const placementsVisits = rollup.pageVisitsByCategory.placements || 0;
  const aiVisits = rollup.pageVisitsByCategory.ai || 0;
  const reportsVisits = rollup.pageVisitsByCategory.reports || 0;
  const focusedEntity = topEntities[0];

  if (insights.some((i) => i.id === 'lead_browse_no_convert')) {
    out.push({
      id: 'tenant_lead_convert_gap',
      flag: 'ops_assist',
      audience: 'tenant_admin',
      title: 'Lead activity without client conversion',
      reason: 'Team member researches leads but rarely progresses to clients.',
      evidence: [`${leadsVisits} lead visits in 7 days`],
      recommendedAction: 'Review lead follow-ups and conversion playbook with this user.',
      priority: 84,
      comboSignals: ['leads_heavy', 'clients_low'],
    });
  }

  if (insights.some((i) => i.id === 'jobs_no_candidate_flow')) {
    out.push({
      id: 'tenant_job_pipeline_gap',
      flag: 'high_intent',
      audience: 'tenant_admin',
      title: 'Job management without pipeline movement',
      reason: 'Jobs module is active but candidate/pipeline work is lagging.',
      evidence: [`${jobsVisits} job visits`, `${rollup.actions} CRM actions`],
      recommendedAction: 'Coach on candidate submission and pipeline hygiene.',
      priority: 82,
      comboSignals: ['jobs_heavy', 'candidates_low'],
    });
  }

  if (insights.some((i) => i.id === 'detail_browse_no_action')) {
    out.push({
      id: 'tenant_browse_no_followthrough',
      flag: 'user_nudge',
      audience: 'both',
      title: 'Record research without follow-through',
      reason: 'Opens many CRM records but rarely saves, assigns, or moves pipeline.',
      evidence: [`${rollup.entityViews} views`, `${rollup.actions} actions`],
      recommendedAction: 'Nudge to complete next step: assign, schedule interview, or update stage.',
      priority: 86,
      comboSignals: ['entity_views_high', 'actions_low'],
    });
  }

  if (insights.some((i) => i.id === 'crm_overdue_meetings')) {
    out.push({
      id: 'tenant_overdue_meetings_nudge',
      flag: 'ops_assist',
      audience: 'both',
      title: 'Clear overdue meetings & follow-ups',
      reason: 'Drawer intelligence detected overdue CRM meetings that block pipeline progress.',
      evidence: insights.find((i) => i.id === 'crm_overdue_meetings')?.evidence || [],
      recommendedAction: 'Open Leads/Clients and complete or reschedule overdue items now.',
      priority: 94,
      comboSignals: ['overdue_followups', 'drawer_engine'],
    });
  }

  if (insights.some((i) => i.id === 'crm_incomplete_records')) {
    out.push({
      id: 'tenant_incomplete_records_nudge',
      flag: 'user_nudge',
      audience: 'both',
      title: 'Fill missing mandatory CRM fields',
      reason: 'Records are opened with incomplete mandatory drawer data.',
      evidence: insights.find((i) => i.id === 'crm_incomplete_records')?.evidence || [],
      recommendedAction: 'Open incomplete leads/clients and fill company, contact, and phone/email.',
      priority: 88,
      comboSignals: ['incomplete_records', 'drawer_engine'],
    });
  }

  if (focusedEntity && focusedEntity.views + focusedEntity.clicks >= 6 && focusedEntity.actions === 0) {
    out.push({
      id: 'tenant_entity_stuck',
      flag: 'watch',
      audience: 'tenant_admin',
      title: `Repeated focus: ${focusedEntity.label || focusedEntity.entityType}`,
      reason: 'Same record revisited many times without a tracked action.',
      evidence: [`${focusedEntity.views} views`, `${focusedEntity.clicks} clicks`, `0 actions on record`],
      recommendedAction: 'Check if user is blocked — missing info, approval, or client feedback.',
      priority: 80,
      comboSignals: ['entity_repeat', 'actions_low'],
    });
  }

  if (top && top.count >= 6) {
    out.push({
      id: 'tenant_module_focus',
      flag: 'watch',
      audience: 'both',
      title: `Primary focus: ${top.label}`,
      reason: 'User concentrates on one CRM module repeatedly.',
      evidence: [`${top.count} visits · ${Math.round(top.activeMs / 60000)}m in ${top.label}`],
      recommendedAction: 'Ensure cross-module workflow (jobs → candidates → interviews) is balanced.',
      priority: 70,
      comboSignals: ['module_concentration'],
    });
  }

  if (aiVisits >= 4 && jobsVisits >= 4 && rollup.actions <= 3) {
    out.push({
      id: 'tenant_ai_ops_combo',
      flag: 'ops_assist',
      audience: 'tenant_admin',
      title: 'AI + jobs research without follow-through',
      reason: 'Uses AI and jobs modules but few tracked operational actions.',
      evidence: [`${aiVisits} AI visits`, `${jobsVisits} job visits`, `${rollup.apiMutations} mutations`],
      recommendedAction: 'Offer workflow training or templates to convert research into actions.',
      priority: 78,
      comboSignals: ['ai_heavy', 'jobs_heavy', 'low_actions'],
    });
  }

  if (rollup.workflowScore >= 65) {
    out.push({
      id: 'tenant_strong_operator',
      flag: 'high_intent',
      audience: 'tenant_admin',
      title: 'Strong end-to-end CRM operator',
      reason: 'Progresses across funnel modules with meaningful forward workflow steps.',
      evidence: [`Workflow score ${rollup.workflowScore}/100`, `${rollup.actions} actions`],
      recommendedAction: 'Consider for advanced modules, team lead responsibilities, or automation pilots.',
      priority: 72,
      comboSignals: ['workflow_forward', 'actions_present'],
    });
  }

  if (reportsVisits >= 6 && rollup.actions <= 2) {
    out.push({
      id: 'tenant_analytics_only',
      flag: 'user_nudge',
      audience: 'user',
      title: 'Analytics-heavy session pattern',
      reason: 'Mostly viewing reports without operational CRM updates.',
      evidence: [`${reportsVisits} report visits`],
      recommendedAction: 'Nudge user toward actionable modules (candidates, interviews, placements).',
      priority: 65,
      comboSignals: ['reports_heavy'],
    });
  }

  if (interviewsVisits >= 5 && placementsVisits <= 1 && rollup.actions >= 3) {
    out.push({
      id: 'tenant_placement_gap',
      flag: 'ops_assist',
      audience: 'both',
      title: 'Interviews without placement follow-through',
      reason: 'Active in interviews but placements module is barely used — offers may be stalling.',
      evidence: [`${interviewsVisits} interview visits`, `${placementsVisits} placement visits`, `${rollup.actions} actions`],
      recommendedAction: 'Move completed interviews to offer/placement stage.',
      priority: 83,
      comboSignals: ['interviews_heavy', 'placements_low'],
    });
  }

  if (rollup.entityViews >= 15 && rollup.apiMutations >= 5 && rollup.workflowScore < 30) {
    out.push({
      id: 'tenant_onboarding_struggle',
      flag: 'ops_assist',
      audience: 'tenant_admin',
      title: 'High activity but low workflow progression',
      reason: 'Many record views and API calls but funnel progression score is low — possible onboarding or setup gap.',
      evidence: [`${rollup.entityViews} views`, `${rollup.apiMutations} mutations`, `workflow ${rollup.workflowScore}/100`],
      recommendedAction: 'Review team setup, module enablement, and recruitment funnel training.',
      priority: 81,
      comboSignals: ['high_mutations', 'low_workflow', 'entity_views_high'],
    });
  }

  if (leadsVisits >= 4 && clientsVisits >= 2 && jobsVisits >= 4 && candidatesVisits >= 3 && rollup.workflowScore >= 50) {
    out.push({
      id: 'tenant_full_funnel_active',
      flag: 'high_intent',
      audience: 'tenant_admin',
      title: 'Full recruitment funnel active',
      reason: 'User touches leads, clients, jobs, and candidates with strong workflow score.',
      evidence: [`Leads ${leadsVisits}`, `Clients ${clientsVisits}`, `Jobs ${jobsVisits}`, `Candidates ${candidatesVisits}`, `workflow ${rollup.workflowScore}/100`],
      recommendedAction: 'Tenant is operating well — consider upsell on advanced AI or automation modules.',
      priority: 68,
      comboSignals: ['full_funnel', 'workflow_forward'],
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

export function buildTenantActivityRollup(
  state: TenantActivityState,
  range: TenantActivityRollup['range'] = 'week',
): TenantActivityRollup | null {
  if (!state?.userId) return null;
  const today = localDateKey();
  let fromDate = today;
  if (range === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    fromDate = localDateKey(d);
  } else if (range === 'month') {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    fromDate = localDateKey(d);
  } else if (range === 'all') {
    const keys = Object.keys(state.days).sort();
    fromDate = keys[0] || today;
  }

  const keys =
    range === 'all'
      ? Object.keys(state.days).sort()
      : Object.keys(state.days)
          .filter((k) => k >= fromDate && k <= today)
          .sort();
  const days = keys.map((k) => state.days[k]).filter(Boolean) as TenantDayBucket[];
  const summed = sumDays(days);

  // Merge action breakdown from state totals for the window (approximation from totals when day-level missing)
  const actionBreakdown = { ...(state.totals.actionBreakdown || {}) };

  const daysActive = days.filter((d) => d.visits > 0 || d.activeMs > 0).length;
  const avgActiveMsPerDay = daysActive > 0 ? Math.round(summed.activeMs / daysActive) : 0;
  const fromTs = Date.parse(`${fromDate}T00:00:00`);
  const workflowScore = computeWorkflowScore(state, fromTs);
  const funnelProgress = computeFunnelProgress(summed.pageVisitsByCategory);
  const topEntities = getTopEntityFocus(state, 8);

  const rollupBase = {
    ...summed,
    actionBreakdown,
    avgActiveMsPerDay,
    daysActive,
    workflowScore,
  };

  const insights = buildTenantBehaviourInsights(
    {
      ...rollupBase,
      logins: summed.logins,
      activeMs: summed.activeMs,
    },
    state.crmSnapshot,
  );
  const topMods = topModules(summed.pageVisitsByCategory, summed.activeMsByCategory);
  const triggers = buildTenantBehaviourTriggers({
    insights,
    rollup: rollupBase,
    topModules: topMods,
    topEntities,
  });

  return {
    userId: state.userId,
    tenantDbName: state.tenantDbName,
    userName: state.userName,
    range,
    fromDate,
    toDate: today,
    ...summed,
    actionBreakdown,
    avgActiveMsPerDay,
    daysActive,
    topFirstOpen: topCategory(summed.firstOpenBreakdown),
    firstOpenBreakdown: summed.firstOpenBreakdown,
    insights,
    triggers,
    topModules: topMods,
    topEntities,
    workflowScore,
    funnelProgress,
    recentSessions: [...state.sessions].slice(-12).reverse(),
    recentEvents: [...(state.events || [])]
      .filter((e) => (range === 'all' ? true : Date.parse(e.at) >= fromTs))
      .slice(-120)
      .reverse(),
    crmSnapshot: state.crmSnapshot,
  };
}
