import { asList, type CrmOverview, type DrillDownPayload } from '@/lib/dashboard/api';
import { filterByLabel, labelsMatch } from '@/lib/dashboard/drillDown';

function leadRows(overview: CrmOverview | null | undefined) {
  return asList(overview?.leadsTable);
}

function clientRows(overview: CrmOverview | null | undefined) {
  return asList(overview?.clientsTable);
}

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type FollowupBucket = 'today' | 'tomorrow' | 'overdue' | 'completed' | 'all';

export function parseFollowupBucket(label?: string | null): FollowupBucket {
  const text = String(label || '').trim().toLowerCase();
  if (text.includes('overdue')) return 'overdue';
  if (text.includes('tomorrow')) return 'tomorrow';
  if (text.includes('complete')) return 'completed';
  if (text.includes('today')) return 'today';
  return 'all';
}

function startOfLocalDayMs(from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
}

export function classifyFollowupAt(at?: string | null): FollowupBucket {
  if (!at) return 'all';
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return 'all';
  const start = startOfLocalDayMs();
  const endToday = start + 24 * 60 * 60 * 1000 - 1;
  const endTomorrow = start + 2 * 24 * 60 * 60 * 1000 - 1;
  if (t < start) return 'overdue';
  if (t <= endToday) return 'today';
  if (t <= endTomorrow) return 'tomorrow';
  return 'all';
}

function mapFollowupDrillRows(
  rows: Array<{
    id?: string;
    company?: string;
    contact?: string;
    type?: string;
    at?: string | null;
    status?: string;
    priority?: string;
    assignee?: string;
    bucket?: string;
  }>,
) {
  return rows.map((item) => ({
    Type: item.type === 'client' ? 'Client' : 'Lead',
    Company: item.company || '—',
    Contact: item.contact || '—',
    When: formatWhen(item.at),
    Bucket: item.bucket || classifyFollowupAt(item.at),
    Status: item.status || '—',
    Priority: item.priority || '—',
    Assignee: item.assignee || '—',
  }));
}

function followupsFromTables(overview: CrmOverview | null | undefined) {
  const leads = leadRows(overview).flatMap((row) => {
    if (!row.nextFollowUp) return [];
    return [
      {
        id: row.id,
        company: row.name,
        contact: row.contact,
        type: 'lead',
        at: row.nextFollowUp,
        status: row.status,
        priority: row.priority,
        assignee: row.assignee,
        bucket: classifyFollowupAt(row.nextFollowUp),
      },
    ];
  });
  const clients = clientRows(overview).flatMap((row) => {
    if (!row.nextFollowUp) return [];
    return [
      {
        id: row.id,
        company: row.name,
        contact: '',
        type: 'client',
        at: row.nextFollowUp,
        status: row.status,
        priority: '',
        assignee: row.assignee,
        bucket: classifyFollowupAt(row.nextFollowUp),
      },
    ];
  });
  return [...leads, ...clients];
}

