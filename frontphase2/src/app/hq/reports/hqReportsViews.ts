import { HQ_LEAD_STAGE_LABELS, type HqLeadStage } from '@/app/hq/leads/hqLeadsData';
import type { HqDemoRequestRow } from '@/app/hq/leads/hqLeadsData';
import type {
  HqBillingPayload,
  HqCompanyApiRow,
  HqCourseRow,
  HqHelpTicket,
  HqKycInterviewerRow,
  HqLeadApiRow,
  HqPortalCandidateRow,
  HqPortalJobRow,
  HqSupportTicket,
  HqTeamMemberRow,
  HqTenantRow,
} from '@/lib/api';
import type { PortalEventRow } from '@/lib/portal-events-api';
import type { HqReportTableColumn } from './HqReportRecordsTable';
import type { HqReportPageId } from './hqReportsCatalog';
import {
  countBy,
  groupHqCandidates,
  groupHqClients,
  groupHqCourses,
  groupHqDemos,
  groupHqEvents,
  groupHqHelpTickets,
  groupHqJobs,
  groupHqKyc,
  groupHqLeads,
  groupHqTeam,
  groupHqTenants,
  groupHqTickets,
  type HqNamedCount,
} from './hqReportsBuild';

export type HqReportKpi = { label: string; value: string | number; active?: boolean };
export type HqReportBreakdown = { title: string; rows: HqNamedCount[] };

export type HqReportView = {
  kpis: HqReportKpi[];
  breakdowns: HqReportBreakdown[];
  tableTitle: string;
  columns: HqReportTableColumn[];
  rows: Array<Record<string, string | number>>;
  csvName: string;
  csvHeaders: string[];
  csvRows: Array<Array<string | number>>;
};

export type HqReportSourceData = {
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
  recycle: HqTenantRow[];
  billing: HqBillingPayload | null;
};

