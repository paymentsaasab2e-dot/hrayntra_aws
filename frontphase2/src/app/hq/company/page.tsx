'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownUp,
  Building2,
  Download,
  MoreVertical,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { ClientDetailsDrawer } from '@/components/drawers/ClientDetailsDrawer';
import {
  HqProductLineDrawerBar,
  withHqProductLine,
  type HqProductLine,
} from '@/components/hq/HqProductLinePicker';
import {
  CreateTenantModal,
  emptyProvisionTenantForm,
  provisionFormFromCompany,
  type ProvisionTenantFormData,
} from '@/components/hq/CreateTenantModal';
import {
  HqModulePageLayout,
  HQ_TABLE_BODY_SCROLL_CLASS,
  HQ_TABLE_CARD_CLASS,
  HQ_TOOLBAR_ROW_CLASS,
} from '@/components/hq/HqModulePageLayout';
import { HqPrimaryButton, HqSecondaryButton, HqStatCard } from '@/components/hq/hqUi';
import {
  countCompaniesByStatus,
  HQ_COMPANY_STATUS_LABELS,
  HQ_COMPANY_STATUS_STYLES,
  HQ_COMPANY_TABS,
  type HqCompanyScore,
  type HqCompanyStatus,
} from './hqCompaniesData';
import {
  apiHqCreateCompany,
  apiHqDeleteCompany,
  apiHqListCompanies,
  apiHqProvisionTenant,
  apiHqUpdateCompany,
  type HqCompanyApiRow,
  type HqCompanyStats,
  type HqLeadStorageInfo,
  type CreateClientData,
} from '@/lib/api';
import { mapHqCompanyToBackendClient, mapHqCompanyToClient } from '@/app/hq/hqCompanyToClient';
import { toast } from 'sonner';

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
  const [companies, setCompanies] = useState<HqCompanyApiRow[]>([]);
  const [stats, setStats] = useState<HqCompanyStats>(EMPTY_STATS);
  const [storage, setStorage] = useState<HqLeadStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | HqCompanyStatus>('all');
  const [search, setSearch] = useState('');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [addProductLine, setAddProductLine] = useState<HqProductLine>('crm');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [createTenantOpen, setCreateTenantOpen] = useState(false);
  const [provisionData, setProvisionData] = useState<ProvisionTenantFormData>(emptyProvisionTenantForm());
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [lockCompanyForTenant, setLockCompanyForTenant] = useState(false);

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
      setSelectedCompanyId(match.id);
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

  const handleCreateCompanyOverride = async (data: CreateClientData) => {
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

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return companies.find((company) => company.id === selectedCompanyId) || null;
  }, [selectedCompanyId, companies]);

  const selectedClient = useMemo(
    () => (selectedCompany ? mapHqCompanyToClient(selectedCompany) : null),
    [selectedCompany],
  );

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

  const handleDeleteCompany = async (companyId: string) => {
    if (!window.confirm('Delete this HQ company? This cannot be undone.')) return;
    try {
      await apiHqDeleteCompany(companyId);
      setSelectedCompanyId(null);
      await loadCompanies();
      toast.success('Company deleted');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete company');
    }
  };

  const openCreateTenantFromCompany = (company: HqCompanyApiRow) => {
    if (company.tenantDbName) {
      toast.error(`Company already linked to tenant ${company.tenantDbName}`);
      return;
    }
    setProvisionData(provisionFormFromCompany(company));
    setLockCompanyForTenant(true);
    setSelectedCompanyId(null);
    setCreateTenantOpen(true);
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (provisionData.enabledModules.length === 0) {
      toast.error('Select at least one CRM or Recruitment tab');
      return;
    }
    if (provisionData.source === 'company' && !provisionData.companyId) {
      toast.error('Select an HQ company');
      return;
    }
    setProvisionLoading(true);
    try {
      const maxUsers = provisionData.maxUsers ? Number(provisionData.maxUsers) : null;
      const maxJobs = provisionData.maxJobs ? Number(provisionData.maxJobs) : null;
      const res = await apiHqProvisionTenant({
        name: provisionData.name.trim(),
        email: provisionData.email.trim().toLowerCase(),
        loginId: provisionData.loginId.trim(),
        password: provisionData.password,
        organizationType: provisionData.organizationType,
        productLine: provisionData.productLine,
        enabledModules: provisionData.enabledModules,
        phase1CommonPoolEnabled: provisionData.phase1CommonPoolEnabled !== false,
        billingCycle: provisionData.billingCycle,
        planStartDate: provisionData.planStartDate || undefined,
        planEndDate: provisionData.planEndDate || undefined,
        companyId:
          provisionData.source === 'company' && provisionData.companyId
            ? provisionData.companyId
            : undefined,
        plan: {
          name: provisionData.planName,
          billingCycle: provisionData.billingCycle,
          planStartDate: provisionData.planStartDate || undefined,
          planEndDate: provisionData.planEndDate || undefined,
          ...(provisionData.customPrice ? { price: provisionData.customPrice } : {}),
          ...(maxUsers ? { maxUsers } : {}),
          ...(maxJobs ? { maxJobs } : {}),
          ...(provisionData.coins ? { coins: Number(provisionData.coins) || 0 } : {}),
        },
      });
      toast.success(
        `Tenant created${res.data?.tenantDbName ? `: ${res.data.tenantDbName}` : ''}.`,
      );
      setCreateTenantOpen(false);
      setProvisionData(emptyProvisionTenantForm());
      setLockCompanyForTenant(false);
      await loadCompanies();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create tenant');
    } finally {
      setProvisionLoading(false);
    }
  };

  return (
    <HqModulePageLayout
      title="Companies"
      subtitle="Lead → Client → Company → Tenant. Converted leads land here; create a tenant from a company when ready."
      icon={<Building2 className="h-5 w-5" />}
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
              <HqSecondaryButton
                onClick={() => {
                  setProvisionData(emptyProvisionTenantForm({ source: 'company' }));
                  setLockCompanyForTenant(false);
                  setCreateTenantOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Create tenant
              </HqSecondaryButton>
              <HqPrimaryButton
                onClick={() => {
                  setSelectedCompanyId(null);
                  setAddProductLine('crm');
                  setCreateDrawerOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add New Company
              </HqPrimaryButton>
        </>
      }
      belowScroll={
        <>
          {createDrawerOpen ? (
            <HqProductLineDrawerBar
              value={addProductLine}
              onChange={setAddProductLine}
              entityLabel="client"
            />
          ) : null}
          <CreateTenantModal
            open={createTenantOpen}
            onClose={() => {
              if (provisionLoading) return;
              setCreateTenantOpen(false);
              setLockCompanyForTenant(false);
            }}
            data={provisionData}
            onChange={setProvisionData}
            onSubmit={handleProvisionSubmit}
            isLoading={provisionLoading}
            lockCompany={lockCompanyForTenant}
          />
          {(createDrawerOpen || selectedClient) ? (
            <ClientDetailsDrawer
              client={createDrawerOpen ? null : selectedClient}
              isAddMode={createDrawerOpen}
              initialMode="view"
              createClientOverride={handleCreateCompanyOverride}
              updateClientOverride={handleUpdateClientOverride}
              onDelete={handleDeleteCompany}
              onCreateTenant={
                createDrawerOpen || selectedCompany?.tenantDbName
                  ? undefined
                  : (clientId) => {
                      const company = companies.find((item) => item.id === clientId);
                      if (company) openCreateTenantFromCompany(company);
                    }
              }
              onClose={() => {
                setCreateDrawerOpen(false);
                setSelectedCompanyId(null);
              }}
              onClientCreated={async () => {
                setCreateDrawerOpen(false);
                await loadCompanies();
                toast.success('Company created');
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
                          logo: patch.logo !== undefined ? patch.logo || '' : item.logo,
                        }
                      : item,
                  ),
                );
              }}
            />
          ) : null}
        </>
      }
    >

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

        <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
          <HqStatCard label="Total Companies" value={stats.total} />
          <HqStatCard label="Active" value={stats.active} delta="+12%" active />
          <HqStatCard label="Inactive" value={stats.inactive} />
          <HqStatCard label="On Hold" value={stats.onHold} />
          <HqStatCard label="Closed" value={stats.closed} />
          <HqStatCard label="Follow-ups Today" value={stats.followUpsToday} />
        </div>

        <div className={HQ_TABLE_CARD_CLASS}>
          <div className={HQ_TOOLBAR_ROW_CLASS}>
            <div className="flex min-w-max items-center gap-1 overflow-x-auto">
            {HQ_COMPANY_TABS.map((tab) => {
              const count = tabCounts[tab.id] ?? 0;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            </div>
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies by name, contact, or owner..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <HqSecondaryButton>
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </HqSecondaryButton>
          </div>

          <div className={HQ_TABLE_BODY_SCROLL_CLASS}>
            <table className="min-w-full text-left">
              <thead>
                <tr>
                  <th>
                    <span className="inline-flex items-center gap-1">
                      Company
                      <ArrowDownUp className="h-3 w-3 opacity-50" />
                    </span>
                  </th>
                  <th>Contact</th>
                  <th>Industry</th>
                  <th>Score</th>
                  <th>Users</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Next Follow-up</th>
                  <th className="w-10" />
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
                  filteredCompanies.map((company) => (
                    <tr
                      key={company.id}
                      onClick={() => setSelectedCompanyId(company.id)}
                      className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{company.name}</span>
                          {company.convertedFromLeadId || company.companyTag === 'converted_lead' ? (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                              From lead
                            </span>
                          ) : null}
                        </div>
                      </td>
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
                            setSelectedCompanyId(company.id);
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
        </div>
    </HqModulePageLayout>
  );
}
