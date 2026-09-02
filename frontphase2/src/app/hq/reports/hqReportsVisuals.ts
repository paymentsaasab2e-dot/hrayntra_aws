import { HQ_LEAD_STAGE_LABELS, type HqLeadStage } from '@/app/hq/leads/hqLeadsData';
import type { HqReportPageId } from './hqReportsCatalog';
import type { HqReportChartSpec } from './HqReportCharts';
import type { HqReportSourceData } from './hqReportsViews';
import {
  countBy,
  countByDay,
  experienceBand,
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
  hqOriginLabel,
  priceBand,
  topN,
  type HqNamedCount,
} from './hqReportsBuild';

export type HqReportInsight = { label: string; value: string };
export type HqChartFilter = { key: string; value: string };

const CRM_FUNNEL: HqLeadStage[] = ['new', 'contacted', 'qualified', 'demo', 'trial', 'converted'];

function chart(
  id: string,
  title: string,
  kind: HqReportChartSpec['kind'],
  rows: HqNamedCount[],
  filterKey?: string,
): HqReportChartSpec {
  const usable = rows.filter((row) => row.count > 0 || Number(row.value || 0) > 0);
  return {
    id,
    title,
    kind: kind === 'donut' && usable.length > 6 ? 'hbar' : kind,
    rows: usable,
    filterKey,
  };
}

function largest(rows: HqNamedCount[], fallback = '—') {
  return rows[0]?.label || fallback;
}

