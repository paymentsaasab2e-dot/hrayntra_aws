'use client';

import React from 'react';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  Mail,
  Phone,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SummaryCard } from '../../../components/ui/SummaryCard';
import type { ReportsSummary } from '../types';
import {
  clientHealthBadge,
  computeProductivityScores,
  EmptyState,
  formatActivityTime,
  formatCurrency,
  formatNumber,
  funnelConversion,
  HorizontalBarChart,
  ReportCard,
  SimpleTable,
  VerticalFunnel,
} from '../reports-utils';

type SectionProps = {
  summary: ReportsSummary;
  onNavigate?: (section: string) => void;
};

export function ExecutiveDashboardSection({ summary }: SectionProps) {
  const kpis = summary.recruitmentPerformance.kpis;
  const revenue = summary.placementsRevenue.kpis.totalRevenue;
  const trend = summary.recruitmentPerformance.trend;
  const funnel = summary.pipelineFunnel.funnel;
  const recruiters = summary.teamPerformance.leaderboard.slice(0, 5);
  const clients = (summary.jobsClients.clientDetails?.length
    ? summary.jobsClients.clientDetails
    : summary.jobsClients.topClients.map((c) => ({ name: c.name, jobs: c.volume, placements: 0, revenue: 0, health: 'slow' as const }))
  ).slice(0, 5);
  const jobs = summary.jobsClients.jobs.slice(0, 5);
  const recentActivities = summary.activityProductivity.recent?.slice(0, 8) ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Open Jobs" count={formatNumber(kpis.totalOpenJobs)} color="blue" icon={<Briefcase size={16} />} />
        <SummaryCard label="Candidates" count={formatNumber(kpis.activeCandidates)} color="purple" icon={<Users size={16} />} />
        <SummaryCard label="Interviews" count={formatNumber(kpis.interviews)} color="orange" icon={<Calendar size={16} />} />
        <SummaryCard label="Placements" count={formatNumber(kpis.placements)} color="green" icon={<CheckCircle2 size={16} />} />
        <SummaryCard label="Revenue" count={formatCurrency(revenue)} color="cyan" icon={<DollarSign size={16} />} />
        <SummaryCard label="Conversion" count={`${kpis.conversionPct}%`} color="rose" icon={<TrendingUp size={16} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReportCard title="Recruitment Trend">
          {trend.length ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="candidates" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Candidates" />
                  <Line type="monotone" dataKey="interviews" stroke="#f97316" strokeWidth={2} dot={false} name="Interviews" />
                  <Line type="monotone" dataKey="placements" stroke="#16a34a" strokeWidth={2} dot={false} name="Placements" />
                  <Line type="monotone" dataKey="openJobs" stroke="#2563eb" strokeWidth={2} dot={false} name="Open Jobs" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text="No trend data for this period." />
          )}
        </ReportCard>
        <ReportCard title="Recruitment Funnel">
          {funnel.length ? <VerticalFunnel stages={funnel} /> : <EmptyState text="No funnel data." />}
        </ReportCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ReportCard title="Top Team Members">
          <SimpleTable
            columns={[
              { key: 'name', label: 'Team Member' },
              { key: 'placements', label: 'Placements', align: 'right' },
            ]}
            rows={recruiters.map((r) => ({ name: r.name, placements: r.placements ?? 0 }))}
          />
        </ReportCard>
        <ReportCard title="Top Clients">
          <SimpleTable
            columns={[
              { key: 'name', label: 'Client' },
              { key: 'jobs', label: 'Jobs', align: 'right' },
              { key: 'placements', label: 'Placements', align: 'right' },
            ]}
            rows={clients.map((c) => ({
              name: c.name,
              jobs: 'jobs' in c ? c.jobs : (c as { volume?: number }).volume ?? 0,
              placements: 'placements' in c ? c.placements : 0,
            }))}
          />
        </ReportCard>
        <ReportCard title="Top Jobs">
          <SimpleTable
            columns={[
              { key: 'title', label: 'Job' },
              { key: 'count', label: 'Candidates', align: 'right' },
            ]}
            rows={jobs.map((j) => ({ title: j.title, count: j.count }))}
          />
        </ReportCard>
      </div>

      {recentActivities.length ? (
        <ReportCard title="Recent Activities">
          <div className="space-y-2">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
                <div>
                  <p className="text-xs font-semibold text-slate-800">{activity.label}</p>
                  {activity.detail ? <p className="text-[11px] text-slate-500">{activity.detail}</p> : null}
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  <div>{formatActivityTime(activity.time)}</div>
                  <div>{activity.performer}</div>
                </div>
              </div>
            ))}
          </div>
        </ReportCard>
      ) : null}
    </div>
  );
}

