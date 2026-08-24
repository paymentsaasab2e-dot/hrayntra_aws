import { HQ_LEAD_STAGE_LABELS, type HqLeadStage } from '@/app/hq/leads/hqLeadsData';
import type {
  HqCompanyApiRow,
  HqCourseRow,
  HqCustomReportRow,
  HqHelpTicket,
  HqKycInterviewerRow,
  HqLeadApiRow,
  HqPortalCandidateRow,
  HqPortalJobRow,
  HqSupportTicket,
  HqTeamMemberRow,
  HqTenantRow,
} from '@/lib/api';
import type { HqDemoRequestRow } from '@/app/hq/leads/hqLeadsData';
import type { PortalEventRow } from '@/lib/portal-events-api';

export type HqReportRange = 'all' | '7d' | '30d' | '90d' | 'custom';

export type HqNamedCount = { label: string; count: number; value?: number };

export const HQ_REPORT_DATASETS: Array<{ id: HqCustomReportRow['dataset']; label: string }> = [
  { id: 'leads', label: 'Leads' },
  { id: 'clients', label: 'Clients' },
  { id: 'demos', label: 'Demos & trials' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'companies', label: 'Companies' },
  { id: 'tickets', label: 'Employer tickets' },
  { id: 'helpTickets', label: 'Employee tickets' },
  { id: 'team', label: 'Team' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'kyc', label: 'KYC / Interviewers' },
  { id: 'courses', label: 'Courses' },
  { id: 'jobs', label: 'Portal jobs' },
  { id: 'events', label: 'Events' },
];

export const HQ_REPORT_GROUP_BY: Record<HqCustomReportRow['dataset'], Array<{ id: string; label: string }>> = {
  leads: [
    { id: 'stage', label: 'Stage' },
    { id: 'source', label: 'Source' },
    { id: 'owner', label: 'Owner' },
    { id: 'score', label: 'Score' },
    { id: 'industry', label: 'Industry' },
    { id: 'country', label: 'Country' },
  ],
  clients: [
    { id: 'status', label: 'Status' },
    { id: 'industry', label: 'Industry' },
    { id: 'owner', label: 'Owner' },
    { id: 'country', label: 'Country' },
    { id: 'source', label: 'Source' },
  ],
  demos: [
    { id: 'status', label: 'Status' },
    { id: 'kind', label: 'Request kind' },
    { id: 'trial', label: 'Trial access' },
    { id: 'package', label: 'Package' },
  ],
  tenants: [
    { id: 'type', label: 'Organization type' },
    { id: 'source', label: 'Signup source' },
    { id: 'plan', label: 'Plan' },
    { id: 'status', label: 'Status' },
  ],
  tickets: [
    { id: 'status', label: 'Status' },
    { id: 'priority', label: 'Priority' },
    { id: 'category', label: 'Category' },
    { id: 'source', label: 'Source' },
  ],
  team: [
    { id: 'status', label: 'Status' },
    { id: 'role', label: 'Role' },
    { id: 'department', label: 'Department' },
  ],
  companies: [
    { id: 'status', label: 'Status' },
    { id: 'industry', label: 'Industry' },
    { id: 'owner', label: 'Owner' },
    { id: 'country', label: 'Country' },
    { id: 'source', label: 'Source' },
  ],
  candidates: [
    { id: 'origin', label: 'Origin' },
    { id: 'status', label: 'Status' },
    { id: 'stage', label: 'Stage' },
    { id: 'kyc', label: 'KYC' },
    { id: 'location', label: 'Location' },
  ],
  kyc: [
    { id: 'kind', label: 'Kind' },
    { id: 'hq', label: 'HQ verified' },
    { id: 'live', label: 'Live for candidates' },
    { id: 'application', label: 'Application status' },
  ],
  courses: [
    { id: 'published', label: 'Published' },
    { id: 'category', label: 'Category' },
    { id: 'tier', label: 'Access tier' },
    { id: 'level', label: 'Level' },
    { id: 'certified', label: 'Certified' },
  ],
  jobs: [
    { id: 'origin', label: 'Origin' },
    { id: 'status', label: 'Status' },
    { id: 'workMode', label: 'Work mode' },
    { id: 'company', label: 'Company' },
    { id: 'location', label: 'Location' },
  ],
  events: [
    { id: 'published', label: 'Published' },
    { id: 'type', label: 'Type' },
    { id: 'mode', label: 'Mode' },
  ],
  helpTickets: [
    { id: 'status', label: 'Status' },
    { id: 'category', label: 'Category' },
    { id: 'source', label: 'Source' },
  ],
};

