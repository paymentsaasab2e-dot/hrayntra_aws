export type HqCompanyStatus = 'active' | 'inactive' | 'on_hold' | 'closed';

export type HqCompanyScore = 'Hot' | 'Warm' | 'Cold';

export type HqCompanyFollowUp = {
  id: string;
  type: string;
  scheduledAt: string | null;
  notes: string;
  status: string;
  createdAt: string | null;
  createdByEmail?: string | null;
  completedAt?: string | null;
};

export type HqCompanyRemark = {
  id: string;
  text: string;
  createdAt: string | null;
  createdByEmail?: string | null;
};

export type HqCompanyRow = {
  id: string;
  name: string;
  contact: string;
  industry: string;
  score: HqCompanyScore;
  users: number;
  owner: string;
  status: HqCompanyStatus;
  nextFollowUp: string;
  nextFollowUpAt?: string | null;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  estimatedDealValue?: number;
  companySource?: string;
  interestedModules?: string[];
  initialNotes?: string;
  createdAt?: string | null;
  followUps?: HqCompanyFollowUp[];
  remarks?: HqCompanyRemark[];
};

export type HqCompanyDrawerTab = 'details' | 'followup' | 'remarks';

export const HQ_COMPANY_STATUS_LABELS: Record<HqCompanyStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  on_hold: 'On Hold',
  closed: 'Closed',
};

export const HQ_COMPANY_STATUS_STYLES: Record<HqCompanyStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-200',
  on_hold: 'bg-amber-50 text-amber-800 ring-amber-200',
  closed: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const HQ_COMPANY_TABS: { id: 'all' | HqCompanyStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'closed', label: 'Closed' },
];

export const HQ_COMPANY_INDUSTRY_OPTIONS = [
  'IT Services',
  'Manufacturing',
  'Technology',
  'Consulting',
  'Media',
  'Security',
  'Real Estate',
  'Healthcare',
  'Staffing',
  'Design',
  'Agriculture',
  'Other',
] as const;

export const HQ_COMPANY_SOURCE_OPTIONS = [
  'Referral',
  'Website',
  'LinkedIn',
  'Cold Outreach',
  'Event',
  'Partner',
  'Other',
] as const;

export const HQ_COMPANY_MODULE_OPTIONS = [
  'Recruitment',
  'Payroll',
  'Time & Attendance',
  'Employee Management',
  'Performance',
] as const;

export const HQ_COMPANY_FOLLOW_UP_TYPES = ['Call', 'Email', 'Meeting', 'WhatsApp', 'Other'] as const;

export function toDatetimeLocalValue(value?: string | Date | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function defaultNextFollowUpLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

export function formatNextFollowUpDisplay(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function countCompaniesByStatus(companies: HqCompanyRow[] = []) {
  const counts: Record<string, number> = { all: companies.length };
  for (const tab of HQ_COMPANY_TABS) {
    if (tab.id === 'all') continue;
    counts[tab.id] = companies.filter((c) => c.status === tab.id).length;
  }
  return counts;
}
