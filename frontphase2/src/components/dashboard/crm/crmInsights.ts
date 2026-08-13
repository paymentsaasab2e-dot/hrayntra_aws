import type { CrmOverview } from '@/lib/dashboard/api';
import { formatMoneyCompact } from './crmShared';

export type CrmInsightCategory = 'leads' | 'clients' | 'team';

export type CrmComboMetric = {
  key: string;
  label: string;
  value: string;
  sub: string;
  pct?: number;
  tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'indigo' | 'slate';
  href?: string;
  priority?: 'high' | 'medium' | 'low';
  category?: CrmInsightCategory;
  /** HQ-style tooltip explaining how to read this stat */
  info?: string;
};

const TONE_BAR: Record<CrmComboMetric['tone'], string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  slate: 'bg-slate-400',
};

const TONE_BG: Record<CrmComboMetric['tone'], string> = {
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-100',
  rose: 'bg-rose-50 text-rose-800 ring-rose-100',
  blue: 'bg-blue-50 text-blue-800 ring-blue-100',
  indigo: 'bg-indigo-50 text-indigo-800 ring-indigo-100',
  slate: 'bg-slate-50 text-slate-700 ring-slate-100',
};

export function comboToneClasses(tone: CrmComboMetric['tone']) {
  return TONE_BG[tone];
}

export function comboBarClass(tone: CrmComboMetric['tone']) {
  return TONE_BAR[tone];
}

