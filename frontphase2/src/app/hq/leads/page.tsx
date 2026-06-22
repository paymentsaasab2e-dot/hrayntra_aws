'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownUp,
  ArrowRightLeft,
  Download,
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
  HQ_DEMO_STATUS_LABELS,
  HQ_DEMO_STATUS_STYLES,
  HQ_LEADS_PAGE_TABS,
  HQ_LEAD_STAGE_LABELS,
  HQ_LEAD_STAGE_STYLES,
  formatHqLeadSourceDisplay,
  type HqDemoRequestRow,
  type HqDemoRequestStatus,
  type HqLeadRow,
  type HqLeadStage,
  type HqLeadsPageTab,
} from './hqLeadsData';
import {
  apiHqCreateLead,
  apiHqConvertLeadToCompany,
  apiHqListDemoRequests,
  apiHqListLeads,
  apiHqUpdateLead,
  type HqDemoStats,
  type HqLeadStats,
  type HqLeadStorageInfo,
} from '@/lib/api';
import type { CreateHqLeadFormValues } from '@/components/hq/CreateHqLeadModal';
import type { EditHqLeadFormValues } from '@/components/hq/HqLeadDetailDrawer';

function StageBadge({ stage }: { stage: HqLeadStage }) {
  const label = HQ_LEAD_STAGE_LABELS[stage].toUpperCase();
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ring-1 ${HQ_LEAD_STAGE_STYLES[stage]}`}
    >
      {label}
    </span>
  );
}

function DemoStatusBadge({ status }: { status: HqDemoRequestStatus }) {
  const normalized = (status in HQ_DEMO_STATUS_LABELS ? status : 'PENDING') as HqDemoRequestStatus;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ring-1 ${HQ_DEMO_STATUS_STYLES[normalized]}`}
    >
      {HQ_DEMO_STATUS_LABELS[normalized].toUpperCase()}
    </span>
  );
}

function formatDemoPhone(demo: HqDemoRequestRow) {
  const phone = [demo.dialCode, demo.phoneNumber].filter(Boolean).join(' ').trim();
  return phone || '—';
}

const EMPTY_STATS: HqLeadStats = {
  total: 0,
  newLeads: 0,
  followUpsToday: 0,
  converted: 0,
  lost: 0,
  conversionRate: 0,
};

const EMPTY_DEMO_STATS: HqDemoStats = {
  total: 0,
  verified: 0,
  pending: 0,
  expired: 0,
};