function dash(value: string | number | null | undefined, fallback = '—') {
  if (value === 0) return 0;
  const text = String(value ?? '').trim();
  return text || fallback;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function yesNo(value: boolean | undefined) {
  return value ? 'Yes' : 'No';
}

function originLabel(origin: string | undefined) {
  if (origin === 'phase1_portal') return 'Portal';
  if (origin === 'phase1_common') return 'Common pool';
  if (origin === 'phase2_crm') return 'Phase 2';
  return dash(origin);
}

function statusLabel(value: string | undefined) {
  return dash(String(value || '').replace(/_/g, ' '));
}

function leadStage(stage: string | undefined) {
  return HQ_LEAD_STAGE_LABELS[stage as HqLeadStage] || dash(stage);
}

function newest<T>(rows: T[], getDate: (row: T) => string | null | undefined, limit?: number) {
  const sorted = [...rows].sort((a, b) => {
    const aTime = new Date(getDate(a) || 0).getTime();
    const bTime = new Date(getDate(b) || 0).getTime();
    return bTime - aTime;
  });
  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}

function tableCsv(
  csvName: string,
  columns: HqReportTableColumn[],
  rows: Array<Record<string, string | number>>,
): Pick<HqReportView, 'csvName' | 'csvHeaders' | 'csvRows'> {
  return {
    csvName,
    csvHeaders: columns.map((col) => col.label),
    csvRows: rows.map((row) => columns.map((col) => (row[col.key] === '—' ? '' : row[col.key] ?? ''))),
  };
}

function overviewCsv(
  csvName: string,
  kpis: HqReportKpi[],
  breakdowns: HqReportBreakdown[],
): Pick<HqReportView, 'csvName' | 'csvHeaders' | 'csvRows'> {
  const csvRows: Array<Array<string | number>> = kpis.map((kpi) => ['KPI', kpi.label, kpi.value]);
  for (const group of breakdowns) {
    for (const row of group.rows) {
      csvRows.push([group.title, row.label, row.count]);
    }
  }
  return { csvName, csvHeaders: ['Section', 'Label', 'Value'], csvRows };
}

function candidateRow(row: HqPortalCandidateRow): Record<string, string | number> {
  return {
    id: row.id,
    name: dash(row.name),
    email: dash(row.email),
    phone: dash(row.phone),
    title: dash(row.title),
    location: dash(row.location),
    origin: originLabel(row.origin),
    status: dash(row.status),
    stage: dash(row.stage),
    kyc: yesNo(row.kycVerified),
    interviewer: yesNo(row.isInterviewer),
    tenantDb: dash(row.tenantDbName),
    created: fmtDate(row.createdAt),
  };
}

function tenantRow(row: HqTenantRow): Record<string, string | number> {
  return {
    id: row.id || row.email,
    name: dash(row.organizationName || row.name),
    email: dash(row.email),
    login: dash(row.loginId),
    type: dash(row.organizationType),
    source: dash(row.signupSource || row.source),
    plan: dash(row.subscriptionPlan?.name),
    productLine: dash(row.productLine),
    paused: row.pausedAt ? 'Paused' : '—',
    status: dash(row.status, 'active'),
    tenantDb: dash(row.tenantDbName),
    created: fmtDate(row.createdAt),
    deletedAt: fmtDate(row.deletedAt),
    deletedBy: dash(row.deletedBy),
  };
}

function companyRow(row: HqCompanyApiRow): Record<string, string | number> {
  return {
    id: row.id,
    name: dash(row.name),
    contact: dash(row.contact || row.directorName),
    email: dash(row.email || row.emails?.[0]),
    phone: dash(row.phone || row.phones?.[0]),
    status: statusLabel(row.status),
    industry: dash(row.industry),
    owner: dash(row.owner, 'Unassigned'),
    country: dash(row.country),
    source: dash(row.companySource),
    tenantDb: dash(row.tenantDbName),
    created: fmtDate(row.createdAt),
  };
}

function leadRow(row: HqLeadApiRow): Record<string, string | number> {
  return {
    id: row.id,
    name: dash(row.name || row.contactPerson),
    company: dash(row.company),
    email: dash(row.email || row.emails?.[0]),
    phone: dash(row.phone || row.phones?.[0]),
    stage: leadStage(row.stage),
    source: dash(row.leadSource || row.source),
    owner: dash(row.owner, 'Unassigned'),
    score: dash(row.score),
    industry: dash(row.industry),
    country: dash(row.country),
    pipeline: Number(row.estimatedDealValue || 0),
    modules: (row.interestedModules || row.hqProductLines || []).join(', ') || '—',
    followUp: dash(row.nextFollowUp),
    created: fmtDate(row.createdAt),
  };
}

export function buildHqReportView(
  pageId: HqReportPageId,
  data: HqReportSourceData,
  formatMoney: (value: number) => string,
): HqReportView {
  const stamp = new Date().toISOString().slice(0, 10);
  const billing = data.billing;
  const candidateTx = (billing?.candidate.transactions || []).filter(Boolean);
  const tenantCycles = billing?.employer.tenantCycles || [];
  const purchaseRequests = billing?.employer.purchaseRequests || [];
  const candidateOverview = billing?.overview.candidate;
  const employerOverview = billing?.overview.employer;

  if (pageId === 'emp-overview') {
    const kycLive = data.kyc.filter((row) => row.liveForCandidates).length;
    const publishedCourses = data.courses.filter((row) => row.isPublished).length;
    const openHelp = data.helpTickets.filter((row) => row.status !== 'closed').length;
    const kpis: HqReportKpi[] = [
      { label: 'Candidates', value: data.candidates.length, active: true },
      { label: 'Portal candidates', value: data.candidates.filter((row) => row.origin === 'phase1_portal').length },
      { label: 'Common pool', value: data.candidates.filter((row) => row.origin === 'phase1_common').length },
      { label: 'Phase 2 candidates', value: data.candidates.filter((row) => row.origin === 'phase2_crm').length },
      { label: 'KYC live', value: kycLive },
      { label: 'Courses published', value: publishedCourses },
      { label: 'Portal jobs', value: data.jobs.length },
      { label: 'Events', value: data.events.length },
      { label: 'Help tickets open', value: openHelp },
      { label: 'Token purchases', value: candidateOverview?.totalPurchases ?? candidateTx.filter((row) => row.direction === 'credit').length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'Candidates by origin', rows: groupHqCandidates(data.candidates, 'origin') },
      { title: 'KYC mix', rows: groupHqKyc(data.kyc, 'hq') },
      { title: 'Courses published vs draft', rows: groupHqCourses(data.courses, 'published') },
      { title: 'Help tickets by status', rows: groupHqHelpTickets(data.helpTickets, 'status') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'origin', label: 'Origin' },
      { key: 'status', label: 'Status' },
      { key: 'kyc', label: 'KYC' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.candidates, (row) => row.createdAt, 50).map(candidateRow);
    return {
      kpis,
      breakdowns,
      tableTitle: 'Latest candidates',
      columns,
      rows,
      ...overviewCsv(`hq-employees-overview-${stamp}.csv`, kpis, breakdowns),
    };
  }

  if (pageId === 'emp-candidates') {
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.candidates.length, active: true },
      { label: 'Portal', value: data.candidates.filter((row) => row.origin === 'phase1_portal').length },
      { label: 'Common pool', value: data.candidates.filter((row) => row.origin === 'phase1_common').length },
      { label: 'Phase 2 CRM', value: data.candidates.filter((row) => row.origin === 'phase2_crm').length },
      { label: 'KYC verified', value: data.candidates.filter((row) => row.kycVerified).length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By origin', rows: groupHqCandidates(data.candidates, 'origin') },
      { title: 'By status', rows: groupHqCandidates(data.candidates, 'status') },
      { title: 'By stage', rows: groupHqCandidates(data.candidates, 'stage') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'title', label: 'Title' },
      { key: 'location', label: 'Location' },
      { key: 'origin', label: 'Origin' },
      { key: 'status', label: 'Status' },
      { key: 'stage', label: 'Stage' },
      { key: 'kyc', label: 'KYC' },
      { key: 'interviewer', label: 'Interviewer' },
      { key: 'tenantDb', label: 'Tenant DB' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.candidates, (row) => row.createdAt).map(candidateRow);
    return {
      kpis,
      breakdowns,
      tableTitle: 'All candidates',
      columns,
      rows,
      ...tableCsv(`hq-employees-candidates-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'emp-kyc') {
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.kyc.length, active: true },
      { label: 'Applicants', value: data.kyc.filter((row) => (row.kind || 'applicant') === 'applicant').length },
      { label: 'Interviewers', value: data.kyc.filter((row) => row.kind === 'interviewer').length },
      { label: 'KYC verified', value: data.kyc.filter((row) => row.kycVerified).length },
      { label: 'Pending HQ verify', value: data.kyc.filter((row) => !row.hqVerified).length },
      { label: 'Live for candidates', value: data.kyc.filter((row) => row.liveForCandidates).length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By kind', rows: groupHqKyc(data.kyc, 'kind') },
      { title: 'HQ verified', rows: groupHqKyc(data.kyc, 'hq') },
      { title: 'Live for candidates', rows: groupHqKyc(data.kyc, 'live') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'kind', label: 'Kind' },
      { key: 'application', label: 'Application' },
      { key: 'kyc', label: 'KYC' },
      { key: 'hq', label: 'HQ verified' },
      { key: 'live', label: 'Live' },
      { key: 'company', label: 'Company' },
      { key: 'role', label: 'Role' },
      { key: 'experience', label: 'Experience' },
      { key: 'price', label: 'Price' },
      { key: 'profile', label: 'Profile' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.kyc, (row) => row.createdAt).map((row) => ({
      id: row.id,
      name: dash(row.name),
      email: dash(row.email),
      phone: dash(row.phone),
      kind: dash(row.kind || 'applicant'),
      application: dash(row.applicationStatus),
      kyc: yesNo(row.kycVerified),
      hq: yesNo(row.hqVerified),
      live: yesNo(row.liveForCandidates),
      company: dash(row.currentCompany),
      role: dash(row.currentRole),
      experience: Number(row.yearsOfExperience || 0),
      price: Number(row.interviewPrice || 0),
      profile: dash(row.profileStatus),
      created: fmtDate(row.createdAt),
    }));
    return {
      kpis,
      breakdowns,
      tableTitle: 'KYC / interviewer records',
      columns,
      rows,
      ...tableCsv(`hq-employees-kyc-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'emp-courses') {
    const enrollments = data.courses.reduce((sum, row) => sum + Number(row.enrolledCount || 0), 0);
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.courses.length, active: true },
      { label: 'Published', value: data.courses.filter((row) => row.isPublished).length },
      { label: 'Draft', value: data.courses.filter((row) => !row.isPublished).length },
      { label: 'Premium', value: data.courses.filter((row) => String(row.accessTier || '').toLowerCase() === 'premium' || Number(row.tokenCost || 0) > 0).length },
      { label: 'Enrollments', value: enrollments },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'Published vs draft', rows: groupHqCourses(data.courses, 'published') },
      { title: 'By category', rows: groupHqCourses(data.courses, 'category') },
      { title: 'By access tier', rows: groupHqCourses(data.courses, 'tier') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' },
      { key: 'level', label: 'Level' },
      { key: 'published', label: 'Published' },
      { key: 'enrollments', label: 'Enrollments' },
      { key: 'tokenCost', label: 'Token cost' },
      { key: 'certified', label: 'Certified' },
      { key: 'instructor', label: 'Instructor' },
      { key: 'lessons', label: 'Lessons' },
      { key: 'hours', label: 'Hours' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.courses, (row) => row.createdAt).map((row) => ({
      id: row.id,
      title: dash(row.title),
      category: dash(row.category),
      level: dash(row.level),
      published: yesNo(row.isPublished),
      enrollments: Number(row.enrolledCount || 0),
      tokenCost: Number(row.tokenCost || 0),
      certified: yesNo(row.isCertified),
      instructor: dash(row.instructorName),
      lessons: Number(row.totalLessons || 0),
      hours: Number(row.estimatedHours || 0),
      created: fmtDate(row.createdAt),
    }));
    return {
      kpis,
      breakdowns,
      tableTitle: 'Courses',
      columns,
      rows,
      ...tableCsv(`hq-employees-courses-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'emp-jobs') {
    const kpis: HqReportKpi[] = [
      { label: 'Total jobs', value: data.jobs.length, active: true },
      { label: 'Portal-only', value: data.jobs.filter((row) => row.origin === 'phase1_portal').length },
      { label: 'Tenant jobs', value: data.jobs.filter((row) => Boolean(row.tenantDbName) && row.origin !== 'phase1_portal').length },
      { label: 'Phase 2 jobs', value: data.jobs.filter((row) => row.origin === 'phase2_crm').length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By origin', rows: groupHqJobs(data.jobs, 'origin') },
      { title: 'By status', rows: groupHqJobs(data.jobs, 'status') },
      { title: 'By work mode', rows: groupHqJobs(data.jobs, 'workMode') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'title', label: 'Title' },
      { key: 'company', label: 'Company' },
      { key: 'location', label: 'Location' },
      { key: 'status', label: 'Status' },
      { key: 'workMode', label: 'Work mode' },
      { key: 'origin', label: 'Origin' },
      { key: 'openings', label: 'Openings' },
      { key: 'posted', label: 'Posted' },
    ];
    const rows = newest(data.jobs, (row) => row.postedDate).map((row) => ({
      id: row.id,
      title: dash(row.title),
      company: dash(row.company),
      location: dash(row.location),
      status: dash(row.status),
      workMode: dash(row.workMode),
      origin: originLabel(row.origin),
      openings: Number(row.openings || 0),
      posted: fmtDate(row.postedDate),
    }));
    return {
      kpis,
      breakdowns,
      tableTitle: 'Portal jobs',
      columns,
      rows,
      ...tableCsv(`hq-employees-jobs-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'emp-events') {
    const registrations = data.events.reduce((sum, row) => sum + Number(row.registrationCount || 0), 0);
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.events.length, active: true },
      { label: 'Published', value: data.events.filter((row) => row.isPublished).length },
      { label: 'Cancelled', value: data.events.filter((row) => row.status === 'cancelled').length },
      { label: 'Registrations', value: registrations },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'Published', rows: groupHqEvents(data.events, 'published') },
      { title: 'By type', rows: groupHqEvents(data.events, 'type') },
      { title: 'By mode', rows: groupHqEvents(data.events, 'mode') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'title', label: 'Title' },
      { key: 'type', label: 'Type' },
      { key: 'mode', label: 'Mode' },
      { key: 'location', label: 'Location' },
      { key: 'scheduled', label: 'Scheduled' },
      { key: 'published', label: 'Published' },
      { key: 'status', label: 'Status' },
      { key: 'registrations', label: 'Registrations' },
      { key: 'access', label: 'Access' },
      { key: 'tokenCost', label: 'Token cost' },
      { key: 'createdBy', label: 'Created by' },
    ];
    const rows = newest(data.events, (row) => row.scheduledAt).map((row) => ({
      id: row.id,
      title: dash(row.title),
      type: dash(row.type),
      mode: dash(row.mode),
      location: dash(row.location),
      scheduled: fmtDate(row.scheduledAt),
      published: yesNo(row.isPublished),
      status: dash(row.status, 'active'),
      registrations: Number(row.registrationCount || 0),
      access: dash(row.accessType),
      tokenCost: Number(row.tokenCost || 0),
      createdBy: dash(row.createdByName || row.createdByEmail),
    }));
    return {
      kpis,
      breakdowns,
      tableTitle: 'Events',
      columns,
      rows,
      ...tableCsv(`hq-employees-events-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'emp-subscriptions') {
    const uniqueBuyers = new Set(candidateTx.map((row) => row.candidateEmail || row.candidateId).filter(Boolean)).size;
    const tokensSold = candidateTx.filter((row) => row.direction === 'credit').reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const tokensSpent = candidateTx.filter((row) => row.direction === 'debit').reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const grants = candidateTx.filter((row) => String(row.type || '').toLowerCase().includes('grant')).length;
    const kpis: HqReportKpi[] = [
      { label: 'Purchases', value: candidateOverview?.totalPurchases ?? candidateTx.filter((row) => row.direction === 'credit').length, active: true },
      { label: 'Unique buyers', value: candidateOverview?.uniqueBuyers ?? uniqueBuyers },
      { label: 'Tokens sold', value: candidateOverview?.totalTokensSold ?? tokensSold },
      { label: 'Tokens spent', value: candidateOverview?.totalTokensSpent ?? tokensSpent },
      { label: 'Grants', value: candidateOverview?.totalGrants ?? grants },
      { label: 'Transactions', value: candidateTx.length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      {
        title: 'By pack / type',
        rows: countBy(candidateTx.map((row) => ({ label: row.packageName || row.label || row.type || 'Other' }))),
      },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Candidate' },
      { key: 'email', label: 'Email' },
      { key: 'type', label: 'Type' },
      { key: 'tokens', label: 'Tokens', align: 'right' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'direction', label: 'Direction' },
      { key: 'pack', label: 'Pack' },
      { key: 'service', label: 'Service' },
      { key: 'balance', label: 'Balance after', align: 'right' },
      { key: 'date', label: 'Date' },
    ];
    const rows = newest(candidateTx, (row) => row.occurredAt).map((row) => ({
      id: row.id,
      name: dash(row.candidateName),
      email: dash(row.candidateEmail),
      type: dash(row.label || row.type),
      tokens: Number(row.amount || 0),
      amount: Number(row.amount || 0),
      direction: dash(row.direction),
      pack: dash(row.packageName),
      service: dash(row.service),
      balance: Number(row.balanceAfter || 0),
      date: fmtDate(row.occurredAt),
    }));
    return {
      kpis,
      breakdowns,
      tableTitle: 'Candidate billing transactions',
      columns,
      rows,
      ...tableCsv(`hq-employees-subscriptions-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'emp-tickets') {
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.helpTickets.length, active: true },
      { label: 'Open', value: data.helpTickets.filter((row) => row.status === 'open').length },
      { label: 'In progress', value: data.helpTickets.filter((row) => row.status === 'in_progress').length },
      { label: 'Closed', value: data.helpTickets.filter((row) => row.status === 'closed').length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By status', rows: groupHqHelpTickets(data.helpTickets, 'status') },
      { title: 'By category', rows: groupHqHelpTickets(data.helpTickets, 'category') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'category', label: 'Category' },
      { key: 'subject', label: 'Subject' },
      { key: 'status', label: 'Status' },
      { key: 'source', label: 'Source' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.helpTickets, (row) => row.createdAt).map((row) => ({
      id: row.id,
      name: dash(row.name),
      email: dash(row.email),
      category: dash(row.category),
      subject: dash(row.subject),
      status: statusLabel(row.status),
      source: dash(row.source),
      created: fmtDate(row.createdAt),
    }));
    return {
      kpis,
      breakdowns,
      tableTitle: 'Employee help tickets',
      columns,
      rows,
      ...tableCsv(`hq-employees-tickets-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'er-overview') {
    const agency = data.tenants.filter((row) => row.organizationType === 'agency').length;
    const standalone = data.tenants.filter((row) => row.organizationType === 'standalone').length;
    const onPlan = data.tenants.filter((row) => Boolean(row.subscriptionPlan?.name)).length;
    const openTickets = data.tickets.filter((row) => row.status === 'open' || row.status === 'in_progress').length;
    const kpis: HqReportKpi[] = [
      { label: 'Tenants', value: data.tenants.length, active: true },
      { label: 'Agency', value: agency },
      { label: 'Standalone', value: standalone },
      { label: 'Companies', value: data.companies.length },
      { label: 'On a plan', value: employerOverview?.tenantsOnPlan ?? onPlan },
      { label: 'Monthly cycles', value: employerOverview?.monthlyCycles ?? tenantCycles.filter((row) => row.billingCycle === 'monthly').length },
      { label: 'Annual cycles', value: employerOverview?.annualCycles ?? tenantCycles.filter((row) => row.billingCycle === 'annual').length },
      { label: 'Open tickets', value: openTickets },
      { label: 'Recycle bin', value: data.recycle.length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'Organization type', rows: groupHqTenants(data.tenants, 'type') },
      { title: 'Signup source', rows: groupHqTenants(data.tenants, 'source') },
      { title: 'Plan', rows: groupHqTenants(data.tenants, 'plan') },
      { title: 'Ticket status', rows: groupHqTickets(data.tickets, 'status') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Organization' },
      { key: 'email', label: 'Email' },
      { key: 'type', label: 'Type' },
      { key: 'source', label: 'Source' },
      { key: 'plan', label: 'Plan' },
      { key: 'status', label: 'Status' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.tenants, (row) => row.createdAt, 50).map(tenantRow);
    return {
      kpis,
      breakdowns,
      tableTitle: 'Latest tenants',
      columns,
      rows,
      ...overviewCsv(`hq-employers-overview-${stamp}.csv`, kpis, breakdowns),
    };
  }

  if (pageId === 'er-companies') {
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.companies.length, active: true },
      { label: 'Active', value: data.companies.filter((row) => row.status === 'active').length },
      { label: 'Inactive', value: data.companies.filter((row) => row.status === 'inactive').length },
      { label: 'On hold', value: data.companies.filter((row) => row.status === 'on_hold').length },
      { label: 'Closed', value: data.companies.filter((row) => row.status === 'closed').length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By status', rows: groupHqClients(data.companies, 'status') },
      { title: 'By industry', rows: groupHqClients(data.companies, 'industry') },
      { title: 'By country', rows: groupHqClients(data.companies, 'country') },
      { title: 'By owner', rows: groupHqClients(data.companies, 'owner') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Name' },
      { key: 'contact', label: 'Contact' },
      { key: 'status', label: 'Status' },
      { key: 'industry', label: 'Industry' },
      { key: 'owner', label: 'Owner' },
      { key: 'country', label: 'Country' },
      { key: 'tenantDb', label: 'Tenant DB' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.companies, (row) => row.createdAt).map(companyRow);
    return {
      kpis,
      breakdowns,
      tableTitle: 'Companies',
      columns,
      rows,
      ...tableCsv(`hq-employers-companies-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'er-users') {
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.tenants.length, active: true },
      { label: 'Agency', value: data.tenants.filter((row) => row.organizationType === 'agency').length },
      { label: 'Standalone', value: data.tenants.filter((row) => row.organizationType === 'standalone').length },
      { label: 'Landing trial', value: data.tenants.filter((row) => row.signupSource === 'landing_trial').length },
      { label: 'Landing purchase', value: data.tenants.filter((row) => row.signupSource === 'landing_purchase').length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By type', rows: groupHqTenants(data.tenants, 'type') },
      { title: 'By source', rows: groupHqTenants(data.tenants, 'source') },
      { title: 'By plan', rows: groupHqTenants(data.tenants, 'plan') },
      { title: 'By status', rows: groupHqTenants(data.tenants, 'status') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'login', label: 'Login' },
      { key: 'type', label: 'Type' },
      { key: 'source', label: 'Source' },
      { key: 'plan', label: 'Plan' },
      { key: 'productLine', label: 'Product' },
      { key: 'tenantDb', label: 'Tenant DB' },
      { key: 'paused', label: 'Paused' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.tenants, (row) => row.createdAt).map(tenantRow);
    return {
      kpis,
      breakdowns,
      tableTitle: 'Entrepreneur users (tenants)',
      columns,
      rows,
      ...tableCsv(`hq-employers-users-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'er-plans') {
    const planRows = tenantCycles.length
      ? tenantCycles
      : data.tenants.map((row) => ({
          tenantId: row.id,
          tenantName: row.organizationName || row.name,
          email: row.email,
          tenantDbName: row.tenantDbName,
          planName: row.subscriptionPlan?.name || '',
          billingCycle: row.subscriptionPlan?.billingCycle || 'monthly',
          isTrial: Boolean(row.subscriptionPlan?.isTrial) || row.signupSource === 'landing_trial',
          createdAt: row.createdAt,
          purchasedAt: null as string | null,
          status: row.status || 'active',
        }));
    const kpis: HqReportKpi[] = [
      { label: 'Tenants on plan', value: employerOverview?.tenantsOnPlan ?? planRows.filter((row) => row.planName).length, active: true },
      { label: 'Monthly cycles', value: employerOverview?.monthlyCycles ?? planRows.filter((row) => row.billingCycle === 'monthly').length },
      { label: 'Annual cycles', value: employerOverview?.annualCycles ?? planRows.filter((row) => row.billingCycle === 'annual').length },
      { label: 'Landing purchases', value: employerOverview?.landingPurchases ?? data.tenants.filter((row) => row.signupSource === 'landing_purchase').length },
      { label: 'Purchase requests', value: employerOverview?.purchaseRequests ?? purchaseRequests.length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By plan', rows: countBy(planRows.map((row) => ({ label: row.planName || 'No plan' }))) },
      { title: 'Billing cycle', rows: countBy(planRows.map((row) => ({ label: row.billingCycle || 'monthly' }))) },
      { title: 'Trial vs paid', rows: countBy(planRows.map((row) => ({ label: row.isTrial ? 'Trial' : 'Paid' }))) },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Organization' },
      { key: 'email', label: 'Email' },
      { key: 'plan', label: 'Plan' },
      { key: 'cycle', label: 'Cycle' },
      { key: 'trial', label: 'Trial' },
      { key: 'status', label: 'Status' },
      { key: 'price', label: 'Price', align: 'right' },
      { key: 'planStart', label: 'Plan start' },
      { key: 'planEnd', label: 'Plan end' },
      { key: 'purchased', label: 'Purchased' },
    ];
    const rows = newest(planRows, (row) => row.purchasedAt || row.createdAt).map((row) => ({
      id: row.tenantId || row.email,
      name: dash(row.tenantName),
      email: dash(row.email),
      plan: dash(row.planName),
      cycle: dash(row.billingCycle),
      trial: yesNo(Boolean(row.isTrial)),
      status: dash(row.status),
      price: dash((row as { price?: string | number }).price),
      planStart: fmtDate((row as { planStartDate?: string | null }).planStartDate),
      planEnd: fmtDate((row as { planEndDate?: string | null }).planEndDate),
      purchased: fmtDate(row.purchasedAt || row.createdAt),
    }));
    return {
      kpis,
      breakdowns,
      tableTitle: tenantCycles.length ? 'Tenant subscription cycles' : 'Tenant plans',
      columns,
      rows,
      ...tableCsv(`hq-employers-subscriptions-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'er-tickets') {
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.tickets.length, active: true },
      { label: 'Open', value: data.tickets.filter((row) => row.status === 'open').length },
      { label: 'In progress', value: data.tickets.filter((row) => row.status === 'in_progress').length },
      { label: 'Resolved', value: data.tickets.filter((row) => row.status === 'resolved').length },
      { label: 'Closed', value: data.tickets.filter((row) => row.status === 'closed').length },
      { label: 'High priority', value: data.tickets.filter((row) => row.priority === 'high' || row.priority === 'urgent').length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By status', rows: groupHqTickets(data.tickets, 'status') },
      { title: 'By priority', rows: groupHqTickets(data.tickets, 'priority') },
      { title: 'By category', rows: groupHqTickets(data.tickets, 'category') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'number', label: 'Ticket' },
      { key: 'subject', label: 'Subject' },
      { key: 'org', label: 'Organization' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'category', label: 'Category' },
      { key: 'raisedBy', label: 'Raised by' },
      { key: 'email', label: 'Email' },
      { key: 'tenantDb', label: 'Tenant DB' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.tickets, (row) => row.createdAt).map((row) => ({
      id: row.id,
      number: dash(row.ticketNumber || row.id),
      subject: dash(row.subject),
      org: dash(row.organizationName),
      status: statusLabel(row.status),
      priority: dash(row.priority),
      category: dash(row.category),
      raisedBy: dash(row.raisedByName || row.raisedByEmail),
      email: dash(row.raisedByEmail),
      tenantDb: dash(row.tenantDbName),
      created: fmtDate(row.createdAt),
    }));
    return {
      kpis,
      breakdowns,
      tableTitle: 'Entrepreneur support tickets',
      columns,
      rows,
      ...tableCsv(`hq-employers-tickets-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'er-recycle') {
    const kpis: HqReportKpi[] = [{ label: 'Deleted tenants', value: data.recycle.length, active: true }];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'tenantDb', label: 'Tenant DB' },
      { key: 'deletedAt', label: 'Deleted at' },
      { key: 'deletedBy', label: 'Deleted by' },
    ];
    const rows = newest(data.recycle, (row) => row.deletedAt || row.updatedAt).map(tenantRow);
    return {
      kpis,
      breakdowns: [],
      tableTitle: 'Recycle bin',
      columns,
      rows,
      ...tableCsv(`hq-employers-recycle-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'crm-overview') {
    const converted = data.leads.filter((row) => row.stage === 'converted').length;
    const lost = data.leads.filter((row) => row.stage === 'lost').length;
    const pipeline = data.leads
      .filter((row) => row.stage !== 'converted' && row.stage !== 'lost')
      .reduce((sum, row) => sum + Number(row.estimatedDealValue || 0), 0);
    const conversionRate = data.leads.length ? Math.round((converted / data.leads.length) * 100) : 0;
    const kpis: HqReportKpi[] = [
      { label: 'Leads', value: data.leads.length, active: true },
      { label: 'Converted', value: converted },
      { label: 'Lost', value: lost },
      { label: 'Conversion', value: `${conversionRate}%` },
      { label: 'Open pipeline', value: formatMoney(pipeline) },
      { label: 'Demo stage', value: data.leads.filter((row) => row.stage === 'demo').length },
      { label: 'Trial stage', value: data.leads.filter((row) => row.stage === 'trial').length },
      { label: 'Clients', value: data.companies.length },
      { label: 'Demos', value: data.demos.length },
      { label: 'Trials granted', value: data.demos.filter((row) => row.trialProvisioned).length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'Lead stage', rows: groupHqLeads(data.leads, 'stage') },
      { title: 'Lead source', rows: groupHqLeads(data.leads, 'source') },
      { title: 'Client status', rows: groupHqClients(data.companies, 'status') },
      { title: 'Demo status', rows: groupHqDemos(data.demos, 'status') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Name' },
      { key: 'company', label: 'Company' },
      { key: 'stage', label: 'Stage' },
      { key: 'source', label: 'Source' },
      { key: 'owner', label: 'Owner' },
      { key: 'pipeline', label: 'Pipeline' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.leads, (row) => row.createdAt, 50).map(leadRow);
    return {
      kpis,
      breakdowns,
      tableTitle: 'Latest leads',
      columns,
      rows,
      ...overviewCsv(`hq-crm-overview-${stamp}.csv`, kpis, breakdowns),
    };
  }

  if (pageId === 'crm-leads') {
    const pipeline = data.leads
      .filter((row) => row.stage !== 'converted' && row.stage !== 'lost')
      .reduce((sum, row) => sum + Number(row.estimatedDealValue || 0), 0);
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.leads.length, active: true },
      { label: 'New', value: data.leads.filter((row) => row.stage === 'new').length },
      { label: 'Demo', value: data.leads.filter((row) => row.stage === 'demo').length },
      { label: 'Trial', value: data.leads.filter((row) => row.stage === 'trial').length },
      { label: 'Contacted', value: data.leads.filter((row) => row.stage === 'contacted').length },
      { label: 'Qualified', value: data.leads.filter((row) => row.stage === 'qualified').length },
      { label: 'Converted', value: data.leads.filter((row) => row.stage === 'converted').length },
      { label: 'Lost', value: data.leads.filter((row) => row.stage === 'lost').length },
      { label: 'Pipeline', value: formatMoney(pipeline) },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By stage', rows: groupHqLeads(data.leads, 'stage') },
      { title: 'By source', rows: groupHqLeads(data.leads, 'source') },
      { title: 'By owner', rows: groupHqLeads(data.leads, 'owner') },
      { title: 'By score', rows: groupHqLeads(data.leads, 'score') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Name' },
      { key: 'company', label: 'Company' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'stage', label: 'Stage' },
      { key: 'source', label: 'Source' },
      { key: 'owner', label: 'Owner' },
      { key: 'score', label: 'Score' },
      { key: 'industry', label: 'Industry' },
      { key: 'country', label: 'Country' },
      { key: 'pipeline', label: 'Pipeline' },
      { key: 'modules', label: 'Modules' },
      { key: 'followUp', label: 'Next follow-up' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.leads, (row) => row.createdAt).map(leadRow);
    return {
      kpis,
      breakdowns,
      tableTitle: 'HQ leads',
      columns,
      rows,
      ...tableCsv(`hq-crm-leads-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'crm-clients') {
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.companies.length, active: true },
      { label: 'Active', value: data.companies.filter((row) => row.status === 'active').length },
      { label: 'Inactive', value: data.companies.filter((row) => row.status === 'inactive').length },
      { label: 'On hold', value: data.companies.filter((row) => row.status === 'on_hold').length },
      { label: 'Closed', value: data.companies.filter((row) => row.status === 'closed').length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By status', rows: groupHqClients(data.companies, 'status') },
      { title: 'By industry', rows: groupHqClients(data.companies, 'industry') },
      { title: 'By owner', rows: groupHqClients(data.companies, 'owner') },
      { title: 'By country', rows: groupHqClients(data.companies, 'country') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Name' },
      { key: 'contact', label: 'Contact' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
      { key: 'industry', label: 'Industry' },
      { key: 'owner', label: 'Owner' },
      { key: 'country', label: 'Country' },
      { key: 'source', label: 'Source' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.companies, (row) => row.createdAt).map(companyRow);
    return {
      kpis,
      breakdowns,
      tableTitle: 'HQ clients',
      columns,
      rows,
      ...tableCsv(`hq-crm-clients-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'crm-demos') {
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.demos.length, active: true },
      { label: 'Pending', value: data.demos.filter((row) => row.status === 'PENDING').length },
      { label: 'Verified', value: data.demos.filter((row) => row.status === 'VERIFIED').length },
      { label: 'Expired', value: data.demos.filter((row) => row.status === 'EXPIRED').length },
      { label: 'Trials granted', value: data.demos.filter((row) => row.trialProvisioned).length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By status', rows: groupHqDemos(data.demos, 'status') },
      { title: 'By request kind', rows: groupHqDemos(data.demos, 'kind') },
      { title: 'Trial granted', rows: groupHqDemos(data.demos, 'trial') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'company', label: 'Company' },
      { key: 'kind', label: 'Kind' },
      { key: 'status', label: 'Status' },
      { key: 'trial', label: 'Trial' },
      { key: 'package', label: 'Package' },
      { key: 'cycle', label: 'Cycle' },
      { key: 'submitted', label: 'Submitted' },
      { key: 'trialStart', label: 'Trial start' },
      { key: 'trialEnd', label: 'Trial end' },
    ];
    const rows = newest(data.demos, (row) => row.submittedAt || row.createdAt).map((row) => ({
      id: row.id,
      name: dash(row.fullName),
      email: dash(row.email),
      company: dash(row.organizationName),
      kind: dash(row.requestKind || 'demo'),
      status: dash(row.status),
      trial: yesNo(row.trialProvisioned),
      package: dash(row.packageName || row.packageSlug),
      cycle: dash(row.billingCycle),
      submitted: fmtDate(row.submittedAt || row.createdAt),
      trialStart: fmtDate(row.trialStartsAt),
      trialEnd: fmtDate(row.trialEndsAt),
    }));
    return {
      kpis,
      breakdowns,
      tableTitle: 'Demos & trials',
      columns,
      rows,
      ...tableCsv(`hq-crm-demos-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'ops-team') {
    const kpis: HqReportKpi[] = [
      { label: 'Total', value: data.team.length, active: true },
      { label: 'Active', value: data.team.filter((row) => row.status === 'active').length },
      { label: 'Inactive', value: data.team.filter((row) => row.status !== 'active').length },
    ];
    const breakdowns: HqReportBreakdown[] = [
      { title: 'By status', rows: groupHqTeam(data.team, 'status') },
      { title: 'By role', rows: groupHqTeam(data.team, 'role') },
      { title: 'By department', rows: groupHqTeam(data.team, 'department') },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'department', label: 'Department' },
      { key: 'status', label: 'Status' },
      { key: 'phone', label: 'Phone' },
      { key: 'designation', label: 'Designation' },
      { key: 'rank', label: 'Rank' },
      { key: 'reportsTo', label: 'Reports to' },
      { key: 'login', label: 'Login' },
      { key: 'created', label: 'Created' },
    ];
    const rows = newest(data.team, (row) => row.createdAt).map((row) => ({
      id: row.id,
      name: dash(row.name),
      email: dash(row.email),
      role: dash(row.role),
      department: dash(row.department),
      status: dash(row.status),
      phone: dash(row.phone),
      designation: dash(row.designation),
      rank: row.rank ?? '—',
      reportsTo: dash(row.reportsToName),
      login: dash(row.loginId),
      created: fmtDate(row.createdAt),
    }));
    return {
      kpis,
      breakdowns,
      tableTitle: 'HQ team',
      columns,
      rows,
      ...tableCsv(`hq-ops-team-${stamp}.csv`, columns, rows),
    };
  }

  if (pageId === 'ops-billing') {
    const candidateTx = (billing?.candidate.transactions || []).filter(Boolean);
    const employerTx = billing?.employer.transactions || [];
    const kpis: HqReportKpi[] = [
      { label: 'Candidate purchases', value: candidateOverview?.totalPurchases ?? 0, active: true },
      { label: 'Candidate spends', value: candidateOverview?.totalSpends ?? 0 },
      { label: 'Candidate grants', value: candidateOverview?.totalGrants ?? 0 },
      { label: 'Tenants on plan', value: employerOverview?.tenantsOnPlan ?? 0 },
      { label: 'Monthly cycles', value: employerOverview?.monthlyCycles ?? 0 },
      { label: 'Annual cycles', value: employerOverview?.annualCycles ?? 0 },
      { label: 'Landing purchases', value: employerOverview?.landingPurchases ?? 0 },
      { label: 'Purchase requests', value: employerOverview?.purchaseRequests ?? 0 },
    ];
    const breakdowns: HqReportBreakdown[] = [
      {
        title: 'Candidate pack / type',
        rows: countBy(candidateTx.map((row) => ({ label: row.packageName || row.label || row.type || 'Other' }))),
      },
      {
        title: 'Entrepreneur billing cycle',
        rows: countBy(tenantCycles.map((row) => ({ label: row.billingCycle || 'monthly' }))),
      },
    ];
    const columns: HqReportTableColumn[] = [
      { key: 'side', label: 'Side' },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount' },
      { key: 'direction', label: 'Direction' },
      { key: 'date', label: 'Date' },
    ];
    const rows = newest(
      [
        ...candidateTx.map((row) => ({
          id: `c-${row.id}`,
          side: 'Candidate',
          name: dash(row.candidateName),
          email: dash(row.candidateEmail),
          type: dash(row.label || row.type),
          amount: Number(row.amount || 0),
          direction: dash(row.direction),
          date: row.occurredAt || '',
        })),
        ...employerTx.map((row) => ({
          id: `e-${row.id}`,
          side: 'Entrepreneur',
          name: dash(row.tenantName),
          email: dash(row.email),
          type: dash(row.label || row.type),
          amount: Number(row.amount || 0),
          direction: dash(row.direction),
          date: row.occurredAt || '',
        })),
      ],
      (row) => row.date,
    ).map((row) => ({ ...row, date: fmtDate(row.date) }));
    return {
      kpis,
      breakdowns,
      tableTitle: 'HQ billing ledger',
      columns,
      rows,
      ...tableCsv(`hq-ops-billing-${stamp}.csv`, columns, rows),
    };
  }

  return {
    kpis: [],
    breakdowns: [],
    tableTitle: 'Records',
    columns: [],
    rows: [],
    csvName: `hq-reports-${stamp}.csv`,
    csvHeaders: [],
    csvRows: [],
  };
}
