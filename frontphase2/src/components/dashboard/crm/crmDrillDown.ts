import type { CrmOverview, DrillDownPayload } from '@/lib/dashboard/api';

function leadRows(overview: CrmOverview | null | undefined) {
  return overview?.leadsTable || [];
}

function clientRows(overview: CrmOverview | null | undefined) {
  return overview?.clientsTable || [];
}

function matchStatus(value: string | undefined, needle: string) {
  return String(value || '').trim().toLowerCase() === needle.trim().toLowerCase();
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

export function mapLeadDrillRows(rows: ReturnType<typeof leadRows>) {
  return rows.map((row) => ({
    Name: row.name || '—',
    Contact: row.contact || '—',
    Email: row.email || '—',
    Phone: row.phone || '—',
    Status: row.status || '—',
    Priority: row.priority || '—',
    Source: row.source || '—',
    Industry: row.industry || '—',
    Assignee: row.assignee || '—',
    Location: row.location || '—',
    'Last Activity': formatWhen(row.lastActivity),
    'Next Follow-up': formatWhen(row.nextFollowUp),
  }));
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
      rows: (overview?.alerts || []).map((alert) => ({
        Alert: alert.text,
        Severity: alert.severity || 'info',
        Action: alert.action || '—',
      })),
    };
  }

  if (metricKey === 'teamMembers') {
    const team = overview?.leaderboard?.length
      ? overview.leaderboard
      : (overview?.teamOptions || []).map((t) => ({
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
  const filtered =
    kind === 'source'
      ? leads.filter((row) => matchStatus(row.source, sliceName))
      : leads.filter((row) => matchStatus(row.status, sliceName));

  return {
    title: `${sliceName} leads`,
    href: `/leads?${kind === 'source' ? 'source' : 'status'}=${encodeURIComponent(sliceName)}`,
    rows: mapLeadDrillRows(filtered.length ? filtered : leads.filter(() => false)),
  };
}

export function buildClientSliceDrillDown(
  overview: CrmOverview | null | undefined,
  sliceName: string,
): DrillDownPayload {
  const clients = clientRows(overview);
  const filtered = clients.filter((row) => matchStatus(row.status, sliceName));
  return {
    title: `${sliceName} clients`,
    href: '/client',
    rows: mapClientDrillRows(filtered),
  };
}
