'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownUp,
  Download,
  MoreVertical,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { CreateHqCompanyModal } from '@/components/hq/CreateHqCompanyModal';
import { HqCompanyDetailDrawer } from '@/components/hq/HqCompanyDetailDrawer';
import {
  HqPageContainer,
  HqPageHeader,
  HqPageMain,
  HqPrimaryButton,
  HqSecondaryButton,
  HqStatCard,
} from '@/components/hq/hqUi';
import {
  countCompaniesByStatus,
  HQ_COMPANY_STATUS_LABELS,
  HQ_COMPANY_STATUS_STYLES,
  HQ_COMPANY_TABS,
  type HqCompanyRow,
  type HqCompanyScore,
  type HqCompanyStatus,
} from './hqCompaniesData';
import {
  apiHqCreateCompany,
  apiHqListCompanies,
  apiHqUpdateCompany,
  type HqCompanyStats,
  type HqLeadStorageInfo,
} from '@/lib/api';
import type { CreateHqCompanyFormValues } from '@/components/hq/CreateHqCompanyModal';
import type { EditHqCompanyFormValues } from '@/components/hq/HqCompanyDetailDrawer';

function ScoreBadge({ score }: { score: HqCompanyScore }) {
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

function StatusBadge({ status }: { status: HqCompanyStatus }) {
  const label = HQ_COMPANY_STATUS_LABELS[status].toUpperCase();
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ring-1 ${HQ_COMPANY_STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  );
}

const EMPTY_STATS: HqCompanyStats = {
  total: 0,
  active: 0,
  inactive: 0,
  onHold: 0,
  closed: 0,
  followUpsToday: 0,
};

export default function HqCompanyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightCompanyId = searchParams.get('company');
  const [companies, setCompanies] = useState<HqCompanyRow[]>([]);
  const [stats, setStats] = useState<HqCompanyStats>(EMPTY_STATS);
  const [storage, setStorage] = useState<HqLeadStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | HqCompanyStatus>('all');
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<HqCompanyRow | null>(null);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await apiHqListCompanies();
      const d = result.data;
      setCompanies(d?.companies ?? []);
      setStats(d?.stats ?? EMPTY_STATS);
      setStorage(d?.storage ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (!highlightCompanyId || loading || companies.length === 0) return;
    const match = companies.find((company) => company.id === highlightCompanyId);
    if (match) {
      setSelectedCompany(match);
      router.replace('/hq/company');
    }
  }, [highlightCompanyId, loading, companies, router]);

  const tabCounts = useMemo(() => countCompaniesByStatus(companies), [companies]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((company) => {
      if (activeTab !== 'all' && company.status !== activeTab) return false;
      if (!q) return true;
      return (
        company.name.toLowerCase().includes(q) ||
        company.contact.toLowerCase().includes(q) ||
        company.owner.toLowerCase().includes(q)
      );
    });
  }, [activeTab, search, companies]);

  const handleCreateCompany = async (values: CreateHqCompanyFormValues) => {
    await apiHqCreateCompany(values);
    await loadCompanies();
  };

  const handleUpdateCompany = async (companyId: string, values: EditHqCompanyFormValues) => {
    const result = await apiHqUpdateCompany(companyId, values);
    const updated = result.data?.company;
    if (updated) {
      handleCompanyUpdated(updated);
    }
    await loadCompanies();
  };

  const handleCompanyUpdated = (updated: HqCompanyRow) => {
    setSelectedCompany(updated);
    setCompanies((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  return (
    <HqPageMain>
      <CreateHqCompanyModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateCompany}
      />
      <HqCompanyDetailDrawer
        open={!!selectedCompany}
        company={selectedCompany}
        onClose={() => setSelectedCompany(null)}
        onSave={handleUpdateCompany}
        onCompanyUpdated={handleCompanyUpdated}
      />
      <HqPageContainer>
        <HqPageHeader
          title="Companies"
          subtitle="Manage prospective and active companies, track account progress, and convert them into tenants."
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
                Add New Company
              </HqPrimaryButton>
            </>
          }
        />

        {storage ? (
          <p className="mb-4 text-xs text-slate-500">
            Companies stored in {storage.engine} database{' '}
            <span className="font-semibold text-slate-700">{storage.database}</span> collection{' '}
            <span className="font-semibold text-slate-700">{storage.collection}</span>
          </p>
        ) : null}

        {loadError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {loadError}
            <button
              type="button"
              onClick={() => void loadCompanies()}
              className="ml-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
        ) : null}

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <HqStatCard label="Total Companies" value={stats.total} />
          <HqStatCard label="Active" value={stats.active} delta="+12%" active />
          <HqStatCard label="Inactive" value={stats.inactive} />
          <HqStatCard label="On Hold" value={stats.onHold} />
          <HqStatCard label="Closed" value={stats.closed} />
          <HqStatCard label="Follow-ups Today" value={stats.followUpsToday} />
        </section>

        <section className="mb-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex min-w-max items-center gap-1 border-b border-slate-100 px-2 py-2">
            {HQ_COMPANY_TABS.map((tab) => {
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
                placeholder="Search companies by name, contact, or owner..."
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
                      Company
                      <ArrowDownUp className="h-3 w-3 opacity-50" />
                    </span>
                  </th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Next Follow-up</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                      Loading companies…
                    </td>
                  </tr>
                ) : filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                      {companies.length === 0
                        ? 'No companies yet. Click Add New Company to create your first company.'
                        : 'No companies match your search.'}
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((company: HqCompanyRow) => (
                    <tr
                      key={company.id}
                      onClick={() => setSelectedCompany(company)}
                      className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3.5 font-semibold text-slate-900">{company.name}</td>
                      <td className="px-4 py-3.5 text-slate-600">{company.contact}</td>
                      <td className="px-4 py-3.5 text-slate-600">{company.industry}</td>
                      <td className="px-4 py-3.5">
                        <ScoreBadge score={company.score} />
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">{company.users}</td>
                      <td className="px-4 py-3.5 text-slate-600">{company.owner}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={company.status} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{company.nextFollowUp}</td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCompany(company);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Actions for ${company.name}`}
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
