import { apiFetch } from '../api';
import type {
  DashboardCatalog,
  DashboardWidget,
  DatasetAnalysis,
  DatasetPayload,
  WidgetFilters,
} from './types';
import type { DashboardLayoutV2 } from './layoutV2';

function filtersToQuery(filters?: WidgetFilters | Record<string, string | undefined | null>) {
  if (!filters) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && String(value).trim() !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export type DashboardInsight = {
  id: string;
  severity: 'high' | 'medium' | 'info' | string;
  text: string;
  action?: string;
  href?: string;
};

export type DashboardAlert = DashboardInsight & {
  category?: string;
};

export type DashboardTimelineItem = {
  id: string;
  at?: string | null;
  label: string;
  detail?: string;
  performer?: string;
  entityType?: string;
};

export type DashboardCalendarItem = {
  id: string;
  type: string;
  at?: string | null;
  title: string;
  status?: string;
  href?: string;
};

export type PipelineStage = {
  stage: string;
  count: number;
  href?: string;
  revenue?: number;
};

export type HealthScores = {
  overall: number;
  business: number;
  hiring: number;
  revenue: number;
  productivity: number;
  risk: number;
};

export type ExecutiveSummary = {
  healthLabel: string;
  bullets: string[];
  recommendations: Array<{ text: string; href?: string }>;
};

export type ChartSlice = { name: string; value: number };

export type UpcomingFollowup = {
  id: string;
  company: string;
  type?: string;
  at?: string | null;
  status?: string;
  priority?: string;
  assignee?: string;
  href?: string;
};

export type ScheduleItem = {
  id: string;
  title: string;
  at?: string | null;
  duration?: string;
  type?: string;
  href?: string;
};

export type AiCredits = {
  total: number;
  used: number;
  remaining: number;
  usagePct: number;
};

export type DashboardOverview = {
  kpis: Record<string, number | null | undefined>;
  insights?: DashboardInsight[];
  alerts?: DashboardAlert[];
  executiveSummary?: ExecutiveSummary;
  healthScores?: HealthScores;
  crmPipeline?: PipelineStage[];
  recruitmentPipeline?: PipelineStage[];
  activityTimeline?: DashboardTimelineItem[];
  calendarItems?: DashboardCalendarItem[];
  upcomingFollowups?: UpcomingFollowup[];
  todaysSchedule?: ScheduleItem[];
  pipelineFunnel?: Array<{ name: string; value: number }>;
  teamLeaderboard?: Array<Record<string, unknown>>;
  recruitmentTrend?: Array<Record<string, unknown>>;
  revenueTrend?: Array<Record<string, unknown>>;
  topClients?: Array<Record<string, unknown>>;
  leadSources?: ChartSlice[];
  jobsByDepartment?: ChartSlice[];
  industries?: ChartSlice[];
  aiCredits?: AiCredits;
  filtersApplied?: Record<string, string | null>;
  generatedAt?: string;
};

export type SmartDashboardFilters = {
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  leadStatus?: string;
  clientStatus?: string;
  jobStatus?: string;
  candidateStatus?: string;
  assignedTo?: string;
  search?: string;
};

export type DrillDownPayload = {
  title: string;
  href?: string;
  metricKey?: string;
  subtitle?: string;
  rows?: Array<Record<string, unknown>>;
};

export async function apiDashboardOverview(filters?: SmartDashboardFilters) {
  const res = await apiFetch<DashboardOverview>(
    `/dashboard/overview${filtersToQuery(filters)}`,
    { auth: true },
  );
  return res.data;
}

export type CrmCommBucket = {
  completed: number;
  pending: number;
  cancelled: number;
  successRate: number;
};

export type CrmOverview = {
  scope?: 'crm';
  access?: DashboardStatsAccess;
  myWork?: DashboardMyWork;
  kpis: Record<string, number | null | undefined>;
  health?: { score: number; label: string };
  todaySummary?: {
    newLeads: number;
    followupsPending: number;
    meetingsScheduled: number;
    hotClients: number;
    estimatedBusinessValue: number;
  };
  insights?: DashboardInsight[];
  recommendations?: Array<{ id: string; text: string; detail?: string; href?: string }>;
  alerts?: DashboardAlert[];
  pipeline?: PipelineStage[];
  leadSources?: ChartSlice[];
  leadStatusBars?: ChartSlice[];
  leadStagePie?: ChartSlice[];
  clientStatusPie?: ChartSlice[];
  industries?: ChartSlice[];
  countries?: ChartSlice[];
  clientGrowth?: Array<{ label: string; value: number }>;
  leadSpark?: Array<{ label: string; value: number }>;
  entityCompare?: {
    leads?: {
      days: string[];
      lines: Array<{ id: string; name: string; values: number[]; total?: number }>;
    };
    clients?: {
      days: string[];
      lines: Array<{ id: string; name: string; values: number[]; total?: number }>;
    };
  };
  aiTokens?: { total: number; used: number; remaining: number; usagePct: number };
  leadsTable?: Array<{
    id: string;
    name: string;
    contact?: string;
    email?: string;
    phone?: string;
    status?: string;
    priority?: string;
    source?: string;
    industry?: string;
    location?: string;
    value?: number;
    lastActivity?: string | null;
    nextFollowUp?: string | null;
    assignee?: string;
    createdAt?: string;
    href?: string;
    totalMeetings?: number;
    meetingsBreakdown?: {
      calls?: number;
      meetings?: number;
      emails?: number;
      whatsapp?: number;
      followups?: number;
    };
  }>;
  clientsTable?: Array<{
    id: string;
    name: string;
    status?: string;
    industry?: string;
    location?: string;
    value?: number;
    lastActivity?: string | null;
    nextFollowUp?: string | null;
    assignee?: string;
    createdAt?: string;
    href?: string;
  }>;
  followups?: {
    today: number;
    tomorrow: number;
    overdue: number;
    completed: number;
    upcoming: UpcomingFollowup[];
  };
  calendar?: Array<{
    id: string;
    title: string;
    at?: string | null;
    time?: string;
    type?: string;
    status?: string;
    assignee?: string;
    href?: string;
  }>;
  communication?: {
    calls: CrmCommBucket;
    meetings: CrmCommBucket;
    emails: CrmCommBucket;
    whatsapp: CrmCommBucket;
  };
  activityTimeline?: DashboardTimelineItem[];
  leaderboard?: Array<{
    id: string;
    name: string;
    email?: string;
    role?: string;
    assignedLeads: number;
    assignedClients?: number;
    calls: number;
    meetings: number;
    emails?: number;
    followups: number;
    overdueFollowups?: number;
    conversions: number;
    businessGenerated: number;
    completionRate: number;
    lastActivity?: string | null;
    nextFollowUp?: string | null;
  }>;
  businessSummary?: {
    potentialBusinessValue: number;
    expectedRevenue: number;
    averageLeadValue: number;
    averageClientValue: number;
    highestValueLead?: { id: string; name: string; value: number } | null;
    highestValueClient?: { id: string; name: string; value: number } | null;
  };
  teamOptions?: Array<{ id: string; name: string }>;
  filtersApplied?: Record<string, string | null>;
  generatedAt?: string;
};

export type OrgCompanyOption = {
  id: string;
  name: string;
  parentId?: string | null;
  levelOrder?: number;
};

export type DashboardOrgScope = {
  isTenantAdmin?: boolean;
  isTenantWide?: boolean;
  canSwitchCompanies?: boolean;
  hierarchyPurpose?: string;
  orgUnitId?: string | null;
  homeOrgUnitId?: string | null;
  homeOrgUnitName?: string | null;
  homeIsOrgCompany?: boolean;
  hasCompanies?: boolean;
  companies?: OrgCompanyOption[];
  memberIds?: string[];
};

export type DashboardLevel = 'self' | 'department' | 'company' | 'tenant';

export type DashboardStatsAccess = {
  /** Data scope for CRM/Rec numbers (separate from which tabs are visible). */
  dashboardLevel?: DashboardLevel;
  statsScope: 'full' | 'self';
  canFullStats: boolean;
  /** Human label for banner, e.g. "Sales department" / "all companies". */
  scopeLabel?: string;
  /** User ids included for this level; omit/null means whole tenant. */
  scopeUserIds?: string[] | null;
  departmentId?: string | null;
  departmentName?: string | null;
  showMineTab: boolean;
  showMineApprovals?: boolean;
  isSuperAdmin?: boolean;
  isDepartmentHead?: boolean;
  org?: DashboardOrgScope;
};

export type DashboardMyWorkApproval = {
  id: string;
  kind: 'team' | 'cross-dept' | 'lead-conversion' | 'task-completion' | string;
  title: string;
  from?: string;
  at?: string | null;
  href: string;
  priority?: string;
};

export type DashboardMyWork = {
  openTasks: number;
  overdueTasks: number;
  awaitingTaskApproval: number;
  pendingLeadConversions: number;
  pendingCrossDept: number;
  pendingTeamRequests?: number;
  pendingApprovalsTotal?: number;
  approvals?: DashboardMyWorkApproval[];
};

export type CrmDashboardFilters = {
  dateRange?: string;
  assignedTo?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  scope?: 'self' | 'full';
  orgUnitId?: string;
};

export async function apiDashboardAccess() {
  const res = await apiFetch<DashboardStatsAccess>('/dashboard/access', { auth: true });
  return res.data;
}

export async function apiCrmDashboardOverview(filters?: CrmDashboardFilters) {
  const res = await apiFetch<CrmOverview>(
    `/dashboard/crm-overview${filtersToQuery(filters)}`,
    { auth: true },
  );
  return res.data;
}

export type RecruitmentOverview = {
  scope?: 'recruitment';
  access?: DashboardStatsAccess;
  myWork?: DashboardMyWork;
  kpis: Record<string, number | null | undefined>;
  health?: { score: number; label: string };
  todaySummary?: {
    interviewsToday: number;
    openJobs: number;
    newCandidates: number;
    pendingOffers: number;
    placementRevenue: number;
  };
  insights?: DashboardInsight[];
  recommendations?: Array<{ id: string; text: string; detail?: string; href?: string }>;
  alerts?: DashboardAlert[];
  pipeline?: PipelineStage[];
  jobStatusPie?: ChartSlice[];
  candidateStatusPie?: ChartSlice[];
  interviewStatusPie?: ChartSlice[];
  placementStatusPie?: ChartSlice[];
  candidateSources?: ChartSlice[];
  jobsByDepartment?: ChartSlice[];
  jobsByClient?: ChartSlice[];
  jobSpark?: Array<{ label: string; value: number }>;
  sourceSpark?: Array<Record<string, string | number>>;
  jobsTable?: Array<{
    id: string;
    title: string;
    status?: string;
    openings?: number;
    department?: string;
    location?: string;
    priority?: string;
    hot?: boolean;
    noCandidates?: boolean;
    slaRisk?: boolean;
    client?: string;
    applicants?: number;
    interviews?: number;
    placements?: number;
    assignee?: string;
    postedDate?: string | null;
    updatedAt?: string | null;
    href?: string;
  }>;
  candidatesTable?: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    status?: string;
    source?: string;
    location?: string;
    title?: string;
    company?: string;
    experience?: number | null;
    assignee?: string;
    createdAt?: string | null;
    updatedAt?: string | null;
    href?: string;
  }>;
  interviewsTable?: Array<{
    id: string;
    candidate: string;
    job?: string;
    status?: string;
    round?: string;
    scheduledAt?: string | null;
    href?: string;
  }>;
  placementsTable?: Array<{
    id: string;
    candidate: string;
    client?: string;
    job?: string;
    status?: string;
    revenue?: number;
    offerDate?: string | null;
    joiningDate?: string | null;
    updatedAt?: string | null;
    href?: string;
  }>;
  schedule?: Array<{
    id: string;
    title: string;
    at?: string | null;
    status?: string;
    round?: string;
    type?: string;
    assignee?: string;
    href?: string;
  }>;
  activityTimeline?: DashboardTimelineItem[];
  leaderboard?: Array<{
    id: string;
    name: string;
    email?: string;
    openJobs: number;
    interviews: number;
    placements: number;
    candidates: number;
    score?: number;
  }>;
  teamOptions?: Array<{ id: string; name: string }>;
  filtersApplied?: Record<string, string | null>;
  generatedAt?: string;
};