export function rangeStartIso(range: HqReportRange): string | null {
  if (range === 'all' || range === 'custom') return null;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);
  return start.toISOString();
}

export function resolveReportRange(
  range: HqReportRange,
  customFrom?: string,
  customTo?: string,
): { from: string | null; to: string | null } {
  if (range === 'custom') {
    return { from: customFrom || null, to: customTo || null };
  }
  return { from: rangeStartIso(range), to: null };
}

export function inDateRange(value: string | null | undefined, from?: string | null, to?: string | null): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  if (from) {
    const fromTime = new Date(from).getTime();
    if (!Number.isNaN(fromTime) && time < fromTime) return false;
  }
  if (to) {
    const toTime = new Date(to).getTime();
    if (!Number.isNaN(toTime) && time > toTime + 24 * 60 * 60 * 1000 - 1) return false;
  }
  return true;
}

export function countBy(rows: Array<{ label: string; value?: number }>): HqNamedCount[] {
  const map = new Map<string, { count: number; value: number }>();
  for (const row of rows) {
    const label = String(row.label || 'Unknown').trim() || 'Unknown';
    const current = map.get(label) || { count: 0, value: 0 };
    current.count += 1;
    current.value += Number(row.value || 0);
    map.set(label, current);
  }
  return [...map.entries()]
    .map(([label, data]) => ({ label, count: data.count, value: data.value }))
    .sort((a, b) => b.count - a.count);
}

function pretty(value: string | null | undefined, fallback = 'Unknown') {
  const text = String(value || '').trim();
  return text || fallback;
}

export function hqOriginLabel(origin: string | null | undefined) {
  if (origin === 'phase1_portal') return 'Portal';
  if (origin === 'phase1_common') return 'Common pool';
  if (origin === 'phase2_crm') return 'Phase 2';
  return pretty(origin);
}

export function topN(rows: HqNamedCount[], limit = 8): HqNamedCount[] {
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit - 1);
  const rest = rows.slice(limit - 1);
  return [
    ...head,
    {
      label: 'Other',
      count: rest.reduce((sum, row) => sum + row.count, 0),
      value: rest.reduce((sum, row) => sum + Number(row.value || 0), 0),
    },
  ];
}

export function countByDay(values: Array<string | null | undefined>): HqNamedCount[] {
  const dated = values.filter((value): value is string => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return !Number.isNaN(time);
  });
  const grouped = countBy(
    dated.map((value) => ({ label: new Date(value).toISOString().slice(0, 10) })),
  ).sort((a, b) => a.label.localeCompare(b.label));
  return grouped.length >= 2 ? grouped : [];
}

export function pickCustomChartKind(rows: HqNamedCount[], metric: 'count' | 'pipeline'): 'donut' | 'hbar' | 'bar' {
  if (metric === 'pipeline') return 'bar';
  return rows.length <= 5 ? 'donut' : 'hbar';
}

export function experienceBand(years: number): string {
  if (years <= 2) return '0–2';
  if (years <= 5) return '3–5';
  if (years <= 10) return '6–10';
  return '10+';
}

export function priceBand(price: number): string {
  if (price <= 0) return 'Free / unset';
  if (price <= 500) return '1–500';
  if (price <= 1500) return '501–1500';
  return '1500+';
}