export function RecruitmentAnalyticsSection({ summary }: SectionProps) {
  const funnel = summary.pipelineFunnel.funnel.map((stage) => {
    if (stage.name === 'Offered') return { ...stage, name: 'Selected' };
    return stage;
  });
  const applied = funnel.find((s) => s.name === 'Applied')?.value ?? 0;
  const interviewed = funnel.find((s) => s.name === 'Interviewed')?.value ?? 0;
  const selected = funnel.find((s) => s.name === 'Selected' || s.name === 'Offered')?.value ?? 0;
  const joined = funnel.find((s) => s.name === 'Joined')?.value ?? 0;
  const sourcePerformance = summary.candidates.sourcePerformance?.slice(0, 10) ?? [];

  return (
    <div className="space-y-5">
      <ReportCard title="Pipeline Funnel">
        {funnel.length ? <VerticalFunnel stages={funnel} /> : <EmptyState text="No pipeline data." />}
      </ReportCard>
      <div className="grid gap-4 sm:grid-cols-3">
        <ReportCard title="Applied → Interviewed">
          <p className="text-3xl font-bold text-indigo-700">{funnelConversion(applied, interviewed)}%</p>
        </ReportCard>
        <ReportCard title="Interviewed → Selected">
          <p className="text-3xl font-bold text-violet-700">{funnelConversion(interviewed, selected)}%</p>
        </ReportCard>
        <ReportCard title="Selected → Joined">
          <p className="text-3xl font-bold text-emerald-700">{funnelConversion(selected, joined)}%</p>
        </ReportCard>
      </div>
      <ReportCard title="Source Performance">
        {sourcePerformance.length ? (
          <SimpleTable
            columns={[
              { key: 'name', label: 'Source' },
              { key: 'candidates', label: 'Candidates', align: 'right' },
              { key: 'placements', label: 'Placements', align: 'right' },
              { key: 'conversionPct', label: 'Conversion %', align: 'right' },
            ]}
            rows={sourcePerformance.map((row) => ({
              name: row.name,
              candidates: row.candidates,
              placements: row.placements,
              conversionPct: `${row.conversionPct}%`,
            }))}
          />
        ) : (
          <EmptyState text="No source data." />
        )}
      </ReportCard>
    </div>
  );
}

