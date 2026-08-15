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

  if (metricKey === 'overdueFollowups' || metricKey === 'followupRisk') {
    const overdue = overview?.followups?.overdue ?? overview?.kpis?.overdueFollowups;
    const upcoming = overview?.followups?.upcoming || [];
    return {
      title: label,
      href,
      metricKey,
      subtitle: `${overdue ?? 0} overdue in period`,
      rows: upcoming.length
        ? upcoming.map((item) => ({
            Company: item.company || '—',
            Contact: item.contact || '—',
            When: formatWhen(item.at),
            Assignee: item.assignee || '—',
          }))
        : [{ Overdue: overdue ?? '—', Today: overview?.followups?.today ?? '—' }],
    };
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
      const noTouch = !Number(row.totalMeetings);
      if (metricKey === 'engagement') return noTouch;
      if (!row.lastActivity) return true;
      const ts = new Date(row.lastActivity).getTime();
      return !Number.isFinite(ts) || ts < Date.now() - 30 * 24 * 60 * 60 * 1000;
    });
    return {
      title: label,
      href,
      metricKey,
      rows: mapLeadDrillRows(filtered),
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
    const sources = overview?.leadSources || [];
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
    const team = overview?.leaderboard || [];
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
    const team = overview?.leaderboard || [];
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
    const team = [...(overview?.leaderboard || [])].sort(
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
    const team = overview?.leaderboard || [];
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
  const needle = sliceName.trim().toLowerCase();
  const byStatus = clients.filter((row) => matchStatus(row.status, sliceName));
  const filtered = byStatus.length
    ? byStatus
    : clients.filter((row) => String(row.industry || '').toLowerCase() === needle);
  return {
    title: `${sliceName} clients`,
    href: '/client',
    rows: mapClientDrillRows(filtered),
  };
}
