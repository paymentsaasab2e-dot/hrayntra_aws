import { COMMON_FILTER_DEFS, DATE_RANGE_OPTIONS } from './dashboard.filters.js';
import { DASHBOARD_MODULE_PERMISSIONS as P } from './dashboardModuleAccess.js';

/** Display order for module groups in the UI */
export const DASHBOARD_MODULE_ORDER = [
  'Leads',
  'Clients',
  'Jobs',
  'Candidates',
  'Interviews',
  'Placements',
  'Task and activity',
  'Team',
  'Departments',
];

const statusOptions = (values) => [
  { value: 'all', label: 'All Status' },
  ...values.map((v) => ({ value: v, label: v })),
];

export const DATASET_REGISTRY = [
  {
    id: 'leads',
    label: 'All leads',
    module: 'Leads',
    description: 'Lead records with status and source',
    permissions: P.Leads,
    kind: 'list',
    filters: [
      COMMON_FILTER_DEFS.dateRange,
      {
        ...COMMON_FILTER_DEFS.statusAll,
        options: statusOptions(['New', 'Contacted', 'Qualified', 'Converted', 'Lost']),
      },
    ],
  },
  {
    id: 'clients',
    label: 'All clients',
    module: 'Clients',
    description: 'Client accounts',
    permissions: P.Clients,
    kind: 'list',
    filters: [
      COMMON_FILTER_DEFS.dateRange,
      {
        ...COMMON_FILTER_DEFS.statusAll,
        options: statusOptions(['ACTIVE', 'PROSPECT', 'ON_HOLD', 'INACTIVE']),
      },
    ],
  },
  {
    id: 'clients_metrics',
    label: 'Client metrics',
    module: 'Clients',
    description: 'KPI aggregates for clients',
    permissions: P.Clients,
    kind: 'metrics',
    filters: [COMMON_FILTER_DEFS.dateRange],
  },
  {
    id: 'jobs',
    label: 'All jobs',
    module: 'Jobs',
    description: 'Job requisitions and pipeline counts',
    permissions: P.Jobs,
    kind: 'list',
    filters: [
      COMMON_FILTER_DEFS.dateRange,
      {
        ...COMMON_FILTER_DEFS.statusAll,
        options: statusOptions(['OPEN', 'DRAFT', 'ON_HOLD', 'CLOSED', 'FILLED']),
      },
    ],
  },
  {
    id: 'jobs_metrics',
    label: 'Job metrics',
    module: 'Jobs',
    description: 'Aggregated job KPIs',
    permissions: P.Jobs,
    kind: 'metrics',
    filters: [COMMON_FILTER_DEFS.dateRange],
  },
  {
    id: 'candidates',
    label: 'All candidates',
    module: 'Candidates',
    description: 'Candidate pool records',
    permissions: P.Candidates,
    kind: 'list',
    filters: [
      COMMON_FILTER_DEFS.dateRange,
      {
        ...COMMON_FILTER_DEFS.statusAll,
        options: statusOptions([
          'Applied',
          'Longlist',
          'Shortlist',
          'Screening',
          'Submitted',
          'Interviewing',
          'Offered',
          'Hired',
          'Rejected',
        ]),
      },
    ],
  },
  {
    id: 'candidates_pipeline',
    label: 'Pipeline by stage',
    module: 'Candidates',
    description: 'Candidate counts per pipeline stage',
    permissions: [...P.Candidates, ...P.Pipeline],
    kind: 'metrics',
    filters: [],
  },
  {
    id: 'interviews',
    label: 'All interviews',
    module: 'Interviews',
    description: 'Scheduled and completed interviews',
    permissions: P.Interviews,
    kind: 'list',
    filters: [
      COMMON_FILTER_DEFS.dateRange,
      {
        ...COMMON_FILTER_DEFS.statusAll,
        options: statusOptions(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'IN_PROGRESS']),
      },
    ],
  },
  {
    id: 'interviews_kpis',
    label: 'Interview KPIs',
    module: 'Interviews',
    description: 'Today, upcoming, and completion metrics',
    permissions: P.Interviews,
    kind: 'metrics',
    filters: [COMMON_FILTER_DEFS.dateRange],
  },
  {
    id: 'placements',
    label: 'All placements',
    module: 'Placements',
    description: 'Placements and revenue',
    permissions: P.Placements,
    kind: 'list',
    filters: [
      COMMON_FILTER_DEFS.dateRange,
      {
        ...COMMON_FILTER_DEFS.statusAll,
        options: statusOptions(['JOINED', 'OFFERED', 'PENDING', 'FAILED', 'REPLACEMENT']),
      },
    ],
  },
  {
    id: 'placements_stats',
    label: 'Placement stats',
    module: 'Placements',
    description: 'Joined, pending, and revenue aggregates',
    permissions: P.Placements,
    kind: 'metrics',
    filters: [COMMON_FILTER_DEFS.dateRange],
  },
  {
    id: 'tasks_and_activity',
    label: 'Tasks & activity',
    module: 'Task and activity',
    description: 'Team tasks and recent user activity',
    permissions: P['Task and activity'],
    kind: 'list',
    filters: [COMMON_FILTER_DEFS.dateRange, COMMON_FILTER_DEFS.recordType],
  },
  {
    id: 'team',
    label: 'Team members',
    module: 'Team',
    description: 'Users, roles, and departments',
    permissions: P.Team,
    kind: 'list',
    filters: [
      {
        key: 'status',
        label: 'Member status',
        type: 'select',
        options: [
          { value: 'all', label: 'All' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
        ],
        defaultValue: 'all',
      },
    ],
  },
  {
    id: 'departments',
    label: 'Departments',
    module: 'Departments',
    description: 'Departments and member counts',
    permissions: P.Departments,
    kind: 'list',
    filters: [],
  },
];

export { DATE_RANGE_OPTIONS };
