import { asList, type RecruitmentOverview, type DrillDownPayload } from '@/lib/dashboard/api';
import { filterByLabel } from '@/lib/dashboard/drillDown';

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function startOfLocalDayMs(from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
}

function isToday(iso?: string | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const start = startOfLocalDayMs();
  return t >= start && t < start + 24 * 60 * 60 * 1000;
}

function normalizeSlice(value?: string | null) {
  return String(value || '')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
}

function mapJobRows(rows: NonNullable<RecruitmentOverview['jobsTable']>) {
  return rows.map((row) => ({
    Job: row.title || '—',
    Status: row.status || '—',
    Client: row.client || '—',
    Assignee: row.assignee || '—',
    Applicants: row.applicants ?? '—',
  }));
}

function mapCandidateRows(rows: NonNullable<RecruitmentOverview['candidatesTable']>) {
  return rows.map((row) => ({
    Candidate: row.name || '—',
    Status: row.status || '—',
    Source: row.source || '—',
    Title: row.title || '—',
    Assignee: row.assignee || '—',
  }));
}

function mapInterviewRows(rows: NonNullable<RecruitmentOverview['interviewsTable']>) {
  return rows.map((row) => ({
    Candidate: row.candidate || '—',
    Job: row.job || '—',
    Status: row.status || '—',
    Round: row.round || '—',
    Scheduled: formatWhen(row.scheduledAt),
  }));
}

function mapPlacementRows(rows: NonNullable<RecruitmentOverview['placementsTable']>) {
  return rows.map((row) => ({
    Candidate: row.candidate || '—',
    Client: row.client || '—',
    Job: row.job || '—',
    Status: row.status || '—',
  }));
}

export function buildRecKpiDrillDown(
  overview: RecruitmentOverview | null | undefined,
  metricKey: string,
  label: string,
  href: string,
): DrillDownPayload {
  const jobs = asList(overview?.jobsTable);
  const candidates = asList(overview?.candidatesTable);
  const interviews = asList(overview?.interviewsTable);
  const placements = asList(overview?.placementsTable);
  const start = startOfLocalDayMs();

  if (metricKey === 'openJobs' || metricKey === 'fillRate' || metricKey === 'jobsNoCandidates' || metricKey === 'jobsSlaRisk') {
    const filtered =
      metricKey === 'jobsNoCandidates'
        ? jobs.filter((row) => Boolean(row.noCandidates) || Number(row.applicants || 0) === 0)
        : metricKey === 'jobsSlaRisk'
          ? jobs.filter((row) => Boolean(row.slaRisk))
          : metricKey === 'openJobs'
            ? jobs.filter((row) => /open/i.test(String(row.status || '')))
            : jobs.filter((row) => /fill|closed/i.test(String(row.status || '')));
    return { title: label, href, rows: mapJobRows(filtered.length ? filtered : jobs) };
  }

  if (metricKey === 'totalCandidates') {
    return { title: label, href, rows: mapCandidateRows(candidates) };
  }

  if (metricKey === 'interviewsToday' || metricKey === 'interviewsUpcoming' || metricKey === 'interviewsOverdueFeedback') {
    const filtered =
      metricKey === 'interviewsToday'
        ? interviews.filter((row) => isToday(row.scheduledAt))
        : metricKey === 'interviewsOverdueFeedback'
          ? interviews.filter((row) => {
              const past = row.scheduledAt ? new Date(row.scheduledAt).getTime() < start : false;
              return past && /feedback|pending/i.test(String(row.status || ''));
            })
          : interviews.filter((row) => (row.scheduledAt ? new Date(row.scheduledAt).getTime() > start + 24 * 60 * 60 * 1000 : false));
    return {
      title: label,
      href,
      rows: mapInterviewRows(filtered.length ? filtered : interviews),
    };
  }

  if (metricKey === 'joinedPlacements') {
    return { title: label, href, rows: mapPlacementRows(placements) };
  }

  if (metricKey === 'alerts') {
    const alerts = asList(overview?.alerts);
    return {
      title: label,
      href,
      rows: alerts.length
        ? alerts.map((alert) => ({
            Alert: alert.text,
            Severity: alert.severity || 'info',
            Action: alert.action || '—',
          }))
        : mapJobRows(jobs.filter((row) => Boolean(row.slaRisk) || Boolean(row.noCandidates))),
    };
  }

  if (metricKey === 'waitingOnYou') {
    const approvals = asList(overview?.myWork?.approvals);
    return {
      title: label,
      href,
      rows: approvals.length
        ? approvals.map((item) => item as Record<string, unknown>)
        : [{ Waiting: overview?.kpis?.waitingOnYou ?? 0 }],
    };
  }

  if (jobs.length) return { title: label, href, rows: mapJobRows(jobs) };
  if (candidates.length) return { title: label, href, rows: mapCandidateRows(candidates) };
  if (interviews.length) return { title: label, href, rows: mapInterviewRows(interviews) };
  if (placements.length) return { title: label, href, rows: mapPlacementRows(placements) };

  return {
    title: label,
    href,
    rows: [{ Metric: label, Value: overview?.kpis?.[metricKey as keyof typeof overview.kpis] ?? 0 }],
  };
}