export function groupHqLeads(leads: HqLeadApiRow[], groupBy: string): HqNamedCount[] {
  return countBy(
    leads.map((lead) => {
      switch (groupBy) {
        case 'source':
          return { label: pretty(lead.leadSource || lead.source), value: Number(lead.estimatedDealValue || 0) };
        case 'owner':
          return { label: pretty(lead.owner, 'Unassigned'), value: Number(lead.estimatedDealValue || 0) };
        case 'score':
          return { label: pretty(lead.score), value: Number(lead.estimatedDealValue || 0) };
        case 'industry':
          return { label: pretty(lead.industry), value: Number(lead.estimatedDealValue || 0) };
        case 'country':
          return { label: pretty(lead.country), value: Number(lead.estimatedDealValue || 0) };
        default:
          return {
            label: HQ_LEAD_STAGE_LABELS[lead.stage as HqLeadStage] || pretty(lead.stage),
            value: Number(lead.estimatedDealValue || 0),
          };
      }
    }),
  );
}

export function groupHqClients(companies: HqCompanyApiRow[], groupBy: string): HqNamedCount[] {
  return countBy(
    companies.map((company) => {
      switch (groupBy) {
        case 'industry':
          return { label: pretty(company.industry), value: Number(company.estimatedDealValue || 0) };
        case 'owner':
          return { label: pretty(company.owner, 'Unassigned'), value: Number(company.estimatedDealValue || 0) };
        case 'country':
          return { label: pretty(company.country), value: Number(company.estimatedDealValue || 0) };
        case 'source':
          return { label: pretty(company.companySource), value: Number(company.estimatedDealValue || 0) };
        default:
          return {
            label: pretty(String(company.status || '').replace('_', ' ')),
            value: Number(company.estimatedDealValue || 0),
          };
      }
    }),
  );
}

export function groupHqDemos(demos: HqDemoRequestRow[], groupBy: string): HqNamedCount[] {
  return countBy(
    demos.map((demo) => {
      switch (groupBy) {
        case 'kind':
          return { label: pretty(demo.requestKind || 'demo') };
        case 'trial':
          return { label: demo.trialProvisioned ? 'Trial granted' : 'No trial yet' };
        case 'package':
          return { label: pretty(demo.packageName || demo.packageSlug, 'No package') };
        default:
          return { label: pretty(demo.status) };
      }
    }),
  );
}

export function groupHqTenants(tenants: HqTenantRow[], groupBy: string): HqNamedCount[] {
  return countBy(
    tenants.map((tenant) => {
      switch (groupBy) {
        case 'source':
          return { label: pretty(tenant.signupSource || tenant.source) };
        case 'plan':
          return { label: pretty(tenant.subscriptionPlan?.name, 'No plan') };
        case 'status':
          return { label: pretty(tenant.status, 'active') };
        default:
          return { label: pretty(tenant.organizationType) };
      }
    }),
  );
}

export function groupHqTickets(tickets: HqSupportTicket[], groupBy: string): HqNamedCount[] {
  return countBy(
    tickets.map((ticket) => {
      switch (groupBy) {
        case 'priority':
          return { label: pretty(ticket.priority) };
        case 'category':
          return { label: pretty(ticket.category) };
        default:
          return { label: pretty(ticket.status).replace('_', ' ') };
      }
    }),
  );
}

export function groupHqTeam(members: HqTeamMemberRow[], groupBy: string): HqNamedCount[] {
  return countBy(
    members.map((member) => {
      switch (groupBy) {
        case 'role':
          return { label: pretty(member.role) };
        case 'department':
          return { label: pretty(member.department) };
        default:
          return { label: pretty(member.status) };
      }
    }),
  );
}

export function groupHqCandidates(rows: HqPortalCandidateRow[], groupBy: string): HqNamedCount[] {
  return countBy(
    rows.map((row) => {
      if (groupBy === 'origin') return { label: hqOriginLabel(row.origin) };
      if (groupBy === 'stage') return { label: pretty(row.stage) };
      if (groupBy === 'kyc') return { label: row.kycVerified ? 'KYC verified' : 'Not verified' };
      if (groupBy === 'location') return { label: pretty(row.location) };
      return { label: pretty(row.status) };
    }),
  );
}

