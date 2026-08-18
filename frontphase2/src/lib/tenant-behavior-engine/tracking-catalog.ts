/** What Phase 2 tracks per tenant — counts + entity ids, not people names. */

export type TrackingCatalogGroup = {
  title: string;
  items: Array<{ signal: string; meaning: string }>;
};

export const PHASE2_TENANT_TRACKING_CATALOG: TrackingCatalogGroup[] = [
  {
    title: 'Sessions & time',
    items: [
      { signal: 'Login / logout', meaning: 'When a workspace user starts or ends a session.' },
      { signal: 'Active time slices', meaning: 'Time the tab is visible, rolled up by module (15s heartbeat).' },
      { signal: 'Session count', meaning: 'Distinct sessions in the selected range.' },
      { signal: 'Online now', meaning: 'Users with activity in the last ~3 minutes.' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { signal: 'Page visits', meaning: 'Each CRM/recruitment route change, tagged by module (jobs, leads, …).' },
      { signal: 'First-open', meaning: 'First module opened in a day — used for focus patterns.' },
      { signal: 'Searches', meaning: 'Search actions inside tenant modules.' },
    ],
  },
  {
    title: 'Records (ids only)',
    items: [
      { signal: 'Entity views', meaning: 'Opened lead / job / candidate / client / interview records (id, not name).' },
      { signal: 'Entity clicks', meaning: 'Row/card clicks marked with data-behavior-entity.' },
      { signal: 'Stuck record', meaning: 'Same id opened many times with zero writes.' },
    ],
  },
  {
    title: 'Work done',
    items: [
      { signal: 'CRM actions', meaning: 'Saves, assigns, stage moves, bulk actions from UI.' },
      { signal: 'API mutations', meaning: 'Create / update / delete / export calls classified by module.' },
      { signal: 'Workflow steps', meaning: 'Forward movement along the hiring funnel.' },
      { signal: 'Action breakdown', meaning: 'Counts by action type (create, update, assign, …).' },
    ],
  },
  {
    title: 'Live CRM workload',
    items: [
      { signal: 'Open jobs / candidates / leads / clients', meaning: 'Current tenant database counts.' },
      { signal: 'Interviews / placements / pipeline / tasks', meaning: 'Open operational backlog.' },
      { signal: 'Team size', meaning: 'Active users on the tenant, not who is who in HQ.' },
    ],
  },
  {
    title: 'Signals (triggers)',
    items: [
      { signal: 'Lead stall', meaning: 'Many open leads, little client conversion.' },
      { signal: 'Jobs without bench', meaning: 'Open jobs, little candidate/pipeline work.' },
      { signal: 'Browse, no write', meaning: 'Lots of views, few saves.' },
      { signal: 'Overdue meetings / incomplete fields', meaning: 'Drawer engine blockers.' },
      { signal: 'Reports-only / interview–placement gap', meaning: 'Funnel imbalance.' },
      { signal: 'Idle seats / healthy funnel', meaning: 'Tenant-wide HQ sales/CS flags only.' },
    ],
  },
];

export const PHASE2_TRACKED_MODULES = [
  'Dashboard',
  'Leads',
  'Clients',
  'Contacts',
  'Jobs',
  'Candidates',
  'Pipeline',
  'Matches',
  'Interviews',
  'Placements',
  'Recruitment hub',
  'Calendar & events',
  'Inbox',
  'Reports',
  'Team',
  'Billing',
  'Settings',
  'AI workspace',
];