export default function HqLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<HqLeadRow[]>([]);
  const [stats, setStats] = useState<HqLeadStats>(EMPTY_STATS);
  const [storage, setStorage] = useState<HqLeadStorageInfo | null>(null);
  const [demos, setDemos] = useState<HqDemoRequestRow[]>([]);
  const [demoStats, setDemoStats] = useState<HqDemoStats>(EMPTY_DEMO_STATS);
  const [demoStorage, setDemoStorage] = useState<HqLeadStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [demosLoading, setDemosLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [demosError, setDemosError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<HqLeadsPageTab>('all');
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<HqLeadRow | null>(null);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

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

  const loadDemos = useCallback(async () => {
    setDemosLoading(true);
    setDemosError(null);
    try {
      const result = await apiHqListDemoRequests();
      const d = result.data;
      setDemos(d?.demos ?? []);
      setDemoStats(d?.stats ?? EMPTY_DEMO_STATS);
      setDemoStorage(d?.storage ?? null);
    } catch (err) {
      setDemosError(err instanceof Error ? err.message : 'Failed to load demo requests');
    } finally {
      setDemosLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
    void loadDemos();
  }, [loadLeads, loadDemos]);

  const isDemosTab = activeTab === 'demos';

  const tabCounts = useMemo(() => {
    const counts = countLeadsByStage(leads);
    counts.demos = demoStats.total;
    return counts;
  }, [leads, demoStats.total]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (activeTab !== 'all' && activeTab !== 'demos' && lead.stage !== activeTab) return false;
      if (activeTab === 'demos') return false;
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.company.toLowerCase().includes(q) ||
        (lead.leadSource || '').toLowerCase().includes(q)
      );
    });
  }, [activeTab, search, leads]);

  const filteredDemos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return demos.filter((demo) => {
      if (!q) return true;
      return (
        demo.fullName.toLowerCase().includes(q) ||
        demo.email.toLowerCase().includes(q) ||
        demo.organizationName.toLowerCase().includes(q) ||
        demo.outcome.toLowerCase().includes(q)
      );
    });
  }, [search, demos]);

  const handleCreateLead = async (values: CreateHqLeadFormValues) => {
    await apiHqCreateLead(values);
    await loadLeads();
  };

  const handleUpdateLead = async (leadId: string, values: EditHqLeadFormValues) => {
    const result = await apiHqUpdateLead(leadId, values);
    const updated = result.data?.lead;
    if (updated) {
      handleLeadUpdated(updated);
    }
    await loadLeads();
  };

  const handleLeadUpdated = (updated: HqLeadRow) => {
    setSelectedLead(updated);
    setLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleConvertToCompany = async (lead: HqLeadRow) => {
    if (lead.convertedToCompanyId) {
      router.push(`/hq/company?company=${encodeURIComponent(lead.convertedToCompanyId)}`);
      return;
    }

    setConvertError(null);
    setConvertingLeadId(lead.id);
    try {
      const result = await apiHqConvertLeadToCompany(lead.id);
      const companyId = result.data?.company?.id;
      const updatedLead = result.data?.lead;
      if (updatedLead) {
        setLeads((prev) => prev.map((item) => (item.id === updatedLead.id ? updatedLead : item)));
      }
      if (companyId) {
        router.push(`/hq/company?company=${encodeURIComponent(companyId)}`);
      }
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Failed to convert lead to company');
    } finally {
      setConvertingLeadId(null);
    }
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
        onSave={handleUpdateLead}
        onLeadUpdated={handleLeadUpdated}
      />
      <HqPageContainer>
        <HqPageHeader
          title="CRM Leads"
          subtitle="Manage potential clients, track deal progress, and convert leads into active workspaces."
          actions={
            isDemosTab ? (
              <HqSecondaryButton onClick={() => void loadDemos()} disabled={demosLoading}>
                <Download className="h-4 w-4" />
                {demosLoading ? 'Refreshing…' : 'Refresh'}
              </HqSecondaryButton>
            ) : (
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
            )
          }
        />

        {isDemosTab && demoStorage ? (
          <p className="mb-4 text-xs text-slate-500">
            Demo requests stored in {demoStorage.engine} database{' '}
            <span className="font-semibold text-slate-700">{demoStorage.database}</span> collection{' '}
            <span className="font-semibold text-slate-700">{demoStorage.collection}</span>
          </p>
        ) : storage ? (
          <p className="mb-4 text-xs text-slate-500">
            Leads stored in {storage.engine} database{' '}
            <span className="font-semibold text-slate-700">{storage.database}</span> collection{' '}
            <span className="font-semibold text-slate-700">{storage.collection}</span>
          </p>
        ) : null}

        {demosError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {demosError}
            <button
              type="button"
              onClick={() => void loadDemos()}
              className="ml-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
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

        {convertError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {convertError}
            <button
              type="button"
              onClick={() => setConvertError(null)}
              className="ml-2 font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {isDemosTab ? (
            <>
              <HqStatCard label="Total Requests" value={demoStats.total} />
              <HqStatCard label="Verified" value={demoStats.verified} active />
              <HqStatCard label="Pending OTP" value={demoStats.pending} />
              <HqStatCard label="Expired" value={demoStats.expired} />
            </>
          ) : (
            <>
              <HqStatCard label="Total Leads" value={stats.total} />
              <HqStatCard label="New Leads" value={stats.newLeads} delta="+12%" active />
              <HqStatCard label="Follow-ups Today" value={stats.followUpsToday} />
              <HqStatCard label="Converted" value={stats.converted} />
              <HqStatCard label="Closed (Lost)" value={stats.lost} />
            </>
          )}
        </section>

        <section className="mb-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex min-w-max items-center gap-1 border-b border-slate-100 px-2 py-2">
            {HQ_LEADS_PAGE_TABS.map((tab) => {
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
                placeholder={
                  isDemosTab
                    ? 'Search demos by name, email, organization, or outcome...'
                    : 'Search leads by name, company, or source...'
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <HqSecondaryButton>
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </HqSecondaryButton>
          </div>

          <div className="overflow-x-auto">
            {isDemosTab ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Country</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Company Size</th>
                    <th className="px-4 py-3">Outcome</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {demosLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                        Loading demo requests…
                      </td>
                    </tr>
                  ) : filteredDemos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                        {demos.length === 0
                          ? 'No employer demo requests yet.'
                          : 'No demo requests match your search.'}
                      </td>
                    </tr>
                  ) : (
                    filteredDemos.map((demo) => (
                      <tr
                        key={demo.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-3.5 font-semibold text-slate-900">{demo.fullName}</td>
                        <td className="px-4 py-3.5 text-slate-600">{demo.email}</td>
                        <td className="px-4 py-3.5 text-slate-600">{demo.organizationName}</td>
                        <td className="px-4 py-3.5 text-slate-600">{demo.countryCode || '—'}</td>
                        <td className="px-4 py-3.5 text-slate-600">{formatDemoPhone(demo)}</td>
                        <td className="px-4 py-3.5 text-slate-600">{demo.companySize}</td>
                        <td className="max-w-xs px-4 py-3.5 text-slate-600">
                          <span className="line-clamp-2">{demo.outcome || '—'}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <DemoStatusBadge status={demo.status} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{demo.submittedAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
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
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Next Follow-up</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      Loading leads…
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
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
                      <td className="px-4 py-3.5 font-medium text-slate-700">{lead.users}</td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {formatHqLeadSourceDisplay(lead.leadSource, lead.leadSourceDetail)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StageBadge stage={lead.stage} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{lead.nextFollowUp}</td>
                      <td className="px-4 py-3.5">
                        {lead.convertedToCompanyId ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/hq/company?company=${encodeURIComponent(lead.convertedToCompanyId!)}`
                              );
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            View Company
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={convertingLeadId === lead.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleConvertToCompany(lead);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            {convertingLeadId === lead.id ? 'Converting…' : 'Convert to Company'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )}
          </div>
        </section>
      </HqPageContainer>
    </HqPageMain>
  );
}
