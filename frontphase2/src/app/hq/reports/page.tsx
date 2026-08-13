'use client';

/**
 * HQ-native Reports — HQ CRM data only (leads + clients from headquarters DB).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import { useHqMoney } from '@/components/hq/HqCurrencyProvider';
import { HqSecondaryButton, HqStatCard } from '@/components/hq/hqUi';
import {
  apiHqListCompanies,
  apiHqListLeads,
  apiHqListTeam,
  type HqCompanyApiRow,
  type HqLeadApiRow,
} from '@/lib/api';
import { HQ_LEAD_STAGE_LABELS, type HqLeadStage } from '@/app/hq/leads/hqLeadsData';

export default function HqReportsPage() {
  const { formatMoney } = useHqMoney();
  const [leads, setLeads] = useState<HqLeadApiRow[]>([]);
  const [companies, setCompanies] = useState<HqCompanyApiRow[]>([]);
  const [teamTotal, setTeamTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setTeamTotal(teamRes.data?.stats?.total ?? 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load HQ reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const report = useMemo(() => {
    const converted = leads.filter((l) => l.stage === 'converted').length;
    const lost = leads.filter((l) => l.stage === 'lost').length;
    const conversionRate = leads.length ? Math.round((converted / leads.length) * 100) : 0;
    const pipeline = leads
      .filter((l) => l.stage !== 'converted' && l.stage !== 'lost')
      .reduce((sum, l) => sum + Number(l.estimatedDealValue || 0), 0);
    const bySource: Record<string, number> = {};
    for (const lead of leads) {
      const source = lead.leadSource?.trim() || 'Unknown';
      bySource[source] = (bySource[source] || 0) + 1;
    }
    const byStage = (Object.keys(HQ_LEAD_STAGE_LABELS) as HqLeadStage[]).map((stage) => ({
      stage: HQ_LEAD_STAGE_LABELS[stage],
      count: leads.filter((l) => l.stage === stage).length,
    }));
    const clientsByStatus = ['active', 'inactive', 'on_hold', 'closed'].map((status) => ({
      status: status.replace('_', ' '),
      count: companies.filter((c) => c.status === status).length,
    }));
    return {
      converted,
      lost,
      conversionRate,
      pipeline,
      bySource: Object.entries(bySource)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      byStage,
      clientsByStatus,
    };
  }, [leads, companies]);

  return (
    <HqModulePageLayout
      title="Reports"
      subtitle="Headquarters CRM reports — HQ database only (not tenant CRM)."
      icon={<BarChart3 className="h-5 w-5" />}
      locked={false}
      actions={
          <HqSecondaryButton onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </HqSecondaryButton>
      }
    >

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <HqStatCard label="Leads" value={leads.length} />
          <HqStatCard label="Converted" value={report.converted} active />
          <HqStatCard label="Lost" value={report.lost} />
          <HqStatCard label="Conversion" value={`${report.conversionRate}%`} />
          <HqStatCard label="Open pipeline" value={formatMoney(report.pipeline)} />
          <HqStatCard label="Clients / Team" value={`${companies.length} / ${teamTotal}`} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="hq-surface p-5">
            <h2 className="hq-display text-sm font-semibold text-slate-900">Leads by stage</h2>
            <ul className="mt-4 space-y-2">
              {report.byStage.map((row) => (
                <li key={row.stage} className="flex justify-between text-sm">
                  <span className="text-slate-600">{row.stage}</span>
                  <span className="font-semibold text-slate-900">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="hq-surface p-5">
            <h2 className="hq-display text-sm font-semibold text-slate-900">Leads by source</h2>
            <ul className="mt-4 space-y-2">
              {report.bySource.length === 0 ? (
                <li className="text-sm text-slate-500">No source data yet.</li>
              ) : (
                report.bySource.map((row) => (
                  <li key={row.source} className="flex justify-between text-sm">
                    <span className="truncate text-slate-600">{row.source}</span>
                    <span className="font-semibold text-slate-900">{row.count}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="hq-surface p-5">
            <h2 className="hq-display text-sm font-semibold text-slate-900">Clients by status</h2>
            <ul className="mt-4 space-y-2">
              {report.clientsByStatus.map((row) => (
                <li key={row.status} className="flex justify-between text-sm capitalize">
                  <span className="text-slate-600">{row.status}</span>
                  <span className="font-semibold text-slate-900">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
    </HqModulePageLayout>
  );
}