export function buildRecPipelineDrillDown(
  overview: RecruitmentOverview | null | undefined,
  stageName: string,
  href?: string,
): DrillDownPayload {
  const stage = normalizeSlice(stageName);
  if (stage === 'interview') {
    return {
      title: `${stageName} stage`,
      href: '/interviews',
      rows: mapInterviewRows(asList(overview?.interviewsTable)),
    };
  }
  if (stage === 'offer') {
    const rows = asList(overview?.placementsTable).filter((row) =>
      /offer|pending/i.test(String(row.status || '')),
    );
    return {
      title: `${stageName} stage`,
      href: '/placement',
      rows: mapPlacementRows(rows.length ? rows : asList(overview?.placementsTable)),
    };
  }
  if (stage === 'joined') {
    return buildRecKpiDrillDown(overview, 'joinedPlacements', `${stageName} stage`, '/placement');
  }
  const candidates = asList(overview?.candidatesTable);
  const rows = candidates.filter((row) => {
    const status = normalizeSlice(row.status);
    if (stage === 'applied') return status === 'new' || status === 'applied';
    return status === stage;
  });
  return {
    title: `${stageName} stage`,
    href: href || '/candidate',
    rows: mapCandidateRows(rows.length ? rows : candidates),
  };
}

export function buildRecOwnershipDrillDown(overview: RecruitmentOverview | null | undefined): DrillDownPayload {
  const jobs = asList(overview?.jobsTable);
  const unassigned = jobs.filter((row) => !row.assignee || /unassigned/i.test(String(row.assignee)));
  return {
    title: 'Unassigned jobs',
    href: '/job',
    rows: mapJobRows(unassigned.length ? unassigned : jobs),
  };
}

export function buildRecFlagDrillDown(
  overview: RecruitmentOverview | null | undefined,
  flag: string,
): DrillDownPayload {
  const name = normalizeSlice(flag);
  const jobs = asList(overview?.jobsTable);
  const candidates = asList(overview?.candidatesTable);
  if (name === 'hot') {
    const rows = jobs.filter((row) => Boolean(row.hot));
    return { title: 'Hot jobs', href: '/job', rows: mapJobRows(rows.length ? rows : jobs) };
  }
  if (name === 'sla') return buildRecKpiDrillDown(overview, 'jobsSlaRisk', 'SLA risk jobs', '/job');
  if (name === 'unassigned') return buildRecOwnershipDrillDown(overview);
  if (name === 'clear') {
    const rows = jobs.filter(
      (row) => !row.hot && !row.slaRisk && row.assignee && !/unassigned/i.test(String(row.assignee)),
    );
    return { title: 'Clear jobs', href: '/job', rows: mapJobRows(rows.length ? rows : jobs) };
  }
  if (name === 'live') {
    const rows = candidates.filter((row) => /new|active/i.test(String(row.status || '')));
    return { title: 'Live candidates', href: '/candidate', rows: mapCandidateRows(rows.length ? rows : candidates) };
  }
  if (name === 'on hold' || name === 'other') {
    const rows = candidates.filter((row) => /inactive|hold|reject|withdraw|archiv/i.test(String(row.status || '')));
    return { title: `${flag} candidates`, href: '/candidate', rows: mapCandidateRows(rows.length ? rows : candidates) };
  }
  if (name === 'done' || name === 'scheduled') {
    return buildRecSliceDrillDown(overview, 'interviews', name === 'done' ? 'completed' : 'scheduled');
  }
  return buildRecSliceDrillDown(overview, 'jobs', flag);
}

export function buildRecSliceDrillDown(
  overview: RecruitmentOverview | null | undefined,
  kind: 'jobs' | 'candidates' | 'interviews' | 'placements' | 'sources' | 'department',
  sliceName: string,
): DrillDownPayload {
  if (kind === 'jobs' || kind === 'department') {
    const jobs = asList(overview?.jobsTable);
    const filtered = filterByLabel(jobs, (row) => (kind === 'department' ? row.department : row.status), sliceName);
    return {
      title: `${sliceName} jobs`,
      href: '/job',
      subtitle: filtered.length ? `${filtered.length} jobs` : jobs.length ? `No exact “${sliceName}” match — showing current jobs` : undefined,
      rows: mapJobRows(filtered.length ? filtered : jobs),
    };
  }
  if (kind === 'candidates' || kind === 'sources') {
    const candidates = asList(overview?.candidatesTable);
    const filtered = filterByLabel(candidates, (row) => (kind === 'sources' ? row.source : row.status), sliceName);
    return {
      title: `${sliceName} candidates`,
      href: '/candidate',
      subtitle: filtered.length ? `${filtered.length} candidates` : candidates.length ? `No exact “${sliceName}” match — showing current candidates` : undefined,
      rows: mapCandidateRows(filtered.length ? filtered : candidates),
    };
  }
  if (kind === 'interviews') {
    const interviews = asList(overview?.interviewsTable);
    const filtered = filterByLabel(interviews, (row) => row.status, sliceName);
    return {
      title: `${sliceName} interviews`,
      href: '/interviews',
      rows: mapInterviewRows(filtered.length ? filtered : interviews),
    };
  }
  const placements = asList(overview?.placementsTable);
  const filtered = filterByLabel(placements, (row) => row.status, sliceName);
  return {
    title: `${sliceName} placements`,
    href: '/placement',
    rows: mapPlacementRows(filtered.length ? filtered : placements),
  };
}
