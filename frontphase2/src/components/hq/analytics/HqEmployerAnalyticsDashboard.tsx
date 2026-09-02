'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
        No entrepreneur analytics loaded yet.
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
            label: 'Monthly billing',
            value: Number(k.monthlyBillingTotal ?? k.mrr ?? 0).toLocaleString(),
          },
          {
            label: 'Annual billing (ARR)',
            value: Number(k.arr ?? 0).toLocaleString(),
          },
          { label: 'Billing tenants', value: k.billingTenants ?? 0 },
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
          title="Recent entrepreneur demos"
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

      <EmployerParametersReference data={data} />
    </div>
  );
}

function PRow({ label, value, description }: { label: string; value: React.ReactNode; description?: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-3 text-sm font-semibold text-slate-800 whitespace-nowrap align-top">{label}</td>
      <td className="py-2 pr-3 text-sm text-slate-900 font-mono align-top">{value ?? '—'}</td>
      {description ? <td className="py-2 text-xs text-slate-500 align-top">{description}</td> : null}
    </tr>
  );
}

function EmployerParametersReference({ data }: { data: HqEmployerAnalytics }) {
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
          <h3 className="text-sm font-bold text-slate-900">Entrepreneur Dashboard — All Parameters (Phase 2)</h3>
          <p className="text-xs text-slate-500">Complete list of all tracked metrics from hiring organizations / tenant workspaces</p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
      </button>
      {open ? (
        <div className="border-t border-slate-100 px-5 py-4 overflow-x-auto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">KPI Metrics — Tenant & Platform</h4>
          <table className="w-full text-left mb-6">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="py-1.5 pr-3">Parameter</th>
                <th className="py-1.5 pr-3">Value</th>
                <th className="py-1.5">Description</th>
              </tr>
            </thead>
            <tbody>
              <PRow label="Total Tenants" value={k.tenants} description="All provisioned Phase 2 workspaces" />
              <PRow label="Agency Tenants" value={k.agency} description="Tenants operating in agency (multi-client) mode" />
              <PRow label="Standalone Tenants" value={k.standalone} description="Tenants operating as standalone companies" />
              <PRow label="Paused Tenants" value={k.paused} description="Tenants whose access is currently paused by HQ" />
              <PRow label="On a Plan" value={k.onPlan} description="Tenants with an active subscription plan" />
              <PRow label="Landing Purchases" value={k.landingPurchases} description="Tenants created via landing page purchase flow" />
              <PRow label="Landing Trials" value={k.landingTrials} description="Tenants created via landing page trial signup" />
            </tbody>
          </table>

          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">KPI Metrics — Jobs & Recruitment</h4>
          <table className="w-full text-left mb-6">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="py-1.5 pr-3">Parameter</th>
                <th className="py-1.5 pr-3">Value</th>
                <th className="py-1.5">Description</th>
              </tr>
            </thead>
            <tbody>
              <PRow label="Open Jobs" value={k.openJobs} description="Currently active job postings across all tenants" />
              <PRow label="Closed Jobs" value={k.closedJobs ?? 0} description="Jobs filled or closed across all tenants" />
              <PRow label="Total Jobs" value={k.jobs} description="All-time job postings across all tenants" />
              <PRow label="Total Candidates" value={k.candidates} description="All candidates across all tenant workspaces" />
              <PRow label="Candidates (7d)" value={k.candidates7d ?? 0} description="New candidates added in the last 7 days" />
              <PRow label="Total Applications" value={k.applications} description="All applications submitted across tenants" />
              <PRow label="Applications (7d)" value={k.applications7d ?? 0} description="Applications submitted in the last 7 days" />
              <PRow label="Total Interviews" value={k.interviews} description="All interviews scheduled/completed across tenants" />
              <PRow label="Interviews Today" value={k.interviewsToday ?? 0} description="Interviews happening today" />
              <PRow label="Interviews Scheduled" value={k.interviewsScheduled ?? 0} description="Interviews awaiting their date" />
              <PRow label="Interviews Completed" value={k.interviewsCompleted ?? 0} description="Interviews that have been conducted" />
              <PRow label="Total Placements" value={k.placements} description="Successful candidate placements across tenants" />
              <PRow label="Placements Joined" value={k.placementsJoined ?? 0} description="Placed candidates who have actually joined" />
              <PRow label="Total Clients" value={k.clients} description="Client companies managed across all tenants" />
              <PRow label="Tenant Leads" value={k.tenantLeads} description="CRM leads within individual tenant workspaces" />
              <PRow label="Open Tasks" value={k.tasksOpen ?? 0} description="Currently open tasks across all tenants" />
            </tbody>
          </table>

          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">KPI Metrics — HQ CRM</h4>
          <table className="w-full text-left mb-6">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="py-1.5 pr-3">Parameter</th>
                <th className="py-1.5 pr-3">Value</th>
                <th className="py-1.5">Description</th>
              </tr>
            </thead>
            <tbody>
              <PRow label="HQ Leads" value={k.hqLeads} description="Leads managed in the HQ CRM pipeline" />
              <PRow label="HQ Lead Conversion" value={`${k.hqLeadConversionRate}%`} description="Lead-to-company conversion rate" />
              <PRow label="Hot Leads" value={k.hotLeads ?? 0} description="High-priority leads requiring immediate attention" />
              <PRow label="Monthly Billing" value={`$${Number(k.monthlyBillingTotal ?? k.mrr ?? 0).toLocaleString()}`} description="Total monthly subscription billing from tenant plan pricing" />
              <PRow label="Annual Billing (ARR)" value={`$${Number(k.arr ?? 0).toLocaleString()}`} description="Monthly billing × 12 across paid tenant plans" />
              <PRow label="Billing Tenants" value={k.billingTenants ?? 0} description="Active tenants with priced subscription plans (excludes trials)" />
              <PRow label="HQ Companies" value={k.hqCompanies} description="Companies created from converted leads" />
              <PRow label="Demos Verified" value={k.demosVerified} description="Landing page demo requests that are verified" />
              <PRow label="Demo Purchases" value={k.demosPurchases} description="Demo requests converted to purchases" />
              <PRow label="Demo Trials" value={k.demosTrials} description="Demo requests converted to trial signups" />
              <PRow label="Follow-ups Today" value={k.followUpsToday} description="CRM follow-ups scheduled for today" />
            </tbody>
          </table>

          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Charts & Visualizations</h4>
          <ul className="space-y-1 text-sm text-slate-700 mb-6">
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Hiring Funnel — Jobs → Apps → Interviews → Placements pipeline</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Tenants by Plan — Distribution across Starter, Professional, Enterprise</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Tenants by Type — Agency vs Standalone split</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Tenants by Signup Source — HQ, landing, manual breakdown</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Leads by Stage — New, Contacted, Demo, Qualified, Converted, Lost</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Leads by Score — Hot, Warm, Cold distribution</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Companies by Status — Active, inactive, pending</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Demos by Kind — Demo vs purchase request types</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Demos by Status — Pending, verified, expired</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Jobs by Status — Open, closed, draft across tenants</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Interviews by Status — Scheduled, completed, cancelled</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Placements by Status — Offered, joined, declined</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Tenant Activity Heatmap — Relative activity per workspace</li>
          </ul>

          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Tables</h4>
          <ul className="space-y-1 text-sm text-slate-700">
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Ranked Tenants — Name, plan, status, jobs, candidates, apps, interviews, placements, activity score</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>HQ CRM Leads — Name, company, stage, score, owner, follow-up, deal value, industry</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>HQ Companies — Name, status, score, industry, country, owner, follow-up</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Recent Demos — Name, company, email, kind, status, submitted date</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Recent Jobs — Title, status, company, location, openings, tenant</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Recent Placements — Candidate, job, company, status, salary, joining date, tenant</li>
            <li className="flex items-start gap-2"><span className="text-slate-400">•</span>Recent Tenant Activity — Tenant, type, plan, open jobs, candidates, apps, interviews, placements, tasks</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
