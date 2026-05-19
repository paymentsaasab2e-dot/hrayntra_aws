import { COMMON_FILTER_DEFS, DATE_RANGE_OPTIONS } from './dashboard.filters.js';

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
    permissions: ['leads_read', 'leads_create', 'leads_update'],
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
    permissions: ['clients_read', 'clients_create', 'clients_update'],
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
    permissions: ['clients_read'],
    kind: 'metrics',
    filters: [COMMON_FILTER_DEFS.dateRange],
  },
  {
    id: 'jobs',
    label: 'All jobs',
    module: 'Jobs',
    description: 'Job requisitions and pipeline counts',
    permissions: ['jobs_read', 'view_jobs', 'create_job', 'edit_job'],
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
    permissions: ['jobs_read', 'view_jobs'],
    kind: 'metrics',
    filters: [COMMON_FILTER_DEFS.dateRange],
  },
  {
    id: 'candidates',
    label: 'All candidates',
    module: 'Candidates',
    description: 'Candidate pool records',
    permissions: ['candidates_read', 'view_all_candidates', 'view_assigned_candidates'],
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
    permissions: ['candidates_read', 'view_all_candidates', 'view_assigned_candidates'],
    kind: 'metrics',
    filters: [],
  },
  {
    id: 'interviews',
    label: 'All interviews',
    module: 'Interviews',
    description: 'Scheduled and completed interviews',
    permissions: ['interviews_read', 'interviews_create'],
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
    permissions: ['interviews_read'],
    kind: 'metrics',
    filters: [COMMON_FILTER_DEFS.dateRange],
  },
  {
    id: 'placements',
    label: 'All placements',
    module: 'Placements',
    description: 'Placements and revenue',
    permissions: ['placements_read', 'placements_create'],
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
    permissions: ['placements_read'],
    kind: 'metrics',
    filters: [COMMON_FILTER_DEFS.dateRange],
  },
  {
    id: 'tasks_and_activity',
    label: 'Tasks & activity',
    module: 'Task and activity',
    description: 'Team tasks and recent user activity',
    permissions: [
      'leads_read',
      'clients_read',
      'jobs_read',
      'candidates_read',
      'interviews_read',
      'placements_read',
      'manage_settings',
      'export_data',
    ],
    kind: 'list',
    filters: [COMMON_FILTER_DEFS.dateRange, COMMON_FILTER_DEFS.recordType],
  },
  {
    id: 'team',
    label: 'Team members',
    module: 'Team',
    description: 'Users, roles, and departments',
    permissions: ['add_team_member', 'edit_team_member', 'assign_roles', 'generate_credentials'],
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
    permissions: ['add_team_member', 'edit_team_member', 'manage_settings'],
    kind: 'list',
    filters: [],
  },
];

export { DATE_RANGE_OPTIONS };
