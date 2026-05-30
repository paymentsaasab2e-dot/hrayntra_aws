/** Lead pipeline statuses — used for Leads KPI cards and Clients (by leadStatus). */
export const LEAD_PIPELINE_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'New', label: 'New' },
  { value: 'Contacted', label: 'Contacted' },
  { value: 'Qualified', label: 'Qualified' },
  { value: 'Converted', label: 'Converted' },
  { value: 'Lost', label: 'Lost' },
] as const;

export const CLIENT_LIFECYCLE_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'INACTIVE', label: 'Inactive' },
] as const;
