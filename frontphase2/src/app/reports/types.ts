export type ReportSection =
  | 'executive'
  | 'recruitment'
  | 'clients'
  | 'candidates'
  | 'interviews'
  | 'placements'
  | 'revenue'
  | 'team'
  | 'activity'
  | 'raw';

export type FunnelRow = { name: string; value: number; fill?: string };
export type NamedCount = { name: string; value: number };
export type SkillRow = { skill: string; count: number; percentage: number };
export type SourcePerformanceRow = {
  name: string;
  candidates: number;
  placements: number;
  conversionPct: number;
};
export type ClientDetailRow = {
  id: string;
  name: string;
  jobs: number;
  placements: number;
  revenue: number;
  health: 'active' | 'slow' | 'no_activity';
};
export type RecentActivityRow = {
  id: string;
  time: string;
  label: string;
  detail: string;
  performer: string;
};
export type LeaderboardRow = {
  id?: string;
  rank?: number;
  name: string;
  jobs?: number;
  submissions?: number;
  interviews?: number;
  placements?: number;
  candidatesAdded?: number;
  revenue?: number;
  tasksCompleted?: number;
};

export type ReportsSummary = {
  recruitmentPerformance: {
    kpis: {
      totalOpenJobs: number;
      activeCandidates: number;
      interviews: number;
      offersReleased: number;
      placements: number;
      conversionPct: number;
    };
    trend: Array<{
      label: string;
      openJobs: number;
      placements: number;
      candidates: number;
      interviews: number;
    }>;
  };
  pipelineFunnel: {
    funnel: FunnelRow[];
    stageDistribution: FunnelRow[];
  };
  jobsClients: {
    jobs: Array<{
      id: string;
      title: string;
      client: string;
      status: string;
      count: number;
      aging: number;
    }>;
    topClients: Array<{ name: string; volume: number }>;
    clientDetails: ClientDetailRow[];
  };
  candidates: {
    sources: NamedCount[];
    skills: SkillRow[];
    byLocation: NamedCount[];
    byRecruiter: NamedCount[];
    sourcePerformance: SourcePerformanceRow[];
  };
  interviews: {
    trend: Array<{ label: string; scheduled: number; completed: number }>;
    feedbackPending: Array<{ userId: string; name: string; pending: number }>;
    funnel: NamedCount[];
  };
  placementsRevenue: {
    kpis: {
      totalPlacements: number;
      totalRevenue: number;
      avgBilling: number;
      commissionPaid: number;
      outstandingPayment: number;
    };
    trend: Array<{ label: string; revenue: number }>;
    byClient: Array<{ name: string; revenue: number }>;
    joiningStatus: NamedCount[];
  };
  teamPerformance: {
    leaderboard: LeaderboardRow[];
  };
  activityProductivity: {
    kpis: {
      callsMade: number;
      emailsSent: number;
      tasksCompleted: number;
      overdueTasks: number;
      notesAdded: number;
      meetingsConducted: number;
    };
    trend: Array<{ label: string; calls: number; emails: number; tasks: number }>;
    recent: RecentActivityRow[];
  };
  entityCounts: Record<string, number>;
};

export type SavedReport = {
  id: string;
  name: string;
  type: string;
  filters: Record<string, unknown> | null;
  createdAt: string;
};

export const SECTION_LABELS: Record<ReportSection, string> = {
  executive: 'Executive Dashboard',
  recruitment: 'Recruitment Analytics',
  clients: 'Client Analytics',
  candidates: 'Candidate Analytics',
  interviews: 'Interview Analytics',
  placements: 'Placement Analytics',
  revenue: 'Revenue Analytics',
  team: 'Team Analytics',
  activity: 'Activity Analytics',
  raw: 'Raw Data Explorer',
};

export const SECTION_EXPORT_TABS: Partial<Record<ReportSection, string>> = {
  executive: 'recruitment-performance',
  recruitment: 'pipeline-funnel',
  clients: 'jobs-clients',
  candidates: 'candidates',
  interviews: 'interviews',
  placements: 'placements-revenue',
  revenue: 'placements-revenue',
  team: 'team-performance',
  activity: 'activity-productivity',
};

export const SECTION_TO_REPORT_TYPE: Record<ReportSection, string> = {
  executive: 'RECRUITMENT_PERFORMANCE',
  recruitment: 'PIPELINE_FUNNEL',
  clients: 'JOBS_CLIENTS',
  candidates: 'CANDIDATES',
  interviews: 'INTERVIEWS',
  placements: 'PLACEMENTS_REVENUE',
  revenue: 'PLACEMENTS_REVENUE',
  team: 'TEAM_PERFORMANCE',
  activity: 'ACTIVITY_PRODUCTIVITY',
  raw: 'CUSTOM',
};