function daysSince(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function stageCount(leads: CrmOverview['leadsTable'], pattern: RegExp) {
  return (leads || []).filter((l) => pattern.test(String(l.status || ''))).length;
}

function stageFromCharts(overview: CrmOverview | null | undefined, pattern: RegExp) {
  const slices = [
    ...(overview?.leadStagePie || []),
    ...(overview?.leadStatusBars || []),
    ...(overview?.pipeline || []).map((p) => ({ name: p.stage, value: p.count })),
  ];
  const hit = slices.find((s) => pattern.test(String(s.name || '')));
  return hit ? Number(hit.value || 0) : null;
}

export function buildCrmComboMetrics(overview: CrmOverview | null | undefined): CrmComboMetric[] {
  const k = overview?.kpis || {};
  const leads = overview?.leadsTable || [];
  const clients = overview?.clientsTable || [];
  const fu = overview?.followups || {};
  const lb = overview?.leaderboard || [];
  const b = overview?.businessSummary;

  const totalLeads = Number(k.totalLeads ?? leads.length) || leads.length;
  const converted =
    k.convertedLeads != null
      ? Number(k.convertedLeads)
      : stageFromCharts(overview, /convert|won/i) ?? stageCount(leads, /convert|won/i);
  const newCount =
    k.newLeads != null
      ? Number(k.newLeads)
      : stageFromCharts(overview, /^new$/i) ?? stageCount(leads, /^new$/i);
  const contacted = stageFromCharts(overview, /contact/i) ?? stageCount(leads, /contact/i);
  const qualified = stageFromCharts(overview, /qualif/i) ?? stageCount(leads, /qualif/i);

  const staleLeads = leads.filter((l) => {
    const days = daysSince(l.lastActivity);
    return days == null || days > 30;
  }).length;

  const noTouch = leads.filter((l) => !Number(l.totalMeetings)).length;
  const overdue = Number(fu.overdue ?? k.overdueFollowups ?? 0);
  const dueSoon = Number(fu.today || 0) + Number(fu.tomorrow || 0);
  const followupDenom = overdue + dueSoon || 1;
  const followupRiskPct = Math.min(100, Math.round((overdue / followupDenom) * 100));

  const totalClients = Number(k.totalClients ?? clients.length) || clients.length;
  const activeClients =
    k.activeClients != null
      ? Number(k.activeClients)
      : clients.filter((c) => /active|hot/i.test(String(c.status || ''))).length;
  const clientActivePct = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;

  // Funnel step: Contacted ÷ New (prior stage). Cap display at 100% for readability.
  const newToContactPct =
    newCount > 0 ? Math.min(100, Math.round((contacted / newCount) * 100)) : null;
  // Closing quality: Converted ÷ Qualified (won of those who reached qualified).
  const qualToConvPct =
    qualified > 0 ? Math.min(100, Math.round((converted / qualified) * 100)) : null;
  const engagementBase = leads.length || totalLeads;
  const engagementPct =
    engagementBase > 0
      ? Math.round(((engagementBase - noTouch) / engagementBase) * 100)
      : 0;
  const stalePct = totalLeads > 0 ? Math.round((staleLeads / totalLeads) * 100) : 0;

  const sources = [...(overview?.leadSources || [])].sort(
    (a, b) => Number(b.value) - Number(a.value),
  );
  const topSource = sources[0];
  const topSourcePct =
    totalLeads > 0 && topSource
      ? Math.round((Number(topSource.value) / totalLeads) * 100)
      : 0;

  const teamLeads = lb.reduce((s, r) => s + (r.assignedLeads || 0), 0);
  const teamMembers = lb.length || 1;
  const avgLoad = Math.round(teamLeads / teamMembers);

  const health = overview?.health?.score ?? null;

  const metrics: CrmComboMetric[] = [
    {
      key: 'qualToConv',
      label: 'Qualified → converted',
      value: qualToConvPct != null ? `${qualToConvPct}%` : '—',
      sub:
        qualToConvPct != null
          ? `${converted} won of ${qualified} qualified`
          : 'Need qualified leads to measure',
      pct: qualToConvPct ?? 0,
      tone: qualToConvPct != null && qualToConvPct >= 25 ? 'emerald' : 'amber',
      href: '/leads?status=Converted',
      priority: qualToConvPct != null && qualToConvPct < 15 ? 'high' : 'medium',
    },
    {
      key: 'followupRisk',
      label: 'Follow-up pressure',
      value: `${overdue} overdue`,
      sub: `${dueSoon} due in next 2 days · ${followupRiskPct}% of queue is late`,
      pct: followupRiskPct,
      tone: overdue > 5 ? 'rose' : overdue > 0 ? 'amber' : 'emerald',
      href: '/leads',
      priority: overdue > 0 ? 'high' : 'low',
    },
    {
      key: 'engagement',
      label: 'Engagement coverage',
      value: `${engagementPct}% touched`,
      sub: `${noTouch} leads with zero touchpoints`,
      pct: engagementPct,
      tone: engagementPct >= 60 ? 'emerald' : engagementPct >= 35 ? 'amber' : 'rose',
      href: '/leads',
      priority: noTouch > 0 ? 'high' : 'low',
    },
    {
      key: 'stale',
      label: 'Stale pipeline',
      value: `${staleLeads} idle 30d+`,
      sub: `${stalePct}% of pipeline needs re-engagement`,
      pct: stalePct,
      tone: stalePct > 40 ? 'rose' : stalePct > 20 ? 'amber' : 'emerald',
      href: '/leads',
      priority: staleLeads > 0 ? 'medium' : 'low',
    },
    {
      key: 'clientHealth',
      label: 'Client stickiness',
      value: `${clientActivePct}% active`,
      sub: `${activeClients} of ${totalClients} clients active`,
      pct: clientActivePct,
      tone: clientActivePct >= 70 ? 'emerald' : clientActivePct >= 40 ? 'amber' : 'rose',
      href: '/client',
    },
    {
      key: 'topSource',
      label: 'Top acquisition',
      value: topSource?.name || '—',
      sub: topSource ? `${topSource.value} leads · ${topSourcePct}% of pipeline` : 'Tag lead sources',
      pct: topSourcePct,
      tone: 'indigo',
      href: '/leads',
    },
    {
      key: 'newToContact',
      label: 'New → contacted',
      value: newToContactPct != null ? `${newToContactPct}%` : '—',
      sub:
        newToContactPct != null
          ? `${contacted} contacted of ${newCount} new`
          : 'No new leads in period',
      pct: newToContactPct ?? 0,
      tone: newToContactPct != null && newToContactPct >= 50 ? 'emerald' : 'blue',
      href: '/leads?status=New',
    },
    {
      key: 'teamLoad',
      label: 'Team load',
      value: `~${avgLoad} leads / rep`,
      sub: `${lb.length} members · ${teamLeads} assigned leads`,
      pct: Math.min(100, avgLoad * 8),
      tone: avgLoad > 12 ? 'amber' : 'blue',
      href: '/dashboard',
    },
  ];

  if (b?.potentialBusinessValue) {
    metrics.splice(4, 0, {
      key: 'pipelineValue',
      label: 'Pipeline value',
      value: formatMoneyCompact(b.potentialBusinessValue),
      sub: `Avg lead ${formatMoneyCompact(b.averageLeadValue || 0)} · expected ${formatMoneyCompact(b.expectedRevenue || 0)}`,
      pct: Math.min(
        100,
        Math.round(((b.expectedRevenue || 0) / (b.potentialBusinessValue || 1)) * 100),
      ),
      tone: 'indigo',
      href: '/leads',
    });
  }

  if (health != null) {
    metrics.unshift({
      key: 'health',
      label: 'CRM health score',
      value: `${health}/100`,
      sub: overview?.health?.label || 'Composite pipeline health',
      pct: health,
      tone: health >= 70 ? 'emerald' : health >= 45 ? 'amber' : 'rose',
      href: '/dashboard',
      priority: health < 50 ? 'high' : 'low',
    });
  }

  return metrics;
}

/** Team-focused combo stats — for Insights & Team tabs */
export function buildCrmTeamStats(
  overview: CrmOverview | null | undefined,
): CrmComboMetric[] {
  const lb = overview?.leaderboard || [];
  const leads = overview?.leadsTable || [];
  const comm = overview?.communication;
  const fu = overview?.followups || {};

  const teamSize = lb.length || 0;
  const totalOverdue = lb.reduce((s, r) => s + (r.overdueFollowups || 0), 0);
  const avgCompletion =
    teamSize > 0
      ? Math.round(lb.reduce((s, r) => s + (r.completionRate || 0), 0) / teamSize)
      : 0;
  const totalCalls = lb.reduce((s, r) => s + (r.calls || 0), 0);
  const totalMeetings = lb.reduce((s, r) => s + (r.meetings || 0), 0);
  const totalConversions = lb.reduce((s, r) => s + (r.conversions || 0), 0);
  const totalFollowups = lb.reduce((s, r) => s + (r.followups || 0), 0);
  const totalBiz = lb.reduce((s, r) => s + (r.businessGenerated || 0), 0);
  const top = [...lb].sort((a, b) => (b.conversions || 0) - (a.conversions || 0))[0];

  const unassigned = leads.filter(
    (l) => !l.assignee || /unassigned/i.test(String(l.assignee)),
  ).length;
  const assignedPct =
    leads.length > 0 ? Math.round(((leads.length - unassigned) / leads.length) * 100) : 0;

  const outreachDone =
    Number(comm?.calls?.completed || 0) +
    Number(comm?.meetings?.completed || 0) +
    Number(comm?.emails?.completed || 0);
  const outreachPending =
    Number(comm?.calls?.pending || 0) +
    Number(comm?.meetings?.pending || 0) +
    Number(comm?.emails?.pending || 0);
  const outreachDenom = outreachDone + outreachPending || 1;
  const outreachSuccess = Math.round((outreachDone / outreachDenom) * 100);

  const fuOverdue = Number(fu.overdue || 0);
  const fuCompleted = Number(fu.completed || 0);
  const fuDenom = fuOverdue + fuCompleted || 1;
  const fuCompletionPct = Math.round((fuCompleted / fuDenom) * 100);

  const teamLeads = lb.reduce((s, r) => s + (r.assignedLeads || 0), 0);
  const avgLoad = teamSize > 0 ? Math.round(teamLeads / teamSize) : 0;

  if (!teamSize && !leads.length) return [];

  return [
    {
      key: 'teamOverdue',
      label: 'Team overdue',
      value: String(totalOverdue || fuOverdue),
      sub:
        teamSize > 0
          ? `${teamSize} members · ${totalFollowups} follow-ups logged`
          : `${fuOverdue} overdue in queue`,
      pct: Math.min(100, (totalOverdue || fuOverdue) * 5),
      tone: (totalOverdue || fuOverdue) > 5 ? 'rose' : (totalOverdue || fuOverdue) > 0 ? 'amber' : 'emerald',
      href: '/leads',
      priority: (totalOverdue || fuOverdue) > 0 ? 'high' : 'low',
    },
    {
      key: 'avgCompletion',
      label: 'Avg completion',
      value: `${avgCompletion || fuCompletionPct}%`,
      sub: 'Follow-up & task completion across team',
      pct: avgCompletion || fuCompletionPct,
      tone: (avgCompletion || fuCompletionPct) >= 70 ? 'emerald' : 'amber',
      href: '/dashboard',
    },
    {
      key: 'topCloser',
      label: 'Top closer',
      value: top?.name?.split(/\s+/)[0] || '—',
      sub: top ? `${top.conversions} conversions · ${top.assignedLeads} leads` : 'No team data yet',
      pct: totalConversions > 0 && top ? Math.round(((top.conversions || 0) / totalConversions) * 100) : 0,
      tone: 'emerald',
      href: '/dashboard',
    },
    {
      key: 'outreachRate',
      label: 'Outreach success',
      value: `${outreachSuccess}%`,
      sub: `${outreachDone} done · ${outreachPending} pending`,
      pct: outreachSuccess,
      tone: outreachSuccess >= 60 ? 'emerald' : outreachSuccess >= 35 ? 'amber' : 'rose',
      href: '/Task&Activites',
    },
    {
      key: 'leadCoverage',
      label: 'Lead ownership',
      value: `${assignedPct}% owned`,
      sub: unassigned > 0 ? `${unassigned} leads need an owner` : 'All leads assigned',
      pct: assignedPct,
      tone: assignedPct >= 90 ? 'emerald' : assignedPct >= 70 ? 'amber' : 'rose',
      href: '/leads',
      priority: unassigned > 0 ? 'medium' : 'low',
    },
    {
      key: 'activityLoad',
      label: 'Touchpoint volume',
      value: String(totalCalls + totalMeetings),
      sub: `${totalCalls} calls · ${totalMeetings} meetings`,
      pct: Math.min(100, (totalCalls + totalMeetings) * 3),
      tone: 'blue',
      href: '/Task&Activites',
    },
    {
      key: 'teamLoad',
      label: 'Leads per rep',
      value: teamSize ? `~${avgLoad}` : '—',
      sub: `${teamLeads} leads across ${teamSize || '—'} members`,
      pct: Math.min(100, avgLoad * 8),
      tone: avgLoad > 12 ? 'amber' : 'blue',
      href: '/dashboard',
    },
    {
      key: 'revenuePerRep',
      label: 'Revenue / rep',
      value: teamSize ? formatMoneyCompact(totalBiz / teamSize) : '—',
      sub: `${formatMoneyCompact(totalBiz)} generated by team`,
      pct: Math.min(100, Math.round(totalBiz / 50_000)),
      tone: 'indigo',
      href: '/client',
    },
  ];
}

/** Pipeline-focused subset (excludes team-only keys duplicated elsewhere) */
export function buildCrmPipelineStats(
  overview: CrmOverview | null | undefined,
): CrmComboMetric[] {
  const k = overview?.kpis || {};
  const leads = overview?.leadsTable || [];
  const clients = overview?.clientsTable || [];
  const fu = overview?.followups || {};
  const b = overview?.businessSummary;

  const totalLeads = Number(k.totalLeads ?? leads.length) || leads.length;
  const converted =
    k.convertedLeads != null
      ? Number(k.convertedLeads)
      : stageFromCharts(overview, /convert|won/i) ?? stageCount(leads, /convert|won/i);
  const newCount =
    k.newLeads != null
      ? Number(k.newLeads)
      : stageFromCharts(overview, /^new$/i) ?? stageCount(leads, /^new$/i);
  const contacted = stageFromCharts(overview, /contact/i) ?? stageCount(leads, /contact/i);
  const qualified = stageFromCharts(overview, /qualif/i) ?? stageCount(leads, /qualif/i);

  const noTouch = leads.filter((l) => !Number(l.totalMeetings)).length;
  const unassigned = leads.filter(
    (l) => !l.assignee || /unassigned/i.test(String(l.assignee)),
  ).length;
  const overdueFu = Number(fu.overdue ?? k.overdueFollowups ?? 0);

  const newToContactPct =
    newCount > 0 ? Math.min(100, Math.round((contacted / newCount) * 100)) : null;
  const qualToConvPct =
    qualified > 0 ? Math.min(100, Math.round((converted / qualified) * 100)) : null;
  const engagementBase = leads.length || totalLeads;
  const engagementPct =
    engagementBase > 0
      ? Math.round(((engagementBase - noTouch) / engagementBase) * 100)
      : 0;
  const ownedPct =
    totalLeads > 0 ? Math.round(((totalLeads - unassigned) / totalLeads) * 100) : 100;

  const totalClients = Number(k.totalClients ?? clients.length) || clients.length;
  const activeClients =
    k.activeClients != null
      ? Number(k.activeClients)
      : clients.filter((c) => /active|hot/i.test(String(c.status || ''))).length;
  const inactiveClients = Number(k.inactiveClients || 0);
  const onHoldClients = Number(k.onHoldClients || 0);
  const prospectClients = Number(k.prospectClients || 0);
  const hotClients = Number(k.hotClients || 0);
  const clientActivePct = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;
  const clientValue = clients.reduce((s, c) => s + Number(c.value || 0), 0);
  const avgClientValue = totalClients > 0 ? clientValue / totalClients : 0;
  const clientsAtRisk = clients.filter((c) => {
    const days = daysSince(c.lastActivity);
    return /inactive|hold|cold/i.test(String(c.status || '')) || (days != null && days > 45);
  }).length;

  const metrics: CrmComboMetric[] = [
    {
      key: 'qualToConv',
      label: 'Qualified → win',
      value: qualToConvPct != null ? `${qualToConvPct}%` : '—',
      sub:
        qualToConvPct != null
          ? `${converted} won of ${qualified} qualified`
          : 'Need qualified leads to measure',
      pct: qualToConvPct ?? 0,
      tone: qualToConvPct != null && qualToConvPct >= 25 ? 'emerald' : 'amber',
      href: '/leads',
      category: 'leads',
      info: 'Closing quality: converted ÷ qualified. Differs from overall KPI conversion.',
      priority: qualToConvPct != null && qualToConvPct < 15 ? 'high' : 'medium',
    },
    {
      key: 'newToContact',
      label: 'New → contacted',
      value: newToContactPct != null ? `${newToContactPct}%` : '—',
      sub:
        newToContactPct != null
          ? `${contacted} contacted of ${newCount} new`
          : 'No new leads in period',
      pct: newToContactPct ?? 0,
      tone: newToContactPct != null && newToContactPct >= 50 ? 'emerald' : 'blue',
      href: '/leads',
      category: 'leads',
      info: 'First-response speed: share of new leads that reached Contacted.',
    },
    {
      key: 'engagement',
      label: 'Engaged leads',
      value: `${engagementPct}%`,
      sub: `${noTouch} with zero touchpoints`,
      pct: engagementPct,
      tone: engagementPct >= 60 ? 'emerald' : engagementPct >= 35 ? 'amber' : 'rose',
      href: '/leads',
      category: 'leads',
      info: 'Leads with at least one logged call, meeting, email, or WhatsApp.',
      priority: noTouch > 0 ? 'high' : 'low',
    },
    {
      key: 'leadCoverage',
      label: 'Unassigned leads',
      value: String(unassigned),
      sub:
        unassigned > 0
          ? `${ownedPct}% owned · ${unassigned} need an owner`
          : `All ${totalLeads} leads have an owner`,
      pct: ownedPct,
      tone: unassigned > 0 ? 'rose' : 'emerald',
      href: '/leads',
      category: 'leads',
      info: 'Leads without an assignee — ownership gaps slow follow-up.',
      priority: unassigned > 0 ? 'high' : 'low',
    },
    {
      key: 'overdueFu',
      label: 'Overdue follow-ups',
      value: String(overdueFu),
      sub: `${Number(fu.today || 0)} due today · ${Number(fu.tomorrow || 0)} tomorrow`,
      pct: Math.min(100, overdueFu * 8),
      tone: overdueFu > 5 ? 'rose' : overdueFu > 0 ? 'amber' : 'emerald',
      href: '/leads',
      category: 'leads',
      info: 'Past-due next steps on leads — clear these before new outreach.',
      priority: overdueFu > 0 ? 'high' : 'low',
    },
    {
      key: 'clientHealth',
      label: 'Active clients',
      value: `${clientActivePct}%`,
      sub: `${activeClients} of ${totalClients} accounts active`,
      pct: clientActivePct,
      tone: clientActivePct >= 70 ? 'emerald' : clientActivePct >= 40 ? 'amber' : 'rose',
      href: '/client',
      category: 'clients',
      info: 'Share of client portfolio marked active.',
    },
    {
      key: 'clientPortfolio',
      label: 'Portfolio size',
      value: String(totalClients),
      sub: [
        hotClients ? `${hotClients} hot` : null,
        prospectClients ? `${prospectClients} prospect` : null,
        onHoldClients ? `${onHoldClients} on hold` : null,
        inactiveClients ? `${inactiveClients} inactive` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'No client mix yet',
      pct: clientActivePct,
      tone: 'blue',
      href: '/client',
      category: 'clients',
      info: 'Total clients with hot / prospect / hold / inactive mix.',
    },
    {
      key: 'clientsAtRisk',
      label: 'Clients at risk',
      value: String(clientsAtRisk),
      sub: 'Inactive, on hold, or quiet 45d+',
      pct: totalClients > 0 ? Math.round((clientsAtRisk / totalClients) * 100) : 0,
      tone: clientsAtRisk > 0 ? 'rose' : 'emerald',
      href: '/client',
      category: 'clients',
      info: 'Accounts that may churn — status risk or no recent activity.',
      priority: clientsAtRisk > 0 ? 'high' : 'low',
    },
    {
      key: 'avgClientValue',
      label: 'Avg client value',
      value: avgClientValue ? formatMoneyCompact(avgClientValue) : '—',
      sub: clientValue ? `Portfolio ${formatMoneyCompact(clientValue)}` : 'No values logged',
      pct: Math.min(100, Math.round(avgClientValue / 1000)),
      tone: 'indigo',
      href: '/client',
      category: 'clients',
      info: 'Average recorded value across client accounts.',
    },
  ];

  if (b?.potentialBusinessValue) {
    metrics.splice(3, 0, {
      key: 'pipelineValue',
      label: 'Pipeline value',
      value: formatMoneyCompact(b.potentialBusinessValue),
      sub: `Avg lead ${formatMoneyCompact(b.averageLeadValue || 0)} · expected ${formatMoneyCompact(b.expectedRevenue || 0)}`,
      pct: Math.min(
        100,
        Math.round(((b.expectedRevenue || 0) / (b.potentialBusinessValue || 1)) * 100),
      ),
      tone: 'indigo',
      href: '/leads',
      category: 'leads',
      info: 'Estimated open-pipeline value vs expected revenue from business summary.',
    });
  }

  return metrics;
}

export function buildCrmPipelineStatsWithInfo(overview: CrmOverview | null | undefined) {
  return buildCrmPipelineStats(overview);
}

const TEAM_INFO: Record<string, string> = {
  teamOverdue: 'Follow-ups past their due date across all assigned team members.',
  avgCompletion: 'Average rate at which the team completes scheduled follow-ups and tasks.',
  topCloser: 'Rep with the highest number of lead conversions in the selected period.',
  outreachRate: 'Completed outreach (calls, meetings, emails) vs still pending.',
  leadCoverage: 'Share of leads with an assigned owner — unassigned leads need attention.',
  activityLoad: 'Total calls and meetings logged by the team.',
  teamLoad: 'Average number of leads assigned per team member.',
  revenuePerRep: 'Business value generated per rep from converted clients.',
};

/** Curated insight stats grouped by Leads / Clients / Team — fewer, clearer metrics */
export function buildCrmInsightCategories(overview: CrmOverview | null | undefined): {
  leads: CrmComboMetric[];
  clients: CrmComboMetric[];
  team: CrmComboMetric[];
} {
  const all = buildCrmComboMetrics(overview);
  const pick = (key: string) => all.find((m) => m.key === key);

  const k = overview?.kpis || {};
  const totalClients = Number(k.totalClients || 0);
  const activeClients = Number(k.activeClients || 0);
  const hotClients = Number(k.hotClients || 0);

  const leadsRaw = overview?.leadsTable || [];
  const unassignedCount = leadsRaw.filter(
    (l) => !l.assignee || /unassigned/i.test(String(l.assignee)),
  ).length;
  const ownedPct =
    leadsRaw.length > 0
      ? Math.round(((leadsRaw.length - unassignedCount) / leadsRaw.length) * 100)
      : 100;

  const leads: CrmComboMetric[] = [
    pick('qualToConv'),
    pick('newToContact'),
    pick('engagement'),
  ]
    .filter((m): m is CrmComboMetric => Boolean(m))
    .map((m) => ({
      ...m,
      category: 'leads' as const,
      label:
        m.key === 'qualToConv'
          ? 'Qualified → win'
          : m.key === 'engagement'
            ? 'Engaged leads'
            : m.label,
      info:
        m.key === 'qualToConv'
          ? 'How many qualified leads converted to won — measures closing effectiveness. Differs from the KPI conversion rate, which is overall funnel %.'
          : m.key === 'newToContact'
            ? 'Share of new leads that reached Contacted. Low % means first response is slow.'
            : 'Leads with at least one logged touchpoint (call, meeting, email). Zero-touch leads need outreach.',
    }));

  leads.push({
    key: 'leadCoverage',
    label: 'Unassigned leads',
    value: String(unassignedCount),
    sub:
      unassignedCount > 0
        ? `${ownedPct}% owned · ${unassignedCount} need an owner`
        : `All ${leadsRaw.length || 0} leads have an owner`,
    pct: ownedPct,
    tone: unassignedCount > 0 ? 'rose' : 'emerald',
    href: '/leads',
    priority: unassignedCount > 0 ? 'high' : 'low',
    category: 'leads',
    info: 'Leads with no assignee. Assign ownership so follow-ups and outreach stay accountable.',
  });

  const clientHealth = pick('clientHealth');
  const clients: CrmComboMetric[] = [
    clientHealth
      ? {
          ...clientHealth,
          category: 'clients',
          label: 'Active clients',
          info: 'Percentage of client accounts marked active vs total clients.',
        }
      : null,
    totalClients > 0
      ? {
          key: 'clientPortfolio',
          label: 'Portfolio size',
          value: String(totalClients),
          sub: `${activeClients} active${hotClients ? ` · ${hotClients} hot` : ''}`,
          pct: totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0,
          tone: 'blue' as const,
          href: '/client',
          category: 'clients' as const,
          info: 'Total client accounts in CRM, with active and hot breakdown.',
        }
      : null,
  ].filter((m): m is CrmComboMetric => Boolean(m));

  const team = buildCrmTeamStats(overview)
    .slice(0, 4)
    .map((m) => ({
      ...m,
      category: 'team' as const,
      info: TEAM_INFO[m.key] || m.sub,
    }));

  return { leads, clients, team };
}

export function buildCrmTeamStatsWithInfo(overview: CrmOverview | null | undefined) {
  return buildCrmTeamStats(overview).map((m) => ({
    ...m,
    info: TEAM_INFO[m.key] || m.sub,
  }));
}
