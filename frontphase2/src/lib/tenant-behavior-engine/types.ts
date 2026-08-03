/** Phase 2 CRM tenant behaviour tracking — per user, scoped by tenantDbName */

export type TenantActivityCategory =
  | 'jobs'
  | 'candidates'
  | 'leads'
  | 'clients'
  | 'contacts'
  | 'interviews'
  | 'placements'
  | 'pipeline'
  | 'matches'
  | 'reports'
  | 'calendar'
  | 'inbox'
  | 'team'
  | 'billing'
  | 'settings'
  | 'ai'
  | 'events'
  | 'recruitment'
  | 'dashboard'
  | 'other';

export type TenantActivityEventType =
  | 'login'
  | 'page_visit'
  | 'entity_click'
  | 'entity_view'
  | 'search'
  | 'action'
  | 'api_mutation'
  | 'workflow_step'
  | 'time_slice'
  | 'session_end';

export type TenantActivityEvent = {
  id: string;
  at: string;
  type: TenantActivityEventType;
  category: TenantActivityCategory;
  path?: string;
  sessionId?: string;
  meta?: Record<string, unknown>;
};

export type TenantDayBucket = {
  date: string;
  logins: number;
  visits: number;
  entityClicks: number;
  entityViews: number;
  searches: number;
  actions: number;
  apiMutations: number;
  pageVisitsByCategory: Partial<Record<TenantActivityCategory, number>>;
  activeMsByCategory: Partial<Record<TenantActivityCategory, number>>;
  actionsByCategory: Partial<Record<TenantActivityCategory, number>>;
  firstOpenCategory?: TenantActivityCategory;
  firstOpenPath?: string;
  firstOpenAt?: string;
  activeMs: number;
  sessionIds: string[];
};

export type TenantActivitySession = {
  id: string;
  startedAt: string;
  endedAt?: string;
  lastActiveAt: string;
  durationMs: number;
  pageCount: number;
  firstPath?: string;
  lastPath?: string;
  lastCategory?: TenantActivityCategory;
  paths: string[];
  deviceType?: string;
  browser?: string;
  operatingSystem?: string;
};

export type TenantCrmSnapshot = {
  openJobs?: number | null;
  draftJobs?: number | null;
  openCandidates?: number | null;
  openLeads?: number | null;
  openClients?: number | null;
  openContacts?: number | null;
  pendingInterviews?: number | null;
  openPlacements?: number | null;
  pendingTasks?: number | null;
  pipelineEntries?: number | null;
  openMatches?: number | null;
  teamMembers?: number | null;
  updatedAt: string;
};

export type TenantActionBreakdown = Partial<
  Record<
    | 'create'
    | 'update'
    | 'delete'
    | 'export'
    | 'import'
    | 'schedule'
    | 'assign'
    | 'convert'
    | 'submit'
    | 'approve'
    | 'reject'
    | 'upload'
    | 'send'
    | 'cancel'
    | 'restore'
    | 'other',
    number
  >
>;

export type TenantEntityFocus = {
  key: string;
  entityType: string;
  entityId?: string;
  label?: string;
  category: TenantActivityCategory;
  views: number;
  clicks: number;
  actions: number;
  lastAt: string;
};

export type TenantWorkflowJourney = {
  sessionId?: string;
  steps: Array<{ category: TenantActivityCategory; at: string; path?: string }>;
  forwardSteps: number;
  completedFunnel: boolean;
};

export type TenantBehaviourInsight = {
  id: string;
  label: string;
  severity: 'info' | 'watch' | 'action';
  summary: string;
  evidence: string[];
};

export type TenantBehaviourTrigger = {
  id: string;
  flag: 'watch' | 'sales_follow_up' | 'ops_assist' | 'high_intent' | 'user_nudge' | 'career_assist';
  audience?: 'hq' | 'user' | 'both' | 'tenant_admin';
  title: string;
  reason: string;
  evidence: string[];
  recommendedAction: string;
  priority: number;
  comboSignals?: string[];
};

