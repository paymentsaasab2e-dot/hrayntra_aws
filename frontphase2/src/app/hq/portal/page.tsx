'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { matchesQuickSearch, buildQuickSearchHaystack } from '../../../lib/quickSearch';
import {
  Building2,
  CheckSquare,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  RefreshCw,
  Rss,
  Search,
  Square,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { requestConfirm } from '@/lib/appDialog';
import {
  HqModulePageLayout,
  HQ_TABLE_BODY_SCROLL_CLASS,
  HQ_TABLE_CARD_CLASS,
  HQ_TABLE_CLASS,
  HQ_TOOLBAR_ROW_CLASS,
  HQ_KPI_ROW_CLASS,
} from '@/components/hq/HqModulePageLayout';
import { HqPrimaryButton, HqSecondaryButton, HqStatCard } from '@/components/hq/hqUi';
import { HqPhase1ConnectionBar } from '@/components/hq/HqPhase1ConnectionBar';
import {
  apiHqDeletePortalJob,
  apiHqListPortal,
  apiHqListTenants,
  apiHqPushJobsToExternalFeeds,
  apiHqSetPortalJobClientVisibility,
  apiHqSyncTenantJobsToPhase1,
  type HqPortalJobRow,
  type HqPortalStats,
  type HqPortalStorageInfo,
  type HqTenantRow,
} from '@/lib/api';

const EMPTY_STATS: HqPortalStats = {
  totalCandidates: 0,
  portalCandidates: 0,
  commonCandidates: 0,
  phase2Candidates: 0,
  totalJobs: 0,
  phase2Jobs: 0,
  tenantJobs: 0,
  portalOnlyJobs: 0,
  tenantCount: 0,
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function JobOriginBadge({ origin }: { origin: HqPortalJobRow['origin'] }) {
  const label = origin === 'phase2_crm' ? 'Phase 2 only' : 'In Phase 1';
  const style =
    origin === 'phase2_crm'
      ? 'bg-violet-50 text-violet-700 ring-violet-200'
      : 'bg-emerald-50 text-emerald-700 ring-emerald-200';

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${style}`}
    >
      {label}
    </span>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
      {value}
    </span>
  );
}

const DELETE_BTN_CLASS =
  'inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50';

const VISIBILITY_BTN_CLASS =
  'inline-flex items-center justify-center rounded-lg border p-2 transition disabled:opacity-50';

function jobRowKey(row: HqPortalJobRow) {
  return `${row.origin}-${row.tenantDbName || 'none'}-${row.id}`;
}

function isClientNameVisible(row: HqPortalJobRow) {
  return row.showClientNamePublicly !== false;
}

function isSyncableJob(row: HqPortalJobRow) {
  return Boolean(row.tenantDbName);
}

function isMissingFromPhase1(row: HqPortalJobRow) {
  return row.origin === 'phase2_crm';
}

type TenantJobGroup = {
  tenantDbName: string;
  tenantName: string;
  jobs: HqPortalJobRow[];
  inPhase1: number;
  missingPhase1: number;
};

export default function HqPortalPage() {
  const [jobs, setJobs] = useState<HqPortalJobRow[]>([]);
  const [tenants, setTenants] = useState<HqTenantRow[]>([]);
  const [stats, setStats] = useState<HqPortalStats>(EMPTY_STATS);
  const [storage, setStorage] = useState<HqPortalStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deletingJobKey, setDeletingJobKey] = useState<string | null>(null);
  const [visibilityJobKey, setVisibilityJobKey] = useState<string | null>(null);
  const [bulkHiding, setBulkHiding] = useState(false);
  const [pushingFeeds, setPushingFeeds] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [activeTenantDb, setActiveTenantDb] = useState<string>('all');

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [portalResult, tenantsResult] = await Promise.all([
        apiHqListPortal(),
        apiHqListTenants().catch(() => null),
      ]);
      const d = portalResult.data;
      setJobs(d?.jobs ?? []);
      setStats(d?.stats ?? EMPTY_STATS);
      setStorage(d?.storage ?? null);
      setTenants(tenantsResult?.data?.tenants ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load portal data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const tenantNameByDb = useMemo(() => {
    const map = new Map<string, string>();
    for (const tenant of tenants) {
      const db = String(tenant.tenantDbName || '').trim();
      if (!db) continue;
      map.set(
        db,
        String(tenant.organizationName || tenant.name || tenant.email || db).trim() || db,
      );
    }
    return map;
  }, [tenants]);

  const needle = search.trim().toLowerCase();

  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (activeTenantDb !== 'all') {
      list = list.filter((row) => row.tenantDbName === activeTenantDb);
    }
    if (!needle) return list;
    return list.filter((row) => {
      const tenantLabel = tenantNameByDb.get(row.tenantDbName || '') || '';
      const hay = [
        row.title,
        row.company,
        row.clientName,
        row.location,
        row.status,
        row.workMode,
        row.tenantDbName,
        row.postedBy,
        row.visibility,
        row.origin,
        tenantLabel,
      ]
        .join(' ')
        .toLowerCase();
      return matchesQuickSearch(hay, needle);
    });
  }, [jobs, needle, activeTenantDb, tenantNameByDb]);

  const tenantGroups = useMemo(() => {
    const groups = new Map<string, TenantJobGroup>();
    for (const row of filteredJobs) {
      const db = String(row.tenantDbName || '').trim() || '__portal_only__';
      if (!groups.has(db)) {
        groups.set(db, {
          tenantDbName: db,
          tenantName:
            db === '__portal_only__'
              ? 'Phase 1 portal only (no tenant)'
              : tenantNameByDb.get(db) || db,
          jobs: [],
          inPhase1: 0,
          missingPhase1: 0,
        });
      }
      const group = groups.get(db)!;
      group.jobs.push(row);
      if (isMissingFromPhase1(row)) group.missingPhase1 += 1;
      else group.inPhase1 += 1;
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (a.tenantDbName === '__portal_only__') return 1;
      if (b.tenantDbName === '__portal_only__') return -1;
      return a.tenantName.localeCompare(b.tenantName);
    });
  }, [filteredJobs, tenantNameByDb]);

  const tenantFilterOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [{ value: 'all', label: 'All tenants' }];
    const seen = new Set<string>();
    for (const tenant of tenants) {
      const db = String(tenant.tenantDbName || '').trim();
      if (!db || seen.has(db)) continue;
      seen.add(db);
      options.push({
        value: db,
        label: String(tenant.organizationName || tenant.name || db).trim() || db,
      });
    }
    for (const db of storage?.phase2?.tenantDatabases || []) {
      const key = String(db || '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      options.push({ value: key, label: tenantNameByDb.get(key) || key });
    }
    return options;
  }, [tenants, storage, tenantNameByDb]);

  const syncableFiltered = useMemo(
    () => filteredJobs.filter((row) => isSyncableJob(row)),
    [filteredJobs],
  );
  const missingFiltered = useMemo(
    () => syncableFiltered.filter((row) => isMissingFromPhase1(row)),
    [syncableFiltered],
  );

  const selectedSyncJobs = useMemo(() => {
    return syncableFiltered.filter((row) => selectedKeys.has(jobRowKey(row)));
  }, [syncableFiltered, selectedKeys]);

  const hiddenClientCount = useMemo(
    () => filteredJobs.filter((row) => !isClientNameVisible(row)).length,
    [filteredJobs],
  );
  const visibleClientCount = filteredJobs.length - hiddenClientCount;

  const toggleSelected = (row: HqPortalJobRow) => {
    if (!isSyncableJob(row)) return;
    const key = jobRowKey(row);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllMissing = () => {
    setSelectedKeys(new Set(missingFiltered.map((row) => jobRowKey(row))));
  };

  const selectAllSyncable = () => {
    setSelectedKeys(new Set(syncableFiltered.map((row) => jobRowKey(row))));
  };

  const clearSelection = () => setSelectedKeys(new Set());

  const applyClientVisibilityToRow = (row: HqPortalJobRow, show: boolean) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === row.id &&
        job.tenantDbName === row.tenantDbName &&
        job.origin === row.origin
          ? { ...job, showClientNamePublicly: show, hqHideClientName: !show }
          : job,
      ),
    );
  };

  const handleToggleClientName = async (row: HqPortalJobRow) => {
    const nextShow = !isClientNameVisible(row);
    setVisibilityJobKey(jobRowKey(row));
    try {
      await apiHqSetPortalJobClientVisibility(row.id, {
        showClientNamePublicly: nextShow,
        tenantDbName: row.tenantDbName || undefined,
      });
      applyClientVisibilityToRow(row, nextShow);
      toast.success(
        nextShow
          ? 'Client name is now visible on Phase 1'
          : 'Client name hidden on Phase 1 job cards',
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update client name visibility',
      );
    } finally {
      setVisibilityJobKey(null);
    }
  };

  const handleBulkHideClientNames = async (show: boolean) => {
    const targets = filteredJobs.filter((row) => isClientNameVisible(row) !== show);
    if (targets.length === 0) {
      toast.info(show ? 'All shown jobs already display the client name.' : 'All shown jobs already hide the client name.');
      return;
    }

    const confirmed = await requestConfirm(
      `${show ? 'Show' : 'Hide'} the client name on Phase 1 for ${targets.length} job${
        targets.length === 1 ? '' : 's'
      }?\n\nThis affects the Phase 1 job cards and job detail pages.`,
      {
        tone: show ? 'info' : 'warning',
        title: show ? 'Show client names' : 'Hide client names',
        confirmLabel: show ? 'Show all' : 'Hide all',
        cancelLabel: 'Cancel',
      },
    );
    if (!confirmed) return;

    setBulkHiding(true);
    let failed = 0;
    for (const row of targets) {
      try {
        await apiHqSetPortalJobClientVisibility(row.id, {
          showClientNamePublicly: show,
          tenantDbName: row.tenantDbName || undefined,
        });
        applyClientVisibilityToRow(row, show);
      } catch {
        failed += 1;
      }
    }
    setBulkHiding(false);

    if (failed === 0) {
      toast.success(
        show
          ? `Client name shown on Phase 1 for ${targets.length} job(s)`
          : `Client name hidden on Phase 1 for ${targets.length} job(s)`,
      );
    } else {
      toast.error(`${failed} of ${targets.length} job(s) could not be updated`);
    }
  };

  const handlePushAllJobsToFeeds = async () => {
    const confirmed = await requestConfirm(
      `Push every currently open/published job into the public Adzuna and Careerjet feeds?\n\nThis uses the existing feed URLs — it does not create a new URL per job:\nhttps://api1.hryantra.com/api/adzuna/jobs.xml\nhttps://api1.hryantra.com/api/careerjet/jobs.xml\n\nDraft, deleted, closed, expired, and internal jobs stay out.`,
      {
        tone: 'info',
        title: 'Push jobs to Adzuna & Careerjet',
        confirmLabel: 'Push all jobs',
        cancelLabel: 'Cancel',
      },
    );
    if (!confirmed) return;

    setPushingFeeds(true);
    try {
      const result = await apiHqPushJobsToExternalFeeds();
      const data = result.data;
      const pushed = (data?.updated ?? 0) + (data?.alreadyInFeed ?? 0);
      toast.success(
        `Feeds updated. ${pushed} open job(s) will appear on Adzuna and Careerjet.` +
          (data?.skipped
            ? ` ${data.skipped} skipped (draft, closed, expired, or not public).`
            : ''),
      );
      void loadPortal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to push jobs to the feeds');
    } finally {
      setPushingFeeds(false);
    }
  };

  const handleSyncSelected = async () => {
    if (selectedSyncJobs.length === 0) {
      toast.info('Select one or more tenant jobs to sync to Phase 1.');
      return;
    }
    const missingCount = selectedSyncJobs.filter((row) => isMissingFromPhase1(row)).length;
    const confirmed = await requestConfirm(
      `Sync ${selectedSyncJobs.length} selected job(s) to Phase 1?\n\n` +
        `${missingCount} are currently Phase 2 only; the rest will be remirrored.\n` +
        `They will appear on the Phase 1 job portal after sync.`,
      {
        tone: 'info',
        title: 'Sync to Phase 1',
        confirmLabel: 'Sync selected',
        cancelLabel: 'Cancel',
      },
    );
    if (!confirmed) return;

    setSyncing(true);
    try {
      const result = await apiHqSyncTenantJobsToPhase1({
        jobs: selectedSyncJobs.map((row) => ({
          tenantDbName: row.tenantDbName,
          jobId: row.id,
        })),
      });
      const data = result.data;
      toast.success(
        `Synced ${data?.synced ?? 0} job(s) to Phase 1` +
          (data?.failed ? ` · ${data.failed} failed` : ''),
      );
      clearSelection();
      await loadPortal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync jobs to Phase 1');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteJob = async (row: HqPortalJobRow) => {
    const label = row.title || 'this job';
    const scope = row.tenantDbName
      ? `tenant ${row.tenantDbName}, Phase 1 portal, and Phase 2 CRM`
      : 'Phase 1 portal';

    const confirmed = await requestConfirm(
      `Delete "${label}" permanently?\n\nThis removes the job from ${scope}. This cannot be undone.`,
      {
        tone: 'warning',
        title: 'Delete portal job',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
      },
    );
    if (!confirmed) return;

    const rowKey = jobRowKey(row);
    setDeletingJobKey(rowKey);
    try {
      await apiHqDeletePortalJob(row.id, {
        tenantDbName: row.tenantDbName || undefined,
      });
      setJobs((prev) =>
        prev.filter(
          (job) =>
            !(
              job.id === row.id &&
              job.tenantDbName === row.tenantDbName &&
              job.origin === row.origin
            ),
        ),
      );
      toast.success('Job deleted from tenant and portal');
      void loadPortal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete job');
    } finally {
      setDeletingJobKey(null);
    }
  };

  return (
    <HqModulePageLayout
      title="Portal"
      subtitle="Compare Phase 2 tenant jobs with Phase 1, then sync missing jobs in bulk."
      icon={<Globe className="h-5 w-5" />}
      actions={
        <>
          <HqPrimaryButton
            onClick={() => void handleSyncSelected()}
            disabled={loading || syncing || selectedSyncJobs.length === 0}
            loading={syncing}
          >
            <UploadCloud className="h-4 w-4" />
            Sync selected to Phase 1
            {selectedSyncJobs.length ? ` (${selectedSyncJobs.length})` : ''}
          </HqPrimaryButton>
          <HqPrimaryButton
            onClick={() => void handlePushAllJobsToFeeds()}
            disabled={loading || pushingFeeds || bulkHiding || syncing}
            loading={pushingFeeds}
          >
            <Rss className="h-4 w-4" />
            Push all jobs to Adzuna & Careerjet
          </HqPrimaryButton>
          <HqSecondaryButton
            onClick={() => void handleBulkHideClientNames(true)}
            disabled={loading || bulkHiding || hiddenClientCount === 0}
          >
            <Eye className="h-4 w-4" />
            Show client names
          </HqSecondaryButton>
          <HqSecondaryButton
            onClick={() => void handleBulkHideClientNames(false)}
            disabled={loading || bulkHiding || visibleClientCount === 0}
          >
            {bulkHiding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            Hide client names
          </HqSecondaryButton>
          <HqSecondaryButton onClick={() => void loadPortal()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </HqSecondaryButton>
        </>
      }
    >
      <HqPhase1ConnectionBar
        live={!loadError && !loading}
        candidateCount={stats.totalCandidates}
        onRefresh={() => void loadPortal()}
        loading={loading}
        compact
      />

      {loadError ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {loadError}
          <button
            type="button"
            onClick={() => void loadPortal()}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className={HQ_KPI_ROW_CLASS}>
        <HqStatCard label="Total Jobs" value={stats.totalJobs} active />
        <HqStatCard label="Missing from Phase 1" value={stats.phase2Jobs} />
        <HqStatCard label="Tenant Jobs" value={stats.tenantJobs} />
        <HqStatCard label="Tenants" value={stats.tenantCount || tenants.length} />
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <Building2 className="h-3.5 w-3.5" />
            Tenants
          </div>
          <div className="max-h-[420px] space-y-1 overflow-auto">
            {tenantFilterOptions.map((option) => {
              const active = activeTenantDb === option.value;
              const group =
                option.value === 'all'
                  ? null
                  : tenantGroups.find((g) => g.tenantDbName === option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActiveTenantDb(option.value)}
                  className={`flex w-full items-start justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'bg-teal-50 text-teal-900 ring-1 ring-teal-200'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{option.label}</span>
                    {option.value !== 'all' ? (
                      <span className="block truncate text-[11px] text-slate-500">{option.value}</span>
                    ) : null}
                  </span>
                  {group ? (
                    <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {group.missingPhase1}/{group.jobs.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <div className={HQ_TABLE_CARD_CLASS}>
          <div className={HQ_TOOLBAR_ROW_CLASS}>
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search jobs by title, company, tenant…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HqSecondaryButton
                onClick={selectAllMissing}
                disabled={missingFiltered.length === 0 || syncing}
              >
                <CheckSquare className="h-4 w-4" />
                Select missing ({missingFiltered.length})
              </HqSecondaryButton>
              <HqSecondaryButton
                onClick={selectAllSyncable}
                disabled={syncableFiltered.length === 0 || syncing}
              >
                Select all tenant jobs
              </HqSecondaryButton>
              <HqSecondaryButton onClick={clearSelection} disabled={selectedKeys.size === 0 || syncing}>
                <Square className="h-4 w-4" />
                Clear
              </HqSecondaryButton>
              <p className="text-xs font-semibold text-slate-500">
                {loading ? 'Loading…' : `${filteredJobs.length} shown · ${selectedSyncJobs.length} selected`}
              </p>
            </div>
          </div>

          <div className={HQ_TABLE_BODY_SCROLL_CLASS}>
            {tenantGroups.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                {loading ? 'Loading jobs…' : 'No jobs found.'}
              </div>
            ) : (
              tenantGroups.map((group) => (
                <div key={group.tenantDbName} className="border-b border-slate-100 last:border-b-0">
                  <div className="sticky top-0 z-[1] flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/95 px-4 py-2.5 backdrop-blur">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{group.tenantName}</p>
                      {group.tenantDbName !== '__portal_only__' ? (
                        <p className="truncate text-[11px] text-slate-500">{group.tenantDbName}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">
                        In Phase 1: {group.inPhase1}
                      </span>
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700 ring-1 ring-violet-200">
                        Phase 2 only: {group.missingPhase1}
                      </span>
                    </div>
                  </div>

                  <table className={HQ_TABLE_CLASS}>
                    <thead>
                      <tr>
                        <th className="w-10">Sel</th>
                        <th>Job</th>
                        <th>Company</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Comparison</th>
                        <th>Openings</th>
                        <th>Posted</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.jobs.map((row) => {
                        const key = jobRowKey(row);
                        const syncable = isSyncableJob(row);
                        const selected = selectedKeys.has(key);
                        return (
                          <tr
                            key={key}
                            className="border-b border-slate-100 transition hover:bg-slate-50/60"
                          >
                            <td className="px-4 py-3">
                              {syncable ? (
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleSelected(row)}
                                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                  aria-label={`Select ${row.title}`}
                                />
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{row.title}</div>
                              {row.workMode ? (
                                <div className="mt-1 text-xs text-slate-500">{row.workMode}</div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              <div>{row.clientName || row.company}</div>
                              {!isClientNameVisible(row) ? (
                                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                                  <EyeOff className="h-3 w-3" />
                                  {row.hqHideClientName ? 'Hidden by HQ' : 'Hidden on Phase 1'}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{row.location || '—'}</td>
                            <td className="px-4 py-3">
                              <StatusPill value={row.status} />
                            </td>
                            <td className="px-4 py-3">
                              <JobOriginBadge origin={row.origin} />
                            </td>
                            <td className="px-4 py-3 text-slate-700">{row.openings}</td>
                            <td className="px-4 py-3 text-slate-500">{formatDate(row.postedDate)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  title={
                                    isClientNameVisible(row)
                                      ? 'Hide client name on Phase 1 job cards'
                                      : 'Show client name on Phase 1 job cards'
                                  }
                                  disabled={visibilityJobKey === key || bulkHiding}
                                  onClick={() => void handleToggleClientName(row)}
                                  className={`${VISIBILITY_BTN_CLASS} ${
                                    isClientNameVisible(row)
                                      ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  }`}
                                >
                                  {visibilityJobKey === key ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : isClientNameVisible(row) ? (
                                    <Eye className="h-4 w-4" />
                                  ) : (
                                    <EyeOff className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  title="Delete job from tenant and portal"
                                  disabled={deletingJobKey === key}
                                  onClick={() => void handleDeleteJob(row)}
                                  className={DELETE_BTN_CLASS}
                                >
                                  {deletingJobKey === key ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </HqModulePageLayout>
  );
}