function pct(part: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export function buildHqReportVisuals(
  pageId: HqReportPageId,
  data: HqReportSourceData,
  formatMoney: (value: number) => string,
): { charts: HqReportChartSpec[]; insights: HqReportInsight[] } {
  const billing = data.billing;
  const candidateTx = billing?.candidate.transactions || [];
  const tenantCycles = billing?.employer.tenantCycles || [];
  const employerTx = billing?.employer.transactions || [];

  if (pageId === 'emp-overview') {
    const origin = groupHqCandidates(data.candidates, 'origin');
    const kycVerified = data.candidates.filter((row) => row.kycVerified).length;
    const kycBars = [
      { label: 'Verified', count: kycVerified },
      { label: 'Not verified', count: Math.max(0, data.candidates.length - kycVerified) },
    ];
    const published = data.courses.filter((row) => row.isPublished).length;
    const draft = Math.max(0, data.courses.length - published);
    return {
      charts: [
        chart('origin', 'Candidate ecosystem', 'donut', origin, 'origin'),
        chart('kyc', 'KYC verification', 'hbar', kycBars),
        {
          id: 'courses',
          title: 'Course publishing',
          kind: 'stacked',
          rows: [
            { label: 'Published', count: published },
            { label: 'Draft', count: draft },
          ],
          stackedKeys: [
            { key: 'published', label: 'Published' },
            { key: 'draft', label: 'Draft' },
          ],
          stackedRows: [{ label: 'Courses', published, draft }],
        },
        chart('tickets', 'Support health', 'donut', groupHqHelpTickets(data.helpTickets, 'status'), 'status'),
      ],
      insights: [],
    };
  }

  if (pageId === 'emp-candidates') {
    const origin = groupHqCandidates(data.candidates, 'origin');
    const status = groupHqCandidates(data.candidates, 'status');
    const stage = groupHqCandidates(data.candidates, 'stage');
    return {
      charts: [
        chart('origin', 'Candidate origin', 'hbar', origin, 'origin'),
        chart('status', 'Candidate status', 'donut', status, 'status'),
        chart('stage', 'Candidate stage', 'bar', stage, 'stage'),
      ],
      insights: [
        { label: 'Largest source', value: largest(origin) },
        { label: 'Highest status', value: largest(status) },
        { label: 'KYC verified', value: pct(data.candidates.filter((row) => row.kycVerified).length, data.candidates.length) },
      ],
    };
  }

  if (pageId === 'emp-kyc') {
    const kind = groupHqKyc(data.kyc, 'kind');
    const pipeline = [
      { label: 'KYC verified', count: data.kyc.filter((row) => row.kycVerified).length },
      { label: 'Pending HQ', count: data.kyc.filter((row) => !row.hqVerified).length },
      { label: 'HQ verified', count: data.kyc.filter((row) => row.hqVerified).length },
      { label: 'Live', count: data.kyc.filter((row) => row.liveForCandidates).length },
    ];
    const experience = countBy(data.kyc.map((row) => ({ label: experienceBand(Number(row.yearsOfExperience || 0)) })));
    const prices = data.kyc.filter((row) => Number(row.interviewPrice) > 0);
    const priceRows = prices.length ? countBy(prices.map((row) => ({ label: priceBand(Number(row.interviewPrice || 0)) }))) : [];
    return {
      charts: [
        chart('kind', 'Applicant vs interviewer', 'donut', kind, 'kind'),
        chart('pipeline', 'Verification pipeline', 'hbar', pipeline),
        ...(experience.some((row) => row.count > 0) ? [chart('exp', 'Experience', 'bar', experience)] : []),
        ...(priceRows.length ? [chart('price', 'Interview price', 'bar', priceRows)] : []),
      ],
      insights: [],
    };
  }

  if (pageId === 'emp-courses') {
    const enroll = topN(
      [...data.courses]
        .map((row) => ({ label: row.title || 'Untitled', count: Number(row.enrolledCount || 0) }))
        .sort((a, b) => b.count - a.count),
      8,
    ).filter((row) => row.count > 0);
    return {
      charts: [
        chart('published', 'Published vs draft', 'donut', groupHqCourses(data.courses, 'published')),
        chart('category', 'Courses by category', 'hbar', topN(groupHqCourses(data.courses, 'category')), 'category'),
        chart('tier', 'Access tier', 'donut', groupHqCourses(data.courses, 'tier'), 'tier'),
        ...(enroll.length ? [{ id: 'enroll', title: 'Enrollment ranking', kind: 'ranking' as const, rows: enroll }] : []),
      ],
      insights: [],
    };
  }

  if (pageId === 'emp-jobs') {
    const companies = topN(groupHqJobs(data.jobs, 'company'), 8).filter((row) => row.count > 0);
    return {
      charts: [
        chart('origin', 'Job origin', 'donut', groupHqJobs(data.jobs, 'origin'), 'origin'),
        chart('status', 'Job status', 'bar', groupHqJobs(data.jobs, 'status'), 'status'),
        chart('mode', 'Work mode', 'donut', groupHqJobs(data.jobs, 'workMode'), 'workMode'),
        ...(companies.length ? [{ id: 'company', title: 'Jobs by company', kind: 'ranking' as const, rows: companies, filterKey: 'company' }] : []),
      ],
      insights: [],
    };
  }

  if (pageId === 'emp-events') {
    const regs = topN(
      data.events.map((row) => ({ label: row.title || 'Untitled', count: Number(row.registrationCount || 0) })),
      8,
    ).filter((row) => row.count > 0);
    return {
      charts: [
        chart('status', 'Event status', 'donut', groupHqEvents(data.events, 'published')),
        chart('type', 'Event type', 'bar', groupHqEvents(data.events, 'type'), 'type'),
        chart('mode', 'Event mode', 'donut', groupHqEvents(data.events, 'mode'), 'mode'),
        ...(regs.length ? [{ id: 'regs', title: 'Registrations by event', kind: 'ranking' as const, rows: regs }] : []),
      ],
      insights: [],
    };
  }

  if (pageId === 'emp-subscriptions') {
    const sold = candidateTx.filter((row) => row.direction === 'credit').reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const spent = candidateTx.filter((row) => row.direction === 'debit').reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const grants = candidateTx.filter((row) => String(row.type || '').toLowerCase().includes('grant')).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const packs = topN(countBy(candidateTx.map((row) => ({ label: row.packageName || row.label || row.type || 'Other' }))));
    const services = topN(
      countBy(candidateTx.filter((row) => row.service).map((row) => ({ label: row.service, value: Number(row.amount || 0) }))).map(
        (row) => ({ ...row, count: Math.round(Number(row.value || row.count)) }),
      ),
    );
    const trend = countByDay(candidateTx.map((row) => row.occurredAt));
    return {
      charts: [
        chart('movement', 'Token movement', 'bar', [
          { label: 'Tokens sold', count: Math.round(sold) },
          { label: 'Tokens spent', count: Math.round(spent) },
          { label: 'Tokens granted', count: Math.round(grants) },
        ]),
        chart('direction', 'Transaction direction', 'donut', countBy(candidateTx.map((row) => ({ label: row.direction || 'unknown' })))),
        chart('packs', 'Purchases by pack', 'hbar', packs),
        ...(services.length ? [{ id: 'services', title: 'Service spend', kind: 'ranking' as const, rows: services }] : []),
        ...(trend.length ? [chart('trend', 'Transaction activity', 'area', trend)] : []),
      ],
      insights: [],
    };
  }

  if (pageId === 'emp-tickets') {
    const sources = groupHqHelpTickets(data.helpTickets, 'source');
    return {
      charts: [
        chart('status', 'Ticket status', 'donut', groupHqHelpTickets(data.helpTickets, 'status'), 'status'),
        chart('category', 'Ticket category', 'hbar', groupHqHelpTickets(data.helpTickets, 'category'), 'category'),
        ...(sources.some((row) => row.label !== 'Unknown') ? [chart('source', 'Ticket source', 'bar', sources, 'source')] : []),
      ],
      insights: [],
    };
  }

  if (pageId === 'er-overview') {
    return {
      charts: [
        chart('type', 'Organization type', 'donut', groupHqTenants(data.tenants, 'type'), 'type'),
        chart('source', 'Signup source', 'bar', groupHqTenants(data.tenants, 'source'), 'source'),
        chart('plan', 'Subscription plans', 'hbar', topN(groupHqTenants(data.tenants, 'plan')), 'plan'),
        chart('tickets', 'Ticket status', 'donut', groupHqTickets(data.tickets, 'status'), 'status'),
      ],
      insights: [],
    };
  }

  if (pageId === 'er-companies' || pageId === 'crm-clients') {
    return {
      charts: [
        chart('status', pageId === 'crm-clients' ? 'Client status' : 'Company status', 'donut', groupHqClients(data.companies, 'status'), 'status'),
        chart('industry', 'By industry', 'hbar', topN(groupHqClients(data.companies, 'industry')), 'industry'),
        chart('country', 'By country', 'hbar', topN(groupHqClients(data.companies, 'country'), 8), 'country'),
        { id: 'owner', title: 'By owner', kind: 'ranking', rows: topN(groupHqClients(data.companies, 'owner'), 8), filterKey: 'owner' },
      ],
      insights: [],
    };
  }

  if (pageId === 'er-users') {
    return {
      charts: [
        chart('type', 'User type', 'donut', groupHqTenants(data.tenants, 'type'), 'type'),
        chart('source', 'Signup source', 'bar', groupHqTenants(data.tenants, 'source'), 'source'),
        chart('plan', 'Plan distribution', 'hbar', topN(groupHqTenants(data.tenants, 'plan')), 'plan'),
        chart('status', 'User status', 'donut', groupHqTenants(data.tenants, 'status'), 'status'),
      ],
      insights: [],
    };
  }

  if (pageId === 'er-plans') {
    const planRows = tenantCycles.length
      ? tenantCycles
      : data.tenants.map((row) => ({
          planName: row.subscriptionPlan?.name || '',
          billingCycle: row.subscriptionPlan?.billingCycle || 'monthly',
          isTrial: Boolean(row.subscriptionPlan?.isTrial) || row.signupSource === 'landing_trial',
          price: Number(String(row.subscriptionPlan?.price || '').replace(/[^\d.]/g, '')) || 0,
        }));
    const prices = planRows
      .map((row) => ({ label: row.planName || 'No plan', count: 1, value: Number((row as { price?: number }).price || 0) }))
      .filter((row) => Number(row.value) > 0);
    const priceChart = prices.length
      ? countBy(prices).map((row) => ({ ...row, count: Math.round(Number(row.value || 0)) }))
      : [];
    return {
      charts: [
        chart('plan', 'Plans distribution', 'hbar', countBy(planRows.map((row) => ({ label: row.planName || 'No plan' }))), 'plan'),
        chart('cycle', 'Billing cycle', 'donut', countBy(planRows.map((row) => ({ label: row.billingCycle || 'monthly' }))), 'cycle'),
        chart('trial', 'Trial vs paid', 'donut', countBy(planRows.map((row) => ({ label: row.isTrial ? 'Trial' : 'Paid' }))), 'trial'),
        ...(priceChart.length ? [chart('price', 'Plan price distribution', 'bar', topN(priceChart))] : []),
      ],
      insights: [],
    };
  }

  if (pageId === 'er-tickets') {
    return {
      charts: [
        chart('status', 'Ticket status', 'donut', groupHqTickets(data.tickets, 'status'), 'status'),
        chart('priority', 'Priority', 'bar', groupHqTickets(data.tickets, 'priority'), 'priority'),
        chart('category', 'Category', 'hbar', groupHqTickets(data.tickets, 'category'), 'category'),
      ],
      insights: [],
    };
  }

  if (pageId === 'er-recycle') {
    const trend = countByDay(data.recycle.map((row) => row.deletedAt));
    return {
      charts: trend.length ? [chart('trend', 'Deletions over time', 'area', trend)] : [],
      insights: [],
    };
  }

  if (pageId === 'crm-overview' || pageId === 'crm-leads') {
    const funnel = CRM_FUNNEL.map((stage) => ({
      label: HQ_LEAD_STAGE_LABELS[stage],
      count: data.leads.filter((row) => row.stage === stage).length,
    }));
    const pipeline = data.leads
      .filter((row) => row.stage !== 'converted' && row.stage !== 'lost')
      .reduce((sum, row) => sum + Number(row.estimatedDealValue || 0), 0);
    const withValue = data.leads.filter((row) => Number(row.estimatedDealValue || 0) > 0);
    const avg = withValue.length
      ? withValue.reduce((sum, row) => sum + Number(row.estimatedDealValue || 0), 0) / withValue.length
      : 0;
    const converted = data.leads.filter((row) => row.stage === 'converted').length;
    const byStageValue = groupHqLeads(data.leads, 'stage').map((row) => ({
      ...row,
      count: Math.round(Number(row.value || 0)),
    }));
    const charts: HqReportChartSpec[] = [
      { id: 'funnel', title: 'CRM funnel', kind: 'funnel', rows: funnel, filterKey: 'stage' },
      chart('source', 'Lead source', 'hbar', topN(groupHqLeads(data.leads, 'source')), 'source'),
    ];
    if (pageId === 'crm-overview') {
      charts.push(chart('clients', 'Client status', 'donut', groupHqClients(data.companies, 'status'), 'clientStatus'));
      charts.push(chart('demos', 'Demo / trial status', 'bar', groupHqDemos(data.demos, 'status'), 'demoStatus'));
    } else {
      charts.push(chart('score', 'Lead score', 'donut', groupHqLeads(data.leads, 'score'), 'score'));
      charts.push({ id: 'owner', title: 'Leads by owner', kind: 'ranking', rows: topN(groupHqLeads(data.leads, 'owner')), filterKey: 'owner' });
      if (byStageValue.some((row) => row.count > 0)) {
        charts.push(chart('pipeline', 'Pipeline by stage', 'bar', byStageValue, 'stage'));
      }
    }
    return {
      charts,
      insights:
        pageId === 'crm-overview'
          ? [
              { label: 'Total pipeline', value: formatMoney(pipeline) },
              { label: 'Average deal', value: withValue.length ? formatMoney(avg) : '—' },
              { label: 'Highest stage', value: largest(funnel.filter((row) => row.count > 0)) },
              { label: 'Conversion rate', value: pct(converted, data.leads.length) },
            ]
          : [],
    };
  }

  if (pageId === 'crm-demos') {
    return {
      charts: [
        chart('status', 'Demo request status', 'donut', groupHqDemos(data.demos, 'status'), 'status'),
        chart('kind', 'Request type', 'bar', groupHqDemos(data.demos, 'kind'), 'kind'),
        chart('trial', 'Trial granted', 'donut', groupHqDemos(data.demos, 'trial'), 'trial'),
        chart('package', 'Package distribution', 'hbar', topN(groupHqDemos(data.demos, 'package'))),
      ],
      insights: [],
    };
  }

  if (pageId === 'ops-team') {
    const reports = topN(
      countBy(data.team.map((row) => ({ label: row.reportsToName || 'Unassigned' }))),
    );
    return {
      charts: [
        chart('status', 'Team status', 'donut', groupHqTeam(data.team, 'status'), 'status'),
        chart('dept', 'Department', 'hbar', groupHqTeam(data.team, 'department'), 'department'),
        chart('role', 'Role distribution', 'hbar', groupHqTeam(data.team, 'role'), 'role'),
        { id: 'reports', title: 'Reporting lines', kind: 'ranking', rows: reports, filterKey: 'reportsTo' },
      ],
      insights: [],
    };
  }

  if (pageId === 'ops-billing') {
    const purchases = candidateTx.filter((row) => row.direction === 'credit').length;
    const spends = candidateTx.filter((row) => row.direction === 'debit').length;
    const grants = candidateTx.filter((row) => String(row.type || '').toLowerCase().includes('grant')).length;
    const trend = countByDay([...candidateTx.map((row) => row.occurredAt), ...employerTx.map((row) => row.occurredAt)]);
    return {
      charts: [
        chart('flow', 'Candidate token flow', 'bar', [
          { label: 'Purchases', count: purchases },
          { label: 'Spends', count: spends },
          { label: 'Grants', count: grants },
        ]),
        chart('cycle', 'Entrepreneur billing cycle', 'donut', countBy(tenantCycles.map((row) => ({ label: row.billingCycle || 'monthly' })))),
        chart('side', 'Billing side', 'donut', [
          { label: 'Candidate', count: candidateTx.length },
          { label: 'Entrepreneur', count: employerTx.length },
        ]),
        ...(trend.length ? [chart('trend', 'Transaction activity', 'area', trend)] : []),
      ],
      insights: [],
    };
  }

  return { charts: [], insights: [] };
}

function matches(actual: string, expected: string) {
  return String(actual || '').trim().toLowerCase() === String(expected || '').trim().toLowerCase();
}

export function applyHqChartFilter(pageId: HqReportPageId, data: HqReportSourceData, filter: HqChartFilter | null): HqReportSourceData {
  if (!filter?.key || !filter.value) return data;
  const { key, value } = filter;
  const next = { ...data };

  const filterCandidates = () =>
    data.candidates.filter((row) => {
      if (key === 'origin') return matches(hqOriginLabel(row.origin), value);
      if (key === 'status') return matches(row.status, value);
      if (key === 'stage') return matches(row.stage, value);
      return true;
    });
  const filterCompanies = () =>
    data.companies.filter((row) => {
      if (key === 'status' || key === 'clientStatus') return matches(String(row.status).replace('_', ' '), value) || matches(row.status, value);
      if (key === 'industry') return matches(row.industry, value);
      if (key === 'country') return matches(row.country || '', value);
      if (key === 'owner') return matches(row.owner || 'Unassigned', value);
      if (key === 'source') return matches(row.companySource || '', value);
      return true;
    });
  const filterLeads = () =>
    data.leads.filter((row) => {
      if (key === 'stage') return matches(HQ_LEAD_STAGE_LABELS[row.stage as HqLeadStage] || row.stage, value);
      if (key === 'source') return matches(row.leadSource || row.source || '', value);
      if (key === 'owner') return matches(row.owner || 'Unassigned', value);
      if (key === 'score') return matches(row.score, value);
      return true;
    });
  const filterTenants = () =>
    data.tenants.filter((row) => {
      if (key === 'type') return matches(row.organizationType, value);
      if (key === 'source') return matches(row.signupSource || row.source || '', value);
      if (key === 'plan') return matches(row.subscriptionPlan?.name || 'No plan', value);
      if (key === 'status') return matches(row.status || 'active', value);
      if (key === 'cycle') return matches(row.subscriptionPlan?.billingCycle || 'monthly', value);
      if (key === 'trial') {
        const isTrial = Boolean(row.subscriptionPlan?.isTrial) || row.signupSource === 'landing_trial';
        return matches(isTrial ? 'Trial' : 'Paid', value);
      }
      return true;
    });

  if (pageId === 'emp-overview' && key === 'origin') next.candidates = filterCandidates();
  if (pageId === 'emp-candidates' && (key === 'origin' || key === 'status' || key === 'stage')) next.candidates = filterCandidates();
  if (pageId === 'emp-kyc' && key === 'kind') next.kyc = data.kyc.filter((row) => matches(row.kind || 'applicant', value));
  if (pageId === 'emp-courses' && (key === 'category' || key === 'tier')) {
    next.courses = data.courses.filter((row) =>
      key === 'tier' ? matches(row.accessTier, value) : matches(row.category, value),
    );
  }
  if (pageId === 'emp-jobs') {
    next.jobs = data.jobs.filter((row) => {
      if (key === 'origin') return matches(hqOriginLabel(row.origin), value);
      if (key === 'status') return matches(row.status, value);
      if (key === 'workMode') return matches(row.workMode, value);
      if (key === 'company') return matches(row.company, value);
      return true;
    });
  }
  if (pageId === 'emp-events' && (key === 'type' || key === 'mode')) {
    next.events = data.events.filter((row) => (key === 'type' ? matches(row.type, value) : matches(row.mode, value)));
  }
  if (pageId === 'emp-tickets' || pageId === 'emp-overview') {
    if (key === 'status' || key === 'category' || key === 'source') {
      next.helpTickets = data.helpTickets.filter((row) => {
        if (key === 'status') return matches(String(row.status).replace('_', ' '), value) || matches(row.status, value);
        if (key === 'category') return matches(row.category, value);
        return matches(row.source || '', value);
      });
    }
  }
  if (pageId.startsWith('er-') || pageId === 'crm-clients') {
    if (['status', 'industry', 'country', 'owner', 'source'].includes(key) && (pageId === 'er-companies' || pageId === 'crm-clients')) {
      next.companies = filterCompanies();
    }
    if (['type', 'source', 'plan', 'status', 'cycle', 'trial'].includes(key) && (pageId === 'er-users' || pageId === 'er-overview' || pageId === 'er-plans')) {
      next.tenants = filterTenants();
    }
    if (['status', 'priority', 'category'].includes(key) && (pageId === 'er-tickets' || pageId === 'er-overview')) {
      next.tickets = data.tickets.filter((row) => {
        if (key === 'status') return matches(String(row.status).replace('_', ' '), value) || matches(row.status, value);
        if (key === 'priority') return matches(row.priority, value);
        return matches(row.category, value);
      });
    }
  }
  if ((pageId === 'crm-overview' || pageId === 'crm-leads') && ['stage', 'source', 'owner', 'score'].includes(key)) {
    next.leads = filterLeads();
  }
  if (pageId === 'crm-demos' || pageId === 'crm-overview') {
    if (['demoStatus', 'status', 'kind', 'trial'].includes(key)) {
      next.demos = data.demos.filter((row) => {
        if (key === 'kind') return matches(row.requestKind || 'demo', value);
        if (key === 'trial') return matches(row.trialProvisioned ? 'Trial granted' : 'No trial yet', value);
        return matches(row.status, value);
      });
    }
    if (key === 'clientStatus') next.companies = filterCompanies();
  }
  if (pageId === 'ops-team') {
    next.team = data.team.filter((row) => {
      if (key === 'status') return matches(row.status, value);
      if (key === 'department') return matches(row.department, value);
      if (key === 'role') return matches(row.role, value);
      if (key === 'reportsTo') return matches(row.reportsToName || 'Unassigned', value);
      return true;
    });
  }
  return next;
}
