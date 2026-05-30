import type { SummaryCardColor } from '@/components/ui/SummaryCard';
import type { DashboardOverview } from './api';
import type { TaskStats } from '../api';
import type { WidgetFilters } from './types';

export type ModuleTabKey =
  | 'leads'
  | 'clients'
  | 'jobs'
  | 'candidates'
  | 'interviews'
  | 'placements'
  | 'pipeline'
  | 'matches'
  | 'tasks'
  | 'team'
  | 'departments';

export type KpiDef = {
  label: string;
  value: string | number;
  color: SummaryCardColor;
};

/** Static KPI card templates for default per-metric widgets. */
export type KpiCardTemplate = {
  slug: string;
  label: string;
  color: SummaryCardColor;
  datasetId?: string;
  /** Clients command center tab (matches /client StatusCards). */
  clientTab?: 'all' | 'active' | 'on-hold' | 'inactive' | 'hot';
  filters?: WidgetFilters;
  kpiMetric?: 'count' | 'overdue_followups' | 'metric_value';
  metricKey?: string;
};

export type ChartSlot = {
  datasetId: string;
  chartType: string;
  title: string;
  categoryField?: string;
  valueField?: string;
  w?: number;
  h?: number;
};

export type ModuleCommandConfig = {
  key: ModuleTabKey;
  label: string;
  listRoute: string;
  permissions: string[];
  datasets: string[];
  tableDatasetId: string;
  tableTitle: string;
  buildKpis: (ctx: ModuleKpiContext) => KpiDef[];
  /** One default widget per KPI metric (SummaryCard tiles). */
  kpiCards: KpiCardTemplate[];
  charts: ChartSlot[];
};

export type ModuleKpiContext = {
  rowsByDataset: Record<string, Record<string, unknown>[]>;
  overview: DashboardOverview | null;
  taskStats: TaskStats | null;
};

