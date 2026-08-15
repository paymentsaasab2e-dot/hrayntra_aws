'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
    <div className="dash-ui space-y-6">
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

      <EmployeeParametersReference data={data} />
    </div>
  );
}

function ParamRow({ label, value, description }: { label: string; value: React.ReactNode; description?: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-3 text-sm font-semibold text-slate-800 whitespace-nowrap align-top">{label}</td>
      <td className="py-2 pr-3 text-sm text-slate-900 font-mono align-top">{value ?? '—'}</td>
      {description ? <td className="py-2 text-xs text-slate-500 align-top">{description}</td> : null}
    </tr>
  );
}

function EmployeeParametersReference({ data }: { data: HqEmployeeAnalytics }) {
  const [open, setOpen] = useState(false);
  const k = data.kpis;
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition"
      >
        <div>
          <h3 className="text-sm font-bold text-slate-900">Employee Dashboard — All Parameters (Phase 1)</h3>
          <p className="text-xs text-slate-500">Complete list of all tracked metrics from the job-seeker / candidate portal</p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
      </button>
      {open ? (
        <div className="border-t border-slate-100 px-5 py-4 overflow-x-auto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">KPI Metrics</h4>
          <table className="w-full text-left mb-6">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="py-1.5 pr-3">Parameter</th>
                <th className="py-1.5 pr-3">Value</th>
                <th className="py-1.5">Description</th>
              </tr>
            </thead>
            <tbody>
              <ParamRow label="Total Candidates" value={k.totalCandidates} description="All registered candidates in the Phase 1 portal" />
              <ParamRow label="Common Pool" value={k.commonCandidates} description="Candidates available in the shared/common talent pool" />
              <ParamRow label="New Today (1d)" value={k.new1d ?? 0} description="Candidates registered in the last 24 hours" />
              <ParamRow label="New (7d)" value={k.new7d} description="Candidates registered in the last 7 days" />
              <ParamRow label="New (30d)" value={k.new30d} description="Candidates registered in the last 30 days" />
              <ParamRow label="Portal Jobs" value={k.portalJobs} description="Total jobs visible on the public job portal" />
              <ParamRow label="Open Jobs" value={k.openJobs} description="Currently active/open job postings" />
              <ParamRow label="Closed Jobs" value={k.closedJobs ?? 0} description="Jobs that have been filled or closed" />
              <ParamRow label="Total Applications" value={k.applications} description="All job applications submitted by candidates" />
              <ParamRow label="Active Applications" value={k.activeApplications} description="Applications currently in progress (not rejected/withdrawn)" />
              <ParamRow label="Applications Today" value={k.applicationsToday ?? 0} description="Applications submitted today" />
              <ParamRow label="Applications (7d)" value={k.applications7d ?? 0} description="Applications submitted in the last 7 days" />
              <ParamRow label="Applications (30d)" value={k.applications30d ?? 0} description="Applications submitted in the last 30 days" />
              <ParamRow label="Selected Applications" value={k.selectedApplications ?? 0} description="Applications that were shortlisted/selected" />
              <ParamRow label="Rejected Applications" value={k.rejectedApplications ?? 0} description="Applications that were rejected" />
              <ParamRow label="Avg Match Score" value={k.avgMatchScore == null ? '—' : k.avgMatchScore} description="Average AI-computed match score across all applications" />
              <ParamRow label="Avg CV Score" value={k.avgCvScore == null ? '—' : k.avgCvScore} description="Average CV/resume quality score from AI analysis" />
              <ParamRow label="Avg ATS Score" value={k.avgAtsScore == null ? '—' : k.avgAtsScore} description="Average ATS compatibility score" />
              <ParamRow label="Saved Jobs" value={k.savedJobs ?? 0} description="Jobs bookmarked/saved by candidates" />
              <ParamRow label="Interview Requests" value={k.interviewRequests ?? 0} description="Total interview requests submitted" />
              <ParamRow label="Interview Pending" value={k.interviewPending ?? 0} description="Interview requests awaiting scheduling" />
              <ParamRow label="Interview Completed" value={k.interviewCompleted ?? 0} description="Interviews that have been completed" />
              <ParamRow label="CV Analyses" value={k.cvAnalyses ?? 0} description="Number of CVs analyzed by the AI engine" />
              <ParamRow label="LMS Enrollments" value={k.lmsEnrollments ?? 0} description="Learning Management System course enrollments" />
              <ParamRow label="AI Matches" value={k.aiMatches ?? 0} description="AI-generated candidate-job matches" />
              <ParamRow label="Profile Completeness" value={`${k.profileCompleteness ?? 0}%`} description="Average percentage of candidate profiles with skills filled" />
            </tbody>
          </table>

          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Charts & Visualizations</h4>
          <ul className="space-y-1 text-sm text-slate-700 mb-6">
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Application Funnel — Status pipeline breakdown</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Applications (14 days) — Daily application trend</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Candidates (14 days) — Daily signup trend</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Candidates Over Time — 6-month growth</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Candidates by Status — Active, inactive, blocked</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Candidates by Source — Referral, organic, social, etc.</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Top Locations — Most popular candidate cities</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Top Skills — Most common candidate skills</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Experience Bands — Junior, mid, senior distribution</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Jobs by Status — Open, closed, draft breakdown</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Match Score Distribution — AI score buckets</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Interview Requests by Status — Pending, completed, cancelled</li>
          </ul>

          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Tables</h4>
          <ul className="space-y-1 text-sm text-slate-700">
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Recent Candidates — Name, email, status, source, location, skills, experience</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Recent Applications — Candidate, job, status, match score, applied date</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Top Jobs by Applications — Job title, status, location, openings, app count</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Open Portal Jobs — Title, location, work mode, openings, posted date</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Recent Interview Requests — Role, status, difficulty, match score, dates</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
