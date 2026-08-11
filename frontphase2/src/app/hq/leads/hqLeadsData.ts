export type HqLeadStage = 'new' | 'demo' | 'contacted' | 'qualified' | 'converted' | 'lost';

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
  leadSourceDetail?: string;
  interestedModules?: string[];
  initialNotes?: string;
  createdAt?: string | null;
  followUps?: HqLeadFollowUp[];
  remarks?: HqLeadRemark[];
  convertedToCompanyId?: string | null;
  employerDemoRequestId?: string | null;
  preferredDemoDate?: string | null;
  preferredDemoTime?: string | null;
};

export type HqLeadFollowUp = {
  id: string;
  type: string;
  scheduledAt: string | null;
  notes: string;
  status: string;
  createdAt: string | null;
  createdByEmail?: string | null;
  completedAt?: string | null;
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
  'Website form fill up',
  'LinkedIn',
  'Cold Outreach',
  'Event',
  'Partner',
  'Other',
] as const;

export type HqLeadSourceOption = (typeof HQ_LEAD_SOURCE_OPTIONS)[number];

export const HQ_LEAD_SOURCE_DETAIL_FIELDS: Record<
  HqLeadSourceOption,
  { label: string; placeholder: string }
> = {
  Referral: { label: 'Referral Name', placeholder: 'Who referred this lead?' },
  Website: { label: 'Website URL', placeholder: 'https://example.com' },
  'Website form fill up': { label: 'Form / Page', placeholder: 'e.g. Request demo page' },
  LinkedIn: { label: 'LinkedIn URL', placeholder: 'https://linkedin.com/...' },
  'Cold Outreach': { label: 'Outreach Details', placeholder: 'e.g. Email sequence, cold call' },
  Event: { label: 'Event Name', placeholder: 'e.g. HR Tech Summit 2026' },
  Partner: { label: 'Partner Name', placeholder: 'Partner organization or contact' },
  Other: { label: 'Source Details', placeholder: 'Describe how this lead was sourced' },
};

export function formatHqLeadSourceDisplay(source?: string, detail?: string | null): string {
  if (!source?.trim()) return '—';
  const trimmedDetail = String(detail || '').trim();
  if (!trimmedDetail) return source;
  return `${source} — ${trimmedDetail}`;
}

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
  demo: 'Demo',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
};

export const HQ_LEAD_STAGE_STYLES: Record<HqLeadStage, string> = {
  new: 'bg-sky-50 text-sky-700 ring-sky-200',
  demo: 'bg-orange-50 text-orange-700 ring-orange-200',
  contacted: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  qualified: 'bg-violet-50 text-violet-700 ring-violet-200',
  converted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  lost: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const HQ_LEAD_TABS: { id: 'all' | HqLeadStage; label: string }[] = [
  { id: 'all', label: 'All Status' },
  { id: 'new', label: 'New' },
  { id: 'demo', label: 'Demo' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'converted', label: 'Converted' },
  { id: 'lost', label: 'Lost' },
];

export type HqLeadsPageTab = 'all' | HqLeadStage | 'demos';

export const HQ_LEADS_PAGE_TABS: { id: HqLeadsPageTab; label: string }[] = [
  ...HQ_LEAD_TABS,
  { id: 'demos', label: 'Landing signups' },
];

export type HqDemoRequestStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED';

export type HqDemoRequestRow = {
  id: string;
  fullName: string;
  email: string;
  organizationName: string;
  countryCode: string;
  dialCode: string;
  phoneNumber: string;
  companySize: string;
  outcome: string;
  requestKind: 'demo' | 'trial' | 'purchase';
  packageSlug?: string;
  packageName?: string;
  billingCycle?: string;
  trialProvisioned: boolean;
  trialTenantDbName: string;
  trialLoginId: string;
  trialDays?: number | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  trialLoginUrl: string;
  credentialsSentAt?: string | null;
  status: HqDemoRequestStatus;
  emailVerifiedAt: string | null;
  createdAt: string | null;
  submittedAt: string;
};

export type HqTryFreeAccessStatus = 'not_granted' | 'active' | 'expired';

export function getDemoTryFreeAccessStatus(demo: {
  trialProvisioned?: boolean;
  trialEndsAt?: string | null;
}): HqTryFreeAccessStatus {
  if (!demo.trialProvisioned) return 'not_granted';
  const end = String(demo.trialEndsAt || '').trim().slice(0, 10);
  if (!end) return 'active';
  const today = new Date().toISOString().slice(0, 10);
  return end < today ? 'expired' : 'active';
}

export function formatDemoTryFreeAccessLabel(demo: {
  trialProvisioned?: boolean;
  trialEndsAt?: string | null;
}): string {
  const status = getDemoTryFreeAccessStatus(demo);
  if (status === 'not_granted') return 'Not granted';
  if (status === 'expired') return 'Expired';
  const end = String(demo.trialEndsAt || '').trim().slice(0, 10);
  return end ? `Active until ${end}` : 'Active';
}

export const HQ_DEMO_STATUS_STYLES: Record<HqDemoRequestStatus, string> = {
  VERIFIED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  EXPIRED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export const HQ_DEMO_STATUS_LABELS: Record<HqDemoRequestStatus, string> = {
  VERIFIED: 'Verified',
  PENDING: 'Pending',
  EXPIRED: 'Expired',
};

export const BOOK_A_DEMO_TAG_CLASS =
  'bg-sky-50 text-sky-700 ring-sky-200';

/** True when this HQ lead came from the employers "Request / Book a demo" form. */
export function isBookADemoLead(lead: {
  leadSource?: string | null;
  leadSourceDetail?: string | null;
  employerDemoRequestId?: string | null;
  initialNotes?: string | null;
  preferredDemoDate?: string | null;
}): boolean {
  if (lead.employerDemoRequestId) return true;
  if (lead.preferredDemoDate) return true;
  const detail = String(lead.leadSourceDetail || '').toLowerCase();
  if (detail.includes('request demo') || detail.includes('try-free')) return true;
  const notes = String(lead.initialNotes || '');
  if (/\[demo-slot:/i.test(notes) || /booked demo:/i.test(notes)) return true;
  if (
    String(lead.leadSource || '') === 'Website form fill up' &&
    /demo/i.test(`${detail} ${notes}`)
  ) {
    return true;
  }
  return false;
}

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