function countBy(rows: Record<string, unknown>[], field: string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = String(row[field] ?? 'Unknown').trim() || 'Unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function sumField(rows: Record<string, unknown>[], field: string) {
  return rows.reduce((sum, row) => {
    const n = Number(row[field]);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export const DASHBOARD_MODULE_TABS: ModuleCommandConfig[] = [
  {
    key: 'leads',
    label: 'Leads',
    listRoute: '/leads',
    permissions: ['leads_read', 'leads_create', 'leads_update'],
    datasets: ['leads'],
    tableDatasetId: 'leads',
    tableTitle: 'Lead command center',
    buildKpis: ({ rowsByDataset }) => {
      const rows = rowsByDataset.leads || [];
      const status = countBy(rows, 'status');
      const overdue = rows.filter(
        (r) => r.nextFollowUp && new Date(String(r.nextFollowUp)) < new Date(),
      ).length;
      return [
        { label: 'Total leads', value: rows.length, color: 'blue' },
        { label: 'New', value: status.get('New') ?? 0, color: 'cyan' },
        { label: 'Qualified', value: status.get('Qualified') ?? 0, color: 'purple' },
        { label: 'Converted', value: status.get('Converted') ?? 0, color: 'green' },
        { label: 'Overdue follow-ups', value: overdue, color: 'rose' },
      ];
    },
    kpiCards: [
      {
        slug: 'total-leads',
        label: 'All leads',
        color: 'blue',
        filters: { dateRange: 'all', status: 'all' },
      },
      {
        slug: 'new',
        label: 'New',
        color: 'cyan',
        filters: { dateRange: 'all', status: 'New' },
      },
      {
        slug: 'qualified',
        label: 'Qualified',
        color: 'purple',
        filters: { dateRange: 'all', status: 'Qualified' },
      },
      {
        slug: 'converted',
        label: 'Converted',
        color: 'green',
        filters: { dateRange: 'all', status: 'Converted' },
      },
      {
        slug: 'overdue-follow-ups',
        label: 'Overdue follow-ups',
        color: 'rose',
        filters: { dateRange: 'all', status: 'all' },
        kpiMetric: 'overdue_followups',
      },
    ],
    charts: [
      { datasetId: 'leads', chartType: 'pie', title: 'Lead source', categoryField: 'source' },
      { datasetId: 'leads', chartType: 'donut', title: 'Lead status', categoryField: 'status' },
      {
        datasetId: 'leads',
        chartType: 'expandableTable',
        title: 'Lead command center',
      },
    ],
  },
  {
    key: 'clients',
    label: 'Clients',
    listRoute: '/client',
    permissions: ['clients_read'],
    datasets: ['clients', 'clients_metrics'],
    tableDatasetId: 'clients',
    tableTitle: 'Client command center',
    buildKpis: ({ rowsByDataset }) => {
      const rows = rowsByDataset.clients || [];
      const tabCount = (tab: string) => {
        switch (tab) {
          case 'active':
            return rows.filter((r) => r.stage === 'Active').length;
          case 'on-hold':
            return rows.filter((r) => r.stage === 'On Hold').length;
          case 'inactive':
            return rows.filter((r) => r.stage === 'Inactive').length;
          case 'hot':
            return rows.filter((r) => String(r.priority || '') === 'High').length;
          default:
            return rows.length;
        }
      };
      return [
        { label: 'All Clients', value: tabCount('all'), color: 'indigo' },
        { label: 'Active', value: tabCount('active'), color: 'blue' },
        { label: 'On Hold', value: tabCount('on-hold'), color: 'orange' },
        { label: 'Inactive', value: tabCount('inactive'), color: 'gray' },
        { label: 'Hot', value: tabCount('hot'), color: 'purple' },
      ];
    },
    kpiCards: [
      { slug: 'all', label: 'All Clients', color: 'indigo', clientTab: 'all' },
      { slug: 'active', label: 'Active', color: 'blue', clientTab: 'active' },
      { slug: 'on-hold', label: 'On Hold', color: 'orange', clientTab: 'on-hold' },
      { slug: 'inactive', label: 'Inactive', color: 'gray', clientTab: 'inactive' },
      { slug: 'hot', label: 'Hot', color: 'purple', clientTab: 'hot' },
    ],
    charts: [
      { datasetId: 'clients', chartType: 'donut', title: 'Client status', categoryField: 'status' },
      { datasetId: 'clients', chartType: 'pie', title: 'Industry mix', categoryField: 'industry' },
    ],
  },
  {
    key: 'jobs',
    label: 'Jobs',
    listRoute: '/job',
    permissions: ['jobs_read', 'view_jobs'],
    datasets: ['jobs', 'jobs_metrics'],
    tableDatasetId: 'jobs',
    tableTitle: 'Job command center',
    buildKpis: ({ rowsByDataset }) => {
      const rows = rowsByDataset.jobs || [];
      const open = countBy(rows, 'status').get('OPEN') ?? 0;
      const noCandidates = rows.filter((r) => Number(r.applied) === 0 && r.status === 'OPEN').length;
      const metrics = rowsByDataset.jobs_metrics || [];
      const nearSla = metrics.find((m) => String(m.metric).toLowerCase().includes('sla'));
      return [
        { label: 'Active jobs', value: open, color: 'blue' },
        { label: 'Total listed', value: rows.length, color: 'indigo' },
        { label: 'No candidates', value: noCandidates, color: 'orange' },
        { label: 'Near SLA', value: nearSla ? Number(nearSla.value) : 0, color: 'rose' },
      ];
    },
    kpiCards: [
      { slug: 'active-jobs', label: 'Active jobs', color: 'blue' },
      { slug: 'total-listed', label: 'Total listed', color: 'indigo' },
      { slug: 'no-candidates', label: 'No candidates', color: 'orange' },
      { slug: 'near-sla', label: 'Near SLA', color: 'rose' },
    ],
    charts: [
      { datasetId: 'jobs', chartType: 'donut', title: 'Job status', categoryField: 'status' },
      { datasetId: 'jobs', chartType: 'funnel', title: 'Hiring funnel', categoryField: 'status' },
    ],
  },
  {
    key: 'candidates',
    label: 'Candidates',
    listRoute: '/candidate',
    permissions: ['candidates_read', 'view_all_candidates'],
    datasets: ['candidates', 'candidates_pipeline'],
    tableDatasetId: 'candidates',
    tableTitle: 'Candidate command center',
    buildKpis: ({ rowsByDataset }) => {
      const rows = rowsByDataset.candidates || [];
      const pipeline = rowsByDataset.candidates_pipeline || [];
      const interviewing =
        countBy(rows, 'status').get('Interviewing') ?? countBy(pipeline, 'stage').get('Interviewing') ?? 0;
      return [
        { label: 'Total candidates', value: rows.length, color: 'blue' },
        { label: 'Interviewing', value: interviewing, color: 'purple' },
        { label: 'Hired', value: countBy(rows, 'status').get('Hired') ?? 0, color: 'green' },
        { label: 'Rejected', value: countBy(rows, 'status').get('Rejected') ?? 0, color: 'gray' },
      ];
    },
    kpiCards: [
      { slug: 'total-candidates', label: 'Total candidates', color: 'blue' },
      { slug: 'interviewing', label: 'Interviewing', color: 'purple' },
      { slug: 'hired', label: 'Hired', color: 'green' },
      { slug: 'rejected', label: 'Rejected', color: 'gray' },
    ],
    charts: [
      { datasetId: 'candidates', chartType: 'pie', title: 'Source', categoryField: 'source' },
      { datasetId: 'candidates_pipeline', chartType: 'funnel', title: 'Pipeline', categoryField: 'stage', valueField: 'count' },
    ],
  },
  {
    key: 'interviews',
    label: 'Interviews',
    listRoute: '/interviews',
    permissions: ['interviews_read'],
    datasets: ['interviews', 'interviews_kpis'],
    tableDatasetId: 'interviews',
    tableTitle: 'Interview schedule',
    buildKpis: ({ rowsByDataset }) => {
      const rows = rowsByDataset.interviews || [];
      const metrics = rowsByDataset.interviews_kpis || [];
      const today = rows.filter((r) => {
        if (!r.scheduledAt) return false;
        const d = new Date(String(r.scheduledAt));
        const n = new Date();
        return d.toDateString() === n.toDateString();
      }).length;
      const completed = countBy(rows, 'status').get('COMPLETED') ?? 0;
      const upcoming = rows.filter((r) => r.scheduledAt && new Date(String(r.scheduledAt)) > new Date()).length;
      return [
        { label: 'Today', value: today, color: 'blue' },
        { label: 'Upcoming', value: upcoming, color: 'indigo' },
        { label: 'Completed', value: completed, color: 'green' },
        {
          label: 'Feedback pending',
          value: metrics.find((m) => String(m.metric).includes('pending'))?.value ?? '—',
          color: 'yellow',
        },
      ];
    },
    kpiCards: [
      { slug: 'today', label: 'Today', color: 'blue' },
      { slug: 'upcoming', label: 'Upcoming', color: 'indigo' },
      { slug: 'completed', label: 'Completed', color: 'green' },
      {
        slug: 'feedback-pending',
        label: 'Feedback pending',
        color: 'yellow',
        datasetId: 'interviews_kpis',
        kpiMetric: 'metric_value',
        metricKey: 'pendingFeedback',
      },
    ],
    charts: [
      { datasetId: 'interviews', chartType: 'donut', title: 'Interview status', categoryField: 'status' },
      { datasetId: 'interviews_kpis', chartType: 'bar', title: 'Interview KPIs', categoryField: 'metric', valueField: 'value' },
    ],
  },
  {
    key: 'placements',
    label: 'Placements',
    listRoute: '/placement',
    permissions: ['placements_read'],
    datasets: ['placements', 'placements_stats'],
    tableDatasetId: 'placements',
    tableTitle: 'Placements',
    buildKpis: ({ rowsByDataset }) => {
      const rows = rowsByDataset.placements || [];
      const stats = rowsByDataset.placements_stats || [];
      const joined = countBy(rows, 'status').get('JOINED') ?? 0;
      const revenue = sumField(rows, 'revenue');
      return [
        { label: 'Placed', value: joined, color: 'green' },
        { label: 'Total records', value: rows.length, color: 'blue' },
        {
          label: 'Revenue',
          value: revenue || stats.find((s) => String(s.metric).includes('revenue'))?.value || 0,
          color: 'purple',
        },
        {
          label: 'Pending',
          value: stats.find((s) => String(s.metric).includes('pending'))?.value ?? '—',
          color: 'yellow',
        },
      ];
    },
    kpiCards: [
      { slug: 'placed', label: 'Placed', color: 'green' },
      { slug: 'total-records', label: 'Total records', color: 'blue' },
      { slug: 'revenue', label: 'Revenue', color: 'purple' },
      { slug: 'pending', label: 'Pending', color: 'yellow' },
    ],
    charts: [
      { datasetId: 'placements', chartType: 'donut', title: 'Placement status', categoryField: 'status' },
    ],
  },
  {
    key: 'pipeline',
    label: 'Pipeline',
    listRoute: '/job',
    permissions: ['pipeline_read', 'move_pipeline'],
    datasets: ['candidates_pipeline'],
    tableDatasetId: 'candidates_pipeline',
    tableTitle: 'Pipeline stages',
    buildKpis: ({ rowsByDataset, overview }) => {
      const stages = rowsByDataset.candidates_pipeline || [];
      const funnel = overview?.pipelineFunnel || [];
      const total = stages.reduce((s, r) => s + Number(r.count || 0), 0);
      return [
        { label: 'Pipeline total', value: total, color: 'blue' },
        { label: 'Funnel stages', value: funnel.length || stages.length, color: 'indigo' },
        { label: 'Applied', value: stages.find((s) => s.stage === 'Applied')?.count ?? 0, color: 'cyan' },
        { label: 'Hired', value: stages.find((s) => s.stage === 'Hired')?.count ?? 0, color: 'green' },
      ];
    },
    kpiCards: [
      { slug: 'pipeline-total', label: 'Pipeline total', color: 'blue' },
      { slug: 'funnel-stages', label: 'Funnel stages', color: 'indigo' },
      { slug: 'applied', label: 'Applied', color: 'cyan' },
      { slug: 'hired', label: 'Hired', color: 'green' },
    ],
    charts: [
      { datasetId: 'candidates_pipeline', chartType: 'funnel', title: 'Pipeline funnel', categoryField: 'stage', valueField: 'count' },
      { datasetId: 'candidates_pipeline', chartType: 'donut', title: 'Stage mix', categoryField: 'stage', valueField: 'count' },
    ],
  },
  {
    key: 'matches',
    label: 'Matches',
    listRoute: '/matches',
    permissions: ['matches_read'],
    datasets: [],
    tableDatasetId: '',
    tableTitle: 'AI matches',
    buildKpis: ({ overview }) => [
      { label: 'AI matches', value: overview?.kpis?.candidates ?? '—', color: 'blue' },
      { label: 'Open jobs', value: overview?.kpis?.activeJobs ?? '—', color: 'indigo' },
      { label: 'Placements', value: overview?.kpis?.placements ?? '—', color: 'green' },
      { label: 'View matches', value: 'Open page', color: 'purple' },
    ],
    kpiCards: [
      { slug: 'ai-matches', label: 'AI matches', color: 'blue' },
      { slug: 'open-jobs', label: 'Open jobs', color: 'indigo' },
      { slug: 'placements', label: 'Placements', color: 'green' },
      { slug: 'view-matches', label: 'View matches', color: 'purple' },
    ],
    charts: [],
  },
  {
    key: 'tasks',
    label: 'Tasks',
    listRoute: '/Task&Activites',
    permissions: ['tasks_read'],
    datasets: ['tasks_and_activity'],
    tableDatasetId: 'tasks_and_activity',
    tableTitle: 'Tasks & activity',
    buildKpis: ({ taskStats, rowsByDataset }) => {
      const tasks = (rowsByDataset.tasks_and_activity || []).filter((r) => r.recordType === 'Task');
      return [
        { label: 'Overdue', value: taskStats?.overdue ?? taskStats?.overdueCount ?? 0, color: 'rose' },
        { label: 'Due today', value: taskStats?.dueToday ?? 0, color: 'yellow' },
        { label: 'Completed today', value: taskStats?.completedToday ?? 0, color: 'green' },
        { label: 'Open tasks', value: tasks.length, color: 'blue' },
      ];
    },
    kpiCards: [
      { slug: 'overdue', label: 'Overdue', color: 'rose' },
      { slug: 'due-today', label: 'Due today', color: 'yellow' },
      { slug: 'completed-today', label: 'Completed today', color: 'green' },
      { slug: 'open-tasks', label: 'Open tasks', color: 'blue' },
    ],
    charts: [
      {
        datasetId: 'tasks_and_activity',
        chartType: 'donut',
        title: 'Tasks vs activity',
        categoryField: 'recordType',
      },
      { datasetId: 'tasks_and_activity', chartType: 'table', title: 'Recent tasks & activity' },
    ],
  },
  {
    key: 'team',
    label: 'Team',
    listRoute: '/team',
    permissions: ['view_team', 'add_team_member'],
    datasets: ['team'],
    tableDatasetId: 'team',
    tableTitle: 'Team members',
    buildKpis: ({ rowsByDataset }) => {
      const rows = rowsByDataset.team || [];
      const active = countBy(rows, 'status').get('ACTIVE') ?? 0;
      return [
        { label: 'Members', value: rows.length, color: 'blue' },
        { label: 'Active', value: active, color: 'green' },
        { label: 'Departments', value: new Set(rows.map((r) => r.department)).size, color: 'indigo' },
        { label: 'Roles', value: new Set(rows.map((r) => r.role)).size, color: 'purple' },
      ];
    },
    kpiCards: [
      { slug: 'members', label: 'Members', color: 'blue' },
      { slug: 'active', label: 'Active', color: 'green' },
      { slug: 'departments', label: 'Departments', color: 'indigo' },
      { slug: 'roles', label: 'Roles', color: 'purple' },
    ],
    charts: [
      { datasetId: 'team', chartType: 'pie', title: 'Team by role', categoryField: 'role' },
      { datasetId: 'team', chartType: 'pie', title: 'By role', categoryField: 'role' },
    ],
  },
  {
    key: 'departments',
    label: 'Departments',
    listRoute: '/team?tab=departments',
    permissions: ['add_team_member', 'manage_settings'],
    datasets: ['departments'],
    tableDatasetId: 'departments',
    tableTitle: 'Departments',
    buildKpis: ({ rowsByDataset }) => {
      const rows = rowsByDataset.departments || [];
      const members = sumField(rows, 'memberCount');
      return [
        { label: 'Departments', value: rows.length, color: 'blue' },
        { label: 'Total members', value: members, color: 'indigo' },
        { label: 'Active depts', value: rows.filter((r) => r.status === 'Active').length, color: 'green' },
        { label: 'Empty', value: rows.filter((r) => r.status !== 'Active').length, color: 'gray' },
      ];
    },
    kpiCards: [
      { slug: 'departments', label: 'Departments', color: 'blue' },
      { slug: 'total-members', label: 'Total members', color: 'indigo' },
      { slug: 'active-depts', label: 'Active depts', color: 'green' },
      { slug: 'empty', label: 'Empty', color: 'gray' },
    ],
    charts: [
      { datasetId: 'departments', chartType: 'donut', title: 'Department status', categoryField: 'status' },
    ],
  },
];

export function getModuleConfig(key: ModuleTabKey) {
  return DASHBOARD_MODULE_TABS.find((m) => m.key === key);
}

/** Catalog / saved-widget module name for a command-center tab. */
export function commandCenterWidgetModule(key: ModuleTabKey, label: string): string {
  const map: Partial<Record<ModuleTabKey, string>> = {
    tasks: 'Task and activity',
    pipeline: 'Candidates',
  };
  return map[key] ?? label;
}

/** Default list dataset for the add-widget wizard in a command center tab. */
export function commandCenterPrimaryDatasetId(config: ModuleCommandConfig): string {
  const list = config.datasets.filter((id) => !/_(metrics|kpis|stats)$/.test(id));
  return list[0] || config.tableDatasetId || config.datasets[0] || '';
}
