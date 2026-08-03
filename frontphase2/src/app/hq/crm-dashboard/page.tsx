'use client';

/**
 * HQ CRM Dashboard — aggregates HQ DB only (leads + clients/companies + team).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Loader2, RefreshCw } from 'lucide-react';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import { HqSecondaryButton, HqStatCard } from '@/components/hq/hqUi';
import {
  apiHqListCompanies,
  apiHqListLeads,
  apiHqListTeam,
  type HqCompanyApiRow,
  type HqLeadApiRow,
  type HqTeamMemberRow,
} from '@/lib/api';
import { HQ_LEAD_STAGE_LABELS, type HqLeadStage } from '@/app/hq/leads/hqLeadsData';

export default function HqCrmDashboardPage() {
  const [leads, setLeads] = useState<HqLeadApiRow[]>([]);
  const [companies, setCompanies] = useState<HqCompanyApiRow[]>([]);
  const [members, setMembers] = useState<HqTeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

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

  const leadStats = useMemo(() => {
    const byStage: Record<string, number> = {};
    for (const stage of Object.keys(HQ_LEAD_STAGE_LABELS) as HqLeadStage[]) {
      byStage[stage] = leads.filter((l) => l.stage === stage).length;
    }
    const hot = leads.filter((l) => l.score === 'Hot').length;
    const pipeline = leads.reduce((sum, l) => sum + Number(l.estimatedDealValue || 0), 0);
    const followUpsToday = leads.filter((l) => {
      if (!l.nextFollowUpAt) return false;
      const d = new Date(l.nextFollowUpAt);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }).length;
    return { byStage, hot, pipeline, followUpsToday, total: leads.length };
  }, [leads]);

  const companyStats = useMemo(() => {
    const active = companies.filter((c) => c.status === 'active').length;
    return { total: companies.length, active };
  }, [companies]);

  const teamStats = useMemo(() => {
    const active = members.filter((m) => m.status === 'active').length;
    return { total: members.length, active };
  }, [members]);

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

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <HqStatCard label="HQ Leads" value={leadStats.total} active />
          <HqStatCard label="Hot leads" value={leadStats.hot} />
          <HqStatCard label="Follow-ups today" value={leadStats.followUpsToday} />
          <HqStatCard label="Pipeline value" value={leadStats.pipeline.toLocaleString()} />
          <HqStatCard label="Clients" value={companyStats.total} delta={`${companyStats.active} active`} />
          <HqStatCard label="Team" value={teamStats.total} delta={`${teamStats.active} active`} />
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-2">
          <div className="hq-surface p-5">
            <h2 className="hq-display text-sm font-semibold text-slate-900">Leads by stage</h2>
            <ul className="mt-4 space-y-2">
              {(Object.keys(HQ_LEAD_STAGE_LABELS) as HqLeadStage[]).map((stage) => (
                <li key={stage} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{HQ_LEAD_STAGE_LABELS[stage]}</span>
                  <span className="font-semibold text-slate-900">{leadStats.byStage[stage] || 0}</span>
                </li>
              ))}
            </ul>
            <Link href="/hq/leads" className="mt-4 inline-block text-sm font-semibold text-teal-700 hover:underline">
              Open leads →
            </Link>
          </div>

          <div className="hq-surface p-5">
            <h2 className="hq-display text-sm font-semibold text-slate-900">Quick links</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { href: '/hq/leads', label: 'Leads' },
                { href: '/hq/clients', label: 'Clients' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white hover:shadow-sm"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="hq-table-wrap">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
              Recent HQ leads
            </div>
            <div className="hq-table-scroll">
              <table className="min-w-full text-left">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Stage</th>
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
                      <tr key={lead.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{lead.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{lead.company}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {HQ_LEAD_STAGE_LABELS[lead.stage as HqLeadStage] || lead.stage}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="hq-table-wrap">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
              Recent HQ clients
            </div>
            <div className="hq-table-scroll">
              <table className="min-w-full text-left">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Status</th>
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
                      <tr key={row.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{row.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.contact}</td>
                        <td className="px-4 py-2.5 capitalize text-slate-600">
                          {String(row.status || '').replace('_', ' ')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
    </HqModulePageLayout>
  );
}