export function ClientAnalyticsSection({ summary }: SectionProps) {
  const clients = summary.jobsClients.clientDetails?.length
    ? summary.jobsClients.clientDetails
    : summary.jobsClients.topClients.map((client) => ({
        id: client.name,
        name: client.name,
        jobs: client.volume,
        placements: 0,
        revenue: 0,
        health: 'slow' as const,
      }));

  return (
    <div className="space-y-5">
      <ReportCard title="Top Clients">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-indigo-100/60 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2 text-right">Jobs</th>
                <th className="px-3 py-2 text-right">Placements</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2">Health</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((row) => {
                const badge = clientHealthBadge(row.health);
                return (
                  <tr key={row.id || row.name} className="border-b border-slate-100/80">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{row.name}</td>
                    <td className="px-3 py-2.5 text-right">{row.jobs}</td>
                    <td className="px-3 py-2.5 text-right">{row.placements}</td>
                    <td className="px-3 py-2.5 text-right">{formatCurrency(row.revenue)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ReportCard>
      <ReportCard title="Top Jobs by Client Pipeline">
        <SimpleTable
          columns={[
            { key: 'title', label: 'Job' },
            { key: 'client', label: 'Client' },
            { key: 'count', label: 'Candidates', align: 'right' },
          ]}
          rows={summary.jobsClients.jobs.slice(0, 10).map((j) => ({
            title: j.title,
            client: j.client,
            count: j.count,
          }))}
        />
      </ReportCard>
    </div>
  );
}

export function CandidateAnalyticsSection({ summary }: SectionProps) {
  const sources = summary.candidates.sources;
  const skills = summary.candidates.skills;
  const byLocation = summary.candidates.byLocation ?? [];
  const byRecruiter = summary.candidates.byRecruiter ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title="Candidates by Source">
          {sources.length ? (
            <HorizontalBarChart items={sources} labelKey="name" valueKey="value" />
          ) : (
            <EmptyState text="No source breakdown." />
          )}
        </ReportCard>
        <ReportCard title="Skill Demand">
          {skills.length ? (
            <HorizontalBarChart
              items={skills.map((s) => ({ name: s.skill, value: s.count }))}
              labelKey="name"
              valueKey="value"
            />
          ) : (
            <EmptyState text="No skills data." />
          )}
        </ReportCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title="Candidates by Location">
          {byLocation.length ? (
            <HorizontalBarChart items={byLocation} labelKey="name" valueKey="value" />
          ) : (
            <EmptyState text="No location data." />
          )}
        </ReportCard>
        <ReportCard title="Candidates by Team Member">
          {byRecruiter.length ? (
            <HorizontalBarChart items={byRecruiter} labelKey="name" valueKey="value" />
          ) : (
            <EmptyState text="No team member breakdown." />
          )}
        </ReportCard>
      </div>
    </div>
  );
}

export function InterviewAnalyticsSection({ summary }: SectionProps) {
  const trend = summary.interviews.trend;
  const funnel = summary.interviews.funnel ?? [];
  const scheduled = funnel.find((row) => row.name === 'Scheduled')?.value ?? trend.reduce((sum, row) => sum + (row.scheduled || 0), 0);
  const completed = funnel.find((row) => row.name === 'Completed')?.value ?? trend.reduce((sum, row) => sum + (row.completed || 0), 0);
  const pending = summary.interviews.feedbackPending;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportCard title="Scheduled">
          <p className="text-2xl font-bold text-indigo-700">{formatNumber(scheduled)}</p>
        </ReportCard>
        <ReportCard title="Completed">
          <p className="text-2xl font-bold text-emerald-700">{formatNumber(completed)}</p>
        </ReportCard>
        <ReportCard title="Pending Feedback">
          <p className="text-2xl font-bold text-amber-700">{formatNumber(pending.reduce((s, r) => s + r.pending, 0))}</p>
        </ReportCard>
        <ReportCard title="Completion Rate">
          <p className="text-2xl font-bold text-violet-700">{funnelConversion(scheduled, completed)}%</p>
        </ReportCard>
      </div>
      <ReportCard title="Interview Funnel">
        {funnel.length ? (
          <HorizontalBarChart items={funnel} labelKey="name" valueKey="value" />
        ) : (
          <EmptyState text="No interview funnel data." />
        )}
      </ReportCard>
      <ReportCard title="Interview Trend">
        {trend.length ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="scheduled" fill="#6366f1" name="Scheduled" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState text="No interview trend data." />
        )}
      </ReportCard>
      <ReportCard title="Pending Feedback by Team Member">
        <SimpleTable
          columns={[
            { key: 'name', label: 'Team Member' },
            { key: 'pending', label: 'Pending', align: 'right' },
          ]}
          rows={pending.map((r) => ({ name: r.name, pending: r.pending }))}
        />
      </ReportCard>
    </div>
  );
}

export function PlacementAnalyticsSection({ summary }: SectionProps) {
  const leaderboard = summary.teamPerformance.leaderboard.slice(0, 10);
  const kpis = summary.placementsRevenue.kpis;
  const joiningStatus = summary.placementsRevenue.joiningStatus ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <ReportCard title="Total Placements">
          <p className="text-2xl font-bold text-emerald-700">{formatNumber(kpis.totalPlacements)}</p>
        </ReportCard>
        <ReportCard title="Offers Released">
          <p className="text-2xl font-bold text-indigo-700">{formatNumber(summary.recruitmentPerformance.kpis.offersReleased)}</p>
        </ReportCard>
        <ReportCard title="Conversion">
          <p className="text-2xl font-bold text-violet-700">{summary.recruitmentPerformance.kpis.conversionPct}%</p>
        </ReportCard>
      </div>
      <ReportCard title="Joining Status">
        {joiningStatus.length ? (
          <HorizontalBarChart items={joiningStatus} labelKey="name" valueKey="value" />
        ) : (
          <EmptyState text="No joining status data." />
        )}
      </ReportCard>
      <ReportCard title="Placement Leaderboard">
        <SimpleTable
          columns={[
            { key: 'rank', label: '#', align: 'right' },
            { key: 'name', label: 'Team Member' },
            { key: 'placements', label: 'Placements', align: 'right' },
          ]}
          rows={leaderboard.map((r) => ({
            rank: r.rank ?? '—',
            name: r.name,
            placements: r.placements ?? 0,
          }))}
        />
      </ReportCard>
    </div>
  );
}

