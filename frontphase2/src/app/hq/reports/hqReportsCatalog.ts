export type HqReportPillar = 'employees' | 'employers' | 'crm' | 'ops' | 'custom';

export type HqReportPageId =
  | 'emp-overview'
  | 'emp-candidates'
  | 'emp-kyc'
  | 'emp-courses'
  | 'emp-jobs'
  | 'emp-events'
  | 'emp-subscriptions'
  | 'emp-tickets'
  | 'er-overview'
  | 'er-companies'
  | 'er-users'
  | 'er-plans'
  | 'er-tickets'
  | 'er-recycle'
  | 'crm-overview'
  | 'crm-leads'
  | 'crm-clients'
  | 'crm-demos'
  | 'ops-team'
  | 'ops-billing'
  | 'custom'
  | 'custom-saved';

export const HQ_REPORT_NAV: Array<{
  pillar: HqReportPillar;
  label: string;
  pages: Array<{ id: HqReportPageId; label: string }>;
}> = [
  {
    pillar: 'employees',
    label: 'Employees',
    pages: [
      { id: 'emp-overview', label: 'Overview' },
      { id: 'emp-candidates', label: 'Candidates' },
      { id: 'emp-kyc', label: 'KYC / Interviewers' },
      { id: 'emp-courses', label: 'Courses' },
      { id: 'emp-jobs', label: 'Portal Jobs' },
      { id: 'emp-events', label: 'Events' },
      { id: 'emp-subscriptions', label: 'Subscriptions' },
      { id: 'emp-tickets', label: 'Tickets' },
    ],
  },
  {
    pillar: 'employers',
    label: 'Employers',
    pages: [
      { id: 'er-overview', label: 'Overview' },
      { id: 'er-companies', label: 'Companies' },
      { id: 'er-users', label: 'Users' },
      { id: 'er-plans', label: 'Subscriptions' },
      { id: 'er-tickets', label: 'Tickets' },
      { id: 'er-recycle', label: 'Recycle Bin' },
    ],
  },
  {
    pillar: 'crm',
    label: 'CRM',
    pages: [
      { id: 'crm-overview', label: 'Overview' },
      { id: 'crm-leads', label: 'Leads' },
      { id: 'crm-clients', label: 'Clients' },
      { id: 'crm-demos', label: 'Demos & Trials' },
    ],
  },
  {
    pillar: 'ops',
    label: 'HQ Operations',
    pages: [
      { id: 'ops-team', label: 'Team' },
      { id: 'ops-billing', label: 'Billing' },
    ],
  },
  {
    pillar: 'custom',
    label: 'Custom',
    pages: [
      { id: 'custom', label: 'Report Builder' },
      { id: 'custom-saved', label: 'Saved Reports' },
    ],
  },
];

export function hqReportPageTitle(pageId: HqReportPageId): string {
  for (const group of HQ_REPORT_NAV) {
    const page = group.pages.find((item) => item.id === pageId);
    if (page) return `${group.label} · ${page.label}`;
  }
  return 'HQ Reports';
}