export function groupHqKyc(rows: HqKycInterviewerRow[], groupBy: string): HqNamedCount[] {
  return countBy(
    rows.map((row) => {
      if (groupBy === 'hq') return { label: row.hqVerified ? 'HQ verified' : 'Pending HQ' };
      if (groupBy === 'live') return { label: row.liveForCandidates ? 'Live' : 'Not live' };
      if (groupBy === 'application') return { label: pretty(row.applicationStatus) };
      return { label: pretty(row.kind || 'applicant') };
    }),
  );
}

export function groupHqCourses(rows: HqCourseRow[], groupBy: string): HqNamedCount[] {
  return countBy(
    rows.map((row) => {
      if (groupBy === 'category') return { label: pretty(row.category) };
      if (groupBy === 'tier') return { label: pretty(row.accessTier) };
      if (groupBy === 'level') return { label: pretty(row.level) };
      if (groupBy === 'certified') return { label: row.isCertified ? 'Certified' : 'Not certified' };
      return { label: row.isPublished ? 'Published' : 'Draft' };
    }),
  );
}

export function groupHqJobs(rows: HqPortalJobRow[], groupBy: string): HqNamedCount[] {
  return countBy(
    rows.map((row) => {
      if (groupBy === 'origin') return { label: hqOriginLabel(row.origin) };
      if (groupBy === 'workMode') return { label: pretty(row.workMode) };
      if (groupBy === 'company') return { label: pretty(row.company) };
      if (groupBy === 'location') return { label: pretty(row.location) };
      return { label: pretty(row.status) };
    }),
  );
}

export function groupHqEvents(rows: PortalEventRow[], groupBy: string): HqNamedCount[] {
  return countBy(
    rows.map((row) => {
      if (groupBy === 'type') return { label: pretty(row.type) };
      if (groupBy === 'mode') return { label: pretty(row.mode) };
      return { label: row.isPublished ? 'Published' : 'Unpublished' };
    }),
  );
}

export function groupHqHelpTickets(rows: HqHelpTicket[], groupBy: string): HqNamedCount[] {
  return countBy(
    rows.map((row) => {
      if (groupBy === 'category') return { label: pretty(row.category) };
      if (groupBy === 'source') return { label: pretty(row.source) };
      return { label: pretty(row.status).replace('_', ' ') };
    }),
  );
}

export function runCustomHqReport(
  report: Pick<HqCustomReportRow, 'dataset' | 'groupBy'>,
  data: {
    leads: HqLeadApiRow[];
    companies: HqCompanyApiRow[];
    demos: HqDemoRequestRow[];
    tenants: HqTenantRow[];
    tickets: HqSupportTicket[];
    team: HqTeamMemberRow[];
    candidates: HqPortalCandidateRow[];
    kyc: HqKycInterviewerRow[];
    courses: HqCourseRow[];
    jobs: HqPortalJobRow[];
    events: PortalEventRow[];
    helpTickets: HqHelpTicket[];
  },
): HqNamedCount[] {
  switch (report.dataset) {
    case 'clients':
    case 'companies':
      return groupHqClients(data.companies, report.groupBy);
    case 'demos':
      return groupHqDemos(data.demos, report.groupBy);
    case 'tenants':
      return groupHqTenants(data.tenants, report.groupBy);
    case 'tickets':
      return groupHqTickets(data.tickets, report.groupBy);
    case 'helpTickets':
      return groupHqHelpTickets(data.helpTickets, report.groupBy);
    case 'team':
      return groupHqTeam(data.team, report.groupBy);
    case 'candidates':
      return groupHqCandidates(data.candidates, report.groupBy);
    case 'kyc':
      return groupHqKyc(data.kyc, report.groupBy);
    case 'courses':
      return groupHqCourses(data.courses, report.groupBy);
    case 'jobs':
      return groupHqJobs(data.jobs, report.groupBy);
    case 'events':
      return groupHqEvents(data.events, report.groupBy);
    default:
      return groupHqLeads(data.leads, report.groupBy);
  }
}

export function downloadCsv(fileName: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
