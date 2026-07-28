'use client';

import type { HqEmployeeAnalytics } from '@/lib/api';
import { HqAnalyticsKpiGrid } from './HqAnalyticsKpiGrid';
import {
  HqAnalyticsAreaChart,
  HqAnalyticsBarChart,
  HqAnalyticsPieChart,
} from './HqAnalyticsCharts';
import { HqAnalyticsTable } from './HqAnalyticsTable';
import { HqAnalyticsInsights } from './HqAnalyticsInsights';

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function HqEmployeeAnalyticsDashboard({
  data,
}: {
  data: HqEmployeeAnalytics | null;
}) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No employee analytics loaded yet.
      </div>
    );
  }

  const k = data.kpis;
  const c = data.charts;
  const t = data.tables;

  return (
    <div className="space-y-6">
      <HqAnalyticsKpiGrid
        items={[
          { label: 'Candidates', value: k.totalCandidates, active: true },
          { label: 'New today', value: k.new1d ?? 0, delta: `${k.new7d} / 7d` },
          { label: 'New (30d)', value: k.new30d },
          { label: 'Applications', value: k.applications, delta: `${k.applicationsToday ?? 0} today` },
          { label: 'Active apps', value: k.activeApplications },
          { label: 'Apps (7d)', value: k.applications7d ?? 0 },
          { label: 'Selected', value: k.selectedApplications ?? 0 },
          { label: 'Rejected', value: k.rejectedApplications ?? 0 },
          { label: 'Avg match', value: k.avgMatchScore == null ? '—' : k.avgMatchScore },
          { label: 'Avg CV score', value: k.avgCvScore == null ? '—' : k.avgCvScore },
          { label: 'Avg ATS', value: k.avgAtsScore == null ? '—' : k.avgAtsScore },
          { label: 'Open jobs', value: k.openJobs },
          { label: 'Portal jobs', value: k.portalJobs },
          { label: 'Saved jobs', value: k.savedJobs ?? 0 },
          { label: 'Interview reqs', value: k.interviewRequests ?? 0, delta: `${k.interviewPending ?? 0} open` },
          { label: 'CV analyses', value: k.cvAnalyses ?? 0 },
          { label: 'LMS enrollments', value: k.lmsEnrollments ?? 0 },
          { label: 'AI matches', value: k.aiMatches ?? 0 },
          { label: 'Common pool', value: k.commonCandidates },
          { label: 'Profile w/ skills', value: `${k.profileCompleteness ?? 0}%` },
        ]}
      />

      <HqAnalyticsInsights insights={data.insights} />

      <div className="grid gap-4 lg:grid-cols-2">
        <HqAnalyticsBarChart
          title="Application funnel"
          subtitle="Live Phase 1 status pipeline"
          data={c.applicationsByStatus}
        />
        <HqAnalyticsAreaChart
          title="Applications (14 days)"
          subtitle="Daily live trend"
          data={c.applicationsDaily || []}
          color="#0284c7"
        />
        <HqAnalyticsAreaChart
          title="Candidates (14 days)"
          subtitle="Daily live signups"
          data={c.candidatesDaily || []}
          color="#0f172a"
        />
        <HqAnalyticsAreaChart
          title="Candidates over time"
          subtitle="Last 6 months"
          data={c.candidatesOverTime}
          color="#059669"
        />
        <HqAnalyticsPieChart title="Candidates by status" data={c.candidatesByStatus} />
        <HqAnalyticsPieChart title="Candidates by source" data={c.candidatesBySource} />
        <HqAnalyticsBarChart title="Top locations" data={c.topLocations} horizontal />
        <HqAnalyticsBarChart title="Top skills" data={c.topSkills} horizontal />
        <HqAnalyticsPieChart title="Experience bands" data={c.experienceBands || []} />
        <HqAnalyticsPieChart title="Jobs by status" data={c.jobsByStatus || []} />
        <HqAnalyticsBarChart title="Match score distribution" data={c.matchScoreBuckets || []} />
        <HqAnalyticsPieChart
          title="Interview requests by status"
          data={c.interviewRequestsByStatus || []}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HqAnalyticsTable
          title="Recent candidates"
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'status', label: 'Status' },
            { key: 'source', label: 'Source' },
            { key: 'skills', label: 'Skills' },
            { key: 'location', label: 'Location' },
            { key: 'updated', label: 'Updated', align: 'right' },
          ]}
          rows={t.recentCandidates.map((row) => ({
            name: (
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{row.name}</div>
                <div className="truncate text-[11px] text-slate-400">{row.email || '—'}</div>
              </div>
            ),
            status: row.status,
            source: row.source,
            skills: row.skills || '—',
            location: row.location,
            updated: formatWhen(row.updatedAt),
          }))}
        />
        <HqAnalyticsTable
          title="Recent applications"
          columns={[
            { key: 'candidate', label: 'Candidate' },
            { key: 'job', label: 'Job' },
            { key: 'status', label: 'Status' },
            { key: 'score', label: 'Score', align: 'right' },
            { key: 'applied', label: 'Applied', align: 'right' },
          ]}
          rows={t.recentApplications.map((row) => ({
            candidate: (
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{row.candidate}</div>
                <div className="truncate text-[11px] text-slate-400">{row.email || '—'}</div>
              </div>
            ),
            job: row.job,
            status: row.status,
            score: row.matchScore == null ? '—' : row.matchScore,
            applied: formatWhen(row.appliedAt),
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HqAnalyticsTable
          title="Top jobs by applications"
          columns={[
            { key: 'title', label: 'Job' },
            { key: 'status', label: 'Status' },
            { key: 'location', label: 'Location' },
            { key: 'openings', label: 'Openings', align: 'right' },
            { key: 'applications', label: 'Apps', align: 'right' },
          ]}
          rows={t.topJobsByApplications.map((row) => ({
            title: <span className="font-semibold text-slate-900">{row.title}</span>,
            status: row.status,
            location: row.location,
            openings: row.openings ?? '—',
            applications: row.applications,
          }))}
        />
        <HqAnalyticsTable
          title="Open portal jobs"
          columns={[
            { key: 'title', label: 'Job' },
            { key: 'location', label: 'Location' },
            { key: 'mode', label: 'Mode' },
            { key: 'openings', label: 'Openings', align: 'right' },
            { key: 'posted', label: 'Posted', align: 'right' },
          ]}
          rows={(t.recentOpenJobs || []).map((row) => ({
            title: <span className="font-semibold text-slate-900">{row.title}</span>,
            location: row.location,
            mode: row.workMode,
            openings: row.openings,
            posted: formatWhen(row.postedDate),
          }))}
        />
      </div>

      <HqAnalyticsTable
        title="Recent interview requests"
        columns={[
          { key: 'role', label: 'Role / category' },
          { key: 'status', label: 'Status' },
          { key: 'difficulty', label: 'Difficulty' },
          { key: 'score', label: 'Match', align: 'right' },
          { key: 'preferred', label: 'Preferred', align: 'right' },
          { key: 'created', label: 'Created', align: 'right' },
        ]}
        rows={(t.recentInterviewRequests || []).map((row) => ({
          role: <span className="font-semibold text-slate-900">{row.role}</span>,
          status: row.status,
          difficulty: row.difficulty,
          score: row.matchingScore == null ? '—' : row.matchingScore,
          preferred: formatWhen(row.preferredDate),
          created: formatWhen(row.createdAt),
        }))}
      />
    </div>
  );
}
