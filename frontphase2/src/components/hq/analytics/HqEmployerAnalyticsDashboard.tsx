'use client';

import type { HqEmployerAnalytics } from '@/lib/api';
import { HqAnalyticsKpiGrid } from './HqAnalyticsKpiGrid';
import {
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

export function HqEmployerAnalyticsDashboard({
  data,
}: {
  data: HqEmployerAnalytics | null;
}) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No employer analytics loaded yet.
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
          { label: 'Tenants', value: k.tenants, active: true },
          { label: 'Open jobs', value: k.openJobs },
          { label: 'Closed jobs', value: k.closedJobs ?? 0 },
          { label: 'Candidates', value: k.candidates, delta: `${k.candidates7d ?? 0} / 7d` },
          { label: 'Applications', value: k.applications, delta: `${k.applications7d ?? 0} / 7d` },
          { label: 'Interviews', value: k.interviews, delta: `${k.interviewsToday ?? 0} today` },
          { label: 'Scheduled int.', value: k.interviewsScheduled ?? 0 },
          { label: 'Completed int.', value: k.interviewsCompleted ?? 0 },
          { label: 'Placements', value: k.placements },
          { label: 'Joined', value: k.placementsJoined ?? 0 },
          { label: 'Clients', value: k.clients },
          { label: 'Tenant leads', value: k.tenantLeads },
          { label: 'Open tasks', value: k.tasksOpen ?? 0, delta: `${k.tasks ?? 0} total` },
          { label: 'HQ leads', value: k.hqLeads, delta: `${k.hqLeadConversionRate}% conv` },
          { label: 'Hot leads', value: k.hotLeads ?? 0 },
          {
            label: 'Pipeline value',
            value: Number(k.pipelineValue || 0).toLocaleString(),
          },
          { label: 'HQ companies', value: k.hqCompanies },
          { label: 'Follow-ups today', value: k.followUpsToday },
          { label: 'Demos verified', value: k.demosVerified },
          { label: 'Purchases', value: k.demosPurchases },
          { label: 'Trials', value: k.demosTrials },
          { label: 'Agency', value: k.agency },
          { label: 'Standalone', value: k.standalone },
          { label: 'On a plan', value: k.onPlan },
          { label: 'Paused', value: k.paused },
          { label: 'Landing buys', value: k.landingPurchases },
        ]}
      />

      <HqAnalyticsInsights insights={data.insights} />

      <div className="grid gap-4 lg:grid-cols-2">
        <HqAnalyticsBarChart
          title="Hiring funnel"
          subtitle="Live across all Phase 2 tenants"
          data={c.hiringFunnel}
        />
        <HqAnalyticsBarChart
          title="Tenant activity score"
          subtitle="Weighted live activity"
          data={c.tenantActivity}
          horizontal
        />
        <HqAnalyticsPieChart title="Tenants by plan" data={c.tenantsByPlan} />
        <HqAnalyticsPieChart title="Tenants by type" data={c.tenantsByType} />
        <HqAnalyticsPieChart title="Signup source" data={c.tenantsBySignup || []} />
        <HqAnalyticsPieChart title="Jobs by status" data={c.jobsByStatus || []} />
        <HqAnalyticsPieChart title="Interviews by status" data={c.interviewsByStatus || []} />
        <HqAnalyticsPieChart title="Placements by status" data={c.placementsByStatus || []} />
        <HqAnalyticsPieChart title="HQ leads by stage" data={c.leadsByStage} />
        <HqAnalyticsPieChart title="HQ leads by score" data={c.leadsByScore || []} />
        <HqAnalyticsPieChart title="HQ companies by status" data={c.companiesByStatus} />
        <HqAnalyticsPieChart title="Demos by kind" data={c.demosByKind || []} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HqAnalyticsTable
          title="Tenants ranked by live activity"
          columns={[
            { key: 'name', label: 'Tenant' },
            { key: 'type', label: 'Type' },
            { key: 'plan', label: 'Plan' },
            { key: 'openJobs', label: 'Jobs', align: 'right' },
            { key: 'candidates', label: 'Cands', align: 'right' },
            { key: 'apps7d', label: 'Apps7d', align: 'right' },
            { key: 'intToday', label: 'Int.today', align: 'right' },
            { key: 'placements', label: 'Place', align: 'right' },
            { key: 'score', label: 'Score', align: 'right' },
          ]}
          rows={t.rankedTenants.map((row) => ({
            name: (
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{row.name}</div>
                <div className="truncate text-[11px] text-slate-400">
                  {row.error ? (
                    <span className="text-rose-500">{row.error}</span>
                  ) : (
                    row.tenantDbName || row.email || '—'
                  )}
                </div>
              </div>
            ),
            type: row.organizationType,
            plan: row.plan,
            openJobs: row.openJobs,
            candidates: row.candidates,
            apps7d: row.applications7d ?? 0,
            intToday: row.interviewsToday ?? 0,
            placements: row.placements,
            score: row.activityScore ?? 0,
          }))}
        />
        <HqAnalyticsTable
          title="HQ CRM lead pipeline"
          columns={[
            { key: 'name', label: 'Contact' },
            { key: 'company', label: 'Company' },
            { key: 'stage', label: 'Stage' },
            { key: 'score', label: 'Score' },
            { key: 'deal', label: 'Deal', align: 'right' },
            { key: 'follow', label: 'Next FU' },
          ]}
          rows={t.crmLeads.map((row) => ({
            name: (
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{row.name}</div>
                <div className="truncate text-[11px] text-slate-400">{row.owner || '—'}</div>
              </div>
            ),
            company: row.company,
            stage: row.stage,
            score: row.score,
            deal: Number(row.estimatedDealValue || 0).toLocaleString(),
            follow: row.nextFollowUp || '—',
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HqAnalyticsTable
          title="Recent jobs across tenants"
          columns={[
            { key: 'title', label: 'Job' },
            { key: 'tenant', label: 'Tenant' },
            { key: 'company', label: 'Company' },
            { key: 'status', label: 'Status' },
            { key: 'openings', label: 'Openings', align: 'right' },
            { key: 'updated', label: 'Updated', align: 'right' },
          ]}
          rows={(t.recentJobs || []).map((row) => ({
            title: <span className="font-semibold text-slate-900">{row.title}</span>,
            tenant: row.tenant,
            company: row.company,
            status: row.status,
            openings: row.openings,
            updated: formatWhen(row.updatedAt),
          }))}
        />
        <HqAnalyticsTable
          title="Recent placements"
          columns={[
            { key: 'candidate', label: 'Candidate' },
            { key: 'job', label: 'Job' },
            { key: 'company', label: 'Company' },
            { key: 'tenant', label: 'Tenant' },
            { key: 'status', label: 'Status' },
            { key: 'updated', label: 'Updated', align: 'right' },
          ]}
          rows={(t.recentPlacements || []).map((row) => ({
            candidate: <span className="font-semibold text-slate-900">{row.candidate}</span>,
            job: row.job,
            company: row.company,
            tenant: row.tenant,
            status: row.status,
            updated: formatWhen(row.updatedAt),
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HqAnalyticsTable
          title="HQ companies"
          columns={[
            { key: 'name', label: 'Company' },
            { key: 'status', label: 'Status' },
            { key: 'score', label: 'Score' },
            { key: 'industry', label: 'Industry' },
            { key: 'owner', label: 'Owner' },
            { key: 'follow', label: 'Next FU' },
          ]}
          rows={(t.crmCompanies || []).map((row) => ({
            name: <span className="font-semibold text-slate-900">{row.name}</span>,
            status: row.status,
            score: row.score,
            industry: row.industry,
            owner: row.owner,
            follow: row.nextFollowUp,
          }))}
        />
        <HqAnalyticsTable
          title="Recent employer demos"
          columns={[
            { key: 'name', label: 'Contact' },
            { key: 'company', label: 'Company' },
            { key: 'kind', label: 'Kind' },
            { key: 'status', label: 'Status' },
            { key: 'submitted', label: 'Submitted', align: 'right' },
          ]}
          rows={(t.recentDemos || []).map((row) => ({
            name: (
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{row.name}</div>
                <div className="truncate text-[11px] text-slate-400">{row.email || '—'}</div>
              </div>
            ),
            company: row.company,
            kind: row.requestKind,
            status: row.status,
            submitted: formatWhen(row.submittedAt),
          }))}
        />
      </div>

      <HqAnalyticsTable
        title="Tenant hiring snapshot"
        columns={[
          { key: 'tenant', label: 'Tenant' },
          { key: 'type', label: 'Type' },
          { key: 'plan', label: 'Plan' },
          { key: 'openJobs', label: 'Open jobs', align: 'right' },
          { key: 'candidates', label: 'Candidates', align: 'right' },
          { key: 'apps7d', label: 'Apps 7d', align: 'right' },
          { key: 'intToday', label: 'Int. today', align: 'right' },
          { key: 'joined', label: 'Joined', align: 'right' },
          { key: 'tasks', label: 'Open tasks', align: 'right' },
        ]}
        rows={t.recentTenantActivity.map((row) => ({
          tenant: <span className="font-semibold text-slate-900">{row.tenant}</span>,
          type: row.organizationType,
          plan: row.plan,
          openJobs: row.openJobs,
          candidates: row.candidates,
          apps7d: row.applications7d ?? 0,
          intToday: row.interviewsToday ?? 0,
          joined: row.placementsJoined ?? 0,
          tasks: row.tasksOpen ?? 0,
        }))}
      />
    </div>
  );
}