export function buildFollowupDrillDown(
  overview: CrmOverview | null | undefined,
  bucketOrLabel: string,
  title?: string,
): DrillDownPayload {
  const bucket = parseFollowupBucket(bucketOrLabel);
  const listed = asList(overview?.followups?.upcoming).map((item) => ({
    ...item,
    bucket: item.bucket || classifyFollowupAt(item.at),
  }));
  const fallback = followupsFromTables(overview);
  const seen = new Set<string>();
  const merged = [...listed, ...fallback].filter((item) => {
    const bucketKey = item.bucket || classifyFollowupAt(item.at);
    const key = `${item.type || 'lead'}:${item.id || item.company}:${bucketKey}`;
    if (!item.id && !item.company) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const matchesBucket = (item: { bucket?: string; at?: string | null }) => {
    const stored = String(item.bucket || '').toLowerCase();
    const dated = classifyFollowupAt(item.at);
    if (bucket === 'all') return stored !== 'completed';
    if (stored === bucket || dated === bucket) return true;
    if (bucket === 'overdue' && item.at) {
      const t = new Date(item.at).getTime();
      return Number.isFinite(t) && t < startOfLocalDayMs() && stored !== 'completed';
    }
    return false;
  };
  const filtered = merged.filter(matchesBucket);
  const href =
    filtered.some((item) => item.type === 'client') && !filtered.some((item) => item.type !== 'client')
      ? '/client'
      : '/leads';
  const count =
    bucket === 'overdue'
      ? overview?.followups?.overdue ?? overview?.kpis?.overdueFollowups
      : bucket === 'today'
        ? overview?.followups?.today
        : bucket === 'tomorrow'
          ? overview?.followups?.tomorrow
          : bucket === 'completed'
            ? overview?.followups?.completed
            : filtered.length;

  return {
    title: title || (bucket === 'all' ? 'Follow-ups' : `${bucket[0].toUpperCase()}${bucket.slice(1)}`),
    href,
    subtitle: `${filtered.length || count || 0} record${(filtered.length || count || 0) === 1 ? '' : 's'}`,
    rows: mapFollowupDrillRows(filtered),
  };
}

export function mapLeadDrillRows(rows: ReturnType<typeof leadRows>) {
  return rows.map((row) => {
    const b = row.meetingsBreakdown || {};
    const breakdown = [
      b.calls ? `${b.calls} calls` : null,
      b.meetings ? `${b.meetings} meetings` : null,
      b.emails ? `${b.emails} emails` : null,
      b.whatsapp ? `${b.whatsapp} WhatsApp` : null,
      b.followups ? `${b.followups} follow-ups` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      Name: row.name || '—',
      Contact: row.contact || '—',
      Email: row.email || '—',
      Phone: row.phone || '—',
      Status: row.status || '—',
      Priority: row.priority || '—',
      Source: row.source || '—',
      Assignee: row.assignee || '—',
      'Total meetings': String(row.totalMeetings ?? 0),
      Breakdown: breakdown || '—',
      'Last Activity': formatWhen(row.lastActivity),
      'Next Follow-up': formatWhen(row.nextFollowUp),
    };
  });
}

export function mapClientDrillRows(rows: ReturnType<typeof clientRows>) {
  return rows.map((row) => ({
    Name: row.name || '—',
    Status: row.status || '—',
    Industry: row.industry || '—',
    Assignee: row.assignee || '—',
    Location: row.location || '—',
    'Last Activity': formatWhen(row.lastActivity),
    'Next Follow-up': formatWhen(row.nextFollowUp),
  }));
}

export function buildKpiDrillDown(
  overview: CrmOverview | null | undefined,
  metricKey: string,
  label: string,
  href: string,
): DrillDownPayload {
  const leads = leadRows(overview);
  const clients = clientRows(overview);

  if (metricKey === 'totalLeads') {
    return {
      title: label,
      href,
      metricKey,
      rows: mapLeadDrillRows(leads),
    };
  }

  if (metricKey === 'totalClients') {
    return {
      title: label,
      href,
      metricKey,
      rows: mapClientDrillRows(clients),
    };
  }

  if (metricKey === 'conversionRate') {
    const converted = leads.filter((row) =>
      /converted|won/i.test(String(row.status || '')),
    );
    return {
      title: label,
      href,
      metricKey,
      rows: mapLeadDrillRows(converted.length ? converted : leads),
    };
  }

  if (metricKey === 'alerts') {
    return {
      title: label,
      href: '/dashboard',
      metricKey,
      rows: asList(overview?.alerts).map((alert) => ({
        Alert: alert.text,
        Severity: alert.severity || 'info',
        Action: alert.action || '—',
      })),
    };
  }

  if (metricKey === 'teamMembers') {
    const team = overview?.leaderboard?.length
      ? overview.leaderboard
      : asList(overview?.teamOptions).map((t) => ({
          id: t.id,
          name: t.name,
          email: '',
          role: 'Member',
          assignedLeads: 0,
          assignedClients: 0,
          calls: 0,
          meetings: 0,
          emails: 0,
          followups: 0,
          overdueFollowups: 0,
          conversions: 0,
          businessGenerated: 0,
          completionRate: 0,
        }));
    return {
      title: label,
      href,
      metricKey,
      rows: team.map((member) => ({
        Name: member.name,
        Role: String(member.role || 'Team').replace(/_/g, ' '),
        Leads: member.assignedLeads ?? '—',
        Clients: member.assignedClients ?? '—',
        Converted: member.conversions ?? '—',
        'Follow-ups': member.followups ?? '—',
        Overdue: member.overdueFollowups ?? '—',
      })),
    };
  }

  if (metricKey === 'overdueFollowups' || metricKey === 'followupRisk') {
    return buildFollowupDrillDown(overview, 'overdue', label);
  }

  if (metricKey === 'newLeads') {
    const recent = leads.filter((row) => {
      if (!row.lastActivity) return false;
      const ts = new Date(row.lastActivity).getTime();
      return Number.isFinite(ts) && ts >= Date.now() - 30 * 24 * 60 * 60 * 1000;
    });
    return {
      title: label,
      href,
      metricKey,
      rows: mapLeadDrillRows(recent.length ? recent : leads.slice(0, 25)),
    };
  }

  if (metricKey === 'engagement' || metricKey === 'stale') {
    const filtered = leads.filter((row) => {
      const touched = Number(row.totalMeetings) > 0;
      if (metricKey === 'engagement') return !touched;
      if (!row.lastActivity) return true;
      const ts = new Date(row.lastActivity).getTime();
      return !Number.isFinite(ts) || ts < Date.now() - 30 * 24 * 60 * 60 * 1000;
    });
    return {
      title: label,
      href,
      metricKey,
      rows: mapLeadDrillRows(filtered.length ? filtered : leads),
    };
  }

  if (metricKey === 'qualToConv') {
    const qualified = leads.filter((row) => /qualif/i.test(String(row.status || '')));
    const converted = leads.filter((row) => /convert|won/i.test(String(row.status || '')));
    return {
      title: label,
      href,
      metricKey,
      rows: mapLeadDrillRows(converted.length ? converted : qualified),
    };
  }

  if (metricKey === 'clientHealth') {
    const active = clients.filter((row) => /active|hot/i.test(String(row.status || '')));
    return {
      title: label,
      href,
      metricKey,
      rows: mapClientDrillRows(active.length ? active : clients),
    };
  }

  if (metricKey === 'clientPortfolio') {
    return {
      title: label,
      href: '/client',
      metricKey,
      rows: mapClientDrillRows(clients),
    };
  }

  if (metricKey === 'topSource') {
    const sources = asList(overview?.leadSources);
    const top = [...sources].sort((a, b) => Number(b.value) - Number(a.value))[0];
    const filtered = top
      ? leads.filter((row) =>
          String(row.source || '')
            .trim()
            .toLowerCase() === String(top.name).trim().toLowerCase(),
        )
      : leads;
    return {
      title: label,
      href,
      metricKey,
      rows: mapLeadDrillRows(filtered),
    };
  }

  if (metricKey === 'teamLoad') {
    return buildKpiDrillDown(overview, 'teamMembers', label, href);
  }

  if (metricKey === 'teamOverdue') {
    const team = asList(overview?.leaderboard);
    return {
      title: label,
      href,
      metricKey,
      rows: team.length
        ? team.map((m) => ({
            Name: m.name,
            Overdue: m.overdueFollowups ?? 0,
            'Follow-ups': m.followups ?? 0,
            Leads: m.assignedLeads ?? 0,
          }))
        : [{ Overdue: overview?.followups?.overdue ?? '—' }],
    };
  }

  if (metricKey === 'avgCompletion') {
    const team = asList(overview?.leaderboard);
    return {
      title: label,
      href,
      metricKey,
      rows: team.map((m) => ({
        Name: m.name,
        'Completion %': m.completionRate ?? 0,
        Converted: m.conversions ?? 0,
        Leads: m.assignedLeads ?? 0,
      })),
    };
  }

  if (metricKey === 'topCloser') {
    const team = [...asList(overview?.leaderboard)].sort(
      (a, b) => (b.conversions || 0) - (a.conversions || 0),
    );
    return {
      title: label,
      href,
      metricKey,
      rows: team.map((m) => ({
        Name: m.name,
        Converted: m.conversions ?? 0,
        Leads: m.assignedLeads ?? 0,
        Clients: m.assignedClients ?? 0,
        Rate: `${m.completionRate ?? 0}%`,
      })),
    };
  }

  if (metricKey === 'outreachRate' || metricKey === 'activityLoad') {
    const c = overview?.communication;
    return {
      title: label,
      href: href || '/Task&Activites',
      metricKey,
      rows: [
        {
          Calls: `${c?.calls?.completed ?? 0} done / ${c?.calls?.pending ?? 0} pending`,
          Meetings: `${c?.meetings?.completed ?? 0} done / ${c?.meetings?.pending ?? 0} pending`,
          Emails: `${c?.emails?.completed ?? 0} done / ${c?.emails?.pending ?? 0} pending`,
          WhatsApp: `${c?.whatsapp?.completed ?? 0} done / ${c?.whatsapp?.pending ?? 0} pending`,
        },
      ],
    };
  }

  if (metricKey === 'leadCoverage') {
    const unassigned = leads.filter(
      (l) => !l.assignee || /unassigned/i.test(String(l.assignee)),
    );
    return {
      title: label,
      href,
      metricKey,
      rows: mapLeadDrillRows(unassigned.length ? unassigned : leads.slice(0, 25)),
    };
  }

  if (metricKey === 'revenuePerRep') {
    const team = asList(overview?.leaderboard);
    return {
      title: label,
      href,
      metricKey,
      rows: team.map((m) => ({
        Name: m.name,
        'Business generated': m.businessGenerated ?? 0,
        Converted: m.conversions ?? 0,
        Leads: m.assignedLeads ?? 0,
      })),
    };
  }

  if (metricKey === 'aiTokens') {
    const tokens = overview?.aiTokens;
    return {
      title: label,
      href,
      metricKey,
      rows: [
        {
          Total: tokens?.total ?? overview?.kpis?.aiTokensTotal ?? '—',
          Used: tokens?.used ?? overview?.kpis?.aiTokensUsed ?? '—',
          Remaining: tokens?.remaining ?? overview?.kpis?.aiTokensRemaining ?? '—',
          'Usage %': tokens?.usagePct != null ? `${tokens.usagePct}%` : '—',
        },
      ],
    };
  }

  if (metricKey === 'proposal' || metricKey === 'negotiation' || metricKey === 'meeting') {
    return buildLeadSliceDrillDown(overview, label || metricKey, 'status');
  }

  if (
    metricKey === 'activeClients' ||
    metricKey === 'inactiveClients' ||
    metricKey === 'onHoldClients' ||
    metricKey === 'prospectClients' ||
    metricKey === 'hotClients' ||
    metricKey === 'coldClients'
  ) {
    const slice =
      metricKey === 'activeClients'
        ? 'Active'
        : metricKey === 'onHoldClients'
          ? 'On Hold'
          : metricKey === 'prospectClients' || metricKey === 'hotClients'
            ? 'Prospect'
            : 'Inactive';
    return buildClientSliceDrillDown(overview, slice);
  }

  if (metricKey === 'meetingsToday' || metricKey === 'callsToday' || metricKey === 'emailsToday' || metricKey === 'whatsappToday') {
    const calendar = asList(overview?.calendar);
    const needle =
      metricKey === 'meetingsToday'
        ? 'meeting'
        : metricKey === 'callsToday'
          ? 'call'
          : metricKey === 'emailsToday'
            ? 'email'
            : 'whatsapp';
    const filtered = calendar.filter((row) => labelsMatch(row.type, needle) || labelsMatch(row.title, needle));
    return {
      title: label,
      href: href || '/Task&Activites',
      metricKey,
      rows: (filtered.length ? filtered : calendar).map((row) => ({
        Title: row.title || '—',
        Type: row.type || '—',
        When: formatWhen(row.at),
        Status: row.status || '—',
        Assignee: row.assignee || '—',
      })),
    };
  }

  if (metricKey === 'waitingOnYou') {
    const approvals = asList(overview?.myWork?.approvals);
    return {
      title: label,
      href,
      metricKey,
      rows: approvals.length
        ? approvals.map((item) => ({
            Title: item.title,
            Kind: item.kind,
            From: item.from || '—',
            When: formatWhen(item.at),
          }))
        : [{ Waiting: overview?.kpis?.waitingOnYou ?? 0 }],
    };
  }

  const leadHit = buildLeadSliceDrillDown(overview, label || metricKey, 'status');
  if (leadHit.rows?.length) return { ...leadHit, title: label, href, metricKey };
  const clientHit = buildClientSliceDrillDown(overview, label || metricKey);
  if (clientHit.rows?.length) return { ...clientHit, title: label, href, metricKey };
  if (leads.length) {
    return { title: label, href, metricKey, rows: mapLeadDrillRows(leads) };
  }
  if (clients.length) {
    return { title: label, href, metricKey, rows: mapClientDrillRows(clients) };
  }

  return {
    title: label,
    href,
    metricKey,
    rows: [{ Metric: label, Value: overview?.kpis?.[metricKey] ?? '—' }],
  };
}

export function buildLeadSliceDrillDown(
  overview: CrmOverview | null | undefined,
  sliceName: string,
  kind: 'status' | 'source' | 'stage' = 'status',
): DrillDownPayload {
  const leads = leadRows(overview);
  const getter = kind === 'source' ? (row: (typeof leads)[number]) => row.source : (row: (typeof leads)[number]) => row.status;
  const filtered = filterByLabel(leads, getter, sliceName);
  const rows = filtered.length ? filtered : leads;
  return {
    title: `${sliceName} leads`,
    href: `/leads?${kind === 'source' ? 'source' : 'status'}=${encodeURIComponent(sliceName)}`,
    subtitle: filtered.length
      ? `${filtered.length} matching lead${filtered.length === 1 ? '' : 's'}`
      : leads.length
        ? `No exact “${sliceName}” match — showing current leads`
        : 'No lead records in the current dashboard data',
    rows: mapLeadDrillRows(rows),
  };
}

export function buildClientSliceDrillDown(
  overview: CrmOverview | null | undefined,
  sliceName: string,
): DrillDownPayload {
  const clients = clientRows(overview);
  const byStatus = filterByLabel(clients, (row) => row.status, sliceName);
  const byIndustry = filterByLabel(clients, (row) => row.industry, sliceName);
  const byLocation = filterByLabel(clients, (row) => row.location, sliceName);
  const filtered = byStatus.length ? byStatus : byIndustry.length ? byIndustry : byLocation;
  const rows = filtered.length ? filtered : clients;
  return {
    title: `${sliceName} clients`,
    href: '/client',
    subtitle: filtered.length
      ? `${filtered.length} matching client${filtered.length === 1 ? '' : 's'}`
      : clients.length
        ? `No exact “${sliceName}” match — showing current clients`
        : 'No client records in the current dashboard data',
    rows: mapClientDrillRows(rows),
  };
}

export function buildLeadOwnershipDrillDown(
  overview: CrmOverview | null | undefined,
  sliceName = 'unassigned',
): DrillDownPayload {
  const leads = leadRows(overview);
  const unassigned = leads.filter((row) => !row.assignee || /unassigned/i.test(String(row.assignee)));
  const assigned = leads.filter((row) => row.assignee && !/unassigned/i.test(String(row.assignee)));
  const wantUnassigned = /unassign|open/i.test(sliceName);
  const rows = wantUnassigned ? unassigned : assigned;
  return {
    title: wantUnassigned ? 'Unassigned leads' : 'Assigned leads',
    href: '/leads',
    rows: mapLeadDrillRows(rows.length ? rows : leads),
  };
}

export function buildEngagementSliceDrillDown(
  overview: CrmOverview | null | undefined,
  sliceName = 'cold',
): DrillDownPayload {
  const leads = leadRows(overview);
  const touched = leads.filter((row) => Number(row.totalMeetings) > 0);
  const cold = leads.filter((row) => !Number(row.totalMeetings));
  const wantTouched = /^(touch|engage)/i.test(String(sliceName || '').trim());
  const rows = wantTouched ? touched : cold;
  return {
    title: wantTouched ? 'Touched leads' : 'Cold leads',
    href: '/leads',
    rows: mapLeadDrillRows(rows.length ? rows : leads),
  };
}