export function RevenueAnalyticsSection({ summary }: SectionProps) {
  const kpis = summary.placementsRevenue.kpis;
  const trend = summary.placementsRevenue.trend;
  const byClient = summary.placementsRevenue.byClient ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportCard title="Total Revenue">
          <p className="text-2xl font-bold text-emerald-700">{formatCurrency(kpis.totalRevenue)}</p>
        </ReportCard>
        <ReportCard title="Avg Placement Fee">
          <p className="text-2xl font-bold text-indigo-700">{formatCurrency(kpis.avgBilling)}</p>
        </ReportCard>
        <ReportCard title="Commission Paid">
          <p className="text-2xl font-bold text-violet-700">{formatCurrency(kpis.commissionPaid ?? 0)}</p>
        </ReportCard>
        <ReportCard title="Outstanding">
          <p className="text-2xl font-bold text-amber-700">{formatCurrency(kpis.outstandingPayment ?? 0)}</p>
        </ReportCard>
      </div>
      <ReportCard title="Revenue Trend">
        {trend.length ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={3} dot={false} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState text="No revenue trend data." />
        )}
      </ReportCard>
      <ReportCard title="Revenue by Client">
        <SimpleTable
          columns={[
            { key: 'name', label: 'Client' },
            { key: 'revenue', label: 'Revenue', align: 'right' },
          ]}
          rows={byClient.map((row) => ({
            name: row.name,
            revenue: formatCurrency(row.revenue),
          }))}
        />
      </ReportCard>
    </div>
  );
}

export function TeamAnalyticsSection({ summary }: SectionProps) {
  const scored = computeProductivityScores(summary.teamPerformance.leaderboard);

  return (
    <div className="space-y-5">
      <ReportCard title="Team Member Performance">
        <SimpleTable
          columns={[
            { key: 'rank', label: '#', align: 'right' },
            { key: 'name', label: 'Team Member' },
            { key: 'candidatesAdded', label: 'Candidates', align: 'right' },
            { key: 'interviews', label: 'Interviews', align: 'right' },
            { key: 'placements', label: 'Placements', align: 'right' },
            { key: 'revenue', label: 'Revenue', align: 'right' },
            { key: 'tasksCompleted', label: 'Tasks', align: 'right' },
            { key: 'productivityScore', label: 'Score', align: 'right' },
          ]}
          rows={scored.map((r) => ({
            rank: r.rank ?? '—',
            name: r.name,
            candidatesAdded: r.candidatesAdded ?? r.submissions ?? 0,
            interviews: r.interviews ?? 0,
            placements: r.placements ?? 0,
            revenue: formatCurrency(r.revenue ?? 0),
            tasksCompleted: r.tasksCompleted ?? 0,
            productivityScore: `${(r as { productivityScore: number }).productivityScore}/100`,
          }))}
        />
        <p className="mt-3 text-[10px] text-slate-500">
          Productivity score: 40% placements · 25% interviews · 20% candidates · 15% activity
        </p>
      </ReportCard>
    </div>
  );
}

export function ActivityAnalyticsSection({ summary }: SectionProps) {
  const kpis = summary.activityProductivity.kpis;
  const trend = summary.activityProductivity.trend;
  const recent = summary.activityProductivity.recent ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Calls" count={formatNumber(kpis.callsMade)} color="blue" icon={<Phone size={16} />} />
        <SummaryCard label="Emails" count={formatNumber(kpis.emailsSent)} color="cyan" icon={<Mail size={16} />} />
        <SummaryCard label="Tasks Done" count={formatNumber(kpis.tasksCompleted)} color="green" icon={<CheckCircle2 size={16} />} />
        <SummaryCard label="Notes" count={formatNumber(kpis.notesAdded ?? 0)} color="purple" icon={<FileText size={16} />} />
        <SummaryCard label="Meetings" count={formatNumber(kpis.meetingsConducted ?? 0)} color="indigo" icon={<Calendar size={16} />} />
        <SummaryCard label="Overdue" count={formatNumber(kpis.overdueTasks)} color="rose" icon={<Calendar size={16} />} />
      </div>
      <ReportCard title="Activity Trend">
        {trend.length ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="calls" stroke="#2563eb" strokeWidth={2} dot={false} name="Calls" />
                <Line type="monotone" dataKey="emails" stroke="#06b6d4" strokeWidth={2} dot={false} name="Emails" />
                <Line type="monotone" dataKey="tasks" stroke="#16a34a" strokeWidth={2} dot={false} name="Tasks" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState text="No activity trend data." />
        )}
      </ReportCard>
      {recent.length ? (
        <ReportCard title="Activity Timeline">
          <div className="space-y-2">
            {recent.map((activity) => (
              <div key={activity.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
                <div>
                  <p className="text-xs font-semibold text-slate-800">{activity.label}</p>
                  {activity.detail ? <p className="text-[11px] text-slate-500">{activity.detail}</p> : null}
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  <div>{formatActivityTime(activity.time)}</div>
                  <div>{activity.performer}</div>
                </div>
              </div>
            ))}
          </div>
        </ReportCard>
      ) : null}
    </div>
  );
}
