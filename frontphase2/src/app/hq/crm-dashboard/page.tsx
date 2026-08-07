'use client';

/**
 * HQ CRM Dashboard — aggregates HQ DB only (leads + clients/companies + team).
 * KPI row always visible; category tabs switch chart/list panels (same pattern as Employers).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Loader2, RefreshCw } from 'lucide-react';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import { HqSecondaryButton, HqStatCard } from '@/components/hq/hqUi';
import { HqDashCategoryTabs } from '@/components/hq/analytics/HqDashCategoryTabs';
import {
  apiHqListCompanies,
  apiHqListLeads,
  apiHqListTeam,
  type HqCompanyApiRow,
  type HqLeadApiRow,
  type HqTeamMemberRow,
} from '@/lib/api';
import { HQ_LEAD_STAGE_LABELS, type HqLeadStage } from '@/app/hq/leads/hqLeadsData';

const CRM_CATEGORY_TABS = [
  {
    id: 'funnel',
    label: 'Funnel & pipeline',
    blurb: 'Leads by stage with conversion %, pipeline $, and quick links',
  },
  {
    id: 'velocity',
    label: 'Velocity & risk',
    blurb: 'Follow-ups due, overdue and stale leads, owner coverage',
  },
  {
    id: 'coverage',
    label: 'Coverage & lists',
    blurb: 'Team load, recent HQ leads and clients',
  },
] as const;

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function money(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n).toLocaleString()}`;
  return `$${Math.round(n)}`;
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_18px_48px_-24px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function PanelTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-indigo-500 to-teal-400" />
        <h3 className="truncate text-[13px] font-semibold tracking-tight text-slate-800">{title}</h3>
      </div>
      {right}
    </div>
  );
}

export default function HqCrmDashboardPage() {
  const [leads, setLeads] = useState<HqLeadApiRow[]>([]);
  const [companies, setCompanies] = useState<HqCompanyApiRow[]>([]);
  const [members, setMembers] = useState<HqTeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof CRM_CATEGORY_TABS)[number]['id']>('funnel');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes, companiesRes, teamRes] = await Promise.all([
        apiHqListLeads(),
        apiHqListCompanies(),
        apiHqListTeam(),
      ]);
      setLeads(leadsRes.data?.leads ?? []);
      setCompanies(companiesRes.data?.companies ?? []);
      setMembers(teamRes.data?.members ?? []);
      setGeneratedAt(new Date().toISOString());
    } catch (err: any) {
      setError(err?.message || 'Failed to load HQ CRM dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const stages = Object.keys(HQ_LEAD_STAGE_LABELS) as HqLeadStage[];
    const byStage: Record<string, number> = {};
    const valueByStage: Record<string, number> = {};
    for (const stage of stages) {
      const rows = leads.filter((l) => l.stage === stage);
      byStage[stage] = rows.length;
      valueByStage[stage] = rows.reduce((s, l) => s + Number(l.estimatedDealValue || 0), 0);
    }

    const hot = leads.filter((l) => l.score === 'Hot').length;
    const pipeline = leads.reduce((sum, l) => sum + Number(l.estimatedDealValue || 0), 0);
    const today = startOfDay();
    const followUpsToday = leads.filter((l) => {
      if (!l.nextFollowUpAt) return false;
      const d = startOfDay(new Date(l.nextFollowUpAt));
      return d.getTime() === today.getTime();
    }).length;

    const overdue = leads.filter((l) => {
      if (!l.nextFollowUpAt) return false;
      const stage = String(l.stage || '');
      if (stage === 'converted' || stage === 'lost') return false;
      return new Date(l.nextFollowUpAt).getTime() < today.getTime();
    });

    const unassigned = leads.filter((l) => {
      const stage = String(l.stage || '');
      if (stage === 'converted' || stage === 'lost') return false;
      return !String(l.owner || '').trim();
    });

    const converted = byStage.converted || 0;
    const lost = byStage.lost || 0;
    const closed = converted + lost;
    const winRate = closed ? Math.round((converted / closed) * 1000) / 10 : 0;

    const stageRows = stages.map((stage, i) => {
      const prev = i > 0 ? byStage[stages[i - 1]] || 0 : 0;
      const value = byStage[stage] || 0;
      const convPct = i === 0 || !prev ? null : Math.round((value / prev) * 1000) / 10;
      return {
        stage,
        label: HQ_LEAD_STAGE_LABELS[stage],
        count: value,
        dollars: valueByStage[stage] || 0,
        convPct,
      };
    });

    const activeMembers = members.filter((m) => m.status === 'active');
    const leadsPerOwner = activeMembers.map((m) => {
      const name = m.name || m.email || 'Member';
      const owned = leads.filter((l) => {
        const owner = String(l.owner || '').toLowerCase();
        return (
          owner === String(m.name || '').toLowerCase() ||
          owner === String(m.email || '').toLowerCase() ||
          (m.name ? owner.includes(String(m.name).toLowerCase()) : false)
        );
      }).length;
      return { name, owned };
    });

    const stale = leads.filter((l) => {
      const stage = String(l.stage || '');
      if (stage === 'converted' || stage === 'lost') return false;
      const ref = l.createdAt;
      if (!ref) return false;
      return daysBetween(new Date(), new Date(ref)) >= 14;
    });

    return {
      byStage,
      hot,
      pipeline,
      followUpsToday,
      total: leads.length,
      overdue,
      stale,
      unassigned,
      winRate,
      converted,
      stageRows,
      maxStage: Math.max(...stageRows.map((s) => s.count), 1),
      leadsPerOwner,
      companyActive: companies.filter((c) => c.status === 'active').length,
      companyTotal: companies.length,
      teamActive: activeMembers.length,
      teamTotal: members.length,
    };
  }, [leads, companies, members]);

  const recentLeads = useMemo(() => leads.slice(0, 8), [leads]);
  const recentClients = useMemo(() => companies.slice(0, 8), [companies]);

  return (
    <HqModulePageLayout
      title="Dashboard"
      subtitle="HQ CRM overview — leads and clients from the headquarters database."
      icon={<LayoutDashboard className="h-5 w-5" />}
      locked={false}
      actions={
        <HqSecondaryButton onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </HqSecondaryButton>
      }
    >
      {generatedAt ? (
        <p className="mb-4 shrink-0 text-[11px] text-slate-400">
          Last updated {new Date(generatedAt).toLocaleString()}
        </p>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {/* KPIs always — no category tab */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <HqStatCard label="HQ Leads" value={stats.total} active />
        <HqStatCard label="Hot leads" value={stats.hot} />
        <HqStatCard label="Follow-ups today" value={stats.followUpsToday} />
        <HqStatCard label="Pipeline value" value={money(stats.pipeline)} />
        <HqStatCard
          label="Clients"
          value={stats.companyTotal}
          delta={`${stats.companyActive} active`}
        />
        <HqStatCard label="Win rate" value={`${stats.winRate}%`} delta={`${stats.converted} won`} />
      </section>

      <HqDashCategoryTabs
        tabs={[...CRM_CATEGORY_TABS]}
        value={category}
        onChange={(id) => setCategory(id as typeof category)}
      />

      {category === 'funnel' ? (
        <section className="mb-2 grid grid-cols-12 items-start gap-4">
          <Panel className="col-span-12 lg:col-span-8">
            <PanelTitle
              title="Leads by stage"
              right={
                <Link href="/hq/leads" className="text-[11px] font-semibold text-indigo-600 hover:underline">
                  Open leads →
                </Link>
              }
            />
            <div className="space-y-2.5">
              {stats.stageRows.map((row) => (
                <div key={row.stage}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                    <span className="font-semibold text-slate-700">{row.label}</span>
                    <span className="text-slate-500">
                      <strong className="text-slate-900">{row.count}</strong>
                      {row.dollars > 0 ? ` · ${money(row.dollars)}` : ''}
                      {row.convPct != null ? ` · ${row.convPct}% of prior` : ''}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-400"
                      style={{ width: `${Math.max(6, (row.count / stats.maxStage) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="col-span-12 lg:col-span-4">
            <PanelTitle title="Quick links" />
            <div className="grid gap-2">
              {[
                { href: '/hq/leads', label: 'Leads inbox', hint: `${stats.total} total` },
                { href: '/hq/clients', label: 'Clients', hint: `${stats.companyActive} active` },
                { href: '/hq/team', label: 'Team', hint: `${stats.teamActive} active` },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 transition hover:border-indigo-200 hover:bg-white hover:shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{item.hint}</p>
                </Link>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pipeline</p>
              <p className="mt-1 text-xl font-bold text-indigo-700">{money(stats.pipeline)}</p>
              <p className="mt-1 text-[11px] text-slate-500">Win rate {stats.winRate}% on closed deals</p>
            </div>
          </Panel>
        </section>
      ) : null}

      {category === 'velocity' ? (
        <section className="mb-2 grid grid-cols-12 items-start gap-4">
          <Panel className="col-span-12 md:col-span-4">
            <PanelTitle title="Follow-ups & overdue" />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Due today</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{stats.followUpsToday}</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-3 py-3 text-center ring-1 ring-amber-100">
                <p className="text-[10px] font-semibold uppercase text-amber-700/80">Overdue</p>
                <p className="mt-1 text-2xl font-bold text-amber-800">{stats.overdue.length}</p>
              </div>
            </div>
            <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto">
              {stats.overdue.length ? (
                stats.overdue.slice(0, 8).map((l) => (
                  <div key={l.id} className="rounded-lg border border-amber-50 bg-amber-50/40 px-2.5 py-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{l.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {l.company || '—'} · {HQ_LEAD_STAGE_LABELS[l.stage as HqLeadStage] || l.stage}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">No overdue follow-ups</p>
              )}
            </div>
          </Panel>

          <Panel className="col-span-12 md:col-span-4">
            <PanelTitle title="Stale / aging (14d+)" />
            <p className="mb-2 text-[11px] text-slate-500">
              Open leads with no update in 14+ days · {stats.stale.length} flagged
            </p>
            <div className="max-h-[280px] space-y-2 overflow-y-auto">
              {stats.stale.length ? (
                stats.stale.slice(0, 10).map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-2 border-b border-slate-50 py-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{l.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {HQ_LEAD_STAGE_LABELS[l.stage as HqLeadStage] || l.stage}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {daysBetween(new Date(), new Date(l.createdAt || Date.now()))}d
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">No stale leads</p>
              )}
            </div>
          </Panel>

          <Panel className="col-span-12 md:col-span-4">
            <PanelTitle title="Owner coverage" />
            <div className="mb-3 rounded-xl bg-slate-50 px-3 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Unassigned open</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.unassigned.length}</p>
            </div>
            <div className="space-y-2">
              {stats.leadsPerOwner.length ? (
                stats.leadsPerOwner.slice(0, 6).map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-[12px]">
                    <span className="truncate text-slate-600">{row.name}</span>
                    <span className="font-semibold text-slate-900">{row.owned}</span>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">No active team members</p>
              )}
            </div>
          </Panel>
        </section>
      ) : null}

      {category === 'coverage' ? (
        <section className="mb-2 grid grid-cols-12 items-start gap-4">
          <Panel className="col-span-12 sm:col-span-4 lg:col-span-3">
            <PanelTitle title="Team coverage" />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Team</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{stats.teamTotal}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Active</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{stats.teamActive}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Avg leads / active AE:{' '}
              <strong className="text-slate-800">
                {stats.teamActive
                  ? Math.round((stats.total / stats.teamActive) * 10) / 10
                  : '—'}
              </strong>
            </p>
          </Panel>

          <Panel className="col-span-12 overflow-hidden !p-0 sm:col-span-8 lg:col-span-5">
            <div className="border-b border-slate-100 px-4 py-3">
              <PanelTitle title="Recent HQ leads" />
            </div>
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50/95 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Name</th>
                    <th className="px-2 py-2 font-semibold">Company</th>
                    <th className="px-4 py-2 font-semibold">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && recentLeads.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  ) : recentLeads.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        No HQ leads yet.
                      </td>
                    </tr>
                  ) : (
                    recentLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{lead.name}</td>
                        <td className="px-2 py-2.5 text-slate-600">{lead.company}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {HQ_LEAD_STAGE_LABELS[lead.stage as HqLeadStage] || lead.stage}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel className="col-span-12 overflow-hidden !p-0 lg:col-span-4">
            <div className="border-b border-slate-100 px-4 py-3">
              <PanelTitle title="Recent HQ clients" />
            </div>
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50/95 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Company</th>
                    <th className="px-2 py-2 font-semibold">Contact</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && recentClients.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  ) : recentClients.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        No HQ clients yet.
                      </td>
                    </tr>
                  ) : (
                    recentClients.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{row.name}</td>
                        <td className="px-2 py-2.5 text-slate-600">{row.contact}</td>
                        <td className="px-4 py-2.5 capitalize text-slate-600">
                          {String(row.status || '').replace('_', ' ')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
      ) : null}
    </HqModulePageLayout>
  );
}