export type TenantActivityState = {
  userId: string;
  tenantDbName: string;
  userName?: string;
  createdAt: string;
  updatedAt: string;
  totals: {
    logins: number;
    visits: number;
    entityClicks: number;
    entityViews: number;
    searches: number;
    actions: number;
    apiMutations: number;
    activeMs: number;
    sessions: number;
    pageVisitsByCategory: Partial<Record<TenantActivityCategory, number>>;
    activeMsByCategory: Partial<Record<TenantActivityCategory, number>>;
    actionsByCategory: Partial<Record<TenantActivityCategory, number>>;
    actionBreakdown: TenantActionBreakdown;
  };
  days: Record<string, TenantDayBucket>;
  sessions: TenantActivitySession[];
  currentSessionId?: string;
  lastPath?: string;
  lastCategory?: TenantActivityCategory;
  crmSnapshot?: TenantCrmSnapshot;
  firstOpens: Array<{ date: string; category: TenantActivityCategory; path: string; at: string }>;
  events: TenantActivityEvent[];
  entityFocus: TenantEntityFocus[];
  recentJourneys: TenantWorkflowJourney[];
  lastWorkflowCategory?: TenantActivityCategory;
};

export type TenantActivityRollup = {
  userId: string;
  tenantDbName: string;
  userName?: string;
  range: 'today' | 'week' | 'month' | 'all';
  fromDate: string;
  toDate: string;
  logins: number;
  visits: number;
  entityClicks: number;
  entityViews: number;
  searches: number;
  actions: number;
  apiMutations: number;
  activeMs: number;
  avgActiveMsPerDay: number;
  sessionCount: number;
  daysActive: number;
  pageVisitsByCategory: Partial<Record<TenantActivityCategory, number>>;
  activeMsByCategory: Partial<Record<TenantActivityCategory, number>>;
  actionsByCategory: Partial<Record<TenantActivityCategory, number>>;
  actionBreakdown: TenantActionBreakdown;
  firstOpenBreakdown: Partial<Record<TenantActivityCategory, number>>;
  topFirstOpen?: TenantActivityCategory;
  insights: TenantBehaviourInsight[];
  triggers: TenantBehaviourTrigger[];
  recentSessions: TenantActivitySession[];
  recentEvents: TenantActivityEvent[];
  topModules: Array<{ key: string; label: string; count: number; activeMs: number }>;
  topEntities: TenantEntityFocus[];
  workflowScore: number;
  funnelProgress: Partial<Record<TenantActivityCategory, number>>;
  crmSnapshot?: TenantCrmSnapshot;
};

export type TenantBehaviorPayload = {
  userId: string;
  tenantDbName: string;
  userName?: string;
  capturedAt: string;
  activityStateUpdatedAt?: string;
  rollupToday: TenantActivityRollup | null;
  rollup7d: TenantActivityRollup | null;
  triggers: TenantBehaviourTrigger[];
};

export type TenantModuleMatrixRow = {
  category: string;
  label: string;
  visits: number;
  activeMs: number;
  actions: number;
  entityViews: number;
  conversionRate: number;
};

export type TenantLiveFeedItem = TenantActivityEvent & {
  userId: string;
  userName?: string;
};

export type TenantBehaviorLiveDashboard = {
  serverTime: string;
  tenantDbName: string | null;
  crmContext: TenantCrmSnapshot;
  intelligenceSummary: string[];
  userCount: number;
  activeUsers7d: number;
  onlineCount: number;
  totalVisits7d: number;
  totalActiveMs7d: number;
  totalActions7d: number;
  totalApiMutations7d: number;
  totalEntityViews7d: number;
  totalSearches7d: number;
  tenantHealthScore: number;
  weekMetrics: {
    visits: number;
    actions: number;
    apiMutations: number;
    entityViews: number;
    searches: number;
    activeMs: number;
    avgWorkflow: number;
  };
  todayMetrics: {
    visits: number;
    actions: number;
    activeMs: number;
  };
  topTriggers: TenantBehaviourTrigger[];
  users: Array<{
    userId: string;
    userName?: string;
    capturedAt: string;
    lastActive: string;
    online: boolean;
    visits7d: number;
    activeMs7d: number;
    actions7d: number;
    apiMutations7d: number;
    entityViews7d: number;
    workflowScore: number;
    visitsToday: number;
    actionsToday: number;
    triggerCount: number;
    topTrigger?: TenantBehaviourTrigger;
    currentPath?: string;
    currentModule?: string;
  }>;
  moduleBreakdown: Array<{ category: string; label: string; visits: number; activeMs: number }>;
  moduleMatrix: TenantModuleMatrixRow[];
  funnelSteps: Array<{ category: string; label: string; visits: number }>;
  actionBreakdown: TenantActionBreakdown;
  liveFeed: TenantLiveFeedItem[];
  onlineUsers: TenantBehaviorLiveDashboard['users'];
};

export type TenantBehaviorAggregate = TenantBehaviorLiveDashboard;
