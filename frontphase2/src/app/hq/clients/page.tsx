'use client';

/**
 * HQ Clients — Phase 2 list chrome + ClientDetailsDrawer,
 * data stored only in headquarters DB via /hq/companies.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BadgeInfo,
  Briefcase,
  Building2,
  Download,
  Flame,
  FolderOpen,
  MoreVertical,
  Plus,
  RefreshCcw,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { ClientDetailsDrawer } from '@/components/drawers/ClientDetailsDrawer';
import { HqCrmEmbed } from '@/components/hq/HqCrmEmbed';
import {
  HqProductLineDrawerBar,
  HqProductLinePickerModal,
  withHqProductLine,
  type HqProductLine,
} from '@/components/hq/HqProductLinePicker';
import { SummaryCard, SummaryCardSkeleton, type SummaryCardColor } from '@/components/ui/SummaryCard';
import { TableBrandAvatar } from '@/components/ui/TableBrandAvatar';
import {
  HQ_COMPANY_STATUS_LABELS,
  HQ_COMPANY_STATUS_STYLES,
  type HqCompanyRow,
  type HqCompanyScore,
  type HqCompanyStatus,
} from '../company/hqCompaniesData';
import type { Client, ClientStage } from '@/app/client/types';
import { mergeDirectorIntoOtherDetails } from '@/lib/clientDirectorDetails';
import {
  apiHqCreateCompany,
  apiHqDeleteCompany,
  apiHqListCompanies,
  apiHqUpdateCompany,
  type BackendClient,
  type CreateClientData,
  type HqCompanyApiRow,
  type HqCompanyStats,
  type HqLeadStorageInfo,
} from '@/lib/api';

type ClientTab = 'all' | 'active' | 'on-hold' | 'inactive' | 'hot';

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

function hqStatusToClientStage(status: HqCompanyStatus): ClientStage {
  if (status === 'on_hold') return 'On Hold';
  if (status === 'inactive' || status === 'closed') return 'Inactive';
  return 'Active';
}

function mapHqCompanyToClient(row: HqCompanyApiRow | HqCompanyRow): Client {
  const stage = hqStatusToClientStage(row.status);
  const leadStatus = row.leadStatus || HQ_COMPANY_STATUS_LABELS[row.status] || stage;
  return {
    id: row.id,
    name: row.name,
    industry: row.industry || '',
    location: row.location || [row.city, row.state, row.country].filter(Boolean).join(', '),
    openJobs: 0,
    activeCandidates: 0,
    placements: 0,
    stage,
    leadStatus,
    leadStatusValue: leadStatus,
    owner: { name: row.owner || 'Unassigned', avatar: '' },
    assignedToId: row.assignedToId || undefined,
    lastActivity: row.nextFollowUp || '—',
    updatedAt: row.createdAt || undefined,
    logo: '',
    companySize: row.companySize || (row.users ? String(row.users) : ''),
    hiringLocations: row.hiringLocations || '',
    servicesNeeded: row.servicesNeeded || '',
    expectedBusinessValue: row.expectedBusinessValue || String(row.estimatedDealValue || ''),
    website: row.website || '',
    linkedin: row.linkedin || '',
    timezone: row.timezone || '',
    priority: (row.priority as Client['priority']) || undefined,
    sla: row.sla || '',
    nextFollowUpDue: row.nextFollowUpAt || undefined,
    city: row.city || '',
    state: row.state || '',
    country: row.country || '',
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    directorSalutation: row.directorSalutation || null,
    emails: row.emails || (row.email ? [row.email] : []),
    phones: row.phones || (row.phone ? [row.phone] : []),
    teamMemberDesignation: row.teamMemberDesignation || undefined,
    teamMemberEmail: row.teamMemberEmail || undefined,
    teamMemberPhone: row.teamMemberPhone || undefined,
    otherDetails:
      mergeDirectorIntoOtherDetails(row.otherDetails || [], {
        directorSalutation: row.directorSalutation,
        directorName: row.directorName || row.contact || '',
      }) || [],
    contacts: [],
    jobs: [],
    pipelineCandidates: [],
    placementList: [],
    activityList: [],
    notesList: [],
    fileList: [],
  };
}

function mapHqCompanyToBackendClient(row: HqCompanyApiRow): BackendClient {
  return {
    id: row.id,
    companyName: row.name,
    industry: row.industry || null,
    website: row.website || null,
    location: row.location || null,
    status: row.status === 'inactive' ? 'INACTIVE' : row.status === 'on_hold' ? 'ON_HOLD' : 'ACTIVE',
    leadStatus: row.leadStatus || HQ_COMPANY_STATUS_LABELS[row.status] || 'Active',
    assignedToId: row.assignedToId || null,
    companySize: row.companySize || null,
    hiringLocations: row.hiringLocations || null,
    servicesNeeded: row.servicesNeeded || null,
    expectedBusinessValue: row.expectedBusinessValue || null,
    linkedin: row.linkedin || null,
    timezone: row.timezone || null,
    priority: row.priority || null,
    sla: row.sla || null,
    nextFollowUpDue: row.nextFollowUpAt || null,
    city: row.city || null,
    state: row.state || null,
    country: row.country || null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    directorSalutation: row.directorSalutation || null,
    teamMemberDesignation: row.teamMemberDesignation || null,
    teamMemberEmail: row.teamMemberEmail || null,
    teamMemberPhone: row.teamMemberPhone || null,
    email: row.email || null,
    phone: row.phone || null,
    emails: row.emails || [],
    phones: row.phones || [],
    otherDetails: row.otherDetails || [],
  } as BackendClient;
}

export default function HqClientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightClientId =
    searchParams.get('clientId') || searchParams.get('client') || searchParams.get('company');
  const pathname = usePathname();

  const [companies, setCompanies] = useState<HqCompanyApiRow[]>([]);
  const [stats, setStats] = useState<HqCompanyStats>(EMPTY_STATS);
  const [storage, setStorage] = useState<HqLeadStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClientTab>('all');
  const [search, setSearch] = useState('');
  const [productLinePickerOpen, setProductLinePickerOpen] = useState(false);
  const [addProductLine, setAddProductLine] = useState<HqProductLine | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientDrawerMode, setSelectedClientDrawerMode] = useState<'view' | 'edit'>('view');

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
      setLoadError(err instanceof Error ? err.message : 'Failed to load HQ clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (!highlightClientId || loading || companies.length === 0) return;
    const match = companies.find((company) => company.id === highlightClientId);
    if (match) {
      setCreateDrawerOpen(false);
      setSelectedClientId(match.id);
      setSelectedClientDrawerMode('view');
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete('clientId');
      sp.delete('client');
      sp.delete('company');
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [highlightClientId, loading, companies, router, pathname, searchParams]);

  const clearDrawerQuery = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('clientId');
    sp.delete('client');
    sp.delete('company');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const tabCounts = useMemo(() => {
    let active = 0;
    let onHold = 0;
    let inactive = 0;
    let hot = 0;
    for (const c of companies) {
      if (c.status === 'active') active += 1;
      else if (c.status === 'on_hold') onHold += 1;
      else if (c.status === 'inactive' || c.status === 'closed') inactive += 1;
      if (c.score === 'Hot') hot += 1;
    }
    return {
      all: companies.length || stats.total,
      active: active || stats.active,
      'on-hold': onHold || stats.onHold,
      inactive: inactive || stats.inactive + stats.closed,
      hot,
    };
  }, [companies, stats]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((company) => {
      if (activeTab === 'active' && company.status !== 'active') return false;
      if (activeTab === 'on-hold' && company.status !== 'on_hold') return false;
      if (
        activeTab === 'inactive' &&
        company.status !== 'inactive' &&
        company.status !== 'closed'
      ) {
        return false;
      }
      if (activeTab === 'hot' && company.score !== 'Hot') return false;
      if (!q) return true;
      return (
        company.name.toLowerCase().includes(q) ||
        (company.contact || '').toLowerCase().includes(q) ||
        (company.owner || '').toLowerCase().includes(q) ||
        (company.email || '').toLowerCase().includes(q) ||
        (company.industry || '').toLowerCase().includes(q)
      );
    });
  }, [activeTab, search, companies]);

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    const row = companies.find((c) => c.id === selectedClientId);
    return row ? mapHqCompanyToClient(row) : null;
  }, [selectedClientId, companies]);

  const handleCreateClientOverride = async (data: CreateClientData) => {
    const result = await apiHqCreateCompany(
      withHqProductLine(
        {
          ...data,
          directorName: (data as CreateClientData & { directorName?: string }).directorName,
          formSchema: 'phase2',
        },
        addProductLine,
      ) as CreateClientData & {
        directorName?: string;
        formSchema?: string;
        hqProductLine?: HqProductLine;
      },
    );
    const created = result.data?.company;
    if (!created) return null;
    return mapHqCompanyToBackendClient(created);
  };

  const handleUpdateClientOverride = async (clientId: string, data: Record<string, unknown>) => {
    const result = await apiHqUpdateCompany(clientId, {
      ...data,
      formSchema: 'phase2',
    });
    const updated = result.data?.company;
    if (!updated) return null;
    setCompanies((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    return mapHqCompanyToBackendClient(updated);
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!window.confirm('Delete this HQ client? This cannot be undone.')) return;
    try {
      await apiHqDeleteCompany(clientId);
      setSelectedClientId(null);
      setCreateDrawerOpen(false);
      await loadCompanies();
      toast.success('Client deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete client');
    }
  };

  const exportCsv = () => {
    if (filteredCompanies.length === 0) {
      toast.error('Nothing to export');
      return;
    }
    const header = ['Client', 'Contact', 'Industry', 'Score', 'Owner', 'Status', 'Next Follow-up'];
    const body = filteredCompanies.map((c) =>
      [
        c.name,
        c.contact || '',
        c.industry || '',
        c.score,
        c.owner || '',
        HQ_COMPANY_STATUS_LABELS[c.status],
        c.nextFollowUp || '',
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hq-clients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredCompanies.length} client${filteredCompanies.length === 1 ? '' : 's'}`);
  };

  const statusCards: Array<{
    id: ClientTab;
    label: string;
    count: number;
    color: SummaryCardColor;
    icon: React.ReactNode;
  }> = [
    {
      id: 'all',
      label: 'All Clients',
      count: tabCounts.all,
      color: 'indigo',
      icon: <FolderOpen size={16} strokeWidth={2.35} />,
    },
    {
      id: 'active',
      label: 'Active',
      count: tabCounts.active,
      color: 'blue',
      icon: <Users size={16} strokeWidth={2.35} />,
    },
    {
      id: 'on-hold',
      label: 'On Hold',
      count: tabCounts['on-hold'],
      color: 'orange',
      icon: <Briefcase size={16} strokeWidth={2.35} />,
    },
    {
      id: 'inactive',
      label: 'Inactive',
      count: tabCounts.inactive,
      color: 'gray',
      icon: <BadgeInfo size={16} strokeWidth={2.35} />,
    },
    {
      id: 'hot',
      label: 'Hot',
      count: tabCounts.hot,
      color: 'purple',
      icon: <Flame size={16} strokeWidth={2.35} />,
    },
  ];

  return (
    <HqCrmEmbed>
      <div className="ph2-page-shell flex h-[100dvh] w-full flex-col overflow-hidden text-slate-900">
        <Toaster position="top-right" richColors style={{ top: '5rem' }} />

        <HqProductLinePickerModal
          open={productLinePickerOpen}
          title="Add Client — choose workspace"
          subtitle="Pick CRM or Recruitment first (Phase 2 modules). Then fill the client form."
          value={addProductLine}
          onClose={() => setProductLinePickerOpen(false)}
          onSelect={(line) => {
            setAddProductLine(line);
            setProductLinePickerOpen(false);
            setSelectedClientId(null);
            setCreateDrawerOpen(true);
          }}
        />

        {createDrawerOpen && addProductLine ? (
          <HqProductLineDrawerBar
            value={addProductLine}
            onChange={setAddProductLine}
            entityLabel="client"
          />
        ) : null}

        {(createDrawerOpen || selectedClient) && (
          <ClientDetailsDrawer
            client={createDrawerOpen ? null : selectedClient}
            isAddMode={createDrawerOpen}
            initialMode={selectedClientDrawerMode}
            onClose={() => {
              setCreateDrawerOpen(false);
              setSelectedClientId(null);
              setSelectedClientDrawerMode('view');
              setAddProductLine(null);
              clearDrawerQuery();
            }}
            createClientOverride={handleCreateClientOverride}
            updateClientOverride={handleUpdateClientOverride}
            onDelete={handleDeleteClient}
            onClientCreated={async () => {
              setCreateDrawerOpen(false);
              setAddProductLine(null);
              await loadCompanies();
              toast.success('HQ client created successfully');
            }}
            onClientUpdated={(patch) => {
              setCompanies((prev) =>
                prev.map((item) =>
                  item.id === patch.id
                    ? {
                        ...item,
                        name: patch.name || item.name,
                        industry: patch.industry || item.industry,
                        location: patch.location || item.location,
                        servicesNeeded: patch.servicesNeeded || item.servicesNeeded,
                        expectedBusinessValue:
                          patch.expectedBusinessValue || item.expectedBusinessValue,
                        leadStatus: patch.leadStatus || item.leadStatus,
                        website: patch.website || item.website,
                        country: patch.country || item.country,
                        city: patch.city || item.city,
                        state: patch.state || item.state,
                        emails: patch.emails || item.emails,
                        phones: patch.phones || item.phones,
                      }
                    : item,
                ),
              );
            }}
          />
        )}

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="min-h-[4.5rem] flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 shrink-0 border-b border-indigo-100/50 bg-white/80 backdrop-blur-md shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)]">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <Building2 className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl sm:text-[1.35rem] font-bold tracking-tight text-slate-900 leading-none">
                  Clients
                </h1>
                {storage ? (
                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    HQ · {storage.database}/{storage.collection} · converted leads appear here and under Companies
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Converted leads become clients here and companies for provisioning
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadCompanies()}
                disabled={loading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCcw size={16} strokeWidth={2.25} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
              >
                <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>Export</span>
              </button>
              <button
                type="button"
                onClick={() => toast.message('CSV import for HQ clients is coming soon')}
                className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
              >
                <Upload size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>Import</span>
              </button>
            <button
              type="button"
              onClick={() => {
                setSelectedClientId(null);
                setCreateDrawerOpen(false);
                setProductLinePickerOpen(true);
              }}
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white px-3.5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/30 active:scale-[0.98]"
            >
              <Plus size={16} className="text-white" strokeWidth={2.5} />
              <span>Add Client</span>
            </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            {loadError ? (
              <div className="mb-4 shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
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

            <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {loading
                ? (['indigo', 'blue', 'orange', 'gray', 'purple'] as SummaryCardColor[]).map(
                    (color, i) => <SummaryCardSkeleton key={i} color={color} />,
                  )
                : statusCards.map((card) => (
                    <SummaryCard
                      key={card.id}
                      label={card.label}
                      count={card.count}
                      color={card.color}
                      icon={card.icon}
                      active={activeTab === card.id}
                      onClick={() => setActiveTab(card.id)}
                    />
                  ))}
            </div>

            <div className="mb-0 flex min-h-0 flex-1 flex-col overflow-hidden hq-table-wrap">
              <div className="flex shrink-0 items-center gap-2 overflow-x-auto ph2-invisible-scrollbar border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/80 p-3 sm:p-4">
                <div className="relative min-w-[14rem] max-w-md shrink-0 grow basis-[14rem] sm:basis-[18rem]">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teal-600/70"
                    size={16}
                    strokeWidth={2.25}
                  />
                  <input
                    type="text"
                    placeholder="Search clients by name, contact, or owner..."
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs text-slate-800 placeholder:text-slate-400 transition-all focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="ph2-table-body-scroll min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[760px] text-left" aria-label="Clients">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="min-w-[11rem]">Client</th>
                      <th>Contact</th>
                      <th>Industry</th>
                      <th>Score</th>
                      <th>Owner</th>
                      <th>Status</th>
                      <th>Next Follow-up</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                          Loading HQ clients…
                        </td>
                      </tr>
                    ) : filteredCompanies.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center">
                          <div className="mx-auto flex max-w-sm flex-col items-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-600">
                              <Building2 className="h-8 w-8" strokeWidth={2} />
                            </div>
                            <h3 className="text-base font-bold text-slate-900 mb-1">
                              {companies.length === 0 ? 'No clients added yet' : 'No matching clients'}
                            </h3>
                            <p className="text-slate-500 text-sm mb-5">
                              {companies.length === 0
                                ? 'Start building your HQ pipeline by adding your first client.'
                                : 'Try adjusting search or clear the status filter.'}
                            </p>
                            {companies.length === 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClientId(null);
                                  setCreateDrawerOpen(false);
                                  setProductLinePickerOpen(true);
                                }}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                              >
                                <Plus className="h-4 w-4" strokeWidth={2.5} /> Create Client
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCompanies.map((company) => (
                        <tr
                          key={company.id}
                          onClick={() => {
                            setCreateDrawerOpen(false);
                            setSelectedClientDrawerMode('view');
                            setSelectedClientId(company.id);
                          }}
                          className={`cursor-pointer group transition-colors duration-200 ${
                            selectedClientId === company.id
                              ? 'bg-blue-50/70 hover:bg-blue-50/85'
                              : 'even:bg-slate-50/35 hover:bg-indigo-50/45'
                          }`}
                        >
                          <td className="px-3 sm:px-4 py-2 min-w-[11rem] align-middle">
                            <div className="flex items-center gap-2">
                              <TableBrandAvatar
                                name={company.name}
                                size="sm"
                                showStatusDot={company.status === 'active'}
                                statusDotTitle={`Client: ${HQ_COMPANY_STATUS_LABELS[company.status]}`}
                              />
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                {company.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-2">
                            <div className="text-xs font-medium text-slate-800 truncate">
                              {company.contact || '—'}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {company.email || company.phone || '—'}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                            {company.industry || '—'}
                          </td>
                          <td className="px-3 sm:px-4 py-2">
                            <ScoreBadge score={company.score} />
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                            {company.owner || 'Unassigned'}
                          </td>
                          <td className="px-3 sm:px-4 py-2">
                            <StatusBadge status={company.status} />
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                            {company.nextFollowUp || '—'}
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreateDrawerOpen(false);
                                setSelectedClientDrawerMode('edit');
                                setSelectedClientId(company.id);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                              aria-label={`Edit ${company.name}`}
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
            </div>
          </div>
        </main>
      </div>
    </HqCrmEmbed>
  );
}
