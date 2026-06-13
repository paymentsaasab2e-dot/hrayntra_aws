export type HqLeadStage = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export type HqLeadScore = 'Hot' | 'Warm' | 'Cold';

export type HqLeadRow = {
  id: string;
  name: string;
  company: string;
  industry: string;
  score: HqLeadScore;
  users: number;
  owner: string;
  stage: HqLeadStage;
  nextFollowUp: string;
  nextFollowUpAt?: string | null;
  email?: string;
  phone?: string;
  country?: string;
  estimatedDealValue?: number;
  leadSource?: string;
  interestedModules?: string[];
  initialNotes?: string;
  createdAt?: string | null;
  followUps?: HqLeadFollowUp[];
  remarks?: HqLeadRemark[];
  convertedToCompanyId?: string | null;
};

export type HqLeadFollowUp = {
  id: string;
  type: string;
  scheduledAt: string | null;
  notes: string;
  status: string;
  createdAt: string | null;
  createdByEmail?: string | null;
};

export type HqLeadRemark = {
  id: string;
  text: string;
  createdAt: string | null;
  createdByEmail?: string | null;
};

export type HqLeadDrawerTab = 'details' | 'followup' | 'remarks';

export const HQ_LEAD_FOLLOW_UP_TYPES = ['Call', 'Email', 'Meeting', 'WhatsApp', 'Other'] as const;

export const HQ_LEAD_MODULE_OPTIONS = [
  'Recruitment',
  'Payroll',
  'Time & Attendance',
  'Employee Management',
  'Performance',
] as const;

export const HQ_LEAD_INDUSTRY_OPTIONS = [
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

export const HQ_LEAD_SOURCE_OPTIONS = [
  'Referral',
  'Website',
  'LinkedIn',
  'Cold Outreach',
  'Event',
  'Partner',
  'Other',
] as const;

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
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export const HQ_LEAD_STAGE_LABELS: Record<HqLeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
};

export const HQ_LEAD_STAGE_STYLES: Record<HqLeadStage, string> = {
  new: 'bg-sky-50 text-sky-700 ring-sky-200',
  contacted: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  qualified: 'bg-violet-50 text-violet-700 ring-violet-200',
  converted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  lost: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const HQ_LEAD_TABS: { id: 'all' | HqLeadStage; label: string }[] = [
  { id: 'all', label: 'All Status' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'converted', label: 'Converted' },
  { id: 'lost', label: 'Lost' },
];

export function countLeadsByStage(leads: HqLeadRow[] = []) {
  const counts: Record<string, number> = { all: leads.length };
  for (const tab of HQ_LEAD_TABS) {
    if (tab.id === 'all') continue;
    counts[tab.id] = leads.filter((l) => l.stage === tab.id).length;
  }
  return counts;
}

export function computeHqLeadStats(leads: HqLeadRow[]) {
  const newLeads = leads.filter((l) => l.stage === 'new').length;
  const converted = leads.filter((l) => l.stage === 'converted').length;
  const lost = leads.filter((l) => l.stage === 'lost').length;
  const followUpsToday = 0;
  const conversionRate = leads.length ? Math.round((converted / leads.length) * 100) : 0;
  return { total: leads.length, newLeads, followUpsToday, converted, lost, conversionRate };
}