export type RecruitmentDashboardFilters = {
  dateRange?: string;
  assignedTo?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  scope?: 'self' | 'full';
  orgUnitId?: string;
};

export async function apiRecruitmentDashboardOverview(filters?: RecruitmentDashboardFilters) {
  const res = await apiFetch<RecruitmentOverview>(
    `/dashboard/recruitment-overview${filtersToQuery(filters)}`,
    { auth: true },
  );
  return res.data;
}

export async function apiDashboardCatalog(): Promise<DashboardCatalog> {
  const res = await apiFetch<DashboardCatalog>('/dashboard/catalog', { auth: true });
  return {
    datasets: res.data.datasets || [],
    modules: res.data.modules || [],
  };
}

export async function apiDashboardDataset(datasetId: string, filters?: WidgetFilters) {
  const res = await apiFetch<DatasetPayload>(
    `/dashboard/data/${encodeURIComponent(datasetId)}${filtersToQuery(filters)}`,
    { auth: true }
  );
  return res.data;
}

export async function apiDashboardAnalyze(rows: Record<string, unknown>[]) {
  const res = await apiFetch<DatasetAnalysis>('/dashboard/analyze', {
    method: 'POST',
    auth: true,
    body: { rows },
  });
  return res.data;
}

export async function apiDashboardGetLayout(): Promise<DashboardLayoutV2 | DashboardWidget[]> {
  const res = await apiFetch<{ layout?: unknown; widgets?: unknown }>('/dashboard/layout', {
    auth: true,
  });
  return (res.data.layout ?? res.data.widgets ?? { version: 2, modules: {} }) as
    | DashboardLayoutV2
    | DashboardWidget[];
}

export async function apiDashboardSaveLayout(layout: DashboardLayoutV2) {
  const res = await apiFetch<{ layout?: DashboardLayoutV2; widgets?: DashboardLayoutV2 }>(
    '/dashboard/layout',
    {
      method: 'PUT',
      auth: true,
      body: { layout },
    },
  );
  return (res.data.layout ?? res.data.widgets ?? layout) as DashboardLayoutV2;
}
