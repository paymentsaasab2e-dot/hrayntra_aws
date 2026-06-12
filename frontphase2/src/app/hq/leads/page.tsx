'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Download,
  MoreVertical,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { CreateHqLeadModal } from '@/components/hq/CreateHqLeadModal';
import { HqLeadDetailDrawer } from '@/components/hq/HqLeadDetailDrawer';
import {
  HqPageContainer,
  HqPageHeader,
  HqPageMain,
  HqPrimaryButton,
  HqSecondaryButton,
  HqStatCard,
} from '@/components/hq/hqUi';
import {
  countLeadsByStage,
  HQ_LEAD_STAGE_LABELS,
  HQ_LEAD_TABS,
  type HqLeadRow,
  type HqLeadScore,
  type HqLeadStage,
} from './hqLeadsData';
import {
  apiHqCreateLead,
  apiHqListLeads,
  type HqLeadStats,
  type HqLeadStorageInfo,
} from '@/lib/api';
import type { CreateHqLeadFormValues } from '@/components/hq/CreateHqLeadModal';

function ScoreBadge({ score }: { score: HqLeadScore }) {
  if (score === 'Hot') {
    return (
      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">
        Hot
      </span>
    );
  }
  if (score === 'Warm') {
    return (
      <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold text-white">
        Warm
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
      Cold
    </span>
  );
}

function StageBadge({ stage }: { stage: HqLeadStage }) {
  const label = HQ_LEAD_STAGE_LABELS[stage].toUpperCase();
  const styles: Record<HqLeadStage, string> = {
    new: 'bg-sky-50 text-sky-700 ring-sky-200',
    contacted: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    demo_scheduled: 'bg-violet-50 text-violet-700 ring-violet-200',
    proposal_sent: 'bg-slate-100 text-slate-700 ring-slate-200',
    negotiation: 'bg-amber-50 text-amber-800 ring-amber-200',
    closed_won: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    closed_lost: 'bg-rose-50 text-rose-700 ring-rose-200',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ring-1 ${styles[stage]}`}
    >
      {label}
    </span>
  );
}

const EMPTY_STATS: HqLeadStats = {
  total: 0,
  newLeads: 0,
  followUpsToday: 0,
  won: 0,
  lost: 0,
  winRate: 0,
};

export default function HqLeadsPage() {
  const [leads, setLeads] = useState<HqLeadRow[]>([]);
  const [stats, setStats] = useState<HqLeadStats>(EMPTY_STATS);
  const [storage, setStorage] = useState<HqLeadStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | HqLeadStage>('all');
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<HqLeadRow | null>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await apiHqListLeads();
      const d = result.data;
      setLeads(d?.leads ?? []);
      setStats(d?.stats ?? EMPTY_STATS);
      setStorage(d?.storage ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const tabCounts = useMemo(() => countLeadsByStage(leads), [leads]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (activeTab !== 'all' && lead.stage !== activeTab) return false;
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.company.toLowerCase().includes(q) ||
        lead.owner.toLowerCase().includes(q)
      );
    });
  }, [activeTab, search, leads]);

  const handleCreateLead = async (values: CreateHqLeadFormValues) => {
    await apiHqCreateLead(values);
    await loadLeads();
  };

  return (
    <HqPageMain>
      <CreateHqLeadModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateLead}
      />
      <HqLeadDetailDrawer
        open={!!selectedLead}
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
      />
      <HqPageContainer>
        <HqPageHeader
          title="CRM Leads"
          subtitle="Manage potential clients, track deal progress, and convert leads into active workspaces."
          actions={
            <>
              <HqSecondaryButton>
                <Upload className="h-4 w-4" />
                Import
              </HqSecondaryButton>
              <HqSecondaryButton>
                <Download className="h-4 w-4" />
                Export
              </HqSecondaryButton>
              <HqPrimaryButton onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Add New Lead
              </HqPrimaryButton>
            </>
          }
        />

        {storage ? (
          <p className="mb-4 text-xs text-slate-500">
            Leads stored in {storage.engine} database{' '}
            <span className="font-semibold text-slate-700">{storage.database}</span> collection{' '}
            <span className="font-semibold text-slate-700">{storage.collection}</span>
          </p>
        ) : null}

        {loadError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {loadError}
            <button
              type="button"
              onClick={() => void loadLeads()}
              className="ml-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
        ) : null}

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <HqStatCard label="Total Leads" value={stats.total} />
          <HqStatCard label="New Leads" value={stats.newLeads} delta="+12%" active />
          <HqStatCard label="Follow-ups Today" value={stats.followUpsToday} />
          <HqStatCard label="Converted (Won)" value={stats.won} />
          <HqStatCard label="Closed (Lost)" value={stats.lost} />
          <HqStatCard label="Win Rate" value={`${stats.winRate}%`} delta="+5%" />
        </section>

        <section className="mb-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex min-w-max items-center gap-1 border-b border-slate-100 px-2 py-2">
            {HQ_LEAD_TABS.map((tab) => {
              const count = tabCounts[tab.id] ?? 0;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-white text-slate-700 ring-1 ring-slate-200' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads by name, company, or owner..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <HqSecondaryButton>
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </HqSecondaryButton>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      Lead Name
                      <ArrowDownUp className="h-3 w-3 opacity-50" />
                    </span>
                  </th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Next Follow-up</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                      Loading leads…
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                      {leads.length === 0
                        ? 'No leads yet. Click Add New Lead to create your first lead.'
                        : 'No leads match your search.'}
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead: HqLeadRow) => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3.5 font-semibold text-slate-900">{lead.name}</td>
                      <td className="px-4 py-3.5 text-slate-600">{lead.company}</td>
                      <td className="px-4 py-3.5 text-slate-600">{lead.industry}</td>
                      <td className="px-4 py-3.5">
                        <ScoreBadge score={lead.score} />
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">{lead.users}</td>
                      <td className="px-4 py-3.5 text-slate-600">{lead.owner}</td>
                      <td className="px-4 py-3.5">
                        <StageBadge stage={lead.stage} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{lead.nextFollowUp}</td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLead(lead);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Actions for ${lead.name}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </HqPageContainer>
    </HqPageMain>
  );
}
